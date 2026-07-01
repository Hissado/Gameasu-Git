import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, proformasTable, invoicesTable, paymentsTable, clientsTable, auditLogsTable, salesLinesTable, creditNotesTable, organizationsTable, clientEmailLogsTable } from "@workspace/db";
import { eq, sql, isNull, and, desc, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requirePermission } from "../middlewares/permissions";
import { postCustomerInvoice, postCustomerPayment } from "../services/postings";
import { logger } from "../lib/logger";
import { sendEmail, buildProformaEmail, buildOrderEmail, buildInvoiceEmail, buildCreditNoteEmail } from "../lib/email";

const router = Router();

const toNum = (v: string | null | undefined) => v ? Number(v) : null;

// ORDERS
router.get("/orders", async (req, res) => {
  const { status, clientId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const orgFilter = and(eq(ordersTable.organizationId, req.authUser!.organizationId), isNull(ordersTable.deletedAt));
  const rows = await db.select({ order: ordersTable, clientName: clientsTable.name })
    .from(ordersTable)
    .leftJoin(clientsTable, eq(ordersTable.clientId, clientsTable.id))
    .where(orgFilter).limit(limitNum).offset(offset);

  const data = rows.map(r => ({ ...r.order, clientName: r.clientName, totalAmount: toNum(r.order.totalAmount) }));
  const count = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(orgFilter);
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/orders", requirePermission("commercial.manage"), async (req, res) => {
  const { clientId, status, totalAmount, currency, notes, attachmentUrl } = req.body;
  const refNum = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const [order] = await db.insert(ordersTable).values({ organizationId: req.authUser!.organizationId, referenceNumber: refNum, clientId, status: status || "draft", totalAmount: totalAmount?.toString(), currency, notes, attachmentUrl }).returning();
  return res.status(201).json({ ...order, totalAmount: toNum(order.totalAmount) });
});

router.get("/orders/financial-summary", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const orders = await db.select().from(ordersTable).where(and(eq(ordersTable.organizationId, orgId), isNull(ordersTable.deletedAt)));
  const proformas = await db.select().from(proformasTable).where(eq(proformasTable.organizationId, orgId));
  const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.organizationId, orgId));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.organizationId, orgId));

  const totalPaid = payments.reduce((s, p) => s + (p.amount ? Number(p.amount) : 0), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount ? Number(i.totalAmount) : 0), 0);

  return res.json({
    totalOrders: orders.length,
    totalOrdersValue: orders.reduce((s, o) => s + (o.totalAmount ? Number(o.totalAmount) : 0), 0),
    totalProformas: proformas.length,
    totalProformasValue: proformas.reduce((s, p) => s + (p.totalAmount ? Number(p.totalAmount) : 0), 0),
    totalInvoices: invoices.length,
    totalInvoicesValue: totalInvoiced,
    totalPaid,
    totalOutstanding: totalInvoiced - totalPaid,
    currency: "XOF",
  });
});

router.get("/orders/:id", async (req, res) => {
  const rows = await db.select({ order: ordersTable, clientName: clientsTable.name })
    .from(ordersTable).leftJoin(clientsTable, eq(ordersTable.clientId, clientsTable.id))
    .where(and(eq(ordersTable.organizationId, req.authUser!.organizationId), eq(ordersTable.id, (req.params.id as string)))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].order, clientName: rows[0].clientName, totalAmount: toNum(rows[0].order.totalAmount) });
});

router.put("/orders/:id", requirePermission("commercial.manage"), async (req, res) => {
  const { clientId, status, totalAmount, currency, notes, attachmentUrl } = req.body;
  const [order] = await db.update(ordersTable).set({ clientId, status, totalAmount: totalAmount?.toString(), currency, notes, attachmentUrl }).where(and(eq(ordersTable.organizationId, req.authUser!.organizationId), eq(ordersTable.id, (req.params.id as string)))).returning();
  if (!order) return res.status(404).json({ error: "Not found" });
  return res.json({ ...order, totalAmount: toNum(order.totalAmount) });
});

router.delete("/orders/:id", requirePermission("commercial.manage"), async (req, res) => {
  await db.update(ordersTable).set({ deletedAt: new Date() }).where(and(eq(ordersTable.organizationId, req.authUser!.organizationId), eq(ordersTable.id, (req.params.id as string))));
  return res.status(204).send();
});

// PROFORMAS
router.get("/proformas", async (req, res) => {
  const { status, clientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const orgFilter = eq(proformasTable.organizationId, req.authUser!.organizationId);
  const rows = await db.select({ pro: proformasTable, clientName: clientsTable.name })
    .from(proformasTable).leftJoin(clientsTable, eq(proformasTable.clientId, clientsTable.id))
    .where(orgFilter).limit(limitNum).offset(offset);
  const data = rows.map(r => ({ ...r.pro, clientName: r.clientName, totalAmount: toNum(r.pro.totalAmount) }));
  const count = await db.select({ count: sql<number>`count(*)` }).from(proformasTable).where(orgFilter);
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/proformas", requirePermission("commercial.manage"), async (req, res) => {
  const { orderId, clientId, status, totalAmount, currency, validUntil, notes, caution, paymentTerms, durationDays } = req.body;
  const refNum = `PRO-${Date.now().toString(36).toUpperCase()}`;
  const [pro] = await db.insert(proformasTable).values({
    organizationId: req.authUser!.organizationId,
    referenceNumber: refNum, orderId, clientId, status: status || "draft",
    totalAmount: totalAmount?.toString(), currency, validUntil, notes,
    caution: caution?.toString(), paymentTerms, durationDays,
  }).returning();
  return res.status(201).json({ ...pro, totalAmount: toNum(pro.totalAmount), caution: toNum(pro.caution) });
});

router.get("/proformas/:id", async (req, res) => {
  const rows = await db.select({ pro: proformasTable, clientName: clientsTable.name })
    .from(proformasTable).leftJoin(clientsTable, eq(proformasTable.clientId, clientsTable.id))
    .where(and(eq(proformasTable.organizationId, req.authUser!.organizationId), eq(proformasTable.id, (req.params.id as string)))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].pro, clientName: rows[0].clientName, totalAmount: toNum(rows[0].pro.totalAmount) });
});

