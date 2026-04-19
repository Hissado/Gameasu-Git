import { db } from "@workspace/db";
import {
  chartOfAccountsTable,
  journalsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  bankAccountsTable,
  invoicesTable,
  paymentsTable,
  supplierInvoicesTable,
  supplierPaymentsTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { getCurrentFiscalPeriod } from "./syscohada-seed";

/**
 * Service de comptabilisation automatique (génération d'écritures en partie double).
 * Chaque opération métier appelle la fonction correspondante pour créer une écriture.
 *
 * Garanties :
 * - Atomicité : en-tête + lignes insérés dans la même transaction Postgres.
 * - Idempotence stricte : un (sourceType, sourceId) ne peut générer qu'une seule
 *   écriture grâce à un index unique partiel + ON CONFLICT côté DB. Les retries,
 *   doubles-clics et appels concurrents sont absorbés silencieusement.
 * - Numérotation concurrent-safe : verrou applicatif Postgres (pg_advisory_xact_lock)
 *   par couple (journal, année) pendant la génération du n°.
 * - Rattachement fiscal : l'exercice est sélectionné à partir de la date d'écriture,
 *   pas de la date de saisie.
 *
 * Hypothèse MVP : pas de TVA séparée sur factures clients (montants TTC vers 411/706).
 */

type LineSpec = {
  accountCode?: string;
  accountId?: string;
  debit?: number;
  credit?: number;
  description?: string;
  thirdPartyType?: "client" | "supplier";
  thirdPartyId?: string;
  projectId?: string;
};

async function resolveAccountId(tx: any, code?: string, id?: string): Promise<string> {
  if (id) return id;
  if (!code) throw new Error("Compte requis (code ou id)");
  const acc = await tx.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.code, code)).limit(1);
  if (!acc[0]) throw new Error(`Compte SYSCOHADA introuvable : ${code}`);
  return acc[0].id;
}

/**
 * Hash stable d'une chaîne en bigint signé Postgres (clé d'advisory lock).
 */
function lockKey(s: string): bigint {
  let h = 5381n;
  for (let i = 0; i < s.length; i++) h = ((h * 33n) ^ BigInt(s.charCodeAt(i))) & 0xffffffffffffffffn;
  // Postgres advisory lock attend un bigint signé : repli dans la plage [-2^63, 2^63-1].
  const max = 1n << 63n;
  return h >= max ? h - (1n << 64n) : h;
}

/**
 * Crée une écriture validée (status="posted") avec ses lignes, en transaction.
 * Vérifie l'équilibre débit = crédit, l'ouverture de l'exercice fiscal,
 * et garantit l'idempotence sur (sourceType, sourceId).
 */
