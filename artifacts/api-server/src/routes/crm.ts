import { Router } from "express";
import { db } from "@workspace/db";
import { opportunitiesTable, activitiesTable, clientsTable, usersTable } from "@workspace/db";
import { eq, ilike, sql, isNull, and } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";

const router = Router();

router.get("/crm/opportunities", async (req, res) => {
  const { stage, clientId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const orgFilter = and(eq(opportunitiesTable.organizationId, req.authUser!.organizationId), isNull(opportunitiesTable.deletedAt));
  const opps = await db.select({
    opp: opportunitiesTable,
    clientName: clientsTable.name,
    assignedToName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(opportunitiesTable)
    .leftJoin(clientsTable, eq(opportunitiesTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(opportunitiesTable.assignedToId, usersTable.id))
    .where(orgFilter)
    .limit(limitNum).offset(offset);

  const data = opps.map(row => ({
    ...row.opp,
    clientName: row.clientName,
    assignedToName: row.assignedToName,
    value: row.opp.value ? Number(row.opp.value) : null,
  }));

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(orgFilter);
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/crm/opportunities", requirePermission("commercial.manage"), async (req, res) => {
  const { title, clientId, stage, value, currency, probability, assignedToId, expectedCloseDate, notes } = req.body;
  const [opp] = await db.insert(opportunitiesTable).values({
    organizationId: req.authUser!.organizationId,
    title, clientId, stage: stage || "lead", value: value?.toString(), currency, probability, assignedToId, expectedCloseDate, notes,
  }).returning();
  return res.status(201).json({ ...opp, value: opp.value ? Number(opp.value) : null });
});

router.get("/crm/opportunities/:id", async (req, res) => {
  const opps = await db.select().from(opportunitiesTable).where(and(eq(opportunitiesTable.organizationId, req.authUser!.organizationId), eq(opportunitiesTable.id, (req.params.id as string)))).limit(1);
  if (!opps[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...opps[0], value: opps[0].value ? Number(opps[0].value) : null });
});

router.put("/crm/opportunities/:id", requirePermission("commercial.manage"), async (req, res) => {
  const { title, clientId, stage, value, currency, probability, assignedToId, expectedCloseDate, notes } = req.body;
  const [opp] = await db.update(opportunitiesTable).set({ title, clientId, stage, value: value?.toString(), currency, probability, assignedToId, expectedCloseDate, notes })
    .where(and(eq(opportunitiesTable.organizationId, req.authUser!.organizationId), eq(opportunitiesTable.id, (req.params.id as string)))).returning();
  if (!opp) return res.status(404).json({ error: "Not found" });
  return res.json({ ...opp, value: opp.value ? Number(opp.value) : null });
});

router.delete("/crm/opportunities/:id", requirePermission("commercial.manage"), async (req, res) => {
  await db.update(opportunitiesTable).set({ deletedAt: new Date() }).where(and(eq(opportunitiesTable.organizationId, req.authUser!.organizationId), eq(opportunitiesTable.id, (req.params.id as string))));
  return res.status(204).send();
});

router.get("/crm/pipeline", async (req, res) => {
  const stages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
  const opps = await db.select().from(opportunitiesTable).where(and(eq(opportunitiesTable.organizationId, req.authUser!.organizationId), isNull(opportunitiesTable.deletedAt)));
  const stageData = stages.map(stage => {
    const items = opps.filter(o => o.stage === stage);
    return {
      stage,
      count: items.length,
      totalValue: items.reduce((sum, o) => sum + (o.value ? Number(o.value) : 0), 0),
    };
  });
  const totalValue = opps.reduce((sum, o) => sum + (o.value ? Number(o.value) : 0), 0);
  return res.json({ stages: stageData, totalValue, totalOpportunities: opps.length });
});

router.get("/crm/activities", async (req, res) => {
  const { clientId, opportunityId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const orgFilter = eq(activitiesTable.organizationId, req.authUser!.organizationId);
  const acts = await db.select({
    act: activitiesTable,
    userName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(activitiesTable)
    .leftJoin(usersTable, eq(activitiesTable.userId, usersTable.id))
    .where(orgFilter)
    .limit(limitNum).offset(offset);

  const data = acts.map(row => ({ ...row.act, userName: row.userName }));
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(activitiesTable).where(orgFilter);
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/crm/activities", requirePermission("commercial.manage"), async (req, res) => {
  const { type, subject, description, clientId, opportunityId, scheduledAt } = req.body;
  const [act] = await db.insert(activitiesTable).values({
    organizationId: req.authUser!.organizationId,
    type, subject, description, clientId, opportunityId,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
  }).returning();
  return res.status(201).json(act);
});

// ─── POST /crm/opportunities/:id/convert-to-client ───────────────────────────
router.post("/crm/opportunities/:id/convert-to-client", requirePermission("commercial.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [opp] = await db.select().from(opportunitiesTable)
      .where(and(eq(opportunitiesTable.organizationId, orgId), eq(opportunitiesTable.id, (req.params.id as string)))).limit(1);
    if (!opp) { res.status(404).json({ error: "Opportunité introuvable" }); return; }

    let clientId = opp.clientId;
    let created = false;

    if (clientId) {
      await db.update(clientsTable)
        .set({ status: "active" })
        .where(and(eq(clientsTable.organizationId, orgId), eq(clientsTable.id, clientId)));
    } else {
      const { name, email, phone, industry } = req.body as Record<string, string>;
      const [newClient] = await db.insert(clientsTable).values({
        organizationId: orgId,
        name: name || opp.title,
        email: email ?? undefined,
        phone: phone ?? undefined,
        industry: industry ?? undefined,
        status: "active",
      }).returning();
      clientId = newClient.id;
      created = true;
    }

    const [updatedOpp] = await db.update(opportunitiesTable)
      .set({ stage: "won", clientId })
      .where(and(eq(opportunitiesTable.organizationId, orgId), eq(opportunitiesTable.id, (req.params.id as string))))
      .returning();

    res.json({ clientId, created, opportunity: { ...updatedOpp, value: updatedOpp.value ? Number(updatedOpp.value) : null } });
  } catch (e) { next(e); }
});

export default router;