router.put("/proformas/:id", requirePermission("commercial.manage"), async (req, res) => {
  const { orderId, clientId, status, totalAmount, currency, validUntil, notes, caution, paymentTerms, durationDays } = req.body;
  const before = (await db.select().from(proformasTable).where(and(eq(proformasTable.organizationId, req.authUser!.organizationId), eq(proformasTable.id, (req.params.id as string)))).limit(1))[0];
  if (!before) return res.status(404).json({ error: "Not found" });

  const [pro] = await db.update(proformasTable).set({
    orderId, clientId, status, totalAmount: totalAmount?.toString(), currency, validUntil, notes,
    caution: caution?.toString(), paymentTerms, durationDays,
  }).where(and(eq(proformasTable.organizationId, req.authUser!.organizationId), eq(proformasTable.id, (req.params.id as string)))).returning();

  // Workflow: validation proforma → génération automatique facture
  let generatedInvoice = null;
  if (status === "approved" && before.status !== "approved") {
    const existingInvoice = await db.select().from(invoicesTable).where(and(eq(invoicesTable.organizationId, req.authUser!.organizationId), eq(invoicesTable.proformaId, pro.id))).limit(1);
    if (existingInvoice.length === 0) {
      const refNum = `INV-${Date.now().toString(36).toUpperCase()}`;
      const [inv] = await db.insert(invoicesTable).values({
        organizationId: req.authUser!.organizationId,
        referenceNumber: refNum,
        proformaId: pro.id,
        clientId: pro.clientId,
        status: "pending",
        totalAmount: pro.totalAmount,
        currency: pro.currency,
        notes: `Facture générée automatiquement après validation de la proforma ${pro.referenceNumber}`,
      }).returning();
      generatedInvoice = { id: inv.id, referenceNumber: inv.referenceNumber };
    }
  }

  return res.json({ ...pro, totalAmount: toNum(pro.totalAmount), caution: toNum(pro.caution), generatedInvoice });
});

// INVOICES — Suggest match (lettrage) — MUST come before /:id route
router.get("/invoices/suggest-match", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { clientId, amount } = req.query as Record<string, string>;
    const amtNum = amount ? Number(amount) : null;

    const rows = await db
      .select({ inv: invoicesTable, clientName: clientsTable.name })
      .from(invoicesTable)
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(
        and(
          eq(invoicesTable.organizationId, orgId),
          clientId ? eq(invoicesTable.clientId, clientId as any) : sql`true`,
          ne(invoicesTable.status, "paid"),
          ne(invoicesTable.status, "cancelled"),
        )
      )
      .orderBy(desc(invoicesTable.createdAt))
      .limit(50);

    const suggestions = rows.map((r) => {
      const total = toNum(r.inv.totalAmount) ?? 0;
      const paid = toNum(r.inv.paidAmount) ?? 0;
      const remaining = Math.max(0, total - paid);
      let confidence: "exact" | "partial" | "low" = "low";
      if (amtNum !== null) {
        const diff = Math.abs(amtNum - remaining);
        const pct = remaining > 0 ? diff / remaining : 1;
        if (pct < 0.001) confidence = "exact";
        else if (pct < 0.3) confidence = "partial";
      }
      return {
        invoiceId: r.inv.id,
        reference: r.inv.referenceNumber,
        clientName: r.clientName,
        totalAmount: total,
        paidAmount: paid,
        remaining,
        status: r.inv.status,
        dueDate: r.inv.dueDate,
        confidence,
      };
    }).sort((a, b) => {
      const order = { exact: 0, partial: 1, low: 2 };
      return order[a.confidence] - order[b.confidence];
    });

    return res.json({ suggestions });
  } catch (e) { next(e); }
});

// INVOICES
router.get("/invoices", async (req, res) => {
  const { status, clientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const orgFilter = eq(invoicesTable.organizationId, req.authUser!.organizationId);
  const rows = await db.select({ inv: invoicesTable, clientName: clientsTable.name })
    .from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(orgFilter).limit(limitNum).offset(offset);
  const data = rows.map(r => ({ ...r.inv, clientName: r.clientName, totalAmount: toNum(r.inv.totalAmount), paidAmount: toNum(r.inv.paidAmount) }));
  const count = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(orgFilter);
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/invoices", requirePermission("commercial.manage"), async (req, res) => {
  const { proformaId, clientId, status, totalAmount, currency, dueDate, notes, issuedAt } = req.body;
  const refNum = `INV-${Date.now().toString(36).toUpperCase()}`;
  const finalStatus = status || "pending";
  const issued = issuedAt || new Date().toISOString().slice(0, 10);
  const [inv] = await db.insert(invoicesTable).values({
    organizationId: req.authUser!.organizationId,
    referenceNumber: refNum, proformaId, clientId,
    status: finalStatus, totalAmount: totalAmount?.toString(),
    currency, dueDate, notes, issuedAt: issued,
  }).returning();

  // Comptabilisation automatique dès qu'une facture est émise (statut != draft).
  // Une erreur ici doit faire échouer la requête pour éviter une divergence
  // silencieuse entre l'opérationnel (facture créée) et la comptabilité.
  if (finalStatus !== "draft") {
    try {
      await postCustomerInvoice(req.authUser!.organizationId, inv.id, req.authUser?.id);
    } catch (e: any) {
      logger.error({ err: e, invoiceId: inv.id }, "Échec comptabilisation facture");
      return res.status(500).json({ error: "Comptabilisation impossible", detail: e.message, invoiceId: inv.id });
    }
  }
  return res.status(201).json({ ...inv, totalAmount: toNum(inv.totalAmount), paidAmount: toNum(inv.paidAmount) });
});

router.get("/invoices/:id", async (req, res) => {
  const rows = await db.select({ inv: invoicesTable, clientName: clientsTable.name })
    .from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(and(eq(invoicesTable.organizationId, req.authUser!.organizationId), eq(invoicesTable.id, (req.params.id as string)))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].inv, clientName: rows[0].clientName, totalAmount: toNum(rows[0].inv.totalAmount), paidAmount: toNum(rows[0].inv.paidAmount) });
});

router.put("/invoices/:id", requirePermission("commercial.manage"), async (req, res) => {
  const { proformaId, clientId, status, totalAmount, currency, dueDate, notes } = req.body;
  const before = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.organizationId, req.authUser!.organizationId), eq(invoicesTable.id, (req.params.id as string)))).limit(1))[0];
  const [inv] = await db.update(invoicesTable).set({ proformaId, clientId, status, totalAmount: totalAmount?.toString(), currency, dueDate, notes }).where(and(eq(invoicesTable.organizationId, req.authUser!.organizationId), eq(invoicesTable.id, (req.params.id as string)))).returning();
  if (!inv) return res.status(404).json({ error: "Not found" });

  // Si la facture sort du statut "draft", on génère l'écriture comptable.
  if (before?.status === "draft" && status && status !== "draft") {
    try {
      await postCustomerInvoice(req.authUser!.organizationId, inv.id, req.authUser?.id);
    } catch (e: any) {
      logger.error({ err: e, invoiceId: inv.id }, "Échec comptabilisation facture");
      return res.status(500).json({ error: "Comptabilisation impossible", detail: e.message, invoiceId: inv.id });
    }
  }
  return res.json({ ...inv, totalAmount: toNum(inv.totalAmount), paidAmount: toNum(inv.paidAmount) });
});

