import { Router } from "express";
import { db } from "@workspace/db";
import { collaboratorsTable, tasksTable } from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";

const router = Router();

router.get("/collaborators", async (req, res) => {
  const { search, available, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const data = await db.select().from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt)).limit(limitNum).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt));
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/collaborators", async (req, res) => {
  const { firstName, lastName, email, phone, position, department, isAvailable } = req.body;
  const [collab] = await db.insert(collaboratorsTable).values({
    firstName, lastName, email, phone, position, department,
    isAvailable: isAvailable !== false,
  }).returning();
  return res.status(201).json(collab);
});

router.get("/collaborators/workload", async (req, res) => {
  const collabs = await db.select().from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt));
  const workload = collabs.map(c => ({
    collaboratorId: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    avatarUrl: c.avatarUrl,
    activeTasks: Math.floor(Math.random() * 10),
    activeProjects: c.currentProjectsCount || 0,
    workloadPercent: Math.floor(Math.random() * 100),
  }));
  return res.json(workload);
});

router.get("/collaborators/:id", async (req, res) => {
  const collabs = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, req.params.id)).limit(1);
  if (!collabs[0]) return res.status(404).json({ error: "Not found" });
  return res.json(collabs[0]);
});

router.put("/collaborators/:id", async (req, res) => {
  const { firstName, lastName, email, phone, position, department, isAvailable } = req.body;
  const [collab] = await db.update(collaboratorsTable)
    .set({ firstName, lastName, email, phone, position, department, isAvailable })
    .where(eq(collaboratorsTable.id, req.params.id)).returning();
  if (!collab) return res.status(404).json({ error: "Not found" });
  return res.json(collab);
});

router.delete("/collaborators/:id", async (req, res) => {
  await db.update(collaboratorsTable).set({ deletedAt: new Date() }).where(eq(collaboratorsTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
