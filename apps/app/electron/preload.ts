/**
 * Electron preload — the ONLY bridge between renderer and main.
 *
 * Sandboxed (no Node), exposes via contextBridge:
 * - getToken / setToken: encrypted session token in the OS keychain
 * - api: same-shape fetch that runs in the main process (no CORS)
 * - download: GET a file through the main process, base64 body
 * - renderPdf: HTML → PDF with the shell's own Chromium (printToPDF)
 * - window controls for the custom title bar (minimize / toggle-maximize /
 *   close / maximized state) + host platform
 * Nothing else crosses the boundary.
 */
import { contextBridge, ipcRenderer } from "electron";

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
  download: (path: string): Promise<DesktopDownloadResponse> =>
    ipcRenderer.invoke("kc:download", { path }),
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
};

export type DesktopBridge = typeof desktop;

contextBridge.exposeInMainWorld("desktop", desktop);
