/**
 * @kataria-syntex/app-core — the business core shared by every shell
 * (web/PWA + Electron in apps/app, React Native Android in apps/android).
 *
 * Owns: the API client, zustand stores, the offline engine (outbox, sync,
 * conflicts), error copy, toasts (sink-based), and page-cache invalidation.
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

export {
  ApiError,
  api,
  apiBlob,
  apiOrigin,
  base64ToBlob,
  deviceHeaders,
  setUpdateRequiredHandler,
} from "./api";

export { friendlyError } from "./errors";
export { configureToasts, toastSuccess, toastError } from "./toast";
export { registerDataCache } from "./data-caches";

// Update-download progress (ETA math shared by every shell's update store)
export { createEtaEstimator, type UpdateProgress } from "./progress";

// Realtime change bus
export {
  subscribeChanges,
  useRealtime,
  useRealtimeEvent,
  type ChangeHandler,
} from "./realtime";

// Stores
export {
  useAuth,
  usePermission,
  isPackerOnlyWorkspace,
  ALL_PERMISSIONS,
  type Permission,
  type Numbering,
  type NumberingType,
  type Member,
  type Device,
  type QrLoginCode,
} from "./store/auth";

export {
  useChallans,
  type Challan,
  type ChallanInput,
  type ChallanItem,
  type ChallanType,
  type RecentChallan,
} from "./store/challans";

export {
  useMasters,
  hydrateMastersCache,
  type Customer,
  type JobWorker,
  type Denier,
  type Color,
  type Supplier,
  type CustomerInput,
  type JobWorkerInput,
  type DenierInput,
  type ColorInput,
  type SupplierInput,
} from "./store/masters";

export {
  useRecipes,
  type RecipeDetail,
  type RecipeInput,
  type RecipeListItem,
  type RecipeVersionPayload,
} from "./store/recipes";

// Offline engine
export {
  randomId,
  nextSeq,
  readCompany,
  listPending,
  type PendingChallan,
} from "./offline/core";

export { useOfflineSync } from "./offline/sync";
export { useSync } from "./offline/sync-state";
export { resubmitWithNumber, retryErrored } from "./offline/conflict";
