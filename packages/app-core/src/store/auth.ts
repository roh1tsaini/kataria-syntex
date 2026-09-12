import { create } from "zustand";
import { useCallback } from "react";
import { api, ApiError } from "../api";
import { core } from "../adapter";
import {
  cacheCompany,
  cacheSession,
  clearAccountCache,
  clearSessionCache,
  readSession,
} from "../offline/core";
import { invalidateDataCaches } from "../data-caches";
import { recountPending } from "../offline/sync-state";
import {
  ALL_PERMISSIONS as SHARED_ALL_PERMISSIONS,
  type Permission as SharedPermission,
} from "@kataria-syntex/shared";
import type {
  NumberingConfig as SharedNumbering,
  NumberingType as SharedNumberingType,
} from "@kataria-syntex/shared";

// Re-export canonical permissions/numbering from shared — single source of truth.
export type Permission = SharedPermission;
export const ALL_PERMISSIONS: Permission[] = [...SHARED_ALL_PERMISSIONS];

/** Account teardown: page stores reset with the caches so the next account
 * on this device never renders the previous one's rows or pickers. Dynamic
 * imports keep the store graph cycle-free (same pattern as logout's old
 * direct challans call). */
async function resetPageStores(): Promise<void> {
  const [{ useChallans }, { useMasters }, { useRecipes }] = await Promise.all([
    import("./challans"),
    import("./masters"),
    import("./recipes"),
  ]);
  useChallans.getState().reset();
  useMasters.getState().reset();
  useRecipes.getState().reset();
}

export type User = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
};
export type Workspace = {
  id: string;
  name: string;
  isPrimaryAdmin: boolean;
  permissions: Permission[];
};
export type NumberingType = SharedNumberingType;
export type Numbering = SharedNumbering;
export type Company = {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  address: string;
  phone1: string;
  phone2: string;
  numbering: Numbering;
};
export type FinancialYearInfo = {
  label: string;
  startsAt: string;
  endsAt: string;
};
export type Member = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isPrimaryAdmin: boolean;
  permissions: Permission[];
  isCurrent: boolean;
};
export type PendingMember = {
  id: string;
  identifier: string;
  permissions: Permission[];
  invitedByName: string | null;
};
export type Device = {
  id: string;
  label: string;
  platform: string;
  userAgent: string | null;
  lastSeenAt: string;
  isCurrent: boolean;
};

type MePayload = {
  user: User;
  workspace: Workspace | null;
};

export type LookupResult = {
  type: "phone" | "email";
  exists: boolean;
  hasPassword: boolean;
  hasInvite: boolean;
};

type VerifyResult =
  | { status: "needs_signup"; hasInvite: boolean }
  | ({ status: "ok" } & SessionPayload);

/** QR payloads are URLs (`<origin>/login/scan/<code>`) so any camera works. */
export type QrLoginCode = {
  code: string;
  expiresIn: number;
  payload: string;
  expiresAt: string;
};

type SessionPayload = MePayload & {
  token: string;
  deviceId: string;
};

type AuthState = {
  status: "loading" | "guest" | "authed";
  user: User | null;
  workspace: Workspace | null;
  devices: Device[];
  members: Member[];
  pendingMembers: PendingMember[];
  company: Company | null;
  currentFy: FinancialYearInfo | null;
  financialYears: FinancialYearInfo[];
  bootstrap: () => Promise<void>;
  lookupIdentifier: (identifier: string) => Promise<LookupResult>;
  requestOtp: (identifier: string) => Promise<void>;
  verifyOtp: (
    identifier: string,
    code: string,
  ) => Promise<{ outcome: "needs_signup" | "ok"; hasInvite?: boolean }>;
  signup: (input: {
    identifier: string;
    name: string;
    password?: string;
    workspaceName?: string;
  }) => Promise<void>;
  loginPassword: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
  startQrLogin: (identifier?: string) => Promise<QrLoginCode>;
  approveQrLogin: (code: string) => Promise<{
    grantedName: string | null;
    grantedSelf: boolean;
  }>;
  pollQrLogin: (
    code: string,
  ) => Promise<"pending" | "expired" | "not_found" | "ok">;
  refreshMembers: () => Promise<void>;
  addMember: (
    identifier: string,
    permissions: Permission[],
  ) => Promise<{ attached: boolean }>;
  removePendingMember: (id: string) => Promise<void>;
  updateMemberPermissions: (
    id: string,
    permissions: Permission[],
  ) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  transferOwnership: (toUserId: string) => Promise<void>;
  refreshCompany: () => Promise<void>;
  saveCompany: (input: {
    name: string;
    gstin: string;
    pan: string;
    address: string;
    phone1: string;
    phone2: string;
  }) => Promise<void>;
  saveNumbering: (numbering: Numbering) => Promise<void>;
};

/** Reactive variant — subscribes to the workspace so permission revocations
 * hide controls immediately, not on the next navigation. */
export function usePermission(): (perm: Permission) => boolean {
  const workspace = useAuth((s) => s.workspace);
  return useCallback(
    (perm) => {
      if (!workspace) return false;
      return workspace.isPrimaryAdmin || workspace.permissions.includes(perm);
    },
    [workspace],
  );
}

