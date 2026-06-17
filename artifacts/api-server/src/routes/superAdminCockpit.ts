/**
 * Cockpit super-admin — vue multi-tenant complète.
 * Routes :
 *  GET  /super-admin/overview
 *  GET  /super-admin/organizations
 *  GET  /super-admin/organizations/:id
 *  GET  /super-admin/organizations/:id/billing
 *  GET  /super-admin/organizations/:id/users
 *  GET  /super-admin/organizations/:id/tickets
 *  GET  /super-admin/revenue
 *  PATCH /super-admin/organizations/:id/status
 */
import { Router, type IRouter } from "express";
import {
  db, organizationsTable, organizationMembersTable, organizationSubscriptionsTable,
  subscriptionPlansTable, billingEventsTable, organizationModulesTable, usersTable,
  ticketsTable,
} from "@workspace/db";
import { and, eq, sql, desc, gte, ne, isNotNull } from "drizzle-orm";
import type { RequestHandler } from "express";
import { PLATFORM_ORG_SLUG } from "../services/ensure-admin";
import { factoryReset } from "../services/factory-reset";

const router: IRouter = Router();

const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") {
    res.status(403).json({ error: "Accès réservé aux super-administrateurs" });
    return;
  }
  next();
};

// ─── Overview ────────────────────────────────────────────────────────────────

