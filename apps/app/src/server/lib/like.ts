import { sql, type AnyColumn } from "drizzle-orm";

/**
 * Case-insensitive "contains" match that neutralizes user-supplied LIKE
 * wildcards (`%`, `_`, `\`) via an explicit `ESCAPE '\'` clause — SQLite has
 * no default escape character, so escaping without ESCAPE would both leave
 * the wildcards active and inject the backslash into the match.
 */
export function likeContains(column: AnyColumn, term: string) {
  const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return sql`${column} LIKE ${`%${escaped}%`} ESCAPE ${"\\"}`;
}
