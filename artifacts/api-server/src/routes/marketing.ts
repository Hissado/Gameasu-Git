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
  marketingFormsTable,
  clientsTable,
  collaboratorsTable,
  usersTable,
  organizationMembersTable,
  invoicesTable,
  rentalsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, ilike, or, gte, lte, inArray } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";

const router = Router();

// ─── HELPERS ENVOI EMAIL ────────────────────────────────────────
function getBaseUrl(req: any): string {
  return process.env["REPLIT_DEV_DOMAIN"]
    ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
    : `${req.protocol}://${req.get("host")}`;
}

function substituteVars(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function buildEmailHtml(body: string, openToken: string, baseUrl: string): string {
  const html = body
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^# (.+)$/gm, "<h2 style='font-size:20px;margin:16px 0 8px'>$1</h2>")
    .replace(/^## (.+)$/gm, "<h3 style='font-size:16px;margin:12px 0 6px'>$1</h3>")
    .replace(/^- (.+)$/gm, "<li style='margin:4px 0'>$1</li>")
    .replace(/\n\n/g, "</p><p style='margin:10px 0'>")
    .replace(/\n/g, "<br/>");
  const pixel = `<img src="${baseUrl}/api/marketing/track/open/${openToken}" width="1" height="1" style="display:none;width:1px;height:1px" alt="" />`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333"><p style="margin:10px 0">${html}</p>${pixel}</body></html>`;
}

// ─── PROSPECTS ──────────────────────────────────────────────────
router.get("/prospects", async (req, res) => {
  const { search = "", status = "" } = req.query as Record<string, string>;
  const conds: any[] = [eq(prospectsTable.organizationId, req.authUser!.organizationId), isNull(prospectsTable.deletedAt)];
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
      organizationId: req.authUser!.organizationId,
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
    }).where(and(eq(prospectsTable.organizationId, req.authUser!.organizationId), eq(prospectsTable.id, req.params.id))).returning();
    if (!p) return res.status(404).json({ error: "Not found" });
    return res.json(p);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/prospects/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(prospectsTable).set({ deletedAt: new Date() }).where(and(eq(prospectsTable.organizationId, req.authUser!.organizationId), eq(prospectsTable.id, req.params.id)));
  return res.status(204).send();
});

router.post("/prospects/:id/convert", requireManagerOrAbove, async (req, res) => {
  try {
    const [p] = await db.select().from(prospectsTable).where(and(eq(prospectsTable.organizationId, req.authUser!.organizationId), eq(prospectsTable.id, req.params.id))).limit(1);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.convertedToClientId) return res.status(409).json({ error: "Déjà converti" });
    const name = p.company || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Client sans nom";
    const [c] = await db.insert(clientsTable).values({
      organizationId: req.authUser!.organizationId,
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

async function loadUnifiedContacts(orgId: string, filters: {
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
    const rows = await db.select().from(clientsTable).where(and(eq(clientsTable.organizationId, orgId), isNull(clientsTable.deletedAt)));
    for (const c of rows) contacts.push({
      type: "client", id: c.id, name: c.name, company: c.name,
      email: c.email, phone: c.phone, source: c.industry || null,
      status: c.status || "active", tags: [], language: null, createdAt: c.createdAt,
    });
  }
  if (sources.includes("prospects")) {
    const rows = await db.select().from(prospectsTable).where(and(eq(prospectsTable.organizationId, orgId), isNull(prospectsTable.deletedAt)));
    for (const p of rows) contacts.push({
      type: "prospect", id: p.id,
      name: p.company || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—",
      company: p.company, email: p.email, phone: p.phone, source: p.source,
      status: p.status, tags: (p.tags as string[]) || [], language: null, createdAt: p.createdAt,
    });
  }
  if (sources.includes("collaborators")) {
    const rows = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));
    for (const c of rows) contacts.push({
      type: "collaborator", id: c.id, name: `${c.firstName} ${c.lastName}`,
      company: null, email: c.email, phone: c.phone, source: "interne",
      status: c.employmentStatus || "active", tags: [], language: null, createdAt: c.createdAt,
    });
  }
  if (sources.includes("users")) {
    const orgUserIds = db.select({ uid: organizationMembersTable.userId })
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.organizationId, orgId));
    const rows = await db.select().from(usersTable)
      .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, orgUserIds)));
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
  const all = await loadUnifiedContacts(req.authUser!.organizationId, filters);
  const limit = Math.min(Number(q.limit) || 200, 1000);
  return res.json({
    total: all.length,
    breakdown: all.reduce((acc: Record<string, number>, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {}),
    data: all.slice(0, limit),
  });
});

