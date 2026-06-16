import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  subscriptionPlansTable, subscriptionPlanFeaturesTable,
  organizationSubscriptionsTable, organizationModulesTable, billingEventsTable,
  organizationMembersTable, organizationsTable,
} from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { getCurrentOrganizationId, getCurrentSubscription } from "../lib/tenant";
import { requireAdmin } from "../middlewares/auth";
import { calcPricing } from "../lib/pricing";

const router: IRouter = Router();

// ── Plans publics
router.get("/subscription-plans", async (_req, res) => {
  const plans = await db.select().from(subscriptionPlansTable).orderBy(subscriptionPlansTable.sortOrder);
  const features = await db.select().from(subscriptionPlanFeaturesTable).orderBy(subscriptionPlanFeaturesTable.sortOrder);
  res.json(plans.map((p) => ({
    ...p,
    features: features.filter((f) => f.planId === p.id),
  })));
});

router.get("/subscription-plans/:code", async (req, res) => {
  const [plan] = await db.select().from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.code, (req.params.code as string).toUpperCase())).limit(1);
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });
  const features = await db.select().from(subscriptionPlanFeaturesTable)
    .where(eq(subscriptionPlanFeaturesTable.planId, plan.id))
    .orderBy(subscriptionPlanFeaturesTable.sortOrder);
  res.json({ ...plan, features });
});

// ── Abonnement courant
router.get("/subscriptions/current", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const current = await getCurrentSubscription(orgId);
  if (!current) return res.status(404).json({ error: "Aucun abonnement actif" });
  res.json({
    subscription: current.sub,
    plan: current.plan,
  });
});

router.patch("/subscriptions/current", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const patch = req.body ?? {};
  const allowed: Record<string, unknown> = {};
  for (const k of ["seats", "notes", "status"]) {
    if (k in patch) allowed[k] = patch[k];
  }
  const [updated] = await db.update(organizationSubscriptionsTable)
    .set(allowed)
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ))
    .returning();
  res.json(updated);
});

router.post("/subscriptions/change-plan", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const { planCode } = req.body ?? {};
  if (!planCode) return res.status(400).json({ error: "planCode requis" });
  const [plan] = await db.select().from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.code, String(planCode).toUpperCase())).limit(1);
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });

  const current = await getCurrentSubscription(orgId);
  const cycle = current?.sub.billingCycle ?? "monthly";
  const unitPrice = cycle === "annual" ? plan.annualPricePerSeat : plan.monthlyPricePerSeat;

  // Marquer l'ancien comme non-courant
  await db.update(organizationSubscriptionsTable)
    .set({ isCurrent: false })
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ));

  const now = new Date();
  const end = new Date(now);
  if (cycle === "annual") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  const [newSub] = await db.insert(organizationSubscriptionsTable).values({
    organizationId: orgId,
    planId: plan.id,
    status: "active",
    billingCycle: cycle,
    seats: current?.sub.seats ?? plan.includedSeats,
    currentPeriodStart: now,
    currentPeriodEnd: end,
    unitPrice,
    setupFee: 0,
    currency: plan.currency,
    isCurrent: true,
  }).returning();

  // Recalcule des modules
  const included = new Set(plan.includedModules ?? []);
  const orgMods = await db.select().from(organizationModulesTable)
    .where(eq(organizationModulesTable.organizationId, orgId));
  for (const mod of orgMods) {
    if (mod.source !== "manual") {
      await db.update(organizationModulesTable)
        .set({ enabled: included.has(mod.moduleKey), source: "plan" })
        .where(eq(organizationModulesTable.id, mod.id));
    }
  }

  await db.insert(billingEventsTable).values({
    organizationId: orgId,
    subscriptionId: newSub.id,
    kind: "plan_change",
    label: `Changement de formule → ${plan.name}`,
    amount: 0,
    status: "paid",
    currency: plan.currency,
    reference: `NX-PLAN-${Date.now()}`,
  });

  res.json({ subscription: newSub, plan });
});

router.post("/subscriptions/change-billing-cycle", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const { cycle } = req.body ?? {};
  if (cycle !== "monthly" && cycle !== "annual") {
    return res.status(400).json({ error: "cycle doit être 'monthly' ou 'annual'" });
  }
  const current = await getCurrentSubscription(orgId);
  if (!current) return res.status(404).json({ error: "Aucun abonnement actif" });
  const unitPrice = cycle === "annual" ? current.plan.annualPricePerSeat : current.plan.monthlyPricePerSeat;

  const [updated] = await db.update(organizationSubscriptionsTable)
    .set({ billingCycle: cycle, unitPrice })
    .where(eq(organizationSubscriptionsTable.id, current.sub.id))
    .returning();

  await db.insert(billingEventsTable).values({
    organizationId: orgId,
    subscriptionId: current.sub.id,
    kind: "cycle_change",
    label: `Changement de cycle → ${cycle === "annual" ? "Annuel" : "Mensuel"}`,
    amount: 0,
    status: "paid",
    currency: current.plan.currency,
    reference: `NX-CYCLE-${Date.now()}`,
  });

  res.json(updated);
});

