/**
 * Network reachability state.
 *
 * Answers "can we reach the server right now?" — the sidebar indicator reads
 * `online`.
 *
 * Writers: `probeServer()` (mounted from `useNetworkState`) and the
 * network-change subscription.
 */
import { create } from "zustand";
import { api, ApiError } from "../api";

type SyncState = {
  /** Server reachable (last probe / API result). */
  online: boolean;
};

export const useSync = create<SyncState>()(() => ({
  online: true,
}));

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
    // An HTTP error still means "reachable" — a 5xx on /health must not flip
    // us offline. Only network failures do.
    if (err instanceof ApiError && err.isNetworkError) {
      setOnline(false);
      return false;
    }
    setOnline(true);
    return true;
  }
}
