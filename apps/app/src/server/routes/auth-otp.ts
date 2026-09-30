import { Hono } from "hono";

import { and, eq, gt, isNull, isNotNull } from "drizzle-orm";
import { getDb } from "../lib/db";
import { users, otpCodes } from "../db/schema";

import { detectIdentifier } from "../lib/identifier";
import { hashPassword } from "../lib/password";
import { generateId } from "../lib/token";
import { consumeBudget } from "../lib/rate-limit";
import {
  requestOtp,
  verifyOtp,
  consumeVerifiedOtp,
  OtpRateError,
  ipBudgetRemaining,
  recordIpAttempt,
} from "../auth/otp";

import { toIso } from "../lib/datetime";
import {
  badRequest,
  clientIp,
  findUserByIdentifier,
  identifierSchema,
  issueSession,
  otpVerifySchema,
  signupSchema,
  authPayload,
  type AuthEnv,
} from "./auth-shared";
import { apiError } from "../lib/api-error";

export const authOtpRoute = new Hono<AuthEnv>();

// ── Lookup — drives the smart routing ──────────────────────────────────────

authOtpRoute.post("/lookup", async (c) => {
  // Throttled hard — this is an unauthenticated exists/has-password oracle.
  // In-memory IP budget short-circuits the cheap bursts; the D1 budgets below
  // hold across isolates (per source IP and per probed identifier).
  if (ipBudgetRemaining("lookup", clientIp(c), 30) <= 0)
    return apiError(c, "rate_limited", 429);
  recordIpAttempt("lookup", clientIp(c));

  const parsed = identifierSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_identifier");
  const ident = detectIdentifier(parsed.data.identifier);
  if (!ident) return badRequest(c, "invalid_identifier");

  const db = getDb(c.env.DB);
  if (!(await consumeBudget(db, `lookup:ip:${clientIp(c)}`, 30, 60_000)))
    return apiError(c, "rate_limited", 429);
  if (!(await consumeBudget(db, `lookup:id:${ident.value}`, 10, 60_000)))
    return apiError(c, "rate_limited", 429);

  const user = await findUserByIdentifier(db, ident);

  return c.json({
    type: ident.type,
    exists: !!user,
    hasPassword: !!user?.passwordHash,
  });
});

// ── OTP ────────────────────────────────────────────────────────────────────

authOtpRoute.post("/otp/request", async (c) => {
  const parsed = identifierSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_identifier");
  const ident = detectIdentifier(parsed.data.identifier);
  if (!ident) return badRequest(c, "invalid_identifier");

  try {
    await requestOtp(getDb(c.env.DB), ident, clientIp(c), c.env);
    return c.json({ ok: true, channel: ident.type });
  } catch (err) {
    if (err instanceof OtpRateError) return apiError(c, err.code, err.status);
    console.error("otp_request_failed", err);
    return apiError(c, "otp_send_failed", 502);
  }
});

authOtpRoute.post("/otp/verify", async (c) => {
  const parsed = otpVerifySchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_request");
  const ident = detectIdentifier(parsed.data.identifier);
  if (!ident) return badRequest(c, "invalid_identifier");

  const db = getDb(c.env.DB);
  const result = await verifyOtp(db, ident, parsed.data.code, clientIp(c));
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

  const existing = await findUserByIdentifier(db, ident);
  if (!existing) {
    return c.json({ status: "needs_signup" });
  }

  // Consume BEFORE issuing the session: if the code can't be consumed (the
  // verify→consume window raced past expiration), the session must not ride
  // on a code that stays reusable for its remaining TTL.
  if (!(await consumeVerifiedOtp(db, ident)))
    return apiError(c, "otp_expired", 400);

  const { token, deviceId } = await issueSession(c, db, existing.id);
  const payload = await authPayload(db, existing.id);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, deviceId, ...payload });
});

// ── Signup — account created after OTP verify ──────────────────────────────

function isUniqueUserConflict(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed.*users\.(phone|email)/is.test(msg);
}

authOtpRoute.post("/signup", async (c) => {
  const parsed = signupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, "invalid_request");
  const ident = detectIdentifier(parsed.data.identifier);
  if (!ident) return badRequest(c, "invalid_identifier");
  const db = getDb(c.env.DB);
  if (await findUserByIdentifier(db, ident))
    return apiError(c, "user_exists", 409);

  const passwordHash = parsed.data.password
    ? await hashPassword(parsed.data.password)
    : null;

  const nowIso = toIso(new Date());
  const userId = generateId();

  // CAS consume on the verified OTP row first; only after it holds does the
  // user insert run.
  const consumed = await db
    .update(otpCodes)
    .set({ consumedAt: nowIso })
    .where(
      and(
        eq(otpCodes.identifier, ident.value),
        isNull(otpCodes.consumedAt),
        isNotNull(otpCodes.verifiedAt),
        gt(otpCodes.expiresAt, nowIso),
      ),
    )
    .run();
  if (consumed.meta.changes !== 1) return apiError(c, "otp_not_verified", 400);

  try {
    await db.insert(users).values({
      id: userId,
      phone: ident.type === "phone" ? ident.value : null,
      email: ident.type === "email" ? ident.value : null,
      name: parsed.data.name,
      passwordHash,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } catch (err) {
    if (isUniqueUserConflict(err)) return apiError(c, "user_exists", 409);
    throw err;
  }

  const { token, deviceId } = await issueSession(c, db, userId);
  const payload = await authPayload(db, userId);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, deviceId, ...payload });
});
