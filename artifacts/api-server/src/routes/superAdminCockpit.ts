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
  ticketsTable, cockpitAuditLogsTable, authSessionsTable,
  addonCatalogTable, orgAddonsTable, orgAttendanceSettingsTable,
} from "@workspace/db";
import { SECTOR_TEMPLATES } from "./attendance";
import { and, eq, sql, desc, gte, ne, inArray, isNull } from "drizzle-orm";
import type { RequestHandler } from "express";
import { PLATFORM_ORG_SLUG } from "../services/ensure-admin";
import { factoryReset } from "../services/factory-reset";
import { seedHissado } from "../services/seed-hissado";
import { deleteOrganization } from "../services/delete-organization";
import { randomBytes } from "node:crypto";
import { seedAccountingFrameworkForOrg, getFrameworkForOrgType, ORG_TYPE_LABELS, FRAMEWORK_LABELS, FRAMEWORK_DESCRIPTIONS, type AccountingFramework } from "../services/accounting-framework";
import bcrypt from "bcryptjs";
import { sendEmail, buildActivationEmail } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";
import { calcPlanPricing, getPlan } from "../lib/pricing";

const router: IRouter = Router();

function baseUrl(): string {
  return getPublicBaseUrl();
}

const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") {
    res.status(403).json({ error: "Accès réservé aux super-administrateurs" });
    return;
  }
  next();
};

// ─── Politique tarifaire Gameasu ─────────────────────────────────────────────
//
//  Tarification plan-based (TTC / util / mois, TVA 18% incluse) :
//    Starter       → 4 000 FCFA TTC
//    Business      → 7 000 FCFA TTC  ★ Populaire
//    Premium       → 10 000 FCFA TTC ✦ Complet
//    Personnalisée → Sur devis (prix négocié HT stocké dans unitPrice)
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
  ht: number | null;
  tva: number | null;
  ttc: number | null;
  isCustom: boolean;
  mrr: number;
  breakdown: PricingLine[];
}

/**
 * Calcule le prix mensuel HT/TVA/TTC pour une organisation selon le plan actif.
 *
 * @param activeUsers   Nombre d'utilisateurs actifs facturables.
 * @param planCode      Code du plan souscrit (STARTER / BUSINESS / PREMIUM / ENTERPRISE).
 * @param negotiatedHt  Prix HT négocié — utilisé uniquement pour ENTERPRISE.
 */
function calcOrgPrice(activeUsers: number, planCode?: string | null, negotiatedHt?: number | null): PriceResult {
  // Personnalisée (Enterprise) ou plan inconnu → prix négocié
  if (!planCode || planCode === "ENTERPRISE") {
    const ht  = negotiatedHt != null && negotiatedHt > 0 ? negotiatedHt : null;
    const tva = ht != null ? Math.round(ht * TVA_RATE) : null;
    return {
      activeUsers, ht, tva, ttc: ht != null && tva != null ? ht + tva : null,
      isCustom: true, mrr: ht ?? 0,
      breakdown: ht != null
        ? [{ label: "Prix négocié (Personnalisée)", qty: activeUsers, unitPrice: 0, total: ht }]
        : [],
    };
  }

  // Plan standard → prix catalogue TTC → décomposer en HT + TVA
  const result = calcPlanPricing({ planCode, seats: Math.max(activeUsers, 1) });
  if (!result) {
    return { activeUsers, ht: null, tva: null, ttc: null, isCustom: true, mrr: 0, breakdown: [] };
  }

  const plan = getPlan(planCode);
  const planLabel = plan?.name ?? planCode;

  return {
    activeUsers,
    ht:  result.totalHT,
    tva: result.tva,
    ttc: result.totalTTC,
    isCustom: false,
    mrr: result.totalHT,
    breakdown: [{
      label:     `${planLabel} — ${Math.max(activeUsers, 1)} utilisateur${activeUsers > 1 ? "s" : ""}`,
      qty:       Math.max(activeUsers, 1),
      unitPrice: result.priceHTPerSeat,
      total:     result.totalHT,
    }],
  };
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
      const pricing = calcOrgPrice(actUsers, s.planCode, s.unitPrice);
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
      const pricing = calcOrgPrice(activeUsers, sub?.planCode, sub?.unitPrice);
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
    const pricing = calcOrgPrice(activeUsers, sub?.planCode, sub?.unitPrice);

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

// ─── Cockpit audit helper ─────────────────────────────────────────────────────

async function cockpitAudit(
  actorId: string, actorEmail: string,
  action: string, resource: string, resourceId?: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(cockpitAuditLogsTable).values({
    actorId, actorEmail, action, resource, resourceId: resourceId ?? null,
    metadata: meta ?? null,
  });
}

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
      phone: usersTable.phone,
      userRole: usersTable.role,
      isActive: usersTable.isActive,
      lastLoginAt: usersTable.lastLoginAt,
      mustChangePassword: usersTable.mustChangePassword,
      hasResetToken: sql<boolean>`(${usersTable.passwordResetToken} is not null)`,
      invitedAt: usersTable.invitedAt,
    }).from(organizationMembersTable)
      .leftJoin(usersTable, eq(usersTable.id, organizationMembersTable.userId))
      .where(eq(organizationMembersTable.organizationId, id))
      .orderBy(desc(organizationMembersTable.joinedAt));

    return res.json({ count: members.length, rows: members });
  } catch (e) { next(e); }
});

