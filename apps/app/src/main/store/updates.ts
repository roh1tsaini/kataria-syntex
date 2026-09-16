/**
 * Update store — the web and desktop shells' single view of "is a newer
 * version out?". ONE state shape and ONE surface set (banner for
 * non-blocking, blocking dialog for the 426 floor) for every host.
 *
 * - Web: no service worker. Freshness rides plain HTTP caching (index.html
 *   revalidates on every navigation, hashed assets are immutable), so a
 *   routine deploy needs no user action at all and renders no surface: the
 *   running tab picks the fresh shell up on its next navigation, reload, or
 *   reopen. The boot manifest check below fills the Settings version line
 *   and arms the force-update floor.
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
import { compareSemver, hasUpdateFloor } from "@kataria-syntex/shared";
import {
  apiOrigin,
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

/** Manifest poll cadence — boot + every 4h on every host. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

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
      // Web and macOS Electron read the same published manifest to fill the
      // Settings version line and arm the 426 floor. Web deploys otherwise
      // apply silently through revalidated index.html — no prompt, no reload.
      const manifest = await fetchManifest();
      if (!manifest) return "error";
      // The sentinel ("no breaking change shipped") is dropped inside
      // markRequired — see hasUpdateFloor.
      if (manifest.minVersion) get().markRequired(manifest.minVersion);
      set({
        latestVersion: manifest.version,
        downloadUrl: artifactFor(manifest),
      });
      if (compareSemver(manifest.version, __APP_VERSION__) > 0) {
        // macOS arms the banner (dmg download). On web there is nothing to
        // download and nothing to prompt — the deploy applies itself, so the
        // state stays idle and no surface can misfire.
        if (usesManifestFlow()) set({ status: "ready" });
        // Android downloads the APK itself the moment the poll finds it, on
        // whatever network the device is on — the installer stays one tap
        // behind a system notification because Android cannot skip it.
        // "ready" means this version is already staged and waiting for that
        // tap, so the 4h re-poll (the user hasn't installed yet, so the
        // manifest is still "newer") must not download it again.
        if (detectHost() === "android" && get().status !== "ready") {
          void get().installUpdate();
          return "available";
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
      set({
        status: "downloading",
        progress: { percent: 0, totalBytes: 0 },
      });
      try {
        await downloadAndInstallApk(apiOrigin(), ({ bytes, total }) => {
          set({
            progress: {
              percent: total > 0 ? Math.min(100, (bytes / total) * 100) : 0,
              totalBytes: total,
            },
          });
        });
        // Fully downloaded. Android cannot skip the system installer tap, so
        // the notification is the summons to install; the Settings row keeps
        // the action for anyone who swiped it away.
        set({ status: "ready", progress: null });
        const latest = get().latestVersion;
        if (latest) void notifyAndroidUpdateAvailable(latest);
      } catch {
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
    // Web: routine deploys apply on their own — index.html revalidates on
    // every navigation, so the next load runs the fresh shell with no prompt
    // and no forced reload. The only case left is a server-required (426)
    // floor, where the shell on screen cannot reach the API at all: one
    // clean reload picks up the deployed build and re-arms the gate.
    if (get().requiredMinVersion) window.location.reload();
  },

  markRequired: (minVersion) => {
    // The only setter of the floor — guard here, not at every consumer. A
    // published manifest carries the sentinel when no breaking change has
    // shipped; storing it would arm the undismissable dialog for nothing.
    if (!hasUpdateFloor(minVersion)) return;
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

/** Launch-time wiring: the manifest poller (every host) + IPC events.
 * StrictMode mounts App twice in dev — wire exactly once. */
let updateChecksWired = false;

export function initUpdateChecks(): void {
  if (updateChecksWired) return;
  updateChecksWired = true;
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
      } else if (s.kind === "ready") {
        useUpdates.setState({
          latestVersion: s.version,
          status: "ready",
          progress: null,
        });
      } else if (s.kind === "downloading") {
        useUpdates.setState({
          status: "downloading",
          progress: { percent: s.percent, totalBytes: s.total },
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
