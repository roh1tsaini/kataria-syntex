import { Hono } from "hono";
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
import { round3 } from "@kataria-syntex/shared";

export const reportsRoute = new Hono<PermsEnv & { Bindings: Env }>();

reportsRoute.use("*", requireAuth, resolveMember());

function parseDateRange(c: {
  req: { query: (k: string) => string | undefined };
}) {
  const from = c.req.query("from")?.trim();
  const to = c.req.query("to")?.trim();
  return { from, to };
}

// ── Dashboard: flow-stage cards ───────────────────────────────────────────────

reportsRoute.get("/dashboard", requirePermission("view_reports"), async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);

  const [sentRows, returnedRows, rawStockRows, dyedStockRows, soldRows] =
    await Promise.all([
      db
        .select({
          total: sql<number>`COALESCE(SUM(${challans.totalNetWt}), 0)`,
        })
        .from(challans)
        .where(
          and(
            eq(challans.workspaceId, workspaceId),
            eq(challans.type, "outward"),
          ),
        ),
      db
        .select({
          total: sql<number>`COALESCE(SUM(${jobWorkReturnItems.netWt}), 0)`,
        })
        .from(jobWorkReturnItems)
        .innerJoin(
          jobWorkReturns,
          eq(jobWorkReturnItems.returnId, jobWorkReturns.id),
        )
        .where(eq(jobWorkReturns.workspaceId, workspaceId)),
      db
        .select({
          total: sql<number>`COALESCE(SUM(${stockEntries.netWt}), 0)`,
        })
        .from(stockEntries)
        .where(
          and(
            eq(stockEntries.workspaceId, workspaceId),
            eq(stockEntries.stockType, "raw"),
          ),
        ),
      db
        .select({
          total: sql<number>`COALESCE(SUM(${stockEntries.netWt}), 0)`,
        })
        .from(stockEntries)
        .where(
          and(
            eq(stockEntries.workspaceId, workspaceId),
            eq(stockEntries.stockType, "dyed"),
          ),
        ),
      db
        .select({
          total: sql<number>`COALESCE(SUM(${challans.totalNetWt}), 0)`,
        })
        .from(challans)
        .where(
          and(
            eq(challans.workspaceId, workspaceId),
            eq(challans.type, "sales"),
          ),
        ),
    ]);
  const sent = round3(sentRows[0]?.total ?? 0);
  const returned = round3(returnedRows[0]?.total ?? 0);
  const rawStock = round3(rawStockRows[0]?.total ?? 0);
  const dyedStock = round3(dyedStockRows[0]?.total ?? 0);
  const sold = round3(soldRows[0]?.total ?? 0);

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
    const workspaceId = c.get("member")!.workspaceId;
    const db = getDb(c.env.DB);
    const { from, to } = parseDateRange(c);
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
    const challanIds = chRows.map((c) => c.id);
    const returnedByChallan = await db
      .select({
        challanId: jobWorkReturnItems.challanId,
        total: sql<number>`COALESCE(SUM(${jobWorkReturnItems.netWt}), 0)`,
      })
      .from(jobWorkReturnItems)
      .where(inArray(jobWorkReturnItems.challanId, challanIds))
      .groupBy(jobWorkReturnItems.challanId);
    const returnedMap = new Map(
      returnedByChallan.map((r) => [r.challanId, round3(r.total)]),
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
    const workspaceId = c.get("member")!.workspaceId;
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
    const workspaceId = c.get("member")!.workspaceId;
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

// ── Sales register ───────────────────────────────────────────────────────────

reportsRoute.get(
  "/sales-register",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member")!.workspaceId;
    const db = getDb(c.env.DB);
    const { from, to } = parseDateRange(c);

    const conditions = [
      eq(challans.workspaceId, workspaceId),
      eq(challans.type, "sales"),
    ];
    if (from) conditions.push(gte(challans.date, from));
    if (to) conditions.push(lte(challans.date, to));

    const rows = await db
      .select({
        id: challans.id,
        challanNumber: challans.challanNumber,
        date: challans.date,
        customerName: challans.customerName,
        totalBoxes: challans.totalBoxes,
        totalCheese: challans.totalCheese,
        totalNetWt: challans.totalNetWt,
      })
      .from(challans)
      .where(and(...conditions))
      .orderBy(desc(challans.date));

    return c.json({ items: rows });
  },
);

// ── Job-work register ────────────────────────────────────────────────────────

reportsRoute.get(
  "/job-work-register",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member")!.workspaceId;
    const db = getDb(c.env.DB);
    const { from, to } = parseDateRange(c);

    const conditions = [
      eq(challans.workspaceId, workspaceId),
      eq(challans.type, "outward"),
    ];
    if (from) conditions.push(gte(challans.date, from));
    if (to) conditions.push(lte(challans.date, to));

    const rows = await db
      .select({
        id: challans.id,
        challanNumber: challans.challanNumber,
        date: challans.date,
        jobWorkerName: challans.jobWorkerName,
        totalBoxes: challans.totalBoxes,
        totalCheese: challans.totalCheese,
        totalNetWt: challans.totalNetWt,
      })
      .from(challans)
      .where(and(...conditions))
      .orderBy(desc(challans.date));

    return c.json({ items: rows });
  },
);

// ── Transaction log ──────────────────────────────────────────────────────────

reportsRoute.get(
  "/transaction-log",
  requirePermission("view_reports"),
  async (c) => {
    const workspaceId = c.get("member")!.workspaceId;
    const db = getDb(c.env.DB);
    const { from, to } = parseDateRange(c);
    const source = c.req.query("source")?.trim();

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
    const workspaceId = c.get("member")!.workspaceId;
    const db = getDb(c.env.DB);

    // Customers: total sold
    const customerRows = await db
      .select({
        id: customers.id,
        name: customers.name,
        totalSold: sql<number>`COALESCE(SUM(${challans.totalNetWt}), 0)`,
        challanCount: sql<number>`COUNT(*)`,
      })
      .from(customers)
      .leftJoin(
        challans,
        and(eq(challans.customerId, customers.id), eq(challans.type, "sales")),
      )
      .where(eq(customers.workspaceId, workspaceId))
      .groupBy(customers.id)
      .orderBy(desc(sql`totalSold`));

    // Job workers: sent, returned, balance
    const jwRows = await db
      .select({
        id: jobWorkers.id,
        name: jobWorkers.name,
        totalSent: sql<number>`COALESCE(SUM(${challans.totalNetWt}), 0)`,
        challanCount: sql<number>`COUNT(*)`,
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
      .orderBy(desc(sql`totalSent`));

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
