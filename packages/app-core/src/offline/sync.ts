/**
 * Sync engine: connectivity tracking + auto-push of the offline pending list.
 *
 * Triggers: app boot, adapter network events, a 30s interval, and explicit
 * retries from the sync dialog. Deliveries are idempotent (server keys on
 * client_ref), so retrying is always safe.
 *
 * Orchestrator only — state lives in sync-state.ts, single delivery in
 * deliver.ts, human-path settlement in conflict.ts.
 */

import { useEffect } from "react";
import { core } from "../adapter";
import { toastError, toastSuccess } from "../toast";
import {
  bumpCounter,
  listPending,
  removePending,
  updatePending,
  type PendingChallan,
} from "./core";
import { deliver } from "./deliver";
import { probeServer, recountPending, setOnline, useSync } from "./sync-state";

/** Pushes every actionable pending challan (conflicts/errors need a human).
 * Concurrent callers share one run. */
export function syncPending(): Promise<void> {
  if (!syncInFlight) {
    syncInFlight = runSync().finally(() => {
      syncInFlight = null;
    });
  }
  return syncInFlight;
}

let syncInFlight: Promise<void> | null = null;

async function runSync(): Promise<void> {
  useSync.setState({ syncing: true });
  let changed = false;
  try {
    // Multiple passes: items created while a pass is in flight are picked up
    // by the next one instead of waiting for the 30s tick.
    for (let pass = 0; pass < 3; pass++) {
      const queue = listPending().filter((p) => p.status === "pending");
      if (queue.length === 0) break;
      let stopped = false;
      for (const snapshot of queue) {
        // Re-read before delivering: the item may have been deleted or
        // renumbered since the queue snapshot was taken.
        const current = listPending().find(
          (x) => x.clientRef === snapshot.clientRef && x.status === "pending",
        );
        if (!current) continue;
        const result = await deliver(current);
        if (result.synced) {
          removePending(current.clientRef);
          bumpCounter(current.fyLabel, current.input.type, current.seq);
          changed = true;
          toastSuccess(
            `Synced ${current.challanNumber}`,
            "Saved to the server.",
          );
        } else if (result.reason === "conflict") {
          updatePending(current.clientRef, {
            status: "conflict",
            suggestion: result.suggestion,
          });
          changed = true;
          toastError(
            `Number clash on ${current.challanNumber}`,
            "Open sync status to fix it.",
          );
        } else if (result.reason === "network") {
          setOnline(false);
          stopped = true; // server went away mid-sync — retry later
          break;
        } else if (result.reason === "retry") {
          // Session expiry or a server fault: every further delivery fails the
          // same way. Leave the queue pending so re-auth / recovery resumes it
          // instead of parking each challan as a permanent error.
          stopped = true;
          break;
        } else {
          updatePending(current.clientRef, {
            status: "error",
            errorCode: result.reason === "rejected" ? result.code : "unknown",
          });
          changed = true;
        }
      }
      if (stopped) break;
    }
  } finally {
    recountPending();
    useSync.setState({
      syncing: false,
      ...(changed ? { lastSyncedAt: new Date().toISOString() } : {}),
    });
    if (changed) {
      const { useChallans } = await import("../store/challans");
      // The summary cache must not keep pre-sync totals now that queued
      // rows are accepted server-side.
      useChallans.getState().clearSummaryCache();
      void useChallans.getState().refresh();
    }
  }
}

/** Runs sync passes until the given item settles (synced, conflict, error or
 * gone). A shared in-flight run may have snapshotted the queue before the
 * caller re-marked the item pending — without this the caller would report
 * success for a delivery that never happened. */
export async function syncUntilSettled(
  clientRef: string,
): Promise<PendingChallan | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await syncPending();
    const after = listPending().find((x) => x.clientRef === clientRef);
    if (!after || after.status !== "pending") return after;
  }
  return listPending().find((x) => x.clientRef === clientRef);
}

/** Wires the sync triggers for the app lifetime — mount once in the root
 * layout (web AppShell / Android root). */
export function useOfflineSync(): void {
  useEffect(() => {
    recountPending();
    const run = async () => {
      if (await probeServer()) await syncPending();
    };
    void run();
    const interval = setInterval(() => void run(), 30_000);
    const unsub = core().onNetworkChange((online) => {
      if (online) void run();
      else setOnline(false);
    });
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);
}
