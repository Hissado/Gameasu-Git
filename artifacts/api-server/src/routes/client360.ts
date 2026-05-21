/**
 * Phase 5 — Vue 360° client.
 * Agrège toutes les données pertinentes pour piloter une relation client :
 * fiche, score santé, risques, recommandations, insights, projets,
 * facturation (CA, encours, retard), opportunités, dernières activités,
 * et un mini résumé heuristique.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, clientContactsTable, projectsTable, tasksTable,
  invoicesTable, paymentsTable, ordersTable, proformasTable,
  opportunitiesTable, activitiesTable,
  smartScoresTable, riskFlagsTable, insightsTable, recommendationsTable,
  assistantSummariesTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { userAccessibleClientIds, userHasClientAccess } from "../lib/rbac/permissions";
import { getCurrentOrganizationId } from "../lib/tenant";
import { tierForScore } from "@workspace/db";

const router: IRouter = Router();

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 3600 * 1000));
}

router.get("/clients/:id/360", requirePermission("clients.read"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const clientId = String(req.params["id"]);
    if (!(await userHasClientAccess(userId, clientId))) {
      return res.status(403).json({ error: "forbidden" });
    }
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), isNull(clientsTable.deletedAt))).limit(1);
    if (!client) return res.status(404).json({ error: "not_found" });

    const [contacts, projects, invoices, payments, orders, proformas, opportunities, activities, score, risks, recos, insights, summary] = await Promise.all([
      db.select().from(clientContactsTable).where(eq(clientContactsTable.clientId, clientId)),
      db.select().from(projectsTable).where(and(eq(projectsTable.clientId, clientId), isNull(projectsTable.deletedAt))).limit(50),
      db.select().from(invoicesTable).where(eq(invoicesTable.clientId, clientId)).orderBy(desc(invoicesTable.createdAt)).limit(50),
      db.select({ p: paymentsTable }).from(paymentsTable)
        .leftJoin(invoicesTable, eq(invoicesTable.id, paymentsTable.invoiceId))
        .where(eq(invoicesTable.clientId, clientId)).limit(50),
      db.select().from(ordersTable).where(and(eq(ordersTable.clientId, clientId), isNull(ordersTable.deletedAt))).orderBy(desc(ordersTable.createdAt)).limit(20),
      db.select().from(proformasTable).where(eq(proformasTable.clientId, clientId)).orderBy(desc(proformasTable.createdAt)).limit(20),
      db.select().from(opportunitiesTable).where(and(eq(opportunitiesTable.clientId, clientId), isNull(opportunitiesTable.deletedAt))).orderBy(desc(opportunitiesTable.createdAt)).limit(20),
      db.select().from(activitiesTable).where(eq(activitiesTable.clientId, clientId)).orderBy(desc(activitiesTable.createdAt)).limit(20),
      db.select().from(smartScoresTable)
        .where(and(eq(smartScoresTable.organizationId, orgId), eq(smartScoresTable.entityType, "client"), eq(smartScoresTable.entityId, clientId), eq(smartScoresTable.scoreType, "health")))
        .orderBy(desc(smartScoresTable.computedAt)).limit(1),
      db.select().from(riskFlagsTable)
        .where(and(eq(riskFlagsTable.organizationId, orgId), eq(riskFlagsTable.entityType, "client"), eq(riskFlagsTable.entityId, clientId), eq(riskFlagsTable.isResolved, false)))
        .orderBy(desc(riskFlagsTable.detectedAt)).limit(10),
      db.select().from(recommendationsTable)
        .where(and(eq(recommendationsTable.organizationId, orgId), eq(recommendationsTable.entityType, "client"), eq(recommendationsTable.entityId, clientId), eq(recommendationsTable.isApplied, false), eq(recommendationsTable.isDismissed, false)))
        .orderBy(desc(recommendationsTable.createdAt)).limit(10),
      db.select().from(insightsTable)
        .where(and(eq(insightsTable.organizationId, orgId), eq(insightsTable.scope, "client"), eq(insightsTable.scopeId, clientId), eq(insightsTable.isDismissed, false)))
        .orderBy(desc(insightsTable.createdAt)).limit(10),
      db.select().from(assistantSummariesTable)
        .where(and(eq(assistantSummariesTable.organizationId, orgId), eq(assistantSummariesTable.scope, "client"), eq(assistantSummariesTable.scopeId, clientId)))
        .orderBy(desc(assistantSummariesTable.createdAt)).limit(1),
    ]);

    // ── Métriques financières ────────────────────────────────
    const now = new Date();
    let totalInvoiced = 0, totalPaid = 0, totalDue = 0, totalOverdue = 0;
    let overdueCount = 0;
    let maxOverdueDays = 0;
    for (const inv of invoices) {
      const t = num(inv.totalAmount);
      const p = num(inv.paidAmount);
      totalInvoiced += t;
      totalPaid += p;
      const remaining = Math.max(0, t - p);
      if (remaining > 0.001 && inv.status !== "cancelled") {
        totalDue += remaining;
        if (inv.dueDate) {
          const due = new Date(inv.dueDate);
          if (due < now) {
            totalOverdue += remaining;
            overdueCount += 1;
            maxOverdueDays = Math.max(maxOverdueDays, daysBetween(now, due));
          }
        }
      }
    }
    const totalPipeline = opportunities
      .filter((o) => !["won", "lost", "cancelled"].includes(String(o.stage)))
      .reduce((acc, o) => acc + num(o.value), 0);

    // ── Stats projets/tâches ─────────────────────────────────
    const projectIds = projects.map((p) => p.id);
    let openTasks = 0, overdueTasks = 0;
    if (projectIds.length > 0) {
      const taskRows = await db.select({
        status: tasksTable.status,
        dueDate: tasksTable.dueDate,
      }).from(tasksTable).where(and(inArray(tasksTable.projectId, projectIds), isNull(tasksTable.deletedAt)));
      for (const t of taskRows) {
        if (t.status !== "done" && t.status !== "cancelled") {
          openTasks += 1;
          if (t.dueDate && new Date(t.dueDate) < now) overdueTasks += 1;
        }
      }
    }

    // ── Score santé heuristique si pas en base ──────────────
    let healthScore = score[0];
    if (!healthScore) {
      const paymentFactor = clamp(totalInvoiced > 0
        ? 100 - (totalOverdue / totalInvoiced) * 200
        : 70);
      const activityFactor = clamp(activities.length * 12);
      const projectFactor = clamp(projects.length > 0 ? 50 + projects.length * 8 : 30);
      const riskFactor = clamp(100 - risks.length * 25);
      const value = clamp(Math.round(paymentFactor * 0.35 + activityFactor * 0.2 + projectFactor * 0.2 + riskFactor * 0.25));
      const tier = tierForScore(value);
      healthScore = {
        id: "computed",
        organizationId: orgId,
        entityType: "client", entityId: clientId,
        scoreType: "health",
        value, tier,
        factors: [
          { key: "payment", label: "Délais de paiement", weight: 35, value: Math.round(paymentFactor), reason: overdueCount > 0 ? `${overdueCount} facture(s) en retard, max ${maxOverdueDays} j` : "À jour" },
          { key: "engagement", label: "Activité récente", weight: 20, value: Math.round(activityFactor), reason: `${activities.length} interactions enregistrées` },
          { key: "projects", label: "Projets en cours", weight: 20, value: Math.round(projectFactor), reason: `${projects.length} projet(s)` },
          { key: "risk", label: "Risques ouverts", weight: 25, value: Math.round(riskFactor), reason: risks.length === 0 ? "Aucun risque ouvert" : `${risks.length} risque(s) à traiter` },
        ],
        computedBy: "heuristic",
        computedAt: new Date(),
      } as any;
    }

    // ── Résumé heuristique de la relation ────────────────────
    const summaryHeuristic = [
      `${client.name} — ${projects.length} projet(s), ${openTasks} tâche(s) ouverte(s)${overdueTasks > 0 ? ` (${overdueTasks} en retard)` : ""}.`,
      totalInvoiced > 0 ? `CA facturé : ${Math.round(totalInvoiced).toLocaleString("fr-FR")} FCFA, encours ${Math.round(totalDue).toLocaleString("fr-FR")} FCFA${totalOverdue > 0 ? `, dont ${Math.round(totalOverdue).toLocaleString("fr-FR")} FCFA en retard` : ""}.` : "Aucune facture émise.",
      totalPipeline > 0 ? `Pipeline commercial : ${Math.round(totalPipeline).toLocaleString("fr-FR")} FCFA.` : null,
      risks.length > 0 ? `${risks.length} risque(s) actif(s) à surveiller.` : null,
    ].filter(Boolean).join(" ");

    return res.json({
      client: { ...client, contacts },
      score: healthScore,
      risks,
      recommendations: recos,
      insights,
      summary: summary[0] ?? null,
      summaryHeuristic,
      financial: {
        totalInvoiced, totalPaid, totalDue, totalOverdue,
        overdueCount, maxOverdueDays,
        invoicesCount: invoices.length,
        paymentsCount: payments.length,
        pipelineAmount: totalPipeline,
      },
      operations: {
        projectsCount: projects.length,
        openTasks, overdueTasks,
        ordersCount: orders.length,
        proformasCount: proformas.length,
        opportunitiesCount: opportunities.length,
      },
      recent: {
        invoices: invoices.slice(0, 8),
        orders: orders.slice(0, 5),
        proformas: proformas.slice(0, 5),
        projects: projects.slice(0, 8),
        opportunities,
        activities,
      },
    });
  } catch (e) { next(e); }
});

// ── Phase 6 — Sales scoring : priorité opportunités ────────
router.get("/sales/opportunities-scoring", requirePermission("commercial.read"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    // ACL : filtrer aux clients accessibles à l'utilisateur (null = accès total)
    const accessible = await userAccessibleClientIds(userId);
    const conds: any[] = [
      isNull(opportunitiesTable.deletedAt),
      isNull(clientsTable.deletedAt),
      sql`${opportunitiesTable.stage} NOT IN ('won', 'lost', 'cancelled')`,
    ];
    if (accessible !== null) {
      if (accessible.length === 0) return res.json({ data: [] });
      conds.push(inArray(opportunitiesTable.clientId, accessible));
    }

    const opps = await db.select({
      opp: opportunitiesTable,
      client: clientsTable,
    })
      .from(opportunitiesTable)
      .leftJoin(clientsTable, eq(clientsTable.id, opportunitiesTable.clientId))
      .where(and(...conds))
      .limit(200);

    const stageWeight: Record<string, number> = {
      lead: 15, qualified: 30, proposal: 55, negotiation: 75, contract: 90,
    };
    const now = new Date();
    const scored = opps.map(({ opp, client }) => {
      const stage = String(opp.stage ?? "lead");
      const stageScore = clamp(stageWeight[stage] ?? 20);
      const amount = num(opp.value);
      const amountScore = clamp(Math.log10(Math.max(1, amount / 100_000)) * 25);
      const closeDate = opp.expectedCloseDate;
      let urgencyScore = 40;
      if (closeDate) {
        const d = daysBetween(new Date(closeDate), now);
        urgencyScore = d <= 7 ? 95 : d <= 30 ? 75 : d <= 90 ? 50 : 25;
      }
      urgencyScore = clamp(urgencyScore);
      const probability = clamp(num(opp.probability ?? 50));
      const scoreValue = clamp(Math.round(stageScore * 0.35 + amountScore * 0.25 + urgencyScore * 0.2 + probability * 0.2));
      return {
        id: opp.id,
        title: opp.title,
        clientId: opp.clientId,
        clientName: client?.name ?? null,
        stage, amount, probability, closeDate: closeDate ?? null,
        score: scoreValue,
        tier: tierForScore(scoreValue),
        factors: [
          { key: "stage", label: "Stade pipeline", value: Math.round(stageScore), weight: 35 },
          { key: "amount", label: "Montant", value: Math.round(amountScore), weight: 25 },
          { key: "urgency", label: "Échéance", value: Math.round(urgencyScore), weight: 20 },
          { key: "probability", label: "Probabilité saisie", value: Math.round(probability), weight: 20 },
        ],
      };
    }).sort((a, b) => b.score - a.score);

    return res.json({ data: scored });
  } catch (e) { next(e); }
});

export default router;
