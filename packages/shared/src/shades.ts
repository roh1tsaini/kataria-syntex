/**
 * Shade card data, transcribed from the physical RAJ embroidery yarn
 * shade card. Codes and hex values match the printed card pages.
 */
export interface Shade {
  code: string;
  hex: string;
  page: number;
  /**
   * Optional multi-color yarn palette. When present the shade is a melange /
   * space-dyed yarn carrying several colors in one thread; the swatch renders
   * the colors as a wrapped 1,2,3,… sequence. Omitted = a single dyed shade.
   */
  colors?: string[];
}

/**
 * Multi-color (melange / space-dyed) yarns, keyed by shade code. Each entry
 * is the ordered color sequence a single thread carries; the swatch wraps
 * through it (1, 2, 3, …, N, 1, …) across the field.
 */
const multiColors: Record<string, string[]> = {
  "64R": ["#7B1F3A", "#C2185B", "#F48FB1"],
  "69ND": ["#66BB6A", "#AED581", "#C8E6C9"],
  "88LD": ["#880E4F", "#9C27B0", "#7B1FA2", "#4A148C"],
  "95R": ["#FFCDD2", "#FFAB91", "#FF8A65"],
  "102DL": ["#FF8A65", "#FF7043", "#D84315"],
  "110V": ["#BCAAA4", "#A1887F", "#795548"],
};

