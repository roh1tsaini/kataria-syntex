/**
 * Expo config — the Android app's native identity.
 *
 * Version + versionCode come from apps/app/package.json (the same file the web
 * bundle and the release manifest use), and the https deep-link host is the
 * origin the build bakes as EXPO_PUBLIC_API_URL. Local builds fall back to the
 * deployed origin so the manifest still merges.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExpoConfig } from "expo/config";

declare const __dirname: string;

/* Expo evaluates this file with CommonJS semantics; process.cwd() covers a
   loader that does not define __dirname. */
const projectDir = typeof __dirname === "string" ? __dirname : process.cwd();

/** Release version — apps/app/package.json is the one source of truth. */
function appVersion(): string {
  const raw = readFileSync(resolve(projectDir, "../app/package.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("apps/app/package.json is not an object");
  }
  const version = (parsed as { version?: unknown }).version;
  if (typeof version !== "string" || !version) {
    throw new Error("apps/app/package.json is missing a version");
  }
  return version;
}

/** versionCode = major*1000000 + minor*1000 + patch — every release number
 * stays unique and increasing. */
function versionCodeFor(version: string): number {
  const parts = version.split(".");
  if (parts.length !== 3 || parts.some((p) => !/^(?:0|[1-9][0-9]*)$/.test(p))) {
    throw new Error(`App version must use three numeric parts: '${version}'`);
  }
  const [major, minor, patch] = parts.map((p) => Number.parseInt(p, 10));
  if (minor >= 1000 || patch >= 1000) {
    throw new Error(
      `App minor and patch parts must be below 1000: '${version}'`,
    );
  }
  const code = major * 1_000_000 + minor * 1_000 + patch;
  if (code < 1 || code > 2_100_000_000) {
    throw new Error(
      `Android versionCode must be between 1 and 2100000000: '${version}'`,
    );
  }
  return code;
}

/** Bare FQDN of the deployed app: the host the installer pins downloads to
 * and the host the https deep-link filter claims. */
function appHost(): string {
  const raw =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.APP_URL ??
    "https://app.katariasyntex.workers.dev";
  const host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "");
  if (!host || /[:\s/\\]/.test(host)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL/APP_URL must be a bare hostname (no scheme, port or path). Got: '${raw}'`,
    );
  }
  return host;
}

const version = appVersion();
const host = appHost();

const config: ExpoConfig = {
  name: "Kataria Syntex",
  slug: "kataria-syntex",
  scheme: "kataria",
  version,
  // iOS is out of scope — this app ships for Android (plus the web target
  // used for browser verification).
  platforms: ["android", "web"],
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  android: {
    package: "com.katariasyntex.bizapp",
    versionCode: versionCodeFor(version),
    allowBackup: false,
    permissions: [
      "android.permission.INTERNET",
      "android.permission.CAMERA",
      "android.permission.REQUEST_INSTALL_PACKAGES",
      "android.permission.POST_NOTIFICATIONS",
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#141210",
    },
    intentFilters: [
      {
        // Custom-scheme deep links (kataria://…).
        action: "VIEW",
        autoVerify: false,
        category: ["DEFAULT", "BROWSABLE"],
        data: [{ scheme: "kataria" }],
      },
      {
        // QR-login payloads are https URLs on the release origin:
        // <origin>/login/scan/<code>. Only that path is claimed, so the
        // browser stays the handler for everything else.
        action: "VIEW",
        autoVerify: false,
        category: ["DEFAULT", "BROWSABLE"],
        data: [{ scheme: "https", host, pathPrefix: "/login/scan/" }],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    // The app's own manifest sets allowBackup=false, so secure-store backup
    // rules would be dead manifest weight.
    ["expo-secure-store", { configureAndroidBackup: false }],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0a0a0a",
        image: "./assets/icon.png",
        imageWidth: 144,
        dark: { backgroundColor: "#0a0a0a" },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          // Phone-only: the app ships to real devices, never emulators.
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
        },
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Kataria Syntex uses the camera to scan login QR codes.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#141210",
      },
    ],
    "./plugins/with-android-release",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
