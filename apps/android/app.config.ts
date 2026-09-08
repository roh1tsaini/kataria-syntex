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

export default {
  expo: {
    name: "Kataria Syntex",
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
    ],
    extra: {
      apiBaseUrl: process.env.EXTRA_API_BASE ?? "",
    },
  },
};
