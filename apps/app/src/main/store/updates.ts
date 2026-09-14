/**
 * Update store — the web and desktop shells' single view of "is a newer
 * version out?". ONE state shape and ONE surface set (banner for
 * non-blocking, blocking dialog for the 426 floor) for every host.
 *
 * - Web/PWA: the custom service worker (src/main/sw.ts) installs a new deploy
 *   sequentially, posts ks:sw-progress messages (turned into the Settings
 *   progress readout) and applies itself — precache, then skipWaiting() and
 *   clients.claim(). A routine deploy therefore needs no user action at all
 *   and renders no surface: the running tab picks the fresh shell up on its
 *   next navigation. A hidden update check runs hourly so long-lived tabs
 *   find deploys.
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
import {
  desktopBridge,
  detectHost,
  downloadAndInstallApk,
  initAndroidUpdateNotifications,
  notifyAndroidUpdateAvailable,
  reloadOnStaleAndroidBundle,
} from "@/lib/platform";

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
  android?: { apk?: string };
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
      // additionally learns about deploys from the SW itself — the manifest
      // read only fills the Settings version line and the 426 floor.)
      const manifest = await fetchManifest();
      if (!manifest) return "error";
      if (manifest.minVersion) get().markRequired(manifest.minVersion);
      set({
        latestVersion: manifest.version,
        downloadUrl: artifactFor(manifest),
      });
      if (compareSemver(manifest.version, __APP_VERSION__) > 0) {
        // "ready" arms the deliberate Settings action on Android (APK) and
        // the banner on macOS (dmg). On web there is nothing to download and
        // nothing to prompt — the deploy applies itself, so the state stays
        // idle and no surface can misfire.
        if (detectHost() !== "web") set({ status: "ready" });
        // Android announces each release once via a system notification
        // (deduped inside) so the user knows an APK is waiting without
        // opening Settings.
        if (detectHost() === "android") {
          void notifyAndroidUpdateAvailable(manifest.version);
        }
        return "available";
      }
      return "up-to-date";
    } finally {
      set({ checking: false });
    }
  },

  installUpdate: async () => {
    if (detectHost() === "android") {
      // Single-flight like the desktop shell: a second tap while the APK
      // streams is a no-op, and the native side single-flights too.
      if (get().status === "downloading") return;
      etaFrom.reset();
      set({
        status: "downloading",
        progress: {
          percent: 0,
          transferredBytes: 0,
          totalBytes: 0,
          etaSeconds: null,
        },
      });
      try {
        await downloadAndInstallApk(apiOrigin(), ({ bytes, total }) => {
          set({
            progress: {
              percent: total > 0 ? Math.min(100, (bytes / total) * 100) : 0,
              transferredBytes: bytes,
              totalBytes: total,
              etaSeconds: etaFrom.sample(bytes, total),
            },
          });
        });
        // Fully downloaded — the system installer dialog takes over from here.
        set({ status: "ready", progress: null });
      } catch {
        etaFrom.reset();
        set({ status: "error", progress: null });
      }
      return;
    }
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
    // Web/PWA: routine deploys apply on their own — sw.ts self-activates and
    // the next navigation is network-first, so it serves the fresh shell with
    // no prompt and no forced reload. The only case left is a server-required
    // (426) floor, where the shell on screen cannot reach the API at all: one
    // clean reload picks up the deployed build and re-arms the gate.
    if (get().requiredMinVersion) window.location.reload();
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
    // Install failed — the running build keeps working and the hourly probe
    // retries. The readout simply never appears.
    clearInstallProgress();
    return;
  }
  if (event.stage === "done") {
    clearInstallProgress();
    return;
  }
  // Install phase: the deploy streams into the precache in the background.
  // The Settings readout is the only surface it ever gets — a routine deploy
  // never prompts, banners, or claims the tab.
  if (!useUpdates.getState().latestVersion) {
    void useUpdates.getState().checkNow();
  }
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

async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  // Progress only: the worker owns the whole apply flow (precache →
  // skipWaiting → claim), so the page never posts SKIP_WAITING and never
  // reloads on controllerchange.
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data: unknown = event.data;
    if (isSwProgressEvent(data)) handleSwProgress(data);
  });
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    // Registration blocked/unsupported — the app still works online; the
    // manifest check keeps arming the 426 floor.
  }
}

/** The install readout must never freeze on a stale percent — finished,
 * failed or superseded installs all clear it. */
function clearInstallProgress(): void {
  etaFrom.reset();
  useUpdates.setState({ progress: null, status: "idle" });
}

/** Launch-time wiring: SW registration (web), the macOS poller, IPC events.
 * StrictMode mounts App twice in dev — wire exactly once. */
let updateChecksWired = false;

export function initUpdateChecks(): void {
  if (updateChecksWired) return;
  updateChecksWired = true;
  // The Android WebView must never register the PWA worker — there is no
  // navigation-time update check inside the native shell, and the bundle is
  // replaced by cap sync, not by the worker. It polls the manifest like the
  // macOS flow instead.
  if (desktopBridge() === null && detectHost() !== "android") {
    void registerServiceWorker();
    // Long-lived tabs: browsers only check for a new worker on navigation, so
    // a standalone PWA window left open for days would never see a deploy.
    // The hourly probe covers that — silently: a deploy applies itself.
    setInterval(() => {
      void navigator.serviceWorker?.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.update();
      });
    }, SW_CHECK_INTERVAL_MS);
    return;
  }
  if (detectHost() === "android") {
    // The WebView can still be running the bundle from the APK that was
    // replaced (its cached copy is not invalidated by an install) — self-heal
    // before the manifest poll, since a bundle/APK mismatch also breaks the
    // 426 handshake. The release-announcement listener wires alongside it.
    void reloadOnStaleAndroidBundle();
    void initAndroidUpdateNotifications();
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

/** True where a routine update needs a non-blocking install/download surface. */
export function showUpdateBanner(): boolean {
  const s = useUpdates.getState();
  if (s.requiredMinVersion) return false;
  if (s.dismissedThisSession) return false;
  // Deferred via the banner's dismiss — hidden until a different version.
  // latestVersion can still be in flight when the user dismisses, so a
  // dismissed version with no manifest yet counts as dismissed; a genuinely
  // new build re-shows the banner once its version arrives.
  if (
    s.dismissedVersion &&
    (s.latestVersion === null || s.latestVersion === s.dismissedVersion)
  ) {
    return false;
  }
  // Browser and Android availability checks are background work. The current
  // web tab picks up the fresh shell on its next navigation; Android keeps a
  // downloaded release discoverable from Settings. Neither interrupts work.
  if (desktopBridge() === null) return false;
  return usesManifestFlow() && s.status === "ready";
}
