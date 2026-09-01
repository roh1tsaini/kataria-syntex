import type { CSSProperties } from "react";

/**
 * Wound-yarn swatch texture — the physical shade card, translated to CSS.
 *
 * A shade renders as strands of dyed yarn wound edge to edge: every row is
 * shaded like a cylinder lit from above (highlight on the crown, body in the
 * middle, and a press-shadow where the strand is squeezed against the next
 * one), then finished with a fine ply twist and a fiber-grain overlay so the
 * field reads as thread, not paint. Multi-color (melange) yarns cycle their
 * palette one strand at a time — the way the physical card wraps a single
 * thread that carries several colors.
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

export function yarnBackground(colors: string[], rowHeight = 9): CSSProperties {
  const list = colors.length ? colors : ["#ffffff"];

  // One strand of cylinder shading per row. Single-color shades cycle
  // through 8 jittered rows so the repeat is organic; multi-color yarns
  // already vary by wrapping their palette 1, 2, 3, … N.
  const rows =
    list.length === 1
      ? ROW_JITTER.map((jitter) => ({ color: list[0], jitter }))
      : list.map((color, i) => ({
          color,
          jitter: ROW_JITTER[i % ROW_JITTER.length] * 0.6,
        }));

  const stops: string[] = [];
  rows.forEach(({ color, jitter }, row) => {
    const at = (fraction: number) =>
      `${(row * rowHeight + fraction * rowHeight).toFixed(2)}px`;
    stops.push(
      `${shift(color, 0.3 + jitter)} ${at(0)}`,
      `${shift(color, 0.22 + jitter)} ${at(0.1)}`,
      `${shift(color, jitter)} ${at(0.36)}`,
      `${shift(color, -0.1 + jitter)} ${at(0.62)}`,
      `${shift(color, -0.26 + jitter)} ${at(0.85)}`,
      `${shift(color, -0.38 + jitter)} ${at(1)}`,
    );
  });
  const strands = `repeating-linear-gradient(180deg, ${stops.join(", ")})`;

  return {
    backgroundColor: list[0],
    backgroundImage: `${GRAIN}, ${DRIFT}, ${TWIST}, ${strands}`,
    backgroundBlendMode: "overlay, normal, normal, normal",
  };
}
