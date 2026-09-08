/**
 * Sync connectivity state: store, counts, reachability probe.
 * Split from sync.ts — state lives here, orchestration stays there.
 */
import { create } from "zustand";
import { api, ApiError } from "../api";
import { listPending } from "./core";

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
