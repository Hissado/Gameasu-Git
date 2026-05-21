import { Router } from "express";
import {
  db,
  prospectsTable,
  marketingCampaignsTable,
  campaignRecipientsTable,
  marketingAudiencesTable,
  marketingTemplatesTable,
  marketingAutomationsTable,
  marketingAutomationLogsTable,
  marketingAlertRulesTable,
  marketingAlertLogsTable,
  marketingConsentTable,
  marketingChannelConnectionsTable,
  clientsTable,
  collaboratorsTable,
  usersTable,
  invoicesTable,
  rentalsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, ilike, or, gte, lte } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

// ─── PROSPECTS ──────────────────────────────────────────────────
router.get("/prospects", async (req, res) => {
  const { search = "", status = "" } = req.query as Record<string, string>;
  const conds: any[] = [isNull(prospectsTable.deletedAt)];
  if (search) conds.push(or(
    ilike(prospectsTable.firstName, `%${search}%`),
    ilike(prospectsTable.lastName, `%${search}%`),
    ilike(prospectsTable.company, `%${search}%`),
    ilike(prospectsTable.email, `%${search}%`),
  ));
  if (status) conds.push(eq(prospectsTable.status, status));
  const data = await db.select().from(prospectsTable).where(and(...conds)).orderBy(desc(prospectsTable.createdAt));
  return res.json({ data });
});

router.post("/prospects", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, company, source, status, tags, notes } = req.body;
    if (!email && !phone) return res.status(400).json({ error: "email ou téléphone requis" });
    const [p] = await db.insert(prospectsTable).values({
      firstName, lastName, email, phone, company, source,
      status: status || "new",
      tags: Array.isArray(tags) ? tags : [],
      notes,
    }).returning();
    return res.status(201).json(p);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.put("/prospects/:id", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, company, source, status, tags, notes } = req.body;
    const [p] = await db.update(prospectsTable).set({
      firstName, lastName, email, phone, company, source, status, notes,
      ...(tags ? { tags } : {}),
    }).where(eq(prospectsTable.id, req.params.id)).returning();
    if (!p) return res.status(404).json({ error: "Not found" });
    return res.json(p);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/prospects/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(prospectsTable).set({ deletedAt: new Date() }).where(eq(prospectsTable.id, req.params.id));
  return res.status(204).send();
});

router.post("/prospects/:id/convert", requireManagerOrAbove, async (req, res) => {
  try {
    const [p] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, req.params.id)).limit(1);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.convertedToClientId) return res.status(409).json({ error: "Déjà converti" });
    const name = p.company || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Client sans nom";
    const [c] = await db.insert(clientsTable).values({
      name, email: p.email, phone: p.phone, status: "active",
    }).returning();
    await db.update(prospectsTable).set({
      status: "converted",
      convertedToClientId: c.id,
    }).where(eq(prospectsTable.id, p.id));
    return res.json({ client: c, prospectId: p.id });
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

// ─── UNIFIED CONTACTS POOL ──────────────────────────────────────
// Vue agrégée des contacts marketing (clients + prospects + collaborateurs + utilisateurs)
type UnifiedContact = {
  type: "client" | "prospect" | "collaborator" | "user";
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  tags: string[];
  language: string | null;
  createdAt: Date;
};

async function loadUnifiedContacts(filters: {
  sources?: string[];
  status?: string;
  tags?: string[];
  requireEmail?: boolean;
  requirePhone?: boolean;
  search?: string;
  inactiveSinceDays?: number;
} = {}): Promise<UnifiedContact[]> {
  const sources = filters.sources && filters.sources.length > 0 ? filters.sources : ["clients", "prospects", "collaborators", "users"];
  const contacts: UnifiedContact[] = [];

  if (sources.includes("clients")) {
    const rows = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
    for (const c of rows) contacts.push({
      type: "client", id: c.id, name: c.name, company: c.name,
      email: c.email, phone: c.phone, source: c.industry || null,
      status: c.status || "active", tags: [], language: null, createdAt: c.createdAt,
    });
  }
  if (sources.includes("prospects")) {
    const rows = await db.select().from(prospectsTable).where(isNull(prospectsTable.deletedAt));
    for (const p of rows) contacts.push({
      type: "prospect", id: p.id,
      name: p.company || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—",
      company: p.company, email: p.email, phone: p.phone, source: p.source,
      status: p.status, tags: (p.tags as string[]) || [], language: null, createdAt: p.createdAt,
    });
  }
  if (sources.includes("collaborators")) {
    const rows = await db.select().from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt));
    for (const c of rows) contacts.push({
      type: "collaborator", id: c.id, name: `${c.firstName} ${c.lastName}`,
      company: null, email: c.email, phone: c.phone, source: "interne",
      status: c.status || "active", tags: [], language: null, createdAt: c.createdAt,
    });
  }
  if (sources.includes("users")) {
    const rows = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
    for (const u of rows) contacts.push({
      type: "user", id: u.id, name: `${u.firstName} ${u.lastName}`,
      company: null, email: u.email, phone: u.phone, source: "interne",
      status: "active", tags: [], language: null, createdAt: u.createdAt,
    });
  }

  let out = contacts;
  if (filters.status) out = out.filter((c) => c.status === filters.status);
  if (filters.requireEmail) out = out.filter((c) => !!c.email);
  if (filters.requirePhone) out = out.filter((c) => !!c.phone);
  if (filters.tags && filters.tags.length > 0) {
    const set = new Set(filters.tags);
    out = out.filter((c) => c.tags.some((t) => set.has(t)));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    out = out.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q),
    );
  }
  if (filters.inactiveSinceDays && filters.inactiveSinceDays > 0) {
    const cutoff = Date.now() - filters.inactiveSinceDays * 24 * 3600 * 1000;
    out = out.filter((c) => new Date(c.createdAt).getTime() < cutoff);
  }
  return out;
}

