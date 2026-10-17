/**
 * Plain names for the three shells. One vocabulary for the client's
 * X-Device-Label header, the server's fallback when a shell sends no label,
 * and the devices list UI — the label stored on a device row and the label
 * rendered next to it can never drift.
 */

export const DEVICE_LABELS = {
  web: "Web browser",
  android: "Android app",
  desktop: "Desktop app",
} as const;

/** Display name for a stored platform token; unknown tokens read as "App". */
export function devicePlatformLabel(platform: string): string {
  return (DEVICE_LABELS as Record<string, string>)[platform] ?? "App";
}
