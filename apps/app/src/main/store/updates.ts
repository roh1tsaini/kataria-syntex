/**
 * Update store — the web and desktop shells' single view of "is a newer
 * version out?". ONE state shape and ONE surface set (banner for
 * non-blocking, blocking dialog for the 426 floor) for every host.
 *
 * - Web/PWA: the custom service worker (src/main/sw.ts) installs a new
 *   deploy sequentially and posts ks:sw-progress messages — this store
 *   turns them into live download progress (percent, size, ETA) on the
 *   banner. When the new worker is fully cached it sits WAITING; the
 *   banner's "reload to apply" sends SKIP_WAITING and reloads on the
 *   resulting controllerchange. The worker never activates itself and a
 *   tab is never force-reloaded. A hidden update check runs hourly so
 *   long-lived tabs find deploys.
 * - Electron Windows/Linux: status is pushed over the kc:update:* IPC bridge
 *   (electron/updater.ts) — silent background download with byte progress,
 *   "restart to update" when staged.
 * - Electron macOS: polls latest.json from the Worker's /releases bucket on
 *   launch + every 4h; the banner drives the dmg download. (The Android app
 *   runs its own manifest poller — apps/android.)
 *
 * Force updates (server 426 / published minVersion) set `requiredMinVersion`,
 * which the blocking dialog in ui/components/update-dialog.tsx renders
 * undismissably. The non-blocking banner can be dismissed — the dismissal
 * remembers the version, so the banner stays gone until the NEXT version
 * ships instead of nagging on every load.
 */
import { create } from "zustand";
import { compareSemver } from "@kataria-syntex/shared";
import {
  apiOrigin,
  createEtaEstimator,
  setUpdateRequiredHandler,
  type UpdateProgress,
} from "@kataria-syntex/app-core";
import { desktopBridge } from "@/lib/platform";

export type { UpdateProgress };

export type UpdateState = {
  /** Latest version published to /releases, when known. */
  latestVersion: string | null;
  /** Server floor (minAppVersion). Non-null ⇒ blocking dialog must show. */
  requiredMinVersion: string | null;
  /** Coarse status for the Settings row / banner. */
  status: "idle" | "checking" | "downloading" | "ready" | "error";
  /** Live download/install progress — null when nothing is in flight. */
  progress: UpdateProgress | null;
  /** True while a manual (Settings) check is in flight. */
  checking: boolean;
  /** Host-specific artifact URL from the manifest (macOS dmg). */
  downloadUrl: string | null;
  /**
   * Web/PWA only — truthy once a new service worker is WAITING (new build
   * fully cached, not yet controlling).
   */
  swWaiting: boolean;
  /** Version deferred via the banner's dismiss — hides the banner until a
   * different version ships. */
  dismissedVersion: string | null;
  /** Set by dismiss() even when the published version isn't known yet —
   * hides the banner for this page session unconditionally. */
  dismissedThisSession: boolean;
  checkNow: () => Promise<"up-to-date" | "available" | "error">;
  installUpdate: () => Promise<void>;
  markRequired: (minVersion: string) => void;
  dismiss: () => void;
};

/** Where latest.json lives (same origin; native shells bake the absolute origin). */
function releasesManifestUrl(): string {
  return `${apiOrigin()}/releases/app/android/latest.json`;
}

type LatestManifest = {
  version: string;
  minVersion?: string;
  desktop?: { win?: string; mac?: string; linux?: string };
};

