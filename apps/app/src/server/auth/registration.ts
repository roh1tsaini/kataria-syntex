import { eq, sql, type SQL } from "drizzle-orm";
import { appSettings } from "../db/schema";
import { getDb } from "../lib/db";

export const REGISTRATION_SETTING_KEY = "public_registrations";

/**
 * Public signups are opt-in: the setting row must exist and read "on". A
 * missing row blocks signup rather than opening it, so a fresh database or a
 * lost settings row can never quietly leave the door open to the world. The
 * owner turns registration on once with the bot's /registrations_on.
 */
export async function registrationsEnabled(
  database: D1Database,
): Promise<boolean> {
  const rows = await getDb(database)
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, REGISTRATION_SETTING_KEY))
    .limit(1);
  return rows[0]?.value === "on";
}

/**
 * D1 expression guarding the final account insert against a concurrent pause.
 *
 * Same policy as registrationsEnabled, and it has to be a scalar comparison
 * rather than NOT EXISTS: "no row at all" must read as closed. A NOT EXISTS
 * subquery returns true when the setting is simply missing, which is the
 * opposite of the intent — a scalar compare yields NULL for a missing row, and
 * NULL is not true, so the WHERE clause blocks the insert.
 */
export function publicSignupAllowed(): SQL {
  return sql`(SELECT ${appSettings.value} FROM ${appSettings} WHERE ${appSettings.key} = ${REGISTRATION_SETTING_KEY}) = 'on'`;
}

export async function saveRegistrationsEnabled(
  database: D1Database,
  enabled: boolean,
): Promise<void> {
  const result = await getDb(database)
    .insert(appSettings)
    .values({
      key: REGISTRATION_SETTING_KEY,
      value: enabled ? "on" : "off",
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: enabled ? "on" : "off",
        updatedAt: new Date().toISOString(),
      },
    })
    .run();
  if (result.meta.changes !== 1)
    throw new Error("registration_setting_not_saved");
}
