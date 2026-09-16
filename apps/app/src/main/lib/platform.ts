/**
 * Web/Electron/Android shell adapter — apps/app's implementation of app-core's
 * PlatformAdapter seam (see packages/app-core/src/adapter.ts), plus the
 * shell-specific bits that never leave this app: host detection, the custom
 * title-bar window controls, and the browser print dialog.
 *
 * Electron exposes a tiny `window.desktop` API via contextBridge (see
 * electron/preload.ts); web/PWA is everything else. The Android app is a
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
import { bytesToBase64 } from "../../shared/base64";

export type { Host };

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

export function detectHost(): Host {
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

/** The Electron IPC bridge (see electron/preload.ts). Null on web/PWA.
 * Everything that touches window.desktop outside this file goes through
 * here (or desktopWindow below) so the bridge surface stays in one module. */
export function desktopBridge(): DesktopBridge | null {
  if (detectHost() !== "electron") return null;
  return window.desktop ?? null;
}

/** Desktop shell only: reports the resolved theme background so the next
 *  launch paints in the user's theme instead of flashing the default.
 *  No-op on web/PWA. */
export function reportThemeBackground(background: string): void {
  void desktopBridge()?.setThemeBackground(background);
}

/** True outside plain browsers — the Electron and Android shells. (Installed
 *  PWAs run on web too; see isPlainBrowser for the entry/download surface
 *  gate.) */
export const isNative = () => detectHost() !== "web";

/** True only in a plain browser tab — not Electron, not an installed PWA
 * running in standalone display mode. Gates the install/download surface:
 * the Electron shell and installed PWAs ARE the app. */
export function isPlainBrowser(): boolean {
  if (detectHost() !== "web") return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari, pre display-mode-query
    (navigator as { standalone?: boolean }).standalone === true;
  return !standalone;
}

/** Human-readable device label for the offline device identity. Reads the
 * user-agent directly so no other module sniffs the UA for platform
 * decisions. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  return /android/i.test(ua)
    ? "Android"
    : /electron/i.test(ua)
      ? "Desktop"
      : "Browser";
}

/** OS key for download recommendations (entry + download pages). Cosmetic —
 * detection is never load-bearing and every platform stays selectable. The
 * one UA read in the app for platform display decisions. */
export function detectPlatformKey():
  "win" | "mac" | "linux" | "android" | null {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|mac/i.test(ua)) return "mac";
  if (/win/i.test(ua)) return "win";
  if (/linux/i.test(ua)) return "linux";
  return null;
}

/** Human-readable OS name — derived from the same sniff as
 * detectPlatformKey, so the two surfaces can never disagree. */
export function detectPlatformLabel(): string {
  const key = detectPlatformKey();
  if (!key) return "this device";
  return { win: "Windows", mac: "macOS", linux: "Linux", android: "Android" }[
    key
  ];
}

/** Opens the browser print dialog. Prints the current view after the page
 * fonts are ready so the embedded Inter font is typeset, not substituted,
 * in the printed page. Web and desktop only — Android cannot print the live
 * page, so callers route it through shareChallanPdfOnAndroid instead, which hands
 * the rendered PDF to the native PrintManager (see challans-print.tsx). */
export async function printPage(name = "Document"): Promise<void> {
  void name;
  try {
    await document.fonts.ready;
  } catch {
    // fonts.ready unsupported — print anyway
  }
  window.print();
}

// ── Android storage (Capacitor Preferences behind a sync map) ───────────────

/** Bearer-token key in Preferences. Kept out of the session map below so
 *  boot hydration never copies the token into the offline KV. */
const ANDROID_TOKEN_KEY = "auth.token.v1";

/** Session-authoritative mirror of the offline KV. Preferences is async but
 *  the offline engine reads synchronously, so every read serves this map:
 *  hydrated once at boot (see hydrateAndroidStorage) with each set/delete
 *  written through to Preferences in the background. A write that lands
 *  before hydration finishes wins — hydration only fills keys the session
 *  has not touched yet. */
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
 *  (new device identity, dropped queue) until the next launch. */
