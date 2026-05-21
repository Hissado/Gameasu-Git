/**
 * Phase 15 — Pipeline commercial IA.
 *  - GET /api/pipeline/intelligence/overview     : KPI synthèse pipeline + forecast.
 *  - GET /api/pipeline/intelligence/forecast     : projection revenu trimestriel pondéré.
 *  - GET /api/pipeline/intelligence/at-risk      : opportunités à risque (stagnation/échéance).
 *  - GET /api/pipeline/intelligence/next-actions : prochaines actions recommandées par opp.
 *
 * Heuristique pure. Permission `commercial.read`. ACL fine via clientIds accessibles.
 */
import { Router, type IRouter } from "express";
import { db, opportunitiesTable, clientsTable, activitiesTable, usersTable } from "@workspace/db";
import { and, eq, isNull, sql, desc, inArray, notInArray, lte } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { userAccessibleClientIds } from "../lib/rbac/permissions";

const router: IRouter = Router();

const CLOSED_STAGES = ["won", "lost", "closed_won", "closed_lost", "cancelled"];

// Stage → probabilité par défaut si pas saisie
const STAGE_PROB: Record<string, number> = {
  lead: 10, qualification: 20, qualified: 25, proposal: 50, negotiation: 70,
  contract: 85, closing: 90, won: 100, closed_won: 100, lost: 0, closed_lost: 0,
};

async function loadOpenOpps(clientIds: string[] | null) {
  const conds: any[] = [isNull(opportunitiesTable.deletedAt), notInArray(opportunitiesTable.stage, CLOSED_STAGES)];
  if (clientIds && clientIds.length) conds.push(inArray(opportunitiesTable.clientId, clientIds));
  if (clientIds && clientIds.length === 0) return [];
  return db.select({
    id: opportunitiesTable.id, title: opportunitiesTable.title, stage: opportunitiesTable.stage,
    value: opportunitiesTable.value, probability: opportunitiesTable.probability,
    expectedCloseDate: opportunitiesTable.expectedCloseDate, clientId: opportunitiesTable.clientId,
    assignedToId: opportunitiesTable.assignedToId, updatedAt: opportunitiesTable.updatedAt,
    createdAt: opportunitiesTable.createdAt,
  }).from(opportunitiesTable).where(and(...conds));
}

router.get("/pipeline/intelligence/overview", requirePermission("commercial.read"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const clientIds = await userAccessibleClientIds(userId);
    const opps = await loadOpenOpps(clientIds);
    const totalValue = opps.reduce((s, o) => s + Number(o.value ?? 0), 0);
    const weighted = opps.reduce((s, o) => {
      const p = (o.probability ?? STAGE_PROB[o.stage] ?? 10) / 100;
      return s + Number(o.value ?? 0) * p;
    }, 0);
    const byStage: Record<string, { count: number; value: number }> = {};
    for (const o of opps) {
      const k = o.stage;
      byStage[k] = byStage[k] ?? { count: 0, value: 0 };
      byStage[k]!.count++;
      byStage[k]!.value += Number(o.value ?? 0);
    }
    const now = Date.now();
    const hot = opps.filter((o) => (o.probability ?? STAGE_PROB[o.stage] ?? 0) >= 60).length;
    const closingSoon = opps.filter((o) => o.expectedCloseDate && new Date(o.expectedCloseDate).getTime() - now < 30 * 86400000).length;
    return res.json({
      totalOpen: opps.length,
      totalValue: Math.round(totalValue),
      weightedValue: Math.round(weighted),
      hotOpps: hot,
      closingSoon,
      byStage,
    });
  } catch (e) { next(e); }
});

router.get("/pipeline/intelligence/forecast", requirePermission("commercial.read"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const clientIds = await userAccessibleClientIds(userId);
    const opps = await loadOpenOpps(clientIds);
    const now = new Date();
    const months: Array<{ month: string; expected: number; weighted: number; count: number }> = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inMonth = opps.filter((o) => {
        if (!o.expectedCloseDate) return false;
        const t = new Date(o.expectedCloseDate).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      const expected = inMonth.reduce((s, o) => s + Number(o.value ?? 0), 0);
      const weighted = inMonth.reduce((s, o) => s + Number(o.value ?? 0) * ((o.probability ?? STAGE_PROB[o.stage] ?? 10) / 100), 0);
      months.push({ month: monthKey, expected: Math.round(expected), weighted: Math.round(weighted), count: inMonth.length });
    }
    return res.json({ months });
  } catch (e) { next(e); }
});

