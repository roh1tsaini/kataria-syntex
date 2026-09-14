/**
 * Build-time guard for the Android web bundle.
 *
 * The WebView serves the bundle from a local https://localhost origin — that
 * origin is NOT the API. When the base URL is empty, every fetch resolves
 * against the bundle origin instead: /api/health answers the SPA shell (or
 * nothing), the client classifies it as a network failure, and the app shows
 * "offline / no internet" on a device with a perfect connection.
 *
 * The boot-time check in platform.ts catches this at runtime; this script
 * catches it one step earlier, so a local `bun run build:apk` fails before an
 * APK exists that can never reach the server.
 *
 * VITE_API_URL is what the app reads (bakedApiOrigin); APP_URL is the CI
 * variable the deploy job exports as VITE_API_URL. Accept either so a local
 * build matches CI's spelling.
 */
const origin = process.env.VITE_API_URL || process.env.APP_URL;

if (!origin || origin.trim() === "") {
  console.error(
    "\nVITE_API_URL is required to build the Android bundle.\n" +
      "The WebView origin is not the API, so an unbaked build shows the app\n" +
      "offline forever no matter how good the connection is.\n\n" +
      "Rebuild with the origin exported, e.g.:\n" +
      "  VITE_API_URL=app.katariasyntex.workers.dev bun run build:apk\n",
  );
  process.exit(1);
}

console.log(`building the Android bundle against ${origin.trim()}`);
