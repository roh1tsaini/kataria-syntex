/**
 * Human-readable formatting for update/download progress — one source of
 * truth for every shell (web/PWA banner, blocking dialog, Settings row,
 * Electron toast copy, Android update surfaces).
 */

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

/** "12.8 MB", "384 kB", "1.1 GB" — decimal (1000-based) units, like a
 * browser's download manager. Zero/negative/unknown → "0 kB". */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 kB";
  const exp = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1000)),
  );
  const value = bytes / 1000 ** exp;
  const text = value >= 100 ? Math.round(value).toString() : value.toFixed(1);
  return `${text} ${BYTE_UNITS[exp]}`;
}

/** "~45s left", "~4m left", "~1h+ left". Unknown/negative → null so callers
 * drop the clause instead of printing a guess. */
function formatEta(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 10) return "a few seconds left";
  if (seconds < 60) return `~${Math.round(seconds)}s left`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)}m left`;
  return "~1h+ left";
}

export type UpdateProgressReadout = {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
  etaSeconds: number | null;
};

/** The one-line progress readout: "34% · 12.8 of 38.1 MB · ~20s left".
 * Unknown totals / ETAs drop their clause instead of showing a guess. */
export function formatUpdateProgress(p: UpdateProgressReadout): string {
  const parts = [`${Math.round(p.percent)}%`];
  if (p.totalBytes > 0) {
    parts.push(
      `${formatBytes(p.transferredBytes)} of ${formatBytes(p.totalBytes)}`,
    );
  }
  const eta = formatEta(p.etaSeconds);
  if (eta) parts.push(eta);
  return parts.join(" · ");
}
