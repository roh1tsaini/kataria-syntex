import { Hono } from "hono";
import { z } from "zod";
import { and, eq, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import {
  challans,
  jobWorkReturns,
  jobWorkReturnItems,
  stockEntries,
  jobWorkers,
  customers,
} from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { apiError } from "../lib/api-error";
import { returnedTotalsByChallan } from "../lib/document-pipeline";
import { round3 } from "@kataria-syntex/shared";

export const reportsRoute = new Hono<PermsEnv & { Bindings: Env }>();

reportsRoute.use("*", requireAuth, resolveMember());

const dateRangeSchema = z.object({
  from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Validated from/to query params; null when either isn't a YYYY-MM-DD date. */
function parseDateRange(c: {
  req: { query: (k: string) => string | undefined };
}): { from?: string; to?: string } | null {
  const parsed = dateRangeSchema.safeParse({
    from: c.req.query("from"),
    to: c.req.query("to"),
  });
  return parsed.success ? parsed.data : null;
}

/** transaction-log ?source= — the movement sources stock.ts writes. */
const stockSourceSchema = z
  .string()
  .trim()
  .pipe(z.enum(["sales", "job_work_send", "job_work_return", "raw_entry"]))
  .optional();

// ── Dashboard: flow-stage cards ───────────────────────────────────────────────

reportsRoute.get("/dashboard", requirePermission("view_reports"), async (c) => {
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);

  // Three grouped sums cover all five cards: challan totals by kind,
  // returned items, stock by ledger.
  const [typeRows, returnedRows, stockRows] = await Promise.all([
    db
      .select({
        type: challans.type,
        total: sql<number>`COALESCE(SUM(${challans.totalNetWt}), 0)`.mapWith(
          Number,
        ),
      })
      .from(challans)
      .where(eq(challans.workspaceId, workspaceId))
      .groupBy(challans.type),
    db
      .select({
        total:
          sql<number>`COALESCE(SUM(${jobWorkReturnItems.netWt}), 0)`.mapWith(
            Number,
          ),
      })
      .from(jobWorkReturnItems)
      .innerJoin(
        jobWorkReturns,
        eq(jobWorkReturnItems.returnId, jobWorkReturns.id),
      )
      .where(eq(jobWorkReturns.workspaceId, workspaceId)),
    db
      .select({
        stockType: stockEntries.stockType,
        total: sql<number>`COALESCE(SUM(${stockEntries.netWt}), 0)`.mapWith(
          Number,
        ),
      })
      .from(stockEntries)
      .where(eq(stockEntries.workspaceId, workspaceId))
      .groupBy(stockEntries.stockType),
  ]);

  const byType = new Map(typeRows.map((r) => [r.type, round3(r.total)]));
  const byStock = new Map(stockRows.map((r) => [r.stockType, round3(r.total)]));
  const sent = byType.get("outward") ?? 0;
  const sold = byType.get("sales") ?? 0;
  const returned = round3(returnedRows[0]?.total ?? 0);
  const rawStock = byStock.get("raw") ?? 0;
  const dyedStock = byStock.get("dyed") ?? 0;

  return c.json({
    cards: [
      {
        label: "Sent",
        value: sent,
        unit: "kg",
        link: "/challans?type=outward",
      },
      { label: "Returned", value: returned, unit: "kg", link: "/returns" },
      {
        label: "In Stock Raw",
        value: rawStock,
        unit: "kg",
        link: "/stock/raw",
      },
      {
        label: "In Stock Dyed",
        value: dyedStock,
        unit: "kg",
        link: "/stock/dyed",
      },
      { label: "Sold", value: sold, unit: "kg", link: "/challans?type=sales" },
    ],
  });
});

// ── Job-work balance ─────────────────────────────────────────────────────────

reportsRoute.get(
  "/job-work-balance",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member").workspaceId;
    const db = getDb(c.env.DB);
    const range = parseDateRange(c);
    if (!range) return apiError(c, "invalid_request", 400);
    const { from, to } = range;
    const jobWorkerId = c.req.query("jobWorkerId")?.trim();

    // Get all outward challans
    const chConditions = [
      eq(challans.workspaceId, workspaceId),
      eq(challans.type, "outward"),
    ];
    if (jobWorkerId) chConditions.push(eq(challans.jobWorkerId, jobWorkerId));
    if (from) chConditions.push(gte(challans.date, from));
    if (to) chConditions.push(lte(challans.date, to));

    const chRows = await db
      .select({
        id: challans.id,
        number: challans.challanNumber,
        date: challans.date,
        jobWorkerId: challans.jobWorkerId,
        jobWorkerName: challans.jobWorkerName,
        totalNetWt: challans.totalNetWt,
      })
      .from(challans)
      .where(and(...chConditions))
      .orderBy(asc(challans.date));

    if (chRows.length === 0) return c.json({ items: [] });
    const returnedMap = await returnedTotalsByChallan(
      db,
      chRows.map((ch) => ch.id),
    );
    const result = chRows.map((ch) => {
      const returned = returnedMap.get(ch.id) ?? 0;
      return {
        challanId: ch.id,
        challanNumber: ch.number,
        date: ch.date,
        jobWorkerName: ch.jobWorkerName,
        sent: ch.totalNetWt,
        returned,
        balance: round3(ch.totalNetWt - returned),
      };
    });

    return c.json({ items: result });
  },
);

// ── Over-receipt list ────────────────────────────────────────────────────────

reportsRoute.get(
  "/over-receipts",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member").workspaceId;
    const db = getDb(c.env.DB);

    const rows = await db
      .select({
        id: jobWorkReturnItems.id,
        returnId: jobWorkReturnItems.returnId,
        challanId: jobWorkReturnItems.challanId,
        denierName: jobWorkReturnItems.denierName,
        colorName: jobWorkReturnItems.colorName,
        lotNo: jobWorkReturnItems.lotNo,
        netWt: jobWorkReturnItems.netWt,
        overReceiptQty: jobWorkReturnItems.overReceiptQty,
        createdAt: jobWorkReturnItems.createdAt,
      })
      .from(jobWorkReturnItems)
      .innerJoin(
        jobWorkReturns,
        eq(jobWorkReturnItems.returnId, jobWorkReturns.id),
      )
      .where(
        and(
          eq(jobWorkReturns.workspaceId, workspaceId),
          eq(jobWorkReturnItems.overReceipt, true),
        ),
      )
      .orderBy(desc(jobWorkReturnItems.createdAt));

    return c.json({ items: rows });
  },
);

