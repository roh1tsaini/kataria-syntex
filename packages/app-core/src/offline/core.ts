/**
 * Offline core: the local session profile cache.
 *
 * Persists in the adapter's synchronous KV store — localStorage on
 * web/Electron, MMKV on Android — so an offline-restarted device isn't blank
 * on a flaky connection.
 */

import { core } from "../adapter";

const K_SESSION = "offline.session.v1";

/** Parse a stored value only when it matches the expected shape — corrupt
 * JSON drops to null instead of poisoning callers. */
function readJson<T>(key: string, guard: (v: unknown) => v is T): T | null {
  try {
    const raw = core().storage.get(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

type SessionCache = {
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    name: string;
  };
};

export function cacheSession(session: SessionCache): void {
  try {
    core().storage.set(K_SESSION, JSON.stringify(session));
  } catch {
    // ignore
  }
}

const isSessionCache = (v: unknown): v is SessionCache =>
  isObject(v) && isObject(v.user) && typeof v.user.id === "string";

export function readSession(): SessionCache | null {
  return readJson(K_SESSION, isSessionCache);
}

export function clearSessionCache(): void {
  try {
    core().storage.delete(K_SESSION);
  } catch {
    // ignore
  }
}
