/**
 * Web/Electron/Android shell adapter — apps/app's implementation of app-core's
 * PlatformAdapter seam (see packages/app-core/src/adapter.ts), plus the
 * shell-specific bits that never leave this app: host detection and the custom
 * title-bar window controls.
 *
 * Electron exposes a tiny `window.desktop` API via contextBridge (see
 * electron/preload.ts); web is everything else. The Android app is a
 * Capacitor shell (apps/android) wrapping this same bundle — its native
 * branch lives below, with plugins imported lazily so browsers never pull
 * native code.
 */

import {
  configureCore,
  type CoreStorage,
  type Host,
  type PlatformAdapter,
} from "@kataria-syntex/app-core";
import type { DesktopBridge } from "../../../electron/preload";

/** Minimal shape of the Capacitor native bridge (v8 exposes
 *  window.Capacitor with isNativePlatform/getPlatform). Declared locally so
 *  this bundle never imports @capacitor/core eagerly — browsers have no
 *  bridge to read. */
type CapacitorBridge = {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
};

function isCapacitorBridge(value: unknown): value is CapacitorBridge {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.isNativePlatform === "function" &&
    typeof record.getPlatform === "function"
  );
}

/** The Capacitor bridge inside the native shell. Null in every browser —
 *  feature-detected, never user-agent sniffed. */
function capacitorBridge(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  const raw = (window as unknown as Record<string, unknown>).Capacitor;
  return isCapacitorBridge(raw) ? raw : null;
}

function detectHost(): Host {
  if (typeof window === "undefined") return "web";
  if (window.desktop) return "electron";
  const bridge = capacitorBridge();
  if (
    bridge &&
    bridge.isNativePlatform() &&
    bridge.getPlatform() === "android"
  ) {
    return "android";
  }
  return "web";
}

/** The Electron IPC bridge (see electron/preload.ts). Null on web.
 * Everything that touches window.desktop outside this file goes through
 * here (or desktopWindow below) so the bridge surface stays in one module. */
export function desktopBridge(): DesktopBridge | null {
  if (detectHost() !== "electron") return null;
  return window.desktop ?? null;
}

/** Desktop shell only: reports the resolved theme background so the next
 *  launch paints in the user's theme instead of flashing the default.
 *  No-op on web. */
export function reportThemeBackground(background: string): void {
  void desktopBridge()?.setThemeBackground(background);
}

/** True outside plain browsers — the Electron and Android shells. */
export const isNative = () => detectHost() !== "web";

/** True only in a plain browser tab — not Electron, not Android. Gates the
 * install/download surface: the native shells ARE the app. (No installed-PWA
 * case: the app ships no web manifest, so standalone display mode cannot
 * happen.) */
export function isPlainBrowser(): boolean {
  return detectHost() === "web";
}

/** True when running inside the Android Capacitor shell. */
export function isAndroid(): boolean {
  return detectHost() === "android";
}

/** macOS Electron reports as desktop but has no self-install path (unsigned
 *  builds cannot be replaced by electron-updater), so it is the one socket
 *  that updates by downloading the published dmg through the release
 *  manifest instead of an updater feed. */
export function usesManifestUpdateFlow(): boolean {
  return desktopBridge()?.platform === "darwin";
}

/** What a forced update offers on this host — the dialog's copy and its
 *  action both come from this, so no UI file branches on platform:
 *  - `reload` (web): index.html revalidates, so a reload runs the fresh shell;
 *  - `restart` (Windows/Linux): restart into the silently staged build;
 *  - `download` (macOS): hand the published dmg to the OS browser;
 *  - `install` (Android): hand the staged APK to the system installer. */
export type UpdateAction = "reload" | "restart" | "download" | "install";

export function updateAction(): UpdateAction {
  const host = detectHost();
  if (host === "android") return "install";
  if (host !== "electron") return "reload";
  return usesManifestUpdateFlow() ? "download" : "restart";
}

