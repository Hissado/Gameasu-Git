import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./saas";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  // Code de rôle (clé fonctionnelle). Référence implicite à `roles.code`.
  role: text("role").notNull().default("collaborator"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  // Lien direct vers un département (utilisé pour ACL et hiérarchie ; le rattachement
  // RH détaillé reste dans `collaborators`).
  departmentId: uuid("department_id"),
  isActive: boolean("is_active").notNull().default(true),
  isClient: boolean("is_client").notNull().default(false),
  clientId: uuid("client_id"),
  // ─── Onboarding & sécurité ────────────────────────────────────
  // true tant que l'utilisateur n'a pas changé son mot de passe initial / temporaire.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  // Token d'invitation/réinitialisation (one-shot, expiration via le champ ci-dessous).
  passwordResetToken: text("password_reset_token"),
  passwordResetTokenExpiresAt: timestamp("password_reset_token_expires_at", { withTimezone: true }),
  // Métadonnées d'invitation
  invitedById: uuid("invited_by_id"),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
