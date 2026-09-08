/**
 * Update store for the Android app — mirrors apps/app's update UX contract:
 * poll the published manifest on launch + every 4h, banner for available,
 * blocking dialog for the 426 floor, download with percent, install via the
 * system package installer.
 */

import { create } from "zustand";
import { setUpdateRequiredHandler } from "@kataria-syntex/app-core";
import { appVersion, apiBaseUrl } from "./core-adapter";
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
  percent: number | null;
  checking: boolean;
  checkNow: () => Promise<"up-to-date" | "available" | "error">;
  installUpdate: () => Promise<void>;
  markRequired: (minVersion: string) => void;
};

/** Poll cadence — launch + every 4h, matching desktop. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let wired = false;

// Wire app-core's 426 classifier to the blocking-dialog state before the
// first request can 426.
setUpdateRequiredHandler((minVersion) =>
  useUpdates.getState().markRequired(minVersion),
);

export const useUpdates = create<UpdateState>()((set, get) => ({
  latestVersion: null,
  requiredMinVersion: null,
  status: "idle",
  percent: null,
  checking: false,

  checkNow: async () => {
    set({ checking: true });
    try {
      const manifest: UpdateManifest | null = await fetchManifest(apiBaseUrl());
      if (!manifest) return "error";
      if (manifest.minVersion) get().markRequired(manifest.minVersion);
      set({ latestVersion: manifest.version });
      if (isNewer(manifest, appVersion())) {
        set({ status: "ready" });
        return "available";
      }
      return "up-to-date";
    } finally {
      set({ checking: false });
    }
  },

  installUpdate: async () => {
    set({ status: "downloading", percent: 0 });
    try {
      await downloadAndInstallApk(apiBaseUrl(), (percent) => set({ percent }));
      set({ status: "ready", percent: null });
    } catch {
      set({ status: "error", percent: null });
    }
  },

  markRequired: (minVersion) => {
    const current = get().requiredMinVersion;
    if (!current || minVersion > current) {
      set({ requiredMinVersion: minVersion });
    }
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
