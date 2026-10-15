import { core } from "./adapter";
import { registerDataCache } from "./data-caches";

/**
 * Navigation display preferences (design.md Section 4, "Nav density").
 *
 * These are per-account and go through the shell seam's storage, so they
 * behave identically on web (localStorage), the Android app (AsyncStorage) and
 * Electron. Every account's copy is wiped on logout / 401 / account switch so a
 * preference can never leak across accounts.
 */

export type NavDensity = "list" | "grid";

const DENSITY_KEY = "nav.density";
const OWNED_KEY = "nav.owned";

function densityKey(accountId: string): string {
  return `${DENSITY_KEY}.${accountId}`;
}

/** Accounts that currently hold a preference, so logout can clear them all. */
function ownedAccounts(): string[] {
  try {
    const raw = core().storage.get(OWNED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberAccount(accountId: string): void {
  const owned = ownedAccounts();
  if (owned.includes(accountId)) return;
  try {
    core().storage.set(OWNED_KEY, JSON.stringify([...owned, accountId]));
  } catch {
    // storage refused — the preference still works for this session
  }
}

/** "list" is the documented default; anything unreadable falls back to it. */
export function readNavDensity(accountId: string | null): NavDensity {
  if (!accountId) return "list";
  try {
    return core().storage.get(densityKey(accountId)) === "grid"
      ? "grid"
      : "list";
  } catch {
    return "list";
  }
}

export function writeNavDensity(
  accountId: string | null,
  value: NavDensity,
): void {
  if (!accountId) return;
  try {
    core().storage.set(densityKey(accountId), value);
    rememberAccount(accountId);
  } catch {
    // storage refused — the choice applies to this session only
  }
}

/** Wipes every account's nav preferences. Cheap and idempotent. */
export function clearNavPrefs(): void {
  const owned = ownedAccounts();
  for (const id of owned) {
    try {
      core().storage.delete(densityKey(id));
    } catch {
      // nothing to clear for this host
    }
  }
  try {
    core().storage.delete(OWNED_KEY);
  } catch {
    // storage refused — there is nothing persisted to clear
  }
}

// Logout, 401 and a fresh sign-in all call invalidateDataCaches(); that is
// the one account reset, so preferences are wiped there and nowhere else.
registerDataCache(clearNavPrefs);