router.get("/marketing/contacts", async (req, res) => {
  const q = req.query as Record<string, string>;
  const filters = {
    sources: q.sources ? q.sources.split(",") : undefined,
    status: q.status || undefined,
    requireEmail: q.requireEmail === "true",
    requirePhone: q.requirePhone === "true",
    search: q.search || undefined,
    tags: q.tags ? q.tags.split(",") : undefined,
  };
  const all = await loadUnifiedContacts(filters);
  const limit = Math.min(Number(q.limit) || 200, 1000);
  return res.json({
    total: all.length,
    breakdown: all.reduce((acc: Record<string, number>, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {}),
    data: all.slice(0, limit),
  });
});

// ─── AUDIENCES ──────────────────────────────────────────────────
async function resolveAudienceContacts(audience: typeof marketingAudiencesTable.$inferSelect): Promise<UnifiedContact[]> {
  if (audience.type === "static") {
    const ids = (audience.staticContactIds as Array<{ type: string; id: string }>) || [];
    if (ids.length === 0) return [];
    const all = await loadUnifiedContacts({});
    const set = new Set(ids.map((x) => `${x.type}:${x.id}`));
    return all.filter((c) => set.has(`${c.type}:${c.id}`));
  }
  // dynamic
  const f = (audience.filters as any) || {};
  return loadUnifiedContacts({
    sources: f.sources,
    status: f.status,
    tags: f.tags,
    requireEmail: f.requireEmail,
    requirePhone: f.requirePhone,
    inactiveSinceDays: f.inactiveSinceDays,
  });
}

router.get("/marketing/audiences", async (_req, res) => {
  const data = await db.select().from(marketingAudiencesTable)
    .where(isNull(marketingAudiencesTable.deletedAt))
    .orderBy(desc(marketingAudiencesTable.createdAt));
  return res.json({ data });
});

router.get("/marketing/audiences/:id", async (req, res) => {
  const [a] = await db.select().from(marketingAudiencesTable).where(eq(marketingAudiencesTable.id, req.params.id)).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const contacts = await resolveAudienceContacts(a);
  return res.json({ ...a, sample: contacts.slice(0, 20), count: contacts.length });
});

router.post("/marketing/audiences", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { name, description, type = "dynamic", filters = {}, staticContactIds = [] } = req.body;
    if (!name) return res.status(400).json({ error: "Nom requis" });
    if (!["static", "dynamic"].includes(type)) return res.status(400).json({ error: "type doit être static ou dynamic" });
    const [a] = await db.insert(marketingAudiencesTable).values({
      name, description, type, filters, staticContactIds,
      createdBy: req.user?.id,
    }).returning();
    // Compute count immediately
    const contacts = await resolveAudienceContacts(a);
    await db.update(marketingAudiencesTable).set({
      contactsCount: contacts.length, lastComputedAt: new Date(),
    }).where(eq(marketingAudiencesTable.id, a.id));
    return res.status(201).json({ ...a, contactsCount: contacts.length });
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.put("/marketing/audiences/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { name, description, type, filters, staticContactIds } = req.body;
    const [a] = await db.update(marketingAudiencesTable).set({
      name, description, type, filters,
      ...(staticContactIds !== undefined ? { staticContactIds } : {}),
    }).where(eq(marketingAudiencesTable.id, req.params.id)).returning();
    if (!a) return res.status(404).json({ error: "Not found" });
    const contacts = await resolveAudienceContacts(a);
    await db.update(marketingAudiencesTable).set({
      contactsCount: contacts.length, lastComputedAt: new Date(),
    }).where(eq(marketingAudiencesTable.id, a.id));
    return res.json({ ...a, contactsCount: contacts.length });
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/marketing/audiences/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingAudiencesTable).set({ deletedAt: new Date() }).where(eq(marketingAudiencesTable.id, req.params.id));
  return res.status(204).send();
});

