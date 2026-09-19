import { and, eq } from "drizzle-orm";
import { round3, type ApiCode } from "@kataria-syntex/shared";
import type { Db } from "../db";
import {
  rawMaterialEntries,
  rawMaterialItems,
  stockEntries,
} from "../../db/schema";
import { validateMasters } from "../masters";
import { buildRawStockStatements } from "../stock";
import { generateId } from "../token";
import {
  allocatedNumber,
  assertMatchingFy,
  MasterRaceError,
  resolveSupplier,
  toDate,
  toIso,
  type ValidatedMasters,
} from "./common";

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

export function buildRawItems(
  validated: ValidatedMasters,
  rawItems: RawItemInput[],
  entryId: string,
  nowIso: string,
) {
  return rawItems.map((i, idx) => {
    const denier = validated.denierById.get(i.denierId);
    if (!denier) throw new MasterRaceError("invalid_denier");
    const color = validated.colorById.get(i.colorId);
    if (!color) throw new MasterRaceError("invalid_color");
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

export type RawItemRow = ReturnType<typeof buildRawItems>[number];

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
  const {
    number: entryNumber,
    fyId,
    fyLabel,
  } = await allocatedNumber(d, workspaceId, date, "raw");
  const nowIso = toIso(new Date());
  const entryId = generateId();
  let items: RawItemRow[];
  try {
    items = buildRawItems(validated, input.items, entryId, nowIso);
  } catch (err) {
    if (err instanceof MasterRaceError) return { error: err.code };
    throw err;
  }

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

  // The number belongs to the FY it was issued in — a date change across FYs is rejected.
  const date = toDate(input.date);
  if (!assertMatchingFy(date, existing.date)) {
    return { error: "fy_change_not_allowed" };
  }

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

  const nowIso = toIso(new Date());
  let items: RawItemRow[];
  try {
    items = buildRawItems(validated, input.items, existing.id, nowIso);
  } catch (err) {
    if (err instanceof MasterRaceError) return { error: err.code };
    throw err;
  }

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
