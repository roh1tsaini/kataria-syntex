export type NumberingType = {
  prefix: string;
  suffix: string;
  minDigits: number;
};

export type NumberingConfig = {
  sales: NumberingType;
  outward: NumberingType;
  packing_s: NumberingType;
  packing_j: NumberingType;
  raw: NumberingType;
};

export const DEFAULT_NUMBERING: NumberingConfig = {
  sales: { prefix: "CH/", suffix: "", minDigits: 3 },
  outward: { prefix: "JW/", suffix: "", minDigits: 3 },
  packing_s: { prefix: "PKG/S/", suffix: "", minDigits: 3 },
  packing_j: { prefix: "PKG/J/", suffix: "", minDigits: 3 },
  raw: { prefix: "RM/", suffix: "", minDigits: 3 },
};

/** App store name for the numbering config. */
export type Numbering = NumberingConfig;

/**
 * Formats a challan number: prefix + padded seq + suffix / FY short.
 * e.g. 7 + CH/ + 3 + "2026-27" → "CH/007/27"
 * Shared single source — server and offline both import from here.
 */
export function formatChallanNumber(
  config: NumberingConfig,
  type: "sales" | "outward",
  seq: number,
  fyLabel: string,
): string {
  const { prefix, suffix, minDigits } = config[type];
  const fyShort = fyLabel.includes("-") ? fyLabel.split("-")[1] : fyLabel;
  return `${prefix}${String(seq).padStart(minDigits, "0")}${suffix}/${fyShort}`;
}

/**
 * Formats a packing or raw material number: prefix + padded seq + suffix.
 * No FY suffix (counter resets per FY, but number has no year in it).
 * e.g. 7 + PKG/S/ + 3 → "PKG/S/007"
 */
export function formatEntryNumber(
  config: NumberingConfig,
  type: "packing_s" | "packing_j" | "raw",
  seq: number,
): string {
  const { prefix, suffix, minDigits } = config[type];
  return `${prefix}${String(seq).padStart(minDigits, "0")}${suffix}`;
}

/**
 * Unified client formatter — covers sales/outward (with FY) and
 * packing/raw (without). Delegates to the two formatters above.
 */
export function formatNumberForType(
  numbering: Numbering,
  type: "sales" | "outward" | "packing_s" | "packing_j" | "raw",
  seq: number,
  fyLabel: string,
): string {
  if (type === "sales" || type === "outward") {
    return formatChallanNumber(numbering, type, seq, fyLabel);
  }
  return formatEntryNumber(numbering, type, seq);
}

/**
 * Best-effort inverse of formatChallanNumber: extracts the numeric seq
 * from a number string using the current numbering config.
 * Returns null when the shape doesn't match.
 */
export function parseSeqFromNumber(
  numbering: Numbering,
  type: "sales" | "outward",
  challanNumber: string,
  fyLabel: string,
): number | null {
  const { prefix, suffix, minDigits } = numbering[type];
  const tail = `/${fyLabel.split("-")[1] ?? fyLabel}`;
  let s = challanNumber;
  if (!s.startsWith(prefix)) return null;
  s = s.slice(prefix.length);
  const stem = suffix + tail;
  if (!s.endsWith(stem)) return null;
  s = s.slice(0, -stem.length);
  if (!/^\d+$/.test(s) || s.length < minDigits) return null;
  return Number.parseInt(s, 10);
}
