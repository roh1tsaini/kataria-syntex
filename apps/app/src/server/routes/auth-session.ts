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
  isHttpsRequest,
  type AuthContext,
  type AuthCtx,
  type AuthEnv,
} from "./auth-shared";
import { apiError } from "../lib/api-error";

export const authSessionRoute = new Hono<AuthEnv>();

// ── Authed endpoints ────────────────────────────────────────────────────────

authSessionRoute.get("/me", requireAuth, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const db = getDb(c.env.DB);
  const payload = await authPayload(db, auth.userId);
  if (!payload) return apiError(c, "unauthorized", 401);
  const deviceRows = await db
    .select()
    .from(devices)
    .where(eq(devices.id, auth.deviceId));
  const device = deviceRows[0];
  return c.json({
    ...payload,
    device: device
      ? { id: device.id, label: device.label, platform: device.platform }
      : null,
  });
});

authSessionRoute.post("/logout", requireAuth, async (c) => {
  const auth = c.get("auth") as AuthContext;
  await getDb(c.env.DB)
    .update(sessions)
    .set({ revokedAt: toIso(new Date()) })
    .where(eq(sessions.id, auth.sessionId));
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: isHttpsRequest(c) });
  return c.json({ ok: true });
});

authSessionRoute.get("/devices", requireAuth, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const list = await getDb(c.env.DB)
    .select()
    .from(devices)
    .where(and(eq(devices.userId, auth.userId), isNull(devices.revokedAt)))
    .orderBy(devices.lastSeenAt);
  return c.json({
    devices: list.map((d) => ({
      id: d.id,
      label: d.label,
      platform: d.platform,
      lastSeenAt: d.lastSeenAt,
      isCurrent: d.id === auth.deviceId,
    })),
  });
});

authSessionRoute.delete("/devices/:id", requireAuth, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const deviceId = c.req.param("id");
  const db = getDb(c.env.DB);
  const deviceRows = await db
    .select()
    .from(devices)
    .where(eq(devices.id, deviceId));
  const device = deviceRows[0];
  if (!device || device.userId !== auth.userId)
    return apiError(c, "not_found", 404);

  const nowIso = toIso(new Date());
  await db
    .update(devices)
    .set({ revokedAt: nowIso })
    .where(eq(devices.id, deviceId));
  await db
    .update(sessions)
    .set({ revokedAt: nowIso })
    .where(eq(sessions.deviceId, deviceId));

  if (deviceId === auth.deviceId) {
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: isHttpsRequest(c) });
  }
  return c.json({ ok: true, revokedCurrent: deviceId === auth.deviceId });
});
