import type { ApiCode } from "@kataria-syntex/shared";
import { and, eq, inArray } from "drizzle-orm";
import type { Queryable } from "./db";
import { deniers, colors } from "../db/schema";

type MastersMaps = {
  denierById: Map<string, typeof deniers.$inferSelect>;
  colorById: Map<string, typeof colors.$inferSelect>;
};

export async function validateMasters(
  d: Queryable,
  workspaceId: string,
  denierIds: string[],
  colorIds: string[],
): Promise<{ error: ApiCode } | MastersMaps> {
  if (denierIds.length === 0) return { error: "invalid_denier" };
  const denierRows = await d
    .select()
    .from(deniers)
    .where(
      and(eq(deniers.workspaceId, workspaceId), inArray(deniers.id, denierIds)),
    );
  if (denierRows.length !== denierIds.length)
    return { error: "invalid_denier" };

  const colorRows =
    colorIds.length > 0
      ? await d
          .select()
          .from(colors)
          .where(
            and(
              eq(colors.workspaceId, workspaceId),
              inArray(colors.id, colorIds),
            ),
          )
      : [];
  if (colorRows.length !== colorIds.length) return { error: "invalid_color" };
  return {
    denierById: new Map(denierRows.map((r) => [r.id, r])),
    colorById: new Map(colorRows.map((r) => [r.id, r])),
  };
}
