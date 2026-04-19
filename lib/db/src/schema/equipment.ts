import { pgTable, text, timestamp, uuid, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const equipmentCategoriesTable = pgTable("equipment_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const equipmentTable = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code"),
  categoryId: uuid("category_id").references(() => equipmentCategoriesTable.id),
  description: text("description"),
  status: text("status").notNull().default("available"),
  quantity: integer("quantity").notNull().default(1),
  availableQuantity: integer("available_quantity").notNull().default(1),
  dailyRate: numeric("daily_rate", { precision: 15, scale: 2 }),
  imageUrl: text("image_url"),
  location: text("location"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEquipmentSchema = createInsertSchema(equipmentTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipmentTable.$inferSelect;

export const insertEquipmentCategorySchema = createInsertSchema(equipmentCategoriesTable).omit({ id: true, createdAt: true });
export type InsertEquipmentCategory = z.infer<typeof insertEquipmentCategorySchema>;
export type EquipmentCategory = typeof equipmentCategoriesTable.$inferSelect;