async function fetchManifest(): Promise<LatestManifest | null> {
  try {
    const res = await fetch(releasesManifestUrl(), {
      // Manifests are served with max-age=60 for native updaters; the browser
      // HTTP cache would delay a new release by up to that window — bypass it.
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object") return null;
    const rec = body as Record<string, unknown>;
    if (typeof rec.version !== "string") return null;
    return body as LatestManifest;
  } catch {
    return null;
  }
}

/** macOS Electron reports as desktop but updates via manifest + dmg. */
function usesManifestFlow(): boolean {
  return desktopBridge()?.platform === "darwin";
}

/** The manifest artifact this host installs. */
function artifactFor(manifest: LatestManifest): string | null {
  const mac = manifest.desktop?.mac;
  return typeof mac === "string" && mac.startsWith("/releases/")
    ? `${apiOrigin()}${mac}`
    : null;
}

/** Poll cadence for the manifest host — launch + every 4h. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** Hidden service-worker update probe for long-lived tabs. */
const SW_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const DISMISS_KEY = "updates.dismissedVersion";

function readDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

// Wire the api client's 426 classifier to the blocking-dialog state. Module
// scope: the handler exists before the first bootstrap request can 426.
setUpdateRequiredHandler((minVersion) =>
  useUpdates.getState().markRequired(minVersion),
);

// ETA math shared by every host's progress source (only one is ever active).
const etaFrom = createEtaEstimator();

export const useUpdates = create<UpdateState>()((set, get) => ({
  latestVersion: null,
  requiredMinVersion: null,
  status: "idle",
  progress: null,
  checking: false,
  downloadUrl: null,
  swWaiting: false,
  dismissedVersion: readDismissedVersion(),
  dismissedThisSession: false,

  checkNow: async () => {
    set({ checking: true });
    try {
      const desktop = desktopBridge();
      if (desktop && !usesManifestFlow()) {
        const res = await desktop.checkForUpdate();
        if (res.kind === "available") {
          // autoDownload is on in the shell — the "downloading" event follows
          // immediately; "ready" must wait for update-downloaded, not fire
          // while the installer is still on the wire.
          set({ latestVersion: res.version, status: "idle", progress: null });
          return "available";
        }
        if (res.kind === "ready") {
          set({ latestVersion: res.version, status: "ready", progress: null });
          return "available";
        }
        return res.kind === "error" ? "error" : "up-to-date";
      }
      // Web and macOS Electron read the same published manifest. (Web
      // additionally learns about deploys via the SW waiting event — this
      // manifest read is the version number shown in the banner.)
      const manifest = await fetchManifest();
      if (!manifest) return "error";
      if (manifest.minVersion) get().markRequired(manifest.minVersion);
      set({
        latestVersion: manifest.version,
        downloadUrl: artifactFor(manifest),
      });
      if (compareSemver(manifest.version, __APP_VERSION__) > 0) {
        set({ status: "ready" });
        return "available";
      }
      // A waiting worker (deploy mid-install) is surfaced by the SW events.
      return "up-to-date";
    } finally {
      set({ checking: false });
    }
  },

  installUpdate: async () => {
    const desktop = desktopBridge();
    if (desktop) {
      if (usesManifestFlow()) {
        // macOS: hand the published dmg to the OS browser.
        const url = get().downloadUrl;
        if (url) await desktop.openReleaseUrl(url);
        return;
      }
      await desktop.restartToUpdate();
      return;
    }
    // Web/PWA: skip-waiting → the new worker takes control → the
    // controllerchange listener reloads. Only meaningful once the new build
    // is fully cached (waiting) — mid-install there is nothing to apply.
    if (!get().swWaiting) return;
    await applyWebUpdate();
  },

  markRequired: (minVersion) => {
    const current = get().requiredMinVersion;
    // Keep the highest floor ever seen this session.
    if (!current || compareSemver(minVersion, current) > 0) {
      set({ requiredMinVersion: minVersion });
    }
  },

  dismiss: () => {
    const version = get().latestVersion;
    if (version) {
      try {
        localStorage.setItem(DISMISS_KEY, version);
      } catch {
        // storage unavailable — dismissal stays for this session only
      }
    }
    // Unknown version (manifest unreachable) still hides the banner — for
    // this page session; a persisted defer needs the version to compare
    // against the next deploy.
    set({
      dismissedThisSession: true,
      ...(version ? { dismissedVersion: version } : {}),
    });
  },
}));

// ── Web/PWA service-worker flow ─────────────────────────────────────────────

type SwProgressEvent =
  | {
      type: "ks:sw-progress";
      stage: "install";
      done: number;
      totalFiles: number;
      bytes: number;
      totalBytes: number;
    }
  | { type: "ks:sw-progress"; stage: "done" }
  | { type: "ks:sw-progress"; stage: "error" };

function isSwProgressEvent(value: unknown): value is SwProgressEvent {
  if (value === null || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  if (rec.type !== "ks:sw-progress") return false;
  return (
    rec.stage === "install" || rec.stage === "done" || rec.stage === "error"
  );
}

function handleSwProgress(event: SwProgressEvent): void {
  if (event.stage === "error") {
    // Install failed — the old version keeps working; the hourly probe
    // retries. No UI state: the banner simply never appears.
    etaFrom.reset();
    useUpdates.setState({ status: "idle", progress: null });
    return;
  }
  // The new build is fully cached — install-phase messages (which can arrive
  // straggling after the worker reached "installed") must never override the
  // ready state or re-disable the apply button.
  if (useUpdates.getState().swWaiting) return;
  if (event.stage === "done") {
    void observeRegistration();
    return;
  }
  // Fill the banner's version number from the published manifest once, and
  // attach to the installing worker (updatefound may have fired before the
  // page attached its listeners — installs start during navigation).
  if (!useUpdates.getState().latestVersion) {
    void useUpdates.getState().checkNow();
  }
  void observeRegistration();
  const percent =
    event.totalBytes > 0
      ? (event.bytes / event.totalBytes) * 100
      : (event.done / event.totalFiles) * 100;
  useUpdates.setState({
    status: "downloading",
    progress: {
      percent,
      transferredBytes: event.bytes,
      totalBytes: event.totalBytes,
      etaSeconds: etaFrom.sample(event.bytes, event.totalBytes),
    },
  });
}

/** Set only by installUpdate() — the controllerchange listener reloads the
 * page ONLY for a user-requested apply, never for a first install/claim. */
let applyRequested = false;

async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (applyRequested) window.location.reload();
  });
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data: unknown = event.data;
    if (isSwProgressEvent(data)) handleSwProgress(data);
  });
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    watchForWaiting(reg);
    // Installs start at the navigation-time update check — they can begin
    // (and even finish) before this page's listeners exist, and no message
    // will have arrived to re-arm the watch. Re-check the registration a
    // few times after load; observeRegistration is idempotent.
    for (const delay of [1_000, 4_000, 15_000]) {
      setTimeout(() => void observeRegistration(), delay);
    }
  } catch {
    // Registration blocked/unsupported — the app still works online; the
    // manifest check keeps arming the 426 floor.
  }
}

