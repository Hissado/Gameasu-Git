import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, taskCommentsTable, taskHistoryTable, projectsTable, usersTable } from "@workspace/db";
import { and, eq, or, sql, isNull, inArray } from "drizzle-orm";
import { requireManagerOrAbove, requireAdmin } from "../middlewares/auth";
import { requirePermission } from "../middlewares/permissions";
import { userAccessibleProjectIds, userHasProjectAccess } from "../lib/rbac/permissions";

const router = Router();

/** Vérifie que l'utilisateur a accès au projet de la tâche (ou est l'assigné). */
async function ensureTaskAccess(req: any, taskId: string, allowAssignee = true) {
  const [t] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (!t) return { allowed: false, status: 404, body: { error: "Tâche introuvable" } };
  if (!req.authUser) return { allowed: true, task: t };
  if (allowAssignee && t.assigneeId === req.authUser.id) return { allowed: true, task: t };
  if (t.projectId && (await userHasProjectAccess(req.authUser.id, t.projectId))) return { allowed: true, task: t };
  return { allowed: false, status: 403, body: { error: "Accès refusé à cette tâche" } };
}

router.get("/tasks", requirePermission("tasks.read"), async (req, res) => {
  const { page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // ACL : restreindre les tâches aux projets accessibles à l'utilisateur.
  const accessible = req.authUser ? await userAccessibleProjectIds(req.authUser.id) : [];
  const conds: any[] = [isNull(tasksTable.deletedAt)];
  if (accessible !== null) {
    if (accessible.length === 0) {
      // Sans projet : on autorise les tâches assignées personnellement (pas d'orphelin ailleurs).
      if (req.authUser) conds.push(eq(tasksTable.assigneeId, req.authUser.id));
      else return res.json({ data: [], total: 0, page: pageNum, limit: limitNum });
    } else {
      conds.push(or(inArray(tasksTable.projectId, accessible), eq(tasksTable.assigneeId, req.authUser!.id)));
    }
  }
  const where = and(...conds);

  const rows = await db.select({
    task: tasksTable,
    projectName: projectsTable.name,
    assigneeName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(where)
    .limit(limitNum).offset(offset);

  const data = rows.map(row => ({ ...row.task, projectName: row.projectName, assigneeName: row.assigneeName }));
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(tasksTable).where(where);
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

router.get("/tasks/:id", requirePermission("tasks.read"), async (req, res) => {
  const acl = await ensureTaskAccess(req, req.params.id);
  if (!acl.allowed) return res.status(acl.status!).json(acl.body);
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

router.get("/tasks/:id/comments", requirePermission("tasks.read"), async (req, res) => {
  const acl = await ensureTaskAccess(req, req.params.id);
  if (!acl.allowed) return res.status(acl.status!).json(acl.body);
  const comments = await db.select({
    comment: taskCommentsTable,
    userName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(taskCommentsTable)
    .leftJoin(usersTable, eq(taskCommentsTable.userId, usersTable.id))
    .where(eq(taskCommentsTable.taskId, req.params.id));
  return res.json(comments.map(c => ({ ...c.comment, userName: c.userName })));
});

router.post("/tasks/:id/comments", requirePermission("tasks.read"), async (req, res) => {
  const acl = await ensureTaskAccess(req, req.params.id);
  if (!acl.allowed) return res.status(acl.status!).json(acl.body);
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
