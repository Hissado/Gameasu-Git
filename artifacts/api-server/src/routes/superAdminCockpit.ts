/**
 * Cockpit super-admin — vue multi-tenant complète.
 * Routes :
 *  GET   /super-admin/overview
 *  GET   /super-admin/organizations
 *  GET   /super-admin/organizations/:id
 *  GET   /super-admin/organizations/:id/billing
 *  GET   /super-admin/organizations/:id/users
 *  GET   /super-admin/organizations/:id/tickets
 *  GET   /super-admin/revenue
 *  PATCH /super-admin/organizations/:id/status
 *  PATCH /super-admin/organizations/:id/custom-price
 *  POST  /super-admin/factory-reset
 *  DELETE /super-admin/organizations/:id
 */
import { Router, type IRouter } from "express";
import {
  db, organizationsTable, organizationMembersTable, organizationSubscriptionsTable,
  subscriptionPlansTable, billingEventsTable, organizationModulesTable, usersTable,
  ticketsTable,
} from "@workspace/db";
import { and, eq, sql, desc, gte, ne } from "drizzle-orm";
import type { RequestHandler } from "express";
import { PLATFORM_ORG_SLUG } from "../services/ensure-admin";
import { factoryReset } from "../services/factory-reset";
import { deleteOrganization } from "../services/delete-organization";

const router: IRouter = Router();

const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") {
    res.status(403).json({ error: "Accès réservé aux super-administrateurs" });
    return;
  }
  next();
};

// ─── Politique tarifaire Gaméasù ─────────────────────────────────────────────
//
//  1er utilisateur       : 10 000 FCFA HT
//  Utilisateurs 2 à 5    :  5 000 FCFA HT / utilisateur
//  Utilisateurs 6 à 10   :  2 000 FCFA HT / utilisateur
//  Utilisateurs 11 à 50  :  1 000 FCFA HT / utilisateur
//  > 50 utilisateurs     : tarification personnalisée (prix négocié stocké dans unitPrice)
//
//  TVA : 18 %
//
//  Seuls les utilisateurs actifs (isActive = true) sont facturables.

const TVA_RATE = 0.18;

