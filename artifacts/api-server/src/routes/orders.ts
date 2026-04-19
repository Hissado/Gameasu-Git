import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, proformasTable, invoicesTable, paymentsTable, clientsTable } from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";

const router = Router();

const toNum = (v: string | null | undefined) => v ? Number(v) : null;

// ORDERS
router.get("/orders", async (req, res) => {
  const { status, clientId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({ order: ordersTable, clientName: clientsTable.name })
    .from(ordersTable)
    .leftJoin(clientsTable, eq(ordersTable.clientId, clientsTable.id))
    .where(isNull(ordersTable.deletedAt)).limit(limitNum).offset(offset);

  const data = rows.map(r => ({ ...r.order, clientName: r.clientName, totalAmount: toNum(r.order.totalAmount) }));
  const count = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(isNull(ordersTable.deletedAt));
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/orders", async (req, res) => {
  const { clientId, status, totalAmount, currency, notes } = req.body;
  const refNum = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const [order] = await db.insert(ordersTable).values({ referenceNumber: refNum, clientId, status: status || "draft", totalAmount: totalAmount?.toString(), currency, notes }).returning();
  return res.status(201).json({ ...order, totalAmount: toNum(order.totalAmount) });
});

router.get("/orders/financial-summary", async (req, res) => {
  const orders = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));
  const proformas = await db.select().from(proformasTable);
  const invoices = await db.select().from(invoicesTable);
  const payments = await db.select().from(paymentsTable);

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
    .where(eq(ordersTable.id, req.params.id)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].order, clientName: rows[0].clientName, totalAmount: toNum(rows[0].order.totalAmount) });
});

router.put("/orders/:id", async (req, res) => {
  const { clientId, status, totalAmount, currency, notes } = req.body;
  const [order] = await db.update(ordersTable).set({ clientId, status, totalAmount: totalAmount?.toString(), currency, notes }).where(eq(ordersTable.id, req.params.id)).returning();
  if (!order) return res.status(404).json({ error: "Not found" });
  return res.json({ ...order, totalAmount: toNum(order.totalAmount) });
});

router.delete("/orders/:id", async (req, res) => {
  await db.update(ordersTable).set({ deletedAt: new Date() }).where(eq(ordersTable.id, req.params.id));
  return res.status(204).send();
});

// PROFORMAS
router.get("/proformas", async (req, res) => {
  const { status, clientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({ pro: proformasTable, clientName: clientsTable.name })
    .from(proformasTable).leftJoin(clientsTable, eq(proformasTable.clientId, clientsTable.id))
    .limit(limitNum).offset(offset);
  const data = rows.map(r => ({ ...r.pro, clientName: r.clientName, totalAmount: toNum(r.pro.totalAmount) }));
  const count = await db.select({ count: sql<number>`count(*)` }).from(proformasTable);
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/proformas", async (req, res) => {
  const { orderId, clientId, status, totalAmount, currency, validUntil, notes } = req.body;
  const refNum = `PRO-${Date.now().toString(36).toUpperCase()}`;
  const [pro] = await db.insert(proformasTable).values({ referenceNumber: refNum, orderId, clientId, status: status || "draft", totalAmount: totalAmount?.toString(), currency, validUntil, notes }).returning();
  return res.status(201).json({ ...pro, totalAmount: toNum(pro.totalAmount) });
});

router.get("/proformas/:id", async (req, res) => {
  const rows = await db.select({ pro: proformasTable, clientName: clientsTable.name })
    .from(proformasTable).leftJoin(clientsTable, eq(proformasTable.clientId, clientsTable.id))
    .where(eq(proformasTable.id, req.params.id)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].pro, clientName: rows[0].clientName, totalAmount: toNum(rows[0].pro.totalAmount) });
});

router.put("/proformas/:id", async (req, res) => {
  const { orderId, clientId, status, totalAmount, currency, validUntil, notes } = req.body;
  const [pro] = await db.update(proformasTable).set({ orderId, clientId, status, totalAmount: totalAmount?.toString(), currency, validUntil, notes }).where(eq(proformasTable.id, req.params.id)).returning();
  if (!pro) return res.status(404).json({ error: "Not found" });
  return res.json({ ...pro, totalAmount: toNum(pro.totalAmount) });
});

// INVOICES
router.get("/invoices", async (req, res) => {
  const { status, clientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({ inv: invoicesTable, clientName: clientsTable.name })
    .from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .limit(limitNum).offset(offset);
  const data = rows.map(r => ({ ...r.inv, clientName: r.clientName, totalAmount: toNum(r.inv.totalAmount), paidAmount: toNum(r.inv.paidAmount) }));
  const count = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable);
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/invoices", async (req, res) => {
  const { proformaId, clientId, status, totalAmount, currency, dueDate, notes } = req.body;
  const refNum = `INV-${Date.now().toString(36).toUpperCase()}`;
  const [inv] = await db.insert(invoicesTable).values({ referenceNumber: refNum, proformaId, clientId, status: status || "draft", totalAmount: totalAmount?.toString(), currency, dueDate, notes }).returning();
  return res.status(201).json({ ...inv, totalAmount: toNum(inv.totalAmount), paidAmount: toNum(inv.paidAmount) });
});

router.get("/invoices/:id", async (req, res) => {
  const rows = await db.select({ inv: invoicesTable, clientName: clientsTable.name })
    .from(invoicesTable).leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(eq(invoicesTable.id, req.params.id)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].inv, clientName: rows[0].clientName, totalAmount: toNum(rows[0].inv.totalAmount), paidAmount: toNum(rows[0].inv.paidAmount) });
});

router.put("/invoices/:id", async (req, res) => {
  const { proformaId, clientId, status, totalAmount, currency, dueDate, notes } = req.body;
  const [inv] = await db.update(invoicesTable).set({ proformaId, clientId, status, totalAmount: totalAmount?.toString(), currency, dueDate, notes }).where(eq(invoicesTable.id, req.params.id)).returning();
  if (!inv) return res.status(404).json({ error: "Not found" });
  return res.json({ ...inv, totalAmount: toNum(inv.totalAmount), paidAmount: toNum(inv.paidAmount) });
});

// PAYMENTS
router.get("/payments", async (req, res) => {
  const { invoiceId, clientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const data = await db.select().from(paymentsTable).limit(limitNum).offset(offset);
  const count = await db.select({ count: sql<number>`count(*)` }).from(paymentsTable);
  return res.json({
    data: data.map(p => ({ ...p, amount: toNum(p.amount) })),
    total: Number(count[0].count), page: pageNum, limit: limitNum,
  });
});

router.post("/payments", async (req, res) => {
  const { invoiceId, amount, currency, method, reference, paidAt, notes } = req.body;
  const [payment] = await db.insert(paymentsTable).values({
    invoiceId, amount: amount.toString(), currency, method, reference,
    paidAt: paidAt ? new Date(paidAt) : new Date(), notes,
  }).returning();

  await db.update(invoicesTable)
    .set({ paidAmount: amount.toString(), status: "paid" })
    .where(eq(invoicesTable.id, invoiceId));

  return res.status(201).json({ ...payment, amount: toNum(payment.amount) });
});

export default router;