router.get("/super-admin/overview", sa, async (_req, res, next) => {
  try {
    const [totalOrgs] = await db.select({ c: sql<number>`count(*)::int` }).from(organizationsTable).where(ne(organizationsTable.slug, PLATFORM_ORG_SLUG));
    const [activeOrgs] = await db.select({ c: sql<number>`count(*)::int` }).from(organizationsTable).where(and(eq(organizationsTable.isActive, true), ne(organizationsTable.slug, PLATFORM_ORG_SLUG)));
    const [totalUsers] = await db.select({ c: sql<number>`count(distinct ${organizationMembersTable.userId})::int` })
      .from(organizationMembersTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, organizationMembersTable.organizationId))
      .where(ne(organizationsTable.slug, PLATFORM_ORG_SLUG));
    const [activeSubs] = await db.select({ c: sql<number>`count(*)::int` }).from(organizationSubscriptionsTable)
      .where(and(eq(organizationSubscriptionsTable.isCurrent, true), eq(organizationSubscriptionsTable.status, "active")));

    const subs = await db.select({
      seats: organizationSubscriptionsTable.seats, unitPrice: organizationSubscriptionsTable.unitPrice,
      cycle: organizationSubscriptionsTable.billingCycle, planCode: subscriptionPlansTable.code,
      planName: subscriptionPlansTable.name,
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

    const since30 = new Date(Date.now() - 30 * 86400000);
    const [paid30] = await db.select({ s: sql<number>`coalesce(sum(${billingEventsTable.amount}), 0)::int` })
      .from(billingEventsTable)
      .where(and(eq(billingEventsTable.status, "paid"), gte(billingEventsTable.occurredAt, since30)));

    // Nouvelles métriques
    const [failedPayments] = await db.select({ c: sql<number>`count(*)::int` }).from(billingEventsTable)
      .where(eq(billingEventsTable.status, "failed"));
    const [pendingPayments] = await db.select({ c: sql<number>`count(*)::int` }).from(billingEventsTable)
      .where(eq(billingEventsTable.status, "pending"));
    const [openTickets] = await db.select({ c: sql<number>`count(*)::int` }).from(ticketsTable)
      .where(eq(ticketsTable.status, "open"));
    const [criticalTickets] = await db.select({ c: sql<number>`count(*)::int` }).from(ticketsTable)
      .where(and(eq(ticketsTable.priority, "critical"), ne(ticketsTable.status, "resolved")));

    return res.json({
      totalOrgs: totalOrgs?.c ?? 0,
      activeOrgs: activeOrgs?.c ?? 0,
      totalUsers: totalUsers?.c ?? 0,
      activeSubscriptions: activeSubs?.c ?? 0,
      mrrFcfa, arrFcfa: mrrFcfa * 12,
      paidLast30Days: paid30?.s ?? 0,
      failedPayments: failedPayments?.c ?? 0,
      pendingPayments: pendingPayments?.c ?? 0,
      openTickets: openTickets?.c ?? 0,
      criticalTickets: criticalTickets?.c ?? 0,
      byPlan,
    });
  } catch (e) { next(e); }
});

// ─── Health route ─────────────────────────────────────────────────────────────

router.get("/super-admin/health", sa, async (_req, res, next) => {
  try {
    const [openTickets] = await db.select({ c: sql<number>`count(*)::int` }).from(ticketsTable)
      .where(ne(ticketsTable.status, "resolved"));
    const [criticalTickets] = await db.select({ c: sql<number>`count(*)::int` }).from(ticketsTable)
      .where(and(eq(ticketsTable.priority, "critical"), ne(ticketsTable.status, "resolved")));
    const openIncidents = 0;
    const [auditLast24h] = [{ c: 0 }];
    const mem = process.memoryUsage();
    const openT = openTickets?.c ?? 0;
    const critT = criticalTickets?.c ?? 0;
    const status = critT > 0 ? "degraded" : openT > 5 ? "warning" : "healthy";
    return res.json({
      status, openTickets: openT, openIncidents, criticalIncidents: critT,
      auditLast24h: auditLast24h?.c ?? 0,
      uptime: process.uptime(), memoryMb: Math.round(mem.heapUsed / 1024 / 1024),
    });
  } catch (e) { next(e); }
});

// ─── Organizations list ───────────────────────────────────────────────────────

router.get("/super-admin/organizations", sa, async (_req, res, next) => {
  try {
    const orgs = await db.select({
      id: organizationsTable.id, slug: organizationsTable.slug, name: organizationsTable.name,
      industry: organizationsTable.industry, country: organizationsTable.country,
      isActive: organizationsTable.isActive, isDefault: organizationsTable.isDefault,
      createdAt: organizationsTable.createdAt,
    }).from(organizationsTable).where(ne(organizationsTable.slug, PLATFORM_ORG_SLUG)).orderBy(desc(organizationsTable.createdAt));

    const subs = await db.select({
      orgId: organizationSubscriptionsTable.organizationId,
      seats: organizationSubscriptionsTable.seats,
      unitPrice: organizationSubscriptionsTable.unitPrice,
      cycle: organizationSubscriptionsTable.billingCycle,
      status: organizationSubscriptionsTable.status,
      currentPeriodEnd: organizationSubscriptionsTable.currentPeriodEnd,
      planCode: subscriptionPlansTable.code,
      planName: subscriptionPlansTable.name,
    }).from(organizationSubscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(eq(organizationSubscriptionsTable.isCurrent, true));
    const subByOrg = new Map(subs.map((s) => [s.orgId, s]));

    const memberCounts = await db.select({
      orgId: organizationMembersTable.organizationId, c: sql<number>`count(*)::int`,
    }).from(organizationMembersTable).groupBy(organizationMembersTable.organizationId);
    const memMap = new Map(memberCounts.map((m) => [m.orgId, m.c]));

    const moduleCounts = await db.select({
      orgId: organizationModulesTable.organizationId,
      c: sql<number>`count(*) filter (where ${organizationModulesTable.enabled} = true)::int`,
    }).from(organizationModulesTable).groupBy(organizationModulesTable.organizationId);
    const modMap = new Map(moduleCounts.map((m) => [m.orgId, m.c]));

    // Billing events: failed count per org
    const failedBilling = await db.select({
      orgId: billingEventsTable.organizationId, c: sql<number>`count(*)::int`,
    }).from(billingEventsTable)
      .where(eq(billingEventsTable.status, "failed"))
      .groupBy(billingEventsTable.organizationId);
    const failedMap = new Map(failedBilling.map((f) => [f.orgId, f.c]));

    // Ticket count per org
    const ticketCounts = await db.select({
      orgId: ticketsTable.organizationId, c: sql<number>`count(*)::int`,
    }).from(ticketsTable)
      .where(ne(ticketsTable.status, "resolved"))
      .groupBy(ticketsTable.organizationId);
    const ticketMap = new Map(ticketCounts.map((t) => [t.orgId, t.c]));

    const rows = orgs.map((o) => {
      const sub = subByOrg.get(o.id);
      const seats = sub?.seats ?? 0;
      const unit = sub?.unitPrice ?? 0;
      const mrr = sub?.cycle === "annual" ? Math.round((unit * seats) / 12) : unit * seats;
      const memberCount = memMap.get(o.id) ?? 0;
      const failedCount = failedMap.get(o.id) ?? 0;
      const openTicketCount = ticketMap.get(o.id) ?? 0;

      // Health score calculation (0-100)
      let score = 100;
      if (!o.isActive) score -= 50;
      if (!sub || sub.status !== "active") score -= 20;
      if (failedCount > 0) score -= Math.min(failedCount * 10, 20);
      if (openTicketCount > 3) score -= 10;
      if (memberCount === 0) score -= 10;
      score = Math.max(0, score);

      const healthLabel = score >= 90 ? "Excellent" : score >= 70 ? "Stable" : score >= 50 ? "À surveiller" : score >= 30 ? "À risque" : "Critique";

      return {
        ...o,
        planCode: sub?.planCode ?? null, planName: sub?.planName ?? null,
        seats, mrr, billingCycle: sub?.cycle ?? null, status: sub?.status ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        memberCount, enabledModules: modMap.get(o.id) ?? 0,
        failedPayments: failedCount, openTickets: openTicketCount,
        healthScore: score, healthLabel,
      };
    });
    return res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

// ─── Organization detail ──────────────────────────────────────────────────────

router.get("/super-admin/organizations/:id", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
    if (!org || org.slug === PLATFORM_ORG_SLUG) return res.status(404).json({ error: "Organisation introuvable" });

    const [sub] = await db.select({
      id: organizationSubscriptionsTable.id,
      seats: organizationSubscriptionsTable.seats,
      unitPrice: organizationSubscriptionsTable.unitPrice,
      cycle: organizationSubscriptionsTable.billingCycle,
      status: organizationSubscriptionsTable.status,
      currentPeriodStart: organizationSubscriptionsTable.currentPeriodStart,
      currentPeriodEnd: organizationSubscriptionsTable.currentPeriodEnd,
      currency: organizationSubscriptionsTable.currency,
      setupFee: organizationSubscriptionsTable.setupFee,
      planId: organizationSubscriptionsTable.planId,
      planCode: subscriptionPlansTable.code,
      planName: subscriptionPlansTable.name,
    }).from(organizationSubscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(and(eq(organizationSubscriptionsTable.organizationId, id), eq(organizationSubscriptionsTable.isCurrent, true)))
      .limit(1);

    const [memberCount] = await db.select({ c: sql<number>`count(*)::int` })
      .from(organizationMembersTable).where(eq(organizationMembersTable.organizationId, id));
    const [moduleCount] = await db.select({
      c: sql<number>`count(*) filter (where ${organizationModulesTable.enabled} = true)::int`,
    }).from(organizationModulesTable).where(eq(organizationModulesTable.organizationId, id));
    const [ticketCount] = await db.select({ c: sql<number>`count(*)::int` })
      .from(ticketsTable).where(eq(ticketsTable.organizationId, id));
    const [openTicketCount] = await db.select({ c: sql<number>`count(*)::int` })
      .from(ticketsTable).where(and(eq(ticketsTable.organizationId, id), ne(ticketsTable.status, "resolved")));
    const [totalRevenue] = await db.select({ s: sql<number>`coalesce(sum(${billingEventsTable.amount}), 0)::int` })
      .from(billingEventsTable).where(and(eq(billingEventsTable.organizationId, id), eq(billingEventsTable.status, "paid")));
    const [failedPayments] = await db.select({ c: sql<number>`count(*)::int` })
      .from(billingEventsTable).where(and(eq(billingEventsTable.organizationId, id), eq(billingEventsTable.status, "failed")));

    const seats = sub?.seats ?? 0;
    const unit = sub?.unitPrice ?? 0;
    const mrr = sub?.cycle === "annual" ? Math.round((unit * seats) / 12) : unit * seats;

    return res.json({
      org,
      subscription: sub ?? null,
      mrr,
      metrics: {
        memberCount: memberCount?.c ?? 0,
        moduleCount: moduleCount?.c ?? 0,
        ticketCount: ticketCount?.c ?? 0,
        openTickets: openTicketCount?.c ?? 0,
        totalRevenue: totalRevenue?.s ?? 0,
        failedPayments: failedPayments?.c ?? 0,
      },
    });
  } catch (e) { next(e); }
});

// ─── Billing history ──────────────────────────────────────────────────────────

router.get("/super-admin/organizations/:id/billing", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const events = await db.select().from(billingEventsTable)
      .where(eq(billingEventsTable.organizationId, id))
      .orderBy(desc(billingEventsTable.occurredAt))
      .limit(100);

    const TVA_RATE = 0.18;
    const rows = events.map((e) => {
      const ht = e.amount;
      const tva = Math.round(ht * TVA_RATE);
      const ttc = ht + tva;
      return { ...e, amountHt: ht, amountTva: tva, amountTtc: ttc };
    });

    const totalPaid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
    const totalFailed = rows.filter((r) => r.status === "failed").length;
    const totalPending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);

    return res.json({ count: rows.length, rows, summary: { totalPaid, totalFailed, totalPending } });
  } catch (e) { next(e); }
});

// ─── Organization users ───────────────────────────────────────────────────────

router.get("/super-admin/organizations/:id/users", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const members = await db.select({
      userId: organizationMembersTable.userId,
      role: organizationMembersTable.role,
      isPrimary: organizationMembersTable.isPrimary,
      joinedAt: organizationMembersTable.joinedAt,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      userRole: usersTable.role,
      isActive: usersTable.isActive,
    }).from(organizationMembersTable)
      .leftJoin(usersTable, eq(usersTable.id, organizationMembersTable.userId))
      .where(eq(organizationMembersTable.organizationId, id))
      .orderBy(desc(organizationMembersTable.joinedAt));

    return res.json({ count: members.length, rows: members });
  } catch (e) { next(e); }
});

