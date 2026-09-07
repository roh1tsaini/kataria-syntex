/**
 * Document Pipeline — deep module for all document creation.
 *
 * One interface, 4 adapters (sales/outward, raw, packing, returns).
 * Routes stay thin: parse → call pipeline → shape JSON.
 * Business logic lives here, testable without HTTP.
 *
 * Design: narrow interface, hidden implementation (validate → allocate → snapshot → insert → stock).
 * Each doc type is an adapter that supplies its 6 steps; the pipeline owns the
 * read-then-batch shape (D1 has no interactive transactions — every write set
 * commits as ONE db.batch()).
 */

import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  challanTotals,
  formatChallanNumber,
  formatEntryNumber,
  fyForDate,
  parseSeqFromNumber,
  round3,
  type ApiCode,
  type ChallanBody,
  type ChallanDto,
  type ChallanItemDto,
  type ChallanItemInput,
  type NumberingConfig,
} from "@kataria-syntex/shared";
import type { Db, Queryable } from "./db";
import {
  challanItems,
  challans,
  stockEntries,
  customers,
  financialYears,
  jobWorkers,
  jobWorkReturns,
  jobWorkReturnItems,
  packingEntries,
  packingItems,
  rawMaterialEntries,
  rawMaterialItems,
  suppliers,
} from "../db/schema";
import { toDate } from "./datetime";
import {
  allocateFyNumber,
  getOrCreateCompany,
  getOrCreateFyForDate,
  parseNumbering,
} from "./company";
import { validateMasters } from "./masters";
import {
  buildChallanStockStatements,
  buildRawStockStatements,
  buildReturnStockStatements,
} from "./stock";
import { generateId } from "./token";

// ── Common helpers ─────────────────────────────────────────────────────────

async function allocatedEntryNumber(
  d: Queryable,
  workspaceId: string,
  date: Date,
  type: "packing_s" | "packing_j" | "raw",
): Promise<{ entryNumber: string; fyId: string; fyLabel: string }> {
  const company = await getOrCreateCompany(d, workspaceId);
  const alloc = await allocateFyNumber(
    d,
    workspaceId,
    date,
    type,
    (config, seq) => formatEntryNumber(config, type, seq),
    parseNumbering(company.numbering),
  );
  return {
    entryNumber: alloc.number,
    fyId: alloc.fyId,
    fyLabel: alloc.fyLabel,
  };
}

/**
 * Counter CAS with retry. Must run BEFORE the caller's db.batch() — a failed
 * CAS (0 changes) does not error a batch, so the document writes would commit
 * against a number that was never allocated. Only after the CAS commits does
 * the caller collect its writes into the batch.
 */
async function allocatedChallanNumber(
  d: Queryable,
  workspaceId: string,
  date: Date,
  type: "sales" | "outward",
  config: NumberingConfig,
): Promise<{ challanNumber: string; fyId: string; fyLabel: string }> {
  const alloc = await allocateFyNumber(
    d,
    workspaceId,
    date,
    type,
    (cfg, seq, fyLabel) => formatChallanNumber(cfg, type, seq, fyLabel),
    config,
  );
  return {
    challanNumber: alloc.number,
    fyId: alloc.fyId,
    fyLabel: alloc.fyLabel,
  };
}

// ── Raw material ───────────────────────────────────────────────────────────

export type RawItemInput = {
  denierId: string;
  colorId: string;
  netWt: number;
  grossWt?: number | null;
  tareWt?: number | null;
  cones?: number | null;
  lotNo: string;
  boxNo?: string | null;
  packingUnit?: string | null;
  packingCount?: number | null;
};

export type RawCreateInput = {
  supplierId?: string;
  supplierChallanNo?: string;
  date: string;
  notes?: string;
  items: RawItemInput[];
};

type ValidatedMasters = Exclude<
  Awaited<ReturnType<typeof validateMasters>>,
  { error: ApiCode }
>;

async function resolveSupplier(
  d: Queryable,
  workspaceId: string,
  supplierId?: string,
): Promise<{ supplier?: typeof suppliers.$inferSelect; error?: ApiCode }> {
  if (!supplierId) return {};
  const rows = await d
    .select()
    .from(suppliers)
    .where(
      and(eq(suppliers.id, supplierId), eq(suppliers.workspaceId, workspaceId)),
    );
  if (!rows[0]) return { error: "invalid_supplier" };
  return { supplier: rows[0] };
}

