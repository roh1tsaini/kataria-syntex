/**
 * Builds the Electron main + preload bundles with Bun.
 *
 * Cross-platform on purpose — no shell quoting for --define flags. CI sets
 * APP_URL; a packaged build without it fails here rather than shipping the
 * placeholder origin.
 */
import { build } from "bun";

if (!process.env.APP_URL) {
  console.error(
    "APP_URL is required to build the Electron shell (e.g. APP_URL=app.example.pages.dev)",
  );
  process.exit(1);
}
const apiOrigin = `https://${process.env.APP_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

const common = {
  target: "node" as const,
  format: "cjs" as const,
  external: ["electron"],
  minify: true,
  sourcemap: "external" as const,
  define: {
    "process.env.KC_API_ORIGIN": JSON.stringify(apiOrigin),
    // Same origin, used by the updater for /releases/* (see updater.ts).
    __KC_UPDATE_FEED__: JSON.stringify(apiOrigin),
  },
};

for (const entry of ["main", "preload"]) {
  const result = await build({
    ...common,
    entrypoints: [`./electron/${entry}.ts`],
    outdir: "dist-electron",
    naming: "[dir]/[name].[ext]",
  });
  if (!result.success) {
    console.error(`electron/${entry}.ts build failed`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
}
console.log("dist-electron/ built");
