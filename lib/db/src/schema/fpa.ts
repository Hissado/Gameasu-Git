import { pgTable, text, timestamp, uuid, numeric, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { fiscalPeriodsTable, chartOfAccountsTable } from "./accounting";

// ────────────────────────────────────────────────────────────────
// FP&A — Reporting & Planning Financier
// Budgets versionnés multi-périmètre (entreprise, projet, département,
// service, activité). Forecasts gérés comme variantes (kind = forecast).
// Les "actuels" sont calculés à la volée depuis journal_entry_lines.
// ────────────────────────────────────────────────────────────────

export const budgetsTable = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // budget | forecast
  kind: text("kind").notNull().default("budget"),
  fiscalPeriodId: uuid("fiscal_period_id").notNull().references(() => fiscalPeriodsTable.id),
  // company | project | department | service | activity
  scope: text("scope").notNull().default("company"),
  // null si scope=company. uuid du projet/dept/service/activité sinon.
  scopeId: uuid("scope_id"),
  versionNumber: integer("version_number").notNull().default(1),
  // draft | active | archived
  status: text("status").notNull().default("draft"),
  // version source quand on duplique pour créer une nouvelle version
  basedOnId: uuid("based_on_id"),
  // Pour les scopes non-company, possibilité de déclarer les projets dont
  // les écritures comptables alimentent les "actuels" (sinon: aucun actuel).
  projectIds: jsonb("project_ids").$type<string[]>().default([]),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  fiscalIdx: index("budgets_fiscal_idx").on(t.fiscalPeriodId),
  scopeIdx: index("budgets_scope_idx").on(t.scope, t.scopeId),
  // PostgreSQL traite NULL comme distinct dans les uniqueIndex standards.
  // On utilise donc deux index partiels pour garantir l'unicité de version
  // à la fois quand scope_id est NULL (scope=company) et quand il est défini.
  versionWithScopeUidx: uniqueIndex("budgets_version_with_scope_uidx")
    .on(t.fiscalPeriodId, t.scope, t.scopeId, t.kind, t.versionNumber)
    .where(sql`scope_id IS NOT NULL`),
  versionNoScopeUidx: uniqueIndex("budgets_version_no_scope_uidx")
    .on(t.fiscalPeriodId, t.scope, t.kind, t.versionNumber)
    .where(sql`scope_id IS NULL`),
}));

export const budgetLinesTable = pgTable("budget_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetId: uuid("budget_id").notNull().references(() => budgetsTable.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => chartOfAccountsTable.id),
  // période mensuelle au format "YYYY-MM"
  period: text("period").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  budgetIdx: index("budget_lines_budget_idx").on(t.budgetId),
  accountIdx: index("budget_lines_account_idx").on(t.accountId),
  cellUidx: uniqueIndex("budget_lines_cell_uidx").on(t.budgetId, t.accountId, t.period),
}));

// ────────────────────────────────────────────────────────────────
// Zod & types
// ────────────────────────────────────────────────────────────────
export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({
  id: true, createdAt: true, updatedAt: true, versionNumber: true,
});
export const insertBudgetLineSchema = createInsertSchema(budgetLinesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type Budget = typeof budgetsTable.$inferSelect;
export type BudgetLine = typeof budgetLinesTable.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type InsertBudgetLine = z.infer<typeof insertBudgetLineSchema>;
