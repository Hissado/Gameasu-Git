import { Router } from "express";
import { db } from "@workspace/db";
import {
  chartOfAccountsTable,
  journalsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  fiscalPeriodsTable,
  bankAccountsTable,
  bankTransactionsTable,
  suppliersTable,
  supplierInvoicesTable,
  supplierPaymentsTable,
  fixedAssetsTable,
  amortizationsTable,
  invoicesTable,
  paymentsTable,
  clientsTable,
  projectsTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, lte, sql, isNull, like, or, inArray } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove, requireAdmin } from "../middlewares/auth";
import {
  postEntry,
  reverseEntry,
  postSupplierInvoice,
  postSupplierPayment,
  postAmortization,
} from "../services/postings";
import { getCurrentFiscalPeriod } from "../services/syscohada-seed";

const router = Router();

const toNum = (v: string | number | null | undefined): number => (v == null ? 0 : Number(v));

// ════════════════════════════════════════════════════════════════
// PLAN COMPTABLE
// ════════════════════════════════════════════════════════════════
router.get("/accounting/chart-of-accounts", async (req, res) => {
  const { search, classNum } = req.query as Record<string, string>;
  const conds = [eq(chartOfAccountsTable.isActive, true)];
  if (classNum) conds.push(eq(chartOfAccountsTable.classNum, parseInt(classNum)));
  if (search) {
    conds.push(or(
      like(chartOfAccountsTable.code, `%${search}%`),
      like(chartOfAccountsTable.label, `%${search}%`),
    )!);
  }
  const rows = await db.select().from(chartOfAccountsTable).where(and(...conds)).orderBy(asc(chartOfAccountsTable.code));
  return res.json({ data: rows });
});

router.post("/accounting/chart-of-accounts", requireAdmin, async (req, res) => {
  const { code, label, classNum, type, normalBalance, parentId, isPostable } = req.body;
  const [acc] = await db.insert(chartOfAccountsTable).values({
    code, label, classNum, type, normalBalance, parentId, isPostable: isPostable ?? true,
  }).returning();
  return res.status(201).json(acc);
});

router.put("/accounting/chart-of-accounts/:id", requireAdmin, async (req, res) => {
  const { label, isActive, isPostable, normalBalance, type } = req.body;
  const [acc] = await db.update(chartOfAccountsTable)
    .set({ label, isActive, isPostable, normalBalance, type })
    .where(eq(chartOfAccountsTable.id, req.params.id)).returning();
  if (!acc) return res.status(404).json({ error: "Compte introuvable" });
  return res.json(acc);
});

// ════════════════════════════════════════════════════════════════
// EXERCICES FISCAUX
// ════════════════════════════════════════════════════════════════
router.get("/accounting/fiscal-periods", async (_req, res) => {
  const rows = await db.select().from(fiscalPeriodsTable).orderBy(desc(fiscalPeriodsTable.startDate));
  return res.json({ data: rows });
});

router.post("/accounting/fiscal-periods", requireAdmin, async (req, res) => {
  const { name, startDate, endDate } = req.body;
  const [p] = await db.insert(fiscalPeriodsTable).values({ name, startDate, endDate, status: "open" }).returning();
  return res.status(201).json(p);
});

router.post("/accounting/fiscal-periods/:id/close", requireAdmin, async (req, res) => {
  const [p] = await db.update(fiscalPeriodsTable)
    .set({ status: "closed", closedAt: new Date(), closedById: req.authUser?.id })
    .where(eq(fiscalPeriodsTable.id, req.params.id)).returning();
  if (!p) return res.status(404).json({ error: "Exercice introuvable" });
  return res.json(p);
});

// ════════════════════════════════════════════════════════════════
// JOURNAUX
// ════════════════════════════════════════════════════════════════
router.get("/accounting/journals", async (_req, res) => {
  const rows = await db.select().from(journalsTable).where(eq(journalsTable.isActive, true)).orderBy(asc(journalsTable.code));
  return res.json({ data: rows });
});

