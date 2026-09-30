import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ── Users ──────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  "users",
  {
    id: text("id", { length: 36 }).primaryKey(),
    // At least one identifier required — phone OR email (enforced in app layer).
    phone: text("phone", { length: 20 }),
    email: text("email", { length: 200 }),
    name: text("name", { length: 100 }).notNull(),
    passwordHash: text("password_hash", { length: 200 }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_users_phone").on(t.phone),
    uniqueIndex("idx_users_email").on(t.email),
  ],
);

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
    code: text("code", { length: 64 }).notNull(),
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
  identifier: text("identifier"),
  grantedTo: text("granted_to", { length: 36 }).references(() => users.id),
  approvedBy: text("approved_by", { length: 36 }).references(() => users.id),
  approvedAt: text("approved_at"),
  claimedAt: text("claimed_at"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Rate-limit counters (D1-backed sliding windows, see lib/rate-limit.ts) ─

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key", { length: 120 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: text("window_start").notNull(),
});
