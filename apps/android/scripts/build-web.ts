/**
 * Builds the apps/app bundle for the Android shell.
 *
 * The WebView serves the bundle from https://localhost, which is not the
 * API: without a baked absolute origin every fetch resolves against the
 * bundle origin instead — /api/health answers the SPA shell, the client
 * classifies it as a network failure, and the app reads "offline / no
 * internet" on a device with a perfect connection. platform.ts throws at
 * boot if the origin is missing; this script fails the build first, so no
 * unbaked APK can ever exist.
 *
 * VITE_API_URL is what the bundle reads (bakedApiOrigin); APP_URL is the CI
 * variable the android job exports as VITE_API_URL. Either is accepted, and
 * a bare FQDN is upgraded to https — a scheme-less value would build
 * relative fetch URLs. The vite build runs through this script instead of a
 * shell line so the origin is injected via node's env (not bash-only
 * VAR=value syntax), which keeps a local Windows build identical to CI.
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const raw = (process.env.VITE_API_URL ?? process.env.APP_URL ?? "").trim();

if (!raw) {
  console.error(
    "\nVITE_API_URL is required to build the Android bundle.\n" +
      "The WebView origin is not the API, so an unbaked build shows the app\n" +
      "offline forever no matter how good the connection is.\n\n" +
      "Set VITE_API_URL to the app origin in your environment (a bare FQDN\n" +
      "is fine — it is normalized to https), then run: bun run build:apk\n",
  );
  process.exit(1);
}

const origin = `https://${raw.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
console.log(`building the Android bundle against ${origin}`);

// process.execPath is this bun executable; "x" resolves vite from apps/app.
const child = spawn(process.execPath, ["x", "vite", "build"], {
  cwd: resolve(import.meta.dirname, "../../app"),
  env: { ...process.env, VITE_API_URL: origin },
  stdio: "inherit",
});

// A failure to spawn (ENOENT, no bun on PATH) never emits "exit" — without
// this the parent would hang instead of failing the build.
child.on("error", (err) => {
  console.error("\nFailed to start the vite build:", err.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