// ════════════════════════════════════════════════════════════════
// ÉCRITURES COMPTABLES
// ════════════════════════════════════════════════════════════════
router.get("/accounting/entries", async (req, res) => {
  const { journalId, from, to, status, sourceType, page = "1", limit = "50" } = req.query as Record<string, string>;
  const conds = [];
  if (journalId) conds.push(eq(journalEntriesTable.journalId, journalId));
  if (status) conds.push(eq(journalEntriesTable.status, status));
  if (sourceType) conds.push(eq(journalEntriesTable.sourceType, sourceType));
  if (from) conds.push(gte(journalEntriesTable.entryDate, from));
  if (to) conds.push(lte(journalEntriesTable.entryDate, to));

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db
    .select({ entry: journalEntriesTable, journalCode: journalsTable.code, journalLabel: journalsTable.label })
    .from(journalEntriesTable)
    .leftJoin(journalsTable, eq(journalEntriesTable.journalId, journalsTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(journalEntriesTable.entryDate), desc(journalEntriesTable.entryNumber))
    .limit(limitNum).offset(offset);

  const totalRows = await db.select({ n: sql<string>`COUNT(*)` }).from(journalEntriesTable).where(conds.length ? and(...conds) : undefined);

  return res.json({
    data: rows.map((r) => ({
      ...r.entry,
      totalDebit: toNum(r.entry.totalDebit),
      totalCredit: toNum(r.entry.totalCredit),
      journalCode: r.journalCode,
      journalLabel: r.journalLabel,
    })),
    total: Number(totalRows[0]?.n ?? 0),
    page: pageNum, limit: limitNum,
  });
});

router.get("/accounting/entries/:id", async (req, res) => {
  const e = (await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, req.params.id)).limit(1))[0];
  if (!e) return res.status(404).json({ error: "Écriture introuvable" });
  const lines = await db
    .select({ line: journalEntryLinesTable, accountCode: chartOfAccountsTable.code, accountLabel: chartOfAccountsTable.label })
    .from(journalEntryLinesTable)
    .leftJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(eq(journalEntryLinesTable.entryId, e.id))
    .orderBy(asc(journalEntryLinesTable.position));
  const journal = (await db.select().from(journalsTable).where(eq(journalsTable.id, e.journalId)).limit(1))[0];
  return res.json({
    ...e,
    totalDebit: toNum(e.totalDebit),
    totalCredit: toNum(e.totalCredit),
    journal,
    lines: lines.map((l) => ({
      ...l.line,
      debit: toNum(l.line.debit),
      credit: toNum(l.line.credit),
      accountCode: l.accountCode,
      accountLabel: l.accountLabel,
    })),
  });
});

