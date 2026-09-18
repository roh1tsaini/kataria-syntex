import { Hono, type Context } from "hono";
import { toIso } from "../lib/datetime";
import { z } from "zod";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import type { SQLiteTable, AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { generateId } from "../lib/token";
import {
  challanItems,
  colorRecipes,
  colors,
  customers,
  deniers,
  jobWorkReturnItems,
  jobWorkers,
  packingItems,
  rawMaterialItems,
  stockEntries,
  suppliers,
} from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { apiError } from "../lib/api-error";
import { publishChanges } from "../realtime/publish";
import { gstinSchema } from "@kataria-syntex/shared";

// Colors and deniers are referenced two different ways: by FK (recipes, and the
// four *_items tables that carry color_id/denier_id) and by the snapshot
// columns those same item rows plus stock_entries copied at write time
// (colorName, denierName — no FK, so a hard delete orphans history that can
// never resolve again, and a later re-create with the same name silently
// merges into it). DELETE checks the whole graph by id and by name; a single
// hit archives the row instead of removing it, and every read filters
// archivedAt IS NULL. Nothing referenced → the ordinary delete applies, there
// is nothing to preserve. (A6)
const ARCHIVABLE_MASTERS: Record<
  "colors" | "deniers",
  {
    table: SQLiteTable & { id: AnySQLiteColumn; workspaceId: AnySQLiteColumn };
    nameCol: AnySQLiteColumn;
    idCol: AnySQLiteColumn;
  }
> = {
  colors: { table: colors, nameCol: colors.name, idCol: colors.id },
  deniers: { table: deniers, nameCol: deniers.name, idCol: deniers.id },
};

// Every *_items table carries the same five columns; the type is what lets the
// probe loop over them uniformly, each concrete table being a subtype.
type ItemTable = SQLiteTable & {
  id: AnySQLiteColumn;
  colorId: AnySQLiteColumn;
  colorName: AnySQLiteColumn;
  denierId: AnySQLiteColumn;
  denierName: AnySQLiteColumn;
};

// These tables carry no workspace_id — they scope through their parent
// document. The probe is workspace-narrowed on the master's own row, so a hit
// here can only be from the same workspace.
const ITEM_TABLES: ItemTable[] = [
  challanItems,
  jobWorkReturnItems,
  rawMaterialItems,
  packingItems,
];

/*
 * Hono dispatches the FIRST matching handler, so these colors/deniers
 * overrides must be registered BEFORE registerMaster() declares the
 * generic /colors/:id and /deniers/:id — otherwise the generic one wins
 * and the override is dead code. registerMasterOverrides() runs first.
 */
function registerMasterOverrides() {
  // A colour's stockType is not an editable attribute once the colour is in use:
  // every stock_entries row freezes it at write time (lib/stock.ts:60), and
  // summarizeStockLedger groups by that frozen value. Flipping dyed→raw would
  // split one colour's yarn across two ledgers — the master says one thing, its
  // history says another. Refuse the flip when any ledger row exists for the
  // colour; name/code edits are unaffected. (A5)
  mastersRoute.put(
    "/colors/:id",
    requirePermission("manage_masters"),
    async (c) => {
      const parsed = colorBody.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return apiError(c, "invalid_request", 400);
      const workspaceId = c.get("member").workspaceId;
      const db = getDb(c.env.DB);
      const existingRows = await db
        .select()
        .from(colors)
        .where(
          and(
            eq(colors.id, c.req.param("id")),
            eq(colors.workspaceId, workspaceId),
          ),
        );
      const existing = existingRows[0];
      if (!existing) return apiError(c, "not_found", 404);
      if (parsed.data.stockType !== existing.stockType) {
        const historyRows = await db
          .select({ id: stockEntries.id })
          .from(stockEntries)
          .where(
            and(
              eq(stockEntries.workspaceId, workspaceId),
              eq(stockEntries.colorId, existing.id),
            ),
          )
          .limit(1);
        if (historyRows.length > 0)
          return apiError(c, "color_type_locked", 409);
      }
      const nowIso = toIso(new Date());
      const row = {
        ...existing,
        name: parsed.data.name,
        code: parsed.data.code || null,
        stockType: parsed.data.stockType,
        updatedAt: nowIso,
      };
      await db.update(colors).set(row).where(eq(colors.id, existing.id));
      publishChanges(
        c.env,
        c.executionCtx,
        workspaceId,
        c.req.header("x-client-id"),
        ["masters"],
      );
      return c.json({ ok: true, item: row });
    },
  );

  // Two literal registrations sharing one handler. A /:kind/:id pattern would
  // also swallow /customers/:id and /suppliers/:id, which must keep the
  // generic delete; `kind` is a literal here, never caller-controlled.
  mastersRoute.delete("/colors/:id", requirePermission("manage_masters"), (c) =>
    archiveOrDelete(c, "colors"),
  );
  mastersRoute.delete(
    "/deniers/:id",
    requirePermission("manage_masters"),
    (c) => archiveOrDelete(c, "deniers"),
  );
}

/** Shared body of the two archivable-master deletes. (A6) */
async function archiveOrDelete(
  c: Context<PermsEnv & { Bindings: Env }>,
  kind: "colors" | "deniers",
) {
  const cfg = ARCHIVABLE_MASTERS[kind];
  const workspaceId = c.get("member").workspaceId;
  const db = getDb(c.env.DB);

  const [existing] = await db
    .select()
    .from(cfg.table)
    .where(
      and(
        eq(cfg.idCol, c.req.param("id")),
        eq(cfg.table.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!existing) return apiError(c, "not_found", 404);

  const idCol = kind === "colors" ? "colorId" : "denierId";
  const nameCol = kind === "colors" ? "colorName" : "denierName";

  // One count per table, OR'd across FK and snapshot-name. Recipes only
  // reference colors+deniers by FK, so they are checked on id alone.
  const recipeHits =
    kind === "colors"
      ? await db
          .select({ id: colorRecipes.id })
          .from(colorRecipes)
          .where(
            and(
              eq(colorRecipes.workspaceId, workspaceId),
              eq(colorRecipes.colorId, existing.id),
            ),
          )
          .limit(1)
      : await db
          .select({ id: colorRecipes.id })
          .from(colorRecipes)
          .where(
            and(
              eq(colorRecipes.workspaceId, workspaceId),
              eq(colorRecipes.denierId, existing.id),
            ),
          )
          .limit(1);

  let referenced = recipeHits.length > 0;
  for (const t of ITEM_TABLES) {
    if (referenced) break;
    const rows = await db
      .select({ id: t.id })
      .from(t)
      .where(or(eq(t[idCol], existing.id), eq(t[nameCol], existing.name)))
      .limit(1);
    if (rows.length > 0) referenced = true;
  }

  // The ledger has no FK to colors/deniers at all — name is the only link.
  const ledgerRows = await db
    .select({ id: stockEntries.id })
    .from(stockEntries)
    .where(
      and(
        eq(stockEntries.workspaceId, workspaceId),
        eq(stockEntries[nameCol], existing.name),
      ),
    )
    .limit(1);
  if (ledgerRows.length > 0) referenced = true;

  if (referenced) {
    const nowIso = toIso(new Date());
    await db
      .update(cfg.table)
      .set({ archivedAt: nowIso, updatedAt: nowIso })
      .where(eq(cfg.idCol, existing.id));
    publishChanges(
      c.env,
      c.executionCtx,
      workspaceId,
      c.req.header("x-client-id"),
      ["masters"],
    );
    return c.json({ ok: true, archived: true });
  }

  try {
    await db.delete(cfg.table).where(eq(cfg.idCol, existing.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/FOREIGN KEY constraint failed/i.test(msg))
      return apiError(c, "in_use", 409);
    throw err;
  }
  publishChanges(
    c.env,
    c.executionCtx,
    workspaceId,
    c.req.header("x-client-id"),
    ["masters"],
  );
  return c.json({ ok: true, archived: false });
}

export const mastersRoute = new Hono<PermsEnv & { Bindings: Env }>();

mastersRoute.use("*", requireAuth, resolveMember());

registerMasterOverrides();

const customerBody = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  gstin: gstinSchema,
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
  gstin: gstinSchema,
});

type MasterTable = SQLiteTable & {
  id: AnySQLiteColumn;
  workspaceId: AnySQLiteColumn;
  name: AnySQLiteColumn;
};

/** Only colors and deniers can be archived (A6); the other three registers
 *  hard-delete. Call sites that pass null never filter. */
type Archivable = AnySQLiteColumn | null;

function registerMaster<TInput>(
  path: string,
  table: MasterTable,
  archivedColumn: Archivable,
  schema: z.ZodType<TInput>,
  toInsertRow: (
    parsed: TInput,
    workspaceId: string,
    nowIso: string,
  ) => Record<string, unknown>,
  toUpdateFields: (parsed: TInput, nowIso: string) => Record<string, unknown>,
) {
  // Master lists are open to all authenticated workspace members (requireAuth +
  // resolveMember applied at router root) so dropdown pickers across challans,
  // packing, returns, and raw materials function. Mutations below are gated
  // by requirePermission("manage_masters").
  mastersRoute.get(`/${path}`, async (c) => {
    const db = getDb(c.env.DB);
    const rows = await db
      .select()
      .from(table)
      .where(
        archivedColumn
          ? and(
              eq(table.workspaceId, c.get("member").workspaceId),
              isNull(archivedColumn),
            )
          : eq(table.workspaceId, c.get("member").workspaceId),
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
      const row = toInsertRow(parsed.data, c.get("member").workspaceId, nowIso);
      await getDb(c.env.DB).insert(table).values(row);
      publishChanges(
        c.env,
        c.executionCtx,
        c.get("member").workspaceId,
        c.req.header("x-client-id"),
        ["masters"],
      );
      return c.json({ ok: true, item: row });
    },
  );

  mastersRoute.put(
    `/${path}/:id`,
    requirePermission("manage_masters"),
    async (c) => {
      const parsed = schema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return apiError(c, "invalid_request", 400);
      const workspaceId = c.get("member").workspaceId;
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
      publishChanges(
        c.env,
        c.executionCtx,
        workspaceId,
        c.req.header("x-client-id"),
        ["masters"],
      );
      return c.json({ ok: true, item: row });
    },
  );

  mastersRoute.delete(
    `/${path}/:id`,
    requirePermission("manage_masters"),
    async (c) => {
      const workspaceId = c.get("member").workspaceId;
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
      publishChanges(
        c.env,
        c.executionCtx,
        workspaceId,
        c.req.header("x-client-id"),
        ["masters"],
      );
      return c.json({ ok: true });
    },
  );
}

registerMaster(
  "customers",
  customers,
  null,
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
  null,
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
  deniers.archivedAt,
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
  colors.archivedAt,
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
  null,
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
