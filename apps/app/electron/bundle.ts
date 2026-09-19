import { build, type BuildConfig } from "bun";

export type ElectronBundleOptions = {
  apiOrigin?: string;
  minify?: boolean;
  sourcemap?: "none" | "inline" | "external";
};

export async function bundleElectron(options: ElectronBundleOptions = {}) {
  const define: Record<string, string> = {};
  if (options.apiOrigin) {
    define["process.env.KC_API_ORIGIN"] = JSON.stringify(options.apiOrigin);
    define["__KC_UPDATE_FEED__"] = JSON.stringify(options.apiOrigin);
  }

  const config: BuildConfig = {
    entrypoints: ["./electron/main.ts", "./electron/preload.ts"],
    outdir: "dist-electron",
    target: "node",
    format: "cjs",
    external: ["electron"],
    naming: "[dir]/[name].cjs",
    minify: options.minify ?? false,
    sourcemap: options.sourcemap ?? "none",
    define,
  };

  const result = await build(config);
  if (!result.success) {
    console.error("Electron bundle failed:");
    for (const log of result.logs) console.error(log);
  }
  return result;
}
