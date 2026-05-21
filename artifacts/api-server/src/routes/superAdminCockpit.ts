/**
 * Phase 20 — Cockpit super-admin (vue multi-tenant).
 *  - GET /api/super-admin/overview : KPI plateforme (orgs, MRR, users, plans).
 *  - GET /api/super-admin/organizations : liste enrichie des organisations.
 *
 * Réservé au rôle `super_admin`.
 */
import { Router, type IRouter } from "express";
import {
  db, organizationsTable, organizationMembersTable, organizationSubscriptionsTable,
  subscriptionPlansTable, billingEventsTable, organizationModulesTable, usersTable,
} from "@workspace/db";
import { and, eq, sql, desc, gte } from "drizzle-orm";
import type { RequestHandler } from "express";

const router: IRouter = Router();

// Garde stricte super_admin uniquement. Note : `requireRole()` standard
// laisse passer `admin` ET `super_admin` par convention plateforme — on a
// donc besoin d'un middleware dédié pour cloisonner la vue multi-tenant.
const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") {
    res.status(403).json({ error: "Accès réservé aux super-administrateurs" });
    return;
  }
  next();
};

router.get("/super-admin/overview", sa, async (_req, res, next) => {
  try {
    const [totalOrgs] = await db.select({ c: sql<number>`count(*)::int` }).from(organizationsTable);
    const [activeOrgs] = await db.select({ c: sql<number>`count(*)::int` }).from(organizationsTable).where(eq(organizationsTable.isActive, true));
    const [totalUsers] = await db.select({ c: sql<number>`count(distinct ${organizationMembersTable.userId})::int` }).from(organizationMembersTable);
    const [activeSubs] = await db.select({ c: sql<number>`count(*)::int` }).from(organizationSubscriptionsTable).where(and(eq(organizationSubscriptionsTable.isCurrent, true), eq(organizationSubscriptionsTable.status, "active")));

    // MRR : somme unitPrice × seats des abonnements mensuels actifs courants
    const subs = await db.select({
      seats: organizationSubscriptionsTable.seats, unitPrice: organizationSubscriptionsTable.unitPrice,
      cycle: organizationSubscriptionsTable.billingCycle, status: organizationSubscriptionsTable.status,
      planCode: subscriptionPlansTable.code, planName: subscriptionPlansTable.name,
    }).from(organizationSubscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(and(eq(organizationSubscriptionsTable.isCurrent, true), eq(organizationSubscriptionsTable.status, "active")));

    let mrrFcfa = 0;
    const byPlan: Record<string, { count: number; seats: number; mrr: number }> = {};
    for (const s of subs) {
      const seats = s.seats ?? 0;
      const unit = s.unitPrice ?? 0;
      const monthly = s.cycle === "annual" ? Math.round((unit * seats) / 12) : unit * seats;
      mrrFcfa += monthly;
      const k = s.planCode ?? "UNKNOWN";
      byPlan[k] = byPlan[k] ?? { count: 0, seats: 0, mrr: 0 };
      byPlan[k]!.count++;
      byPlan[k]!.seats += seats;
      byPlan[k]!.mrr += monthly;
    }

    // Revenu encaissé 30 derniers jours
    const since = new Date(Date.now() - 30 * 86400000);
    const [paid30] = await db.select({ s: sql<number>`coalesce(sum(${billingEventsTable.amount}), 0)::int` })
      .from(billingEventsTable)
      .where(and(eq(billingEventsTable.status, "paid"), gte(billingEventsTable.occurredAt, since)));

    return res.json({
      totalOrgs: totalOrgs?.c ?? 0,
      activeOrgs: activeOrgs?.c ?? 0,
      totalUsers: totalUsers?.c ?? 0,
      activeSubscriptions: activeSubs?.c ?? 0,
      mrrFcfa,
      arrFcfa: mrrFcfa * 12,
      paidLast30Days: paid30?.s ?? 0,
      byPlan,
    });
  } catch (e) { next(e); }
});

router.get("/super-admin/organizations", sa, async (_req, res, next) => {
  try {
    const orgs = await db.select({
      id: organizationsTable.id, slug: organizationsTable.slug, name: organizationsTable.name,
      industry: organizationsTable.industry, country: organizationsTable.country,
      isActive: organizationsTable.isActive, isDefault: organizationsTable.isDefault,
      createdAt: organizationsTable.createdAt,
    }).from(organizationsTable).orderBy(desc(organizationsTable.createdAt));

    const subs = await db.select({
      orgId: organizationSubscriptionsTable.organizationId,
      seats: organizationSubscriptionsTable.seats,
      unitPrice: organizationSubscriptionsTable.unitPrice,
      cycle: organizationSubscriptionsTable.billingCycle,
      status: organizationSubscriptionsTable.status,
      planCode: subscriptionPlansTable.code,
      planName: subscriptionPlansTable.name,
    }).from(organizationSubscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(eq(organizationSubscriptionsTable.isCurrent, true));
    const subByOrg = new Map(subs.map((s) => [s.orgId, s]));

    const memberCounts = await db.select({
      orgId: organizationMembersTable.organizationId,
      c: sql<number>`count(*)::int`,
    }).from(organizationMembersTable).groupBy(organizationMembersTable.organizationId);
    const memMap = new Map(memberCounts.map((m) => [m.orgId, m.c]));

    const moduleCounts = await db.select({
      orgId: organizationModulesTable.organizationId,
      c: sql<number>`count(*) filter (where ${organizationModulesTable.enabled} = true)::int`,
    }).from(organizationModulesTable).groupBy(organizationModulesTable.organizationId);
    const modMap = new Map(moduleCounts.map((m) => [m.orgId, m.c]));

    const rows = orgs.map((o) => {
      const sub = subByOrg.get(o.id);
      const seats = sub?.seats ?? 0;
      const unit = sub?.unitPrice ?? 0;
      const mrr = sub?.cycle === "annual" ? Math.round((unit * seats) / 12) : unit * seats;
      return {
        ...o,
        planCode: sub?.planCode ?? null,
        planName: sub?.planName ?? null,
        seats, mrr, billingCycle: sub?.cycle ?? null, status: sub?.status ?? null,
        memberCount: memMap.get(o.id) ?? 0,
        enabledModules: modMap.get(o.id) ?? 0,
      };
    });
    return res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

export default router;
