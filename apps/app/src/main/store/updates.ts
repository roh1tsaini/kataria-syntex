/** Shared update state for the web, Electron and Android shells.
 *
 * - Web releases apply silently on the next navigation. Only a live server
 *   426 response can require an update.
 * - Electron and Android check on launch, return to the screen, network
 *   return, and every four foreground hours.
 * - Android stages APK bytes in the background; Settings starts installation.
 * - Windows/Linux Electron downloads in the background and installs on quit.
 * - macOS Electron keeps the manual DMG download in Settings.
 * - In-app release notices appear once per version while the app is visible.
 *
 * `failure` carries the step that failed so Settings and the blocking dialog
 *   can show the same plain retry guidance.
 */
import { create } from "zustand";
import { toast } from "sonner";
import {
  compareSemver,
  floorAppliesTo,
  type ReleaseManifest,
  type UpdateProgress,
} from "@kataria-syntex/shared";
import { apiOrigin, setUpdateRequiredHandler } from "@kataria-syntex/app-core";
import {
  clearStagedApkVersion,
  desktopBridge,
  ensureAndroidStaging,
  fetchInstallerManifest,
  installStagedAndroidApk,
  isAndroid,
  isPlainBrowser,
  pluginErrorCode,
  readStagedApkVersion,
  reloadOnStaleAndroidBundle,
  retryUpdateUsesAction,
  updateNoticeCopy,
  usesManifestUpdateFlow,
  watchUpdateCheckTriggers,
} from "@/lib/platform";

/**
 * Which step of an update attempt failed. One vocabulary for every shell —
 * the blocking dialog maps it to copy and nothing else inspects it, so a
 * release that is not published yet can never read as "no network".
 */
type UpdateFailure =
  /** The release manifest itself could not be read. */
  | "manifest_unavailable"
  /** The server's floor is ahead of what is published — nothing to install. */
  | "publish_pending"
  /** The download failed, or the feed has no such artifact. */
  | "download_failed"
  /** The staged file could not be written — the device is out of space. */
  | "storage_full"
  /** Bytes arrived but failed verification. */
  | "integrity_failed"
  /** Android needs permission to install this APK. */
  | "install_blocked"
  /** Android could not open the package installer. */
  | "install_failed"
  /** An update operation is still active or was interrupted. */
  | "stalled"
  /** The Electron updater feed errored. */
  | "check_failed";

export const UPDATE_FAILURE_COPY: Record<UpdateFailure, string> = {
  manifest_unavailable:
    "Could not check for updates. Check your connection, then retry.",
  check_failed:
    "Could not check for updates. Check your connection, then retry.",
  publish_pending:
    "The required update is still publishing. Try again shortly.",
  download_failed: "The update download failed. Try again.",
  integrity_failed: "The update file could not be verified. Try again.",
  storage_full:
    "Not enough storage on the phone to install the update. Free some space, then try again.",
  install_blocked: "Allow app installs in Android Settings, then try again.",
  install_failed: "Android could not open the installer. Try again.",
  stalled: "The update was interrupted. Try again.",
};

type UpdateState = {
  /** Latest version published to /releases, when known. */
  latestVersion: string | null;
  /** Floor this client is below (live server 426 only). Non-null
   *  ⇒ blocking dialog must show. Never set for a floor the running build
   *  already satisfies — see markRequired. */
  requiredMinVersion: string | null;
  /** Coarse status for Settings. */
  status:
    "idle" | "checking" | "downloading" | "installing" | "ready" | "error";
  /** Live download/install progress — null when nothing is in flight. */
  progress: UpdateProgress | null;
  /** Why the last attempt failed — null when nothing failed. */
  failure: UpdateFailure | null;
  /** True while a check is in flight. */
  checking: boolean;
  /** Host-specific artifact URL from the manifest (macOS dmg). */
  downloadUrl: string | null;
  checkNow: (
    queueIfInFlight?: boolean,
  ) => Promise<"up-to-date" | "available" | "error">;
  retryUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  markRequired: (minVersion: string) => void;
};

/** Where latest.json lives (same origin; native shells bake the absolute origin). */
function releasesManifestUrl(): string {
  return `${apiOrigin()}/releases/app/android/latest.json`;
}

async function fetchManifest(): Promise<ReleaseManifest | null> {
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
    return body as ReleaseManifest;
  } catch {
    return null;
  }
}

/** The manifest artifact this host installs. */
function artifactFor(manifest: ReleaseManifest): string | null {
  const mac = manifest.desktop?.mac;
  return typeof mac === "string" && mac.startsWith("/releases/")
    ? `${apiOrigin()}${mac}`
    : null;
}

