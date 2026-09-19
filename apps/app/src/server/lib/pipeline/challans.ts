import { and, asc, eq } from "drizzle-orm";
import {
  challanTotals,
  fyForDate,
  round3,
  type ApiCode,
  type ChallanBody,
  type ChallanDto,
  type ChallanItemDto,
  type ChallanItemInput,
} from "@kataria-syntex/shared";
import type { Db, Queryable } from "../db";
import {
  challanItems,
  challans,
  jobWorkReturnItems,
  stockEntries,
} from "../../db/schema";
import { validateMasters } from "../masters";
import { buildChallanStockStatements, StockRaceError } from "../stock";
import { generateId } from "../token";
import { getOrCreateCompany, parseNumbering } from "../company";
import {
  allocatedNumber,
  assertMatchingFy,
  resolveParty,
  toDate,
  toIso,
} from "./common";

export type ChallanCreateInput = ChallanBody;

export type ChallanItemRow = typeof challanItems.$inferSelect;

export async function buildChallanItems(
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
  const items: ChallanItemRow[] = [];
  for (const [idx, i] of rawItems.entries()) {
    const denier = validated.denierById.get(i.denierId);
    if (!denier) return { error: "invalid_denier", items: [] };
    const color = i.colorId ? validated.colorById.get(i.colorId) : null;
    if (i.colorId && !color) return { error: "invalid_color", items: [] };
    items.push({
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
    });
  }
  return { items };
}

export type ChallanRow = typeof challans.$inferSelect;

export type ChallanResult =
  | { ok: true; challan: ChallanRow; items: ChallanItemRow[] }
  | { error: ApiCode; status?: 400 | 404 | 409 };

export async function createChallan(
  d: Db,
  workspaceId: string,
  userId: string,
  input: ChallanCreateInput,
): Promise<ChallanResult> {
  const date = toDate(input.date);

  // Idempotency: a clientRef that already exists answers with the stored
  // challan instead of creating a duplicate.
  if (input.clientRef) {
    const rows = await d
      .select()
      .from(challans)
      .where(
        and(
          eq(challans.workspaceId, workspaceId),
          eq(challans.clientRef, input.clientRef),
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
  const nowIso = toIso(new Date());
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

  const alloc = await allocatedNumber(d, workspaceId, date, input.type, config);
  const challanNumber = alloc.number;
  const fyId = alloc.fyId;

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
    clientRef: input.clientRef ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const stockBuilt = await buildChallanStockStatements(
    d,
    workspaceId,
    challanId,
    items,
    input.date,
    nowIso,
    input.type,
  ).catch((err: unknown) => {
    if (err instanceof StockRaceError) return null;
    throw err;
  });
  if (!stockBuilt) return { error: "invalid_color" as const };
  const stockStmts = stockBuilt;
  await d.batch([
    d.insert(challans).values(row),
    ...items.map((it) => d.insert(challanItems).values(it)),
    ...stockStmts,
  ]);
  return { ok: true as const, challan: row, items };
}

// ── Challan DTOs & update ────────────────────────────────────────────────────

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
  // The number belongs to the FY it was issued in — a date change across FYs is rejected.
  if (!assertMatchingFy(date, existing.date)) {
    return { error: "fy_change_not_allowed" };
  }

  const party = await resolveParty(d, workspaceId, input);
  if (party.error) return { error: party.error };

  const nowIso = toIso(new Date());
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
  const stockBuiltUpdate = await buildChallanStockStatements(
    d,
    workspaceId,
    existing.id,
    built.items,
    input.date,
    nowIso,
    existing.type as "sales" | "outward",
  ).catch((err: unknown) => {
    if (err instanceof StockRaceError) return null;
    throw err;
  });
  if (!stockBuiltUpdate) return { error: "invalid_color" as const };
  const stockStmts = stockBuiltUpdate;

  // The response is built from known values — no read-back of what was just written.
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

  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/FOREIGN KEY constraint failed/i.test(msg)) {
      return { error: "challan_has_returns", status: 409 };
    }
    throw err;
  }

  return {
    ok: true,
    challan: toChallanDto(updated, fyForDate(date).label),
    items: built.items.map(toItemDto),
  };
}