router.post("/marketing/audiences/:id/recompute", requireManagerOrAbove, async (req, res) => {
  const [a] = await db.select().from(marketingAudiencesTable).where(eq(marketingAudiencesTable.id, req.params.id)).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const contacts = await resolveAudienceContacts(a);
  await db.update(marketingAudiencesTable).set({
    contactsCount: contacts.length, lastComputedAt: new Date(),
  }).where(eq(marketingAudiencesTable.id, a.id));
  return res.json({ count: contacts.length, breakdown: contacts.reduce((acc: Record<string, number>, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {}) });
});

// ─── TEMPLATES ──────────────────────────────────────────────────
router.get("/marketing/templates", async (req, res) => {
  const { channel, category } = req.query as Record<string, string>;
  const conds: any[] = [isNull(marketingTemplatesTable.deletedAt)];
  if (channel) conds.push(eq(marketingTemplatesTable.channel, channel));
  if (category) conds.push(eq(marketingTemplatesTable.category, category));
  const data = await db.select().from(marketingTemplatesTable).where(and(...conds)).orderBy(desc(marketingTemplatesTable.createdAt));
  return res.json({ data });
});

router.post("/marketing/templates", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { name, channel, category = "campagne", subject, body, variables = [], description } = req.body;
    if (!name || !channel || !body) return res.status(400).json({ error: "champs requis manquants" });
    if (!["email", "sms", "whatsapp"].includes(channel)) return res.status(400).json({ error: "channel invalide" });
    const [t] = await db.insert(marketingTemplatesTable).values({
      name, channel, category, subject, body, variables, description,
      createdBy: req.user?.id,
    }).returning();
    return res.status(201).json(t);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.put("/marketing/templates/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { name, channel, category, subject, body, variables, description } = req.body;
    const [t] = await db.update(marketingTemplatesTable).set({
      name, channel, category, subject, body, description,
      ...(variables !== undefined ? { variables } : {}),
    }).where(eq(marketingTemplatesTable.id, req.params.id)).returning();
    if (!t) return res.status(404).json({ error: "Not found" });
    return res.json(t);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/marketing/templates/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingTemplatesTable).set({ deletedAt: new Date() }).where(eq(marketingTemplatesTable.id, req.params.id));
  return res.status(204).send();
});

// ─── SEGMENTATION HELPER (legacy + new audiences) ───────────────
async function buildAudience(segment: { audiences: string[]; statusFilter?: string; tags?: string[] }) {
  const audiences = segment.audiences || [];
  const recipients: Array<{ audienceType: string; refId: string | null; name: string; email: string | null; phone: string | null }> = [];

  if (audiences.includes("clients")) {
    const rows = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
    for (const c of rows) recipients.push({ audienceType: "client", refId: c.id, name: c.name, email: c.email, phone: c.phone });
  }
  if (audiences.includes("collaborators")) {
    const rows = await db.select().from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt));
    for (const c of rows) recipients.push({ audienceType: "collaborator", refId: c.id, name: `${c.firstName} ${c.lastName}`, email: c.email, phone: c.phone });
  }
  if (audiences.includes("prospects")) {
    const conds: any[] = [isNull(prospectsTable.deletedAt)];
    if (segment.statusFilter) conds.push(eq(prospectsTable.status, segment.statusFilter));
    const rows = await db.select().from(prospectsTable).where(and(...conds));
    for (const p of rows) recipients.push({
      audienceType: "prospect", refId: p.id,
      name: p.company || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—",
      email: p.email, phone: p.phone,
    });
  }
  if (audiences.includes("users")) {
    const rows = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
    for (const u of rows) recipients.push({ audienceType: "user", refId: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, phone: u.phone });
  }
  return recipients;
}

// ─── CAMPAIGNS ──────────────────────────────────────────────────
router.get("/marketing/campaigns", async (_req, res) => {
  const data = await db.select().from(marketingCampaignsTable)
    .where(isNull(marketingCampaignsTable.deletedAt))
    .orderBy(desc(marketingCampaignsTable.createdAt));
  return res.json({ data });
});

router.get("/marketing/campaigns/:id", async (req, res) => {
  const [c] = await db.select().from(marketingCampaignsTable).where(eq(marketingCampaignsTable.id, req.params.id)).limit(1);
  if (!c) return res.status(404).json({ error: "Not found" });
  const recipients = await db.select().from(campaignRecipientsTable)
    .where(eq(campaignRecipientsTable.campaignId, c.id))
    .orderBy(desc(campaignRecipientsTable.createdAt))
    .limit(500);
  return res.json({ ...c, recipients });
});