/** Foreground check cadence. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

const ANNOUNCED_VERSION_KEY = "updates.announcedVersion";
let announcedVersionInMemory: string | null = null;
let pendingNotice: { version: string; phase: "found" | "ready" } | null = null;

function hasAnnouncedVersion(version: string): boolean {
  if (announcedVersionInMemory === version) return true;
  try {
    return localStorage.getItem(ANNOUNCED_VERSION_KEY) === version;
  } catch {
    return false;
  }
}

function flushUpdateNotice(): void {
  const pending = pendingNotice;
  if (!pending || document.visibilityState !== "visible") return;
  const copy = updateNoticeCopy(pending.version, pending.phase);
  if (!copy) {
    pendingNotice = null;
    return;
  }
  toast.info(copy.title, { description: copy.description, duration: 4000 });
  announcedVersionInMemory = pending.version;
  try {
    localStorage.setItem(ANNOUNCED_VERSION_KEY, pending.version);
  } catch {
    // In-memory dedupe still prevents repeat notices during this run.
  }
  pendingNotice = null;
}

function announceRelease(version: string, phase: "found" | "ready"): void {
  if (!version || hasAnnouncedVersion(version)) return;
  if (!pendingNotice || pendingNotice.version !== version) {
    pendingNotice = { version, phase };
  } else if (phase === "ready") {
    pendingNotice = { version, phase };
  }
  flushUpdateNotice();
}

let checkInFlight: Promise<"up-to-date" | "available" | "error"> | null = null;
let deferredCheck = false;

function drainDeferredCheck(): void {
  if (!deferredCheck || checkInFlight) return;
  const status = useUpdates.getState().status;
  if (status === "downloading" || status === "installing") return;
  deferredCheck = false;
  queueMicrotask(() => void useUpdates.getState().checkNow());
}

/** Android stages downloaded bytes only; Settings owns the installer tap. */
async function stageAndroidInBackground(
  manifest: ReleaseManifest,
): Promise<void> {
  const s = useUpdates.getState();
  if (s.status === "downloading" || s.status === "installing") return;
  if (s.status === "ready" && readStagedApkVersion() === manifest.version) {
    return;
  }
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
    useUpdates.setState({ status: "ready", progress: null, failure: null });
    announceRelease(manifest.version, "ready");
    drainDeferredCheck();
  } catch (error) {
    useUpdates.setState({
      status: "error",
      progress: null,
      failure: androidFailure(error),
    });
    drainDeferredCheck();
  }
}

/** Native reject codes → the failure vocabulary the dialog renders. Anything
 *  unmapped is a download failure, the only step with no better name. */
const ANDROID_FAILURES: Record<string, UpdateFailure> = {
  manifest_unavailable: "manifest_unavailable",
  artifact_missing: "download_failed",
  download_failed: "download_failed",
  integrity_failed: "integrity_failed",
  storage_unavailable: "storage_full",
  install_permission_required: "install_blocked",
  install_unavailable: "install_failed",
  not_staged: "download_failed",
  already_in_progress: "stalled",
  stalled: "stalled",
};