export type UpdateNoticePhase = "found" | "ready";

export function updateNoticeCopy(
  version: string,
  phase: UpdateNoticePhase,
): { title: string; description: string } | null {
  const host = detectHost();
  if (host === "web") return null;
  if (host === "android") {
    return phase === "found"
      ? {
          title: "Update found",
          description: `Version ${version} is downloading in the background.`,
        }
      : {
          title: "Update downloaded",
          description: `Version ${version} is downloaded. Open Settings and tap Update.`,
        };
  }
  if (usesManifestUpdateFlow()) {
    return {
      title: "Update available",
      description: `Version ${version} is available. Download it from Settings.`,
    };
  }
  return phase === "found"
    ? {
        title: "Update found",
        description: `Version ${version} is downloading in the background.`,
      }
    : {
        title: "Update downloaded",
        description: `Version ${version} is ready. Open Settings to restart and update.`,
      };
}

/** Retry the same user action after an Android or macOS handoff failed. */
export function retryUpdateUsesAction(failure: string | null): boolean {
  const host = detectHost();
  if (host === "android") {
    return failure === "install_blocked" || failure === "install_failed";
  }
  return (
    host === "electron" &&
    usesManifestUpdateFlow() &&
    failure === "download_failed"
  );
}

export type DownloadPlatformKey = "win" | "mac" | "linux" | "android";

type OperatingSystem = DownloadPlatformKey | "ios";
type ArchitectureHints = { architecture: string; bitness: string };

type UserAgentDataLike = {
  getHighEntropyValues?: (hints: string[]) => Promise<unknown>;
};

function detectOperatingSystem(): OperatingSystem | null {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return null;
  }
  if (/win/i.test(ua)) return "win";
  if (/macintosh|mac os x/i.test(ua)) return "mac";
  if (/linux/i.test(ua)) return "linux";
  return null;
}

async function readArchitectureHints(): Promise<ArchitectureHints | null> {
  const userAgentData = (
    navigator as Navigator & { userAgentData?: UserAgentDataLike }
  ).userAgentData;
  if (!userAgentData?.getHighEntropyValues) return null;

  try {
    const value: unknown = await userAgentData.getHighEntropyValues([
      "architecture",
      "bitness",
    ]);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.architecture !== "string" ||
      typeof record.bitness !== "string"
    ) {
      return null;
    }
    return {
      architecture: record.architecture.toLowerCase(),
      bitness: record.bitness,
    };
  } catch {
    return null;
  }
}

/** Recommends only builds whose published CPU target can be identified. */
export async function detectPlatformKey(): Promise<DownloadPlatformKey | null> {
  const system = detectOperatingSystem();
  if (!system || system === "ios") return null;
  if (system === "android") return "android";

  const architecture = await readArchitectureHints();
  if (architecture) {
    if (architecture.bitness !== "64") return null;
    if (system === "win" && architecture.architecture === "x86") return "win";
    if (
      system === "mac" &&
      ["arm", "arm64"].includes(architecture.architecture)
    ) {
      return "mac";
    }
    if (system === "linux" && architecture.architecture === "x86") {
      return "linux";
    }
    return null;
  }

  const ua = navigator.userAgent;
  if (system === "win" && /\b(?:win64|x64|wow64)\b/i.test(ua)) return "win";
  if (system === "linux" && /\b(?:x86_64|amd64)\b/i.test(ua)) return "linux";
  return null;
}

// ── Android storage (Capacitor Preferences behind a sync map) ───────────────

/** Session-authoritative mirror of the offline KV. Preferences is async but
 *  the offline engine reads synchronously, so every read serves this map:
 *  hydrated once at boot (see hydrateAndroidStorage) with each set/delete
 *  written through to Preferences in the background. A write that lands
 *  before hydration finishes wins — hydration only fills keys the session
 *  has not touched yet.
 *
 *  Preferences holds offline caches only — never a credential. The session
 *  token goes to the keystore-backed SecureToken plugin. */
