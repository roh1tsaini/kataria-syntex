import { and, eq, lt } from "drizzle-orm";
import { rateLimits } from "../db/schema";
import type { Queryable } from "./db";

/**
 * D1-backed sliding-window budget. Survives isolate restarts and spans all
 * Worker isolates (the in-memory budgets in auth/otp.ts only bound one
 * isolate). Each accepted call pays one read + one write — reserve it for
 * endpoints whose abuse is expensive or dangerous: the unauthenticated
 * lookup oracle and the CPU-heavy PDF render.
 *
 * Fail-open: a D1 hiccup must not take the endpoint down, so contention and
 * storage errors let the request through.
 */
export async function consumeBudget(
  d: Queryable,
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
