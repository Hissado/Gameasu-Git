/**
 * Moteur Fiscal — Configurable par pays (OHADA / Togo par défaut)
 *
 * Tables :
 * - tax_rate_configs      : catalogue des impôts/taxes par pays (TVA, IS, IMF, Patente, IRPP…)
 * - tax_obligations       : échéancier fiscal de l'organisation (quand payer quoi)
 * - tax_obligation_payments : paiements effectués sur une obligation
 * - tax_simulations       : simulations fiscales sauvegardées
 * - patente_brackets      : tranches de patente configurables par pays/secteur
 *
 * Taxes couvertes (Togo / OHADA) :
 *   TVA 18% | IS 27% | IMF 1% CAHT | Patente (tranches) | IRPP (barème progressif)
 *   Retenues à la source | CNSS | IPTS | Droits d'enregistrement
 *   Taxe foncière (TFPB / TFPNB) | Taxe véhicules | Taxe d'habitation
 */
import {
  pgTable, text, timestamp, uuid, numeric, integer,
  boolean, jsonb, index, uniqueIndex, date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";

// ─────────────────────────────────────────────────────────
// CATALOGUE DES TAUX PAR PAYS
// ─────────────────────────────────────────────────────────
export const taxRateConfigsTable = pgTable("tax_rate_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),

  // Code pays ISO 3166-1 alpha-2 : TG, CI, SN, CM, BJ, GN, ML, BF, NE, TZ, NG…
  country: text("country").notNull().default("TG"),

  // Code impôt : TVA | IS | IMF | PATENTE | IRPP | RS | CNSS | IPTS | DE | TFPB | TFPNB | TVE | TH | AUTRE
  taxCode: text("tax_code").notNull(),
  taxLabel: text("tax_label").notNull(),
  // Description légale courte
  legalRef: text("legal_ref"),

  // Taux en % (null si montant fixe ou calcul par tranches)
  rate: numeric("rate", { precision: 8, scale: 4 }),
  // Montant fixe en unité monétaire locale (si applicable)
  fixedAmount: numeric("fixed_amount", { precision: 14, scale: 2 }),

  // Base de calcul : revenue_ht | net_profit | gross_salary | property_value | turnover | fixed
  calculationBase: text("calculation_base").notNull().default("revenue_ht"),

  // Fréquence de déclaration : monthly | quarterly | annual | on_event
  declarationFrequency: text("declaration_frequency").notNull().default("monthly"),
  // Jour limite de dépôt dans le mois/trimestre (ex: 15, 20, 31)
  dueDayOfPeriod: integer("due_day_of_period").default(15),

  // Secteurs applicables (null = tous) : commerce | services | industrie | btp | telecom | banque
  applicableSectors: jsonb("applicable_sectors"),

  // Acomptes : nombre par an (ex: 4 pour IS)
  advancePaymentsPerYear: integer("advance_payments_per_year").default(0),
  // Dates des acomptes (ex: ["01-31","05-31","07-31","10-31"])
  advancePaymentDates: jsonb("advance_payment_dates"),

  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),

  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx:     index("tax_rate_org_idx").on(t.organizationId),
  codeIdx:    index("tax_rate_code_idx").on(t.taxCode),
  countryIdx: index("tax_rate_country_idx").on(t.country),
  uniqueOrgCode: uniqueIndex("tax_rate_org_code_uidx").on(t.organizationId, t.taxCode, t.country),
}));

// ─────────────────────────────────────────────────────────
// TRANCHES DE PATENTE PAR SECTEUR
// ─────────────────────────────────────────────────────────
export const patenteBracketsTable = pgTable("patente_brackets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  country: text("country").notNull().default("TG"),
  // CO | HO | PH | SE | ASS | BE | BTP | TEL | TI | IND
  sector: text("sector").notNull(),
  sectorLabel: text("sector_label").notNull(),
  // Tranche inférieure en FCFA
  fromAmount: numeric("from_amount", { precision: 18, scale: 2 }).notNull(),
  // Tranche supérieure (null = au-delà)
  toAmount:   numeric("to_amount",   { precision: 18, scale: 2 }),
  // Taux en % (ex: 0.55, 0.60, 0.65, 0.70)
  rate: numeric("rate", { precision: 6, scale: 4 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx:    index("patente_brackets_org_idx").on(t.organizationId),
  sectorIdx: index("patente_brackets_sector_idx").on(t.sector),
}));

