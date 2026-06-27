/**
 * Seed Hissado Consulting — données de démo complètes
 *
 * Org ID : 88d7592d-8749-49c1-a9b1-d69b44c90f72
 * Idempotent : chaque section vérifie sa présence avant d'insérer.
 * Appelé par POST /super-admin/seed-hissado
 */

import { db } from "@workspace/db";
import {
  organizationsTable,
  usersTable,
  collaboratorsTable,
  contractsTable,
  chartOfAccountsTable,
  fiscalPeriodsTable,
  journalsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  bankAccountsTable,
  suppliersTable,
  supplierInvoicesTable,
  costCentersTable,
  analyticalAccountsTable,
  analyticalEntriesTable,
  fixedAssetsTable,
  budgetsTable,
  budgetLinesTable,
  clientsTable,
  invoicesTable,
  proformasTable,
  projectsTable,
  productsTable,
  productCategoriesTable,
  stockMovementsTable,
  warehousesTable,
  payrollRunsTable,
  payslipsTable,
  marketingCampaignsTable,
  prospectsTable,
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  notificationsTable,
  ticketsTable,
  opportunitiesTable,
  orgAttendanceSettingsTable,
} from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const DEFAULT_ORG_ID = "88d7592d-8749-49c1-a9b1-d69b44c90f72"; // Hissado Consulting — production

function D(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function tryInsert<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

async function createEntry(
  orgId: string, journalId: string, periodId: string, num: string,
  date: string, desc: string,
  lines: Array<{ accountId: string; debit?: number; credit?: number }>,
  status = "posted",
) {
  const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const [entry] = await db.insert(journalEntriesTable).values({
    organizationId: orgId, journalId, fiscalPeriodId: periodId,
    entryNumber: num, entryDate: date, description: desc, status,
    totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2),
    postedAt: status === "posted" ? new Date(`${date}T10:00:00Z`) : undefined,
  }).returning().catch(() => [null]);
  if (!entry) return;
  await db.insert(journalEntryLinesTable).values(
    lines.map((l, i) => ({
      organizationId: orgId, entryId: entry.id, accountId: l.accountId,
      debit: (l.debit ?? 0).toFixed(2), credit: (l.credit ?? 0).toFixed(2),
      description: desc, position: i,
    }))
  ).catch(() => {});
}