/** Where the session token lived before the keystore plugin took over. Read
 *  once at boot only to delete it — see hydrateAndroidStorage. */
const LEGACY_ANDROID_TOKEN_KEY = "auth.token.v1";

const androidMemory = new Map<string, string>();

function androidStorage(): CoreStorage {
  return {
    get(key) {
      return androidMemory.get(key) ?? null;
    },
    set(key, value) {
      androidMemory.set(key, value);
      void import("@capacitor/preferences")
        .then(({ Preferences }) => Preferences.set({ key, value }))
        .catch(() => {
          // native store unavailable — the memory map still serves this session
        });
    },
    delete(key) {
      androidMemory.delete(key);
      void import("@capacitor/preferences")
        .then(({ Preferences }) => Preferences.remove({ key }))
        .catch(() => {
          // native store unavailable — the memory map still serves this session
        });
    },
  };
}

/** Loads the persisted offline KV into the session map. Awaited once from
 *  main.tsx before the first render on Android only — the offline engine
 *  reads synchronously, so an unhydrated map would look like a fresh install
 *  (new device identity) until the next launch. */
export async function hydrateAndroidStorage(): Promise<void> {
  if (detectHost() !== "android") return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { keys } = await Preferences.keys();
    // The session token used to live here in the clear before the keystore
    // plugin took over. On an upgraded install that file is still on disk and
    // would otherwise be hydrated into the session map as if it were an
    // offline cache — burn it before anything reads it. The keystore slot is
    // empty on such an install, so the one sign-in is lost and the next write
    // lands encrypted.
    if (keys.includes(LEGACY_ANDROID_TOKEN_KEY))
      await Preferences.remove({ key: LEGACY_ANDROID_TOKEN_KEY }).catch(() => {
        // best effort — the value is unreadable to the app either way
      });
    await Promise.all(
      keys
        .filter(
          (key) => key !== LEGACY_ANDROID_TOKEN_KEY && !androidMemory.has(key),
        )
        .map(async (key) => {
          try {
            const { value } = await Preferences.get({ key });
            if (value !== null) androidMemory.set(key, value);
          } catch {
            // single-key read failed — the session value (if any) stands
          }
        }),
    );
  } catch {
    // native store unavailable — the memory map stays authoritative
  }
}

// ── native listener helper ────────────────────────────────────────────────────

/** Minimal listener handle shared by the native plugins (both expose
 *  remove()). Declared locally so no native package is imported eagerly. */
type NativeListenerHandle = {
  remove: () => Promise<void>;
};

/** Subscribes through a lazily imported native plugin, falling back to the
 *  window listeners when the plugin is missing. The adapter contract is
 *  synchronous, so the native subscription resolves in the background while
 *  the caller already holds a working unsubscribe. */
function nativeListener(
  subscribe: () => Promise<NativeListenerHandle>,
  fallback: () => () => void,
): () => void {
  let cleanup: (() => void) | null = null;
  let settled = false;
  subscribe()
    .then((handle) => {
      if (settled) {
        void handle.remove();
        return;
      }
      settled = true;
      cleanup = () => {
        void handle.remove();
      };
    })
    .catch(() => {
      if (settled) return;
      settled = true;
      cleanup = fallback();
    });
  return () => {
    settled = true;
    cleanup?.();
  };
}

/** Browser online/offline subscription — the fallback when the native
 *  Network plugin is unavailable, and the implementation on web/Electron. */
function windowNetworkListener(
  onChange: (online: boolean) => void,
): () => void {
  const online = () => onChange(true);
  const offline = () => onChange(false);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}