function buildRawItems(
  validated: ValidatedMasters,
  rawItems: RawItemInput[],
  entryId: string,
  nowIso: string,
) {
  return rawItems.map((i, idx) => {
    const denier = validated.denierById.get(i.denierId)!;
    const color = validated.colorById.get(i.colorId)!;
    return {
      id: generateId(),
      entryId,
      seq: idx + 1,
      denierId: i.denierId,
      denierName: denier.name,
      colorId: i.colorId,
      colorName: color.name,
      colorCode: color.code,
      netWt: round3(i.netWt),
      grossWt: i.grossWt ?? null,
      tareWt: i.tareWt ?? null,
      cones: i.cones ?? null,
      lotNo: i.lotNo,
      boxNo: i.boxNo || null,
      packingUnit: i.packingUnit ?? null,
      packingCount: i.packingCount ?? null,
      createdAt: nowIso,
    };
  });
}

type RawItemRow = ReturnType<typeof buildRawItems>[number];

export async function createRawMaterial(
  d: Db,
  workspaceId: string,
  userId: string,
  input: RawCreateInput,
): Promise<
  | { ok: true; entryId: string; entryNumber: string; fyLabel: string }
  | { error: ApiCode }
> {
  const date = toDate(input.date);
  const party = await resolveSupplier(d, workspaceId, input.supplierId);
  if (party.error) return { error: party.error };

  const denierIds = [...new Set(input.items.map((i) => i.denierId))];
  const colorIds = [...new Set(input.items.map((i) => i.colorId))];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error };
  for (const c of validated.colorById.values()) {
    if (c.stockType !== "raw") return { error: "color_not_raw" };
  }

  // D1 has no interactive transactions — reads and the counter CAS commit
  // first, then every write goes out in ONE db.batch().
  const { entryNumber, fyId, fyLabel } = await allocatedEntryNumber(
    d,
    workspaceId,
    date,
    "raw",
  );
  const nowIso = new Date().toISOString();
  const entryId = generateId();
  const items = buildRawItems(validated, input.items, entryId, nowIso);

  await d.batch([
    d.insert(rawMaterialEntries).values({
      id: entryId,
      workspaceId,
      financialYearId: fyId,
      entryNumber,
      supplierId: party.supplier?.id ?? null,
      supplierName: party.supplier?.name ?? null,
      supplierChallanNo: input.supplierChallanNo || null,
      date: input.date,
      notes: input.notes || null,
      createdBy: userId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
    ...items.map((it) => d.insert(rawMaterialItems).values(it)),
    ...buildRawStockStatements(
      d,
      workspaceId,
      entryId,
      items,
      input.date,
      nowIso,
    ),
  ]);

  return { ok: true as const, entryId, entryNumber, fyLabel };
}

/**
 * Full raw-entry update: re-resolves supplier and masters, rebuilds item
 * snapshots and the raw stock movements, and replaces the item rows — all
 * writes commit in ONE batch. The number never moves across FYs, and an
 * entry whose raw stock was already consumed is locked.
 */
export async function updateRawMaterial(
  d: Db,
  workspaceId: string,
  id: string,
  input: RawCreateInput,
): Promise<
  | { ok: true; entryId: string; items: RawItemRow[] }
  | { error: ApiCode; status?: 400 | 404 }
> {
  const existingRows = await d
    .select()
    .from(rawMaterialEntries)
    .where(
      and(
        eq(rawMaterialEntries.id, id),
        eq(rawMaterialEntries.workspaceId, workspaceId),
      ),
    );
  const existing = existingRows[0];
  if (!existing) return { error: "not_found", status: 404 };

  // The number belongs to the FY it was issued in — a date change across FYs
  // is rejected.
  if (
    fyForDate(toDate(existing.date)).label !==
    fyForDate(toDate(input.date)).label
  )
    return { error: "fy_change_not_allowed" };

  // Raw updates unconditionally rebuild their "in" stock rows (see batch below).
  const party = await resolveSupplier(d, workspaceId, input.supplierId);
  if (party.error) return { error: party.error };

  const denierIds = [...new Set(input.items.map((i) => i.denierId))];
  const colorIds = [...new Set(input.items.map((i) => i.colorId))];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error };
  for (const c of validated.colorById.values()) {
    if (c.stockType !== "raw") return { error: "color_not_raw" };
  }

  const nowIso = new Date().toISOString();
  const items = buildRawItems(validated, input.items, existing.id, nowIso);

  await d.batch([
    d
      .delete(stockEntries)
      .where(
        and(
          eq(stockEntries.sourceRefId, existing.id),
          eq(stockEntries.workspaceId, workspaceId),
        ),
      ),
    d.delete(rawMaterialItems).where(eq(rawMaterialItems.entryId, existing.id)),
    d
      .update(rawMaterialEntries)
      .set({
        supplierId: party.supplier?.id ?? null,
        supplierName: party.supplier?.name ?? null,
        supplierChallanNo: input.supplierChallanNo || null,
        date: input.date,
        notes: input.notes || null,
        updatedAt: nowIso,
      })
      .where(eq(rawMaterialEntries.id, existing.id)),
    ...items.map((it) => d.insert(rawMaterialItems).values(it)),
    ...buildRawStockStatements(
      d,
      workspaceId,
      existing.id,
      items,
      input.date,
      nowIso,
    ),
  ]);

  return { ok: true as const, entryId: existing.id, items };
}

