/**
 * Offline core: local caches + the pending challan list.
 *
 * Everything persists in localStorage — supported and durable on web/PWA and
 * the Android Capacitor webview, so one implementation serves all targets.
 * Sizes are tiny (JSON records), well under the ~5MB quota.
 *
 * Challan numbering and the Indian FY window (Apr 1 – Mar 31, UTC) come
 * from `@kataria-syntex/shared` — the single source for both client and
 * server.
 */

import type { Challan, ChallanInput, ChallanItem } from "@/store/challans";
import type {
  Customer,
  JobWorker,
  Denier,
  Color,
  Supplier,
} from "@/store/masters";
import type { Numbering } from "@kataria-syntex/shared";
import { deviceLabel } from "../platform";

// ── Keys ────────────────────────────────────────────────────────────────────

const K_DEVICE = "offline.device.v1";
const K_MASTERS = "offline.masters.v1";
const K_COMPANY = "offline.company.v1";
const K_SESSION = "offline.session.v1";
const K_PENDING = "offline.pending.v1";

// ── IDs ─────────────────────────────────────────────────────────────────────

/** UUID-shaped id that works outside secure contexts (plain-http LAN).
 * Never Math.random — low entropy invites collisions in sync keys. */
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // set version 4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (b, i) =>
    [4, 6, 8, 10].includes(i)
      ? `-${b.toString(16).padStart(2, "0")}`
      : b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Parse a localStorage value only when it matches the expected shape —
 * corrupt JSON drops to null instead of poisoning callers. */
function readJson<T>(key: string, guard: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

// ── Device identity ─────────────────────────────────────────────────────────

export type DeviceIdentity = { ref: string; label: string };

const isDeviceIdentity = (v: unknown): v is DeviceIdentity =>
  isObject(v) && typeof v.ref === "string" && typeof v.label === "string";

export function deviceIdentity(): DeviceIdentity {
  const stored = readJson(K_DEVICE, isDeviceIdentity);
  if (stored) return stored;
  const identity: DeviceIdentity = { ref: randomId(), label: deviceLabel() };
  try {
    localStorage.setItem(K_DEVICE, JSON.stringify(identity));
  } catch {
    // storage unavailable — identity stays for this session only
  }
  return identity;
}

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
    localStorage.setItem(
      K_MASTERS,
      JSON.stringify({ ...cache, savedAt: new Date().toISOString() }),
    );
  } catch {
    // quota/unavailable — masters stay in memory for this session
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

// ── Company + counters cache ────────────────────────────────────────────────

export type CompanyCache = {
  name: string;
  gstin: string;
  pan: string;
  address: string;
  phone1: string;
  phone2: string;
  numbering: Numbering;
  /** Next seq per FY per type, as last seen from the server. */
  counters: Record<
    string,
    {
      sales: number;
      outward: number;
      packing_s: number;
      packing_j: number;
      raw: number;
    }
  >;
  savedAt: string;
};

export function cacheCompany(cache: Omit<CompanyCache, "savedAt">): void {
  try {
    localStorage.setItem(
      K_COMPANY,
      JSON.stringify({ ...cache, savedAt: new Date().toISOString() }),
    );
  } catch {
    // ignore
  }
}

const isCompanyCache = (v: unknown): v is CompanyCache =>
  isObject(v) && isObject(v.numbering) && isObject(v.counters);

export function readCompany(): CompanyCache | null {
  return readJson(K_COMPANY, isCompanyCache);
}

/** Next seq to issue offline for a FY + type (1 when nothing cached). */
export function nextSeq(
  fyLabel: string,
  type: "sales" | "outward" | "packing_s" | "packing_j" | "raw",
): number {
  return readCompany()?.counters[fyLabel]?.[type] ?? 1;
}

/** Raises the cached counter so the next offline issue doesn't repeat a seq. */
export function bumpCounter(
  fyLabel: string,
  type: "sales" | "outward" | "packing_s" | "packing_j" | "raw",
  usedSeq: number,
): void {
  const cache = readCompany();
  if (!cache) return;
  const current = cache.counters[fyLabel]?.[type] ?? 1;
  if (usedSeq + 1 <= current) return;
  cache.counters[fyLabel] = {
    ...(cache.counters[fyLabel] ?? {}),
    [type]: usedSeq + 1,
  };
  cacheCompany(cache);
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
    localStorage.setItem(K_SESSION, JSON.stringify(session));
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
    localStorage.removeItem(K_SESSION);
  } catch {
    // ignore
  }
}

/** Wipes everything account-scoped: the pending outbox, masters and company
 * caches. Called on logout / session death / fresh login so one account's
 * queued challans can never sync under another account's session. */
export function clearAccountCache(): void {
  try {
    localStorage.removeItem(K_PENDING);
    localStorage.removeItem(K_MASTERS);
    localStorage.removeItem(K_COMPANY);
  } catch {
    // ignore
  }
}

// ── Pending challans (the offline outbox) ───────────────────────────────────

type PendingStatus = "pending" | "conflict" | "error";

export type PendingChallan = {
  clientRef: string;
  originDevice: string;
  status: PendingStatus;
  /** Server's next-free number, set when a sync hit a number clash (409). */
  suggestion?: string;
  /** Error code from a rejected sync (status "error"). */
  errorCode?: string;
  createdAt: string;
  /** Exact create body the device will re-send on sync. */
  input: ChallanInput;
  challanNumber: string;
  seq: number;
  fyLabel: string;
  /** Local projection used until the server accepts the challan. */
  local: Challan;
  items: ChallanItem[];
};

const isPendingList = (v: unknown): v is PendingChallan[] =>
  Array.isArray(v) &&
  v.every(
    (p) =>
      isObject(p) &&
      typeof p.clientRef === "string" &&
      typeof p.status === "string" &&
      typeof p.challanNumber === "string",
  );

export function listPending(): PendingChallan[] {
  return readJson(K_PENDING, isPendingList) ?? [];
}

function savePendingList(list: PendingChallan[]): void {
  try {
    localStorage.setItem(K_PENDING, JSON.stringify(list));
  } catch {
    // ignore — stays in memory via the zustand mirror
  }
}

export function addPending(p: PendingChallan): void {
  savePendingList([...listPending(), p]);
}

export function updatePending(
  clientRef: string,
  patch: Partial<PendingChallan>,
): void {
  savePendingList(
    listPending().map((p) =>
      p.clientRef === clientRef ? { ...p, ...patch } : p,
    ),
  );
}

export function removePending(clientRef: string): void {
  savePendingList(listPending().filter((p) => p.clientRef !== clientRef));
}