function androidFailure(error: unknown): UpdateFailure {
  const code = pluginErrorCode(error);
  return (code && ANDROID_FAILURES[code]) || "download_failed";
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
  failure: null,
  checking: false,
  downloadUrl: null,
  checkNow: (queueIfInFlight = false) => {
    if (checkInFlight) {
      if (queueIfInFlight) deferredCheck = true;
      return checkInFlight;
    }
    if (get().status === "downloading" || get().status === "installing") {
      deferredCheck = true;
      return Promise.resolve("available");
    }
    const run = async (): Promise<"up-to-date" | "available" | "error"> => {
      set({ checking: true, failure: null });
      try {
        const desktop = desktopBridge();
        if (desktop && !usesManifestUpdateFlow()) {
          const res = await desktop.checkForUpdate();
          if (res.kind === "available") {
            set({
              latestVersion: res.version,
              status: "downloading",
              progress: { percent: 0, totalBytes: 0 },
              failure: null,
            });
            announceRelease(res.version, "found");
            return "available";
          }
          if (res.kind === "ready") {
            set({
              latestVersion: res.version,
              status: "ready",
              progress: null,
              failure: null,
            });
            announceRelease(res.version, "ready");
            return "available";
          }
          if (res.kind === "error") {
            set({ status: "error", failure: "check_failed" });
            return "error";
          }
          set({ status: "idle", failure: null });
          return "up-to-date";
        }

        const manifest = await fetchManifest();
        if (!manifest) {
          set({ status: "error", failure: "manifest_unavailable" });
          return "error";
        }
        const downloadUrl = artifactFor(manifest);
        set({ latestVersion: manifest.version, downloadUrl, failure: null });
        if (compareSemver(manifest.version, __APP_VERSION__) > 0) {
          if (usesManifestUpdateFlow()) {
            if (!downloadUrl) {
              set({ status: "error", failure: "download_failed" });
              return "error";
            }
            set({ status: "ready" });
            announceRelease(manifest.version, "ready");
          }
          if (isAndroid()) {
            announceRelease(manifest.version, "found");
            const staged = readStagedApkVersion();
            if (staged === manifest.version) {
              set({ status: "ready", progress: null, failure: null });
            } else {
              if (staged) clearStagedApkVersion();
              void stageAndroidInBackground(manifest);
            }
          }
          return "available";
        }

        if (isAndroid()) {
          const staged = readStagedApkVersion();
          if (staged && compareSemver(staged, __APP_VERSION__) <= 0) {
            clearStagedApkVersion();
          }
        }
        set({ status: "idle", progress: null });
        const armed = get().requiredMinVersion;
        if (armed && floorAppliesTo(armed, __APP_VERSION__)) {
          set({ status: "error", failure: "publish_pending" });
          return "error";
        }
        set({ failure: null });
        return "up-to-date";
      } catch {
        set({
          status: "error",
          failure:
            desktopBridge() && !usesManifestUpdateFlow()
              ? "check_failed"
              : "manifest_unavailable",
        });
        return "error";
      } finally {
        set({ checking: false });
      }
    };
    const flight = run();
    checkInFlight = flight;
    void flight.then(
      () => {
        if (checkInFlight === flight) {
          checkInFlight = null;
          drainDeferredCheck();
        }
      },
      () => {
        if (checkInFlight === flight) {
          checkInFlight = null;
          drainDeferredCheck();
        }
      },
    );
    return flight;
  },

  retryUpdate: async () => {
    if (retryUpdateUsesAction(get().failure)) {
      await get().installUpdate();
      return;
    }
    await get().checkNow();
  },

  installUpdate: async () => {
    if (checkInFlight) await checkInFlight;
    if (isAndroid()) {
      // Tap-driven: installs the staged APK, staging first when nothing is
      // staged for the known release. A second tap while bytes stream is a
      // no-op, and the native side single-flights too. Only this path can
      // open the install-permission settings — never the background poll.
      if (get().status === "downloading" || get().status === "installing") {
        return;
      }
      const currentLatest = get().latestVersion;
      const needsStage =
        !currentLatest ||
        compareSemver(currentLatest, __APP_VERSION__) <= 0 ||
        readStagedApkVersion() !== currentLatest;
      set({
        status: needsStage ? "downloading" : "installing",
        progress: needsStage ? { percent: 0, totalBytes: 0 } : null,
        failure: null,
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
        if (
          !latest ||
          compareSemver(latest, __APP_VERSION__) <= 0 ||
          readStagedApkVersion() !== latest
        ) {
          const manifest = await fetchInstallerManifest(apiOrigin());
          if (!manifest) throw new Error("manifest_unavailable");
          if (compareSemver(manifest.version, __APP_VERSION__) <= 0) {
            const armed = get().requiredMinVersion;
            const satisfied = !armed || !floorAppliesTo(armed, __APP_VERSION__);
            set({
              latestVersion: manifest.version,
              progress: null,
              ...(satisfied
                ? {
                    status: "idle" as const,
                    requiredMinVersion: null,
                    failure: null,
                  }
                : {
                    status: "error" as const,
                    failure: "publish_pending" as const,
                  }),
            });
            drainDeferredCheck();
            return;
          }
          set({ latestVersion: manifest.version });
          await ensureAndroidStaging(apiOrigin(), manifest, onProgress);
        }
        set({ status: "installing", progress: null });
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
          if (compareSemver(manifest.version, __APP_VERSION__) <= 0) {
            set({
              status: "error",
              progress: null,
              failure: "publish_pending",
            });
            drainDeferredCheck();
            return;
          }
          set({ latestVersion: manifest.version });
          set({
            status: "downloading",
            progress: { percent: 0, totalBytes: 0 },
          });
          await ensureAndroidStaging(apiOrigin(), manifest, onProgress);
          set({ status: "installing", progress: null });
          await installStagedAndroidApk();
        }
        // The system installer owns the screen from here. Keep the Settings
        // action available if the user backs out of it.
        set({ status: "ready", progress: null, failure: null });
        drainDeferredCheck();
      } catch (error) {
        set({
          status: "error",
          progress: null,
          failure: androidFailure(error),
        });
        deferredCheck = false;
      }
      return;
    }
    const desktop = desktopBridge();
    if (desktop) {
      if (usesManifestUpdateFlow()) {
        // macOS keeps its explicit DMG download path.
        let url = get().downloadUrl;
        if (!url) {
          const result = await get().checkNow();
          url = get().downloadUrl;
          if (!url) {
            if (result !== "error") {
              set({ status: "error", failure: "manifest_unavailable" });
            }
            return;
          }
        }
        try {
          await desktop.openReleaseUrl(url);
          set({ status: "ready", failure: null });
        } catch {
          set({ status: "error", failure: "download_failed" });
        }
        return;
      }
      // Windows/Linux: restart only when the new build is staged. Quitting
      // with nothing downloaded just relands on the same floored build, so
      // a tap with nothing staged (or a failed staging) starts the silent
      // background download instead — its progress events drive the dialog
      // to "ready", and the next tap restarts into the new build.
      if (get().status === "ready") {
        try {
          await desktop.restartToUpdate();
        } catch {
          set({ status: "error", failure: "check_failed" });
        }
        return;
      }
      if (get().status === "downloading") return;
      set({
        status: "downloading",
        progress: { percent: 0, totalBytes: 0 },
        failure: null,
      });
      try {
        const res = await desktop.checkForUpdate();
        if (res.kind === "ready") {
          set({
            latestVersion: res.version,
            status: "ready",
            progress: null,
            failure: null,
          });
        } else if (res.kind === "available") {
          // autoDownload is on in the shell — progress events follow and
          // flip the state to ready; staying "downloading" keeps the dialog
          // honest until they do.
          if (res.version) set({ latestVersion: res.version });
        } else if (res.kind === "not-available") {
          // Feed says current: nothing to stage. Back to idle so the next
          // tap retries instead of spinning on a download that never comes.
          set({ status: "idle", progress: null, failure: null });
        } else {
          set({ status: "error", progress: null, failure: "check_failed" });
        }
      } catch {
        set({ status: "error", progress: null, failure: "check_failed" });
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
    // An armed floor the running build already satisfies must not survive —
    // it can outlive its own release (someone installed the update while the
    // dialog was up, or the server's floor moved back). Checked BEFORE the
    // new value, so a delayed server response cannot keep a solved dialog up.
    const armed = get().requiredMinVersion;
    if (armed && !floorAppliesTo(armed, __APP_VERSION__)) {
      set({ requiredMinVersion: null });
    }
    // The server's live 426 response is the only setter of this floor.
    if (!floorAppliesTo(minVersion, __APP_VERSION__)) return;
    // Web heals a floor silently: the fresh shell is one reload away
    // (index.html revalidates), so reload once per floor version instead of
    // blocking. Native shells cannot self-refresh — they fall through to
    // the dialog. So does a web client that already reloaded for this floor
    // and still gets 426 (the deploy hasn't reached the edge yet).
    if (isPlainBrowser()) {
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
}));

/** StrictMode mounts App twice in dev — wire update checks exactly once. */
let updateChecksWired = false;

export function initUpdateChecks(): void {
  if (updateChecksWired) return;
  updateChecksWired = true;
  if (isAndroid()) {
    // The WebView can still be running the bundle from the APK that was
    // replaced (its cached copy is not invalidated by an install) — self-heal
    // before the 426 handshake.
    void reloadOnStaleAndroidBundle();
  }
  const desktop = desktopBridge();
  if (desktop?.onUpdateStatus) {
    desktop.onUpdateStatus((s) => {
      if (s.kind === "available") {
        useUpdates.setState({
          latestVersion: s.version,
          status: "downloading",
          progress: { percent: 0, totalBytes: 0 },
          failure: null,
        });
        announceRelease(s.version, "found");
      } else if (s.kind === "ready") {
        useUpdates.setState({
          latestVersion: s.version,
          status: "ready",
          progress: null,
          failure: null,
        });
        announceRelease(s.version, "ready");
        drainDeferredCheck();
      } else if (s.kind === "downloading") {
        useUpdates.setState({
          status: "downloading",
          progress: { percent: s.percent, totalBytes: s.total },
          failure: null,
        });
      } else if (s.kind === "not-available") {
        useUpdates.setState({ status: "idle", progress: null, failure: null });
        drainDeferredCheck();
      } else if (s.kind === "error") {
        useUpdates.setState({
          status: "error",
          progress: null,
          failure: "check_failed",
        });
        drainDeferredCheck();
      }
    });
  }
  if (isPlainBrowser()) return;
  watchUpdateCheckTriggers(
    (queueIfInFlight) => void useUpdates.getState().checkNow(queueIfInFlight),
    CHECK_INTERVAL_MS,
    flushUpdateNotice,
  );
  flushUpdateNotice();
  if (document.visibilityState === "visible") {
    void useUpdates.getState().checkNow(true);
  }
}
