import { pgTable, text, boolean, timestamp, uuid, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// ─────────────────────────────────────────────────────────────────
// NEXORA — couche SaaS multi-tenant
// Espaces de travail (organisations), abonnements, plans, modules,
// facturation et invitations. Tout cela est neutre métier et peut
// embarquer plusieurs entreprises sur la même instance.
// ─────────────────────────────────────────────────────────────────

export const organizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  industry: text("industry"),
  country: text("country").default("TG"),
  currency: text("currency").notNull().default("XOF"),
  timezone: text("timezone").notNull().default("Africa/Lome"),
  locale: text("locale").notNull().default("fr-FR"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#FF6B00"),
  secondaryColor: text("secondary_color").default("#0F172A"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  taxId: text("tax_id"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  slugUidx: uniqueIndex("organizations_slug_uidx").on(t.slug),
  defaultIdx: index("organizations_default_idx").on(t.isDefault),
}));

export const organizationMembersTable = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner | admin | manager | member
  isPrimary: boolean("is_primary").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("organization_members_uidx").on(t.organizationId, t.userId),
  orgIdx: index("organization_members_org_idx").on(t.organizationId),
  userIdx: index("organization_members_user_idx").on(t.userId),
}));

// ─────────────────────────────────────────────────────────────────
// CATALOGUE MODULES — métadonnées des grands modules produits Gaméasù
// ─────────────────────────────────────────────────────────────────
export const moduleCatalogTable = pgTable("module_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(), // ex. "accounting", "marketing"
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("business"), // core | business | admin
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(100),
  isCore: boolean("is_core").notNull().default(false),
}, (t) => ({
  keyUidx: uniqueIndex("module_catalog_key_uidx").on(t.key),
}));

// ─────────────────────────────────────────────────────────────────
// PLANS SaaS — catalogue Starter / Growth / Professional / Enterprise
// ─────────────────────────────────────────────────────────────────
export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(), // STARTER | GROWTH | PROFESSIONAL | ENTERPRISE
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  // Prix en FCFA. Tarification mensuelle de base par utilisateur, et option annuelle.
  monthlyPricePerSeat: integer("monthly_price_per_seat").notNull().default(0),
  annualPricePerSeat: integer("annual_price_per_seat").notNull().default(0),
  setupFee: integer("setup_fee").notNull().default(0),
  minimumSeats: integer("minimum_seats").notNull().default(1),
  includedSeats: integer("included_seats").notNull().default(1),
  maxSeats: integer("max_seats"), // null = illimité
  currency: text("currency").notNull().default("XOF"),
  // Liste des module keys inclus (ex. ["dashboard","clients","projects",...])
  includedModules: jsonb("included_modules").$type<string[]>().notNull().default([]),
  // Mise en avant commerciale
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  codeUidx: uniqueIndex("subscription_plans_code_uidx").on(t.code),
}));

export const subscriptionPlanFeaturesTable = pgTable("subscription_plan_features", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlansTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  included: boolean("included").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
}, (t) => ({
  planIdx: index("subscription_plan_features_plan_idx").on(t.planId),
}));

// ─────────────────────────────────────────────────────────────────
// ABONNEMENTS — une organisation a un abonnement actif courant
// ─────────────────────────────────────────────────────────────────
export const organizationSubscriptionsTable = pgTable("organization_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlansTable.id),
  status: text("status").notNull().default("active"), // trial | active | past_due | canceled
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly | annual
  seats: integer("seats").notNull().default(1),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  // Snapshot des montants au moment de la souscription
  unitPrice: integer("unit_price").notNull().default(0),
  setupFee: integer("setup_fee").notNull().default(0),
  currency: text("currency").notNull().default("XOF"),
  notes: text("notes"),
  isCurrent: boolean("is_current").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("organization_subscriptions_org_idx").on(t.organizationId),
  currentIdx: index("organization_subscriptions_current_idx").on(t.organizationId, t.isCurrent),
}));

// ─────────────────────────────────────────────────────────────────
// MODULES ACTIVÉS — état réel des modules par organisation
// ─────────────────────────────────────────────────────────────────
export const organizationModulesTable = pgTable("organization_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  // Source : "plan" (inclus dans le plan), "addon" (option payante), "manual" (forcé admin)
  source: text("source").notNull().default("plan"),
  config: jsonb("config"),
  enabledAt: timestamp("enabled_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uniq: uniqueIndex("organization_modules_uidx").on(t.organizationId, t.moduleKey),
  orgIdx: index("organization_modules_org_idx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────────────
// BILLING EVENTS — journal de facturation
// ─────────────────────────────────────────────────────────────────
export const billingEventsTable = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(() => organizationSubscriptionsTable.id, { onDelete: "set null" }),
  // invoice | payment | setup_fee | plan_change | cycle_change | refund | adjustment
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  amount: integer("amount").notNull().default(0),
  currency: text("currency").notNull().default("XOF"),
  // pending | paid | failed | refunded
  status: text("status").notNull().default("paid"),
  reference: text("reference"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("billing_events_org_idx").on(t.organizationId),
  kindIdx: index("billing_events_kind_idx").on(t.kind),
  occurredIdx: index("billing_events_occurred_idx").on(t.occurredAt),
}));

// ─────────────────────────────────────────────────────────────────
// INVITATIONS WORKSPACE
// ─────────────────────────────────────────────────────────────────
export const workspaceInvitationsTable = pgTable("workspace_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull(),
  invitedById: uuid("invited_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  // pending | accepted | revoked | expired
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenUidx: uniqueIndex("workspace_invitations_token_uidx").on(t.token),
  orgEmailIdx: index("workspace_invitations_org_email_idx").on(t.organizationId, t.email),
}));

// ─────────────────────────────────────────────────────────────────
// Schémas Zod & types
// ─────────────────────────────────────────────────────────────────
export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrganizationMemberSchema = createInsertSchema(organizationMembersTable).omit({ id: true, joinedAt: true });
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrganizationSubscriptionSchema = createInsertSchema(organizationSubscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrganizationModuleSchema = createInsertSchema(organizationModulesTable).omit({ id: true, enabledAt: true, updatedAt: true });
export const insertBillingEventSchema = createInsertSchema(billingEventsTable).omit({ id: true, createdAt: true });
export const insertWorkspaceInvitationSchema = createInsertSchema(workspaceInvitationsTable).omit({ id: true, createdAt: true });

export type Organization = typeof organizationsTable.$inferSelect;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
export type SubscriptionPlanFeature = typeof subscriptionPlanFeaturesTable.$inferSelect;
export type OrganizationSubscription = typeof organizationSubscriptionsTable.$inferSelect;
export type OrganizationModule = typeof organizationModulesTable.$inferSelect;
export type BillingEvent = typeof billingEventsTable.$inferSelect;
export type WorkspaceInvitation = typeof workspaceInvitationsTable.$inferSelect;
export type ModuleCatalog = typeof moduleCatalogTable.$inferSelect;

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type InsertOrganizationSubscription = z.infer<typeof insertOrganizationSubscriptionSchema>;
export type InsertOrganizationModule = z.infer<typeof insertOrganizationModuleSchema>;
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type InsertWorkspaceInvitation = z.infer<typeof insertWorkspaceInvitationSchema>;
