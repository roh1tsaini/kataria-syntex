import { Hono } from "hono";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { stockEntries } from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { round3 } from "@kataria-syntex/shared";

export const stockRoute = new Hono<PermsEnv & { Bindings: Env }>();

stockRoute.use("*", requireAuth, resolveMember());

// ── Stock summary (raw or dyed) ──────────────────────────────────────────────

stockRoute.get("/", requirePermission("view_stock"), async (c) => {
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);
  const stockType = c.req.query("type") === "raw" ? "raw" : "dyed";
  const denierId = c.req.query("denierId")?.trim();
  const colorId = c.req.query("colorId")?.trim();
  const dateFrom = c.req.query("from")?.trim();
  const dateTo = c.req.query("to")?.trim();

  const conditions = [
    eq(stockEntries.workspaceId, workspaceId),
    eq(stockEntries.stockType, stockType),
  ];
  if (denierId) conditions.push(eq(stockEntries.denierId, denierId));
  if (colorId) conditions.push(eq(stockEntries.colorId, colorId));
  if (dateFrom) conditions.push(gte(stockEntries.date, dateFrom));
  if (dateTo) conditions.push(lte(stockEntries.date, dateTo));

  const grouped = await db
    .select({
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
      stockEntries.denierId,
      stockEntries.denierName,
      stockEntries.colorId,
      stockEntries.colorName,
      stockEntries.colorCode,
      stockEntries.lotNo,
    );

  const items = grouped.map((r) => ({
    denierId: r.denierId,
    denierName: r.denierName,
    colorId: r.colorId,
    colorName: r.colorName,
    colorCode: r.colorCode,
    lotNo: r.lotNo || "Unlabelled",
    totalWt: round3(r.totalWt ?? 0),
    movements: r.movements ?? 0,
  }));
  return c.json({
    stockType,
    items: items.sort((a, b) => a.denierName.localeCompare(b.denierName)),
  });
});
