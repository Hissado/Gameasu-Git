/**
 * Script diagnostic — vérifie l'état des données démo dans la base.
 * Usage : cd lib/db && pnpm exec tsx src/check-demo-state.ts
 */
import { db } from "./index";
import { eq, sql } from "drizzle-orm";
import {
  organizationsTable,
  chartOfAccountsTable,
  fiscalPeriodsTable,
  journalsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  budgetsTable,
  budgetLinesTable,
  costCentersTable,
  suppliersTable,
  bankAccountsTable,
  fixedAssetsTable,
  departmentsTable,
  positionsTable,
  contractsTable,
  leaveRequestsTable,
  trainingSessionsTable,
  jobOffersTable,
  candidaciesTable,
  collaboratorsTable,
  productCategoriesTable,
  productsTable,
} from "./schema";

async function main() {
  const [org] = await db.select().from(organizationsTable)
    .where(eq(organizationsTable.slug, "nexora-demo")).limit(1);

  if (!org) { console.log("❌ Org nexora-demo introuvable"); process.exit(1); }

  console.log(`\n🏢 Organisation : ${org.name} (${org.id.slice(0, 8)}…)\n`);

  const cnt = async (table: any, cond?: any) => {
    const q = db.select({ c: sql<number>`count(*)::int` }).from(table);
    const [r] = cond ? await q.where(cond) : await q;
    return r.c;
  };

  const orgCond = (t: any) => eq(t.organizationId, org.id);

  const coa      = await cnt(chartOfAccountsTable, orgCond(chartOfAccountsTable));
  const periods  = await cnt(fiscalPeriodsTable,   orgCond(fiscalPeriodsTable));
  const journals = await cnt(journalsTable,         orgCond(journalsTable));
  const entries  = await cnt(journalEntriesTable,   orgCond(journalEntriesTable));
  const lines    = await cnt(journalEntryLinesTable, orgCond(journalEntryLinesTable));
  const budgets  = await cnt(budgetsTable,           orgCond(budgetsTable));
  const blines   = await cnt(budgetLinesTable,       orgCond(budgetLinesTable));
  const costCtrs = await cnt(costCentersTable,       orgCond(costCentersTable));
  const supps    = await cnt(suppliersTable,         orgCond(suppliersTable));
  const banks    = await cnt(bankAccountsTable,      orgCond(bankAccountsTable));
  const assets   = await cnt(fixedAssetsTable,       orgCond(fixedAssetsTable));
  const depts    = await cnt(departmentsTable,       orgCond(departmentsTable));
  const posits   = await cnt(positionsTable,         orgCond(positionsTable));
  const contrats = await cnt(contractsTable,         orgCond(contractsTable));
  const conges   = await cnt(leaveRequestsTable,     orgCond(leaveRequestsTable));
  const trainings= await cnt(trainingSessionsTable,  orgCond(trainingSessionsTable));
  const jobs     = await cnt(jobOffersTable,         orgCond(jobOffersTable));
  const candids  = await cnt(candidaciesTable,       orgCond(candidaciesTable));
  const collabs  = await cnt(collaboratorsTable,     orgCond(collaboratorsTable));
  const prodCats = await cnt(productCategoriesTable, orgCond(productCategoriesTable));
  const products = await cnt(productsTable,          orgCond(productsTable));

  console.log("── COMPTABILITÉ ──────────────────────────────");
  console.log(`  Plan comptable   : ${coa}      comptes SYSCOHADA`);
  console.log(`  Exercices        : ${periods}`);
  console.log(`  Journaux         : ${journals}`);
  console.log(`  Écritures        : ${entries}      (posted)`);
  console.log(`  Lignes écriture  : ${lines}`);
  console.log(`  Fournisseurs     : ${supps}`);
  console.log(`  Comptes bancaires: ${banks}`);
  console.log(`  Immobilisations  : ${assets}`);
  console.log("── FP&A ──────────────────────────────────────");
  console.log(`  Budgets          : ${budgets}`);
  console.log(`  Lignes budget    : ${blines}`);
  console.log(`  Centres de coût  : ${costCtrs}`);
  console.log("── RH ────────────────────────────────────────");
  console.log(`  Départements     : ${depts}`);
  console.log(`  Postes           : ${posits}`);
  console.log(`  Collaborateurs   : ${collabs}`);
  console.log(`  Contrats CDI     : ${contrats}`);
  console.log(`  Congés           : ${conges}`);
  console.log(`  Formations       : ${trainings}`);
  console.log(`  Offres emploi    : ${jobs}`);
  console.log(`  Candidatures     : ${candids}`);
  console.log("── STOCK / PRODUITS ──────────────────────────");
  console.log(`  Catégories       : ${prodCats}`);
  console.log(`  Produits         : ${products}`);

  // YTD Revenus classe 7
  const ytdRev = await db.execute(sql`
    SELECT COALESCE(SUM(jel.credit),0)::numeric AS total
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE jel.organization_id = ${org.id}
      AND je.status = 'posted'
      AND coa.class_num = 7
      AND je.entry_date BETWEEN '2026-01-01' AND '2026-05-31'
  `);
  const ytdChg = await db.execute(sql`
    SELECT COALESCE(SUM(jel.debit),0)::numeric AS total
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE jel.organization_id = ${org.id}
      AND je.status = 'posted'
      AND coa.class_num = 6
      AND je.entry_date BETWEEN '2026-01-01' AND '2026-05-31'
  `);

  const rev = parseFloat((ytdRev.rows[0] as any)?.total ?? "0");
  const chg = parseFloat((ytdChg.rows[0] as any)?.total ?? "0");

  console.log("\n── YTD Jan–Mai 2026 (live depuis journal) ────");
  console.log(`  Revenus  (cl.7)  : ${(rev / 1e6).toFixed(1)} M FCFA`);
  console.log(`  Charges  (cl.6)  : ${(chg / 1e6).toFixed(1)} M FCFA`);
  console.log(`  Résultat estimé  : ${((rev - chg) / 1e6).toFixed(1)} M FCFA`);
  console.log(`  Marge nette      : ${rev > 0 ? ((rev - chg) / rev * 100).toFixed(1) : "—"} %`);
  console.log();

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