// ─── Create user in org ───────────────────────────────────────────────────────

router.post("/super-admin/organizations/:id/users", sa, async (req, res, next) => {
  try {
    const { id: orgId } = req.params as Record<string, string>;
    const { firstName, lastName, email, phone, role = "member" } = req.body as Record<string, string>;
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "Prénom, nom et email sont obligatoires" });
    }
    const emailLc = email.trim().toLowerCase();

    // Check org exists
    const [org] = await db.select({ id: organizationsTable.id, name: organizationsTable.name })
      .from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });

    // Check email not already used
    const [existing] = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.email, emailLc)).limit(1);
    if (existing) {
      // Check if already in this org
      const [inOrg] = await db.select({ id: organizationMembersTable.userId })
        .from(organizationMembersTable)
        .where(and(
          eq(organizationMembersTable.organizationId, orgId),
          eq(organizationMembersTable.userId, existing.id),
        )).limit(1);
      if (inOrg) return res.status(409).json({ error: "Cet utilisateur est déjà membre de l'organisation" });
      // Add existing user to org
      await db.insert(organizationMembersTable).values({ organizationId: orgId, userId: existing.id, role });
      await cockpitAudit(req.authUser!.id, req.authUser!.email, "org_user.add_existing", "user", existing.id, {
        orgId, orgName: org.name, email: emailLc, role,
      });
      const [u] = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, existing.id)).limit(1);
      return res.status(201).json(u);
    }

    // Create new user with invite token
    const unusablePassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    const inviteToken = randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [newUser] = await db.insert(usersTable).values({
      email: emailLc, firstName, lastName,
      password: unusablePassword,
      phone: phone ?? null,
      role: "collaborator",
      organizationId: orgId,
      isActive: true,
      mustChangePassword: true,
      passwordResetToken: inviteToken,
      passwordResetTokenExpiresAt: inviteExpiresAt,
      invitedAt: new Date(),
      invitedById: req.authUser!.id,
    }).returning({ id: usersTable.id, email: usersTable.email });

    await db.insert(organizationMembersTable).values({
      organizationId: orgId, userId: newUser.id, role,
    });

    const acceptUrl = `${baseUrl()}/accept-invitation?token=${inviteToken}`;
    await sendEmail({
      to: emailLc,
      subject: `Invitation à rejoindre ${org.name} sur Gameasu`,
      html: `<p>Bonjour ${firstName},</p><p>Vous avez été invité(e) à rejoindre <strong>${org.name}</strong> sur la plateforme Gameasu.</p><p>Cliquez sur le lien ci-dessous pour activer votre compte :</p><p><a href="${acceptUrl}">${acceptUrl}</a></p><p>Ce lien expire dans 7 jours.</p>`,
      text: `Bonjour ${firstName},\n\nVous avez été invité(e) à rejoindre ${org.name} sur Gameasu.\n\nActivez votre compte : ${acceptUrl}\n\nCe lien expire dans 7 jours.`,
    });

    await cockpitAudit(req.authUser!.id, req.authUser!.email, "org_user.create", "user", newUser.id, {
      orgId, orgName: org.name, email: emailLc, role,
    });
    return res.status(201).json({ id: newUser.id, email: newUser.email, acceptUrl });
  } catch (e) { next(e); }
});

