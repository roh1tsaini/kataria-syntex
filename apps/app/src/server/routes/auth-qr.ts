import { Hono } from "hono";
import { z } from "zod";
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
import { detectIdentifier, type Identifier } from "../lib/identifier";
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
  isHttpsRequest,
  type AuthContext,
  type AuthCtx,
  type AuthEnv,
} from "./auth-shared";
import { apiError } from "../lib/api-error";

export const authQrRoute = new Hono<AuthEnv>();

// ── QR login ────────────────────────────────────────────────────────────────

const qrLoginCodeSchema = z.object({ code: z.string().min(4).max(64) });

/**
 * Start a QR login. Optional identifier: when the waiting device names an
 * account (OTP-quota fallback), approval grants THAT account instead of the
 * approver's own. Unknown identifiers are rejected.
 */
authQrRoute.post("/qr/start", async (c) => {
  // Budgeted: QR rows are never deleted eagerly, so unbounded anonymous
  // starts would grow the table forever. Normal use is a handful per login.
  if (ipBudgetRemaining("qr_start", clientIp(c), 120) <= 0)
    return apiError(c, "qr_rate_limited", 429);
  recordIpAttempt("qr_start", clientIp(c));
  const db = getDb(c.env.DB);
  // Opportunistic bounded purge of expired/claimed rows (same pattern as
  // loginAttempts pruning) — a global unbounded DELETE on every anonymous
  // start is both wasteful and a free-tier D1 write spike.
  const staleRows = await db
    .select({ id: qrLogins.id })
    .from(qrLogins)
    .where(
      or(
        lt(qrLogins.expiresAt, toIso(new Date())),
        isNotNull(qrLogins.claimedAt),
      ),
    )
    .limit(500);
  if (staleRows.length > 0)
    await db.delete(qrLogins).where(
      inArray(
        qrLogins.id,
        staleRows.map((r) => r.id),
      ),
    );

  const body = await c.req.json().catch(() => null);
  let ident: Identifier | null = null;
  if (body && typeof body === "object" && "identifier" in body) {
    const parsed = identifierSchema.safeParse(body);
    if (!parsed.success) return badRequest(c, "invalid_identifier");
    ident = detectIdentifier(parsed.data.identifier);
    if (!ident) return badRequest(c, "invalid_identifier");
    const target = await findUserByIdentifier(db, ident);
    if (!target) return apiError(c, "unknown_identifier", 404);
  }

  // QR creation is unlimited: a pending code grants nothing until an
  // authenticated device approves it, and codes are unguessable (2^79).
  const { code, expiresAt } = await createQrLogin(db, clientIp(c), ident);
  const origin = new URL(c.req.url).origin;
  const payloadUrl = `${origin}/login/scan/${encodeURIComponent(code)}`;
  return c.json({
    code,
    expiresIn: QR_TTL_SECONDS,
    payload: payloadUrl,
    expiresAt: expiresAt.toISOString(),
  });
});

/** Public info for the scan/approve page — names who will be logged in. */
authQrRoute.get("/qr/info", async (c) => {
  const code = c.req.query("code") ?? "";
  if (ipBudgetRemaining("qr_info", clientIp(c), 120) <= 0)
    return apiError(c, "qr_rate_limited", 429);
  recordIpAttempt("qr_info", clientIp(c));
  const info = await qrLoginInfo(getDb(c.env.DB), code);
  return c.json(info);
});

/**
 * Approve from a logged-in device. Granting someone else's account (the
 * named-identifier fallback) requires that person to belong to — or be
 * invited into — the approver's workspace.
 */
authQrRoute.post("/qr/approve", requireAuth, async (c) => {
  const parsed = qrLoginCodeSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_code");
  const auth = c.get("auth") as AuthContext;

  const db = getDb(c.env.DB);
  const memRows = await db
    .select({
      workspaceId: memberships.workspaceId,
      isPrimaryAdmin: memberships.isPrimaryAdmin,
    })
    .from(memberships)
    .where(eq(memberships.userId, auth.userId));
  const membership = memRows[0];

  const result = await approveQrLogin(db, parsed.data.code, {
    userId: auth.userId,
    workspaceId: membership?.workspaceId ?? "",
  });
  if (result.kind === "expired") return apiError(c, "qr_code_expired", 400);
  if (result.kind === "not_found") return apiError(c, "qr_code_invalid", 400);
  if (result.kind === "unknown_target") return apiError(c, "forbidden", 403);
  if (result.kind === "already_approved")
    return apiError(c, "qr_already_approved", 409);
  return c.json({
    status: "ok",
    grantedTo: result.grantedTo,
    grantedName: result.grantedName,
    grantedSelf: result.grantedTo === auth.userId,
  });
});

authQrRoute.post("/qr/status", async (c) => {
  const code = c.req.query("code") ?? "";
  if (ipBudgetRemaining("qr_status", clientIp(c), 600) <= 0)
    return c.json({ status: "pending" });
  recordIpAttempt("qr_status", clientIp(c));
  const db = getDb(c.env.DB);
  const result = await claimQrLogin(db, code, buildDeviceMeta(c));
  if (result.status === "pending") return c.json({ status: "pending" });
  if (result.status === "expired") return c.json({ status: "expired" });
  if (result.status === "not_found") return c.json({ status: "not_found" });

  const { token, deviceId } = result.session;
  setSessionCookie(c, token);
  const payload = await authPayload(db, result.userId);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, deviceId, ...payload });
});