// ── Packing ────────────────────────────────────────────────────────────────

export type PackingItemInput = {
  denierId: string;
  colorId: string;
  tareWt?: number | null;
  grossWt?: number | null;
  sackWt?: number | null;
  sacks?: number | null;
  cones?: number | null;
  boxNo?: string | null;
  lotNo?: string | null;
  remarks?: string | null;
  netWt: number;
};

export type PackingCreateInput = {
  type: "sale" | "job_work";
  date: string;
  items: PackingItemInput[];
};

function buildPackingItems(
  validated: ValidatedMasters,
  packingItemsIn: PackingItemInput[],
  entryId: string,
  nowIso: string,
) {
  return packingItemsIn.map((i, idx) => {
    const denier = validated.denierById.get(i.denierId)!;
    const color = validated.colorById.get(i.colorId)!;
    return {
      id: generateId(),
      entryId,
      seq: idx + 1,
      denierId: i.denierId,
      denierName: denier.name,
      colorId: i.colorId,
      colorName: color.name,
      colorCode: color.code,
      tareWt: i.tareWt ?? null,
      grossWt: i.grossWt ?? null,
      sackWt: i.sackWt ?? null,
      sacks: i.sacks ?? null,
      cones: i.cones ?? null,
      boxNo: i.boxNo || null,
      lotNo: i.lotNo || null,
      remarks: i.remarks || null,
      netWt: round3(i.netWt),
      createdAt: nowIso,
    };
  });
}

type PackingItemRow = ReturnType<typeof buildPackingItems>[number];

export async function createPacking(
  d: Db,
  workspaceId: string,
  userId: string,
  input: PackingCreateInput,
): Promise<
  | { ok: true; entryId: string; entryNumber: string; fyLabel: string }
  | { error: ApiCode }
> {
  const date = toDate(input.date);

  const denierIds = [...new Set(input.items.map((i) => i.denierId))];
  const colorIds = [...new Set(input.items.map((i) => i.colorId))];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error };

  const numType = input.type === "sale" ? "packing_s" : "packing_j";
  const { entryNumber, fyId, fyLabel } = await allocatedEntryNumber(
    d,
    workspaceId,
    date,
    numType,
  );
  const nowIso = new Date().toISOString();
  const entryId = generateId();
  const items = buildPackingItems(validated, input.items, entryId, nowIso);

  await d.batch([
    d.insert(packingEntries).values({
      id: entryId,
      workspaceId,
      financialYearId: fyId,
      type: input.type,
      entryNumber,
      date: input.date,
      createdBy: userId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
    ...items.map((it) => d.insert(packingItems).values(it)),
  ]);

  return { ok: true as const, entryId, entryNumber, fyLabel };
}

/**
 * Full packing-entry update: revalidates masters and rebuilds the item rows —
 * one atomic batch. Packing writes no stock movements.
 */
export async function updatePacking(
  d: Db,
  workspaceId: string,
  id: string,
  input: PackingCreateInput,
): Promise<
  | { ok: true; entryId: string; items: PackingItemRow[] }
  | { error: ApiCode; status?: 400 | 404 }
> {
  const existingRows = await d
    .select()
    .from(packingEntries)
    .where(
      and(
        eq(packingEntries.id, id),
        eq(packingEntries.workspaceId, workspaceId),
      ),
    );
  const existing = existingRows[0];
  if (!existing) return { error: "not_found", status: 404 };

  // An entry never changes kind — the number belongs to the sale or job-work
  // series it was issued from.
  if (input.type !== existing.type) return { error: "type_change_not_allowed" };

  // The number belongs to the FY it was issued in — a date change across FYs
  // is rejected.
  if (
    fyForDate(toDate(existing.date)).label !==
    fyForDate(toDate(input.date)).label
  )
    return { error: "fy_change_not_allowed" };

  const denierIds = [...new Set(input.items.map((i) => i.denierId))];
  const colorIds = [...new Set(input.items.map((i) => i.colorId))];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error };

  const nowIso = new Date().toISOString();
  const items = buildPackingItems(validated, input.items, existing.id, nowIso);

  // Delete old items, recreate — one atomic D1 batch, no reads in between.
  await d.batch([
    d.delete(packingItems).where(eq(packingItems.entryId, existing.id)),
    d
      .update(packingEntries)
      .set({ date: input.date, updatedAt: nowIso })
      .where(eq(packingEntries.id, existing.id)),
    ...items.map((it) => d.insert(packingItems).values(it)),
  ]);

  return { ok: true as const, entryId: existing.id, items };
}

