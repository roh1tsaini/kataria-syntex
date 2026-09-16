/**
 * Human-readable formatting for update/download progress — one source of
 * truth for every shell (web/PWA banner, blocking dialog, Settings row,
 * Electron toast copy, Android update surfaces).
 *
 * The readout shows percent and total size only — "34% · 38.1 MB". How much
 * has moved and how long is left changes every tick and adds noise a browser
 * download bar already gives the user; on Electron the transferred figure was
 * the one that ran to 1092% against a 100 MB total. Percent is the progress,
 * size is the scale.
 */

export type UpdateProgressReadout = {
  percent: number;
  totalBytes: number;
};

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

/** "38.1 MB", "384 kB", "1.1 GB" — decimal (1000-based) units, like a
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

/** The one-line progress readout: "34% · 38.1 MB".
 * An unknown total drops the size clause instead of guessing. */
export function formatUpdateProgress(p: UpdateProgressReadout): string {
  const parts = [`${Math.round(p.percent)}%`];
  if (p.totalBytes > 0) parts.push(formatBytes(p.totalBytes));
  return parts.join(" · ");
}
