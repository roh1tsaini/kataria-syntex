import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import {
  rawMaterialEntries,
  rawMaterialItems,
  suppliers,
  stockEntries,
} from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { generateId } from "../lib/token";
import { buildRawStockStatements } from "../lib/stock";
import { createRawMaterial } from "../lib/document-pipeline";
import { round3, dateStringSchema, fyForDate } from "@kataria-syntex/shared";
import { validateMasters } from "../lib/masters";
import { toDate } from "../lib/datetime";
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
  const workspaceId = c.get("member")!.workspaceId;
  const supplierId = c.req.query("supplierId")?.trim();

  const conditions = [eq(rawMaterialEntries.workspaceId, workspaceId)];
  if (supplierId)
    conditions.push(eq(rawMaterialEntries.supplierId, supplierId));

  const rows = await getDb(c.env.DB)
    .select()
    .from(rawMaterialEntries)
    .where(and(...conditions))
    .orderBy(desc(rawMaterialEntries.date), desc(rawMaterialEntries.createdAt));

  return c.json({ items: rows });
});

// ── Detail ──────────────────────────────────────────────────────────────────

rawMaterialRoute.get("/:id", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
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
    const workspaceId = c.get("member")!.workspaceId;
    const result = await createRawMaterial(
      getDb(c.env.DB),
      workspaceId,
      c.get("auth")!.userId,
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
    const workspaceId = c.get("member")!.workspaceId;
    const db = getDb(c.env.DB);

    const existingRows = await db
      .select()
      .from(rawMaterialEntries)
      .where(
        and(
          eq(rawMaterialEntries.id, c.req.param("id")),
          eq(rawMaterialEntries.workspaceId, workspaceId),
        ),
      );
    const existing = existingRows[0];
    if (!existing) return apiError(c, "not_found", 404);

    // The number belongs to the FY it was issued in — a date change across
    // FYs is rejected.
    if (
      fyForDate(toDate(existing.date)).label !==
      fyForDate(toDate(parsed.data.date)).label
    )
      return apiError(c, "fy_change_not_allowed", 400);

    // Check stock not consumed
    const stockOut = await db
      .select({ id: stockEntries.id })
      .from(stockEntries)
      .where(
        and(
          eq(stockEntries.sourceRefId, existing.id),
          eq(stockEntries.movement, "out"),
        ),
      )
      .limit(1);
    if (stockOut.length > 0) return apiError(c, "stock_consumed", 400);

    // Validate supplier (optional)
    let supplier: typeof suppliers.$inferSelect | undefined;
    if (parsed.data.supplierId) {
      const supplierRows = await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.id, parsed.data.supplierId),
            eq(suppliers.workspaceId, workspaceId),
          ),
        );
      supplier = supplierRows[0];
      if (!supplier) return apiError(c, "invalid_supplier", 400);
    }

    const denierIds2 = [...new Set(parsed.data.items.map((i) => i.denierId))];
    const colorIds2 = [...new Set(parsed.data.items.map((i) => i.colorId))];
    const validated2 = await validateMasters(
      db,
      workspaceId,
      denierIds2,
      colorIds2,
    );
    if ("error" in validated2) return apiError(c, validated2.error, 400);
    const { denierById, colorById } = validated2;
    for (const color of colorById.values()) {
      if (color.stockType !== "raw") return apiError(c, "color_not_raw", 400);
    }
    const nowIso = new Date().toISOString();

    const items = parsed.data.items.map((i, idx) => {
      const denier = denierById.get(i.denierId)!;
      const color = colorById.get(i.colorId)!;
      return {
        id: generateId(),
        entryId: existing.id,
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

    // Delete old items + stock movements, recreate — one atomic D1 batch,
    // no reads in between.
    await db.batch([
      db
        .delete(stockEntries)
        .where(
          and(
            eq(stockEntries.sourceRefId, existing.id),
            eq(stockEntries.workspaceId, workspaceId),
          ),
        ),
      db
        .delete(rawMaterialItems)
        .where(eq(rawMaterialItems.entryId, existing.id)),
      db
        .update(rawMaterialEntries)
        .set({
          supplierId: supplier?.id ?? null,
          supplierName: supplier?.name ?? null,
          supplierChallanNo: parsed.data.supplierChallanNo || null,
          date: parsed.data.date,
          notes: parsed.data.notes || null,
          updatedAt: nowIso,
        })
        .where(eq(rawMaterialEntries.id, existing.id)),
      ...items.map((item) => db.insert(rawMaterialItems).values(item)),
      ...buildRawStockStatements(
        db,
        workspaceId,
        existing.id,
        items,
        parsed.data.date,
        nowIso,
      ),
    ]);

    return c.json({ ok: true, entryId: existing.id, items });
  },
);
