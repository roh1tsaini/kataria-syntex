import { Hono } from "hono";
import { z } from "zod";

import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import {
  challanItems,
  challans,
  companies,
  customers,
  financialYears,
  jobWorkers,
  jobWorkReturnItems,
  stockEntries,
} from "../db/schema";
import { likeContains } from "../lib/like";
import { toDate } from "../lib/datetime";
import { challanBodySchema, fyForDate } from "@kataria-syntex/shared";
import { consumeBudget } from "../lib/rate-limit";
import {
  createChallan,
  toChallanDto,
  toItemDto,
  updateChallan,
} from "../lib/document-pipeline";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import {
  buildChallanHtml,
  type ChallanFonts,
  type ChallanType,
} from "../../shared/challan-html";
import { loadInterFonts } from "../lib/inter-fonts";
import {
  PdfRenderError,
  isPdfConfigured,
  renderHtmlPdf,
} from "../lib/browser-pdf";
import { apiError } from "../lib/api-error";
import { publishChanges } from "../realtime/publish";

export const challansRoute = new Hono<PermsEnv & { Bindings: Env }>();

challansRoute.use("*", requireAuth, resolveMember());

// ── List ─────────────────────────────────────────────────────────────────────

const CHALLAN_PAGE_SIZE = 25;
const CHALLAN_MAX_PAGE_SIZE = 100;

