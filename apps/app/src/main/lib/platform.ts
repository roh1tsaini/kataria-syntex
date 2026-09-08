/**
 * Web/Electron shell adapter — apps/app's implementation of app-core's
 * PlatformAdapter seam (see packages/app-core/src/adapter.ts), plus the
 * shell-specific bits that never leave this app: host detection, the custom
 * title-bar window controls, and the browser print dialog.
 *
 * Electron exposes a tiny `window.desktop` API via contextBridge (see
 * electron/preload.ts); web/PWA is everything else. The Android app is a
 * separate React Native workspace (apps/android) with its own adapter —
 * it never loads this bundle.
 */

import {
  configureCore,
  type CoreStorage,
  type Host,
  type PlatformAdapter,
} from "@kataria-syntex/app-core";

export type { Host };

export function detectHost(): Host {
  if (typeof window === "undefined") return "web";
  if (window.desktop) return "electron";
  return "web";
}

/** True outside plain browsers — the Electron shell. (Installed PWAs run on
 * web too; see isPlainBrowser for the entry/download surface gate.) */
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

/** OS name for download recommendations (entry + download pages). Only
 * cosmetic — detection is never load-bearing and every platform stays
 * selectable on the download page. */
export function detectPlatformLabel(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|mac/i.test(ua)) return "macOS";
  if (/win/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "this device";
}

/** Opens the browser print dialog. Prints the current view after the page
 * fonts are ready so the embedded Inter font is typeset, not substituted,
 * in the printed page. (The Android app prints PDFs via its own shell.) */
export async function printPage(name = "Document"): Promise<void> {
  void name;
  try {
    await document.fonts.ready;
  } catch {
    // fonts.ready unsupported — print anyway
  }
  window.print();
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

/** Configures app-core for this shell. Called exactly once from main.tsx,
 * before the first render. Electron's session token lives in the OS
 * keychain via the IPC bridge; the web session is the HttpOnly cookie, so
 * the token hooks are Electron-only no-ops elsewhere. */
export function configureWebCore(appVersion: string): void {
  const host = detectHost();
  const desktop = window.desktop;
  const adapter: PlatformAdapter = {
    host,
    apiBaseUrl: import.meta.env.VITE_API_URL ?? "",
    appVersion,
    storage: localStorageStorage(),
    async readToken() {
      if (detectHost() !== "electron") return null;
      try {
        return (await window.desktop?.getToken()) ?? null;
      } catch {
        return null;
      }
    },
    async writeToken(token) {
      if (detectHost() !== "electron") return;
      try {
        await window.desktop?.setToken(token);
      } catch {
        // storage unavailable — session still works via bearer for this run
      }
    },
    deviceLabel,
    onNetworkChange(onChange) {
      const online = () => onChange(true);
      const offline = () => onChange(false);
      window.addEventListener("online", online);
      window.addEventListener("offline", offline);
      return () => {
        window.removeEventListener("online", online);
        window.removeEventListener("offline", offline);
      };
    },
  };
  if (host === "electron" && desktop) {
    adapter.transport = (path, init) => desktop.api(path, init);
  }
  configureCore(adapter);
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
