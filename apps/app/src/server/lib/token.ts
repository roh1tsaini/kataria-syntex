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

/** Constant-time compare of two equal-length ASCII secrets (hex digests). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export function generateOtpCode(): string {
  // Rejection sampling over Uint32 to eliminate modulo bias across 1,000,000 codes.
  // 4_294_000_000 is the largest multiple of 1_000_000 below 2^32.
  const max = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < max) {
      return String(buf[0] % 1_000_000).padStart(6, "0");
    }
  }
}

// Unambiguous uppercase alphabet (no 0/O/1/I/L) — 31 characters.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * QR login codes: 16 chars from a 31-char alphabet ≈ 2^79 search space,
 * making online guessing impossible while staying single-use + 10-min TTL.
 * The QR payload URL never carries the code — it carries the row id — so
 * only someone looking at the waiting device's screen can read the code: the
 * approver types its last 4 characters (or all 16 in the in-app entry form).
 * Rejection sampling over Uint8 eliminates modulo bias (248 is largest multiple of 31 below 256).
 */
export function generateQrLoginCode(): string {
  const max = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  const chars: string[] = [];
  const buf = new Uint8Array(1);
  while (chars.length < 16) {
    crypto.getRandomValues(buf);
    if (buf[0] < max) {
      chars.push(CODE_ALPHABET[buf[0] % CODE_ALPHABET.length]);
    }
  }
  const raw = chars.join("");
  const parts = raw.match(/.{4}/g);
  if (!parts) throw new Error("qr_code_match_failed");
  return parts.join("-");
}

export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Secret half of a QR login. The waiting device keeps this to itself and must
 * present it to claim the session; only its SHA-256 is stored server-side.
 * A captured QR — screenshot, forwarded link, shoulder-surfed photo — carries
 * the request id alone and can prove nothing.
 */
export function generateQrClaimSecret(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
