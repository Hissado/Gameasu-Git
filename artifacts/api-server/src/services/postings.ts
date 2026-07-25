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
  payrollRunsTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { getCurrentFiscalPeriod } from "./syscohada-seed";
import { getAccountCodeMap } from "./account-mapping";

/**
 * Garantit l'existence d'un compte du plan comptable pour l'organisation
 * (idempotent). Utilisé pour les comptes ajoutés après le seed initial
 * (ex. 4471/4472) afin que les organisations existantes ne bloquent pas.
 */
async function ensureAccount(
  tx: any,
  organizationId: string,
  account: { code: string; label: string; classNum: number; type: string; normalBalance: string },
): Promise<void> {
  const existing = await tx.select({ id: chartOfAccountsTable.id }).from(chartOfAccountsTable).where(and(
    eq(chartOfAccountsTable.organizationId, organizationId),
    eq(chartOfAccountsTable.code, account.code),
  )).limit(1);
  if (existing[0]) return;
  await tx.insert(chartOfAccountsTable).values({
    organizationId,
    code: account.code,
    label: account.label,
    classNum: account.classNum,
    type: account.type,
    normalBalance: account.normalBalance,
    isPostable: true,
  });
}

/**
 * Service de comptabilisation automatique (génération d'écritures en partie double).
 * Multi-tenant strict : chaque écriture est scopée à une `organizationId`.
 * L'orgId est dérivé automatiquement depuis l'entité métier source
 * (invoice, supplierInvoice…) pour rester transparent côté routes.
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

async function resolveAccountId(tx: any, organizationId: string, code?: string, id?: string): Promise<string> {
  if (id) {
    const owned = await tx.select({ id: chartOfAccountsTable.id }).from(chartOfAccountsTable).where(and(
      eq(chartOfAccountsTable.organizationId, organizationId),
      eq(chartOfAccountsTable.id, id),
    )).limit(1);
    if (!owned[0]) throw new Error(`Compte SYSCOHADA introuvable pour cette organisation : ${id}`);
    return owned[0].id;
  }
  if (!code) throw new Error("Compte requis (code ou id)");
  const acc = await tx.select().from(chartOfAccountsTable).where(and(
    eq(chartOfAccountsTable.organizationId, organizationId),
    eq(chartOfAccountsTable.code, code),
  )).limit(1);
  if (!acc[0]) throw new Error(`Compte SYSCOHADA introuvable : ${code}`);
  return acc[0].id;
}

function lockKey(s: string): bigint {
  let h = 5381n;
  for (let i = 0; i < s.length; i++) h = ((h * 33n) ^ BigInt(s.charCodeAt(i))) & 0xffffffffffffffffn;
  const max = 1n << 63n;
  return h >= max ? h - (1n << 64n) : h;
}

type PostEntryOpts = {
  organizationId: string;
  journalCode: string;
  entryDate: string;
  reference?: string | null;
  description?: string;
  sourceType?: string;
  sourceId?: string;
  createdById?: string;
  lines: LineSpec[];
};

/** Comptabilise une écriture en ouvrant sa propre transaction. */
export async function postEntry(opts: PostEntryOpts) {
  return db.transaction((tx) => postEntryTx(tx, opts));
}

/** Variante transaction-aware : à utiliser quand l'appelant fournit déjà un `tx`
 *  pour garantir l'atomicité avec d'autres écritures (ex : encaissement d'un
 *  règlement qui doit rester cohérent avec la mise à jour du solde de la facture). */
