import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../lib/db";
import { qrLogins, users } from "../db/schema";
import { generateId, generateQrLoginCode, timingSafeEqual } from "../lib/token";
import { toIso, toDate } from "../lib/datetime";
import type { Identifier } from "../lib/identifier";
import { createSessionForUser, type DeviceMeta } from "./session";

const QR_TTL_SECONDS = 10 * 60;

export async function createQrLogin(
  d: Db,
  ident: Identifier | null,
  claimSecretHash: string,
  deviceLabel: string,
): Promise<{ id: string; code: string; expiresAt: Date }> {
  const now = new Date();
  const nowIso = toIso(now);
  const id = generateId();
  const code = generateQrLoginCode();
  const expiresAt = new Date(now.getTime() + QR_TTL_SECONDS * 1000);

  await d.insert(qrLogins).values({
    id,
    code,
    claimSecretHash,
    deviceLabel,
    status: "pending",
    identifier: ident?.value ?? null,
    grantedTo: null,
    approvedBy: null,
    approvedAt: null,
    claimedAt: null,
    expiresAt: toIso(expiresAt),
    createdAt: nowIso,
  });
  return { id, code, expiresAt };
}

/** Public info for the approve page — who is asking, and whose account.
 *  Keyed by the request id the QR URL carries; never exposes the code. */
export async function qrLoginInfo(
  d: Db,
  id: string,
): Promise<{
  status: "pending" | "approved" | "expired" | "not_found";
  targetName: string | null;
  deviceLabel: string | null;
}> {
  const rows = await d.select().from(qrLogins).where(eq(qrLogins.id, id));
  const row = rows[0];
  if (!row || row.claimedAt)
    return { status: "not_found", targetName: null, deviceLabel: null };
  if (toDate(row.expiresAt).getTime() < Date.now())
    return { status: "expired", targetName: null, deviceLabel: null };

  // Name the requesting device, never just the account: an approve screen that
  // only reads "log in as <you>" looks identical whether the QR came from your
  // own second device or from someone else's link.
  const deviceLabel = row.deviceLabel || null;

  if (!row.identifier)
    return {
      status: row.status as "pending" | "approved",
      targetName: null,
      deviceLabel,
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
      deviceLabel,
    };
  return {
    status: row.status as "pending" | "approved",
    targetName: user.name,
    deviceLabel,
  };
}

type QrApproveResult =
  | { kind: "ok"; grantedTo: string; grantedName: string | null }
  | { kind: "expired" }
  | { kind: "not_found" }
  | { kind: "unknown_target" }
  | { kind: "already_approved" }
  | { kind: "code_mismatch" };

/**
 * Two proof shapes reach the same approve: the request id plus the code's
 * last 4 characters typed off the waiting device's screen (the QR URL carries
 * only the id), or the full 16-character code typed in the in-app entry form.
 * Neither shape can be produced from a forwarded link or a screenshot.
 */
type QrApproveRef = { id: string; suffix: string } | { code: string };

/** Uppercase letters + digits only — "QRST", "qrst", and "QRST-" all count. */
function normalizeCodeText(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function suffixMatches(code: string, input: string): boolean {
  return timingSafeEqual(
    normalizeCodeText(code).slice(-4),
    normalizeCodeText(input),
  );
}

/**
 * Approve a pending QR login. Without a named identifier the waiting device
 * is logged in as the approver. With a named identifier, only the approver's
 * own account may be granted.
 */
export async function approveQrLogin(
  d: Db,
  ref: QrApproveRef,
  approver: { userId: string },
): Promise<QrApproveResult> {
  const rows =
    "id" in ref
      ? await d.select().from(qrLogins).where(eq(qrLogins.id, ref.id))
      : await d
          .select()
          .from(qrLogins)
          .where(eq(qrLogins.code, ref.code.trim().toUpperCase()));
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
    if (!target || target.id !== approver.userId) {
      return { kind: "unknown_target" };
    }
    grantUserId = target.id;
    grantedName = target.name;
  }

  // Typed confirmation, checked after the target so a non-owner never gets a
  // suffix verdict on someone else's named login.
  if ("suffix" in ref && !suffixMatches(row.code, ref.suffix))
    return { kind: "code_mismatch" };

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

type QrClaimResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "not_found" }
  | {
      status: "ok";
      userId: string;
      session: { token: string };
    };

export async function claimQrLogin(
  d: Db,
  code: string,
  /** SHA-256 of the secret the waiting device kept; null when not supplied. */
  claimSecretHash: string | null,
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

  // A screenshot or a forwarded link carries no claim secret, so it cannot
  // mint the session — and it cannot burn the code either, because this check
  // runs before the CAS below.
  if (
    !claimSecretHash ||
    !timingSafeEqual(row.claimSecretHash, claimSecretHash)
  )
    return { status: "pending" };

  if (row.status !== "approved" || !row.approvedBy || !row.grantedTo)
    return { status: "pending" };

  const claim = await d
    .update(qrLogins)
    .set({ claimedAt: toIso(new Date()) })
    .where(and(eq(qrLogins.id, row.id), isNull(qrLogins.claimedAt)))
    .run();
  // CAS: the code may already have been claimed by another device.
  if (claim.meta.changes !== 1) return { status: "not_found" };

  const { token } = await createSessionForUser(d, row.grantedTo, meta);
  return { status: "ok", userId: row.grantedTo, session: { token } };
}
