import { pgTable, text, timestamp, uuid, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collaboratorsTable } from "./collaborators";
import { organizationsTable } from "./saas";

export const equipmentCategoriesTable = pgTable("equipment_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const equipmentTable = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code"),
  categoryId: uuid("category_id").references(() => equipmentCategoriesTable.id),
  description: text("description"),
  status: text("status").notNull().default("available"),
  quantity: integer("quantity").notNull().default(1),
  availableQuantity: integer("available_quantity").notNull().default(1),
  dailyRate: numeric("daily_rate", { precision: 15, scale: 2 }),
  imageUrl: text("image_url"),
  photos: jsonb("photos").$type<string[]>().default([]),
  qrCode: text("qr_code"),
  variant: text("variant"),
  location: text("location"),
  // Collaborateur responsable de l'équipement (synchronisation Matériel ↔ RH).
  responsibleCollaboratorId: uuid("responsible_collaborator_id").references(() => collaboratorsTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const equipmentMovementsTable = pgTable("equipment_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  equipmentId: uuid("equipment_id").notNull().references(() => equipmentTable.id),
  type: text("type").notNull(),
  fromLocation: text("from_location"),
  toLocation: text("to_location"),
  quantity: integer("quantity").notNull().default(1),
  performedById: uuid("performed_by_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EquipmentMovement = typeof equipmentMovementsTable.$inferSelect;

export const insertEquipmentSchema = createInsertSchema(equipmentTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipmentTable.$inferSelect;

export const insertEquipmentCategorySchema = createInsertSchema(equipmentCategoriesTable).omit({ id: true, createdAt: true });
export type InsertEquipmentCategory = z.infer<typeof insertEquipmentCategorySchema>;
export type EquipmentCategory = typeof equipmentCategoriesTable.$inferSelect;
