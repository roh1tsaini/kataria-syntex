import { z } from "zod";
import { round3 } from "./math";

/**
 * Challan domain contract — one source of truth for the request schemas and
 * the server→client DTO shapes, shared by the Hono routes, the offline sync
 * builder, and the React stores.
 */

/** One challan line item as submitted by any client. */
export const challanItemSchema = z.object({
  denierId: z.string().min(1),
  colorId: z.string().optional().nullable().default(""),
  boxNo: z.string().trim().max(60).default(""),
  lotNo: z.string().trim().max(50).default(""),
  cheese: z.number().int().min(0).max(1_000_000).default(0),
  grossWt: z.number().min(0).max(1_000_000).default(0),
  tareWt: z.number().min(0).max(1_000_000).default(0),
  remarks: z.string().trim().max(300).default(""),
  boxes: z.number().int().min(1).max(100_000).default(1),
  netWt: z.number().positive().max(1_000_000), // kg
});

/** POST/PUT /api/challans body. */
export const challanBodySchema = z.object({
  type: z.enum(["sales", "outward"]).default("sales"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  customerId: z.string().min(1).optional(),
  jobWorkerId: z.string().min(1).optional(),
  notes: z.string().trim().max(500).optional().default(""),
  items: z.array(challanItemSchema).min(1).max(200),
  /**
   * Idempotency key. Online creates send just a clientRef so a lost response
   * can't double-create; offline syncs also carry the device-issued number.
   */
  offline: z
    .object({
      clientRef: z.string().min(8).max(60),
      originDevice: z.string().trim().min(1).max(120).optional(),
      challanNumber: z.string().trim().min(1).max(50).optional(),
      seq: z.number().int().min(1).max(1_000_000).optional(),
      fyLabel: z.string().trim().min(1).max(10).optional(),
    })
    .optional(),
});

export type ChallanItemInput = z.infer<typeof challanItemSchema>;
export type ChallanBody = z.infer<typeof challanBodySchema>;

/** One challan line item as the server returns it (names snapshotted). */
export type ChallanItemDto = {
  id: string;
  challanId: string;
  seq: number;
  denierId: string;
  denierName: string;
  colorId: string | null;
  colorName: string;
  colorCode: string | null;
  boxNo: string;
  lotNo: string;
  cheese: number;
  grossWt: number;
  tareWt: number;
  remarks: string;
  boxes: number;
  netWt: number;
  createdAt: string;
};

/** A challan header as the server returns it. */
export type ChallanDto = {
  id: string;
  workspaceId: string;
  financialYearId: string;
  type: "sales" | "outward";
  challanNumber: string;
  date: string;
  customerId: string | null;
  customerName: string | null;
  customerGstin: string | null;
  jobWorkerId: string | null;
  jobWorkerName: string | null;
  notes: string | null;
  totalBoxes: number;
  totalCheese: number;
  totalGrossWt: number;
  totalTareWt: number;
  totalNetWt: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  fyLabel: string;
};

/** Column totals across a set of challan items. */
export function challanTotals(
  items: Array<{
    boxes: number;
    cheese: number;
    grossWt: number;
    tareWt: number;
    netWt: number;
  }>,
) {
  return {
    totalBoxes: items.reduce((s, i) => s + i.boxes, 0),
    totalCheese: items.reduce((s, i) => s + i.cheese, 0),
    totalGrossWt: round3(items.reduce((s, i) => s + i.grossWt, 0)),
    totalTareWt: round3(items.reduce((s, i) => s + i.tareWt, 0)),
    totalNetWt: round3(items.reduce((s, i) => s + i.netWt, 0)),
  };
}
