import { createMiddleware } from "hono/factory";
import { toIso } from "../lib/datetime";
import { getCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Db } from "../lib/db";
import type { Env } from "../env";
import { devices, sessions } from "../db/schema";
import { generateId, generateToken, sha256Hex } from "../lib/token";
import { apiError } from "../lib/api-error";

export type AuthContext = {
  userId: string;
  sessionId: string;
  deviceId: string;
};

export type AuthVariables = {
  auth?: AuthContext;
};

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr);
}

export const requireAuth = createMiddleware<
  { Bindings: Env } & { Variables: AuthVariables }
>(async (c, next) => {
  const token =
    getCookie(c, "kc_session") ??
    c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return apiError(c, "unauthorized", 401);

  const db = getDb(c.env.DB);
  const tokenHash = await sha256Hex(token);
  const sessionsRows = await db
    .select({
      id: sessions.id,
      deviceId: sessions.deviceId,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
    })
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash));
  const session = sessionsRows[0];

  if (!session || session.revokedAt) return apiError(c, "unauthorized", 401);

  const now = new Date();
  const expiresAt = toDate(session.expiresAt);
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return apiError(c, "unauthorized", 401);
  }

  const deviceRows = await db
    .select({
      id: devices.id,
      userId: devices.userId,
      revokedAt: devices.revokedAt,
      lastSeenAt: devices.lastSeenAt,
    })
    .from(devices)
    .where(eq(devices.id, session.deviceId));
  const device = deviceRows[0];

  if (!device || device.revokedAt) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return apiError(c, "unauthorized", 401);
  }

  // lastSeenAt is presence info, not per-request state — throttle the
  // write so an active session costs at most one D1 write per 5 minutes.
  const lastSeen = toDate(device.lastSeenAt);
  if (!lastSeen || now.getTime() - lastSeen.getTime() > 5 * 60 * 1000) {
    await db
      .update(devices)
      .set({ lastSeenAt: toIso(now) })
      .where(eq(devices.id, device.id));
  }

  c.set("auth", {
    userId: device.userId,
    sessionId: session.id,
    deviceId: device.id,
  });
  await next();
});

export type DeviceMeta = {
  label: string;
  platform: string;
  userAgent?: string;
};

export async function createSessionForUser(
  d: Db,
  userId: string,
  meta: DeviceMeta,
): Promise<{ token: string; deviceId: string; sessionId: string }> {
  const now = new Date();
  const nowIso = toIso(now);

  const deviceRows = await d
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.userId, userId),
        eq(devices.label, meta.label),
        eq(devices.platform, meta.platform),
        isNull(devices.revokedAt),
      ),
    );
  let device = deviceRows[0];

  if (!device) {
    const deviceId = generateId();
    const row = {
      id: deviceId,
      userId,
      label: meta.label,
      platform: meta.platform,
      userAgent: meta.userAgent ?? null,
      createdAt: nowIso,
      lastSeenAt: nowIso,
      revokedAt: null,
    };
    await d.insert(devices).values(row);
    device = row;
  }

  const token = generateToken();
  const sessionId = generateId();
  await d.insert(sessions).values({
    id: sessionId,
    deviceId: device.id,
    tokenHash: await sha256Hex(token),
    createdAt: nowIso,
    expiresAt: toIso(new Date(now.getTime() + SESSION_TTL_MS)),
  });

  return { token, deviceId: device.id, sessionId };
}
