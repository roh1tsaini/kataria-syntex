/**
 * Expo config as code. The Android app is one release train with the rest of
 * the product: `apps/app/package.json` version is the single source, and
 * versionCode uses the same derivation the native build always used
 * (major*10000 + minor*100 + patch) so it keeps increasing monotonically.
 *
 * API base: dev builds point at the machine running `bun run dev:server`
 * (adb reverse tcp:3000 makes localhost work on a device); release builds
 * bake the deployed origin via EXTRA_API_BASE in CI.
 */

import pkg from "../app/package.json";

const [major, minor, patch] = pkg.version.split(".").map(Number);

const releaseApiBase =
  process.env.EXTRA_API_BASE ?? "https://app.katariasyntex.workers.dev";
let releaseHost: string | null = null;
try {
  const url = new URL(releaseApiBase);
  if (url.protocol === "https:") releaseHost = url.hostname;
} catch {
  // Dev builds use the custom `kataria://` scheme; malformed release config
  // must not produce a broken HTTPS intent filter.
}

const httpsQrIntentFilter = releaseHost
  ? {
      action: "VIEW",
      autoVerify: true,
      category: ["BROWSABLE", "DEFAULT"],
      data: [
        {
          scheme: "https",
          host: releaseHost,
          pathPrefix: "/login/scan",
        },
      ],
    }
  : null;

export default {
  expo: {
    name: "Kataria Syntex Biz App",
    slug: "kataria-syntex",
    scheme: "kataria",
    version: pkg.version,
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    platforms: ["android"],
    entryPoint: "expo-router/entry",
    android: {
      package: "com.katariasyntex.bizapp",
      versionCode: major * 10000 + minor * 100 + patch,
      permissions: ["INTERNET", "CAMERA", "REQUEST_INSTALL_PACKAGES"],
      // Transitive plugins (camera, sharing, file-system) otherwise merge
      // these in. The app records no audio, draws no system overlays, and
      // keeps every file in app-private storage — none belong in the manifest.
      blockedPermissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
      ],
      // Offline challans, masters and the company profile are business data —
      // they must not ride Android's cloud/device-transfer backups.
      allowBackup: false,
      intentFilters: httpsQrIntentFilter ? [httpsQrIntentFilter] : [],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-sharing",
      [
        "expo-camera",
        {
          cameraPermission:
            "Camera access scans QR login codes and device approval codes.",
        },
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#fcfcfc",
          image: "./assets/splash-icon.png",
          imageWidth: 160,
        },
      ],
      "./plugins/with-signing.ts",
      "./plugins/with-arm-only.ts",
      "./plugins/with-javac-flags.ts",
    ],
    extra: {
      // CI bakes the deployed origin here (EXTRA_API_BASE). Empty in dev so
      // the adapter's __DEV__ localhost path applies.
      apiBaseUrl: process.env.EXTRA_API_BASE ?? "",
      // The origin a release falls back to when no override was baked — the
      // same one the QR intent filter advertises, so the two never disagree.
      releaseApiBase,
    },
  },
};