export async function postEntryTx(tx: any, opts: PostEntryOpts) {
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

    if (opts.sourceType && opts.sourceId) {
      const existing = await tx
        .select()
        .from(journalEntriesTable)
        .where(and(
          eq(journalEntriesTable.organizationId, opts.organizationId),
          eq(journalEntriesTable.sourceType, opts.sourceType),
          eq(journalEntriesTable.sourceId, opts.sourceId),
          sql`${journalEntriesTable.status} <> 'reversed'`,
        ))
        .limit(1);
      if (existing[0]) return existing[0];
    }

    const period = await getCurrentFiscalPeriod(opts.organizationId, opts.entryDate);
    if (!period) throw new Error(`Aucun exercice fiscal ne couvre la date ${opts.entryDate}.`);
    if (period.status === "closed") throw new Error(`Exercice clôturé : écriture refusée.`);

    const journalRows = await tx.select().from(journalsTable).where(and(
      eq(journalsTable.organizationId, opts.organizationId),
      eq(journalsTable.code, opts.journalCode),
    )).limit(1);
    if (!journalRows[0]) throw new Error(`Journal introuvable : ${opts.journalCode}`);
    const journal = journalRows[0];

    const year = opts.entryDate.slice(0, 4);
    const key = lockKey(`entry-num:${opts.organizationId}:${journal.code}:${year}`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${key.toString()}::bigint)`);

    const prefix = `${journal.code}-${year}-`;
    const cnt = await tx
      .select({ n: sql<string>`COUNT(*)` })
      .from(journalEntriesTable)
      .where(and(
        eq(journalEntriesTable.organizationId, opts.organizationId),
        sql`${journalEntriesTable.entryNumber} LIKE ${prefix + "%"}`,
      ));
    const entryNumber = `${prefix}${String(Number(cnt[0]?.n ?? 0) + 1).padStart(4, "0")}`;

    const resolvedLines: Array<LineSpec & { accountId: string; debit: number; credit: number }> = [];
    for (const l of opts.lines) {
      const accountId = await resolveAccountId(tx, opts.organizationId, l.accountCode, l.accountId);
      resolvedLines.push({ ...l, accountId, debit: Number(l.debit ?? 0), credit: Number(l.credit ?? 0) });
    }

    const [entry] = await tx
      .insert(journalEntriesTable)
      .values({
        organizationId: opts.organizationId,
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
        organizationId: opts.organizationId,
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
}

export async function reverseEntry(organizationId: string, entryId: string, userId?: string) {
  return db.transaction(async (tx) => {
    const orig = (await tx.select().from(journalEntriesTable).where(and(
      eq(journalEntriesTable.organizationId, organizationId),
      eq(journalEntriesTable.id, entryId),
    )).limit(1))[0];
    if (!orig) throw new Error("Écriture introuvable");
    if (orig.status === "reversed") throw new Error("Écriture déjà extournée");

    const lines = await tx.select().from(journalEntryLinesTable).where(eq(journalEntryLinesTable.entryId, entryId));
    const journal = (await tx.select().from(journalsTable).where(and(
      eq(journalsTable.organizationId, organizationId),
      eq(journalsTable.id, orig.journalId),
    )).limit(1))[0];

    await tx
      .update(journalEntriesTable)
      .set({ status: "reversed" })
      .where(and(
        eq(journalEntriesTable.organizationId, organizationId),
        eq(journalEntriesTable.id, entryId),
      ));

    const period = await getCurrentFiscalPeriod(orig.organizationId, new Date().toISOString().slice(0, 10));
    if (!period) throw new Error("Aucun exercice fiscal ouvert pour la contre-passation.");
    if (period.status === "closed") throw new Error(`Exercice clôturé.`);

    const year = new Date().getFullYear().toString();
    const key = lockKey(`entry-num:${orig.organizationId}:${journal.code}:${year}`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${key.toString()}::bigint)`);
    const prefix = `${journal.code}-${year}-`;
    const cnt = await tx
      .select({ n: sql<string>`COUNT(*)` })
      .from(journalEntriesTable)
      .where(and(
        eq(journalEntriesTable.organizationId, orig.organizationId),
        sql`${journalEntriesTable.entryNumber} LIKE ${prefix + "%"}`,
      ));
    const entryNumber = `${prefix}${String(Number(cnt[0]?.n ?? 0) + 1).padStart(4, "0")}`;

    const totalDebit = lines.reduce((s, l) => s + Number(l.credit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.debit), 0);

    const [reversal] = await tx
      .insert(journalEntriesTable)
      .values({
        organizationId: orig.organizationId,
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
        organizationId: orig.organizationId,
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
      .where(and(
        eq(journalEntriesTable.organizationId, organizationId),
        eq(journalEntriesTable.id, entryId),
      ));

    return reversal;
  });
}