// PAYMENTS
router.get("/payments", async (req, res) => {
  const { invoiceId: filterInvoiceId, clientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const orgId = req.authUser!.organizationId;
  const conds = [eq(paymentsTable.organizationId, orgId)];
  if (filterInvoiceId) conds.push(eq(paymentsTable.invoiceId, filterInvoiceId));
  if (clientId) conds.push(eq(invoicesTable.clientId, clientId));
  const where = and(...conds);

  const rows = await db.select({
    pay: paymentsTable,
    invoiceRef: invoicesTable.referenceNumber,
    clientName: clientsTable.name,
  }).from(paymentsTable)
    .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(where).limit(limitNum).offset(offset)
    .orderBy(desc(paymentsTable.paidAt));

  const count = await db.select({ count: sql<number>`count(*)` }).from(paymentsTable).where(eq(paymentsTable.organizationId, orgId));
  return res.json({
    data: rows.map(r => ({ ...r.pay, amount: toNum(r.pay.amount), invoiceRef: r.invoiceRef, clientName: r.clientName })),
    total: Number(count[0].count), page: pageNum, limit: limitNum,
  });
});

router.post("/payments", requirePermission("commercial.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { invoiceId, amount, currency, method, reference, paidAt, notes, bankAccountId, payerPhone, transactionStatus } = req.body;

  const amt = Number(amount);
  if (!invoiceId || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: "Montant de règlement invalide" });
  }

  // Contrôles préalables : la facture doit exister, appartenir à l'organisation
  // et ne pas être annulée.
  const inv = (await db.select().from(invoicesTable).where(and(
    eq(invoicesTable.organizationId, orgId),
    eq(invoicesTable.id, invoiceId),
  )).limit(1))[0];
  if (!inv) return res.status(404).json({ error: "Facture introuvable" });
  if (inv.status === "cancelled") return res.status(400).json({ error: "Facture annulée : règlement impossible" });

  try {
    // Tout le règlement (insertion paiement + mise à jour du solde de la facture
    // + écriture comptable) est encapsulé dans UNE seule transaction : si la
    // comptabilisation échoue, rien n'est écrit → plus de divergence entre
    // l'opérationnel (solde facture) et le grand livre.
    const payment = await db.transaction(async (tx) => {
      const [created] = await tx.insert(paymentsTable).values({
        organizationId: orgId,
        invoiceId, amount: amt.toString(), currency, method, reference,
        paidAt: paidAt ? new Date(paidAt) : new Date(), notes,
        payerPhone: payerPhone || null,
        transactionStatus: transactionStatus || "confirmed",
      }).returning();

      // Cumul atomique du paid_amount : empêche les écrasements concurrents
      // (lost update) si plusieurs règlements arrivent simultanément. Le
      // garde-fou `status <> 'cancelled'` + le contrôle du nombre de lignes
      // touchées ferment la fenêtre TOCTOU : si la facture est annulée (ou
      // supprimée) entre la vérification préalable et la transaction, on
      // annule tout le règlement.
      const touched = await tx.update(invoicesTable)
        .set({
          paidAmount: sql`COALESCE(${invoicesTable.paidAmount}, 0) + ${amt}`,
          status: sql`CASE WHEN COALESCE(${invoicesTable.paidAmount}, 0) + ${amt} >= COALESCE(${invoicesTable.totalAmount}, 0) THEN 'paid' ELSE 'partially_paid' END`,
        })
        .where(and(
          eq(invoicesTable.organizationId, orgId),
          eq(invoicesTable.id, invoiceId),
          sql`${invoicesTable.status} <> 'cancelled'`,
        ))
        .returning({ id: invoicesTable.id });
      if (touched.length === 0) throw new Error("Facture introuvable ou annulée pendant le règlement");

      // Comptabilisation dans la même transaction (tx partagé).
      await postCustomerPayment(orgId, created.id, { bankAccountId, userId: req.authUser?.id, tx });
      return created;
    });

    return res.status(201).json({ ...payment, amount: toNum(payment.amount) });
  } catch (e: any) {
    logger.error({ err: e, invoiceId }, "Échec enregistrement règlement");
    return res.status(500).json({ error: "Enregistrement du règlement impossible", detail: e.message });
  }
});

// ─── GET /clients/:id/commercial ─────────────────────────────────────────────
router.get("/clients/:id/commercial", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const clientId = (req.params.id as string);

    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.organizationId, orgId), eq(clientsTable.id, clientId))).limit(1);
    if (!client) { res.status(404).json({ error: "Client introuvable" }); return; }

    const [proformas, orders, invoices] = await Promise.all([
      db.select().from(proformasTable)
        .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.clientId, clientId)))
        .orderBy(desc(proformasTable.createdAt)),
      db.select().from(ordersTable)
        .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.clientId, clientId), isNull(ordersTable.deletedAt)))
        .orderBy(desc(ordersTable.createdAt)),
      db.select().from(invoicesTable)
        .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.clientId, clientId)))
        .orderBy(desc(invoicesTable.createdAt)),
    ]);

    const invoiceIds = invoices.map(i => i.id);
    let rawPayments: { pay: typeof paymentsTable.$inferSelect; invoiceRef: string | null }[] = [];
    if (invoiceIds.length > 0) {
      rawPayments = await db.select({ pay: paymentsTable, invoiceRef: invoicesTable.referenceNumber })
        .from(paymentsTable)
        .innerJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
        .where(and(eq(paymentsTable.organizationId, orgId), eq(invoicesTable.clientId, clientId)))
        .orderBy(desc(paymentsTable.paidAt));
    }

    const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount ? Number(i.totalAmount) : 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount ? Number(i.paidAmount) : 0), 0);

    res.json({
      kpis: {
        totalProformas: proformas.length,
        totalOrders: orders.length,
        totalInvoices: invoices.length,
        totalInvoiced,
        totalPaid,
        outstandingBalance: totalInvoiced - totalPaid,
      },
      proformas: proformas.map(p => ({ ...p, totalAmount: toNum(p.totalAmount) })),
      orders: orders.map(o => ({ ...o, totalAmount: toNum(o.totalAmount) })),
      invoices: invoices.map(i => ({ ...i, totalAmount: toNum(i.totalAmount), paidAmount: toNum(i.paidAmount) })),
      payments: rawPayments.map(p => ({ ...p.pay, amount: toNum(p.pay.amount), invoiceRef: p.invoiceRef })),
    });
  } catch (e) { next(e); }
});

