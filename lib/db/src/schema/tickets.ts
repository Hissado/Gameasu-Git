import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ticketsTable = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: text("subject").notNull(),
  description: text("description"),
  category: text("category").notNull().default("other"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  assigneeId: uuid("assignee_id").references(() => usersTable.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
