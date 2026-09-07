/**
 * Browser-side API client.
 * Base URL: same-origin `/api` by default (Vite dev proxies to the local
 * server; production web + native builds are served same-origin). Native
 * builds can override with `VITE_API_URL` pointing at the deployed backend.
 */

import { detectHost, readNativeToken, isNative } from "@/lib/platform";
import { randomId } from "@/lib/offline/core";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    /** Parsed JSON body of the error response, when present. */
    public readonly data?: unknown,
  ) {
    super(code);
  }

  /**
   * True when the request never reached the app server — offline, or a proxy
   * reporting a dead upstream (502/504). Drives the offline fallbacks (queue
   * challan, render PDF locally).
   */
  get isNetworkError(): boolean {
    return (
      this.code === "network_error" ||
      this.status === 502 ||
      this.status === 504
    );
  }
}

/**
 * Late-bound hook so a 426 update_required raises the blocking update dialog
 * without a circular import (store/updates imports API_BASE from this module).
 * Set once from store/updates.ts.
 */
let onUpdateRequired: ((minVersion: string) => void) | null = null;
export function setUpdateRequiredHandler(
  fn: (minVersion: string) => void,
): void {
  onUpdateRequired = fn;
}

/** Extracts the force-update floor from a 426 body and raises the dialog. */
function raiseUpdateRequired(data: unknown): void {
  if (!onUpdateRequired) return;
  const min =
    data !== null && typeof data === "object" && "minVersion" in data
      ? (data as { minVersion: unknown }).minVersion
      : undefined;
  if (typeof min === "string" && min) onUpdateRequired(min);
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";
export { API_BASE };
const FINGERPRINT_KEY = "auth.deviceFingerprint";

/**
 * A stable per-browser installation id, persisted in localStorage. Sent on
 * every request so the server can give each physical machine its own device
 * row (otherwise every web login reuses one "Web browser" device and revoking
 * it kills every browser's session at once).
 */
function deviceFingerprint(): string | null {
  try {
    let fp = localStorage.getItem(FINGERPRINT_KEY);
    if (!fp) {
      fp = randomId();
      localStorage.setItem(FINGERPRINT_KEY, fp);
    }
    return fp;
  } catch {
    return null;
  }
}

export function deviceHeaders(): Record<string, string> {
  const host = detectHost();
  // Version gate: every client announces its build (electron/main.ts
  // overrides with the packaged app.getVersion() for the desktop shell).
  const version = { "X-App-Version": __APP_VERSION__ };
  if (host === "electron")
    return {
      ...version,
      "X-Platform": "desktop",
      "X-Device-Label": "Desktop app",
    };
  if (host === "capacitor")
    return {
      ...version,
      "X-Platform": "android",
      "X-Device-Label": "Android app",
    };
  const fp = deviceFingerprint();
  return fp
    ? { ...version, "X-Platform": "web", "X-Device-Fingerprint": fp }
    : { ...version, "X-Platform": "web" };
}

/** Network-level failure (server unreachable) → ApiError(0, "network_error"). */
function networkError(): ApiError {
  return new ApiError(0, "network_error");
}

/**
 * One classifier for both transports — Electron's IPC bridge and web fetch
 * must agree on what counts as success, an API error, or a network failure.
 */
function classify<T>(status: number, body: unknown): T {
  if (status < 200 || status >= 300) {
    let code = `http_${status}`;
    if (body !== null && typeof body === "object" && "error" in body) {
      const err = (body as { error: unknown }).error;
      if (typeof err === "string" && err) code = err;
    }
    if (status === 426 || code === "update_required") raiseUpdateRequired(body);
    throw new ApiError(status, code, body);
  }
  if (status === 204 || body === undefined) return undefined as T;
  // A 2xx with an empty/HTML body (captive portal, truncated response) must
  // classify as a network error so callers queue/retry instead of crashing
  // or poisoning the sync queue with permanent "rejected" rows.
  if (body === null) throw networkError();
  return body as T;
}

export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const { method = "GET", body, token, timeoutMs = 30_000 } = options;

  // Electron routes API calls through the main-process net.fetch bridge —
  // no renderer CORS, no cookie flags, no Node in the renderer. The main
  // process attaches the keychain token itself, so skip the read here.
  if (detectHost() === "electron" && window.desktop) {
    let res: { status: number; body: unknown };
    try {
      res = await window.desktop.api(path, {
        method,
        headers: deviceHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        timeoutMs,
      });
    } catch {
      throw networkError();
    }
    return classify<T>(res.status, res.body);
  }

  // Native apps authenticate via the persisted Bearer token; web uses the
  // HttpOnly cookie. An explicit `token` always wins.
  const resolvedToken = token ?? (await readNativeToken());
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      // On native hosts there is no cookie — omit credentials so the browser
      // never tries to send cross-origin cookie flags.
      credentials: isNative() ? "omit" : "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
        ...deviceHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw networkError();
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  let resBody: unknown;
  try {
    resBody = await res.json();
  } catch {
    // Unparseable body: on a 2xx that's a captive portal / truncated
    // response — classify as a network error so callers queue and retry
    // instead of poisoning the sync queue. On an error status it's just a
    // non-JSON error body; classify keeps the http_ fallback code.
    if (res.ok) throw networkError();
    return classify<T>(res.status, undefined);
  }
  return classify<T>(res.status, resBody);
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Binary-download variant of the fetch transport — same auth and error-code
 * rules as `api()`, but the body is raw bytes (used for PDFs).
 */
async function apiBlob(path: string): Promise<Blob> {
  const resolvedToken = await readNativeToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      credentials: isNative() ? "omit" : "include",
      headers: {
        ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
        ...deviceHeaders(),
      },
    });
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    let code = res.status === 429 ? "rate_limited" : "pdf_render_failed";
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") code = body.error;
    } catch {
      // non-JSON error body — keep the status-derived code
    }
    throw new ApiError(res.status, code);
  }
  return res.blob();
}

/**
 * Challan PDF for every host — the one place that branches on where it runs.
 * Electron renders the caller's HTML with its own Chromium over the IPC
 * bridge (fully offline); web/PWA and Capacitor fetch the server-rendered
 * copy (Browser Run). `localHtml` is only awaited on the Electron path.
 */
export async function challanPdf(
  challanId: string,
  localHtml: () => Promise<string>,
): Promise<{ blob: Blob; via: "local" | "server" }> {
  if (detectHost() === "electron" && window.desktop) {
    let res: { status: number; base64: string | null };
    try {
      res = await window.desktop.renderPdf(await localHtml());
    } catch {
      throw networkError();
    }
    if (res.status !== 200 || !res.base64)
      throw new ApiError(res.status || 500, "pdf_render_failed");
    return { blob: base64ToBlob(res.base64, "application/pdf"), via: "local" };
  }
  return { blob: await apiBlob(`/challans/${challanId}/pdf`), via: "server" };
}
