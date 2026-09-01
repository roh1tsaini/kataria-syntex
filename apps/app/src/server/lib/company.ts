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
  formatChallanNumber as sharedFormatChallanNumber,
  formatEntryNumber as sharedFormatEntryNumber,
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

/** Thin wrappers — single source lives in @kataria-syntex/shared */
export const formatChallanNumber = sharedFormatChallanNumber;
const formatEntryNumber = sharedFormatEntryNumber;

/**
 * Allocates the next packing/raw number using compare-and-swap on the FY counter.
 * Single atomic UPDATE per attempt — must NOT run inside db.batch(): a failed
 * CAS (0 changes) doesn't error the batch, so the condition has to be checked
 * here before any dependent writes are collected.
 */
export async function allocateEntryNumber(
  d: Queryable,
  workspaceId: string,
  date: Date,
  config: NumberingConfig,
  type: "packing_s" | "packing_j" | "raw",
): Promise<{ entryNumber: string; fyId: string; fyLabel: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const fy = await getOrCreateFyForDate(d, workspaceId, date);
    const fyRow = await d
      .select()
      .from(financialYears)
      .where(eq(financialYears.id, fy.id))
      .get();
    if (!fyRow) throw new Error("financial_year_missing");

    const seq =
      type === "packing_s"
        ? fyRow.packingSaleNext
        : type === "packing_j"
          ? fyRow.packingJobNext
          : fyRow.rawNext;
    const entryNumber = formatEntryNumber(config, type, seq);

    // Type-safe CAS: explicit branch retains Drizzle column typing
    const res =
      type === "packing_s"
        ? await d
            .update(financialYears)
            .set({ packingSaleNext: seq + 1 })
            .where(
              and(
                eq(financialYears.id, fy.id),
                eq(financialYears.packingSaleNext, seq),
              ),
            )
        : type === "packing_j"
          ? await d
              .update(financialYears)
              .set({ packingJobNext: seq + 1 })
              .where(
                and(
                  eq(financialYears.id, fy.id),
                  eq(financialYears.packingJobNext, seq),
                ),
              )
          : await d
              .update(financialYears)
              .set({ rawNext: seq + 1 })
              .where(
                and(
                  eq(financialYears.id, fy.id),
                  eq(financialYears.rawNext, seq),
                ),
              );

    if (res.meta.changes > 0) {
      return { entryNumber, fyId: fy.id, fyLabel: fy.label };
    }
  }
  throw new Error("entry_number_conflict");
}
