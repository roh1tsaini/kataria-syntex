/**
 * Opaque session tokens + SHA-256 hashing.
 * Only the hash is stored in SQL; the raw token is shown to the client once.
 */

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateOtpCode(): string {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

// Unambiguous uppercase alphabet (no 0/O/1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * QR login codes are never typed by hand — only scanned by another device —
 * so they can be long. 16 chars from a 31-char alphabet ≈ 2^79 search space,
 * making online guessing impossible while staying single-use + 10-min TTL.
 */
export function generateQrLoginCode(): string {
  const buf = crypto.getRandomValues(new Uint8Array(16));
  const raw = Array.from(
    buf,
    (b) => CODE_ALPHABET[b % CODE_ALPHABET.length],
  ).join("");
  const parts = raw.match(/.{4}/g);
  if (!parts) throw new Error("qr_code_match_failed");
  return parts.join("-");
}

export function generateId(): string {
  return crypto.randomUUID();
}
