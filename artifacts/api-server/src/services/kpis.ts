/**
 * Dictionnaire central des indicateurs financiers (audit phase 3 — source
 * unique de vérité). Tout écran qui affiche l'un de ces KPI doit passer par
 * ces fonctions : il est interdit de recalculer une formule différente dans
 * un composant ou une route.
 *
 * Définitions :
 *  - Trésorerie disponible : solde comptable (débit − crédit) des comptes de
 *    classe 5 sur les écritures POSTÉES, jusqu'à la date demandée.
 *  - Créances clients : solde débiteur du compte 411 (et subdivisions).
 *  - Dettes fournisseurs : solde créditeur du compte 401 (et subdivisions).
 * Source : grand livre réel (journal_entry_lines × journal_entries posted).
 */
import { db } from "@workspace/db";
import {
  chartOfAccountsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  bankAccountsTable,
} from "@workspace/db";
import { and, eq, gte, lte, sql, asc } from "drizzle-orm";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Soldes par compte (débit − crédit) sur une classe, écritures postées. */
async function classBalances(organizationId: string, classNum: number, asOf?: string) {
  const conds = [
    eq(journalEntriesTable.organizationId, organizationId),
    eq(journalEntriesTable.status, "posted"),
    eq(chartOfAccountsTable.classNum, classNum),
  ];
  if (asOf) conds.push(lte(journalEntriesTable.entryDate, asOf));
  return db
    .select({
      accountId: chartOfAccountsTable.id,
      code: chartOfAccountsTable.code,
      label: chartOfAccountsTable.label,
      balance: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit} - ${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(...conds))
    .groupBy(chartOfAccountsTable.id, chartOfAccountsTable.code, chartOfAccountsTable.label)
    .orderBy(asc(chartOfAccountsTable.code));
}

export interface TreasuryPosition {
  /** Trésorerie disponible totale (solde comptable classe 5). */
  total: number;
  /** Ventilation par compte comptable, avec le compte bancaire rattaché s'il existe. */
  byAccount: Array<{
    accountId: string;
    code: string;
    label: string;
    balance: number;
    bankAccountId: string | null;
    bankAccountName: string | null;
  }>;
  /** Part du total non rattachée à un compte bancaire déclaré (visibilité, jamais masquée). */
  unlinked: number;
}

/**
 * Position de trésorerie — LA définition unique de « Trésorerie disponible ».
 * Identique par construction au poste Trésorerie du bilan (même requête
 * grand livre) : l'écart « 91,8 M au bilan vs 0 en trésorerie » ne peut
 * plus se produire.
 */
export async function getTreasuryPosition(organizationId: string, asOf?: string): Promise<TreasuryPosition> {
  const balances = await classBalances(organizationId, 5, asOf);
  const banks = await db
    .select({ id: bankAccountsTable.id, name: bankAccountsTable.name, accountId: bankAccountsTable.accountId })
    .from(bankAccountsTable)
    .where(and(eq(bankAccountsTable.organizationId, organizationId), eq(bankAccountsTable.isActive, true)));
  const bankByChartAccount = new Map(banks.map((b) => [b.accountId, b]));

  const byAccount = balances.map((b) => {
    const bank = bankByChartAccount.get(b.accountId);
    return {
      accountId: b.accountId,
      code: b.code,
      label: b.label,
      balance: num(b.balance),
      bankAccountId: bank?.id ?? null,
      bankAccountName: bank?.name ?? null,
    };
  }).filter((b) => b.balance !== 0 || b.bankAccountId !== null);

  const total = byAccount.reduce((s, b) => s + b.balance, 0);
  const unlinked = byAccount.filter((b) => !b.bankAccountId).reduce((s, b) => s + b.balance, 0);
  return { total, byAccount, unlinked };
}

/** Créances clients ouvertes = solde débiteur des comptes 411x (grand livre). */
export async function getReceivablesBalance(organizationId: string, asOf?: string): Promise<number> {
  const balances = await classBalances(organizationId, 4, asOf);
  return balances
    .filter((b) => b.code.startsWith("411"))
    .reduce((s, b) => s + Math.max(0, num(b.balance)), 0);
}

/** Dettes fournisseurs = solde créditeur des comptes 401x (grand livre). */
export async function getPayablesBalance(organizationId: string, asOf?: string): Promise<number> {
  const balances = await classBalances(organizationId, 4, asOf);
  return balances
    .filter((b) => b.code.startsWith("401"))
    .reduce((s, b) => s + Math.max(0, -num(b.balance)), 0);
}

// ── KPI de résultat (compte de résultat) sur une période ─────────────────────

/** Soldes par classe (6 ou 7) sur une période, écritures postées. */
async function periodClassTotal(
  organizationId: string,
  classNum: 6 | 7,
  fromIso?: string,
  toIso?: string,
): Promise<number> {
  const conds = [
    eq(journalEntriesTable.organizationId, organizationId),
    eq(journalEntriesTable.status, "posted"),
    eq(chartOfAccountsTable.classNum, classNum),
  ];
  if (fromIso) conds.push(gte(journalEntriesTable.entryDate, fromIso));
  if (toIso) conds.push(lte(journalEntriesTable.entryDate, toIso));
  const [row] = await db
    .select({
      debit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      credit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(...conds));
  // Produits (7) : solde créditeur ; Charges (6) : solde débiteur.
  return classNum === 7 ? num(row?.credit) - num(row?.debit) : num(row?.debit) - num(row?.credit);
}

export interface IncomeStatementKpis {
  revenue: number;   // Chiffre d'affaires / produits (classe 7)
  expenses: number;  // Charges (classe 6)
  result: number;    // Résultat = produits − charges
}

/**
 * KPI du compte de résultat — LA définition unique de « Chiffre d'affaires »,
 * « Charges » et « Résultat » (grand livre, classes 7 et 6). Toute carte,
 * rapport ou tableau de bord affichant ces montants doit passer par ici.
 */
export async function getIncomeStatementKpis(
  organizationId: string,
  fromIso?: string,
  toIso?: string,
): Promise<IncomeStatementKpis> {
  const [revenue, expenses] = await Promise.all([
    periodClassTotal(organizationId, 7, fromIso, toIso),
    periodClassTotal(organizationId, 6, fromIso, toIso),
  ]);
  return { revenue, expenses, result: revenue - expenses };
}

/** Masse salariale d'une période = charges de personnel (661 + 664). */
export async function getPayrollCost(
  organizationId: string,
  fromIso?: string,
  toIso?: string,
): Promise<number> {
  const conds = [
    eq(journalEntriesTable.organizationId, organizationId),
    eq(journalEntriesTable.status, "posted"),
    sql`${chartOfAccountsTable.code} LIKE '66%' OR ${chartOfAccountsTable.code} LIKE '664%'`,
  ];
  if (fromIso) conds.push(gte(journalEntriesTable.entryDate, fromIso));
  if (toIso) conds.push(lte(journalEntriesTable.entryDate, toIso));
  const [row] = await db
    .select({
      debit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      credit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(...conds));
  return num(row?.debit) - num(row?.credit);
}

export interface VatKpis {
  collected: number;   // TVA collectée (4431, solde créditeur)
  deductible: number;  // TVA déductible / récupérable (4452, solde débiteur)
  net: number;         // Net à payer (collectée − déductible)
}

/**
 * KPI TVA — définition unique depuis les comptes de TVA du grand livre
 * (collectée 443x, déductible 445x). Le net positif = TVA à payer.
 */
export async function getVatKpis(organizationId: string, asOf?: string): Promise<VatKpis> {
  const balances = await classBalances(organizationId, 4, asOf);
  const collected = balances
    .filter((b) => b.code.startsWith("443"))
    .reduce((s, b) => s + Math.max(0, -num(b.balance)), 0); // créditeur
  const deductible = balances
    .filter((b) => b.code.startsWith("445"))
    .reduce((s, b) => s + Math.max(0, num(b.balance)), 0);  // débiteur
  return { collected, deductible, net: collected - deductible };
}
