/**
 * Module Paie — Bulletins de paie SYSCOHADA / Togo
 *
 * - payroll_runs    : cycle de paie mensuel (un run par mois, par org)
 * - payslips        : bulletin de paie individuel (un par collaborateur par run)
 *
 * Cotisations sociales CNSS Togo :
 *   - Employé  : 4 % (prestations vieillesse) sur brut plafonné
 *   - Employeur : 16,4 % total (accidents + vieillesse + famille)
 * IRPP : barème progressif annuel Togo
 * IPTS : Impôt Proportionnel sur les Traitements et Salaires (2 %)
 */
import { pgTable, text, timestamp, uuid, numeric, integer, boolean, jsonb, index, uniqueIndex, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { organizationsTable } from "./saas";
import { collaboratorsTable } from "./collaborators";
import { contractsTable } from "./hr";
import { usersTable } from "./users";

// ─────────────────────────────────────────────────────────
// CYCLES DE PAIE (RUNS MENSUELS)
// ─────────────────────────────────────────────────────────
export const payrollRunsTable = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // Période : "YYYY-MM" (ex: "2026-06")
  period: text("period").notNull(),
  // draft | validated | paid | archived
  status: text("status").notNull().default("draft"),
  runDate: date("run_date"),
  paymentDate: date("payment_date"),
  // Totaux agrégés (recalculés à la validation)
  totalGrossSalary: numeric("total_gross_salary", { precision: 18, scale: 2 }).default("0"),
  totalCnssEmployee: numeric("total_cnss_employee", { precision: 18, scale: 2 }).default("0"),
  totalCnssEmployer: numeric("total_cnss_employer", { precision: 18, scale: 2 }).default("0"),
  totalIrpp: numeric("total_irpp", { precision: 18, scale: 2 }).default("0"),
  totalIpts: numeric("total_ipts", { precision: 18, scale: 2 }).default("0"),
  totalNetSalary: numeric("total_net_salary", { precision: 18, scale: 2 }).default("0"),
  employeeCount: integer("employee_count").default(0),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  validatedById: uuid("validated_by_id").references(() => usersTable.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  periodOrgIdx: uniqueIndex("payroll_runs_period_org_uidx").on(t.organizationId, t.period),
  statusIdx: index("payroll_runs_status_idx").on(t.status),
}));

// ─────────────────────────────────────────────────────────
// BULLETINS DE PAIE INDIVIDUELS
// ─────────────────────────────────────────────────────────
export const payslipsTable = pgTable("payslips", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  payrollRunId: uuid("payroll_run_id").notNull().references(() => payrollRunsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id),
  contractId: uuid("contract_id").references(() => contractsTable.id),
  // Période couverte
  period: text("period").notNull(), // "YYYY-MM"
  // Salaire de base (issu du contrat ou saisi)
  baseSalary: numeric("base_salary", { precision: 14, scale: 2 }).notNull(),
  // Éléments variables (heures sup, primes, etc.) — jsonb [{label, amount}]
  additions: jsonb("additions").default([]),
  // Retenues diverses — jsonb [{label, amount}]
  deductions: jsonb("deductions").default([]),
  // Allocations
  transportAllowance: numeric("transport_allowance", { precision: 14, scale: 2 }).default("0"),
  housingAllowance: numeric("housing_allowance", { precision: 14, scale: 2 }).default("0"),
  mealAllowance: numeric("meal_allowance", { precision: 14, scale: 2 }).default("0"),
  // Salaire brut = baseSalary + additions + allowances
  grossSalary: numeric("gross_salary", { precision: 14, scale: 2 }).notNull(),
  // Cotisations CNSS Togo
  cnssEmployee: numeric("cnss_employee", { precision: 14, scale: 2 }).default("0"),
  cnssEmployer: numeric("cnss_employer", { precision: 14, scale: 2 }).default("0"),
  // Fiscalité
  irpp: numeric("irpp", { precision: 14, scale: 2 }).default("0"),
  ipts: numeric("ipts", { precision: 14, scale: 2 }).default("0"),
  // Salaire net = grossSalary - cnssEmployee - irpp - ipts - deductions
  netSalary: numeric("net_salary", { precision: 14, scale: 2 }).notNull(),
  // draft | validated | paid
  status: text("status").notNull().default("draft"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  runCollabIdx: uniqueIndex("payslips_run_collab_uidx").on(t.payrollRunId, t.collaboratorId),
  collabIdx: index("payslips_collab_idx").on(t.collaboratorId),
  periodIdx: index("payslips_period_idx").on(t.period),
}));

// ─────────────────────────────────────────────────────────
// Zod & types
// ─────────────────────────────────────────────────────────
export const insertPayrollRunSchema = createInsertSchema(payrollRunsTable).omit({ id: true, createdAt: true, updatedAt: true, validatedAt: true });
export const insertPayslipSchema = createInsertSchema(payslipsTable).omit({ id: true, createdAt: true, updatedAt: true, paidAt: true });

export type PayrollRun = typeof payrollRunsTable.$inferSelect;
export type Payslip = typeof payslipsTable.$inferSelect;
