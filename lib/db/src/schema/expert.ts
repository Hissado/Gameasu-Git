import { pgTable, text, boolean, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable } from "./saas";

// ─────────────────────────────────────────────────────────────────
// EXPERT PORTAL — cabinets d'experts (comptables, consultants, agences)
// Un cabinet peut gérer plusieurs organisations clientes Gameasu
// depuis un seul compte, sans partager les données entre clients.
// ─────────────────────────────────────────────────────────────────

/** Cabinet d'expertise (comptable, consultant, agence conseil) */
export const expertFirmsTable = pgTable("expert_firms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  country: text("country").notNull().default("TG"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  logoUrl: text("logo_url"),
  // starter | growth | professional (reprise du catalogue plans SaaS)
  plan: text("plan").notNull().default("starter"),
  isActive: boolean("is_active").notNull().default(true),
  // Organisation tenant propre au cabinet (créée à l'acceptation de l'invitation)
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "set null" }),
  createdById: uuid("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  slugUidx: uniqueIndex("expert_firms_slug_uidx").on(t.slug),
  activeIdx: index("expert_firms_active_idx").on(t.isActive),
}));

/** Membres d'un cabinet (owner / admin / member) */
export const expertFirmMembersTable = pgTable("expert_firm_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id").notNull().references(() => expertFirmsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // owner | admin | member
  role: text("role").notNull().default("member"),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
}, (t) => ({
  uniq: uniqueIndex("expert_firm_members_uidx").on(t.firmId, t.userId),
  firmIdx: index("expert_firm_members_firm_idx").on(t.firmId),
  userIdx: index("expert_firm_members_user_idx").on(t.userId),
}));

/** Accès d'un cabinet à une organisation cliente */
export const expertClientAccessTable = pgTable("expert_client_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id").notNull().references(() => expertFirmsTable.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // full | read | billing
  accessLevel: text("access_level").notNull().default("read"),
  isActive: boolean("is_active").notNull().default(true),
  grantedById: uuid("granted_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  notes: text("notes"),
}, (t) => ({
  uniq: uniqueIndex("expert_client_access_uidx").on(t.firmId, t.orgId),
  firmIdx: index("expert_client_access_firm_idx").on(t.firmId),
  orgIdx: index("expert_client_access_org_idx").on(t.orgId),
  activeIdx: index("expert_client_access_active_idx").on(t.isActive),
}));

/** Demandes de documents adressées par un cabinet à un client */
export const documentRequestsTable = pgTable("document_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id").notNull().references(() => expertFirmsTable.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  // en_attente | recu | rejete | valide
  status: text("status").notNull().default("en_attente"),
  dueDate: text("due_date"), // ISO date string YYYY-MM-DD
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  requestedById: uuid("requested_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  respondedById: uuid("responded_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  firmIdx: index("document_requests_firm_idx").on(t.firmId),
  orgIdx: index("document_requests_org_idx").on(t.orgId),
  statusIdx: index("document_requests_status_idx").on(t.status),
}));

/**
 * Sessions de contexte expert — permettent à un expert de "switcher" vers
 * une org cliente sans déconnexion. Token court-vécu (8h) stocké côté serveur.
 * Le frontend inclut ce token dans le header X-Expert-Context lors des appels
 * qui doivent opérer dans le contexte de l'org cliente.
 */
export const expertContextSessionsTable = pgTable("expert_context_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull(),
  expertUserId: uuid("expert_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  firmId: uuid("firm_id").notNull().references(() => expertFirmsTable.id, { onDelete: "cascade" }),
  targetOrgId: uuid("target_org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenUidx: uniqueIndex("expert_context_sessions_token_uidx").on(t.token),
  userIdx: index("expert_context_sessions_user_idx").on(t.expertUserId),
  firmIdx: index("expert_context_sessions_firm_idx").on(t.firmId),
  expiresIdx: index("expert_context_sessions_expires_idx").on(t.expiresAt),
}));

/**
 * Invitations cabinet — token sécurisé envoyé par le Cockpit super-admin
 * pour qu'un expert crée son espace professionnel Gameasu.
 * Durée de validité : 72 heures.
 */
export const expertFirmInvitationsTable = pgTable("expert_firm_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull(),
  firmId: uuid("firm_id").notNull().references(() => expertFirmsTable.id, { onDelete: "cascade" }),
  // Email de l'administrateur invité (celui qui recevra le lien)
  email: text("email").notNull(),
  // pending | accepted | expired
  status: text("status").notNull().default("pending"),
  invitedByAdminId: uuid("invited_by_admin_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenUidx: uniqueIndex("expert_firm_invitations_token_uidx").on(t.token),
  firmIdx: index("expert_firm_invitations_firm_idx").on(t.firmId),
  statusIdx: index("expert_firm_invitations_status_idx").on(t.status),
}));

// ─── Zod schemas & types ──────────────────────────────────────────
export const insertExpertFirmSchema = createInsertSchema(expertFirmsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpertFirmMemberSchema = createInsertSchema(expertFirmMembersTable).omit({ id: true, invitedAt: true });
export const insertExpertClientAccessSchema = createInsertSchema(expertClientAccessTable).omit({ id: true, grantedAt: true });
export const insertDocumentRequestSchema = createInsertSchema(documentRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpertFirmInvitationSchema = createInsertSchema(expertFirmInvitationsTable).omit({ id: true, createdAt: true });

export type ExpertFirm = typeof expertFirmsTable.$inferSelect;
export type ExpertFirmMember = typeof expertFirmMembersTable.$inferSelect;
export type ExpertClientAccess = typeof expertClientAccessTable.$inferSelect;
export type DocumentRequest = typeof documentRequestsTable.$inferSelect;
export type ExpertContextSession = typeof expertContextSessionsTable.$inferSelect;
export type ExpertFirmInvitation = typeof expertFirmInvitationsTable.$inferSelect;

export type InsertExpertFirm = z.infer<typeof insertExpertFirmSchema>;
export type InsertExpertFirmMember = z.infer<typeof insertExpertFirmMemberSchema>;
export type InsertExpertClientAccess = z.infer<typeof insertExpertClientAccessSchema>;
export type InsertDocumentRequest = z.infer<typeof insertDocumentRequestSchema>;
export type InsertExpertFirmInvitation = z.infer<typeof insertExpertFirmInvitationSchema>;
