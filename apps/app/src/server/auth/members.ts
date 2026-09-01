import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db, Queryable } from "../lib/db";
import {
  invites,
  memberships,
  memberPermissions,
  users,
  devices,
  sessions,
  type Permission,
} from "../db/schema";
import { ALL_PERMISSIONS } from "@kataria-syntex/shared";
import { generateId } from "../lib/token";
import { toIso } from "../lib/datetime";
import type { Identifier } from "../lib/identifier";

function parsePermissions(raw: string): Permission[] {
  try {
    const arr = JSON.parse(raw) as string[];
    return arr.filter((p): p is Permission =>
      (ALL_PERMISSIONS as readonly string[]).includes(p),
    );
  } catch {
    return [];
  }
}

/** Pre-add a member: a permissions row keyed by phone/email, no codes.
 * Expires after INVITE_TTL_DAYS so recycled numbers can't join with stale
 * permissions years later (owner decision 2026-08-25). */
const INVITE_TTL_DAYS = 30;

export async function addPendingMember(
  d: Db,
  workspaceId: string,
  invitedBy: string,
  ident: Identifier,
  permissions: Permission[],
): Promise<void> {
  const now = new Date();
  await d.insert(invites).values({
    id: generateId(),
    workspaceId,
    phone: ident.type === "phone" ? ident.value : null,
    email: ident.type === "email" ? ident.value : null,
    permissions: JSON.stringify(permissions),
    invitedBy,
    expiresAt: toIso(
      new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    ),
    createdAt: toIso(now),
  });
}

export type PendingMemberRow = {
  id: string;
  identifier: string;
  permissions: Permission[];
};

export async function listPendingMembers(
  d: Db,
  workspaceId: string,
): Promise<PendingMemberRow[]> {
  const rows = await d
    .select()
    .from(invites)
    .where(
      and(eq(invites.workspaceId, workspaceId), isNull(invites.consumedAt)),
    );
  return rows.map((r) => ({
    id: r.id,
    identifier: r.phone ?? r.email ?? "",
    permissions: parsePermissions(r.permissions),
  }));
}

/**
 * Find the unconsumed pre-add matching an identifier (any workspace).
 * Used at signup/first-login to attach the person to the right workspace.
 */
export async function findPendingMembership(
  d: Db,
  ident: Identifier,
): Promise<{
  id: string;
  workspaceId: string;
  permissions: Permission[];
} | null> {
  const nowIso = toIso(new Date());
  const column = ident.type === "phone" ? invites.phone : invites.email;
  const rows = await d
    .select()
    .from(invites)
    .where(and(eq(column, ident.value), isNull(invites.consumedAt)))
    .orderBy(invites.createdAt);
  // Expired pre-adds are dead — skip them (and don't consume; the owner may
  // re-add the person fresh).
  const row = rows.find(
    (r) => !r.expiresAt || new Date(r.expiresAt).getTime() > Date.now(),
  );
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    permissions: parsePermissions(row.permissions),
  };
}

/** Atomically consume one specific pre-add row (CAS on consumedAt). */
export async function consumePendingMembership(
  d: Queryable,
  inviteId: string,
): Promise<boolean> {
  const nowIso = toIso(new Date());
  const consumed = await d
    .update(invites)
    .set({ consumedAt: nowIso })
    .where(and(eq(invites.id, inviteId), isNull(invites.consumedAt)))
    .run();
  return consumed.meta.changes >= 1;
}

/** Attach an existing user to a workspace with permissions (pre-add fast path). */
export async function attachExistingUser(
  d: Db,
  userId: string,
  workspaceId: string,
  permissions: Permission[],
): Promise<void> {
  const nowIso = toIso(new Date());
  await d
    .insert(memberships)
    .values({ userId, workspaceId, isPrimaryAdmin: false, joinedAt: nowIso })
    .onConflictDoNothing();
  for (const perm of permissions) {
    await d
      .insert(memberPermissions)
      .values({ userId, workspaceId, permission: perm })
      .onConflictDoNothing();
  }
}

export type MemberRow = {
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  isPrimaryAdmin: boolean;
  permissions: Permission[];
  joinedAt: string;
};

