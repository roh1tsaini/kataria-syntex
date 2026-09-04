import type { CSSProperties } from "react";
import { threadRows } from "@/components/shade/thread";

/**
 * Wound-yarn swatch texture — the physical shade card, translated to CSS.
 *
 * A shade renders as strands of dyed yarn wound edge to edge: every row is
 * shaded like a cylinder lit from above (highlight on the crown, body in the
 * middle, and a press-shadow where the strand is squeezed against the next
 * one), then finished with a fine ply twist and a fiber-grain overlay so the
 * field reads as thread, not paint. Multi-color (melange) yarn is one
 * continuous thread carrying its palette in order along its length, so each
 * row is split into color segments along the row (thread.ts) — the same
 * thread the cone winds, seeded stable per shade.
 */

/** Shared fiber-grain tile: desaturated fractal noise, blended as overlay. */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)' opacity='0.55'/%3E%3C/svg%3E")`;

/** Ply twist — fine near-horizontal hairlines where the plies spiral. */
const TWIST =
  "repeating-linear-gradient(171deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 3px, rgba(255,255,255,0) 4px, rgba(255,255,255,0) 7px)";

/**
 * Long-period luminance drift, so rows don't repeat with machine-perfect
 * regularity the way paint would — real wound yarn catches light unevenly.
 */
const DRIFT =
  "repeating-linear-gradient(178deg, rgba(255,255,255,0.05) 0px, rgba(0,0,0,0) 30px, rgba(0,0,0,0.05) 64px, rgba(0,0,0,0) 92px, rgba(255,255,255,0.05) 120px)";

function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return [128, 128, 128];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function toRgb(r: number, g: number, b: number): string {
  const clamped = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return `rgb(${clamped(r)} ${clamped(g)} ${clamped(b)})`;
}

/** amount > 0 lightens toward white, amount < 0 darkens toward black. */
function shift(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toRgb(
    r + (target - r) * t,
    g + (target - g) * t,
    b + (target - b) * t,
  );
}

/**
 * Per-strand luminance jitter, cycling every 8 rows. Real wound yarn never
 * repeats with machine regularity — each strand catches the light slightly
 * differently. Deterministic, so server and client render identically.
 */
const ROW_JITTER = [0.05, -0.03, 0.015, -0.055, 0.03, -0.02, 0.04, -0.015];

/** Cylinder profile within one strand: crown highlight → pressed groove. */
const PROFILE: Array<[number, number]> = [
  [0, 0.3],
  [0.1, 0.22],
  [0.36, 0],
  [0.62, -0.1],
  [0.85, -0.26],
  [1, -0.38],
];

/* Melange thread tile — bigger than any swatch instance, so it paints
   edge to edge without repeating mid-swatch. */
const TILE_W = 240;
const TILE_ROWS = 28;

export function yarnBackground(
  colors: string[],
  rowHeight = 9,
  seed?: string | number,
): CSSProperties {
  const list = colors.length ? colors : ["#ffffff"];

  // Single-color shades: one strand of baked cylinder shading per row,
  // cycling through 8 jittered rows so the repeat is organic.
  if (list.length === 1) {
    const rows = ROW_JITTER.map((jitter) => ({ color: list[0], jitter }));

    const stops: string[] = [];
    rows.forEach(({ color, jitter }, row) => {
      const at = (fraction: number) =>
        `${(row * rowHeight + fraction * rowHeight).toFixed(2)}px`;
      PROFILE.forEach(([fraction, amount]) => {
        stops.push(`${shift(color, amount + jitter)} ${at(fraction)}`);
      });
    });
    const strands = `repeating-linear-gradient(180deg, ${stops.join(", ")})`;

    return {
      backgroundColor: list[0],
      backgroundImage: `${GRAIN}, ${DRIFT}, ${TWIST}, ${strands}`,
      backgroundBlendMode: "overlay, normal, normal, normal",
    };
  }

  // Melange: one continuous thread walked across every row (thread.ts) —
  // palette-ordered segments along the row, seeded stable per shade. Flat
  // hues go in the tile; the cylinder shading rides on top as white/black
  // light so it works over varying colors.
  const rows = threadRows({
    paletteLength: list.length,
    rowWidths: Array.from({ length: TILE_ROWS }, () => TILE_W),
    baseLen: 6 * rowHeight,
    seed: seed ?? list.join("|"),
  });
  const tileH = TILE_ROWS * rowHeight;
  const rects: string[] = [];
  rows.forEach((segments, row) => {
    const y = (row * rowHeight).toFixed(2);
    const h = (rowHeight + 0.5).toFixed(2);
    segments.forEach((segment) => {
      rects.push(
        `<rect x='${segment.x0.toFixed(2)}' y='${y}' width='${(segment.x1 - segment.x0 + 0.5).toFixed(2)}' height='${h}' fill='${list[segment.colorIndex % list.length]}'/>`,
      );
    });
  });
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_W}' height='${tileH.toFixed(2)}'>` +
    `${rects.join("")}</svg>`;
  const tile = `url("data:image/svg+xml,${svg
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/#/g, "%23")}")`;

  // Strand shading overlay — the same profile + damped jitter the cone
  // uses, as repeating white/black light over the flat thread colors.
  const shadeStops: string[] = [];
  for (let row = 0; row < ROW_JITTER.length; row += 1) {
    const jitter = ROW_JITTER[row] * 0.6;
    PROFILE.forEach(([fraction, amount]) => {
      const v = amount + jitter;
      const light = v >= 0 ? "255 255 255" : "0 0 0";
      shadeStops.push(
        `rgb(${light} / ${Math.abs(v).toFixed(3)}) ${(row * rowHeight + fraction * rowHeight).toFixed(2)}px`,
      );
    });
  }
  const shading = `repeating-linear-gradient(180deg, ${shadeStops.join(", ")})`;

  return {
    backgroundColor: list[0],
    backgroundImage: `${GRAIN}, ${DRIFT}, ${TWIST}, ${shading}, ${tile}`,
    backgroundBlendMode: "overlay, normal, normal, normal, normal",
    backgroundRepeat: "repeat, repeat, repeat, repeat, no-repeat",
  };
}