/** Install finished or died without producing a waiting update — the
 * banner's progress readout must never freeze on a stale percent. */
function clearInstallProgress(): void {
  etaFrom.reset();
  useUpdates.setState({ progress: null, status: "idle" });
}

/** A worker that finished installing while an old one still controls the
 * page is a WAITING update — announce it to the banner. On a fresh origin
 * (no old controller) the page IS the new version: drop the install banner. */
function announceWaiting(): void {
  if (!navigator.serviceWorker.controller) {
    clearInstallProgress();
    return;
  }
  if (useUpdates.getState().swWaiting) return;
  etaFrom.reset();
  void useUpdates.getState().checkNow();
  useUpdates.setState({ swWaiting: true, progress: null, status: "ready" });
}

function watchForWaiting(reg: ServiceWorkerRegistration): void {
  // An update may already be waiting from before this page load.
  if (reg.waiting) announceWaiting();
  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed") announceWaiting();
      // A failed install (network flap mid-deploy) retires as "redundant"
      // without ever reaching "installed" — clear the frozen readout.
      else if (installing.state === "redundant") clearInstallProgress();
    });
  });
}

/** (Re)attaches waiting/installing observation to the current registration —
 * safe to call repeatedly; installs can start before the page's listeners
 * exist, so progress messages re-arm the watch mid-flight. */