// ─── Organization tickets ─────────────────────────────────────────────────────

router.get("/super-admin/organizations/:id/tickets", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const tickets = await db.select().from(ticketsTable)
      .where(eq(ticketsTable.organizationId, id))
      .orderBy(desc(ticketsTable.createdAt))
      .limit(50);
    return res.json({ count: tickets.length, rows: tickets });
  } catch (e) { next(e); }
});

// ─── Revenue analytics ────────────────────────────────────────────────────────

router.get("/super-admin/revenue", sa, async (_req, res, next) => {
  try {
    // MRR par organisation
    const subs = await db.select({
      orgId: organizationSubscriptionsTable.organizationId,
      orgName: organizationsTable.name,
      seats: organizationSubscriptionsTable.seats,
      unitPrice: organizationSubscriptionsTable.unitPrice,
      cycle: organizationSubscriptionsTable.billingCycle,
      status: organizationSubscriptionsTable.status,
      planCode: subscriptionPlansTable.code,
    }).from(organizationSubscriptionsTable)
      .leftJoin(organizationsTable, eq(organizationsTable.id, organizationSubscriptionsTable.organizationId))
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(eq(organizationSubscriptionsTable.isCurrent, true));

    const byOrg = subs.map((s) => {
      const seats = s.seats ?? 0;
      const unit = s.unitPrice ?? 0;
      const mrr = s.cycle === "annual" ? Math.round((unit * seats) / 12) : unit * seats;
      return { orgId: s.orgId, orgName: s.orgName ?? "—", planCode: s.planCode ?? "—", seats, mrr, status: s.status };
    }).sort((a, b) => b.mrr - a.mrr);

    // Revenus par mois (12 derniers mois depuis billing_events)
    const since12 = new Date();
    since12.setMonth(since12.getMonth() - 11);
    since12.setDate(1);
    since12.setHours(0, 0, 0, 0);

    const monthlyRevenue = await db.execute(sql`
      SELECT
        to_char(occurred_at, 'YYYY-MM') AS month,
        coalesce(sum(amount) filter (where status = 'paid'), 0)::int AS revenue,
        count(*) filter (where status = 'paid') AS paid_count,
        count(*) filter (where status = 'failed') AS failed_count
      FROM billing_events
      WHERE occurred_at >= ${since12}
      GROUP BY 1
      ORDER BY 1
    `);

    const totalMrr = byOrg.reduce((s, r) => s + r.mrr, 0);
    const activeOrgs = byOrg.filter((r) => r.status === "active").length;
    const arpu = activeOrgs > 0 ? Math.round(totalMrr / activeOrgs) : 0;

    // Prévision 30/60/90 jours
    const forecast = [
      { period: "30 jours", amount: totalMrr },
      { period: "60 jours", amount: totalMrr * 2 },
      { period: "90 jours", amount: totalMrr * 3 },
    ];

    return res.json({
      totalMrr, arrFcfa: totalMrr * 12, arpu, activeOrgs,
      byOrg, monthlyRevenue: monthlyRevenue.rows,
      forecast,
    });
  } catch (e) { next(e); }
});

