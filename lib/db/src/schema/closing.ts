/**
 * Clôture financière — Gaméasù
 * Tables: period_months, closing_checklist_items, closing_audit_log
 */
import { pgTable, uuid, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { fiscalPeriodsTable } from "./accounting";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";

// ── Period Months — suivi mensuel (mois de clôture) ──────────────────────────
// Un enregistrement par mois (YYYY-MM) dans chaque exercice fiscal.
// Créés à la demande ou lors de la première clôture d'un mois.
export const periodMonthsTable = pgTable("period_months", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  fiscalPeriodId: uuid("fiscal_period_id").notNull().references(() => fiscalPeriodsTable.id, { onDelete: "cascade" }),
  // YYYY-MM ex: "2026-06"
  month: text("month").notNull(),
  // open | review | closed | locked
  status: text("status").notNull().default("open"),
  // Clôture
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedById: uuid("closed_by_id").references(() => usersTable.id),
  closedByName: text("closed_by_name"),
  // Approbation
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedById: uuid("approved_by_id").references(() => usersTable.id),
  approvedByName: text("approved_by_name"),
  // Réouverture
  reopenedAt: timestamp("reopened_at", { withTimezone: true }),
  reopenedById: uuid("reopened_by_id").references(() => usersTable.id),
  reopenedByName: text("reopened_by_name"),
  reopenReason: text("reopen_reason"),
  // Méta
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgMonthIdx: uniqueIndex("period_months_org_month_uidx").on(t.organizationId, t.month),
  orgFiscalIdx: index("period_months_fiscal_idx").on(t.organizationId, t.fiscalPeriodId),
}));

export type PeriodMonth = typeof periodMonthsTable.$inferSelect;

// ── Closing Checklist Items ───────────────────────────────────────────────────
export const closingChecklistItemsTable = pgTable("closing_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  periodMonthId: uuid("period_month_id").notNull().references(() => periodMonthsTable.id, { onDelete: "cascade" }),
  // clé fonctionnelle unique (invoices_reviewed, payments_recorded, etc.)
  itemKey: text("item_key").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  // pending | in_progress | done | na
  status: text("status").notNull().default("pending"),
  // Responsable
  assignedToId: uuid("assigned_to_id").references(() => usersTable.id),
  assignedToName: text("assigned_to_name"),
  // Complétion
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedById: uuid("completed_by_id").references(() => usersTable.id),
  completedByName: text("completed_by_name"),
  dueDate: text("due_date"), // YYYY-MM-DD
  comments: text("comments"),
  // Auto-computed: nombre d'éléments pour ce poste (ex: nb factures non validées)
  countTotal: integer("count_total"),
  countOk: integer("count_ok"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  periodIdx: index("closing_checklist_period_idx").on(t.periodMonthId),
}));

export type ClosingChecklistItem = typeof closingChecklistItemsTable.$inferSelect;

// ── Closing Audit Log ─────────────────────────────────────────────────────────
export const closingAuditLogTable = pgTable("closing_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // Cible : mois ou exercice
  periodMonthId: uuid("period_month_id").references(() => periodMonthsTable.id),
  fiscalPeriodId: uuid("fiscal_period_id").references(() => fiscalPeriodsTable.id),
  month: text("month"),          // YYYY-MM (dénormalisé pour lisibilité)
  // Action
  // month_opened | month_closed | month_approved | month_locked | month_reopened
  // year_closed | year_reopened | checklist_updated
  action: text("action").notNull(),
  userId: uuid("user_id").references(() => usersTable.id),
  userName: text("user_name"),
  userEmail: text("user_email"),
  reason: text("reason"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("closing_audit_org_idx").on(t.organizationId),
  dateIdx: index("closing_audit_date_idx").on(t.createdAt),
}));

export type ClosingAuditLog = typeof closingAuditLogTable.$inferSelect;

// ── Checklist template par défaut ─────────────────────────────────────────────
export const DEFAULT_CHECKLIST_ITEMS = [
  { key: "invoices_reviewed",           label: "Factures clients vérifiées",           description: "Toutes les factures du mois sont saisies et validées",           sortOrder: 1 },
  { key: "payments_recorded",           label: "Encaissements enregistrés",             description: "Tous les paiements reçus sont comptabilisés",                    sortOrder: 2 },
  { key: "supplier_invoices_reviewed",  label: "Factures fournisseurs vérifiées",       description: "Toutes les factures fournisseurs sont saisies",                   sortOrder: 3 },
  { key: "supplier_payments_recorded",  label: "Paiements fournisseurs enregistrés",    description: "Tous les paiements fournisseurs sont comptabilisés",              sortOrder: 4 },
  { key: "bank_reconciliation_done",    label: "Rapprochements bancaires effectués",    description: "Chaque compte bancaire est rapproché avec le relevé",             sortOrder: 5 },
  { key: "expenses_processed",          label: "Notes de frais traitées",               description: "Toutes les notes de frais sont approuvées et comptabilisées",     sortOrder: 6 },
  { key: "payroll_entries_posted",      label: "Écritures de paie postées",             description: "Le bulletin de paie du mois est validé et comptabilisé",          sortOrder: 7 },
  { key: "depreciation_posted",         label: "Amortissements comptabilisés",          description: "Dotations aux amortissements calculées et postées",               sortOrder: 8 },
  { key: "taxes_reviewed",              label: "Taxes et charges vérifiées",            description: "TVA, IRPP, CNSS et autres charges calculées",                     sortOrder: 9 },
  { key: "accruals_posted",             label: "Régularisations comptabilisées",        description: "Charges à payer et produits à recevoir comptabilisés",            sortOrder: 10 },
  { key: "adjustments_reviewed",        label: "Écritures d'ajustement vérifiées",      description: "Toutes les OD et corrections sont documentées",                  sortOrder: 11 },
  { key: "trial_balance_reviewed",      label: "Balance de vérification contrôlée",     description: "La balance est équilibrée (débit = crédit)",                     sortOrder: 12 },
  { key: "financial_statements_done",   label: "États financiers générés",              description: "Bilan, compte de résultat et tableau de trésorerie produits",     sortOrder: 13 },
  { key: "management_report_done",      label: "Rapport de gestion produit",            description: "Le rapport mensuel de gestion est rédigé et partagé",             sortOrder: 14 },
  { key: "period_approved",             label: "Période approuvée pour clôture",        description: "La direction valide la clôture du mois",                          sortOrder: 15 },
] as const;
