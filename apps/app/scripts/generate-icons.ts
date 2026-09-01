/**
 * Generates every raster icon from the master SVG (resources/icon.svg):
 * - public/favicon.svg          — copied verbatim
 * - public/pwa-{192,512}.png    — manifest icons
 * - public/pwa-maskable-*.png   — same art shrunk into the maskable safe zone
 * - resources/icon.png          — 1024px source for electron-builder
 * Run: bun run icons
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("resources/icon.svg");

mkdirSync("public", { recursive: true });
mkdirSync("resources", { recursive: true });

writeFileSync("public/favicon.svg", svg);

// Maskable icons need the logo inside the inner 80% safe zone.
function maskableSvg(): string {
  return svg
    .toString("utf8")
    .replace("<svg ", '<svg width="512" height="512" ')
    .replace('viewBox="0 0 512 512"', 'viewBox="-64 -64 640 640"');
}

const jobs: Array<[string, Buffer | string, number]> = [
  ["public/pwa-192.png", svg, 192],
  ["public/pwa-512.png", svg, 512],
  ["public/pwa-maskable-192.png", maskableSvg(), 192],
  ["public/pwa-maskable-512.png", maskableSvg(), 512],
  ["resources/icon.png", svg, 1024],
];

for (const [out, input, size] of jobs) {
  await sharp(Buffer.from(input))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(out);
}
