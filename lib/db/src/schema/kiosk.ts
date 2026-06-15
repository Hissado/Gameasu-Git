import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";

// ─────────────────────────────────────────────────────────────────
// KIOSK — Borne de pointage autonome (Phase 19)
// kiosks              : borne physique ou logique par organisation
// ─────────────────────────────────────────────────────────────────

export const kiosksTable = pgTable("kiosks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  // Token d'accès public (UUID) — transmis dans le header X-Kiosk-Token
  token: uuid("token").notNull().defaultRandom(),
  // Paramètres JSON : photoEnabled, requirePhoto, timezone, orgLogoUrl, etc.
  settings: jsonb("settings").$type<{
    photoEnabled?: boolean;
    requirePhoto?: boolean;
    timezone?: string;
    orgLogoUrl?: string | null;
    orgName?: string | null;
    welcomeMessage?: string | null;
  }>().default({}),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  // Traçabilité du token
  usageCount: integer("usage_count").notNull().default(0),
  generatedByUserId: uuid("generated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: uuid("revoked_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("kiosks_org_idx").on(t.organizationId),
  tokenIdx: uniqueIndex("kiosks_token_uidx").on(t.token),
  activeIdx: index("kiosks_active_idx").on(t.isActive),
}));

export const insertKioskSchema = createInsertSchema(kiosksTable).omit({ id: true, createdAt: true, updatedAt: true, lastSeenAt: true });
export type InsertKiosk = z.infer<typeof insertKioskSchema>;
export type Kiosk = typeof kiosksTable.$inferSelect;