// ─────────────────────────────────────────────────────────
// ÉCHÉANCIER FISCAL (obligations de l'organisation)
// ─────────────────────────────────────────────────────────
export const taxObligationsTable = pgTable("tax_obligations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),

  taxCode:  text("tax_code").notNull(),
  taxLabel: text("tax_label").notNull(),

  // Exercice fiscal (ex: "2026")
  fiscalYear: text("fiscal_year").notNull(),
  // Période couverte (ex: "2026-01" pour TVA, "2026-Q1" pour trimestriel, "2026" pour annuel)
  period: text("period").notNull(),
  periodLabel: text("period_label").notNull(),

  // Statut : upcoming | due | overdue | paid | submitted | cancelled
  status: text("status").notNull().default("upcoming"),

  // Montant calculé automatiquement
  calculatedAmount: numeric("calculated_amount", { precision: 14, scale: 2 }),
  // Montant déclaré
  declaredAmount: numeric("declared_amount", { precision: 14, scale: 2 }),
  // Montant payé
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).default("0"),

  // Date limite de dépôt
  dueDate: date("due_date").notNull(),
  // Date de dépôt effective
  submittedDate: date("submitted_date"),
  // Date de paiement
  paidDate: date("paid_date"),

  // Pénalités de retard
  latePenalty: numeric("late_penalty", { precision: 14, scale: 2 }).default("0"),
  penaltyRate: numeric("penalty_rate", { precision: 6, scale: 4 }).default("0"),

  // Référence de la déclaration auprès de l'OTR / administration
  referenceNumber: text("reference_number"),

  // Acompte ou solde final
  obligationType: text("obligation_type").notNull().default("payment"), // payment | advance | balance | regularization

  notes: text("notes"),
  attachments: jsonb("attachments").default([]),

  responsibleId: uuid("responsible_id").references(() => usersTable.id),
  createdById:   uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx:       index("tax_oblig_org_idx").on(t.organizationId),
  statusIdx:    index("tax_oblig_status_idx").on(t.status),
  dueDateIdx:   index("tax_oblig_due_idx").on(t.dueDate),
  fiscalYrIdx:  index("tax_oblig_year_idx").on(t.fiscalYear),
  taxCodeIdx:   index("tax_oblig_code_idx").on(t.taxCode),
}));

// ─────────────────────────────────────────────────────────
// PAIEMENTS SUR OBLIGATIONS
// ─────────────────────────────────────────────────────────
export const taxObligationPaymentsTable = pgTable("tax_obligation_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  obligationId: uuid("obligation_id").notNull().references(() => taxObligationsTable.id, { onDelete: "cascade" }),

  amount:      numeric("amount",       { precision: 14, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  // virement | cheque | especes | mobile_money
  paymentMethod: text("payment_method").notNull().default("virement"),
  referenceNumber: text("reference_number"),
  bankName:     text("bank_name"),
  attachments:  jsonb("attachments").default([]),
  notes:        text("notes"),

  recordedById: uuid("recorded_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  obligIdx: index("tax_pay_oblig_idx").on(t.obligationId),
  orgIdx:   index("tax_pay_org_idx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────
// SIMULATIONS FISCALES
// ─────────────────────────────────────────────────────────
export const taxSimulationsTable = pgTable("tax_simulations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),

  label: text("label").notNull(),
  fiscalYear: text("fiscal_year").notNull(),
  country: text("country").notNull().default("TG"),

  // Inputs de la simulation
  inputs: jsonb("inputs").notNull(), // {turnover, netProfit, vatCollected, vatDeductible, employees, sector, ...}

  // Résultats calculés
  results: jsonb("results"), // {tva, is, imf, patente, irpp_total, cnss_total, de, totaux}

  // total_tax_burden = somme de tous les impôts
  totalTaxBurden: numeric("total_tax_burden", { precision: 14, scale: 2 }),
  // Ratio impôts / CA
  effectiveTaxRate: numeric("effective_tax_rate", { precision: 6, scale: 4 }),

  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx:  index("tax_sim_org_idx").on(t.organizationId),
  yearIdx: index("tax_sim_year_idx").on(t.fiscalYear),
}));

// ─────────────────────────────────────────────────────────
// TYPES EXPORTÉS
// ─────────────────────────────────────────────────────────
export type TaxRateConfig          = typeof taxRateConfigsTable.$inferSelect;
export type PatenteBracket         = typeof patenteBracketsTable.$inferSelect;
export type TaxObligation          = typeof taxObligationsTable.$inferSelect;
export type TaxObligationPayment   = typeof taxObligationPaymentsTable.$inferSelect;
export type TaxSimulation          = typeof taxSimulationsTable.$inferSelect;

export const insertTaxObligationSchema = createInsertSchema(taxObligationsTable).omit({
  id: true, createdAt: true, updatedAt: true, paidAmount: true, latePenalty: true,
});
export const insertTaxSimulationSchema = createInsertSchema(taxSimulationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