// List query params. fy/q stay free-form (unknown FY labels degrade to an
// empty list, search allows any characters); type is the only enum; limit
// and page are positive integers, limit capped at CHALLAN_MAX_PAGE_SIZE.
const listQuerySchema = z.object({
  type: z.enum(["sales", "outward"]).optional(),
  fy: z.string().trim().max(10).optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(CHALLAN_MAX_PAGE_SIZE).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

challansRoute.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse({
    type: c.req.query("type"),
    fy: c.req.query("fy"),
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    page: c.req.query("page"),
  });
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const { type, fy, q } = parsed.data;
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);

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
  const limit = parsed.data.limit ?? CHALLAN_PAGE_SIZE;
  const page = parsed.data.page ?? 1;
  const paged =
    parsed.data.limit !== undefined || parsed.data.page !== undefined;

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

  // Unpaged reads return every matching row, so the count IS rows.length —
  // a 0 here would make the client's total fallback ("N records", page
  // count) lie until the next paginated refresh.
  const total = paged ? Number(countRes[0]?.count ?? 0) : rows.length;
  return c.json({
    items: rows.map((r) =>
      toChallanDto(r, labelById.get(r.financialYearId) ?? ""),
    ),
    total,
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────

/** One read path shared by the JSON detail and the PDF download: the challan
 * row (workspace-scoped) plus items, FY label, customer and job worker in one
 * parallel round-trip. Null when the challan doesn't exist. */
async function loadChallanDetail(
  db: ReturnType<typeof getDb>,
  workspaceId: string,
  id: string,
) {
  const rowRows = await db
    .select()
    .from(challans)
    .where(and(eq(challans.id, id), eq(challans.workspaceId, workspaceId)));
  const row = rowRows[0];
  if (!row) return null;

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

  return {
    row,
    items,
    fy: fyRows[0] ?? null,
    customer: customerRows[0] ?? null,
    jobWorker: jobWorkerRows[0] ?? null,
  };
}

challansRoute.get("/:id", async (c) => {
  const detail = await loadChallanDetail(
    getDb(c.env.DB),
    c.get("member").workspaceId,
    c.req.param("id"),
  );
  if (!detail) return apiError(c, "not_found", 404);

  return c.json({
    challan: toChallanDto(detail.row, detail.fy?.label ?? ""),
    items: detail.items.map(toItemDto),
    customer: detail.customer,
    jobWorker: detail.jobWorker,
  });
});

// ── Create ───────────────────────────────────────────────────────────────────

challansRoute.post("/", requirePermission("create_challan"), async (c) => {
  const parsed = challanBodySchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const workspaceId = c.get("member").workspaceId;
  const result = await createChallan(
    getDb(c.env.DB),
    workspaceId,
    c.get("auth").userId,
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
  publishChanges(
    c.env,
    c.executionCtx,
    workspaceId,
    c.req.header("x-client-id"),
    ["challans", "stock"],
  );
  // Same DTO shape as PUT — clients type the response challan as a
  // ChallanDto (fyLabel included), not the raw insert row.
  return c.json({
    challan: toChallanDto(
      result.challan,
      fyForDate(toDate(result.challan.date)).label,
    ),
  });
});

// ── Update ───────────────────────────────────────────────────────────────────

challansRoute.put("/:id", requirePermission("edit_challan"), async (c) => {
  const parsed = challanBodySchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const result = await updateChallan(
    getDb(c.env.DB),
    c.get("member").workspaceId,
    c.req.param("id"),
    parsed.data,
  );
  if ("error" in result)
    return apiError(c, result.error, "status" in result ? result.status : 400);
  publishChanges(
    c.env,
    c.executionCtx,
    c.get("member").workspaceId,
    c.req.header("x-client-id"),
    ["challans", "stock"],
  );
  return c.json({ ok: true, challan: result.challan, items: result.items });
});

// ── Delete ───────────────────────────────────────────────────────────────────

challansRoute.delete("/:id", requirePermission("delete_challan"), async (c) => {
  const workspaceId = c.get("member").workspaceId;
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

  await db.batch([
    db
      .delete(stockEntries)
      .where(
        and(
          eq(stockEntries.sourceRefId, existing.id),
          eq(stockEntries.workspaceId, workspaceId),
        ),
      ),
    db.delete(challanItems).where(eq(challanItems.challanId, existing.id)),
    db.delete(challans).where(eq(challans.id, existing.id)),
  ]);
  publishChanges(
    c.env,
    c.executionCtx,
    workspaceId,
    c.req.header("x-client-id"),
    ["challans", "stock"],
  );
  return c.json({ ok: true });
});

// ── PDF Download ───────────────────────────────────────────────────────────────

challansRoute.get("/:id/pdf", async (c) => {
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);

  const [detail, companyRows] = await Promise.all([
    loadChallanDetail(db, workspaceId, c.req.param("id")),
    db.select().from(companies).where(eq(companies.workspaceId, workspaceId)),
  ]);
  if (!detail) return apiError(c, "not_found", 404);
  const company = companyRows[0] ?? null;

  // Doomed requests must be free: only once the challan exists and the
  // renderer is configured does a call start costing the user's budget.
  if (!isPdfConfigured(c.env)) return apiError(c, "pdf_not_configured", 500);

  // Browser Run renders on real Chromium — cap requests per user, fail-open
  // on D1, so the free browser-time budget stretches across the day.
  if (
    !(await consumeBudget(
      db,
      `pdf:${c.get("auth").userId}`,
      120,
      60 * 60 * 1000,
    ))
  )
    return apiError(c, "rate_limited", 429);

  let fonts: ChallanFonts;
  try {
    fonts = await loadInterFonts(c.env.ASSETS, c.req.url);
  } catch {
    // Missing/corrupt font assets — a render failure, not a server bug.
    return apiError(c, "pdf_render_failed", 502);
  }

  const html = buildChallanHtml({
    detail: {
      challan: detail.row,
      items: detail.items.map(toItemDto),
      customer: detail.customer,
      jobWorker: detail.jobWorker,
    },
    company,
    type: detail.row.type as ChallanType,
    fonts,
  });

  try {
    const pdfBytes = await renderHtmlPdf(c.env, html);
    // challanNumber is device-issued user input — strip anything a header
    // value can't hold before it reaches Content-Disposition.
    const safeNumber = detail.row.challanNumber.replace(
      /[^A-Za-z0-9._-]/g,
      "_",
    );
    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="challan-${safeNumber}.pdf"`,
      },
    });
  } catch (err) {
    if (err instanceof PdfRenderError) return apiError(c, err.code, err.status);
    throw err;
  }
});
