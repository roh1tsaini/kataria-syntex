import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import {
  challanItems,
  challans,
  challanItemSources,
  companies,
  customers,
  financialYears,
  jobWorkers,
  jobWorkReturnItems,
  stockEntries,
} from "../db/schema";
import { likeContains } from "../lib/like";
import { challanBodySchema } from "@kataria-syntex/shared";
import {
  createChallan,
  toChallanDto,
  toItemDto,
  updateChallan,
} from "../lib/document-pipeline";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { renderSheetPdf } from "../../shared/pdf-driver";
import { loadInterFonts } from "../lib/inter-fonts";
import { apiError } from "../lib/api-error";

export const challansRoute = new Hono<PermsEnv & { Bindings: Env }>();

challansRoute.use("*", requireAuth, resolveMember());

// ── List ─────────────────────────────────────────────────────────────────────

const CHALLAN_PAGE_SIZE = 25;
const CHALLAN_MAX_PAGE_SIZE = 100;

challansRoute.get("/", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);
  const type = c.req.query("type")?.trim();
  const fy = c.req.query("fy")?.trim();
  const q = c.req.query("q")?.trim();
  // Optional pagination. When absent the whole (filtered) set is returned so
  // the dashboard's summary() and exports keep working unchanged.
  const limitRaw = c.req.query("limit")?.trim();
  const pageRaw = c.req.query("page")?.trim();

  const conditions = [eq(challans.workspaceId, workspaceId)];
  if (type === "sales" || type === "outward")
    conditions.push(eq(challans.type, type));
  if (q) {
    const search = or(
      likeContains(challans.customerName, q),
      likeContains(challans.jobWorkerName, q),
    );
    if (search) conditions.push(search);
  }
  // Optional limit/page → OFFSET/LIMIT. Without them every matching row is
  // returned (summary/exports rely on the full set).
  const limit = Math.min(
    Math.max(Number.parseInt(limitRaw ?? "", 10) || CHALLAN_PAGE_SIZE, 1),
    CHALLAN_MAX_PAGE_SIZE,
  );
  const page = Math.max(Number.parseInt(pageRaw ?? "", 10) || 1, 1);
  const paged = Boolean(limitRaw || pageRaw);

  // The FY label map doubles as the fy-filter lookup — one fetch serves both.
  // The COUNT only runs when actually paging (the summary/export path never
  // reads `total`).
  const fyRows = await db
    .select({ id: financialYears.id, label: financialYears.label })
    .from(financialYears)
    .where(eq(financialYears.workspaceId, workspaceId));
  const labelById = new Map(fyRows.map((r) => [r.id, r.label]));
  if (fy) {
    const fyRow = fyRows.find((r) => r.label === fy);
    if (!fyRow) return c.json({ items: [], total: 0 });
    conditions.push(eq(challans.financialYearId, fyRow.id));
  }

  const where = and(...conditions);
  const rowsQuery = db
    .select()
    .from(challans)
    .where(where)
    .orderBy(desc(challans.date), desc(challans.createdAt));

  const [rows, countRes] = await Promise.all([
    paged ? rowsQuery.offset((page - 1) * limit).limit(limit) : rowsQuery,
    paged
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(challans)
          .where(where)
      : Promise.resolve([] as Array<{ count: number }>),
  ]);

  const total = Number(countRes[0]?.count ?? 0);
  return c.json({
    items: rows.map((r) =>
      toChallanDto(r, labelById.get(r.financialYearId) ?? ""),
    ),
    total,
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────

challansRoute.get("/:id", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);
  const rowRows = await db
    .select()
    .from(challans)
    .where(
      and(
        eq(challans.id, c.req.param("id")),
        eq(challans.workspaceId, workspaceId),
      ),
    );
  const row = rowRows[0];
  if (!row) return apiError(c, "not_found", 404);

  const [items, fyRows, customerRows, jobWorkerRows] = await Promise.all([
    db
      .select()
      .from(challanItems)
      .where(eq(challanItems.challanId, row.id))
      .orderBy(asc(challanItems.seq), asc(challanItems.id)),
    db
      .select({ label: financialYears.label })
      .from(financialYears)
      .where(eq(financialYears.id, row.financialYearId)),
    row.customerId
      ? db.select().from(customers).where(eq(customers.id, row.customerId))
      : Promise.resolve([] as (typeof customers.$inferSelect)[]),
    row.jobWorkerId
      ? db.select().from(jobWorkers).where(eq(jobWorkers.id, row.jobWorkerId))
      : Promise.resolve([] as (typeof jobWorkers.$inferSelect)[]),
  ]);
  const fy = fyRows[0];
  const customer = customerRows[0] ?? null;
  const jobWorker = jobWorkerRows[0] ?? null;

  return c.json({
    challan: toChallanDto(row, fy?.label ?? ""),
    items: items.map(toItemDto),
    customer,
    jobWorker,
  });
});