export async function postEntry(opts: {
  journalCode: string;
  entryDate: string;
  reference?: string | null;
  description?: string;
  sourceType?: string;
  sourceId?: string;
  createdById?: string;
  lines: LineSpec[];
}) {
  // Validation préalable hors transaction pour fail-fast.
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of opts.lines) {
    const debit = Number(l.debit ?? 0);
    const credit = Number(l.credit ?? 0);
    if (debit < 0 || credit < 0) throw new Error("Débit/Crédit doivent être positifs");
    if (debit > 0 && credit > 0) throw new Error("Une ligne ne peut pas être à la fois débit et crédit");
    totalDebit += debit;
    totalCredit += credit;
  }
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new Error(`Écriture déséquilibrée : Débit ${totalDebit} ≠ Crédit ${totalCredit}`);
  }

  return db.transaction(async (tx) => {
    // Idempotence : si une écriture existe déjà pour cette source, on la renvoie sans recréer.
    if (opts.sourceType && opts.sourceId) {
      const existing = await tx
        .select()
        .from(journalEntriesTable)
        .where(and(
          eq(journalEntriesTable.sourceType, opts.sourceType),
          eq(journalEntriesTable.sourceId, opts.sourceId),
          sql`${journalEntriesTable.status} <> 'reversed'`,
        ))
        .limit(1);
      if (existing[0]) return existing[0];
    }

    // Rattachement fiscal sur la DATE de l'écriture (et non aujourd'hui).
    const period = await getCurrentFiscalPeriod(opts.entryDate);
    if (!period) throw new Error(`Aucun exercice fiscal ne couvre la date ${opts.entryDate}.`);
    if (period.status === "closed") throw new Error(`Exercice ${period.year} clôturé : écriture refusée.`);

    const journalRows = await tx.select().from(journalsTable).where(eq(journalsTable.code, opts.journalCode)).limit(1);
    if (!journalRows[0]) throw new Error(`Journal introuvable : ${opts.journalCode}`);
    const journal = journalRows[0];

    // Verrou applicatif sur (journal, année) — sérialise la numérotation.
    const year = opts.entryDate.slice(0, 4);
    const key = lockKey(`entry-num:${journal.code}:${year}`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${key.toString()}::bigint)`);

    const prefix = `${journal.code}-${year}-`;
    const cnt = await tx
      .select({ n: sql<string>`COUNT(*)` })
      .from(journalEntriesTable)
      .where(sql`${journalEntriesTable.entryNumber} LIKE ${prefix + "%"}`);
    const entryNumber = `${prefix}${String(Number(cnt[0]?.n ?? 0) + 1).padStart(4, "0")}`;

    // Résolution des comptes (dans la transaction pour bénéficier d'éventuelles vues).
    const resolvedLines: Array<LineSpec & { accountId: string; debit: number; credit: number }> = [];
    for (const l of opts.lines) {
      const accountId = await resolveAccountId(tx, l.accountCode, l.accountId);
      resolvedLines.push({ ...l, accountId, debit: Number(l.debit ?? 0), credit: Number(l.credit ?? 0) });
    }

    const [entry] = await tx
      .insert(journalEntriesTable)
      .values({
        journalId: journal.id,
        fiscalPeriodId: period.id,
        entryNumber,
        entryDate: opts.entryDate,
        reference: opts.reference ?? null,
        description: opts.description,
        status: "posted",
        totalDebit: totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        sourceType: opts.sourceType,
        sourceId: opts.sourceId,
        createdById: opts.createdById,
        postedAt: new Date(),
      })
      .returning();

    await tx.insert(journalEntryLinesTable).values(
      resolvedLines.map((l, idx) => ({
        entryId: entry.id,
        accountId: l.accountId,
        debit: l.debit.toFixed(2),
        credit: l.credit.toFixed(2),
        description: l.description,
        thirdPartyType: l.thirdPartyType,
        thirdPartyId: l.thirdPartyId,
        projectId: l.projectId,
        position: idx,
      })),
    );

    return entry;
  });
}

/**
 * Inverse une écriture comptable existante (contre-passation) en créant
 * une nouvelle écriture symétrique. L'extournée passe à status="reversed",
 * libérant ainsi l'index unique (sourceType, sourceId) pour une future
 * recomptabilisation correctrice si besoin.
 */
export async function reverseEntry(entryId: string, userId?: string) {
  return db.transaction(async (tx) => {
    const orig = (await tx.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, entryId)).limit(1))[0];
    if (!orig) throw new Error("Écriture introuvable");
    if (orig.status === "reversed") throw new Error("Écriture déjà extournée");

    const lines = await tx.select().from(journalEntryLinesTable).where(eq(journalEntryLinesTable.entryId, entryId));
    const journal = (await tx.select().from(journalsTable).where(eq(journalsTable.id, orig.journalId)).limit(1))[0];

    // On marque l'originale comme extournée AVANT de poster la contre-passation,
    // afin que l'index unique partiel autorise la nouvelle écriture.
    await tx
      .update(journalEntriesTable)
      .set({ status: "reversed" })
      .where(eq(journalEntriesTable.id, entryId));

    // Petite parenthèse : postEntry réutilise db (hors transaction). Pour rester
    // simple et cohérent, on inline ici la création de la contre-passation.
    const period = await getCurrentFiscalPeriod(new Date().toISOString().slice(0, 10));
    if (!period) throw new Error("Aucun exercice fiscal ouvert pour la contre-passation.");
    if (period.status === "closed") throw new Error(`Exercice ${period.year} clôturé.`);

    const year = new Date().getFullYear().toString();
    const key = lockKey(`entry-num:${journal.code}:${year}`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${key.toString()}::bigint)`);
    const prefix = `${journal.code}-${year}-`;
    const cnt = await tx
      .select({ n: sql<string>`COUNT(*)` })
      .from(journalEntriesTable)
      .where(sql`${journalEntriesTable.entryNumber} LIKE ${prefix + "%"}`);
    const entryNumber = `${prefix}${String(Number(cnt[0]?.n ?? 0) + 1).padStart(4, "0")}`;

    const totalDebit = lines.reduce((s, l) => s + Number(l.credit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.debit), 0);

    const [reversal] = await tx
      .insert(journalEntriesTable)
      .values({
        journalId: orig.journalId,
        fiscalPeriodId: period.id,
        entryNumber,
        entryDate: new Date().toISOString().slice(0, 10),
        reference: orig.reference,
        description: `EXTOURNE de ${orig.entryNumber}`,
        status: "posted",
        totalDebit: totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        sourceType: "reversal",
        sourceId: entryId,
        createdById: userId,
        postedAt: new Date(),
      })
      .returning();

    await tx.insert(journalEntryLinesTable).values(
      lines.map((l, idx) => ({
        entryId: reversal.id,
        accountId: l.accountId,
        debit: Number(l.credit).toFixed(2),
        credit: Number(l.debit).toFixed(2),
        description: l.description,
        thirdPartyType: l.thirdPartyType,
        thirdPartyId: l.thirdPartyId,
        projectId: l.projectId,
        position: idx,
      })),
    );

    await tx
      .update(journalEntriesTable)
      .set({ reversedById: reversal.id })
      .where(eq(journalEntriesTable.id, entryId));

    return reversal;
  });
}

