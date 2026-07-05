/**
 * Seed SaaS Gameasu — crée/maintient :
 *  - organisation par défaut (où vivent les données métier existantes)
 *  - catalogue des modules
 *  - 4 plans (Starter / Business / Premium / Personnalisée) + features
 *  - abonnement courant (Premium, mensuel) pour l'organisation par défaut
 *  - modules activés selon le plan
 *  - quelques évènements de facturation de démo
 *
 * TARIFICATION (TTC, TVA 18 % incluse) :
 *   Starter      → 4 000 FCFA / util / mois  (7 modules)
 *   Business     → 7 000 FCFA / util / mois  (15 modules)  ★ Populaire
 *   Premium      → 10 000 FCFA / util / mois (24 modules)  ✦ Complet
 *   Personnalisée (Enterprise) → Sur devis
 *
 * Remises périodicité : Trimestriel −10 %, Semestriel −15 %, Annuel −20 %.
 *
 * Idempotent : peut être ré-exécuté sans dupliquer.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  organizationsTable,
  organizationMembersTable,
  moduleCatalogTable,
  subscriptionPlansTable,
  subscriptionPlanFeaturesTable,
  organizationSubscriptionsTable,
  organizationModulesTable,
  billingEventsTable,
  usersTable,
} from "./schema";

type ModuleSeed = { key: string; name: string; category: string; sortOrder: number; isCore?: boolean; icon: string };
const MODULES: ModuleSeed[] = [
  { key: "dashboard",            name: "Tableau de bord",                   category: "core",     sortOrder: 10,  isCore: true, icon: "LayoutDashboard" },
  { key: "clients",              name: "Clients",                            category: "core",     sortOrder: 20,  isCore: true, icon: "Building2" },
  { key: "services",             name: "Services",                           category: "core",     sortOrder: 30,  isCore: true, icon: "Briefcase" },
  { key: "projects",             name: "Projets",                            category: "core",     sortOrder: 40,  isCore: true, icon: "FolderKanban" },
  { key: "tasks",                name: "Tâches",                             category: "core",     sortOrder: 50,  isCore: true, icon: "CheckSquare" },
  { key: "sales_crm",            name: "Ventes & Relation client",           category: "business", sortOrder: 60,  icon: "Target" },
  { key: "accounting",           name: "Comptabilité",                       category: "business", sortOrder: 70,  icon: "Calculator" },
  { key: "purchases",            name: "Achats & Fournisseurs",              category: "business", sortOrder: 75,  icon: "ShoppingCart" },
  { key: "financial_planning",   name: "Planification financière",           category: "business", sortOrder: 80,  icon: "TrendingUp" },
  { key: "operations",           name: "Opérations",                         category: "business", sortOrder: 90,  icon: "Truck" },
  { key: "inventory_assets",     name: "Parc & équipements",                 category: "business", sortOrder: 100, icon: "Wrench" },
  { key: "inventory_products",   name: "Produits & Stock",                   category: "business", sortOrder: 105, icon: "Package" },
  { key: "rentals",              name: "Locations",                          category: "business", sortOrder: 110, icon: "Truck" },
  { key: "documents",            name: "Documents",                          category: "core",     sortOrder: 120, isCore: true, icon: "FolderOpen" },
  { key: "team_hr",              name: "Équipe & RH",                        category: "business", sortOrder: 130, icon: "UsersRound" },
  { key: "communications",       name: "Communications",                     category: "business", sortOrder: 140, icon: "MessageSquare" },
  { key: "reports",              name: "Rapports",                           category: "business", sortOrder: 150, icon: "BarChart3" },
  { key: "client_portal",        name: "Portail client",                     category: "business", sortOrder: 160, icon: "ExternalLink" },
  { key: "marketing",            name: "Marketing",                          category: "business", sortOrder: 170, icon: "Megaphone" },
  { key: "administration",       name: "Administration",                     category: "admin",    sortOrder: 200, isCore: true, icon: "Shield" },
  { key: "billing_subscription", name: "Abonnement & facturation",           category: "admin",    sortOrder: 210, isCore: true, icon: "CreditCard" },
  { key: "workspace_settings",   name: "Paramètres de l'espace de travail",  category: "admin",    sortOrder: 220, isCore: true, icon: "Settings" },
] as const;

// Modules admin toujours inclus dans tous les plans
const ADMIN_MODULES = ["administration", "billing_subscription", "workspace_settings"] as const;

/**
 * Nouveaux plans Gameasu — tarifs TTC (TVA 18 % incluse).
 * monthlyPricePerSeat = prix TTC / utilisateur / mois
 * annualPricePerSeat  = prix TTC / utilisateur / mois si facturation annuelle (remise −20 %)
 */
const PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    tagline: "Démarrer simplement",
    description: "Pour les petites équipes qui structurent leur activité.",
    monthlyPricePerSeat: 4_000,
    annualPricePerSeat:  3_200,   // 4 000 × (1 − 20 %) = 3 200 / mois si annuel
    setupFee: 0,
    minimumSeats: 1,
    includedSeats: 3,
    maxSeats: null,
    includedModules: [
      // 7 modules fonctionnels
      "dashboard", "clients", "services", "projects", "tasks",
      "documents", "reports",
      // admin toujours inclus
      ...ADMIN_MODULES,
    ],
    isFeatured: false,
    sortOrder: 10,
    features: [
      "Tableau de bord & KPI",
      "Clients, services & projets",
      "Tâches & gestion documentaire",
      "Rapports essentiels",
      "Support standard",
    ],
  },
  {
    code: "BUSINESS",
    name: "Business",
    tagline: "Accélérer la croissance",
    description: "Pour les organisations en expansion qui veulent vendre et facturer.",
    monthlyPricePerSeat: 7_000,
    annualPricePerSeat:  5_600,   // 7 000 × 0,80
    setupFee: 0,
    minimumSeats: 1,
    includedSeats: 10,
    maxSeats: null,
    includedModules: [
      // Tout Starter (7) + 8 modules supplémentaires = 15 modules
      "dashboard", "clients", "services", "projects", "tasks",
      "documents", "reports",
      "sales_crm", "accounting", "purchases",
      "team_hr", "communications", "inventory_assets",
      "client_portal", "marketing",
      // admin toujours inclus
      ...ADMIN_MODULES,
    ],
    isFeatured: true,
    sortOrder: 20,
    features: [
      "Tout Starter inclus",
      "Ventes, CRM & pipeline commercial",
      "Comptabilité SYSCOHADA",
      "Équipe & RH complet",
      "Support prioritaire",
    ],
  },
  {
    code: "PREMIUM",
    name: "Premium",
    tagline: "Le standard complet",
    description: "Pour les structures multi-services qui pilotent finance et opérations.",
    monthlyPricePerSeat: 10_000,
    annualPricePerSeat:  8_000,   // 10 000 × 0,80
    setupFee: 0,
    minimumSeats: 1,
    includedSeats: 25,
    maxSeats: null,
    includedModules: MODULES.map((m) => m.key),  // tous les modules
    isFeatured: false,
    sortOrder: 30,
    features: [
      "Tout Business inclus",
      "FP&A & planification financière",
      "Opérations, parc & locations",
      "Portail client & marketing",
      "Account manager dédié",
    ],
  },
  {
    code: "ENTERPRISE",
    name: "Personnalisée",
    tagline: "Sur-mesure & souverain",
    description: "Pour les groupes et grandes organisations à exigences avancées.",
    monthlyPricePerSeat: 0,
    annualPricePerSeat:  0,
    setupFee: 0,
    minimumSeats: 1,
    includedSeats: 100,
    maxSeats: null,
    includedModules: MODULES.map((m) => m.key),
    isFeatured: false,
    sortOrder: 40,
    features: [
      "Tous les modules activés",
      "Utilisateurs illimités",
      "SSO, audit avancé & SLA",
      "Hébergement souverain disponible",
      "Intégrations & customisations sur-mesure",
    ],
  },
] as const;