/** Checks only while the app is visible; returning and reconnecting check now. */
export function watchUpdateCheckTriggers(
  checkNow: (queueIfInFlight?: boolean) => void,
  intervalMs: number,
  onForeground?: () => void,
): () => void {
  let foreground = document.visibilityState === "visible";
  let online = navigator.onLine;
  let timer: number | null = null;

  const clearTimer = () => {
    if (timer === null) return;
    window.clearInterval(timer);
    timer = null;
  };
  const schedule = () => {
    clearTimer();
    if (foreground)
      timer = window.setInterval(() => checkNow(true), intervalMs);
  };
  const setForeground = (next: boolean, forceCheck = false) => {
    const changed = foreground !== next;
    foreground = next;
    schedule();
    if (foreground && (changed || forceCheck)) {
      onForeground?.();
      checkNow(true);
    }
  };
  const onVisibilityChange = () =>
    setForeground(document.visibilityState === "visible");
  const onNetworkChange = (connected: boolean) => {
    const returned = !online && connected;
    online = connected;
    if (returned && foreground) checkNow(true);
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  const host = detectHost();
  let removeNetworkListener: () => void;
  let removeAppListener = () => {};
  if (host === "android") {
    removeNetworkListener = nativeListener(
      () =>
        import("@capacitor/network").then(({ Network }) =>
          Network.addListener("networkStatusChange", ({ connected }) =>
            onNetworkChange(connected),
          ),
        ),
      () => windowNetworkListener(onNetworkChange),
    );
    removeAppListener = nativeListener(
      () =>
        import("@capacitor/app").then(({ App }) =>
          App.addListener("appStateChange", ({ isActive }) =>
            setForeground(isActive, isActive),
          ),
        ),
      () => () => {},
    );
  } else {
    removeNetworkListener = windowNetworkListener(onNetworkChange);
  }

  schedule();
  return () => {
    clearTimer();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    removeNetworkListener();
    removeAppListener();
  };
}

// ── app-core adapter ────────────────────────────────────────────────────────

function localStorageStorage(): CoreStorage {
  return {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // quota/unavailable — caches stay in memory for this session
      }
    },
    delete(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

/**
 * The baked API origin, normalized to an absolute https:// URL (or "" for
 * same-origin). VITE_API_URL comes from the APP_URL repo variable, which is
 * a bare FQDN — a scheme-less value would make every fetch URL RELATIVE
 * (requests land on <page>/app.example.com/api/… → SPA HTML → the app reads
 * "offline"), so a bare host is always upgraded to https. Native shells'
 * build steps do the same normalization (electron/build.ts,
 * apps/android/scripts/build-web.ts). Android has no same-origin to fall back
 * to — its page origin is the local bundle — so an empty value there is a
 * build misconfiguration.
 */
function bakedApiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) {
    // Web is same-origin — an empty base is correct there. Android and
    // Electron serve a local bundle whose origin is NOT the API, so an empty
    // base makes every fetch resolve against the WebView/Electron origin:
    // /api/health returns the SPA shell (or nothing), the classifier reads it
    // as a network failure, and the app shows "offline / no internet" while
    // the device has a perfect connection. Fail at boot instead of shipping
    // a build that can never reach the server.
    if (detectHost() !== "web") {
      throw new Error(
        `VITE_API_URL is not baked into this ${detectHost()} build — the app cannot reach the API. Rebuild with VITE_API_URL set (the Android step is bun run build:web:apk with the env exported; see apps/android/APP.md).`,
      );
    }
    return "";
  }
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  return `https://${raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}`;
}

/** Configures app-core for this shell. Called exactly once from main.tsx,
 * before the first render. Electron's session token lives in the OS
 * keychain via the IPC bridge; Android keeps its token in Preferences and
 * its offline KV in the hydrated session map; the web session is the
 * HttpOnly cookie, so the token hooks are no-ops there. */
