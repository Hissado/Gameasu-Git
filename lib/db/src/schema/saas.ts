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
  // Stripe — identifiant client Stripe (cus_xxx), jamais exposé côté front
  stripeCustomerId: text("stripe_customer_id"),
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
// CATALOGUE MODULES — métadonnées des grands modules produits Gameasu
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
  // Autopay / renouvellement automatique par carte
  autopayEnabled: boolean("autopay_enabled").notNull().default(false),
  // Identifiant du moyen de paiement sauvegardé (pm_xxx) — stocké côté serveur uniquement
  stripePaymentMethodId: text("stripe_payment_method_id"),
  // Informations d'affichage de la carte (jamais de numéro complet ni CVV)
  cardBrand: text("card_brand"),         // visa | mastercard | amex | ...
  cardLast4: text("card_last4"),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  // Date de la prochaine tentative de renouvellement automatique
  nextAutopayAt: timestamp("next_autopay_at", { withTimezone: true }),
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
// INVITATIONS STRUCTURE — onboarding d'une nouvelle organisation
// (lien envoyé par le super-admin, l'invité finalise lui-même org+plan)
// ─────────────────────────────────────────────────────────────────
export const structureInvitationsTable = pgTable("structure_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull(),
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  suggestedPlanCode: text("suggested_plan_code"),
  suggestedOrgName: text("suggested_org_name"),
  notes: text("notes"),
  // pending | accepted | revoked | expired
  status: text("status").notNull().default("pending"),
  invitedById: uuid("invited_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenUidx: uniqueIndex("structure_invitations_token_uidx").on(t.token),
  statusIdx: index("structure_invitations_status_idx").on(t.status),
}));

export type StructureInvitation = typeof structureInvitationsTable.$inferSelect;

// ─────────────────────────────────────────────────────────────────
// TRANSACTIONS DE PAIEMENT TENANT
// Suit chaque tentative de paiement d'abonnement/frais par un tenant
// ─────────────────────────────────────────────────────────────────
export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(() => organizationSubscriptionsTable.id, { onDelete: "set null" }),
  billingEventId: uuid("billing_event_id").references(() => billingEventsTable.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("XOF"),
  // card | mixx | flooz | mobile_money | virement | depot_bancaire | depot_bureau | cheque
  method: text("method").notNull(),
  payerPhone: text("payer_phone"),
  // pending | pending_verification | confirmed | rejected | failed | cancelled | expired | refunded
  status: text("status").notNull().default("pending"),
  reference: text("reference"),
  gatewayRef: text("gateway_ref"),
  receiptNumber: text("receipt_number"),
  // renewal | setup_fee | upgrade | addon | seats
  purpose: text("purpose").notNull().default("renewal"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  // Paiements manuels déclarés
  declaredAt: timestamp("declared_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedById: uuid("verified_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  rejectionReason: text("rejection_reason"),
  justificationUrl: text("justification_url"),
  coversPeriodStart: timestamp("covers_period_start", { withTimezone: true }),
  coversPeriodEnd: timestamp("covers_period_end", { withTimezone: true }),
  planCode: text("plan_code"),
  seats: integer("seats"),
  periodicity: text("periodicity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("payment_tx_org_idx").on(t.organizationId),
  statusIdx: index("payment_tx_status_idx").on(t.status),
  declaredIdx: index("payment_tx_declared_idx").on(t.declaredAt),
}));

// ─────────────────────────────────────────────────────────────────
// CONFIGURATION DES PASSERELLES DE PAIEMENT (system-wide)
// Les clés secrètes ne sont JAMAIS stockées ici — variables d'env uniquement
// ─────────────────────────────────────────────────────────────────
export const paymentGatewayConfigsTable = pgTable("payment_gateway_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  // stripe | paydunya | cinetpay | flutterwave | mixx_api | flooz_api | manual
  gateway: text("gateway").notNull(),
  displayName: text("display_name").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  isSandbox: boolean("is_sandbox").notNull().default(true),
  // Clé publique (safe) — clé secrète via variable d'env uniquement
  publicKey: text("public_key"),
  webhookUrl: text("webhook_url"),
  txFeePercent: text("tx_fee_percent").default("0"),
  txFeeFixed: integer("tx_fee_fixed").default(0),
  minAmount: integer("min_amount").default(100),
  maxAmount: integer("max_amount").default(10000000),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  gatewayUidx: uniqueIndex("payment_gateway_configs_gateway_uidx").on(t.gateway),
}));

// ─────────────────────────────────────────────────────────────────
// Add-on catalog & tenant subscriptions
// ─────────────────────────────────────────────────────────────────

