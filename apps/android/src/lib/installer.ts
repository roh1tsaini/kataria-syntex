/**
 * In-app APK self-update for the Android app.
 *
 * Downloads the release APK from the /releases R2 bucket into app-private
 * storage via expo-file-system, then hands the file to the system package
 * installer (REQUEST_INSTALL_PACKAGES).
 *
 * Same manifest contract as every other shell: /releases/app/android/latest.json
 * published by .github/workflows/app-build.yml.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { compareSemver } from "@kataria-syntex/shared";

export type UpdateManifest = {
  version: string;
  minVersion?: string;
  releasedAt?: string;
  android?: { apk?: string };
  desktop?: { win?: string; mac?: string; linux?: string };
};

export function releasesManifestUrl(apiBase: string): string {
  return `${apiBase}/releases/app/android/latest.json`;
}

export async function fetchManifest(
  apiBase: string,
): Promise<UpdateManifest | null> {
  try {
    const res = await fetch(releasesManifestUrl(apiBase), {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object") return null;
    const rec = body as Record<string, unknown>;
    if (typeof rec.version !== "string") return null;
    return body as UpdateManifest;
  } catch {
    return null;
  }
}

/** True when the published version is newer than the running build. */
export function isNewer(manifest: UpdateManifest, running: string): boolean {
  return compareSemver(manifest.version, running) > 0;
}

function artifactUrl(apiBase: string, manifest: UpdateManifest): string | null {
  const apk = manifest.android?.apk;
  if (typeof apk !== "string" || !apk.startsWith("/releases/")) return null;
  return `${apiBase}${apk}`;
}

/**
 * Streams the APK to the app's private cache, then hands the file to the
 * system installer. onPercent reports 0–100. Throws on any failure — the
 * update store maps that to status "error".
 */
export async function downloadAndInstallApk(
  apiBase: string,
  onPercent: (percent: number) => void,
): Promise<void> {
  const manifest = await fetchManifest(apiBase);
  if (!manifest) throw new Error("manifest_unavailable");
  const url = artifactUrl(apiBase, manifest);
  if (!url) throw new Error("artifact_missing");

  const target = `${FileSystem.documentDirectory}updates/ks-biz-app.apk`;
  await FileSystem.makeDirectoryAsync(
    `${FileSystem.documentDirectory}updates`,
    { intermediates: true },
  ).catch(() => {});

  // Download in the background session type so large APKs survive
  // app switches. /releases is public by design (install links work in any
  // browser), so no Authorization header is needed.
  const res = await FileSystem.downloadAsync(url, target);
  onPercent(100);

  if (Platform.OS !== "android") throw new Error("android_only");

  // Hand the APK to the system package installer. expo-sharing's
  // SYSTEM_DIALOG destination registers the file through FileProvider and
  // offers the package installer (the file is application/vnd.android.package-archive).
  await Sharing.shareAsync(res.uri, {
    mimeType: "application/vnd.android.package-archive",
    dialogTitle: "Install update",
    UTI: "com.android.package.archive",
  });
}

/** Deletes a staged APK after an install attempt or on cleanup. */
export async function clearStagedApk(): Promise<void> {
  await FileSystem.deleteAsync(
    `${FileSystem.documentDirectory}updates/ks-biz-app.apk`,
    { idempotent: true },
  );
}
