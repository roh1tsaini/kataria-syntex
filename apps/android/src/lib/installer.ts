/**
 * In-app APK self-update for the Android app.
 *
 * Downloads the release APK from the /releases R2 bucket into app-private
 * storage via expo-file-system, then hands the file to the system package
 * installer (REQUEST_INSTALL_PACKAGES).
 *
 * Same manifest contract as every other shell: /releases/app/android/latest.json
 * published by .github/workflows/pipeline.yml.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";
import { compareSemver } from "@kataria-syntex/shared";

const ANDROID_PACKAGE = "com.katariasyntex.bizapp";

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

/** Live download progress — bytes on the wire and the APK's total size
 * (0 until Content-Length arrives). */
export type ApkProgress = { bytes: number; total: number };

/**
 * Streams the APK to the app's private cache, then hands the file to the
 * system installer. onProgress fires as chunks land (bytes/total). Throws on
 * any failure — the update store maps that to status "error".
 */
export async function downloadAndInstallApk(
  apiBase: string,
  onProgress: (progress: ApkProgress) => void,
): Promise<void> {
  if (Platform.OS !== "android") throw new Error("android_only");
  if (!apiBase) throw new Error("manifest_unavailable");
  const manifest = await fetchManifest(apiBase);
  if (!manifest) throw new Error("manifest_unavailable");
  const url = artifactUrl(apiBase, manifest);
  if (!url) throw new Error("artifact_missing");

  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) throw new Error("storage_unavailable");
  const target = `${baseDir}updates/ks-biz-app.apk`;
  await FileSystem.makeDirectoryAsync(`${baseDir}updates`, {
    intermediates: true,
  });

  // Resumable session (instead of downloadAsync) so the store gets live
  // byte progress for the update dialog's size/percent/ETA readout.
  // /releases is public by design (install links work in any browser), so
  // no Authorization header is needed.
  const download = FileSystem.createDownloadResumable(url, target, {}, (p) => {
    onProgress({
      bytes: p.totalBytesWritten,
      total: p.totalBytesExpectedToWrite,
    });
  });
  const res = await download.downloadAsync();
  if (!res) throw new Error("download_failed");

  // Hand the APK to the system package installer via a VIEW intent on the
  // FileProvider content URI. Sharing is only the fallback — its sheet does
  // not invoke the installer reliably.
  const contentUri = await FileSystem.getContentUriAsync(res.uri);
  try {
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: 1,
      type: "application/vnd.android.package-archive",
    });
  } catch {
    // Android 8+ blocks installs until the user grants this app the special
    // "install unknown apps" app-op. Send them to the exact system page;
    // after allowing it, pressing Update again retries the staged APK.
    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.MANAGE_UNKNOWN_APP_SOURCES",
        { data: `package:${ANDROID_PACKAGE}` },
      );
      throw new Error("install_permission_required");
    } catch (settingsError) {
      if (
        settingsError instanceof Error &&
        settingsError.message === "install_permission_required"
      ) {
        throw settingsError;
      }
      await Sharing.shareAsync(res.uri, {
        mimeType: "application/vnd.android.package-archive",
        dialogTitle: "Install update",
        UTI: "com.android.package.archive",
      });
    }
  }
}

/** Deletes a staged APK after an install attempt or on cleanup. */
export async function clearStagedApk(): Promise<void> {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) return;
  await FileSystem.deleteAsync(`${baseDir}updates/ks-biz-app.apk`, {
    idempotent: true,
  });
}