// ─── POST /proformas/:id/generate-invoice ─────────────────────────────────────
router.post("/proformas/:id/generate-order", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [pro] = await db.select().from(proformasTable)
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, (req.params.id as string)))).limit(1);
    if (!pro) { res.status(404).json({ error: "Devis introuvable" }); return; }

    const refNum = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const [order] = await db.insert(ordersTable).values({
      organizationId: orgId,
      referenceNumber: refNum,
      clientId: pro.clientId,
      status: "confirmed",
      totalAmount: pro.totalAmount,
      currency: pro.currency ?? "XOF",
      notes: `Commande générée depuis le devis ${pro.referenceNumber}`,
    }).returning();

    const proLines = await getLines(orgId, "proforma", pro.id);
    if (proLines.length > 0) {
      await replaceLines(orgId, "order", order.id, proLines.map(l => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPriceFcfa: Number(l.unitPriceFcfa),
        discountPct: Number(l.discountPct),
        taxRatePct: Number(l.taxRatePct),
        productId: l.productId,
      })));
    }

    await db.update(proformasTable).set({ status: "approved" })
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, pro.id)));

    res.status(201).json({ ...order, totalAmount: toNum(order.totalAmount) });
  } catch (e) { next(e); }
});

router.post("/proformas/:id/generate-invoice", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [pro] = await db.select().from(proformasTable)
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, (req.params.id as string)))).limit(1);
    if (!pro) { res.status(404).json({ error: "Proforma introuvable" }); return; }

    const existing = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.proformaId, pro.id))).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Facture déjà générée pour ce devis", invoiceId: existing[0].id, invoiceRef: existing[0].referenceNumber });
      return;
    }

    const refNum = `INV-${Date.now().toString(36).toUpperCase()}`;
    const [inv] = await db.insert(invoicesTable).values({
      organizationId: orgId,
      referenceNumber: refNum,
      proformaId: pro.id,
      clientId: pro.clientId,
      status: "pending",
      totalAmount: pro.totalAmount,
      currency: pro.currency ?? "XOF",
      notes: `Facture générée depuis le devis ${pro.referenceNumber}`,
      issuedAt: new Date().toISOString().slice(0, 10),
    }).returning();

    try {
      await postCustomerInvoice(orgId, inv.id, req.authUser?.id);
    } catch (e: any) {
      logger.error({ err: e, invoiceId: inv.id }, "Comptabilisation facture depuis proforma — non bloquant");
    }

    res.status(201).json({ ...inv, totalAmount: toNum(inv.totalAmount), paidAmount: toNum(inv.paidAmount) });
  } catch (e) { next(e); }
});

// ─── POST /orders/:id/generate-invoice ────────────────────────────────────────
router.post("/orders/:id/generate-invoice", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, (req.params.id as string)))).limit(1);
    if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }
    if (order.status === "cancelled") { res.status(422).json({ error: "Impossible de facturer une commande annulée" }); return; }

    // Idempotence : vérifie si une facture existe déjà pour cette commande (via notes)
    const existing = await db.select({ id: invoicesTable.id, ref: invoicesTable.referenceNumber })
      .from(invoicesTable)
      .where(and(
        eq(invoicesTable.organizationId, orgId),
        eq(invoicesTable.clientId, order.clientId!),
        sql`${invoicesTable.notes} LIKE ${'%' + order.referenceNumber + '%'}`,
      )).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Facture déjà générée pour cette commande", invoiceId: existing[0].id, invoiceRef: existing[0].ref });
      return;
    }

    const refNum = `INV-${Date.now().toString(36).toUpperCase()}`;
    const [inv] = await db.insert(invoicesTable).values({
      organizationId: orgId,
      referenceNumber: refNum,
      clientId: order.clientId,
      status: "pending",
      totalAmount: order.totalAmount,
      currency: order.currency ?? "XOF",
      notes: `Facture générée depuis la commande ${order.referenceNumber}`,
      issuedAt: new Date().toISOString().slice(0, 10),
    }).returning();

    try {
      await postCustomerInvoice(orgId, inv.id, req.authUser?.id);
    } catch (e: any) {
      logger.error({ err: e, invoiceId: inv.id }, "Comptabilisation facture depuis commande — non bloquant");
    }

    // Piste d'audit
    await writeAudit(req, "order_generate_invoice", "order", order.id, { invoiceRef: refNum, invoiceId: inv.id });

    res.status(201).json({ ...inv, totalAmount: toNum(inv.totalAmount), paidAmount: toNum(inv.paidAmount) });
  } catch (e) { next(e); }
});

// ─── PATCH /orders/:id/edit — Modification avec règles métier ────────────────
router.patch("/orders/:id/edit", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, (req.params.id as string)))).limit(1);
    if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }

    // Règles de modification selon statut
    const EDITABLE: Record<string, string[]> = {
      draft:     ["clientId", "totalAmount", "currency", "notes"],
      confirmed: ["notes"],
    };
    const allowed = EDITABLE[order.status];
    if (!allowed) {
      res.status(422).json({ error: `La commande en statut "${order.status}" ne peut pas être modifiée` });
      return;
    }

    const { clientId, totalAmount, currency, notes } = req.body;
    const patch: Record<string, unknown> = {};
    if (allowed.includes("clientId") && clientId !== undefined) patch.clientId = clientId;
    if (allowed.includes("totalAmount") && totalAmount !== undefined) patch.totalAmount = totalAmount?.toString();
    if (allowed.includes("currency") && currency !== undefined) patch.currency = currency;
    if (allowed.includes("notes") && notes !== undefined) patch.notes = notes;

    const before = { status: order.status, totalAmount: order.totalAmount, notes: order.notes };
    const [updated] = await db.update(ordersTable).set(patch as any)
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, (req.params.id as string)))).returning();

    await writeAudit(req, "order_edit", "order", order.id, { before, after: patch, reason: req.body.reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount) });
  } catch (e) { next(e); }
});

// ─── POST /orders/:id/cancel — Annulation avec règles métier ────────────────
router.post("/orders/:id/cancel", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = req.body;
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, (req.params.id as string)))).limit(1);
    if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }

    if (order.status === "cancelled") { res.status(409).json({ error: "Commande déjà annulée" }); return; }
    if (order.status === "delivered") {
      res.status(422).json({ error: "Une commande livrée ne peut pas être annulée. Créez un avoir." });
      return;
    }
    if (order.status === "confirmed" && !reason?.trim()) {
      res.status(422).json({ error: "Un motif d'annulation est requis pour une commande confirmée" });
      return;
    }

    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled" })
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, (req.params.id as string)))).returning();

    await writeAudit(req, "order_cancel", "order", order.id, { before: { status: order.status }, after: { status: "cancelled" }, reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount) });
  } catch (e) { next(e); }
});

