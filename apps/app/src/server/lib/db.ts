import { drizzle } from "drizzle-orm/d1";
import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";

/**
 * D1 is async and per-request: build the drizzle handle from the env binding
 * inside each handler (`const db = getDb(c.env.DB)`). No singletons, no
 * pragmas — D1 manages the file, WAL, and foreign keys itself.
 */
export function getDb(d1: D1Database) {
  return drizzle(d1);
}

/** Query-capable surface — accepts the D1 drizzle handle. */
export type Db = ReturnType<typeof getDb>;

/**
 * Anything that executes queries: the per-request handle OR an open
 * transaction (both expose select/insert/update/delete). Helper modules
 * accept this so they run inside transactions too.
 */
export type Queryable = SQLiteAsyncDatabase<"async", D1Result>;