// ── Stock summary ────────────────────────────────────────────────────────────

reportsRoute.get(
  "/stock-summary",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member").workspaceId;
    const db = getDb(c.env.DB);

    const grouped = await db
      .select({
        stockType: stockEntries.stockType,
        denierName: stockEntries.denierName,
        colorName: stockEntries.colorName,
        lotNo: stockEntries.lotNo,
        total: sql<number>`sum(${stockEntries.netWt})`.mapWith(Number),
      })
      .from(stockEntries)
      .where(eq(stockEntries.workspaceId, workspaceId))
      .groupBy(
        stockEntries.stockType,
        stockEntries.denierName,
        stockEntries.colorName,
        stockEntries.lotNo,
      )
      .orderBy(asc(stockEntries.stockType), asc(stockEntries.denierName));

    const items = grouped.map((r) => ({
      stockType: r.stockType,
      denierName: r.denierName,
      colorName: r.colorName,
      lotNo: r.lotNo || "Unlabelled",
      total: round3(r.total ?? 0),
    }));

    return c.json({ items });
  },
);

// ── Sales / job-work registers ───────────────────────────────────────────────

/** Both registers read the same challan columns, filtered by kind — the
 * endpoints project the party column their screen shows. */
async function readRegister(
  db: ReturnType<typeof getDb>,
  workspaceId: string,
  type: "sales" | "outward",
  range: { from?: string; to?: string },
) {
  const conditions = [
    eq(challans.workspaceId, workspaceId),
    eq(challans.type, type),
  ];
  if (range.from) conditions.push(gte(challans.date, range.from));
  if (range.to) conditions.push(lte(challans.date, range.to));

  return db
    .select({
      id: challans.id,
      challanNumber: challans.challanNumber,
      date: challans.date,
      customerName: challans.customerName,
      jobWorkerName: challans.jobWorkerName,
      totalBoxes: challans.totalBoxes,
      totalCheese: challans.totalCheese,
      totalNetWt: challans.totalNetWt,
    })
    .from(challans)
    .where(and(...conditions))
    .orderBy(desc(challans.date));
}

reportsRoute.get(
  "/sales-register",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member").workspaceId;
    const range = parseDateRange(c);
    if (!range) return apiError(c, "invalid_request", 400);
    const rows = await readRegister(
      getDb(c.env.DB),
      workspaceId,
      "sales",
      range,
    );
    return c.json({
      items: rows.map(({ jobWorkerName, ...rest }) => rest),
    });
  },
);

