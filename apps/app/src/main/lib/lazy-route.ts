/**
 * Route-level code splitting with a stale-deploy guard.
 *
 * Every deploy replaces every content-hashed chunk, so a tab left open across
 * one can ask for a chunk URL that no longer exists on the edge — the classic
 * "Failed to fetch dynamically imported module" crash. The industry-standard
 * fix (React Router / Vite apps from every large shop) is to reload once: the
 * shell that comes back IS the current deploy, so the retry resolves. A second
 * failure is not a stale-build problem, so it reaches the ErrorBoundary
 * instead of reloading forever.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/** Per-tab-session marker — survives the reload, dies with the tab. */
const RELOAD_KEY = "routes.chunkReloaded";

export function lazyRoute<T extends ComponentType<object>>(
  load: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    load().catch((error: unknown) => {
      let alreadyReloaded: boolean;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === "1";
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        // Storage unavailable — no way to guarantee a single reload, so the
        // error surfaces rather than risking a loop.
        throw error;
      }
      if (alreadyReloaded) throw error;
      window.location.reload();
      // Never resolves: the reload owns the document from here.
      return new Promise<{ default: T }>(() => {});
    }),
  );
}