async function upsertModuleCatalog() {
  for (const m of MODULES) {
    await db.insert(moduleCatalogTable).values({
      key: m.key, name: m.name, category: m.category, sortOrder: m.sortOrder,
      isCore: m.isCore ?? false, icon: m.icon,
    }).onConflictDoUpdate({
      target: moduleCatalogTable.key,
      set: { name: m.name, category: m.category, sortOrder: m.sortOrder, isCore: m.isCore ?? false, icon: m.icon },
    });
  }
}

async function upsertPlans() {
  const result: Record<string, string> = {};
  for (const p of PLANS) {
    const existing = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.code, p.code)).limit(1);
    let planId: string;
    const payload = {
      code: p.code, name: p.name, tagline: p.tagline, description: p.description,
      monthlyPricePerSeat: p.monthlyPricePerSeat, annualPricePerSeat: p.annualPricePerSeat,
      setupFee: p.setupFee, minimumSeats: p.minimumSeats, includedSeats: p.includedSeats,
      maxSeats: p.maxSeats ?? null, includedModules: [...p.includedModules],
      isFeatured: p.isFeatured, sortOrder: p.sortOrder, currency: "XOF",
    };
    if (existing.length === 0) {
      const [row] = await db.insert(subscriptionPlansTable).values(payload)
        .onConflictDoUpdate({ target: subscriptionPlansTable.code, set: payload })
        .returning({ id: subscriptionPlansTable.id });
      planId = row.id;
    } else {
      planId = existing[0].id;
      await db.update(subscriptionPlansTable).set(payload).where(eq(subscriptionPlansTable.id, planId));
    }
    // Rafraîchit les features
    await db.delete(subscriptionPlanFeaturesTable).where(eq(subscriptionPlanFeaturesTable.planId, planId));
    for (let i = 0; i < p.features.length; i++) {
      await db.insert(subscriptionPlanFeaturesTable).values({
        planId, label: p.features[i], included: true, sortOrder: (i + 1) * 10,
      });
    }
    result[p.code] = planId;
  }

  // Migration : suppression des anciens plans obsolètes (GROWTH, PROFESSIONAL)
  // s'ils existent encore en base et n'ont pas d'abonnement actif.
  for (const oldCode of ["GROWTH", "PROFESSIONAL"]) {
    const old = await db.select().from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.code, oldCode)).limit(1);
    if (old.length > 0) {
      const subs = await db.select().from(organizationSubscriptionsTable)
        .where(eq(organizationSubscriptionsTable.planId, old[0].id)).limit(1);
      if (subs.length === 0) {
        await db.delete(subscriptionPlanFeaturesTable)
          .where(eq(subscriptionPlanFeaturesTable.planId, old[0].id));
        await db.delete(subscriptionPlansTable)
          .where(eq(subscriptionPlansTable.id, old[0].id));
      }
    }
  }

  return result;
}

async function ensureDefaultOrganization(): Promise<string> {
  const existing = await db.select().from(organizationsTable).where(eq(organizationsTable.isDefault, true)).limit(1);
  if (existing.length > 0) return existing[0].id;

  const [org] = await db.insert(organizationsTable).values({
    slug: "nexora-demo",
    name: "Gameasu Demo",
    legalName: "Gameasu Demo SARL",
    industry: "Services aux entreprises",
    country: "TG",
    currency: "XOF",
    timezone: "Africa/Lome",
    locale: "fr-FR",
    contactEmail: "hello@gameasu.africa",
    isDefault: true,
    primaryColor: "#FF6B00",
    secondaryColor: "#0F172A",
  })
    .onConflictDoUpdate({ target: organizationsTable.slug, set: { isDefault: true } })
    .returning({ id: organizationsTable.id });
  return org.id;
}

async function ensureMembership(orgId: string) {
  const users = await db.select().from(usersTable);
  for (const u of users) {
    const role = u.role === "super_admin" ? "owner"
      : u.role === "admin" ? "admin"
      : u.role === "manager" ? "manager"
      : "member";
    await db.insert(organizationMembersTable).values({
      organizationId: orgId, userId: u.id, role, isPrimary: true,
    }).onConflictDoNothing();
  }
}

