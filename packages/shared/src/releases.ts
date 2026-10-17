/** CPU-target artifact paths for a platform that ships more than one build
 *  (Windows, Linux; macOS is a single Apple Silicon build). */
export type DesktopArchPaths = {
  x64?: string;
  arm64?: string;
};

/** The app/android/latest.json contract — written by
 *  apps/app/scripts/publish-releases.ts, read by the update checks, Android
 *  staging and the download page. Paths are public /releases/* URLs; a
 *  platform or target appears only when its build was published
 *  (JSON.stringify drops undefined keys), so every reader guards for
 *  absence. */
export type ReleaseManifest = {
  version: string;
  releasedAt: string;
  android?: {
    apk?: string;
    sha256?: string;
    size?: number;
  };
  desktop?: {
    win?: DesktopArchPaths;
    mac?: string;
    linux?: DesktopArchPaths;
  };
};

const RELEASE_CONTENT_TYPES: Record<string, string> = {
  ".apk": "application/vnd.android.package-archive",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".dmg": "application/x-apple-diskimage",
  ".blockmap": "application/octet-stream",
  ".yml": "application/yaml",
  ".json": "application/json",
  ".AppImage": "application/x-executable",
};

export function releaseContentType(key: string): string {
  const dot = key.lastIndexOf(".");
  const ext = dot === -1 ? "" : key.slice(dot).toLowerCase();
  return RELEASE_CONTENT_TYPES[ext] ?? "application/octet-stream";
}
