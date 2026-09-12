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
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  session,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
} from "electron";
import { join, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readFile, writeFile, unlink, stat } from "node:fs/promises";
import {
  loadDesktopState,
  saveDesktopState,
  trackWindow,
  visibleBounds,
  type DesktopState,
} from "./state";
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

/** Geometry + theme from the last session; onReady() fills it before the
 *  first window is created. */
let initialState: DesktopState = {};

// ── Origin & sender guards ──────────────────────────────────────────────────
// One place decides what counts as "inside the app": navigation, window
// opens, and permission grants all compare parsed origins — never string
// prefixes, where `https://app.example.com.evil.com` starts with
// `https://app.example.com` and would be trusted.

/** Protocol+host equality. `app://bundle/x` and `app://bundle` share an
 *  origin; `…workers.dev.evil.com` does not share one with `…workers.dev`. */
function sameOrigin(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.protocol === y.protocol && x.host === y.host;
  } catch {
    return false;
  }
}

/** The app's own surfaces: the packaged bundle (or the Vite dev server) and
 *  the API origin the release flow hands to the browser. */
function isInternalUrl(raw: string): boolean {
  if (DEV) return sameOrigin(raw, "http://localhost:1420");
  return sameOrigin(raw, "app://bundle") || sameOrigin(raw, API_ORIGIN);
}

/** Links leave the app only over the web — `file:`, `smb:`, UNC paths and
 *  custom schemes must never reach the OS handler. */
function isSafeExternalUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function openExternal(raw: string): void {
  if (isSafeExternalUrl(raw)) void shell.openExternal(raw);
}

/** Only the app's own published release files may be handed to the browser. */
function isReleaseUrl(raw: string): boolean {
  try {
    return (
      sameOrigin(raw, API_ORIGIN) &&
      new URL(raw).pathname.startsWith("/releases/")
    );
  } catch {
    return false;
  }
}

/**
 * IPC is reachable only from the shell window's own top frame — a nested
 * frame (or a stray webContents) must never read the session token, proxy
 * API calls, render PDFs, or drive the window.
 */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return false;
  if (event.sender !== win.webContents) return false;
  const frame = event.senderFrame;
  return frame === null || frame === win.webContents.mainFrame;
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  // A second launch must not race the first for the encrypted token file.
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = mainWindow;
    if (!win) {
      createWindow();
      return;
    }
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app
    .whenReady()
    .then(onReady)
    .catch((error: unknown) => {
      console.error("startup_failed", error);
      app.quit();
    });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // A main-process throw must surface in the logs, not vanish into an
  // invisible unhandled rejection with no window on screen.
  process.on("uncaughtException", (error) => {
    console.error("main_uncaught", error);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("main_unhandled_rejection", reason);
  });
}

const TOKEN_FILE = () => join(app.getPath("userData"), "session.token");

// One in-memory copy is authoritative for this process: the keychain decrypt
// is expensive to run per API call, and the single-instance lock guarantees
// no other process mutates the file behind us.
let tokenCache: { value: string | null } | null = null;

