/**
 * Download/install progress bar — track + fill + a percent/size readout.
 *
 * The readout is percent and total size only. Transferred bytes and ETA were
 * dropped: both change every tick and the browser's own download manager
 * already shows them, while a percent that climbed past 100 on Electron is
 * what surfaced this component.
 *
 * The fill is width + a CSS transition, never a JS animation loop: the update
 * store throttles the samples it pushes and the transition smooths the gap
 * between them, and unlike a rAF loop it keeps advancing when a window is
 * minimized or a WebView goes to the background.
 */
import { formatUpdateProgress } from "@kataria-syntex/shared";
import { cn } from "@/ui/lib/cn";

export function ProgressBar({
  percent,
  totalBytes,
  className,
}: {
  percent: number;
  totalBytes: number;
  className?: string;
}) {
  const known = totalBytes > 0;
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={known ? Math.round(clamped) : undefined}
      >
        {known ? (
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${clamped}%` }}
          />
        ) : (
          // Unknown size — an honest shimmer instead of a bar pinned at 0%.
          <div
            className="absolute inset-y-0 w-2/5 rounded-full bg-primary motion-safe:animate-[shimmer_1.1s_var(--ease-out)_infinite]"
            aria-hidden
          />
        )}
      </div>
      <p className="text-right text-xs tabular-nums text-muted-foreground">
        {known
          ? formatUpdateProgress({ percent: clamped, totalBytes })
          : "Downloading…"}
      </p>
    </div>
  );
}