export async function hydrateAndroidStorage(): Promise<void> {
  if (detectHost() !== "android") return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { keys } = await Preferences.keys();
    await Promise.all(
      keys
        .filter((key) => key !== ANDROID_TOKEN_KEY && !androidMemory.has(key))
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

/** Document visibility subscription — the fallback when the native App
 *  plugin is unavailable, and the implementation on web/Electron. */
function windowActivityListener(
  onActive: (active: boolean) => void,
): () => void {
  const handler = () => onActive(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
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
 *  apps/android/scripts/build-web.ts). Android has no same-origin to fall back to — its page
 *  origin is the local bundle — so an empty value there is a build
 *  misconfiguration: the sync step must bake VITE_API_URL, and realtime stays
 *  disabled rather than dialing the bundle (see realtimeOrigin).
 */
function bakedApiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) {
    // Web/PWA is same-origin — an empty base is correct there. Android and
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
        // Preferences is the v1 token store; native secure storage is the
        // follow-up — the API shape (get-then-read-.value) stays identical.
        try {
          const { Preferences } = await import("@capacitor/preferences");
          return (await Preferences.get({ key: ANDROID_TOKEN_KEY })).value;
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
          const { Preferences } = await import("@capacitor/preferences");
          if (token === null)
            await Preferences.remove({ key: ANDROID_TOKEN_KEY });
          else await Preferences.set({ key: ANDROID_TOKEN_KEY, value: token });
        } catch {
          // native store unavailable — session still works via bearer for this run
        }
      }
    },
    deviceLabel,
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
    realtimeOrigin() {
      if (apiOrigin) return apiOrigin;
      // The Android WebView serves the local bundle, so deriving from the
      // page would dial the bundle origin — realtime stays off until the
      // sync step bakes VITE_API_URL (see bakedApiOrigin).
      if (detectHost() === "android") return null;
      // Same-origin web/PWA: derive from the page itself (apiBaseUrl is "").
      const loc = window.location;
      return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}`;
    },
    onActivityChange(onActive) {
      if (detectHost() !== "android") return windowActivityListener(onActive);
      return nativeListener(
        () =>
          import("@capacitor/app").then(({ App }) =>
            App.addListener("appStateChange", (state) =>
              onActive(state.isActive),
            ),
          ),
        () => windowActivityListener(onActive),
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
 * The QR-login payload is a URL whose last path segment is the code (see
 * use-camera-scanner.ts: the scan side accepts the same shape). Both the
 * custom scheme and the release origin's https form carry it, so this parses
 * either. Returns null for anything that isn't a scan route — the link must
 * not route the app off somewhere unrelated.
 */
function parseScanUrl(url: string): string | null {
  // A custom-scheme URL with no authority ("kataria://login/scan/AB12CD") is
  // still parseable by URL, but the scheme's first segment reads as the host
  // and the pathname starts at /scan — so match the full path, not just the
  // parsed pathname. Accepting both that and the https form keeps the parse
  // honest for every shape the manifest can claim.
  const m = url.match(/\/login\/scan\/([^/?#\s]+)/);
  if (!m) return null;
  return decodeURIComponent(m[1]).toUpperCase();
}

/**
 * Routes a URL Android handed the app. Only the QR-login scan route is
 * claimed; anything else is ignored so a link can't navigate the app to an
 * arbitrary page. Navigation mirrors the notification-tap path: push the path
 * and let the router's popstate listener pick it up.
 */
function routeDeepLink(url: string): void {
  const code = parseScanUrl(url);
  if (!code) return;
  try {
    window.history.pushState(null, "", `/login/scan/${code}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch {
    // Navigation failed — the code can still be typed on the scan page.
  }
}

let deepLinksWired = false;

/**
 * Subscribes to native URL-open events and routes them. Android delivers
 * appUrlOpen when the app was launched (or resumed) by an intent filter the
 * manifest claims: the kataria:// scheme and the release origin's
 * /login/scan/<code> path (see AndroidManifest.xml). Wired once at boot by
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

// ── Android PDF share (Capacitor Filesystem + Share) ─────────────────────────

/** True when the Capacitor shell needs its own file handling instead of the
 *  browser download / Electron save dialog. */
export function isAndroidShell(): boolean {
  return detectHost() === "android";
}

/**
 * Saves a PDF to the cache and opens the system share sheet. The WebView has
 * no download manager, so a blob download is a no-op on Android — the file
 * must go through Capacitor's Filesystem to a real path, then Share so the
 * user can send it to Drive, WhatsApp, print apps, etc. Resolves once the
 * sheet opens — a dismissed sheet is not reported, so the caller treats a
 * resolution as saved.
 */
export async function sharePdfOnAndroid(
  bytes: Uint8Array,
  filename: string,
): Promise<boolean> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const base64 = bytesToBase64(bytes);
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });
  await Share.share({
    title: filename,
    url: uri,
    dialogTitle: filename,
  });
  return true;
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

// ── Android release announcement (LocalNotifications) ────────────────────────

/** Version last announced via a system notification (per-release dedupe). */
const NOTIFIED_KEY = "android.updateNotifiedVersion";

function alreadyNotified(version: string): boolean {
  try {
    return localStorage.getItem(NOTIFIED_KEY) === version;
  } catch {
    return false;
  }
}

function markNotified(version: string): void {
  try {
    localStorage.setItem(NOTIFIED_KEY, version);
  } catch {
    // Storage unavailable — worst case is one repeat per launch, which the
    // Settings row already makes harmless.
  }
}

