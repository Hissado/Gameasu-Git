import { pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./saas";

export type ExecSummarySectionConfig = {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
  thresholds: {
    metric?: string;
    greenMin?: number;
    orangeMin?: number;
  };
};

export const dailyStockReportsTable = pgTable("daily_stock_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  reportDate: text("report_date").notNull(),
  totalEquipment: integer("total_equipment").notNull().default(0),
  available: integer("available").notNull().default(0),
  rented: integer("rented").notNull().default(0),
  maintenance: integer("maintenance").notNull().default(0),
  movements24h: integer("movements_24h").notNull().default(0),
  byCategory: jsonb("by_category").$type<Record<string, { total: number; available: number; rented: number; maintenance: number }>>().default({}),
  generatedById: uuid("generated_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DailyStockReport = typeof dailyStockReportsTable.$inferSelect;

export const execSummaryConfigsTable = pgTable("exec_summary_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().unique().references(() => organizationsTable.id, { onDelete: "cascade" }),
  sections: jsonb("sections").$type<ExecSummarySectionConfig[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExecSummaryConfig = typeof execSummaryConfigsTable.$inferSelect;
