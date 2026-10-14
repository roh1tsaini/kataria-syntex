import { Hono } from "hono";

import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { rateLimits } from "../db/schema";

import { detectIdentifier } from "../lib/identifier";
import { verifyPasswordOrDummy } from "../lib/password";
import { sha256Hex } from "../lib/token";
import { consumeBudgetsStrict } from "../lib/rate-limit";

import { ipBudgetRemaining, recordIpAttempt } from "../auth/otp";

import {
  badRequest,
  buildDeviceMeta,
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
  const ok = await verifyPasswordOrDummy(
    parsed.data.password,
    user?.passwordHash ?? null,
  );

  if (!ok || !user || !user.passwordHash)
    return apiError(c, "invalid_credentials", 401);

  // A successful login clears this device's budget; the identifier and IP
  // ceilings stand.
  await db.delete(rateLimits).where(eq(rateLimits.key, deviceBudgetKey));

  const { token, deviceId } = await issueSession(c, db, user.id);
  const payload = await authPayload(db, user.id);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, deviceId, ...payload });
});