// ─── PATCH /proformas/:id/edit — Modification avec règles métier ─────────────
router.patch("/proformas/:id/edit", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [pro] = await db.select().from(proformasTable)
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, (req.params.id as string)))).limit(1);
    if (!pro) { res.status(404).json({ error: "Devis introuvable" }); return; }

    const EDITABLE: Record<string, string[]> = {
      draft: ["clientId", "totalAmount", "validUntil", "notes", "currency"],
      sent:  ["totalAmount", "validUntil", "notes"],
    };
    const allowed = EDITABLE[pro.status];
    if (!allowed) {
      res.status(422).json({ error: `Le devis en statut "${pro.status}" ne peut pas être modifié` });
      return;
    }

    const { clientId, totalAmount, validUntil, notes, currency } = req.body;
    const patch: Record<string, unknown> = {};
    if (allowed.includes("clientId") && clientId !== undefined) patch.clientId = clientId;
    if (allowed.includes("totalAmount") && totalAmount !== undefined) patch.totalAmount = totalAmount?.toString();
    if (allowed.includes("validUntil") && validUntil !== undefined) patch.validUntil = validUntil || null;
    if (allowed.includes("notes") && notes !== undefined) patch.notes = notes;
    if (allowed.includes("currency") && currency !== undefined) patch.currency = currency;

    const before = { status: pro.status, totalAmount: pro.totalAmount, notes: pro.notes };
    const [updated] = await db.update(proformasTable).set(patch as any)
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, (req.params.id as string)))).returning();

    await writeAudit(req, "proforma_edit", "proforma", pro.id, { before, after: patch, reason: req.body.reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount), caution: toNum(updated.caution) });
  } catch (e) { next(e); }
});

// ─── POST /proformas/:id/cancel — Annulation avec règles métier ──────────────
router.post("/proformas/:id/cancel", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = req.body;
    const [pro] = await db.select().from(proformasTable)
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, (req.params.id as string)))).limit(1);
    if (!pro) { res.status(404).json({ error: "Devis introuvable" }); return; }
    if (pro.status === "cancelled") { res.status(409).json({ error: "Devis déjà annulé" }); return; }

    // Si approuvé, vérifier qu'aucune facture n'existe
    if (pro.status === "approved") {
      const existingInvoice = await db.select({ id: invoicesTable.id })
        .from(invoicesTable)
        .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.proformaId, pro.id))).limit(1);
      if (existingInvoice.length > 0) {
        res.status(422).json({ error: "Ce devis a déjà généré une facture — annulez la facture d'abord" });
        return;
      }
      if (!reason?.trim()) {
        res.status(422).json({ error: "Un motif est requis pour annuler un devis approuvé" });
        return;
      }
    }
    if (pro.status === "sent" && !reason?.trim()) {
      res.status(422).json({ error: "Un motif d'annulation est requis pour un devis envoyé" });
      return;
    }

    const [updated] = await db.update(proformasTable)
      .set({ status: "cancelled" })
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, (req.params.id as string)))).returning();

    await writeAudit(req, "proforma_cancel", "proforma", pro.id, { before: { status: pro.status }, after: { status: "cancelled" }, reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount), caution: toNum(updated.caution) });
  } catch (e) { next(e); }
});

// ─── PATCH /invoices/:id/edit — Modification avec règles métier ──────────────
router.patch("/invoices/:id/edit", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string)))).limit(1);
    if (!inv) { res.status(404).json({ error: "Facture introuvable" }); return; }

    const EDITABLE: Record<string, string[]> = {
      draft:          ["clientId", "totalAmount", "dueDate", "notes", "currency"],
      pending:        ["dueDate", "notes"],
      overdue:        ["dueDate", "notes"],
      partially_paid: ["notes"],
    };
    const allowed = EDITABLE[inv.status];
    if (!allowed) {
      res.status(422).json({ error: `La facture en statut "${inv.status}" ne peut pas être modifiée` });
      return;
    }

    const { clientId, totalAmount, dueDate, notes, currency } = req.body;
    const patch: Record<string, unknown> = {};
    if (allowed.includes("clientId") && clientId !== undefined) patch.clientId = clientId;
    if (allowed.includes("totalAmount") && totalAmount !== undefined) {
      // Contrôle interne : montant ne peut pas descendre sous le montant déjà payé
      const paid = Number(inv.paidAmount ?? 0);
      if (Number(totalAmount) < paid) {
        res.status(422).json({ error: `Le montant ne peut pas être inférieur au montant déjà encaissé (${paid} XOF)` });
        return;
      }
      patch.totalAmount = totalAmount.toString();
    }
    if (allowed.includes("dueDate") && dueDate !== undefined) patch.dueDate = dueDate || null;
    if (allowed.includes("notes") && notes !== undefined) patch.notes = notes;
    if (allowed.includes("currency") && currency !== undefined) patch.currency = currency;

    const before = { status: inv.status, totalAmount: inv.totalAmount, dueDate: inv.dueDate, notes: inv.notes };
    const [updated] = await db.update(invoicesTable).set(patch as any)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string)))).returning();

    await writeAudit(req, "invoice_edit", "invoice", inv.id, { before, after: patch, reason: req.body.reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount), paidAmount: toNum(updated.paidAmount) });
  } catch (e) { next(e); }
});

// ─── POST /invoices/:id/cancel — Annulation avec règles métier ───────────────
router.post("/invoices/:id/cancel", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = req.body;
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string)))).limit(1);
    if (!inv) { res.status(404).json({ error: "Facture introuvable" }); return; }
    if (inv.status === "cancelled") { res.status(409).json({ error: "Facture déjà annulée" }); return; }

    // Contrôle interne : bloquer si des paiements ont été reçus
    if (inv.status === "paid") {
      res.status(422).json({ error: "Facture entièrement encaissée — annulez les paiements via votre comptable avant toute modification" });
      return;
    }
    if (inv.status === "partially_paid") {
      res.status(422).json({ error: "Un encaissement partiel a déjà été reçu — annulez les paiements associés avant d'annuler cette facture" });
      return;
    }
    if ((inv.status === "pending" || inv.status === "overdue") && !reason?.trim()) {
      res.status(422).json({ error: "Un motif d'annulation est requis" });
      return;
    }

    const [updated] = await db.update(invoicesTable)
      .set({ status: "cancelled" })
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string)))).returning();

    await writeAudit(req, "invoice_cancel", "invoice", inv.id, { before: { status: inv.status, totalAmount: inv.totalAmount }, after: { status: "cancelled" }, reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount), paidAmount: toNum(updated.paidAmount) });
  } catch (e) { next(e); }
});

// ─── GET /commercial-audit — Piste d'audit pour un document commercial ────────
router.get("/commercial-audit", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { entityType, entityId, limit = "20" } = req.query as Record<string, string>;
    if (!entityType || !entityId) { res.status(400).json({ error: "entityType et entityId sont requis" }); return; }

    const rows = await db.select().from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.organizationId, orgId),
        eq(auditLogsTable.entityType, entityType),
        eq(auditLogsTable.entityId as any, entityId),
      ))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(parseInt(limit));

    res.json({ data: rows });
  } catch (e) { next(e); }
});