// ── Returns ────────────────────────────────────────────────────────────────

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

/** Resolves the receiving job worker and validates every referenced challan:
 * exists in the workspace, is outward, and belongs to that job worker. */
async function resolveReturnParty(
  d: Queryable,
  workspaceId: string,
  input: ReturnCreateInput,
): Promise<{ jobWorker: typeof jobWorkers.$inferSelect } | { error: ApiCode }> {
  const jwRows = await d
    .select()
    .from(jobWorkers)
    .where(
      and(
        eq(jobWorkers.id, input.jobWorkerId),
        eq(jobWorkers.workspaceId, workspaceId),
      ),
    );
  const jw = jwRows[0];
  if (!jw) return { error: "invalid_job_worker" };
  const challanIds = [...new Set(input.items.map((i) => i.challanId))];
  const challanRows = await d
    .select()
    .from(challans)
    .where(
      and(
        eq(challans.workspaceId, workspaceId),
        inArray(challans.id, challanIds),
      ),
    );
  if (challanRows.length !== challanIds.length)
    return { error: "invalid_challan" };
  for (const ch of challanRows) {
    if (ch.type !== "outward") return { error: "challan_not_outward" };
    if (ch.jobWorkerId !== input.jobWorkerId)
      return { error: "challan_job_worker_mismatch" };
  }
  return { jobWorker: jw };
}

function buildReturnItems(
  validated: ValidatedMasters,
  returnItems: ReturnItemInput[],
  balances: Map<string, { sent: number; returned: number }>,
  returnId: string,
  nowIso: string,
) {
  const remainingByChallan = new Map<string, number>();
  for (const [cid, bal] of balances)
    remainingByChallan.set(cid, round3(bal.sent - bal.returned));
  return returnItems.map((i, idx) => {
    const denier = validated.denierById.get(i.denierId)!;
    const color = validated.colorById.get(i.colorId)!;
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

type ReturnItemRow = ReturnType<typeof buildReturnItems>[number];

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
 * Batched balance for N challans at once: two grouped SUM queries total,
 * regardless of N. `excludeReturnId` drops one return's items (edit path —
 * its old items still exist until the batch commits).
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
      challanId: challanItems.challanId,
      total: sql<number>`COALESCE(SUM(${challanItems.netWt}), 0)`.mapWith(
        Number,
      ),
    })
    .from(challanItems)
    .where(inArray(challanItems.challanId, challanIds))
    .groupBy(challanItems.challanId);
  for (const r of sentRows) {
    const cur = result.get(r.challanId);
    if (cur) cur.sent = round3(r.total);
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

  const nowIso = new Date().toISOString();
  const returnId = generateId();
  const challanIds = [...new Set(input.items.map((i) => i.challanId))];
  const balances = await getChallanBalances(d, challanIds);
  const items = buildReturnItems(
    validated,
    input.items,
    balances,
    returnId,
    nowIso,
  );

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

  const nowIso = new Date().toISOString();
  const challanIds = [...new Set(input.items.map((i) => i.challanId))];
  const balances = await getChallanBalances(d, challanIds, existing.id);
  const items = buildReturnItems(
    validated,
    input.items,
    balances,
    existing.id,
    nowIso,
  );

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

// ── Challans (sales/outward) ───────────────────────────────────────────────

export type ChallanCreateInput = ChallanBody;

async function resolveParty(
  d: Queryable,
  workspaceId: string,
  input: ChallanCreateInput,
): Promise<{
  customer?: typeof customers.$inferSelect | null;
  jobWorker?: typeof jobWorkers.$inferSelect | null;
  error?: ApiCode;
}> {
  if (input.type === "sales") {
    if (!input.customerId) return { error: "invalid_request" };
    const rows = await d
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, input.customerId),
          eq(customers.workspaceId, workspaceId),
        ),
      );
    if (!rows[0]) return { error: "invalid_customer" };
    return { customer: rows[0], jobWorker: null };
  }
  if (!input.jobWorkerId) return { error: "invalid_request" };
  const rows = await d
    .select()
    .from(jobWorkers)
    .where(
      and(
        eq(jobWorkers.id, input.jobWorkerId),
        eq(jobWorkers.workspaceId, workspaceId),
      ),
    );
  if (!rows[0]) return { error: "invalid_job_worker" };
  return { customer: null, jobWorker: rows[0] };
}