// ─── Update user in org ───────────────────────────────────────────────────────

router.patch("/super-admin/organizations/:orgId/users/:userId", sa, async (req, res, next) => {
  try {
    const { orgId, userId } = req.params as Record<string, string>;
    const { firstName, lastName, email, phone, role } = req.body as Record<string, string>;

    const [before] = await db.select({
      firstName: usersTable.firstName, lastName: usersTable.lastName,
      email: usersTable.email, role: usersTable.role, isActive: usersTable.isActive,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!before) return res.status(404).json({ error: "Utilisateur introuvable" });

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (email) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone || null;

    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
    }
    if (role) {
      await db.update(organizationMembersTable)
        .set({ role })
        .where(and(eq(organizationMembersTable.organizationId, orgId), eq(organizationMembersTable.userId, userId)));
    }

    await cockpitAudit(req.authUser!.id, req.authUser!.email, "org_user.update", "user", userId, {
      orgId, changes: { ...updates, ...(role ? { role } : {}) },
    });
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── Activate / deactivate user ───────────────────────────────────────────────

router.post("/super-admin/organizations/:orgId/users/:userId/activate", sa, async (req, res, next) => {
  try {
    const { orgId, userId } = req.params as Record<string, string>;
    await db.update(usersTable).set({ isActive: true }).where(eq(usersTable.id, userId));
    await cockpitAudit(req.authUser!.id, req.authUser!.email, "org_user.activate", "user", userId, { orgId });
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post("/super-admin/organizations/:orgId/users/:userId/deactivate", sa, async (req, res, next) => {
  try {
    const { orgId, userId } = req.params as Record<string, string>;
    await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, userId));
    await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, userId));
    await cockpitAudit(req.authUser!.id, req.authUser!.email, "org_user.deactivate", "user", userId, { orgId });
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── Reset password ───────────────────────────────────────────────────────────

router.post("/super-admin/organizations/:orgId/users/:userId/reset-password", sa, async (req, res, next) => {
  try {
    const { orgId, userId } = req.params as Record<string, string>;
    const [user] = await db.select({ email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(usersTable).set({
      passwordResetToken: token,
      passwordResetTokenExpiresAt: expiresAt,
      mustChangePassword: true,
    }).where(eq(usersTable.id, userId));

    const resetUrl = `${baseUrl()}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "Réinitialisation de votre mot de passe Gameasu",
      html: `<p>Bonjour ${user.firstName},</p><p>Un administrateur a demandé la réinitialisation de votre mot de passe sur Gameasu.</p><p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Ce lien expire dans 24 heures.</p>`,
      text: `Bonjour ${user.firstName},\n\nRéinitialisez votre mot de passe : ${resetUrl}\n\nCe lien expire dans 24 heures.`,
    });

    await cockpitAudit(req.authUser!.id, req.authUser!.email, "org_user.reset_password", "user", userId, { orgId, email: user.email });
    return res.json({ ok: true, resetUrl });
  } catch (e) { next(e); }
});

// ─── Resend invitation ────────────────────────────────────────────────────────

router.post("/super-admin/organizations/:orgId/users/:userId/resend-invite", sa, async (req, res, next) => {
  try {
    const { orgId, userId } = req.params as Record<string, string>;
    const [user] = await db.select({
      email: usersTable.email, firstName: usersTable.firstName,
      organizationId: usersTable.organizationId,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const [org] = await db.select({ name: organizationsTable.name })
      .from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.update(usersTable).set({
      passwordResetToken: token,
      passwordResetTokenExpiresAt: expiresAt,
      mustChangePassword: true,
      invitedAt: new Date(),
      invitedById: req.authUser!.id,
    }).where(eq(usersTable.id, userId));

    const acceptUrl = `${baseUrl()}/accept-invitation?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: `Invitation à rejoindre ${org?.name ?? "votre organisation"} sur Gameasu`,
      html: `<p>Bonjour ${user.firstName},</p><p>Votre invitation à rejoindre <strong>${org?.name ?? "votre organisation"}</strong> sur Gameasu a été renouvelée.</p><p><a href="${acceptUrl}">${acceptUrl}</a></p><p>Ce lien expire dans 7 jours.</p>`,
      text: `Bonjour ${user.firstName},\n\nActivez votre compte : ${acceptUrl}\n\nCe lien expire dans 7 jours.`,
    });

    await cockpitAudit(req.authUser!.id, req.authUser!.email, "org_user.resend_invite", "user", userId, { orgId, email: user.email });
    return res.json({ ok: true, acceptUrl });
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
      const pricing = calcOrgPrice(actUsers, s.planCode, s.unitPrice);
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

// ─── Add-on pricing per tenant ───────────────────────────────────────────────

/**
 * GET /super-admin/organizations/:id/addon-pricing
 * Retourne le catalogue des add-ons avec le prix custom de l'org (null = prix catalogue)
 */
router.get("/super-admin/organizations/:id/addon-pricing", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const [org] = await db.select({ id: organizationsTable.id })
      .from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });

    const catalog = await db.select().from(addonCatalogTable)
      .where(eq(addonCatalogTable.isActive, true))
      .orderBy(addonCatalogTable.sortOrder);

    const orgAddons = await db.select().from(orgAddonsTable)
      .where(eq(orgAddonsTable.organizationId, id));

    const overrideMap = new Map(orgAddons.map((a) => [a.addonId, a.customPriceHT]));

    const result = catalog.map((addon) => ({
      id:             addon.id,
      slug:           addon.slug,
      name:           addon.name,
      category:       addon.category,
      billingType:    addon.billingType,
      unit:           addon.unit,
      catalogPriceHT: addon.priceHT,
      customPriceHT:  overrideMap.has(addon.id) ? overrideMap.get(addon.id) ?? null : null,
      effectivePriceHT: overrideMap.has(addon.id) && overrideMap.get(addon.id) != null
        ? overrideMap.get(addon.id)!
        : addon.priceHT,
    }));

    return res.json({ data: result });
  } catch (e) { next(e); }
});

/**
 * PUT /super-admin/organizations/:id/addon-pricing
 * Body: { prices: [{ addonId, customPriceHT: number | null }] }
 * customPriceHT = null → réinitialise au prix catalogue
 */
router.put("/super-admin/organizations/:id/addon-pricing", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { prices } = req.body as { prices: Array<{ addonId: string; customPriceHT: number | null }> };

    if (!Array.isArray(prices)) {
      return res.status(400).json({ error: "prices doit être un tableau" });
    }

    const [org] = await db.select({ id: organizationsTable.id, name: organizationsTable.name })
      .from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });

    for (const item of prices) {
      if (typeof item.addonId !== "string") continue;
      if (item.customPriceHT !== null && (typeof item.customPriceHT !== "number" || item.customPriceHT < 0)) continue;

      // Upsert: create orgAddon row if missing (status=inactive, just to store custom price)
      const existing = await db.select({ id: orgAddonsTable.id })
        .from(orgAddonsTable)
        .where(and(eq(orgAddonsTable.organizationId, id), eq(orgAddonsTable.addonId, item.addonId)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(orgAddonsTable)
          .set({ customPriceHT: item.customPriceHT, updatedAt: new Date() })
          .where(eq(orgAddonsTable.id, existing[0].id));
      } else {
        await db.insert(orgAddonsTable).values({
          organizationId:  id,
          addonId:         item.addonId,
          status:          "inactive",
          customPriceHT:   item.customPriceHT,
          usageUsed:       0,
          creditsPurchased: 0,
        });
      }
    }

    req.log.info({ userId: req.authUser?.id, orgId: id, count: prices.length }, "addon-pricing: prix personnalisés mis à jour");
    return res.json({ ok: true });
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

// ─── Seed données Hissado Consulting ──────────────────────────────────────────

router.post("/super-admin/seed-hissado", sa, async (req, res, next) => {
  try {
    req.log.info({ userId: req.authUser?.id }, "seed-hissado: démarrage seed démo Hissado");
    const orgId = (req.body as any)?.orgId as string | undefined;
    const result = await seedHissado(orgId);
    req.log.info({ counts: (result as any).counts }, "seed-hissado: terminé");
    return res.json(result);
  } catch (e) { next(e); }
});

// ── Settings de pointage par organisation ────────────────────────────────────
router.get("/super-admin/organizations/:id/attendance-settings", sa, async (req, res, next) => {
  try {
    const orgId = req.params.id as string;
    const [s] = await db.select().from(orgAttendanceSettingsTable)
      .where(eq(orgAttendanceSettingsTable.organizationId, orgId)).limit(1);
    const sector = s?.sector ?? "consulting";
    const template = SECTOR_TEMPLATES.find(t => t.sector === sector) ?? SECTOR_TEMPLATES[4]!;
    res.json({ settings: s ?? null, sector, sectorLabel: template.label, sectorIcon: template.icon });
  } catch (e) { next(e); }
});

const VALID_SECTORS = ["btp", "logistique", "commerce", "sante", "consulting", "industrie", "ong", "education"] as const;
router.put("/super-admin/organizations/:id/attendance-settings", sa, async (req, res, next) => {
  try {
    const orgId = req.params.id as string;
    const raw = req.body as {
      sector?: string; expectedDailyMinutes?: number; lateThresholdMinutes?: number;
      requireGps?: boolean; requirePhoto?: boolean;
      trackByProject?: boolean; trackBySite?: boolean; allowOvertime?: boolean;
    };
    if (raw.sector && !VALID_SECTORS.includes(raw.sector as typeof VALID_SECTORS[number])) {
      return res.status(400).json({ error: `Secteur invalide. Valeurs acceptées: ${VALID_SECTORS.join(", ")}` });
    }
    // Appliquer les valeurs du template de secteur comme defaults (les champs fournis dans raw écrasent)
    let templateDefaults: Partial<typeof raw> = {};
    if (raw.sector) {
      const tpl = SECTOR_TEMPLATES.find(t => t.sector === raw.sector);
      if (tpl) {
        templateDefaults = {
          expectedDailyMinutes: tpl.expectedDailyMinutes,
          lateThresholdMinutes: tpl.lateThresholdMinutes,
          requireGps: tpl.requireGps,
          requirePhoto: tpl.requirePhoto,
          trackByProject: tpl.trackByProject,
          trackBySite: tpl.trackBySite,
          allowOvertime: tpl.allowOvertime,
        };
      }
    }
    const body = { ...templateDefaults, ...raw };
    const [result] = await db.insert(orgAttendanceSettingsTable)
      .values({ organizationId: orgId, ...body })
      .onConflictDoUpdate({
        target: orgAttendanceSettingsTable.organizationId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning();
    const sector = result?.sector ?? "consulting";
    const template = SECTOR_TEMPLATES.find(t => t.sector === sector) ?? SECTOR_TEMPLATES[4]!;
    res.json({ settings: result, sector, sectorLabel: template.label, sectorIcon: template.icon });
  } catch (e) { next(e); }
});

// ─── Référentiel comptable par organisation ────────────────────────────────────

const VALID_ORG_TYPES = ["enterprise", "tpe", "association", "bank", "microfinance", "insurance", "social_protection", "government"] as const;

router.get("/super-admin/organizations/:id/accounting-framework", sa, async (req, res, next) => {
  try {
    const orgId = req.params.id as string;
    const [org] = await db
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        orgType: organizationsTable.orgType,
        accountingFramework: organizationsTable.accountingFramework,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });

    const framework = (org.accountingFramework ?? "SYSCOHADA") as AccountingFramework;
    const orgType = org.orgType ?? "enterprise";

    return res.json({
      orgType,
      orgTypeLabel: ORG_TYPE_LABELS[orgType as keyof typeof ORG_TYPE_LABELS] ?? orgType,
      accountingFramework: framework,
      frameworkLabel: FRAMEWORK_LABELS[framework] ?? framework,
      frameworkDescription: FRAMEWORK_DESCRIPTIONS[framework] ?? "",
    });
  } catch (e) { next(e); }
});

router.patch("/super-admin/organizations/:id/accounting-framework", sa, async (req, res, next) => {
  try {
    const orgId = req.params.id as string;
    const { orgType } = req.body ?? {};

    if (!orgType || !VALID_ORG_TYPES.includes(orgType)) {
      return res.status(400).json({
        error: `Type d'organisation invalide. Valeurs acceptées : ${VALID_ORG_TYPES.join(", ")}`,
      });
    }

    const framework = getFrameworkForOrgType(orgType) as AccountingFramework;

    const [updated] = await db
      .update(organizationsTable)
      .set({ orgType, accountingFramework: framework, updatedAt: new Date() })
      .where(eq(organizationsTable.id, orgId))
      .returning({ id: organizationsTable.id, orgType: organizationsTable.orgType, accountingFramework: organizationsTable.accountingFramework });

    if (!updated) return res.status(404).json({ error: "Organisation introuvable" });

    // Re-seed le plan comptable si nécessaire (idempotent — n'écrase pas les comptes existants)
    seedAccountingFrameworkForOrg(orgId, framework).catch((e) => {
      req.log.warn({ err: e, orgId, framework }, "accounting-framework re-seed failed");
    });

    return res.json({
      orgType: updated.orgType,
      orgTypeLabel: ORG_TYPE_LABELS[orgType as keyof typeof ORG_TYPE_LABELS] ?? orgType,
      accountingFramework: updated.accountingFramework,
      frameworkLabel: FRAMEWORK_LABELS[framework] ?? framework,
      frameworkDescription: FRAMEWORK_DESCRIPTIONS[framework] ?? "",
    });
  } catch (e) { next(e); }
});

// ─── Réinitialisation usine ────────────────────────────────────────────────────

const FACTORY_RESET_CONFIRM = "RÉINITIALISER GAMEASU";

// ── POST /super-admin/subscriptions/:id/activate-manually ─────────────────
// Activation manuelle d'un abonnement pending_payment (paiement hors-ligne
// reçu par le super-admin : virement, espèces, chèque…)
router.post("/super-admin/subscriptions/:id/activate-manually", sa, async (req, res, next) => {
  try {
    const subId = req.params["id"] as string;
    const notes = String((req.body as any)?.notes ?? "").slice(0, 500);

    const [sub] = await db
      .select()
      .from(organizationSubscriptionsTable)
      .where(eq(organizationSubscriptionsTable.id, subId))
      .limit(1);

    if (!sub) {
      res.status(404).json({ error: "Abonnement introuvable." });
      return;
    }
    if (sub.status !== "pending_payment") {
      res.status(409).json({ error: `L'abonnement est déjà en statut « ${sub.status} ».` });
      return;
    }

    const [org] = await db
      .select({ name: organizationsTable.name, contactEmail: organizationsTable.contactEmail })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, sub.organizationId))
      .limit(1);

    const [adminUser] = await db
      .select({ firstName: usersTable.firstName })
      .from(usersTable)
      .where(and(
        eq(usersTable.organizationId, sub.organizationId),
        eq(usersTable.isActive, true),
      ))
      .limit(1);

    const now = new Date();
    const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
    const months = MONTHS[(sub.billingCycle as string) ?? "monthly"] ?? 1;
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + months);

    // Mettre à jour l'abonnement
    await db.update(organizationSubscriptionsTable).set({
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    }).where(eq(organizationSubscriptionsTable.id, subId));

    // Activer l'organisation (isActive: false à la création, true après paiement)
    await db.update(organizationsTable).set({ isActive: true })
      .where(eq(organizationsTable.id, sub.organizationId));

    // Activer les modules inclus dans le plan
    let planName: string | null = null;
    if (sub.planId) {
      const [planData] = await db
        .select({ includedModules: subscriptionPlansTable.includedModules, name: subscriptionPlansTable.name })
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, sub.planId))
        .limit(1);
      planName = planData?.name ?? null;
      const modules = (planData?.includedModules ?? []) as string[];
      if (modules.length > 0) {
        await db
          .insert(organizationModulesTable)
          .values(modules.map((k) => ({
            organizationId: sub.organizationId,
            moduleKey: k, enabled: true, source: "plan" as const,
          })))
          .onConflictDoUpdate({
            target: [organizationModulesTable.organizationId, organizationModulesTable.moduleKey],
            set: { enabled: true, source: "plan" as const },
          });
      }
    }

    // Créer un événement de facturation « activation manuelle »
    // Le montant couvre l'intégralité du cycle de facturation (mensuel/trimestriel/semestriel/annuel),
    // pas seulement un mois — sinon les cycles > mensuel sont sous-évalués.
    const cycleAmount = sub.unitPrice * sub.seats * months;
    await db.insert(billingEventsTable).values({
      organizationId: sub.organizationId,
      subscriptionId: subId,
      kind: "payment",
      label: `Activation manuelle par super-admin${notes ? ` — ${notes}` : ""}`,
      amount: cycleAmount,
      currency: "XOF",
      status: "paid",
    });

    await cockpitAudit(
      req.authUser!.id, req.authUser!.email,
      "subscription.activate_manual", "subscription", subId,
      { orgId: sub.organizationId, notes },
    );

    // Envoyer l'e-mail de confirmation d'activation (même chemin que CinetPay / confirmation manuelle)
    if (org?.contactEmail) {
      try {
        const activationEmail = buildActivationEmail({
          firstName: adminUser?.firstName ?? org.name,
          orgName: org.name,
          planName: planName ?? "Gameasu",
          periodEnd,
          loginUrl: baseUrl(),
        });
        await sendEmail({ ...activationEmail, to: org.contactEmail });
      } catch (emailErr) {
        req.log.error({ err: emailErr, subId }, "Échec d'envoi de l'e-mail d'activation manuelle");
      }
    }

    res.json({ ok: true, subscriptionId: subId, newStatus: "active" });
  } catch (e) { next(e); }
});

