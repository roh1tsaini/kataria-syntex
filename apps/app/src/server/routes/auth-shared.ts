import { type Context } from "hono";

import { z } from "zod";
import { setCookie } from "hono/cookie";
import { and, eq } from "drizzle-orm";
import { type Db } from "../lib/db";
import type { Env } from "../env";
import {
  users,
  workspaces,
  memberships,
  memberPermissions,
  type Permission,
} from "../db/schema";
import { ALL_PERMISSIONS, type ApiCode } from "@kataria-syntex/shared";
import { apiError } from "../lib/api-error";
import { type Identifier } from "../lib/identifier";

import {
  createSessionForUser,
  SESSION_TTL_MS,
  type AuthVariables,
} from "../auth/session";

export type AuthEnv = { Bindings: Env; Variables: AuthVariables };
export type AuthCtx = Context<AuthEnv>;

export const SESSION_COOKIE = "kc_session";
const SESSION_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);
export const PASSWORD_LOGIN_MAX_FAILS = 10;
export const PASSWORD_LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const identifierSchema = z.object({
  identifier: z.string().min(3).max(200),
});
export const otpVerifySchema = z.object({
  identifier: z.string().min(3).max(200),
  code: z.string().regex(/^\d{6}$/),
});
export const signupSchema = z.object({
  identifier: z.string().min(3).max(200),
  name: z.string().trim().min(1).max(60),
  // Owner mandate: min 10 — don't undermine PBKDF2 with short secrets.
  password: z.string().min(10).max(200).optional(),
  workspaceName: z.string().trim().min(1).max(60).optional(),
});
export const passwordLoginSchema = z.object({
  identifier: z.string().min(3).max(200),
  password: z.string().min(10).max(200),
});

export function badRequest(c: AuthCtx, message: ApiCode) {
  return apiError(c, message, 400);
}

export function buildDeviceMeta(c: AuthCtx): {
  label: string;
  platform: string;
  userAgent?: string;
} {
  const platform = (c.req.header("x-platform") ?? "web").toLowerCase();
  const userAgent = c.req.header("user-agent");
  const fingerprint = c.req.header("x-device-fingerprint") ?? null;
  const label =
    c.req.header("x-device-label") ??
    (platform === "web"
      ? fingerprint
        ? `Browser ${fingerprint.slice(0, 6)}`
        : "Web browser"
      : platform === "android"
        ? "Android app"
        : "Desktop app");
  return {
    label,
    platform:
      platform === "web" || platform === "android" ? platform : "desktop",
    userAgent,
  };
}

export function isHttpsRequest(c: AuthCtx): boolean {
  const forwarded = c.req.header("x-forwarded-proto");
  return forwarded ? forwarded.split(",")[0].trim() === "https" : false;
}

/**
 * Client IP for rate-limit budgets. X-Forwarded-For is spoofable, so it is
 * honored ONLY when TRUST_PROXY=1 (one known proxy in front) — and then the
 * RIGHTMOST entry wins: a trusted proxy APPENDS the real client IP, so any
 * client-supplied entries sit to the LEFT of it. Taking the leftmost value
 * would let an attacker rotate the header past every IP budget.
 *
 * On Cloudflare the edge itself sets CF-Connecting-IP to the true client
 * address (not client-spoofable), so that is the default source.
 */
export function clientIp(c: AuthCtx): string {
  if (c.env.TRUST_PROXY === "1") {
    const forwarded = c.req.header("x-forwarded-for");
    const parts = forwarded?.split(",").map((s) => s.trim()) ?? [];
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return c.req.header("cf-connecting-ip") ?? "127.0.0.1";
}

export function setSessionCookie(c: AuthCtx, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttpsRequest(c) || c.env.APP_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function findUserByIdentifier(
  d: Db,
  ident: Identifier,
): Promise<typeof users.$inferSelect | undefined> {
  const column = ident.type === "phone" ? users.phone : users.email;
  const rows = await d.select().from(users).where(eq(column, ident.value));
  return rows[0];
}

export async function authPayload(d: Db, userId: string) {
  const userRows = await d.select().from(users).where(eq(users.id, userId));
  const user = userRows[0];
  if (!user) return null;
  const membershipRows = await d
    .select({
      workspace: workspaces,
      isPrimaryAdmin: memberships.isPrimaryAdmin,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(eq(memberships.userId, userId));
  const membership = membershipRows[0];
  let permissions: Permission[] = [];
  if (membership && !membership.isPrimaryAdmin) {
    const permRows = await d
      .select({ permission: memberPermissions.permission })
      .from(memberPermissions)
      .where(eq(memberPermissions.userId, userId));
    permissions = permRows
      .map((r) => r.permission as Permission)
      .filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p));
  } else if (membership && membership.isPrimaryAdmin) {
    permissions = [...ALL_PERMISSIONS];
  }
  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
    },
    workspace: membership
      ? {
          id: membership.workspace.id,
          name: membership.workspace.name,
          isPrimaryAdmin: membership.isPrimaryAdmin,
          permissions,
        }
      : null,
  };
}

export async function issueSession(c: AuthCtx, d: Db, userId: string) {
  const meta = buildDeviceMeta(c);
  const { token, deviceId } = await createSessionForUser(d, userId, meta);
  setSessionCookie(c, token);
  return { token, deviceId };
}