export function configureWebCore(appVersion: string): void {
  const host = detectHost();
  const desktop = window.desktop;
  const apiOrigin = bakedApiOrigin();
  const adapter: PlatformAdapter = {
    host,
    apiBaseUrl: apiOrigin,
    appVersion,
    storage: host === "android" ? androidStorage() : localStorageStorage(),
    async readToken() {
      const shell = detectHost();
      if (shell === "electron") {
        try {
          return (await window.desktop?.getToken()) ?? null;
        } catch {
          return null;
        }
      }
      if (shell === "android") {
        // Keystore-encrypted at rest. No plaintext fallback on purpose: a
        // secure store that quietly degrades to a readable file is the bug
        // this replaced, so an unreachable store means the user signs in
        // again instead of their token sitting in a file.
        try {
          const { token } = await (await secureToken()).readToken();
          return token || null;
        } catch {
          return null;
        }
      }
      return null;
    },
    async writeToken(token) {
      const shell = detectHost();
      if (shell === "electron") {
        try {
          await window.desktop?.setToken(token);
        } catch {
          // storage unavailable — session still works via bearer for this run
        }
        return;
      }
      if (shell === "android") {
        try {
          // An empty string is the plugin's clear signal — the session token
          // is never the empty string.
          await (await secureToken()).writeToken({ token: token ?? "" });
        } catch {
          // keystore unavailable — the user signs in again next launch
        }
      }
    },
    onNetworkChange(onChange) {
      if (detectHost() !== "android") return windowNetworkListener(onChange);
      return nativeListener(
        () =>
          import("@capacitor/network").then(({ Network }) =>
            Network.addListener("networkStatusChange", (status) =>
              onChange(status.connected),
            ),
          ),
        () => windowNetworkListener(onChange),
      );
    },
  };
  if (host === "electron" && desktop) {
    adapter.transport = (path, init) => desktop.api(path, init);
  }
  configureCore(adapter);
}

// ── Android deep links ────────────────────────────────────────────────────────

/**
 * The QR-login payload is a URL whose last path segment is the request id
 * (see use-camera-scanner.ts: the scan side accepts the same shape). Both the
 * custom scheme and the release origin's https form carry it, so this parses
 * either. Returns null for anything that isn't a scan route — the link must
 * not route the app off somewhere unrelated.
 */
