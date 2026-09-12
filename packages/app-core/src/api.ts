/**
 * Shell-agnostic API client.
 * Transport: the adapter's Electron IPC bridge when present, plain fetch
 * everywhere else (web uses the HttpOnly cookie; Android sends the persisted
 * Bearer token). Auth and error-code rules are identical on every shell.
 */

import { core } from "./adapter";
import { randomId } from "./offline/core";

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
 * without a circular import (the updates store wires it at boot).
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

/** Absolute API origin — "" means same-origin (web dev proxy). */
export function apiOrigin(): string {
  return core().apiBaseUrl;
}

const FINGERPRINT_KEY = "auth.deviceFingerprint";

/**
 * A stable per-browser installation id, persisted in adapter storage. Sent
 * on every web request so the server can give each physical machine its own
 * device row (otherwise every web login reuses one "Web browser" device and
 * revoking it kills every browser's session at once).
 */
function deviceFingerprint(): string | null {
  try {
    let fp = core().storage.get(FINGERPRINT_KEY);
    if (!fp) {
      fp = randomId();
      core().storage.set(FINGERPRINT_KEY, fp);
    }
    return fp;
  } catch {
    return null;
  }
}

const CLIENT_ID_KEY = "realtime.clientId";

/**
 * Stable install id for realtime echo suppression: the server stamps each
 * broadcast with the writer's client id, and a client skips events it
 * caused itself. Same persistence pattern as the device fingerprint. Null
 * when storage is unavailable — the caller then omits the header entirely
 * (a shared sentinel id would wrongly suppress echoes between unrelated
 * storage-less clients).
 */
export function clientId(): string | null {
  try {
    let id = core().storage.get(CLIENT_ID_KEY);
    if (!id) {
      id = randomId();
      core().storage.set(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function deviceHeaders(): Record<string, string> {
  const a = core();
  // Version gate: every client announces its build (the Electron main process
  // overrides with the packaged app.getVersion() for the desktop shell).
  const cid = clientId();
  const version: Record<string, string> = { "X-App-Version": a.appVersion };
  if (cid) version["X-Client-Id"] = cid;
  if (a.host === "electron")
    return {
      ...version,
      "X-Platform": "desktop",
      "X-Device-Label": "Desktop app",
    };
  if (a.host === "android")
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
 * One classifier for both transports — Electron's IPC bridge and fetch
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
  const a = core();

  // Electron routes API calls through the main-process net.fetch bridge —
  // no renderer CORS, no cookie flags, no Node in the renderer. The main
  // process attaches the keychain token itself, so skip the read here.
  if (a.transport) {
    let res: { status: number; body: unknown };
    try {
      res = await a.transport(path, {
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

  // The Android app authenticates via the persisted Bearer token; web uses
  // the HttpOnly cookie. An explicit `token` always wins.
  const resolvedToken = token ?? (await a.readToken());
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${a.apiBaseUrl}/api${path}`, {
      method,
      // Non-web hosts have no cookie — omit credentials so the client never
      // tries to send cross-origin cookie flags.
      credentials: a.host === "web" ? "include" : "omit",
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

/**
 * Binary-download variant of the fetch transport — same auth and error-code
 * rules as `api()`, but the body is raw bytes (used for PDFs). Web/desktop
 * only; the Android app downloads files through its own native transport.
 */
export async function apiBlob(
  path: string,
  options: { timeoutMs?: number } = {},
): Promise<Blob> {
  const { timeoutMs = 30_000 } = options;
  const a = core();
  const resolvedToken = await a.readToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${a.apiBaseUrl}/api${path}`, {
      credentials: a.host === "web" ? "include" : "omit",
      headers: {
        ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
        ...deviceHeaders(),
      },
      signal: ctrl.signal,
    });
  } catch {
    throw networkError();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let code = res.status === 429 ? "rate_limited" : "pdf_render_failed";
    let data: unknown;
    try {
      data = (await res.json()) as { error?: unknown };
      if (
        data !== null &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
      ) {
        code = (data as { error: string }).error;
      }
    } catch {
      // non-JSON error body — keep the status-derived code
    }
    if (res.status === 426 || code === "update_required")
      raiseUpdateRequired(data);
    throw new ApiError(res.status, code);
  }
  return res.blob();
}