/** Packer-only account: not an admin and every permission is a packing one.
 * Such workspaces land in packing mode instead of the full dashboard. */
export function isPackerOnlyWorkspace(ws: Workspace | null): boolean {
  if (!ws || ws.isPrimaryAdmin || !ws.permissions.length) return false;
  return ws.permissions.every((p) =>
    ["create_packing", "edit_packing"].includes(p),
  );
}

function applySession(
  set: (
    partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>),
  ) => void,
  payload: SessionPayload,
): void {
  // A fresh login supersedes any in-flight bootstrap reconciliation.
  ++bootstrapGeneration;
  // Fresh login: drop any data a previous account left on this device —
  // storage caches, module caches, and the page stores' in-memory rows.
  clearAccountCache();
  invalidateDataCaches();
  void resetPageStores();
  set({
    status: "authed",
    user: payload.user,
    workspace: payload.workspace,
  });
  cacheSession({ user: payload.user, workspace: payload.workspace });
  core()
    .writeToken(payload.token)
    .catch(() => {
      // Non-fatal — the web session still works; worst case the user signs in
      // again on next launch instead of a silent failed keychain write.
    });
}

/** Cached sessions store permissions as plain strings — narrow them back to
 * the canonical set before trusting them as a Workspace. */
function cachedWorkspace(
  ws:
    | {
        id: string;
        name: string;
        isPrimaryAdmin: boolean;
        permissions: string[];
      }
    | null
    | undefined,
): Workspace | null {
  if (!ws) return null;
  return {
    ...ws,
    permissions: ws.permissions.filter((p): p is Permission =>
      (SHARED_ALL_PERMISSIONS as readonly string[]).includes(p),
    ),
  };
}

let bootstrapGeneration = 0;

