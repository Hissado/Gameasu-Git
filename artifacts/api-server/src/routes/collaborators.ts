import { Router } from "express";
import { db } from "@workspace/db";
import { collaboratorsTable, tasksTable } from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";

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

router.post("/collaborators", requireManagerOrAbove, async (req, res) => {
  const { firstName, lastName, email, phone, position, department, isAvailable, departmentId, positionId, employeeNumber, hireDate, baseSalary } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: "firstName et lastName requis" });
  try {
    const [collab] = await db.insert(collaboratorsTable).values({
      firstName, lastName, email, phone, position, department,
      isAvailable: isAvailable !== false,
      departmentId: departmentId || null,
      positionId: positionId || null,
      employeeNumber: employeeNumber || null,
      hireDate: hireDate || null,
      baseSalary: baseSalary != null ? baseSalary.toString() : null,
    }).returning();
    return res.status(201).json(collab);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.get("/collaborators/workload", async (_req, res) => {
  const collabs = await db.select().from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt));
  const workload = collabs.map(c => ({
    collaboratorId: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    avatarUrl: c.avatarUrl,
    activeTasks: 0,
    activeProjects: c.currentProjectsCount || 0,
    workloadPercent: Math.min(100, (c.currentProjectsCount || 0) * 25),
  }));
  return res.json(workload);
});

router.get("/collaborators/:id", async (req, res) => {
  const collabs = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, req.params.id)).limit(1);
  if (!collabs[0]) return res.status(404).json({ error: "Not found" });
  return res.json(collabs[0]);
});

router.put("/collaborators/:id", requireManagerOrAbove, async (req, res) => {
  const { firstName, lastName, email, phone, position, department, isAvailable, departmentId, positionId, employeeNumber, hireDate, baseSalary, managerCollaboratorId, employmentStatus } = req.body;
  try {
    const [collab] = await db.update(collaboratorsTable)
      .set({
        firstName, lastName, email, phone, position, department, isAvailable,
        departmentId: departmentId === "" ? null : departmentId,
        positionId: positionId === "" ? null : positionId,
        employeeNumber, hireDate,
        baseSalary: baseSalary != null ? baseSalary.toString() : undefined,
        managerCollaboratorId: managerCollaboratorId === "" ? null : managerCollaboratorId,
        employmentStatus,
      })
      .where(eq(collaboratorsTable.id, req.params.id)).returning();
    if (!collab) return res.status(404).json({ error: "Not found" });
    return res.json(collab);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.delete("/collaborators/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(collaboratorsTable).set({ deletedAt: new Date() }).where(eq(collaboratorsTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
