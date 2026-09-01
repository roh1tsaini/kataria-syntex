/**
 * Electron main process — kataria challan desktop shell.
 *
 * Security posture (Electron best practices):
 * - contextIsolation always on, nodeIntegration off, sandboxed preload
 * - renderer talks ONLY to the tiny `window.desktop` bridge (see preload.ts)
 * - session tokens live encrypted in the OS keychain via safeStorage,
 *   never in localStorage and never exposed to the renderer in plaintext
 *   beyond the single round-trip over IPC
 * - API calls happen here (net.fetch): no renderer CORS, one place for
 *   credentials handling
 * - external links open in the OS browser; in-window navigation away from
 *   the app is blocked
 */
import { app, BrowserWindow, ipcMain, net, safeStorage, shell } from "electron";
import { join } from "node:path";
import { readFile, writeFile, unlink } from "node:fs/promises";

const DEV = process.env.KC_DEV === "1";
// Baked at build time (electron/build.ts) from APP_URL / defaults to the
// placeholder that CI rewrites; dev overrides with KC_API_ORIGIN.
const API_ORIGIN =
  process.env.KC_API_ORIGIN ??
  (DEV ? "http://localhost:3000" : "https://CHANGE_ME_APP_ORIGIN");

const TOKEN_FILE = () => join(app.getPath("userData"), "session.token");

async function readToken(): Promise<string | null> {
  try {
    const raw = await readFile(TOKEN_FILE(), "utf8");
    if (!raw) return null;
    if (safeAvailable()) return safeStorageDecrypt(Buffer.from(raw, "base64"));
    // Encryption unavailable — dev convenience only, never in packaged builds.
    return app.isPackaged ? null : raw;
  } catch {
    return null;
  }
}

function safeAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

function safeStorageDecrypt(buf: Buffer): string | null {
  try {
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

async function writeToken(token: string | null): Promise<void> {
  const file = TOKEN_FILE();
  if (!token) {
    await unlink(file).catch(() => {});
    return;
  }
  const payload = safeAvailable()
    ? safeStorage.encryptString(token).toString("base64")
    : // Encryption unavailable — plaintext outside packaged builds only.
      app.isPackaged
      ? null
      : token;
  if (payload === null)
    throw new Error("safeStorage unavailable in packaged build");
  await writeFile(file, payload, "utf8");
}

type ApiRequest = {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function parseApiRequest(raw: unknown): ApiRequest | null {
  if (raw === null || typeof raw !== "object") return null;
  const req = raw as Record<string, unknown>;
  if (typeof req.path !== "string" || !req.path.startsWith("/")) return null;
  const method =
    req.method === undefined ? "GET" : String(req.method).toUpperCase();
  if (!ALLOWED_METHODS.has(method)) return null;
  const headers: Record<string, string> = {};
  if (req.headers !== null && typeof req.headers === "object") {
    for (const [key, value] of Object.entries(
      req.headers as Record<string, unknown>,
    )) {
      if (typeof value === "string") headers[key] = value;
    }
  }
  const body = typeof req.body === "string" ? req.body : undefined;
  const timeoutMs =
    typeof req.timeoutMs === "number" && req.timeoutMs > 0
      ? Math.min(req.timeoutMs, 120_000)
      : 30_000;
  return { path: req.path, method, headers, body, timeoutMs };
}

async function handleApi(_event: unknown, raw: unknown) {
  const req = parseApiRequest(raw);
  if (!req) return { status: 0, body: { error: "invalid_request" } };
  const url = `${API_ORIGIN}/api${req.path}`;
  const headers: Record<string, string> = { ...req.headers };
  const token = await readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 30_000);
  try {
    const res = await net.fetch(url, {
      method: req.method ?? "GET",
      headers,
      body: req.body,
      signal: ctrl.signal,
    });
    let body: unknown = null;
    if (res.status !== 204) {
      try {
        body = await res.json();
      } catch {
        // Non-JSON 2xx (captive portal, truncated body) — the renderer
        // classifies a null body on a success status as a network error.
        body = null;
      }
    }
    return { status: res.status, body };
  } catch {
    return { status: 0, body: { error: "network_error" } };
  } finally {
    clearTimeout(timer);
  }
}

function registerIpc(): void {
  ipcMain.handle("kc:get-token", () => readToken());
  ipcMain.handle("kc:set-token", (_e, token: string | null) =>
    writeToken(token),
  );
  ipcMain.handle("kc:api", handleApi);
  ipcMain.handle("kc:download", handleDownload);
}

async function handleDownload(_event: unknown, raw: unknown) {
  if (raw === null || typeof raw !== "object")
    return { status: 0, base64: null };
  const path = (raw as Record<string, unknown>).path;
  if (typeof path !== "string" || !path.startsWith("/"))
    return { status: 0, base64: null };
  const url = `${API_ORIGIN}/api${path}`;
  const headers: Record<string, string> = {};
  const token = await readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await net.fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) return { status: res.status, base64: null };
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, base64: buf.toString("base64") };
  } catch {
    return { status: 0, base64: null };
  } finally {
    clearTimeout(timer);
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#0a0a0a",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // External links → OS browser; never navigate the window elsewhere.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const allowed = DEV
      ? "http://localhost:1420"
      : ["file://", API_ORIGIN].some((p) => url.startsWith(p));
    if (!allowed) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (DEV) {
    void win.loadURL("http://localhost:1420");
  } else {
    void win.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