async function observeRegistration(): Promise<void> {
  const reg = await navigator.serviceWorker
    ?.getRegistration()
    .catch(() => undefined);
  if (!reg) return;
  if (reg.waiting) {
    announceWaiting();
    return;
  }
  const worker = reg.installing;
  if (worker) {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") announceWaiting();
      else if (worker.state === "redundant") clearInstallProgress();
    });
  } else if (useUpdates.getState().progress !== null) {
    // Nothing is installing or waiting anymore (broadcasts lost, install
    // finished between observations) — never keep a dead progress readout.
    clearInstallProgress();
  }
}

async function applyWebUpdate(): Promise<void> {
  const reg = await navigator.serviceWorker
    ?.getRegistration()
    .catch(() => undefined);
  const waiting = reg?.waiting;
  if (!waiting || !navigator.serviceWorker.controller) {
    // Nothing to hand over to — a plain reload re-fetches the fresh shell
    // (index.html is no-cache) and re-arms the 426 gate.
    window.location.reload();
    return;
  }
  applyRequested = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
  // The controllerchange listener (wired at registration) reloads as soon as
  // the new worker controls the page. If activation stalls, force the
  // handover after a generous window — an early reload would just re-serve
  // the old precached shell and never converge.
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  if (useUpdates.getState().swWaiting) window.location.reload();
}

/** Launch-time wiring: SW registration (web), the macOS poller, IPC events.
 * StrictMode mounts App twice in dev — wire exactly once. */
let updateChecksWired = false;

export function initUpdateChecks(): void {
  if (updateChecksWired) return;
  updateChecksWired = true;
  if (desktopBridge() === null) {
    void registerServiceWorker();
    // Long-lived tabs: SWs are checked by the browser on navigation only, so
    // a standalone PWA window left open for days would never see a deploy.
    // The hourly probe covers that.
    setInterval(() => {
      void navigator.serviceWorker?.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.update();
      });
    }, SW_CHECK_INTERVAL_MS);
    return;
  }
  void useUpdates.getState().checkNow();
  setInterval(() => void useUpdates.getState().checkNow(), CHECK_INTERVAL_MS);

  const desktop = desktopBridge();
  if (desktop?.onUpdateStatus) {
    desktop.onUpdateStatus((s) => {
      if (s.kind === "available") {
        // Match checkNow: the download starts automatically in the shell.
        useUpdates.setState({
          latestVersion: s.version,
          status: "idle",
          progress: null,
        });
        etaFrom.reset();
      } else if (s.kind === "ready") {
        useUpdates.setState({
          latestVersion: s.version,
          status: "ready",
          progress: null,
        });
        etaFrom.reset();
      } else if (s.kind === "downloading") {
        useUpdates.setState({
          status: "downloading",
          progress: {
            percent: s.percent,
            transferredBytes: s.transferred,
            totalBytes: s.total,
            etaSeconds: etaFrom.sample(s.transferred, s.total),
          },
        });
      }
    });
  }
}

/** True where the banner (not the blocking dialog) is the update surface. */
export function showUpdateBanner(): boolean {
  const s = useUpdates.getState();
  if (s.requiredMinVersion) return false;
  if (s.dismissedThisSession) return false;
  // Deferred via the banner's dismiss — hidden until a different version.
  if (s.dismissedVersion && s.latestVersion === s.dismissedVersion) {
    return false;
  }
  if (desktopBridge() === null) {
    // Web/PWA: live install progress, then the waiting worker.
    return s.progress !== null || s.swWaiting;
  }
  return usesManifestFlow() && s.status === "ready";
}
