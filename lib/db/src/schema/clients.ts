import { pgTable, text, timestamp, uuid, index, boolean, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./saas";

export const clientsTable = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  industry: text("industry"),
  address: text("address"),
  website: text("website"),
  logoUrl: text("logo_url"),
  status: text("status").notNull().default("prospect"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
  paymentTermsDays: integer("payment_terms_days").default(30),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  clientsDeletedAtIdx: index("clients_deleted_at_idx").on(t.deletedAt),
  clientsStatusIdx: index("clients_status_idx").on(t.status),
}));

export const clientContactsTable = pgTable("client_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clientsTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"),
  isPrimary: text("is_primary").default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  clientContactsClientIdx: index("client_contacts_client_idx").on(t.clientId),
}));

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

export const insertClientContactSchema = createInsertSchema(clientContactsTable).omit({ id: true, createdAt: true });
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;
export type ClientContact = typeof clientContactsTable.$inferSelect;

export const clientEmailLogsTable = pgTable("client_email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clientsTable.id),
  direction: text("direction").notNull().default("outbound"),
  subject: text("subject").notNull(),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  preview: text("preview"),
  body: text("body"),
  hasAttachments: boolean("has_attachments").default(false),
  status: text("status").default("sent"),
  resendMessageId: text("resend_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  clientEmailLogsClientIdx: index("client_email_logs_client_idx").on(t.clientId),
  clientEmailLogsSentAtIdx: index("client_email_logs_sent_at_idx").on(t.sentAt),
}));

export type ClientEmailLog = typeof clientEmailLogsTable.$inferSelect;

export const clientNotesTable = pgTable("client_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  authorId: uuid("author_id"),
  content: text("content").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  clientNotesClientIdx: index("client_notes_client_idx").on(t.clientId),
}));

export type ClientNote = typeof clientNotesTable.$inferSelect;
