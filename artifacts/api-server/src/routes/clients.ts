import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, clientContactsTable, clientEmailLogsTable, clientNotesTable,
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
  const {
    name, email, email2, phone, phone2, whatsapp, industry, address, website, status,
    type, commercialName, contactTitle, contactName, contactFunction, contactPhotoUrl,
    country, region, city, commune, quartier, rue, postalCode, gpsLat, gpsLng,
    billingAddress, shippingAddress,
    ifu, rccm, vatNumber, statisticNumber, companySize, foundedDate, employeeCount,
    preferredCurrency, preferredLanguage,
    assignedUserId, source, category, segment, acquisitionChannel, priority, potential,
    firstContactDate, conversionDate,
    creditLimit, paymentTermsDays, paymentConditions, preferredPaymentMode,
    vatExempt, discountRate, specialConditions, customFields, logoUrl,
  } = req.body;
  const [client] = await db.insert(clientsTable).values({
    organizationId: req.authUser!.organizationId,
    name, email, email2, phone, phone2, whatsapp, industry, address, website,
    status: status || "prospect", type: type || "entreprise", commercialName,
    contactTitle, contactName, contactFunction, contactPhotoUrl, logoUrl,
    country, region, city, commune, quartier, rue, postalCode, gpsLat, gpsLng,
    billingAddress: billingAddress ?? null, shippingAddress: shippingAddress ?? null,
    ifu, rccm, vatNumber, statisticNumber, companySize, foundedDate,
    employeeCount: employeeCount ? Number(employeeCount) : null,
    preferredCurrency: preferredCurrency || "XOF", preferredLanguage: preferredLanguage || "fr",
    assignedUserId: assignedUserId || null, source, category, segment, acquisitionChannel,
    priority: priority || "normale", potential, firstContactDate, conversionDate,
    creditLimit: creditLimit ? String(creditLimit) : null,
    paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : 30,
    paymentConditions, preferredPaymentMode,
    vatExempt: vatExempt === true || vatExempt === "true",
    discountRate: discountRate ? String(discountRate) : null,
    specialConditions, customFields: customFields ?? null,
  }).returning();
  res.status(201).json(client); return;
});

router.get("/clients/:id", requirePermission("clients.read"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  const clients = await db.select().from(clientsTable).where(and(
    eq(clientsTable.organizationId, req.authUser!.organizationId),
    eq(clientsTable.id, (req.params.id as string)),
  )).limit(1);
  if (!clients[0]) { res.status(404).json({ error: "Not found" }); return; }
  const contacts = await db.select().from(clientContactsTable).where(and(
    eq(clientContactsTable.organizationId, req.authUser!.organizationId),
    eq(clientContactsTable.clientId, (req.params.id as string)),
  ));
  res.json({ ...clients[0], contacts, projectsCount: 0, ordersCount: 0, totalRevenue: 0 }); return;
});

router.put("/clients/:id", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  const b = req.body;
  const update: Record<string, unknown> = {};
  const str = (v: any) => v !== undefined ? (v === "" ? null : v) : undefined;
  const num = (v: any) => v !== undefined ? (v === "" || v === null ? null : Number(v)) : undefined;

  const textFields = [
    "name","email","email2","phone","phone2","whatsapp","industry","address","website","status",
    "type","commercialName","contactTitle","contactName","contactFunction","contactPhotoUrl","logoUrl",
    "country","region","city","commune","quartier","rue","postalCode","gpsLat","gpsLng",
    "ifu","rccm","vatNumber","statisticNumber","companySize","foundedDate",
    "preferredCurrency","preferredLanguage","source","category","segment","acquisitionChannel",
    "priority","potential","firstContactDate","conversionDate","paymentConditions",
    "preferredPaymentMode","specialConditions",
  ] as const;
  for (const f of textFields) if (b[f] !== undefined) update[f] = str(b[f]);

  if (b.employeeCount !== undefined) update.employeeCount = num(b.employeeCount);
  if (b.creditLimit !== undefined) update.creditLimit = b.creditLimit === "" || b.creditLimit === null ? null : String(b.creditLimit);
  if (b.paymentTermsDays !== undefined) update.paymentTermsDays = num(b.paymentTermsDays);
  if (b.discountRate !== undefined) update.discountRate = b.discountRate === "" || b.discountRate === null ? null : String(b.discountRate);
  if (b.vatExempt !== undefined) update.vatExempt = b.vatExempt === true || b.vatExempt === "true";
  if (b.billingAddress !== undefined) update.billingAddress = b.billingAddress ?? null;
  if (b.shippingAddress !== undefined) update.shippingAddress = b.shippingAddress ?? null;
  if (b.customFields !== undefined) update.customFields = b.customFields ?? null;
  if (b.assignedUserId !== undefined) update.assignedUserId = b.assignedUserId || null;

  const [client] = await db.update(clientsTable).set(update).where(and(
    eq(clientsTable.organizationId, req.authUser!.organizationId),
    eq(clientsTable.id, (req.params.id as string)),
  )).returning();
  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client); return;
});