type ChallanItemRow = typeof challanItems.$inferSelect;

async function buildChallanItems(
  d: Queryable,
  workspaceId: string,
  challanId: string,
  rawItems: ChallanItemInput[],
  nowIso: string,
): Promise<{ items: ChallanItemRow[]; error?: ApiCode }> {
  const denierIds = [...new Set(rawItems.map((i) => i.denierId))];
  const colorIds = [
    ...new Set(
      rawItems.map((i) => i.colorId).filter((id): id is string => !!id),
    ),
  ];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error, items: [] };
  const items = rawItems.map((i, idx) => {
    const denier = validated.denierById.get(i.denierId)!;
    const color = i.colorId ? validated.colorById.get(i.colorId) : null;
    return {
      id: generateId(),
      challanId,
      seq: idx + 1,
      denierId: i.denierId,
      denierName: denier.name,
      colorId: i.colorId || null,
      colorName: color?.name ?? "Raw / Undyed",
      colorCode: color?.code ?? null,
      boxNo: i.boxNo ?? "",
      lotNo: i.lotNo ?? "",
      cheese: i.cheese ?? 0,
      grossWt: round3(i.grossWt ?? 0),
      tareWt: round3(i.tareWt ?? 0),
      remarks: i.remarks ?? "",
      boxes: i.boxes,
      netWt: round3(i.netWt),
      createdAt: nowIso,
    };
  });
  return { items };
}

export type ChallanResult =
  | { ok: true; challan: ChallanRow; items: ChallanItemRow[] }
  | { error: ApiCode; suggestion?: string; status?: 409 };

