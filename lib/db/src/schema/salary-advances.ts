/**
 * Module Avances sur Salaire
 *
 * - salary_advances          : demande d'avance (workflow complet)
 * - salary_advance_repayments: échéancier de remboursement (multi-mois)
 *
 * Workflow : draft → pending_approval → approved / rejected → disbursed → closed
 * Le remboursement est automatiquement intégré dans le bulletin de paie mensuel.
 */
import {
  pgTable, text, timestamp, uuid, numeric, integer,
  boolean, jsonb, index, date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { organizationsTable } from "./saas";
import { collaboratorsTable } from "./collaborators";
import { usersTable } from "./users";
import { payrollRunsTable } from "./payroll";

// ─────────────────────────────────────────────────────────
// DEMANDES D'AVANCE SUR SALAIRE
// ─────────────────────────────────────────────────────────
export const salaryAdvancesTable = pgTable("salary_advances", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),

  // Montant demandé
  requestedAmount: numeric("requested_amount", { precision: 14, scale: 2 }).notNull(),
  approvedAmount:  numeric("approved_amount",  { precision: 14, scale: 2 }),
  currency: text("currency").notNull().default("XOF"),

  // Mois cible de l'avance ("YYYY-MM")
  targetPeriod: text("target_period").notNull(),

  // Mode de remboursement : single | multi | custom
  repaymentMode: text("repayment_mode").notNull().default("single"),
  // Nombre de mensualités (pour mode multi)
  repaymentMonths: integer("repayment_months").default(1),
  // Pour mode custom : [{period:"2026-07",amount:25000}, ...]
  repaymentSchedule: jsonb("repayment_schedule"),

  // Motif et pièces jointes
  reason: text("reason"),
  attachments: jsonb("attachments").default([]),

  // Workflow : draft | pending_approval | approved | rejected | disbursed | closed | cancelled
  status: text("status").notNull().default("draft"),

  // Approbation
  requestedById: uuid("requested_by_id").references(() => usersTable.id),
  approvedById:  uuid("approved_by_id").references(() => usersTable.id),
  approvedAt:    timestamp("approved_at",    { withTimezone: true }),
  rejectedById:  uuid("rejected_by_id").references(() => usersTable.id),
  rejectedAt:    timestamp("rejected_at",    { withTimezone: true }),
  rejectionNote: text("rejection_note"),

  // Signature électronique de l'approbation
  approvalSignature: text("approval_signature"),

  // Décaissement
  disbursedAt:   timestamp("disbursed_at",   { withTimezone: true }),
  disbursedById: uuid("disbursed_by_id").references(() => usersTable.id),

  // Solde restant dû (mis à jour à chaque remboursement)
  remainingAmount: numeric("remaining_amount", { precision: 14, scale: 2 }).default("0"),

  // Montant total remboursé
  repaidAmount: numeric("repaid_amount", { precision: 14, scale: 2 }).default("0"),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx:      index("salary_adv_org_idx").on(t.organizationId),
  collabIdx:   index("salary_adv_collab_idx").on(t.collaboratorId),
  statusIdx:   index("salary_adv_status_idx").on(t.status),
  periodIdx:   index("salary_adv_period_idx").on(t.targetPeriod),
}));

// ─────────────────────────────────────────────────────────
// ÉCHÉANCIER DE REMBOURSEMENT
// ─────────────────────────────────────────────────────────
export const salaryAdvanceRepaymentsTable = pgTable("salary_advance_repayments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  advanceId: uuid("advance_id").notNull().references(() => salaryAdvancesTable.id, { onDelete: "cascade" }),

  // Période de remboursement ("YYYY-MM")
  period: text("period").notNull(),

  // Montant à rembourser sur cette période
  scheduledAmount: numeric("scheduled_amount", { precision: 14, scale: 2 }).notNull(),
  // Montant effectivement prélevé (peut différer si ajustement)
  deductedAmount:  numeric("deducted_amount",  { precision: 14, scale: 2 }),

  // Lien avec le cycle de paie qui a effectué le prélèvement
  payrollRunId: uuid("payroll_run_id").references(() => payrollRunsTable.id),

  // pending | deducted | skipped | adjusted
  status: text("status").notNull().default("pending"),

  adjustmentNote: text("adjustment_note"),
  processedAt:    timestamp("processed_at", { withTimezone: true }),
  processedById:  uuid("processed_by_id").references(() => usersTable.id),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  advanceIdx: index("repay_advance_idx").on(t.advanceId),
  periodIdx:  index("repay_period_idx").on(t.period),
  statusIdx:  index("repay_status_idx").on(t.status),
}));

// ─────────────────────────────────────────────────────────
// POLITIQUE D'AVANCES (plafonds par organisation)
// ─────────────────────────────────────────────────────────
export const salaryAdvancePolicyTable = pgTable("salary_advance_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().unique().references(() => organizationsTable.id, { onDelete: "cascade" }),

  // Plafond en % du salaire mensuel brut (ex: 50 = 50%)
  maxPercentOfSalary: integer("max_percent_of_salary").notNull().default(50),
  // Plafond absolu en FCFA (0 = pas de plafond absolu)
  maxAbsoluteAmount: numeric("max_absolute_amount", { precision: 14, scale: 2 }).default("0"),
  // Nombre maximum d'avances actives simultanées par employé
  maxActiveAdvances: integer("max_active_advances").notNull().default(1),
  // Nombre maximum de mensualités de remboursement
  maxRepaymentMonths: integer("max_repayment_months").notNull().default(6),
  // Ancienneté minimale requise (en mois)
  minTenureMonths: integer("min_tenure_months").notNull().default(3),
  // Workflow : direct_approval | manager_then_hr | hr_only
  approvalWorkflow: text("approval_workflow").notNull().default("manager_then_hr"),
  // Notification automatique au DRH
  notifyHr: boolean("notify_hr").notNull().default(true),

  isActive: boolean("is_active").notNull().default(true),
  updatedById: uuid("updated_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────
// TYPES EXPORTÉS
// ─────────────────────────────────────────────────────────
export type SalaryAdvance          = typeof salaryAdvancesTable.$inferSelect;
export type SalaryAdvanceRepayment = typeof salaryAdvanceRepaymentsTable.$inferSelect;
export type SalaryAdvancePolicy    = typeof salaryAdvancePolicyTable.$inferSelect;

export const insertSalaryAdvanceSchema = createInsertSchema(salaryAdvancesTable).omit({
  id: true, createdAt: true, updatedAt: true,
  approvedAt: true, rejectedAt: true, disbursedAt: true,
  remainingAmount: true, repaidAmount: true,
});
