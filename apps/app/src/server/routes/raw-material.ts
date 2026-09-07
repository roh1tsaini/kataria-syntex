import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { rawMaterialEntries, rawMaterialItems } from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { createRawMaterial, updateRawMaterial } from "../lib/document-pipeline";
import { dateStringSchema } from "@kataria-syntex/shared";
import { apiError } from "../lib/api-error";

export const rawMaterialRoute = new Hono<PermsEnv & { Bindings: Env }>();

rawMaterialRoute.use("*", requireAuth, resolveMember());

const rawItemSchema = z
  .object({
    denierId: z.string().min(1),
    colorId: z.string().min(1),
    netWt: z.number().positive().max(1_000_000),
    grossWt: z.number().min(0).max(1_000_000).optional(),
    tareWt: z.number().min(0).max(1_000_000).optional(),
    cones: z.number().int().min(0).max(1_000_000).optional(),
    lotNo: z.string().trim().max(100).default(""),
    boxNo: z.string().trim().max(60).default(""),
    packingUnit: z.enum(["bags", "boxes"]).optional(),
    packingCount: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((i) => !i.packingCount || !!i.packingUnit, {
    message: "packing_unit_required",
  });

const rawBody = z.object({
  supplierId: z.string().min(1).optional(),
  supplierChallanNo: z.string().trim().max(100).optional().default(""),
  date: dateStringSchema,
  notes: z.string().trim().max(500).optional().default(""),
  items: z.array(rawItemSchema).min(1).max(200),
});

// ── List ────────────────────────────────────────────────────────────────────

rawMaterialRoute.get("/", async (c) => {
  const workspaceId = c.get("member").workspaceId;

  const rows = await getDb(c.env.DB)
    .select()
    .from(rawMaterialEntries)
    .where(eq(rawMaterialEntries.workspaceId, workspaceId))
    .orderBy(desc(rawMaterialEntries.date), desc(rawMaterialEntries.createdAt));

  return c.json({ items: rows });
});

// ── Detail ──────────────────────────────────────────────────────────────────

rawMaterialRoute.get("/:id", async (c) => {
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);
  const headerRows = await db
    .select()
    .from(rawMaterialEntries)
    .where(
      and(
        eq(rawMaterialEntries.id, c.req.param("id")),
        eq(rawMaterialEntries.workspaceId, workspaceId),
      ),
    );
  const header = headerRows[0];
  if (!header) return apiError(c, "not_found", 404);

  const items = await db
    .select()
    .from(rawMaterialItems)
    .where(eq(rawMaterialItems.entryId, header.id))
    .orderBy(asc(rawMaterialItems.seq));

  return c.json({ entry: header, items });
});

// ── Create ──────────────────────────────────────────────────────────────────

rawMaterialRoute.post(
  "/",
  requirePermission("create_raw_material"),
  async (c) => {
    const parsed = rawBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return apiError(c, "invalid_request", 400);
    const workspaceId = c.get("member").workspaceId;
    const result = await createRawMaterial(
      getDb(c.env.DB),
      workspaceId,
      c.get("auth").userId,
      parsed.data,
    );
    if ("error" in result) return apiError(c, result.error, 400);
    return c.json({
      ok: true,
      entryId: result.entryId,
      entryNumber: result.entryNumber,
      fyLabel: result.fyLabel,
    });
  },
);

// ── Update ──────────────────────────────────────────────────────────────────

rawMaterialRoute.put(
  "/:id",
  requirePermission("edit_raw_material"),
  async (c) => {
    const parsed = rawBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return apiError(c, "invalid_request", 400);
    const result = await updateRawMaterial(
      getDb(c.env.DB),
      c.get("member").workspaceId,
      c.req.param("id"),
      parsed.data,
    );
    if ("error" in result)
      return apiError(c, result.error, result.status ?? 400);
    return c.json({ ok: true, entryId: result.entryId, items: result.items });
  },
);
