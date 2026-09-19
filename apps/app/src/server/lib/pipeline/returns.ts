import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { round3, type ApiCode } from "@kataria-syntex/shared";
import type { Db, Queryable } from "../db";
import {
  challans,
  jobWorkReturns,
  jobWorkReturnItems,
  stockEntries,
} from "../../db/schema";
import { validateMasters } from "../masters";
import { buildReturnStockStatements } from "../stock";
import { generateId } from "../token";
import {
  MasterRaceError,
  resolveReturnParty,
  toIso,
  type ValidatedMasters,
} from "./common";

export type ReturnItemInput = {
  challanId: string;
  denierId: string;
  colorId: string;
  lotNo: string;
  netWt: number;
  cones?: number | null;
};

export type ReturnCreateInput = {
  jobWorkerId: string;
  invoiceNo: string;
  date: string;
  remarks?: string;
  items: ReturnItemInput[];
};

export function buildReturnItems(
  validated: ValidatedMasters,
  returnItems: ReturnItemInput[],
  balances: Map<string, { sent: number; returned: number }>,
  returnId: string,
  nowIso: string,
) {
  const remainingByChallan = new Map<string, number>();
  const returnedSoFarByChallan = new Map<string, number>();
  for (const [cid, bal] of balances) {
    remainingByChallan.set(cid, round3(bal.sent - bal.returned));
    returnedSoFarByChallan.set(cid, bal.returned);
  }
  return returnItems.map((i, idx) => {
    const denier = validated.denierById.get(i.denierId);
    if (!denier) throw new MasterRaceError("invalid_denier");
    const color = validated.colorById.get(i.colorId);
    if (!color) throw new MasterRaceError("invalid_color");

    const bal = balances.get(i.challanId);
    const prevReturned = returnedSoFarByChallan.get(i.challanId) ?? 0;
    const currentTotalReturned = round3(prevReturned + i.netWt);
    if (bal && bal.sent > 0) {
      // Over-receipt sanity cap (A34): yarn returns against an outward challan
      // cannot exceed 200% of outward sent weight (or sent + 50 kg for small sample
      // challans). Prevents catastrophic typos from inflating stock.
      const maxAllowed = round3(Math.max(bal.sent * 2, bal.sent + 50));
      if (currentTotalReturned > maxAllowed) {
        throw new MasterRaceError("over_receipt_exceeded");
      }
    }
    returnedSoFarByChallan.set(i.challanId, currentTotalReturned);

    const remainingBefore = remainingByChallan.get(i.challanId) ?? 0;
    const overReceipt = i.netWt > remainingBefore;
    const overReceiptQty = overReceipt
      ? round3(i.netWt - remainingBefore)
      : null;
    // Consume this item's qty so sibling items against the same challan
    // in the SAME submission are measured against what actually remains.
    remainingByChallan.set(i.challanId, round3(remainingBefore - i.netWt));
    return {
      id: generateId(),
      returnId,
      challanId: i.challanId,
      seq: idx + 1,
      denierId: i.denierId,
      denierName: denier.name,
      colorId: i.colorId,
      colorName: color.name,
      colorCode: color.code,
      lotNo: i.lotNo,
      netWt: round3(i.netWt),
      cones: i.cones ?? null,
      overReceipt,
      overReceiptQty,
      createdAt: nowIso,
    };
  });
}

export type ReturnItemRow = ReturnType<typeof buildReturnItems>[number];

/** Grouped returned net weight per challan (2 round-trips become 1).
 * `excludeReturnId` drops one return's items (edit path — its old items still
 * exist until the batch commits). */
