/**
 * Token derivatives.
 *
 * The web app composes translucent surfaces in CSS (`bg-warning/10`,
 * `border-success/25`). NativeWind cannot apply an alpha modifier to a
 * `var()`-defined color, so the same values are computed once, here, from the
 * generated tokens and handed to the tree as their own variables.
 */
import { darkTheme, lightTheme, type ThemeTokens } from "@/theme/tokens";
import type { Theme } from "@/theme/theme";

/** `rgb(...)` → `rgba(...)`, or an existing `rgba(...)` with its alpha scaled. */
function withAlpha(value: string, alpha: number): string {
  const solid = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (solid) return `rgba(${solid[1]}, ${solid[2]}, ${solid[3]}, ${alpha})`;
  const translucent = value.match(
    /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
  );
  if (translucent) {
    const scaled = Number.parseFloat(translucent[4]) * alpha;
    return `rgba(${translucent[1]}, ${translucent[2]}, ${translucent[3]}, ${scaled})`;
  }
  return value;
}

export function themeTokens(theme: Theme): ThemeTokens {
  return theme === "dark" ? darkTheme : lightTheme;
}

/** The extra variables `--*-soft` / `--*-line` the class vocabulary uses. */
export function derivedTokens(theme: Theme): Record<`--${string}`, string> {
  const tokens = themeTokens(theme);
  const soft = (token: keyof ThemeTokens, alpha = 0.1) =>
    withAlpha(tokens[token], alpha);

  return {
    "--success-soft": soft("--success"),
    "--success-line": soft("--success", 0.25),
    "--warning-soft": soft("--warning"),
    "--warning-line": soft("--warning", 0.25),
    "--destructive-soft": soft("--destructive"),
    "--primary-soft": soft("--primary"),
    "--muted-soft": soft("--foreground", theme === "dark" ? 0.08 : 0.04),
    // Solid `muted` as a veil (web: `bg-muted/60` on capsule clusters).
    "--muted-veil": soft("--muted", 0.6),
    // `border-border/60` on circle buttons.
    "--border-soft": soft("--border", 0.6),
    // Dialog scrim (globals.css: bg-black/40).
    "--overlay": "rgba(0, 0, 0, 0.4)",
  };
}
