/**
 * Android update flow — the shell's implementation of the update contract in
 * `apps/app/spec.md` Section 5.3: silent background manifest checks on launch,
 * foreground return, network return, and every four foreground hours; the APK
 * stages in app-private cache automatically; only a Settings tap can open the
 * system installer; one system notification per release points at Settings; a
 * failed step carries the same failure vocabulary and copy the web app uses.
 *
 * This is a platform seam: the expo-file-system / expo-crypto /
 * expo-notifications / expo-intent-launcher calls live only here and in
 * `adapter.ts`. No UI file branches on platform; the Settings screen and the
 * 426 gate consume the store below.
 *
 * The silent rule is deliberate (AGENTS.md caching section): routine releases
 * never toast in-app on Android. The notification and the Settings action are
 * the only user-facing surfaces; only a live server `426 update_required`
 * blocks work, through the undismissable gate.
 */
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import { create } from "zustand";
import { compareSemver, floorAppliesTo } from "@kataria-syntex/shared";
import {
  core,
  setUpdateRequiredHandler,
  type UpdateProgress,
} from "@kataria-syntex/app-core";

import { appVersion, onAppStateChange } from "@/platform/adapter";

// ── Constants ────────────────────────────────────────────────────────────────

/** Foreground check cadence — spec.md Section 5.3. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

const ANDROID_CHANNEL_ID = "updates";

/** Staged APK filename — one slot in app-private cache. The `.part` suffix
 *  keeps a dropped download invisible to the installer; the file is renamed
 *  into the staged name only after verification. */
const STAGED_APK_NAME = "ks-biz-app.apk";
const PARTIAL_APK_NAME = "ks-biz-app.apk.part";
const UPDATES_DIR_NAME = "updates";

/** Version whose APK sits verified in app-private cache. Retained after
 *  launching the installer so backing out keeps the Settings action; the
 *  marker alone never proves the file is there, so the install step stages
 *  again when the cache was evicted. */
const STAGED_VERSION_KEY = "android.stagedApkVersion";

/** Version a system notification already pointed at — one per release. */
const NOTIFIED_VERSION_KEY = "updates.notifiedVersion";

// ── Failure vocabulary (identical copy to apps/app/src/main/store/updates.ts) ─

export type UpdateFailure =
  | "manifest_unavailable"
  | "publish_pending"
  | "download_failed"
  | "integrity_failed"
  | "install_blocked"
  | "install_failed"
  | "stalled"
  | "check_failed";

const UPDATE_FAILURE_COPY: Record<UpdateFailure, string> = {
  manifest_unavailable:
    "Could not check for updates. Check your connection, then retry.",
  check_failed:
    "Could not check for updates. Check your connection, then retry.",
  publish_pending:
    "The required update is still publishing. Try again shortly.",
  download_failed: "The update download failed. Try again.",
  integrity_failed: "The update file could not be verified. Try again.",
  install_blocked: "Allow app installs in Android Settings, then try again.",
  install_failed: "Android could not open the installer. Try again.",
  stalled: "The update was interrupted. Try again.",
};

export function updateFailureCopy(failure: UpdateFailure): string {
  return UPDATE_FAILURE_COPY[failure];
}

// ── Manifest ─────────────────────────────────────────────────────────────────

type AndroidManifest = {
  version: string;
  android?: { apk?: string; sha256?: string; size?: number };
};