export async function returnedTotalsByChallan(
  d: Queryable,
  challanIds: string[],
  excludeReturnId?: string,
): Promise<Map<string, number>> {
  const returnConds = [inArray(jobWorkReturnItems.challanId, challanIds)];
  if (excludeReturnId)
    returnConds.push(ne(jobWorkReturnItems.returnId, excludeReturnId));
  const returnRows = await d
    .select({
      challanId: jobWorkReturnItems.challanId,
      total: sql<number>`COALESCE(SUM(${jobWorkReturnItems.netWt}), 0)`.mapWith(
        Number,
      ),
    })
    .from(jobWorkReturnItems)
    .where(and(...returnConds))
    .groupBy(jobWorkReturnItems.challanId);
  return new Map(returnRows.map((r) => [r.challanId, round3(r.total)]));
}

/**
 * Job-work balance list: outward challans for a workspace with
 * sent/returned/balance computed from one batched totals query.
 * Single formula shared by `GET /reports/job-work-balance` and
 * `GET /returns/balance/:jobWorkerId` — callers project their own envelope.
 */
export type JobWorkBalanceRow = {
  challanId: string;
  challanNumber: string;
  date: string;
  jobWorkerId: string | null;
  jobWorkerName: string | null;
  sent: number;
  returned: number;
  balance: number;
};

export async function jobWorkBalances(
  d: Queryable,
  workspaceId: string,
  opts: { jobWorkerId?: string; from?: string; to?: string } = {},
): Promise<JobWorkBalanceRow[]> {
  const conds = [
    eq(challans.workspaceId, workspaceId),
    eq(challans.type, "outward"),
  ];
  if (opts.jobWorkerId) conds.push(eq(challans.jobWorkerId, opts.jobWorkerId));
  if (opts.from) conds.push(gte(challans.date, opts.from));
  if (opts.to) conds.push(lte(challans.date, opts.to));
  const rows = await d
    .select({
      id: challans.id,
      challanNumber: challans.challanNumber,
      date: challans.date,
      jobWorkerId: challans.jobWorkerId,
      jobWorkerName: challans.jobWorkerName,
      totalNetWt: challans.totalNetWt,
    })
    .from(challans)
    .where(and(...conds))
    .orderBy(asc(challans.date));
  if (rows.length === 0) return [];
  const returnedMap = await returnedTotalsByChallan(
    d,
    rows.map((r) => r.id),
  );
  return rows.map((r) => {
    const returned = returnedMap.get(r.id) ?? 0;
    return {
      challanId: r.id,
      challanNumber: r.challanNumber,
      date: r.date,
      jobWorkerId: r.jobWorkerId,
      jobWorkerName: r.jobWorkerName,
      sent: r.totalNetWt,
      returned,
      balance: round3(r.totalNetWt - returned),
    };
  });
}

/**
 * Batched balance for N challans at once: reads challan header sent weights
 * and one grouped SUM query for returns, regardless of N. `excludeReturnId`
 * drops one return's items (edit path — its old items still exist until the
 * batch commits).
 */
export async function getChallanBalances(
  d: Queryable,
  challanIds: string[],
  excludeReturnId?: string,
): Promise<Map<string, { sent: number; returned: number }>> {
  const result = new Map<string, { sent: number; returned: number }>();
  if (challanIds.length === 0) return result;
  for (const cid of challanIds) result.set(cid, { sent: 0, returned: 0 });

  const sentRows = await d
    .select({
      id: challans.id,
      totalNetWt: challans.totalNetWt,
    })
    .from(challans)
    .where(inArray(challans.id, challanIds));
  for (const r of sentRows) {
    const cur = result.get(r.id);
    if (cur) cur.sent = r.totalNetWt;
  }

  const returnedMap = await returnedTotalsByChallan(
    d,
    challanIds,
    excludeReturnId,
  );
  for (const [challanId, total] of returnedMap) {
    const cur = result.get(challanId);
    if (cur) cur.returned = total;
  }

  return result;
}