// ────────────────────────────────────────────────────────────────
// HOOKS MÉTIER → ÉCRITURES AUTOMATIQUES (orgId dérivé de l'entité)
// ────────────────────────────────────────────────────────────────

export async function postCustomerInvoice(organizationId: string, invoiceId: string, userId?: string, tx?: any) {
  const exec = tx ?? db;
  const inv = (await exec.select().from(invoicesTable).where(and(
    eq(invoicesTable.organizationId, organizationId),
    eq(invoicesTable.id, invoiceId),
  )).limit(1))[0];
  if (!inv) throw new Error("Facture introuvable");
  const amount = Number(inv.totalAmount ?? 0); // TTC
  if (amount <= 0) return null;

  // TVA (audit P0.1) : si la facture porte une TVA, l'écriture éclate
  //   Débit 411 TTC / Crédit 706 HT / Crédit 4431 TVA facturée.
  // Sans TVA renseignée (factures historiques), comportement inchangé.
  const taxAmount = Number(inv.taxAmount ?? 0);
  const subtotal = Number(inv.subtotalAmount ?? 0) || (amount - taxAmount);
  if (taxAmount > 0 && Math.abs(subtotal + taxAmount - amount) > 1) {
    throw new Error(
      `Facture ${inv.referenceNumber} incohérente : HT ${subtotal} + TVA ${taxAmount} ≠ TTC ${amount}`,
    );
  }

  const M = await getAccountCodeMap(inv.organizationId, exec);
  const entryOpts: PostEntryOpts = {
    organizationId: inv.organizationId,
    journalCode: "VTE",
    entryDate: inv.issuedAt ?? new Date().toISOString().slice(0, 10),
    reference: inv.referenceNumber,
    description: `Facture ${inv.referenceNumber}`,
    sourceType: "invoice",
    sourceId: inv.id,
    createdById: userId,
    lines: taxAmount > 0
      ? [
          { accountCode: M.sales_client, debit: amount, thirdPartyType: "client", thirdPartyId: inv.clientId ?? undefined, description: "Client (TTC)" },
          { accountCode: M.sales_revenue, credit: amount - taxAmount, description: "Prestations de services (HT)" },
          { accountCode: M.sales_vat_collected, credit: taxAmount, description: "TVA facturée" },
        ]
      : [
          { accountCode: M.sales_client, debit: amount, thirdPartyType: "client", thirdPartyId: inv.clientId ?? undefined, description: "Client" },
          { accountCode: M.sales_revenue, credit: amount, description: "Prestations de services" },
        ],
  };
  return tx ? postEntryTx(tx, entryOpts) : postEntry(entryOpts);
}

export async function postCustomerPayment(organizationId: string, paymentId: string, opts: { bankAccountId?: string; userId?: string; tx?: any } = {}) {
  const exec = opts.tx ?? db;
  const pay = (await exec.select().from(paymentsTable).where(and(
    eq(paymentsTable.organizationId, organizationId),
    eq(paymentsTable.id, paymentId),
  )).limit(1))[0];
  if (!pay) throw new Error("Paiement introuvable");
  const amount = Number(pay.amount);
  const inv = (await exec.select().from(invoicesTable).where(and(
    eq(invoicesTable.organizationId, organizationId),
    eq(invoicesTable.id, pay.invoiceId),
  )).limit(1))[0];

  const M = await getAccountCodeMap(organizationId, exec);
  let treasuryCode = pay.method === "cash" ? M.treasury_cash : M.treasury_bank;
  let journalCode = pay.method === "cash" ? "CAI" : "BNQ";
  if (opts.bankAccountId) {
    const bank = (await exec.select().from(bankAccountsTable).where(and(
      eq(bankAccountsTable.organizationId, organizationId),
      eq(bankAccountsTable.id, opts.bankAccountId),
    )).limit(1))[0];
    if (bank) {
      const acc = (await exec.select().from(chartOfAccountsTable).where(and(
        eq(chartOfAccountsTable.organizationId, organizationId),
        eq(chartOfAccountsTable.id, bank.accountId),
      )).limit(1))[0];
      if (acc) {
        treasuryCode = acc.code;
        journalCode = bank.type === "cash" ? "CAI" : "BNQ";
      }
    }
  }

  const dateStr = (pay.paidAt ?? pay.createdAt ?? new Date()).toISOString().slice(0, 10);

  const entryOpts: PostEntryOpts = {
    organizationId: pay.organizationId,
    journalCode,
    entryDate: dateStr,
    reference: pay.reference || inv?.referenceNumber,
    description: `Règlement ${inv?.referenceNumber ?? ""}`.trim(),
    sourceType: "payment",
    sourceId: pay.id,
    createdById: opts.userId,
    lines: [
      { accountCode: treasuryCode, debit: amount, description: "Encaissement" },
      { accountCode: M.sales_client, credit: amount, thirdPartyType: "client", thirdPartyId: inv?.clientId ?? undefined, description: "Client" },
    ],
  };
  return opts.tx ? postEntryTx(opts.tx, entryOpts) : postEntry(entryOpts);
}