export async function seedHissado(orgIdOverride?: string): Promise<Record<string, unknown>> {
  const log: string[] = [];
  const counts: Record<string, number> = {};

  // Resolve org ID: override → default → lookup by slug
  let ORG_ID = orgIdOverride ?? DEFAULT_ORG_ID;
  if (!orgIdOverride) {
    const slugRow = await db.select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(sql`slug LIKE '%hissado%'`).limit(1);
    if (slugRow[0]) {
      ORG_ID = slugRow[0].id;
      log.push(`✓ Org résolue par slug : ${ORG_ID}`);
    }
  }

  // ── Pré-requis : plan comptable, journaux, période, banque ────────────────
  const allAccounts = await db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code })
    .from(chartOfAccountsTable).where(eq(chartOfAccountsTable.organizationId, ORG_ID));
  const byCode: Record<string, string> = {};
  for (const a of allAccounts) byCode[a.code] = a.id;
  const acc = (code: string) => byCode[code] ?? null;

  const [period] = await db.select().from(fiscalPeriodsTable)
    .where(eq(fiscalPeriodsTable.organizationId, ORG_ID)).limit(1);
  if (!period) throw new Error("Aucune période fiscale — démarrez l'API server.");

  const allJournals = await db.select().from(journalsTable)
    .where(eq(journalsTable.organizationId, ORG_ID));
  const jByCode: Record<string, typeof allJournals[0]> = {};
  for (const j of allJournals) jByCode[j.code] = j;

  const ensureJournal = async (code: string, label: string, type: string) => {
    if (jByCode[code]) return jByCode[code]!;
    const [j] = await db.insert(journalsTable)
      .values({ organizationId: ORG_ID, code, label, type })
      .returning().catch(() => [null]);
    if (j) { jByCode[code] = j; return j; }
    const [ex] = await db.select().from(journalsTable)
      .where(and(eq(journalsTable.organizationId, ORG_ID), eq(journalsTable.code, code))).limit(1);
    return ex!;
  };
  const jVTE = await ensureJournal("VTE", "Journal des ventes", "sales");
  const jACH = await ensureJournal("ACH", "Journal des achats", "purchase");
  const jBNQ = await ensureJournal("BNQ", "Journal banque UTB", "bank");
  const jOD  = await ensureJournal("OD", "Opérations diverses", "misc");
  const jCAI = await ensureJournal("CAI", "Journal de caisse", "cash");

  const [bankAccount] = await db.select().from(bankAccountsTable)
    .where(eq(bankAccountsTable.organizationId, ORG_ID)).limit(1);
  if (!bankAccount) throw new Error("Aucun compte bancaire pour Hissado.");

  const allUsers = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.organizationId, ORG_ID));
  const adminUser = allUsers.find(u => u.role === "admin" || u.role === "super_admin") ?? allUsers[0];

  const allCollabs = await db.select().from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, ORG_ID)));
  const allProjects = await db.select().from(projectsTable)
    .where(eq(projectsTable.organizationId, ORG_ID));
  const allClients = await db.select().from(clientsTable)
    .where(eq(clientsTable.organizationId, ORG_ID));
  const allSuppliers = await db.select().from(suppliersTable)
    .where(eq(suppliersTable.organizationId, ORG_ID));

  // ── 1. Correction des emails @hissado.tg ──────────────────────────────────
  const OLD_DOMAIN = "hissado.tg";
  const oldEmails = allUsers.filter(u => u.email.endsWith(`@${OLD_DOMAIN}`));
  const emailMap: Record<string, string> = {
    "dg@hissado.tg":         "direction@hissadoconsulting.com",
    "finance@hissado.tg":    "finance@hissadoconsulting.com",
    "compta@hissado.tg":     "compta@hissadoconsulting.com",
    "commercial@hissado.tg": "commercial@hissadoconsulting.com",
    "sales2@hissado.tg":     "sales2@hissadoconsulting.com",
    "rh@hissado.tg":         "rh@hissadoconsulting.com",
    "ops@hissado.tg":        "operations@hissadoconsulting.com",
    "collab@hissado.tg":     "collab@hissadoconsulting.com",
    "readonly@hissado.tg":   "audit@hissadoconsulting.com",
  };
  let emailFixed = 0;
  for (const u of oldEmails) {
    const newEmail = emailMap[u.email] ?? u.email.replace(`@${OLD_DOMAIN}`, "@hissadoconsulting.com");
    const conflict = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.email, newEmail)).limit(1);
    if (conflict[0]) continue;
    await db.update(usersTable).set({ email: newEmail }).where(eq(usersTable.id, u.id)).catch(() => {});
    emailFixed++;
  }
  // Also fix collaborator emails
  const oldCollabEmails = await db.select({ id: collaboratorsTable.id, email: collaboratorsTable.email })
    .from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, ORG_ID)));
  for (const c of oldCollabEmails) {
    if (c.email && c.email.endsWith(`@${OLD_DOMAIN}`)) {
      const newEmail = emailMap[c.email] ?? c.email.replace(`@${OLD_DOMAIN}`, "@hissadoconsulting.com");
      await db.update(collaboratorsTable).set({ email: newEmail }).where(eq(collaboratorsTable.id, c.id)).catch(() => {});
      emailFixed++;
    }
  }
  counts.emailFixed = emailFixed;
  log.push(`✓ ${emailFixed} emails corrigés @hissado.tg → @hissadoconsulting.com`);

  // ── 2. Centres de coût ────────────────────────────────────────────────────
  const [ccCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(costCentersTable).where(eq(costCentersTable.organizationId, ORG_ID));
  if ((ccCountRow?.c ?? 0) === 0) {
    const centers = [
      { code: "CC-DG",    name: "Direction Générale",                type: "department", color: "#1E3A5F", budgetAmount: "55000000"  },
      { code: "CC-FIN",   name: "Finance & Administration",           type: "department", color: "#2563EB", budgetAmount: "45000000"  },
      { code: "CC-COM",   name: "Conseil & Transformation Digitale",  type: "department", color: "#7C3AED", budgetAmount: "120000000" },
      { code: "CC-DEV",   name: "Développement Logiciel",             type: "department", color: "#0891B2", budgetAmount: "85000000"  },
      { code: "CC-RH",    name: "Ressources Humaines",                type: "department", color: "#059669", budgetAmount: "30000000"  },
      { code: "CC-MKT",   name: "Commercial & Marketing",             type: "department", color: "#D97706", budgetAmount: "40000000"  },
      { code: "CC-OPS",   name: "Opérations",                         type: "department", color: "#DC2626", budgetAmount: "35000000"  },
      { code: "CC-SUPP",  name: "Support Client",                     type: "department", color: "#64748B", budgetAmount: "25000000"  },
      { code: "CC-FORM",  name: "Formation & Accompagnement",         type: "activity",   color: "#F59E0B", budgetAmount: "18000000"  },
      { code: "CC-PROJ1", name: "Projet — Audit SI BSIC Togo",        type: "project",    color: "#0EA5E9", budgetAmount: "28000000"  },
      { code: "CC-PROJ2", name: "Projet — ERP Bolloré Togo",          type: "project",    color: "#8B5CF6", budgetAmount: "65000000"  },
    ];
    await db.insert(costCentersTable).values(
      centers.map(c => ({ organizationId: ORG_ID, ...c, isActive: true }))
    ).catch(() => {});
    counts.costCenters = centers.length;
    log.push(`✓ ${centers.length} centres de coût créés`);
  } else {
    log.push(`✓ Centres de coût existants (${ccCountRow?.c})`);
  }

  // Récupérer les centres pour les entrées analytiques
  const costCenters = await db.select().from(costCentersTable)
    .where(eq(costCentersTable.organizationId, ORG_ID));
  const ccByCode: Record<string, string> = {};
  for (const cc of costCenters) ccByCode[cc.code] = cc.id;

  // ── 3. Comptes analytiques ────────────────────────────────────────────────
  const [aaCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(analyticalAccountsTable).where(eq(analyticalAccountsTable.organizationId, ORG_ID));
  if ((aaCountRow?.c ?? 0) === 0) {
    const analyticalAccounts = [
      // Charges par département
      { code: "AA-SAL",  name: "Charges salariales",           axis: "nature",      type: "charges" },
      { code: "AA-LOC",  name: "Loyers & charges locatives",   axis: "nature",      type: "charges" },
      { code: "AA-INFO", name: "Licences & logiciels",         axis: "nature",      type: "charges" },
      { code: "AA-TEL",  name: "Télécommunications",           axis: "nature",      type: "charges" },
      { code: "AA-TRANSP", name: "Transports & déplacements",  axis: "nature",      type: "charges" },
      { code: "AA-FORM", name: "Formation & coaching",         axis: "nature",      type: "charges" },
      { code: "AA-MARK", name: "Marketing & communication",    axis: "nature",      type: "charges" },
      { code: "AA-CONS", name: "Consultants externes",         axis: "nature",      type: "charges" },
      { code: "AA-MAINT", name: "Maintenance & entretien",     axis: "nature",      type: "charges" },
      // Produits par type de prestation
      { code: "AA-CONS-IT",  name: "Conseil IT & Digital",     axis: "service",     type: "produits" },
      { code: "AA-AUDIT",    name: "Audit & Diagnostic SI",    axis: "service",     type: "produits" },
      { code: "AA-FORM-P",   name: "Formation professionnelle", axis: "service",    type: "produits" },
      { code: "AA-DEV-LOG",  name: "Développement logiciel",   axis: "service",     type: "produits" },
      { code: "AA-MAINT-SI", name: "Maintenance SI",           axis: "service",     type: "produits" },
      // Axes projet
      { code: "AA-PRJ-BSIC", name: "Projet BSIC — Audit SI",   axis: "projet",     type: "mixte" },
      { code: "AA-PRJ-BOLL", name: "Projet Bolloré — ERP",      axis: "projet",     type: "mixte" },
      { code: "AA-PRJ-ECO",  name: "Projet Ecobank — Formation", axis: "projet",    type: "mixte" },
      { code: "AA-PRJ-NSIA", name: "Projet NSIA — Paiement",    axis: "projet",     type: "mixte" },
    ];
    await db.insert(analyticalAccountsTable).values(
      analyticalAccounts.map(a => ({ organizationId: ORG_ID, ...a, isActive: true }))
    ).catch(() => {});
    counts.analyticalAccounts = analyticalAccounts.length;
    log.push(`✓ ${analyticalAccounts.length} comptes analytiques créés`);
  } else {
    log.push(`✓ Comptes analytiques existants (${aaCountRow?.c})`);
  }

  // ── 4. Immobilisations ────────────────────────────────────────────────────
  const [assCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(fixedAssetsTable).where(eq(fixedAssetsTable.organizationId, ORG_ID));
  if ((assCountRow?.c ?? 0) < 3) {
    const a241  = acc("241");
    const a2441 = acc("2441") ?? acc("244");
    const a2841 = acc("2841") ?? acc("2844") ?? acc("2845") ?? acc("281");
    const a681  = acc("681");
    if (a241 && a2841 && a681) {
      await db.insert(fixedAssetsTable).values([
        { organizationId: ORG_ID, code: "HC-IMM-001", label: "Serveurs Dell PowerEdge R750 (cluster)", category: "Matériel informatique", accountId: a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2023-06-01", acquisitionCost: "48000000", residualValue: "3000000", depreciationMethod: "linear", usefulLifeYears: 5, status: "active" },
        { organizationId: ORG_ID, code: "HC-IMM-002", label: "Climatiseurs & onduleurs salle serveur", category: "Équipement technique", accountId: a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2023-06-15", acquisitionCost: "12500000", residualValue: "500000", depreciationMethod: "linear", usefulLifeYears: 8, status: "active" },
        { organizationId: ORG_ID, code: "HC-IMM-003", label: "Minibus Toyota Hiace 15 places", category: "Véhicule de service", accountId: a2441 ?? a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2022-03-10", acquisitionCost: "22000000", residualValue: "2000000", depreciationMethod: "linear", usefulLifeYears: 7, status: "active" },
        { organizationId: ORG_ID, code: "HC-IMM-004", label: "Mobilier & aménagement bureaux (Lomé)", category: "Mobilier de bureau", accountId: a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2021-09-01", acquisitionCost: "18500000", residualValue: "1000000", depreciationMethod: "linear", usefulLifeYears: 10, status: "active" },
        { organizationId: ORG_ID, code: "HC-IMM-005", label: "Système CCTV & contrôle d'accès", category: "Sécurité", accountId: a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2024-01-15", acquisitionCost: "8500000", residualValue: "500000", depreciationMethod: "linear", usefulLifeYears: 5, status: "active" },
      ]).catch(() => {});
      counts.fixedAssets = 5;
      log.push("✓ 5 immobilisations créées");
    }
  } else {
    log.push(`✓ Immobilisations existantes (${assCountRow?.c})`);
  }

  // ── 5. Budgets + lignes ───────────────────────────────────────────────────
  const [budgetCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(budgetsTable).where(eq(budgetsTable.organizationId, ORG_ID));
  if ((budgetCountRow?.c ?? 0) === 0) {
    const budgetAccounts = [
      { code: "706", label: "Prestations de services",    type: "revenue", months: [42_000_000, 38_000_000, 51_000_000, 55_000_000, 49_000_000, 58_000_000, 62_000_000, 55_000_000, 48_000_000, 52_000_000, 60_000_000, 70_000_000] },
      { code: "707", label: "Ventes produits & licences", type: "revenue", months: [8_500_000, 7_200_000, 11_500_000, 12_000_000, 9_800_000, 13_000_000, 14_500_000, 11_000_000, 9_500_000, 10_500_000, 12_000_000, 15_000_000] },
      { code: "661", label: "Salaires & traitements",     type: "expense", months: [18_200_000, 18_200_000, 19_500_000, 19_500_000, 19_500_000, 19_500_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000] },
      { code: "664", label: "Charges sociales patronales", type: "expense", months: [3_350_000, 3_350_000, 3_590_000, 3_590_000, 3_590_000, 3_590_000, 3_680_000, 3_680_000, 3_680_000, 3_680_000, 3_680_000, 3_680_000] },
      { code: "622", label: "Loyers & charges locatives",  type: "expense", months: [3_200_000, 3_200_000, 3_200_000, 3_200_000, 3_200_000, 3_200_000, 3_200_000, 3_200_000, 3_200_000, 3_200_000, 3_200_000, 3_200_000] },
      { code: "625", label: "Assurances",                  type: "expense", months: [850_000, 850_000, 850_000, 850_000, 850_000, 850_000, 850_000, 850_000, 850_000, 850_000, 850_000, 850_000] },
      { code: "628", label: "Télécommunications",          type: "expense", months: [620_000, 620_000, 620_000, 680_000, 680_000, 680_000, 700_000, 700_000, 700_000, 700_000, 700_000, 720_000] },
      { code: "627", label: "Marketing & communication",   type: "expense", months: [2_800_000, 2_500_000, 3_200_000, 4_000_000, 3_500_000, 4_500_000, 5_000_000, 3_500_000, 3_000_000, 3_500_000, 4_000_000, 5_500_000] },
      { code: "605", label: "Licences & abonnements",      type: "expense", months: [1_800_000, 1_800_000, 1_800_000, 1_800_000, 1_800_000, 1_800_000, 2_200_000, 2_200_000, 2_200_000, 2_200_000, 2_200_000, 2_200_000] },
      { code: "624", label: "Entretien & maintenance",     type: "expense", months: [1_200_000, 1_100_000, 1_500_000, 1_400_000, 1_300_000, 1_600_000, 1_500_000, 1_400_000, 1_300_000, 1_400_000, 1_500_000, 1_800_000] },
      { code: "631", label: "Frais bancaires",             type: "expense", months: [280_000, 280_000, 280_000, 300_000, 300_000, 300_000, 320_000, 320_000, 320_000, 320_000, 320_000, 350_000] },
      { code: "641", label: "Impôts & taxes",              type: "expense", months: [1_200_000, 1_200_000, 1_200_000, 1_350_000, 1_350_000, 1_350_000, 1_400_000, 1_400_000, 1_400_000, 1_400_000, 1_400_000, 1_500_000] },
    ];

    // Budget prévisionnel 2026 — utilise la période fiscale déjà chargée
    const [budget] = await db.insert(budgetsTable).values({
      organizationId: ORG_ID,
      name: "Budget prévisionnel 2026",
      fiscalPeriodId: period.id,
      kind: "budget",
      scope: "company",
      status: "active",
      versionNumber: 1,
      notes: "Budget annuel Hissado Consulting — exercice 2026",
    }).returning().catch(() => [null]);
    if (budget) {
      const lines: Array<Record<string, unknown>> = [];
      for (const ba of budgetAccounts) {
        const accountId = acc(ba.code);
        if (!accountId) continue;
        for (let m = 1; m <= 12; m++) {
          lines.push({
            organizationId: ORG_ID,
            budgetId: budget.id,
            accountId,
            period: `2026-${String(m).padStart(2, "0")}`,
            amount: String(ba.months[m - 1]),
          });
        }
      }
      if (lines.length > 0) {
        await db.insert(budgetLinesTable).values(lines as any).catch(() => {});
      }
      counts.budgets = 1;
      counts.budgetLines = lines.length;
      log.push(`✓ Budget 2026 créé (${lines.length} lignes)`);
    }

    // Forecast révisé S1 2026
    const [forecast] = await db.insert(budgetsTable).values({
      organizationId: ORG_ID,
      name: "Forecast révisé S1 2026",
      fiscalPeriodId: period.id,
      kind: "forecast",
      scope: "company",
      status: "active",
      versionNumber: 1,
      notes: "Révision semestrielle avec actualisation des projections +8%",
    }).returning().catch(() => [null]);
    if (forecast) {
      const fcstLines: Array<Record<string, unknown>> = [];
      for (const ba of budgetAccounts.slice(0, 6)) {
        const accountId = acc(ba.code);
        if (!accountId) continue;
        for (let m = 1; m <= 6; m++) {
          const adjusted = Math.round(ba.months[m - 1] * 1.08);
          fcstLines.push({
            organizationId: ORG_ID,
            budgetId: forecast.id,
            accountId,
            period: `2026-${String(m).padStart(2, "0")}`,
            amount: String(adjusted),
          });
        }
      }
      if (fcstLines.length > 0) {
        await db.insert(budgetLinesTable).values(fcstLines as any).catch(() => {});
      }
      counts.forecasts = 1;
      log.push("✓ Forecast S1 2026 créé");
    }
  } else {
    log.push(`✓ Budgets existants (${budgetCountRow?.c})`);
  }

  // ── 6. Écritures comptables ───────────────────────────────────────────────
  const [entryCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(journalEntriesTable).where(eq(journalEntriesTable.organizationId, ORG_ID));
  if ((entryCountRow?.c ?? 0) < 5) {
    const months = [
      { mm: 1, rev706: 42_000_000, rev707: 8_500_000, sal661: 18_200_000, sal664: 3_350_000, loyer622: 3_200_000, assur625: 850_000, tel628: 620_000, imp641: 1_200_000, ach605: 1_800_000, maint624: 1_200_000, pub627: 2_800_000, bank631: 280_000 },
      { mm: 2, rev706: 38_000_000, rev707: 7_200_000, sal661: 18_200_000, sal664: 3_350_000, loyer622: 3_200_000, assur625: 850_000, tel628: 620_000, imp641: 1_200_000, ach605: 1_800_000, maint624: 1_100_000, pub627: 2_500_000, bank631: 280_000 },
      { mm: 3, rev706: 51_000_000, rev707: 11_500_000, sal661: 19_500_000, sal664: 3_590_000, loyer622: 3_200_000, assur625: 850_000, tel628: 620_000, imp641: 1_200_000, ach605: 1_800_000, maint624: 1_500_000, pub627: 3_200_000, bank631: 280_000 },
      { mm: 4, rev706: 55_000_000, rev707: 12_000_000, sal661: 19_500_000, sal664: 3_590_000, loyer622: 3_200_000, assur625: 850_000, tel628: 680_000, imp641: 1_350_000, ach605: 1_800_000, maint624: 1_400_000, pub627: 4_000_000, bank631: 300_000 },
      { mm: 5, rev706: 49_000_000, rev707: 9_800_000, sal661: 19_500_000, sal664: 3_590_000, loyer622: 3_200_000, assur625: 850_000, tel628: 680_000, imp641: 1_350_000, ach605: 1_800_000, maint624: 1_300_000, pub627: 3_500_000, bank631: 300_000 },
      { mm: 6, rev706: 58_000_000, rev707: 13_000_000, sal661: 19_500_000, sal664: 3_590_000, loyer622: 3_200_000, assur625: 850_000, tel628: 680_000, imp641: 1_350_000, ach605: 1_800_000, maint624: 1_600_000, pub627: 4_500_000, bank631: 300_000 },
    ];
    let seq = 1;
    const num = (j: string) => `HC-${j}-2026-${String(seq++).padStart(4, "0")}`;
    for (const m of months) {
      const d1 = D(2026, m.mm, 1); const d10 = D(2026, m.mm, 10);
      const d15 = D(2026, m.mm, 15); const d28 = D(2026, m.mm, 28);
      if (!acc("411") || !acc("706") || !acc("521")) continue;
      // Ventes
      await createEntry(ORG_ID, jVTE.id, period.id, num("VTE"), d1, `Prestations Hissado — mois ${m.mm}/2026`, [
        { accountId: acc("411")!, debit: m.rev706 + m.rev707 },
        { accountId: acc("706")!, credit: m.rev706 },
        ...(acc("707") ? [{ accountId: acc("707")!, credit: m.rev707 }] : []),
      ]);
      // Encaissements 80%
      const encaiss = Math.round((m.rev706 + m.rev707) * 0.80);
      await createEntry(ORG_ID, jBNQ.id, period.id, num("BNQ"), d15, `Encaissements clients ${m.mm}/2026`, [
        { accountId: acc("521")!, debit: encaiss },
        { accountId: acc("411")!, credit: encaiss },
      ]);
      // Masse salariale
      if (acc("661") && acc("664") && acc("421")) {
        await createEntry(ORG_ID, jOD.id, period.id, num("OD"), d28, `Masse salariale ${m.mm}/2026`, [
          { accountId: acc("661")!, debit: m.sal661 },
          { accountId: acc("664")!, debit: m.sal664 },
          { accountId: acc("421")!, credit: m.sal661 + m.sal664 },
        ]);
        await createEntry(ORG_ID, jBNQ.id, period.id, num("BNQ"), d28, `Paiement salaires ${m.mm}/2026`, [
          { accountId: acc("421")!, debit: m.sal661 + m.sal664 },
          { accountId: acc("521")!, credit: m.sal661 + m.sal664 },
        ]);
      }
      // Charges
      if (acc("622") && acc("401")) {
        await createEntry(ORG_ID, jACH.id, period.id, num("ACH"), d1, `Loyer ${m.mm}/2026`, [
          { accountId: acc("622")!, debit: m.loyer622 },
          { accountId: acc("401")!, credit: m.loyer622 },
        ]);
      }
      if (acc("625") && acc("401")) {
        await createEntry(ORG_ID, jACH.id, period.id, num("ACH"), d1, `Assurance ${m.mm}/2026`, [
          { accountId: acc("625")!, debit: m.assur625 },
          { accountId: acc("401")!, credit: m.assur625 },
        ]);
      }
      if (acc("628") && acc("401")) {
        await createEntry(ORG_ID, jACH.id, period.id, num("ACH"), d1, `Télécommunications ${m.mm}/2026`, [
          { accountId: acc("628")!, debit: m.tel628 },
          { accountId: acc("401")!, credit: m.tel628 },
        ]);
      }
      if (acc("641") && acc("521")) {
        await createEntry(ORG_ID, jBNQ.id, period.id, num("BNQ"), d10, `Impôts & taxes ${m.mm}/2026`, [
          { accountId: acc("641")!, debit: m.imp641 },
          { accountId: acc("521")!, credit: m.imp641 },
        ]);
      }
      if (acc("605") && acc("401")) {
        await createEntry(ORG_ID, jACH.id, period.id, num("ACH"), d1, `Licences logiciels ${m.mm}/2026`, [
          { accountId: acc("605")!, debit: m.ach605 },
          { accountId: acc("401")!, credit: m.ach605 },
        ]);
      }
      if (acc("624") && acc("401")) {
        await createEntry(ORG_ID, jACH.id, period.id, num("ACH"), d15, `Maintenance SI ${m.mm}/2026`, [
          { accountId: acc("624")!, debit: m.maint624 },
          { accountId: acc("401")!, credit: m.maint624 },
        ]);
      }
      if (acc("627") && acc("401")) {
        await createEntry(ORG_ID, jACH.id, period.id, num("ACH"), d1, `Marketing & communication ${m.mm}/2026`, [
          { accountId: acc("627")!, debit: m.pub627 },
          { accountId: acc("401")!, credit: m.pub627 },
        ]);
      }
      if (acc("631") && acc("521")) {
        await createEntry(ORG_ID, jBNQ.id, period.id, num("BNQ"), d28, `Frais bancaires ${m.mm}/2026`, [
          { accountId: acc("631")!, debit: m.bank631 },
          { accountId: acc("521")!, credit: m.bank631 },
        ]);
      }
      // Règlement fournisseurs 70%
      const totalFourn = m.loyer622 + m.assur625 + m.tel628 + m.ach605 + m.maint624 + m.pub627;
      if (acc("401") && acc("521")) {
        await createEntry(ORG_ID, jBNQ.id, period.id, num("BNQ"), d28, `Règlements fournisseurs ${m.mm}/2026`, [
          { accountId: acc("401")!, debit: Math.round(totalFourn * 0.70) },
          { accountId: acc("521")!, credit: Math.round(totalFourn * 0.70) },
        ]);
      }
    }
    counts.journalEntries = months.length * 12;
    log.push(`✓ ${months.length * 12} écritures comptables créées (6 mois × ~12)`);
  } else {
    log.push(`✓ Écritures comptables existantes (${entryCountRow?.c})`);
  }

  // ── 7. Entrées analytiques ────────────────────────────────────────────────
  const [aeCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(analyticalEntriesTable).where(eq(analyticalEntriesTable.organizationId, ORG_ID));
  if ((aeCountRow?.c ?? 0) < 5) {
    const allAA = await db.select().from(analyticalAccountsTable)
      .where(eq(analyticalAccountsTable.organizationId, ORG_ID));
    const aaByCode: Record<string, string> = {};
    for (const a of allAA) aaByCode[a.code] = a.id;

    const entries: Array<Record<string, unknown>> = [];
    const months = [1, 2, 3, 4, 5, 6];
    for (const mm of months) {
      const period2 = `2026-${String(mm).padStart(2, "0")}`;
      const date2 = D(2026, mm, 28);
      // Charges salariales par centre
      const salTotal = 19_500_000;
      const salSplit = [
        { cc: "CC-DG", pct: 0.12 }, { cc: "CC-FIN", pct: 0.08 },
        { cc: "CC-COM", pct: 0.25 }, { cc: "CC-DEV", pct: 0.22 },
        { cc: "CC-RH", pct: 0.06 }, { cc: "CC-MKT", pct: 0.10 },
        { cc: "CC-OPS", pct: 0.08 }, { cc: "CC-SUPP", pct: 0.09 },
      ];
      for (const s of salSplit) {
        if (!ccByCode[s.cc]) continue;
        entries.push({
          organizationId: ORG_ID, date: date2, period: period2,
          accountId: aaByCode["AA-SAL"] ?? null,
          costCenterId: ccByCode[s.cc],
          amount: String(Math.round(salTotal * s.pct)),
          costType: "direct", label: `Charges salariales — ${s.cc} — ${period2}`,
        });
      }
      // Produits par projet
      if (allProjects[0] && aaByCode["AA-PRJ-BSIC"]) {
        entries.push({
          organizationId: ORG_ID, date: D(2026, mm, 15), period: period2,
          accountId: aaByCode["AA-AUDIT"] ?? null,
          costCenterId: ccByCode["CC-COM"] ?? null,
          projectId: allProjects[0].id,
          amount: String(-8_500_000),
          costType: "direct", label: `CA Projet BSIC Audit SI — ${period2}`,
        });
      }
      if (allProjects[1] && aaByCode["AA-PRJ-BOLL"]) {
        entries.push({
          organizationId: ORG_ID, date: D(2026, mm, 15), period: period2,
          accountId: aaByCode["AA-DEV-LOG"] ?? null,
          costCenterId: ccByCode["CC-DEV"] ?? null,
          projectId: allProjects[1].id,
          amount: String(-12_000_000),
          costType: "direct", label: `CA Projet Bolloré ERP — ${period2}`,
        });
      }
    }
    if (entries.length > 0) {
      await db.insert(analyticalEntriesTable).values(entries as any).catch(() => {});
    }
    counts.analyticalEntries = entries.length;
    log.push(`✓ ${entries.length} entrées analytiques créées`);
  } else {
    log.push(`✓ Entrées analytiques existantes (${aeCountRow?.c})`);
  }

  // ── 8. Cycles de paie (3 mois) ───────────────────────────────────────────
  const [prCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(payrollRunsTable).where(eq(payrollRunsTable.organizationId, ORG_ID));
  if ((prCountRow?.c ?? 0) === 0 && allCollabs.length > 0) {
    const allContracts = await db.select().from(contractsTable)
      .where(inArray(contractsTable.collaboratorId, allCollabs.map(c => c.id)));
    const contractByCollab: Record<string, typeof allContracts[0]> = {};
    for (const c of allContracts) contractByCollab[c.collaboratorId] = c;

    const payPeriods = [
      { period: "2026-04", runDate: D(2026, 4, 25), paymentDate: D(2026, 4, 28) },
      { period: "2026-05", runDate: D(2026, 5, 26), paymentDate: D(2026, 5, 29) },
      { period: "2026-06", runDate: D(2026, 6, 25), paymentDate: D(2026, 6, 27) },
    ];

    for (const pp of payPeriods) {
      const payslipData = allCollabs.map(collab => {
        const baseSal = parseFloat(String(collab.baseSalary ?? "0"));
        if (baseSal === 0) return null;
        const contract = contractByCollab[collab.id];
        // CNSS Togo : 4% employé, 16.4% employeur
        const cnssEmployee = Math.round(baseSal * 0.04);
        const cnssEmployer = Math.round(baseSal * 0.164);
        // IPTS : 2%
        const ipts = Math.round(baseSal * 0.02);
        // IRPP simplifié Togo (~5-30% progressif, moyenne ~8%)
        const irpp = Math.round(baseSal * 0.08);
        const grossSalary = baseSal;
        const netSalary = grossSalary - cnssEmployee - ipts - irpp;
        return {
          organizationId: ORG_ID,
          collaboratorId: collab.id,
          contractId: contract?.id ?? null,
          period: pp.period,
          baseSalary: String(baseSal),
          grossSalary: String(grossSalary),
          cnssEmployee: String(cnssEmployee),
          cnssEmployer: String(cnssEmployer),
          irpp: String(irpp),
          ipts: String(ipts),
          netSalary: String(netSalary),
          additions: [] as any,
          deductions: [] as any,
          transportAllowance: "25000",
          status: "paid",
          paidAt: new Date(`${pp.paymentDate}T10:00:00Z`),
        };
      }).filter(Boolean) as Array<Record<string, unknown>>;

      const totalGross = payslipData.reduce((s, p) => s + parseFloat(String(p!.grossSalary)), 0);
      const totalNet = payslipData.reduce((s, p) => s + parseFloat(String(p!.netSalary)), 0);
      const totalCnssEmp = payslipData.reduce((s, p) => s + parseFloat(String(p!.cnssEmployee)), 0);
      const totalCnssEr = payslipData.reduce((s, p) => s + parseFloat(String(p!.cnssEmployer)), 0);
      const totalIrpp = payslipData.reduce((s, p) => s + parseFloat(String(p!.irpp)), 0);
      const totalIpts = payslipData.reduce((s, p) => s + parseFloat(String(p!.ipts)), 0);

      const [run] = await db.insert(payrollRunsTable).values({
        organizationId: ORG_ID,
        period: pp.period,
        status: "paid",
        runDate: pp.runDate,
        paymentDate: pp.paymentDate,
        totalGrossSalary: String(totalGross),
        totalNetSalary: String(totalNet),
        totalCnssEmployee: String(totalCnssEmp),
        totalCnssEmployer: String(totalCnssEr),
        totalIrpp: String(totalIrpp),
        totalIpts: String(totalIpts),
        employeeCount: payslipData.length,
        notes: `Paie ${pp.period} — Hissado Consulting`,
        createdById: adminUser?.id ?? null,
        validatedById: adminUser?.id ?? null,
        validatedAt: new Date(`${pp.runDate}T14:00:00Z`),
      } as any).returning().catch(() => [null]);

      if (run && payslipData.length > 0) {
        const slips = payslipData.map(p => ({ ...p, payrollRunId: run.id }));
        await db.insert(payslipsTable).values(slips as any).catch(() => {});
      }
    }
    counts.payrollRuns = payPeriods.length;
    counts.payslips = payPeriods.length * allCollabs.length;
    log.push(`✓ ${payPeriods.length} cycles de paie créés (${allCollabs.length} collaborateurs × 3 mois)`);
  } else {
    log.push(`✓ Cycles de paie existants (${prCountRow?.c})`);
  }

  // ── 9. Entrepôt + produits + mouvements stock ─────────────────────────────
  const [whCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(warehousesTable).where(eq((warehousesTable as any).organizationId, ORG_ID));
  if ((whCountRow?.c ?? 0) === 0) {
    const [wh] = await db.insert(warehousesTable).values({
      organizationId: ORG_ID,
      code: "WH-LOME-01",
      name: "Dépôt principal — Lomé Quartier Bé",
      address: "Quartier Bé, Lomé, Togo",
      type: "principal",
      isActive: true,
    } as any).returning().catch(() => [null]);

    // Catégories produits
    const [catInf] = await db.insert(productCategoriesTable).values({ organizationId: ORG_ID, name: "Équipements informatiques", description: "Matériel IT" }).returning().catch(() => [null]);
    const [catLog] = await db.insert(productCategoriesTable).values({ organizationId: ORG_ID, name: "Licences logicielles", description: "Logiciels & SaaS" }).returning().catch(() => [null]);
    const [catOff] = await db.insert(productCategoriesTable).values({ organizationId: ORG_ID, name: "Fournitures de bureau", description: "Consommables" }).returning().catch(() => [null]);

    // Produits
    const productSpecs = [
      { sku: "HC-LAPTOP-001", name: "Laptop Dell Latitude 5540 i7 16Go", categoryId: catInf?.id ?? null, unit: "pcs", purchasePriceFcfa: "550000", sellingPriceFcfa: "720000", minStock: "2" },
      { sku: "HC-SWITCH-001", name: "Switch réseau Cisco SG350-28 24P", categoryId: catInf?.id ?? null, unit: "pcs", purchasePriceFcfa: "320000", sellingPriceFcfa: "420000", minStock: "1" },
      { sku: "HC-LIC-WIN11", name: "Licence Windows 11 Pro (OEM)", categoryId: catLog?.id ?? null, unit: "pcs", purchasePriceFcfa: "125000", sellingPriceFcfa: "180000", minStock: "5" },
      { sku: "HC-LIC-OFF365", name: "Microsoft 365 Business Standard (ann.)", categoryId: catLog?.id ?? null, unit: "abonnement", purchasePriceFcfa: "75000", sellingPriceFcfa: "110000", minStock: "0" },
      { sku: "HC-PRNTR-001", name: "Imprimante HP LaserJet Pro 4001n", categoryId: catInf?.id ?? null, unit: "pcs", purchasePriceFcfa: "280000", sellingPriceFcfa: "360000", minStock: "1" },
      { sku: "HC-PAPE-A4", name: "Ramette papier A4 80g (500 feuilles)", categoryId: catOff?.id ?? null, unit: "ramette", purchasePriceFcfa: "3500", sellingPriceFcfa: "5000", minStock: "20" },
      { sku: "HC-TONER-001", name: "Toner HP 58A noir (original)", categoryId: catOff?.id ?? null, unit: "pcs", purchasePriceFcfa: "28000", sellingPriceFcfa: "38000", minStock: "3" },
    ];
    const productIds: string[] = [];
    for (const p of productSpecs) {
      const [prod] = await db.insert(productsTable).values({
        organizationId: ORG_ID, ...p, isActive: true,
      } as any).returning().catch(() => [null]);
      if (prod) productIds.push(prod.id);
    }

    // Mouvements de stock (entrées initiales)
    const initialQtys = [8, 3, 15, 20, 2, 100, 10];
    for (let i = 0; i < productIds.length; i++) {
      await db.insert(stockMovementsTable).values({
        organizationId: ORG_ID,
        productId: productIds[i],
        kind: "in",
        quantity: String(initialQtys[i] ?? 5),
        referenceType: "initial",
        referenceLabel: `ENT-2026-${String(i + 1).padStart(4, "0")}`,
        reason: "Stock initial — ouverture inventaire 2026",
        unitCostFcfa: productSpecs[i]?.purchasePriceFcfa ?? "0",
        occurredAt: new Date("2026-01-02T08:00:00Z"),
      } as any).catch(() => {});
    }

    // Quelques sorties (ventes)
    if (productIds[0]) {
      await db.insert(stockMovementsTable).values({
        organizationId: ORG_ID, productId: productIds[0]!,
        kind: "out", quantity: "-2",
        referenceType: "sale", referenceLabel: "SOR-2026-0001",
        reason: "Livraison client BSIC Togo — Audit SI",
        unitCostFcfa: "550000", occurredAt: new Date("2026-02-15T10:00:00Z"),
      } as any).catch(() => {});
    }
    if (productIds[2]) {
      await db.insert(stockMovementsTable).values({
        organizationId: ORG_ID, productId: productIds[2]!,
        kind: "out", quantity: "-5",
        referenceType: "sale", referenceLabel: "SOR-2026-0002",
        reason: "Licences Windows — Projet Bolloré",
        unitCostFcfa: "125000", occurredAt: new Date("2026-03-10T10:00:00Z"),
      } as any).catch(() => {});
    }

    counts.warehouses = 1;
    counts.products = productIds.length;
    log.push(`✓ 1 entrepôt + ${productIds.length} produits + mouvements de stock créés`);
  } else {
    log.push(`✓ Entrepôt & produits existants (${whCountRow?.c})`);
  }

  // ── 10. Campagnes marketing + prospects ───────────────────────────────────
  const [campCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(marketingCampaignsTable).where(eq(marketingCampaignsTable.organizationId, ORG_ID));
  if ((campCountRow?.c ?? 0) === 0) {
    await db.insert(marketingCampaignsTable).values([
      { organizationId: ORG_ID, name: "[HC] Campagne — Transformation Digitale Togo 2026", status: "active", type: "email", budget: "5000000", spent: "2800000", startDate: "2026-01-15", endDate: "2026-06-30", description: "Ciblage DSI et DG des 100 premières entreprises togolaises" },
      { organizationId: ORG_ID, name: "[HC] Campagne — Refonte SI Secteur Financier", status: "completed", type: "email", budget: "3500000", spent: "3200000", startDate: "2025-10-01", endDate: "2026-01-31", description: "Institutions financières et banques — proposition ERP & audit" },
      { organizationId: ORG_ID, name: "[HC] Webinaire — Cybersécurité & Cloud Afrique", status: "draft", type: "event", budget: "2000000", spent: "0", startDate: "2026-07-15", endDate: "2026-07-15", description: "Webinaire gratuit 200 inscrits attendus" },
    ] as any).catch(() => {});

    // Prospects
    const prospectSpecs = [
      { firstName: "Pépé", lastName: "Gnanawoubou", email: "p.gnanawoubou@mtn-togo.tg", phone: "+228 90 11 22 33", company: "MTN Togo", status: "qualified", source: "linkedin" },
      { firstName: "Adèle", lastName: "Koumassou", email: "a.koumassou@societe-generale.tg", phone: "+228 22 21 31 41", company: "Société Générale Togo", status: "new", source: "referral" },
      { firstName: "Martial", lastName: "Djossou", email: "m.djossou@lomé-port.tg", phone: "+228 90 22 33 44", company: "Port Autonome de Lomé", status: "contacted", source: "conference" },
      { firstName: "Sœur Ama", lastName: "Adjagba", email: "direction@clinique-sainte-anne.tg", phone: "+228 22 35 46 57", company: "Clinique Sainte-Anne Lomé", status: "proposal_sent", source: "website" },
      { firstName: "Gérard", lastName: "Aholou", email: "g.aholou@togolaise-telecom.tg", phone: "+228 92 11 22 33", company: "Togolaise des Télécoms", status: "new", source: "cold_call" },
    ];
    await db.insert(prospectsTable).values(
      prospectSpecs.map(p => ({ organizationId: ORG_ID, ...p } as any))
    ).catch(() => {});
    counts.campaigns = 3;
    counts.prospects = prospectSpecs.length;
    log.push("✓ 3 campagnes marketing + 5 prospects créés");
  } else {
    log.push(`✓ Campagnes existantes (${campCountRow?.c})`);
  }

  // ── 11. Factures + proformas supplémentaires ──────────────────────────────
  const [invCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(invoicesTable).where(eq(invoicesTable.organizationId, ORG_ID));
  if ((invCountRow?.c ?? 0) < 8 && allClients.length >= 3) {
    const [c0, c1, c2, c3, c4] = allClients;
    const [p0, p1] = allProjects;

    const invoiceSpecs = [
      { client: c0!, project: p0 ?? null, ref: "HC-FAC-2026-0001", date: "2026-01-31", due: "2026-03-02", amount: "8500000", paid: "8500000", status: "paid", label: "Audit SI Phase 1 — BSIC Togo" },
      { client: c1!, project: p1 ?? null, ref: "HC-FAC-2026-0002", date: "2026-02-28", due: "2026-03-30", amount: "15000000", paid: "7500000", status: "partial", label: "Implémentation ERP Bolloré — Acompte Phase 1" },
      { client: c2!, project: null, ref: "HC-FAC-2026-0003", date: "2026-03-15", due: "2026-04-14", amount: "6800000", paid: "0", status: "overdue", label: "Audit conformité IFRS — ORABANK Togo" },
      { client: c3!, project: null, ref: "HC-FAC-2026-0004", date: "2026-04-05", due: "2026-05-05", amount: "4200000", paid: "4200000", status: "paid", label: "Formation cadres Ecobank — Lot 1" },
      { client: c4!, project: null, ref: "HC-FAC-2026-0005", date: "2026-05-20", due: "2026-06-19", amount: "9500000", paid: "0", status: "pending", label: "Conseil actuariat & tarification — GTA Assurances" },
    ];
    let inserted = 0;
    for (const inv of invoiceSpecs) {
      if (!inv.client) continue;
      const existing = await db.select({ id: invoicesTable.id }).from(invoicesTable)
        .where(and(eq(invoicesTable.organizationId, ORG_ID), eq(invoicesTable.referenceNumber, inv.ref))).limit(1);
      if (existing[0]) continue;
      await db.insert(invoicesTable).values({
        organizationId: ORG_ID,
        referenceNumber: inv.ref,
        clientId: inv.client.id,
        projectId: inv.project?.id ?? null,
        status: inv.status,
        invoiceDate: inv.date,
        dueDate: inv.due,
        totalAmount: inv.amount,
        paidAmount: inv.paid,
        remainingAmount: String(parseFloat(inv.amount) - parseFloat(inv.paid)),
        currency: "XOF",
        taxRate: "18",
        taxAmount: String(Math.round(parseFloat(inv.amount) * 0.18 / 1.18)),
        notes: inv.label,
      } as any).catch(() => {});
      inserted++;
    }

    // Proformas
    if (allClients[5] || allClients[6]) {
      await db.insert(proformasTable).values([
        { organizationId: ORG_ID, referenceNumber: "HC-PRO-2026-0001", clientId: (allClients[5] ?? allClients[0])!.id, status: "sent", proformaDate: "2026-05-10", validUntil: "2026-06-10", totalAmount: "12000000", taxAmount: "1830508", currency: "XOF", notes: "Intégration SWIFT & Core Banking NSIA — devis initial" },
        { organizationId: ORG_ID, referenceNumber: "HC-PRO-2026-0002", clientId: (allClients[6] ?? allClients[1])!.id, status: "draft", proformaDate: "2026-06-01", validUntil: "2026-07-01", totalAmount: "7500000", taxAmount: "1144068", currency: "XOF", notes: "Audit & conseil digitalisation COFINA Togo" },
      ] as any).catch(() => {});
    }
    counts.invoices = inserted;
    counts.proformas = 2;
    log.push(`✓ ${inserted} factures + 2 proformas créés`);
  } else {
    log.push(`✓ Factures existantes (${invCountRow?.c})`);
  }

  // ── 12. Factures fournisseurs supplémentaires ─────────────────────────────
  const [siCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(supplierInvoicesTable).where(eq(supplierInvoicesTable.organizationId, ORG_ID));
  if ((siCountRow?.c ?? 0) < 5 && allSuppliers.length >= 3) {
    const [s0, s1, s2, s3] = allSuppliers;
    await db.insert(supplierInvoicesTable).values([
      { organizationId: ORG_ID, referenceNumber: "HC-FA-LOGITEK-0126", supplierId: s0!.id, status: "paid",    invoiceDate: D(2026,1,15), dueDate: D(2026,2,14), totalAmount: "3800000", paidAmount: "3800000", currency: "XOF", notes: "Fournitures matériel IT Q1 2026" },
      { organizationId: ORG_ID, referenceNumber: "HC-FA-CABINET-0226", supplierId: s1!.id, status: "paid",    invoiceDate: D(2026,2,10), dueDate: D(2026,3,12), totalAmount: "2100000", paidAmount: "2100000", currency: "XOF", notes: "Audit juridique contrats clients T1" },
      { organizationId: ORG_ID, referenceNumber: "HC-FA-PRINT-0326",   supplierId: s2!.id, status: "paid",    invoiceDate: D(2026,3,20), dueDate: D(2026,4,20), totalAmount: "850000",  paidAmount: "850000",  currency: "XOF", notes: "Impression documents commerciaux Q1" },
      { organizationId: ORG_ID, referenceNumber: "HC-FA-CANAL-0426",   supplierId: s3?.id ?? s0!.id, status: "pending", invoiceDate: D(2026,4,1),  dueDate: D(2026,5,1),  totalAmount: "420000",  paidAmount: "0", currency: "XOF", notes: "Abonnement CANAL+ Pro Avril 2026" },
      { organizationId: ORG_ID, referenceNumber: "HC-FA-TOTAL-0526",   supplierId: allSuppliers[4]?.id ?? s0!.id, status: "pending", invoiceDate: D(2026,5,31), dueDate: D(2026,6,30), totalAmount: "1250000", paidAmount: "0", currency: "XOF", notes: "Carburant flotte véhicules Mai 2026" },
    ] as any).catch(() => {});
    counts.supplierInvoices = 5;
    log.push("✓ 5 factures fournisseurs créées");
  } else {
    log.push(`✓ Factures fournisseurs existantes (${siCountRow?.c})`);
  }

  // ── 13. Conversations + messages ──────────────────────────────────────────
  const [convCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(conversationsTable).where(eq(conversationsTable.organizationId, ORG_ID));
  if ((convCountRow?.c ?? 0) < 3 && allUsers.length >= 2) {
    const [u0, u1, u2] = allUsers;
    const convSpecs = [
      { title: "[HC] Projet BSIC — Équipe Audit", isGroup: true },
      { title: "[HC] Direction — Communication interne", isGroup: true },
    ];
    for (const cs of convSpecs) {
      const [conv] = await db.insert(conversationsTable).values({
        organizationId: ORG_ID,
        title: cs.title,
        isGroup: cs.isGroup,
        createdById: u0?.id,
      } as any).returning().catch(() => [null]);
      if (!conv) continue;
      const participants = [u0, u1, u2].filter(Boolean).slice(0, 3);
      await db.insert(conversationParticipantsTable).values(
        participants.map(u => ({ conversationId: conv.id, userId: u!.id } as any))
      ).catch(() => {});
      // Messages de démo
      const msgTexts = [
        "Bonjour à tous, lancement du projet ce lundi. Merci de confirmer votre disponibilité.",
        "Confirmé de mon côté. J'ai préparé le plan de collecte des données SI.",
        "Je prépare les documents de cadrage pour l'atelier de lundi.",
        "Très bien ! N'oubliez pas d'apporter les accès aux serveurs pour l'audit technique.",
      ];
      for (let i = 0; i < msgTexts.length; i++) {
        const sender = participants[i % participants.length];
        if (!sender) continue;
        await db.insert(messagesTable).values({
          conversationId: conv.id,
          senderId: sender.id,
          body: msgTexts[i],
          kind: "text",
        } as any).catch(() => {});
      }
    }
    counts.conversations = convSpecs.length;
    log.push(`✓ ${convSpecs.length} conversations + messages créés`);
  } else {
    log.push(`✓ Conversations existantes (${convCountRow?.c})`);
  }

  // ── 14. Notifications ─────────────────────────────────────────────────────
  if (adminUser && (prCountRow?.c ?? 0) === 0) {
    const notifSpecs = [
      { title: "Facture en retard", body: "La facture HC-FAC-2026-0003 (ORABANK) est échue depuis 15 jours.", type: "alert" },
      { title: "Cycle de paie prêt", body: "Le cycle de paie Juin 2026 est disponible pour validation.", type: "info" },
      { title: "Prospect qualifié", body: "Pépé Gnanawoubou (MTN Togo) a été qualifié — opportunité à 25M FCFA.", type: "success" },
      { title: "Stock faible", body: "Article HC-LAPTOP-001 : stock actuel 6 pcs, seuil minimum 2.", type: "warning" },
      { title: "Ticket support ouvert", body: "Nouveau ticket client #SUP-042 : BSIC Togo — accès reporting.", type: "info" },
    ];
    await db.insert(notificationsTable).values(
      notifSpecs.map(n => ({
        organizationId: ORG_ID,
        userId: adminUser.id,
        title: n.title,
        body: n.body,
        type: n.type,
        isRead: false,
      } as any))
    ).catch(() => {});
    counts.notifications = notifSpecs.length;
    log.push(`✓ ${notifSpecs.length} notifications créées`);
  }

  // ── 15. Tickets support supplémentaires ──────────────────────────────────
  const [tickCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(ticketsTable).where(eq(ticketsTable.organizationId, ORG_ID));
  if ((tickCountRow?.c ?? 0) < 8) {
    const ticketSpecs = [
      { subject: "Accès refusé — module Comptabilité analytique", status: "open",     priority: "high",   category: "access" },
      { subject: "Export Excel budget vide — exercice 2026",      status: "in_progress", priority: "medium", category: "bug" },
      { subject: "Demande d'ajout d'un utilisateur Audit",        status: "resolved",  priority: "low",    category: "user_management" },
      { subject: "Synchronisation Kiosk — pointages manquants",   status: "open",      priority: "high",   category: "sync" },
    ];
    await db.insert(ticketsTable).values(
      ticketSpecs.map(t => ({
        organizationId: ORG_ID,
        subject: t.subject,
        description: `Détail du ticket : ${t.subject}. Signalé par un utilisateur Hissado Consulting.`,
        status: t.status,
        priority: t.priority,
        category: t.category,
        createdById: adminUser?.id ?? null,
      } as any))
    ).catch(() => {});
    counts.tickets = ticketSpecs.length;
    log.push(`✓ ${ticketSpecs.length} tickets support créés`);
  } else {
    log.push(`✓ Tickets existants (${tickCountRow?.c})`);
  }

  // ── 16. Opportunités CRM supplémentaires ─────────────────────────────────
  const [oppCountRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(opportunitiesTable).where(eq(opportunitiesTable.organizationId, ORG_ID));
  if ((oppCountRow?.c ?? 0) < 18 && allClients.length >= 4) {
    const oppSpecs = [
      { name: "Digitalisation RH — Togolaise des Eaux", value: "18000000", stage: "proposal", prob: 70, clientIdx: 7 },
      { name: "Plateforme recouvrement — COFINA Togo",  value: "12500000", stage: "qualified", prob: 50, clientIdx: 6 },
      { name: "Refonte portail web — GTA Assurances",   value: "8500000",  stage: "lead",      prob: 25, clientIdx: 4 },
    ];
    const addedOpps = oppSpecs.filter(o => o.clientIdx < allClients.length);
    if (addedOpps.length > 0) {
      await db.insert(opportunitiesTable).values(
        addedOpps.map(o => ({
          organizationId: ORG_ID,
          name: o.name,
          value: o.value,
          stage: o.stage,
          probability: o.prob,
          clientId: allClients[o.clientIdx]!.id,
          expectedCloseDate: D(2026, 9, 30),
          assignedToId: adminUser?.id ?? null,
        } as any))
      ).catch(() => {});
      counts.opportunities = addedOpps.length;
      log.push(`✓ ${addedOpps.length} opportunités CRM ajoutées`);
    }
  } else {
    log.push(`✓ Opportunités CRM existantes (${oppCountRow?.c})`);
  }

  // ── 17. Template de pointage secteur Consulting ──────────────────────────
  const [attRow] = await db.select({ organizationId: orgAttendanceSettingsTable.organizationId })
    .from(orgAttendanceSettingsTable)
    .where(eq(orgAttendanceSettingsTable.organizationId, ORG_ID))
    .limit(1);
  if (!attRow) {
    await db.insert(orgAttendanceSettingsTable).values({
      organizationId: ORG_ID,
      sector: "consulting",
      expectedDailyMinutes: 480,
      lateThresholdMinutes: 15,
      requireGps: true,
      requirePhoto: false,
      trackByProject: true,
      trackBySite: false,
      allowOvertime: true,
    });
    log.push("✓ Template pointage secteur Consulting créé");
  } else {
    log.push("✓ Template pointage déjà existant");
  }

  return {
    success: true,
    organizationId: ORG_ID,
    log,
    counts,
  };
}
