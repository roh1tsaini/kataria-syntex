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
 * first and only arms the dialog when the reloaded shell is still stale. A
 * floor is armed only when it is ABOVE the running build (`floorAppliesTo`):
 * a published manifest keeps carrying `minVersion` for every later release,
 * so arming on the raw value would block clients that are already current
 * and leave the dialog's only action with nothing to install. The server's
 * 426 needs no such test — it measures the announced version itself.
 *
 * `failure` carries WHICH step failed, so the dialog never blames the
 * connection for a release that simply is not published yet. The
 * non-blocking banner can be dismissed — the dismissal
 * remembers the version, so the banner stays gone until the NEXT version
 * ships instead of nagging on every load.
 */
import { create } from "zustand";
import { compareSemver, floorAppliesTo } from "@kataria-syntex/shared";
import {
  apiOrigin,
  setUpdateRequiredHandler,
  type UpdateProgress,
} from "@kataria-syntex/app-core";
import {
  clearStagedApkVersion,
  desktopBridge,
  ensureAndroidStaging,
  fetchInstallerManifest,
  initAndroidUpdateNotifications,
  installStagedAndroidApk,
  isAndroid,
  isPlainBrowser,
  notifyAndroidUpdateAvailable,
  pluginErrorCode,
  readStagedApkVersion,
  reloadOnStaleAndroidBundle,
  usesManifestUpdateFlow,
} from "@/lib/platform";

/**
 * Which step of an update attempt failed. One vocabulary for every shell —
 * the blocking dialog maps it to copy and nothing else inspects it, so a
 * release that is not published yet can never read as "no network".
 */
export type UpdateFailure =
  /** The release manifest itself could not be read. */
  | "manifest_unavailable"
  /** The server's floor is ahead of what is published — nothing to install. */
  | "publish_pending"
  /** The download failed, or the feed has no such artifact. */
  | "download_failed"
  /** Bytes arrived but failed verification. */
  | "integrity_failed"
  /** Android would not hand the APK to its installer. */
  | "install_blocked"
  /** The shell never answered — retryable, not broken. */
  | "stalled"
  /** The Electron updater feed errored. */
  | "check_failed";

export type UpdateState = {
  /** Latest version published to /releases, when known. */
  latestVersion: string | null;
  /** Floor this client is below (server 426 / published minVersion). Non-null
   *  ⇒ blocking dialog must show. Never set for a floor the running build
   *  already satisfies — see markRequired. */
  requiredMinVersion: string | null;
  /** Coarse status for the Settings row / banner. */
  status: "idle" | "checking" | "downloading" | "ready" | "error";
  /** Live download/install progress — null when nothing is in flight. */
  progress: UpdateProgress | null;
  /** Why the last attempt failed — null when nothing failed. */
  failure: UpdateFailure | null;
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
    useUpdates.setState({ status: "ready", progress: null, failure: null });
    void notifyAndroidUpdateAvailable(manifest.version);
  } catch (error) {
    useUpdates.setState({
      status: "error",
      progress: null,
      failure: androidFailure(error),
    });
  }
}

/** How long a tap-driven Android install may stay unanswered before the
 *  dialog offers a retry instead of a permanently disabled button. Android
 *  can kill the process behind the install-permission settings screen, which
 *  loses the plugin's callback and leaves that promise un-settled forever. */
const INSTALL_WATCHDOG_MS = 5 * 60 * 1000;

function withInstallWatchdog<T>(work: () => Promise<T>): Promise<T> {
  const running = work();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("stalled")),
      INSTALL_WATCHDOG_MS,
    );
    running.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Native reject codes → the failure vocabulary the dialog renders. Anything
 *  unmapped is a download failure, the only step with no better name. */
const ANDROID_FAILURES: Record<string, UpdateFailure> = {
  manifest_unavailable: "manifest_unavailable",
  artifact_missing: "download_failed",
  download_failed: "download_failed",
  integrity_failed: "integrity_failed",
  not_staged: "install_blocked",
  install_permission_required: "install_blocked",
  install_unavailable: "install_blocked",
  already_in_progress: "stalled",
  stalled: "stalled",
};