// ─── SALES LINES — GET/PUT ────────────────────────────────────────────────────

async function getLines(orgId: string, parentType: string, parentId: string) {
  return db.select().from(salesLinesTable)
    .where(and(
      eq(salesLinesTable.organizationId, orgId),
      eq(salesLinesTable.parentType, parentType),
      eq(salesLinesTable.parentId, parentId),
    ))
    .orderBy(salesLinesTable.position);
}

async function replaceLines(
  orgId: string, parentType: string, parentId: string,
  rawLines: Array<{ description: string; quantity: number; unitPriceFcfa: number; discountPct?: number; taxRatePct?: number; productId?: string | null }>,
) {
  await db.delete(salesLinesTable).where(and(
    eq(salesLinesTable.organizationId, orgId),
    eq(salesLinesTable.parentType, parentType),
    eq(salesLinesTable.parentId, parentId),
  ));
  if (rawLines.length === 0) return [];
  const toInsert = rawLines.map((l, i) => {
    const qty = Number(l.quantity) || 0;
    const unitPrice = Number(l.unitPriceFcfa) || 0;
    const disc = Number(l.discountPct ?? 0);
    const tax = Number(l.taxRatePct ?? 18);
    const total = Math.round(qty * unitPrice * (1 - disc / 100) * (1 + tax / 100));
    return {
      organizationId: orgId, parentType, parentId,
      productId: l.productId ?? null,
      description: l.description,
      quantity: qty.toString(),
      unitPriceFcfa: unitPrice.toString(),
      discountPct: disc.toString(),
      taxRatePct: tax.toString(),
      totalFcfa: total.toString(),
      position: i,
    };
  });
  return db.insert(salesLinesTable).values(toInsert).returning();
}

function computeTotalFromLines(lines: { totalFcfa: string }[]): number {
  return lines.reduce((s, l) => s + Number(l.totalFcfa), 0);
}

function lineToFront(l: typeof salesLinesTable.$inferSelect) {
  return {
    ...l,
    quantity: Number(l.quantity),
    unitPriceFcfa: Number(l.unitPriceFcfa),
    discountPct: Number(l.discountPct),
    taxRatePct: Number(l.taxRatePct),
    totalFcfa: Number(l.totalFcfa),
  };
}

router.get("/orders/:id/lines", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const lines = await getLines(orgId, "order", (req.params.id as string));
    res.json({ data: lines.map(lineToFront) });
  } catch (e) { next(e); }
});

router.put("/orders/:id/lines", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { lines } = req.body as { lines: any[] };
    const saved = await replaceLines(orgId, "order", (req.params.id as string), lines ?? []);
    const total = computeTotalFromLines(saved);
    await db.update(ordersTable).set({ totalAmount: total.toString() })
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, (req.params.id as string))));
    res.json({ data: saved.map(lineToFront), totalAmount: total });
  } catch (e) { next(e); }
});

router.get("/proformas/:id/lines", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const lines = await getLines(orgId, "proforma", (req.params.id as string));
    res.json({ data: lines.map(lineToFront) });
  } catch (e) { next(e); }
});

router.put("/proformas/:id/lines", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { lines } = req.body as { lines: any[] };
    const saved = await replaceLines(orgId, "proforma", (req.params.id as string), lines ?? []);
    const total = computeTotalFromLines(saved);
    await db.update(proformasTable).set({ totalAmount: total.toString() })
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, (req.params.id as string))));
    res.json({ data: saved.map(lineToFront), totalAmount: total });
  } catch (e) { next(e); }
});

router.get("/invoices/:id/lines", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const lines = await getLines(orgId, "invoice", (req.params.id as string));
    res.json({ data: lines.map(lineToFront) });
  } catch (e) { next(e); }
});

router.put("/invoices/:id/lines", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { lines } = req.body as { lines: any[] };
    const saved = await replaceLines(orgId, "invoice", (req.params.id as string), lines ?? []);
    const total = computeTotalFromLines(saved);
    await db.update(invoicesTable).set({ totalAmount: total.toString() })
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string))));
    res.json({ data: saved.map(lineToFront), totalAmount: total });
  } catch (e) { next(e); }
});

// ─── EMAIL SENDING ─────────────────────────────────────────────────────────────

async function getOrgBranding(orgId: string) {
  const [org] = await db.select({ name: organizationsTable.name, logoUrl: organizationsTable.logoUrl, primaryColor: organizationsTable.primaryColor })
    .from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  return org ?? { name: "Gameasu", logoUrl: null, primaryColor: "#C8A24B" };
}

