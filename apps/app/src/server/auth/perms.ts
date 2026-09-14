import { createMiddleware } from "hono/factory";
import { eq, and } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { memberships, memberPermissions, type Permission } from "../db/schema";
import { ALL_PERMISSIONS } from "@kataria-syntex/shared";
import type { AuthVariables } from "./session";
import { apiError } from "../lib/api-error";

/**
 * Permission-based access control middleware — the only authorization model
 * in the app. Members hold explicit permissions; the primary admin holds all.
 *
 * Usage:
 *   const requireMember = resolveMember();
 *   route.use("*", requireAuth, requireMember);
 *   route.post("/", requireMember, requirePermission("create_challan"), handler);
 */

type MemberContext = {
  workspaceId: string;
  isPrimaryAdmin: boolean;
  permissions: Set<Permission>;
};

export type PermsEnv = {
  Variables: AuthVariables & {
    /** Set by resolveMember() — every reader sits behind that middleware. */
    member: MemberContext;
  };
};

/** Resolves the caller's membership + permissions. Sets `member` on context. */
export function resolveMember() {
  return createMiddleware<{ Bindings: Env } & PermsEnv>(async (c, next) => {
    const auth = c.get("auth");
    if (!auth) return apiError(c, "unauthorized", 401);

    const db = getDb(c.env.DB);
    const memRows = await db
      .select({
        workspaceId: memberships.workspaceId,
        isPrimaryAdmin: memberships.isPrimaryAdmin,
      })
      .from(memberships)
      .where(eq(memberships.userId, auth.userId))
      .limit(2);
    const mem = memRows[0];
    if (!mem) return apiError(c, "no_workspace", 403);
    // uq_memberships_user makes a second row impossible, and limit(2) above
    // keeps this query from scanning the table on its way to proving that. If
    // a duplicate ever lands anyway (a migration run against data the index
    // couldn't accept), refuse instead of guessing which workspace is theirs —
    // picking a row with no ordering would silently cross tenant boundaries.
    if (memRows.length > 1) return apiError(c, "multiple_memberships", 409);

    // Primary admin gets all permissions implicitly
    let perms: Set<Permission>;
    if (mem.isPrimaryAdmin) {
      perms = new Set(ALL_PERMISSIONS);
    } else {
      const permRows = await db
        .select({ permission: memberPermissions.permission })
        .from(memberPermissions)
        .where(
          and(
            eq(memberPermissions.userId, auth.userId),
            eq(memberPermissions.workspaceId, mem.workspaceId),
          ),
        );
      perms = new Set(
        permRows
          .map((r) => r.permission as Permission)
          .filter((p) => ALL_PERMISSIONS.includes(p)),
      );
    }

    c.set("member", {
      workspaceId: mem.workspaceId,
      isPrimaryAdmin: mem.isPrimaryAdmin,
      permissions: perms,
    });
    await next();
  });
}

/** Returns a middleware that checks for a specific permission. */
export function requirePermission(perm: Permission) {
  return createMiddleware<PermsEnv>(async (c, next) => {
    const member = c.get("member");
    if (!member) return apiError(c, "unauthorized", 401);
    if (member.isPrimaryAdmin || member.permissions.has(perm)) {
      await next();
      return;
    }
    return apiError(c, "forbidden", 403, { required: perm });
  });
}
