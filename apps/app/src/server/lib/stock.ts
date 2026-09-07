import type { Queryable } from "./db";
import { colors, stockEntries } from "../db/schema";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { generateId } from "./token";
import { round3 } from "@kataria-syntex/shared";

/**
 * Stock writes are statement builders, not executions — the caller commits
 * them together with its other writes in ONE db.batch() (a single atomic D1
 * transaction). The sole read (stockType lookup) happens up front.
 */

type ChallanStockItem = {
  denierId: string | null;
  denierName: string;
  colorId: string | null;
  colorName: string;
  colorCode: string | null;
  lotNo: string;
  netWt: number;
};

type StockItem = {
  denierId: string;
  denierName: string;
  colorId: string;
  colorName: string;
  colorCode: string | null;
  lotNo: string;
  netWt: number;
};

export async function buildChallanStockStatements(
  d: Queryable,
  workspaceId: string,
  challanId: string,
  items: ChallanStockItem[],
  date: string,
  nowIso: string,
  type: "sales" | "outward",
) {
  // Batch fetch stockType for all colors in one query — fixes N+1
  const colorIds = [
    ...new Set(items.map((i) => i.colorId).filter(Boolean) as string[]),
  ];
  const rows = colorIds.length
    ? await d
        .select({ id: colors.id, stockType: colors.stockType })
        .from(colors)
        .where(
          and(
            eq(colors.workspaceId, workspaceId),
            inArray(colors.id, colorIds),
          ),
        )
    : [];
  const stockTypeById = new Map(rows.map((r) => [r.id, r.stockType]));
  return items.map((i) => {
    // No colour on the item = grey/undyed yarn — raw stock, never dyed.
    const stockType = i.colorId
      ? (stockTypeById.get(i.colorId) ?? "raw")
      : "raw";
    return d.insert(stockEntries).values({
      id: generateId(),
      workspaceId,
      stockType,
      denierId: i.denierId,
      denierName: i.denierName,
      colorId: i.colorId,
      colorName: i.colorName,
      colorCode: i.colorCode,
      lotNo: i.lotNo,
      movement: "out",
      source: type === "outward" ? "job_work_send" : "sales",
      sourceRefId: challanId,
      netWt: -round3(i.netWt),
      date,
      createdAt: nowIso,
    });
  });
}

export function buildRawStockStatements(
  d: Queryable,
  workspaceId: string,
  entryId: string,
  items: StockItem[],
  date: string,
  nowIso: string,
) {
  return items.map((item) =>
    d.insert(stockEntries).values({
      id: generateId(),
      workspaceId,
      stockType: "raw",
      denierId: item.denierId,
      denierName: item.denierName,
      colorId: item.colorId,
      colorName: item.colorName,
      colorCode: item.colorCode,
      lotNo: item.lotNo,
      movement: "in",
      source: "raw_entry",
      sourceRefId: entryId,
      netWt: round3(item.netWt),
      date,
      createdAt: nowIso,
    }),
  );
}

export function buildReturnStockStatements(
  d: Queryable,
  workspaceId: string,
  returnId: string,
  items: StockItem[],
  date: string,
  nowIso: string,
) {
  return items.map((item) =>
    d.insert(stockEntries).values({
      id: generateId(),
      workspaceId,
      stockType: "dyed",
      denierId: item.denierId,
      denierName: item.denierName,
      colorId: item.colorId,
      colorName: item.colorName,
      colorCode: item.colorCode,
      lotNo: item.lotNo,
      movement: "in",
      source: "job_work_return",
      sourceRefId: returnId,
      netWt: round3(item.netWt),
      date,
      createdAt: nowIso,
    }),
  );
}

export type StockLedgerRow = {
  stockType: string;
  denierId: string | null;
  denierName: string;
  colorId: string | null;
  colorName: string;
  colorCode: string | null;
  lotNo: string;
  totalWt: number;
  movements: number;
};

/**
 * Single canonical stock-ledger GROUP BY (denier×color×lot with summed
 * weight). Shared by `GET /stock` and `GET /reports/stock-summary` — callers
 * project their own envelope from these rows.
 */
export async function summarizeStockLedger(
  d: Queryable,
  workspaceId: string,
  stockType?: "raw" | "dyed",
  range?: { from?: string; to?: string },
): Promise<StockLedgerRow[]> {
  const conditions = [eq(stockEntries.workspaceId, workspaceId)];
  if (stockType) conditions.push(eq(stockEntries.stockType, stockType));
  if (range?.from) conditions.push(gte(stockEntries.date, range.from));
  if (range?.to) conditions.push(lte(stockEntries.date, range.to));
  const grouped = await d
    .select({
      stockType: stockEntries.stockType,
      denierId: stockEntries.denierId,
      denierName: stockEntries.denierName,
      colorId: stockEntries.colorId,
      colorName: stockEntries.colorName,
      colorCode: stockEntries.colorCode,
      lotNo: stockEntries.lotNo,
      totalWt: sql<number>`sum(${stockEntries.netWt})`.mapWith(Number),
      movements: sql<number>`count(*)`.mapWith(Number),
    })
    .from(stockEntries)
    .where(and(...conditions))
    .groupBy(
      stockEntries.stockType,
      stockEntries.denierId,
      stockEntries.denierName,
      stockEntries.colorId,
      stockEntries.colorName,
      stockEntries.colorCode,
      stockEntries.lotNo,
    );
  return grouped.map((r) => ({
    stockType: r.stockType,
    denierId: r.denierId,
    denierName: r.denierName,
    colorId: r.colorId,
    colorName: r.colorName,
    colorCode: r.colorCode,
    lotNo: r.lotNo,
    totalWt: round3(r.totalWt ?? 0),
    movements: r.movements ?? 0,
  }));
}
