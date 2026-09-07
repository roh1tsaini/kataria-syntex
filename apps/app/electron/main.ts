/**
 * Electron main process — kataria syntex biz app desktop shell.
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
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  shell,
} from "electron";
import { join, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readFile, writeFile, unlink, stat } from "node:fs/promises";
import { initUpdater } from "./updater";

// The packaged SPA must not load from file:// — Chromium blocks ES-module
// scripts (CORS, null origin) and CSP 'self' matches nothing there, leaving
// a black window. A privileged custom scheme gives the renderer a real
// origin; the handler in whenReady serves dist/ under app://bundle/*.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const DEV = process.env.KC_DEV === "1" && !app.isPackaged;
// Baked at build time from APP_URL via electron/build.ts (--define
// KC_API_ORIGIN); dev overrides with localhost. A packaged build without the
// define must fail loudly — a placeholder origin would silently dead-end
// every API call.
const API_ORIGIN =
  process.env.KC_API_ORIGIN ?? (DEV ? "http://localhost:3000" : "");
if (!DEV && !API_ORIGIN.startsWith("https://")) {
  throw new Error(
    "KC_API_ORIGIN missing — rebuild the desktop bundle via electron/build.ts",
  );
}

// Runtime paths only — Bun's bundler replaces __dirname with the build
// machine's source directory, which is fiction once the app is installed.
// getAppPath() is resources/app.asar when packaged, apps/app in dev.
const APP_ROOT = app.getAppPath();

/** The single shell window — window-control IPC operates on this. */
let mainWindow: BrowserWindow | null = null;

// One window per installation: a second launch focuses the first instead of
// racing it for the encrypted token file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = mainWindow;
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

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
  // Version gate (server/lib/version-gate.ts): the packaged build always
  // announces itself — app.getVersion() beats anything the renderer claims.
  headers["X-App-Version"] = app.getVersion();
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
  ipcMain.handle("kc:render-pdf", handleRenderPdf);
  // macOS update flow only: hand a published release URL to the OS browser.
  // Locked to the app's own origin so the bridge can never be a general
  // link-opener.
  ipcMain.handle("kc:open-external", (_e, raw: unknown) => {
    if (typeof raw !== "string" || !raw.startsWith(`${API_ORIGIN}/releases/`))
      return;
    void shell.openExternal(raw);
  });
  // Custom title bar (frameless shell): the renderer draws its own controls;
  // macOS keeps native traffic lights and never calls these.
  ipcMain.handle("kc:win:minimize", () => mainWindow?.minimize());
  ipcMain.handle("kc:win:toggle-maximize", () => {
    const win = mainWindow;
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle("kc:win:close", () => mainWindow?.close());
  ipcMain.handle(
    "kc:win:is-maximized",
    () => mainWindow?.isMaximized() ?? false,
  );
}

async function handleDownload(_event: unknown, raw: unknown) {
  if (raw === null || typeof raw !== "object")
    return { status: 0, base64: null };
  const path = (raw as Record<string, unknown>).path;
  if (typeof path !== "string" || !path.startsWith("/"))
    return { status: 0, base64: null };
  const url = `${API_ORIGIN}/api${path}`;
  const headers: Record<string, string> = {
    "X-App-Version": app.getVersion(),
  };
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

/**
 * Renders a self-contained HTML document to PDF with the shell's own Chromium
 * (webContents.printToPDF) — fully offline, no server round-trip. The
 * document is dropped into a temp file, printed, and deleted immediately.
 */
async function handleRenderPdf(_event: unknown, html: unknown) {
  if (
    typeof html !== "string" ||
    !html.startsWith("<!DOCTYPE html>") ||
    html.length > 10_000_000
  )
    return { status: 0, base64: null };
  const file = join(app.getPath("temp"), `kc-challan-${randomUUID()}.html`);
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: false,
    },
  });
  try {
    await writeFile(file, html, "utf8");
    await win.loadFile(file);
    const buf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return { status: 200, base64: buf.toString("base64") };
  } catch {
    return { status: 0, base64: null };
  } finally {
    win.destroy();
    await unlink(file).catch(() => {});
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
    // macOS keeps native traffic lights over the app surface; Windows/Linux
    // hide the system bar entirely — the renderer draws the chrome.
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    webPreferences: {
      preload: join(APP_ROOT, "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  mainWindow = win;
  win.on("maximize", () => win.webContents.send("kc:win:maximized", true));
  win.on("unmaximize", () => win.webContents.send("kc:win:maximized", false));

  // Camera for QR-code scan/approve: Chromium asks the embedder, and with no
  // handler the request is denied — grant `media` only to the app's own
  // origins (packaged app://bundle, Vite dev server). Everything else stays
  // denied, matching the no-handler default. Both handlers are needed for
  // complete permission handling (query + request).
  const mediaOrigins = DEV ? ["http://localhost:1420"] : ["app://bundle/"];
  const allowsMedia = (url: unknown) =>
    typeof url === "string" && mediaOrigins.some((o) => url.startsWith(o));
  win.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      if (permission !== "media") {
        callback(false);
        return;
      }
      const requestingUrl = (details as { requestingUrl?: unknown } | null)
        ?.requestingUrl;
      callback(allowsMedia(requestingUrl));
    },
  );
  win.webContents.session.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin, details) => {
      if (permission !== "media") return false;
      const requestingUrl = (details as { requestingUrl?: unknown } | null)
        ?.requestingUrl;
      return allowsMedia(requestingUrl) || allowsMedia(requestingOrigin);
    },
  );

  // Touchpad pinch / ctrl-wheel must not zoom the UI like a webpage.
  win.webContents.setVisualZoomLevelLimits(1, 1);

  win.once("ready-to-show", () => win.show());

  // External links → OS browser; never navigate the window elsewhere.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const allowed = DEV
      ? "http://localhost:1420"
      : ["app://", API_ORIGIN].some((p) => url.startsWith(p));
    if (!allowed) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (DEV) {
    void win.loadURL("http://localhost:1420");
  } else {
    // Directory root, not index.html — the router treats the URL path as a
    // route, and "/index.html" is not one.
    void win.loadURL("app://bundle/");
  }
}

app.whenReady().then(() => {
  // Packaged Windows/Linux ship no menu bar — the app is the chrome. The
  // default menu's accelerators (Ctrl+R reload wiping form state, devtools)
  // have no place in a production business app; macOS keeps its standard
  // menu because app lifecycle and edit shortcuts live there.
  if (!DEV && process.platform !== "darwin") Menu.setApplicationMenu(null);

  // Serve the packaged renderer: app://bundle/<path> → APP_ROOT/dist/<path>.
  // Host is ignored; only the path matters, and it may not escape dist/.
  // Paths with no file behind them (deep links, reload on /challans, …) fall
  // back to index.html — the SPA router owns every URL, same contract as the
  // web deployment's single-page-application not_found handling.
  const distRoot = join(APP_ROOT, "dist");
  protocol.handle("app", async (request) => {
    const { pathname } = new URL(request.url);
    const rel = pathname.replace(/^\/+/, "") || "index.html";
    const file = join(distRoot, rel);
    if (file !== distRoot && !file.startsWith(distRoot + sep)) {
      return new Response("forbidden", { status: 403 });
    }
    const isFile = await stat(file)
      .then((s) => s.isFile())
      .catch(() => false);
    return net.fetch(
      pathToFileURL(isFile ? file : join(distRoot, "index.html")).toString(),
    );
  });

  registerIpc();
  initUpdater(() => mainWindow);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
