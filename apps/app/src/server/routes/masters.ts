import { Hono } from "hono";
import { toIso } from "../lib/datetime";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import type {
  SQLiteTableWithColumns,
  AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { likeContains } from "../lib/like";
import { generateId } from "../lib/token";
import {
  colors,
  customers,
  deniers,
  jobWorkers,
  suppliers,
} from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { apiError } from "../lib/api-error";

export const mastersRoute = new Hono<PermsEnv & { Bindings: Env }>();

mastersRoute.use("*", requireAuth, resolveMember());

const customerBody = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  gstin: z.string().trim().max(15).optional().default(""),
});

const jobWorkerBody = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
});

const denierBody = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional().default(""),
});

const colorBody = z.object({
  name: z.string().trim().min(1).max(60),
  code: z.string().trim().max(20).optional().default(""),
  stockType: z.enum(["raw", "dyed"]).optional().default("dyed"),
});

const supplierBody = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  gstin: z.string().trim().max(15).optional().default(""),
});

type MasterTable = SQLiteTableWithColumns<any> & {
  id: AnySQLiteColumn;
  workspaceId: AnySQLiteColumn;
  name: AnySQLiteColumn;
};

function registerMaster<TInput>(
  path: string,
  table: MasterTable,
  schema: z.ZodType<TInput>,
  toInsertRow: (
    parsed: TInput,
    workspaceId: string,
    nowIso: string,
  ) => Record<string, unknown>,
  toUpdateFields: (parsed: TInput, nowIso: string) => Record<string, unknown>,
) {
  mastersRoute.get(`/${path}`, async (c) => {
    const q = c.req.query("q")?.trim();
    const db = getDb(c.env.DB);
    const rows = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.workspaceId, c.get("member")!.workspaceId),
          q ? likeContains(table.name, q) : undefined,
        ),
      )
      .orderBy(asc(table.name));
    return c.json({ items: rows });
  });

  mastersRoute.post(
    `/${path}`,
    requirePermission("manage_masters"),
    async (c) => {
      const parsed = schema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return apiError(c, "invalid_request", 400);
      const nowIso = toIso(new Date());
      const row = toInsertRow(
        parsed.data,
        c.get("member")!.workspaceId,
        nowIso,
      );
      await getDb(c.env.DB).insert(table).values(row);
      return c.json({ ok: true, item: row });
    },
  );

  mastersRoute.put(
    `/${path}/:id`,
    requirePermission("manage_masters"),
    async (c) => {
      const parsed = schema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return apiError(c, "invalid_request", 400);
      const workspaceId = c.get("member")!.workspaceId;
      const db = getDb(c.env.DB);
      const existingRows = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.id, c.req.param("id")),
            eq(table.workspaceId, workspaceId),
          ),
        );
      const existing = existingRows[0];
      if (!existing) return apiError(c, "not_found", 404);
      const nowIso = toIso(new Date());
      // Response built from the fetched row + the SET values — no read-back.
      const row = {
        ...existing,
        ...toUpdateFields(parsed.data, nowIso),
      };
      await db.update(table).set(row).where(eq(table.id, existing.id));
      return c.json({ ok: true, item: row });
    },
  );

  mastersRoute.delete(
    `/${path}/:id`,
    requirePermission("manage_masters"),
    async (c) => {
      const workspaceId = c.get("member")!.workspaceId;
      const db = getDb(c.env.DB);
      const existingRows = await db
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            eq(table.id, c.req.param("id")),
            eq(table.workspaceId, workspaceId),
          ),
        );
      const existing = existingRows[0];
      if (!existing) return apiError(c, "not_found", 404);
      try {
        await db.delete(table).where(eq(table.id, existing.id));
      } catch (err) {
        // Documents still reference this master — the FK refuses the delete.
        const msg = err instanceof Error ? err.message : String(err);
        if (/FOREIGN KEY constraint failed/i.test(msg))
          return apiError(c, "in_use", 409);
        throw err;
      }
      return c.json({ ok: true });
    },
  );
}

registerMaster(
  "customers",
  customers,
  customerBody,
  (d, workspaceId, nowIso) => ({
    id: generateId(),
    workspaceId,
    name: d.name,
    phone: d.phone || null,
    address: d.address || null,
    gstin: d.gstin || null,
    createdAt: nowIso,
    updatedAt: nowIso,
  }),
  (d, nowIso) => ({
    name: d.name,
    phone: d.phone || null,
    address: d.address || null,
    gstin: d.gstin || null,
    updatedAt: nowIso,
  }),
);

registerMaster(
  "job-workers",
  jobWorkers,
  jobWorkerBody,
  (d, workspaceId, nowIso) => ({
    id: generateId(),
    workspaceId,
    name: d.name,
    phone: d.phone || null,
    address: d.address || null,
    createdAt: nowIso,
    updatedAt: nowIso,
  }),
  (d, nowIso) => ({
    name: d.name,
    phone: d.phone || null,
    address: d.address || null,
    updatedAt: nowIso,
  }),
);

registerMaster(
  "deniers",
  deniers,
  denierBody,
  (d, workspaceId, nowIso) => ({
    id: generateId(),
    workspaceId,
    name: d.name,
    description: d.description || null,
    createdAt: nowIso,
    updatedAt: nowIso,
  }),
  (d, nowIso) => ({
    name: d.name,
    description: d.description || null,
    updatedAt: nowIso,
  }),
);

registerMaster(
  "colors",
  colors,
  colorBody,
  (d, workspaceId, nowIso) => ({
    id: generateId(),
    workspaceId,
    name: d.name,
    code: d.code || null,
    stockType: d.stockType,
    createdAt: nowIso,
    updatedAt: nowIso,
  }),
  (d, nowIso) => ({
    name: d.name,
    code: d.code || null,
    stockType: d.stockType,
    updatedAt: nowIso,
  }),
);

registerMaster(
  "suppliers",
  suppliers,
  supplierBody,
  (d, workspaceId, nowIso) => ({
    id: generateId(),
    workspaceId,
    name: d.name,
    phone: d.phone || null,
    address: d.address || null,
    gstin: d.gstin || null,
    createdAt: nowIso,
    updatedAt: nowIso,
  }),
  (d, nowIso) => ({
    name: d.name,
    phone: d.phone || null,
    address: d.address || null,
    gstin: d.gstin || null,
    updatedAt: nowIso,
  }),
);
