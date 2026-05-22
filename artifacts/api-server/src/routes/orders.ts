import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, proformasTable, invoicesTable, paymentsTable, clientsTable, auditLogsTable } from "@workspace/db";
import { eq, sql, isNull, and, desc } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";
import { postCustomerInvoice, postCustomerPayment } from "../services/postings";
import { logger } from "../lib/logger";

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

router.post("/orders", requireManagerOrAbove, async (req, res) => {
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
    .where(and(eq(ordersTable.organizationId, req.authUser!.organizationId), eq(ordersTable.id, req.params.id))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].order, clientName: rows[0].clientName, totalAmount: toNum(rows[0].order.totalAmount) });
});

router.put("/orders/:id", requireManagerOrAbove, async (req, res) => {
  const { clientId, status, totalAmount, currency, notes, attachmentUrl } = req.body;
  const [order] = await db.update(ordersTable).set({ clientId, status, totalAmount: totalAmount?.toString(), currency, notes, attachmentUrl }).where(and(eq(ordersTable.organizationId, req.authUser!.organizationId), eq(ordersTable.id, req.params.id))).returning();
  if (!order) return res.status(404).json({ error: "Not found" });
  return res.json({ ...order, totalAmount: toNum(order.totalAmount) });
});

router.delete("/orders/:id", async (req, res) => {
  await db.update(ordersTable).set({ deletedAt: new Date() }).where(and(eq(ordersTable.organizationId, req.authUser!.organizationId), eq(ordersTable.id, req.params.id)));
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

router.post("/proformas", requireManagerOrAbove, async (req, res) => {
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
    .where(and(eq(proformasTable.organizationId, req.authUser!.organizationId), eq(proformasTable.id, req.params.id))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].pro, clientName: rows[0].clientName, totalAmount: toNum(rows[0].pro.totalAmount) });
});

router.put("/proformas/:id", requireManagerOrAbove, async (req, res) => {
  const { orderId, clientId, status, totalAmount, currency, validUntil, notes, caution, paymentTerms, durationDays } = req.body;
  const before = (await db.select().from(proformasTable).where(and(eq(proformasTable.organizationId, req.authUser!.organizationId), eq(proformasTable.id, req.params.id))).limit(1))[0];
  if (!before) return res.status(404).json({ error: "Not found" });

  const [pro] = await db.update(proformasTable).set({
    orderId, clientId, status, totalAmount: totalAmount?.toString(), currency, validUntil, notes,
    caution: caution?.toString(), paymentTerms, durationDays,
  }).where(and(eq(proformasTable.organizationId, req.authUser!.organizationId), eq(proformasTable.id, req.params.id))).returning();

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

router.post("/invoices", requireManagerOrAbove, async (req, res) => {
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
    .where(and(eq(invoicesTable.organizationId, req.authUser!.organizationId), eq(invoicesTable.id, req.params.id))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].inv, clientName: rows[0].clientName, totalAmount: toNum(rows[0].inv.totalAmount), paidAmount: toNum(rows[0].inv.paidAmount) });
});

router.put("/invoices/:id", requireManagerOrAbove, async (req, res) => {
  const { proformaId, clientId, status, totalAmount, currency, dueDate, notes } = req.body;
  const before = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.organizationId, req.authUser!.organizationId), eq(invoicesTable.id, req.params.id))).limit(1))[0];
  const [inv] = await db.update(invoicesTable).set({ proformaId, clientId, status, totalAmount: totalAmount?.toString(), currency, dueDate, notes }).where(and(eq(invoicesTable.organizationId, req.authUser!.organizationId), eq(invoicesTable.id, req.params.id))).returning();
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
  const { invoiceId, clientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const orgFilter = eq(paymentsTable.organizationId, req.authUser!.organizationId);
  const data = await db.select().from(paymentsTable).where(orgFilter).limit(limitNum).offset(offset);
  const count = await db.select({ count: sql<number>`count(*)` }).from(paymentsTable).where(orgFilter);
  return res.json({
    data: data.map(p => ({ ...p, amount: toNum(p.amount) })),
    total: Number(count[0].count), page: pageNum, limit: limitNum,
  });
});