function parseScanUrl(url: string): string | null {
  // A custom-scheme URL with no authority ("kataria://login/scan/<id>") is
  // still parseable by URL, but the scheme's first segment reads as the host
  // and the pathname starts at /scan — so match the full path, not just the
  // parsed pathname. Accepting both that and the https form keeps the parse
  // honest for every shape the manifest can claim. The id keeps its case —
  // it is an opaque server-issued value, not an upper-case code.
  const m = url.match(/\/login\/scan\/([^/?#\s]+)/);
  if (!m) return null;
  return decodeURIComponent(m[1]);
}

/**
 * Routes a URL Android handed the app. Only the QR-login scan route is
 * claimed; anything else is ignored so a link can't navigate the app to an
 * arbitrary page. Navigation mirrors the notification-tap path: push the path
 * and let the router's popstate listener pick it up.
 */
function routeDeepLink(url: string): void {
  const id = parseScanUrl(url);
  if (!id) return;
  try {
    window.history.pushState(null, "", `/login/scan/${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch {
    // Navigation failed — leave the app where it is; the approve page can
    // also be opened by typing the link on any browser.
  }
}

let deepLinksWired = false;

/**
 * Subscribes to native URL-open events and routes them. Android delivers
 * appUrlOpen when the app was launched (or resumed) by an intent filter the
 * manifest claims: the kataria:// scheme and the release origin's
 * /login/scan/<id> path (see AndroidManifest.xml). Wired once at boot by
 * main.tsx; returns the unsubscribe, which the app never calls — the
 * subscription lives as long as the process.
 */
export async function initAndroidDeepLinks(): Promise<void> {
  if (detectHost() !== "android" || deepLinksWired) return;
  deepLinksWired = true;
  try {
    const { App } = await import("@capacitor/app");
    // A cold start hands the launch URL immediately; a warm resume fires it
    // when the user taps a link from another app. Both route the same way.
    await App.addListener("appUrlOpen", (event) => {
      if (typeof event?.url === "string") routeDeepLink(event.url);
    });
  } catch {
    // Plugin unavailable (bundle previewed in a browser) — deep links simply
    // don't route, the app still opens on its last route.
  }
}

// ── Android bundle self-heal ─────────────────────────────────────────────────

/** One reload attempt per WebView session — the swapped bundle must match the
 *  installed APK after that, so a second attempt only means something else is
 *  wrong (rolled-back APK, patched build) and must never become a loop. */
const ANDROID_HEAL_KEY = "android.bundleHealVersion";

function healAlreadyAttempted(nativeVersion: string): boolean {
  try {
    return sessionStorage.getItem(ANDROID_HEAL_KEY) === nativeVersion;
  } catch {
    // Storage unavailable — the loop that a session flag exists to stop
    // cannot be ruled out, so bail out of the heal entirely. A stale bundle
    // then surfaces as an app error instead of reloading unguarded.
    return true;
  }
}

function markHealAttempted(nativeVersion: string): void {
  try {
    sessionStorage.setItem(ANDROID_HEAL_KEY, nativeVersion);
  } catch {
    // Best effort — see healAlreadyAttempted.
  }
}

/**
 * Android serves the bundle from the APK's assets through synthetic
 * https://localhost responses, and the WebView keeps a cached copy that an APK
 * install does not invalidate — so the app can start up running the build that
 * was just replaced, which also breaks the X-App-Version handshake. Compare
 * the native versionName with the version baked into the bundle that is
 * actually executing; on a mismatch reload once with a version query so the
 * WebView re-reads the new APK's assets.
 */
export async function reloadOnStaleAndroidBundle(): Promise<void> {
  if (detectHost() !== "android") return;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    if (!info.version || info.version === __APP_VERSION__) return;
    if (healAlreadyAttempted(info.version)) return;
    markHealAttempted(info.version);
    const url = new URL(window.location.href);
    url.searchParams.set("v", info.version);
    window.location.replace(url.toString());
  } catch {
    // Bridge unavailable (bundle previewed in a browser) — nothing to check.
  }
}

// ── Android APK self-update (InstallerPlugin) ─────────────────────────────────

type ApkProgress = { bytes: number; total: number };

/** Minimal shape of the app's Installer plugin (registered in MainActivity,
 *  not an npm package). Declared locally so browsers never import
 *  @capacitor/core eagerly. */
type InstallerPlugin = {
  downloadApk(options: {
    url: string;
    filename?: string;
    sha256?: string;
  }): Promise<void>;
  installApk(options: { filename?: string }): Promise<void>;
  addListener(
    event: "progress",
    listener: (progress: ApkProgress) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

/** Staged APK filename — one slot in app-private cache, shared by the native
 *  side (InstallerPlugin.DEFAULT_FILENAME) and every caller below. */
const STAGED_APK_FILENAME = "ks-biz-app.apk";

type InstallerManifest = {
  version: string;
  android?: { apk?: string; sha256?: string; size?: number };
};

export async function fetchInstallerManifest(
  apiBase: string,
): Promise<InstallerManifest | null> {
  try {
    const res = await fetch(`${apiBase}/releases/app/android/latest.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object") return null;
    if (typeof (body as Record<string, unknown>).version !== "string") {
      return null;
    }
    return body as InstallerManifest;
  } catch {
    return null;
  }
}

/** Version whose APK sits verified in app-private cache (survives restarts).
 *  Cleared when superseded by a newer manifest or after a cache eviction;
 *  retained after launching the installer so backing out of it keeps the
 *  Settings action. The marker alone never proves the file is there — the
 *  cache can be evicted — so the install step still handles "not_staged" by
 *  staging again. */
const STAGED_KEY = "android.stagedApkVersion";

export function readStagedApkVersion(): string | null {
  try {
    return localStorage.getItem(STAGED_KEY);
  } catch {
    return null;
  }
}

function writeStagedApkVersion(version: string): void {
  try {
    localStorage.setItem(STAGED_KEY, version);
  } catch {
    // Storage unavailable — staging still works, it just re-downloads next
    // launch instead of being reused.
  }
}

export function clearStagedApkVersion(): void {
  try {
    localStorage.removeItem(STAGED_KEY);
  } catch {
    // ignore
  }
}

/** Capacitor reject codes surface as the Error message — the store switches
 *  on "not_staged" to stage again after a cache eviction. */
export function pluginErrorCode(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

async function installer(): Promise<InstallerPlugin> {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<InstallerPlugin>("Installer");
}

/** Native session-token store (SecureTokenPlugin.kt) — AES-GCM under a
 *  non-exportable Android Keystore key. */
type SecureTokenPlugin = {
  readToken(): Promise<{ token: string | null }>;
  writeToken(options: { token: string }): Promise<void>;
};

async function secureToken(): Promise<SecureTokenPlugin> {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<SecureTokenPlugin>("SecureToken");
}

function apkUrl(apiBase: string, manifest: InstallerManifest): string {
  const apk = manifest.android?.apk;
  if (typeof apk !== "string" || !apk.startsWith("/releases/")) {
    throw new Error("artifact_missing");
  }
  return `${apiBase}${apk}`;
}

/**
 * Background staging: downloads the manifest's APK into app-private cache
 * and verifies its SHA-256 when the manifest carries one. Never opens
 * settings, never launches the installer — safe from the background poller
 * with no user gesture. Skips the download when this exact version is
 * already staged. onProgress fires as chunks land. Throws
 * "manifest_unavailable" / "artifact_missing" / "download_failed" /
 * "integrity_failed".
 */
export async function ensureAndroidStaging(
  apiBase: string,
  manifest: InstallerManifest,
  onProgress: (progress: ApkProgress) => void,
): Promise<void> {
  if (detectHost() !== "android") throw new Error("android_only");
  if (!apiBase) throw new Error("manifest_unavailable");
  if (readStagedApkVersion() === manifest.version) return;
  const url = apkUrl(apiBase, manifest);
  const sha256 = manifest.android?.sha256;
  const plugin = await installer();
  const handle = await plugin.addListener("progress", onProgress);
  try {
    await plugin.downloadApk({
      url,
      filename: STAGED_APK_FILENAME,
      ...(typeof sha256 === "string" && sha256 ? { sha256 } : {}),
    });
  } finally {
    await handle.remove().catch(() => {
      // listener already gone — the download result stands on its own
    });
  }
  writeStagedApkVersion(manifest.version);
}

/**
 * Tap-driven install: hands the staged APK to the system package installer.
 * The unknown-sources settings page opens exclusively from here — never from
 * a background poll. Throws "not_staged" (cache evicted since staging —
 * stage again, then retry) / "install_permission_required" (user must allow
 * installs from this app, then retry) / "install_unavailable".
 */
export async function installStagedAndroidApk(): Promise<void> {
  if (detectHost() !== "android") throw new Error("android_only");
  const plugin = await installer();
  await plugin.installApk({ filename: STAGED_APK_FILENAME });
}

// ── Electron window chrome (used by title-bar.tsx) ──────────────────────────

/** Window-control surface behind the custom title bar. Null on web —
 * there is no window chrome. Everything touching window.desktop window IPC
 * lives here so no UI file branches on platform. */
type DesktopWindow = {
  platform: "darwin" | "win32" | "linux";
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
};

export function desktopWindow(): DesktopWindow | null {
  if (detectHost() !== "electron") return null;
  const d = window.desktop;
  if (!d?.minimizeWindow || !d.platform) return null;
  return {
    platform: d.platform,
    minimize: () => d.minimizeWindow(),
    toggleMaximize: () => d.toggleMaximizeWindow(),
    close: () => d.closeWindow(),
    isMaximized: () => d.isMaximizedWindow(),
    onMaximizedChange: (cb) => d.onMaximizedChange(cb),
  };
}
