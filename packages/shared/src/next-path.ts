/** Post-sign-in destination carried in `?next=` (or the equivalent route param
 *  on the phone). Only same-origin absolute paths are accepted — a
 *  protocol-relative (`//evil.test`) or absolute URL would bounce a fresh
 *  session off-site. */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/** QR-login request id from a scanned QR payload. The payload is the
 *  approve-page URL (<origin>/login/scan/<id>), so the id is its last path
 *  segment; a bare id is accepted too. Case is preserved — the id is an
 *  opaque server-issued value, not a typed code. Returns null unless the
 *  value has the shape of an id. */
export function parseQrScanId(data: string): string | null {
  const fromUrl = data.match(/\/login\/scan\/([^/?#\s]+)/);
  const raw = fromUrl ? decodeURIComponent(fromUrl[1]) : data.trim();
  return raw.length >= 8 && raw.length <= 64 ? raw : null;
}
