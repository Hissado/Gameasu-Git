import { pgTable, text, timestamp, uuid, jsonb, integer, index, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";
import { organizationsTable } from "./saas";

export const prospectsTable = pgTable("prospects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  source: text("source"),
  status: text("status").notNull().default("new"),
  tags: jsonb("tags").$type<string[]>().default([]),
  notes: text("notes"),
  convertedToClientId: uuid("converted_to_client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── AUDIENCES ──────────────────────────────────────────────────
// Audience statique (liste figée) ou dynamique (filtres rejoués à l'envoi).
export const marketingAudiencesTable = pgTable("marketing_audiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("dynamic"), // "static" | "dynamic"
  filters: jsonb("filters").$type<{
    sources?: string[]; // ["clients","prospects","collaborators","users"]
    status?: string;
    tags?: string[];
    countries?: string[];
    cities?: string[];
    languages?: string[];
    requireEmail?: boolean;
    requirePhone?: boolean;
    requireWhatsapp?: boolean;
    consentRequired?: boolean;
    industries?: string[];
    inactiveSinceDays?: number;
  }>().notNull().default({}),
  staticContactIds: jsonb("static_contact_ids").$type<Array<{ type: string; id: string }>>().default([]),
  contactsCount: integer("contacts_count").notNull().default(0),
  lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── TEMPLATES ──────────────────────────────────────────────────
export const marketingTemplatesTable = pgTable("marketing_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channel: text("channel").notNull(), // email | sms | whatsapp
  category: text("category").notNull().default("campagne"), // relance, campagne, rappel, fidelisation, onboarding, support, institutionnel, transactionnel
  subject: text("subject"),
  body: text("body").notNull(),
  variables: jsonb("variables").$type<string[]>().default([]),
  description: text("description"),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── CAMPAIGNS ──────────────────────────────────────────────────
export const marketingCampaignsTable = pgTable("marketing_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channel: text("channel").notNull(), // email | sms | whatsapp | multi
  subject: text("subject"),
  body: text("body").notNull(),
  segment: jsonb("segment").$type<{ audiences: string[]; statusFilter?: string; tags?: string[] }>().notNull(),
  audienceId: uuid("audience_id").references(() => marketingAudiencesTable.id, { onDelete: "set null" }),
  templateId: uuid("template_id").references(() => marketingTemplatesTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"), // draft, scheduled, running, sent, paused, cancelled
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientsCount: integer("recipients_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  openCount: integer("open_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  unsubscribeCount: integer("unsubscribe_count").notNull().default(0),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignRecipientsTable = pgTable("campaign_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => marketingCampaignsTable.id, { onDelete: "cascade" }),
  audienceType: text("audience_type").notNull(),
  refId: uuid("ref_id"),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  status: text("status").notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  errorMsg: text("error_msg"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byCampaign: index("campaign_recipients_campaign_idx").on(t.campaignId),
}));

// ─── AUTOMATIONS ────────────────────────────────────────────────
// Workflow déclaratif : un déclencheur + une liste d'actions séquentielles.
export const marketingAutomationsTable = pgTable("marketing_automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(),
  // Déclencheurs supportés : new_prospect, new_client, invoice_issued, invoice_overdue,
  // payment_received, quote_unconfirmed, rental_due_soon, rental_return_due,
  // project_created, recurring_service_due, client_inactive, special_date, document_missing
  triggerConfig: jsonb("trigger_config").$type<Record<string, any>>().default({}),
  audienceId: uuid("audience_id").references(() => marketingAudiencesTable.id, { onDelete: "set null" }),
  steps: jsonb("steps").$type<Array<{
    kind: "send_email" | "send_sms" | "send_whatsapp" | "create_task" | "notify_user" | "assign_commercial" | "change_status" | "add_tag" | "add_to_audience" | "wait";
    templateId?: string;
    subject?: string;
    body?: string;
    delayHours?: number;
    userId?: string;
    tag?: string;
    status?: string;
    audienceId?: string;
  }>>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(false),
  runsCount: integer("runs_count").notNull().default(0),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const marketingAutomationLogsTable = pgTable("marketing_automation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  automationId: uuid("automation_id").notNull().references(() => marketingAutomationsTable.id, { onDelete: "cascade" }),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull(), // success | partial | failed
  contextEntityType: text("context_entity_type"),
  contextEntityId: uuid("context_entity_id"),
  stepsExecuted: integer("steps_executed").notNull().default(0),
  payload: jsonb("payload").$type<Record<string, any>>().default({}),
  error: text("error"),
}, (t) => ({
  byAutomation: index("automation_logs_automation_idx").on(t.automationId),
}));

// ─── ALERT RULES (rappels métier) ───────────────────────────────
export const marketingAlertRulesTable = pgTable("marketing_alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  source: text("source").notNull(),
  // Sources : invoice_due, invoice_overdue, rental_due, rental_return,
  // service_renewal, appointment_reminder, document_missing,
  // admin_reminder, generic_date
  config: jsonb("config").$type<{
    leadTimeDays?: number;
    repeatEveryDays?: number;
    maxRepeats?: number;
    targetRole?: string;
  }>().notNull().default({}),
  channels: jsonb("channels").$type<string[]>().notNull().default(["email"]),
  templateId: uuid("template_id").references(() => marketingTemplatesTable.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  sentCount: integer("sent_count").notNull().default(0),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const marketingAlertLogsTable = pgTable("marketing_alert_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").notNull().references(() => marketingAlertRulesTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  channel: text("channel").notNull(),
  recipient: text("recipient"),
  status: text("status").notNull(), // sent | failed | skipped
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byRule: index("alert_logs_rule_idx").on(t.ruleId),
}));

// ─── CONSENT (opt-in / opt-out) ─────────────────────────────────
export const marketingConsentTable = pgTable("marketing_consent", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  contactType: text("contact_type").notNull(), // client | prospect | collaborator | user
  contactId: uuid("contact_id").notNull(),
  channel: text("channel").notNull(), // email | sms | whatsapp
  optIn: boolean("opt_in").notNull().default(true),
  source: text("source"), // form | manual | api | import
  preferredLanguage: text("preferred_language"),
  updatedBy: uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uniqContactChannel: uniqueIndex("marketing_consent_uniq").on(t.contactType, t.contactId, t.channel),
}));

// ─── CHANNEL CONNECTIONS (providers) ────────────────────────────
export const marketingChannelConnectionsTable = pgTable("marketing_channel_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(), // email | sms | whatsapp
  provider: text("provider").notNull(), // sendgrid | resend | twilio | wa_business | preview
  displayName: text("display_name"),
  config: jsonb("config").$type<Record<string, any>>().notNull().default({}),
  isActive: boolean("is_active").notNull().default(false),
  status: text("status").notNull().default("not_configured"), // not_configured | ok | error
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastError: text("last_error"),
  volume30d: integer("volume_30d").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uniqChannelProvider: uniqueIndex("marketing_channel_provider_uniq").on(t.channel, t.provider),
}));

export type Prospect = typeof prospectsTable.$inferSelect;
export type MarketingCampaign = typeof marketingCampaignsTable.$inferSelect;
export type CampaignRecipient = typeof campaignRecipientsTable.$inferSelect;
export type MarketingAudience = typeof marketingAudiencesTable.$inferSelect;
export type MarketingTemplate = typeof marketingTemplatesTable.$inferSelect;
export type MarketingAutomation = typeof marketingAutomationsTable.$inferSelect;
export type MarketingAutomationLog = typeof marketingAutomationLogsTable.$inferSelect;
export type MarketingAlertRule = typeof marketingAlertRulesTable.$inferSelect;
export type MarketingAlertLog = typeof marketingAlertLogsTable.$inferSelect;
export type MarketingConsent = typeof marketingConsentTable.$inferSelect;
export type MarketingChannelConnection = typeof marketingChannelConnectionsTable.$inferSelect;
