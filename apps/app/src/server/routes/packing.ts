import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { packingEntries, packingItems } from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { dateStringSchema } from "@kataria-syntex/shared";
import { createPacking, updatePacking } from "../lib/document-pipeline";
import { apiError } from "../lib/api-error";
import { publishChanges } from "../realtime/publish";

export const packingRoute = new Hono<PermsEnv & { Bindings: Env }>();

packingRoute.use("*", requireAuth, resolveMember());

const packingItemSchema = z.object({
  denierId: z.string().min(1),
  colorId: z.string().min(1),
  // sale type
  tareWt: z.number().min(0).max(1_000_000).optional(),
  grossWt: z.number().min(0).max(1_000_000).optional(),
  // job_work type
  sackWt: z.number().min(0).max(1_000_000).optional(),
  sacks: z.number().int().min(0).max(100_000).optional(),
  // shared
  cones: z.number().int().min(0).max(1_000_000).optional(),
  boxNo: z.string().trim().max(50).optional().default(""),
  lotNo: z.string().trim().max(100).optional().default(""),
  remarks: z.string().trim().max(300).optional().default(""),
  netWt: z.number().positive().max(1_000_000),
});

const packingBody = z.object({
  type: z.enum(["sale", "job_work"]),
  date: dateStringSchema,
  items: z.array(packingItemSchema).min(1).max(200),
});

// ── List ────────────────────────────────────────────────────────────────────

packingRoute.get("/", async (c) => {
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);
  const type = c.req.query("type")?.trim();

  const conditions = [eq(packingEntries.workspaceId, workspaceId)];
  if (type === "sale" || type === "job_work")
    conditions.push(eq(packingEntries.type, type));

  const rows = await db
    .select()
    .from(packingEntries)
    .where(and(...conditions))
    .orderBy(desc(packingEntries.date), desc(packingEntries.createdAt));

  if (rows.length === 0) return c.json({ items: [] });
  const entryIds = rows.map((r) => r.id);
  const allItems = await db
    .select()
    .from(packingItems)
    .where(inArray(packingItems.entryId, entryIds))
    .orderBy(asc(packingItems.seq));
  const itemsByEntry = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByEntry.get(item.entryId);
    if (list) list.push(item);
    else itemsByEntry.set(item.entryId, [item]);
  }
  const result = rows.map((row) => ({
    ...row,
    items: itemsByEntry.get(row.id) ?? [],
  }));

  return c.json({ items: result });
});

// ── Detail ──────────────────────────────────────────────────────────────────

packingRoute.get("/:id", async (c) => {
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);
  const headerRows = await db
    .select()
    .from(packingEntries)
    .where(
      and(
        eq(packingEntries.id, c.req.param("id")),
        eq(packingEntries.workspaceId, workspaceId),
      ),
    );
  const header = headerRows[0];
  if (!header) return apiError(c, "not_found", 404);

  const items = await db
    .select()
    .from(packingItems)
    .where(eq(packingItems.entryId, header.id))
    .orderBy(asc(packingItems.seq));

  return c.json({
    entry: header,
    items,
  });
});

// ── Create ──────────────────────────────────────────────────────────────────

packingRoute.post("/", requirePermission("create_packing"), async (c) => {
  const parsed = packingBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const workspaceId = c.get("member").workspaceId;
  const result = await createPacking(
    getDb(c.env.DB),
    workspaceId,
    c.get("auth").userId,
    parsed.data,
  );
  if ("error" in result) return apiError(c, result.error, 400);
  publishChanges(
    c.env,
    c.executionCtx,
    workspaceId,
    c.req.header("x-client-id"),
    ["packing", "stock"],
  );
  return c.json({
    ok: true,
    entryId: result.entryId,
    entryNumber: result.entryNumber,
    fyLabel: result.fyLabel,
  });
});

// ── Update ──────────────────────────────────────────────────────────────────

packingRoute.put("/:id", requirePermission("edit_packing"), async (c) => {
  const parsed = packingBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const result = await updatePacking(
    getDb(c.env.DB),
    c.get("member").workspaceId,
    c.req.param("id"),
    parsed.data,
  );
  if ("error" in result) return apiError(c, result.error, result.status ?? 400);
  publishChanges(
    c.env,
    c.executionCtx,
    c.get("member").workspaceId,
    c.req.header("x-client-id"),
    ["packing", "stock"],
  );
  return c.json({ ok: true, entryId: result.entryId, items: result.items });
});
