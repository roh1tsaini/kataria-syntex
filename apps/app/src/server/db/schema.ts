import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import {
  type Permission as SharedPermission,
  type NumberingConfig as SharedNumberingConfig,
} from "@kataria-syntex/shared";

// ── Users ──────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  "users",
  {
    id: text("id", { length: 36 }).primaryKey(),
    // At least one identifier required — phone OR email (enforced in app layer).
    phone: text("phone", { length: 20 }),
    email: text("email", { length: 200 }),
    name: text("name", { length: 100 }).notNull(),
    // Optional — members are OTP-only; admins may skip too.
    passwordHash: text("password_hash", { length: 200 }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_users_phone").on(t.phone),
    uniqueIndex("idx_users_email").on(t.email),
  ],
);

// ── Workspaces ─────────────────────────────────────────────────────────────

export const workspaces = sqliteTable("workspaces", {
  id: text("id", { length: 36 }).primaryKey(),
  name: text("name", { length: 100 }).notNull(),
  createdBy: text("created_by", { length: 36 })
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
});

// ── Memberships (permission-based, no fixed roles) ─────────────────────────

export const memberships = sqliteTable(
  "memberships",
  {
    userId: text("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    isPrimaryAdmin: integer("is_primary_admin", { mode: "boolean" })
      .notNull()
      .default(false),
    joinedAt: text("joined_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })],
);

export const memberPermissions = sqliteTable(
  "member_permissions",
  {
    userId: text("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    permission: text("permission", { length: 40 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.workspaceId, t.permission] }),
    index("idx_member_perms_workspace").on(t.workspaceId),
  ],
);

export type Permission = SharedPermission;

// ── Devices & sessions ─────────────────────────────────────────────────────

export const devices = sqliteTable(
  "devices",
  {
    id: text("id", { length: 36 }).primaryKey(),
    userId: text("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    label: text("label", { length: 100 }).notNull(),
    platform: text("platform", { length: 10 }).notNull(),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("idx_devices_user").on(t.userId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id", { length: 36 }).primaryKey(),
    deviceId: text("device_id", { length: 36 })
      .notNull()
      .references(() => devices.id),
    tokenHash: text("token_hash", { length: 64 }).notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [
    uniqueIndex("idx_sessions_token_hash").on(t.tokenHash),
    index("idx_sessions_device").on(t.deviceId),
  ],
);

// ── One-time passwords (phone or email) ────────────────────────────────────

export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: text("id", { length: 36 }).primaryKey(),
    identifier: text("identifier").notNull(),
    code: text("code", { length: 10 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: text("expires_at").notNull(),
    verifiedAt: text("verified_at"),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_otp_identifier").on(t.identifier)],
);

// ── Password login brute-force protection ──────────────────────────────────

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id", { length: 36 }).primaryKey(),
    phone: text("phone", { length: 20 }).notNull(),
    // Failures count per identifier+device pair: an attacker hammering one
    // device can't lock the real owner out of their account.
    deviceKey: text("device_key", { length: 80 }).notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_login_attempts_phone").on(t.phone)],
);

// ── QR login ────────────────────────────────────────────────────────────────

export const qrLogins = sqliteTable("qr_logins", {
  id: text("id", { length: 36 }).primaryKey(),
  code: text("code", { length: 64 }).notNull().unique(),
  status: text("status", { length: 10 }).notNull().default("pending"),
  // Optional — when the requester named an identifier, approval grants THAT
  // account to the waiting device instead of the approver's own.
  identifier: text("identifier"),
  grantedTo: text("granted_to", { length: 36 }).references(() => users.id),
  approvedBy: text("approved_by", { length: 36 }).references(() => users.id),
  approvedAt: text("approved_at"),
  claimedAt: text("claimed_at"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Pre-added members (no codes — resolved by identifier at first login) ───

export const invites = sqliteTable(
  "invites",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    phone: text("phone", { length: 20 }),
    email: text("email", { length: 200 }),
    permissions: text("permissions").notNull(), // JSON array of permission strings
    invitedBy: text("invited_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    consumedAt: text("consumed_at"),
    // Pre-adds expire (owner decision): a recycled phone number must never
    // join with stale permissions years later.
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_invites_workspace").on(t.workspaceId),
    index("idx_invites_phone").on(t.phone),
    index("idx_invites_email").on(t.email),
  ],
);

// ── Company & financial years ──────────────────────────────────────────────

export type NumberingConfig = SharedNumberingConfig;

export const companies = sqliteTable("companies", {
  id: text("id", { length: 36 }).primaryKey(),
  workspaceId: text("workspace_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => workspaces.id),
  name: text("name", { length: 100 }).notNull(),
  gstin: text("gstin", { length: 15 }),
  pan: text("pan", { length: 10 }),
  address: text("address"),
  phone1: text("phone_1", { length: 20 }),
  phone2: text("phone_2", { length: 20 }),
  numbering: text("numbering").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by", { length: 36 }).references(() => users.id),
});

export const financialYears = sqliteTable(
  "financial_years",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    label: text("label", { length: 10 }).notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    salesNext: integer("sales_next").notNull().default(1),
    outwardNext: integer("outward_next").notNull().default(1),
    packingSaleNext: integer("packing_sale_next").notNull().default(1),
    packingJobNext: integer("packing_job_next").notNull().default(1),
    rawNext: integer("raw_next").notNull().default(1),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("uq_fy_workspace_label").on(t.workspaceId, t.label)],
);

// ── Masters ────────────────────────────────────────────────────────────────

export const customers = sqliteTable(
  "customers",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    name: text("name", { length: 200 }).notNull(),
    phone: text("phone", { length: 20 }),
    address: text("address"),
    gstin: text("gstin", { length: 15 }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_customers_workspace").on(t.workspaceId)],
);

export const jobWorkers = sqliteTable(
  "job_workers",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    name: text("name", { length: 200 }).notNull(),
    phone: text("phone", { length: 20 }),
    address: text("address"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_job_workers_workspace").on(t.workspaceId)],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    name: text("name", { length: 200 }).notNull(),
    phone: text("phone", { length: 20 }),
    address: text("address"),
    gstin: text("gstin", { length: 15 }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_suppliers_workspace").on(t.workspaceId)],
);

export const deniers = sqliteTable(
  "deniers",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    name: text("name", { length: 200 }).notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_deniers_workspace").on(t.workspaceId)],
);

export const colors = sqliteTable(
  "colors",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    name: text("name", { length: 200 }).notNull(),
    code: text("code", { length: 100 }),
    stockType: text("stock_type", { length: 4 }).notNull().default("dyed"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_colors_workspace").on(t.workspaceId)],
);

// ── Color Organiser (recipes are per color + denier, versioned) ────────────

export const colorRecipes = sqliteTable(
  "color_recipes",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    colorId: text("color_id", { length: 36 })
      .notNull()
      .references(() => colors.id),
    denierId: text("denier_id", { length: 36 })
      .notNull()
      .references(() => deniers.id),
    processTempC: integer("process_temp_c"),
    processTimeHrs: integer("process_time_hrs"),
    processTimeMin: integer("process_time_min"),
    processTimeSec: integer("process_time_sec"),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    // One living recipe per color+denier pair — history lives in versions.
    uniqueIndex("uq_recipes_workspace_color_denier").on(
      t.workspaceId,
      t.colorId,
      t.denierId,
    ),
    index("idx_recipes_workspace").on(t.workspaceId),
    index("idx_recipes_color").on(t.colorId),
  ],
);

export const colorRecipeIngredients = sqliteTable(
  "color_recipe_ingredients",
  {
    id: text("id", { length: 36 }).primaryKey(),
    recipeId: text("recipe_id", { length: 36 })
      .notNull()
      .references(() => colorRecipes.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull().default(0),
    name: text("name", { length: 120 }).notNull(),
    quantity: real("quantity").notNull(),
    // g / mg presets plus any custom unit the workspace types in.
    unit: text("unit", { length: 20 }).notNull().default("g"),
  },
  (t) => [index("idx_recipe_ingredients_recipe").on(t.recipeId)],
);

export const colorRecipeVersions = sqliteTable(
  "color_recipe_versions",
  {
    id: text("id", { length: 36 }).primaryKey(),
    recipeId: text("recipe_id", { length: 36 })
      .notNull()
      .references(() => colorRecipes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // Full recipe snapshot (ingredients + process + notes) at save time.
    payload: text("payload").notNull(),
    restoredFrom: integer("restored_from"),
    savedBy: text("saved_by", { length: 36 }).references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("uq_recipe_versions_recipe_version").on(t.recipeId, t.version),
  ],
);

// ── Challans (sales + outward only — inward removed, rates removed) ────────

export const challans = sqliteTable(
  "challans",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    financialYearId: text("financial_year_id", { length: 36 })
      .notNull()
      .references(() => financialYears.id),
    type: text("type", { length: 10 }).notNull().default("sales"),
    challanNumber: text("challan_number", { length: 50 }).notNull(),
    date: text("date").notNull(),
    customerId: text("customer_id", { length: 36 }).references(
      () => customers.id,
    ),
    customerName: text("customer_name", { length: 200 }),
    customerGstin: text("customer_gstin", { length: 15 }),
    jobWorkerId: text("job_worker_id", { length: 36 }).references(
      () => jobWorkers.id,
    ),
    jobWorkerName: text("job_worker_name", { length: 200 }),
    notes: text("notes"),
    totalBoxes: integer("total_boxes").notNull().default(0),
    totalCheese: integer("total_cheese").notNull().default(0),
    totalGrossWt: real("total_gross_wt").notNull().default(0),
    totalTareWt: real("total_tare_wt").notNull().default(0),
    totalNetWt: real("total_net_wt").notNull().default(0),
    createdBy: text("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    clientRef: text("client_ref", { length: 60 }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("uq_challans_workspace_number").on(
      t.workspaceId,
      t.financialYearId,
      t.challanNumber,
    ),
    uniqueIndex("uq_challans_workspace_client_ref").on(
      t.workspaceId,
      t.clientRef,
    ),
    index("idx_challans_workspace_fy").on(t.workspaceId, t.financialYearId),
    index("idx_challans_workspace_date").on(t.workspaceId, t.date),
  ],
);

export const challanItems = sqliteTable(
  "challan_items",
  {
    id: text("id", { length: 36 }).primaryKey(),
    challanId: text("challan_id", { length: 36 })
      .notNull()
      .references(() => challans.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull().default(0),
    denierId: text("denier_id", { length: 36 }).references(() => deniers.id),
    denierName: text("denier_name", { length: 200 }).notNull(),
    colorId: text("color_id", { length: 36 }).references(() => colors.id),
    colorName: text("color_name", { length: 200 }).notNull(),
    colorCode: text("color_code", { length: 100 }),
    boxNo: text("box_no", { length: 50 }).notNull().default(""),
    lotNo: text("lot_no", { length: 50 }).notNull().default(""),
    cheese: integer("cheese").notNull().default(0),
    grossWt: real("gross_wt").notNull().default(0),
    tareWt: real("tare_wt").notNull().default(0),
    remarks: text("remarks").notNull().default(""),
    boxes: integer("boxes").notNull().default(1),
    netWt: real("net_wt").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_challan_items_challan").on(t.challanId)],
);

// ── Job-work returns (challan_id on items — each row picks its challan) ────

export const jobWorkReturns = sqliteTable(
  "job_work_returns",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    jobWorkerId: text("job_worker_id", { length: 36 })
      .notNull()
      .references(() => jobWorkers.id),
    jobWorkerName: text("job_worker_name", { length: 200 }).notNull(),
    invoiceNo: text("invoice_no", { length: 100 }).notNull(),
    date: text("date").notNull(),
    remarks: text("remarks"),
    receivedBy: text("received_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_returns_workspace").on(t.workspaceId),
    index("idx_returns_job_worker").on(t.jobWorkerId),
    index("idx_returns_date").on(t.date),
  ],
);

export const jobWorkReturnItems = sqliteTable(
  "job_work_return_items",
  {
    id: text("id", { length: 36 }).primaryKey(),
    returnId: text("return_id", { length: 36 })
      .notNull()
      .references(() => jobWorkReturns.id, { onDelete: "cascade" }),
    challanId: text("challan_id", { length: 36 })
      .notNull()
      .references(() => challans.id),
    seq: integer("seq").notNull().default(0),
    denierId: text("denier_id", { length: 36 }).references(() => deniers.id),
    denierName: text("denier_name", { length: 200 }).notNull(),
    colorId: text("color_id", { length: 36 }).references(() => colors.id),
    colorName: text("color_name", { length: 200 }).notNull(),
    colorCode: text("color_code", { length: 100 }),
    lotNo: text("lot_no", { length: 100 }).notNull().default(""),
    netWt: real("net_wt").notNull(),
    cones: integer("cones"),
    overReceipt: integer("over_receipt", { mode: "boolean" })
      .notNull()
      .default(false),
    overReceiptQty: real("over_receipt_qty"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_return_items_return").on(t.returnId),
    index("idx_return_items_challan").on(t.challanId),
  ],
);

// ── Raw material entries ───────────────────────────────────────────────────

export const rawMaterialEntries = sqliteTable(
  "raw_material_entries",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    financialYearId: text("financial_year_id", { length: 36 })
      .notNull()
      .references(() => financialYears.id),
    entryNumber: text("entry_number", { length: 50 }).notNull(),
    supplierId: text("supplier_id", { length: 36 }).references(
      () => suppliers.id,
    ),
    supplierName: text("supplier_name", { length: 200 }),
    supplierChallanNo: text("supplier_challan_no", { length: 100 }),
    date: text("date").notNull(),
    notes: text("notes"),
    createdBy: text("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("uq_raw_workspace_number").on(
      t.workspaceId,
      t.financialYearId,
      t.entryNumber,
    ),
    index("idx_raw_workspace_date").on(t.workspaceId, t.date),
  ],
);

export const rawMaterialItems = sqliteTable(
  "raw_material_items",
  {
    id: text("id", { length: 36 }).primaryKey(),
    entryId: text("entry_id", { length: 36 })
      .notNull()
      .references(() => rawMaterialEntries.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull().default(0),
    denierId: text("denier_id", { length: 36 }).references(() => deniers.id),
    denierName: text("denier_name", { length: 200 }).notNull(),
    colorId: text("color_id", { length: 36 }).references(() => colors.id),
    colorName: text("color_name", { length: 200 }).notNull(),
    colorCode: text("color_code", { length: 100 }),
    netWt: real("net_wt").notNull(),
    grossWt: real("gross_wt"),
    tareWt: real("tare_wt"),
    cones: integer("cones"),
    lotNo: text("lot_no", { length: 100 }).notNull().default(""),
    boxNo: text("box_no", { length: 60 }),
    packingUnit: text("packing_unit", { length: 10 }),
    packingCount: integer("packing_count"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_raw_items_entry").on(t.entryId)],
);

// ── Packing entries (packer creates — 2 types: sale | job_work) ────────────

export const packingEntries = sqliteTable(
  "packing_entries",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    financialYearId: text("financial_year_id", { length: 36 })
      .notNull()
      .references(() => financialYears.id),
    type: text("type", { length: 10 }).notNull(),
    entryNumber: text("entry_number", { length: 50 }).notNull(),
    date: text("date").notNull(),
    createdBy: text("created_by", { length: 36 })
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("uq_packing_workspace_number").on(
      t.workspaceId,
      t.financialYearId,
      t.entryNumber,
    ),
    index("idx_packing_workspace_type").on(t.workspaceId, t.type),
    index("idx_packing_workspace_date").on(t.workspaceId, t.date),
    index("idx_packing_created_by").on(t.createdBy),
  ],
);

export const packingItems = sqliteTable(
  "packing_items",
  {
    id: text("id", { length: 36 }).primaryKey(),
    entryId: text("entry_id", { length: 36 })
      .notNull()
      .references(() => packingEntries.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull().default(0),
    denierId: text("denier_id", { length: 36 }).references(() => deniers.id),
    denierName: text("denier_name", { length: 200 }).notNull(),
    colorId: text("color_id", { length: 36 }).references(() => colors.id),
    colorName: text("color_name", { length: 200 }).notNull(),
    colorCode: text("color_code", { length: 100 }),
    tareWt: real("tare_wt"),
    grossWt: real("gross_wt"),
    sackWt: real("sack_wt"),
    sacks: integer("sacks"),
    cones: integer("cones"),
    boxNo: text("box_no", { length: 50 }),
    lotNo: text("lot_no", { length: 100 }),
    remarks: text("remarks"),
    netWt: real("net_wt").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_packing_items_entry").on(t.entryId)],
);

// ── Rate-limit counters (D1-backed sliding windows, see lib/rate-limit.ts) ─

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key", { length: 120 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: text("window_start").notNull(),
});

// ── Stock ledger (2 inventory systems: raw + dyed, with lot_no) ────────────

export const stockEntries = sqliteTable(
  "stock_entries",
  {
    id: text("id", { length: 36 }).primaryKey(),
    workspaceId: text("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id),
    stockType: text("stock_type", { length: 4 }).notNull(),
    denierId: text("denier_id", { length: 36 }),
    denierName: text("denier_name", { length: 200 }).notNull(),
    colorId: text("color_id", { length: 36 }),
    colorName: text("color_name", { length: 200 }).notNull(),
    colorCode: text("color_code", { length: 100 }),
    lotNo: text("lot_no", { length: 100 }).notNull().default(""),
    movement: text("movement", { length: 4 }).notNull(),
    source: text("source", { length: 20 }).notNull(),
    sourceRefId: text("source_ref_id", { length: 36 }).notNull(),
    netWt: real("net_wt").notNull(),
    date: text("date").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_stock_workspace_type").on(t.workspaceId, t.stockType),
    index("idx_stock_workspace_date").on(t.workspaceId, t.date),
    index("idx_stock_source").on(t.source, t.sourceRefId),
    index("idx_stock_denier_color").on(t.workspaceId, t.denierId, t.colorId),
  ],
);