router.post("/accounting/entries", requireManagerOrAbove, async (req, res) => {
  try {
    const { journalCode, entryDate, reference, description, lines } = req.body;
    const entry = await postEntry({
      journalCode,
      entryDate,
      reference,
      description,
      sourceType: "manual",
      createdById: req.authUser?.id,
      lines,
    });
    return res.status(201).json(entry);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.post("/accounting/entries/:id/reverse", requireManagerOrAbove, async (req, res) => {
  try {
    const reversal = await reverseEntry(req.params.id, req.authUser?.id);
    return res.status(201).json(reversal);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// GRAND LIVRE (mouvements détaillés par compte)
// ════════════════════════════════════════════════════════════════
router.get("/accounting/ledger", async (req, res) => {
  const { accountId, accountCode, from, to } = req.query as Record<string, string>;
  let resolvedAccountId = accountId;
  if (!resolvedAccountId && accountCode) {
    const acc = (await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.code, accountCode)).limit(1))[0];
    if (acc) resolvedAccountId = acc.id;
  }
  if (!resolvedAccountId) return res.status(400).json({ error: "accountId ou accountCode requis" });

  const conds = [eq(journalEntryLinesTable.accountId, resolvedAccountId), eq(journalEntriesTable.status, "posted")];
  if (from) conds.push(gte(journalEntriesTable.entryDate, from));
  if (to) conds.push(lte(journalEntriesTable.entryDate, to));

  const rows = await db
    .select({
      line: journalEntryLinesTable,
      entry: journalEntriesTable,
      journalCode: journalsTable.code,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .leftJoin(journalsTable, eq(journalEntriesTable.journalId, journalsTable.id))
    .where(and(...conds))
    .orderBy(asc(journalEntriesTable.entryDate), asc(journalEntriesTable.entryNumber));

  const account = (await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, resolvedAccountId)).limit(1))[0];

  let runningBalance = 0;
  const data = rows.map((r) => {
    const debit = toNum(r.line.debit);
    const credit = toNum(r.line.credit);
    runningBalance += account?.normalBalance === "debit" ? (debit - credit) : (credit - debit);
    return {
      lineId: r.line.id,
      entryId: r.entry.id,
      entryNumber: r.entry.entryNumber,
      entryDate: r.entry.entryDate,
      journalCode: r.journalCode,
      reference: r.entry.reference,
      description: r.line.description ?? r.entry.description,
      debit, credit, runningBalance,
    };
  });

  const totalDebit = data.reduce((s, r) => s + r.debit, 0);
  const totalCredit = data.reduce((s, r) => s + r.credit, 0);

  return res.json({ account, data, totalDebit, totalCredit, balance: account?.normalBalance === "debit" ? totalDebit - totalCredit : totalCredit - totalDebit });
});

// ════════════════════════════════════════════════════════════════
// BALANCE GÉNÉRALE
// ════════════════════════════════════════════════════════════════
router.get("/accounting/balance", async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const conds = [eq(journalEntriesTable.status, "posted")];
  if (from) conds.push(gte(journalEntriesTable.entryDate, from));
  if (to) conds.push(lte(journalEntriesTable.entryDate, to));

  const rows = await db
    .select({
      accountId: journalEntryLinesTable.accountId,
      code: chartOfAccountsTable.code,
      label: chartOfAccountsTable.label,
      classNum: chartOfAccountsTable.classNum,
      normalBalance: chartOfAccountsTable.normalBalance,
      totalDebit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(...conds))
    .groupBy(journalEntryLinesTable.accountId, chartOfAccountsTable.code, chartOfAccountsTable.label, chartOfAccountsTable.classNum, chartOfAccountsTable.normalBalance)
    .orderBy(asc(chartOfAccountsTable.code));

  const data = rows.map((r) => {
    const d = toNum(r.totalDebit);
    const c = toNum(r.totalCredit);
    const soldDebit = Math.max(0, d - c);
    const soldCredit = Math.max(0, c - d);
    return { ...r, totalDebit: d, totalCredit: c, soldDebit, soldCredit };
  });
  return res.json({
    data,
    totalDebit: data.reduce((s, r) => s + r.totalDebit, 0),
    totalCredit: data.reduce((s, r) => s + r.totalCredit, 0),
  });
});

// ════════════════════════════════════════════════════════════════
// COMPTE DE RÉSULTAT (P&L)
// ════════════════════════════════════════════════════════════════
router.get("/accounting/income-statement", async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const conds = [eq(journalEntriesTable.status, "posted")];
  if (from) conds.push(gte(journalEntriesTable.entryDate, from));
  if (to) conds.push(lte(journalEntriesTable.entryDate, to));

  const rows = await db
    .select({
      code: chartOfAccountsTable.code,
      label: chartOfAccountsTable.label,
      classNum: chartOfAccountsTable.classNum,
      type: chartOfAccountsTable.type,
      totalDebit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(...conds, sql`${chartOfAccountsTable.classNum} IN (6, 7)`))
    .groupBy(chartOfAccountsTable.code, chartOfAccountsTable.label, chartOfAccountsTable.classNum, chartOfAccountsTable.type)
    .orderBy(asc(chartOfAccountsTable.code));

  const charges = rows.filter((r) => r.classNum === 6).map((r) => ({
    code: r.code, label: r.label,
    amount: toNum(r.totalDebit) - toNum(r.totalCredit),
  }));
  const produits = rows.filter((r) => r.classNum === 7).map((r) => ({
    code: r.code, label: r.label,
    amount: toNum(r.totalCredit) - toNum(r.totalDebit),
  }));
  const totalCharges = charges.reduce((s, r) => s + r.amount, 0);
  const totalProduits = produits.reduce((s, r) => s + r.amount, 0);
  return res.json({
    charges, produits,
    totalCharges, totalProduits,
    resultatNet: totalProduits - totalCharges,
    period: { from: from || null, to: to || null },
  });
});

// ════════════════════════════════════════════════════════════════
// BILAN
// ════════════════════════════════════════════════════════════════
router.get("/accounting/balance-sheet", async (req, res) => {
  const { asOf } = req.query as Record<string, string>;
  const conds = [eq(journalEntriesTable.status, "posted")];
  if (asOf) conds.push(lte(journalEntriesTable.entryDate, asOf));

  const rows = await db
    .select({
      code: chartOfAccountsTable.code,
      label: chartOfAccountsTable.label,
      classNum: chartOfAccountsTable.classNum,
      type: chartOfAccountsTable.type,
      normalBalance: chartOfAccountsTable.normalBalance,
      totalDebit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(...conds, sql`${chartOfAccountsTable.classNum} IN (1, 2, 3, 4, 5)`))
    .groupBy(chartOfAccountsTable.code, chartOfAccountsTable.label, chartOfAccountsTable.classNum, chartOfAccountsTable.type, chartOfAccountsTable.normalBalance)
    .orderBy(asc(chartOfAccountsTable.code));

  // Calcul résultat net pour intégration au bilan (passif)
  const pl = await db
    .select({
      classNum: chartOfAccountsTable.classNum,
      totalDebit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(...conds, sql`${chartOfAccountsTable.classNum} IN (6, 7)`))
    .groupBy(chartOfAccountsTable.classNum);

  let resultatNet = 0;
  for (const r of pl) {
    if (r.classNum === 7) resultatNet += toNum(r.totalCredit) - toNum(r.totalDebit);
    if (r.classNum === 6) resultatNet -= toNum(r.totalDebit) - toNum(r.totalCredit);
  }

  const actifs: any[] = [];
  const passifs: any[] = [];
  for (const r of rows) {
    const d = toNum(r.totalDebit);
    const c = toNum(r.totalCredit);
    const sold = r.normalBalance === "debit" ? d - c : c - d;
    if (sold === 0) continue;
    const item = { code: r.code, label: r.label, amount: Math.abs(sold) };
    // actif = solde débiteur sur compte d'actif ; passif = solde créditeur sur passif/capitaux
    if ((r.type === "asset" && sold > 0) || (r.type === "liability" && sold < 0) || (r.type === "equity" && sold < 0)) {
      actifs.push(item);
    } else {
      passifs.push(item);
    }
  }

  if (resultatNet !== 0) {
    passifs.push({ code: "13", label: "Résultat net de l'exercice (calculé)", amount: resultatNet });
  }

  const totalActif = actifs.reduce((s, r) => s + r.amount, 0);
  const totalPassif = passifs.reduce((s, r) => s + r.amount, 0);

  return res.json({ actifs, passifs, totalActif, totalPassif, resultatNet, asOf: asOf || null });
});

// ════════════════════════════════════════════════════════════════
// FOURNISSEURS
// ════════════════════════════════════════════════════════════════
router.get("/accounting/suppliers", async (req, res) => {
  const { search } = req.query as Record<string, string>;
  const conds = [isNull(suppliersTable.deletedAt)];
  if (search) conds.push(like(suppliersTable.name, `%${search}%`));
  const rows = await db.select().from(suppliersTable).where(and(...conds)).orderBy(asc(suppliersTable.name));
  return res.json({ data: rows });
});

router.post("/accounting/suppliers", requireManagerOrAbove, async (req, res) => {
  const { name, email, phone, address, taxId, paymentTerms, code } = req.body;
  const cnt = await db.select({ n: sql<string>`COUNT(*)` }).from(suppliersTable);
  const generatedCode = code || `F${String(Number(cnt[0].n) + 1).padStart(4, "0")}`;
  const [s] = await db.insert(suppliersTable).values({
    code: generatedCode, name, email, phone, address, taxId, paymentTerms,
  }).returning();
  return res.status(201).json(s);
});

router.put("/accounting/suppliers/:id", requireManagerOrAbove, async (req, res) => {
  const { name, email, phone, address, taxId, paymentTerms, isActive } = req.body;
  const [s] = await db.update(suppliersTable).set({ name, email, phone, address, taxId, paymentTerms, isActive })
    .where(eq(suppliersTable.id, req.params.id)).returning();
  if (!s) return res.status(404).json({ error: "Fournisseur introuvable" });
  return res.json(s);
});

router.delete("/accounting/suppliers/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(suppliersTable).set({ deletedAt: new Date() }).where(eq(suppliersTable.id, req.params.id));
  return res.status(204).send();
});

// ════════════════════════════════════════════════════════════════
// FACTURES FOURNISSEURS
// ════════════════════════════════════════════════════════════════
router.get("/accounting/supplier-invoices", async (req, res) => {
  const { status, supplierId } = req.query as Record<string, string>;
  const conds = [];
  if (status) conds.push(eq(supplierInvoicesTable.status, status));
  if (supplierId) conds.push(eq(supplierInvoicesTable.supplierId, supplierId));
  const rows = await db.select({
    inv: supplierInvoicesTable, supplierName: suppliersTable.name,
  }).from(supplierInvoicesTable)
    .leftJoin(suppliersTable, eq(supplierInvoicesTable.supplierId, suppliersTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(supplierInvoicesTable.invoiceDate));
  return res.json({
    data: rows.map((r) => ({
      ...r.inv, supplierName: r.supplierName,
      totalAmount: toNum(r.inv.totalAmount), paidAmount: toNum(r.inv.paidAmount), taxAmount: toNum(r.inv.taxAmount),
    })),
  });
});

router.post("/accounting/supplier-invoices", requireManagerOrAbove, async (req, res) => {
  try {
    const { supplierId, projectId, invoiceDate, dueDate, totalAmount, taxAmount, currency, expenseAccountId, notes, attachmentUrl, status } = req.body;
    const cnt = await db.select({ n: sql<string>`COUNT(*)` }).from(supplierInvoicesTable);
    const refNum = `FF-${new Date().getFullYear()}-${String(Number(cnt[0].n) + 1).padStart(4, "0")}`;
    const [inv] = await db.insert(supplierInvoicesTable).values({
      referenceNumber: refNum, supplierId, projectId,
      invoiceDate, dueDate,
      totalAmount: String(totalAmount), taxAmount: String(taxAmount ?? 0),
      currency: currency ?? "XOF",
      expenseAccountId, notes, attachmentUrl,
      status: status ?? "pending",
    }).returning();

    // Comptabilisation automatique
    const entry = await postSupplierInvoice(inv.id, req.authUser?.id);
    return res.status(201).json({ ...inv, totalAmount: toNum(inv.totalAmount), journalEntry: entry });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.post("/accounting/supplier-payments", requireManagerOrAbove, async (req, res) => {
  try {
    const { supplierInvoiceId, bankAccountId, amount, method, reference, notes, paidAt } = req.body;
    const [pay] = await db.insert(supplierPaymentsTable).values({
      supplierInvoiceId, bankAccountId,
      amount: String(amount), method, reference, notes,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
    }).returning();

    // Cumul atomique du paid_amount via SQL (évite les écrasements concurrents).
    await db.execute(sql`
      UPDATE ${supplierInvoicesTable}
         SET paid_amount = COALESCE(paid_amount, 0) + ${Number(amount)},
             status = CASE
               WHEN COALESCE(paid_amount, 0) + ${Number(amount)} >= COALESCE(total_amount, 0) THEN 'paid'
               ELSE 'pending'
             END
       WHERE id = ${supplierInvoiceId}
    `);

    const entry = await postSupplierPayment(pay.id, req.authUser?.id);
    return res.status(201).json({ ...pay, amount: toNum(pay.amount), journalEntry: entry });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// AGING — Comptes clients & fournisseurs (balances âgées)
// ════════════════════════════════════════════════════════════════
function bucketAge(dueDateStr: string | null | undefined): string {
  if (!dueDateStr) return "current";
  const due = new Date(dueDateStr);
  const days = Math.floor((Date.now() - due.getTime()) / 86400000);
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90_plus";
}

router.get("/accounting/aging/customers", async (_req, res) => {
  const rows = await db
    .select({ inv: invoicesTable, clientName: clientsTable.name })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(sql`${invoicesTable.status} != 'paid'`);
  const buckets: Record<string, any[]> = { current: [], d1_30: [], d31_60: [], d61_90: [], d90_plus: [] };
  for (const r of rows) {
    const remaining = toNum(r.inv.totalAmount) - toNum(r.inv.paidAmount);
    if (remaining <= 0) continue;
    const b = bucketAge(r.inv.dueDate);
    buckets[b].push({
      invoiceId: r.inv.id,
      reference: r.inv.referenceNumber,
      clientName: r.clientName,
      dueDate: r.inv.dueDate,
      amount: remaining,
    });
  }
  const totals: Record<string, number> = {};
  for (const k of Object.keys(buckets)) totals[k] = buckets[k].reduce((s, r) => s + r.amount, 0);
  return res.json({ buckets, totals, total: Object.values(totals).reduce((a, b) => a + b, 0) });
});

router.get("/accounting/aging/suppliers", async (_req, res) => {
  const rows = await db
    .select({ inv: supplierInvoicesTable, supplierName: suppliersTable.name })
    .from(supplierInvoicesTable)
    .leftJoin(suppliersTable, eq(supplierInvoicesTable.supplierId, suppliersTable.id))
    .where(sql`${supplierInvoicesTable.status} != 'paid'`);
  const buckets: Record<string, any[]> = { current: [], d1_30: [], d31_60: [], d61_90: [], d90_plus: [] };
  for (const r of rows) {
    const remaining = toNum(r.inv.totalAmount) - toNum(r.inv.paidAmount);
    if (remaining <= 0) continue;
    const b = bucketAge(r.inv.dueDate);
    buckets[b].push({
      invoiceId: r.inv.id,
      reference: r.inv.referenceNumber,
      supplierName: r.supplierName,
      dueDate: r.inv.dueDate,
      amount: remaining,
    });
  }
  const totals: Record<string, number> = {};
  for (const k of Object.keys(buckets)) totals[k] = buckets[k].reduce((s, r) => s + r.amount, 0);
  return res.json({ buckets, totals, total: Object.values(totals).reduce((a, b) => a + b, 0) });
});

// ════════════════════════════════════════════════════════════════
// BANQUES / CAISSES
// ════════════════════════════════════════════════════════════════
router.get("/accounting/bank-accounts", async (_req, res) => {
  const rows = await db
    .select({ b: bankAccountsTable, accountCode: chartOfAccountsTable.code, accountLabel: chartOfAccountsTable.label })
    .from(bankAccountsTable)
    .leftJoin(chartOfAccountsTable, eq(bankAccountsTable.accountId, chartOfAccountsTable.id))
    .where(eq(bankAccountsTable.isActive, true))
    .orderBy(asc(bankAccountsTable.name));

  // Solde calculé = openingBalance + somme(débits) - somme(crédits) sur le compte rattaché
  const data = await Promise.all(rows.map(async (r) => {
    const sums = (await db
      .select({
        d: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
        c: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .where(and(eq(journalEntryLinesTable.accountId, r.b.accountId), eq(journalEntriesTable.status, "posted"))))[0];
    const computed = toNum(r.b.openingBalance) + toNum(sums.d) - toNum(sums.c);
    return { ...r.b, openingBalance: toNum(r.b.openingBalance), accountCode: r.accountCode, accountLabel: r.accountLabel, computedBalance: computed };
  }));
  return res.json({ data });
});

router.post("/accounting/bank-accounts", requireAdmin, async (req, res) => {
  const { name, type, bankName, accountNumber, iban, accountId, currency, openingBalance } = req.body;
  const [b] = await db.insert(bankAccountsTable).values({
    name, type: type ?? "bank", bankName, accountNumber, iban,
    accountId, currency: currency ?? "XOF",
    openingBalance: openingBalance != null ? String(openingBalance) : "0",
  }).returning();
  return res.status(201).json(b);
});

router.get("/accounting/bank-accounts/:id/transactions", async (req, res) => {
  const txs = await db.select().from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.bankAccountId, req.params.id))
    .orderBy(desc(bankTransactionsTable.transactionDate));
  return res.json({ data: txs.map((t) => ({ ...t, amount: toNum(t.amount) })) });
});

router.post("/accounting/bank-accounts/:id/transactions", requireManagerOrAbove, async (req, res) => {
  const { transactionDate, label, amount, reference } = req.body;
  const [tx] = await db.insert(bankTransactionsTable).values({
    bankAccountId: req.params.id, transactionDate, label,
    amount: String(amount), reference,
  }).returning();
  return res.status(201).json({ ...tx, amount: toNum(tx.amount) });
});

// Rapprochement bancaire : suggestions automatiques
router.get("/accounting/bank-accounts/:id/reconciliation", async (req, res) => {
  const bank = (await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, req.params.id)).limit(1))[0];
  if (!bank) return res.status(404).json({ error: "Compte bancaire introuvable" });

  const txs = await db.select().from(bankTransactionsTable)
    .where(and(eq(bankTransactionsTable.bankAccountId, req.params.id), eq(bankTransactionsTable.isReconciled, false)))
    .orderBy(desc(bankTransactionsTable.transactionDate));

  const lines = await db
    .select({ line: journalEntryLinesTable, entry: journalEntriesTable })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .where(and(eq(journalEntryLinesTable.accountId, bank.accountId), isNull(journalEntryLinesTable.reconciledAt), eq(journalEntriesTable.status, "posted")));

  return res.json({
    bank: { ...bank, openingBalance: toNum(bank.openingBalance) },
    transactions: txs.map((t) => ({ ...t, amount: toNum(t.amount) })),
    journalLines: lines.map((l) => ({
      lineId: l.line.id, entryNumber: l.entry.entryNumber, entryDate: l.entry.entryDate,
      description: l.line.description ?? l.entry.description,
      debit: toNum(l.line.debit), credit: toNum(l.line.credit),
    })),
  });
});

router.post("/accounting/reconciliation/match", requireManagerOrAbove, async (req, res) => {
  const { transactionId, lineId } = req.body;
  await db.update(bankTransactionsTable)
    .set({ isReconciled: true, reconciledLineId: lineId })
    .where(eq(bankTransactionsTable.id, transactionId));
  await db.update(journalEntryLinesTable)
    .set({ reconciledAt: new Date(), bankTransactionId: transactionId })
    .where(eq(journalEntryLinesTable.id, lineId));
  return res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// IMMOBILISATIONS & AMORTISSEMENTS
// ════════════════════════════════════════════════════════════════
router.get("/accounting/fixed-assets", async (_req, res) => {
  const rows = await db.select().from(fixedAssetsTable).orderBy(desc(fixedAssetsTable.acquisitionDate));
  // Calcule cumul amortissements par immobilisation
  const data = await Promise.all(rows.map(async (a) => {
    const sums = (await db.select({
      total: sql<string>`COALESCE(SUM(${amortizationsTable.periodAmount}), 0)`,
    }).from(amortizationsTable).where(eq(amortizationsTable.fixedAssetId, a.id)))[0];
    const cumul = toNum(sums.total);
    const cost = toNum(a.acquisitionCost);
    return {
      ...a,
      acquisitionCost: cost,
      residualValue: toNum(a.residualValue),
      accumulatedDepreciation: cumul,
      netBookValue: cost - cumul,
    };
  }));
  return res.json({ data });
});

router.post("/accounting/fixed-assets", requireManagerOrAbove, async (req, res) => {
  const { code, label, category, accountId, depreciationAccountId, expenseAccountId, acquisitionDate, acquisitionCost, residualValue, depreciationMethod, usefulLifeYears, notes } = req.body;
  const [a] = await db.insert(fixedAssetsTable).values({
    code, label, category, accountId, depreciationAccountId, expenseAccountId,
    acquisitionDate, acquisitionCost: String(acquisitionCost),
    residualValue: residualValue != null ? String(residualValue) : "0",
    depreciationMethod: depreciationMethod ?? "linear",
    usefulLifeYears,
    notes,
  }).returning();
  return res.status(201).json(a);
});

router.post("/accounting/fixed-assets/:id/depreciate", requireManagerOrAbove, async (req, res) => {
  try {
    const asset = (await db.select().from(fixedAssetsTable).where(eq(fixedAssetsTable.id, req.params.id)).limit(1))[0];
    if (!asset) return res.status(404).json({ error: "Immobilisation introuvable" });
    if (!asset.depreciationAccountId || !asset.expenseAccountId) {
      return res.status(400).json({ error: "Comptes d'amortissement et de charge requis sur l'immobilisation" });
    }
    const period = await getCurrentFiscalPeriod();
    if (!period) return res.status(400).json({ error: "Aucun exercice ouvert" });

    const cost = toNum(asset.acquisitionCost) - toNum(asset.residualValue);
    const annual = cost / asset.usefulLifeYears;

    const sums = (await db.select({
      total: sql<string>`COALESCE(SUM(${amortizationsTable.periodAmount}), 0)`,
    }).from(amortizationsTable).where(eq(amortizationsTable.fixedAssetId, asset.id)))[0];
    const accumulated = toNum(sums.total) + annual;

    const entry = await postAmortization({
      fiscalPeriodId: period.id,
      fixedAssetCode: asset.code,
      description: `Dotation amortissement ${asset.label}`,
      amount: annual,
      expenseAccountId: asset.expenseAccountId,
      depreciationAccountId: asset.depreciationAccountId,
      sourceId: asset.id,
      userId: req.authUser?.id,
    });

    const [am] = await db.insert(amortizationsTable).values({
      fixedAssetId: asset.id,
      fiscalPeriodId: period.id,
      periodAmount: annual.toFixed(2),
      accumulatedAmount: accumulated.toFixed(2),
      journalEntryId: entry.id,
      postedAt: new Date(),
    }).returning();

    return res.status(201).json({ amortization: am, journalEntry: entry });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// DASHBOARD FINANCIER
// ════════════════════════════════════════════════════════════════
router.get("/accounting/dashboard", async (_req, res) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  // Trésorerie totale (une seule requête agrégée par accountId, au lieu d'un query par banque)
  const banks = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.isActive, true));
  const bankAccountIds = banks.map((b) => b.accountId).filter(Boolean);
  let cashTotal = banks.reduce((s, b) => s + toNum(b.openingBalance), 0);
  if (bankAccountIds.length > 0) {
    const bankSums = await db.select({
      accountId: journalEntryLinesTable.accountId,
      d: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      c: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    }).from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .where(and(inArray(journalEntryLinesTable.accountId, bankAccountIds), eq(journalEntriesTable.status, "posted")))
      .groupBy(journalEntryLinesTable.accountId);
    for (const s of bankSums) cashTotal += toNum(s.d) - toNum(s.c);
  }

  // Créances clients (soldes débiteurs 411)
  const ar = await db.select({
    d: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
    c: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
  }).from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(eq(chartOfAccountsTable.code, "411"), eq(journalEntriesTable.status, "posted")));
  const creances = toNum(ar[0]?.d) - toNum(ar[0]?.c);

  // Dettes fournisseurs (soldes créditeurs 401)
  const ap = await db.select({
    d: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
    c: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
  }).from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(eq(chartOfAccountsTable.code, "401"), eq(journalEntriesTable.status, "posted")));
  const dettes = toNum(ap[0]?.c) - toNum(ap[0]?.d);

  // P&L mois courant
  const pl = await db
    .select({
      classNum: chartOfAccountsTable.classNum,
      d: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      c: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(
      eq(journalEntriesTable.status, "posted"),
      gte(journalEntriesTable.entryDate, startOfMonth),
      lte(journalEntriesTable.entryDate, endOfMonth),
      sql`${chartOfAccountsTable.classNum} IN (6, 7)`,
    ))
    .groupBy(chartOfAccountsTable.classNum);
  let revenusMois = 0; let chargesMois = 0;
  for (const r of pl) {
    if (r.classNum === 7) revenusMois += toNum(r.c) - toNum(r.d);
    if (r.classNum === 6) chargesMois += toNum(r.d) - toNum(r.c);
  }

  // 6 derniers mois — produits/charges (une seule requête, group by mois + classe)
  const firstMonthDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const firstMonthStr = firstMonthDate.toISOString().slice(0, 10);
  const monthlyAgg = await db
    .select({
      month: sql<string>`to_char(${journalEntriesTable.entryDate}::date, 'YYYY-MM')`,
      classNum: chartOfAccountsTable.classNum,
      d: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      c: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(
      eq(journalEntriesTable.status, "posted"),
      gte(journalEntriesTable.entryDate, firstMonthStr),
      sql`${chartOfAccountsTable.classNum} IN (6, 7)`,
    ))
    .groupBy(sql`1`, chartOfAccountsTable.classNum);

  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthKeys.push(d.toISOString().slice(0, 7));
  }
  const monthly = monthKeys.map((m) => {
    const rows = monthlyAgg.filter((r) => r.month === m);
    let rv = 0; let ch = 0;
    for (const x of rows) {
      if (x.classNum === 7) rv += toNum(x.c) - toNum(x.d);
      if (x.classNum === 6) ch += toNum(x.d) - toNum(x.c);
    }
    return { month: m, revenus: rv, charges: ch };
  });

  // Top 5 dettes & créances (depuis factures opérationnelles)
  const topCreances = await db.select({ inv: invoicesTable, clientName: clientsTable.name })
    .from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(sql`${invoicesTable.status} != 'paid'`)
    .orderBy(desc(invoicesTable.totalAmount)).limit(5);

  const topDettes = await db.select({ inv: supplierInvoicesTable, supplierName: suppliersTable.name })
    .from(supplierInvoicesTable).leftJoin(suppliersTable, eq(supplierInvoicesTable.supplierId, suppliersTable.id))
    .where(sql`${supplierInvoicesTable.status} != 'paid'`)
    .orderBy(desc(supplierInvoicesTable.totalAmount)).limit(5);

  return res.json({
    cashTotal, creances, dettes,
    revenusMois, chargesMois, resultatMois: revenusMois - chargesMois,
    monthly,
    topCreances: topCreances.map((r) => ({ id: r.inv.id, ref: r.inv.referenceNumber, client: r.clientName, amount: toNum(r.inv.totalAmount) - toNum(r.inv.paidAmount) })),
    topDettes: topDettes.map((r) => ({ id: r.inv.id, ref: r.inv.referenceNumber, supplier: r.supplierName, amount: toNum(r.inv.totalAmount) - toNum(r.inv.paidAmount) })),
  });
});

export default router;
