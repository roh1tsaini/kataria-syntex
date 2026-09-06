import type { ApiCode } from "@kataria-syntex/shared";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../lib/db";
import type { Env } from "../env";
import { otpCodes } from "../db/schema";
import { generateId, generateOtpCode, sha256Hex } from "../lib/token";
import { toIso, toDate } from "../lib/datetime";
import type { Identifier } from "../lib/identifier";
import { sendOtpSms, sendOtpEmail } from "../lib/pingram";

const OTP_TTL_SECONDS = 5 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_MAX_ATTEMPTS = 3;
const OTP_MAX_PER_HOUR = 5;
// Daily ceilings — the SMS/email sender is PAID per message; without these a
// scraped identifier list can pump spend even within hourly limits.
const OTP_MAX_PER_DAY = 12;

/** Bindings requestOtp needs — passed down from the route's c.env. */
type OtpEnv = Pick<Env, "PINGRAM_API_KEY" | "OTP_DAILY_BUDGET">;

const OTP_MAX_VERIFY_ATTEMPTS_PER_IP = 30;
const OTP_MAX_REQUESTS_PER_IP = 10;
const OTP_IP_WINDOW_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export class OtpRateError extends Error {
  constructor(
    public readonly status: 400 | 429 | 502,
    public readonly code: ApiCode,
  ) {
    super(code);
  }
}

export async function requestOtp(
  d: Db,
  ident: Identifier,
  ip: string,
  env: OtpEnv,
): Promise<void> {
  const now = new Date();
  const nowIso = toIso(now);

  if (ipBudgetRemaining("otp_request", ip, OTP_MAX_REQUESTS_PER_IP) <= 0) {
    throw new OtpRateError(429, "otp_rate_limit_ip");
  }
  recordIpAttempt("otp_request", ip);

  // One query serves all three ceilings: per-identifier hourly, per-identifier
  // daily, and the global daily spend kill-switch — via conditional sums over
  // codes created in the last 24h.
  const maxPerDayGlobal = Number(env.OTP_DAILY_BUDGET ?? "300");
  const counts = await d
    .select({
      hourly:
        sql<number>`SUM(CASE WHEN ${otpCodes.createdAt} > ${toIso(new Date(now.getTime() - 3_600_000))} THEN 1 ELSE 0 END)`.mapWith(
          Number,
        ),
      daily: sql<number>`COUNT(*)`.mapWith(Number),
      globalDaily:
        sql<number>`(SELECT COUNT(*) FROM ${otpCodes} WHERE ${otpCodes.createdAt} > ${toIso(new Date(now.getTime() - DAY_MS))})`.mapWith(
          Number,
        ),
    })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.identifier, ident.value),
        gt(otpCodes.createdAt, toIso(new Date(now.getTime() - DAY_MS))),
      ),
    )
    .limit(1);
  if ((counts[0]?.globalDaily ?? 0) >= maxPerDayGlobal) {
    throw new OtpRateError(502, "otp_budget_exhausted");
  }
  if ((counts[0]?.daily ?? 0) >= OTP_MAX_PER_DAY) {
    throw new OtpRateError(429, "otp_rate_limit_daily");
  }
  if ((counts[0]?.hourly ?? 0) >= OTP_MAX_PER_HOUR) {
    throw new OtpRateError(429, "otp_rate_limit_hourly");
  }

  const latest = await d
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.identifier, ident.value))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (
    latest[0] &&
    now.getTime() - toDate(latest[0].createdAt).getTime() <
      OTP_RESEND_COOLDOWN_SECONDS * 1000
  ) {
    throw new OtpRateError(429, "otp_resend_cooldown");
  }

  // Invalidate any still-active codes by marking them consumed — the rows
  // stay, because the hourly/daily ceilings above count every code actually
  // SENT (deleting them here would reset the budgets on every request).
  await d
    .update(otpCodes)
    .set({ consumedAt: nowIso })
    .where(
      and(eq(otpCodes.identifier, ident.value), isNull(otpCodes.consumedAt)),
    );
  // Housekeeping: prune only rows past the daily window so accounting holds.
  await d
    .delete(otpCodes)
    .where(
      and(
        eq(otpCodes.identifier, ident.value),
        lt(otpCodes.createdAt, toIso(new Date(now.getTime() - DAY_MS))),
      ),
    );

  const code = generateOtpCode();

  const apiKey = env.PINGRAM_API_KEY;
  if (!apiKey) throw new OtpRateError(502, "otp_send_failed");

  // Insert before send: the ceilings count rows, so a paid message must
  // always land on a counted row, and a failed send must never leave a sent
  // code that can never verify.
  const otpId = generateId();
  await d.insert(otpCodes).values({
    id: otpId,
    identifier: ident.value,
    // Only the hash is stored — a leaked DB file/backup never yields a
    // usable live code (owner mandate).
    code: await sha256Hex(code),
    attempts: 0,
    expiresAt: toIso(new Date(now.getTime() + OTP_TTL_SECONDS * 1000)),
    createdAt: nowIso,
  });

  try {
    if (ident.type === "email") {
      await sendOtpEmail(apiKey, ident.value, code);
    } else {
      await sendOtpSms(apiKey, ident.value, code);
    }
  } catch (err) {
    // The message never went out — un-charge the budget and drop the row so
    // no unverifiable code lingers.
    await d.delete(otpCodes).where(eq(otpCodes.id, otpId));
    console.error("otp_send_failed", err);
    throw new OtpRateError(502, "otp_send_failed");
  }
}

