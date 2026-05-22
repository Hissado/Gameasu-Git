import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, clientContactsTable, clientEmailLogsTable,
  ordersTable, proformasTable, invoicesTable, paymentsTable,
  projectsTable, conversationsTable,
} from "@workspace/db";
import { and, eq, ilike, sql, isNull, inArray, desc } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { userAccessibleClientIds, userHasClientAccess } from "../lib/rbac/permissions";

const router = Router();

router.get("/clients", requirePermission("clients.read"), async (req, res) => {
  const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const accessible = req.authUser ? await userAccessibleClientIds(req.authUser.id) : [];
  const conds: any[] = [
    eq(clientsTable.organizationId, req.authUser!.organizationId),
    isNull(clientsTable.deletedAt),
  ];
  if (accessible !== null) {
    if (accessible.length === 0) {
      res.json({ data: [], total: 0, page: pageNum, limit: limitNum }); return;
    }
    conds.push(inArray(clientsTable.id, accessible));
  }
  if (search) conds.push(ilike(clientsTable.name, `%${search}%`));
  const where = and(...conds);

  const data = await db.select().from(clientsTable).where(where).limit(limitNum).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(clientsTable).where(where);
  res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum }); return;
});

router.post("/clients", requirePermission("clients.manage"), async (req, res) => {
  const { name, email, phone, industry, address, website, status } = req.body;
  const [client] = await db.insert(clientsTable).values({
    organizationId: req.authUser!.organizationId, name, email, phone, industry, address, website, status: status || "prospect",
  }).returning();
  res.status(201).json(client); return;
});

router.get("/clients/:id", requirePermission("clients.read"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, req.params.id))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  const clients = await db.select().from(clientsTable).where(and(
    eq(clientsTable.organizationId, req.authUser!.organizationId),
    eq(clientsTable.id, req.params.id),
  )).limit(1);
  if (!clients[0]) { res.status(404).json({ error: "Not found" }); return; }
  const contacts = await db.select().from(clientContactsTable).where(and(
    eq(clientContactsTable.organizationId, req.authUser!.organizationId),
    eq(clientContactsTable.clientId, req.params.id),
  ));
  res.json({ ...clients[0], contacts, projectsCount: 0, ordersCount: 0, totalRevenue: 0 }); return;
});

router.put("/clients/:id", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, req.params.id))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  const { name, email, phone, industry, address, website, status } = req.body;
  const [client] = await db.update(clientsTable).set({ name, email, phone, industry, address, website, status }).where(and(
    eq(clientsTable.organizationId, req.authUser!.organizationId),
    eq(clientsTable.id, req.params.id),
  )).returning();
  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client); return;
});

router.delete("/clients/:id", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, req.params.id))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  await db.update(clientsTable).set({ deletedAt: new Date() }).where(and(
    eq(clientsTable.organizationId, req.authUser!.organizationId),
    eq(clientsTable.id, req.params.id),
  ));
  res.status(204).send(); return;
});

router.get("/clients/:id/contacts", requirePermission("clients.read"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, req.params.id))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  const contacts = await db.select().from(clientContactsTable).where(and(
    eq(clientContactsTable.organizationId, req.authUser!.organizationId),
    eq(clientContactsTable.clientId, req.params.id),
  ));
  res.json(contacts); return;
});

router.post("/clients/:id/contacts", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, req.params.id))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  const { firstName, lastName, email, phone, role, isPrimary } = req.body;
  const [contact] = await db.insert(clientContactsTable).values({
    organizationId: req.authUser!.organizationId,
    clientId: req.params.id, firstName, lastName, email, phone, role,
    isPrimary: isPrimary ? "true" : "false",
  }).returning();
  res.status(201).json({ ...contact, isPrimary: contact.isPrimary === "true" }); return;
});

// ── Emails ──────────────────────────────────────────────────────────────────

router.get("/clients/:id/emails", requirePermission("clients.read"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, req.params.id))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const emails = await db.select().from(clientEmailLogsTable)
    .where(eq(clientEmailLogsTable.clientId, req.params.id))
    .orderBy(desc(clientEmailLogsTable.sentAt))
    .limit(100);
  res.json({ data: emails }); return;
});

router.post("/clients/:id/emails/send", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, req.params.id))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.params.id)).limit(1);
  if (!client) { res.status(404).json({ error: "Client introuvable" }); return; }

  const { subject, body, toAddress } = req.body || {};
  if (!subject || !body) { res.status(400).json({ error: "Sujet et corps requis" }); return; }

  const [log] = await db.insert(clientEmailLogsTable).values({
    organizationId: req.authUser!.organizationId,
    clientId: req.params.id,
    direction: "outbound",
    subject,
    fromAddress: "noreply@gameasù.com",
    toAddress: toAddress || client.email || "",
    preview: body.slice(0, 200),
    body,
    status: "sent",
    sentAt: new Date(),
  }).returning();
  res.status(201).json(log); return;
});