// ─── AUDIENCES ──────────────────────────────────────────────────
async function resolveAudienceContacts(audience: typeof marketingAudiencesTable.$inferSelect, orgId: string): Promise<UnifiedContact[]> {
  if (audience.type === "static") {
    const ids = (audience.staticContactIds as Array<{ type: string; id: string }>) || [];
    if (ids.length === 0) return [];
    const all = await loadUnifiedContacts(orgId, {});
    const set = new Set(ids.map((x) => `${x.type}:${x.id}`));
    return all.filter((c) => set.has(`${c.type}:${c.id}`));
  }
  // dynamic
  const f = (audience.filters as any) || {};
  return loadUnifiedContacts(orgId, {
    sources: f.sources,
    status: f.status,
    tags: f.tags,
    requireEmail: f.requireEmail,
    requirePhone: f.requirePhone,
    inactiveSinceDays: f.inactiveSinceDays,
  });
}

router.get("/marketing/audiences", async (req, res) => {
  const data = await db.select().from(marketingAudiencesTable)
    .where(and(eq(marketingAudiencesTable.organizationId, req.authUser!.organizationId), isNull(marketingAudiencesTable.deletedAt)))
    .orderBy(desc(marketingAudiencesTable.createdAt));
  return res.json({ data });
});

router.get("/marketing/audiences/:id", async (req, res) => {
  const [a] = await db.select().from(marketingAudiencesTable).where(and(eq(marketingAudiencesTable.organizationId, req.authUser!.organizationId), eq(marketingAudiencesTable.id, req.params.id))).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const contacts = await resolveAudienceContacts(a, req.authUser!.organizationId);
  return res.json({ ...a, sample: contacts.slice(0, 20), count: contacts.length });
});

router.post("/marketing/audiences", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { name, description, type = "dynamic", filters = {}, staticContactIds = [] } = req.body;
    if (!name) return res.status(400).json({ error: "Nom requis" });
    if (!["static", "dynamic"].includes(type)) return res.status(400).json({ error: "type doit être static ou dynamic" });
    const [a] = await db.insert(marketingAudiencesTable).values({
      organizationId: req.authUser!.organizationId,
      name, description, type, filters, staticContactIds,
      createdBy: req.user?.id,
    }).returning();
    const contacts = await resolveAudienceContacts(a, req.authUser!.organizationId);
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
    }).where(and(eq(marketingAudiencesTable.organizationId, req.authUser!.organizationId), eq(marketingAudiencesTable.id, req.params.id))).returning();
    if (!a) return res.status(404).json({ error: "Not found" });
    const contacts = await resolveAudienceContacts(a, req.authUser!.organizationId);
    await db.update(marketingAudiencesTable).set({
      contactsCount: contacts.length, lastComputedAt: new Date(),
    }).where(eq(marketingAudiencesTable.id, a.id));
    return res.json({ ...a, contactsCount: contacts.length });
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/marketing/audiences/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingAudiencesTable).set({ deletedAt: new Date() }).where(and(eq(marketingAudiencesTable.organizationId, req.authUser!.organizationId), eq(marketingAudiencesTable.id, req.params.id)));
  return res.status(204).send();
});

router.post("/marketing/audiences/:id/recompute", requireManagerOrAbove, async (req, res) => {
  const [a] = await db.select().from(marketingAudiencesTable).where(and(eq(marketingAudiencesTable.organizationId, req.authUser!.organizationId), eq(marketingAudiencesTable.id, req.params.id))).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const contacts = await resolveAudienceContacts(a, req.authUser!.organizationId);
  await db.update(marketingAudiencesTable).set({
    contactsCount: contacts.length, lastComputedAt: new Date(),
  }).where(eq(marketingAudiencesTable.id, a.id));
  return res.json({ count: contacts.length, breakdown: contacts.reduce((acc: Record<string, number>, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {}) });
});

// ─── TEMPLATES ──────────────────────────────────────────────────
router.get("/marketing/templates", async (req, res) => {
  const { channel, category } = req.query as Record<string, string>;
  const conds: any[] = [eq(marketingTemplatesTable.organizationId, req.authUser!.organizationId), isNull(marketingTemplatesTable.deletedAt)];
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
      organizationId: req.authUser!.organizationId,
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
    }).where(and(eq(marketingTemplatesTable.organizationId, req.authUser!.organizationId), eq(marketingTemplatesTable.id, req.params.id))).returning();
    if (!t) return res.status(404).json({ error: "Not found" });
    return res.json(t);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/marketing/templates/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingTemplatesTable).set({ deletedAt: new Date() }).where(and(eq(marketingTemplatesTable.organizationId, req.authUser!.organizationId), eq(marketingTemplatesTable.id, req.params.id)));
  return res.status(204).send();
});

