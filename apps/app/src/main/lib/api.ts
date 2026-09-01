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
  if (host === "electron")
    return { "X-Platform": "desktop", "X-Device-Label": "Desktop app" };
  if (host === "capacitor")
    return { "X-Platform": "android", "X-Device-Label": "Android app" };
  const fp = deviceFingerprint();
  return fp
    ? { "X-Platform": "web", "X-Device-Fingerprint": fp }
    : { "X-Platform": "web" };
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
