import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  subscriptionPlansTable, subscriptionPlanFeaturesTable,
  organizationSubscriptionsTable, organizationModulesTable, billingEventsTable,
  organizationMembersTable, organizationsTable, moduleCatalogTable,
  usersTable,
} from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { getCurrentOrganizationId, getCurrentSubscription } from "../lib/tenant";
import { requireAdmin } from "../middlewares/auth";
import { calcPricing } from "../lib/pricing";
import { sendEmail } from "../lib/email";

// ── Hiérarchie des plans (plus le nombre est élevé, plus le plan est supérieur)
const PLAN_ORDER: Record<string, number> = { STARTER: 1, BUSINESS: 2, PREMIUM: 3, ENTERPRISE: 99 };

function getPlanChangeType(fromCode: string, toCode: string): "upgrade" | "downgrade" | "current" | "enterprise" {
  const from = fromCode.toUpperCase();
  const to   = toCode.toUpperCase();
  if (from === to) return "current";
  if (to === "ENTERPRISE" || from === "ENTERPRISE") return "enterprise";
  const fromOrder = PLAN_ORDER[from] ?? 0;
  const toOrder   = PLAN_ORDER[to]   ?? 0;
  return toOrder > fromOrder ? "upgrade" : "downgrade";
}

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

// ── Prévisualisation d'un changement de plan (sans effet)
router.get("/subscriptions/change-plan/preview", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });

  const targetCode = String((req.query as Record<string, string>).to ?? "").toUpperCase();
  if (!targetCode) return res.status(400).json({ error: "Paramètre 'to' requis" });

  const [targetPlan] = await db.select().from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.code, targetCode)).limit(1);
  if (!targetPlan) return res.status(404).json({ error: "Plan introuvable" });

  const current = await getCurrentSubscription(orgId);
  if (!current) return res.status(404).json({ error: "Aucun abonnement actif" });

  const { sub, plan: fromPlan } = current;
  const changeType = getPlanChangeType(fromPlan.code, targetCode);
  const cycle = sub.billingCycle ?? "monthly";
  const seats = sub.seats ?? 1;

  const fromUnitTTC = cycle === "annual" ? fromPlan.annualPricePerSeat : fromPlan.monthlyPricePerSeat;
  const toUnitTTC   = cycle === "annual" ? targetPlan.annualPricePerSeat : targetPlan.monthlyPricePerSeat;

  const fromMonthlyTTC = fromUnitTTC * seats;
  const toMonthlyTTC   = toUnitTTC   * seats;
  const diffMonthly    = toMonthlyTTC - fromMonthlyTTC;

  // Prorata (upgrade seulement : facturer la différence pour la période restante)
  const now  = new Date();
  const pEnd = sub.currentPeriodEnd  ? new Date(sub.currentPeriodEnd)  : new Date();
  const pStart = sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : new Date();
  const totalMs     = Math.max(1, pEnd.getTime() - pStart.getTime());
  const remainingMs = Math.max(0, pEnd.getTime() - now.getTime());
  const totalDays     = Math.round(totalMs     / 86_400_000);
  const remainingDays = Math.round(remainingMs / 86_400_000);
  const ratio = remainingMs / totalMs;
  const prorataAmount = changeType === "upgrade" ? Math.round(diffMonthly * ratio) : 0;

  // Modules gagnés / perdus
  const fromMods = new Set<string>(fromPlan.includedModules ?? []);
  const toMods   = new Set<string>(targetPlan.includedModules ?? []);
  const modulesGained = [...toMods  ].filter(m => !fromMods.has(m));
  const modulesLost   = [...fromMods].filter(m => !toMods.has(m));

  res.json({
    from: { code: fromPlan.code, name: fromPlan.name, unitPriceTTC: fromUnitTTC, monthlyTTC: fromMonthlyTTC, seats },
    to:   { code: targetPlan.code, name: targetPlan.name, unitPriceTTC: toUnitTTC, monthlyTTC: toMonthlyTTC },
    changeType,
    diffMonthly,
    remainingDays,
    totalDays,
    prorataRatio: Math.round(ratio * 100),
    prorataAmount,
    effectiveDate:    now.toISOString().split("T")[0],
    nextBillingDate:  pEnd.toISOString().split("T")[0],
    modulesGained,
    modulesLost,
  });
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
  const oldPlanName = current?.plan.name ?? "—";
  const changeType  = current ? getPlanChangeType(current.plan.code, plan.code) : "upgrade";
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
  const included = new Set<string>(plan.includedModules ?? []);
  const orgMods = await db.select().from(organizationModulesTable)
    .where(eq(organizationModulesTable.organizationId, orgId));
  const existingKeys = new Set(orgMods.map((m) => m.moduleKey));
  for (const mod of orgMods) {
    if (mod.source !== "manual") {
      await db.update(organizationModulesTable)
        .set({ enabled: included.has(mod.moduleKey), source: "plan" })
        .where(eq(organizationModulesTable.id, mod.id));
    }
  }
  const missing = [...included].filter((k) => !existingKeys.has(k));
  if (missing.length > 0) {
    await db.insert(organizationModulesTable).values(
      missing.map((k) => ({ organizationId: orgId, moduleKey: k, enabled: true, source: "plan" as const })),
    );
  }

  const changeLabel = changeType === "upgrade"
    ? `Upgrade ${oldPlanName} → ${plan.name}`
    : `Réduction ${oldPlanName} → ${plan.name}`;

  await db.insert(billingEventsTable).values({
    organizationId: orgId,
    subscriptionId: newSub.id,
    kind: "plan_change",
    label: changeLabel,
    amount: 0,
    status: "paid",
    currency: plan.currency,
    reference: `NX-PLAN-${Date.now()}`,
  });

  // Email de confirmation à l'utilisateur
  try {
    const [user] = await db.select({ email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, req.authUser!.id)).limit(1);
    if (user?.email) {
      const typeLabel  = changeType === "upgrade" ? "upgrade" : "downgrade";
      const actionWord = changeType === "upgrade" ? "Upgrade" : "Réduction";
      const seats      = newSub.seats ?? 1;
      const ttc        = unitPrice * seats;
      await sendEmail({
        to:      user.email,
        subject: `${actionWord} de votre abonnement Gaméasù — Formule ${plan.name}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
  <div style="text-align:center;margin-bottom:24px">
    <img src="https://gameasu.com/assets/logo.png" alt="Gaméasù" width="120" style="margin-bottom:8px" />
    <h2 style="color:#111827;font-size:20px;margin:0">Confirmation de changement de formule</h2>
  </div>
  <p style="color:#374151;font-size:15px">Bonjour ${user.firstName ?? ""},</p>
  <p style="color:#374151;font-size:15px">
    Votre abonnement Gaméasù a été modifié avec succès.
  </p>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0">
    <table style="width:100%;font-size:14px;color:#374151">
      <tr><td style="padding:4px 0;color:#6b7280">Ancienne formule</td><td style="text-align:right;font-weight:600">${oldPlanName}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Nouvelle formule</td><td style="text-align:right;font-weight:700;color:#f37021">${plan.name}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Type de changement</td><td style="text-align:right">${actionWord}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Utilisateurs</td><td style="text-align:right">${seats}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Montant mensuel TTC</td><td style="text-align:right;font-weight:600">${ttc.toLocaleString("fr-FR")} FCFA</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Date d'effet</td><td style="text-align:right">${now.toLocaleDateString("fr-FR")}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Prochaine facturation</td><td style="text-align:right">${end.toLocaleDateString("fr-FR")}</td></tr>
    </table>
  </div>
  ${changeType === "downgrade" ? `
  <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;font-size:13px;color:#92400e">
    <strong>⚠️ Modules désactivés</strong><br />
    Certains modules de votre ancienne formule ne sont plus accessibles.
    Vos données sont conservées et resteront disponibles si vous repassez à une formule supérieure.
  </div>` : ""}
  <p style="color:#6b7280;font-size:13px;margin-top:24px">
    Pour toute question, contactez notre équipe à <a href="mailto:support@gameasutech.africa" style="color:#f37021">support@gameasutech.africa</a>.
  </p>
  <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:24px;text-align:center">
    © ${now.getFullYear()} Gaméasù · Pilotage d'entreprise nouvelle génération
  </p>
</div>`,
      });
    }
  } catch { /* email non-bloquant */ }

  res.json({ subscription: newSub, plan, changeType });
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

  const [orgMods, catalog] = await Promise.all([
    db.select().from(organizationModulesTable)
      .where(eq(organizationModulesTable.organizationId, orgId)),
    db.select().from(moduleCatalogTable).orderBy(moduleCatalogTable.sortOrder),
  ]);

  const orgModMap = new Map(orgMods.map((m) => [m.moduleKey, m]));

  const result = catalog.map((cat) => {
    const orgMod = orgModMap.get(cat.key);
    return {
      id: orgMod?.id ?? cat.id,
      organizationId: orgId,
      moduleKey: cat.key,
      enabled: orgMod?.enabled ?? false,
      source: (orgMod?.source ?? "plan") as "plan" | "addon" | "manual",
      name: cat.name,
      description: cat.description ?? null,
      category: cat.category,
      icon: cat.icon ?? null,
      isCore: cat.isCore,
      sortOrder: cat.sortOrder,
    };
  });

  res.json(result);
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