export async function createChallan(
  d: Db,
  workspaceId: string,
  userId: string,
  input: ChallanCreateInput,
): Promise<ChallanResult> {
  const date = toDate(input.date);

  // Idempotency: an offline clientRef that already exists answers with the
  // stored challan instead of creating a duplicate.
  if (input.offline) {
    const rows = await d
      .select()
      .from(challans)
      .where(
        and(
          eq(challans.workspaceId, workspaceId),
          eq(challans.clientRef, input.offline.clientRef),
        ),
      );
    const row = rows[0];
    if (row) {
      // Replay answers with the full stored document, not just the header.
      const storedItems = await d
        .select()
        .from(challanItems)
        .where(eq(challanItems.challanId, row.id))
        .orderBy(asc(challanItems.seq));
      return { ok: true as const, challan: row, items: storedItems };
    }
  }

  const party = await resolveParty(d, workspaceId, input);
  if (party.error) return { error: party.error };
  const nowIso = new Date().toISOString();
  const challanId = generateId();
  const built = await buildChallanItems(
    d,
    workspaceId,
    challanId,
    input.items,
    nowIso,
  );
  if (built.error) return { error: built.error };
  const items = built.items;
  const company = await getOrCreateCompany(d, workspaceId);
  const config = parseNumbering(company.numbering);

  let challanNumber: string;
  let fyId: string;
  let fyCatchUp: BatchItem<"sqlite"> | null = null;
  if (
    input.offline?.challanNumber != null &&
    input.offline.seq != null &&
    input.offline.fyLabel != null
  ) {
    const fyRow = await getOrCreateFyForDate(d, workspaceId, date);
    const fy = fyRow;
    if (fyRow.label !== input.offline.fyLabel) return { error: "fy_mismatch" };
    // Device-issued numbers must parse back to the claimed seq under the
    // workspace's numbering config — an arbitrary string would otherwise be
    // stored verbatim and inflate the FY counter.
    if (
      parseSeqFromNumber(
        config,
        input.type,
        input.offline.challanNumber,
        fyRow.label,
      ) !== input.offline.seq
    )
      return { error: "invalid_challan" };
    const clash = await d
      .select({ id: challans.id })
      .from(challans)
      .where(
        and(
          eq(challans.workspaceId, workspaceId),
          eq(challans.financialYearId, fy.id),
          eq(challans.challanNumber, input.offline.challanNumber),
        ),
      );
    if (clash.length) {
      const counter =
        input.type === "sales" ? fyRow.salesNext : fyRow.outwardNext;
      return {
        error: "challan_number_conflict",
        suggestion: formatChallanNumber(
          config,
          input.type,
          counter,
          fyRow.label,
        ),
        status: 409 as const,
      };
    }
    challanNumber = input.offline.challanNumber;
    fyId = fy.id;
    // Device-issued number: catch the counter up monotonically (no CAS —
    // it only ever moves forward) in the same batch as the inserts.
    const next = input.offline.seq + 1;
    fyCatchUp =
      input.type === "sales"
        ? d
            .update(financialYears)
            .set({
              salesNext: sql`max(${financialYears.salesNext}, ${next})`,
            })
            .where(eq(financialYears.id, fy.id))
        : d
            .update(financialYears)
            .set({
              outwardNext: sql`max(${financialYears.outwardNext}, ${next})`,
            })
            .where(eq(financialYears.id, fy.id));
  } else {
    const alloc = await allocatedChallanNumber(
      d,
      workspaceId,
      date,
      input.type,
      config,
    );
    challanNumber = alloc.challanNumber;
    fyId = alloc.fyId;
  }

  const totals = challanTotals(items);
  const row = {
    id: challanId,
    workspaceId,
    financialYearId: fyId,
    type: input.type,
    challanNumber,
    date: input.date,
    customerId: party.customer?.id ?? null,
    customerName: party.customer?.name ?? null,
    customerGstin: party.customer?.gstin ?? null,
    jobWorkerId: party.jobWorker?.id ?? null,
    jobWorkerName: party.jobWorker?.name ?? null,
    notes: input.notes || null,
    totalBoxes: totals.totalBoxes,
    totalCheese: totals.totalCheese,
    totalGrossWt: totals.totalGrossWt,
    totalTareWt: totals.totalTareWt,
    totalNetWt: totals.totalNetWt,
    createdBy: userId,
    clientRef: input.offline?.clientRef ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const stockStmts = await buildChallanStockStatements(
    d,
    workspaceId,
    challanId,
    items,
    input.date,
    nowIso,
    input.type,
  );
  try {
    await d.batch([
      d.insert(challans).values(row),
      ...items.map((it) => d.insert(challanItems).values(it)),
      ...stockStmts,
      // Order irrelevant: the catch-up touches financial_years, whose row
      // already exists — it cannot conflict with the challan inserts.
      ...(fyCatchUp ? [fyCatchUp] : []),
    ]);
  } catch (err) {
    // The pre-batch clash check is TOCTOU — a concurrent insert can still
    // win. Surface the lost race as the same 409/conflict shape.
    const msg = err instanceof Error ? err.message : String(err);
    if (input.offline && /UNIQUE constraint failed/i.test(msg)) {
      return { error: "challan_number_conflict", status: 409 as const };
    }
    throw err;
  }
  return { ok: true as const, challan: row, items };
}

// ── Challan DTOs & update ────────────────────────────────────────────────────

export type ChallanRow = typeof challans.$inferSelect;

export function toChallanDto(row: ChallanRow, fyLabel: string): ChallanDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    financialYearId: row.financialYearId,
    type: row.type as "sales" | "outward",
    challanNumber: row.challanNumber,
    date: row.date,
    customerId: row.customerId,
    customerName: row.customerName,
    customerGstin: row.customerGstin,
    jobWorkerId: row.jobWorkerId,
    jobWorkerName: row.jobWorkerName,
    notes: row.notes,
    totalBoxes: row.totalBoxes,
    totalCheese: row.totalCheese,
    totalGrossWt: row.totalGrossWt,
    totalTareWt: row.totalTareWt,
    totalNetWt: row.totalNetWt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fyLabel,
  };
}

