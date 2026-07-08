import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./saas";

// ────────────────────────────────────────────────────────────────
// PARAMÈTRES FISCAUX PAR ORGANISATION
// ────────────────────────────────────────────────────────────────
export const fiscalSettingsTable = pgTable("fiscal_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().unique().references(() => organizationsTable.id, { onDelete: "cascade" }),
  country: text("country").notNull().default("TG"),
  taxAuthority: text("tax_authority").notNull().default("OTR"),
  taxAuthorityLabel: text("tax_authority_label").notNull().default("Office Togolais des Recettes"),
  vatRate: integer("vat_rate").notNull().default(18),
  withholdingRate: integer("withholding_rate").notNull().default(0),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
  currency: text("currency").notNull().default("XOF"),
  enabledChecks: jsonb("enabled_checks").notNull().default([
    "vat_consistency", "vat_deductible_justified", "fiscal_number_present",
    "invoices_conformity", "payment_reconciliation", "revenue_consistency",
    "period_entries", "duplicate_declaration", "thresholds", "withholding",
  ]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedById: uuid("updated_by_id").references(() => usersTable.id),
});

// ────────────────────────────────────────────────────────────────
// DÉCLARATIONS DE CONTRÔLE FISCAL
// Note: nommées fiscalDeclarations pour éviter le conflit avec
// taxDeclarationsTable qui existe dans benefits.ts
// ────────────────────────────────────────────────────────────────
export const fiscalDeclarationsTable = pgTable("fiscal_declarations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  typeLabel: text("type_label").notNull(),
  period: text("period").notNull(),
  periodLabel: text("period_label").notNull(),
  status: text("status").notNull().default("brouillon"),
  conformityScore: integer("conformity_score"),
  declaredRevenue: integer("declared_revenue"),
  declaredVatCollected: integer("declared_vat_collected"),
  declaredVatDeductible: integer("declared_vat_deductible"),
  declaredNetVat: integer("declared_net_vat"),
  declaredAmount: integer("declared_amount"),
  dueDate: text("due_date"),
  taxAuthority: text("tax_authority"),
  notes: text("notes"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  responsibleId: uuid("responsible_id").references(() => usersTable.id),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("fiscal_decl_org_idx").on(t.organizationId),
  statusIdx: index("fiscal_decl_status_idx").on(t.status),
  periodIdx: index("fiscal_decl_period_idx").on(t.period),
}));

// ────────────────────────────────────────────────────────────────
// ANOMALIES DÉTECTÉES
// ────────────────────────────────────────────────────────────────
export const fiscalAnomaliesTable = pgTable("fiscal_anomalies", {
  id: uuid("id").primaryKey().defaultRandom(),
  declarationId: uuid("declaration_id").notNull().references(() => fiscalDeclarationsTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  level: text("level").notNull(),
  category: text("category").notNull(),
  checkCode: text("check_code").notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  recommendedAction: text("recommended_action"),
  linkedModule: text("linked_module"),
  linkedPath: text("linked_path"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedById: uuid("resolved_by_id").references(() => usersTable.id),
  resolutionNote: text("resolution_note"),
  source: text("source").notNull().default("auto"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  declIdx: index("fiscal_anomalies_decl_idx").on(t.declarationId),
}));

// ────────────────────────────────────────────────────────────────
// POINTS DE CONTRÔLE
// ────────────────────────────────────────────────────────────────
export const fiscalChecksTable = pgTable("fiscal_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  declarationId: uuid("declaration_id").notNull().references(() => fiscalDeclarationsTable.id, { onDelete: "cascade" }),
  checkCode: text("check_code").notNull(),
  checkLabel: text("check_label").notNull(),
  passed: boolean("passed").notNull().default(false),
  detail: text("detail"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  declIdx: index("fiscal_checks_decl_idx").on(t.declarationId),
}));

// ────────────────────────────────────────────────────────────────
// HISTORIQUE (journal d'audit)
// ────────────────────────────────────────────────────────────────
export const fiscalDeclarationHistoryTable = pgTable("fiscal_declaration_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  declarationId: uuid("declaration_id").notNull().references(() => fiscalDeclarationsTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  eventLabel: text("event_label").notNull(),
  detail: text("detail"),
  metadata: jsonb("metadata"),
  actorId: uuid("actor_id").references(() => usersTable.id),
  actorName: text("actor_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  declIdx: index("fiscal_hist_decl_idx").on(t.declarationId),
}));
