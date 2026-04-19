import { Router } from "express";
import { requireManagerOrAbove, requireAdmin } from "../middlewares/auth";
import { db } from "@workspace/db";
import { projectsTable, projectPhasesTable, clientsTable, usersTable, tasksTable } from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";

const router = Router();

router.get("/projects", async (req, res) => {
  const { status, clientId, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({
    proj: projectsTable,
    clientName: clientsTable.name,
    managerName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(projectsTable.managerId, usersTable.id))
    .where(isNull(projectsTable.deletedAt))
    .limit(limitNum).offset(offset);

  const data = rows.map(row => ({
    ...row.proj,
    clientName: row.clientName,
    managerName: row.managerName,
    budget: row.proj.budget ? Number(row.proj.budget) : null,
  }));

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(isNull(projectsTable.deletedAt));
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/projects", requireManagerOrAbove, async (req, res) => {
  const { name, description, status, clientId, managerId, startDate, endDate, budget, documentLinks } = req.body;
  const [proj] = await db.insert(projectsTable).values({
    name, description, status: status || "planning", clientId, managerId, startDate, endDate,
    budget: budget?.toString(), documentLinks: documentLinks || [],
  }).returning();
  return res.status(201).json({ ...proj, budget: proj.budget ? Number(proj.budget) : null });
});

router.get("/projects/stats", async (req, res) => {
  const allProjects = await db.select().from(projectsTable).where(isNull(projectsTable.deletedAt));
  const statuses = ["planning", "active", "on_hold", "completed", "cancelled"];
  const byStatus = statuses.map(s => ({ status: s, count: allProjects.filter(p => p.status === s).length }));
  return res.json({
    total: allProjects.length,
    byStatus,
    activeCount: allProjects.filter(p => p.status === "active").length,
    completedCount: allProjects.filter(p => p.status === "completed").length,
  });
});

router.get("/projects/:id", async (req, res) => {
  const rows = await db.select({
    proj: projectsTable,
    clientName: clientsTable.name,
    managerName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(projectsTable.managerId, usersTable.id))
    .where(eq(projectsTable.id, req.params.id)).limit(1);

  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const phases = await db.select().from(projectPhasesTable).where(eq(projectPhasesTable.projectId, req.params.id));
  const allTasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, req.params.id));

  return res.json({
    ...rows[0].proj,
    clientName: rows[0].clientName,
    managerName: rows[0].managerName,
    budget: rows[0].proj.budget ? Number(rows[0].proj.budget) : null,
    phases,
    tasksCount: allTasks.length,
    tasksCompleted: allTasks.filter(t => t.status === "done").length,
    collaborators: [],
  });
});

router.put("/projects/:id", requireManagerOrAbove, async (req, res) => {
  const { name, description, status, clientId, managerId, startDate, endDate, budget, documentLinks } = req.body;
  const [proj] = await db.update(projectsTable)
    .set({ name, description, status, clientId, managerId, startDate, endDate, budget: budget?.toString(), documentLinks })
    .where(eq(projectsTable.id, req.params.id)).returning();
  if (!proj) return res.status(404).json({ error: "Not found" });
  return res.json({ ...proj, budget: proj.budget ? Number(proj.budget) : null });
});

router.delete("/projects/:id", requireAdmin, async (req, res) => {
  await db.update(projectsTable).set({ deletedAt: new Date() }).where(eq(projectsTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
