/**
 * Phase 21 — Org tuner (audit & recommandations sur la configuration).
 *  - GET /api/org-tuner/audit : audit heuristique de l'organisation courante.
 *
 * Analyse : adéquation plan/usage (sièges utilisés vs payés), modules activés
 * mais non utilisés (heuristique sur tables métier), suggestions d'upgrade
 * pour modules absents, paramètres non renseignés (taxId, logo, etc.).
 */
import { Router, type IRouter } from "express";
import {
  db, organizationsTable, organizationSubscriptionsTable, organizationModulesTable,
  organizationMembersTable, subscriptionPlansTable, moduleCatalogTable,
  usersTable, clientsTable, projectsTable, invoicesTable, opportunitiesTable, documentsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, gte } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/org-tuner/audit", requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(400).json({ error: "Aucune organisation courante" });

    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });

    const [sub] = await db.select({
      seats: organizationSubscriptionsTable.seats,
      planCode: subscriptionPlansTable.code,
      planName: subscriptionPlansTable.name,
      includedModules: subscriptionPlansTable.includedModules,
      unitPrice: organizationSubscriptionsTable.unitPrice,
      cycle: organizationSubscriptionsTable.billingCycle,
    }).from(organizationSubscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(and(eq(organizationSubscriptionsTable.organizationId, orgId), eq(organizationSubscriptionsTable.isCurrent, true)))
      .limit(1);

    const [memCount] = await db.select({ c: sql<number>`count(*)::int` })
      .from(organizationMembersTable).where(eq(organizationMembersTable.organizationId, orgId));

    const enabled = await db.select({ moduleKey: organizationModulesTable.moduleKey, enabled: organizationModulesTable.enabled })
      .from(organizationModulesTable).where(eq(organizationModulesTable.organizationId, orgId));
    const enabledKeys = new Set(enabled.filter((e) => e.enabled).map((e) => e.moduleKey));

    const catalog = await db.select().from(moduleCatalogTable);

    // Heuristique usage : compteur de ressources par module
    const since90 = new Date(Date.now() - 90 * 86400000);
    const [cliCount] = await db.select({ c: sql<number>`count(*)::int` }).from(clientsTable).where(isNull(clientsTable.deletedAt));
    const [projCount] = await db.select({ c: sql<number>`count(*)::int` }).from(projectsTable).where(isNull(projectsTable.deletedAt));
    const [invCount] = await db.select({ c: sql<number>`count(*)::int` }).from(invoicesTable).where(gte(invoicesTable.createdAt, since90));
    const [oppCount] = await db.select({ c: sql<number>`count(*)::int` }).from(opportunitiesTable).where(isNull(opportunitiesTable.deletedAt));
    const [docCount] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(isNull(documentsTable.deletedAt));

    const usage: Record<string, number> = {
      clients: cliCount?.c ?? 0,
      projects: projCount?.c ?? 0,
      accounting: invCount?.c ?? 0,
      sales_crm: oppCount?.c ?? 0,
      documents: docCount?.c ?? 0,
    };

    const recommendations: Array<{ severity: "low" | "medium" | "high"; kind: string; title: string; detail: string; cta?: string }> = [];

    // 1. Sièges
    const seats = sub?.seats ?? 0;
    const memUsed = memCount?.c ?? 0;
    if (seats > 0 && memUsed > seats) {
      recommendations.push({
        severity: "high", kind: "seats_exceeded",
        title: `Sièges dépassés (${memUsed} / ${seats})`,
        detail: `Ajustez l'abonnement pour couvrir tous les membres actifs.`,
        cta: "/billing",
      });
    } else if (seats > 0 && memUsed < seats / 2) {
      recommendations.push({
        severity: "medium", kind: "seats_underused",
        title: `Sous-utilisation des sièges (${memUsed} / ${seats})`,
        detail: `Vous payez ${seats - memUsed} siège(s) inutilisé(s). Envisagez un rééchelonnement.`,
        cta: "/billing",
      });
    }

    // 2. Modules activés mais usage = 0
    for (const [key, count] of Object.entries(usage)) {
      if (enabledKeys.has(key) && count === 0) {
        const mod = catalog.find((c) => c.key === key);
        recommendations.push({
          severity: "low", kind: "module_unused",
          title: `Module « ${mod?.name ?? key} » activé mais non utilisé`,
          detail: `Aucune donnée détectée sur les 90 derniers jours. Considérez le désactiver ou l'adopter.`,
          cta: "/workspace-settings",
        });
      }
    }

    // 3. Modules utilisés mais désactivés (anomalie)
    for (const [key, count] of Object.entries(usage)) {
      if (!enabledKeys.has(key) && count > 0) {
        const mod = catalog.find((c) => c.key === key);
        recommendations.push({
          severity: "high", kind: "module_disabled_but_used",
          title: `Données présentes sur module désactivé : ${mod?.name ?? key}`,
          detail: `${count} ressource(s) existent. Réactivez le module pour y accéder.`,
          cta: "/workspace-settings",
        });
      }
    }

    // 4. Profil organisation incomplet
    if (!org.taxId) recommendations.push({ severity: "medium", kind: "missing_tax_id", title: "Identifiant fiscal manquant", detail: "Renseignez le NIF pour des factures conformes." , cta: "/workspace-settings"});
    if (!org.logoUrl) recommendations.push({ severity: "low", kind: "missing_logo", title: "Logo manquant", detail: "Personnalisez l'identité visuelle de votre espace.", cta: "/workspace-settings" });
    if (!org.contactPhone) recommendations.push({ severity: "low", kind: "missing_phone", title: "Téléphone de contact manquant", detail: "Ajoutez un numéro pour les communications client.", cta: "/workspace-settings" });
    if (!org.address) recommendations.push({ severity: "low", kind: "missing_address", title: "Adresse manquante", detail: "Indispensable pour les documents légaux.", cta: "/workspace-settings" });

    const counts = { high: 0, medium: 0, low: 0 };
    for (const r of recommendations) counts[r.severity]++;
    const order = { high: 2, medium: 1, low: 0 };
    recommendations.sort((a, b) => order[b.severity] - order[a.severity]);

    return res.json({
      organization: { id: org.id, name: org.name, slug: org.slug, country: org.country, industry: org.industry },
      subscription: sub ? { planCode: sub.planCode, planName: sub.planName, seats, used: memUsed, cycle: sub.cycle } : null,
      usage,
      enabledModulesCount: enabledKeys.size,
      totalModulesCount: catalog.length,
      counts,
      recommendations,
    });
  } catch (e) { next(e); }
});

export default router;
