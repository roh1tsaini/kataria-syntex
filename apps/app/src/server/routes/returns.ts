import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import {
  jobWorkReturns,
  jobWorkReturnItems,
  challans,
  challanItems,
  jobWorkers,
  stockEntries,
} from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { generateId } from "../lib/token";
import { validateMasters } from "../lib/masters";
import { buildReturnStockStatements } from "../lib/stock";
import { createReturn, getChallanBalances } from "../lib/document-pipeline";
import { round3 } from "@kataria-syntex/shared";
import { apiError } from "../lib/api-error";

export const returnsRoute = new Hono<PermsEnv & { Bindings: Env }>();

returnsRoute.use("*", requireAuth, resolveMember());

const returnItemSchema = z.object({
  challanId: z.string().min(1),
  denierId: z.string().min(1),
  colorId: z.string().min(1),
  lotNo: z.string().trim().max(100).default(""),
  netWt: z.number().positive().max(1_000_000),
  cones: z.number().int().min(0).max(1_000_000).optional(),
});

const returnBody = z.object({
  jobWorkerId: z.string().min(1),
  invoiceNo: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: z.string().trim().max(500).optional().default(""),
  items: z.array(returnItemSchema).min(1).max(200),
});

// ── List ────────────────────────────────────────────────────────────────────

returnsRoute.get("/", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const jobWorkerId = c.req.query("jobWorkerId")?.trim();

  const conditions = [eq(jobWorkReturns.workspaceId, workspaceId)];
  if (jobWorkerId) conditions.push(eq(jobWorkReturns.jobWorkerId, jobWorkerId));

  const rows = await getDb(c.env.DB)
    .select()
    .from(jobWorkReturns)
    .where(and(...conditions))
    .orderBy(desc(jobWorkReturns.date), desc(jobWorkReturns.createdAt));

  return c.json({ items: rows });
});

// ── Detail ──────────────────────────────────────────────────────────────────

returnsRoute.get("/:id", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);
  const headerRows = await db
    .select()
    .from(jobWorkReturns)
    .where(
      and(
        eq(jobWorkReturns.id, c.req.param("id")),
        eq(jobWorkReturns.workspaceId, workspaceId),
      ),
    );
  const header = headerRows[0];
  if (!header) return apiError(c, "not_found", 404);

  const items = await db
    .select()
    .from(jobWorkReturnItems)
    .where(eq(jobWorkReturnItems.returnId, header.id))
    .orderBy(asc(jobWorkReturnItems.seq));

  return c.json({ returnEntry: header, items });
});

// ── Pending balance for a job worker's challans ──────────────────────────────

returnsRoute.get("/balance/:jobWorkerId", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const jobWorkerId = c.req.param("jobWorkerId");
  const db = getDb(c.env.DB);

  // Get all outward challans for this job worker
  const challanRows = await db
    .select({
      id: challans.id,
      challanNumber: challans.challanNumber,
      date: challans.date,
      totalNetWt: challans.totalNetWt,
    })
    .from(challans)
    .where(
      and(
        eq(challans.workspaceId, workspaceId),
        eq(challans.jobWorkerId, jobWorkerId),
        eq(challans.type, "outward"),
      ),
    )
    .orderBy(asc(challans.date));

  if (challanRows.length === 0) return c.json({ items: [] });
  const returnedByChallan = await db
    .select({
      challanId: jobWorkReturnItems.challanId,
      total: sql<number>`COALESCE(SUM(${jobWorkReturnItems.netWt}), 0)`,
    })
    .from(jobWorkReturnItems)
    .where(
      inArray(
        jobWorkReturnItems.challanId,
        challanRows.map((c) => c.id),
      ),
    )
    .groupBy(jobWorkReturnItems.challanId);
  const returnedMap = new Map(
    returnedByChallan.map((r) => [r.challanId, round3(r.total)]),
  );
  const balances = challanRows.map((ch) => {
    const returned = returnedMap.get(ch.id) ?? 0;
    return {
      challanId: ch.id,
      challanNumber: ch.challanNumber,
      date: ch.date,
      sent: ch.totalNetWt,
      returned,
      balance: round3(ch.totalNetWt - returned),
    };
  });

  return c.json({ items: balances });
});

// ── Create ──────────────────────────────────────────────────────────────────