export async function listMembers(
  d: Db,
  workspaceId: string,
): Promise<MemberRow[]> {
  const memRows = await d
    .select({
      userId: memberships.userId,
      isPrimaryAdmin: memberships.isPrimaryAdmin,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(memberships.joinedAt);

  if (memRows.length === 0) return [];
  const userIds = memRows.map((m) => m.userId);
  const userRows = await d
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const permRows = await d
    .select({
      userId: memberPermissions.userId,
      permission: memberPermissions.permission,
    })
    .from(memberPermissions)
    .where(
      and(
        eq(memberPermissions.workspaceId, workspaceId),
        inArray(memberPermissions.userId, userIds),
      ),
    );
  const permsByUser = new Map<string, Permission[]>();
  for (const r of permRows) {
    const perm = r.permission as Permission;
    if (!(ALL_PERMISSIONS as readonly string[]).includes(perm)) continue;
    const list = permsByUser.get(r.userId) ?? [];
    list.push(perm);
    permsByUser.set(r.userId, list);
  }

  const result: MemberRow[] = [];
  for (const mem of memRows) {
    const user = userById.get(mem.userId);
    if (!user) continue;
    const permissions = mem.isPrimaryAdmin
      ? []
      : (permsByUser.get(mem.userId) ?? []);
    result.push({
      userId: mem.userId,
      name: user.name,
      phone: user.phone,
      email: user.email,
      isPrimaryAdmin: mem.isPrimaryAdmin,
      permissions,
      joinedAt: mem.joinedAt,
    });
  }
  return result;
}

export async function setMemberPermissions(
  d: Db,
  workspaceId: string,
  userId: string,
  permissions: Permission[],
): Promise<void> {
  // One atomic replace — a failure between delete and insert must not be
  // able to leave the member with zero permissions.
  await d.batch([
    d
      .delete(memberPermissions)
      .where(
        and(
          eq(memberPermissions.userId, userId),
          eq(memberPermissions.workspaceId, workspaceId),
        ),
      ),
    ...permissions.map((perm) =>
      d
        .insert(memberPermissions)
        .values({ userId, workspaceId, permission: perm }),
    ),
  ]);
}

export async function removeMember(
  d: Db,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const userDevices = await d
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.userId, userId));
  const deviceIds = userDevices.map((dev) => dev.id);
  const nowIso = toIso(new Date());
  await d.batch([
    d
      .delete(memberPermissions)
      .where(
        and(
          eq(memberPermissions.userId, userId),
          eq(memberPermissions.workspaceId, workspaceId),
        ),
      ),
    d
      .delete(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, userId),
        ),
      ),
    // A removed member must not keep live sessions on any device.
    ...(deviceIds.length > 0
      ? [
          d
            .update(sessions)
            .set({ revokedAt: nowIso })
            .where(inArray(sessions.deviceId, deviceIds)),
          d
            .update(devices)
            .set({ revokedAt: nowIso })
            .where(inArray(devices.id, deviceIds)),
        ]
      : []),
  ]);
}

export async function transferOwnership(
  d: Db,
  workspaceId: string,
  fromUserId: string,
  toUserId: string,
): Promise<boolean> {
  const rows = await d
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, toUserId),
      ),
    );
  const target = rows[0];
  if (!target || target.userId === fromUserId) return false;

  const nowIso = toIso(new Date());
  // D1 has no interactive transactions, so order matters: a committed demote
  // with a failed promote would leave ZERO primary admins. Promote runs first
  // as its own CAS — if it misses, nothing changed yet and false matches the
  // old rollback outcome. Once the promote commits, the demote can only miss
  // when fromUserId's membership was deleted concurrently; then toUserId is
  // already the sole admin, so the transfer still holds.
  const promote = await d
    .update(memberships)
    .set({ isPrimaryAdmin: true, joinedAt: nowIso })
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, toUserId),
      ),
    )
    .run();
  if (promote.meta.changes !== 1) return false;

  await d
    .update(memberships)
    .set({ isPrimaryAdmin: false })
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, fromUserId),
      ),
    )
    .run();
  return true;
}
