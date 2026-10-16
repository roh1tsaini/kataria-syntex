import { Hono } from "hono";

import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { rateLimits, users } from "../db/schema";

import { detectIdentifier, type Identifier } from "../lib/identifier";
import { hashPassword, verifyPasswordOrDummy } from "../lib/password";
import { toIso } from "../lib/datetime";
import { sha256Hex } from "../lib/token";
import { consumeBudgetsStrict } from "../lib/rate-limit";

import {
  consumeVerifiedOtp,
  ipBudgetRemaining,
  recordIpAttempt,
  verifyOtp,
} from "../auth/otp";
import { requireAuth } from "../auth/session";

import {
  badRequest,
  buildDeviceMeta,
  changePasswordSchema,
  clientIp,
  findUserByIdentifier,
  issueSession,
  passwordLoginSchema,
  authPayload,
  PASSWORD_LOGIN_MAX_ATTEMPTS,
  PASSWORD_LOGIN_WINDOW_MS,
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

  const ip = clientIp(c);
  if (ipBudgetRemaining("password_login", ip, 30) <= 0) {
    return apiError(c, "password_login_rate_limited", 429);
  }
  recordIpAttempt("password_login", ip);

  // D1 counters cover IP, identifier, and device. The identifier ceiling
  // prevents rotating client-controlled device fingerprints from bypassing it.
  const meta = buildDeviceMeta(c);
  const deviceKey =
    c.req.header("x-device-fingerprint")?.slice(0, 64) ??
    `${meta.platform}:${meta.label}`.slice(0, 80);

  const db = getDb(c.env.DB);
  const identifierHash = await sha256Hex(ident.value);
  const ipHash = await sha256Hex(ip);
  const deviceHash = await sha256Hex(`${ident.value}\u0000${deviceKey}`);
  const deviceBudgetKey = `password:device:${deviceHash}`;
  const allowed = await consumeBudgetsStrict(db, [
    {
      key: `password:ip:${ipHash}`,
      max: 30,
      windowMs: PASSWORD_LOGIN_WINDOW_MS,
    },
    {
      key: `password:id:${identifierHash}`,
      max: PASSWORD_LOGIN_MAX_ATTEMPTS * 10,
      windowMs: PASSWORD_LOGIN_WINDOW_MS,
    },
    {
      key: deviceBudgetKey,
      max: PASSWORD_LOGIN_MAX_ATTEMPTS,
      windowMs: PASSWORD_LOGIN_WINDOW_MS,
    },
  ]);
  if (!allowed) {
    return apiError(c, "password_login_rate_limited", 429);
  }

  const user = await findUserByIdentifier(db, ident);
  const check = await verifyPasswordOrDummy(
    parsed.data.password,
    user?.passwordHash ?? null,
  );

  if (!user || !check.ok) return apiError(c, "invalid_credentials", 401);

  if (check.needsRehash) {
    // Best-effort upgrade to the current recipe — rewriting the stored hash
    // must never turn a correct password into a failed sign-in.
    try {
      const upgraded = await hashPassword(parsed.data.password);
      await db
        .update(users)
        .set({ passwordHash: upgraded, updatedAt: toIso(new Date()) })
        .where(eq(users.id, user.id));
    } catch (error) {
      console.error("password_rehash_failed", error);
    }
  }

  // A successful login clears this device's budget; the identifier and IP
  // ceilings stand.
  await db.delete(rateLimits).where(eq(rateLimits.key, deviceBudgetKey));

  const { token, deviceId } = await issueSession(c, db, user.id);
  const payload = await authPayload(db, user.id);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, deviceId, ...payload });
});

// ── Password change ─────────────────────────────────────────────────────────

authPasswordRoute.post("/password/change", requireAuth, async (c) => {
  const parsed = changePasswordSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_request");
  const { currentPassword, code, newPassword } = parsed.data;
  // Exactly one proof: the current password, or a code sent to the account.
  if ((currentPassword === undefined) === (code === undefined))
    return badRequest(c, "invalid_request");

  const auth = c.get("auth");
  const db = getDb(c.env.DB);
  const ip = clientIp(c);
  if (ipBudgetRemaining("password_change", ip, 30) <= 0)
    return apiError(c, "password_change_rate_limited", 429);
  recordIpAttempt("password_change", ip);

  const ipHash = await sha256Hex(ip);
  const allowed = await consumeBudgetsStrict(db, [
    {
      key: `password_change:ip:${ipHash}`,
      max: 30,
      windowMs: PASSWORD_LOGIN_WINDOW_MS,
    },
    {
      key: `password_change:user:${auth.userId}`,
      max: PASSWORD_LOGIN_MAX_ATTEMPTS,
      windowMs: PASSWORD_LOGIN_WINDOW_MS,
    },
  ]);
  if (!allowed) return apiError(c, "password_change_rate_limited", 429);

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.userId));
  const user = userRows[0];
  if (!user) return apiError(c, "unauthorized", 401);

  if (currentPassword !== undefined) {
    const check = await verifyPasswordOrDummy(
      currentPassword,
      user.passwordHash,
    );
    if (!check.ok) return badRequest(c, "wrong_password");
  } else if (code !== undefined) {
    // The code goes to whichever identifier the account carries (phone wins
    // when both exist) — the client cannot redirect it anywhere else.
    const ident: Identifier | null = user.phone
      ? { type: "phone", value: user.phone }
      : user.email
        ? { type: "email", value: user.email }
        : null;
    if (!ident) return apiError(c, "internal_server_error", 500);
    const result = await verifyOtp(db, ident, code, ip);
    if (result.status === "ip_rate_limited")
      return apiError(c, "otp_rate_limit_ip", 429);
    if (result.status === "invalid")
      return c.json(
        { error: "invalid_code", attemptsLeft: result.attemptsLeft },
        400,
      );
    if (result.status === "expired") return apiError(c, "otp_expired", 400);
    if (result.status === "attempts_exhausted")
      return apiError(c, "otp_attempts_exhausted", 429);
    if (result.status === "not_found") return apiError(c, "otp_not_found", 400);
    // One-shot: the same code can never confirm a second change.
    if (!(await consumeVerifiedOtp(db, ident)))
      return apiError(c, "otp_expired", 400);
  }

  const upgraded = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash: upgraded, updatedAt: toIso(new Date()) })
    .where(eq(users.id, auth.userId));
  return c.json({ ok: true });
});
