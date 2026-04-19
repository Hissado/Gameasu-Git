import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, taskCommentsTable, taskHistoryTable, projectsTable, usersTable } from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";
import { requireManagerOrAbove, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/tasks", async (req, res) => {
  const { projectId, assignedTo, status, priority, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({
    task: tasksTable,
    projectName: projectsTable.name,
    assigneeName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(isNull(tasksTable.deletedAt))
    .limit(limitNum).offset(offset);

  const data = rows.map(row => ({ ...row.task, projectName: row.projectName, assigneeName: row.assigneeName }));
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(isNull(tasksTable.deletedAt));
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/tasks", requireManagerOrAbove, async (req, res) => {
  const { title, description, status, priority, projectId, assigneeId, dueDate, parentTaskId } = req.body;
  const [task] = await db.insert(tasksTable).values({
    title, description, status: status || "todo", priority: priority || "medium",
    projectId, assigneeId, dueDate, parentTaskId,
  }).returning();
  await db.insert(taskHistoryTable).values({
    taskId: task.id, userId: req.authUser?.id, action: "created", newValue: title,
  });
  return res.status(201).json(task);
});

router.get("/tasks/:id", async (req, res) => {
  const rows = await db.select({
    task: tasksTable,
    projectName: projectsTable.name,
    assigneeName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(eq(tasksTable.id, req.params.id)).limit(1);

  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const comments = await db.select({
    comment: taskCommentsTable,
    userName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(taskCommentsTable)
    .leftJoin(usersTable, eq(taskCommentsTable.userId, usersTable.id))
    .where(eq(taskCommentsTable.taskId, req.params.id));

  const subtasks = await db.select().from(tasksTable).where(eq(tasksTable.parentTaskId, req.params.id));

  const history = await db.select({
    h: taskHistoryTable,
    userName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(taskHistoryTable)
    .leftJoin(usersTable, eq(taskHistoryTable.userId, usersTable.id))
    .where(eq(taskHistoryTable.taskId, req.params.id))
    .orderBy(sql`${taskHistoryTable.createdAt} DESC`).limit(50);

  return res.json({
    ...rows[0].task,
    projectName: rows[0].projectName,
    assigneeName: rows[0].assigneeName,
    comments: comments.map(c => ({ ...c.comment, userName: c.userName })),
    subtasks,
    history: history.map(h => ({ ...h.h, userName: h.userName })),
  });
});

router.put("/tasks/:id", requireManagerOrAbove, async (req, res) => {
  const { title, description, status, priority, projectId, assigneeId, dueDate } = req.body;
  const before = (await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id)).limit(1))[0];
  if (!before) return res.status(404).json({ error: "Not found" });

  // Restriction collaborateur: ne peut modifier que ses propres tâches
  const role = req.authUser?.role || "collaborator";
  if (role === "collaborator" && before.assigneeId !== req.authUser?.id) {
    return res.status(403).json({ error: "Vous ne pouvez modifier que les tâches qui vous sont assignées" });
  }
  // Seuls manager+ peuvent réassigner
  if (assigneeId && assigneeId !== before.assigneeId && role === "collaborator") {
    return res.status(403).json({ error: "Réassignation réservée aux managers" });
  }

  const [task] = await db.update(tasksTable)
    .set({ title, description, status, priority, projectId, assigneeId, dueDate })
    .where(eq(tasksTable.id, req.params.id)).returning();

  // Historique des changements
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  if (before.status !== status && status) changes.push({ field: "status", oldValue: before.status, newValue: status });
  if (before.priority !== priority && priority) changes.push({ field: "priority", oldValue: before.priority, newValue: priority });
  if (before.assigneeId !== assigneeId && assigneeId) changes.push({ field: "assigneeId", oldValue: before.assigneeId, newValue: assigneeId });
  if (before.title !== title && title) changes.push({ field: "title", oldValue: before.title, newValue: title });
  for (const c of changes) {
    await db.insert(taskHistoryTable).values({
      taskId: task.id, userId: req.authUser?.id, action: "updated", field: c.field, oldValue: c.oldValue, newValue: c.newValue,
    });
  }
  return res.json(task);
});

router.delete("/tasks/:id", requireAdmin, async (req, res) => {
  await db.update(tasksTable).set({ deletedAt: new Date() }).where(eq(tasksTable.id, req.params.id));
  await db.insert(taskHistoryTable).values({
    taskId: req.params.id, userId: req.authUser?.id, action: "deleted",
  });
  return res.status(204).send();
});

router.get("/tasks/:id/comments", async (req, res) => {
  const comments = await db.select({
    comment: taskCommentsTable,
    userName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(taskCommentsTable)
    .leftJoin(usersTable, eq(taskCommentsTable.userId, usersTable.id))
    .where(eq(taskCommentsTable.taskId, req.params.id));
  return res.json(comments.map(c => ({ ...c.comment, userName: c.userName })));
});

router.post("/tasks/:id/comments", async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Content required" });
  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Authentification requise" });

  const [comment] = await db.insert(taskCommentsTable).values({
    taskId: req.params.id, userId, content,
  }).returning();
  await db.insert(taskHistoryTable).values({
    taskId: req.params.id, userId, action: "commented", newValue: content.slice(0, 100),
  });
  const userName = `${req.authUser?.firstName || ""} ${req.authUser?.lastName || ""}`.trim();
  return res.status(201).json({ ...comment, userName });
});

export default router;
