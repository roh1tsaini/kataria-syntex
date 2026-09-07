import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { summarizeStockLedger } from "../lib/stock";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";

export const stockRoute = new Hono<PermsEnv & { Bindings: Env }>();

stockRoute.use("*", requireAuth, resolveMember());

// ── Stock summary (raw or dyed) ──────────────────────────────────────────────

stockRoute.get("/", requirePermission("view_stock"), async (c) => {
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);
  const stockType = c.req.query("type") === "raw" ? "raw" : "dyed";

  const grouped = await summarizeStockLedger(db, workspaceId, stockType);

  const items = grouped.map((r) => ({
    denierId: r.denierId,
    denierName: r.denierName,
    colorId: r.colorId,
    colorName: r.colorName,
    colorCode: r.colorCode,
    lotNo: r.lotNo || "Unlabelled",
    totalWt: r.totalWt,
    movements: r.movements,
  }));
  return c.json({
    stockType,
    items: items.sort((a, b) => a.denierName.localeCompare(b.denierName)),
  });
});
