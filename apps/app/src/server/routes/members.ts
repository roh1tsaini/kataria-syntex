import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { memberships, users, invites, type Permission } from "../db/schema";
import { ALL_PERMISSIONS } from "@kataria-syntex/shared";
import { detectIdentifier } from "../lib/identifier";
import { requireAuth } from "../auth/session";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import {
  addPendingMember,
  attachExistingUser,
  listMembers,
  listPendingMembers,
  removeMember,
  transferOwnership,
  setMemberPermissions,
} from "../auth/members";
import { apiError } from "../lib/api-error";

export const membersRoute = new Hono<PermsEnv & { Bindings: Env }>();

membersRoute.use("*", requireAuth, resolveMember());

const addMemberSchema = z.object({
  identifier: z.string().min(3).max(200),
  permissions: z.array(z.string()).min(1),
});

/**
 * Pre-add a member by phone/email. If they already have an account without a
 * workspace, they're attached immediately; otherwise they land here
 * automatically on first login/signup. No codes, no SMS.
 */
membersRoute.post("/invite", requirePermission("manage_members"), async (c) => {
  const parsed = addMemberSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const ident = detectIdentifier(parsed.data.identifier);
  if (!ident) return apiError(c, "invalid_identifier", 400);
  const member = c.get("member")!;

  const perms = parsed.data.permissions.filter((p): p is Permission =>
    (ALL_PERMISSIONS as readonly string[]).includes(p),
  );
  if (perms.length === 0) return apiError(c, "invalid_permissions", 400);

  const db = getDb(c.env.DB);
  const column = ident.type === "phone" ? users.phone : users.email;
  const existingRows = await db
    .select()
    .from(users)
    .where(eq(column, ident.value));
  const existingUser = existingRows[0];

  if (existingUser) {
    // Already registered elsewhere → one workspace per account.
    const memRows = await db
      .select({ workspaceId: memberships.workspaceId })
      .from(memberships)
      .where(eq(memberships.userId, existingUser.id));
    if (memRows.length > 0) return apiError(c, "phone_already_registered", 409);
    await attachExistingUser(db, existingUser.id, member.workspaceId, perms);
    return c.json({ ok: true, attached: true });
  }

  // Already pending with this identifier IN THIS WORKSPACE? A pending invite
  // elsewhere doesn't block inviting the person here. Expired rows don't block
  // either — a stale invite must not be a permanent dead end.
  const pendingRows = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.workspaceId, member.workspaceId),
        eq(ident.type === "phone" ? invites.phone : invites.email, ident.value),
      ),
    );
  if (
    pendingRows.some(
      (r) =>
        !r.consumedAt && (!r.expiresAt || new Date(r.expiresAt) > new Date()),
    )
  )
    return apiError(c, "already_pending", 409);

  await addPendingMember(
    db,
    member.workspaceId,
    c.get("auth")!.userId,
    ident,
    perms,
  );
  return c.json({ ok: true, attached: false });
});

// Anyone with manage_members: read the roster + who is waiting to join.
membersRoute.get("/", requirePermission("manage_members"), async (c) => {
  const member = c.get("member")!;
  const db = getDb(c.env.DB);
  const [members, pending] = await Promise.all([
    listMembers(db, member.workspaceId),
    listPendingMembers(db, member.workspaceId),
  ]);
  const auth = c.get("auth")!;
  return c.json({
    members: members.map((m) => ({
      id: m.userId,
      name: m.name,
      phone: m.phone,
      email: m.email,
      isPrimaryAdmin: m.isPrimaryAdmin,
      permissions: m.permissions,
      isCurrent: m.userId === auth.userId,
    })),
    pending,
  });
});

// Remove a pending pre-add before they join.
membersRoute.delete(
  "/pending/:id",
  requirePermission("manage_members"),
  async (c) => {
    const member = c.get("member")!;
    const db = getDb(c.env.DB);
    const rows = await db
      .select()
      .from(invites)
      .where(eq(invites.id, c.req.param("id")));
    const row = rows[0];
    if (!row || row.workspaceId !== member.workspaceId || row.consumedAt)
      return apiError(c, "not_found", 404);
    await db.delete(invites).where(eq(invites.id, row.id));
    return c.json({ ok: true });
  },
);

// Primary admin only: update a member's permissions. (manage_members alone
// would let a manager edit their own permissions — privilege escalation.)
membersRoute.put("/:id", async (c) => {
  const member = c.get("member")!;
  if (!member.isPrimaryAdmin) return apiError(c, "forbidden", 403);
  const parsed = z
    .object({ permissions: z.array(z.string()).min(0) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);

  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, c.req.param("id")),
        eq(memberships.workspaceId, member.workspaceId),
      ),
    );
  const target = rows[0];
  if (!target) return apiError(c, "not_found", 404);
  if (target.isPrimaryAdmin)
    return apiError(c, "cannot_change_primary_admin", 400);

  const perms = parsed.data.permissions.filter((p): p is Permission =>
    (ALL_PERMISSIONS as readonly string[]).includes(p),
  );
  await setMemberPermissions(db, member.workspaceId, c.req.param("id"), perms);
  return c.json({ ok: true });
});

// Primary admin only: remove a member (revokes their sessions/devices).
membersRoute.delete("/:id", async (c) => {
  const member = c.get("member")!;
  if (!member.isPrimaryAdmin) return apiError(c, "forbidden", 403);
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, c.req.param("id")),
        eq(memberships.workspaceId, member.workspaceId),
      ),
    );
  const target = rows[0];
  if (!target) return apiError(c, "not_found", 404);
  if (target.isPrimaryAdmin)
    return apiError(c, "cannot_remove_primary_admin", 400);

  await removeMember(db, member.workspaceId, c.req.param("id"));
  return c.json({ ok: true });
});

// Primary admin only: hand over primary admin to another member.
membersRoute.post(
  "/transfer",
  requirePermission("manage_members"),
  async (c) => {
    const parsed = z
      .object({ toUserId: z.string().min(1) })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return apiError(c, "invalid_request", 400);
    const member = c.get("member")!;
    if (!member.isPrimaryAdmin) return apiError(c, "forbidden", 403);
    const ok = await transferOwnership(
      getDb(c.env.DB),
      member.workspaceId,
      c.get("auth")!.userId,
      parsed.data.toUserId,
    );
    if (!ok) return apiError(c, "not_found", 404);
    return c.json({ ok: true });
  },
);