returnsRoute.post("/", requirePermission("create_return"), async (c) => {
  const parsed = returnBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const workspaceId = c.get("member")!.workspaceId;
  const result = await createReturn(
    getDb(c.env.DB),
    workspaceId,
    c.get("auth")!.userId,
    parsed.data,
  );
  if ("error" in result) return apiError(c, result.error, 400);
  return c.json({ ok: true, returnId: result.returnId });
});

// ── Update ──────────────────────────────────────────────────────────────────

returnsRoute.put("/:id", requirePermission("edit_return"), async (c) => {
  const parsed = returnBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);

  const existingRows = await db
    .select()
    .from(jobWorkReturns)
    .where(
      and(
        eq(jobWorkReturns.id, c.req.param("id")),
        eq(jobWorkReturns.workspaceId, workspaceId),
      ),
    );
  const existing = existingRows[0];
  if (!existing) return apiError(c, "not_found", 400);

  // Validate job worker + challans (same as create)
  const jwRows = await db
    .select()
    .from(jobWorkers)
    .where(
      and(
        eq(jobWorkers.id, parsed.data.jobWorkerId),
        eq(jobWorkers.workspaceId, workspaceId),
      ),
    );
  const jw = jwRows[0];
  if (!jw) return apiError(c, "invalid_job_worker", 400);

  const challanIds = [...new Set(parsed.data.items.map((i) => i.challanId))];
  const challanRows = await db
    .select()
    .from(challans)
    .where(
      and(
        eq(challans.workspaceId, workspaceId),
        inArray(challans.id, challanIds),
      ),
    );
  if (challanRows.length !== challanIds.length)
    return apiError(c, "invalid_challan", 400);
  for (const ch of challanRows) {
    if (ch.type !== "outward") return apiError(c, "challan_not_outward", 400);
    if (ch.jobWorkerId !== parsed.data.jobWorkerId)
      return apiError(c, "challan_job_worker_mismatch", 400);
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
  const nowIso = new Date().toISOString();
  // Balance per challan, measured WITHOUT this return's own items (they get
  // replaced by this edit) and decremented as this submission consumes it —
  // otherwise two items against one challan both see the full balance.
  const balances = await getChallanBalances(db, challanIds, existing.id);
  const remainingByChallan = new Map<string, number>();
  for (const [cid, bal] of balances)
    remainingByChallan.set(cid, round3(bal.sent - bal.returned));

  const items = [] as Array<{
    id: string;
    returnId: string;
    challanId: string;
    seq: number;
    denierId: string;
    denierName: string;
    colorId: string;
    colorName: string;
    colorCode: string | null;
    lotNo: string;
    netWt: number;
    cones: number | null;
    overReceipt: boolean;
    overReceiptQty: number | null;
    createdAt: string;
  }>;
  for (const [idx, i] of parsed.data.items.entries()) {
    const denier = denierById.get(i.denierId)!;
    const color = colorById.get(i.colorId)!;
    const remainingBefore = remainingByChallan.get(i.challanId) ?? 0;
    const overReceipt = i.netWt > remainingBefore;
    const overReceiptQty = overReceipt
      ? round3(i.netWt - remainingBefore)
      : null;
    // Consume this item's qty so sibling items against the same challan
    // in the SAME submission are measured against what actually remains.
    remainingByChallan.set(i.challanId, round3(remainingBefore - i.netWt));
    items.push({
      id: generateId(),
      returnId: existing.id,
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
    });
  }

  // Delete old items + stock movements, then recreate — one atomic D1 batch,
  // no reads in between.
  await db.batch([
    db.delete(stockEntries).where(eq(stockEntries.sourceRefId, existing.id)),
    db
      .delete(jobWorkReturnItems)
      .where(eq(jobWorkReturnItems.returnId, existing.id)),
    db
      .update(jobWorkReturns)
      .set({
        jobWorkerId: parsed.data.jobWorkerId,
        jobWorkerName: jw.name,
        invoiceNo: parsed.data.invoiceNo,
        date: parsed.data.date,
        remarks: parsed.data.remarks || null,
        updatedAt: nowIso,
      })
      .where(eq(jobWorkReturns.id, existing.id)),
    ...items.map((item) => db.insert(jobWorkReturnItems).values(item)),
    ...buildReturnStockStatements(
      db,
      workspaceId,
      existing.id,
      items,
      parsed.data.date,
      nowIso,
    ),
  ]);

  return c.json({ ok: true, returnId: existing.id, items });
});
