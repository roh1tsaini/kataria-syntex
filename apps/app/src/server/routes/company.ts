import { Hono } from "hono";
import { toIso } from "../lib/datetime";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import type { Env } from "../env";
import { companies, financialYears } from "../db/schema";
import {
  getOrCreateCompany,
  parseNumbering,
  fyForDate,
  indiaNow,
} from "../lib/company";
import { resolveMember, requirePermission, type PermsEnv } from "../auth/perms";
import { requireAuth } from "../auth/session";
import type { NumberingConfig } from "../db/schema";
import { apiError } from "../lib/api-error";

export const companyRoute = new Hono<PermsEnv & { Bindings: Env }>();

companyRoute.use("*", requireAuth, resolveMember());

const detailsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  gstin: z.string().trim().max(15).optional().default(""),
  pan: z
    .string()
    .trim()
    .length(10)
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN")
    .optional()
    .or(z.literal(""))
    .default(""),
  address: z.string().trim().max(300).optional().default(""),
  phone1: z.string().trim().max(20).optional().default(""),
  phone2: z.string().trim().max(20).optional().default(""),
});

const numberingTypeSchema = z.object({
  prefix: z.string().trim().max(10),
  suffix: z.string().trim().max(10),
  minDigits: z.number().int().min(1).max(6),
});
const numberingSchema = z.object({
  sales: numberingTypeSchema,
  outward: numberingTypeSchema,
  packing_s: numberingTypeSchema,
  packing_j: numberingTypeSchema,
  raw: numberingTypeSchema,
});

function toCompanyDto(
  row: {
    id: string;
    name: string;
    gstin: string | null;
    pan: string | null;
    address: string | null;
    phone1: string | null;
    phone2: string | null;
  },
  numbering: NumberingConfig,
) {
  return {
    id: row.id,
    name: row.name,
    gstin: row.gstin ?? "",
    pan: row.pan ?? "",
    address: row.address ?? "",
    phone1: row.phone1 ?? "",
    phone2: row.phone2 ?? "",
    numbering,
  };
}

companyRoute.get("/", async (c) => {
  const member = c.get("member");
  const db = getDb(c.env.DB);
  const row = await getOrCreateCompany(db, member.workspaceId);

  const fyRows = await db
    .select({
      label: financialYears.label,
      startsAt: financialYears.startsAt,
      endsAt: financialYears.endsAt,
      salesNext: financialYears.salesNext,
      outwardNext: financialYears.outwardNext,
      packingSaleNext: financialYears.packingSaleNext,
      packingJobNext: financialYears.packingJobNext,
      rawNext: financialYears.rawNext,
    })
    .from(financialYears)
    .where(eq(financialYears.workspaceId, c.get("member").workspaceId))
    .orderBy(desc(financialYears.startsAt));

  return c.json({
    company: toCompanyDto(row, parseNumbering(row.numbering)),
    currentFy: fyForDate(indiaNow()),
    financialYears: fyRows,
  });
});

companyRoute.put("/", requirePermission("manage_settings"), async (c) => {
  const parsed = detailsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, "invalid_request", 400);
  const member = c.get("member");
  const db = getDb(c.env.DB);
  const company = await getOrCreateCompany(db, member.workspaceId);
  const nowIso = toIso(new Date());
  // Response built from known values — no read-back of what was just written.
  const updated = {
    ...company,
    name: parsed.data.name,
    gstin: parsed.data.gstin || null,
    pan: parsed.data.pan || null,
    address: parsed.data.address || null,
    phone1: parsed.data.phone1 || null,
    phone2: parsed.data.phone2 || null,
    updatedAt: nowIso,
    updatedBy: c.get("auth").userId,
  };
  await db.update(companies).set(updated).where(eq(companies.id, company.id));
  return c.json({
    ok: true,
    company: toCompanyDto(updated, parseNumbering(updated.numbering)),
  });
});

companyRoute.put(
  "/numbering",
  requirePermission("manage_settings"),
  async (c) => {
    const parsed = numberingSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return apiError(c, "invalid_request", 400);
    const member = c.get("member");
    const db = getDb(c.env.DB);
    const company = await getOrCreateCompany(db, member.workspaceId);
    const nowIso = toIso(new Date());
    await db
      .update(companies)
      .set({
        numbering: JSON.stringify(parsed.data),
        updatedAt: nowIso,
        updatedBy: c.get("auth").userId,
      })
      .where(eq(companies.id, company.id));
    return c.json({ ok: true, numbering: parsed.data });
  },
);
