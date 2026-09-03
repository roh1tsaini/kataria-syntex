import type { ApiCode } from "@kataria-syntex/shared";
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

import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db, Queryable } from "./db";
import {
  challanItemSources,
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
import {
  allocateEntryNumber,
  formatChallanNumber,
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
import {
  challanTotals,
  fyForDate,
  parseSeqFromNumber,
  round3,
  type ChallanBody,
  type ChallanDto,
  type ChallanItemDto,
  type ChallanItemInput,
} from "@kataria-syntex/shared";
import { toDate } from "./datetime";

// ── Common helpers ─────────────────────────────────────────────────────────

async function allocatedEntryNumber(
  d: Queryable,
  workspaceId: string,
  date: Date,
  type: "packing_s" | "packing_j" | "raw",
): Promise<{ entryNumber: string; fyId: string; fyLabel: string }> {
  const company = await getOrCreateCompany(d, workspaceId);
  return allocateEntryNumber(
    d,
    workspaceId,
    date,
    parseNumbering(company.numbering),
    type,
  );
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
): Promise<{ challanNumber: string; fyId: string; fyLabel: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const fyRow = await getOrCreateFyForDate(d, workspaceId, date);
    const company = await getOrCreateCompany(d, workspaceId);
    const config = parseNumbering(company.numbering);
    const seq = type === "sales" ? fyRow.salesNext : fyRow.outwardNext;
    const challanNumber = formatChallanNumber(config, type, seq, fyRow.label);
    const set =
      type === "sales" ? { salesNext: seq + 1 } : { outwardNext: seq + 1 };
    const counterCond =
      type === "sales"
        ? eq(financialYears.salesNext, seq)
        : eq(financialYears.outwardNext, seq);
    const res = await d
      .update(financialYears)
      .set(set)
      .where(and(eq(financialYears.id, fyRow.id), counterCond))
      .run();
    if (res.meta.changes === 1)
      return { challanNumber, fyId: fyRow.id, fyLabel: fyRow.label };
  }
  throw new Error("challan_number_conflict");
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

  let supplier: typeof suppliers.$inferSelect | undefined;
  if (input.supplierId) {
    const rows = await d
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.id, input.supplierId),
          eq(suppliers.workspaceId, workspaceId),
        ),
      );
    supplier = rows[0];
    if (!supplier) return { error: "invalid_supplier" };
  }

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

  const items = input.items.map((i, idx) => {
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
      boxNo: i.boxNo ?? null,
      packingUnit: i.packingUnit ?? null,
      packingCount: i.packingCount ?? null,
      createdAt: nowIso,
    };
  });

  await d.batch([
    d.insert(rawMaterialEntries).values({
      id: entryId,
      workspaceId,
      financialYearId: fyId,
      entryNumber,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
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

  const numType = input.type === "sale" ? "packing_s" : ("packing_j" as const);
  const { entryNumber, fyId, fyLabel } = await allocatedEntryNumber(
    d,
    workspaceId,
    date,
    numType as "packing_s" | "packing_j",
  );
  const nowIso = new Date().toISOString();
  const entryId = generateId();
  const items = input.items.map((i, idx) => {
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
      boxNo: i.boxNo ?? null,
      lotNo: i.lotNo ?? null,
      remarks: i.remarks ?? null,
      netWt: round3(i.netWt),
      createdAt: nowIso,
    };
  });

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
  for (const r of returnRows) {
    const cur = result.get(r.challanId);
    if (cur) cur.returned = round3(r.total);
  }

  return result;
}

export async function createReturn(
  d: Db,
  workspaceId: string,
  userId: string,
  input: ReturnCreateInput,
): Promise<{ ok: true; returnId: string } | { error: ApiCode }> {
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
  const denierIds = [...new Set(input.items.map((i) => i.denierId))];
  const colorIds = [...new Set(input.items.map((i) => i.colorId))];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error };

  const nowIso = new Date().toISOString();
  const returnId = generateId();
  const balances = await getChallanBalances(d, challanIds);
  const remainingByChallan = new Map<string, number>();
  for (const [cid, bal] of balances)
    remainingByChallan.set(cid, round3(bal.sent - bal.returned));
  const items = input.items.map((i, idx) => {
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

  await d.batch([
    d.insert(jobWorkReturns).values({
      id: returnId,
      workspaceId,
      jobWorkerId: input.jobWorkerId,
      jobWorkerName: jw.name,
      invoiceNo: input.invoiceNo,
      date: input.date,
      remarks: input.remarks || null,
      receivedBy: userId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
    ...items.map((it) => d.insert(jobWorkReturnItems).values(it as never)),
    ...buildReturnStockStatements(
      d,
      workspaceId,
      returnId,
      items as never,
      input.date,
      nowIso,
    ),
  ]);

  return { ok: true as const, returnId };
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
    const existing = await d
      .select({ id: challans.id })
      .from(challans)
      .where(
        and(
          eq(challans.workspaceId, workspaceId),
          eq(challans.clientRef, input.offline.clientRef),
        ),
      );
    if (existing[0]) {
      const rows = await d
        .select()
        .from(challans)
        .where(eq(challans.id, existing[0].id));
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
    originDevice: input.offline?.originDevice ?? null,
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
      d.insert(challans).values(row as never),
      ...items.map((it) => d.insert(challanItems).values(it as never)),
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
  | ({ error: ApiCode } & ({ status: 404 } | { status?: never }))
> {
  const existingRows = await d
    .select()
    .from(challans)
    .where(and(eq(challans.id, id), eq(challans.workspaceId, workspaceId)));
  const existing = existingRows[0];
  if (!existing) return { error: "not_found", status: 404 };

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

  const oldItemRows = await d
    .select({ id: challanItems.id })
    .from(challanItems)
    .where(eq(challanItems.challanId, existing.id));
  const oldItemIds = oldItemRows.map((r) => r.id);

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
    ...(oldItemIds.length
      ? [
          d
            .delete(challanItemSources)
            .where(inArray(challanItemSources.challanItemId, oldItemIds)),
        ]
      : []),
    d.delete(challanItems).where(eq(challanItems.challanId, existing.id)),
    ...built.items.map((i) => d.insert(challanItems).values(i as never)),
    ...stockStmts,
  ]);

  return {
    ok: true,
    challan: toChallanDto(updated, fyForDate(date).label),
    items: built.items.map(toItemDto),
  };
}
