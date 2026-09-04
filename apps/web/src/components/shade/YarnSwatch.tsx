import { yarnBackground } from "@/components/shade/woven";
import { cn } from "@/lib/utils";

/**
 * A wound-yarn swatch — the texture plus the physical wrap: rounded
 * corners, a light catch along the top strands, and press-shadow falling
 * into the sides and bottom edge, so the band reads as raised yarn on a
 * card rather than a colored box.
 */
export function YarnSwatch({
  colors,
  rowHeight,
  seed,
  className,
}: {
  colors: string[];
  rowHeight?: number;
  /** Stable per-shade seed (e.g. the shade code) for melange threads. */
  seed?: string | number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("block rounded-chip", className)}
      style={{
        ...yarnBackground(colors, rowHeight, seed),
        boxShadow:
          "inset 0 1px 1px rgb(255 255 255 / 0.2), inset 0 -1px 2px rgb(10 25 40 / 0.28), inset 3px 0 5px -2px rgb(0 0 0 / 0.24), inset -3px 0 5px -2px rgb(0 0 0 / 0.24)",
      }}
    />
  );
}
