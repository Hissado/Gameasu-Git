import { Router } from "express";
import { db } from "@workspace/db";
import { opportunitiesTable, activitiesTable, clientsTable, usersTable } from "@workspace/db";
import { eq, ilike, sql, isNull } from "drizzle-orm";

const router = Router();

router.get("/crm/opportunities", async (req, res) => {
  const { stage, clientId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const opps = await db.select({
    opp: opportunitiesTable,
    clientName: clientsTable.name,
    assignedToName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(opportunitiesTable)
    .leftJoin(clientsTable, eq(opportunitiesTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(opportunitiesTable.assignedToId, usersTable.id))
    .where(isNull(opportunitiesTable.deletedAt))
    .limit(limitNum).offset(offset);

  const data = opps.map(row => ({
    ...row.opp,
    clientName: row.clientName,
    assignedToName: row.assignedToName,
    value: row.opp.value ? Number(row.opp.value) : null,
  }));

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(opportunitiesTable).where(isNull(opportunitiesTable.deletedAt));
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/crm/opportunities", async (req, res) => {
  const { title, clientId, stage, value, currency, probability, assignedToId, expectedCloseDate, notes } = req.body;
  const [opp] = await db.insert(opportunitiesTable).values({
    title, clientId, stage: stage || "lead", value: value?.toString(), currency, probability, assignedToId, expectedCloseDate, notes,
  }).returning();
  return res.status(201).json({ ...opp, value: opp.value ? Number(opp.value) : null });
});

router.get("/crm/opportunities/:id", async (req, res) => {
  const opps = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, req.params.id)).limit(1);
  if (!opps[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...opps[0], value: opps[0].value ? Number(opps[0].value) : null });
});

router.put("/crm/opportunities/:id", async (req, res) => {
  const { title, clientId, stage, value, currency, probability, assignedToId, expectedCloseDate, notes } = req.body;
  const [opp] = await db.update(opportunitiesTable).set({ title, clientId, stage, value: value?.toString(), currency, probability, assignedToId, expectedCloseDate, notes })
    .where(eq(opportunitiesTable.id, req.params.id)).returning();
  if (!opp) return res.status(404).json({ error: "Not found" });
  return res.json({ ...opp, value: opp.value ? Number(opp.value) : null });
});

router.delete("/crm/opportunities/:id", async (req, res) => {
  await db.update(opportunitiesTable).set({ deletedAt: new Date() }).where(eq(opportunitiesTable.id, req.params.id));
  return res.status(204).send();
});

router.get("/crm/pipeline", async (req, res) => {
  const stages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
  const opps = await db.select().from(opportunitiesTable).where(isNull(opportunitiesTable.deletedAt));
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

  const acts = await db.select({
    act: activitiesTable,
    userName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(activitiesTable)
    .leftJoin(usersTable, eq(activitiesTable.userId, usersTable.id))
    .limit(limitNum).offset(offset);

  const data = acts.map(row => ({ ...row.act, userName: row.userName }));
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(activitiesTable);
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/crm/activities", async (req, res) => {
  const { type, subject, description, clientId, opportunityId, scheduledAt } = req.body;
  const [act] = await db.insert(activitiesTable).values({
    type, subject, description, clientId, opportunityId,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
  }).returning();
  return res.status(201).json(act);
});

export default router;
