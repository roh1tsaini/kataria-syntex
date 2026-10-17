import { Hono } from "hono";

import { and, eq, gt, isNull, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { users, otpCodes } from "../db/schema";

import { detectIdentifier } from "../lib/identifier";
import { hashPassword, isUsablePasswordHash } from "../lib/password";
import { generateId, sha256Hex } from "../lib/token";
import { consumeBudget } from "../lib/rate-limit";
import {
  OTP_MAX_ATTEMPTS,
  requestOtp,
  verifyOtp,
  consumeVerifiedOtp,
  findLatestActiveOtp,
  timingSafeEqual,
  OtpRateError,
  ipBudgetRemaining,
  recordIpAttempt,
} from "../auth/otp";

import { toIso, toDate } from "../lib/datetime";
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
import {
  publicSignupAllowed,
  registrationsEnabled,
} from "../auth/registration";

export const authOtpRoute = new Hono<AuthEnv>();

// ── Lookup — drives the smart routing ────────────────────────────────

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
  const ipHash = await sha256Hex(clientIp(c));
  const identifierHash = await sha256Hex(ident.value);
  if (!(await consumeBudget(db, `lookup:ip:${ipHash}`, 30, 60_000)))
    return apiError(c, "rate_limited", 429);
  if (!(await consumeBudget(db, `lookup:id:${identifierHash}`, 10, 60_000)))
    return apiError(c, "rate_limited", 429);

  const user = await findUserByIdentifier(db, ident);
  const open = user ? true : await registrationsEnabled(c.env.DB);

  return c.json({
    exists: !!user,
    hasPassword: !!user && isUsablePasswordHash(user.passwordHash),
    registrationClosed: !user && !open,
  });
});

// ── OTP ──────────────────────────────────────────────────────────────

authOtpRoute.post("/otp/request", async (c) => {
  const parsed = identifierSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_identifier");
  const ident = detectIdentifier(parsed.data.identifier);
  if (!ident) return badRequest(c, "invalid_identifier");

  const ip = clientIp(c);
  if (ipBudgetRemaining("otp_request", ip, 10) <= 0)
    return apiError(c, "otp_rate_limit_ip", 429);
  recordIpAttempt("otp_request", ip);

  try {
    const db = getDb(c.env.DB);
    const user = await findUserByIdentifier(db, ident);
    if (!user && !(await registrationsEnabled(c.env.DB)))
      return apiError(c, "registration_closed", 403);

    const waitUntil = (promise: Promise<unknown>) => {
      try {
        c.executionCtx.waitUntil(promise);
      } catch {
        void promise;
      }
    };
    await requestOtp(db, ident, ip, c.env, waitUntil);
    return c.json({ ok: true, channel: ident.type });
  } catch (err) {
    if (err instanceof OtpRateError) return apiError(c, err.code, err.status);
    console.error("otp_request_failed");
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

  const { token } = await issueSession(c, db, existing.id);
  const payload = await authPayload(db, existing.id);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, ...payload });
});

// ── Signup — account created after OTP verify ────────────────────────

function isUniqueUserConflict(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed.*users\.(phone|email)/is.test(msg);
}

authOtpRoute.post("/signup", async (c) => {
  const ip = clientIp(c);
  if (ipBudgetRemaining("signup", ip, 20) <= 0)
    return apiError(c, "rate_limited", 429);
  recordIpAttempt("signup", ip);

  const parsed = signupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, "invalid_request");
  const ident = detectIdentifier(parsed.data.identifier);
  if (!ident) return badRequest(c, "invalid_identifier");

  const db = getDb(c.env.DB);
  const ipHash = await sha256Hex(ip);
  const identifierHash = await sha256Hex(ident.value);
  if (!(await consumeBudget(db, `signup:ip:${ipHash}`, 20, 60_000)))
    return apiError(c, "rate_limited", 429);
  if (!(await consumeBudget(db, `signup:id:${identifierHash}`, 10, 60_000)))
    return apiError(c, "rate_limited", 429);

  if (await findUserByIdentifier(db, ident))
    return apiError(c, "user_exists", 409);
  if (!(await registrationsEnabled(c.env.DB)))
    return apiError(c, "registration_closed", 403);

  const row = await findLatestActiveOtp(db, ident.value);
  if (!row) return apiError(c, "otp_not_verified", 400);
  if (row.attempts >= OTP_MAX_ATTEMPTS)
    return apiError(c, "otp_attempts_exhausted", 429);
  const now = new Date();
  const nowIso = toIso(now);
  if (toDate(row.expiresAt).getTime() <= now.getTime())
    return apiError(c, "otp_expired", 400);

  // Signup must prove possession again.
  const otpHash = await sha256Hex(parsed.data.code);
  if (!timingSafeEqual(row.code, otpHash)) {
    await db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(
        and(
          eq(otpCodes.id, row.id),
          isNull(otpCodes.consumedAt),
          lt(otpCodes.attempts, OTP_MAX_ATTEMPTS),
          gt(otpCodes.expiresAt, nowIso),
        ),
      )
      .run();
    return apiError(c, "invalid_code", 400);
  }

  if (!row.verifiedAt) {
    return apiError(c, "otp_not_verified", 400);
  }

  // Reject unverified requests before spending Worker CPU on Argon2id.
  const passwordHash = await hashPassword(parsed.data.password);
  const userId = generateId();
  const registrationOpen = publicSignupAllowed();

  try {
    // D1 batches run transactionally: the OTP is consumed only if the user
    // insert also succeeds, and only one concurrent signup can win the CAS.
    const results = await db.batch([
      db
        .update(otpCodes)
        .set({ consumedAt: nowIso })
        .where(
          and(
            eq(otpCodes.identifier, ident.value),
            eq(otpCodes.id, row.id),
            eq(otpCodes.code, otpHash),
            isNull(otpCodes.consumedAt),
            isNotNull(otpCodes.verifiedAt),
            lt(otpCodes.attempts, OTP_MAX_ATTEMPTS),
            gt(otpCodes.expiresAt, nowIso),
            registrationOpen,
          ),
        ),
      db.insert(users).select(
        db
          .select({
            id: sql<string>`${userId}`.as("id"),
            phone: sql<
              string | null
            >`${ident.type === "phone" ? ident.value : null}`.as("phone"),
            email: sql<
              string | null
            >`${ident.type === "email" ? ident.value : null}`.as("email"),
            name: sql<string>`${parsed.data.name}`.as("name"),
            passwordHash: sql<string>`${passwordHash}`.as("password_hash"),
            createdAt: sql<string>`${nowIso}`.as("created_at"),
            updatedAt: sql<string>`${nowIso}`.as("updated_at"),
          })
          .from(otpCodes)
          .where(
            and(
              eq(otpCodes.id, row.id),
              eq(otpCodes.identifier, ident.value),
              eq(otpCodes.code, otpHash),
              eq(otpCodes.consumedAt, nowIso),
              isNotNull(otpCodes.verifiedAt),
              lt(otpCodes.attempts, OTP_MAX_ATTEMPTS),
              gt(otpCodes.expiresAt, nowIso),
              registrationOpen,
            ),
          ),
      ),
    ]);
    if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) {
      if (!(await registrationsEnabled(c.env.DB)))
        return apiError(c, "registration_closed", 403);
      return apiError(c, "otp_not_verified", 400);
    }
  } catch (err) {
    if (isUniqueUserConflict(err)) return apiError(c, "user_exists", 409);
    throw err;
  }

  const { token } = await issueSession(c, db, userId);
  const payload = await authPayload(db, userId);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, ...payload });
});
