/**
 * Pure aggregation math for the dashboard — the RN port of apps/app's
 * ui/lib/dashboard-math. No React, no store access, so it stays
 * unit-testable and the screen stays readable.
 */

import type { Challan } from "@kataria-syntex/app-core";
import { fyPrevLabel } from "@kataria-syntex/shared";
import { daysAgoISO } from "@/lib/format";

export { fyPrevLabel };

export type Period = "fy" | "30d" | "all";

export function aggregate(list: Challan[]) {
  return list.reduce(
    (acc, c) => {
      acc.count += 1;
      acc.boxes += c.totalBoxes;
      acc.netWt += c.totalNetWt;
      return acc;
    },
    { count: 0, boxes: 0, netWt: 0 },
  );
}

export function inWindow(c: Challan, period: Period, fy: string): boolean {
  if (period === "fy") return c.fyLabel === fy;
  if (period === "30d") return c.date >= daysAgoISO(29);
  return true;
}

export function prevFilter(
  period: Period,
  fy: string,
): (c: Challan) => boolean {
  if (period === "fy") {
    const prev = fyPrevLabel(fy);
    return (c) => c.fyLabel === prev;
  }
  if (period === "30d") {
    const start = daysAgoISO(59);
    const end = daysAgoISO(29);
    return (c) => c.date >= start && c.date < end;
  }
  return () => false;
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

const shortMonth = (d: Date) => d.toLocaleString("en-IN", { month: "short" });

export function revenueBuckets(list: Challan[], period: Period, fy: string) {
  const buckets: Record<
    string,
    { label: string; netWt: number; count: number }
  > = {};
  const ordered: string[] = [];
  const seed = (key: string, label: string) => {
    ordered.push(key);
    buckets[key] = { label, netWt: 0, count: 0 };
  };
  if (period === "fy") {
    const startYear = Number(fy.split("-")[0]);
    for (let i = 0; i < 12; i++) {
      const d = new Date(startYear, 3 + i, 1);
      seed(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        shortMonth(d),
      );
    }
  } else if (period === "30d") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      seed(
        key,
        i === 29 || i === 0 || d.getDate() === 1 ? String(d.getDate()) : "",
      );
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      seed(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        shortMonth(d),
      );
    }
  }
  for (const c of list) {
    const key = c.date.slice(0, period === "30d" ? 10 : 7);
    if (buckets[key]) {
      buckets[key].netWt += c.totalNetWt;
      buckets[key].count += 1;
    }
  }
  return ordered.map((k) => ({ key: k, ...buckets[k] }));
}
