/**
 * Update store — the web and desktop shells' single view of "is a newer
 * version out?". ONE state shape and ONE surface set (banner for
 * non-blocking, blocking dialog for the 426 floor) for every host.
 *
 * - Web: no service worker. Freshness rides plain HTTP caching (index.html
 *   revalidates on every navigation, hashed assets are immutable), so a
 *   routine deploy needs no user action at all and renders no surface: the
 *   running tab picks the fresh shell up on its next navigation, reload, or
 *   reopen. The boot manifest check below fills the Settings version line.
 *   A force-update floor (server 426 or published minVersion) heals itself
 *   the same silent way: one guarded reload runs the fresh shell, and only
 *   a client that is still stale after that reload arms the blocking
 *   dialog (the deploy hasn't reached the edge yet).
 * - Electron Windows/Linux: status is pushed over the kc:update:* IPC bridge
 *   (electron/updater.ts) — silent background download with byte progress,
 *   "restart to update" when staged.
 * - Electron macOS: polls latest.json from the Worker's /releases bucket on
 *   launch + every 4h; the banner drives the dmg download.
 * - Android: the same poll stages the APK in the background (download +
 *   SHA-256 verify, never the installer or its permission screen) and the
 *   staged version persists across restarts; a tap installs it (notification,
 *   Settings row, or the blocking floor dialog).
 *
 * Force updates (server 426 / published minVersion) set `requiredMinVersion`,
 * which the blocking dialog in ui/components/update-dialog.tsx renders
 * undismissably — except on web, where markRequired reloads once silently
 * first and only arms the dialog when the reloaded shell is still stale. The non-blocking banner can be dismissed — the dismissal
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
  clearStagedApkVersion,
  desktopBridge,
  detectHost,
  ensureAndroidStaging,
  fetchInstallerManifest,
  initAndroidUpdateNotifications,
  installStagedAndroidApk,
  notifyAndroidUpdateAvailable,
  pluginErrorCode,
  readStagedApkVersion,
  reloadOnStaleAndroidBundle,
} from "@/lib/platform";

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
  android?: { apk?: string; sha256?: string; size?: number };
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

/**
 * Background-poll staging on Android — download + verify only, never the
 * installer or its permission screen. A tap (notification, Settings row, or
 * the blocking floor dialog) performs the install.
 */
async function stageAndroidInBackground(
  manifest: LatestManifest,
): Promise<void> {
  const s = useUpdates.getState();
  if (s.status === "downloading" || s.status === "ready") return;
  useUpdates.setState({
    status: "downloading",
    progress: { percent: 0, totalBytes: 0 },
  });
  try {
    await ensureAndroidStaging(apiOrigin(), manifest, ({ bytes, total }) => {
      useUpdates.setState({
        progress: {
          percent: total > 0 ? Math.min(100, (bytes / total) * 100) : 0,
          totalBytes: total,
        },
      });
    });
    useUpdates.setState({ status: "ready", progress: null });
    void notifyAndroidUpdateAvailable(manifest.version);
  } catch {
    useUpdates.setState({ status: "error", progress: null });
  }
}

const DISMISS_KEY = "updates.dismissedVersion";

function readDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/** Floor version a silent web reload already attempted, per tab session. */
const FLOOR_RELOAD_KEY = "updates.floorReloadedFor";

function floorReloadAttempted(minVersion: string): boolean {
  try {
    return sessionStorage.getItem(FLOOR_RELOAD_KEY) === minVersion;
  } catch {
    // Storage unavailable — no way to guard against a reload loop, so never
    // auto-reload; the blocking dialog stays the fallback.
    return true;
  }
}

function markFloorReloadAttempted(minVersion: string): void {
  try {
    sessionStorage.setItem(FLOOR_RELOAD_KEY, minVersion);
  } catch {
    // Best effort — the in-memory pending flag below still guards this load.
  }
}

/** True once this page load triggered the silent floor reload — the document
 *  is going away, so later floors from in-flight requests stay quiet. */