interface PricingLine {
  label: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface PriceResult {
  activeUsers: number;
  ht: number | null;   // null = > 50 utilisateurs sans prix négocié défini
  tva: number | null;
  ttc: number | null;
  isCustom: boolean;   // true si > 50 utilisateurs
  mrr: number;         // ht ?? 0 — pour les agrégats (ne jamais afficher directement)
  breakdown: PricingLine[];
}

/**
 * Calcule le prix mensuel HT pour une organisation selon la politique tarifaire
 * officielle de Gaméasù.
 *
 * @param activeUsers   Nombre d'utilisateurs actifs facturables.
 * @param negotiatedHt  Prix mensuel HT négocié (utilisé uniquement si activeUsers > 50).
 */
function calcOrgPrice(activeUsers: number, negotiatedHt?: number | null): PriceResult {
  if (activeUsers > 50) {
    const ht = negotiatedHt != null && negotiatedHt > 0 ? negotiatedHt : null;
    const tva = ht != null ? Math.round(ht * TVA_RATE) : null;
    return {
      activeUsers, ht, tva, ttc: ht != null && tva != null ? ht + tva : null,
      isCustom: true, mrr: ht ?? 0,
      breakdown: ht != null
        ? [{ label: "Prix négocié (> 50 utilisateurs)", qty: activeUsers, unitPrice: 0, total: ht }]
        : [],
    };
  }

  let ht = 0;
  const breakdown: PricingLine[] = [];

  if (activeUsers >= 1) {
    breakdown.push({ label: "1er utilisateur", qty: 1, unitPrice: 10_000, total: 10_000 });
    ht += 10_000;
  }
  if (activeUsers >= 2) {
    const qty = Math.min(activeUsers, 5) - 1;
    const total = qty * 5_000;
    breakdown.push({ label: "Utilisateurs 2 à 5", qty, unitPrice: 5_000, total });
    ht += total;
  }
  if (activeUsers >= 6) {
    const qty = Math.min(activeUsers, 10) - 5;
    const total = qty * 2_000;
    breakdown.push({ label: "Utilisateurs 6 à 10", qty, unitPrice: 2_000, total });
    ht += total;
  }
  if (activeUsers >= 11) {
    const qty = Math.min(activeUsers, 50) - 10;
    const total = qty * 1_000;
    breakdown.push({ label: "Utilisateurs 11 à 50", qty, unitPrice: 1_000, total });
    ht += total;
  }

  const tva = Math.round(ht * TVA_RATE);
  return { activeUsers, ht, tva, ttc: ht + tva, isCustom: false, mrr: ht, breakdown };
}

/** Retourne le nombre d'utilisateurs actifs facturables par organisation. */
async function fetchActiveUsersPerOrg(): Promise<Map<string, number>> {
  const rows = await db.select({
    orgId: organizationMembersTable.organizationId,
    c: sql<number>`count(${usersTable.id})::int`,
  }).from(organizationMembersTable)
    .innerJoin(usersTable, and(
      eq(usersTable.id, organizationMembersTable.userId),
      eq(usersTable.isActive, true),
    ))
    .groupBy(organizationMembersTable.organizationId);
  return new Map(rows.map((r) => [r.orgId, r.c]));
}

// ─── Overview ────────────────────────────────────────────────────────────────

router.get("/super-admin/overview", sa, async (_req, res, next) => {
  try {
    const [totalOrgs] = await db.select({ c: sql<number>`count(*)::int` })
      .from(organizationsTable).where(ne(organizationsTable.slug, PLATFORM_ORG_SLUG));
    const [activeOrgs] = await db.select({ c: sql<number>`count(*)::int` })
      .from(organizationsTable)
      .where(and(eq(organizationsTable.isActive, true), ne(organizationsTable.slug, PLATFORM_ORG_SLUG)));
    const [totalUsers] = await db.select({ c: sql<number>`count(distinct ${organizationMembersTable.userId})::int` })
      .from(organizationMembersTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, organizationMembersTable.organizationId))
      .where(ne(organizationsTable.slug, PLATFORM_ORG_SLUG));
    const [activeSubs] = await db.select({ c: sql<number>`count(*)::int` })
      .from(organizationSubscriptionsTable)
      .where(and(eq(organizationSubscriptionsTable.isCurrent, true), eq(organizationSubscriptionsTable.status, "active")));

    // Abonnements actifs + prix négocié (unitPrice utilisé pour > 50 utilisateurs)
    const subs = await db.select({
      orgId: organizationSubscriptionsTable.organizationId,
      unitPrice: organizationSubscriptionsTable.unitPrice,
      planCode: subscriptionPlansTable.code,
      planName: subscriptionPlansTable.name,
      status: organizationSubscriptionsTable.status,
    }).from(organizationSubscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(and(eq(organizationSubscriptionsTable.isCurrent, true), eq(organizationSubscriptionsTable.status, "active")));

    const activeUsersMap = await fetchActiveUsersPerOrg();

    let mrrFcfa = 0;
    const byPlan: Record<string, { count: number; seats: number; mrr: number }> = {};
    for (const s of subs) {
      const actUsers = activeUsersMap.get(s.orgId) ?? 0;
      const pricing = calcOrgPrice(actUsers, s.unitPrice);
      mrrFcfa += pricing.mrr;
      const k = s.planCode ?? "UNKNOWN";
      byPlan[k] = byPlan[k] ?? { count: 0, seats: 0, mrr: 0 };
      byPlan[k]!.count++;
      byPlan[k]!.seats += actUsers;
      byPlan[k]!.mrr += pricing.mrr;
    }

    const since30 = new Date(Date.now() - 30 * 86400000);
    const [paid30] = await db.select({ s: sql<number>`coalesce(sum(${billingEventsTable.amount}), 0)::int` })
      .from(billingEventsTable)
      .where(and(eq(billingEventsTable.status, "paid"), gte(billingEventsTable.occurredAt, since30)));

    const [failedPayments] = await db.select({ c: sql<number>`count(*)::int` })
      .from(billingEventsTable).where(eq(billingEventsTable.status, "failed"));
    const [pendingPayments] = await db.select({ c: sql<number>`count(*)::int` })
      .from(billingEventsTable).where(eq(billingEventsTable.status, "pending"));
    const [openTickets] = await db.select({ c: sql<number>`count(*)::int` })
      .from(ticketsTable).where(eq(ticketsTable.status, "open"));
    const [criticalTickets] = await db.select({ c: sql<number>`count(*)::int` })
      .from(ticketsTable).where(and(eq(ticketsTable.priority, "critical"), ne(ticketsTable.status, "resolved")));

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
    const [openTickets] = await db.select({ c: sql<number>`count(*)::int` })
      .from(ticketsTable).where(ne(ticketsTable.status, "resolved"));
    const [criticalTickets] = await db.select({ c: sql<number>`count(*)::int` })
      .from(ticketsTable).where(and(eq(ticketsTable.priority, "critical"), ne(ticketsTable.status, "resolved")));
    const mem = process.memoryUsage();
    const openT = openTickets?.c ?? 0;
    const critT = criticalTickets?.c ?? 0;
    const status = critT > 0 ? "degraded" : openT > 5 ? "warning" : "healthy";
    return res.json({
      status, openTickets: openT, openIncidents: 0, criticalIncidents: critT,
      auditLast24h: 0,
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
    }).from(organizationsTable)
      .where(ne(organizationsTable.slug, PLATFORM_ORG_SLUG))
      .orderBy(desc(organizationsTable.createdAt));

    const subs = await db.select({
      orgId: organizationSubscriptionsTable.organizationId,
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

    // Membres totaux (tous) + actifs facturables
    const memberCounts = await db.select({
      orgId: organizationMembersTable.organizationId, c: sql<number>`count(*)::int`,
    }).from(organizationMembersTable).groupBy(organizationMembersTable.organizationId);
    const memMap = new Map(memberCounts.map((m) => [m.orgId, m.c]));

    const activeUsersMap = await fetchActiveUsersPerOrg();

    const moduleCounts = await db.select({
      orgId: organizationModulesTable.organizationId,
      c: sql<number>`count(*) filter (where ${organizationModulesTable.enabled} = true)::int`,
    }).from(organizationModulesTable).groupBy(organizationModulesTable.organizationId);
    const modMap = new Map(moduleCounts.map((m) => [m.orgId, m.c]));

    const failedBilling = await db.select({
      orgId: billingEventsTable.organizationId, c: sql<number>`count(*)::int`,
    }).from(billingEventsTable)
      .where(eq(billingEventsTable.status, "failed"))
      .groupBy(billingEventsTable.organizationId);
    const failedMap = new Map(failedBilling.map((f) => [f.orgId, f.c]));

    const ticketCounts = await db.select({
      orgId: ticketsTable.organizationId, c: sql<number>`count(*)::int`,
    }).from(ticketsTable)
      .where(ne(ticketsTable.status, "resolved"))
      .groupBy(ticketsTable.organizationId);
    const ticketMap = new Map(ticketCounts.map((t) => [t.orgId, t.c]));

    const rows = orgs.map((o) => {
      const sub = subByOrg.get(o.id);
      const activeUsers = activeUsersMap.get(o.id) ?? 0;
      const memberCount = memMap.get(o.id) ?? 0;
      const pricing = calcOrgPrice(activeUsers, sub?.unitPrice);
      const failedCount = failedMap.get(o.id) ?? 0;
      const openTicketCount = ticketMap.get(o.id) ?? 0;

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
        billingCycle: sub?.cycle ?? null, status: sub?.status ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        // Utilisateurs
        memberCount, activeUsers,
        // Tarification officielle (calculée)
        priceHt: pricing.ht, priceTva: pricing.tva, priceTtc: pricing.ttc,
        isCustomPricing: pricing.isCustom,
        mrr: pricing.mrr,  // agrégat interne (ht ?? 0)
        // Santé
        enabledModules: modMap.get(o.id) ?? 0,
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
      .where(and(
        eq(organizationSubscriptionsTable.organizationId, id),
        eq(organizationSubscriptionsTable.isCurrent, true),
      ))
      .limit(1);

    const [memberCount] = await db.select({ c: sql<number>`count(*)::int` })
      .from(organizationMembersTable).where(eq(organizationMembersTable.organizationId, id));
    const [activeUserCount] = await db.select({ c: sql<number>`count(${usersTable.id})::int` })
      .from(organizationMembersTable)
      .innerJoin(usersTable, and(
        eq(usersTable.id, organizationMembersTable.userId),
        eq(usersTable.isActive, true),
      ))
      .where(eq(organizationMembersTable.organizationId, id));
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

    const activeUsers = activeUserCount?.c ?? 0;
    const pricing = calcOrgPrice(activeUsers, sub?.unitPrice);

    return res.json({
      org,
      subscription: sub ?? null,
      mrr: pricing.mrr,
      pricing,
      metrics: {
        memberCount: memberCount?.c ?? 0,
        activeUsers,
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
    const subs = await db.select({
      orgId: organizationSubscriptionsTable.organizationId,
      orgName: organizationsTable.name,
      unitPrice: organizationSubscriptionsTable.unitPrice,
      status: organizationSubscriptionsTable.status,
      planCode: subscriptionPlansTable.code,
    }).from(organizationSubscriptionsTable)
      .leftJoin(organizationsTable, eq(organizationsTable.id, organizationSubscriptionsTable.organizationId))
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(eq(organizationSubscriptionsTable.isCurrent, true));

    const activeUsersMap = await fetchActiveUsersPerOrg();

    const byOrg = subs.map((s) => {
      const actUsers = activeUsersMap.get(s.orgId) ?? 0;
      const pricing = calcOrgPrice(actUsers, s.unitPrice);
      return {
        orgId: s.orgId, orgName: s.orgName ?? "—",
        planCode: s.planCode ?? "—",
        activeUsers: actUsers,
        priceHt: pricing.ht, priceTtc: pricing.ttc,
        isCustomPricing: pricing.isCustom,
        mrr: pricing.mrr,
        status: s.status,
      };
    }).sort((a, b) => b.mrr - a.mrr);

    const since12 = new Date();
    since12.setMonth(since12.getMonth() - 11);
    since12.setDate(1); since12.setHours(0, 0, 0, 0);

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

// ─── Custom price (organisations > 50 utilisateurs) ──────────────────────────

router.patch("/super-admin/organizations/:id/custom-price", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { monthlyHt } = req.body as { monthlyHt?: unknown };
    if (typeof monthlyHt !== "number" || monthlyHt < 0) {
      return res.status(400).json({ error: "monthlyHt doit être un nombre positif (FCFA HT / mois)" });
    }

    const [org] = await db.select({ id: organizationsTable.id, name: organizationsTable.name })
      .from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });

    await db.update(organizationSubscriptionsTable)
      .set({ unitPrice: monthlyHt, updatedAt: new Date() })
      .where(and(
        eq(organizationSubscriptionsTable.organizationId, id),
        eq(organizationSubscriptionsTable.isCurrent, true),
      ));

    req.log.warn(
      { userId: req.authUser?.id, organizationId: id, monthlyHt },
      "custom-price: prix négocié défini par le super-admin",
    );
    return res.json({ ok: true, organizationId: id, monthlyHt });
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

    const confirm = (req.body as { confirm?: unknown } | undefined)?.confirm;
    if (typeof confirm !== "string" || confirm.trim() !== org.name) {
      return res.status(400).json({
        error: `Confirmation invalide. Saisissez exactement le nom de l'organisation « ${org.name} » pour confirmer la suppression.`,
      });
    }

    req.log.warn(
      { userId: req.authUser?.id, email: req.authUser?.email, organizationId: id, organizationName: org.name },
      "suppression définitive d'une organisation déclenchée par un super-admin",
    );

    const report = await deleteOrganization(id);
    return res.json({ ok: true, deleted: id, name: org.name, ...report });
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

// ─── Réinitialisation usine ────────────────────────────────────────────────────

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