router.get("/pipeline/intelligence/at-risk", requirePermission("commercial.read"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const clientIds = await userAccessibleClientIds(userId);
    const opps = await loadOpenOpps(clientIds);
    const now = Date.now();
    const rows = opps.map((o) => {
      const staleDays = Math.floor((now - new Date(o.updatedAt).getTime()) / 86400000);
      const closeDays = o.expectedCloseDate ? Math.floor((new Date(o.expectedCloseDate).getTime() - now) / 86400000) : null;
      const reasons: string[] = [];
      let score = 0;
      if (staleDays > 14) { reasons.push(`Pas de mise à jour depuis ${staleDays} j`); score += Math.min(40, staleDays); }
      if (closeDays !== null && closeDays < 0) { reasons.push(`Échéance dépassée de ${Math.abs(closeDays)} j`); score += 30; }
      if (closeDays !== null && closeDays >= 0 && closeDays < 7 && (o.probability ?? 0) < 50) { reasons.push("Clôture imminente mais probabilité < 50 %"); score += 25; }
      if ((o.probability ?? STAGE_PROB[o.stage] ?? 0) < 20 && Number(o.value ?? 0) > 5000000) { reasons.push("Gros deal avec probabilité faible"); score += 15; }
      return { ...o, value: Number(o.value ?? 0), probability: o.probability ?? STAGE_PROB[o.stage] ?? 0, riskScore: Math.min(100, score), reasons, staleDays, closeDays };
    }).filter((r) => r.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore).slice(0, 20);
    return res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

router.get("/pipeline/intelligence/next-actions", requirePermission("commercial.read"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const clientIds = await userAccessibleClientIds(userId);
    const opps = await loadOpenOpps(clientIds);
    const ids = opps.map((o) => o.id);
    const lastActMap = new Map<string, Date>();
    if (ids.length) {
      const acts = await db.select({ oppId: activitiesTable.opportunityId, createdAt: activitiesTable.createdAt })
        .from(activitiesTable).where(inArray(activitiesTable.opportunityId, ids));
      for (const a of acts) {
        if (!a.oppId) continue;
        const cur = lastActMap.get(a.oppId);
        if (!cur || a.createdAt > cur) lastActMap.set(a.oppId, a.createdAt);
      }
    }
    const now = Date.now();
    const actions = opps.map((o) => {
      const last = lastActMap.get(o.id);
      const daysSince = last ? Math.floor((now - last.getTime()) / 86400000) : 999;
      let action = "Relancer le contact"; let priority: "low" | "medium" | "high" | "urgent" = "low";
      if (o.stage === "lead" || o.stage === "qualification") { action = "Qualifier le besoin (call de découverte)"; priority = daysSince > 7 ? "high" : "medium"; }
      else if (o.stage === "proposal") { action = "Présenter la proposition / suivre l'envoi"; priority = daysSince > 5 ? "urgent" : "high"; }
      else if (o.stage === "negotiation") { action = "Négocier conditions / produire devis final"; priority = "urgent"; }
      else if (o.stage === "contract" || o.stage === "closing") { action = "Faire signer le contrat"; priority = "urgent"; }
      if (daysSince > 21) priority = "urgent";
      return {
        id: o.id, title: o.title, stage: o.stage, value: Number(o.value ?? 0),
        probability: o.probability ?? STAGE_PROB[o.stage] ?? 0,
        daysSinceLastActivity: daysSince === 999 ? null : daysSince,
        nextAction: action, priority,
      };
    }).sort((a, b) => {
      const order = { urgent: 3, high: 2, medium: 1, low: 0 };
      return order[b.priority] - order[a.priority] || b.value - a.value;
    }).slice(0, 30);
    return res.json({ count: actions.length, actions });
  } catch (e) { next(e); }
});

export default router;
