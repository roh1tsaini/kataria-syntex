/**
 * Password hashing via Web Crypto PBKDF2-SHA256 (global crypto on Node).
 * Per-user random salt. Format: pbkdf2$sha256$<iterations>$<salt_b64>$<hash_b64>
 */
const ITERATIONS = 310_000;
const KEY_BITS = 256;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    keyMaterial,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  // Mirrors signupSchema's min 10 — the boundary guard for any future caller.
  if (password.length < 10) throw new Error("password_too_short");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt as Uint8Array<ArrayBuffer>);
  return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256")
    return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;
  const salt = fromBase64(parts[3]);
  const expected = fromBase64(parts[4]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    KEY_BITS,
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/**
 * Verifies against a fixed dummy hash so login for a phone that has NO account
 * still burns the same ~310k-iteration PBKDF2 cost as a real one. Without this,
 * an attacker can tell "no such user" from "wrong password" purely by response
 * timing (real users take ~50-100ms longer), enumerating which phones have
 * accounts. The dummy is generated once at module load.
 */
const DUMMY_PASSWORD_HASH = (() => {
  const salt = Buffer.alloc(16, 0x5a); // fixed, not a secret — just a timing sink
  const dummy = `pbkdf2$sha256$${ITERATIONS}$${salt.toString("base64")}$`;
  return dummy + Buffer.alloc(32, 0xa5).toString("base64");
})();

export async function verifyPasswordOrDummy(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (stored) return verifyPassword(password, stored);
  await verifyPassword(password, DUMMY_PASSWORD_HASH);
  return false;
}
