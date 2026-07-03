import { pgTable, text, boolean, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./saas";

// ─────────────────────────────────────────────────────────────────
// AUTH SESSIONS — sessions serveur (remplacent le token Base64)
// ─────────────────────────────────────────────────────────────────
export const authSessionsTable = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Token opaque (crypto.randomUUID()), stocké tel quel pour lookup direct
  token: text("token").notNull(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // Organisation active pour cette session (multi-org). NULL = org primaire de l'utilisateur.
  activeOrgId: uuid("active_org_id").references(() => organizationsTable.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenUidx: uniqueIndex("auth_sessions_token_uidx").on(t.token),
  userIdx: index("auth_sessions_user_idx").on(t.userId),
  expiresIdx: index("auth_sessions_expires_idx").on(t.expiresAt),
}));

// ─────────────────────────────────────────────────────────────────
// TWO FACTOR CODES — codes OTP à 6 chiffres envoyés par email
// ─────────────────────────────────────────────────────────────────
export const twoFactorCodesTable = pgTable("two_factor_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // Token temporaire renvoyé au client après l'étape 1 du login
  tempToken: text("temp_token").notNull(),
  // Hash bcrypt du code à 6 chiffres
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tempTokenUidx: uniqueIndex("two_factor_codes_temp_token_uidx").on(t.tempToken),
  userIdx: index("two_factor_codes_user_idx").on(t.userId),
}));

// ─────────────────────────────────────────────────────────────────
// TRUSTED DEVICES — appareils mémorisés (bypass 2FA 60 jours)
// ─────────────────────────────────────────────────────────────────
export const trustedDevicesTable = pgTable("trusted_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // Hash bcrypt du deviceToken brut (stocké dans localStorage côté client)
  deviceTokenHash: text("device_token_hash").notNull(),
  label: text("label"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("trusted_devices_user_idx").on(t.userId),
  expiresIdx: index("trusted_devices_expires_idx").on(t.expiresAt),
}));

export type AuthSession = typeof authSessionsTable.$inferSelect;
export type TwoFactorCode = typeof twoFactorCodesTable.$inferSelect;
export type TrustedDevice = typeof trustedDevicesTable.$inferSelect;
