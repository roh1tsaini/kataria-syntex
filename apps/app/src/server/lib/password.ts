import setupWasm, {
  type Argon2idParams,
  type computeHash,
} from "argon2id/lib/setup.js";
import wasmSIMD from "argon2id/dist/simd.wasm";
import wasmNonSIMD from "argon2id/dist/no-simd.wasm";

/** The recipe for NEW hashes; verification reads each hash's own label. */
const MEMORY_KIB = 19_456;
const PASSES = 2;
const PARALLELISM = 1;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const MIN_PASSWORD_LENGTH = 10;

// Corruption guards for settings read out of a stored hash. Only
// hashPassword writes hashes, so real values sit at or below the current
// recipe; anything above these bounds is a hand-edited or corrupt row and
// must never be handed to the wasm hasher.
const MAX_MEMORY_KIB = 65_536;
const MAX_PASSES = 16;
const MAX_PARALLELISM = 4;

type HashSettings = {
  memoryKib: number;
  passes: number;
  parallelism: number;
};

const CURRENT_RECIPE: HashSettings = {
  memoryKib: MEMORY_KIB,
  passes: PASSES,
  parallelism: PARALLELISM,
};

let computeHashPromise: Promise<computeHash> | undefined;

function loadInstance(module: WebAssembly.Module) {
  return async (imports: WebAssembly.Imports) => {
    const instance = await WebAssembly.instantiate(module, imports);
    return { module, instance };
  };
}

function getComputeHash(): Promise<computeHash> {
  computeHashPromise ??= setupWasm(
    loadInstance(wasmSIMD),
    loadInstance(wasmNonSIMD),
  );
  return computeHashPromise;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, "");
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeHash(salt: Uint8Array, digest: Uint8Array): string {
  return `$argon2id$v=19$m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}$${encodeBase64(salt)}$${encodeBase64(digest)}`;
}

type StoredHash = {
  salt: Uint8Array<ArrayBuffer>;
  digest: Uint8Array<ArrayBuffer>;
  settings: HashSettings;
};

/**
 * Reads the label every stored hash carries (algorithm version and the exact
 * settings it was written with). Verification uses these, never the current
 * constants — a recipe change must not strand stored passwords.
 */
function decodeHash(stored: string): StoredHash | null {
  const match =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
      stored,
    );
  if (!match) return null;
  const settings: HashSettings = {
    memoryKib: Number(match[1]),
    passes: Number(match[2]),
    parallelism: Number(match[3]),
  };
  if (
    !Number.isSafeInteger(settings.memoryKib) ||
    settings.memoryKib > MAX_MEMORY_KIB ||
    !Number.isSafeInteger(settings.passes) ||
    settings.passes < 1 ||
    settings.passes > MAX_PASSES ||
    !Number.isSafeInteger(settings.parallelism) ||
    settings.parallelism < 1 ||
    settings.parallelism > MAX_PARALLELISM ||
    // The wasm hasher rejects memory < 8 × lanes; keep such labels out.
    settings.memoryKib < 8 * settings.parallelism
  )
    return null;
  try {
    const salt = decodeBase64(match[4]);
    const digest = decodeBase64(match[5]);
    return salt.length === SALT_BYTES && digest.length === HASH_BYTES
      ? { salt, digest, settings }
      : null;
  } catch {
    return null;
  }
}

async function deriveHash(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  settings: HashSettings,
): Promise<Uint8Array> {
  const hash = await getComputeHash();
  const params: Argon2idParams = {
    password: new TextEncoder().encode(password),
    salt,
    parallelism: settings.parallelism,
    passes: settings.passes,
    memorySize: settings.memoryKib,
    tagLength: HASH_BYTES,
  };
  return hash(params);
}

/** Writes a hash with the current recipe. */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new Error("password_too_short");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return encodeHash(salt, await deriveHash(password, salt, CURRENT_RECIPE));
}

/** True when the stored value is a hash this module can verify. */
export function isUsablePasswordHash(stored: string): boolean {
  return decodeHash(stored) !== null;
}

/** Salts the cost-burn path so "nothing to verify" takes the same time as a
 *  real verification — response timing must not tell accounts apart. */
const DUMMY_SALT = new Uint8Array(SALT_BYTES).fill(0x5a);

type PasswordCheck = {
  ok: boolean;
  /** The stored hash matched but predates the current recipe — the caller
   *  rewrites it after a successful login. */
  needsRehash: boolean;
};

/**
 * Verifies against the settings written inside the stored hash, or burns an
 * equivalent hash when there is nothing usable to check (unknown account,
 * sentinel value, corrupt row) so those cases keep the same response time.
 */
export async function verifyPasswordOrDummy(
  password: string,
  stored: string | null,
): Promise<PasswordCheck> {
  const parsed = stored === null ? null : decodeHash(stored);
  if (!parsed) {
    await deriveHash(password, DUMMY_SALT, CURRENT_RECIPE);
    return { ok: false, needsRehash: false };
  }
  const actual = await deriveHash(password, parsed.salt, parsed.settings);
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ parsed.digest[i];
  const ok = diff === 0;
  return {
    ok,
    needsRehash:
      ok &&
      (parsed.settings.memoryKib !== MEMORY_KIB ||
        parsed.settings.passes !== PASSES ||
        parsed.settings.parallelism !== PARALLELISM),
  };
}