reportsRoute.get(
  "/job-work-register",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member").workspaceId;
    const range = parseDateRange(c);
    if (!range) return apiError(c, "invalid_request", 400);
    const rows = await readRegister(
      getDb(c.env.DB),
      workspaceId,
      "outward",
      range,
    );
    return c.json({
      items: rows.map(({ customerName, ...rest }) => rest),
    });
  },
);

// ── Transaction log ──────────────────────────────────────────────────────────

reportsRoute.get(
  "/transaction-log",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member").workspaceId;
    const db = getDb(c.env.DB);
    const range = parseDateRange(c);
    if (!range) return apiError(c, "invalid_request", 400);
    const { from, to } = range;
    const parsedSource = stockSourceSchema.safeParse(c.req.query("source"));
    if (!parsedSource.success) return apiError(c, "invalid_request", 400);
    const source = parsedSource.data;

    const conditions = [eq(stockEntries.workspaceId, workspaceId)];
    if (from) conditions.push(gte(stockEntries.date, from));
    if (to) conditions.push(lte(stockEntries.date, to));
    if (source) conditions.push(eq(stockEntries.source, source));

    const rows = await db
      .select()
      .from(stockEntries)
      .where(and(...conditions))
      .orderBy(desc(stockEntries.date), desc(stockEntries.createdAt))
      .limit(1000);

    return c.json({ items: rows });
  },
);

// ── Party summary ────────────────────────────────────────────────────────────

reportsRoute.get(
  "/party-summary",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member").workspaceId;
    const db = getDb(c.env.DB);

    // Customers: total sold
    const customerRows = await db
      .select({
        id: customers.id,
        name: customers.name,
        // .as() names the output column so ORDER BY can reference it.
        totalSold: sql<number>`COALESCE(SUM(${challans.totalNetWt}), 0)`.as(
          "total_sold",
        ),
        // COUNT(challans.id), not COUNT(*) — the left join's null-extended
        // row makes a zero-challan party report a count of 1.
        challanCount: sql<number>`COUNT(${challans.id})`,
      })
      .from(customers)
      .leftJoin(
        challans,
        and(eq(challans.customerId, customers.id), eq(challans.type, "sales")),
      )
      .where(eq(customers.workspaceId, workspaceId))
      .groupBy(customers.id)
      .orderBy(desc(sql`total_sold`));

    // Job workers: sent, returned, balance
    const jwRows = await db
      .select({
        id: jobWorkers.id,
        name: jobWorkers.name,
        totalSent: sql<number>`COALESCE(SUM(${challans.totalNetWt}), 0)`.as(
          "total_sent",
        ),
        // COUNT(challans.id), not COUNT(*) — the left join's null-extended
        // row makes a zero-challan party report a count of 1.
        challanCount: sql<number>`COUNT(${challans.id})`,
      })
      .from(jobWorkers)
      .leftJoin(
        challans,
        and(
          eq(challans.jobWorkerId, jobWorkers.id),
          eq(challans.type, "outward"),
        ),
      )
      .where(eq(jobWorkers.workspaceId, workspaceId))
      .groupBy(jobWorkers.id)
      .orderBy(desc(sql`total_sent`));

    const returnedByJw =
      jwRows.length > 0
        ? await db
            .select({
              jobWorkerId: jobWorkReturns.jobWorkerId,
              total: sql<number>`COALESCE(SUM(${jobWorkReturnItems.netWt}), 0)`,
            })
            .from(jobWorkReturnItems)
            .innerJoin(
              jobWorkReturns,
              eq(jobWorkReturnItems.returnId, jobWorkReturns.id),
            )
            .where(
              and(
                inArray(
                  jobWorkReturns.jobWorkerId,
                  jwRows.map((jw) => jw.id),
                ),
                eq(jobWorkReturns.workspaceId, workspaceId),
              ),
            )
            .groupBy(jobWorkReturns.jobWorkerId)
        : [];
    const returnedByJwMap = new Map(
      returnedByJw.map((r) => [r.jobWorkerId, round3(r.total)]),
    );
    const jobWorkerSummaries = jwRows.map((jw) => {
      const returned = returnedByJwMap.get(jw.id) ?? 0;
      return {
        id: jw.id,
        name: jw.name,
        sent: round3(jw.totalSent),
        returned,
        balance: round3(jw.totalSent - returned),
        challanCount: jw.challanCount,
      };
    });

    return c.json({
      customers: customerRows.map((c) => ({
        id: c.id,
        name: c.name,
        totalSold: round3(c.totalSold),
        challanCount: c.challanCount,
      })),
      jobWorkers: jobWorkerSummaries,
    });
  },
);
