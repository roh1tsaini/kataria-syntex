/**
 * Update store for the Android app — mirrors apps/app's update UX contract:
 * poll the published manifest on launch + every 4h, banner for available
 * (dismissable per version), blocking dialog for the 426 floor, APK download
 * with live byte/percent/ETA progress, install via the system package
 * installer.
 */

import { create } from "zustand";
import { compareSemver } from "@kataria-syntex/shared";
import {
  createEtaEstimator,
  setUpdateRequiredHandler,
  type UpdateProgress,
} from "@kataria-syntex/app-core";
import { apiBaseUrl, appVersion, uiStorage } from "./core-adapter";
import {
  downloadAndInstallApk,
  fetchManifest,
  isNewer,
  type UpdateManifest,
} from "./installer";

export type UpdateState = {
  latestVersion: string | null;
  requiredMinVersion: string | null;
  status: "idle" | "checking" | "downloading" | "ready" | "error";
  /** Live APK download progress — null when nothing is in flight. */
  progress: UpdateProgress | null;
  checking: boolean;
  /** Version deferred via the banner's dismiss — the banner stays hidden
   * until a different version ships. */
  dismissedVersion: string | null;
  checkNow: () => Promise<"up-to-date" | "available" | "error">;
  installUpdate: () => Promise<void>;
  markRequired: (minVersion: string) => void;
  dismiss: () => void;
};

/** Poll cadence — launch + every 4h, matching desktop. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const DISMISS_KEY = "updates.dismissedVersion";

let wired = false;
let checkSeq = 0;
let installInFlight: Promise<void> | null = null;
const etaFrom = createEtaEstimator();

// Wire app-core's 426 classifier to the blocking-dialog state before the
// first request can 426.
setUpdateRequiredHandler((minVersion) =>
  useUpdates.getState().markRequired(minVersion),
);

export const useUpdates = create<UpdateState>()((set, get) => ({
  latestVersion: null,
  requiredMinVersion: null,
  status: "idle",
  progress: null,
  checking: false,
  dismissedVersion: uiStorage.get(DISMISS_KEY),

  checkNow: async () => {
    const seq = ++checkSeq;
    set({ checking: true });
    try {
      const manifest: UpdateManifest | null = await fetchManifest(apiBaseUrl());
      if (seq !== checkSeq) return "error";
      if (!manifest) {
        set({ status: "error" });
        return "error";
      }
      if (
        manifest.minVersion &&
        compareSemver(manifest.minVersion, appVersion()) > 0
      ) {
        get().markRequired(manifest.minVersion);
      }
      set({ latestVersion: manifest.version });
      if (isNewer(manifest, appVersion())) {
        set({ status: "ready" });
        return "available";
      }
      set({ status: "idle" });
      return "up-to-date";
    } catch {
      if (seq !== checkSeq) return "error";
      set({ status: "error" });
      return "error";
    } finally {
      if (seq === checkSeq) set({ checking: false });
    }
  },

  installUpdate: async () => {
    if (installInFlight) return installInFlight;
    const run = (async () => {
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
        await downloadAndInstallApk(apiBaseUrl(), ({ bytes, total }) => {
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
    })();
    installInFlight = run;
    try {
      await run;
    } finally {
      if (installInFlight === run) installInFlight = null;
    }
  },

  markRequired: (minVersion) => {
    const current = get().requiredMinVersion;
    // Keep the highest floor ever seen this session — string comparison
    // would rank "0.10.0" below "0.9.0" and silently drop the gate.
    if (!current || compareSemver(minVersion, current) > 0) {
      set({ requiredMinVersion: minVersion });
    }
  },

  dismiss: () => {
    const version = get().latestVersion;
    if (!version) return;
    uiStorage.set(DISMISS_KEY, version);
    set({ dismissedVersion: version });
  },
}));

/** Launch-time wiring: poll now, then every 4h. Mount once in the root
 * layout (StrictMode-safe). */
export function initUpdateChecks(): void {
  if (wired) return;
  wired = true;
  void useUpdates.getState().checkNow();
  setInterval(() => void useUpdates.getState().checkNow(), CHECK_INTERVAL_MS);
}
