import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable, clientsTable, opportunitiesTable, rentalsTable, equipmentTable, conversationParticipantsTable, notificationsTable, invoicesTable, paymentsTable } from "@workspace/db";
import { isNull, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/kpis", async (req, res) => {
  const projects = await db.select().from(projectsTable).where(isNull(projectsTable.deletedAt));
  const tasks = await db.select().from(tasksTable).where(isNull(tasksTable.deletedAt));
  const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  const opps = await db.select().from(opportunitiesTable).where(isNull(opportunitiesTable.deletedAt));
  const rentals = await db.select().from(rentalsTable);
  const equipment = await db.select().from(equipmentTable).where(isNull(equipmentTable.deletedAt));
  const invoices = await db.select().from(invoicesTable);
  const payments = await db.select().from(paymentsTable);

  const activeProjects = projects.filter(p => p.status === "active").length;
  const pipelineValue = opps.filter(o => !["won", "lost"].includes(o.stage)).reduce((s, o) => s + (o.value ? Number(o.value) : 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount ? Number(p.amount) : 0), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount ? Number(i.totalAmount) : 0), 0);

  return res.json({
    activeProjects,
    totalClients: clients.length,
    tasksTodo: tasks.filter(t => t.status === "todo").length,
    tasksInProgress: tasks.filter(t => t.status === "in_progress").length,
    tasksCompleted: tasks.filter(t => t.status === "done").length,
    openOpportunities: opps.filter(o => !["won", "lost"].includes(o.stage)).length,
    pipelineValue,
    monthlyRevenue: totalPaid,
    outstandingInvoices: totalInvoiced - totalPaid,
    activeRentals: rentals.filter(r => r.status === "active").length,
    equipmentAvailable: equipment.filter(e => e.status === "available").length,
    unreadMessages: 0,
    currency: "XOF",
  });
});

router.get("/dashboard/recent-activity", async (req, res) => {
  const { limit = "20" } = req.query as Record<string, string>;
  const limitNum = parseInt(limit);

  const recentProjects = await db.select().from(projectsTable).where(isNull(projectsTable.deletedAt)).limit(5);
  const recentTasks = await db.select().from(tasksTable).where(isNull(tasksTable.deletedAt)).limit(5);

  const feed = [
    ...recentProjects.map(p => ({
      id: p.id,
      type: "project_created",
      description: `Project "${p.name}" was created`,
      entityType: "project",
      entityId: p.id,
      userId: null,
      userName: "System",
      userAvatarUrl: null,
      createdAt: p.createdAt,
    })),
    ...recentTasks.map(t => ({
      id: t.id,
      type: "task_created",
      description: `Task "${t.title}" was added`,
      entityType: "task",
      entityId: t.id,
      userId: null,
      userName: "System",
      userAvatarUrl: null,
      createdAt: t.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limitNum);

  return res.json(feed);
});

router.get("/dashboard/charts", async (req, res) => {
  const projects = await db.select().from(projectsTable).where(isNull(projectsTable.deletedAt));
  const tasks = await db.select().from(tasksTable).where(isNull(tasksTable.deletedAt));

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const revenueByMonth = months.map((month, i) => ({
    month,
    revenue: Math.floor(Math.random() * 5000000) + 1000000,
    invoiced: Math.floor(Math.random() * 6000000) + 1500000,
  }));

  const statusOrder = ["planning", "active", "on_hold", "completed", "cancelled"];
  const projectsByStatus = statusOrder.map(status => ({
    status,
    count: projects.filter(p => p.status === status).length,
  }));

  const priorities = ["low", "medium", "high", "urgent"];
  const tasksByPriority = priorities.map(priority => ({
    priority,
    count: tasks.filter(t => t.priority === priority).length,
  }));

  return res.json({ revenueByMonth, projectsByStatus, tasksByPriority });
});

export default router;
