/**
 * Offline core: the local read caches.
 *
 * Everything persists in the adapter's synchronous KV store — localStorage
 * on web/Electron, MMKV on Android — so one implementation serves all
 * targets. Sizes are tiny (JSON records).
 *
 * This is a *read* cache only: masters, company config, and the session
 * profile hydrate from disk so pickers and an offline-restarted device aren't
 * blank on a flaky connection. Saving is online-only — a blocked save keeps
 * the form and tells the user to go online (`store/challans.ts`).
 *
 * Challan numbering and the Indian FY window (Apr 1 – Mar 31, UTC) come
 * from `@kataria-syntex/shared` — the single source for both client and
 * server.
 */

import type {
  Customer,
  JobWorker,
  Denier,
  Color,
  Supplier,
} from "../store/masters";
import type { Numbering } from "@kataria-syntex/shared";
import { core } from "../adapter";
// ── Keys ────────────────────────────────────────────────────────────────────

const K_MASTERS = "offline.masters.v1";
const K_COMPANY = "offline.company.v1";
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

// ── Masters cache ───────────────────────────────────────────────────────────

export type MastersCache = {
  customers: Customer[];
  jobWorkers: JobWorker[];
  deniers: Denier[];
  colors: Color[];
  suppliers: Supplier[];
  savedAt: string;
};

export function cacheMasters(cache: Omit<MastersCache, "savedAt">): void {
  try {
    core().storage.set(
      K_MASTERS,
      JSON.stringify({ ...cache, savedAt: new Date().toISOString() }),
    );
  } catch {
    // storage unavailable — masters stay in memory for this session
  }
}

const isMastersCache = (v: unknown): v is MastersCache =>
  isObject(v) &&
  Array.isArray(v.customers) &&
  Array.isArray(v.jobWorkers) &&
  Array.isArray(v.deniers) &&
  Array.isArray(v.colors) &&
  Array.isArray(v.suppliers);

export function readMasters(): MastersCache | null {
  return readJson(K_MASTERS, isMastersCache);
}

import type { Company, FinancialYearInfo } from "../store/auth";

// ── Company + financial years cache ─────────────────────────────────────────

export type CompanyCache = {
  company: Company;
  currentFy: FinancialYearInfo | null;
  financialYears: FinancialYearInfo[];
  savedAt: string;
};

export function cacheCompany(cache: Omit<CompanyCache, "savedAt">): void {
  try {
    core().storage.set(
      K_COMPANY,
      JSON.stringify({ ...cache, savedAt: new Date().toISOString() }),
    );
  } catch {
    // ignore
  }
}

const isCompanyCache = (v: unknown): v is CompanyCache =>
  isObject(v) &&
  isObject(v.company) &&
  typeof v.company.name === "string" &&
  Array.isArray(v.financialYears);

export function readCompany(): CompanyCache | null {
  return readJson(K_COMPANY, isCompanyCache);
}

// ── Session profile cache (offline restart keeps the device usable) ─────────

export type SessionCache = {
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    name: string;
  };
  workspace: {
    id: string;
    name: string;
    isPrimaryAdmin: boolean;
    permissions: string[];
  } | null;
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

/** Wipes everything account-scoped: the masters and company caches. Called on
 * logout / session death / fresh login so one account's cached data can never
 * surface under another account's session. */
export function clearAccountCache(): void {
  try {
    core().storage.delete(K_MASTERS);
    core().storage.delete(K_COMPANY);
  } catch {
    // ignore
  }
}
