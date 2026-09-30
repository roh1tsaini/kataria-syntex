/**
 * Generates every raster icon from the master SVG (resources/icon.svg):
 * - public/favicon.svg          — copied verbatim
 * - public/apple-touch-icon.png — home-screen/bookmark icon (180px)
 * - resources/icon.png          — 1024px source for electron-builder
 * Run: bun run icons
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("resources/icon.svg");

mkdirSync("public", { recursive: true });
mkdirSync("resources", { recursive: true });

writeFileSync("public/favicon.svg", svg);

const jobs: Array<[string, Buffer | string, number]> = [
  ["public/apple-touch-icon.png", svg, 180],
  ["resources/icon.png", svg, 1024],
];

for (const [out, input, size] of jobs) {
  await sharp(Buffer.from(input))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(out);
}
