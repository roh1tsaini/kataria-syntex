/**
 * Builds the Electron main + preload bundles with Bun.
 *
 * Cross-platform on purpose — no shell quoting for --define flags. CI sets
 * APP_URL; a packaged build without it fails here rather than shipping the
 * placeholder origin.
 */
import { bundleElectron } from "./bundle";

if (!process.env.APP_URL) {
  console.error(
    "APP_URL is required to build the Electron shell (e.g. APP_URL=app.example.pages.dev)",
  );
  process.exit(1);
}
const apiOrigin = `https://${process.env.APP_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

const built = await bundleElectron({
  apiOrigin,
  minify: true,
  sourcemap: "external",
});
if (!built.success) process.exit(1);

console.log("dist-electron/ built");
