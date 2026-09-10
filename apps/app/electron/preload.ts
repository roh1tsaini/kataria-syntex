/**
 * Electron preload — the ONLY bridge between renderer and main.
 *
 * Sandboxed (no Node), exposes via contextBridge:
 * - getToken / setToken: encrypted session token in the OS keychain
 * - api: same-shape fetch that runs in the main process (no CORS)
 * - renderPdf: HTML → PDF with the shell's own Chromium (printToPDF)
 * - window controls for the custom title bar (minimize / toggle-maximize /
 *   close / maximized state) + host platform
 * - update bridge: check / status events / quit-and-install / app version
 * Nothing else crosses the boundary.
 */
import { contextBridge, ipcRenderer } from "electron";
import type { UpdateStatus } from "./updater";

export type DesktopApiInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

export type DesktopApiResponse = {
  status: number;
  body: unknown;
};

export type DesktopDownloadResponse = {
  status: number;
  /** Base64 body for 2xx responses, null otherwise. */
  base64: string | null;
};

const desktop = {
  getToken: (): Promise<string | null> => ipcRenderer.invoke("kc:get-token"),
  setToken: (token: string | null): Promise<void> =>
    ipcRenderer.invoke("kc:set-token", token),
  api: (path: string, init?: DesktopApiInit): Promise<DesktopApiResponse> =>
    ipcRenderer.invoke("kc:api", { path, ...(init ?? {}) }),
  renderPdf: (html: string): Promise<DesktopDownloadResponse> =>
    ipcRenderer.invoke("kc:render-pdf", html),
  platform: process.platform as "darwin" | "win32" | "linux",
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke("kc:win:minimize"),
  toggleMaximizeWindow: (): Promise<boolean> =>
    ipcRenderer.invoke("kc:win:toggle-maximize"),
  closeWindow: (): Promise<void> => ipcRenderer.invoke("kc:win:close"),
  isMaximizedWindow: (): Promise<boolean> =>
    ipcRenderer.invoke("kc:win:is-maximized"),
  onMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) =>
      cb(maximized);
    ipcRenderer.on("kc:win:maximized", listener);
    return () => {
      ipcRenderer.removeListener("kc:win:maximized", listener);
    };
  },
  // Update system (see electron/updater.ts): manual check, push status,
  // quit-and-install (Windows/Linux), and the packaged version.
  checkForUpdate: (): Promise<UpdateStatus> =>
    ipcRenderer.invoke("kc:update:check"),
  onUpdateStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, s: UpdateStatus) =>
      cb(s);
    ipcRenderer.on("kc:update:status", listener);
    return () => {
      ipcRenderer.removeListener("kc:update:status", listener);
    };
  },
  restartToUpdate: (): Promise<void> => ipcRenderer.invoke("kc:update:restart"),
  appVersion: (): Promise<string> => ipcRenderer.invoke("kc:update:version"),
  /** /releases/* URLs only (main-validated) — macOS dmg download flow. */
  openReleaseUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke("kc:open-external", url),
};

export type DesktopBridge = typeof desktop;

contextBridge.exposeInMainWorld("desktop", desktop);