// ── GET /super-admin/addon-quote-requests ─────────────────────────────────────
// Liste tous les add-ons en statut pending_quote (demandes de devis en attente)
router.get("/super-admin/addon-quote-requests", sa, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id:             orgAddonsTable.id,
        organizationId: orgAddonsTable.organizationId,
        orgName:        organizationsTable.name,
        orgSlug:        organizationsTable.slug,
        orgEmail:       organizationsTable.contactEmail,
        addonId:        orgAddonsTable.addonId,
        addonSlug:      addonCatalogTable.slug,
        addonName:      addonCatalogTable.name,
        addonCategory:  addonCatalogTable.category,
        status:         orgAddonsTable.status,
        notes:          orgAddonsTable.notes,
        createdAt:      orgAddonsTable.createdAt,
        updatedAt:      orgAddonsTable.updatedAt,
      })
      .from(orgAddonsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, orgAddonsTable.organizationId))
      .innerJoin(addonCatalogTable, eq(addonCatalogTable.id, orgAddonsTable.addonId))
      .where(eq(orgAddonsTable.status, "pending_quote"))
      .orderBy(desc(orgAddonsTable.createdAt));

    return res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

// ── POST /super-admin/addon-quote-requests/:id/activate ───────────────────────
// Active un add-on en attente de devis + déverrouille le module dans l'org
router.post("/super-admin/addon-quote-requests/:id/activate", sa, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { notes } = req.body as { notes?: string };

    // Charger la ligne
    const [row] = await db
      .select({
        id:             orgAddonsTable.id,
        organizationId: orgAddonsTable.organizationId,
        addonId:        orgAddonsTable.addonId,
        status:         orgAddonsTable.status,
        addonSlug:      addonCatalogTable.slug,
        addonName:      addonCatalogTable.name,
        orgName:        organizationsTable.name,
      })
      .from(orgAddonsTable)
      .innerJoin(addonCatalogTable, eq(addonCatalogTable.id, orgAddonsTable.addonId))
      .innerJoin(organizationsTable, eq(organizationsTable.id, orgAddonsTable.organizationId))
      .where(eq(orgAddonsTable.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Demande introuvable" });
    if (row.status !== "pending_quote") {
      return res.status(400).json({ error: "Cette demande n'est pas en statut pending_quote" });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      // 1. Activer l'add-on
      await tx
        .update(orgAddonsTable)
        .set({ status: "active", activatedAt: now, notes: notes ?? row.addonName, updatedAt: now })
        .where(eq(orgAddonsTable.id, id));

      // 2. Déverrouiller le module dans organization_modules (upsert)
      await tx
        .insert(organizationModulesTable)
        .values({
          organizationId: row.organizationId,
          moduleKey:      row.addonSlug,
          enabled:        true,
          source:         "addon",
          enabledAt:      now,
        })
        .onConflictDoUpdate({
          target: [organizationModulesTable.organizationId, organizationModulesTable.moduleKey],
          set: { enabled: true, source: "addon", updatedAt: now },
        });
    });

    return res.json({ ok: true, addonSlug: row.addonSlug, orgName: row.orgName });
  } catch (e) { next(e); }
});

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
