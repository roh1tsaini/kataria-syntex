import { Skeleton } from "@/ui/components/motion";
import { cn } from "@/ui/lib/cn";

/** One column: the Skeleton classes plus an optional td padding override. */
export type SkeletonCol = { skeleton: string; td?: string };

const DEFAULT_TD = (first: boolean, last: boolean) =>
  cn("py-2.5 pr-3", first && "pl-5", last && "pr-5");

/**
 * Shared loading skeleton for the list-page tables. Pages pass their own
 * column shapes; the default cell padding matches the standard list table
 * (leading pad on the first column, trailing pad on the last).
 */
export function TableSkeleton({
  cols,
  rows = 5,
}: {
  cols: SkeletonCol[];
  rows?: number;
}) {
  return (
    <tbody aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border/65 last:border-b-0">
          {cols.map((col, j) => (
            <td
              key={j}
              className={col.td ?? DEFAULT_TD(j === 0, j === cols.length - 1)}
            >
              <Skeleton className={col.skeleton} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/** The "N entries" label shared by the desktop badge and the mobile line. */
export function countLabel(
  n: number,
  singular: string,
  plural: string,
  loading: boolean,
): string {
  if (loading) return "Refreshing…";
  return `${n.toLocaleString("en-IN")} ${n === 1 ? singular : plural}`;
}