/**
 * Announces a downloaded release with a system notification, once per
 * version. Fires after the APK has landed in app-private cache and the
 * system installer is one tap away, so the notification is a summons to
 * install, not a promise of a download. The Android 13+ permission prompt
 * stays contextual — never at boot. Denial only silences the announcement;
 * the Updates row in Settings keeps the install path.
 */
export async function notifyAndroidUpdateAvailable(
  version: string,
): Promise<void> {
  if (detectHost() !== "android") return;
  if (alreadyNotified(version)) return;
  try {
    const { LocalNotifications } =
      await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1, // one slot — a newer release replaces the pending announce
          title: `Kataria Syntex v${version} ready to install`,
          body: "Downloaded — tap to install the update.",
          extra: { version },
          schedule: { at: new Date(Date.now() + 1_000) },
        },
      ],
    });
    markNotified(version);
  } catch {
    // Bridge missing or plugin not synced — the Settings row still carries
    // the update.
  }
}

let notificationTapWired = false;

/**
 * Wires the announcement's tap to the Updates screen, once per app lifetime.
 * A tap while the app is backgrounded (or killed) re-launches it and this
 * listener receives the same `localNotificationActionPerformed` event, so
 * navigation happens after boot either way.
 */
export async function initAndroidUpdateNotifications(): Promise<void> {
  if (detectHost() !== "android" || notificationTapWired) return;
  notificationTapWired = true;
  try {
    const { LocalNotifications } =
      await import("@capacitor/local-notifications");
    await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      () => {
        // Client-side navigation inside the WebView: push the Updates route
        // and let the router's popstate listener pick it up. The app's own
        // deep-link seam (kataria://) is reserved for the QR flows.
        try {
          window.history.pushState(null, "", "/settings");
          window.dispatchEvent(new PopStateEvent("popstate"));
        } catch {
          // Navigation failed — the update still shows in Settings manually.
        }
      },
    );
  } catch {
    // Plugin unavailable — announcements stay in the Settings row.
  }
}

// ── Android APK self-update (InstallerPlugin) ─────────────────────────────────

export type ApkProgress = { bytes: number; total: number };

/** Minimal shape of the app's Installer plugin (registered in MainActivity,
 *  not an npm package). Declared locally so browsers never import
 *  @capacitor/core eagerly. */
type InstallerPlugin = {
  installApk(options: { url: string; filename?: string }): Promise<void>;
  addListener(
    event: "progress",
    listener: (progress: ApkProgress) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

type InstallerManifest = {
  version: string;
  android?: { apk?: string };
};

async function fetchInstallerManifest(
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

/**
 * Streams the release APK into app-private cache and hands it to the system
 * package installer. onProgress fires as chunks land. Throws
 * "manifest_unavailable" / "artifact_missing" / "download_failed" /
 * "install_permission_required" (user must allow installs from this app,
 * then retry) / "install_unavailable" — the update store maps these to its
 * status, the blocking dialog explains the permission one.
 */
export async function downloadAndInstallApk(
  apiBase: string,
  onProgress: (progress: ApkProgress) => void,
): Promise<void> {
  if (detectHost() !== "android") throw new Error("android_only");
  if (!apiBase) throw new Error("manifest_unavailable");
  const manifest = await fetchInstallerManifest(apiBase);
  if (!manifest) throw new Error("manifest_unavailable");
  const apk = manifest.android?.apk;
  if (typeof apk !== "string" || !apk.startsWith("/releases/")) {
    throw new Error("artifact_missing");
  }
  const { registerPlugin } = await import("@capacitor/core");
  const installer = registerPlugin<InstallerPlugin>("Installer");
  const handle = await installer.addListener("progress", onProgress);
  try {
    await installer.installApk({
      url: `${apiBase}${apk}`,
      filename: "ks-biz-app.apk",
    });
  } finally {
    await handle.remove().catch(() => {
      // listener already gone — the download result stands on its own
    });
  }
}

// ── Android PDF share ────────────────────────────────────────────────────────

/**
 * Shares the already-rendered challan PDF on Android. window.print() in the
 * WebView has no document to hand the system, only the live page, and there is
 * no maintained Capacitor plugin that prints a file — so Android gets the same
 * share sheet the download path uses (Drive, WhatsApp, a print app, or Save),
 * and printing stays a web/desktop capability.
 *
 * Android-only: throws "android_only" elsewhere.
 */
export async function shareChallanPdfOnAndroid(
  bytes: Uint8Array,
  filename: string,
): Promise<boolean> {
  if (detectHost() !== "android") throw new Error("android_only");
  return sharePdfOnAndroid(bytes, filename);
}

// ── Electron window chrome (used by title-bar.tsx) ──────────────────────────

/** Window-control surface behind the custom title bar. Null on web/PWA —
 * there is no window chrome. Everything touching window.desktop window IPC
 * lives here so no UI file branches on platform. */
export type DesktopWindow = {
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