// ── Credit Risk ──────────────────────────────────────────────────────────────

router.get("/clients/:id/credit-risk", requirePermission("clients.read"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const [client] = await db.select({
    id: clientsTable.id, creditLimit: clientsTable.creditLimit, paymentTermsDays: clientsTable.paymentTermsDays,
  }).from(clientsTable).where(and(
    eq(clientsTable.organizationId, req.authUser!.organizationId),
    eq(clientsTable.id, (req.params.id as string)),
  )).limit(1);
  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const invoices = await db.select({
    id: invoicesTable.id, status: invoicesTable.status,
    totalAmount: invoicesTable.totalAmount, paidAmount: invoicesTable.paidAmount,
    dueDate: invoicesTable.dueDate,
  }).from(invoicesTable).where(and(
    eq(invoicesTable.organizationId, req.authUser!.organizationId),
    eq(invoicesTable.clientId, (req.params.id as string)),
  ));

  const now = Date.now();
  let encours = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  for (const inv of invoices) {
    if (["paid", "cancelled"].includes(inv.status)) continue;
    const remaining = (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0);
    encours += remaining;
    if (inv.dueDate && new Date(inv.dueDate).getTime() < now) {
      overdueAmount += remaining;
      overdueCount++;
    }
  }

  const limit = client.creditLimit ? Number(client.creditLimit) : null;
  const utilisationPct = limit && limit > 0 ? Math.round((encours / limit) * 100) : null;

  let riskScore: "low" | "medium" | "high" | "critical";
  if (overdueAmount > 0 && overdueCount >= 2) riskScore = "critical";
  else if (overdueAmount > 0) riskScore = "high";
  else if (utilisationPct !== null && utilisationPct >= 80) riskScore = "medium";
  else riskScore = "low";

  res.json({
    encours, overdueAmount, overdueCount,
    creditLimit: limit, paymentTermsDays: client.paymentTermsDays,
    utilisationPct, riskScore,
  }); return;
});

router.delete("/clients/:id", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  await db.update(clientsTable).set({ deletedAt: new Date() }).where(and(
    eq(clientsTable.organizationId, req.authUser!.organizationId),
    eq(clientsTable.id, (req.params.id as string)),
  ));
  res.status(204).send(); return;
});

router.get("/clients/:id/contacts", requirePermission("clients.read"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  const contacts = await db.select().from(clientContactsTable).where(and(
    eq(clientContactsTable.organizationId, req.authUser!.organizationId),
    eq(clientContactsTable.clientId, (req.params.id as string)),
  ));
  res.json(contacts); return;
});

router.post("/clients/:id/contacts", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé à ce client" }); return;
  }
  const { title, firstName, lastName, email, phone, whatsapp, function: fn, role, isPrimary, notes } = req.body;
  const [contact] = await db.insert(clientContactsTable).values({
    organizationId: req.authUser!.organizationId,
    clientId: (req.params.id as string),
    title: title || null, firstName, lastName, email: email || null,
    phone: phone || null, whatsapp: whatsapp || null,
    function: fn || null, role: role || null, notes: notes || null,
    isPrimary: isPrimary === true || isPrimary === "true" ? "true" : "false",
  }).returning();
  res.status(201).json(contact); return;
});

