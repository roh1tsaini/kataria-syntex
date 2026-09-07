/**
 * Android self-update transport: stream the published APK into the app's
 * cache (chunked, with progress) and hand the file to the system package
 * installer via the KsInstaller Capacitor plugin (MainActivity-registered;
 * see android/app/src/main/java/.../KsInstallerPlugin.java).
 *
 * Runs only on the Capacitor host — the web shell never downloads an APK,
 * and Electron's updater lives in the main process.
 */
import { registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { detectHost } from "@/lib/platform";
import { API_BASE } from "@/lib/api";
import { useUpdates } from "@/store/updates";
interface KsInstallerPlugin {
  /** Opens the system install prompt for an APK staged under Cache/. */
  installApk(options: { path: string }): Promise<void>;
}

const KsInstaller = registerPlugin<KsInstallerPlugin>("KsInstaller");

/** Cache-relative staging directory; mirrored in res/xml/file_paths.xml. */
const STAGE_DIR = "updates";

export async function downloadAndInstallApk(
  onProgress: (percent: number) => void,
): Promise<boolean> {
  if (detectHost() !== "capacitor") return false;

  const { downloadUrl } = useUpdates.getState();
  if (!downloadUrl) return false;
  const apkUrl = `${API_BASE}${downloadUrl}`;

  const fileName = apkUrl.slice(apkUrl.lastIndexOf("/") + 1) || "update.apk";
  const stagePath = `${STAGE_DIR}/${fileName}`;

  let res: Response;
  try {
    res = await fetch(apkUrl, { signal: AbortSignal.timeout(120_000) });
  } catch {
    return false;
  }
  if (!res.ok || !res.body) return false;

  const total = Number(res.headers.get("Content-Length") ?? 0);
  const reader = res.body.getReader();
  let received = 0;
  let first = true;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (total > 0)
      onProgress(Math.min(99, Math.round((received / total) * 100)));
    const chunk = toBase64(value);
    if (first) {
      first = false;
      await Filesystem.writeFile({
        path: stagePath,
        data: chunk,
        directory: Directory.Cache,
        recursive: true,
      });
    } else {
      await Filesystem.appendFile({
        path: stagePath,
        data: chunk,
        directory: Directory.Cache,
      });
    }
  }
  onProgress(100);

  try {
    await KsInstaller.installApk({ path: stagePath });
    return true;
  } catch {
    return false;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