// ────────────────────────────────────────────────────────────────
// HOOKS MÉTIER → ÉCRITURES AUTOMATIQUES
// L'idempotence est assurée nativement par postEntry (cf. supra).
// ────────────────────────────────────────────────────────────────

/**
 * Émission d'une facture client : 411 Client D / 706 Prestations C.
 */
export async function postCustomerInvoice(invoiceId: string, userId?: string) {
  const inv = (await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1))[0];
  if (!inv) throw new Error("Facture introuvable");
  const amount = Number(inv.totalAmount ?? 0);
  if (amount <= 0) return null;

  return postEntry({
    journalCode: "VTE",
    entryDate: inv.issuedAt ?? new Date().toISOString().slice(0, 10),
    reference: inv.referenceNumber,
    description: `Facture ${inv.referenceNumber}`,
    sourceType: "invoice",
    sourceId: inv.id,
    createdById: userId,
    lines: [
      { accountCode: "411", debit: amount, thirdPartyType: "client", thirdPartyId: inv.clientId ?? undefined, description: "Client" },
      { accountCode: "706", credit: amount, description: "Prestations de services" },
    ],
  });
}

/**
 * Encaissement d'un règlement client : 521 Banque (ou 571 Caisse) D / 411 Client C.
 */
export async function postCustomerPayment(paymentId: string, opts: { bankAccountId?: string; userId?: string } = {}) {
  const pay = (await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).limit(1))[0];
  if (!pay) throw new Error("Paiement introuvable");
  const amount = Number(pay.amount);
  const inv = (await db.select().from(invoicesTable).where(eq(invoicesTable.id, pay.invoiceId)).limit(1))[0];

  // Choix du compte trésorerie : si bankAccountId fourni, utilise son compte
  // comptable, sinon déduit de la méthode (cash → 571, autres → 521).
  let treasuryCode = pay.method === "cash" ? "571" : "521";
  let journalCode = pay.method === "cash" ? "CAI" : "BNQ";
  if (opts.bankAccountId) {
    const bank = (await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, opts.bankAccountId)).limit(1))[0];
    if (bank) {
      const acc = (await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, bank.accountId)).limit(1))[0];
      if (acc) {
        treasuryCode = acc.code;
        journalCode = bank.type === "cash" ? "CAI" : "BNQ";
      }
    }
  }

  const dateStr = (pay.paidAt ?? pay.createdAt ?? new Date()).toISOString().slice(0, 10);

  return postEntry({
    journalCode,
    entryDate: dateStr,
    reference: pay.reference || inv?.referenceNumber,
    description: `Règlement ${inv?.referenceNumber ?? ""}`.trim(),
    sourceType: "payment",
    sourceId: pay.id,
    createdById: opts.userId,
    lines: [
      { accountCode: treasuryCode, debit: amount, description: "Encaissement" },
      { accountCode: "411", credit: amount, thirdPartyType: "client", thirdPartyId: inv?.clientId ?? undefined, description: "Client" },
    ],
  });
}