/** Reads `latest.json` — same origin, same shape, same 20s budget as web. */
async function fetchManifest(): Promise<AndroidManifest | null> {
  try {
    const res = await fetch(
      `${core().apiBaseUrl}/releases/app/android/latest.json`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object") return null;
    if (typeof (body as Record<string, unknown>).version !== "string") {
      return null;
    }
    return body as AndroidManifest;
  } catch {
    return null;
  }
}

function apkUrl(manifest: AndroidManifest): string {
  const apk = manifest.android?.apk;
  if (typeof apk !== "string" || !apk.startsWith("/releases/")) {
    throw new Error("artifact_missing");
  }
  return `${core().apiBaseUrl}${apk}`;
}

// ── Staged marker (adapter KV — synchronous, survives restarts) ──────────────

function readStagedVersion(): string | null {
  return core().storage.get(STAGED_VERSION_KEY);
}

function writeStagedVersion(version: string): void {
  core().storage.set(STAGED_VERSION_KEY, version);
}

function clearStagedVersion(): void {
  core().storage.delete(STAGED_VERSION_KEY);
}

// ── Staging: download → verify → rename ──────────────────────────────────────

function updatesDirectory(): FileSystem.Directory {
  const dir = new FileSystem.Directory(
    FileSystem.Paths.cache,
    UPDATES_DIR_NAME,
  );
  if (!dir.exists) dir.create();
  return dir;
}

function stagedFile(): FileSystem.File {
  return new FileSystem.File(updatesDirectory(), STAGED_APK_NAME);
}

/**
 * Streams the manifest APK into app-private cache and verifies its SHA-256
 * when the manifest carries one. Never opens settings, never launches the
 * installer — safe from the background poller with no user gesture. Every
 * attempt lands on a `.part` file and is renamed into the staged name only
 * after verification, so neither a dropped connection nor a corrupt artifact
 * can leave bytes at the path the installer reads.
 */
async function stageApk(
  manifest: AndroidManifest,
  onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
  const dir = updatesDirectory();
  const target = new FileSystem.File(dir, STAGED_APK_NAME);
  const partial = new FileSystem.File(dir, PARTIAL_APK_NAME);
  if (partial.exists) partial.delete();
  const task = FileSystem.File.createDownloadTask(apkUrl(manifest), partial, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress({
        percent:
          totalBytes > 0 ? Math.min(100, (bytesWritten / totalBytes) * 100) : 0,
        totalBytes,
      });
    },
  });
  await task.downloadAsync();
  if (!partial.exists || partial.size <= 0) {
    if (partial.exists) partial.delete();
    throw new Error("download_failed");
  }
  const sha256 = manifest.android?.sha256;
  if (typeof sha256 === "string" && sha256) {
    const digest = await Crypto.digest(
      Crypto.CryptoDigestAlgorithm.SHA256,
      await partial.bytes(),
    );
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hex !== sha256.trim().toLowerCase()) {
      partial.delete();
      throw new Error("integrity_failed");
    }
  }
  if (target.exists) target.delete();
  partial.move(target);
  writeStagedVersion(manifest.version);
}

// ── Failure mapping (the old InstallerPlugin reject codes → web vocabulary) ──

function androidFailure(error: unknown): UpdateFailure {
  const code = error instanceof Error ? error.message : null;
  if (code === "manifest_unavailable") return "manifest_unavailable";
  if (code === "artifact_missing") return "download_failed";
  if (code === "integrity_failed") return "integrity_failed";
  if (code === "install_permission_required") return "install_blocked";
  if (code === "install_unavailable") return "install_failed";
  if (code === "not_staged") return "download_failed";
  if (code === "already_in_progress") return "stalled";
  if (code === "stalled") return "stalled";
  return "download_failed";
}

// ── Install (tap-driven only) ────────────────────────────────────────────────

/** Grants the installer read access to the staged file's content URI. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Hands the staged APK to the system package installer. This is the only path
 * that opens the system permission flow — never the background poller. When
 * installs are blocked, Android presents its own "allow from this source"
 * step; backing out of the installer keeps the staged bytes for a retry.
 */
async function installStaged(): Promise<void> {
  const file = stagedFile();
  if (!file.exists) throw new Error("not_staged");
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: file.contentUri,
    type: "application/vnd.android.package-archive",
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}

// ── System notification (one per release) ────────────────────────────────────

function hasNotified(version: string): boolean {
  return core().storage.get(NOTIFIED_VERSION_KEY) === version;
}

/**
 * One system notification per release: the download is ready and the tap
 * target is Settings, where the APK action lives. Permission is requested
 * only at this first genuinely-needed moment, never at boot.
 */
