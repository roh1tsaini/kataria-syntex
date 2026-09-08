/**
 * Generates the Expo raster assets from apps/app's master SVG (the single
 * icon source for every platform):
 * - assets/icon.png           — 1024px app icon
 * - assets/adaptive-icon.png  — Android adaptive foreground
 * - assets/splash-icon.png    — splash logo
 * Run: bun scripts/generate-assets.ts
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(resolve(here, "../../app/resources/icon.svg"));

for (const [out, size] of [
  ["../assets/icon.png", 1024],
  ["../assets/adaptive-icon.png", 1024],
  ["../assets/splash-icon.png", 512],
] as const) {
  await sharp(svg)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(here, out));
  console.log(out);
}
