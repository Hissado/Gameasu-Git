import { Router } from "express";
import { requireManagerOrAbove, requireAdmin } from "../middlewares/auth";
import { requirePermission } from "../middlewares/permissions";
import { db } from "@workspace/db";
import { projectsTable, projectPhasesTable, clientsTable, usersTable, tasksTable } from "@workspace/db";
import { and, eq, sql, isNull, inArray } from "drizzle-orm";
import { userAccessibleProjectIds, userHasProjectAccess, userHasClientAccess } from "../lib/rbac/permissions";

const router = Router();

router.get("/projects", requirePermission("projects.read"), async (req, res, next) => {
  try {
    const { page = "1", limit = "20", clientId } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const accessible = req.authUser ? await userAccessibleProjectIds(req.authUser.id) : [];
    const conds: any[] = [
      eq(projectsTable.organizationId, req.authUser!.organizationId),
      isNull(projectsTable.deletedAt),
    ];
    if (accessible !== null) {
      if (accessible.length === 0) {
        return res.json({ data: [], total: 0, page: pageNum, limit: limitNum });
      }
      conds.push(inArray(projectsTable.id, accessible));
    }
    if (clientId) {
      if (req.authUser && !(await userHasClientAccess(req.authUser.id, clientId))) {
        return res.json({ data: [], total: 0, page: pageNum, limit: limitNum });
      }
      conds.push(eq(projectsTable.clientId, clientId));
    }
    const where = and(...conds);

    const [rows, countResult] = await Promise.all([
      db.select({
        proj: projectsTable,
        clientName: clientsTable.name,
        managerName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
      })
        .from(projectsTable)
        .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
        .leftJoin(usersTable, eq(projectsTable.managerId, usersTable.id))
        .where(where)
        .limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(where),
    ]);

    const data = rows.map(row => ({
      ...row.proj,
      clientName: row.clientName,
      managerName: row.managerName,
      budget: row.proj.budget ? Number(row.proj.budget) : null,
    }));

    return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
  } catch (e) { next(e); }
});

router.post("/projects", requireManagerOrAbove, async (req, res, next) => {
  try {
    const { name, description, status, clientId, managerId, startDate, endDate, budget, documentLinks } = req.body;
    if (clientId && req.authUser && !(await userHasClientAccess(req.authUser.id, clientId))) {
      return res.status(403).json({ error: "Accès refusé au client cible" });
    }
    const [proj] = await db.insert(projectsTable).values({
      organizationId: req.authUser!.organizationId,
      name, description, status: status || "planning", clientId, managerId, startDate, endDate,
      budget: budget?.toString(), documentLinks: documentLinks || [],
    }).returning();
    return res.status(201).json({ ...proj, budget: proj.budget ? Number(proj.budget) : null });
  } catch (e) { next(e); }
});

router.get("/projects/stats", requirePermission("projects.read"), async (req, res, next) => {
  try {
    const accessible = req.authUser ? await userAccessibleProjectIds(req.authUser.id) : null;
    const orgCond = eq(projectsTable.organizationId, req.authUser!.organizationId);

    if (accessible !== null && accessible.length === 0) {
      return res.json({ total: 0, totalCount: 0, activeCount: 0, completedCount: 0, byStatus: [] });
    }

    const where = accessible !== null && accessible.length > 0
      ? and(orgCond, isNull(projectsTable.deletedAt), inArray(projectsTable.id, accessible))
      : and(orgCond, isNull(projectsTable.deletedAt));

    const byStatusRows = await db.select({
      status: projectsTable.status,
      count: sql<number>`cast(count(*) as int)`,
    }).from(projectsTable).where(where).groupBy(projectsTable.status);

    const statuses = ["planning", "active", "on_hold", "completed", "cancelled"];
    const byStatus = statuses.map(s => ({ status: s, count: byStatusRows.find(r => r.status === s)?.count ?? 0 }));
    const total = byStatus.reduce((s, r) => s + r.count, 0);

    return res.json({
      total,
      totalCount: total,
      byStatus,
      activeCount: byStatus.find(r => r.status === "active")?.count ?? 0,
      completedCount: byStatus.find(r => r.status === "completed")?.count ?? 0,
    });
  } catch (e) { next(e); }
});

router.get("/projects/:id", async (req, res, next) => {
  try {
    if (req.authUser && !(await userHasProjectAccess(req.authUser.id, req.params.id))) {
      return res.status(403).json({ error: "Accès refusé à ce projet" });
    }
    const [rows, phases, allTasks] = await Promise.all([
      db.select({
        proj: projectsTable,
        clientName: clientsTable.name,
        managerName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
      })
        .from(projectsTable)
        .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
        .leftJoin(usersTable, eq(projectsTable.managerId, usersTable.id))
        .where(and(eq(projectsTable.organizationId, req.authUser!.organizationId), eq(projectsTable.id, req.params.id))).limit(1),
      db.select().from(projectPhasesTable).where(and(eq(projectPhasesTable.organizationId, req.authUser!.organizationId), eq(projectPhasesTable.projectId, req.params.id))),
      db.select({ id: tasksTable.id, status: tasksTable.status }).from(tasksTable).where(and(eq(tasksTable.organizationId, req.authUser!.organizationId), eq(tasksTable.projectId, req.params.id))),
    ]);

    if (!rows[0]) return res.status(404).json({ error: "Not found" });
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
  } catch (e) { next(e); }
});

router.put("/projects/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const { name, description, status, clientId, managerId, startDate, endDate, budget, documentLinks } = req.body;
    const [proj] = await db.update(projectsTable)
      .set({ name, description, status, clientId, managerId, startDate, endDate, budget: budget?.toString(), documentLinks })
      .where(and(eq(projectsTable.organizationId, req.authUser!.organizationId), eq(projectsTable.id, req.params.id))).returning();
    if (!proj) return res.status(404).json({ error: "Not found" });
    return res.json({ ...proj, budget: proj.budget ? Number(proj.budget) : null });
  } catch (e) { next(e); }
});

router.delete("/projects/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.update(projectsTable).set({ deletedAt: new Date() }).where(and(eq(projectsTable.organizationId, req.authUser!.organizationId), eq(projectsTable.id, req.params.id)));
    return res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