async function readToken(): Promise<string | null> {
  if (tokenCache) return tokenCache.value;
  let value: string | null = null;
  try {
    const raw = await readFile(TOKEN_FILE(), "utf8");
    if (raw) {
      value = safeAvailable()
        ? safeStorageDecrypt(Buffer.from(raw, "base64"))
        : // Encryption unavailable — dev convenience only, never packaged.
          app.isPackaged
          ? null
          : raw;
    }
  } catch {
    value = null;
  }
  tokenCache = { value };
  return value;
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
    tokenCache = { value: null };
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
  tokenCache = { value: token };
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

async function handleApi(raw: unknown) {
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
  const method = req.method ?? "GET";
  try {
    const res = await net.fetch(url, {
      method,
      headers,
      // net.fetch rejects a body on GET/HEAD — forward it only where it
      // belongs instead of letting the request fail as a network error.
      body: method === "GET" || method === "HEAD" ? undefined : req.body,
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

/**
 * Desktop "Save as PDF": the browser's silent download becomes a real save
 * dialog, so the user picks where the file lands and gets it confirmed.
 */
async function handleSaveFile(raw: unknown): Promise<{ saved: boolean }> {
  if (raw === null || typeof raw !== "object") return { saved: false };
  const req = raw as { base64?: unknown; filename?: unknown };
  if (typeof req.base64 !== "string" || typeof req.filename !== "string")
    return { saved: false };
  if (req.base64.length > 24_000_000) return { saved: false };
  // Never let a crafted name escape the directory the user picked.
  const filename = req.filename.replace(/[^\w.-]+/g, "_").slice(0, 120);
  const ext = (filename.split(".").pop() ?? "pdf").toLowerCase();
  const options = {
    defaultPath: join(app.getPath("downloads"), filename),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  };
  const win = mainWindow;
  const { canceled, filePath } =
    win && !win.isDestroyed()
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
  if (canceled || !filePath) return { saved: false };
  await writeFile(filePath, Buffer.from(req.base64, "base64"));
  return { saved: true };
}

function registerIpc(): void {
  ipcMain.handle("kc:get-token", (event) =>
    isTrustedSender(event) ? readToken() : null,
  );
  ipcMain.handle("kc:set-token", (event, token: unknown) => {
    if (!isTrustedSender(event)) return;
    if (token !== null && typeof token !== "string") return;
    return writeToken(token);
  });
  ipcMain.handle("kc:api", (event, raw: unknown) =>
    isTrustedSender(event)
      ? handleApi(raw)
      : { status: 0, body: { error: "invalid_request" } },
  );
  ipcMain.handle("kc:render-pdf", (event, html: unknown) =>
    isTrustedSender(event)
      ? handleRenderPdf(html)
      : { status: 0, base64: null },
  );
  ipcMain.handle("kc:save-file", (event, raw: unknown) =>
    isTrustedSender(event) ? handleSaveFile(raw) : { saved: false },
  );
  // The renderer reports its resolved background so the next launch paints in
  // the user's theme instead of flashing the built-in default.
  ipcMain.handle("kc:theme", (event, background: unknown) => {
    if (!isTrustedSender(event)) return;
    if (typeof background !== "string" || background.length > 40) return;
    saveDesktopState({ backgroundColor: background });
    const win = mainWindow;
    if (!win || win.isDestroyed()) return;
    try {
      win.setBackgroundColor(background);
    } catch {
      // An unexpected color string must not take the window down.
    }
  });
  // macOS update flow only: hand a published release URL to the OS browser.
  // Locked to the app's own origin and /releases/* so the bridge can never be
  // a general link-opener.
  ipcMain.handle("kc:open-external", (event, raw: unknown) => {
    if (!isTrustedSender(event)) return;
    if (typeof raw !== "string" || !isReleaseUrl(raw)) return;
    void shell.openExternal(raw);
  });
  // Custom title bar (frameless shell): the renderer draws its own controls;
  // macOS keeps native traffic lights and never calls these.
  ipcMain.handle("kc:win:minimize", (event) => {
    if (isTrustedSender(event)) mainWindow?.minimize();
  });
  ipcMain.handle("kc:win:toggle-maximize", (event) => {
    if (!isTrustedSender(event)) return false;
    const win = mainWindow;
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle("kc:win:close", (event) => {
    if (isTrustedSender(event)) mainWindow?.close();
  });
  ipcMain.handle("kc:win:is-maximized", (event) =>
    isTrustedSender(event) ? (mainWindow?.isMaximized() ?? false) : false,
  );
}

// The PDF renderer is a throwaway Chromium that loads app-generated HTML. A
// dedicated in-memory session blocks every remote resource it might
// reference — the sheet is self-contained (inlined fonts), so a network fetch
// is a bug or an injection attempt, never a need.
const PDF_PARTITION = "kc-pdf";

function hardenPdfSession(): void {
  session
    .fromPartition(PDF_PARTITION)
    .webRequest.onBeforeRequest((details, callback) => {
      const local =
        details.url.startsWith("file:") ||
        details.url.startsWith("data:") ||
        details.url.startsWith("blob:") ||
        details.url.startsWith("about:");
      callback({ cancel: !local });
    });
}

/**
 * Renders a self-contained HTML document to PDF with the shell's own Chromium
 * (webContents.printToPDF) — fully offline, no server round-trip. The
 * document is dropped into a temp file, printed, and deleted immediately.
 */
async function handleRenderPdf(html: unknown) {
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
      // Throwaway session, not the shell's — see hardenPdfSession().
      partition: PDF_PARTITION,
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
  // Geometry from the last session, but only when it still lands on a
  // connected display.
  const restored = visibleBounds(initialState.bounds);
  const win = new BrowserWindow({
    width: restored?.width ?? 1280,
    height: restored?.height ?? 820,
    ...(restored ? { x: restored.x, y: restored.y } : {}),
    minWidth: 960,
    minHeight: 640,
    show: false,
    // The renderer's own background from last launch — a light-theme user
    // must not get a dark flash while the bundle boots.
    backgroundColor: initialState.backgroundColor ?? "#0a0a0a",
    // macOS keeps native traffic lights over the app surface; Windows/Linux
    // hide the system bar entirely — the renderer draws the chrome.
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    webPreferences: {
      preload: join(APP_ROOT, "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // DevTools is a development tool — a production business app never
      // exposes its internals to whoever walks past the machine.
      devTools: DEV,
    },
  });
  mainWindow = win;
  win.on("maximize", () => win.webContents.send("kc:win:maximized", true));
  win.on("unmaximize", () => win.webContents.send("kc:win:maximized", false));
  // A destroyed window must not linger as `mainWindow` — every window-control
  // IPC and second-instance focus would then throw "Object has been destroyed".
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  trackWindow(win);
  if (initialState.maximized) win.maximize();

  // Camera for QR-code scan/approve: Chromium asks the embedder, and with no
  // handler the request is denied — grant `media` only to the app's own
  // origins (packaged app://bundle, Vite dev server). Everything else stays
  // denied, matching the no-handler default. Both handlers are needed for
  // complete permission handling (query + request).
  const mediaOrigins = DEV ? ["http://localhost:1420"] : ["app://bundle"];
  const allowsMedia = (url: unknown) =>
    typeof url === "string" && mediaOrigins.some((o) => sameOrigin(url, o));
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

  // The UI is an app, not a web page — pinch, ctrl-wheel and the keyboard
  // zoom accelerators must all leave the layout exactly as designed.
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on("zoom-changed", () => win.webContents.setZoomLevel(0));
  win.webContents.on("before-input-event", (event, input) => {
    const mod = process.platform === "darwin" ? input.meta : input.control;
    if (!mod) return;
    if (["+", "=", "-", "_", "0"].includes(input.key)) event.preventDefault();
  });

  win.once("ready-to-show", () => win.show());

  // Desktop grammar: right-click offers the standard editing commands on
  // editable fields and selections — and nothing else gets a menu.
  win.webContents.on("context-menu", (_event, params) => {
    let template: MenuItemConstructorOptions[];
    if (params.isEditable) {
      template = [
        { role: "cut", enabled: params.editFlags.canCut },
        { role: "copy", enabled: params.editFlags.canCopy },
        { role: "paste", enabled: params.editFlags.canPaste },
        { type: "separator" },
        { role: "selectAll" },
      ];
    } else if (params.selectionText) {
      template = [{ role: "copy" }];
    } else {
      return;
    }
    Menu.buildFromTemplate(template).popup({ window: win });
  });

  // External links → OS browser; never navigate the window elsewhere. Only
  // real web URLs leave the app (openExternal rejects file:/smb:/custom
  // schemes), and in-app navigation is limited to the app's own origins.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  // show:false until ready-to-show — a failed load would otherwise leave an
  // invisible, unusable app with no window and no log.
  win.webContents.on(
    "did-fail-load",
    (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame) return;
      console.error("renderer_load_failed", code, description, url);
      win.show();
    },
  );

  if (DEV) {
    void win.loadURL("http://localhost:1420").catch((error: unknown) => {
      console.error("renderer_load_failed", error);
      win.show();
    });
  } else {
    // Directory root, not index.html — the router treats the URL path as a
    // route, and "/index.html" is not one.
    void win.loadURL("app://bundle/").catch((error: unknown) => {
      console.error("renderer_load_failed", error);
      win.show();
    });
  }
}

function installApplicationMenu(): void {
  // Dev keeps the default menu (Reload, DevTools). Packaged Windows/Linux
  // ship no menu bar — the app is the chrome, and the default menu's
  // accelerators (Ctrl+R wiping form state, DevTools) have no place in a
  // production business app.
  if (DEV) return;
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }
  // macOS needs a menu for app lifecycle and the standard Edit accelerators,
  // but the View submenu (Reload, DevTools, page zoom) must never reach
  // production.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "appMenu" },
      { role: "editMenu" },
      { role: "windowMenu" },
    ]),
  );
}

async function onReady(): Promise<void> {
  installApplicationMenu();
  hardenPdfSession();
  // Restore the previous window geometry + theme before the first paint.
  initialState = await loadDesktopState();

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
}