const ipWindows = new Map<string, Map<string, number[]>>();
const IP_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

/** Drops IPs with no recent activity so the in-memory map can't grow forever
 * (keys come from client-controlled data when behind a proxy). */
function sweepStaleIps(): void {
  const now = Date.now();
  if (now - lastSweep < IP_SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [ip, byKey] of ipWindows) {
    let alive = false;
    for (const [key, times] of byKey) {
      const fresh = times.filter((t) => t > now - OTP_IP_WINDOW_MS);
      if (fresh.length === 0) byKey.delete(key);
      else {
        byKey.set(key, fresh);
        alive = true;
      }
    }
    if (!alive) ipWindows.delete(ip);
  }
}

function pruneWindow(ip: string, key: string): number[] {
  sweepStaleIps();
  const now = Date.now();
  const byKey = ipWindows.get(ip) ?? new Map<string, number[]>();
  const recent = (byKey.get(key) ?? []).filter(
    (t) => t > now - OTP_IP_WINDOW_MS,
  );
  byKey.set(key, recent);
  ipWindows.set(ip, byKey);
  return recent;
}

export function ipBudgetRemaining(
  key: string,
  ip: string,
  max: number,
): number {
  return Math.max(0, max - pruneWindow(ip, key).length);
}

export function recordIpAttempt(key: string, ip: string): void {
  const recent = pruneWindow(ip, key);
  recent.push(Date.now());
  const byKey = ipWindows.get(ip) ?? new Map<string, number[]>();
  byKey.set(key, recent);
  ipWindows.set(ip, byKey);
}

async function findLatestActiveOtp(
  d: Db,
  identifier: string,
): Promise<typeof otpCodes.$inferSelect | undefined> {
  const rows = await d
    .select()
    .from(otpCodes)
    .where(
      and(eq(otpCodes.identifier, identifier), isNull(otpCodes.consumedAt)),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  return rows[0];
}

export type OtpVerifyResult =
  | { status: "valid" }
  | { status: "invalid"; attemptsLeft: number }
  | { status: "expired" }
  | { status: "attempts_exhausted" }
  | { status: "not_found" }
  | { status: "ip_rate_limited" };

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function verifyOtp(
  d: Db,
  ident: Identifier,
  code: string,
  ip: string,
): Promise<OtpVerifyResult> {
  if (
    ipBudgetRemaining("otp_verify", ip, OTP_MAX_VERIFY_ATTEMPTS_PER_IP) <= 0
  ) {
    return { status: "ip_rate_limited" };
  }
  recordIpAttempt("otp_verify", ip);

  const row = await findLatestActiveOtp(d, ident.value);

  if (!row) return { status: "not_found" };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { status: "attempts_exhausted" };
  if (toDate(row.expiresAt).getTime() < Date.now())
    return { status: "expired" };

  if (!(await timingSafeEqual(row.code, await sha256Hex(code)))) {
    // Atomic increment — a JS read-modify-write would let parallel guesses
    // all read the same count and bypass OTP_MAX_ATTEMPTS.
    const attempts = row.attempts + 1;
    await d
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, row.id));
    return {
      status: "invalid",
      attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - attempts),
    };
  }

  await d
    .update(otpCodes)
    .set({ verifiedAt: toIso(new Date()) })
    .where(eq(otpCodes.id, row.id));
  return { status: "valid" };
}

export async function consumeVerifiedOtp(
  d: Db,
  ident: Identifier,
): Promise<boolean> {
  const row = await findLatestActiveOtp(d, ident.value);

  if (!row || !row.verifiedAt) return false;
  if (toDate(row.expiresAt).getTime() < Date.now()) return false;

  // CAS one-shot: a parallel login racing the same verified code must not
  // also mint a session.
  const res = await d
    .update(otpCodes)
    .set({ consumedAt: toIso(new Date()) })
    .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt)))
    .run();
  return res.meta.changes === 1;
}
