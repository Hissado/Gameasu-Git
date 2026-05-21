/**
 * Phase 7 — Intelligence projet & tâches.
 *  - GET /api/projects/:id/intelligence  : santé projet (schedule, tâches, budget, risques, recos)
 *  - GET /api/tasks/priority             : backlog priorisé (urgence, importance, âge, statut)
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable, tasksTable, clientsTable, usersTable,
  smartScoresTable, riskFlagsTable,
  recommendationsTable, insightsTable, assistantSummariesTable,
  tierForScore,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { userAccessibleProjectIds, userHasProjectAccess } from "../lib/rbac/permissions";
import { getCurrentOrganizationId } from "../lib/tenant";

const router: IRouter = Router();

const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / (24 * 3600 * 1000));

router.get("/projects/:id/intelligence", requirePermission("projects.read"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const projectId = String(req.params["id"]);
    if (!(await userHasProjectAccess(userId, projectId))) {
      return res.status(403).json({ error: "forbidden" });
    }
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), isNull(projectsTable.deletedAt)))
      .limit(1);
    if (!project) return res.status(404).json({ error: "not_found" });

    const [tasks, client, manager, score, risks, recos, insights, summary] = await Promise.all([
      db.select().from(tasksTable).where(and(eq(tasksTable.projectId, projectId), isNull(tasksTable.deletedAt))),
      project.clientId ? db.select().from(clientsTable).where(eq(clientsTable.id, project.clientId)).limit(1) : Promise.resolve([]),
      project.managerId ? db.select().from(usersTable).where(eq(usersTable.id, project.managerId)).limit(1) : Promise.resolve([]),
      db.select().from(smartScoresTable)
        .where(and(eq(smartScoresTable.organizationId, orgId), eq(smartScoresTable.entityType, "project"), eq(smartScoresTable.entityId, projectId), eq(smartScoresTable.scoreType, "risk")))
        .orderBy(desc(smartScoresTable.computedAt)).limit(1),
      db.select().from(riskFlagsTable)
        .where(and(eq(riskFlagsTable.organizationId, orgId), eq(riskFlagsTable.entityType, "project"), eq(riskFlagsTable.entityId, projectId), eq(riskFlagsTable.isResolved, false)))
        .orderBy(desc(riskFlagsTable.detectedAt)).limit(10),
      db.select().from(recommendationsTable)
        .where(and(eq(recommendationsTable.organizationId, orgId), eq(recommendationsTable.entityType, "project"), eq(recommendationsTable.entityId, projectId), eq(recommendationsTable.isApplied, false), eq(recommendationsTable.isDismissed, false)))
        .orderBy(desc(recommendationsTable.createdAt)).limit(10),
      db.select().from(insightsTable)
        .where(and(eq(insightsTable.organizationId, orgId), eq(insightsTable.scope, "project"), eq(insightsTable.scopeId, projectId), eq(insightsTable.isDismissed, false)))
        .limit(10),
      db.select().from(assistantSummariesTable)
        .where(and(eq(assistantSummariesTable.organizationId, orgId), eq(assistantSummariesTable.scope, "project"), eq(assistantSummariesTable.scopeId, projectId)))
        .orderBy(desc(assistantSummariesTable.createdAt)).limit(1),
    ]);

    // ── Statistiques tâches ──────────────────────────────────
    const now = new Date();
    let done = 0, inProgress = 0, todo = 0, blocked = 0, overdue = 0, dueSoon = 0;
    const completedDates: number[] = [];
    for (const t of tasks) {
      const s = t.status;
      if (s === "done" || s === "completed") { done += 1; if (t.completedAt) completedDates.push(t.completedAt.getTime()); }
      else if (s === "in_progress") inProgress += 1;
      else if (s === "blocked" || s === "on_hold") blocked += 1;
      else if (s === "cancelled") continue;
      else todo += 1;
      if (t.dueDate && s !== "done" && s !== "completed" && s !== "cancelled") {
        const due = new Date(t.dueDate);
        const diff = daysBetween(due, now);
        if (diff < 0) overdue += 1;
        else if (diff <= 3) dueSoon += 1;
      }
    }
    const active = tasks.length - tasks.filter((t) => t.status === "cancelled").length;
    const completionRate = active > 0 ? Math.round((done / active) * 100) : 0;

    // Vélocité : tâches complétées sur 14 derniers jours
    const cutoff = now.getTime() - 14 * 24 * 3600 * 1000;
    const recentDone = completedDates.filter((ts) => ts >= cutoff).length;
    const velocity = Math.round((recentDone / 14) * 7); // tâches/semaine

    // ── Schedule health ──────────────────────────────────────
    let scheduleStatus: "on_track" | "at_risk" | "delayed" | "unknown" = "unknown";
    let expectedProgress = 0;
    let scheduleScore = 60;
    if (project.startDate && project.endDate) {
      const start = new Date(project.startDate).getTime();
      const end = new Date(project.endDate).getTime();
      const total = Math.max(1, end - start);
      const elapsed = Math.max(0, Math.min(total, now.getTime() - start));
      expectedProgress = Math.round((elapsed / total) * 100);
      const actual = project.progress ?? 0;
      const gap = actual - expectedProgress;
      if (gap >= -5) { scheduleStatus = "on_track"; scheduleScore = 85 + Math.min(15, gap / 2); }
      else if (gap >= -20) { scheduleStatus = "at_risk"; scheduleScore = 55 + gap; }
      else { scheduleStatus = "delayed"; scheduleScore = clamp(40 + gap); }
    }
    scheduleScore = clamp(scheduleScore);

    // ── Score de risque global ───────────────────────────────
    let healthScore = score[0];
    if (!healthScore) {
      const taskScore = clamp(active > 0 ? completionRate - overdue * 6 - blocked * 4 : 60);
      const riskScore = clamp(100 - risks.length * 25);
      const velocityScore = clamp(velocity > 0 ? 50 + velocity * 5 : 30);
      const value = clamp(Math.round(scheduleScore * 0.4 + taskScore * 0.3 + riskScore * 0.2 + velocityScore * 0.1));
      healthScore = {
        id: "computed",
        organizationId: orgId,
        entityType: "project", entityId: projectId,
        scoreType: "risk",
        value, tier: tierForScore(value),
        factors: [
          { key: "schedule", label: "Respect du planning", weight: 40, value: Math.round(scheduleScore), reason: scheduleStatus === "delayed" ? `Retard estimé : ${expectedProgress - (project.progress ?? 0)} pts` : scheduleStatus === "at_risk" ? "À surveiller" : "Conforme" },
          { key: "tasks", label: "Exécution des tâches", weight: 30, value: Math.round(taskScore), reason: `${done}/${active} terminées · ${overdue} en retard` },
          { key: "risk", label: "Risques ouverts", weight: 20, value: Math.round(riskScore), reason: risks.length === 0 ? "Aucun" : `${risks.length} risque(s)` },
          { key: "velocity", label: "Vélocité (14j)", weight: 10, value: Math.round(velocityScore), reason: `${recentDone} terminée(s), ~${velocity}/semaine` },
        ],
        computedBy: "heuristic",
        computedAt: now,
      } as any;
    }

    // ── Budget (alloué uniquement — pas de lien direct invoice→project en base) ──
    const budget = num(project.budget);

    // ── Résumé heuristique ───────────────────────────────────
    const summaryHeuristic = [
      `${project.name} — ${project.progress ?? 0}% d'avancement${expectedProgress ? ` (attendu ${expectedProgress}%)` : ""}.`,
      active > 0 ? `${done}/${active} tâches terminées${overdue ? `, ${overdue} en retard` : ""}${dueSoon ? `, ${dueSoon} à échéance proche` : ""}.` : "Aucune tâche.",
      velocity > 0 ? `Vélocité ${velocity} tâche(s)/semaine.` : null,
      budget > 0 ? `Budget alloué ${Math.round(budget).toLocaleString("fr-FR")} FCFA.` : null,
      risks.length > 0 ? `${risks.length} risque(s) ouvert(s).` : null,
    ].filter(Boolean).join(" ");

    return res.json({
      project: {
        ...project,
        clientName: client[0]?.name ?? null,
        managerName: manager[0] ? `${manager[0].firstName ?? ""} ${manager[0].lastName ?? ""}`.trim() : null,
      },
      score: healthScore,
      risks, recommendations: recos, insights,
      summary: summary[0] ?? null,
      summaryHeuristic,
      schedule: {
        status: scheduleStatus,
        actualProgress: project.progress ?? 0,
        expectedProgress,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      taskStats: {
        total: tasks.length, active, done, inProgress, todo, blocked, overdue, dueSoon,
        completionRate, velocityPerWeek: velocity, recentlyDone: recentDone,
      },
      budget: { allocated: budget },
    });
  } catch (e) { next(e); }
});

router.get("/tasks/priority", requirePermission("tasks.read"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const mineOnly = String(req.query["mine"] ?? "") === "1";
    const accessible = await userAccessibleProjectIds(userId);

    // ACL alignée avec GET /tasks : si la liste de projets accessibles est vide,
    // on autorise toujours les tâches dont l'utilisateur est l'assignee.
    // Si la liste a des projets, on retourne (projet accessible OU assignee = user).
    const conds: any[] = [
      isNull(tasksTable.deletedAt),
      sql`${tasksTable.status} NOT IN ('done', 'completed', 'cancelled')`,
    ];
    if (accessible !== null) {
      if (accessible.length === 0) {
        conds.push(eq(tasksTable.assigneeId, userId));
      } else {
        conds.push(or(inArray(tasksTable.projectId, accessible), eq(tasksTable.assigneeId, userId)));
      }
    }
    if (mineOnly) conds.push(eq(tasksTable.assigneeId, userId));

    // Pré-tri DB pour éviter le sampling bias : on remonte d'abord les tâches
    // urgentes (due date proche, statut critique) avant le scoring applicatif.
    // Tri : priorité (urgent>high>medium>low) puis dueDate asc puis createdAt asc.
    const priorityRank = sql`CASE ${tasksTable.priority}
      WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END`;
    const rows = await db.select({
      task: tasksTable,
      project: { id: projectsTable.id, name: projectsTable.name, status: projectsTable.status },
      assignee: { id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName },
    })
      .from(tasksTable)
      .leftJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
      .leftJoin(usersTable, eq(usersTable.id, tasksTable.assigneeId))
      .where(and(...conds))
      .orderBy(desc(priorityRank), sql`${tasksTable.dueDate} ASC NULLS LAST`, asc(tasksTable.createdAt))
      .limit(1000);

    const priorityWeight: Record<string, number> = { urgent: 100, high: 80, medium: 50, low: 25 };
    const statusBoost: Record<string, number> = { blocked: 25, in_progress: 15, todo: 5, on_hold: 10 };
    const now = new Date();

    const scored = rows.map(({ task, project, assignee }) => {
      const pri = clamp(priorityWeight[task.priority ?? "medium"] ?? 50);

      let urgency = 30;
      let daysUntilDue: number | null = null;
      if (task.dueDate) {
        daysUntilDue = daysBetween(new Date(task.dueDate), now);
        if (daysUntilDue < 0) urgency = clamp(95 + Math.min(5, -daysUntilDue));
        else if (daysUntilDue <= 1) urgency = 90;
        else if (daysUntilDue <= 3) urgency = 75;
        else if (daysUntilDue <= 7) urgency = 60;
        else if (daysUntilDue <= 30) urgency = 40;
        else urgency = 25;
      }
      urgency = clamp(urgency);

      const ageDays = daysBetween(now, task.createdAt);
      const ageScore = clamp(Math.min(60, ageDays * 1.5));

      const statusScore = clamp(statusBoost[task.status] ?? 0);

      const score = clamp(Math.round(pri * 0.4 + urgency * 0.35 + ageScore * 0.15 + statusScore * 0.1));

      return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        daysUntilDue,
        projectId: task.projectId,
        projectName: project?.name ?? null,
        assigneeId: task.assigneeId,
        assigneeName: assignee?.firstName ? `${assignee.firstName} ${assignee.lastName ?? ""}`.trim() : null,
        score,
        tier: tierForScore(score),
        factors: [
          { key: "priority", label: "Priorité saisie", value: Math.round(pri), weight: 40 },
          { key: "urgency", label: "Urgence (échéance)", value: Math.round(urgency), weight: 35 },
          { key: "age", label: "Âge de la tâche", value: Math.round(ageScore), weight: 15 },
          { key: "status", label: "Statut", value: Math.round(statusScore), weight: 10 },
        ],
      };
    }).sort((a, b) => b.score - a.score).slice(0, 100);

    return res.json({ data: scored });
  } catch (e) { next(e); }
});

export default router;
