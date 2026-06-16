import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable, clientsTable, opportunitiesTable, rentalsTable, equipmentTable, invoicesTable, paymentsTable } from "@workspace/db";
import { isNull, sql, and, eq } from "drizzle-orm";

const router = Router();

router.get("/dashboard/kpis", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

    const [
      kpiRows
    ] = await Promise.all([
      db.select({
        activeProjects:     sql<number>`cast(count(*) filter (where ${projectsTable.status} = 'active' and ${projectsTable.deletedAt} is null) as int)`,
        totalProjects:      sql<number>`cast(count(*) filter (where ${projectsTable.deletedAt} is null) as int)`,
      }).from(projectsTable).where(eq(projectsTable.organizationId, orgId)),
    ]);

    const [taskStats] = await db.select({
      todo:        sql<number>`cast(count(*) filter (where ${tasksTable.status} = 'todo') as int)`,
      inProgress:  sql<number>`cast(count(*) filter (where ${tasksTable.status} = 'in_progress') as int)`,
      done:        sql<number>`cast(count(*) filter (where ${tasksTable.status} = 'done') as int)`,
    }).from(tasksTable).where(and(eq(tasksTable.organizationId, orgId), isNull(tasksTable.deletedAt)));

    const [clientStats] = await db.select({
      total: sql<number>`cast(count(*) as int)`,
    }).from(clientsTable).where(and(eq(clientsTable.organizationId, orgId), isNull(clientsTable.deletedAt)));

    const oppRows = await db.select({
      stage: opportunitiesTable.stage,
      value: opportunitiesTable.value,
    }).from(opportunitiesTable).where(and(eq(opportunitiesTable.organizationId, orgId), isNull(opportunitiesTable.deletedAt)));

    const [invoiceStats] = await db.select({
      totalInvoiced: sql<string>`coalesce(sum(${invoicesTable.totalAmount}), 0)`,
    }).from(invoicesTable).where(eq(invoicesTable.organizationId, orgId));

    const [paymentStats] = await db.select({
      totalPaid: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
    }).from(paymentsTable).where(eq(paymentsTable.organizationId, orgId));

    const [rentalStats] = await db.select({
      active: sql<number>`cast(count(*) filter (where ${rentalsTable.status} = 'active') as int)`,
    }).from(rentalsTable).where(eq(rentalsTable.organizationId, orgId));

    const [equipStats] = await db.select({
      available: sql<number>`cast(count(*) filter (where ${equipmentTable.status} = 'available') as int)`,
    }).from(equipmentTable).where(and(eq(equipmentTable.organizationId, orgId), isNull(equipmentTable.deletedAt)));

    const openOpps = oppRows.filter(o => !["won", "lost"].includes(o.stage));
    const pipelineValue = openOpps.reduce((s, o) => s + (o.value ? Number(o.value) : 0), 0);
    const totalPaid = Number(paymentStats?.totalPaid ?? 0);
    const totalInvoiced = Number(invoiceStats?.totalInvoiced ?? 0);

    return res.json({
      activeProjects:       kpiRows[0]?.activeProjects ?? 0,
      totalClients:         clientStats?.total ?? 0,
      tasksTodo:            taskStats?.todo ?? 0,
      tasksInProgress:      taskStats?.inProgress ?? 0,
      tasksCompleted:       taskStats?.done ?? 0,
      openOpportunities:    openOpps.length,
      pipelineValue,
      monthlyRevenue:       totalPaid,
      outstandingInvoices:  totalInvoiced - totalPaid,
      activeRentals:        rentalStats?.active ?? 0,
      equipmentAvailable:   equipStats?.available ?? 0,
      unreadMessages:       0,
      currency:             "XOF",
    });
  } catch (e) { next(e); }
});

router.get("/dashboard/recent-activity", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { limit = "20" } = req.query as Record<string, string>;
    const limitNum = Math.min(parseInt(limit) || 20, 50);

    const [recentProjects, recentTasks] = await Promise.all([
      db.select({ id: projectsTable.id, name: projectsTable.name, createdAt: projectsTable.createdAt })
        .from(projectsTable).where(and(eq(projectsTable.organizationId, orgId), isNull(projectsTable.deletedAt))).limit(5),
      db.select({ id: tasksTable.id, title: tasksTable.title, createdAt: tasksTable.createdAt })
        .from(tasksTable).where(and(eq(tasksTable.organizationId, orgId), isNull(tasksTable.deletedAt))).limit(5),
    ]);

    const feed = [
      ...recentProjects.map(p => ({
        id: p.id, type: "project_created",
        description: `Projet "${p.name}" créé`,
        entityType: "project", entityId: p.id,
        userId: null, userName: "Système", userAvatarUrl: null, createdAt: p.createdAt,
      })),
      ...recentTasks.map(t => ({
        id: t.id, type: "task_created",
        description: `Tâche "${t.title}" ajoutée`,
        entityType: "task", entityId: t.id,
        userId: null, userName: "Système", userAvatarUrl: null, createdAt: t.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limitNum);

    return res.json(feed);
  } catch (e) { next(e); }
});

router.get("/dashboard/charts", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

    const [projectStats, taskStats, revenueStats] = await Promise.all([
      db.select({
        status: projectsTable.status,
        count: sql<number>`cast(count(*) as int)`,
      }).from(projectsTable)
        .where(and(eq(projectsTable.organizationId, orgId), isNull(projectsTable.deletedAt)))
        .groupBy(projectsTable.status),

      db.select({
        priority: tasksTable.priority,
        count: sql<number>`cast(count(*) as int)`,
      }).from(tasksTable)
        .where(and(eq(tasksTable.organizationId, orgId), isNull(tasksTable.deletedAt)))
        .groupBy(tasksTable.priority),

      db.select({
        month: sql<string>`to_char(${paymentsTable.createdAt}, 'Mon')`,
        monthNum: sql<number>`cast(extract(month from ${paymentsTable.createdAt}) as int)`,
        revenue: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)`,
      }).from(paymentsTable)
        .where(and(
          eq(paymentsTable.organizationId, orgId),
          sql`${paymentsTable.createdAt} >= date_trunc('year', now())`,
        ))
        .groupBy(sql`to_char(${paymentsTable.createdAt}, 'Mon')`, sql`extract(month from ${paymentsTable.createdAt})`)
        .orderBy(sql`extract(month from ${paymentsTable.createdAt})`),
    ]);

    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const revenueByMonth = months.map((month, i) => {
      const found = revenueStats.find(r => r.monthNum === i + 1);
      return { month, revenue: Number(found?.revenue ?? 0), invoiced: 0 };
    });

    const statusOrder = ["planning", "active", "on_hold", "completed", "cancelled"];
    const projectsByStatus = statusOrder.map(status => ({
      status,
      count: projectStats.find(p => p.status === status)?.count ?? 0,
    }));

    const priorities = ["low", "medium", "high", "urgent"];
    const tasksByPriority = priorities.map(priority => ({
      priority,
      count: taskStats.find(t => t.priority === priority)?.count ?? 0,
    }));

    return res.json({ revenueByMonth, projectsByStatus, tasksByPriority });
  } catch (e) { next(e); }
});

export default router;
