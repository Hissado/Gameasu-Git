import { pgTable, text, timestamp, uuid, numeric, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { organizationsTable } from "./saas";

// ────────────────────────────────────────────────────────────────
// PLAN COMPTABLE SYSCOHADA (Système Comptable Ouest-Africain)
// Classes 1 à 9. Codes 2 à 8 chiffres (ex: "411", "411100", "70110000").
// ────────────────────────────────────────────────────────────────
export const chartOfAccountsTable = pgTable("chart_of_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),                 // ex: "411000"
  label: text("label").notNull(),               // ex: "Clients"
  classNum: integer("class_num").notNull(),     // 1..9
  // type fonctionnel : asset, liability, equity, revenue, expense, off_balance
  type: text("type").notNull(),
  // sens normal : debit | credit
  normalBalance: text("normal_balance").notNull(),
  parentId: uuid("parent_id"),
  isActive: boolean("is_active").notNull().default(true),
  // si true, on peut imputer dessus ; sinon c'est un "noeud" de regroupement
  isPostable: boolean("is_postable").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("chart_accounts_org_code_uidx").on(t.organizationId, t.code),
  classIdx: index("chart_accounts_class_idx").on(t.classNum),
}));

// ────────────────────────────────────────────────────────────────
// EXERCICES FISCAUX (périodes comptables)
// ────────────────────────────────────────────────────────────────
export const fiscalPeriodsTable = pgTable("fiscal_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                 // ex: "Exercice 2026"
  startDate: text("start_date").notNull(),      // ISO date
  endDate: text("end_date").notNull(),
  // open | closed
  status: text("status").notNull().default("open"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedById: uuid("closed_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────
// JOURNAUX COMPTABLES (VTE, ACH, BNQ, CAI, OD, ...)
// ────────────────────────────────────────────────────────────────
export const journalsTable = pgTable("journals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),                 // VTE, ACH, BNQ, CAI, OD
  label: text("label").notNull(),
  // sales | purchase | bank | cash | misc
  type: text("type").notNull(),
  // contrepartie par défaut (banque pour BNQ, caisse pour CAI...)
  defaultAccountId: uuid("default_account_id").references(() => chartOfAccountsTable.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("journals_org_code_uidx").on(t.organizationId, t.code),
}));

// ────────────────────────────────────────────────────────────────
// ÉCRITURES COMPTABLES (en-tête)
// Une écriture = N lignes, total débit = total crédit (partie double).
// ────────────────────────────────────────────────────────────────
export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  journalId: uuid("journal_id").notNull().references(() => journalsTable.id),
  fiscalPeriodId: uuid("fiscal_period_id").notNull().references(() => fiscalPeriodsTable.id),
  entryNumber: text("entry_number").notNull(),  // ex: "VTE-2026-0001"
  entryDate: text("entry_date").notNull(),      // ISO date
  reference: text("reference"),                 // pièce justificative
  description: text("description"),
  // draft | posted | reversed
  status: text("status").notNull().default("draft"),
  totalDebit: numeric("total_debit", { precision: 18, scale: 2 }).notNull().default("0"),
  totalCredit: numeric("total_credit", { precision: 18, scale: 2 }).notNull().default("0"),
  // origine métier : invoice | payment | proforma | supplier_invoice | manual | amortization | opening
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  reversedById: uuid("reversed_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  numberIdx: uniqueIndex("journal_entries_org_number_uidx").on(t.organizationId, t.entryNumber),
  sourceIdx: index("journal_entries_source_idx").on(t.sourceType, t.sourceId),
  // Idempotence stricte : une opération métier (sourceType+sourceId) ne peut
  // produire qu'une seule écriture comptable. Empêche les doubles
  // comptabilisations sous concurrence (double-clic, retry HTTP).
  sourceUniqueIdx: uniqueIndex("journal_entries_source_uidx")
    .on(t.sourceType, t.sourceId)
    .where(sql`${t.sourceType} IS NOT NULL AND ${t.sourceId} IS NOT NULL AND ${t.status} <> 'reversed'`),
  dateIdx: index("journal_entries_date_idx").on(t.entryDate),
}));

