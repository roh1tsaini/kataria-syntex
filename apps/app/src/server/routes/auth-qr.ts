import { Hono } from "hono";
import { z } from "zod";

import { inArray, isNotNull, lt, or } from "drizzle-orm";
import { getDb } from "../lib/db";
import { qrLogins } from "../db/schema";

import { detectIdentifier, type Identifier } from "../lib/identifier";
import { generateQrClaimSecret, sha256Hex } from "../lib/token";
import { consumeBudgetsStrict } from "../lib/rate-limit";

import { ipBudgetRemaining, recordIpAttempt } from "../auth/otp";
import {
  createQrLogin,
  approveQrLogin,
  claimQrLogin,
  qrLoginInfo,
  QR_TTL_SECONDS,
} from "../auth/qr-login";

import { requireAuth } from "../auth/session";
import { toIso } from "../lib/datetime";
import {
  badRequest,
  buildDeviceMeta,
  clientIp,
  findUserByIdentifier,
  identifierSchema,
  setSessionCookie,
  authPayload,
  type AuthEnv,
} from "./auth-shared";
import { apiError } from "../lib/api-error";

export const authQrRoute = new Hono<AuthEnv>();

// ── QR login ────────────────────────────────────────────────────────────────

const qrLoginCodeSchema = z.object({ code: z.string().min(4).max(64) });

/** /qr/start body. An absent identifier — including a missing or empty
 * body — starts an anonymous login; a present one names the account to
 * grant. Unknown keys are rejected so garbage can't masquerade as anonymous. */
const qrStartBodySchema = identifierSchema.partial().strict();

/**
 * Query form of the login code — same bounds as qrLoginCodeSchema.
 */
const qrCodeQuerySchema = z.string().min(4).max(64);

/**
 * /qr/status body. The claim secret rides here, never in the query string: a
 * URL lands in platform logs and proxy traces, and this secret is what turns
 * an approved code into a live session.
 */
const qrStatusSchema = z.object({
  code: qrCodeQuerySchema,
  claimSecret: z.string().min(16).max(128),
});

const QR_START_MAX_PER_IP = 30;
const QR_START_WINDOW_MS = 15 * 60 * 1000;

/**
 * Start a QR login. Optional identifier: when the waiting device names an
 * account, approval grants that account if it matches the approver.
 */
authQrRoute.post("/qr/start", async (c) => {
  const ip = clientIp(c);
  // The in-memory budget below only bounds one Worker isolate. This D1 budget
  // is the one that actually caps the day: D1 free allows 100,000 rows
  // written per day and crossing it takes the database offline until 00:00
  // UTC, so an uncapped anonymous write endpoint is a whole-app outage.
  if (
    !(await consumeBudgetsStrict(getDb(c.env.DB), [
      {
        key: `qr:start:${await sha256Hex(ip)}`,
        max: QR_START_MAX_PER_IP,
        windowMs: QR_START_WINDOW_MS,
      },
    ]))
  )
    return apiError(c, "qr_rate_limited", 429);

  // Budgeted: QR rows are never deleted eagerly, so unbounded anonymous
  // starts would grow the table forever. Normal use is a handful per login.
  if (ipBudgetRemaining("qr_start", ip, 120) <= 0)
    return apiError(c, "qr_rate_limited", 429);
  recordIpAttempt("qr_start", ip);
  const db = getDb(c.env.DB);
  // Opportunistic bounded purge of expired/claimed rows — a global
  // unbounded DELETE on every anonymous start is both wasteful and a
  // free-tier D1 write spike.
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

  // A missing body parses as null and means the same thing as {} — the
  // waiting device starts an anonymous login.
  const parsed = qrStartBodySchema.safeParse(
    (await c.req.json().catch(() => null)) ?? {},
  );
  if (!parsed.success) return badRequest(c, "invalid_identifier");
  let ident: Identifier | null = null;
  if (parsed.data.identifier !== undefined) {
    ident = detectIdentifier(parsed.data.identifier);
    if (!ident) return badRequest(c, "invalid_identifier");
    const target = await findUserByIdentifier(db, ident);
    if (!target) return apiError(c, "unknown_identifier", 404);
  }

  // The secret half of the pairing. It is returned to this device only and
  // never goes into the payload URL: the QR carries the code alone, so a
  // screenshot or a forwarded link cannot be claimed by whoever holds it.
  const claimSecret = generateQrClaimSecret();
  const { code, expiresAt } = await createQrLogin(
    db,
    ident,
    await sha256Hex(claimSecret),
    buildDeviceMeta(c).label,
  );
  const origin = new URL(c.req.url).origin;
  const payloadUrl = `${origin}/login/scan/${encodeURIComponent(code)}`;
  return c.json({
    code,
    claimSecret,
    expiresIn: QR_TTL_SECONDS,
    payload: payloadUrl,
    expiresAt: expiresAt.toISOString(),
  });
});

/** Public info for the scan/approve page — names who will be logged in. */
authQrRoute.get("/qr/info", async (c) => {
  const parsed = qrCodeQuerySchema.safeParse(c.req.query("code"));
  if (!parsed.success) return badRequest(c, "invalid_code");
  const code = parsed.data;
  if (ipBudgetRemaining("qr_info", clientIp(c), 120) <= 0)
    return apiError(c, "qr_rate_limited", 429);
  recordIpAttempt("qr_info", clientIp(c));
  const info = await qrLoginInfo(getDb(c.env.DB), code);
  return c.json(info);
});

/**
 * Approve from a logged-in device.
 */
authQrRoute.post("/qr/approve", requireAuth, async (c) => {
  const parsed = qrLoginCodeSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_code");
  const auth = c.get("auth");

  const db = getDb(c.env.DB);
  const result = await approveQrLogin(db, parsed.data.code, {
    userId: auth.userId,
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
  const parsed = qrStatusSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, "invalid_code");
  const { code, claimSecret } = parsed.data;
  if (ipBudgetRemaining("qr_status", clientIp(c), 600) <= 0)
    return c.json({ status: "pending" });
  recordIpAttempt("qr_status", clientIp(c));
  const db = getDb(c.env.DB);
  const result = await claimQrLogin(
    db,
    code,
    await sha256Hex(claimSecret),
    buildDeviceMeta(c),
  );
  if (result.status === "pending") return c.json({ status: "pending" });
  if (result.status === "expired") return c.json({ status: "expired" });
  if (result.status === "not_found") return c.json({ status: "not_found" });

  const { token, deviceId } = result.session;
  setSessionCookie(c, token);
  const payload = await authPayload(db, result.userId);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, deviceId, ...payload });
});
