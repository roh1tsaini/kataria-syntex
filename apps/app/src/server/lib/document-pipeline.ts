/**
 * Document Pipeline — deep module for all document creation.
 *
 * Modularized into:
 *   - pipeline/common.ts: shared party resolution, numbering, and FY assertions
 *   - pipeline/raw.ts: raw material creation and updates
 *   - pipeline/packing.ts: packing creation and updates
 *   - pipeline/returns.ts: job work return creation, updates, and balance tracking
 *   - pipeline/challans.ts: delivery challan creation, updates, and DTO mapping
 *
 * One interface, 4 adapters (sales/outward, raw, packing, returns).
 * Routes stay thin: parse → call pipeline → shape JSON.
 * Business logic lives here, testable without HTTP.
 */

export * from "./pipeline/common";
export * from "./pipeline/raw";
export * from "./pipeline/packing";
export * from "./pipeline/returns";
export * from "./pipeline/challans";