// ────────────────────────────────────────────────────────────────
// LIGNES D'ÉCRITURE (débit / crédit)
// ────────────────────────────────────────────────────────────────
export const journalEntryLinesTable = pgTable("journal_entry_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  entryId: uuid("entry_id").notNull().references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => chartOfAccountsTable.id),
  debit: numeric("debit", { precision: 18, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 18, scale: 2 }).notNull().default("0"),
  description: text("description"),
  // tiers auxiliaire optionnel
  thirdPartyType: text("third_party_type"),     // client | supplier
  thirdPartyId: uuid("third_party_id"),
  projectId: uuid("project_id").references(() => projectsTable.id),
  costCenterId: uuid("cost_center_id"),
  // pour rapprochement bancaire
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  bankTransactionId: uuid("bank_transaction_id"),
  position: integer("position").notNull().default(0),
}, (t) => ({
  entryIdx: index("jel_entry_idx").on(t.entryId),
  accountIdx: index("jel_account_idx").on(t.accountId),
  thirdPartyIdx: index("jel_thirdparty_idx").on(t.thirdPartyType, t.thirdPartyId),
}));

// ────────────────────────────────────────────────────────────────
// FOURNISSEURS (compte 401)
// ────────────────────────────────────────────────────────────────
export const suppliersTable = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),                 // ex: "F0001"
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  taxId: text("tax_id"),                        // numéro contribuable
  paymentTerms: text("payment_terms"),
  // compte comptable auxiliaire (ex: 401001) — facultatif, sinon 401
  accountId: uuid("account_id").references(() => chartOfAccountsTable.id),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  codeIdx: uniqueIndex("suppliers_org_code_uidx").on(t.organizationId, t.code),
}));

// ────────────────────────────────────────────────────────────────
// FACTURES FOURNISSEURS (comptes fournisseurs)
// ────────────────────────────────────────────────────────────────
export const supplierInvoicesTable = pgTable("supplier_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  referenceNumber: text("reference_number").notNull(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliersTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  // draft | pending | paid | overdue | cancelled
  status: text("status").notNull().default("pending"),
  invoiceDate: text("invoice_date").notNull(),
  dueDate: text("due_date"),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).default("0"),
  paidAmount: numeric("paid_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  currency: text("currency").default("XOF"),
  expenseAccountId: uuid("expense_account_id").references(() => chartOfAccountsTable.id),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ────────────────────────────────────────────────────────────────
// BANQUES / CAISSES
// ────────────────────────────────────────────────────────────────
export const bankAccountsTable = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                 // ex: "BICICI compte courant"
  // bank | cash
  type: text("type").notNull().default("bank"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  iban: text("iban"),
  // compte comptable rattaché (521 ou 571)
  accountId: uuid("account_id").notNull().references(() => chartOfAccountsTable.id),
  currency: text("currency").default("XOF"),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────
// MOUVEMENTS BANCAIRES (lignes de relevé importées ou saisies)
// ────────────────────────────────────────────────────────────────
export const bankTransactionsTable = pgTable("bank_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccountsTable.id),
  transactionDate: text("transaction_date").notNull(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(), // signé : + recette / - dépense
  reference: text("reference"),
  isReconciled: boolean("is_reconciled").notNull().default(false),
  reconciledLineId: uuid("reconciled_line_id").references(() => journalEntryLinesTable.id),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  bankIdx: index("banktx_bank_idx").on(t.bankAccountId),
  dateIdx: index("banktx_date_idx").on(t.transactionDate),
}));

// ────────────────────────────────────────────────────────────────
// IMMOBILISATIONS
// ────────────────────────────────────────────────────────────────
export const fixedAssetsTable = pgTable("fixed_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  category: text("category"),                   // matériel, mobilier, véhicule...
  accountId: uuid("account_id").notNull().references(() => chartOfAccountsTable.id), // 24x
  depreciationAccountId: uuid("depreciation_account_id").references(() => chartOfAccountsTable.id), // 28x
  expenseAccountId: uuid("expense_account_id").references(() => chartOfAccountsTable.id), // 681
  acquisitionDate: text("acquisition_date").notNull(),
  acquisitionCost: numeric("acquisition_cost", { precision: 18, scale: 2 }).notNull(),
  residualValue: numeric("residual_value", { precision: 18, scale: 2 }).default("0"),
  // linear (linéaire) | declining (dégressif)
  depreciationMethod: text("depreciation_method").notNull().default("linear"),
  usefulLifeYears: integer("useful_life_years").notNull(),
  // active | disposed
  status: text("status").notNull().default("active"),
  disposedAt: text("disposed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  codeIdx: uniqueIndex("fixed_assets_org_code_uidx").on(t.organizationId, t.code),
}));

