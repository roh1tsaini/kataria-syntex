/**
 * Registry for the page-level module caches (stock, packing, raw material,
 * returns, reports, dashboard flow cards). They are stale-while-revalidate
 * snapshots keyed by workspaceId — every page refetches on mount — but a
 * snapshot must never outlive the account context it was loaded under.
 * registerDataCache wires each cache into one wipe call that account resets
 * (logout / 401 / fresh login, via clearAccountCache) and future invalidation
 * points can invoke.
 */
type Invalidator = () => void;

const invalidators = new Set<Invalidator>();

/** Page modules call this once at module scope for each module cache. */
export function registerDataCache(clear: Invalidator): void {
  invalidators.add(clear);
}

/** Wipes every registered module cache. Cheap and idempotent. */
export function invalidateDataCaches(): void {
  for (const clear of invalidators) clear();
}
