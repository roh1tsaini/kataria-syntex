/**
 * Sync engine: connectivity tracking + auto-push of the offline pending list.
 *
 * Triggers: app boot, browser "online" event, a 30s interval, and explicit
 * retries from the sync dialog. Deliveries are idempotent (server keys on
 * client_ref), so retrying is always safe.
 */

import { useEffect } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/lib/api";
import { toastError, toastSuccess } from "@/store/toast";
import { parseSeqFromNumber } from "@kataria-syntex/shared";
import {
  bumpCounter,
  listPending,
  readCompany,
  removePending,
  updatePending,
  type PendingChallan,
} from "./core";

type SyncState = {
  /** Server reachable (last probe / API result). */
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  conflictCount: number;
  errorCount: number;
  lastSyncedAt: string | null;
};

export const useSync = create<SyncState>()(() => ({
  online: true,
  syncing: false,
  pendingCount: 0,
  conflictCount: 0,
  errorCount: 0,
  lastSyncedAt: null,
}));

/** Recomputes the pending/conflict/error counts from the stored list. */
export function recountPending(): void {
  const list = listPending();
  useSync.setState({
    pendingCount: list.filter((p) => p.status === "pending").length,
    conflictCount: list.filter((p) => p.status === "conflict").length,
    errorCount: list.filter((p) => p.status === "error").length,
  });
}

export function setOnline(online: boolean): void {
  useSync.setState({ online });
}

/** Cheap reachability probe against the health endpoint. Goes through the
 * platform seam — a raw fetch never reaches the server on Electron. */
export async function probeServer(): Promise<boolean> {
  try {
    await api<unknown>("/health", { timeoutMs: 4000 });
    setOnline(true);
    return true;
  } catch (err) {
    // An HTTP error still means "reachable"; only network failures flip us
    // offline.
    if (err instanceof ApiError && err.isNetworkError) setOnline(false);
    return false;
  }
}

async function deliver(
  p: PendingChallan,
): Promise<
  | { synced: true }
  | { synced: false; reason: "network" | "conflict"; suggestion?: string }
  | { synced: false; reason: "rejected"; code: string }
> {
  try {
    await api("/challans", {
      method: "POST",
      body: {
        ...p.input,
        offline: {
          clientRef: p.clientRef,
          originDevice: p.originDevice,
          challanNumber: p.challanNumber,
          seq: p.seq,
          fyLabel: p.fyLabel,
        },
      },
    });
    return { synced: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const data: unknown = err.data;
      const suggestion =
        data !== null &&
        typeof data === "object" &&
        "suggestion" in data &&
        typeof (data as { suggestion: unknown }).suggestion === "string"
          ? (data as { suggestion: string }).suggestion
          : undefined;
      return { synced: false, reason: "conflict", suggestion };
    }
    if (err instanceof ApiError && err.isNetworkError)
      return { synced: false, reason: "network" };
    return {
      synced: false,
      reason: "rejected",
      code: err instanceof ApiError ? err.code : "unknown",
    };
  }
}

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
      let stoppedByNetwork = false;
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
          stoppedByNetwork = true; // server went away mid-sync — retry later
          break;
        } else {
          updatePending(current.clientRef, {
            status: "error",
            errorCode: result.reason === "rejected" ? result.code : "unknown",
          });
          changed = true;
        }
      }
      if (stoppedByNetwork) break;
    }
  } finally {
    recountPending();
    useSync.setState({
      syncing: false,
      ...(changed ? { lastSyncedAt: new Date().toISOString() } : {}),
    });
    if (changed) {
      const { useChallans } = await import("@/store/challans");
      void useChallans.getState().refresh();
    }
  }
}

/** Runs sync passes until the given item settles (synced, conflict, error or
 * gone). A shared in-flight run may have snapshotted the queue before the
 * caller re-marked the item pending — without this the caller would report
 * success for a delivery that never happened. */
async function syncUntilSettled(
  clientRef: string,
): Promise<PendingChallan | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await syncPending();
    const after = listPending().find((x) => x.clientRef === clientRef);
    if (!after || after.status !== "pending") return after;
  }
  return listPending().find((x) => x.clientRef === clientRef);
}

/** Clash fix: adopt the suggested (or manually entered) number and resync. */
export async function resubmitWithNumber(
  clientRef: string,
  newNumber: string,
): Promise<{ ok: boolean; error?: string }> {
  const p = listPending().find((x) => x.clientRef === clientRef);
  if (!p) return { ok: false, error: "Not found" };
  const numbering = readCompany()?.numbering;
  if (!numbering)
    return { ok: false, error: "Numbering config unavailable offline" };
  const seq = parseSeqFromNumber(numbering, p.input.type, newNumber, p.fyLabel);
  if (seq == null)
    return {
      ok: false,
      error: "Number doesn't match the configured format",
    };
  updatePending(clientRef, {
    challanNumber: newNumber,
    seq,
    status: "pending",
    suggestion: undefined,
    errorCode: undefined,
    local: { ...p.local, challanNumber: newNumber, suggestion: undefined },
  });
  recountPending();
  const after = await syncUntilSettled(clientRef);
  if (!after) return { ok: true };
  if (after.status === "pending")
    return { ok: false, error: "Still waiting to sync — try again" };
  if (after.status === "conflict")
    return { ok: false, error: "That number is also taken" };
  return { ok: false, error: after.errorCode ?? "Rejected" };
}

/** Retry a challan the server rejected (e.g. after fixing the cause online). */
export async function retryErrored(clientRef: string): Promise<void> {
  updatePending(clientRef, { status: "pending", errorCode: undefined });
  recountPending();
  await syncUntilSettled(clientRef);
}

/** Wires the sync triggers for the app lifetime — mount once in AppShell. */
export function useOfflineSync(): void {
  useEffect(() => {
    recountPending();
    const run = async () => {
      if (await probeServer()) await syncPending();
    };
    void run();
    const interval = setInterval(() => void run(), 30_000);
    const onOnline = () => void run();
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
}
