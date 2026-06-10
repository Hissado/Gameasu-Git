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

// ─────────────────────────────────────────────────────────
// PAIE HORS-CYCLE (#8)
// prime | acompte | regularisation
// ─────────────────────────────────────────────────────────
export const offCyclePaymentsTable = pgTable("off_cycle_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id),
  // prime | acompte | regularisation | indemnite | autre
  type: text("type").notNull(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XOF"),
  period: text("period").notNull(), // "YYYY-MM"
  paymentDate: date("payment_date"),
  // draft | approved | paid | cancelled
  status: text("status").notNull().default("draft"),
  reason: text("reason"),
  notes: text("notes"),
  // Lié à un run mensuel si intégré dans un cycle
  payrollRunId: uuid("payroll_run_id").references(() => payrollRunsTable.id),
  // Impôts calculés sur le montant
  irpp: numeric("irpp", { precision: 14, scale: 2 }).default("0"),
  cnssEmployee: numeric("cnss_employee", { precision: 14, scale: 2 }).default("0"),
  netAmount: numeric("net_amount", { precision: 14, scale: 2 }),
  approvedById: uuid("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("ocp_org_idx").on(t.organizationId),
  collabIdx: index("ocp_collab_idx").on(t.collaboratorId),
  periodIdx: index("ocp_period_idx").on(t.period),
}));

// ─────────────────────────────────────────────────────────
// TRANCHES IRPP PARAMÉTRABLES (#9)
// ─────────────────────────────────────────────────────────
export const irppBracketsTable = pgTable("irpp_brackets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  fromAmount: numeric("from_amount", { precision: 14, scale: 2 }).notNull(),
  toAmount: numeric("to_amount", { precision: 14, scale: 2 }), // null = infini
  rate: numeric("rate", { precision: 5, scale: 4 }).notNull(), // ex: 0.07 = 7%
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("irpp_brackets_org_idx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────
// EXONÉRATIONS FISCALES (#9)
// ─────────────────────────────────────────────────────────
export const taxExemptionsTable = pgTable("tax_exemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").references(() => collaboratorsTable.id), // null = org-wide
  // irpp | cnss | ipts | all
  exemptionType: text("exemption_type").notNull(),
  // Montant fixe OU pourcentage (l'un des deux)
  fixedAmount: numeric("fixed_amount", { precision: 14, scale: 2 }),
  percentage: numeric("percentage", { precision: 5, scale: 4 }),
  reason: text("reason"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("tax_exemptions_org_idx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────
// ORDRES DE VIREMENT BANCAIRE (#14)
// ─────────────────────────────────────────────────────────
export const bankTransferOrdersTable = pgTable("bank_transfer_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  payrollRunId: uuid("payroll_run_id").references(() => payrollRunsTable.id),
  reference: text("reference").notNull(),
  // pending | processing | submitted | completed | failed | cancelled
  status: text("status").notNull().default("pending"),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XOF"),
  // Référence retournée par la banque
  bankReference: text("bank_reference"),
  // Données des bénéficiaires (JSONB [{collaboratorId, iban, amount, name}])
  transferLines: jsonb("transfer_lines").default([]),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("bto_org_idx").on(t.organizationId),
  statusIdx: index("bto_status_idx").on(t.status),
}));

export const insertOffCyclePaymentSchema = createInsertSchema(offCyclePaymentsTable).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true, paidAt: true });
export const insertIrppBracketSchema = createInsertSchema(irppBracketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaxExemptionSchema = createInsertSchema(taxExemptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBankTransferOrderSchema = createInsertSchema(bankTransferOrdersTable).omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true, completedAt: true });

export type OffCyclePayment = typeof offCyclePaymentsTable.$inferSelect;
export type IrppBracket = typeof irppBracketsTable.$inferSelect;
export type TaxExemption = typeof taxExemptionsTable.$inferSelect;
export type BankTransferOrder = typeof bankTransferOrdersTable.$inferSelect;