export const addonCatalogTable = pgTable("addon_catalog", {
  id:           uuid("id").primaryKey().defaultRandom(),
  slug:         text("slug").notNull(),
  name:         text("name").notNull(),
  description:  text("description"),
  category:     text("category").notNull().default("general"), // sms | email | support | storage | general
  billingType:  text("billing_type").notNull().default("monthly"), // monthly | annual | usage | onetime
  priceHT:      integer("price_ht").notNull().default(0),     // FCFA HT
  unit:         text("unit"),                                 // "SMS" | "email" | "Go" — for usage billing
  includedUnits:integer("included_units"),                    // units bundled in the price
  isActive:     boolean("is_active").notNull().default(true),
  sortOrder:    integer("sort_order").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  slugUidx: uniqueIndex("addon_catalog_slug_uidx").on(t.slug),
}));

export const orgAddonsTable = pgTable("org_addons", {
  id:               uuid("id").primaryKey().defaultRandom(),
  organizationId:   uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  addonId:          uuid("addon_id").notNull().references(() => addonCatalogTable.id, { onDelete: "cascade" }),
  status:           text("status").notNull().default("inactive"), // active | inactive | pending_quote
  activatedAt:      timestamp("activated_at", { withTimezone: true }),
  nextRenewalAt:    timestamp("next_renewal_at", { withTimezone: true }),
  usageUsed:        integer("usage_used").notNull().default(0),
  creditsPurchased: integer("credits_purchased").notNull().default(0),
  customPriceHT:    integer("custom_price_ht"),                         // surcharge super-admin (null = prix catalogue)
  notes:            text("notes"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgAddonUidx: uniqueIndex("org_addons_org_addon_uidx").on(t.organizationId, t.addonId),
}));

// ─────────────────────────────────────────────────────────────────
// Demandes d'accès (prospects entrants depuis la page login)
// ─────────────────────────────────────────────────────────────────
export const accessRequestsTable = pgTable("access_requests", {
  id:                uuid("id").primaryKey().defaultRandom(),
  // Contact
  contactName:       text("contact_name").notNull(),
  contactFunction:   text("contact_function"),
  contactEmail:      text("contact_email").notNull(),
  contactPhone:      text("contact_phone"),
  contactPreference: text("contact_preference").notNull().default("email"), // email | phone | whatsapp
  // Organisation
  orgName:           text("org_name").notNull(),
  orgSector:         text("org_sector"),
  orgDomain:         text("org_domain"),
  orgSize:           text("org_size"),                    // 1-5 | 6-20 | 21-50 | 51-100 | 100+
  estimatedUsers:    text("estimated_users"),
  country:           text("country"),
  city:              text("city"),
  // Besoin
  desiredModules:    jsonb("desired_modules").$type<string[]>().notNull().default([]),
  mainNeed:          text("main_need"),
  message:           text("message"),
  consentGiven:      boolean("consent_given").notNull().default(false),
  // Suivi commercial
  status:            text("status").notNull().default("new"),
  // new | to_contact | contacted | demo_planned | qualifying | offer_sent | converted | rejected
  assignedTo:        uuid("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  notes:             text("notes"),
  source:            text("source").notNull().default("login_page"),
  // Emails
  confirmationSent:  boolean("confirmation_sent").notNull().default(false),
  notificationSent:  boolean("notification_sent").notNull().default(false),
  // Timestamps
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  contactedAt:       timestamp("contacted_at", { withTimezone: true }),
}, (t) => ({
  statusIdx: index("access_requests_status_idx").on(t.status),
  emailIdx:  index("access_requests_email_idx").on(t.contactEmail),
  createdIdx: index("access_requests_created_idx").on(t.createdAt),
}));

// ─────────────────────────────────────────────────────────────────
// Schémas Zod & types
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// PARAMÈTRES PLATEFORME — clé/valeur jsonb pour la config système
// ─────────────────────────────────────────────────────────────────
export const platformSettingsTable = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedById: uuid("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
});

export type PlatformSetting = typeof platformSettingsTable.$inferSelect;

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

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentGatewayConfigSchema = createInsertSchema(paymentGatewayConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
export type PaymentGatewayConfig = typeof paymentGatewayConfigsTable.$inferSelect;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;

export type AddonCatalog = typeof addonCatalogTable.$inferSelect;
export type OrgAddon    = typeof orgAddonsTable.$inferSelect;
export type InsertPaymentGatewayConfig = z.infer<typeof insertPaymentGatewayConfigSchema>;

export const insertAccessRequestSchema = createInsertSchema(accessRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type AccessRequest = typeof accessRequestsTable.$inferSelect;
export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;
