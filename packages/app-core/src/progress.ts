/**
 * Update-download progress plumbing shared by every shell's update store
 * (web/PWA service-worker installs, Electron's electron-updater, Android's
 * APK downloader). Percent and bytes come straight from the source; ETA is
 * estimated here so every platform shows the same math.
 */

export type UpdateProgress = {
  /** 0–100, rounded by the UI. */
  percent: number;
  transferredBytes: number;
  /** 0 when the source can't know the size — the UI hides size/ETA then. */
  totalBytes: number;
  etaSeconds: number | null;
};

/** Smoothed bytes/second estimator → ETA. Progress events land at irregular
 * intervals (per file from the service worker, throttled from electron-updater,
 * chunk-level on Android), so speed is an EMA over the samples instead of a
 * single instant — a stalled first sample reads as "unknown", not "∞". */
export function createEtaEstimator(): {
  sample: (transferredBytes: number, totalBytes: number) => number | null;
  reset: () => void;
} {
  let lastTime = 0;
  let lastBytes = 0;
  let speed = 0;

  return {
    reset() {
      lastTime = 0;
      lastBytes = 0;
      speed = 0;
    },
    sample(transferredBytes, totalBytes) {
      if (totalBytes <= 0 || transferredBytes <= 0) return null;
      const now = Date.now();
      if (lastTime === 0) {
        lastTime = now;
        lastBytes = transferredBytes;
        return null;
      }
      const dt = (now - lastTime) / 1000;
      if (dt < 0.25) {
        // Sample arrived too soon after the last one — keep the current
        // estimate instead of letting a burst read as infinite speed.
        return speed > 0
          ? Math.max(0, Math.round((totalBytes - transferredBytes) / speed))
          : null;
      }
      const dBytes = transferredBytes - lastBytes;
      const instant = dBytes >= 0 ? dBytes / dt : 0;
      speed = speed > 0 ? 0.6 * speed + 0.4 * instant : instant;
      lastTime = now;
      lastBytes = transferredBytes;
      const remaining = totalBytes - transferredBytes;
      if (speed <= 0 || remaining <= 0) return null;
      return Math.max(0, Math.round(remaining / speed));
    },
  };
}
