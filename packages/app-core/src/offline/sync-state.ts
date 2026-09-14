/**
 * Network reachability state.
 *
 * Saving is online-only, so this store's one job is answering "can we reach
 * the server right now?" — the sidebar indicator and the go-online message on
 * a blocked save both read `online`.
 *
 * Writers: `probeServer()` (mounted from `useNetworkState`), the network-change
 * subscription, and `api()`'s failure path in `store/challans.ts`.
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
