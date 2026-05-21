/**
 * Phase 14 — Daily Briefing exécutif.
 *  - GET /api/briefing/today
 *
 * Agrège en un appel : KPI d'activité, alertes critiques, top tâches du jour,
 * factures à relancer, présences/retards, risques ouverts. Génère un résumé
 * narratif IA (OpenAI proxy) avec fallback heuristique.
 */
import { Router, type IRouter } from "express";
import {
  db, clientsTable, projectsTable, tasksTable, invoicesTable,
  riskFlagsTable, recommendationsTable, insightsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, inArray, gte, lte } from "drizzle-orm";
import { summarize, aiAvailable } from "../lib/ai";
import { userAccessibleProjectIds, userAccessibleClientIds, hasPermission } from "../lib/rbac/permissions";
import { getCurrentOrganizationId } from "../lib/tenant";

const router: IRouter = Router();

function fmtFCFA(n: number): string { return Math.round(n).toLocaleString("fr-FR") + " FCFA"; }

router.get("/briefing/today", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const [clientIds, projectIds, orgId] = await Promise.all([
      userAccessibleClientIds(userId),
      userAccessibleProjectIds(userId),
      getCurrentOrganizationId(userId),
    ]);
    const canViewRisks = await hasPermission(userId, "ai.view_risk_flags");
    const canViewRecos = await hasPermission(userId, "ai.view_recommendations");
    const canViewInsights = await hasPermission(userId, "ai.view_insights");

    const denyProj = projectIds !== null && projectIds.length === 0;
    const denyClient = clientIds !== null && clientIds.length === 0;

    // ── Activité globale ────────────────────────────────────
    const clientConds = [isNull(clientsTable.deletedAt)];
    if (clientIds && clientIds.length) clientConds.push(inArray(clientsTable.id, clientIds));
    const totalClients = denyClient ? 0 : (await db.select({ c: sql<number>`count(*)::int` }).from(clientsTable).where(and(...clientConds)))[0]?.c ?? 0;

    const projConds = [isNull(projectsTable.deletedAt)];
    if (projectIds && projectIds.length) projConds.push(inArray(projectsTable.id, projectIds));
    const activeProjects = denyProj ? 0 : (await db.select({ c: sql<number>`count(*)::int` })
      .from(projectsTable).where(and(...projConds, sql`${projectsTable.status} in ('active','planning','in_progress')`)))[0]?.c ?? 0;

    // ── Tâches du jour & retard ─────────────────────────────
    const taskBase = [isNull(tasksTable.deletedAt), sql`${tasksTable.status} not in ('done','completed','cancelled')`];
    if (projectIds && projectIds.length) taskBase.push(inArray(tasksTable.projectId, projectIds));
    const tasksToday = denyProj ? [] : await db.select({ id: tasksTable.id, title: tasksTable.title, priority: tasksTable.priority, dueDate: tasksTable.dueDate })
      .from(tasksTable).where(and(...taskBase, eq(tasksTable.dueDate, today))).limit(10);
    const tasksOverdueRows = denyProj ? [] : await db.select({ id: tasksTable.id, title: tasksTable.title, priority: tasksTable.priority, dueDate: tasksTable.dueDate })
      .from(tasksTable).where(and(...taskBase, sql`${tasksTable.dueDate} < ${today}`, sql`${tasksTable.dueDate} is not null`)).orderBy(tasksTable.dueDate).limit(10);

    // ── Factures à relancer (>5j retard) ────────────────────
    let invoicesOverdue: Array<{ id: string; ref: string; outstanding: number; daysLate: number }> = [];
    let outstandingTotal = 0;
    if (await hasPermission(userId, "accounting.read") && !denyClient) {
      const invConds = [
        sql`${invoicesTable.status} not in ('draft','paid','cancelled')`,
        sql`${invoicesTable.dueDate} is not null`,
        sql`${invoicesTable.dueDate}::date < now()::date`,
      ];
      if (clientIds && clientIds.length) invConds.push(inArray(invoicesTable.clientId, clientIds));
      const rows = await db.select({
        id: invoicesTable.id, ref: invoicesTable.referenceNumber,
        total: invoicesTable.totalAmount, paid: invoicesTable.paidAmount,
        dueDate: invoicesTable.dueDate,
      }).from(invoicesTable).where(and(...invConds)).limit(20);
      invoicesOverdue = rows.map((r) => {
        const outstanding = Number(r.total ?? 0) - Number(r.paid ?? 0);
        const due = r.dueDate ? new Date(r.dueDate) : now;
        const daysLate = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
        return { id: r.id, ref: r.ref, outstanding, daysLate };
      }).filter((r) => r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);
      outstandingTotal = invoicesOverdue.reduce((s, x) => s + x.outstanding, 0);
    }

    // ── Risques critiques ouverts (tenant-scoped + RBAC) ────
    const risks = (orgId && canViewRisks) ? await db.select({ id: riskFlagsTable.id, severity: riskFlagsTable.severity, title: riskFlagsTable.title, category: riskFlagsTable.category })
      .from(riskFlagsTable)
      .where(and(
        eq(riskFlagsTable.organizationId, orgId),
        eq(riskFlagsTable.isResolved, false),
        inArray(riskFlagsTable.severity, ["high", "critical"]),
      ))
      .orderBy(desc(riskFlagsTable.createdAt)).limit(5) : [];

    // ── Recommandations actives non traitées (tenant + RBAC) ─
    const recos = (orgId && canViewRecos) ? await db.select({ id: recommendationsTable.id, title: recommendationsTable.title, priority: recommendationsTable.priority })
      .from(recommendationsTable)
      .where(and(
        eq(recommendationsTable.organizationId, orgId),
        eq(recommendationsTable.isApplied, false),
        eq(recommendationsTable.isDismissed, false),
      ))
      .orderBy(desc(recommendationsTable.createdAt)).limit(3) : [];

    // ── Insights frais (J-1) (tenant + RBAC) ────────────────
    const insightCutoff = new Date(now.getTime() - 24 * 3600 * 1000);
    const insights = (orgId && canViewInsights) ? await db.select({ id: insightsTable.id, title: insightsTable.title })
      .from(insightsTable)
      .where(and(
        eq(insightsTable.organizationId, orgId),
        gte(insightsTable.createdAt, insightCutoff),
      ))
      .limit(3) : [];

    // ── Compose le briefing narratif ────────────────────────
    const ctxLines = [
      `Périmètre accessible : ${totalClients} client(s) actifs, ${activeProjects} projet(s) en cours.`,
      tasksToday.length ? `${tasksToday.length} tâche(s) due(s) aujourd'hui dont prioritaires : ${tasksToday.slice(0, 3).map((t) => t.title).join(", ")}.` : "Aucune tâche due aujourd'hui.",
      tasksOverdueRows.length ? `${tasksOverdueRows.length} tâche(s) en retard, la plus ancienne : ${tasksOverdueRows[0]!.title} (échéance ${tasksOverdueRows[0]!.dueDate}).` : "Aucune tâche en retard.",
      invoicesOverdue.length ? `${invoicesOverdue.length} facture(s) en retard pour ${fmtFCFA(outstandingTotal)} d'encours.` : "Aucune facture en retard.",
      risks.length ? `Risques critiques ouverts : ${risks.map((r) => r.title).slice(0, 3).join(" | ")}.` : "Aucun risque critique.",
      recos.length ? `Recommandations actives : ${recos.map((r) => r.title).join(" / ")}.` : "",
      insights.length ? `Signaux récents (24h) : ${insights.map((i) => i.title).join(" / ")}.` : "",
    ].filter(Boolean);

    let narrative: string | null = null;
    let provider: "openai" | "heuristic" = "heuristic";

    if (aiAvailable()) {
      narrative = await summarize({
        system: "Tu es le briefer exécutif Gaméasù. Rédige un briefing matinal de 4-6 phrases, en français business, pour un dirigeant pressé. Hiérarchise : priorités du jour > alertes argent > risques > opportunités. Pas de markdown, pas de préambule. Sois factuel.",
        context: ctxLines.join("\n"),
        maxTokens: 350,
      });
      if (narrative) provider = "openai";
    }
    if (!narrative) {
      narrative = ctxLines.join(" ");
    }

    return res.json({
      date: today,
      narrative,
      provider,
      kpis: {
        clients: totalClients,
        activeProjects,
        tasksDueToday: tasksToday.length,
        tasksOverdue: tasksOverdueRows.length,
        invoicesOverdue: invoicesOverdue.length,
        outstandingFCFA: outstandingTotal,
        criticalRisks: risks.length,
      },
      tasksToday,
      tasksOverdue: tasksOverdueRows.slice(0, 5),
      invoicesOverdue,
      risks,
      recommendations: recos,
      insights,
    });
  } catch (e) { next(e); }
});

export default router;
