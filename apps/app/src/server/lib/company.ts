import { and, eq } from "drizzle-orm";
import type { Queryable } from "./db";
import {
  companies,
  financialYears,
  workspaces,
  type NumberingConfig,
} from "../db/schema";
import {
  DEFAULT_NUMBERING,
  fyForDate as sharedFyForDate,
} from "@kataria-syntex/shared";
import { generateId } from "./token";

type ChallanType = "sales" | "outward";

export const DEFAULT_NUMBERING_JSON = JSON.stringify(DEFAULT_NUMBERING);

const NUMBERING_KEYS = Object.keys(DEFAULT_NUMBERING) as Array<
  keyof typeof DEFAULT_NUMBERING
>;

export function parseNumbering(
  raw: string | null | undefined,
): NumberingConfig {
  if (!raw) return structuredClone(DEFAULT_NUMBERING);
  try {
    const parsed = JSON.parse(raw) as Partial<NumberingConfig>;
    const base = structuredClone(DEFAULT_NUMBERING);
    for (const key of NUMBERING_KEYS) {
      const t = parsed[key];
      if (t && typeof t === "object") {
        base[key] = {
          prefix: typeof t.prefix === "string" ? t.prefix : base[key].prefix,
          suffix: typeof t.suffix === "string" ? t.suffix : base[key].suffix,
          minDigits:
            Number.isInteger(t.minDigits) &&
            t.minDigits >= 1 &&
            t.minDigits <= 6
              ? t.minDigits
              : base[key].minDigits,
        };
      }
    }
    return base;
  } catch {
    return structuredClone(DEFAULT_NUMBERING);
  }
}

/** Returns the company row for a workspace, creating it on first access. */
export type CompanyRow = typeof companies.$inferSelect;

export async function getOrCreateCompany(
  d: Queryable,
  workspaceId: string,
): Promise<CompanyRow> {
  const existing = await d
    .select()
    .from(companies)
    .where(eq(companies.workspaceId, workspaceId))
    .get();
  if (existing) return existing;

  const ws = await d
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .get();
  if (!ws) throw new Error("workspace_not_found");

  const nowIso = new Date().toISOString();
  const id = generateId();
  try {
    await d.insert(companies).values({
      id,
      workspaceId,
      name: ws.name,
      numbering: DEFAULT_NUMBERING_JSON,
      updatedAt: nowIso,
      updatedBy: null,
    });
  } catch (err) {
    const raced = await d
      .select()
      .from(companies)
      .where(eq(companies.workspaceId, workspaceId))
      .get();
    if (raced) return raced;
    throw err;
  }
  return {
    id,
    workspaceId,
    name: ws.name,
    numbering: DEFAULT_NUMBERING_JSON,
    gstin: null,
    pan: null,
    address: null,
    phone1: null,
    phone2: null,
    updatedAt: nowIso,
    updatedBy: null,
  };
}

/**
 * Wall-clock date in Asia/Kolkata (fixed +05:30, no DST).
 */
export function indiaNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

export const fyForDate = sharedFyForDate;

/**
 * Auto-creates the FY row a date falls in, if missing.
 */
export type FinancialYearRow = typeof financialYears.$inferSelect;

export async function getOrCreateFyForDate(
  d: Queryable,
  workspaceId: string,
  date: Date,
): Promise<FinancialYearRow> {
  const fy = fyForDate(date);
  const existing = await d
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.workspaceId, workspaceId),
        eq(financialYears.label, fy.label),
      ),
    )
    .get();
  if (existing) return existing;

  const id = generateId();
  try {
    await d.insert(financialYears).values({
      id,
      workspaceId,
      label: fy.label,
      startsAt: fy.startsAt.toISOString(),
      endsAt: fy.endsAt.toISOString(),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    const raced = await d
      .select()
      .from(financialYears)
      .where(
        and(
          eq(financialYears.workspaceId, workspaceId),
          eq(financialYears.label, fy.label),
        ),
      )
      .get();
    if (raced) return raced;
    throw err;
  }
  return {
    id,
    workspaceId,
    label: fy.label,
    startsAt: fy.startsAt.toISOString(),
    endsAt: fy.endsAt.toISOString(),
    salesNext: 1,
    outwardNext: 1,
    packingSaleNext: 1,
    packingJobNext: 1,
    rawNext: 1,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Allocates the next number in a series via compare-and-swap on the FY
 * counter, retrying on contention. Must run BEFORE the caller's db.batch():
 * a failed CAS (0 changes) doesn't error the batch, so the condition has to
 * be checked here before any dependent writes are collected.
 */

/** FY counter column per number series. */
const FY_COUNTERS = {
  sales: "salesNext",
  outward: "outwardNext",
  packing_s: "packingSaleNext",
  packing_j: "packingJobNext",
  raw: "rawNext",
} as const;

export type FyCounterKey = keyof typeof FY_COUNTERS;

export async function allocateFyNumber(
  d: Queryable,
  workspaceId: string,
  date: Date,
  key: FyCounterKey,
  format: (config: NumberingConfig, seq: number, fyLabel: string) => string,
  config: NumberingConfig,
): Promise<{ number: string; fyId: string; fyLabel: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const fyRow = await getOrCreateFyForDate(d, workspaceId, date);
    const seq = fyRow[FY_COUNTERS[key]];
    const number = format(config, seq, fyRow.label);

    // Type-safe CAS: explicit branches retain Drizzle column typing
    const res =
      key === "sales"
        ? await d
            .update(financialYears)
            .set({ salesNext: seq + 1 })
            .where(
              and(
                eq(financialYears.id, fyRow.id),
                eq(financialYears.salesNext, seq),
              ),
            )
            .run()
        : key === "outward"
          ? await d
              .update(financialYears)
              .set({ outwardNext: seq + 1 })
              .where(
                and(
                  eq(financialYears.id, fyRow.id),
                  eq(financialYears.outwardNext, seq),
                ),
              )
              .run()
          : key === "packing_s"
            ? await d
                .update(financialYears)
                .set({ packingSaleNext: seq + 1 })
                .where(
                  and(
                    eq(financialYears.id, fyRow.id),
                    eq(financialYears.packingSaleNext, seq),
                  ),
                )
                .run()
            : key === "packing_j"
              ? await d
                  .update(financialYears)
                  .set({ packingJobNext: seq + 1 })
                  .where(
                    and(
                      eq(financialYears.id, fyRow.id),
                      eq(financialYears.packingJobNext, seq),
                    ),
                  )
                  .run()
              : await d
                  .update(financialYears)
                  .set({ rawNext: seq + 1 })
                  .where(
                    and(
                      eq(financialYears.id, fyRow.id),
                      eq(financialYears.rawNext, seq),
                    ),
                  )
                  .run();

    if (res.meta.changes > 0) {
      return { number, fyId: fyRow.id, fyLabel: fyRow.label };
    }
  }
  throw new Error("fy_number_conflict");
}
