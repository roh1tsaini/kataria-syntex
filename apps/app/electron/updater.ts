/**
 * Desktop auto-update — the main-process half of the update system.
 *
 * Windows/Linux: electron-updater (generic provider) against the Worker's
 *   /releases/app/desktop. The renderer owns one check schedule; this module
 *   coalesces overlapping IPC requests, downloads silently, and applies on
 *   quit. Status is pushed to the renderer over kc:update:status.
 * macOS: unsigned builds cannot self-install, so electron-updater never
 *   starts here. The renderer checks the shared release info and offers the
 *   manual DMG download (kc:open-external).
 */
import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { autoUpdater } from "electron-updater";

// Baked at build time by electron/build.ts alongside KC_API_ORIGIN —
// the deployed Worker that serves /releases/*.
declare const __KC_UPDATE_FEED__: string;

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; version: string }
  | { kind: "not-available" }
  | {
      kind: "downloading";
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
    }
  | { kind: "ready"; version: string }
  | { kind: "error"; message: string };

/** True once update-downloaded fires for the current staging. The renderer
 *  only asks for a restart when its own state says "ready" (same event), so
 *  this is the second half of that handshake: a restart with nothing staged
 *  would just quit into the same old build, so it is ignored instead. */
let staged = false;

/** True when the packaged feed exists (KC_UPDATE_FEED baked). Dev builds
 * and misconfigured bundles stay idle instead of spamming errors. */
function feedConfigured(): boolean {
  return typeof __KC_UPDATE_FEED__ === "string" && __KC_UPDATE_FEED__ !== "";
}

function broadcast(status: UpdateStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("kc:update:status", status);
  }
}

export function initUpdater(
  isTrusted: (event: IpcMainInvokeEvent) => boolean,
): void {
  ipcMain.handle("kc:update:version", (event) =>
    isTrusted(event) ? app.getVersion() : "",
  );

  // macOS + dev builds: the renderer's manifest check owns updates.
  // Idle is the only answer on this path, trusted or not.
  if (process.platform === "darwin" || !feedConfigured()) {
    ipcMain.handle("kc:update:check", () => ({ kind: "idle" }) as UpdateStatus);
    ipcMain.handle("kc:update:restart", (event) => {
      if (!isTrusted(event)) return;
    });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Channel files live per-OS in the bucket (latest.yml → win/,
  // latest-linux.yml → linux/), matching the published layout.
  autoUpdater.setFeedURL({
    provider: "generic",
    url:
      process.platform === "win32"
        ? `${__KC_UPDATE_FEED__}/releases/app/desktop/win`
        : `${__KC_UPDATE_FEED__}/releases/app/desktop/linux`,
    // The Worker serves single byte ranges (206 + Content-Range); multiple
    // ranges per request aren't supported, and one slice at a time is all the
    // blockmap diff needs.
    useMultipleRangeRequest: false,
  });

  autoUpdater.on("checking-for-update", () => broadcast({ kind: "checking" }));
  autoUpdater.on("update-available", (info) => {
    // A newer build supersedes whatever was staged — the old installer must
    // not be what a restart applies.
    staged = false;
    broadcast({ kind: "available", version: info.version ?? "" });
  });
  autoUpdater.on("update-not-available", () =>
    broadcast({ kind: "not-available" }),
  );
  autoUpdater.on("download-progress", (progress) =>
    broadcast({
      kind: "downloading",
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    staged = true;
    broadcast({ kind: "ready", version: info.version ?? "" });
  });
  autoUpdater.on("error", () => {
    broadcast({ kind: "error", message: "update_check_failed" });
  });

  let checkInFlight: Promise<UpdateStatus> | null = null;
  ipcMain.handle("kc:update:check", (event): Promise<UpdateStatus> => {
    if (!isTrusted(event)) return Promise.resolve({ kind: "idle" });
    if (checkInFlight) return checkInFlight;
    const flight = (async (): Promise<UpdateStatus> => {
      try {
        const res = await autoUpdater.checkForUpdates();
        const version = res?.updateInfo?.version ?? "";
        return compareVersions(version, app.getVersion()) > 0
          ? { kind: "available", version }
          : { kind: "not-available" };
      } catch {
        return { kind: "error", message: "update_check_failed" };
      }
    })();
    checkInFlight = flight;
    void flight.then(
      () => {
        if (checkInFlight === flight) checkInFlight = null;
      },
      () => {
        if (checkInFlight === flight) checkInFlight = null;
      },
    );
    return flight;
  });
  ipcMain.handle("kc:update:restart", (event) => {
    if (!isTrusted(event)) return;
    // Restart only into a staged build. Without this a restart raced with a
    // failed or superseded download just quits into the same old build —
    // on a force-update floor that reads as "the update button closed my
    // app and changed nothing".
    if (staged) autoUpdater.quitAndInstall();
  });
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}
