import { pgTable, text, timestamp, uuid, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { equipmentTable } from "./equipment";
import { usersTable } from "./users";

export const rentalsTable = pgTable("rentals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referenceNumber: text("reference_number").notNull(),
  clientId: uuid("client_id").references(() => clientsTable.id),
  status: text("status").notNull().default("pending"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalCost: numeric("total_cost", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const rentalItemsTable = pgTable("rental_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  rentalId: uuid("rental_id").notNull().references(() => rentalsTable.id),
  equipmentId: uuid("equipment_id").notNull().references(() => equipmentTable.id),
  quantity: integer("quantity").notNull().default(1),
  dailyRate: numeric("daily_rate", { precision: 15, scale: 2 }),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }),
});

export const inspectionsTable = pgTable("inspections", {
  id: uuid("id").primaryKey().defaultRandom(),
  rentalId: uuid("rental_id").notNull().references(() => rentalsTable.id),
  type: text("type").notNull(),
  conductedById: uuid("conducted_by_id").references(() => usersTable.id),
  notes: text("notes"),
  hasDispute: text("has_dispute").default("false"),
  disputeNotes: text("dispute_notes"),
  retentionAmount: numeric("retention_amount", { precision: 15, scale: 2 }),
  photos: jsonb("photos").$type<string[]>().default([]),
  beforePhotos: jsonb("before_photos").$type<string[]>().default([]),
  afterPhotos: jsonb("after_photos").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const logisticsOperationsTable = pgTable("logistics_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  status: text("status").notNull().default("scheduled"),
  rentalId: uuid("rental_id").references(() => rentalsTable.id),
  responsibleId: uuid("responsible_id").references(() => usersTable.id),
  address: text("address"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRentalSchema = createInsertSchema(rentalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Rental = typeof rentalsTable.$inferSelect;

export const insertInspectionSchema = createInsertSchema(inspectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspectionsTable.$inferSelect;

export const insertLogisticsSchema = createInsertSchema(logisticsOperationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLogistics = z.infer<typeof insertLogisticsSchema>;
export type LogisticsOperation = typeof logisticsOperationsTable.$inferSelect;
