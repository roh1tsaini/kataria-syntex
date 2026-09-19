import { and, eq } from "drizzle-orm";
import { round3, type ApiCode } from "@kataria-syntex/shared";
import type { Db } from "../db";
import { packingEntries, packingItems } from "../../db/schema";
import { validateMasters } from "../masters";
import { generateId } from "../token";
import {
  allocatedNumber,
  assertMatchingFy,
  MasterRaceError,
  toDate,
  toIso,
  type ValidatedMasters,
} from "./common";

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

export function buildPackingItems(
  validated: ValidatedMasters,
  packingItemsIn: PackingItemInput[],
  entryId: string,
  nowIso: string,
) {
  return packingItemsIn.map((i, idx) => {
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

export type PackingItemRow = ReturnType<typeof buildPackingItems>[number];

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
  const {
    number: entryNumber,
    fyId,
    fyLabel,
  } = await allocatedNumber(d, workspaceId, date, numType);
  const nowIso = toIso(new Date());
  const entryId = generateId();
  let items: PackingItemRow[];
  try {
    items = buildPackingItems(validated, input.items, entryId, nowIso);
  } catch (err) {
    if (err instanceof MasterRaceError) return { error: err.code };
    throw err;
  }

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

  // An entry never changes kind — the number belongs to the sale or job-work series it was issued from.
  if (input.type !== existing.type) return { error: "type_change_not_allowed" };

  // The number belongs to the FY it was issued in — a date change across FYs is rejected.
  const date = toDate(input.date);
  if (!assertMatchingFy(date, existing.date)) {
    return { error: "fy_change_not_allowed" };
  }

  const denierIds = [...new Set(input.items.map((i) => i.denierId))];
  const colorIds = [...new Set(input.items.map((i) => i.colorId))];
  const validated = await validateMasters(d, workspaceId, denierIds, colorIds);
  if ("error" in validated) return { error: validated.error };

  const nowIso = toIso(new Date());
  let items: PackingItemRow[];
  try {
    items = buildPackingItems(validated, input.items, existing.id, nowIso);
  } catch (err) {
    if (err instanceof MasterRaceError) return { error: err.code };
    throw err;
  }

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
