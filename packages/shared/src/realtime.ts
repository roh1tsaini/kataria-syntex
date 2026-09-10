/**
 * Realtime vocabulary — one truth for the server's RealtimeRoom and every
 * client's realtime engine. Events are refresh hints, never payloads: a
 * socket message says "this part of the data changed", and clients refetch
 * through the normal api() paths.
 */

/** Data domains a write can mark stale. */
export type RealtimeEntity =
  "challans" | "returns" | "raw-material" | "packing" | "stock" | "masters";

export const REALTIME_ENTITIES: readonly RealtimeEntity[] = [
  "challans",
  "returns",
  "raw-material",
  "packing",
  "stock",
  "masters",
];

export function isRealtimeEntity(value: unknown): value is RealtimeEntity {
  return (
    typeof value === "string" &&
    (REALTIME_ENTITIES as readonly string[]).includes(value)
  );
}
