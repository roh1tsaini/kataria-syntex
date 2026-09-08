/**
 * Update store — the web and desktop shells' single view of "is a newer
 * version out?". ONE state shape and ONE surface set (banner for
 * non-blocking, blocking dialog for the 426 floor) for every host.
 *
 * - Web/PWA: the service worker is the updater, in "prompt" mode. A new
 *   deploy installs (precaches) in the background; the SW never activates
 *   itself and the tab never auto-reloads. The banner shows "ready to
 *   update"; installUpdate() sends skip-waiting, then reloads once the
 *   waiting worker controls the page. A hidden update check runs hourly so
 *   long-lived tabs find deploys.
 * - Electron Windows/Linux: status is pushed over the kc:update:* IPC bridge
 *   (electron/updater.ts) — silent background download, "restart to update".
 * - Electron macOS: polls latest.json from the Worker's /releases bucket on
 *   launch + every 4h; the banner drives the dmg download. (The Android app
 *   runs its own manifest poller — apps/android.)
 *
 * Force updates (server 426 / published minVersion) set `requiredMinVersion`,
 * which the blocking dialog in ui/components/update-dialog.tsx renders
 * undismissably. On web that action awaits SW activation before reloading —
 * see applyWebUpdate().
 */
import { create } from "zustand";
import { compareSemver } from "@kataria-syntex/shared";
import { apiOrigin, setUpdateRequiredHandler } from "@kataria-syntex/app-core";
import { registerSW } from "virtual:pwa-register";
import { detectHost } from "@/lib/platform";

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
  /** Host-specific artifact URL from the manifest (macOS dmg). */
  downloadUrl: string | null;
  /**
   * Web/PWA only — truthy once a new service worker is WAITING (new build
   * fully precached, not yet controlling). Set by onNeedRefresh.
   */
  swWaiting: boolean;
  checkNow: () => Promise<"up-to-date" | "available" | "error">;
  installUpdate: () => Promise<void>;
  markRequired: (minVersion: string) => void;
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
  return detectHost() === "electron" && window.desktop?.platform === "darwin";
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

/**
 * Web/PWA install flow. prompt-mode registration; `updateSW()` messages the
 * waiting worker to skipWaiting, then this side reloads ONLY after the
 * "controlling" event (the waiting worker is active) — a reload before that
 * would just re-serve the old precached shell and never converge on a 426.
 */
let updateSwFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swWaitingResolve: (() => void) | null = null;

function registerServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    updateSwFn = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        useUpdates.setState({ swWaiting: true, status: "ready" });
        // The SW events carry no version number — read the published
        // manifest so the banner can show one (also re-arms the 426 floor).
        void useUpdates.getState().checkNow();
        if (swWaitingResolve) {
          swWaitingResolve();
          swWaitingResolve = null;
        }
      },
    });
  }
}

/** Resolves once a waiting worker exists (immediately if one is already
 * there, else after probing the registration with a bounded timeout). */
function waitForWaitingWorker(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve) => {
    if (useUpdates.getState().swWaiting) {
      resolve();
      return;
    }
    swWaitingResolve = resolve;
    // A 426 can land before the browser's own update check has fetched the
    // new sw.js — force a check so the waiting worker materializes instead
    // of us timing out into a plain reload.
    void navigator.serviceWorker
      ?.getRegistration()
      .then((reg) => {
        void reg?.update().catch(() => {});
      })
      .catch(() => {});
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 500;
      if (useUpdates.getState().swWaiting || elapsed >= timeoutMs) {
        clearInterval(timer);
        if (swWaitingResolve === resolve) swWaitingResolve = null;
        resolve();
      }
    }, 500);
  });
}

/**
 * Web/PWA install flow. registerType "prompt": the waiting worker never
 * activates itself, and the registered plugin callback reloads the page ONLY
 * after the new worker takes control (the `controlling` event) — so this
 * side must never race it with its own reload.
 */
async function applyWebUpdate(): Promise<void> {
  if (!updateSwFn) {
    // Registration failed / unsupported — a plain reload still re-fetches
    // the fresh shell (index.html is no-cache) and re-arms the 426 gate.
    window.location.reload();
    return;
  }
  await waitForWaitingWorker();
  await updateSwFn();
  // Reload happens via the plugin's controlling listener. If no waiting
  // worker materialized within the timeout, force the handover ourselves.
  if (!useUpdates.getState().swWaiting) window.location.reload();
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
  percent: null,
  checking: false,
  downloadUrl: null,
  swWaiting: false,

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
      // A waiting worker (deploy mid-install) is surfaced by onNeedRefresh.
      return "up-to-date";
    } finally {
      set({ checking: false });
    }
  },

  installUpdate: async () => {
    if (detectHost() === "electron") {
      if (usesManifestFlow()) {
        // macOS: hand the published dmg to the OS browser.
        const url = get().downloadUrl;
        if (url) await window.desktop?.openReleaseUrl(url);
        return;
      }
      await window.desktop?.restartToUpdate();
      return;
    }
    // Web/PWA: skip-waiting → wait for the new worker to control the page →
    // reload. Safe from the banner AND from the 426 dialog.
    await applyWebUpdate();
  },

  markRequired: (minVersion) => {
    const current = get().requiredMinVersion;
    // Keep the highest floor ever seen this session.
    if (!current || compareSemver(minVersion, current) > 0) {
      set({ requiredMinVersion: minVersion });
    }
  },
}));

/** Launch-time wiring: SW registration (web), the macOS poller, IPC events.
 * StrictMode mounts App twice in dev — wire exactly once. */
let updateChecksWired = false;

export function initUpdateChecks(): void {
  if (updateChecksWired) return;
  updateChecksWired = true;
  const host = detectHost();
  if (host === "web") {
    registerServiceWorker();
    // Long-lived tabs: prompt-mode SWs are checked by the browser on
    // navigation only, so a standalone PWA window left open for days would
    // never see a deploy. The hourly probe covers that.
    setInterval(() => {
      void navigator.serviceWorker?.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.update();
      });
    }, SW_CHECK_INTERVAL_MS);
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
  const s = useUpdates.getState();
  if (detectHost() === "web") {
    // Web banner: a waiting service worker (new build precached, ready to
    // apply). The blocking dialog covers the 426 floor separately.
    return s.swWaiting && !s.requiredMinVersion;
  }
  return usesManifestFlow() && s.status === "ready" && !s.requiredMinVersion;
}