const pages: Record<number, Array<[string, string]>> = {
  7: [
    ["57", "#FFA500"],
    ["58", "#FFD700"],
    ["59", "#FFEB3B"],
    ["60LL", "#B2EBF2"],
    ["60L", "#80DEEA"],
    ["60", "#4DD0E1"],
    ["61", "#26C6DA"],
    ["62", "#00ACC1"],
    ["63", "#00838F"],
    ["64", "#006064"],
    ["64R", "#7B1F3A"],
    ["60NL", "#F8BBD0"],
    ["60N", "#F48FB1"],
    ["61N", "#EC407A"],
    ["62N", "#009688"],
    ["63N", "#00796B"],
    ["65", "#E91E63"],
    ["66", "#C2185B"],
    ["67", "#00695C"],
    ["68", "#004D40"],
    ["69NL", "#A5D6A7"],
    ["69N", "#81C784"],
    ["69ND", "#66BB6A"],
    ["69LL", "#C8E6C9"],
    ["69L", "#E8F5E9"],
  ],
  8: [
    ["69", "#43A047"],
    ["70", "#388E3C"],
    ["71", "#2E7D32"],
    ["71D", "#1B5E20"],
    ["71B", "#4CAF50"],
    ["72", "#66BB6A"],
    ["72D", "#558B2F"],
    ["73LL", "#AED581"],
    ["73L", "#8BC34A"],
    ["73", "#689F38"],
    ["74", "#33691E"],
    ["75", "#00BFA5"],
    ["76", "#009688"],
    ["76G", "#00897B"],
    ["77", "#00796B"],
    ["77D", "#00695C"],
    ["73N", "#00BCD4"],
    ["74N", "#0097A7"],
    ["75N", "#00838F"],
    ["76N", "#006064"],
    ["78LL", "#B2DFDB"],
    ["78L", "#80CBC4"],
    ["78", "#4DB6AC"],
    ["79", "#26A69A"],
  ],
  9: [
    ["80", "#5D4037"],
    ["81", "#6D4C41"],
    ["82", "#795548"],
    ["82D", "#4E342E"],
    ["83LL", "#BCAAA4"],
    ["83L", "#A1887F"],
    ["83", "#8D6E63"],
    ["84", "#BBDEFB"],
    ["85", "#90CAF9"],
    ["86", "#64B5F6"],
    ["87", "#42A5F5"],
    ["87D", "#1E88E5"],
    ["88S", "#1565C0"],
    ["88LL", "#0D47A1"],
    ["88L", "#283593"],
    ["88", "#1A237E"],
    ["88LD", "#880E4F"],
    ["88D", "#4A148C"],
    ["88DD", "#311B92"],
    ["88NL", "#9C27B0"],
    ["88N", "#7B1FA2"],
    ["88ND", "#6A1B9A"],
    ["89", "#AD1457"],
    ["89D", "#C62828"],
    ["90L", "#D32F2F"],
  ],
  10: [
    ["90", "#8D6E63"],
    ["90D", "#795548"],
    ["90DD", "#6D4C41"],
    ["90NL", "#FFCCBC"],
    ["90N", "#FFAB91"],
    ["90ND", "#FF8A65"],
    ["91LL", "#E1BEE7"],
    ["91L", "#CE93D8"],
    ["91", "#81D4FA"],
    ["92", "#B3E5FC"],
    ["93", "#0277BD"],
    ["94", "#01579B"],
    ["95L", "#FFE0B2"],
    ["95", "#FF6F00"],
    ["95D", "#E65100"],
    ["95R", "#FFCDD2"],
    ["91N", "#F8BBD0"],
    ["92N", "#F48FB1"],
    ["93N", "#546E7A"],
    ["94N", "#455A64"],
    ["95NL", "#FFCC80"],
    ["95N", "#FFB74D"],
    ["95ND", "#FFA726"],
    ["96", "#FF9800"],
    ["96D", "#F57C00"],
  ],
  11: [
    ["96DD", "#EF6C00"],
    ["97T", "#FF7043"],
    ["99T", "#FF5722"],
    ["97LL", "#E57373"],
    ["97L", "#EF5350"],
    ["97", "#F44336"],
    ["98L", "#FFCDD2"],
    ["98", "#EF9A9A"],
    ["98D", "#556B2F"],
    ["99", "#E53935"],
    ["100", "#C62828"],
    ["101N", "#FF7043"],
    ["102N", "#FF5722"],
    ["101", "#D84315"],
    ["102L", "#BF360C"],
    ["102", "#8B4513"],
    ["102DL", "#FF8A65"],
    ["102D", "#6D4C41"],
    ["103LL", "#5D4037"],
    ["103L", "#A1887F"],
    ["103", "#795548"],
    ["103D", "#8D6E63"],
    ["104NL", "#FFAB91"],
    ["104N", "#FF8A65"],
    ["104LL", "#B0BEC5"],
  ],
  12: [
    ["104L", "#D7CCC8"],
    ["104", "#BCAAA4"],
    ["104D", "#A1887F"],
    ["104R", "#8D6E63"],
    ["105R", "#FFB300"],
    ["104B", "#FFA000"],
    ["105B", "#FF8F00"],
    ["105LL", "#FF6F00"],
    ["105L", "#E65100"],
    ["105", "#BF360C"],
    ["105D", "#D84315"],
    ["105NL", "#FFD54F"],
    ["105N", "#FFCA28"],
    ["108L", "#FFC107"],
    ["109", "#FFB300"],
    ["110LL", "#FFA000"],
    ["110L", "#FF8F00"],
    ["110", "#E65100"],
    ["110D", "#BF360C"],
    ["110DD", "#D84315"],
    ["110V", "#BCAAA4"],
    ["110NL", "#A1887F"],
    ["110N", "#8D6E63"],
    ["110ND", "#795548"],
    ["111", "#6D4C41"],
  ],
};

export const shades: Shade[] = Object.entries(pages).flatMap(
  ([page, entries]) =>
    entries.map(([code, hex]) => {
      const colors = multiColors[code];
      return { code, hex, page: Number(page), ...(colors && { colors }) };
    }),
);

export const shadePages = Object.keys(pages)
  .map(Number)
  .sort((a, b) => a - b);

/** Every 6th shade — a dye-heavy, full-spectrum run across the card. */
export function shadeBand(limit: number): Shade[] {
  return shades.filter((_, index) => index % 6 === 0).slice(0, limit);
}

/** Relative luminance — used to pick readable text over a swatch. */
export function isLightShade(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55;
}
