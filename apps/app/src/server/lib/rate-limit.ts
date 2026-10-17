import { and, eq, gt, lt, lte, or, sql } from "drizzle-orm";
import { rateLimits } from "../db/schema";
import type { Db } from "./db";

export type StrictBudget = {
  key: string;
  max: number;
  windowMs: number;
};

type StrictBudgetReservation = {
  allowed: boolean;
  reserved: StrictBudget[];
  denied?: StrictBudget;
};

const STRICT_BUDGET_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastStrictBudgetSweep = 0;

/** Atomic D1 reservations for expensive auth operations. */
export async function reserveBudgetsStrict(
  d: Db,
  budgets: readonly StrictBudget[],
  at = new Date(),
): Promise<StrictBudgetReservation> {
  if (budgets.length === 0) return { allowed: true, reserved: [] };
  const now = at.getTime();
  const nowIso = at.toISOString();
  const invalidBudget = budgets.find(
    (budget) =>
      !Number.isSafeInteger(budget.max) ||
      budget.max < 1 ||
      !Number.isSafeInteger(budget.windowMs) ||
      budget.windowMs < 1 ||
      budget.key.length > 120,
  );
  if (invalidBudget)
    return { allowed: false, reserved: [], denied: invalidBudget };
  if (now - lastStrictBudgetSweep >= STRICT_BUDGET_SWEEP_INTERVAL_MS) {
    lastStrictBudgetSweep = now;
    const stale = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    try {
      await d.delete(rateLimits).where(lt(rateLimits.windowStart, stale));
    } catch (error) {
      lastStrictBudgetSweep = 0;
      throw error;
    }
  }
  const results = await Promise.allSettled(
    budgets.map((budget) => {
      const cutoff = new Date(now - budget.windowMs).toISOString();
      return d
        .insert(rateLimits)
        .values({ key: budget.key, count: 1, windowStart: nowIso })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            count: sql`CASE WHEN ${rateLimits.windowStart} <= ${cutoff} OR ${rateLimits.count} = 0 THEN 1 ELSE ${rateLimits.count} + 1 END`,
            windowStart: sql`CASE WHEN ${rateLimits.windowStart} <= ${cutoff} OR ${rateLimits.count} = 0 THEN ${nowIso} ELSE ${rateLimits.windowStart} END`,
          },
          setWhere: or(
            lte(rateLimits.windowStart, cutoff),
            lt(rateLimits.count, budget.max),
          ),
        })
        .run();
    }),
  );
  const reserved = budgets.filter((_, index) => {
    const result = results[index];
    return result.status === "fulfilled" && result.value.meta.changes === 1;
  });
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    await releaseBudgetsStrict(d, reserved, at).catch(() => undefined);
    throw failed.reason;
  }
  const deniedIndex = results.findIndex(
    (result) =>
      result.status === "fulfilled" && result.value.meta.changes !== 1,
  );
  return {
    allowed: reserved.length === budgets.length,
    reserved,
    denied:
      reserved.length === budgets.length ? undefined : budgets[deniedIndex],
  };
}

/** Release a reservation after work failed before it took effect. */
export async function releaseBudgetsStrict(
  d: Db,
  budgets: readonly StrictBudget[],
  reservedAt: Date,
): Promise<void> {
  const reservedAtIso = reservedAt.toISOString();
  const releasedAtIso = new Date().toISOString();
  for (const budget of budgets) {
    const cutoff = new Date(
      reservedAt.getTime() - budget.windowMs,
    ).toISOString();
    await d
      .update(rateLimits)
      .set({
        count: sql`CASE WHEN ${rateLimits.count} > 1 THEN ${rateLimits.count} - 1 ELSE 0 END`,
        windowStart: sql`CASE WHEN ${rateLimits.count} <= 1 THEN ${releasedAtIso} ELSE ${rateLimits.windowStart} END`,
      })
      .where(
        and(
          eq(rateLimits.key, budget.key),
          lte(rateLimits.windowStart, reservedAtIso),
          gt(rateLimits.windowStart, cutoff),
          gt(rateLimits.count, 0),
        ),
      )
      .run();
  }
}

/** Atomic D1 budgets for expensive auth operations. Storage errors fail closed. */
export async function consumeBudgetsStrict(
  d: Db,
  budgets: readonly StrictBudget[],
): Promise<boolean> {
  const at = new Date();
  const reservation = await reserveBudgetsStrict(d, budgets, at);
  if (!reservation.allowed && reservation.reserved.length > 0)
    await releaseBudgetsStrict(d, reservation.reserved, at);
  return reservation.allowed;
}

/**
 * D1-backed fixed-window budget. Survives isolate restarts and spans all
 * Worker isolates (the in-memory budgets in auth/otp.ts only bound one
 * isolate). Each accepted call pays one read + one write — reserve it for
 * endpoints whose abuse is expensive or dangerous: the unauthenticated
 * lookup oracle and the CPU-heavy PDF render.
 *
 * Fail-open: a D1 hiccup must not take the endpoint down, so contention and
 * storage errors let the request through.
 */
export async function consumeBudget(
  d: Db,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rows = await d
        .select()
        .from(rateLimits)
        .where(eq(rateLimits.key, key))
        .limit(1);
      const row = rows[0];
      const now = Date.now();

      if (!row || now - new Date(row.windowStart).getTime() >= windowMs) {
        // New key or expired window — restart the counter via CAS on the
        // window we read, and sweep rows nobody has touched for a day.
        const windowStart = new Date(now).toISOString();
        const stale = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        await d.delete(rateLimits).where(lt(rateLimits.windowStart, stale));
        const res = row
          ? await d
              .update(rateLimits)
              .set({ count: 1, windowStart })
              .where(
                and(
                  eq(rateLimits.key, key),
                  eq(rateLimits.windowStart, row.windowStart),
                ),
              )
              .run()
          : await d
              .insert(rateLimits)
              .values({ key, count: 1, windowStart })
              .run();
        if (res.meta.changes > 0) return true;
        continue; // lost the reset race — re-read
      }

      if (row.count >= max) return false;

      const res = await d
        .update(rateLimits)
        .set({ count: row.count + 1 })
        .where(and(eq(rateLimits.key, key), eq(rateLimits.count, row.count)))
        .run();
      if (res.meta.changes > 0) return true;
    } catch {
      // Lost a CAS race or D1 failed — one request slipping through (or
      // skipping the counter) is the acceptable failure mode here.
      return true;
    }
  }
  return true;
}
