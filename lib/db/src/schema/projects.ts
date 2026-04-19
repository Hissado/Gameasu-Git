import { pgTable, text, timestamp, uuid, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("planning"),
  clientId: uuid("client_id").references(() => clientsTable.id),
  managerId: uuid("manager_id").references(() => usersTable.id),
  startDate: text("start_date"),
  endDate: text("end_date"),
  progress: integer("progress").default(0),
  budget: numeric("budget", { precision: 15, scale: 2 }),
  documentLinks: jsonb("document_links").$type<Array<{ label: string; url: string }>>().default([]),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const projectPhasesTable = pgTable("project_phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