// ── Create ───────────────────────────────────────────────────────────────────

challansRoute.post("/", requirePermission("create_challan"), async (c) => {
  const parsed = challanBodySchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const workspaceId = c.get("member")!.workspaceId;
  const result = await createChallan(
    getDb(c.env.DB),
    workspaceId,
    c.get("auth")!.userId,
    parsed.data,
  );
  if ("error" in result)
    return c.json(
      {
        error: result.error,
        ...("suggestion" in result && result.suggestion
          ? { suggestion: result.suggestion }
          : {}),
      },
      "status" in result ? (result.status as 409) : 400,
    );
  return c.json(result as never);
});

// ── Update ───────────────────────────────────────────────────────────────────

challansRoute.put("/:id", requirePermission("edit_challan"), async (c) => {
  const parsed = challanBodySchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const result = await updateChallan(
    getDb(c.env.DB),
    c.get("member")!.workspaceId,
    c.req.param("id"),
    parsed.data,
  );
  if ("error" in result)
    return apiError(c, result.error, "status" in result ? result.status : 400);
  return c.json({ ok: true, challan: result.challan, items: result.items });
});

// ── Delete ───────────────────────────────────────────────────────────────────

challansRoute.delete("/:id", requirePermission("delete_challan"), async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);

  const existingRows = await db
    .select({ id: challans.id })
    .from(challans)
    .where(
      and(
        eq(challans.id, c.req.param("id")),
        eq(challans.workspaceId, workspaceId),
      ),
    );
  const existing = existingRows[0];
  if (!existing) return apiError(c, "not_found", 404);

  // job_work_return_items.challan_id has a non-cascading FK — a challan
  // with recorded returns can't be deleted; answer 409 instead of a 500.
  const returnRows = await db
    .select({ id: jobWorkReturnItems.id })
    .from(jobWorkReturnItems)
    .where(eq(jobWorkReturnItems.challanId, existing.id));
  if (returnRows.length > 0) return apiError(c, "challan_has_returns", 409);

  const oldItemRows = await db
    .select({ id: challanItems.id })
    .from(challanItems)
    .where(eq(challanItems.challanId, existing.id));
  const oldItemIds = oldItemRows.map((r) => r.id);

  await db.batch([
    db
      .delete(stockEntries)
      .where(
        and(
          eq(stockEntries.sourceRefId, existing.id),
          eq(stockEntries.workspaceId, workspaceId),
        ),
      ),
    ...(oldItemIds.length
      ? [
          db
            .delete(challanItemSources)
            .where(inArray(challanItemSources.challanItemId, oldItemIds)),
        ]
      : []),
    db.delete(challanItems).where(eq(challanItems.challanId, existing.id)),
    db.delete(challans).where(eq(challans.id, existing.id)),
  ]);
  return c.json({ ok: true });
});

// ── PDF Download ───────────────────────────────────────────────────────────────

challansRoute.get("/:id/pdf", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);
  const rowRows = await db
    .select()
    .from(challans)
    .where(
      and(
        eq(challans.id, c.req.param("id")),
        eq(challans.workspaceId, workspaceId),
      ),
    );
  const row = rowRows[0];
  if (!row) return apiError(c, "not_found", 404);

  // Items, FY label, customer, job worker and company are independent —
  // one parallel round-trip instead of five sequential awaits.
  const [items, fyRows, customerRows, jobWorkerRows, companyRows] =
    await Promise.all([
      db
        .select()
        .from(challanItems)
        .where(eq(challanItems.challanId, row.id))
        .orderBy(asc(challanItems.seq), asc(challanItems.id)),
      db
        .select({ label: financialYears.label })
        .from(financialYears)
        .where(eq(financialYears.id, row.financialYearId)),
      row.customerId
        ? db.select().from(customers).where(eq(customers.id, row.customerId))
        : Promise.resolve([]),
      row.jobWorkerId
        ? db.select().from(jobWorkers).where(eq(jobWorkers.id, row.jobWorkerId))
        : Promise.resolve([]),
      db.select().from(companies).where(eq(companies.workspaceId, workspaceId)),
    ]);
  const customer = customerRows[0] ?? null;
  const jobWorker = jobWorkerRows[0] ?? null;
  const company = companyRows[0] ?? null;

  const detail = {
    challan: row,
    items: items.map(toItemDto),
    customer,
    jobWorker,
  };

  const fonts = await loadInterFonts(c.env.ASSETS, c.req.url);
  const pdfBytes = await renderSheetPdf(
    fonts.regular,
    fonts.bold,
    detail,
    company,
    row.type as "sales" | "outward",
  );

  // challanNumber is device-issued user input — strip anything a header
  // value can't hold before it reaches Content-Disposition.
  const safeNumber = row.challanNumber.replace(/[^A-Za-z0-9._-]/g, "_");
  return new Response(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="challan-${safeNumber}.pdf"`,
    },
  });
});