export async function postSupplierInvoice(organizationId: string, supplierInvoiceId: string, userId?: string) {
  const sInv = (await db.select().from(supplierInvoicesTable).where(and(
    eq(supplierInvoicesTable.organizationId, organizationId),
    eq(supplierInvoicesTable.id, supplierInvoiceId),
  )).limit(1))[0];
  if (!sInv) throw new Error("Facture fournisseur introuvable");
  const amount = Number(sInv.totalAmount);
  if (amount <= 0) return null;

  const M = await getAccountCodeMap(sInv.organizationId);

  let expenseAccountId = sInv.expenseAccountId;
  if (!expenseAccountId) {
    const fallback = (await db.select().from(chartOfAccountsTable).where(and(
      eq(chartOfAccountsTable.organizationId, sInv.organizationId),
      eq(chartOfAccountsTable.code, M.purchase_expense_default),
    )).limit(1))[0];
    if (!fallback) throw new Error("Compte de charge par défaut introuvable");
    expenseAccountId = fallback.id;
  }

  // TVA déductible (audit P0.3) : la charge est comptabilisée HT et la TVA
  // récupérable au compte mappé (défaut 4452). `taxAmount` existe déjà.
  const taxAmount = Math.min(Math.max(Number(sInv.taxAmount ?? 0), 0), amount);

  return postEntry({
    organizationId: sInv.organizationId,
    journalCode: "ACH",
    entryDate: sInv.invoiceDate,
    reference: sInv.referenceNumber,
    description: `Facture fournisseur ${sInv.referenceNumber}`,
    sourceType: "supplier_invoice",
    sourceId: sInv.id,
    createdById: userId,
    lines: taxAmount > 0
      ? [
          { accountId: expenseAccountId, debit: amount - taxAmount, projectId: sInv.projectId ?? undefined, description: "Charge (HT)" },
          { accountCode: M.purchase_vat_deductible, debit: taxAmount, description: "TVA récupérable sur achats" },
          { accountCode: M.purchase_supplier, credit: amount, thirdPartyType: "supplier", thirdPartyId: sInv.supplierId, description: "Fournisseur (TTC)" },
        ]
      : [
          { accountId: expenseAccountId, debit: amount, projectId: sInv.projectId ?? undefined, description: "Charge" },
          { accountCode: M.purchase_supplier, credit: amount, thirdPartyType: "supplier", thirdPartyId: sInv.supplierId, description: "Fournisseur" },
        ],
  });
}

