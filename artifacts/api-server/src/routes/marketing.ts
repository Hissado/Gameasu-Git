import { Router } from "express";
import {
  db,
  prospectsTable,
  marketingCampaignsTable,
  campaignRecipientsTable,
  clientsTable,
  collaboratorsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, ilike, or, inArray } from "drizzle-orm";
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

// ─── SEGMENTATION ───────────────────────────────────────────────
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
  const { segment } = req.body;
  if (!segment) return res.status(400).json({ error: "segment requis" });
  const audience = await buildAudience(segment);
  return res.json({
    total: audience.length,
    breakdown: audience.reduce((acc: Record<string, number>, r) => { acc[r.audienceType] = (acc[r.audienceType] || 0) + 1; return acc; }, {}),
    sample: audience.slice(0, 10),
  });
});

router.post("/marketing/campaigns", requireManagerOrAbove, async (req: any, res) => {
  try {
    const { name, channel, subject, body, segment, scheduledAt } = req.body;
    if (!name || !channel || !body || !segment) return res.status(400).json({ error: "champs requis manquants" });
    if (!["email", "sms"].includes(channel)) return res.status(400).json({ error: "channel doit être email ou sms" });
    const [c] = await db.insert(marketingCampaignsTable).values({
      name, channel, subject, body, segment,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdBy: req.user?.id,
    }).returning();
    return res.status(201).json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.put("/marketing/campaigns/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { name, channel, subject, body, segment, scheduledAt, status } = req.body;
    const [c] = await db.update(marketingCampaignsTable).set({
      name, channel, subject, body, segment, status,
      ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
    }).where(eq(marketingCampaignsTable.id, req.params.id)).returning();
    if (!c) return res.status(404).json({ error: "Not found" });
    return res.json(c);
  } catch (e: any) { return res.status(400).json({ error: e.message }); }
});

router.delete("/marketing/campaigns/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(marketingCampaignsTable).set({ deletedAt: new Date() }).where(eq(marketingCampaignsTable.id, req.params.id));
  return res.status(204).send();
});

// Envoi (mode dry-run par défaut : enregistre les destinataires + log
// console; en production brancher SendGrid/Twilio via integration).
router.post("/marketing/campaigns/:id/send", requireManagerOrAbove, async (req, res) => {
  try {
    const [c] = await db.select().from(marketingCampaignsTable).where(eq(marketingCampaignsTable.id, req.params.id)).limit(1);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.status === "sent") return res.status(409).json({ error: "Déjà envoyée" });
    const audience = await buildAudience(c.segment as any);
    const valid = audience.filter((r) => c.channel === "email" ? !!r.email : !!r.phone);
    const failed = audience.length - valid.length;

    // Insertion en lot des destinataires
    if (valid.length > 0) {
      await db.insert(campaignRecipientsTable).values(
        valid.map((r) => ({
          campaignId: c.id,
          audienceType: r.audienceType,
          refId: r.refId,
          name: r.name,
          email: r.email,
          phone: r.phone,
          status: "sent" as const,
          sentAt: new Date(),
        }))
      );
    }
    if (failed > 0) {
      const invalids = audience.filter((r) => c.channel === "email" ? !r.email : !r.phone);
      await db.insert(campaignRecipientsTable).values(
        invalids.map((r) => ({
          campaignId: c.id,
          audienceType: r.audienceType,
          refId: r.refId,
          name: r.name,
          email: r.email,
          phone: r.phone,
          status: "failed" as const,
          errorMsg: c.channel === "email" ? "Email manquant" : "Téléphone manquant",
        }))
      );
    }

    const [updated] = await db.update(marketingCampaignsTable).set({
      status: "sent",
      sentAt: new Date(),
      recipientsCount: audience.length,
      sentCount: valid.length,
      failedCount: failed,
    }).where(eq(marketingCampaignsTable.id, c.id)).returning();

    console.log(`[MARKETING] Campagne "${c.name}" envoyée — ${valid.length}/${audience.length} ${c.channel}(s) délivrés (mode simulation)`);
    return res.json({ campaign: updated, sent: valid.length, failed });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

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

export default router;
