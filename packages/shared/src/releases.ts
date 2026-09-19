export const RELEASE_CONTENT_TYPES: Record<string, string> = {
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
