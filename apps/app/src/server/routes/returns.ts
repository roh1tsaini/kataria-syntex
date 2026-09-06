import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { jobWorkReturns, jobWorkReturnItems, challans } from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import {
  createReturn,
  returnedTotalsByChallan,
  updateReturn,
} from "../lib/document-pipeline";
import { round3, dateStringSchema } from "@kataria-syntex/shared";
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
  date: dateStringSchema,
  remarks: z.string().trim().max(500).optional().default(""),
  items: z.array(returnItemSchema).min(1).max(200),
});

// ── List ────────────────────────────────────────────────────────────────────

returnsRoute.get("/", async (c) => {
  const workspaceId = c.get("member").workspaceId;
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
  const workspaceId = c.get("member").workspaceId;
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
  const workspaceId = c.get("member").workspaceId;
  const jobWorkerId = c.req.param("jobWorkerId");
  const db = getDb(c.env.DB);

  // Outward challans for this job worker
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
  const returnedMap = await returnedTotalsByChallan(
    db,
    challanRows.map((ch) => ch.id),
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
  const workspaceId = c.get("member").workspaceId;
  const result = await createReturn(
    getDb(c.env.DB),
    workspaceId,
    c.get("auth").userId,
    parsed.data,
  );
  if ("error" in result) return apiError(c, result.error, 400);
  return c.json({ ok: true, returnId: result.returnId });
});

// ── Update ──────────────────────────────────────────────────────────────────

returnsRoute.put("/:id", requirePermission("edit_return"), async (c) => {
  const parsed = returnBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const result = await updateReturn(
    getDb(c.env.DB),
    c.get("member").workspaceId,
    c.req.param("id"),
    parsed.data,
  );
  if ("error" in result) return apiError(c, result.error, result.status ?? 400);
  return c.json({ ok: true, returnId: result.returnId, items: result.items });
});
