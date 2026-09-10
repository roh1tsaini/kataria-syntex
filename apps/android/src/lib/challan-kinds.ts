/**
 * Challan kind descriptors — the RN counterpart of web's
 * `challans-shared.tsx` plus each page's local KINDS map.
 *
 * One table serves the registers, the detail screen and the editor, so their
 * copy and route params can't drift apart.
 */

import type { ChallanType } from "@kataria-syntex/app-core";

export type ChallanKind = {
  type: ChallanType;
  /** Screen/nav title, e.g. "Sales challans". */
  title: string;
  /** Screen subtitle, e.g. "Create, edit and print." */
  desc: string;
  /** Lower-case noun used in confirm copy, e.g. "sales challan". */
  singular: string;
  /** Counterparty column label, e.g. "Customer". */
  party: string;
  /** Lower-case plural used in "Back to …", e.g. "sales challans". */
  listTitle: string;
  searchPlaceholder: string;
  emptyHint: string;
};

export const SALES_KIND: ChallanKind = {
  type: "sales",
  title: "Sales challans",
  desc: "Create, edit and print.",
  singular: "sales challan",
  party: "Customer",
  listTitle: "sales challans",
  searchPlaceholder: "Search customer…",
  emptyHint: "No challans found",
};

export const OUTWARD_KIND: ChallanKind = {
  type: "outward",
  title: "Job-work challans",
  desc: "Outward movement to job workers, no rates.",
  singular: "job-work challan",
  party: "Job worker",
  listTitle: "job-work challans",
  searchPlaceholder: "Search job worker…",
  emptyHint: "No job-work challans found",
};

export const KINDS: Record<"sales" | "outward", ChallanKind> = {
  sales: SALES_KIND,
  outward: OUTWARD_KIND,
};

/** Route param → kind, defaulting to sales for an absent/garbage value. */
export function kindFromParam(param: string | undefined): ChallanKind {
  return KINDS[param === "outward" ? "outward" : "sales"];
}
