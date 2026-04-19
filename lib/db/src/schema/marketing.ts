import { pgTable, text, timestamp, uuid, jsonb, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const prospectsTable = pgTable("prospects", {
  id: uuid("id").primaryKey().defaultRandom(),
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

export const marketingCampaignsTable = pgTable("marketing_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  segment: jsonb("segment").$type<{ audiences: string[]; statusFilter?: string; tags?: string[] }>().notNull(),
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientsCount: integer("recipients_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignRecipientsTable = pgTable("campaign_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
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

export type Prospect = typeof prospectsTable.$inferSelect;
export type MarketingCampaign = typeof marketingCampaignsTable.$inferSelect;
export type CampaignRecipient = typeof campaignRecipientsTable.$inferSelect;
