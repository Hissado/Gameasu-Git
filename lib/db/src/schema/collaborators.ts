import { pgTable, text, boolean, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const collaboratorsTable = pgTable("collaborators", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  position: text("position"),
  department: text("department"),
  avatarUrl: text("avatar_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  currentProjectsCount: integer("current_projects_count").default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCollaboratorSchema = createInsertSchema(collaboratorsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;
export type Collaborator = typeof collaboratorsTable.$inferSelect;