async function notifyReleaseReady(version: string): Promise<void> {
  if (hasNotified(version)) return;
  try {
    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.granted ||
      (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "App updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Update downloaded",
        body: `Version ${version} is downloaded. Open Settings and tap Update.`,
        data: { path: "/settings" },
      },
      trigger: null,
    });
    core().storage.set(NOTIFIED_VERSION_KEY, version);
  } catch {
    // Notifications unavailable — the Settings action still carries the update.
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export type UpdateStatus =
  "idle" | "checking" | "downloading" | "installing" | "ready" | "error";

type UpdateState = {
  /** Latest version published to /releases, when known. */
  latestVersion: string | null;
  /** Floor this client is below (live server 426 only). Non-null ⇒ the
   *  blocking gate must show. */
  requiredMinVersion: string | null;
  /** Coarse status for Settings. */
  status: UpdateStatus;
  /** Live download progress — null when nothing is in flight. */
  progress: UpdateProgress | null;
  /** Why the last attempt failed — null when nothing failed. */
  failure: UpdateFailure | null;
  /** True while a check is in flight. */
  checking: boolean;
  checkNow: (
    queueIfInFlight?: boolean,
  ) => Promise<"up-to-date" | "available" | "error">;
  installUpdate: () => Promise<void>;
  retryUpdate: () => Promise<void>;
  markRequired: (minVersion: string) => void;
};

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
async function stageInBackground(manifest: AndroidManifest): Promise<void> {
  const s = useUpdates.getState();
  if (s.status === "downloading" || s.status === "installing") return;
  if (s.status === "ready" && readStagedVersion() === manifest.version) return;
  useUpdates.setState({
    status: "downloading",
    progress: { percent: 0, totalBytes: 0 },
    failure: null,
  });
  try {
    await stageApk(manifest, (progress) => {
      useUpdates.setState({ progress });
    });
    useUpdates.setState({ status: "ready", progress: null, failure: null });
    void notifyReleaseReady(manifest.version);
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

export const useUpdates = create<UpdateState>()((set, get) => ({
  latestVersion: null,
  requiredMinVersion: null,
  status: "idle",
  progress: null,
  failure: null,
  checking: false,
  checkNow: (queueIfInFlight = false) => {
    if (checkInFlight) {
      if (queueIfInFlight) deferredCheck = true;
      return checkInFlight;
    }
    const status = get().status;
    if (status === "downloading" || status === "installing") {
      deferredCheck = true;
      return Promise.resolve("available");
    }
    const run = async (): Promise<"up-to-date" | "available" | "error"> => {
      set({ checking: true, failure: null });
      try {
        const manifest = await fetchManifest();
        if (!manifest) {
          set({ status: "error", failure: "manifest_unavailable" });
          return "error";
        }
        set({ latestVersion: manifest.version, failure: null });
        if (compareSemver(manifest.version, appVersion()) > 0) {
          const staged = readStagedVersion();
          if (staged === manifest.version) {
            set({
              status: "ready",
              progress: null,
              failure: null,
            });
            void notifyReleaseReady(manifest.version);
          } else {
            if (staged) clearStagedVersion();
            void stageInBackground(manifest);
          }
          return "available";
        }
        const staged = readStagedVersion();
        if (staged && compareSemver(staged, appVersion()) <= 0) {
          clearStagedVersion();
        }
        set({ status: "idle", progress: null });
        const armed = get().requiredMinVersion;
        if (armed && floorAppliesTo(armed, appVersion())) {
          set({ status: "error", failure: "publish_pending" });
          return "error";
        }
        set({ failure: null });
        return "up-to-date";
      } catch {
        set({ status: "error", failure: "manifest_unavailable" });
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
  installUpdate: async () => {
    if (checkInFlight) await checkInFlight;
    if (get().status === "downloading" || get().status === "installing") {
      return;
    }
    const currentLatest = get().latestVersion;
    const staged = readStagedVersion();
    const canInstallStaged =
      !!staged && compareSemver(staged, appVersion()) > 0;
    const needsStage =
      !canInstallStaged &&
      (!currentLatest ||
        compareSemver(currentLatest, appVersion()) <= 0 ||
        staged !== currentLatest);
    set({
      status: needsStage ? "downloading" : "installing",
      progress: needsStage ? { percent: 0, totalBytes: 0 } : null,
      failure: null,
    });
    const onProgress = (progress: UpdateProgress) => set({ progress });
    try {
      if (needsStage) {
        const manifest = await fetchManifest();
        if (!manifest) throw new Error("manifest_unavailable");
        if (compareSemver(manifest.version, appVersion()) <= 0) {
          const armed = get().requiredMinVersion;
          const satisfied = !armed || !floorAppliesTo(armed, appVersion());
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
        await stageApk(manifest, onProgress);
      }
      set({ status: "installing", progress: null });
      try {
        await installStaged();
      } catch (error) {
        // App-private cache evicted since staging — drop the stale marker,
        // stage once more from the manifest, then install. Any other
        // failure (permission, unavailable) stands.
        if (!(error instanceof Error) || error.message !== "not_staged") {
          throw error;
        }
        clearStagedVersion();
        const manifest = await fetchManifest();
        if (!manifest) throw new Error("manifest_unavailable");
        if (compareSemver(manifest.version, appVersion()) <= 0) {
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
        await stageApk(manifest, onProgress);
        set({ status: "installing", progress: null });
        await installStaged();
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
  },
  retryUpdate: async () => {
    // Every Android failure resolves through the install path: it re-fetches
    // the manifest and re-stages only when needed.
    await get().installUpdate();
  },
  markRequired: (minVersion) => {
    // An armed floor the running build already satisfies must not survive —
    // it can outlive its own release (someone installed the update while the
    // gate was up, or the server's floor moved back). Checked BEFORE the new
    // value, so a delayed server response cannot keep a solved gate up.
    const armed = get().requiredMinVersion;
    if (armed && !floorAppliesTo(armed, appVersion())) {
      set({ requiredMinVersion: null });
    }
    // The server's live 426 response is the only setter of this floor.
    if (!floorAppliesTo(minVersion, appVersion())) return;
    const current = get().requiredMinVersion;
    // Keep the highest floor ever seen this session.
    if (!current || compareSemver(minVersion, current) > 0) {
      set({ requiredMinVersion: minVersion });
    }
  },
}));

// Wire the api client's 426 classifier to the blocking-gate state. Module
// scope: the handler exists before the first bootstrap request can 426.
setUpdateRequiredHandler((minVersion) =>
  useUpdates.getState().markRequired(minVersion),
);

// ── Foreground triggers (checks only while the app is on screen) ─────────────

let triggersWired = false;

/**
 * Boot wiring for the Android shell: the notification tap target, the check
 * triggers, and the first silent check. A no-op on the web export, so the
 * Playwright renderer never touches native update modules.
 */
export function initUpdateChecks(): void {
  if (Platform.OS !== "android") return;
  if (triggersWired) return;
  triggersWired = true;
  // One notification per release points at Settings; the tap lands there.
  Notifications.addNotificationResponseReceivedListener(() => {
    void import("expo-router").then(({ router }) => {
      router.push("/settings");
    });
  });
  watchUpdateCheckTriggers();
  // The first check rides the launch trigger; a backgrounded cold start will
  // check on its first return to the foreground instead.
  void useUpdates.getState().checkNow(true);
}

/** Checks on return-to-foreground and network return; interval only while
 *  the app is visible. Mirrors `watchUpdateCheckTriggers` on the web. */
function watchUpdateCheckTriggers(): void {
  let foreground = true;
  let online: boolean | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const clearTimer = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };
  const schedule = () => {
    clearTimer();
    if (foreground) {
      timer = setInterval(
        () => void useUpdates.getState().checkNow(true),
        CHECK_INTERVAL_MS,
      );
    }
  };

  const removeAppStateListener = onAppStateChange((active) => {
    const changed = foreground !== active;
    foreground = active;
    schedule();
    if (active && changed) void useUpdates.getState().checkNow(true);
  });

  const removeNetworkListener = core().onNetworkChange((connected) => {
    const returned = online === false && connected;
    online = connected;
    if (returned && foreground) void useUpdates.getState().checkNow(true);
  });

  schedule();
  // The app shell lives for the process lifetime; the subscriptions are kept
  // alive on purpose, so there is no dispose path to expose.
  void removeAppStateListener;
  void removeNetworkListener;
}
