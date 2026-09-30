/**
 * Update-download progress plumbing shared by every shell's update store
 * (Electron's electron-updater, Android's APK downloader). Percent comes straight from the source; the readout pairs
 * it with the total size — nothing transferring, no ETA.
 */

export type UpdateProgress = {
  /** 0–100, rounded by the UI. */
  percent: number;
  /** 0 when the source can't know the size — the UI hides the size then. */
  totalBytes: number;
};
