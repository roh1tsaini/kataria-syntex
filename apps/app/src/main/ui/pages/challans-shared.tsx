import type { ChallanType } from "@/store/challans";

/**
 * Kind descriptors for the two challan routes — sales and outward — consumed
 * by the list, editor, detail and print modules.
 */

export type ChallanKind = {
  type: ChallanType;
  listPath: string; // "/challans" | "/outward"
  newPath: string; // "/challans/new" | "/outward/new"
  title: string; // "Sales challans" | "Job-work challans"
  desc: string;
  singular: string; // "sales challan" | "job-work challan"
  party: string; // "Customer" | "Job worker"
  printTitle: string; // "Sales Challan" | "Job-Work (Dyeing) Challan"
  searchPlaceholder: string;
  emptyHint: string;
};

export const SALES_KIND: ChallanKind = {
  type: "sales",
  listPath: "/challans",
  newPath: "/challans/new",
  title: "Sales challans",
  desc: "Create, edit and print.",
  singular: "sales challan",
  party: "Customer",
  printTitle: "Sales Challan",
  searchPlaceholder: "Search customer…",
  emptyHint: "No challans found",
};

export const OUTWARD_KIND: ChallanKind = {
  type: "outward",
  listPath: "/outward",
  newPath: "/outward/new",
  title: "Job-work challans",
  desc: "Outward movement to job workers, no rates.",
  singular: "job-work challan",
  party: "Job worker",
  printTitle: "Job-Work (Dyeing) Challan",
  searchPlaceholder: "Search job worker…",
  emptyHint: "No job-work challans found",
};
