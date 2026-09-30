/** Shared date helpers for the server — one definition, no per-module copies. */

export function toIso(date: Date): string {
  return date.toISOString();
}

// Accepts both stored forms: "YYYY-MM-DD" and full timestamps.
export function toDate(value: string): Date {
  return value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);
}