export async function postSupplierPayment(organizationId: string, paymentId: string, userId?: string) {
  const pay = (await db.select().from(supplierPaymentsTable).where(and(
    eq(supplierPaymentsTable.organizationId, organizationId),
    eq(supplierPaymentsTable.id, paymentId),
  )).limit(1))[0];
  if (!pay) throw new Error("Paiement fournisseur introuvable");
  const amount = Number(pay.amount);
  const sInv = (await db.select().from(supplierInvoicesTable).where(and(
    eq(supplierInvoicesTable.organizationId, organizationId),
    eq(supplierInvoicesTable.id, pay.supplierInvoiceId),
  )).limit(1))[0];

  const M = await getAccountCodeMap(organizationId);
  let treasuryCode = pay.method === "cash" ? M.treasury_cash : M.treasury_bank;
  let journalCode = pay.method === "cash" ? "CAI" : "BNQ";
  if (pay.bankAccountId) {
    const bank = (await db.select().from(bankAccountsTable).where(and(
      eq(bankAccountsTable.organizationId, organizationId),
      eq(bankAccountsTable.id, pay.bankAccountId),
    )).limit(1))[0];
    if (bank) {
      const acc = (await db.select().from(chartOfAccountsTable).where(and(
        eq(chartOfAccountsTable.organizationId, organizationId),
        eq(chartOfAccountsTable.id, bank.accountId),
      )).limit(1))[0];
      if (acc) {
        treasuryCode = acc.code;
        journalCode = bank.type === "cash" ? "CAI" : "BNQ";
      }
    }
  }

  return postEntry({
    organizationId: pay.organizationId,
    journalCode,
    entryDate: pay.paidAt.toISOString().slice(0, 10),
    reference: pay.reference || sInv?.referenceNumber,
    description: `Règlement fournisseur ${sInv?.referenceNumber ?? ""}`.trim(),
    sourceType: "supplier_payment",
    sourceId: pay.id,
    createdById: userId,
    lines: [
      { accountCode: M.purchase_supplier, debit: amount, thirdPartyType: "supplier", thirdPartyId: sInv?.supplierId, description: "Fournisseur" },
      { accountCode: treasuryCode, credit: amount, description: "Décaissement" },
    ],
  });
}

/**
 * Comptabilise un cycle de paie VALIDÉ en partie double (audit P0.1/P0.3).
 *
 * Écriture générée (journal OD, idempotente par sourceType=payroll_run) :
 *   Débit  661  Rémunérations directes        = total brut
 *   Débit  664  Charges sociales (patronales) = CNSS patronal
 *   Crédit 421  Personnel - rémunérations dues = total net
 *   Crédit 431  Sécurité sociale               = CNSS salarié + patronal
 *   Crédit 4471 État - IRPP retenu à la source = total IRPP
 *   Crédit 4472 État - IPTS retenu à la source = total IPTS (si non nul)
 *
 * Équilibre garanti par construction : brut + patronal
 *   = net + (CNSS sal + pat) + IRPP + IPTS  (identité du bulletin).
 * `postEntryTx` re-vérifie l'équilibre et rejette tout écart.
 */
export async function postPayrollRun(
  organizationId: string,
  payrollRunId: string,
  userId?: string,
  tx?: any,
) {
  const exec = tx ?? db;
  const run = (await exec.select().from(payrollRunsTable).where(and(
    eq(payrollRunsTable.organizationId, organizationId),
    eq(payrollRunsTable.id, payrollRunId),
  )).limit(1))[0];
  if (!run) throw new Error("Cycle de paie introuvable");

  const gross = Number(run.totalGrossSalary ?? 0);
  const cnssEmployee = Number(run.totalCnssEmployee ?? 0);
  const cnssEmployer = Number(run.totalCnssEmployer ?? 0);
  const irpp = Number(run.totalIrpp ?? 0);
  const ipts = Number(run.totalIpts ?? 0);
  const net = Number(run.totalNetSalary ?? 0);
  if (gross <= 0) return null;

  const M = await getAccountCodeMap(organizationId, exec);
  const doPost = async (t: any) => {
    await ensureAccount(t, organizationId, { code: M.payroll_income_tax_irpp, label: "État - IRPP retenu à la source", classNum: 4, type: "liability", normalBalance: "credit" });
    if (ipts > 0) {
      await ensureAccount(t, organizationId, { code: M.payroll_income_tax_ipts, label: "État - IPTS retenu à la source", classNum: 4, type: "liability", normalBalance: "credit" });
    }
    return postEntryTx(t, {
      organizationId,
      journalCode: "OD",
      entryDate: run.paymentDate ?? new Date().toISOString().slice(0, 10),
      reference: `PAIE-${run.period}`,
      description: `Paie ${run.period} (${run.employeeCount ?? 0} collaborateur(s))`,
      sourceType: "payroll_run",
      sourceId: run.id,
      createdById: userId,
      lines: [
        { accountCode: M.payroll_gross, debit: gross, description: "Salaires bruts" },
        ...(cnssEmployer > 0 ? [{ accountCode: M.payroll_employer_charges, debit: cnssEmployer, description: "Charges sociales patronales" }] : []),
        { accountCode: M.payroll_net, credit: net, description: "Net à payer au personnel" },
        ...(cnssEmployee + cnssEmployer > 0 ? [{ accountCode: M.payroll_social, credit: cnssEmployee + cnssEmployer, description: "CNSS (parts salariale et patronale)" }] : []),
        ...(irpp > 0 ? [{ accountCode: M.payroll_income_tax_irpp, credit: irpp, description: "IRPP retenu à la source" }] : []),
        ...(ipts > 0 ? [{ accountCode: M.payroll_income_tax_ipts, credit: ipts, description: "IPTS retenu à la source" }] : []),
      ],
    });
  };

  return tx ? doPost(tx) : db.transaction(doPost);
}