export const useAuth = create<AuthState>()((set, get) => ({
  // No storage reads at module scope — stores evaluate before the shell's
  // configureCore() runs (ES import hoisting). bootstrap() hydrates the
  // cached session before touching the network.
  status: "loading",
  user: null,
  workspace: null,
  devices: [],
  members: [],
  pendingMembers: [],
  company: null,
  currentFy: null,
  financialYears: [],

  bootstrap: async () => {
    const generation = ++bootstrapGeneration;
    const current = () => generation === bootstrapGeneration;
    // Cached session first: a device that signed in before (or is offline)
    // starts usable, then /auth/me reconciles with the server.
    const cached = readSession();
    if (cached && current()) {
      set({
        status: "authed",
        user: cached.user,
        workspace: cachedWorkspace(cached.workspace),
      });
    }
    try {
      const me = await api<MePayload>("/auth/me", {});
      if (!current()) return;
      set({ status: "authed", user: me.user, workspace: me.workspace });
      cacheSession({ user: me.user, workspace: me.workspace });
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        // Server unreachable: a device that signed in before stays usable
        // offline with its cached profile (challan creation is queued).
        const cached = readSession();
        if (cached && current()) {
          set({
            status: "authed",
            user: cached.user,
            workspace: cachedWorkspace(cached.workspace),
          });
          return;
        }
        if (!current()) return;
        set({ status: "guest" });
      } else if (err instanceof ApiError && err.status === 401) {
        if (!current()) return;
        clearSessionCache();
        clearAccountCache();
        // Page module caches hold the old account's rows in memory; the
        // workspaceId key prevents cross-account display but the memory is
        // still the prior account's data — drop it with the storage.
        invalidateDataCaches();
        await resetPageStores();
        if (!current()) return;
        void core()
          .writeToken(null)
          .catch(() => {});
        set({ status: "guest", user: null, workspace: null });
      } else {
        if (!current()) return;
        set({ status: "guest" });
      }
    }
  },

  lookupIdentifier: async (identifier) =>
    api<LookupResult>("/auth/lookup", {
      method: "POST",
      body: { identifier },
    }),

  requestOtp: async (identifier) => {
    await api<{ ok: boolean }>("/auth/otp/request", {
      method: "POST",
      body: { identifier },
    });
  },

  verifyOtp: async (identifier, code) => {
    const res = await api<VerifyResult>("/auth/otp/verify", {
      method: "POST",
      body: { identifier, code },
    });
    if (res.status === "needs_signup")
      return { outcome: "needs_signup", hasInvite: res.hasInvite };
    applySession(set, res);
    return { outcome: "ok" };
  },

  signup: async (input) => {
    const res = await api<SessionPayload>("/auth/signup", {
      method: "POST",
      body: input,
    });
    applySession(set, res);
  },

  loginPassword: async (identifier, password) => {
    const res = await api<SessionPayload>("/auth/password/login", {
      method: "POST",
      body: { identifier, password },
    });
    applySession(set, res);
  },

  logout: async () => {
    ++bootstrapGeneration;
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Server unreachable — local teardown below must always win, otherwise
      // the user is stuck "logged in" on a dead session.
    } finally {
      await core().writeToken(null);
      clearSessionCache();
      clearAccountCache();
      // Same contract as the 401 path: page module caches go with the
      // account (see data-caches).
      invalidateDataCaches();
      await resetPageStores();
      recountPending();
      set({
        status: "guest",
        user: null,
        workspace: null,
        devices: [],
        members: [],
        pendingMembers: [],
        company: null,
        currentFy: null,
        financialYears: [],
      });
    }
  },

  refreshDevices: async () => {
    const res = await api<{ devices: Device[] }>("/auth/devices", {});
    set({ devices: res.devices });
  },

  deleteDevice: async (id) => {
    await api(`/auth/devices/${id}`, {
      method: "DELETE",
    });
    await get().refreshDevices();
  },

  startQrLogin: async (identifier) => {
    const res = await api<QrLoginCode>("/auth/qr/start", {
      method: "POST",
      ...(identifier ? { body: { identifier } } : {}),
    });
    return res;
  },

  approveQrLogin: async (code) => {
    const res = await api<{
      status: "ok";
      grantedName: string | null;
      grantedSelf: boolean;
    }>("/auth/qr/approve", {
      method: "POST",
      body: { code },
    });
    return { grantedName: res.grantedName, grantedSelf: res.grantedSelf };
  },

  pollQrLogin: async (code) => {
    // POST — claiming a session is a state change; GET only reads status
    // (login-CSRF hardening).
    const res = await api<
      {
        status: "pending" | "expired" | "not_found" | "ok";
      } & Partial<SessionPayload>
    >(`/auth/qr/status?code=${encodeURIComponent(code)}`, { method: "POST" });
    if (
      res.status === "ok" &&
      typeof res.token === "string" &&
      res.token &&
      res.user
    ) {
      applySession(set, {
        token: res.token,
        deviceId: res.deviceId ?? "",
        user: res.user,
        workspace: res.workspace ?? null,
      });
    }
    return res.status;
  },

  refreshMembers: async () => {
    const res = await api<{ members: Member[]; pending: PendingMember[] }>(
      "/members",
      {},
    );
    set({ members: res.members, pendingMembers: res.pending ?? [] });
  },

  addMember: async (identifier, permissions) => {
    const res = await api<{ ok: boolean; attached: boolean }>(
      "/members/invite",
      {
        method: "POST",
        body: { identifier, permissions },
      },
    );
    await get().refreshMembers();
    return { attached: res.attached };
  },

  removePendingMember: async (id) => {
    await api(`/members/pending/${id}`, {
      method: "DELETE",
    });
    await get().refreshMembers();
  },

  updateMemberPermissions: async (id, permissions) => {
    await api(`/members/${id}`, {
      method: "PUT",
      body: { permissions },
    });
    await get().refreshMembers();
  },

  removeMember: async (id) => {
    await api(`/members/${id}`, {
      method: "DELETE",
    });
    await get().refreshMembers();
  },

  transferOwnership: async (toUserId) => {
    await api("/members/transfer", {
      method: "POST",
      body: { toUserId },
    });
    await get().refreshMembers();
  },

  refreshCompany: async () => {
    const res = await api<{
      company: Company;
      currentFy: FinancialYearInfo;
      financialYears: (FinancialYearInfo & {
        salesNext?: number;
        outwardNext?: number;
        packingSaleNext?: number;
        packingJobNext?: number;
        rawNext?: number;
      })[];
    }>("/company", {});
    set({
      company: res.company,
      currentFy: res.currentFy,
      financialYears: res.financialYears,
    });
    // Offline cache: numbering config + per-FY next counters for offline
    // challan numbering. Merge with cached counters — the server doesn't know
    // about locally-issued (still unsynced) numbers, so taking raw server
    // values would regress a counter below an already-used seq and cause
    // duplicate-number clashes on the next offline create.
    const { readCompany } = await import("../offline/core");
    const prev = readCompany()?.counters ?? {};
    const counters: Record<
      string,
      {
        sales: number;
        outward: number;
        packing_s: number;
        packing_j: number;
        raw: number;
      }
    > = {};
    for (const fy of res.financialYears) {
      const p = prev[fy.label];
      counters[fy.label] = {
        sales: Math.max(fy.salesNext ?? 1, p?.sales ?? 0),
        outward: Math.max(fy.outwardNext ?? 1, p?.outward ?? 0),
        packing_s: Math.max(fy.packingSaleNext ?? 1, p?.packing_s ?? 0),
        packing_j: Math.max(fy.packingJobNext ?? 1, p?.packing_j ?? 0),
        raw: Math.max(fy.rawNext ?? 1, p?.raw ?? 0),
      };
    }
    cacheCompany({
      name: res.company.name,
      gstin: res.company.gstin,
      pan: res.company.pan,
      address: res.company.address,
      phone1: res.company.phone1,
      phone2: res.company.phone2,
      numbering: res.company.numbering,
      counters,
    });
  },

  saveCompany: async (input) => {
    const res = await api<{ company: Company }>("/company", {
      method: "PUT",
      body: input,
    });
    set({ company: res.company });
  },

  saveNumbering: async (numbering) => {
    await api("/company/numbering", {
      method: "PUT",
      body: numbering,
    });
    await get().refreshCompany();
  },
}));