router.post("/proformas/:id/send-email", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { to, message } = req.body as { to: string; message?: string };
    if (!to?.trim()) { res.status(400).json({ error: "Adresse email requise" }); return; }

    const rows = await db.select({ pro: proformasTable, clientName: clientsTable.name })
      .from(proformasTable).leftJoin(clientsTable, eq(proformasTable.clientId, clientsTable.id))
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, (req.params.id as string)))).limit(1);
    if (!rows[0]) { res.status(404).json({ error: "Devis introuvable" }); return; }

    const { pro, clientName } = rows[0];
    const lines = await getLines(orgId, "proforma", pro.id);
    const org = await getOrgBranding(orgId);

    const tpl = buildProformaEmail({
      org, refNumber: pro.referenceNumber, clientName: clientName ?? "Client",
      totalAmount: Number(pro.totalAmount ?? 0), lines: lines.map(lineToFront),
      notes: pro.notes, validUntil: pro.validUntil, paymentTerms: pro.paymentTerms, message,
    });
    tpl.to = to.trim();
    const result = await sendEmail(tpl);

    if (result.delivered) {
      await db.update(proformasTable).set({ status: pro.status === "draft" ? "sent" : pro.status })
        .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, pro.id)));
      await writeAudit(req, "proforma_email_sent", "proforma", pro.id, { to, provider: result.provider });
    }
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/orders/:id/send-email", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { to, message } = req.body as { to: string; message?: string };
    if (!to?.trim()) { res.status(400).json({ error: "Adresse email requise" }); return; }

    const rows = await db.select({ order: ordersTable, clientName: clientsTable.name })
      .from(ordersTable).leftJoin(clientsTable, eq(ordersTable.clientId, clientsTable.id))
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, (req.params.id as string)))).limit(1);
    if (!rows[0]) { res.status(404).json({ error: "Commande introuvable" }); return; }

    const { order, clientName } = rows[0];
    const lines = await getLines(orgId, "order", order.id);
    const org = await getOrgBranding(orgId);

    const tpl = buildOrderEmail({
      org, refNumber: order.referenceNumber, clientName: clientName ?? "Client",
      totalAmount: Number(order.totalAmount ?? 0), lines: lines.map(lineToFront), notes: order.notes, message,
    });
    tpl.to = to.trim();
    const result = await sendEmail(tpl);

    if (result.delivered) {
      await writeAudit(req, "order_email_sent", "order", order.id, { to, provider: result.provider });
    }
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/invoices/:id/send-email", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { to, message } = req.body as { to: string; message?: string };
    if (!to?.trim()) { res.status(400).json({ error: "Adresse email requise" }); return; }

    const rows = await db.select({ inv: invoicesTable, clientName: clientsTable.name, clientEmail: clientsTable.email })
      .from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string)))).limit(1);
    if (!rows[0]) { res.status(404).json({ error: "Facture introuvable" }); return; }

    const { inv, clientName } = rows[0];
    const lines = await getLines(orgId, "invoice", inv.id);
    const org = await getOrgBranding(orgId);

    const tpl = buildInvoiceEmail({
      org, refNumber: inv.referenceNumber, clientName: clientName ?? "Client",
      totalAmount: Number(inv.totalAmount ?? 0), lines: lines.map(lineToFront),
      notes: inv.notes, dueDate: inv.dueDate, message,
    });
    tpl.to = to.trim();
    const result = await sendEmail(tpl);

    if (result.delivered) {
      await writeAudit(req, "invoice_email_sent", "invoice", inv.id, { to, provider: result.provider });
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ─── RELANCE IMPAYÉS ──────────────────────────────────────────────────────────

router.post("/invoices/:id/remind", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { to: toOverride, message } = (req.body ?? {}) as { to?: string; message?: string };

    const rows = await db.select({
      inv: invoicesTable,
      clientName: clientsTable.name,
      clientEmail: clientsTable.email,
    })
      .from(invoicesTable)
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string))))
      .limit(1);

    if (!rows[0]) { res.status(404).json({ error: "Facture introuvable" }); return; }
    const { inv, clientName, clientEmail } = rows[0];
    if (!inv) { res.status(404).json({ error: "Facture introuvable" }); return; }

    const to = (toOverride?.trim() || clientEmail?.trim() || "");
    if (!to) { res.status(400).json({ error: "Adresse email introuvable — renseignez le champ 'to'" }); return; }

    if (!["pending", "overdue", "partially_paid", "sent"].includes(inv.status ?? "")) {
      res.status(422).json({ error: "Seules les factures en attente ou en retard peuvent faire l'objet d'une relance." });
      return;
    }

    const outstanding = (toNum(inv.totalAmount) ?? 0) - (toNum(inv.paidAmount) ?? 0);
    const org = await getOrgBranding(orgId);
    const orgName = org?.name ?? "Gameasu";
    const dueDateStr = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("fr-FR") : "—";
    const daysOverdue = inv.dueDate
      ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const emailMsg = {
      to,
      subject: `Relance de paiement — Facture ${inv.referenceNumber}`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#0f172a;padding:24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#C8A24B;font-size:20px">${orgName}</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">Relance de paiement</p>
  </div>
  <div style="padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <p style="margin:0 0 16px">Bonjour${clientName ? ` ${clientName}` : ""},</p>
    ${message ? `<p style="margin:0 0 16px">${message}</p>` : ""}
    <p style="margin:0 0 16px">Sauf erreur de notre part, la facture suivante reste impayée&nbsp;:</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
      <tr style="background:#f8fafc">
        <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600">Référence</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0">${inv.referenceNumber}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600">Échéance</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0;color:${daysOverdue > 0 ? "#dc2626" : "#1e293b"}">${dueDateStr}${daysOverdue > 0 ? ` (${daysOverdue} jour${daysOverdue > 1 ? "s" : ""} de retard)` : ""}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600">Reste à payer</td>
        <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:700;color:#2563EB">${new Intl.NumberFormat("fr-FR").format(outstanding)} FCFA</td>
      </tr>
    </table>
    <p style="margin:0 0 24px">Nous vous serions reconnaissants de bien vouloir procéder au règlement dans les meilleurs délais.</p>
    <p style="margin:0;color:#64748b;font-size:12px">Pour toute question, n'hésitez pas à nous contacter en répondant à cet email.<br>${orgName}</p>
  </div>
</div>`,
      text: `Relance de paiement — Facture ${inv.referenceNumber}\n\nBonjour${clientName ? ` ${clientName}` : ""},\n${message ? "\n" + message + "\n" : ""}\nReste à payer : ${new Intl.NumberFormat("fr-FR").format(outstanding)} FCFA\nÉchéance : ${dueDateStr}${daysOverdue > 0 ? ` (${daysOverdue} jour(s) de retard)` : ""}\n\nMerci de procéder au règlement.\n${orgName}`,
      category: "invoice_reminder",
    };

    const result = await sendEmail(emailMsg);

    if (result.delivered) {
      await writeAudit(req, "invoice_reminder_sent", "invoice", inv.id, {
        to, daysOverdue, outstanding, provider: result.provider,
      });
    }

    res.json({ ...result, to, daysOverdue, outstanding });
  } catch (e) { next(e); }
});

// ─── CREDIT NOTES / AVOIRS ────────────────────────────────────────────────────

router.get("/credit-notes", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { invoiceId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page); const limitNum = parseInt(limit);
    const base = and(eq(creditNotesTable.organizationId, orgId), invoiceId ? eq(creditNotesTable.invoiceId, invoiceId) : undefined);
    const rows = await db.select({ cn: creditNotesTable, clientName: clientsTable.name, invoiceRef: invoicesTable.referenceNumber })
      .from(creditNotesTable)
      .leftJoin(clientsTable, eq(creditNotesTable.clientId, clientsTable.id))
      .leftJoin(invoicesTable, eq(creditNotesTable.invoiceId, invoicesTable.id))
      .where(base).orderBy(desc(creditNotesTable.createdAt))
      .limit(limitNum).offset((pageNum - 1) * limitNum);
    const count = await db.select({ count: sql<number>`count(*)` }).from(creditNotesTable).where(base);
    res.json({
      data: rows.map(r => ({ ...r.cn, clientName: r.clientName, invoiceRef: r.invoiceRef, amount: toNum(r.cn.amount), appliedAmount: toNum(r.cn.appliedAmount) })),
      total: Number(count[0].count), page: pageNum, limit: limitNum,
    });
  } catch (e) { next(e); }
});

// ─── RELANCE RECOUVREMENT (avec log + dunning status) ────────────────────────
router.post("/invoices/:id/relance", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { subject, body, promiseDate, promiseAmount } = req.body as {
      subject?: string; body?: string; promiseDate?: string; promiseAmount?: number;
    };

    const rows = await db
      .select({ inv: invoicesTable, clientId: clientsTable.id, clientEmail: clientsTable.email, clientName: clientsTable.name })
      .from(invoicesTable)
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string))))
      .limit(1);

    if (!rows[0]) { res.status(404).json({ error: "Facture introuvable" }); return; }
    const { inv, clientId, clientEmail, clientName } = rows[0];

    const outstanding = (toNum(inv.totalAmount) ?? 0) - (toNum(inv.paidAmount) ?? 0);
    const todayISO = new Date().toISOString().slice(0, 10);

    // Update dunning fields on invoice
    const updatePayload: Record<string, any> = {
      dunningStatus: "relanced",
      lastDunnedAt: todayISO,
    };
    if (promiseDate) updatePayload["promisedPaymentDate"] = promiseDate;
    if (promiseAmount != null && promiseAmount > 0) updatePayload["promisedPaymentAmount"] = promiseAmount.toString();

    await db.update(invoicesTable).set(updatePayload)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, inv.id)));

    // Log to clientEmailLogs if clientId exists
    if (clientId) {
      const emailSubject = subject?.trim() || `Relance — Facture ${inv.referenceNumber}`;
      const emailBody = body?.trim() || `Relance de paiement pour la facture ${inv.referenceNumber} — solde dû : ${new Intl.NumberFormat("fr-FR").format(outstanding)} FCFA.`;
      await db.insert(clientEmailLogsTable).values({
        organizationId: orgId,
        clientId,
        direction: "outbound",
        subject: emailSubject,
        fromAddress: req.authUser!.email ?? "noreply@gameasutech.com",
        toAddress: clientEmail ?? "—",
        preview: emailBody.slice(0, 160),
        body: emailBody,
        status: "logged",
      });
    }

    await writeAudit(req, "invoice_relanced", "invoice", inv.id, {
      promiseDate, promiseAmount, outstanding,
    });

    return res.json({
      ok: true,
      invoiceId: inv.id,
      dunningStatus: "relanced",
      lastDunnedAt: todayISO,
      promisedPaymentDate: promiseDate ?? null,
      promisedPaymentAmount: promiseAmount ?? null,
    });
  } catch (e) { next(e); }
});

// ─── LIEN PUBLIC FACTURE ──────────────────────────────────────────────────────
router.post("/invoices/:id/generate-public-link", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string)))).limit(1);
    if (!inv) { res.status(404).json({ error: "Facture introuvable" }); return; }

    const token = inv.publicToken ?? randomUUID().replace(/-/g, "");
    if (!inv.publicToken) {
      await db.update(invoicesTable).set({ publicToken: token })
        .where(eq(invoicesTable.id, inv.id));
    }
    return res.json({ token, url: `/facture/${token}` });
  } catch (e) { next(e); }
});

// NOTE: GET /public/invoices/:token est dans orders-public.ts (route publique sans auth)

router.get("/invoices/:id/credit-notes", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(creditNotesTable)
      .where(and(eq(creditNotesTable.organizationId, orgId), eq(creditNotesTable.invoiceId, (req.params.id as string))))
      .orderBy(desc(creditNotesTable.createdAt));
    res.json({ data: rows.map(cn => ({ ...cn, amount: toNum(cn.amount), appliedAmount: toNum(cn.appliedAmount) })) });
  } catch (e) { next(e); }
});

router.post("/invoices/:id/credit-note", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { amount, reason, notes } = req.body;
    if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "Montant invalide" }); return; }
    if (!reason?.trim()) { res.status(400).json({ error: "Motif requis" }); return; }

    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, (req.params.id as string)))).limit(1);
    if (!inv) { res.status(404).json({ error: "Facture introuvable" }); return; }
    if (inv.status === "cancelled") { res.status(422).json({ error: "Impossible d'émettre un avoir sur une facture annulée" }); return; }

    const maxAmount = Number(inv.totalAmount ?? 0);
    if (Number(amount) > maxAmount) {
      res.status(422).json({ error: `Le montant de l'avoir (${amount}) ne peut pas dépasser le montant de la facture (${maxAmount})` });
      return;
    }

    const refNum = `AV-${Date.now().toString(36).toUpperCase()}`;
    const [cn] = await db.insert(creditNotesTable).values({
      organizationId: orgId,
      referenceNumber: refNum,
      invoiceId: inv.id,
      clientId: inv.clientId,
      reason: reason.trim(),
      amount: amount.toString(),
      appliedAmount: "0",
      currency: inv.currency ?? "XOF",
      status: "issued",
      notes: notes?.trim() || null,
    }).returning();

    await writeAudit(req, "credit_note_created", "invoice", inv.id, { creditNoteId: cn.id, refNum, amount, reason });

    res.status(201).json({ ...cn, amount: toNum(cn.amount), appliedAmount: toNum(cn.appliedAmount) });
  } catch (e) { next(e); }
});

