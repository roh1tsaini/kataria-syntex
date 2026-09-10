/**
 * Desktop auto-update — the main-process half of the update system.
 *
 * Windows/Linux: electron-updater (generic provider) against the Worker's
 *   /releases/app/desktop — checks at launch and every 4h, downloads
 *   silently, applies on quit. Status is pushed to the renderer over the
 *   kc:update:status event; the renderer owns all UI (banner, toast,
 *   Settings row).
 * macOS: unsigned builds cannot self-install, so electron-updater never
 *   starts here. The renderer polls the same published manifest the
 *   /download page reads and offers the dmg download (kc:open-external).
 */
import { app, BrowserWindow, ipcMain } from "electron";
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

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

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

export function initUpdater(getWin: () => BrowserWindow | null): void {
  void getWin;

  ipcMain.handle("kc:update:version", () => app.getVersion());

  // macOS + dev builds: the renderer's manifest check owns updates.
  if (process.platform === "darwin" || !feedConfigured()) {
    ipcMain.handle("kc:update:check", () => ({ kind: "idle" }) as UpdateStatus);
    ipcMain.handle("kc:update:restart", () => {});
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
    // Cloudflare R2 + Workers reject multi-range downloads; fall back to
    // single-range/blockmap-free transfer if the server nags.
    useMultipleRangeRequest: false,
  });

  autoUpdater.on("checking-for-update", () => broadcast({ kind: "checking" }));
  autoUpdater.on("update-available", (info) =>
    broadcast({ kind: "available", version: info.version ?? "" }),
  );
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
  autoUpdater.on("update-downloaded", (info) =>
    broadcast({ kind: "ready", version: info.version ?? "" }),
  );
  autoUpdater.on("error", () => {
    // Background checks fail silently (offline desktops are normal); the
    // renderer surfaces the failure only for its manual Settings check.
    broadcast({ kind: "error", message: "update_check_failed" });
  });

  ipcMain.handle("kc:update:check", async (): Promise<UpdateStatus> => {
    try {
      const res = await autoUpdater.checkForUpdates();
      const v = res?.updateInfo?.version ?? "";
      return compareVersions(v, app.getVersion()) > 0
        ? { kind: "available", version: v }
        : { kind: "not-available" };
    } catch {
      return { kind: "error", message: "update_check_failed" };
    }
  });
  ipcMain.handle("kc:update:restart", () => autoUpdater.quitAndInstall());

  void autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  setInterval(
    () => void autoUpdater.checkForUpdates().catch(() => {}),
    CHECK_INTERVAL_MS,
  );
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}
