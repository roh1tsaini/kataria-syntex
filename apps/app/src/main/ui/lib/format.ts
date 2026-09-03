export const fmtBoxes = (n: number) => n.toLocaleString("en-IN");
export const fmtWt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
export const fmtDate = (iso: string) => {
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

/** Today's date in the device timezone as YYYY-MM-DD (never UTC — entries created after midnight IST must not be filed under yesterday). */
export const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
