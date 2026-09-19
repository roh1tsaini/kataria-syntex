import { and, eq, inArray } from "drizzle-orm";
import {
  formatNumberForType,
  fyForDate,
  type ApiCode,
  type NumberingConfig,
} from "@kataria-syntex/shared";
import type { Queryable } from "../db";
import { challans, customers, jobWorkers, suppliers } from "../../db/schema";
import { toDate, toIso } from "../datetime";
import {
  allocateFyNumber,
  getOrCreateCompany,
  parseNumbering,
} from "../company";
import { validateMasters } from "../masters";

export type ValidatedMasters = Exclude<
  Awaited<ReturnType<typeof validateMasters>>,
  { error: ApiCode }
>;

/**
 * validateMasters guarantees every requested id is present, but a concurrent
 * archive between validate and snapshot would make .get() miss. Throw a
 * domain error so the caller returns invalid_denier/color (400), never a
 * TypeError panic (500).
 */
export class MasterRaceError extends Error {
  constructor(readonly code: ApiCode) {
    super(code);
  }
}

/**
 * Standard FY check on updates: the number belongs to the FY it was issued in.
 * Returns true if both dates fall into the same financial year.
 */
export function assertMatchingFy(
  newDate: Date,
  existingDateStr: string,
): boolean {
  return fyForDate(newDate).label === fyForDate(toDate(existingDateStr)).label;
}

/**
 * One counter allocation for every document type: sales/outward numbers
 * carry the FY short, packing/raw ones don't. Pass `config` when the caller
 * already holds the numbering; otherwise the workspace's live config is
 * loaded here.
 */
export async function allocatedNumber(
  d: Queryable,
  workspaceId: string,
  date: Date,
  type: "sales" | "outward" | "packing_s" | "packing_j" | "raw",
  config?: NumberingConfig,
): Promise<{ number: string; fyId: string; fyLabel: string }> {
  const numbering =
    config ??
    parseNumbering((await getOrCreateCompany(d, workspaceId)).numbering);
  const alloc = await allocateFyNumber(
    d,
    workspaceId,
    date,
    type,
    (cfg, seq, fyLabel) => formatNumberForType(cfg, type, seq, fyLabel),
    numbering,
  );
  return { number: alloc.number, fyId: alloc.fyId, fyLabel: alloc.fyLabel };
}

/**
 * Resolves an active supplier by id.
 */
export async function resolveSupplier(
  d: Queryable,
  workspaceId: string,
  supplierId?: string,
): Promise<{ supplier?: typeof suppliers.$inferSelect; error?: ApiCode }> {
  if (!supplierId) return {};
  const rows = await d
    .select()
    .from(suppliers)
    .where(
      and(eq(suppliers.id, supplierId), eq(suppliers.workspaceId, workspaceId)),
    );
  if (!rows[0]) return { error: "invalid_supplier" };
  return { supplier: rows[0] };
}

/**
 * Resolves customer or jobWorker for a challan depending on its type.
 */
export async function resolveParty(
  d: Queryable,
  workspaceId: string,
  input: {
    type: "sales" | "outward";
    customerId?: string;
    jobWorkerId?: string;
  },
): Promise<{
  customer?: typeof customers.$inferSelect | null;
  jobWorker?: typeof jobWorkers.$inferSelect | null;
  error?: ApiCode;
}> {
  if (input.type === "sales") {
    if (!input.customerId) return { error: "invalid_request" };
    const rows = await d
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, input.customerId),
          eq(customers.workspaceId, workspaceId),
        ),
      );
    if (!rows[0]) return { error: "invalid_customer" };
    return { customer: rows[0], jobWorker: null };
  }
  if (!input.jobWorkerId) return { error: "invalid_request" };
  const rows = await d
    .select()
    .from(jobWorkers)
    .where(
      and(
        eq(jobWorkers.id, input.jobWorkerId),
        eq(jobWorkers.workspaceId, workspaceId),
      ),
    );
  if (!rows[0]) return { error: "invalid_job_worker" };
  return { customer: null, jobWorker: rows[0] };
}

/**
 * Resolves the receiving job worker and validates every referenced challan:
 * exists in the workspace, is outward, and belongs to that job worker.
 */
export async function resolveReturnParty(
  d: Queryable,
  workspaceId: string,
  input: { jobWorkerId: string; items: Array<{ challanId: string }> },
): Promise<{ jobWorker: typeof jobWorkers.$inferSelect } | { error: ApiCode }> {
  const jwRows = await d
    .select()
    .from(jobWorkers)
    .where(
      and(
        eq(jobWorkers.id, input.jobWorkerId),
        eq(jobWorkers.workspaceId, workspaceId),
      ),
    );
  const jw = jwRows[0];
  if (!jw) return { error: "invalid_job_worker" };
  const challanIds = [...new Set(input.items.map((i) => i.challanId))];
  const challanRows = await d
    .select()
    .from(challans)
    .where(
      and(
        eq(challans.workspaceId, workspaceId),
        inArray(challans.id, challanIds),
      ),
    );
  if (challanRows.length !== challanIds.length)
    return { error: "invalid_challan" };
  for (const ch of challanRows) {
    if (ch.type !== "outward") return { error: "challan_not_outward" };
    if (ch.jobWorkerId !== input.jobWorkerId)
      return { error: "challan_job_worker_mismatch" };
  }
  return { jobWorker: jw };
}

export { toIso, toDate };