// ─── Delete organization ──────────────────────────────────────────────────────

router.delete("/super-admin/organizations/:id", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });
    if (org.slug === PLATFORM_ORG_SLUG)
      return res.status(403).json({ error: "L'organisation interne de la plateforme ne peut pas être supprimée" });
    if (org.isDefault)
      return res.status(403).json({ error: "L'organisation par défaut ne peut pas être supprimée" });

    // Hard delete — les FK onDelete:cascade nettoient toutes les tables enfants
    await db.delete(organizationsTable).where(eq(organizationsTable.id, id));
    return res.json({ ok: true, deleted: id });
  } catch (e) { next(e); }
});

// ─── Status toggle ────────────────────────────────────────────────────────────

router.patch("/super-admin/organizations/:id/status", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { action } = req.body as { action: string };
    if (!["suspend", "reactivate"].includes(action)) {
      return res.status(400).json({ error: "action doit être 'suspend' ou 'reactivate'" });
    }
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });
    if (org.slug === PLATFORM_ORG_SLUG) return res.status(403).json({ error: "L'organisation interne de la plateforme ne peut pas être modifiée" });
    if (org.isDefault) return res.status(403).json({ error: "L'organisation par défaut ne peut pas être suspendue" });

    const isActive = action === "reactivate";
    await db.update(organizationsTable).set({ isActive, updatedAt: new Date() }).where(eq(organizationsTable.id, id));
    const newSubStatus = action === "suspend" ? "suspended" : "active";
    await db.update(organizationSubscriptionsTable)
      .set({ status: newSubStatus, updatedAt: new Date() })
      .where(and(
        eq(organizationSubscriptionsTable.organizationId, id),
        eq(organizationSubscriptionsTable.isCurrent, true),
        ne(organizationSubscriptionsTable.status, "trial"),
      ));
    return res.json({ ok: true, organizationId: id, action, isActive });
  } catch (e) { next(e); }
});

