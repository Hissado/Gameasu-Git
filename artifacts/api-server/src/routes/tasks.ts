import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, taskCommentsTable, projectsTable, usersTable } from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";

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

router.post("/tasks", async (req, res) => {
  const { title, description, status, priority, projectId, assigneeId, dueDate, parentTaskId } = req.body;
  const [task] = await db.insert(tasksTable).values({
    title, description, status: status || "todo", priority: priority || "medium",
    projectId, assigneeId, dueDate, parentTaskId,
  }).returning();
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

  return res.json({
    ...rows[0].task,
    projectName: rows[0].projectName,
    assigneeName: rows[0].assigneeName,
    comments: comments.map(c => ({ ...c.comment, userName: c.userName })),
    subtasks,
  });
});

router.put("/tasks/:id", async (req, res) => {
  const { title, description, status, priority, projectId, assigneeId, dueDate } = req.body;
  const [task] = await db.update(tasksTable)
    .set({ title, description, status, priority, projectId, assigneeId, dueDate })
    .where(eq(tasksTable.id, req.params.id)).returning();
  if (!task) return res.status(404).json({ error: "Not found" });
  return res.json(task);
});

router.delete("/tasks/:id", async (req, res) => {
  await db.update(tasksTable).set({ deletedAt: new Date() }).where(eq(tasksTable.id, req.params.id));
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
  const systemUserId = req.body.userId || null;
  if (!content) return res.status(400).json({ error: "Content required" });

  const users = await db.select().from(usersTable).limit(1);
  const userId = systemUserId || users[0]?.id;
  if (!userId) return res.status(400).json({ error: "No users exist" });

  const [comment] = await db.insert(taskCommentsTable).values({
    taskId: req.params.id, userId, content,
  }).returning();
  return res.status(201).json({ ...comment, userName: "System" });
});

export default router;
