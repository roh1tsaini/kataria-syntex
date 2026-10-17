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

/** Request-id bounds — a UUID today, validated loosely as an opaque id. */
const qrIdSchema = z.string().min(8).max(64);

/**
 * /qr/approve body. Two proof shapes: the request id plus the code's last 4
 * characters typed off the waiting screen, or the full 16-character code
 * typed in the in-app entry form. Strict objects keep the shapes from
 * blending; a forwarded link alone satisfies neither.
 */
const qrApproveSchema = z.union([
  z.object({ id: qrIdSchema, suffix: z.string().min(1).max(8) }).strict(),
  z.object({ code: z.string().min(4).max(64) }).strict(),
]);

/** /qr/start body. An absent identifier — including a missing or empty
 * body — starts an anonymous login; a present one names the account to
 * grant. Unknown keys are rejected so garbage can't masquerade as anonymous. */
const qrStartBodySchema = identifierSchema.partial().strict();

/**
 * /qr/status body. The claim secret rides here, never in the query string: a
 * URL lands in platform logs and proxy traces, and this secret is what turns
 * an approved code into a live session.
 */
const qrStatusSchema = z.object({
  code: z.string().min(4).max(64),
  claimSecret: z.string().min(16).max(128),
});

const QR_START_MAX_PER_IP = 30;
const QR_START_WINDOW_MS = 15 * 60 * 1000;
const QR_APPROVE_MAX_PER_IP = 30;
const QR_APPROVE_MAX_PER_USER = 10;
/* /qr/status polling budgets: generous enough that a full-length wait (10 min
   at 4s ≈ 150 polls) is never cut off, tight enough that hammering the route
   can't burn D1 reads. Over budget the route answers 429 instead of a silent
   "pending", so the panel can slow down and say so. */
const QR_STATUS_MAX_PER_CODE = 200;
const QR_STATUS_MAX_PER_IP = 2000;

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
  // never goes into the payload URL: the QR carries the request id alone, so
  // a screenshot or a forwarded link can neither claim the session nor
  // approve it — approval needs the code characters only this screen shows.
  const claimSecret = generateQrClaimSecret();
  const { id, code, expiresAt } = await createQrLogin(
    db,
    ident,
    await sha256Hex(claimSecret),
    buildDeviceMeta(c).label,
  );
  const origin = new URL(c.req.url).origin;
  const payloadUrl = `${origin}/login/scan/${encodeURIComponent(id)}`;
  return c.json({
    code,
    claimSecret,
    payload: payloadUrl,
    expiresAt: expiresAt.toISOString(),
  });
});

/** Public info for the scan/approve page — names who will be logged in. */
authQrRoute.get("/qr/info", async (c) => {
  const parsed = qrIdSchema.safeParse(c.req.query("id"));
  if (!parsed.success) return badRequest(c, "invalid_request");
  if (ipBudgetRemaining("qr_info", clientIp(c), 120) <= 0)
    return apiError(c, "qr_rate_limited", 429);
  recordIpAttempt("qr_info", clientIp(c));
  const info = await qrLoginInfo(getDb(c.env.DB), parsed.data);
  return c.json(info);
});

/**
 * Approve from a logged-in device.
 */
authQrRoute.post("/qr/approve", requireAuth, async (c) => {
  const parsed = qrApproveSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(c, "invalid_request");
  const auth = c.get("auth");
  const ip = clientIp(c);

  // Approve was the one QR route with no budget; typed confirmation makes
  // wrong guesses the expected abuse, and every call still touches D1.
  if (
    !(await consumeBudgetsStrict(getDb(c.env.DB), [
      {
        key: `qr:approve:ip:${await sha256Hex(ip)}`,
        max: QR_APPROVE_MAX_PER_IP,
        windowMs: QR_START_WINDOW_MS,
      },
      {
        key: `qr:approve:user:${auth.userId}`,
        max: QR_APPROVE_MAX_PER_USER,
        windowMs: QR_START_WINDOW_MS,
      },
    ]))
  )
    return apiError(c, "qr_rate_limited", 429);
  if (ipBudgetRemaining("qr_approve", ip, 120) <= 0)
    return apiError(c, "qr_rate_limited", 429);
  recordIpAttempt("qr_approve", ip);

  const db = getDb(c.env.DB);
  const result = await approveQrLogin(db, parsed.data, {
    userId: auth.userId,
  });
  if (result.kind === "expired") return apiError(c, "qr_code_expired", 400);
  if (result.kind === "not_found") return apiError(c, "qr_code_invalid", 400);
  if (result.kind === "unknown_target") return apiError(c, "forbidden", 403);
  if (result.kind === "code_mismatch")
    return apiError(c, "qr_code_mismatch", 400);
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
  const ip = clientIp(c);
  // Two budgets: per code+IP so one waiting session is never starved by other
  // traffic from the same network, and per IP as the aggregate shield for D1
  // reads. The code is normalized the same way claimQrLogin does, so casing
  // variants can't farm separate allowances.
  const codeKey = `qr_status:${code.trim().toUpperCase()}`;
  if (
    ipBudgetRemaining(codeKey, ip, QR_STATUS_MAX_PER_CODE) <= 0 ||
    ipBudgetRemaining("qr_status", ip, QR_STATUS_MAX_PER_IP) <= 0
  )
    return apiError(c, "qr_rate_limited", 429);
  recordIpAttempt(codeKey, ip);
  recordIpAttempt("qr_status", ip);
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

  const { token } = result.session;
  setSessionCookie(c, token);
  const payload = await authPayload(db, result.userId);
  if (!payload) return apiError(c, "internal_server_error", 500);
  return c.json({ status: "ok", token, ...payload });
});
