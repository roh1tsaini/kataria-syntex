/**
 * @kataria-syntex/app-core — the business core shared by every shell
 * (web + Electron + the Capacitor Android shell, all in apps/app).
 *
 * Owns: the API client, zustand stores, session read cache + network
 * reachability, error copy, toasts (sink-based), and page-cache invalidation.
 * Renders nothing and touches no DOM — shells configure it at boot via
 * configureCore(adapter) (see adapter.ts).
 */

export {
  configureCore,
  core,
  type Host,
  type CoreStorage,
  type PlatformAdapter,
} from "./adapter";

export { ApiError, api, apiOrigin, setUpdateRequiredHandler } from "./api";

export { friendlyError } from "./errors";
export { configureToasts, toastSuccess, toastError } from "./toast";
export { registerDataCache } from "./data-caches";

// Update-download progress (ETA math shared by every shell's update store)
export { type UpdateProgress } from "./progress";

// Stores
export {
  useAuth,
  type User,
  type Device,
  type QrLoginCode,
} from "./store/auth";

// Offline read cache + network reachability
export { useSync } from "./offline/sync-state";
export { useNetworkState } from "./network";