// ── Modules
router.get("/organization-modules", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.json([]);
  const rows = await db.select().from(organizationModulesTable)
    .where(eq(organizationModulesTable.organizationId, orgId));
  res.json(rows);
});

router.patch("/organization-modules/:moduleKey/toggle", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const { enabled } = req.body ?? {};
  const moduleKey = (req.params.moduleKey as string);
  // Nouveau modèle : accès total modules — aucune restriction par plan
  const [row] = await db.update(organizationModulesTable)
    .set({ enabled: !!enabled, source: "plan" })
    .where(and(
      eq(organizationModulesTable.organizationId, orgId),
      eq(organizationModulesTable.moduleKey, moduleKey),
    ))
    .returning();
  if (!row) {
    const [created] = await db.insert(organizationModulesTable).values({
      organizationId: orgId, moduleKey, enabled: !!enabled, source: "plan",
    }).returning();
    return res.json(created);
  }
  res.json(row);
});

// ── Billing
router.get("/billing/summary", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const current = await getCurrentSubscription(orgId);
  const events = await db.select().from(billingEventsTable)
    .where(eq(billingEventsTable.organizationId, orgId))
    .orderBy(desc(billingEventsTable.occurredAt))
    .limit(12);
  const ytdPaid = events
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + (e.amount ?? 0), 0);
  // Nouveau modèle : tarification par nombre d'utilisateurs actifs
  const [{ count: memberCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationMembersTable)
    .where(eq(organizationMembersTable.organizationId, orgId));
  const userCount = Number(memberCount ?? 0);
  const pricing = calcPricing(userCount);
  res.json({
    subscription: current?.sub ?? null,
    plan: current?.plan ?? null,
    nextInvoiceAt: current?.sub.currentPeriodEnd ?? null,
    currency: current?.plan.currency ?? "XOF",
    paidYearToDate: ytdPaid,
    recentEvents: events,
    // Nouvelle tarification
    userCount,
    amountHT: pricing.amountHT,
    tva: pricing.tva,
    ttc: pricing.ttc,
    isEnterprise: pricing.isEnterprise,
  });
});

router.get("/billing/events", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.json([]);
  const rows = await db.select().from(billingEventsTable)
    .where(eq(billingEventsTable.organizationId, orgId))
    .orderBy(desc(billingEventsTable.occurredAt));
  res.json(rows);
});

router.get("/billing/usage", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const current = await getCurrentSubscription(orgId);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(organizationMembersTable)
    .where(eq(organizationMembersTable.organizationId, orgId));
  const userCount = Number(count ?? 0);
  const pricing = calcPricing(userCount);
  res.json({
    userCount,
    // Compatibilité ascendante
    seatsUsed: userCount,
    seatsTotal: current?.sub.seats ?? userCount,
    ratio: 1,
    plan: current?.plan ?? null,
    // Nouveau modèle tarifaire
    amountHT: pricing.amountHT,
    tva: pricing.tva,
    ttc: pricing.ttc,
    isEnterprise: pricing.isEnterprise,
  });
});

// ── Workspace settings (alias dédié)
router.get("/workspace-settings", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  const sub = await getCurrentSubscription(orgId);
  const modules = await db.select().from(organizationModulesTable)
    .where(eq(organizationModulesTable.organizationId, orgId));
  res.json({ organization: org, subscription: sub?.sub, plan: sub?.plan, modules });
});

const SETTINGS_FIELDS: Record<"general" | "branding" | "preferences", string[]> = {
  general: ["name", "legalName", "industry", "country", "contactEmail", "contactPhone", "address", "taxId"],
  branding: ["logoUrl", "primaryColor", "secondaryColor"],
  preferences: ["currency", "timezone", "locale"],
};

async function patchSettings(req: import("express").Request, res: import("express").Response, group: "general" | "branding" | "preferences") {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const patch = req.body ?? {};
  const allowed: Record<string, unknown> = {};
  for (const k of SETTINGS_FIELDS[group]) if (k in patch) allowed[k] = patch[k];
  const [updated] = await db.update(organizationsTable).set(allowed).where(eq(organizationsTable.id, orgId)).returning();
  res.json(updated);
}

router.patch("/workspace-settings/general", requireAdmin, (req, res) => { patchSettings(req, res, "general"); });
router.patch("/workspace-settings/branding", requireAdmin, (req, res) => { patchSettings(req, res, "branding"); });
router.patch("/workspace-settings/preferences", requireAdmin, (req, res) => { patchSettings(req, res, "preferences"); });

export default router;
