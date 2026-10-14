import setupWasm, {
  type Argon2idParams,
  type computeHash,
} from "argon2id/lib/setup.js";
import wasmSIMD from "argon2id/dist/simd.wasm";
import wasmNonSIMD from "argon2id/dist/no-simd.wasm";

const MEMORY_KIB = 19_456;
const PASSES = 2;
const PARALLELISM = 1;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const MIN_PASSWORD_LENGTH = 10;

let computeHashPromise: Promise<computeHash> | undefined;

function loadInstance(module: WebAssembly.Module) {
  return async (imports: WebAssembly.Imports) => {
    const instance =
      typeof WebAssembly.instantiate === "function"
        ? await WebAssembly.instantiate(module, imports)
        : new WebAssembly.Instance(module, imports);
    return {
      module,
      instance:
        instance instanceof WebAssembly.Instance
          ? instance
          : (instance as { instance: WebAssembly.Instance }).instance,
    };
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

function decodeHash(stored: string): {
  salt: Uint8Array<ArrayBuffer>;
  digest: Uint8Array<ArrayBuffer>;
} | null {
  const match =
    /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
      stored,
    );
  if (!match) return null;
  try {
    const salt = decodeBase64(match[1]);
    const digest = decodeBase64(match[2]);
    return salt.length === SALT_BYTES && digest.length === HASH_BYTES
      ? { salt, digest }
      : null;
  } catch {
    return null;
  }
}

async function deriveHash(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const hash = await getComputeHash();
  const params: Argon2idParams = {
    password: new TextEncoder().encode(password),
    salt,
    parallelism: PARALLELISM,
    passes: PASSES,
    memorySize: MEMORY_KIB,
    tagLength: HASH_BYTES,
  };
  return hash(params);
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new Error("password_too_short");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return encodeHash(salt, await deriveHash(password, salt));
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const decoded = decodeHash(stored);
  if (!decoded) return false;
  const actual = await deriveHash(password, decoded.salt);
  if (actual.length !== decoded.digest.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ decoded.digest[i];
  return diff === 0;
}

const DUMMY_PASSWORD_HASH = encodeHash(
  new Uint8Array(SALT_BYTES).fill(0x5a),
  new Uint8Array(HASH_BYTES).fill(0xa5),
);

export async function verifyPasswordOrDummy(
  password: string,
  stored: string | null,
): Promise<boolean> {
  const ok = await verifyPassword(password, stored ?? DUMMY_PASSWORD_HASH);
  return stored !== null && ok;
}
