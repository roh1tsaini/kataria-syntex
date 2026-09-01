import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../lib/db";
import { invites, memberships, qrLogins, users } from "../db/schema";
import { generateId, generateQrLoginCode } from "../lib/token";
import { toIso, toDate } from "../lib/datetime";
import type { Identifier } from "../lib/identifier";
import { createSessionForUser, type DeviceMeta } from "./session";

export const QR_TTL_SECONDS = 10 * 60;

export async function createQrLogin(
  d: Db,
  ip: string,
  ident: Identifier | null,
): Promise<{ code: string; expiresAt: Date }> {
  const now = new Date();
  const nowIso = toIso(now);
  const code = generateQrLoginCode();
  const expiresAt = new Date(now.getTime() + QR_TTL_SECONDS * 1000);

  await d.insert(qrLogins).values({
    id: generateId(),
    code,
    ip,
    status: "pending",
    identifier: ident?.value ?? null,
    grantedTo: null,
    approvedBy: null,
    approvedAt: null,
    claimedAt: null,
    expiresAt: toIso(expiresAt),
    createdAt: nowIso,
  });
  return { code, expiresAt };
}

/** Public info for the approve page — who is asking to log in. */
export async function qrLoginInfo(
  d: Db,
  code: string,
): Promise<{
  status: "pending" | "approved" | "expired" | "not_found";
  targetName: string | null;
}> {
  const rows = await d
    .select()
    .from(qrLogins)
    .where(eq(qrLogins.code, code.trim().toUpperCase()));
  const row = rows[0];
  if (!row || row.claimedAt) return { status: "not_found", targetName: null };
  if (toDate(row.expiresAt).getTime() < Date.now())
    return { status: "expired", targetName: null };

  if (!row.identifier)
    return {
      status: row.status as "pending" | "approved",
      targetName: null,
    };

  // Named login — resolve the display name of the account to be granted.
  const column = row.identifier.includes("@") ? users.email : users.phone;
  const userRows = await d
    .select({ name: users.name })
    .from(users)
    .where(eq(column, row.identifier));
  const user = userRows[0];
  if (!user)
    return {
      status: row.status as "pending" | "approved",
      targetName: null,
    };
  return {
    status: row.status as "pending" | "approved",
    targetName: user.name,
  };
}

export type QrApproveResult =
  | { kind: "ok"; grantedTo: string; grantedName: string | null }
  | { kind: "expired" }
  | { kind: "not_found" }
  | { kind: "unknown_target" }
  | { kind: "already_approved" };

/**
 * Approve a pending QR login. Without a named identifier the scanning device
 * is logged in as the approver. With one, the named account is granted —
 * which requires the target to belong to the approver's workspace (member or
 * primary admin) or hold a pending invite to it. A manager can never mint a
 * session for an unrelated account elsewhere in the database.
 */
export async function approveQrLogin(
  d: Db,
  code: string,
  approver: { userId: string; workspaceId: string },
): Promise<QrApproveResult> {
  const normalized = code.trim().toUpperCase();
  const rows = await d
    .select()
    .from(qrLogins)
    .where(eq(qrLogins.code, normalized));
  const row = rows[0];

  if (!row || row.claimedAt) return { kind: "not_found" };
  if (toDate(row.expiresAt).getTime() < Date.now()) return { kind: "expired" };

  let grantUserId = approver.userId;
  let grantedName: string | null = null;

  if (row.identifier) {
    const column = row.identifier.includes("@") ? users.email : users.phone;
    const userRows = await d
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(column, row.identifier));
    const target = userRows[0];
    if (!target) return { kind: "unknown_target" };
    // Granting your own account never needs permission; granting someone
    // else's requires them to already belong to (or be invited into) YOUR
    // workspace.
    if (target.id !== approver.userId) {
      const memRows = await d
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, approver.workspaceId),
            eq(memberships.userId, target.id),
          ),
        )
        .limit(1);
      const invRows = await d
        .select({ id: invites.id })
        .from(invites)
        .where(
          and(
            eq(invites.workspaceId, approver.workspaceId),
            isNull(invites.consumedAt),
            eq(
              row.identifier.includes("@") ? invites.email : invites.phone,
              row.identifier,
            ),
          ),
        )
        .limit(1);
      if (!memRows[0] && !invRows[0]) return { kind: "unknown_target" };
    }
    grantUserId = target.id;
    grantedName = target.name;
  }

  if (row.status === "approved" && row.grantedTo === grantUserId)
    return { kind: "ok", grantedTo: grantUserId, grantedName };

  // CAS on status='pending' — concurrent approves must not overwrite each
  // other's grantedTo.
  const updated = await d
    .update(qrLogins)
    .set({
      status: "approved",
      grantedTo: grantUserId,
      approvedBy: approver.userId,
      approvedAt: toIso(new Date()),
    })
    .where(and(eq(qrLogins.id, row.id), eq(qrLogins.status, "pending")))
    .run();
  if (updated.meta.changes === 0) {
    const freshRows = await d
      .select({ grantedTo: qrLogins.grantedTo })
      .from(qrLogins)
      .where(eq(qrLogins.id, row.id));
    if (freshRows[0]?.grantedTo === grantUserId)
      return { kind: "ok", grantedTo: grantUserId, grantedName };
    return { kind: "already_approved" };
  }
  return { kind: "ok", grantedTo: grantUserId, grantedName };
}

export type QrClaimResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "not_found" }
  | {
      status: "ok";
      userId: string;
      session: { token: string; deviceId: string; sessionId: string };
    };

export async function claimQrLogin(
  d: Db,
  code: string,
  meta: DeviceMeta,
): Promise<QrClaimResult> {
  const normalized = code.trim().toUpperCase();
  const rows = await d
    .select()
    .from(qrLogins)
    .where(eq(qrLogins.code, normalized));
  const row = rows[0];

  if (!row || row.claimedAt) return { status: "not_found" };
  if (toDate(row.expiresAt).getTime() < Date.now())
    return { status: "expired" };
  if (row.status !== "approved" || !row.approvedBy || !row.grantedTo)
    return { status: "pending" };

  const claim = await d
    .update(qrLogins)
    .set({ claimedAt: toIso(new Date()) })
    .where(and(eq(qrLogins.id, row.id), isNull(qrLogins.claimedAt)))
    .run();
  // CAS: the code may already have been claimed by another device.
  if (claim.meta.changes !== 1) return { status: "not_found" };

  const session = await createSessionForUser(d, row.grantedTo, meta);
  return { status: "ok", userId: row.grantedTo, session };
}