let floorReloadPending = false;

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
        // Android stages the APK in the background the moment the poll finds
        // it, on whatever network the device is on — bytes only, never the
        // installer or its permission screen. Those stay one explicit tap
        // away (a system notification, the Settings row, or the blocking
        // floor dialog) because Android cannot skip that tap. "ready" means
        // this version is already staged and waiting for it, so the 4h
        // re-poll (the user hasn't installed yet, so the manifest is still
        // "newer") must not stage it again; the persisted marker also
        // survives restarts, so a staged release is never re-downloaded.
        if (detectHost() === "android" && get().status !== "ready") {
          const staged = readStagedApkVersion();
          if (
            staged === manifest.version &&
            compareSemver(staged, __APP_VERSION__) > 0
          ) {
            // Staged before a restart: the verified APK is already in
            // app-private cache.
            set({ status: "ready", progress: null });
          } else {
            // Installed, superseded, or never staged — an old marker (if
            // any) no longer describes the cache.
            if (staged) clearStagedApkVersion();
            void stageAndroidInBackground(manifest);
          }
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
      // Tap-driven: installs the staged APK, staging first when nothing is
      // staged for the known release. A second tap while bytes stream is a
      // no-op, and the native side single-flights too. Only this path can
      // open the install-permission settings — never the background poll.
      if (get().status === "downloading") return;
      set({
        status: "downloading",
        progress: { percent: 0, totalBytes: 0 },
      });
      const onProgress = ({
        bytes,
        total,
      }: {
        bytes: number;
        total: number;
      }) => {
        set({
          progress: {
            percent: total > 0 ? Math.min(100, (bytes / total) * 100) : 0,
            totalBytes: total,
          },
        });
      };
      try {
        const latest = get().latestVersion;
        if (!latest || readStagedApkVersion() !== latest) {
          const manifest = await fetchInstallerManifest(apiOrigin());
          if (!manifest) throw new Error("manifest_unavailable");
          if (compareSemver(manifest.version, __APP_VERSION__) <= 0) {
            throw new Error("artifact_missing");
          }
          set({ latestVersion: manifest.version });
          await ensureAndroidStaging(apiOrigin(), manifest, onProgress);
        }
        try {
          await installStagedAndroidApk();
        } catch (error) {
          // App-private cache evicted since staging — drop the stale marker,
          // stage once more from the manifest, then install. Any other
          // failure (permission, unavailable) stands.
          if (pluginErrorCode(error) !== "not_staged") throw error;
          clearStagedApkVersion();
          const manifest = await fetchInstallerManifest(apiOrigin());
          if (!manifest) throw new Error("manifest_unavailable");
          set({ latestVersion: manifest.version });
          await ensureAndroidStaging(apiOrigin(), manifest, onProgress);
          await installStagedAndroidApk();
        }
        // The system installer owns the screen from here — "ready" keeps
        // the Settings row actionable for anyone who backs out of it, and
        // the notification summons the tap that opens it.
        set({ status: "ready", progress: null });
        const done = get().latestVersion;
        if (done) void notifyAndroidUpdateAvailable(done);
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
      // Windows/Linux: restart only when the new build is staged. Quitting
      // with nothing downloaded just relands on the same floored build, so
      // a tap with nothing staged (or a failed staging) starts the silent
      // background download instead — its progress events drive the dialog
      // to "ready", and the next tap restarts into the new build.
      if (get().status === "ready") {
        await desktop.restartToUpdate();
        return;
      }
      if (get().status === "downloading") return;
      set({
        status: "downloading",
        progress: { percent: 0, totalBytes: 0 },
      });
      try {
        const res = await desktop.checkForUpdate();
        if (res.kind === "ready") {
          set({ latestVersion: res.version, status: "ready", progress: null });
        } else if (res.kind === "available") {
          // autoDownload is on in the shell — progress events follow and
          // flip the state to ready; staying "downloading" keeps the dialog
          // honest until they do.
          if (res.version) set({ latestVersion: res.version });
        } else if (res.kind === "not-available") {
          // Feed says current: nothing to stage. Back to idle so the next
          // tap retries instead of spinning on a download that never comes.
          set({ status: "idle", progress: null });
        } else {
          set({ status: "error", progress: null });
        }
      } catch {
        set({ status: "error", progress: null });
      }
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
    // Web heals a floor silently: the fresh shell is one reload away
    // (index.html revalidates), so reload once per floor version instead of
    // blocking. Native shells cannot self-refresh — they fall through to
    // the dialog. So does a web client that already reloaded for this floor
    // and still gets 426 (the deploy hasn't reached the edge yet).
    if (detectHost() === "web") {
      if (floorReloadPending) return;
      if (!floorReloadAttempted(minVersion)) {
        floorReloadPending = true;
        markFloorReloadAttempted(minVersion);
        window.location.reload();
        return;
      }
    }
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
      } else if (s.kind === "error") {
        // A failed background staging must surface: without this the store
        // sits on a stale "downloading" forever and the dialog spins with
        // no download behind it. The dialog's error copy tells the user to
        // check the connection and retry.
        useUpdates.setState({ status: "error", progress: null });
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
