/**
 * Generates src/theme/tokens.ts from the web design tokens.
 *
 * apps/app/src/main/ui/globals.css is the one source of truth for the palette
 * (design.md Section 2). React Native cannot parse oklch(), so every token this
 * app consumes is converted to rgb()/rgba() here — the values stay identical,
 * the notation changes. Run `bun run tokens` after touching globals.css.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "../app/src/main/ui/globals.css");
const OUT = resolve(ROOT, "src/theme/tokens.ts");

/** Tokens the phone app consumes, in globals.css names. */
const EMITTED = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "warning",
  "border",
  "input",
  "ring",
  "qr-ink",
] as const;

/** oklch(L C H) → sRGB, per the CSS Color 4 conversion. */
function oklchToRgb(
  l: number,
  c: number,
  hDeg: number,
): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const lTemp = l + 0.3963377774 * a + 0.2158037573 * b;
  const mTemp = l - 0.1055613458 * a - 0.0638541728 * b;
  const sTemp = l - 0.0894841775 * a - 1.291485548 * b;

  const lms = [lTemp ** 3, mTemp ** 3, sTemp ** 3];

  const linear = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ];

  return linear.map((channel) => {
    const gamma =
      channel <= 0.0031308
        ? 12.92 * channel
        : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, gamma)) * 255);
  }) as [number, number, number];
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  if (raw.endsWith("%")) return Number.parseFloat(raw) / 100;
  return Number.parseFloat(raw);
}

/** Any oklch() value in globals.css → "rgb(r, g, b)" or "rgba(r, g, b, a)". */
function convert(value: string): string {
  const match =
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/.exec(
      value.trim(),
    );
  if (!match) throw new Error(`Unsupported token value: '${value}'`);
  const [, l, c, h, alpha] = match;
  const [r, g, b] = oklchToRgb(
    Number.parseFloat(l),
    Number.parseFloat(c),
    Number.parseFloat(h),
  );
  const a = parseAlpha(alpha);
  return a >= 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
}

/** Collects --name: value declarations per theme, in file order (later wins).
 *  Only top-level blocks count: nested @media overrides (contrast, print) are
 *  conditional variants of the same token, not the base value. */
function readDeclarations(css: string): {
  light: Map<string, string>;
  dark: Map<string, string>;
} {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  const stack: Array<{ selector: string; bodyStart: number }> = [];
  let selector = "";
  let bodyStart = 0;

  const handleBlock = (sel: string, body: string) => {
    const target = sel.includes(".dark")
      ? dark
      : sel.includes(":root")
        ? light
        : null;
    if (!target) return;
    for (const decl of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      target.set(decl[1], decl[2].trim());
    }
  };

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (char === "{") {
      stack.push({ selector: selector.trim(), bodyStart: i + 1 });
      selector = "";
    } else if (char === "}") {
      const block = stack.pop();
      // Only top-level blocks are theme values; nested blocks are media
      // queries (print, contrast) or component rules.
      if (block !== undefined && stack.length === 0) {
        handleBlock(block.selector, css.slice(block.bodyStart, i));
      }
      selector = "";
    } else if (char === ";" && stack.length === 0) {
      selector = "";
    } else {
      selector += char;
    }
  }
  return { light, dark };
}

/** Resolves var(--x) indirections against the theme, then the light theme. */
function resolveValue(
  name: string,
  theme: Map<string, string>,
  light: Map<string, string>,
  seen: Set<string> = new Set(),
): string {
  if (seen.has(name)) throw new Error(`Circular token reference at ${name}`);
  seen.add(name);
  const raw = theme.get(name) ?? light.get(name);
  if (raw === undefined) throw new Error(`Token ${name} is not defined`);
  const reference = /^var\((--[\w-]+)\)$/.exec(raw);
  if (!reference) return raw;
  return resolveValue(reference[1], theme, light, seen);
}

const css = readFileSync(SOURCE, "utf8");
const { light, dark } = readDeclarations(css);

function emitTheme(theme: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of EMITTED) {
    out[`--${name}`] = convert(resolveValue(`--${name}`, theme, light));
  }
  // Translucent capsule surface: color-mix(card 78%, transparent) in the web
  // sheet; web + native both blur behind it (design.md Section 2.7.2).
  const card = out["--card"];
  const [r, g, b] = /rgb\((\d+), (\d+), (\d+)\)/
    .exec(card)!
    .slice(1)
    .map(Number);
  out["--capsule-surface"] = `rgba(${r}, ${g}, ${b}, 0.78)`;
  // Specular edge: the inset top highlight on capsule materials.
  out["--specular"] =
    theme === dark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.55)";
  return out;
}

function serialize(name: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(
    ([key, value]) => `  "${key}": "${value}",`,
  );
  return `export const ${name}: ThemeTokens = {\n${lines.join("\n")}\n};\n`;
}

const header = `/**
 * GENERATED FILE — do not edit.
 *
 * Run \`bun run tokens\` (scripts/generate-tokens.ts): it converts the oklch()
 * tokens in apps/app/src/main/ui/globals.css — the design system's single
 * source of truth — into the rgb()/rgba() strings React Native can resolve.
 */

/** One theme's CSS variables, keyed by their custom-property name. */
export type ThemeTokens = Record<\`--\${string}\`, string>;
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${header}\n${serialize("lightTheme", emitTheme(light))}\n${serialize("darkTheme", emitTheme(dark))}`,
);
console.log(`${OUT.replace(`${ROOT}\\`, "")} written from globals.css`);
