import { create } from "zustand";
import { api, ApiError } from "../api";
import { core } from "../adapter";
import { cacheSession, clearSessionCache, readSession } from "../offline/core";
import { invalidateDataCaches } from "../data-caches";

export type User = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
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
};

type LookupResult = {
  type: "phone" | "email";
  exists: boolean;
  hasPassword: boolean;
  registrationClosed: boolean;
};

type VerifyResult =
  { status: "needs_signup" } | ({ status: "ok" } & SessionPayload);

/** QR payloads are URLs (`<origin>/login/scan/<id>`) so any camera works;
 *  the link carries the request id only, never the code. */
export type QrLoginCode = {
  code: string;
  /** Secret half of the pairing. Kept by this device, never shown or
   *  transmitted to the scanning device — without it the code cannot be
   *  claimed, so a screenshot or forwarded link is worthless. */
  claimSecret: string;
  expiresIn: number;
  payload: string;
  expiresAt: string;
};

/** What an approve call reports: whose account was signed in. */
type QrApproveOutcome = {
  grantedName: string | null;
  grantedSelf: boolean;
};

type SessionPayload = MePayload & {
  token: string;
  deviceId: string;
};

type AuthState = {
  status: "loading" | "guest" | "authed";
  user: User | null;
  devices: Device[];
  bootstrap: () => Promise<void>;
  lookupIdentifier: (identifier: string) => Promise<LookupResult>;
  requestOtp: (identifier: string) => Promise<void>;
  verifyOtp: (
    identifier: string,
    code: string,
  ) => Promise<{ outcome: "needs_signup" | "ok" }>;
  signup: (input: {
    identifier: string;
    name: string;
    password: string;
    code: string;
  }) => Promise<void>;
  loginPassword: (identifier: string, password: string) => Promise<void>;
  changePassword: (input: {
    currentPassword?: string;
    code?: string;
    newPassword: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
  startQrLogin: (identifier?: string) => Promise<QrLoginCode>;
  approveQrLoginByCode: (code: string) => Promise<QrApproveOutcome>;
  approveQrLoginBySuffix: (
    id: string,
    suffix: string,
  ) => Promise<QrApproveOutcome>;
  pollQrLogin: (
    code: string,
    claimSecret: string,
  ) => Promise<"pending" | "expired" | "not_found" | "ok">;
};

function applySession(
  set: (
    partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>),
  ) => void,
  payload: SessionPayload,
): void {
  // A fresh login supersedes any in-flight bootstrap reconciliation.
  ++bootstrapGeneration;
  invalidateDataCaches();
  set({
    status: "authed",
    user: payload.user,
  });
  cacheSession({ user: payload.user });
  core()
    .writeToken(payload.token)
    .catch(() => {
      // Non-fatal — the web session still works; worst case the user signs in
      // again on next launch instead of a silent failed keychain write.
    });
}

let bootstrapGeneration = 0;

export const useAuth = create<AuthState>()((set, get) => ({
  // No storage reads at module scope — stores evaluate before the shell's
  // configureCore() runs (ES import hoisting). bootstrap() hydrates the
  // cached session before touching the network.
  status: "loading",
  user: null,
  devices: [],

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
      });
    }
    try {
      const me = await api<MePayload>("/auth/me", {});
      if (!current()) return;
      set({ status: "authed", user: me.user });
      cacheSession({ user: me.user });
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        // Server unreachable: a device that signed in before stays usable
        // offline with its cached profile.
        const cached = readSession();
        if (cached && current()) {
          set({
            status: "authed",
            user: cached.user,
          });
          return;
        }
        if (!current()) return;
        set({ status: "guest" });
      } else if (err instanceof ApiError && err.status === 401) {
        if (!current()) return;
        clearSessionCache();
        invalidateDataCaches();
        void core()
          .writeToken(null)
          .catch(() => {});
        set({ status: "guest", user: null });
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
    if (res.status === "needs_signup") return { outcome: "needs_signup" };
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

  changePassword: async (input) => {
    await api<{ ok: boolean }>("/auth/password/change", {
      method: "POST",
      body: input,
    });
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
      invalidateDataCaches();
      set({
        status: "guest",
        user: null,
        devices: [],
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

  approveQrLoginByCode: async (code) => {
    const res = await api<{ status: "ok" } & QrApproveOutcome>(
      "/auth/qr/approve",
      {
        method: "POST",
        body: { code },
      },
    );
    return { grantedName: res.grantedName, grantedSelf: res.grantedSelf };
  },

  approveQrLoginBySuffix: async (id, suffix) => {
    const res = await api<{ status: "ok" } & QrApproveOutcome>(
      "/auth/qr/approve",
      {
        method: "POST",
        body: { id, suffix },
      },
    );
    return { grantedName: res.grantedName, grantedSelf: res.grantedSelf };
  },

  pollQrLogin: async (code, claimSecret) => {
    // POST — claiming a session is a state change; GET only reads status
    // (login-CSRF hardening). The claim secret rides in the body, never the
    // query string, so it stays out of platform logs and proxy traces.
    const res = await api<
      {
        status: "pending" | "expired" | "not_found" | "ok";
      } & Partial<SessionPayload>
    >("/auth/qr/status", { method: "POST", body: { code, claimSecret } });
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
      });
    }
    return res.status;
  },
}));
