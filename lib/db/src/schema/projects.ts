import { pgTable, text, timestamp, uuid, integer, numeric, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { usersTable } from "./users";
import { collaboratorsTable } from "./collaborators";
import { organizationsTable } from "./saas";

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("planning"),
  clientId: uuid("client_id").references(() => clientsTable.id),
  managerId: uuid("manager_id").references(() => usersTable.id),
  // Chef de projet côté RH (collaborateur), distinct du `managerId` (compte utilisateur).
  leadCollaboratorId: uuid("lead_collaborator_id").references(() => collaboratorsTable.id, { onDelete: "set null" }),
  startDate: text("start_date"),
  endDate: text("end_date"),
  progress: integer("progress").default(0),
  budget: numeric("budget", { precision: 15, scale: 2 }),
  documentLinks: jsonb("document_links").$type<Array<{ label: string; url: string }>>().default([]),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  projectsClientIdx: index("projects_client_idx").on(t.clientId),
  projectsManagerIdx: index("projects_manager_idx").on(t.managerId),
  projectsDeletedAtIdx: index("projects_deleted_at_idx").on(t.deletedAt),
}));

export const projectPhasesTable = pgTable("project_phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectPhasesProjectIdx: index("project_phases_project_idx").on(t.projectId),
}));

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