router.post("/payments", requireManagerOrAbove, async (req, res) => {
  const { invoiceId, amount, currency, method, reference, paidAt, notes, bankAccountId } = req.body;
  const [payment] = await db.insert(paymentsTable).values({
    organizationId: req.authUser!.organizationId,
    invoiceId, amount: amount.toString(), currency, method, reference,
    paidAt: paidAt ? new Date(paidAt) : new Date(), notes,
  }).returning();

  // Cumul atomique du paid_amount via SQL : empêche les écrasements concurrents
  // (lost update) si plusieurs règlements arrivent simultanément.
  const updated = await db.execute(sql`
    UPDATE ${invoicesTable}
       SET paid_amount = COALESCE(paid_amount, 0) + ${Number(amount)},
           status = CASE
             WHEN COALESCE(paid_amount, 0) + ${Number(amount)} >= COALESCE(total_amount, 0) THEN 'paid'
             ELSE 'partially_paid'
           END
     WHERE id = ${invoiceId}
       AND organization_id = ${req.authUser!.organizationId}
  `);

  // Comptabilisation automatique du règlement.
  try {
    await postCustomerPayment(req.authUser!.organizationId, payment.id, { bankAccountId, userId: req.authUser?.id });
  } catch (e: any) {
    logger.error({ err: e, paymentId: payment.id }, "Échec comptabilisation règlement");
    return res.status(500).json({ error: "Comptabilisation impossible", detail: e.message, paymentId: payment.id });
  }

  return res.status(201).json({ ...payment, amount: toNum(payment.amount) });
});

// ─── GET /clients/:id/commercial ─────────────────────────────────────────────
router.get("/clients/:id/commercial", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const clientId = req.params.id;

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
router.post("/proformas/:id/generate-invoice", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [pro] = await db.select().from(proformasTable)
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, req.params.id))).limit(1);
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
router.post("/orders/:id/generate-invoice", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, req.params.id))).limit(1);
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
router.patch("/orders/:id/edit", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, req.params.id))).limit(1);
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
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, req.params.id))).returning();

    await writeAudit(req, "order_edit", "order", order.id, { before, after: patch, reason: req.body.reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount) });
  } catch (e) { next(e); }
});

// ─── POST /orders/:id/cancel — Annulation avec règles métier ────────────────
router.post("/orders/:id/cancel", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = req.body;
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, req.params.id))).limit(1);
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
      .where(and(eq(ordersTable.organizationId, orgId), eq(ordersTable.id, req.params.id))).returning();

    await writeAudit(req, "order_cancel", "order", order.id, { before: { status: order.status }, after: { status: "cancelled" }, reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount) });
  } catch (e) { next(e); }
});

// ─── PATCH /proformas/:id/edit — Modification avec règles métier ─────────────
router.patch("/proformas/:id/edit", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [pro] = await db.select().from(proformasTable)
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, req.params.id))).limit(1);
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
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, req.params.id))).returning();

    await writeAudit(req, "proforma_edit", "proforma", pro.id, { before, after: patch, reason: req.body.reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount), caution: toNum(updated.caution) });
  } catch (e) { next(e); }
});

// ─── POST /proformas/:id/cancel — Annulation avec règles métier ──────────────
router.post("/proformas/:id/cancel", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = req.body;
    const [pro] = await db.select().from(proformasTable)
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, req.params.id))).limit(1);
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
      .where(and(eq(proformasTable.organizationId, orgId), eq(proformasTable.id, req.params.id))).returning();

    await writeAudit(req, "proforma_cancel", "proforma", pro.id, { before: { status: pro.status }, after: { status: "cancelled" }, reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount), caution: toNum(updated.caution) });
  } catch (e) { next(e); }
});

// ─── PATCH /invoices/:id/edit — Modification avec règles métier ──────────────
router.patch("/invoices/:id/edit", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, req.params.id))).limit(1);
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
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, req.params.id))).returning();

    await writeAudit(req, "invoice_edit", "invoice", inv.id, { before, after: patch, reason: req.body.reason });

    res.json({ ...updated, totalAmount: toNum(updated.totalAmount), paidAmount: toNum(updated.paidAmount) });
  } catch (e) { next(e); }
});

// ─── POST /invoices/:id/cancel — Annulation avec règles métier ───────────────
router.post("/invoices/:id/cancel", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = req.body;
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, req.params.id))).limit(1);
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
      .where(and(eq(invoicesTable.organizationId, orgId), eq(invoicesTable.id, req.params.id))).returning();

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