export function toItemDto(i: ChallanItemRow): ChallanItemDto {
  return {
    id: i.id,
    challanId: i.challanId,
    seq: i.seq,
    denierId: i.denierId as string,
    denierName: i.denierName,
    colorId: i.colorId,
    colorName: i.colorName,
    colorCode: i.colorCode,
    boxNo: i.boxNo,
    lotNo: i.lotNo,
    cheese: i.cheese,
    grossWt: i.grossWt,
    tareWt: i.tareWt,
    remarks: i.remarks,
    boxes: i.boxes,
    netWt: i.netWt,
    createdAt: i.createdAt,
  };
}

/**
 * Full challan update: re-resolves the party, rebuilds item snapshots and
 * stock movements, and replaces the item rows — all writes commit in ONE
 * batch. The kind never changes and the number never moves across FYs.
 */
export async function updateChallan(
  d: Db,
  workspaceId: string,
  id: string,
  input: ChallanCreateInput,
): Promise<
  | { ok: true; challan: ChallanDto; items: ChallanItemDto[] }
  | ({ error: ApiCode } & ({ status: 404 | 409 } | { status?: never }))
> {
  const existingRows = await d
    .select()
    .from(challans)
    .where(and(eq(challans.id, id), eq(challans.workspaceId, workspaceId)));
  const existing = existingRows[0];
  if (!existing) return { error: "not_found", status: 404 };

  // Same guard as challan delete: job_work_return_items.challan_id is a
  // non-cascading FK and the update rebuilds item rows + stock movements —
  // answer 409 instead of a 500.
  const returnRows = await d
    .select({ id: jobWorkReturnItems.id })
    .from(jobWorkReturnItems)
    .where(eq(jobWorkReturnItems.challanId, existing.id));
  if (returnRows.length > 0)
    return { error: "challan_has_returns", status: 409 };

  // A challan never changes kind (sales stays sales, outward stays outward).
  if (input.type !== existing.type) return { error: "type_change_not_allowed" };

  const date = toDate(input.date);
  // The number belongs to the FY it was issued in — a date change across FYs
  // is rejected.
  if (fyForDate(toDate(existing.date)).label !== fyForDate(date).label) {
    return { error: "fy_change_not_allowed" };
  }

  const party = await resolveParty(d, workspaceId, input);
  if (party.error) return { error: party.error };

  const nowIso = new Date().toISOString();
  const built = await buildChallanItems(
    d,
    workspaceId,
    existing.id,
    input.items,
    nowIso,
  );
  if (built.error) return { error: built.error };
  const t = challanTotals(built.items);

  // Recreate stock movements: delete old, create new — one atomic batch.
  const stockStmts = await buildChallanStockStatements(
    d,
    workspaceId,
    existing.id,
    built.items,
    input.date,
    nowIso,
    existing.type as "sales" | "outward",
  );

  // The response is built from known values — no read-back of what was just
  // written.
  const updated: ChallanRow = {
    ...existing,
    date: input.date,
    customerId: party.customer?.id ?? null,
    customerName: party.customer?.name ?? null,
    customerGstin: party.customer?.gstin ?? null,
    jobWorkerId: party.jobWorker?.id ?? null,
    jobWorkerName: party.jobWorker?.name ?? null,
    notes: input.notes || null,
    totalBoxes: t.totalBoxes,
    totalCheese: t.totalCheese,
    totalGrossWt: t.totalGrossWt,
    totalTareWt: t.totalTareWt,
    totalNetWt: t.totalNetWt,
    updatedAt: nowIso,
  };

  await d.batch([
    d.update(challans).set(updated).where(eq(challans.id, existing.id)),
    d
      .delete(stockEntries)
      .where(
        and(
          eq(stockEntries.sourceRefId, existing.id),
          eq(stockEntries.workspaceId, workspaceId),
        ),
      ),
    d.delete(challanItems).where(eq(challanItems.challanId, existing.id)),
    ...built.items.map((i) => d.insert(challanItems).values(i)),
    ...stockStmts,
  ]);

  return {
    ok: true,
    challan: toChallanDto(updated, fyForDate(date).label),
    items: built.items.map(toItemDto),
  };
}
