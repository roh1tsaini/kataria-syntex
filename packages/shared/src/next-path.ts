/** Post-sign-in destination carried in `?next=` (or the equivalent route param
 *  on the phone). Only same-origin absolute paths are accepted — a
 *  protocol-relative (`//evil.test`) or absolute URL would bounce a fresh
 *  session off-site. */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/** Login code from a scanned QR payload. The payload is the approve-page URL
 *  (<origin>/login/scan/<code>), so the code is its last path segment; a bare
 *  code is accepted too. Returns the upper-cased code, or null for anything
 *  under 4 characters. */
export function parseQrScanCode(data: string): string | null {
  const fromUrl = data.match(/\/login\/scan\/([^/?#\s]+)/);
  const raw = (
    fromUrl ? decodeURIComponent(fromUrl[1]) : data.trim()
  ).toUpperCase();
  return raw.length >= 4 ? raw : null;
}
