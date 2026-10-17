/**
 * Human-readable formatting for update/download progress — one source of
 * truth for every shell (blocking dialog, Settings row,
 * Electron toast copy, Android update surfaces).
 *
 * The readout shows percent and total size only — "34% · 38.1 MB". How much
 * has moved and how long is left changes every tick and adds noise a browser
 * download bar already gives the user; on Electron the transferred figure was
 * the one that ran to 1092% against a 100 MB total. Percent is the progress,
 * size is the scale.
 */

export type UpdateProgress = {
  /** 0–100, rounded by the UI. */
  percent: number;
  /** 0 when the source can't know the size — the readout hides the size then. */
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
export function formatUpdateProgress(p: UpdateProgress): string {
  const parts = [`${Math.round(p.percent)}%`];
  if (p.totalBytes > 0) parts.push(formatBytes(p.totalBytes));
  return parts.join(" · ");
}

const fmtDate = (iso: string) => {
  // Date-only strings ("2026-09-03") parse as UTC midnight — construct the
  // date from its parts so timezones west of UTC don't render the previous
  // day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = dateOnly
    ? new Date(
        Number(iso.slice(0, 4)),
        Number(iso.slice(5, 7)) - 1,
        Number(iso.slice(8, 10)),
      )
    : new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Fresh end of a timestamp: "Active now", "12 min ago", "3 hr ago",
 * "Yesterday". Anything older falls back to fmtDate, so a stale device never
 * reads as a vague "long ago". */
export const fmtRelative = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Unknown";
  const mins = Math.floor((now.getTime() - then) / 60_000);
  if (mins < 1) return "Active now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  if (hrs < 48) return "Yesterday";
  return fmtDate(iso);
};