// ── Activity timeline ────────────────────────────────────────────────────────

router.get("/clients/:id/activity", requirePermission("clients.read"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, req.params.id))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const clientId = req.params.id;
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
  if (!client) { res.status(404).json({ error: "Client introuvable" }); return; }

  const [orders, proformas, invoices, payments, projects, conversations, emails] = await Promise.all([
    db.select({ id: ordersTable.id, ref: ordersTable.referenceNumber, createdAt: ordersTable.createdAt, amount: ordersTable.totalAmount })
      .from(ordersTable)
      .where(and(eq(ordersTable.clientId, clientId), isNull(ordersTable.deletedAt)))
      .orderBy(desc(ordersTable.createdAt)).limit(30),
    db.select({ id: proformasTable.id, ref: proformasTable.referenceNumber, createdAt: proformasTable.createdAt, amount: proformasTable.totalAmount })
      .from(proformasTable)
      .where(eq(proformasTable.clientId, clientId))
      .orderBy(desc(proformasTable.createdAt)).limit(30),
    db.select({ id: invoicesTable.id, ref: invoicesTable.referenceNumber, createdAt: invoicesTable.createdAt, amount: invoicesTable.totalAmount })
      .from(invoicesTable)
      .where(eq(invoicesTable.clientId, clientId))
      .orderBy(desc(invoicesTable.createdAt)).limit(30),
    db.select({ id: paymentsTable.id, amount: paymentsTable.amount, createdAt: paymentsTable.createdAt, reference: paymentsTable.reference })
      .from(paymentsTable)
      .innerJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
      .where(eq(invoicesTable.clientId, clientId))
      .orderBy(desc(paymentsTable.createdAt)).limit(30),
    db.select({ id: projectsTable.id, name: projectsTable.name, createdAt: projectsTable.createdAt })
      .from(projectsTable)
      .where(and(eq(projectsTable.clientId, clientId), isNull(projectsTable.deletedAt)))
      .orderBy(desc(projectsTable.createdAt)).limit(20),
    db.select({ id: conversationsTable.id, title: conversationsTable.title, createdAt: conversationsTable.createdAt })
      .from(conversationsTable)
      .where(eq(conversationsTable.clientId, clientId))
      .orderBy(desc(conversationsTable.createdAt)).limit(10),
    db.select({ id: clientEmailLogsTable.id, subject: clientEmailLogsTable.subject, direction: clientEmailLogsTable.direction, sentAt: clientEmailLogsTable.sentAt })
      .from(clientEmailLogsTable)
      .where(eq(clientEmailLogsTable.clientId, clientId))
      .orderBy(desc(clientEmailLogsTable.sentAt)).limit(30),
  ]);

  type ActivityEvent = { id: string; type: string; label: string; createdAt: Date | string; meta: Record<string, unknown> };
  const events: ActivityEvent[] = [
    { id: `client-created`, type: "client_created", label: "Fiche client créée", createdAt: client.createdAt, meta: {} },
    ...orders.map(o => ({ id: `ord-${o.id}`, type: "order_created", label: `Commande ${o.ref} créée`, createdAt: o.createdAt, meta: { id: o.id, amount: o.amount } })),
    ...proformas.map(p => ({ id: `pro-${p.id}`, type: "proforma_created", label: `Devis ${p.ref} créé`, createdAt: p.createdAt, meta: { id: p.id, amount: p.amount } })),
    ...invoices.map(i => ({ id: `inv-${i.id}`, type: "invoice_created", label: `Facture ${i.ref} créée`, createdAt: i.createdAt, meta: { id: i.id, amount: i.amount } })),
    ...payments.map(p => ({ id: `pay-${p.id}`, type: "payment_recorded", label: `Encaissement enregistré${p.reference ? ` — Réf. ${p.reference}` : ""}`, createdAt: p.createdAt, meta: { id: p.id, amount: p.amount } })),
    ...projects.map(p => ({ id: `prj-${p.id}`, type: "project_created", label: `Projet « ${p.name} » créé`, createdAt: p.createdAt, meta: { id: p.id } })),
    ...conversations.map(c => ({ id: `conv-${c.id}`, type: "conversation_created", label: `Groupe « ${c.title ?? "Discussion"} » créé`, createdAt: c.createdAt, meta: { id: c.id } })),
    ...emails.map(e => ({ id: `email-${e.id}`, type: e.direction === "inbound" ? "email_received" : "email_sent", label: e.direction === "inbound" ? `Email reçu : ${e.subject}` : `Email envoyé : ${e.subject}`, createdAt: e.sentAt, meta: { id: e.id } })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ data: events }); return;
});

export default router;
