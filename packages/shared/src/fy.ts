/** Indian financial year (Apr 1 – Mar 31) for a UTC date. */
export function fyForDate(date: Date): {
  label: string;
  startsAt: Date;
  endsAt: Date;
} {
  const y = date.getUTCFullYear();
  const startYear = date.getTime() < Date.UTC(y, 3, 1) ? y - 1 : y;
  const startsAt = new Date(Date.UTC(startYear, 3, 1));
  const endsAt = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999));
  return {
    label: `${startYear}-${String(startYear + 1).slice(2)}`,
    startsAt,
    endsAt,
  };
}

/** Indian FY label ("2026-27") for a "YYYY-MM-DD" date string, computed in UTC. */
export function fyLabelForDateString(date: string): string {
  return fyForDate(new Date(`${date}T00:00:00.000Z`)).label;
}

/** Previous FY label ("2026-27" -> "2025-26"). Pure string math, no dates. */
export const fyPrevLabel = (label: string) => {
  const [a, b] = label.split("-").map(Number);
  return `${a - 1}-${b - 1}`;
};
