/** Indian FY label ("2026-27") for a UTC date. Apr 1 – Mar 31. */
export function fyLabelForDate(date: Date): string {
  const y = date.getUTCFullYear();
  const startYear = date.getTime() < Date.UTC(y, 3, 1) ? y - 1 : y;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/** Indian FY label for a "YYYY-MM-DD" date string, computed in UTC. */
export function fyLabelForDateString(date: string): string {
  return fyLabelForDate(new Date(`${date}T00:00:00.000Z`));
}

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
