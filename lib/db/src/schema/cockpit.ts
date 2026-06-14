import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ticketsTable } from "./tickets";

export const ticketCommentsTable = pgTable("ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => usersTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const incidentsTable = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  affectedServices: text("affected_services"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const cockpitAuditLogsTable = pgTable("cockpit_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => usersTable.id),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Incident = typeof incidentsTable.$inferSelect;
export type TicketComment = typeof ticketCommentsTable.$inferSelect;
export type CockpitAuditLog = typeof cockpitAuditLogsTable.$inferSelect;