function androidFailure(error: unknown): UpdateFailure {
  const code = pluginErrorCode(error);
  return (code && ANDROID_FAILURES[code]) || "download_failed";
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
  failure: null,
  checking: false,
  downloadUrl: null,
  dismissedVersion: readDismissedVersion(),
  dismissedThisSession: false,

  checkNow: async () => {
    set({ checking: true });
    try {
      const desktop = desktopBridge();
      if (desktop && !usesManifestUpdateFlow()) {
        const res = await desktop.checkForUpdate();
        if (res.kind === "available") {
          // autoDownload is on in the shell — the "downloading" event follows
          // immediately; "ready" must wait for update-downloaded, not fire
          // while the installer is still on the wire.
          set({
            latestVersion: res.version,
            status: "idle",
            progress: null,
            failure: null,
          });
          return "available";
        }
        if (res.kind === "ready") {
          set({
            latestVersion: res.version,
            status: "ready",
            progress: null,
            failure: null,
          });
          return "available";
        }
        // A feed that errors means the update service itself is unreachable —
        // say that, never "up to date".
        if (res.kind === "error") {
          set({ failure: "check_failed" });
          return "error";
        }
        set({ failure: null });
        return "up-to-date";
      }
      // Web and macOS Electron read the same published manifest to fill the
      // Settings version line and arm the 426 floor. Web deploys otherwise
      // apply silently through revalidated index.html — no prompt, no reload.
      const manifest = await fetchManifest();
      if (!manifest) {
        // The manifest is the whole update path on these hosts: a check that
        // cannot read it is a failure, not "up to date".
        set({ failure: "manifest_unavailable" });
        return "error";
      }
      // markRequired decides whether this floor applies to THIS build (the
      // manifest keeps carrying minVersion forever, see floorAppliesTo).
      if (manifest.minVersion) get().markRequired(manifest.minVersion);
      set({
        latestVersion: manifest.version,
        downloadUrl: artifactFor(manifest),
        failure: null,
      });
      if (compareSemver(manifest.version, __APP_VERSION__) > 0) {
        // macOS arms the banner (dmg download). On web there is nothing to
        // download and nothing to prompt — the deploy applies itself, so the
        // state stays idle and no surface can misfire.
        if (usesManifestUpdateFlow()) set({ status: "ready", failure: null });
        // Android stages the APK in the background the moment the poll finds
        // it, on whatever network the device is on — bytes only, never the
        // installer or its permission screen. Those stay one explicit tap
        // away (a system notification, the Settings row, or the blocking
        // floor dialog) because Android cannot skip that tap. "ready" means
        // this version is already staged and waiting for it, so the 4h
        // re-poll (the user hasn't installed yet, so the manifest is still
        // "newer") must not stage it again; the persisted marker also
        // survives restarts, so a staged release is never re-downloaded.
        if (isAndroid() && get().status !== "ready") {
          const staged = readStagedApkVersion();
          if (
            staged === manifest.version &&
            compareSemver(staged, __APP_VERSION__) > 0
          ) {
            // Staged before a restart: the verified APK is already in
            // app-private cache.
            set({ status: "ready", progress: null, failure: null });
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
      // Nothing newer is published. A floor this build does not satisfy is
      // not installable yet — the release that lifts it is still publishing.
      // Withholding that distinction is what made the dialog blame the
      // network for a release that simply was not out.
      const armed = get().requiredMinVersion;
      if (armed && floorAppliesTo(armed, __APP_VERSION__)) {
        set({ failure: "publish_pending" });
        return "error";
      }
      set({ failure: null });
      return "up-to-date";
    } finally {
      set({ checking: false });
    }
  },

  installUpdate: async () => {
    if (isAndroid()) {
      // Tap-driven: installs the staged APK, staging first when nothing is
      // staged for the known release. A second tap while bytes stream is a
      // no-op, and the native side single-flights too. Only this path can
      // open the install-permission settings — never the background poll.
      if (get().status === "downloading") return;
      set({
        status: "downloading",
        progress: { percent: 0, totalBytes: 0 },
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
        if (!latest || readStagedApkVersion() !== latest) {
          const manifest = await fetchInstallerManifest(apiOrigin());
          if (!manifest) throw new Error("manifest_unavailable");
          if (compareSemver(manifest.version, __APP_VERSION__) <= 0) {
            // Nothing newer is published than what is running. Exactly two
            // honest readings, never a download error: this build already
            // satisfies the floor — the dialog was armed by a release the
            // server has since moved past — so stand it down; or the
            // release that lifts the floor is still publishing, so say so.
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
            return;
          }
          set({ latestVersion: manifest.version });
          await ensureAndroidStaging(apiOrigin(), manifest, onProgress);
        }
        // Bounded: a tap that Android never answers must come back as a
        // retryable failure, not a permanently disabled button. Only the
        // install step is wrapped — staging has its own native connect/read
        // timeouts and may legitimately run for minutes on slow mobile data.
        await withInstallWatchdog(async () => {
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
          set({ status: "ready", progress: null, failure: null });
          const done = get().latestVersion;
          if (done) void notifyAndroidUpdateAvailable(done);
        });
      } catch (error) {
        set({
          status: "error",
          progress: null,
          failure: androidFailure(error),
        });
      }
      return;
    }
    const desktop = desktopBridge();
    if (desktop) {
      if (usesManifestUpdateFlow()) {
        // macOS: hand the published dmg to the OS browser. No artifact in the
        // manifest means there is nothing to hand over — surface that instead
        // of a tap that appears to do nothing.
        const url = get().downloadUrl;
        if (url) await desktop.openReleaseUrl(url);
        else set({ failure: "manifest_unavailable" });
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
    // new value, so a stale manifest can never quiet a solved dialog.
    const armed = get().requiredMinVersion;
    if (armed && !floorAppliesTo(armed, __APP_VERSION__)) {
      set({ requiredMinVersion: null });
    }
    // The only setter of the floor — guard here, not at every consumer. A
    // published manifest carries the sentinel when no breaking change has
    // shipped, AND keeps carrying a real minVersion for every later release.
    // So a floor this build is already above is not a floor: arming it would
    // block a current client whose dialog then has nothing to install.
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
  if (isAndroid()) {
    // The WebView can still be running the bundle from the APK that was
    // replaced (its cached copy is not invalidated by an install) — self-heal
    // before the manifest poll, since a bundle/APK mismatch also breaks the
    // 426 handshake. The release-announcement listener wires alongside it.
    void reloadOnStaleAndroidBundle();
    void initAndroidUpdateNotifications();
  }
  void useUpdates.getState().checkNow();
  // Deliberate fire-and-forget: a failed check lands in the store (`failure`
  // drives the dialog's copy and the Settings row's hint), so there is no
  // caller-side catch to write.
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
          failure: null,
        });
      } else if (s.kind === "ready") {
        useUpdates.setState({
          latestVersion: s.version,
          status: "ready",
          progress: null,
          failure: null,
        });
      } else if (s.kind === "downloading") {
        useUpdates.setState({
          status: "downloading",
          progress: { percent: s.percent, totalBytes: s.total },
          failure: null,
        });
      } else if (s.kind === "error") {
        // A failed background staging must surface: without this the store
        // sits on a stale "downloading" forever and the dialog spins with
        // no download behind it. The reason travels with it, so the dialog
        // says the feed failed rather than blaming the user's connection.
        useUpdates.setState({
          status: "error",
          progress: null,
          failure: "check_failed",
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
  // macOS only, and only with a dmg to offer — a banner whose button has no
  // artifact behind it is a dead end.
  return (
    usesManifestUpdateFlow() && s.status === "ready" && s.downloadUrl !== null
  );
}