/**
 * Comptabilise une note de frais APPROUVÉE (audit P1) :
 *   Débit  618 Divers frais (voyages et déplacements) = montant
 *   Crédit 421 Personnel - rémunérations dues         = montant
 * La dette envers le collaborateur est soldée par postExpensePayment.
 */
export async function postExpenseReport(
  organizationId: string,
  expense: { id: string; title: string; totalAmount: number; approvedAt?: Date | null },
  userId?: string,
  tx?: any,
) {
  const amount = Number(expense.totalAmount ?? 0);
  if (amount <= 0) return null;
  const M = await getAccountCodeMap(organizationId);
  const doPost = async (t: any) => {
    await ensureAccount(t, organizationId, { code: M.expense_report, label: "Divers frais (voyages et déplacements)", classNum: 6, type: "expense", normalBalance: "debit" });
    return postEntryTx(t, {
      organizationId,
      journalCode: "OD",
      entryDate: (expense.approvedAt ?? new Date()).toISOString().slice(0, 10),
      reference: expense.title,
      description: `Note de frais approuvée : ${expense.title}`,
      sourceType: "expense_report",
      sourceId: expense.id,
      createdById: userId,
      lines: [
        { accountCode: M.expense_report, debit: amount, description: "Frais professionnels" },
        { accountCode: M.payroll_net, credit: amount, description: "Dette envers le collaborateur" },
      ],
    });
  };
  return tx ? doPost(tx) : db.transaction(doPost);
}

/**
 * Comptabilise le REMBOURSEMENT d'une note de frais :
 *   Débit  421 Personnel        / Crédit 521 Banque (ou 571 Caisse)
 */
export async function postExpensePayment(
  organizationId: string,
  expense: { id: string; title: string; totalAmount: number },
  opts: { method?: "bank" | "cash"; userId?: string; tx?: any } = {},
) {
  const amount = Number(expense.totalAmount ?? 0);
  if (amount <= 0) return null;
  const M = await getAccountCodeMap(organizationId, opts.tx ?? db);
  const treasuryCode = opts.method === "cash" ? M.treasury_cash : M.treasury_bank;
  const journalCode = opts.method === "cash" ? "CAI" : "BNQ";
  const entryOpts: PostEntryOpts = {
    organizationId,
    journalCode,
    entryDate: new Date().toISOString().slice(0, 10),
    reference: expense.title,
    description: `Remboursement note de frais : ${expense.title}`,
    sourceType: "expense_report_payment",
    sourceId: expense.id,
    createdById: opts.userId,
    lines: [
      { accountCode: M.payroll_net, debit: amount, description: "Solde de la dette collaborateur" },
      { accountCode: treasuryCode, credit: amount, description: "Décaissement" },
    ],
  };
  return opts.tx ? postEntryTx(opts.tx, entryOpts) : postEntry(entryOpts);
}

export async function postAmortization(opts: {
  organizationId: string;
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
    organizationId: opts.organizationId,
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