export async function createReturn(
  d: Db,
  workspaceId: string,
  userId: string,
  input: ReturnCreateInput,
): Promise<{ ok: true; returnId: string } | { error: ApiCode }> {
  const party = await resolveReturnParty(d, workspaceId, input);
  if ("error" in party) return { error: party.error };

  const denierIds = [...new Set(input.items.map((i) => i.denierId))];
  const colorIds = [...new Set(input.items.map((i) => i.colorId))];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error };

  const nowIso = toIso(new Date());
  const returnId = generateId();
  const challanIds = [...new Set(input.items.map((i) => i.challanId))];
  const balances = await getChallanBalances(d, challanIds);
  let items: ReturnItemRow[];
  try {
    items = buildReturnItems(
      validated,
      input.items,
      balances,
      returnId,
      nowIso,
    );
  } catch (err) {
    if (err instanceof MasterRaceError) return { error: err.code };
    throw err;
  }

  await d.batch([
    d.insert(jobWorkReturns).values({
      id: returnId,
      workspaceId,
      jobWorkerId: input.jobWorkerId,
      jobWorkerName: party.jobWorker.name,
      invoiceNo: input.invoiceNo,
      date: input.date,
      remarks: input.remarks || null,
      receivedBy: userId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
    ...items.map((it) => d.insert(jobWorkReturnItems).values(it)),
    ...buildReturnStockStatements(
      d,
      workspaceId,
      returnId,
      items,
      input.date,
      nowIso,
    ),
  ]);

  return { ok: true as const, returnId };
}

/**
 * Full return update: re-resolves the job worker and challans, rebuilds item
 * snapshots and dyed stock movements, and replaces the item rows — one atomic
 * batch. The balance excludes this return's own items (this edit replaces
 * them), and consumed dyed stock locks the return.
 */
export async function updateReturn(
  d: Db,
  workspaceId: string,
  id: string,
  input: ReturnCreateInput,
): Promise<
  | { ok: true; returnId: string; items: ReturnItemRow[] }
  | { error: ApiCode; status?: 400 | 404 }
> {
  const existingRows = await d
    .select()
    .from(jobWorkReturns)
    .where(
      and(
        eq(jobWorkReturns.id, id),
        eq(jobWorkReturns.workspaceId, workspaceId),
      ),
    );
  const existing = existingRows[0];
  if (!existing) return { error: "not_found", status: 404 };

  // Return updates unconditionally rebuild their "in" stock rows (see batch below).
  const party = await resolveReturnParty(d, workspaceId, input);
  if ("error" in party) return { error: party.error };

  const denierIds = [...new Set(input.items.map((i) => i.denierId))];
  const colorIds = [...new Set(input.items.map((i) => i.colorId))];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error };

  const nowIso = toIso(new Date());
  const challanIds = [...new Set(input.items.map((i) => i.challanId))];
  const balances = await getChallanBalances(d, challanIds, existing.id);
  let items: ReturnItemRow[];
  try {
    items = buildReturnItems(
      validated,
      input.items,
      balances,
      existing.id,
      nowIso,
    );
  } catch (err) {
    if (err instanceof MasterRaceError) return { error: err.code };
    throw err;
  }

  // Delete old items + stock movements, then recreate — one atomic D1 batch,
  // no reads in between.
  await d.batch([
    d
      .delete(stockEntries)
      .where(
        and(
          eq(stockEntries.sourceRefId, existing.id),
          eq(stockEntries.workspaceId, workspaceId),
        ),
      ),
    d
      .delete(jobWorkReturnItems)
      .where(eq(jobWorkReturnItems.returnId, existing.id)),
    d
      .update(jobWorkReturns)
      .set({
        jobWorkerId: input.jobWorkerId,
        jobWorkerName: party.jobWorker.name,
        invoiceNo: input.invoiceNo,
        date: input.date,
        remarks: input.remarks || null,
        updatedAt: nowIso,
      })
      .where(eq(jobWorkReturns.id, existing.id)),
    ...items.map((it) => d.insert(jobWorkReturnItems).values(it)),
    ...buildReturnStockStatements(
      d,
      workspaceId,
      existing.id,
      items,
      input.date,
      nowIso,
    ),
  ]);

  return { ok: true as const, returnId: existing.id, items };
}
