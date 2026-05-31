/**
 * Seed démo Comptabilité — Gaméasù
 *
 * Ajoute ce qui manque pour avoir un jeu de données démo complet :
 *  - Exercice fiscal 2026 (créé si absent)
 *  - 5 journaux DEMO (créés si absents)
 *  - 2 comptes bancaires (créés si absents)
 *  - 7 fournisseurs (créés si absents)
 *  - 5 centres de coût (créés si absents)
 *  - 5 immobilisations (créées si absentes)
 *  - Écritures mensuelles DEMO Jan–Mai 2026 (préfixe DEMO- pour éviter conflits)
 *  - Budget FP&A 2026 complet 18 comptes × 12 mois (créé si absent)
 *
 * Idempotent : chaque section vérifie sa propre présence avant insertion.
 * Lancement :
 *   cd lib/db && pnpm exec tsx src/seed-demo-accounting.ts
 */

import { db } from "./index";
import { eq, and, sql } from "drizzle-orm";
import {
  organizationsTable,
  chartOfAccountsTable,
  fiscalPeriodsTable,
  journalsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  bankAccountsTable,
  suppliersTable,
  supplierInvoicesTable,
  costCentersTable,
  fixedAssetsTable,
  budgetsTable,
  budgetLinesTable,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const D = (yyyy: number, mm: number, dd: number) =>
  `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

async function createEntry(
  orgId: string,
  journalId: string,
  periodId: string,
  num: string,
  date: string,
  desc: string,
  lines: Array<{ accountId: string; debit?: number; credit?: number; desc?: string }>,
  status = "posted"
) {
  const totalDebit  = lines.reduce((s, l) => s + (l.debit  ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const [entry] = await db.insert(journalEntriesTable).values({
    organizationId: orgId,
    journalId,
    fiscalPeriodId: periodId,
    entryNumber: num,
    entryDate: date,
    description: desc,
    status,
    totalDebit:  totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
    postedAt: status === "posted" ? new Date(`${date}T10:00:00Z`) : undefined,
  }).returning().catch(() => [null]);
  if (!entry) return;
  await db.insert(journalEntryLinesTable).values(
    lines.map((l, i) => ({
      organizationId: orgId,
      entryId: entry.id,
      accountId: l.accountId,
      debit:  (l.debit  ?? 0).toFixed(2),
      credit: (l.credit ?? 0).toFixed(2),
      description: l.desc ?? desc,
      position: i,
    }))
  ).catch(() => {});
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function seedDemoAccounting() {
  console.log("→ Seed comptabilité démo démarré…");

  // 1. Organisation
  const [org] = await db.select().from(organizationsTable)
    .where(eq(organizationsTable.slug, "nexora-demo")).limit(1);
  if (!org) { console.log("  ✗ Org nexora-demo introuvable — skip"); return; }
  const orgId = org.id;

  // 2. Plan comptable
  const accounts = await db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code })
    .from(chartOfAccountsTable).where(eq(chartOfAccountsTable.organizationId, orgId));
  if (accounts.length === 0) {
    console.log("  ✗ Plan comptable vide — démarrez l'API server puis relancez."); return;
  }
  const byCode: Record<string, string> = {};
  for (const a of accounts) byCode[a.code] = a.id;
  const acc    = (code: string) => { if (!byCode[code]) throw new Error(`Compte ${code} manquant`); return byCode[code]!; };
  const accOpt = (code: string): string | null => byCode[code] ?? null;
  console.log(`  • Plan comptable : ${accounts.length} comptes`);

  // 3. Exercice fiscal 2026 — créer si absent
  let [period] = await db.select().from(fiscalPeriodsTable)
    .where(eq(fiscalPeriodsTable.organizationId, orgId)).limit(1);
  if (!period) {
    [period] = await db.insert(fiscalPeriodsTable).values({
      organizationId: orgId, name: "Exercice 2026",
      startDate: "2026-01-01", endDate: "2026-12-31", status: "open",
    }).returning();
    console.log("  • Exercice fiscal 2026 créé");
  } else {
    console.log("  ✓ Exercice fiscal existant :", period.name);
  }

  // 4. Journaux — créer si absents
  const existingJournals = await db.select().from(journalsTable)
    .where(eq(journalsTable.organizationId, orgId));
  const jByCode: Record<string, typeof existingJournals[0]> = {};
  for (const j of existingJournals) jByCode[j.code] = j;

  const ensureJournal = async (code: string, label: string, type: string) => {
    if (jByCode[code]) return jByCode[code]!;
    const [j] = await db.insert(journalsTable).values({ organizationId: orgId, code, label, type }).returning().catch(() => [null]);
    if (j) { jByCode[code] = j; return j; }
    const [existing] = await db.select().from(journalsTable).where(and(eq(journalsTable.organizationId, orgId), eq(journalsTable.code, code))).limit(1);
    return existing!;
  };
  const jVTE = await ensureJournal("VTE", "Journal des ventes",       "sales");
  const jACH = await ensureJournal("ACH", "Journal des achats",       "purchase");
  const jBNQ = await ensureJournal("BNQ", "Journal banque SGBC",      "bank");
  await ensureJournal("CAI", "Journal de caisse", "cash");
  const jOD  = await ensureJournal("OD",  "Opérations diverses",      "misc");
  console.log("  ✓ Journaux :", Object.keys(jByCode).join(", "));

  // 5. Comptes bancaires — créer si absents
  const existingBanks = await db.select({ c: sql<number>`count(*)::int` })
    .from(bankAccountsTable).where(eq(bankAccountsTable.organizationId, orgId));
  if (existingBanks[0]!.c === 0) {
    await db.insert(bankAccountsTable).values([
      { organizationId: orgId, name: "SGBC — Compte courant professionnel", type: "bank", bankName: "Société Générale de Banques au Cameroun", accountNumber: "TG53 TG05 9062 6001 6250 6401 45", accountId: acc("521"), currency: "XOF", openingBalance: "8500000" },
      { organizationId: orgId, name: "Caisse siège — Lomé Agbalépédogan",   type: "cash", accountId: acc("571"), currency: "XOF", openingBalance: "850000" },
    ]).catch(() => {});
    console.log("  • Comptes bancaires créés (2)");
  } else {
    console.log(`  ✓ Comptes bancaires existants (${existingBanks[0]!.c})`);
  }

  // 6. Fournisseurs — créer si absents
  const suppCount = await db.select({ c: sql<number>`count(*)::int` })
    .from(suppliersTable).where(eq(suppliersTable.organizationId, orgId));
  let suppliers: Array<{ id: string }> = [];
  if (suppCount[0]!.c < 5) {
    suppliers = await db.insert(suppliersTable).values([
      { organizationId: orgId, code: "F001", name: "SOLTRANS SARL",               email: "contact@soltrans.tg",       paymentTerms: "30j", isActive: true },
      { organizationId: orgId, code: "F002", name: "GIE Maintenance Pro",          email: "pro@maintenancepro.tg",    paymentTerms: "15j", isActive: true },
      { organizationId: orgId, code: "F003", name: "SOGEBA Immobilier",            email: "loyer@sogeba.tg",           paymentTerms: "30j", isActive: true },
      { organizationId: orgId, code: "F004", name: "Orange Togo Pro",              email: "b2b@orange.tg",             paymentTerms: "30j", isActive: true },
      { organizationId: orgId, code: "F005", name: "STAR National Assurances",     email: "pro@star-assurances.tg",   paymentTerms: "30j", isActive: true },
      { organizationId: orgId, code: "F006", name: "Sahel Matériaux SARL",         email: "ventes@sahelmateriaux.tg", paymentTerms: "15j", isActive: true },
      { organizationId: orgId, code: "F007", name: "Lomé Bancaire & Crédit (LBC)", email: "credit@lbc.tg",            paymentTerms: "fin de mois", isActive: true },
    ]).returning().catch(() => []);
    console.log(`  • Fournisseurs créés (${suppliers.length})`);
  } else {
    suppliers = await db.select({ id: suppliersTable.id }).from(suppliersTable).where(eq(suppliersTable.organizationId, orgId)).limit(7);
    console.log(`  ✓ Fournisseurs existants (${suppCount[0]!.c})`);
  }

  // 7. Centres de coût — créer si absents
  const ccCount = await db.select({ c: sql<number>`count(*)::int` })
    .from(costCentersTable).where(eq(costCentersTable.organizationId, orgId));
  if (ccCount[0]!.c === 0) {
    await db.insert(costCentersTable).values([
      { organizationId: orgId, code: "CC-TECH", name: "Département Technique",          type: "department", color: "#0EA5E9", budgetAmount: "75000000"  },
      { organizationId: orgId, code: "CC-OPS",  name: "Opérations & Chantier",          type: "department", color: "#10B981", budgetAmount: "95000000"  },
      { organizationId: orgId, code: "CC-ADM",  name: "Administration & Finance",        type: "department", color: "#64748B", budgetAmount: "42000000"  },
      { organizationId: orgId, code: "CC-COM",  name: "Commercial & Marketing",          type: "department", color: "#A855F7", budgetAmount: "25000000"  },
      { organizationId: orgId, code: "CC-LOG",  name: "Logistique & Approvisionnement",  type: "department", color: "#F59E0B", budgetAmount: "18000000"  },
    ]).catch(() => {});
    console.log("  • Centres de coût créés (5)");
  } else {
    console.log(`  ✓ Centres de coût existants (${ccCount[0]!.c})`);
  }

  // 8. Immobilisations — créer si absentes
  const assetsCount = await db.select({ c: sql<number>`count(*)::int` })
    .from(fixedAssetsTable).where(eq(fixedAssetsTable.organizationId, orgId));
  if (assetsCount[0]!.c < 3) {
    const a241  = accOpt("241");
    const a2441 = accOpt("2441") ?? accOpt("244");
    const a2841 = accOpt("2841") ?? accOpt("2844") ?? accOpt("2845");
    const a681  = accOpt("681");
    if (a241 && a2841 && a681) {
      await db.insert(fixedAssetsTable).values([
        { organizationId: orgId, code: "IMM-001", label: "Grue mobile Liebherr LTM 1090-4.2", category: "Matériel technique", accountId: a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2022-03-15", acquisitionCost: "185000000", residualValue: "15000000", depreciationMethod: "linear", usefulLifeYears: 10, status: "active" },
        { organizationId: orgId, code: "IMM-002", label: "Groupe électrogène FG Wilson P250", category: "Matériel technique", accountId: a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2023-07-01", acquisitionCost: "32000000", residualValue: "2000000", depreciationMethod: "linear", usefulLifeYears: 8, status: "active" },
        { organizationId: orgId, code: "IMM-003", label: "Camion-benne Mercedes Actros 3345", category: "Matériel de transport", accountId: a2441 ?? a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2021-01-20", acquisitionCost: "48000000", residualValue: "4000000", depreciationMethod: "linear", usefulLifeYears: 7, status: "active" },
        { organizationId: orgId, code: "IMM-004", label: "Pick-up Toyota Hilux 4×4",         category: "Véhicule de service",   accountId: a2441 ?? a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2023-11-05", acquisitionCost: "17500000", residualValue: "1500000", depreciationMethod: "linear", usefulLifeYears: 5, status: "active" },
        { organizationId: orgId, code: "IMM-005", label: "Compresseur Atlas Copco XAS 97",  category: "Matériel technique", accountId: a241, depreciationAccountId: a2841, expenseAccountId: a681, acquisitionDate: "2024-02-28", acquisitionCost: "9800000", residualValue: "800000", depreciationMethod: "linear", usefulLifeYears: 6, status: "active" },
      ]).catch(() => {});
      console.log("  • Immobilisations créées (5)");
    }
  } else {
    console.log(`  ✓ Immobilisations existantes (${assetsCount[0]!.c})`);
  }

  // 9. Écritures mensuelles DEMO — uniquement si absentes (préfixe DEMO-VTE-)
  const demoEntryMarker = "DEMO-VTE-2026-0001";
  const demoExists = await db.select({ id: journalEntriesTable.id })
    .from(journalEntriesTable)
    .where(and(
      eq(journalEntriesTable.organizationId, orgId),
      eq(journalEntriesTable.entryNumber, demoEntryMarker)
    )).limit(1);

  if (demoExists.length > 0) {
    console.log("  ✓ Écritures mensuelles DEMO déjà présentes — skip");
  } else {
    console.log("  • Création des écritures mensuelles DEMO Jan–Mai 2026…");

    // 707 = Ventes de marchandises (disponible), 706 = Prestations de services
    const months = [
      { mm: "01", label: "Janvier",  rev706: 34_500_000, rev707: 7_500_000,  sal661: 12_400_000, sal664: 2_280_000, loyer622: 1_800_000, assur625: 950_000, tel628: 420_000, imp641: 780_000, ach601: 2_500_000, ach604: 1_750_000, ach605: 2_200_000, trans611: 1_180_000, trans614: 480_000, maint624: 1_450_000, pub627: 1_750_000, bank631: 175_000, int671: 620_000 },
      { mm: "02", label: "Février",  rev706: 31_200_000, rev707: 7_300_000,  sal661: 12_400_000, sal664: 2_280_000, loyer622: 1_800_000, assur625: 950_000, tel628: 390_000, imp641: 760_000, ach601: 2_200_000, ach604: 1_520_000, ach605: 1_980_000, trans611: 1_020_000, trans614: 450_000, maint624: 1_180_000, pub627: 2_180_000, bank631: 160_000, int671: 620_000 },
      { mm: "03", label: "Mars",     rev706: 43_800_000, rev707: 11_200_000, sal661: 13_200_000, sal664: 2_429_000, loyer622: 1_800_000, assur625: 950_000, tel628: 450_000, imp641: 830_000, ach601: 4_750_000, ach604: 2_480_000, ach605: 2_820_000, trans611: 2_180_000, trans614: 580_000, maint624: 2_450_000, pub627: 2_820_000, bank631: 185_000, int671: 620_000 },
      { mm: "04", label: "Avril",    rev706: 51_000_000, rev707: 12_000_000, sal661: 13_200_000, sal664: 2_429_000, loyer622: 1_800_000, assur625: 950_000, tel628: 470_000, imp641: 890_000, ach601: 5_480_000, ach604: 3_120_000, ach605: 3_450_000, trans611: 2_780_000, trans614: 620_000, maint624: 2_980_000, pub627: 3_450_000, bank631: 190_000, int671: 620_000 },
      { mm: "05", label: "Mai",      rev706: 38_200_000, rev707: 8_800_000,  sal661: 13_200_000, sal664: 2_429_000, loyer622: 1_800_000, assur625: 950_000, tel628: 430_000, imp641: 810_000, ach601: 3_780_000, ach604: 2_020_000, ach605: 2_560_000, trans611: 1_800_000, trans614: 550_000, maint624: 1_980_000, pub627: 2_500_000, bank631: 170_000, int671: 620_000 },
    ] as const;

    let seq = 1;
    const num = (j: string) => `DEMO-${j}-2026-${String(seq++).padStart(4, "0")}`;

    for (const m of months) {
      const yyyy = 2026;
      const mm   = parseInt(m.mm);
      const d1   = D(yyyy, mm, 1);
      const d10  = D(yyyy, mm, 10);
      const d15  = D(yyyy, mm, 15);
      const d28  = D(yyyy, mm, 28);

      // Revenue
      await createEntry(orgId, jVTE.id, period.id, num("VTE"), d1,
        `Prestations services ${m.label} 2026 (agrégé démo)`,
        [
          { accountId: acc("411"), debit:  m.rev706 + m.rev707 },
          { accountId: acc("706"), credit: m.rev706 },
          { accountId: acc("707"), credit: m.rev707 },
        ]);

      // Encaissements clients 80%
      const encaiss = Math.round((m.rev706 + m.rev707) * 0.80);
      await createEntry(orgId, jBNQ.id, period.id, num("BNQ"), d15,
        `Encaissements clients ${m.label} 2026`,
        [{ accountId: acc("521"), debit: encaiss }, { accountId: acc("411"), credit: encaiss }]);

      // Masse salariale
      const masseS = m.sal661 + m.sal664;
      await createEntry(orgId, jOD.id, period.id, num("OD"), d28,
        `Masse salariale ${m.label} 2026`,
        [
          { accountId: acc("661"), debit:  m.sal661 },
          { accountId: acc("664"), debit:  m.sal664 },
          { accountId: acc("421"), credit: masseS },
        ]);

      // Paiement salaires
      await createEntry(orgId, jBNQ.id, period.id, num("BNQ"), d28,
        `Paiement salaires ${m.label} 2026`,
        [{ accountId: acc("421"), debit: masseS }, { accountId: acc("521"), credit: masseS }]);

      // Loyer
      await createEntry(orgId, jACH.id, period.id, num("ACH"), d1,
        `Loyer ${m.label} 2026`,
        [{ accountId: acc("622"), debit: m.loyer622 }, { accountId: acc("401"), credit: m.loyer622 }]);

      // Assurance
      await createEntry(orgId, jACH.id, period.id, num("ACH"), d1,
        `Assurance ${m.label} 2026`,
        [{ accountId: acc("625"), debit: m.assur625 }, { accountId: acc("401"), credit: m.assur625 }]);

      // Télécom
      await createEntry(orgId, jACH.id, period.id, num("ACH"), d1,
        `Télécommunications ${m.label} 2026`,
        [{ accountId: acc("628"), debit: m.tel628 }, { accountId: acc("401"), credit: m.tel628 }]);

      // Impôts
      await createEntry(orgId, jBNQ.id, period.id, num("BNQ"), d10,
        `Impôts & taxes ${m.label} 2026`,
        [{ accountId: acc("641"), debit: m.imp641 }, { accountId: acc("521"), credit: m.imp641 }]);

      // Achats matières
      const totalAch = m.ach601 + m.ach604 + m.ach605;
      await createEntry(orgId, jACH.id, period.id, num("ACH"), d15,
        `Achats matières & fournitures ${m.label} 2026`,
        [
          { accountId: acc("601"), debit:  m.ach601 },
          { accountId: acc("604"), debit:  m.ach604 },
          { accountId: acc("605"), debit:  m.ach605 },
          { accountId: acc("401"), credit: totalAch },
        ]);

      // Transports
      const totalTrans = m.trans611 + m.trans614;
      await createEntry(orgId, jACH.id, period.id, num("ACH"), d15,
        `Transports ${m.label} 2026`,
        [
          { accountId: acc("611"), debit:  m.trans611 },
          { accountId: acc("614"), debit:  m.trans614 },
          { accountId: acc("401"), credit: totalTrans },
        ]);

      // Maintenance
      await createEntry(orgId, jACH.id, period.id, num("ACH"), d15,
        `Entretien & maintenance ${m.label} 2026`,
        [{ accountId: acc("624"), debit: m.maint624 }, { accountId: acc("401"), credit: m.maint624 }]);

      // Publicité
      await createEntry(orgId, jACH.id, period.id, num("ACH"), d1,
        `Publicité & communication ${m.label} 2026`,
        [{ accountId: acc("627"), debit: m.pub627 }, { accountId: acc("401"), credit: m.pub627 }]);

      // Frais bancaires
      await createEntry(orgId, jBNQ.id, period.id, num("BNQ"), d28,
        `Frais bancaires ${m.label} 2026`,
        [{ accountId: acc("631"), debit: m.bank631 }, { accountId: acc("521"), credit: m.bank631 }]);

      // Intérêts emprunt
      await createEntry(orgId, jBNQ.id, period.id, num("BNQ"), d28,
        `Intérêts emprunt ${m.label} 2026`,
        [{ accountId: acc("671"), debit: m.int671 }, { accountId: acc("521"), credit: m.int671 }]);

      // Règlement fournisseurs 65%
      const totalFourn = m.loyer622 + m.assur625 + m.tel628 + m.ach601 + m.ach604 + m.ach605 + m.trans611 + m.trans614 + m.maint624 + m.pub627;
      const paidFourn = Math.round(totalFourn * 0.65);
      await createEntry(orgId, jBNQ.id, period.id, num("BNQ"), d28,
        `Règlements fournisseurs ${m.label} 2026`,
        [{ accountId: acc("401"), debit: paidFourn }, { accountId: acc("521"), credit: paidFourn }]);
    }
    console.log(`  • ${seq - 1} écritures DEMO créées (5 mois × 15)`);
  }

  // 10. Factures fournisseurs — créer si absentes
  const siCount = await db.select({ c: sql<number>`count(*)::int` })
    .from(supplierInvoicesTable).where(eq(supplierInvoicesTable.organizationId, orgId));
  if (siCount[0]!.c < 5 && suppliers.length >= 5) {
    const [s1, s2, s3, s4, s5] = suppliers.slice(0, 5);
    await db.insert(supplierInvoicesTable).values([
      { organizationId: orgId, referenceNumber: "DEMO-FA-SOLTRANS-0126", supplierId: s1!.id, status: "paid",    invoiceDate: D(2026,1,15), dueDate: D(2026,2,14), totalAmount: "2500000",  paidAmount: "2500000",  currency: "XOF" },
      { organizationId: orgId, referenceNumber: "DEMO-FA-MAINPRO-0126",  supplierId: s2!.id, status: "paid",    invoiceDate: D(2026,1,28), dueDate: D(2026,2,12), totalAmount: "1450000",  paidAmount: "1450000",  currency: "XOF" },
      { organizationId: orgId, referenceNumber: "DEMO-FA-SOGEBA-0226",   supplierId: s3!.id, status: "paid",    invoiceDate: D(2026,2, 1), dueDate: D(2026,3, 1), totalAmount: "1800000",  paidAmount: "1800000",  currency: "XOF" },
      { organizationId: orgId, referenceNumber: "DEMO-FA-MAINPRO-0426",  supplierId: s2!.id, status: "pending", invoiceDate: D(2026,4,25), dueDate: D(2026,5,10), totalAmount: "2980000",  paidAmount: "0",        currency: "XOF" },
      { organizationId: orgId, referenceNumber: "DEMO-FA-SOGEBA-0526",   supplierId: s3!.id, status: "pending", invoiceDate: D(2026,5, 1), dueDate: D(2026,6, 1), totalAmount: "1800000",  paidAmount: "0",        currency: "XOF" },
    ]).catch(() => {});
    console.log("  • Factures fournisseurs DEMO créées (5)");
  }

  // 11. Budget FP&A 2026 complet — créer si < 180 lignes
  const existingBl = await db.select({ c: sql<number>`count(*)::int` })
    .from(budgetLinesTable)
    .where(and(
      eq(budgetLinesTable.organizationId, orgId),
      sql`${budgetLinesTable.period} LIKE '2026-%'`
    ));

  if (existingBl[0]!.c >= 180) {
    console.log(`  ✓ Budget FP&A complet déjà présent (${existingBl[0]!.c} lignes)`);
  } else {
    // Récupérer ou créer un budget "Annuel 2026"
    let [budget] = await db.select().from(budgetsTable)
      .where(and(
        eq(budgetsTable.organizationId, orgId),
        eq(budgetsTable.scope, "company"),
        eq(budgetsTable.kind, "budget"),
        sql`${budgetsTable.status} = 'active'`
      )).limit(1);

    if (!budget) {
      [budget] = await db.insert(budgetsTable).values({
        organizationId: orgId, name: "Budget Annuel 2026 — Société",
        kind: "budget", fiscalPeriodId: period.id, scope: "company",
        versionNumber: 1, status: "active",
        notes: "Budget annuel approuvé par le CA le 28/12/2025",
      }).returning();
      console.log("  • Nouveau budget FP&A annuel créé");
    } else {
      console.log(`  • Complétion budget "${budget.name}" (${existingBl[0]!.c} → 216 lignes)`);
    }

    const bLines = [
      { code: "706", j: 38_000_000, f: 40_000_000, m: 55_000_000, a: 62_000_000, may: 50_000_000, r: 52_000_000 },
      { code: "707", j:  8_500_000, f:  9_000_000, m: 12_000_000, a: 14_000_000, may: 11_000_000, r: 11_000_000 },
      { code: "601", j:  3_000_000, f:  2_800_000, m:  5_500_000, a:  6_000_000, may:  4_500_000, r:  4_200_000 },
      { code: "604", j:  2_000_000, f:  1_800_000, m:  3_000_000, a:  3_500_000, may:  2_500_000, r:  2_300_000 },
      { code: "605", j:  2_500_000, f:  2_300_000, m:  3_200_000, a:  3_800_000, may:  3_000_000, r:  2_800_000 },
      { code: "611", j:  1_300_000, f:  1_200_000, m:  2_500_000, a:  3_000_000, may:  2_000_000, r:  1_900_000 },
      { code: "614", j:    550_000, f:    500_000, m:    650_000, a:    700_000, may:    600_000, r:    580_000 },
      { code: "622", j:  1_800_000, f:  1_800_000, m:  1_800_000, a:  1_800_000, may:  1_800_000, r:  1_800_000 },
      { code: "624", j:  1_600_000, f:  1_500_000, m:  2_800_000, a:  3_200_000, may:  2_200_000, r:  2_000_000 },
      { code: "625", j:    950_000, f:    950_000, m:    950_000, a:    950_000, may:    950_000, r:    950_000 },
      { code: "627", j:  2_000_000, f:  2_500_000, m:  3_200_000, a:  4_000_000, may:  3_000_000, r:  2_500_000 },
      { code: "628", j:    450_000, f:    450_000, m:    450_000, a:    450_000, may:    450_000, r:    450_000 },
      { code: "631", j:    180_000, f:    180_000, m:    180_000, a:    180_000, may:    180_000, r:    180_000 },
      { code: "641", j:    850_000, f:    820_000, m:    900_000, a:    950_000, may:    850_000, r:    870_000 },
      { code: "661", j: 13_200_000, f: 13_200_000, m: 13_200_000, a: 13_200_000, may: 13_200_000, r: 13_200_000 },
      { code: "664", j:  2_429_000, f:  2_429_000, m:  2_429_000, a:  2_429_000, may:  2_429_000, r:  2_429_000 },
      { code: "671", j:    620_000, f:    620_000, m:    620_000, a:    620_000, may:    620_000, r:    620_000 },
      ...(accOpt("681") ? [{ code: "681", j: 2_800_000, f: 2_800_000, m: 2_800_000, a: 2_800_000, may: 2_800_000, r: 2_800_000 }] : []),
    ];

    const periodsMap = [
      { period: "2026-01", val: (b: typeof bLines[0]) => b.j },
      { period: "2026-02", val: (b: typeof bLines[0]) => b.f },
      { period: "2026-03", val: (b: typeof bLines[0]) => b.m },
      { period: "2026-04", val: (b: typeof bLines[0]) => b.a },
      { period: "2026-05", val: (b: typeof bLines[0]) => b.may },
      { period: "2026-06", val: (b: typeof bLines[0]) => b.r },
      { period: "2026-07", val: (b: typeof bLines[0]) => b.r },
      { period: "2026-08", val: (b: typeof bLines[0]) => b.r },
      { period: "2026-09", val: (b: typeof bLines[0]) => b.r },
      { period: "2026-10", val: (b: typeof bLines[0]) => b.r },
      { period: "2026-11", val: (b: typeof bLines[0]) => b.r },
      { period: "2026-12", val: (b: typeof bLines[0]) => b.r },
    ];

    const toInsert = [];
    for (const p of periodsMap) {
      for (const bl of bLines) {
        if (!byCode[bl.code]) continue;
        toInsert.push({ organizationId: orgId, budgetId: budget.id, accountId: byCode[bl.code]!, period: p.period, amount: p.val(bl).toFixed(2) });
      }
    }
    for (let i = 0; i < toInsert.length; i += 50) {
      await db.insert(budgetLinesTable).values(toInsert.slice(i, i + 50))
        .onConflictDoNothing().catch(() => {});
    }
    console.log(`  • Budget : ${toInsert.length} lignes insérées (${bLines.length} comptes × 12 mois)`);
  }

  // Résumé
  const ytdRev = await db.execute(sql`
    SELECT COALESCE(SUM(jel.credit),0)::numeric AS total FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE jel.organization_id = ${orgId} AND je.status = 'posted' AND coa.class_num = 7 AND je.entry_date BETWEEN '2026-01-01' AND '2026-05-31'`);
  const ytdChg = await db.execute(sql`
    SELECT COALESCE(SUM(jel.debit),0)::numeric AS total FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE jel.organization_id = ${orgId} AND je.status = 'posted' AND coa.class_num = 6 AND je.entry_date BETWEEN '2026-01-01' AND '2026-05-31'`);

  const rev = parseFloat((ytdRev.rows[0] as any)?.total ?? "0");
  const chg = parseFloat((ytdChg.rows[0] as any)?.total ?? "0");
  console.log(`\n  📊 YTD Jan–Mai 2026`);
  console.log(`     Revenus  cl.7 : ${(rev/1e6).toFixed(1)} M FCFA`);
  console.log(`     Charges  cl.6 : ${(chg/1e6).toFixed(1)} M FCFA`);
  console.log(`     Résultat      : ${((rev-chg)/1e6).toFixed(1)} M FCFA (${rev > 0 ? ((rev-chg)/rev*100).toFixed(0) : "—"}%)`);

  console.log("\n✅ Seed comptabilité démo terminé !");
}

if (process.argv[1]?.endsWith("seed-demo-accounting.ts") ||
    process.argv[1]?.endsWith("seed-demo-accounting.js")) {
  seedDemoAccounting()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
