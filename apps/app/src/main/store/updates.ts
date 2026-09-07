/**
 * Update store — the renderer's single view of "is a newer version out?"
 * across all three hosts.
 *
 * - Web/PWA: the service worker IS the updater (vite-plugin-pwa autoUpdate).
 *   A new deploy precaches in the background; this store only surfaces the
 *   426 update_required dialog ("refresh to update").
 * - Electron Windows/Linux: status is pushed over the kc:update:* IPC bridge
 *   (electron/updater.ts) — silent background download, "restart to update".
 * - Electron macOS + Android (Capacitor): polls latest.json from the
 *   Worker's /releases bucket on launch + every 4h; the banner drives the
 *   dmg download / in-app APK install.
 *
 * Force updates (server 426 / published minVersion) set `requiredMinVersion`,
 * which the blocking dialog in ui/components/update-dialog.tsx renders
 * undismissably.
 */
import { create } from "zustand";
import { compareSemver } from "@kataria-syntex/shared";
import { detectHost } from "@/lib/platform";
import { API_BASE, setUpdateRequiredHandler } from "@/lib/api";

export type UpdateState = {
  /** Latest version published to /releases, when known. */
  latestVersion: string | null;
  /** Server floor (minAppVersion). Non-null ⇒ blocking dialog must show. */
  requiredMinVersion: string | null;
  /** Coarse status for the Settings row / banner. */
  status: "idle" | "checking" | "downloading" | "ready" | "error";
  /** Download percent while status === "downloading" (Android). */
  percent: number | null;
  /** True while a manual (Settings) check is in flight. */
  checking: boolean;
  /** Host-specific artifact URL from the manifest (Android APK / macOS dmg). */
  downloadUrl: string | null;
  checkNow: () => Promise<"up-to-date" | "available" | "error">;
  installUpdate: () => Promise<void>;
  markRequired: (minVersion: string) => void;
};

/** Where latest.json lives (same origin; native shells bake the absolute origin). */
function releasesManifestUrl(): string {
  return `${API_BASE}/releases/app/android/latest.json`;
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
  const host = detectHost();
  if (host === "capacitor") return true;
  if (host === "electron") return window.desktop?.platform === "darwin";
  return false;
}

/** The manifest artifact this host installs. */
function artifactFor(manifest: LatestManifest): string | null {
  const host = detectHost();
  if (host === "capacitor") {
    const apk = manifest.android?.apk;
    return typeof apk === "string" && apk.startsWith("/releases/") ? apk : null;
  }
  if (host === "electron") {
    const mac = manifest.desktop?.mac;
    return typeof mac === "string" && mac.startsWith("/releases/")
      ? `${API_BASE}${mac}`
      : null;
  }
  return null;
}

/** Poll cadence for native hosts — launch + every 4h, matching desktop. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Wire the api client's 426 classifier to the blocking-dialog state. Module
// scope: the handler exists before the first bootstrap request can 426.
setUpdateRequiredHandler((minVersion) =>
  useUpdates.getState().markRequired(minVersion),
);

export const useUpdates = create<UpdateState>()((set, get) => ({
  latestVersion: null,
  requiredMinVersion: null,
  status: "idle",
  percent: null,
  checking: false,
  downloadUrl: null,

  checkNow: async () => {
    set({ checking: true });
    try {
      if (detectHost() === "electron" && !usesManifestFlow()) {
        const res = await window.desktop?.checkForUpdate();
        if (res?.kind === "available" || res?.kind === "ready") {
          set({ latestVersion: res.version, status: "ready" });
          return "available";
        }
        return res?.kind === "error" ? "error" : "up-to-date";
      }
      // Web + Android + macOS Electron read the same published manifest.
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
      return "up-to-date";
    } finally {
      set({ checking: false });
    }
  },

  installUpdate: async () => {
    const host = detectHost();
    if (host === "electron") {
      if (usesManifestFlow()) {
        // macOS: hand the published dmg to the OS browser.
        const url = get().downloadUrl;
        if (url) await window.desktop?.openReleaseUrl(url);
        return;
      }
      await window.desktop?.restartToUpdate();
      return;
    }
    if (host === "capacitor") {
      if (!get().downloadUrl) return;
      set({ status: "downloading", percent: 0 });
      const ok = await import("@/lib/installer").then((m) =>
        m.downloadAndInstallApk((percent) => set({ percent })),
      );
      set(ok ? { status: "ready" } : { status: "error", percent: null });
      return;
    }
    // Web: the SW already precached the new build — a reload swaps it in.
    window.location.reload();
  },

  markRequired: (minVersion) => {
    const current = get().requiredMinVersion;
    // Keep the highest floor ever seen this session.
    if (!current || compareSemver(minVersion, current) > 0) {
      set({ requiredMinVersion: minVersion });
    }
  },
}));

/** Launch-time wiring: native pollers + Electron status events. */
export function initUpdateChecks(): void {
  const host = detectHost();
  if (host === "web") {
    // Web never self-blocks on a manifest — the API's 426 is the only
    // force-update signal, and the SW handles ordinary updates.
    return;
  }
  void useUpdates.getState().checkNow();
  setInterval(() => void useUpdates.getState().checkNow(), CHECK_INTERVAL_MS);

  if (host === "electron" && window.desktop?.onUpdateStatus) {
    window.desktop.onUpdateStatus((s) => {
      if (s.kind === "available" || s.kind === "ready") {
        useUpdates.setState({
          latestVersion: s.version,
          status: s.kind === "ready" ? "ready" : "idle",
        });
      } else if (s.kind === "downloading") {
        useUpdates.setState({ status: "downloading" });
      }
    });
  }
}

/** True where the banner (not the blocking dialog) is the update surface. */
export function showUpdateBanner(): boolean {
  return (
    usesManifestFlow() &&
    useUpdates.getState().status === "ready" &&
    !useUpdates.getState().requiredMinVersion
  );
}