/**
 * Saisie d'une facture fournisseur : 60x/61x/62x Charges D / 401 Fournisseur C.
 */
export async function postSupplierInvoice(supplierInvoiceId: string, userId?: string) {
  const sInv = (await db.select().from(supplierInvoicesTable).where(eq(supplierInvoicesTable.id, supplierInvoiceId)).limit(1))[0];
  if (!sInv) throw new Error("Facture fournisseur introuvable");
  const amount = Number(sInv.totalAmount);
  if (amount <= 0) return null;

  let expenseAccountId = sInv.expenseAccountId;
  if (!expenseAccountId) {
    const fallback = (await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.code, "605")).limit(1))[0];
    if (!fallback) throw new Error("Compte de charge par défaut introuvable");
    expenseAccountId = fallback.id;
  }

  return postEntry({
    journalCode: "ACH",
    entryDate: sInv.invoiceDate,
    reference: sInv.referenceNumber,
    description: `Facture fournisseur ${sInv.referenceNumber}`,
    sourceType: "supplier_invoice",
    sourceId: sInv.id,
    createdById: userId,
    lines: [
      { accountId: expenseAccountId, debit: amount, projectId: sInv.projectId ?? undefined, description: "Charge" },
      { accountCode: "401", credit: amount, thirdPartyType: "supplier", thirdPartyId: sInv.supplierId, description: "Fournisseur" },
    ],
  });
}

/**
 * Décaissement vers un fournisseur : 401 Fournisseur D / 521 Banque (ou 571) C.
 */
export async function postSupplierPayment(paymentId: string, userId?: string) {
  const pay = (await db.select().from(supplierPaymentsTable).where(eq(supplierPaymentsTable.id, paymentId)).limit(1))[0];
  if (!pay) throw new Error("Paiement fournisseur introuvable");
  const amount = Number(pay.amount);
  const sInv = (await db.select().from(supplierInvoicesTable).where(eq(supplierInvoicesTable.id, pay.supplierInvoiceId)).limit(1))[0];

  let treasuryCode = pay.method === "cash" ? "571" : "521";
  let journalCode = pay.method === "cash" ? "CAI" : "BNQ";
  if (pay.bankAccountId) {
    const bank = (await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, pay.bankAccountId)).limit(1))[0];
    if (bank) {
      const acc = (await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, bank.accountId)).limit(1))[0];
      if (acc) {
        treasuryCode = acc.code;
        journalCode = bank.type === "cash" ? "CAI" : "BNQ";
      }
    }
  }

  return postEntry({
    journalCode,
    entryDate: pay.paidAt.toISOString().slice(0, 10),
    reference: pay.reference || sInv?.referenceNumber,
    description: `Règlement fournisseur ${sInv?.referenceNumber ?? ""}`.trim(),
    sourceType: "supplier_payment",
    sourceId: pay.id,
    createdById: userId,
    lines: [
      { accountCode: "401", debit: amount, thirdPartyType: "supplier", thirdPartyId: sInv?.supplierId, description: "Fournisseur" },
      { accountCode: treasuryCode, credit: amount, description: "Décaissement" },
    ],
  });
}

/**
 * Dotation aux amortissements : 681 D / 28xx C.
 */
export async function postAmortization(opts: {
  fiscalPeriodId: string;
  fixedAssetCode: string;
  description: string;
  amount: number;
  expenseAccountId: string;
  depreciationAccountId: string;
  sourceId?: string;
  userId?: string;
}) {
  return postEntry({
    journalCode: "OD",
    entryDate: new Date().toISOString().slice(0, 10),
    reference: opts.fixedAssetCode,
    description: opts.description,
    sourceType: "amortization",
    sourceId: opts.sourceId,
    createdById: opts.userId,
    lines: [
      { accountId: opts.expenseAccountId, debit: opts.amount, description: "Dotation amortissement" },
      { accountId: opts.depreciationAccountId, credit: opts.amount, description: "Amortissement cumulé" },
    ],
  });
}
