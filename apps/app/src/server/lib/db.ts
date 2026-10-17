import { drizzle } from "drizzle-orm/d1";

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