export const amortizationsTable = pgTable("amortizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  fixedAssetId: uuid("fixed_asset_id").notNull().references(() => fixedAssetsTable.id, { onDelete: "cascade" }),
  fiscalPeriodId: uuid("fiscal_period_id").notNull().references(() => fiscalPeriodsTable.id),
  periodAmount: numeric("period_amount", { precision: 18, scale: 2 }).notNull(),
  accumulatedAmount: numeric("accumulated_amount", { precision: 18, scale: 2 }).notNull(),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntriesTable.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────
// PAIEMENTS FOURNISSEURS (décaissements)
// ────────────────────────────────────────────────────────────────
export const supplierPaymentsTable = pgTable("supplier_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  supplierInvoiceId: uuid("supplier_invoice_id").notNull().references(() => supplierInvoicesTable.id),
  bankAccountId: uuid("bank_account_id").references(() => bankAccountsTable.id),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").default("XOF"),
  method: text("method").notNull(),
  reference: text("reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────
// COMPTABILITÉ ANALYTIQUE — CENTRES DE COÛT
// ────────────────────────────────────────────────────────────────
export const costCentersTable = pgTable("cost_centers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // department | project | activity | service | geographic | product_line
  type: text("type").notNull().default("department"),
  parentId: uuid("parent_id"),
  isActive: boolean("is_active").notNull().default(true),
  // Budget annuel indicatif pour ce centre (en FCFA)
  budgetAmount: numeric("budget_amount", { precision: 18, scale: 2 }),
  managerId: uuid("manager_id").references(() => usersTable.id),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  codeOrgIdx: uniqueIndex("cost_centers_org_code_uidx").on(t.organizationId, t.code),
  typeIdx: index("cost_centers_type_idx").on(t.type),
}));

// Imputation analytique : lien entre une ligne d'écriture et un ou plusieurs centres de coût
// Géré via costCenterId dans journalEntryLinesTable (à ajouter si besoin de profondeur)
// Pour l'instant : les lignes d'écriture pointent vers projectId, et les centres de coût
// peuvent être liés à des projets ou des départements pour l'agrégation analytique.

// ────────────────────────────────────────────────────────────────
// Zod & types
// ────────────────────────────────────────────────────────────────
export const insertAccountSchema = createInsertSchema(chartOfAccountsTable).omit({ id: true, createdAt: true });
export type ChartAccount = typeof chartOfAccountsTable.$inferSelect;
export type Journal = typeof journalsTable.$inferSelect;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type JournalEntryLine = typeof journalEntryLinesTable.$inferSelect;
export type FiscalPeriod = typeof fiscalPeriodsTable.$inferSelect;
export type Supplier = typeof suppliersTable.$inferSelect;
export type SupplierInvoice = typeof supplierInvoicesTable.$inferSelect;
export type BankAccount = typeof bankAccountsTable.$inferSelect;
export type BankTransaction = typeof bankTransactionsTable.$inferSelect;
export type FixedAsset = typeof fixedAssetsTable.$inferSelect;
export type Amortization = typeof amortizationsTable.$inferSelect;
export type SupplierPayment = typeof supplierPaymentsTable.$inferSelect;

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertSupplierInvoiceSchema = createInsertSchema(supplierInvoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, createdAt: true });
export const insertBankTransactionSchema = createInsertSchema(bankTransactionsTable).omit({ id: true, createdAt: true });
export const insertFixedAssetSchema = createInsertSchema(fixedAssetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCostCenterSchema = createInsertSchema(costCentersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CostCenter = typeof costCentersTable.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
