/**
 * Network reachability hook.
 *
 * Tracks whether the server is reachable so the offline indicator stays
 * accurate.
 *
 * No polling and no queue — the platform network event (`core().onNetworkChange`,
 * Capacitor `@capacitor/network` on Android, the browser otherwise) is the
 * signal, backed by a probe on mount. `api()` also flips the flag on a real
 * failure, so a silently-dead connection surfaces on the next request.
 *
 * Mount once in the app shell.
 */
import { useEffect } from "react";

import { core } from "./adapter";
import { probeServer, setOnline } from "./offline/sync-state";

export function useNetworkState(): void {
  useEffect(() => {
    void probeServer();
    const unsub = core().onNetworkChange((online) => {
      setOnline(online);
      // A "back online" event needs a probe before we trust it — the router
      // may be up with no route to the worker.
      if (online) void probeServer();
    });
    return () => {
      unsub();
    };
  }, []);
}
