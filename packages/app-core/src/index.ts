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
  coreConfigured,
  type Host,
  type CoreStorage,
  type DesktopTransport,
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
export {
  configureToasts,
  toastSuccess,
  toastError,
  type ToastSink,
} from "./toast";
export { registerDataCache, invalidateDataCaches } from "./data-caches";

// Stores
export {
  useAuth,
  usePermission,
  isPackerOnlyWorkspace,
  ALL_PERMISSIONS,
  type Permission,
  type User,
  type Workspace,
  type Numbering,
  type NumberingType,
  type Company,
  type FinancialYearInfo,
  type Member,
  type PendingMember,
  type Device,
  type LookupResult,
  type QrLoginCode,
} from "./store/auth";

export {
  useChallans,
  type Challan,
  type ChallanDetail,
  type ChallanInput,
  type ChallanItem,
  type ChallanListFilter,
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
  deviceIdentity,
  randomId,
  cacheMasters,
  readMasters,
  type MastersCache,
  cacheCompany,
  readCompany,
  nextSeq,
  bumpCounter,
  cacheSession,
  readSession,
  clearSessionCache,
  clearAccountCache,
  listPending,
  addPending,
  updatePending,
  removePending,
  type PendingChallan,
} from "./offline/core";

export { createOfflineChallan } from "./offline/create";
export { deliver, type DeliverResult } from "./offline/deliver";
export { useOfflineSync, syncPending, syncUntilSettled } from "./offline/sync";
export {
  probeServer,
  recountPending,
  setOnline,
  useSync,
} from "./offline/sync-state";
export { resubmitWithNumber, retryErrored } from "./offline/conflict";
