import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { toIso } from "../lib/datetime";
import { generateId } from "../lib/token";
import {
  colorRecipeIngredients,
  colorRecipeVersions,
  colorRecipes,
  colors,
  deniers,
  users,
} from "../db/schema";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import { apiError } from "../lib/api-error";

export const recipesRoute = new Hono<PermsEnv & { Bindings: Env }>();

recipesRoute.use("*", requireAuth, resolveMember());

/** Owner decision: keep the last 5 versions of every recipe. */
const MAX_VERSIONS = 5;

const ingredientInput = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(20),
});

const recipeBody = z.object({
  colorId: z.string().trim().min(1).max(36),
  denierId: z.string().trim().min(1).max(36),
  ingredients: z.array(ingredientInput).min(1).max(50),
  processTempC: z.number().int().min(0).max(300).nullable().optional(),
  processTimeHrs: z.number().int().min(0).max(720).nullable().optional(),
  processTimeMin: z.number().int().min(0).max(59).nullable().optional(),
  processTimeSec: z.number().int().min(0).max(59).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const restoreBody = z.object({ version: z.number().int().min(1) });

type RecipePayload = {
  ingredients: { seq: number; name: string; quantity: number; unit: string }[];
  processTempC: number | null;
  processTimeHrs: number | null;
  processTimeMin: number | null;
  processTimeSec: number | null;
  notes: string | null;
};

function toPayload(body: z.infer<typeof recipeBody>): RecipePayload {
  return {
    ingredients: body.ingredients.map((i, seq) => ({
      seq,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    })),
    processTempC: body.processTempC ?? null,
    processTimeHrs: body.processTimeHrs ?? null,
    processTimeMin: body.processTimeMin ?? null,
    processTimeSec: body.processTimeSec ?? null,
    notes: body.notes ?? null,
  };
}

function ingredientRows(recipeId: string, payload: RecipePayload) {
  return payload.ingredients.map((i) => ({
    id: generateId(),
    recipeId,
    seq: i.seq,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
  }));
}

function isUniqueRecipeConflict(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // D1 names the violated columns, not the index.
  return /UNIQUE constraint failed.*color_recipes\.(workspace_id|color_id|denier_id)/s.test(
    msg,
  );
}

/** Workspace-scoped list of recipes with color/denier names joined in. */
recipesRoute.get("/", requirePermission("manage_masters"), async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const colorId = c.req.query("colorId")?.trim();
  const db = getDb(c.env.DB);
  const rows = await db
    .select({
      id: colorRecipes.id,
      colorId: colorRecipes.colorId,
      colorName: colors.name,
      colorCode: colors.code,
      denierId: colorRecipes.denierId,
      denierName: deniers.name,
      processTempC: colorRecipes.processTempC,
      processTimeHrs: colorRecipes.processTimeHrs,
      processTimeMin: colorRecipes.processTimeMin,
      processTimeSec: colorRecipes.processTimeSec,
      notes: colorRecipes.notes,
      version: colorRecipes.version,
      ingredientCount:
        sql<number>`(select count(*) from ${colorRecipeIngredients} where ${colorRecipeIngredients.recipeId} = ${colorRecipes.id})`.as(
          "ingredient_count",
        ),
      updatedAt: colorRecipes.updatedAt,
    })
    .from(colorRecipes)
    .innerJoin(colors, eq(colors.id, colorRecipes.colorId))
    .innerJoin(deniers, eq(deniers.id, colorRecipes.denierId))
    .where(
      and(
        eq(colorRecipes.workspaceId, workspaceId),
        colorId ? eq(colorRecipes.colorId, colorId) : undefined,
      ),
    )
    .orderBy(asc(colors.name), asc(deniers.name));
  return c.json({ items: rows });
});

/** Single recipe by color+denier — the challan detail "View recipe" path.
 * Returns just the id; clients then fetch full detail via /:id. */
recipesRoute.get("/lookup", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const colorId = c.req.query("colorId")?.trim() ?? "";
  const denierId = c.req.query("denierId")?.trim() ?? "";
  if (!colorId || !denierId) return apiError(c, "invalid_request", 400);
  const db = getDb(c.env.DB);
  const rows = await db
    .select({ id: colorRecipes.id })
    .from(colorRecipes)
    .where(
      and(
        eq(colorRecipes.workspaceId, workspaceId),
        eq(colorRecipes.colorId, colorId),
        eq(colorRecipes.denierId, denierId),
      ),
    )
    .limit(1);
  const recipe = rows[0];
  if (!recipe) return c.json({ recipe: null });
  return c.json({ recipeId: recipe.id });
});