// ─── SEGMENTATION HELPER (legacy + new audiences) ───────────────
async function buildAudience(orgId: string, segment: { audiences: string[]; statusFilter?: string; tags?: string[] }) {
  const audiences = segment.audiences || [];
  const recipients: Array<{ audienceType: string; refId: string | null; name: string; email: string | null; phone: string | null }> = [];

  if (audiences.includes("clients")) {
    const rows = await db.select().from(clientsTable).where(and(eq(clientsTable.organizationId, orgId), isNull(clientsTable.deletedAt)));
    for (const c of rows) recipients.push({ audienceType: "client", refId: c.id, name: c.name, email: c.email, phone: c.phone });
  }
  if (audiences.includes("collaborators")) {
    const rows = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));
    for (const c of rows) recipients.push({ audienceType: "collaborator", refId: c.id, name: `${c.firstName} ${c.lastName}`, email: c.email, phone: c.phone });
  }
  if (audiences.includes("prospects")) {
    const conds: any[] = [eq(prospectsTable.organizationId, orgId), isNull(prospectsTable.deletedAt)];
    if (segment.statusFilter) conds.push(eq(prospectsTable.status, segment.statusFilter));
    const rows = await db.select().from(prospectsTable).where(and(...conds));
    for (const p of rows) recipients.push({
      audienceType: "prospect", refId: p.id,
      name: p.company || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—",
      email: p.email, phone: p.phone,
    });
  }
  if (audiences.includes("users")) {
    // Restreindre aux utilisateurs membres de l'organisation courante
    const memberIds = (await db.select({ id: organizationMembersTable.userId })
      .from(organizationMembersTable)
      .where(eq(organizationMembersTable.organizationId, orgId))).map((m) => m.id);
    if (memberIds.length > 0) {
      const rows = await db.select().from(usersTable).where(and(eq(usersTable.isActive, true), inArray(usersTable.id, memberIds)));
      for (const u of rows) recipients.push({ audienceType: "user", refId: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, phone: u.phone });
    }
  }
  return recipients;
}

// ─── CAMPAIGNS ──────────────────────────────────────────────────
router.get("/marketing/campaigns", async (req, res) => {
  const data = await db.select().from(marketingCampaignsTable)
    .where(and(eq(marketingCampaignsTable.organizationId, req.authUser!.organizationId), isNull(marketingCampaignsTable.deletedAt)))
    .orderBy(desc(marketingCampaignsTable.createdAt));
  return res.json({ data });
});

router.get("/marketing/campaigns/:id", async (req, res) => {
  const [c] = await db.select().from(marketingCampaignsTable).where(and(eq(marketingCampaignsTable.organizationId, req.authUser!.organizationId), eq(marketingCampaignsTable.id, req.params.id))).limit(1);
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
    const [a] = await db.select().from(marketingAudiencesTable).where(and(eq(marketingAudiencesTable.organizationId, req.authUser!.organizationId), eq(marketingAudiencesTable.id, audienceId))).limit(1);
    if (!a) return res.status(404).json({ error: "Audience introuvable" });
    const contacts = await resolveAudienceContacts(a, req.authUser!.organizationId);
    return res.json({
      total: contacts.length,
      breakdown: contacts.reduce((acc: Record<string, number>, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {}),
      sample: contacts.slice(0, 10).map((c) => ({ name: c.name, email: c.email, phone: c.phone, audienceType: c.type })),
    });
  }
  if (!segment) return res.status(400).json({ error: "segment ou audienceId requis" });
  const audience = await buildAudience(req.authUser!.organizationId, segment);
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
      organizationId: req.authUser!.organizationId,
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
    }).where(and(eq(marketingCampaignsTable.organizationId, req.authUser!.organizationId), eq(marketingCampaignsTable.id, req.params.id))).returning();
    if (!c) return res.status(404).json({ error: "Not found" });
    return res.json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.post("/marketing/campaigns/:id/duplicate", requireManagerOrAbove, async (req: any, res) => {
  const [src] = await db.select().from(marketingCampaignsTable).where(and(eq(marketingCampaignsTable.organizationId, req.authUser!.organizationId), eq(marketingCampaignsTable.id, req.params.id))).limit(1);
  if (!src) return res.status(404).json({ error: "Not found" });
  const [c] = await db.insert(marketingCampaignsTable).values({
    organizationId: req.authUser!.organizationId,
    name: `${src.name} (copie)`,
    channel: src.channel, subject: src.subject, body: src.body,
    segment: src.segment as any, audienceId: src.audienceId, templateId: src.templateId,
    status: "draft", createdBy: req.user?.id,
  }).returning();
  return res.status(201).json(c);
});

