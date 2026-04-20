import { pgTable, text, timestamp, uuid, jsonb, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { usersTable } from "./users";
import { servicesTable } from "./services";

export const clientServicesTable = pgTable("client_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clientsTable.id),
  catalogId: uuid("catalog_id").references(() => servicesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrencePattern: jsonb("recurrence_pattern").$type<{
    frequency: "weekly" | "monthly" | "quarterly" | "annual";
    dayOfWeek?: number;
    dayOfMonth?: number;
    monthOfYear?: number;
  } | null>(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  ownerId: uuid("owner_id").references(() => usersTable.id),
  startDate: text("start_date"),
  endDate: text("end_date"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  clientIdx: index("client_services_client_idx").on(t.clientId),
  statusIdx: index("client_services_status_idx").on(t.status),
}));

export const serviceSectionsTable = pgTable("service_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientServiceId: uuid("client_service_id").notNull().references(() => clientServicesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  serviceIdx: index("service_sections_service_idx").on(t.clientServiceId),
}));

export const userClientAccessTable = pgTable("user_client_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  accessLevel: text("access_level").notNull().default("viewer"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  grantedById: uuid("granted_by_id").references(() => usersTable.id),
}, (t) => ({
  userIdx: index("user_client_access_user_idx").on(t.userId),
  clientIdx: index("user_client_access_client_idx").on(t.clientId),
}));

export const insertClientServiceSchema = createInsertSchema(clientServicesTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertServiceSectionSchema = createInsertSchema(serviceSectionsTable).omit({ id: true, createdAt: true });
export const insertUserClientAccessSchema = createInsertSchema(userClientAccessTable).omit({ id: true, grantedAt: true });

export type ClientService = typeof clientServicesTable.$inferSelect;
export type ServiceSection = typeof serviceSectionsTable.$inferSelect;
export type UserClientAccess = typeof userClientAccessTable.$inferSelect;
export type InsertClientService = z.infer<typeof insertClientServiceSchema>;
export type InsertServiceSection = z.infer<typeof insertServiceSectionSchema>;
export type InsertUserClientAccess = z.infer<typeof insertUserClientAccessSchema>;
