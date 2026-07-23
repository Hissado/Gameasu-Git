/**
 * Rattrapage comptable (audit P1) — re-poste les opérations métier émises
 * AVANT le branchement systématique du moteur d'écritures :
 *   - factures clients émises (status ≠ draft/cancelled) sans écriture ;
 *   - paiements clients confirmés sans écriture ;
 *   - factures fournisseurs (status ≠ draft/cancelled) sans écriture ;
 *   - paiements fournisseurs sans écriture ;
 *   - cycles de paie validés/payés sans écriture.
 *
 * SÛRETÉ :
 *   - Idempotent : chaque hook de comptabilisation ignore les opérations déjà
 *     écriturées (index unique sourceType+sourceId) — ré-exécutable sans risque.
 *   - Mode SIMULATION par défaut : n'écrit rien, liste ce qui serait posté.
 *     Passer `--apply` pour écrire réellement.
 *   - Les échecs unitaires (exercice manquant, montants incohérents…) sont
 *     collectés et rapportés sans interrompre le lot.
 *
 * Exécution (préproduction d'abord — phase 0 de l'audit) :
 *   pnpm --filter @workspace/api-server run backfill:postings           # simulation
 *   pnpm --filter @workspace/api-server run backfill:postings -- --apply
 */
import { db } from "@workspace/db";
import {
  invoicesTable,
  paymentsTable,
  supplierInvoicesTable,
  supplierPaymentsTable,
  payrollRunsTable,
  journalEntriesTable,
} from "@workspace/db";
import { and, eq, sql, notInArray, inArray } from "drizzle-orm";
import {
  postCustomerInvoice,
  postCustomerPayment,
  postSupplierInvoice,
  postSupplierPayment,
  postPayrollRun,
} from "../services/postings";

const APPLY = process.argv.includes("--apply");

type Failure = { kind: string; id: string; ref: string | null; error: string };

async function missingSources(kind: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ sourceId: journalEntriesTable.sourceId })
    .from(journalEntriesTable)
    .where(and(
      eq(journalEntriesTable.sourceType, kind),
      inArray(journalEntriesTable.sourceId, ids),
      sql`${journalEntriesTable.status} <> 'reversed'`,
    ));
  const posted = new Set(rows.map((r) => r.sourceId as string));
  return new Set(ids.filter((id) => !posted.has(id)));
}

async function main() {
  console.log(APPLY
    ? "Mode APPLICATION — les écritures manquantes vont être créées.\n"
    : "Mode SIMULATION — aucune écriture ne sera créée (utiliser --apply).\n");

  const failures: Failure[] = [];
  let planned = 0, posted = 0;

  // ── 1. Factures clients émises ──────────────────────────────────────────
  const invoices = await db.select({
    id: invoicesTable.id, ref: invoicesTable.referenceNumber,
    orgId: invoicesTable.organizationId, total: invoicesTable.totalAmount,
  }).from(invoicesTable).where(notInArray(invoicesTable.status, ["draft", "cancelled"]));
  const invMissing = await missingSources("invoice", invoices.map((i) => i.id));
  for (const inv of invoices) {
    if (!invMissing.has(inv.id) || Number(inv.total ?? 0) <= 0) continue;
    planned++;
    console.log(`  facture client   ${inv.ref}`);
    if (!APPLY) continue;
    try { await postCustomerInvoice(inv.orgId, inv.id); posted++; }
    catch (e: any) { failures.push({ kind: "invoice", id: inv.id, ref: inv.ref, error: e.message }); }
  }

  // ── 2. Paiements clients confirmés ──────────────────────────────────────
  const payments = await db.select({
    id: paymentsTable.id, ref: paymentsTable.reference,
    orgId: paymentsTable.organizationId, status: paymentsTable.transactionStatus,
  }).from(paymentsTable).where(eq(paymentsTable.transactionStatus, "confirmed"));
  const payMissing = await missingSources("payment", payments.map((p) => p.id));
  for (const pay of payments) {
    if (!payMissing.has(pay.id)) continue;
    planned++;
    console.log(`  encaissement     ${pay.ref ?? pay.id}`);
    if (!APPLY) continue;
    try { await postCustomerPayment(pay.orgId, pay.id); posted++; }
    catch (e: any) { failures.push({ kind: "payment", id: pay.id, ref: pay.ref, error: e.message }); }
  }

  // ── 3. Factures fournisseurs ────────────────────────────────────────────
  const sInvoices = await db.select({
    id: supplierInvoicesTable.id, ref: supplierInvoicesTable.referenceNumber,
    orgId: supplierInvoicesTable.organizationId, total: supplierInvoicesTable.totalAmount,
  }).from(supplierInvoicesTable).where(notInArray(supplierInvoicesTable.status, ["draft", "cancelled"]));
  const sInvMissing = await missingSources("supplier_invoice", sInvoices.map((i) => i.id));
  for (const sInv of sInvoices) {
    if (!sInvMissing.has(sInv.id) || Number(sInv.total ?? 0) <= 0) continue;
    planned++;
    console.log(`  facture fourn.   ${sInv.ref}`);
    if (!APPLY) continue;
    try { await postSupplierInvoice(sInv.orgId, sInv.id); posted++; }
    catch (e: any) { failures.push({ kind: "supplier_invoice", id: sInv.id, ref: sInv.ref, error: e.message }); }
  }

  // ── 4. Paiements fournisseurs ───────────────────────────────────────────
  const sPayments = await db.select({
    id: supplierPaymentsTable.id, ref: supplierPaymentsTable.reference,
    orgId: supplierPaymentsTable.organizationId,
  }).from(supplierPaymentsTable);
  const sPayMissing = await missingSources("supplier_payment", sPayments.map((p) => p.id));
  for (const sp of sPayments) {
    if (!sPayMissing.has(sp.id)) continue;
    planned++;
    console.log(`  paiement fourn.  ${sp.ref ?? sp.id}`);
    if (!APPLY) continue;
    try { await postSupplierPayment(sp.orgId, sp.id); posted++; }
    catch (e: any) { failures.push({ kind: "supplier_payment", id: sp.id, ref: sp.ref, error: e.message }); }
  }

  // ── 5. Cycles de paie validés / payés ───────────────────────────────────
  const runs = await db.select({
    id: payrollRunsTable.id, period: payrollRunsTable.period,
    orgId: payrollRunsTable.organizationId, gross: payrollRunsTable.totalGrossSalary,
  }).from(payrollRunsTable).where(inArray(payrollRunsTable.status, ["validated", "paid"]));
  const runMissing = await missingSources("payroll_run", runs.map((r) => r.id));
  for (const run of runs) {
    if (!runMissing.has(run.id) || Number(run.gross ?? 0) <= 0) continue;
    planned++;
    console.log(`  cycle de paie    ${run.period}`);
    if (!APPLY) continue;
    try { await postPayrollRun(run.orgId, run.id); posted++; }
    catch (e: any) { failures.push({ kind: "payroll_run", id: run.id, ref: run.period, error: e.message }); }
  }

  // ── Bilan ────────────────────────────────────────────────────────────────
  console.log(`\n${planned} opération(s) sans écriture détectée(s).`);
  if (APPLY) {
    console.log(`${posted} écriture(s) créée(s), ${failures.length} échec(s).`);
    for (const f of failures) console.error(`  ✘ ${f.kind} ${f.ref ?? f.id} : ${f.error}`);
    if (failures.length > 0) process.exit(1);
  } else if (planned > 0) {
    console.log("Relancer avec --apply pour créer ces écritures (préproduction d'abord).");
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