router.delete("/marketing/campaigns/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingCampaignsTable).set({ deletedAt: new Date() }).where(and(eq(marketingCampaignsTable.organizationId, req.authUser!.organizationId), eq(marketingCampaignsTable.id, req.params.id)));
  return res.status(204).send();
});

router.post("/marketing/campaigns/:id/schedule", requireManagerOrAbove, async (req, res) => {
  const { scheduledAt } = req.body;
  if (!scheduledAt) return res.status(400).json({ error: "scheduledAt requis" });
  const [c] = await db.update(marketingCampaignsTable).set({
    scheduledAt: new Date(scheduledAt), status: "scheduled",
  }).where(and(eq(marketingCampaignsTable.organizationId, req.authUser!.organizationId), eq(marketingCampaignsTable.id, req.params.id))).returning();
  if (!c) return res.status(404).json({ error: "Not found" });
  return res.json(c);
});

// Envoi réel via Resend si un provider email est configuré pour l'organisation,
// sinon mode simulation (insertion destinataires sans envoi).
router.post("/marketing/campaigns/:id/send", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [c] = await db.select().from(marketingCampaignsTable)
      .where(and(eq(marketingCampaignsTable.organizationId, orgId), eq(marketingCampaignsTable.id, req.params.id))).limit(1);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.status === "sent") return res.status(409).json({ error: "Déjà envoyée" });

    // Résoudre l'audience
    let recipients: Array<{ audienceType: string; refId: string | null; name: string; email: string | null; phone: string | null }> = [];
    if (c.audienceId) {
      const [a] = await db.select().from(marketingAudiencesTable)
        .where(and(eq(marketingAudiencesTable.organizationId, orgId), eq(marketingAudiencesTable.id, c.audienceId))).limit(1);
      if (a) {
        const contacts = await resolveAudienceContacts(a, orgId);
        recipients = contacts.map((x) => ({ audienceType: x.type, refId: x.id, name: x.name, email: x.email, phone: x.phone }));
      }
    } else {
      recipients = await buildAudience(orgId, c.segment as any);
    }

    // Filtre consentement
    const consents = await db.select().from(marketingConsentTable).where(eq(marketingConsentTable.organizationId, orgId));
    const optOut = new Set(consents.filter((x) => !x.optIn && (x.channel === c.channel || c.channel === "multi")).map((x) => `${x.contactType}:${x.contactId}`));
    recipients = recipients.filter((r) => !r.refId || !optOut.has(`${r.audienceType}:${r.refId}`));

    const hasContact = (r: typeof recipients[number]) => {
      if (c.channel === "email") return !!r.email;
      if (c.channel === "sms" || c.channel === "whatsapp") return !!r.phone;
      return !!r.email || !!r.phone;
    };
    const valid = recipients.filter(hasContact);
    const failed = recipients.length - valid.length;

    // Générer les tokens de tracking par destinataire
    const validWithTokens = valid.map((r) => ({
      ...r, openToken: randomUUID(), clickToken: randomUUID(),
    }));

    // ── Envoi réel via Resend (canal email uniquement) ──────────
    let sendMode: "resend" | "preview" = "preview";
    let actualSent = 0;
    let actualFailed = 0;

    if (c.channel === "email" || c.channel === "multi") {
      const [emailConn] = await db.select().from(marketingChannelConnectionsTable)
        .where(and(
          eq(marketingChannelConnectionsTable.organizationId, orgId),
          eq(marketingChannelConnectionsTable.channel, "email"),
          eq(marketingChannelConnectionsTable.isActive, true),
        )).limit(1);

      const apiKey = emailConn?.config?.apiKey as string | undefined;
      if (apiKey) {
        sendMode = "resend";
        const resend = new Resend(apiKey);
        const fromEmail = (emailConn.config?.fromEmail as string) || "noreply@gameasu.com";
        const fromName = (emailConn.config?.fromName as string) || "Gaméasù";
        const baseUrl = getBaseUrl(req);

        for (const r of validWithTokens.filter((x) => x.email)) {
          try {
            const personalizedBody = substituteVars(c.body, {
              nom: r.name, prenom: r.name?.split(" ")[0] ?? "",
              email: r.email ?? "", telephone: r.phone ?? "",
            });
            await resend.emails.send({
              from: `${fromName} <${fromEmail}>`,
              to: r.email!,
              subject: substituteVars(c.subject ?? c.name, { nom: r.name, email: r.email ?? "" }),
              html: buildEmailHtml(personalizedBody, r.openToken, baseUrl),
            });
            actualSent++;
          } catch (sendErr: any) {
            actualFailed++;
            req.log.warn({ err: sendErr?.message, email: r.email }, "Resend: échec envoi");
          }
        }

        // Mettre à jour le statut de la connexion
        await db.update(marketingChannelConnectionsTable)
          .set({ lastCheckAt: new Date(), status: "ok" })
          .where(eq(marketingChannelConnectionsTable.id, emailConn.id));
      }
    }

    // ── Insérer les destinataires avec tokens ───────────────────
    if (validWithTokens.length > 0) {
      await db.insert(campaignRecipientsTable).values(
        validWithTokens.map((r) => ({
          organizationId: orgId,
          campaignId: c.id, audienceType: r.audienceType, refId: r.refId,
          name: r.name, email: r.email, phone: r.phone,
          status: "sent" as const, sentAt: new Date(),
          openToken: r.openToken, clickToken: r.clickToken,
        })),
      );
    }
    if (failed > 0) {
      const invalids = recipients.filter((r) => !hasContact(r));
      await db.insert(campaignRecipientsTable).values(
        invalids.map((r) => ({
          organizationId: orgId,
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
    }).where(and(eq(marketingCampaignsTable.organizationId, orgId), eq(marketingCampaignsTable.id, c.id))).returning();

    if (valid.length > 0 && c.channel !== "multi") {
      await db.update(marketingChannelConnectionsTable).set({
        volume30d: sql`${marketingChannelConnectionsTable.volume30d} + ${valid.length}`,
      }).where(and(
        eq(marketingChannelConnectionsTable.organizationId, orgId),
        eq(marketingChannelConnectionsTable.channel, c.channel),
        eq(marketingChannelConnectionsTable.isActive, true),
      ));
    }

    req.log.info({ campaignId: c.id, sendMode, sent: valid.length, failed, actualSent, actualFailed }, "Campagne envoyée");
    return res.json({ campaign: updated, sent: valid.length, failed, sendMode, actualSent, actualFailed });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ─── AUTOMATIONS ────────────────────────────────────────────────
router.get("/marketing/automations", async (req, res) => {
  const data = await db.select().from(marketingAutomationsTable)
    .where(and(eq(marketingAutomationsTable.organizationId, req.authUser!.organizationId), isNull(marketingAutomationsTable.deletedAt)))
    .orderBy(desc(marketingAutomationsTable.createdAt));
  return res.json({ data });
});

router.get("/marketing/automations/:id", async (req, res) => {
  const [a] = await db.select().from(marketingAutomationsTable).where(and(eq(marketingAutomationsTable.organizationId, req.authUser!.organizationId), eq(marketingAutomationsTable.id, req.params.id))).limit(1);
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
      organizationId: req.authUser!.organizationId,
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
    }).where(and(eq(marketingAutomationsTable.organizationId, req.authUser!.organizationId), eq(marketingAutomationsTable.id, req.params.id))).returning();
    if (!a) return res.status(404).json({ error: "Not found" });
    return res.json(a);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.post("/marketing/automations/:id/toggle", requireManagerOrAbove, async (req, res) => {
  const [a] = await db.select().from(marketingAutomationsTable).where(and(eq(marketingAutomationsTable.organizationId, req.authUser!.organizationId), eq(marketingAutomationsTable.id, req.params.id))).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const [u] = await db.update(marketingAutomationsTable).set({ isActive: !a.isActive }).where(eq(marketingAutomationsTable.id, a.id)).returning();
  return res.json(u);
});

router.delete("/marketing/automations/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingAutomationsTable).set({ deletedAt: new Date() }).where(and(eq(marketingAutomationsTable.organizationId, req.authUser!.organizationId), eq(marketingAutomationsTable.id, req.params.id)));
  return res.status(204).send();
});

// Exécution manuelle (test) d'une automatisation : log + incrémente le compteur.
router.post("/marketing/automations/:id/run", requireManagerOrAbove, async (req, res) => {
  const [a] = await db.select().from(marketingAutomationsTable).where(and(eq(marketingAutomationsTable.organizationId, req.authUser!.organizationId), eq(marketingAutomationsTable.id, req.params.id))).limit(1);
  if (!a) return res.status(404).json({ error: "Not found" });
  const steps = (a.steps as any[]) || [];
  await db.insert(marketingAutomationLogsTable).values({
    organizationId: req.authUser!.organizationId,
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
router.get("/marketing/alerts/rules", async (req, res) => {
  const data = await db.select().from(marketingAlertRulesTable)
    .where(and(eq(marketingAlertRulesTable.organizationId, req.authUser!.organizationId), isNull(marketingAlertRulesTable.deletedAt)))
    .orderBy(desc(marketingAlertRulesTable.createdAt));
  return res.json({ data });
});

router.post("/marketing/alerts/rules", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { name, description, source, config = {}, channels = ["email"], templateId, isActive = true } = req.body;
    if (!name || !source) return res.status(400).json({ error: "name et source requis" });
    const [r] = await db.insert(marketingAlertRulesTable).values({
      organizationId: req.authUser!.organizationId,
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
    }).where(and(eq(marketingAlertRulesTable.organizationId, req.authUser!.organizationId), eq(marketingAlertRulesTable.id, req.params.id))).returning();
    if (!r) return res.status(404).json({ error: "Not found" });
    return res.json(r);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/marketing/alerts/rules/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingAlertRulesTable).set({ deletedAt: new Date() }).where(and(eq(marketingAlertRulesTable.organizationId, req.authUser!.organizationId), eq(marketingAlertRulesTable.id, req.params.id)));
  return res.status(204).send();
});

router.get("/marketing/alerts/logs", async (req, res) => {
  const ruleId = (req.query as any).ruleId as string | undefined;
  // Scope via rule ownership : limite aux règles de l'org courante
  const ownedRuleIds = (await db.select({ id: marketingAlertRulesTable.id })
    .from(marketingAlertRulesTable)
    .where(eq(marketingAlertRulesTable.organizationId, req.authUser!.organizationId))).map((r) => r.id);
  if (ownedRuleIds.length === 0) return res.json({ data: [] });
  const conds: any[] = [inArray(marketingAlertLogsTable.ruleId, ownedRuleIds)];
  if (ruleId) conds.push(eq(marketingAlertLogsTable.ruleId, ruleId));
  const data = await db.select().from(marketingAlertLogsTable)
    .where(and(...conds))
    .orderBy(desc(marketingAlertLogsTable.sentAt))
    .limit(200);
  return res.json({ data });
});

// Exécution manuelle d'une règle d'alerte : balaie les entités cibles et logge.
router.post("/marketing/alerts/rules/:id/run", requireManagerOrAbove, async (req, res) => {
  const [rule] = await db.select().from(marketingAlertRulesTable).where(and(eq(marketingAlertRulesTable.organizationId, req.authUser!.organizationId), eq(marketingAlertRulesTable.id, req.params.id))).limit(1);
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
        eq(invoicesTable.organizationId, rule.organizationId),
        rule.source === "invoice_overdue"
          ? lte(invoicesTable.dueDate, now.toISOString().slice(0, 10) as any)
          : and(gte(invoicesTable.dueDate, now.toISOString().slice(0, 10) as any), lte(invoicesTable.dueDate, target.toISOString().slice(0, 10) as any)),
      )).limit(200);
    for (const inv of invs) {
      for (const ch of channels) {
        await db.insert(marketingAlertLogsTable).values({
          organizationId: rule.organizationId,
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
        eq(rentalsTable.organizationId, rule.organizationId),
        gte(rentalsTable.endDate, now.toISOString().slice(0, 10) as any),
        lte(rentalsTable.endDate, target.toISOString().slice(0, 10) as any),
      )).limit(200);
    for (const r of rentals) {
      for (const ch of channels) {
        await db.insert(marketingAlertLogsTable).values({
          organizationId: rule.organizationId,
          ruleId: rule.id, entityType: "rental", entityId: r.id,
          channel: ch, recipient: r.clientId, status: "sent",
        });
        sent++;
      }
    }
  } else {
    // stub : 1 log "skipped"
    await db.insert(marketingAlertLogsTable).values({
      organizationId: rule.organizationId,
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
  const conds: any[] = [eq(marketingConsentTable.organizationId, req.authUser!.organizationId)];
  if (contactType) conds.push(eq(marketingConsentTable.contactType, contactType));
  if (contactId) conds.push(eq(marketingConsentTable.contactId, contactId));
  const data = await db.select().from(marketingConsentTable)
    .where(and(...conds))
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
        eq(marketingConsentTable.organizationId, req.authUser!.organizationId),
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
      organizationId: req.authUser!.organizationId,
      contactType, contactId, channel, optIn: optIn ?? true,
      source, preferredLanguage, updatedBy: req.user?.id,
    }).returning();
    return res.status(201).json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

// ─── CHANNEL CONNECTIONS ────────────────────────────────────────
router.get("/marketing/channels", async (req, res) => {
  const data = await db.select().from(marketingChannelConnectionsTable)
    .where(eq(marketingChannelConnectionsTable.organizationId, req.authUser!.organizationId))
    .orderBy(marketingChannelConnectionsTable.channel);
  return res.json({ data });
});

router.put("/marketing/channels/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { displayName, config, isActive, status } = req.body;
    const [c] = await db.update(marketingChannelConnectionsTable).set({
      displayName, config, isActive, status,
      lastCheckAt: new Date(),
    }).where(and(eq(marketingChannelConnectionsTable.organizationId, req.authUser!.organizationId), eq(marketingChannelConnectionsTable.id, req.params.id))).returning();
    if (!c) return res.status(404).json({ error: "Not found" });
    return res.json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.post("/marketing/channels", requireManagerOrAbove, async (req, res) => {
  try {
    const { channel, provider, displayName, config = {}, isActive = false } = req.body;
    if (!channel || !provider) return res.status(400).json({ error: "channel et provider requis" });
    const [c] = await db.insert(marketingChannelConnectionsTable).values({
      organizationId: req.authUser!.organizationId,
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
router.get("/marketing/dashboard", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [{ total: totalCamp }] = await db.select({ total: sql<number>`count(*)` })
    .from(marketingCampaignsTable).where(and(eq(marketingCampaignsTable.organizationId, orgId), isNull(marketingCampaignsTable.deletedAt)));
  const [{ sent }] = await db.select({ sent: sql<number>`coalesce(sum(sent_count),0)` })
    .from(marketingCampaignsTable).where(and(eq(marketingCampaignsTable.organizationId, orgId), isNull(marketingCampaignsTable.deletedAt)));
  const [{ totalProspects }] = await db.select({ totalProspects: sql<number>`count(*)` })
    .from(prospectsTable).where(and(eq(prospectsTable.organizationId, orgId), isNull(prospectsTable.deletedAt)));
  const byStatus = await db.select({ status: prospectsTable.status, count: sql<number>`count(*)` })
    .from(prospectsTable).where(and(eq(prospectsTable.organizationId, orgId), isNull(prospectsTable.deletedAt))).groupBy(prospectsTable.status);
  return res.json({
    totalCampaigns: Number(totalCamp),
    totalMessagesSent: Number(sent),
    totalProspects: Number(totalProspects),
    prospectsByStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
  });
});

router.get("/marketing/overview", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [campCounts] = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) filter (where status in ('running','scheduled'))`,
    scheduled: sql<number>`count(*) filter (where status = 'scheduled')`,
    sent: sql<number>`count(*) filter (where status = 'sent')`,
    draft: sql<number>`count(*) filter (where status = 'draft')`,
  }).from(marketingCampaignsTable).where(and(eq(marketingCampaignsTable.organizationId, orgId), isNull(marketingCampaignsTable.deletedAt)));

  const byChannel = await db.select({
    channel: marketingCampaignsTable.channel,
    count: sql<number>`count(*)`,
    sentTotal: sql<number>`coalesce(sum(sent_count),0)`,
  }).from(marketingCampaignsTable)
    .where(and(eq(marketingCampaignsTable.organizationId, orgId), isNull(marketingCampaignsTable.deletedAt)))
    .groupBy(marketingCampaignsTable.channel);

  const [totals] = await db.select({
    sent: sql<number>`coalesce(sum(sent_count),0)`,
    failed: sql<number>`coalesce(sum(failed_count),0)`,
    opens: sql<number>`coalesce(sum(open_count),0)`,
    clicks: sql<number>`coalesce(sum(click_count),0)`,
    replies: sql<number>`coalesce(sum(reply_count),0)`,
    unsubs: sql<number>`coalesce(sum(unsubscribe_count),0)`,
    recipients: sql<number>`coalesce(sum(recipients_count),0)`,
  }).from(marketingCampaignsTable).where(and(eq(marketingCampaignsTable.organizationId, orgId), isNull(marketingCampaignsTable.deletedAt)));

  const [{ totalProspects }] = await db.select({ totalProspects: sql<number>`count(*)` })
    .from(prospectsTable).where(and(eq(prospectsTable.organizationId, orgId), isNull(prospectsTable.deletedAt)));
  const [{ converted }] = await db.select({ converted: sql<number>`count(*)` })
    .from(prospectsTable).where(and(eq(prospectsTable.organizationId, orgId), isNull(prospectsTable.deletedAt), eq(prospectsTable.status, "converted")));

  const [autos] = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) filter (where is_active = true)`,
    runs: sql<number>`coalesce(sum(runs_count),0)`,
  }).from(marketingAutomationsTable).where(and(eq(marketingAutomationsTable.organizationId, orgId), isNull(marketingAutomationsTable.deletedAt)));

  const [alerts] = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) filter (where is_active = true)`,
    sent: sql<number>`coalesce(sum(sent_count),0)`,
  }).from(marketingAlertRulesTable).where(and(eq(marketingAlertRulesTable.organizationId, orgId), isNull(marketingAlertRulesTable.deletedAt)));

  const [aud] = await db.select({
    total: sql<number>`count(*)`,
    contacts: sql<number>`coalesce(sum(contacts_count),0)`,
  }).from(marketingAudiencesTable).where(and(eq(marketingAudiencesTable.organizationId, orgId), isNull(marketingAudiencesTable.deletedAt)));

  const topCampaigns = await db.select().from(marketingCampaignsTable)
    .where(and(eq(marketingCampaignsTable.organizationId, orgId), isNull(marketingCampaignsTable.deletedAt), eq(marketingCampaignsTable.status, "sent")))
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

  const conds: any[] = [eq(marketingCampaignsTable.organizationId, req.authUser!.organizationId), isNull(marketingCampaignsTable.deletedAt)];
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

  const orgId = req.authUser!.organizationId;
  const camps = await db.select().from(marketingCampaignsTable)
    .where(and(
      eq(marketingCampaignsTable.organizationId, orgId),
      isNull(marketingCampaignsTable.deletedAt),
      or(
        and(gte(marketingCampaignsTable.scheduledAt, fromD), lte(marketingCampaignsTable.scheduledAt, toD)),
        and(gte(marketingCampaignsTable.sentAt, fromD), lte(marketingCampaignsTable.sentAt, toD)),
      ),
    ));
  const ownedRuleIds = (await db.select({ id: marketingAlertRulesTable.id })
    .from(marketingAlertRulesTable)
    .where(eq(marketingAlertRulesTable.organizationId, orgId))).map((r) => r.id);
  const alerts = ownedRuleIds.length === 0 ? [] : await db.select().from(marketingAlertLogsTable)
    .where(and(
      inArray(marketingAlertLogsTable.ruleId, ownedRuleIds),
      gte(marketingAlertLogsTable.sentAt, fromD),
      lte(marketingAlertLogsTable.sentAt, toD),
    ))
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

// ─── FORMULAIRES MARKETING (CRUD) ───────────────────────────────

router.get("/marketing/forms", async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const forms = await db.select().from(marketingFormsTable)
      .where(and(eq(marketingFormsTable.organizationId, orgId), isNull(marketingFormsTable.deletedAt)))
      .orderBy(desc(marketingFormsTable.createdAt));
    return res.json({ data: forms });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/marketing/forms", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { name, slug, description, fields, confirmationMessage, sourceTag, automationId, isActive } = req.body;
    if (!name) return res.status(400).json({ error: "Le nom est requis" });
    if (!fields || !Array.isArray(fields)) return res.status(400).json({ error: "Les champs sont requis" });
    const [form] = await db.insert(marketingFormsTable).values({
      organizationId: orgId, name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: description || null, fields, confirmationMessage: confirmationMessage || null,
      sourceTag: sourceTag || "form", automationId: automationId || null,
      isActive: isActive ?? true, createdBy: req.authUser!.id,
    }).returning();
    return res.status(201).json(form);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/marketing/forms/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { name, slug, description, fields, confirmationMessage, sourceTag, automationId, isActive } = req.body;
    const [form] = await db.update(marketingFormsTable)
      .set({
        name, slug, description: description ?? null, fields,
        confirmationMessage: confirmationMessage ?? null,
        sourceTag: sourceTag ?? "form", automationId: automationId ?? null,
        isActive: isActive ?? true, updatedAt: new Date(),
      })
      .where(and(eq(marketingFormsTable.organizationId, orgId), eq(marketingFormsTable.id, req.params.id), isNull(marketingFormsTable.deletedAt)))
      .returning();
    if (!form) return res.status(404).json({ error: "Not found" });
    return res.json(form);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.delete("/marketing/forms/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.update(marketingFormsTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(marketingFormsTable.organizationId, orgId), eq(marketingFormsTable.id, req.params.id)));
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

export default router;
