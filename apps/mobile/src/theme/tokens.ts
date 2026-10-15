/**
 * GENERATED FILE — do not edit.
 *
 * Run `bun run tokens` (scripts/generate-tokens.ts): it converts the oklch()
 * tokens in apps/app/src/main/ui/globals.css — the design system's single
 * source of truth — into the rgb()/rgba() strings React Native can resolve.
 */

/** One theme's CSS variables, keyed by their custom-property name. */
export type ThemeTokens = Record<`--${string}`, string>;

export const lightTheme: ThemeTokens = {
  "--background": "rgb(252, 252, 252)",
  "--foreground": "rgb(10, 10, 10)",
  "--card": "rgb(255, 255, 255)",
  "--card-foreground": "rgb(10, 10, 10)",
  "--primary": "rgb(25, 27, 29)",
  "--primary-foreground": "rgb(250, 250, 250)",
  "--secondary": "rgb(245, 245, 245)",
  "--secondary-foreground": "rgb(23, 23, 23)",
  "--muted": "rgb(245, 245, 245)",
  "--muted-foreground": "rgb(115, 115, 115)",
  "--accent": "rgba(25, 27, 29, 0.07)",
  "--accent-foreground": "rgb(48, 51, 55)",
  "--destructive": "rgb(220, 37, 39)",
  "--destructive-foreground": "rgb(252, 252, 252)",
  "--success": "rgb(33, 151, 97)",
  "--warning": "rgb(206, 135, 27)",
  "--border": "rgb(229, 229, 229)",
  "--input": "rgb(229, 229, 229)",
  "--ring": "rgb(25, 27, 29)",
  "--qr-ink": "rgb(10, 10, 10)",
  "--capsule-surface": "rgba(255, 255, 255, 0.78)",
  "--specular": "rgba(255, 255, 255, 0.55)",
};

export const darkTheme: ThemeTokens = {
  "--background": "rgb(10, 10, 10)",
  "--foreground": "rgb(250, 250, 250)",
  "--card": "rgb(23, 23, 23)",
  "--card-foreground": "rgb(250, 250, 250)",
  "--primary": "rgb(232, 232, 232)",
  "--primary-foreground": "rgb(13, 13, 13)",
  "--secondary": "rgb(38, 38, 38)",
  "--secondary-foreground": "rgb(250, 250, 250)",
  "--muted": "rgb(38, 38, 38)",
  "--muted-foreground": "rgb(161, 161, 161)",
  "--accent": "rgba(255, 255, 255, 0.1)",
  "--accent-foreground": "rgb(215, 215, 215)",
  "--destructive": "rgb(255, 100, 103)",
  "--destructive-foreground": "rgb(252, 252, 252)",
  "--success": "rgb(69, 191, 130)",
  "--warning": "rgb(239, 172, 68)",
  "--border": "rgba(255, 255, 255, 0.1)",
  "--input": "rgba(255, 255, 255, 0.14)",
  "--ring": "rgb(232, 232, 232)",
  "--qr-ink": "rgb(10, 10, 10)",
  "--capsule-surface": "rgba(23, 23, 23, 0.78)",
  "--specular": "rgba(255, 255, 255, 0.08)",
};
