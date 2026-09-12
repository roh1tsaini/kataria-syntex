/**
 * RN theme — the app-core store tree reads colors from here. Two schemes and
 * one neutral accent, exactly the apps/app palette (globals.css values,
 * sRGB-converted by scripts/convert-tokens.ts — never hand-edit).
 */

import { useSyncExternalStore } from "react";
import { ACCENT, TOKENS } from "./tokens";

export type Scheme = "light" | "dark";

export type Palette = {
  scheme: Scheme;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  accentSoft: string;
  accentInk: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  warning: string;
  border: string;
  input: string;
};

// Palettes are cached per scheme — useSyncExternalStore's getSnapshot must
// return a stable reference or React re-renders forever and native crashes
// with "Maximum update depth exceeded" on launch.
const paletteCache = new Map<Scheme, Palette>();

function palette(scheme: Scheme): Palette {
  const cached = paletteCache.get(scheme);
  if (cached) return cached;
  const t = TOKENS[scheme];
  const a = ACCENT[scheme];
  const p: Palette = {
    scheme,
    background: t.background,
    foreground: t.foreground,
    card: t.card,
    cardForeground: t.cardForeground,
    secondary: t.secondary,
    secondaryForeground: t.secondaryForeground,
    muted: t.muted,
    mutedForeground: t.mutedForeground,
    primary: a.strong,
    primaryForeground: a.fg,
    accentSoft: a.soft,
    accentInk: a.ink,
    destructive: t.destructive,
    destructiveForeground: t.destructiveForeground,
    success: t.success,
    warning: t.warning,
    border: t.border,
    input: t.input,
  };
  paletteCache.set(scheme, p);
  return p;
}

/**
 * Applies an alpha channel to a palette color.
 *
 * Tokens are hex in light mode but `rgba()` in dark mode for `border` and
 * `input`, so naive suffix concatenation (`${p.border}a6`) yields the
 * malformed `"rgba(255, 255, 255, 0.1)a6"` and the color silently falls back
 * to black. Always route translucent palette colors through this.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  if (color.startsWith("#")) {
    const hex =
      color.length === 4
        ? color
            .slice(1)
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : color.slice(1, 7);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const rgb = color.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color;
}

/** Overlay scrim behind dialogs and sheets — design.md §3 (40% black). */
export const SCRIM = "rgba(0, 0, 0, 0.4)";

// ── Theme store (useSyncExternalStore — no zustand dependency here) ─────────

type ThemeState = { scheme: Scheme };

let state: ThemeState = { scheme: "light" };
const listeners = new Set<() => void>();

function setTheme(next: Partial<ThemeState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

// Stable module-level functions — useSyncExternalStore re-subscribes whenever
// subscribe/getSnapshot identity changes, and getSnapshot must return a cached
// reference. Inline arrows in usePalette recreated both every render, which
// drove the launch-time "Maximum update depth exceeded" fatal.
function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getThemeSnapshot(): Palette {
  return palette(state.scheme);
}

export const themeStore = {
  get: () => state,
  setScheme: (scheme: Scheme) => setTheme({ scheme }),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** The live palette — subscribes to scheme/accent switches. */
export function usePalette(): Palette {
  return useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeSnapshot,
  );
}
