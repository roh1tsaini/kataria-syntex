/**
 * Generates the app's raster assets from the one brand source —
 * apps/app/resources/icon.svg, the same mark the web app and desktop ship.
 *
 * Outputs (committed; re-run with `bun run assets` after a brand change):
 * - assets/icon.png               1024px app icon
 * - assets/adaptive-icon.png      Android adaptive foreground (safe zone)
 * - assets/favicon.png            web export favicon
 * - assets/notification-icon.png  white-on-transparent, for Android notifications
 */
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "../app/resources/icon.svg");
const OUT_DIR = resolve(ROOT, "assets");

const svg = readFileSync(SOURCE);

/* Android draws the adaptive foreground inside the central 66% safe zone and
   masks the corners: the mark is re-drawn smaller on transparency. */
const BACKGROUND_RECT =
  '<rect width="512" height="512" rx="112" fill="url(#bg)"/>';
const monochrome = (() => {
  const stripped = svg
    .toString("utf8")
    .replace(BACKGROUND_RECT, "")
    .replaceAll("url(#accent)", "#ffffff");
  if (stripped.includes("url(#bg)") || stripped.includes("url(#accent)")) {
    throw new Error(
      "icon.svg changed shape — update scripts/generate-assets.ts",
    );
  }
  return Buffer.from(stripped, "utf8");
})();

mkdirSync(OUT_DIR, { recursive: true });

await sharp(svg).resize(1024, 1024).png().toFile(resolve(OUT_DIR, "icon.png"));

const safeZone = await sharp(svg).resize(680, 680).png().toBuffer();
await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: safeZone, gravity: "center" }])
  .png()
  .toFile(resolve(OUT_DIR, "adaptive-icon.png"));

await sharp(svg).resize(48, 48).png().toFile(resolve(OUT_DIR, "favicon.png"));

const notif = await sharp(monochrome).resize(64, 64).png().toBuffer();
await sharp({
  create: {
    width: 96,
    height: 96,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: notif, gravity: "center" }])
  .png()
  .toFile(resolve(OUT_DIR, "notification-icon.png"));

console.log("assets/ regenerated from apps/app/resources/icon.svg");