router.post("/marketing/campaigns/preview", async (req, res) => {
  const { segment, audienceId } = req.body;
  if (audienceId) {
    const [a] = await db.select().from(marketingAudiencesTable).where(eq(marketingAudiencesTable.id, audienceId)).limit(1);
    if (!a) return res.status(404).json({ error: "Audience introuvable" });
    const contacts = await resolveAudienceContacts(a);
    return res.json({
      total: contacts.length,
      breakdown: contacts.reduce((acc: Record<string, number>, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {}),
      sample: contacts.slice(0, 10).map((c) => ({ name: c.name, email: c.email, phone: c.phone, audienceType: c.type })),
    });
  }
  if (!segment) return res.status(400).json({ error: "segment ou audienceId requis" });
  const audience = await buildAudience(segment);
  return res.json({
    total: audience.length,
    breakdown: audience.reduce((acc: Record<string, number>, r) => { acc[r.audienceType] = (acc[r.audienceType] || 0) + 1; return acc; }, {}),
    sample: audience.slice(0, 10),
  });
});

router.post("/marketing/campaigns", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { name, channel, subject, body, segment, audienceId, templateId, scheduledAt } = req.body;
    if (!name || !channel || !body) return res.status(400).json({ error: "champs requis manquants" });
    if (!["email", "sms", "whatsapp", "multi"].includes(channel)) return res.status(400).json({ error: "channel invalide" });
    if (!audienceId && !segment) return res.status(400).json({ error: "audienceId ou segment requis" });
    const [c] = await db.insert(marketingCampaignsTable).values({
      name, channel, subject, body,
      segment: segment || { audiences: [] },
      audienceId: audienceId || null,
      templateId: templateId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? "scheduled" : "draft",
      createdBy: req.user?.id,
    }).returning();
    return res.status(201).json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.put("/marketing/campaigns/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { name, channel, subject, body, segment, audienceId, templateId, scheduledAt, status } = req.body;
    const [c] = await db.update(marketingCampaignsTable).set({
      name, channel, subject, body, segment, status,
      ...(audienceId !== undefined ? { audienceId: audienceId || null } : {}),
      ...(templateId !== undefined ? { templateId: templateId || null } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
    }).where(eq(marketingCampaignsTable.id, req.params.id)).returning();
    if (!c) return res.status(404).json({ error: "Not found" });
    return res.json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.post("/marketing/campaigns/:id/duplicate", requireManagerOrAbove, async (req: any, res) => {
  const [src] = await db.select().from(marketingCampaignsTable).where(eq(marketingCampaignsTable.id, req.params.id)).limit(1);
  if (!src) return res.status(404).json({ error: "Not found" });
  const [c] = await db.insert(marketingCampaignsTable).values({
    name: `${src.name} (copie)`,
    channel: src.channel, subject: src.subject, body: src.body,
    segment: src.segment as any, audienceId: src.audienceId, templateId: src.templateId,
    status: "draft", createdBy: req.user?.id,
  }).returning();
  return res.status(201).json(c);
});

router.delete("/marketing/campaigns/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingCampaignsTable).set({ deletedAt: new Date() }).where(eq(marketingCampaignsTable.id, req.params.id));
  return res.status(204).send();
});

router.post("/marketing/campaigns/:id/schedule", requireManagerOrAbove, async (req, res) => {
  const { scheduledAt } = req.body;
  if (!scheduledAt) return res.status(400).json({ error: "scheduledAt requis" });
  const [c] = await db.update(marketingCampaignsTable).set({
    scheduledAt: new Date(scheduledAt), status: "scheduled",
  }).where(eq(marketingCampaignsTable.id, req.params.id)).returning();
  if (!c) return res.status(404).json({ error: "Not found" });
  return res.json(c);
});

// Envoi (simulation : log en console + insertion des destinataires).
// Pour brancher un vrai provider, lire marketing_channel_connections et appeler le SDK ici.
router.post("/marketing/campaigns/:id/send", requireManagerOrAbove, async (req, res) => {
  try {
    const [c] = await db.select().from(marketingCampaignsTable).where(eq(marketingCampaignsTable.id, req.params.id)).limit(1);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.status === "sent") return res.status(409).json({ error: "Déjà envoyée" });

    // Résoudre l'audience : nouvelle audience prioritaire, sinon segment legacy.
    let recipients: Array<{ audienceType: string; refId: string | null; name: string; email: string | null; phone: string | null }> = [];
    if (c.audienceId) {
      const [a] = await db.select().from(marketingAudiencesTable).where(eq(marketingAudiencesTable.id, c.audienceId)).limit(1);
      if (a) {
        const contacts = await resolveAudienceContacts(a);
        recipients = contacts.map((x) => ({ audienceType: x.type, refId: x.id, name: x.name, email: x.email, phone: x.phone }));
      }
    } else {
      recipients = await buildAudience(c.segment as any);
    }

    // Filtre consentement
    const consents = await db.select().from(marketingConsentTable);
    const optOut = new Set(consents.filter((x) => !x.optIn && (x.channel === c.channel || c.channel === "multi")).map((x) => `${x.contactType}:${x.contactId}`));
    recipients = recipients.filter((r) => !r.refId || !optOut.has(`${r.audienceType}:${r.refId}`));

    const hasContact = (r: typeof recipients[number]) => {
      if (c.channel === "email") return !!r.email;
      if (c.channel === "sms" || c.channel === "whatsapp") return !!r.phone;
      return !!r.email || !!r.phone;
    };
    const valid = recipients.filter(hasContact);
    const failed = recipients.length - valid.length;

    if (valid.length > 0) {
      await db.insert(campaignRecipientsTable).values(
        valid.map((r) => ({
          campaignId: c.id, audienceType: r.audienceType, refId: r.refId,
          name: r.name, email: r.email, phone: r.phone,
          status: "sent" as const, sentAt: new Date(),
        })),
      );
    }
    if (failed > 0) {
      const invalids = recipients.filter((r) => !hasContact(r));
      await db.insert(campaignRecipientsTable).values(
        invalids.map((r) => ({
          campaignId: c.id, audienceType: r.audienceType, refId: r.refId,
          name: r.name, email: r.email, phone: r.phone,
          status: "failed" as const,
          errorMsg: c.channel === "email" ? "Email manquant" : "Téléphone manquant",
        })),
      );
    }

    const [updated] = await db.update(marketingCampaignsTable).set({
      status: "sent", sentAt: new Date(),
      recipientsCount: recipients.length, sentCount: valid.length, failedCount: failed,
    }).where(eq(marketingCampaignsTable.id, c.id)).returning();

    // Incrémenter le volume du canal (compteur 30j approximatif)
    if (valid.length > 0 && c.channel !== "multi") {
      await db.update(marketingChannelConnectionsTable).set({
        volume30d: sql`${marketingChannelConnectionsTable.volume30d} + ${valid.length}`,
        lastCheckAt: new Date(),
      }).where(and(eq(marketingChannelConnectionsTable.channel, c.channel), eq(marketingChannelConnectionsTable.isActive, true)));
    }

    console.log(`[MARKETING] Campagne "${c.name}" envoyée — ${valid.length}/${recipients.length} ${c.channel}(s) délivrés (mode simulation)`);
    return res.json({ campaign: updated, sent: valid.length, failed });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ─── AUTOMATIONS ────────────────────────────────────────────────
router.get("/marketing/automations", async (_req, res) => {
  const data = await db.select().from(marketingAutomationsTable)
    .where(isNull(marketingAutomationsTable.deletedAt))
    .orderBy(desc(marketingAutomationsTable.createdAt));
  return res.json({ data });
});

router.get("/marketing/automations/:id", async (req, res) => {
  const [a] = await db.select().from(marketingAutomationsTable).where(eq(marketingAutomationsTable.id, req.params.id)).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const logs = await db.select().from(marketingAutomationLogsTable)
    .where(eq(marketingAutomationLogsTable.automationId, a.id))
    .orderBy(desc(marketingAutomationLogsTable.triggeredAt))
    .limit(50);
  return res.json({ ...a, logs });
});

router.post("/marketing/automations", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { name, description, trigger, triggerConfig = {}, audienceId, steps = [], isActive = false } = req.body;
    if (!name || !trigger) return res.status(400).json({ error: "name et trigger requis" });
    const [a] = await db.insert(marketingAutomationsTable).values({
      name, description, trigger, triggerConfig,
      audienceId: audienceId || null, steps, isActive,
      createdBy: req.user?.id,
    }).returning();
    return res.status(201).json(a);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.put("/marketing/automations/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { name, description, trigger, triggerConfig, audienceId, steps, isActive } = req.body;
    const [a] = await db.update(marketingAutomationsTable).set({
      name, description, trigger,
      ...(triggerConfig !== undefined ? { triggerConfig } : {}),
      ...(audienceId !== undefined ? { audienceId: audienceId || null } : {}),
      ...(steps !== undefined ? { steps } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }).where(eq(marketingAutomationsTable.id, req.params.id)).returning();
    if (!a) return res.status(404).json({ error: "Not found" });
    return res.json(a);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.post("/marketing/automations/:id/toggle", requireManagerOrAbove, async (req, res) => {
  const [a] = await db.select().from(marketingAutomationsTable).where(eq(marketingAutomationsTable.id, req.params.id)).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const [u] = await db.update(marketingAutomationsTable).set({ isActive: !a.isActive }).where(eq(marketingAutomationsTable.id, a.id)).returning();
  return res.json(u);
});

router.delete("/marketing/automations/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingAutomationsTable).set({ deletedAt: new Date() }).where(eq(marketingAutomationsTable.id, req.params.id));
  return res.status(204).send();
});

// Exécution manuelle (test) d'une automatisation : log + incrémente le compteur.
router.post("/marketing/automations/:id/run", requireManagerOrAbove, async (req, res) => {
  const [a] = await db.select().from(marketingAutomationsTable).where(eq(marketingAutomationsTable.id, req.params.id)).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const steps = (a.steps as any[]) || [];
  await db.insert(marketingAutomationLogsTable).values({
    automationId: a.id, status: "success", stepsExecuted: steps.length,
    payload: { manual: true, trigger: a.trigger },
  });
  await db.update(marketingAutomationsTable).set({
    runsCount: sql`${marketingAutomationsTable.runsCount} + 1`,
    lastRunAt: new Date(),
  }).where(eq(marketingAutomationsTable.id, a.id));
  console.log(`[MARKETING] Automation "${a.name}" exécutée manuellement — ${steps.length} étape(s) (simulation)`);
  return res.json({ ok: true, stepsExecuted: steps.length });
});

// ─── ALERT RULES ────────────────────────────────────────────────
router.get("/marketing/alerts/rules", async (_req, res) => {
  const data = await db.select().from(marketingAlertRulesTable)
    .where(isNull(marketingAlertRulesTable.deletedAt))
    .orderBy(desc(marketingAlertRulesTable.createdAt));
  return res.json({ data });
});

router.post("/marketing/alerts/rules", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { name, description, source, config = {}, channels = ["email"], templateId, isActive = true } = req.body;
    if (!name || !source) return res.status(400).json({ error: "name et source requis" });
    const [r] = await db.insert(marketingAlertRulesTable).values({
      name, description, source, config, channels,
      templateId: templateId || null, isActive,
      createdBy: req.user?.id,
    }).returning();
    return res.status(201).json(r);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.put("/marketing/alerts/rules/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { name, description, source, config, channels, templateId, isActive } = req.body;
    const [r] = await db.update(marketingAlertRulesTable).set({
      name, description, source,
      ...(config !== undefined ? { config } : {}),
      ...(channels !== undefined ? { channels } : {}),
      ...(templateId !== undefined ? { templateId: templateId || null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }).where(eq(marketingAlertRulesTable.id, req.params.id)).returning();
    if (!r) return res.status(404).json({ error: "Not found" });
    return res.json(r);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/marketing/alerts/rules/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingAlertRulesTable).set({ deletedAt: new Date() }).where(eq(marketingAlertRulesTable.id, req.params.id));
  return res.status(204).send();
});

router.get("/marketing/alerts/logs", async (req, res) => {
  const ruleId = (req.query as any).ruleId as string | undefined;
  const conds: any[] = [];
  if (ruleId) conds.push(eq(marketingAlertLogsTable.ruleId, ruleId));
  const data = await db.select().from(marketingAlertLogsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(marketingAlertLogsTable.sentAt))
    .limit(200);
  return res.json({ data });
});

// Exécution manuelle d'une règle d'alerte : balaie les entités cibles et logge.
router.post("/marketing/alerts/rules/:id/run", requireManagerOrAbove, async (req, res) => {
  const [rule] = await db.select().from(marketingAlertRulesTable).where(eq(marketingAlertRulesTable.id, req.params.id)).limit(1);
  if (!rule) return res.status(404).json({ error: "Not found" });

  let sent = 0;
  const channels = (rule.channels as string[]) || ["email"];

  // Sources implémentées : invoice_due, rental_due. Les autres sont stubbées.
  if (rule.source === "invoice_due" || rule.source === "invoice_overdue") {
    const leadTime = (rule.config as any)?.leadTimeDays ?? 7;
    const now = new Date();
    const target = new Date(now.getTime() + leadTime * 24 * 3600 * 1000);
    const invs = await db.select().from(invoicesTable)
      .where(and(
        isNull(invoicesTable.deletedAt),
        rule.source === "invoice_overdue"
          ? lte(invoicesTable.dueDate, now.toISOString().slice(0, 10) as any)
          : and(gte(invoicesTable.dueDate, now.toISOString().slice(0, 10) as any), lte(invoicesTable.dueDate, target.toISOString().slice(0, 10) as any)),
      )).limit(200);
    for (const inv of invs) {
      for (const ch of channels) {
        await db.insert(marketingAlertLogsTable).values({
          ruleId: rule.id, entityType: "invoice", entityId: inv.id,
          channel: ch, recipient: inv.clientId, status: "sent",
        });
        sent++;
      }
    }
  } else if (rule.source === "rental_due" || rule.source === "rental_return") {
    const leadTime = (rule.config as any)?.leadTimeDays ?? 3;
    const now = new Date();
    const target = new Date(now.getTime() + leadTime * 24 * 3600 * 1000);
    const rentals = await db.select().from(rentalsTable)
      .where(and(
        isNull(rentalsTable.deletedAt),
        gte(rentalsTable.endDate, now.toISOString().slice(0, 10) as any),
        lte(rentalsTable.endDate, target.toISOString().slice(0, 10) as any),
      )).limit(200);
    for (const r of rentals) {
      for (const ch of channels) {
        await db.insert(marketingAlertLogsTable).values({
          ruleId: rule.id, entityType: "rental", entityId: r.id,
          channel: ch, recipient: r.clientId, status: "sent",
        });
        sent++;
      }
    }
  } else {
    // stub : 1 log "skipped"
    await db.insert(marketingAlertLogsTable).values({
      ruleId: rule.id, channel: channels[0] || "email", status: "skipped",
      error: `Source "${rule.source}" non implémentée — balayage stub`,
    });
  }

  await db.update(marketingAlertRulesTable).set({
    lastRunAt: new Date(),
    sentCount: sql`${marketingAlertRulesTable.sentCount} + ${sent}`,
  }).where(eq(marketingAlertRulesTable.id, rule.id));
  return res.json({ sent, channels });
});

// ─── CONSENT ────────────────────────────────────────────────────
router.get("/marketing/consent", async (req, res) => {
  const { contactType, contactId } = req.query as Record<string, string>;
  const conds: any[] = [];
  if (contactType) conds.push(eq(marketingConsentTable.contactType, contactType));
  if (contactId) conds.push(eq(marketingConsentTable.contactId, contactId));
  const data = await db.select().from(marketingConsentTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(marketingConsentTable.updatedAt))
    .limit(500);
  return res.json({ data });
});

router.put("/marketing/consent", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { contactType, contactId, channel, optIn, preferredLanguage, source = "manual" } = req.body;
    if (!contactType || !contactId || !channel) return res.status(400).json({ error: "contactType, contactId, channel requis" });
    const existing = await db.select().from(marketingConsentTable)
      .where(and(
        eq(marketingConsentTable.contactType, contactType),
        eq(marketingConsentTable.contactId, contactId),
        eq(marketingConsentTable.channel, channel),
      )).limit(1);
    if (existing.length > 0) {
      const [u] = await db.update(marketingConsentTable).set({
        optIn, source, preferredLanguage, updatedBy: req.user?.id,
      }).where(eq(marketingConsentTable.id, existing[0].id)).returning();
      return res.json(u);
    }
    const [c] = await db.insert(marketingConsentTable).values({
      contactType, contactId, channel, optIn: optIn ?? true,
      source, preferredLanguage, updatedBy: req.user?.id,
    }).returning();
    return res.status(201).json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

// ─── CHANNEL CONNECTIONS ────────────────────────────────────────
router.get("/marketing/channels", async (_req, res) => {
  const data = await db.select().from(marketingChannelConnectionsTable).orderBy(marketingChannelConnectionsTable.channel);
  return res.json({ data });
});

router.put("/marketing/channels/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { displayName, config, isActive, status } = req.body;
    const [c] = await db.update(marketingChannelConnectionsTable).set({
      displayName, config, isActive, status,
      lastCheckAt: new Date(),
    }).where(eq(marketingChannelConnectionsTable.id, req.params.id)).returning();
    if (!c) return res.status(404).json({ error: "Not found" });
    return res.json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.post("/marketing/channels", requireManagerOrAbove, async (req, res) => {
  try {
    const { channel, provider, displayName, config = {}, isActive = false } = req.body;
    if (!channel || !provider) return res.status(400).json({ error: "channel et provider requis" });
    const [c] = await db.insert(marketingChannelConnectionsTable).values({
      channel, provider, displayName, config, isActive,
      status: isActive ? "ok" : "not_configured",
    }).returning();
    return res.status(201).json(c);
  } catch (e: any) {
    if (e.message?.includes("unique")) return res.status(409).json({ error: "Ce couple canal/fournisseur existe déjà" });
    return res.status(400).json({ error: e.message });
  }
});

// ─── OVERVIEW / DASHBOARD ───────────────────────────────────────
router.get("/marketing/dashboard", async (_req, res) => {
  const [{ total: totalCamp }] = await db.select({ total: sql<number>`count(*)` })
    .from(marketingCampaignsTable).where(isNull(marketingCampaignsTable.deletedAt));
  const [{ sent }] = await db.select({ sent: sql<number>`coalesce(sum(sent_count),0)` })
    .from(marketingCampaignsTable).where(isNull(marketingCampaignsTable.deletedAt));
  const [{ totalProspects }] = await db.select({ totalProspects: sql<number>`count(*)` })
    .from(prospectsTable).where(isNull(prospectsTable.deletedAt));
  const byStatus = await db.select({ status: prospectsTable.status, count: sql<number>`count(*)` })
    .from(prospectsTable).where(isNull(prospectsTable.deletedAt)).groupBy(prospectsTable.status);
  return res.json({
    totalCampaigns: Number(totalCamp),
    totalMessagesSent: Number(sent),
    totalProspects: Number(totalProspects),
    prospectsByStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
  });
});

router.get("/marketing/overview", async (_req, res) => {
  const [campCounts] = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) filter (where status in ('running','scheduled'))`,
    scheduled: sql<number>`count(*) filter (where status = 'scheduled')`,
    sent: sql<number>`count(*) filter (where status = 'sent')`,
    draft: sql<number>`count(*) filter (where status = 'draft')`,
  }).from(marketingCampaignsTable).where(isNull(marketingCampaignsTable.deletedAt));

  const byChannel = await db.select({
    channel: marketingCampaignsTable.channel,
    count: sql<number>`count(*)`,
    sentTotal: sql<number>`coalesce(sum(sent_count),0)`,
  }).from(marketingCampaignsTable)
    .where(isNull(marketingCampaignsTable.deletedAt))
    .groupBy(marketingCampaignsTable.channel);

  const [totals] = await db.select({
    sent: sql<number>`coalesce(sum(sent_count),0)`,
    failed: sql<number>`coalesce(sum(failed_count),0)`,
    opens: sql<number>`coalesce(sum(open_count),0)`,
    clicks: sql<number>`coalesce(sum(click_count),0)`,
    replies: sql<number>`coalesce(sum(reply_count),0)`,
    unsubs: sql<number>`coalesce(sum(unsubscribe_count),0)`,
    recipients: sql<number>`coalesce(sum(recipients_count),0)`,
  }).from(marketingCampaignsTable).where(isNull(marketingCampaignsTable.deletedAt));

  const [{ totalProspects }] = await db.select({ totalProspects: sql<number>`count(*)` })
    .from(prospectsTable).where(isNull(prospectsTable.deletedAt));
  const [{ converted }] = await db.select({ converted: sql<number>`count(*)` })
    .from(prospectsTable).where(and(isNull(prospectsTable.deletedAt), eq(prospectsTable.status, "converted")));

  const [autos] = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) filter (where is_active = true)`,
    runs: sql<number>`coalesce(sum(runs_count),0)`,
  }).from(marketingAutomationsTable).where(isNull(marketingAutomationsTable.deletedAt));

  const [alerts] = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) filter (where is_active = true)`,
    sent: sql<number>`coalesce(sum(sent_count),0)`,
  }).from(marketingAlertRulesTable).where(isNull(marketingAlertRulesTable.deletedAt));

  const [aud] = await db.select({
    total: sql<number>`count(*)`,
    contacts: sql<number>`coalesce(sum(contacts_count),0)`,
  }).from(marketingAudiencesTable).where(isNull(marketingAudiencesTable.deletedAt));

  const topCampaigns = await db.select().from(marketingCampaignsTable)
    .where(and(isNull(marketingCampaignsTable.deletedAt), eq(marketingCampaignsTable.status, "sent")))
    .orderBy(desc(marketingCampaignsTable.sentCount))
    .limit(5);

  const sentN = Number(totals.sent);
  const openRate = sentN > 0 ? Number(totals.opens) / sentN : 0;
  const clickRate = sentN > 0 ? Number(totals.clicks) / sentN : 0;
  const replyRate = sentN > 0 ? Number(totals.replies) / sentN : 0;

  return res.json({
    campaigns: {
      total: Number(campCounts.total),
      active: Number(campCounts.active),
      scheduled: Number(campCounts.scheduled),
      sent: Number(campCounts.sent),
      draft: Number(campCounts.draft),
    },
    byChannel: byChannel.map((r) => ({ channel: r.channel, count: Number(r.count), sentTotal: Number(r.sentTotal) })),
    delivery: {
      sent: sentN,
      failed: Number(totals.failed),
      recipients: Number(totals.recipients),
      opens: Number(totals.opens),
      clicks: Number(totals.clicks),
      replies: Number(totals.replies),
      unsubs: Number(totals.unsubs),
      openRate, clickRate, replyRate,
    },
    prospects: {
      total: Number(totalProspects),
      converted: Number(converted),
    },
    automations: {
      total: Number(autos.total), active: Number(autos.active), runs: Number(autos.runs),
    },
    alerts: {
      total: Number(alerts.total), active: Number(alerts.active), sent: Number(alerts.sent),
    },
    audiences: {
      total: Number(aud.total), contacts: Number(aud.contacts),
    },
    topCampaigns,
  });
});

// ─── ANALYTICS ──────────────────────────────────────────────────
router.get("/marketing/analytics", async (req, res) => {
  const { fromDate, toDate } = req.query as Record<string, string>;
  const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const to = toDate ? new Date(toDate) : new Date();

  const conds: any[] = [isNull(marketingCampaignsTable.deletedAt)];
  conds.push(gte(marketingCampaignsTable.createdAt, from));
  conds.push(lte(marketingCampaignsTable.createdAt, to));

  const series = await db.select({
    month: sql<string>`to_char(created_at, 'YYYY-MM')`,
    channel: marketingCampaignsTable.channel,
    sent: sql<number>`coalesce(sum(sent_count),0)`,
    failed: sql<number>`coalesce(sum(failed_count),0)`,
    recipients: sql<number>`coalesce(sum(recipients_count),0)`,
    campaigns: sql<number>`count(*)`,
  }).from(marketingCampaignsTable)
    .where(and(...conds))
    .groupBy(sql`to_char(created_at, 'YYYY-MM')`, marketingCampaignsTable.channel)
    .orderBy(sql`to_char(created_at, 'YYYY-MM')`);

  const byCampaign = await db.select({
    id: marketingCampaignsTable.id,
    name: marketingCampaignsTable.name,
    channel: marketingCampaignsTable.channel,
    sentCount: marketingCampaignsTable.sentCount,
    recipientsCount: marketingCampaignsTable.recipientsCount,
    openCount: marketingCampaignsTable.openCount,
    clickCount: marketingCampaignsTable.clickCount,
    replyCount: marketingCampaignsTable.replyCount,
    sentAt: marketingCampaignsTable.sentAt,
  }).from(marketingCampaignsTable)
    .where(and(...conds, eq(marketingCampaignsTable.status, "sent")))
    .orderBy(desc(marketingCampaignsTable.sentCount))
    .limit(20);

  return res.json({
    range: { from, to },
    series: series.map((r) => ({ ...r, sent: Number(r.sent), failed: Number(r.failed), recipients: Number(r.recipients), campaigns: Number(r.campaigns) })),
    byCampaign,
  });
});

// ─── CALENDAR ───────────────────────────────────────────────────
router.get("/marketing/calendar", async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const fromD = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const toD = to ? new Date(to) : new Date(Date.now() + 60 * 24 * 3600 * 1000);

  const camps = await db.select().from(marketingCampaignsTable)
    .where(and(
      isNull(marketingCampaignsTable.deletedAt),
      or(
        and(gte(marketingCampaignsTable.scheduledAt, fromD), lte(marketingCampaignsTable.scheduledAt, toD)),
        and(gte(marketingCampaignsTable.sentAt, fromD), lte(marketingCampaignsTable.sentAt, toD)),
      ),
    ));
  const alerts = await db.select().from(marketingAlertLogsTable)
    .where(and(gte(marketingAlertLogsTable.sentAt, fromD), lte(marketingAlertLogsTable.sentAt, toD)))
    .limit(200);

  const events: Array<{ id: string; date: Date; type: string; title: string; channel?: string; status?: string }> = [];
  for (const c of camps) {
    const d = c.sentAt || c.scheduledAt;
    if (!d) continue;
    events.push({
      id: c.id, date: d, type: "campaign",
      title: c.name, channel: c.channel, status: c.status,
    });
  }
  for (const a of alerts) {
    events.push({
      id: a.id, date: a.sentAt, type: "alert",
      title: `Alerte ${a.entityType || "—"}`, channel: a.channel, status: a.status,
    });
  }
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return res.json({ events });
});

export default router;