async function ensureSubscription(orgId: string, planIds: Record<string, string>) {
  const existing = await db.select().from(organizationSubscriptionsTable)
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    )).limit(1);
  if (existing.length > 0) return existing[0].id;

  const plan = PLANS.find((p) => p.code === "PREMIUM")!;
  const now = new Date();
  const periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [sub] = await db.insert(organizationSubscriptionsTable).values({
    organizationId: orgId,
    planId: planIds[plan.code],
    status: "active",
    billingCycle: "monthly",
    seats: plan.includedSeats,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    unitPrice: plan.monthlyPricePerSeat,
    setupFee: plan.setupFee,
    currency: "XOF",
    isCurrent: true,
  }).returning({ id: organizationSubscriptionsTable.id });
  return sub.id;
}

async function ensureOrgModules(orgId: string) {
  const sub = await db.select().from(organizationSubscriptionsTable)
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    )).limit(1);
  if (sub.length === 0) return;
  const plan = await db.select().from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, sub[0].planId)).limit(1);
  if (plan.length === 0) return;
  const includedKeys = new Set(plan[0].includedModules ?? []);
  const existing = await db.select().from(organizationModulesTable)
    .where(eq(organizationModulesTable.organizationId, orgId));
  const byKey = new Map(existing.map((x) => [x.moduleKey, x]));

  for (const m of MODULES) {
    const has = byKey.get(m.key);
    const enabled = includedKeys.has(m.key);
    if (!has) {
      await db.insert(organizationModulesTable).values({
        organizationId: orgId, moduleKey: m.key, enabled, source: "plan",
      }).onConflictDoNothing();
    } else if (has.enabled !== enabled && has.source === "plan") {
      await db.update(organizationModulesTable)
        .set({ enabled })
        .where(eq(organizationModulesTable.id, has.id));
    }
  }
}

async function ensureBillingDemo(orgId: string, subId: string) {
  const existing = await db.select().from(billingEventsTable)
    .where(eq(billingEventsTable.organizationId, orgId)).limit(1);
  if (existing.length > 0) return;
  const now = new Date();
  const months = 3;
  const premiumSeats = 25;
  const premiumPriceTTC = 10_000;  // TTC/util/mois
  for (let i = months; i >= 1; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i);
    await db.insert(billingEventsTable).values({
      organizationId: orgId,
      subscriptionId: subId,
      kind: "invoice",
      label: `Abonnement Premium — ${d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
      amount: premiumPriceTTC * premiumSeats,
      status: "paid",
      currency: "XOF",
      reference: `NX-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-001`,
      occurredAt: d,
    });
  }
}

/**
 * Seed SaaS.
 *
 * Par défaut, ne sème QUE les données de référence (catalogue de modules + plans
 * d'abonnement) — indispensables en production et conservées par la
 * réinitialisation usine. Les données de démonstration (organisation « démo »,
 * membres, abonnement, modules activés, historique de facturation) ne sont
 * créées que lorsque `includeDemoData` est vrai, afin qu'une base vide
 * (production ou après purge) le reste au redémarrage.
 */
export async function seedSaas(opts: { includeDemoData?: boolean } = {}) {
  console.log("• Catalogue modules…");
  await upsertModuleCatalog();
  console.log("• Plans Gameasu (Starter / Business / Premium / Personnalisée)…");
  const planIds = await upsertPlans();

  if (!opts.includeDemoData) {
    console.log("✓ Seed SaaS terminé (catalogue uniquement)");
    return;
  }

  console.log("• Organisation par défaut…");
  const orgId = await ensureDefaultOrganization();
  console.log("• Membres workspace…");
  await ensureMembership(orgId);
  console.log("• Abonnement courant (Premium)…");
  const subId = await ensureSubscription(orgId, planIds);
  console.log("• Modules activés…");
  await ensureOrgModules(orgId);
  console.log("• Historique de facturation…");
  await ensureBillingDemo(orgId, subId);
  console.log("✓ Seed SaaS terminé");
}

// Pas d'auto-run : ce module est appelé explicitement par le boot de l'API
// (artifacts/api-server/src/routes/index.ts) ou via le script `pnpm exec tsx`.
