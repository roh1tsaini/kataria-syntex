/**
 * Runtime host detection + native session-token storage.
 *
 * The same Vite SPA runs on web/PWA (HttpOnly cookie), Electron desktop
 * (token encrypted in the OS keychain via the IPC bridge) and
 * Capacitor/Android (secure storage plugin with Preferences fallback). This
 * module abstracts "where am I" and "where is the bearer token" so the rest
 * of the app never branches on a platform.
 *
 * Electron exposes a tiny `window.desktop` API via contextBridge (see
 * electron/preload.ts); Capacitor injects "Capacitor" into the user-agent;
 * web/PWA is everything else.
 */

export type Host = "web" | "electron" | "capacitor";

export function detectHost(): Host {
  if (typeof window === "undefined") return "web";
  if (window.desktop) return "electron";
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Capacitor")
  )
    return "capacitor";
  return "web";
}

export const isNative = () => detectHost() !== "web";

/** Human-readable device label for the offline device identity. Reads the
 * user-agent directly (Android WebViews and Electron both announce themselves
 * there) so no other module sniffs the UA for platform decisions. */
export function deviceLabel(): string {
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

/** Opens the device print dialog. Android has no window.print() in the
 * Capacitor WebView, so it goes through the native PrintManager plugin;
 * everything else uses the browser/Electron print dialog. Prints the current
 * view after the page fonts are ready so the embedded Inter font is typeset,
 * not substituted, in the printed page. */
export async function printPage(name = "Document"): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    // fonts.ready unsupported — print anyway
  }
  if (detectHost() === "capacitor") {
    const { Printer } = await import("@capgo/capacitor-printer");
    await Printer.printWebView({ name });
    return;
  }
  window.print();
}

const TOKEN_KEY = "auth.sessionToken";

/** Reads the persisted native session token, if any. Web/pwa returns null (cookie). */
export async function readNativeToken(): Promise<string | null> {
  const host = detectHost();
  if (host === "electron") {
    try {
      return (await window.desktop?.getToken()) ?? null;
    } catch {
      return null;
    }
  }
  if (host === "capacitor") {
    // Secure storage only — on failure return null (user re-auths) rather
    // than falling back to plaintext Preferences on disk (owner mandate).
    try {
      const { SecureStoragePlugin } =
        await import("capacitor-secure-storage-plugin");
      const { value } = await SecureStoragePlugin.get({ key: TOKEN_KEY });
      return value || null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Persists (or clears) the native session token. No-op on web/pwa. */
export async function writeNativeToken(token: string | null): Promise<void> {
  const host = detectHost();
  if (host === "electron") {
    try {
      await window.desktop?.setToken(token);
    } catch {
      // storage unavailable — session still works via bearer for this call
    }
    return;
  }
  if (host === "capacitor") {
    if (!token) {
      try {
        const { SecureStoragePlugin } =
          await import("capacitor-secure-storage-plugin");
        await SecureStoragePlugin.remove({ key: TOKEN_KEY });
      } catch {
        // nothing persisted anyway
      }
      return;
    }
    // Encrypted storage or nothing — never persist plaintext (owner mandate).
    // The bearer still works for this run in memory; the next
    // launch simply asks again.
    try {
      const { SecureStoragePlugin } =
        await import("capacitor-secure-storage-plugin");
      await SecureStoragePlugin.set({ key: TOKEN_KEY, value: token });
    } catch {
      // Non-fatal: this run keeps the in-memory bearer; the caller's .catch
      // keeps an unguarded rejection out of the console.
    }
  }
}

export type DesktopPlatform = "darwin" | "win32" | "linux";

/** Window-control surface behind the custom title bar. Null on web/PWA and
 * Capacitor — they have no window chrome. Everything touching
 * window.desktop window IPC lives here so no UI file branches on platform. */
export type DesktopWindow = {
  platform: DesktopPlatform;
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