recipesRoute.post("/", requirePermission("manage_masters"), async (c) => {
  const parsed = recipeBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const body = parsed.data;
  const workspaceId = c.get("member")!.workspaceId;
  const userId = c.get("auth")!.userId;
  const db = getDb(c.env.DB);

  const [colorRow] = await db
    .select({ id: colors.id })
    .from(colors)
    .where(
      and(eq(colors.id, body.colorId), eq(colors.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!colorRow) return apiError(c, "invalid_color", 400);
  const [denierRow] = await db
    .select({ id: deniers.id })
    .from(deniers)
    .where(
      and(eq(deniers.id, body.denierId), eq(deniers.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!denierRow) return apiError(c, "invalid_denier", 400);

  const nowIso = toIso(new Date());
  const recipeId = generateId();
  const payload = toPayload(body);
  try {
    await db.batch([
      db.insert(colorRecipes).values({
        id: recipeId,
        workspaceId,
        colorId: body.colorId,
        denierId: body.denierId,
        processTempC: payload.processTempC,
        processTimeHrs: payload.processTimeHrs,
        processTimeMin: payload.processTimeMin,
        processTimeSec: payload.processTimeSec,
        notes: payload.notes,
        version: 1,
        createdBy: userId,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
      db
        .insert(colorRecipeIngredients)
        .values(ingredientRows(recipeId, payload)),
      db.insert(colorRecipeVersions).values({
        id: generateId(),
        recipeId,
        version: 1,
        payload: JSON.stringify(payload),
        savedBy: userId,
        createdAt: nowIso,
      }),
    ]);
  } catch (err) {
    if (isUniqueRecipeConflict(err)) return apiError(c, "recipe_exists", 409);
    throw err;
  }
  return c.json({ ok: true, id: recipeId }, 201);
});

/** Full recipe detail: current ingredients + version list. Any member may
 * read (challan detail links here); writes stay manage_masters-gated. */
recipesRoute.get("/:id", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(colorRecipes)
    .where(
      and(
        eq(colorRecipes.id, c.req.param("id")),
        eq(colorRecipes.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const recipe = rows[0];
  if (!recipe) return apiError(c, "not_found", 404);

  const [ingredientRows, versionRows] = await Promise.all([
    db
      .select()
      .from(colorRecipeIngredients)
      .where(eq(colorRecipeIngredients.recipeId, recipe.id))
      .orderBy(asc(colorRecipeIngredients.seq)),
    db
      .select({
        version: colorRecipeVersions.version,
        restoredFrom: colorRecipeVersions.restoredFrom,
        createdAt: colorRecipeVersions.createdAt,
        savedByName: users.name,
      })
      .from(colorRecipeVersions)
      .leftJoin(users, eq(users.id, colorRecipeVersions.savedBy))
      .where(eq(colorRecipeVersions.recipeId, recipe.id))
      .orderBy(desc(colorRecipeVersions.version)),
  ]);

  return c.json({ recipe, ingredients: ingredientRows, versions: versionRows });
});

/** One historical snapshot. */
recipesRoute.get("/:id/versions/:version", async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const version = Number.parseInt(c.req.param("version"), 10);
  if (!Number.isFinite(version) || version < 1)
    return apiError(c, "invalid_request", 400);
  const db = getDb(c.env.DB);
  const rows = await db
    .select({ payload: colorRecipeVersions.payload })
    .from(colorRecipeVersions)
    .innerJoin(
      colorRecipes,
      and(
        eq(colorRecipes.id, colorRecipeVersions.recipeId),
        eq(colorRecipes.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(colorRecipeVersions.recipeId, c.req.param("id")),
        eq(colorRecipeVersions.version, version),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return apiError(c, "not_found", 404);
  return c.json({ version, payload: JSON.parse(row.payload) });
});

/** A save is a new version: replace ingredients + process, record the
 * snapshot, prune beyond MAX_VERSIONS — one atomic batch. */
async function saveNewVersion(
  db: ReturnType<typeof getDb>,
  opts: {
    recipeId: string;
    currentVersion: number;
    payload: RecipePayload;
    restoredFrom: number | null;
    userId: string;
  },
) {
  const nowIso = toIso(new Date());
  const nextVersion = opts.currentVersion + 1;
  // Keep only the newest MAX_VERSIONS snapshot rows.
  const oldestToKeep = nextVersion - MAX_VERSIONS + 1;
  await db.batch([
    db
      .delete(colorRecipeIngredients)
      .where(eq(colorRecipeIngredients.recipeId, opts.recipeId)),
    db
      .insert(colorRecipeIngredients)
      .values(ingredientRows(opts.recipeId, opts.payload)),
    db
      .update(colorRecipes)
      .set({
        processTempC: opts.payload.processTempC,
        processTimeHrs: opts.payload.processTimeHrs,
        processTimeMin: opts.payload.processTimeMin,
        processTimeSec: opts.payload.processTimeSec,
        notes: opts.payload.notes,
        version: nextVersion,
        updatedAt: nowIso,
      })
      .where(eq(colorRecipes.id, opts.recipeId)),
    db.insert(colorRecipeVersions).values({
      id: generateId(),
      recipeId: opts.recipeId,
      version: nextVersion,
      payload: JSON.stringify(opts.payload),
      restoredFrom: opts.restoredFrom,
      savedBy: opts.userId,
      createdAt: nowIso,
    }),
    ...(oldestToKeep > 1
      ? [
          db
            .delete(colorRecipeVersions)
            .where(
              and(
                eq(colorRecipeVersions.recipeId, opts.recipeId),
                lt(colorRecipeVersions.version, oldestToKeep),
              ),
            ),
        ]
      : []),
  ]);
}

recipesRoute.put("/:id", requirePermission("manage_masters"), async (c) => {
  const parsed = recipeBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const body = parsed.data;
  const workspaceId = c.get("member")!.workspaceId;
  const userId = c.get("auth")!.userId;
  const db = getDb(c.env.DB);

  const rows = await db
    .select({ id: colorRecipes.id, version: colorRecipes.version })
    .from(colorRecipes)
    .where(
      and(
        eq(colorRecipes.id, c.req.param("id")),
        eq(colorRecipes.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const recipe = rows[0];
  if (!recipe) return apiError(c, "not_found", 404);

  // The pair is immutable; editing keeps the recipe's color+denier.
  await saveNewVersion(db, {
    recipeId: recipe.id,
    currentVersion: recipe.version,
    payload: toPayload(body),
    restoredFrom: null,
    userId,
  });
  return c.json({ ok: true, version: recipe.version + 1 });
});

recipesRoute.post(
  "/:id/restore",
  requirePermission("manage_masters"),
  async (c) => {
    const parsed = restoreBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return apiError(c, "invalid_request", 400);
    const workspaceId = c.get("member")!.workspaceId;
    const userId = c.get("auth")!.userId;
    const db = getDb(c.env.DB);

    const rows = await db
      .select({ id: colorRecipes.id, version: colorRecipes.version })
      .from(colorRecipes)
      .where(
        and(
          eq(colorRecipes.id, c.req.param("id")),
          eq(colorRecipes.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    const recipe = rows[0];
    if (!recipe) return apiError(c, "not_found", 404);

    const versionRows = await db
      .select({ payload: colorRecipeVersions.payload })
      .from(colorRecipeVersions)
      .where(
        and(
          eq(colorRecipeVersions.recipeId, recipe.id),
          eq(colorRecipeVersions.version, parsed.data.version),
        ),
      )
      .limit(1);
    const versionRow = versionRows[0];
    if (!versionRow) return apiError(c, "recipe_version_missing", 404);

    await saveNewVersion(db, {
      recipeId: recipe.id,
      currentVersion: recipe.version,
      payload: JSON.parse(versionRow.payload) as RecipePayload,
      restoredFrom: parsed.data.version,
      userId,
    });
    return c.json({ ok: true, version: recipe.version + 1 });
  },
);

recipesRoute.delete("/:id", requirePermission("manage_masters"), async (c) => {
  const workspaceId = c.get("member")!.workspaceId;
  const db = getDb(c.env.DB);
  const rows = await db
    .select({ id: colorRecipes.id })
    .from(colorRecipes)
    .where(
      and(
        eq(colorRecipes.id, c.req.param("id")),
        eq(colorRecipes.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const recipe = rows[0];
  if (!recipe) return apiError(c, "not_found", 404);
  // Ingredients + versions cascade.
  await db.delete(colorRecipes).where(eq(colorRecipes.id, recipe.id));
  return c.json({ ok: true });
});