router.put("/clients/:id/contacts/:contactId", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const { title, firstName, lastName, email, phone, whatsapp, function: fn, role, isPrimary, notes } = req.body;
  const [contact] = await db.update(clientContactsTable)
    .set({
      title: title ?? null, firstName, lastName, email: email ?? null,
      phone: phone ?? null, whatsapp: whatsapp ?? null,
      function: fn ?? null, role: role ?? null, notes: notes ?? null,
      isPrimary: isPrimary === true || isPrimary === "true" ? "true" : "false",
    })
    .where(and(
      eq(clientContactsTable.id, (req.params.contactId as string)),
      eq(clientContactsTable.clientId, (req.params.id as string)),
      eq(clientContactsTable.organizationId, req.authUser!.organizationId),
    ))
    .returning();
  if (!contact) { res.status(404).json({ error: "Contact introuvable" }); return; }
  res.json(contact); return;
});

router.delete("/clients/:id/contacts/:contactId", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  await db.delete(clientContactsTable)
    .where(and(
      eq(clientContactsTable.id, (req.params.contactId as string)),
      eq(clientContactsTable.clientId, (req.params.id as string)),
      eq(clientContactsTable.organizationId, req.authUser!.organizationId),
    ));
  res.status(204).end(); return;
});

// ── Emails ──────────────────────────────────────────────────────────────────

router.get("/clients/:id/emails", requirePermission("clients.read"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const emails = await db.select().from(clientEmailLogsTable)
    .where(eq(clientEmailLogsTable.clientId, (req.params.id as string)))
    .orderBy(desc(clientEmailLogsTable.sentAt))
    .limit(100);
  res.json({ data: emails }); return;
});

router.post("/clients/:id/emails/send", requirePermission("clients.manage"), async (req, res) => {
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, (req.params.id as string))).limit(1);
  if (!client) { res.status(404).json({ error: "Client introuvable" }); return; }

  const { subject, body, toAddress } = req.body || {};
  if (!subject || !body) { res.status(400).json({ error: "Sujet et corps requis" }); return; }

  const [log] = await db.insert(clientEmailLogsTable).values({
    organizationId: req.authUser!.organizationId,
    clientId: (req.params.id as string),
    direction: "outbound",
    subject,
    fromAddress: "noreply@gameasu.com",
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
  if (req.authUser && !(await userHasClientAccess(req.authUser.id, (req.params.id as string)))) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const clientId = (req.params.id as string);
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

// ─── Notes ────────────────────────────────────────────────────────────────────
router.get("/clients/:id/notes", requirePermission("clients.read"), async (req, res) => {
  const clientId = (req.params.id as string);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
  if (!client) { res.status(404).json({ error: "Client introuvable" }); return; }
  const notes = await db.select().from(clientNotesTable)
    .where(eq(clientNotesTable.clientId, clientId))
    .orderBy(desc(clientNotesTable.pinned), desc(clientNotesTable.createdAt));
  res.json({ data: notes }); return;
});

router.post("/clients/:id/notes", requirePermission("clients.manage"), async (req, res) => {
  const clientId = (req.params.id as string);
  const { content } = req.body || {};
  if (!content?.trim()) { res.status(400).json({ error: "Contenu requis" }); return; }
  const { pinned } = req.body || {};
  const [note] = await db.insert(clientNotesTable).values({
    organizationId: req.authUser!.organizationId,
    clientId,
    authorId: req.authUser!.id,
    content: content.trim(),
    ...(pinned !== undefined ? { pinned: Boolean(pinned) } : {}),
  }).returning();
  res.status(201).json(note); return;
});

router.patch("/clients/:id/notes/:noteId", requirePermission("clients.manage"), async (req, res) => {
  const { content, pinned } = req.body || {};
  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content.trim();
  if (pinned !== undefined) updates.pinned = pinned;
  const [note] = await db.update(clientNotesTable)
    .set(updates)
    .where(and(eq(clientNotesTable.id, (req.params.noteId as string)), eq(clientNotesTable.clientId, (req.params.id as string))))
    .returning();
  if (!note) { res.status(404).json({ error: "Note introuvable" }); return; }
  res.json(note); return;
});

router.delete("/clients/:id/notes/:noteId", requirePermission("clients.manage"), async (req, res) => {
  await db.delete(clientNotesTable)
    .where(and(eq(clientNotesTable.id, (req.params.noteId as string)), eq(clientNotesTable.clientId, (req.params.id as string))));
  res.json({ success: true }); return;
});

export default router;
