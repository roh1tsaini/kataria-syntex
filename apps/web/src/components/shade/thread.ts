/**
 * Continuous-thread walker for multi-color (space-dyed / melange) yarns.
 *
 * A real multicolor yarn is ONE continuous thread carrying its palette in
 * order along its length: red — blue — green — red — blue — green … So when
 * the thread winds onto a cone (or a shade-card band), each winding row shows
 * the colors as segments ALONG the row, not one solid color per row.
 *
 * `threadRows` models that: it walks a single thread coordinate across the
 * given row widths (one entry per winding row, top to bottom — the thread
 * spirals down, so the coordinate never resets). Segment lengths come from a
 * seeded stream, so narrow rows naturally fit fewer colors and wide rows fit
 * more, while the palette order is always preserved and the layout is stable
 * per shade across reloads and server/client renders.
 */

/** FNV-1a 32-bit — small deterministic string hash for seeding. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG — stable per shade, SSR-safe (no Math.random). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeSeed(seed: string | number): number {
  return typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
}

export interface ThreadSegment {
  /** Segment start within its row, in the caller's units. */
  x0: number;
  /** Segment end within its row. */
  x1: number;
  /**
   * Palette index — advances strictly in order along the thread
   * (occurrence j carries palette[j % paletteLength]).
   */
  colorIndex: number;
}

/**
 * Walk one continuous thread across `rowWidths` (thread consumed per row,
 * top to bottom). Each color occurrence lasts
 * `baseLen * (0.75 + 0.55 * rand)` from the seeded stream, so the
 * randomization is in the segment lengths and the per-row phase — never in
 * the palette order.
 */
export function threadRows(opts: {
  paletteLength: number;
  rowWidths: number[];
  baseLen: number;
  seed: string | number;
}): ThreadSegment[][] {
  const { paletteLength, rowWidths, baseLen, seed } = opts;
  if (paletteLength <= 0 || baseLen <= 0) return rowWidths.map(() => []);

  const rng = mulberry32(normalizeSeed(seed));
  const phase = rng() * baseLen;

  /* Occurrence lengths, generated lazily from the seeded stream. */
  const lengths: number[] = [];
  const lengthAt = (j: number): number => {
    while (lengths.length <= j) {
      lengths.push(baseLen * (0.75 + 0.55 * rng()));
    }
    return lengths[j];
  };

  /* Segment boundaries B[0] = 0 < B[1] < … — extended on demand. */
  const boundaries: number[] = [0];
  const ensure = (s: number): void => {
    while (boundaries[boundaries.length - 1] < s) {
      const j = boundaries.length - 1;
      boundaries.push(boundaries[j] + lengthAt(j));
    }
  };

  let cursor = phase;
  let seg = 0;
  ensure(cursor + 1);
  while (boundaries[seg + 1] <= cursor) seg += 1;

  return rowWidths.map((width) => {
    if (width <= 0) return [];
    const rowStart = cursor;
    const rowEnd = cursor + width;
    cursor = rowEnd;
    ensure(rowEnd + 1);
    while (boundaries[seg + 1] <= rowStart) seg += 1;
    const out: ThreadSegment[] = [];
    let s = seg;
    while (boundaries[s] < rowEnd) {
      out.push({
        x0: Math.max(boundaries[s], rowStart) - rowStart,
        x1: Math.min(boundaries[s + 1], rowEnd) - rowStart,
        colorIndex: s % paletteLength,
      });
      s += 1;
    }
    return out;
  });
}