router.post("/credit-notes/:id/apply", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [cn] = await db.select().from(creditNotesTable)
      .where(and(eq(creditNotesTable.organizationId, orgId), eq(creditNotesTable.id, (req.params.id as string)))).limit(1);
    if (!cn) { res.status(404).json({ error: "Note de crédit introuvable" }); return; }
    if (cn.status === "applied" || cn.status === "cancelled") {
      res.status(409).json({ error: "Cette note de crédit a déjà été appliquée ou annulée" }); return;
    }
    const cnAmount = Number(cn.amount);
    await db.execute(sql`
      UPDATE ${invoicesTable}
         SET total_amount = GREATEST(0, COALESCE(total_amount, 0) - ${cnAmount}),
             status = CASE
               WHEN COALESCE(paid_amount, 0) >= GREATEST(0, COALESCE(total_amount, 0) - ${cnAmount}) THEN 'paid'
               ELSE status
             END
       WHERE id = ${cn.invoiceId} AND organization_id = ${orgId}
    `);
    const [updated] = await db.update(creditNotesTable)
      .set({ status: "applied", appliedAmount: cn.amount })
      .where(eq(creditNotesTable.id, cn.id)).returning();
    await writeAudit(req, "credit_note_applied", "invoice", cn.invoiceId, { creditNoteId: cn.id, amount: cnAmount });
    res.json({ ...updated, amount: toNum(updated.amount), appliedAmount: toNum(updated.appliedAmount) });
  } catch (e) { next(e); }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function writeAudit(
  req: any,
  action: string,
  entityType: string,
  entityId: string,
  payload: { before?: unknown; after?: unknown; reason?: string; [k: string]: unknown },
) {
  const orgId = req.authUser?.organizationId;
  if (!orgId) return;
  try {
    await db.insert(auditLogsTable).values({
      organizationId: orgId,
      userId: req.authUser?.id ?? null,
      userEmail: req.authUser?.email ?? null,
      action,
      entityType,
      entityId: entityId as any,
      payload: payload as any,
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
  } catch (e: any) {
    logger.warn({ err: e }, "[audit] write failed");
  }
}

export default router;