// ─── Réinitialisation usine (purge totale des données) ────────────────────────
//
// Supprime TOUTES les données applicatives (comptes, organisations, abonnements,
// facturation, CRM, RH, finance, stock, kiosk, messagerie, logs métier…) tout en
// conservant le schéma, les migrations et le catalogue de configuration.
// Reconstruit ensuite une base « première installation » (org plateforme +
// super-admin sans mot de passe). IRRÉVERSIBLE — double garde : super-admin +
// phrase de confirmation exacte.

const FACTORY_RESET_CONFIRM = "RÉINITIALISER GAMEASU";

router.post("/super-admin/factory-reset", sa, async (req, res, next) => {
  try {
    const confirm = (req.body as { confirm?: unknown } | undefined)?.confirm;
    if (typeof confirm !== "string" || confirm.trim() !== FACTORY_RESET_CONFIRM) {
      return res.status(400).json({
        error: `Confirmation invalide. Saisissez exactement « ${FACTORY_RESET_CONFIRM} » pour confirmer la purge.`,
      });
    }

    req.log.warn(
      { userId: req.authUser?.id, email: req.authUser?.email },
      "factory-reset: purge totale déclenchée par un super-admin",
    );

    const report = await factoryReset();
    return res.json({ ok: true, ...report });
  } catch (e) { next(e); }
});

export default router;
