import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNull,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "../lib/db";
import {
  users,
  workspaces,
  memberships,
  memberPermissions,
  devices,
  sessions,
  loginAttempts,
  companies,
  otpCodes,
  qrLogins,
  type Permission,
} from "../db/schema";
import { ALL_PERMISSIONS } from "@kataria-syntex/shared";
import { detectIdentifier } from "../lib/identifier";
import { hashPassword, verifyPasswordOrDummy } from "../lib/password";
import { generateId } from "../lib/token";
import { DEFAULT_NUMBERING_JSON } from "../lib/company";
import {
  requestOtp,
  verifyOtp,
  consumeVerifiedOtp,
  OtpRateError,
  ipBudgetRemaining,
  recordIpAttempt,
} from "../auth/otp";
import {
  createQrLogin,
  approveQrLogin,
  claimQrLogin,
  qrLoginInfo,
  QR_TTL_SECONDS,
} from "../auth/qr-login";
import {
  findPendingMembership,
  consumePendingMembership,
} from "../auth/members";
import {
  requireAuth,
  createSessionForUser,
  SESSION_TTL_MS,
} from "../auth/session";
import { toIso } from "../lib/datetime";
import {
  badRequest,
  buildDeviceMeta,
  clientIp,
  deleteSessionCookie,
  findUserByIdentifier,
  identifierSchema,
  issueSession,
  otpVerifySchema,
  passwordLoginSchema,
  setSessionCookie,
  signupSchema,
  authPayload,
  PASSWORD_LOGIN_MAX_FAILS,
  PASSWORD_LOGIN_WINDOW_MS,
  SESSION_COOKIE,
  type AuthCtx,
  type AuthEnv,
} from "./auth-shared";
import { apiError } from "../lib/api-error";

export const authPasswordRoute = new Hono<AuthEnv>();

// ── Password login ──────────────────────────────────────────────────────────

authPasswordRoute.post("/password/login", async (c) => {
  const parsed = passwordLoginSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_request");
  const ident = detectIdentifier(parsed.data.identifier);
  if (!ident) return badRequest(c, "invalid_identifier");

  const now = new Date();
  const nowIso = toIso(now);
  if (ipBudgetRemaining("password_login", clientIp(c), 30) <= 0) {
    return apiError(c, "password_login_rate_limited", 429);
  }
  recordIpAttempt("password_login", clientIp(c));

  // Two-tier lockout: per identifier+device pair (owner mandate —
  // an attacker hammering THEIR device can't lock the real owner out) AND a
  // wider per-identifier ceiling, because the device key is client-controlled
  // and rotating it must not defeat the limit entirely.
  const meta = buildDeviceMeta(c);
  const deviceKey =
    c.req.header("x-device-fingerprint")?.slice(0, 64) ??
    `${meta.platform}:${meta.label}`.slice(0, 80);

  const db = getDb(c.env.DB);
  // One query serves both lockout ceilings: device-scoped and
  // identifier-scoped failure counts over the rate-limit window.
  const failCounts = await db
    .select({
      deviceFails:
        sql<number>`SUM(CASE WHEN ${loginAttempts.deviceKey} = ${deviceKey} THEN 1 ELSE 0 END)`.mapWith(
          Number,
        ),
      identFails: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.phone, ident.value),
        eq(loginAttempts.ok, false),
        gt(
          loginAttempts.createdAt,
          toIso(new Date(now.getTime() - PASSWORD_LOGIN_WINDOW_MS)),
        ),
      ),
    )
    .limit(1);
  if ((failCounts[0]?.identFails ?? 0) >= PASSWORD_LOGIN_MAX_FAILS * 10) {
    return apiError(c, "password_login_rate_limited", 429);
  }
  if ((failCounts[0]?.deviceFails ?? 0) >= PASSWORD_LOGIN_MAX_FAILS) {
    return apiError(c, "password_login_rate_limited", 429);
  }

  const user = await findUserByIdentifier(db, ident);
  const ok = await verifyPasswordOrDummy(
    parsed.data.password,
    user?.passwordHash ?? null,
  );

  await db.batch([
    db.insert(loginAttempts).values({
      id: generateId(),
      phone: ident.value,
      deviceKey,
      ok,
      createdAt: nowIso,
    }),
    // Bound the table on successful logins only — a failed attempt shouldn't
    // pay for a full-table delete sweep.
    ...(ok
      ? [
          db
            .delete(loginAttempts)
            .where(
              lt(
                loginAttempts.createdAt,
                toIso(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
              ),
            ),
        ]
      : []),
  ]);
  if (!ok || !user || !user.passwordHash)
    return apiError(c, "invalid_credentials", 401);

  // Correct login clears this device's failure history.
  await db
    .delete(loginAttempts)
    .where(
      and(
        eq(loginAttempts.phone, ident.value),
        eq(loginAttempts.deviceKey, deviceKey),
      ),
    );

  const { token, deviceId } = await issueSession(c, db, user.id);
  const payload = await authPayload(db, user.id);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, deviceId, ...payload });
});
