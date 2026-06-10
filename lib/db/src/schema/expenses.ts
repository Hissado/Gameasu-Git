/**
 * Module Notes de Frais (#12)
 * - expense_reports : rapport de frais (soumission + validation)
 * - expense_items   : lignes de frais individuelles
 */
import { pgTable, text, timestamp, uuid, numeric, boolean, index, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { organizationsTable } from "./saas";
import { collaboratorsTable } from "./collaborators";
import { usersTable } from "./users";

export const expenseReportsTable = pgTable("expense_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  // draft | submitted | approved | rejected | paid
  status: text("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("XOF"),
  // Période concernée
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedById: uuid("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidById: uuid("paid_by_id").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("exp_reports_org_idx").on(t.organizationId),
  collabIdx: index("exp_reports_collab_idx").on(t.collaboratorId),
  statusIdx: index("exp_reports_status_idx").on(t.status),
}));

export const expenseItemsTable = pgTable("expense_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseReportId: uuid("expense_report_id").notNull().references(() => expenseReportsTable.id, { onDelete: "cascade" }),
  // transport | repas | hébergement | fournitures | communication | formation | autre
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XOF"),
  expenseDate: date("expense_date").notNull(),
  // URL du justificatif (objet storage ou upload)
  receiptUrl: text("receipt_url"),
  isBillable: boolean("is_billable").notNull().default(false),
  projectId: uuid("project_id"), // référence optionnelle vers un projet
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  reportIdx: index("exp_items_report_idx").on(t.expenseReportId),
}));

export const insertExpenseReportSchema = createInsertSchema(expenseReportsTable).omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true, approvedAt: true, paidAt: true });
export const insertExpenseItemSchema = createInsertSchema(expenseItemsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ExpenseReport = typeof expenseReportsTable.$inferSelect;
export type ExpenseItem = typeof expenseItemsTable.$inferSelect;
