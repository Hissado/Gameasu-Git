import { pgTable, text, timestamp, uuid, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const servicesTable = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  unit: text("unit").notNull().default("forfait"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
