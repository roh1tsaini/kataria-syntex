/**
 * Shell seam: the one place the business core meets its host.
 *
 * app-core is shared by every shell (web/PWA, Electron desktop, Android).
 * Each shell configures it exactly once at boot with a PlatformAdapter that
 * answers "where am I, where is the bearer token, is the network up, where
 * does state persist". Nothing inside app-core touches window, document,
 * localStorage or navigator — DOM differences are the adapter's problem.
 */

export type Host = "web" | "electron" | "android";

/** Synchronous KV storage for offline caches — localStorage on web,
 * MMKV on Android. Both are synchronous, so the offline engine needs no
 * async hydration and behaves identically everywhere. */
export interface CoreStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

/** Electron's IPC transport (see apps/app/electron/preload.ts). When set,
 * api() routes every call through it instead of fetch. */
export type DesktopTransport = (
  path: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
  },
) => Promise<{ status: number; body: unknown }>;

export interface PlatformAdapter {
  host: Host;
  /** Absolute API origin — "" for same-origin web and the Vite dev proxy. */
  apiBaseUrl: string;
  /** Announced build version, sent as X-App-Version (drives the 426 gate). */
  appVersion: string;
  storage: CoreStorage;
  /** Encrypted bearer-token persistence. Web stores nothing (HttpOnly
   * cookie); Electron uses the OS keychain; Android uses the keystore. */
  readToken(): Promise<string | null>;
  writeToken(token: string | null): Promise<void>;
  /** Human device label for the offline device identity. */
  deviceLabel(): string;
  /** Connectivity change events; returns an unsubscribe function. */
  onNetworkChange(onChange: (online: boolean) => void): () => void;
  /** Absolute ws:// or wss:// origin that hosts /api/realtime. Null (or an
   * adapter that leaves it unset) disables the realtime layer — the app
   * keeps working through its poll-and-sync paths. */
  realtimeOrigin?(): string | null;
  /** Foreground/visibility changes (optional). Realtime reconnects
   * immediately when the shell becomes active. */
  onActivityChange?(onActive: (active: boolean) => void): () => void;
  /** Electron IPC transport — unset on web and Android. */
  transport?: DesktopTransport;
}

let adapter: PlatformAdapter | null = null;

/** Wires the shell seam. Call once at boot, before any core call runs. */
export function configureCore(next: PlatformAdapter): void {
  adapter = next;
}

/** The configured adapter. Throws when a shell forgot to configure. */
export function core(): PlatformAdapter {
  if (!adapter) throw new Error("app-core used before configureCore()");
  return adapter;
}
