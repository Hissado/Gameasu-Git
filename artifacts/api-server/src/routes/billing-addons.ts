import { Router } from "express";
import { db } from "@workspace/db";
import { addonCatalogTable, orgAddonsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

const TVA_RATE = 0.18;

const ADDON_CATALOG_SEED = [
  {
    slug: "sms_custom",
    name: "SMS personnalisés",
    description: "Envoyez des SMS depuis Gaméasù avec un nom d'expéditeur personnalisé. 1 000 SMS inclus/mois.",
    category: "sms",
    billingType: "monthly",
    priceHT: 15_000,
    unit: "SMS",
    includedUnits: 1_000,
    sortOrder: 10,
  },
  {
    slug: "sms_campaigns",
    name: "Campagnes SMS",
    description: "Créez et envoyez des campagnes SMS marketing à vos contacts. 5 000 SMS inclus/mois.",
    category: "sms",
    billingType: "monthly",
    priceHT: 35_000,
    unit: "SMS",
    includedUnits: 5_000,
    sortOrder: 20,
  },
  {
    slug: "email_custom",
    name: "Emails personnalisés",
    description: "Envoyez des emails depuis votre propre domaine avec vos templates. 5 000 emails/mois inclus.",
    category: "email",
    billingType: "monthly",
    priceHT: 7_500,
    unit: "email",
    includedUnits: 5_000,
    sortOrder: 30,
  },
  {
    slug: "email_campaigns",
    name: "Campagnes email avancées",
    description: "Automatisations, séquences et analytics avancés. 20 000 emails/mois inclus.",
    category: "email",
    billingType: "monthly",
    priceHT: 20_000,
    unit: "email",
    includedUnits: 20_000,
    sortOrder: 40,
  },
  {
    slug: "support_priority",
    name: "Support prioritaire",
    description: "Accès prioritaire à l'équipe support avec SLA garanti sous 4 h ouvrées.",
    category: "support",
    billingType: "monthly",
    priceHT: 25_000,
    unit: null,
    includedUnits: null,
    sortOrder: 50,
  },
  {
    slug: "onboarding",
    name: "Assistance à l'intégration",
    description: "Accompagnement personnalisé pour la mise en place initiale de votre espace Gaméasù.",
    category: "support",
    billingType: "onetime",
    priceHT: 50_000,
    unit: null,
    includedUnits: null,
    sortOrder: 60,
  },
  {
    slug: "training",
    name: "Formation personnalisée",
    description: "Session de formation dédiée à votre équipe (demi-journée, en ligne ou présentiel).",
    category: "support",
    billingType: "onetime",
    priceHT: 75_000,
    unit: null,
    includedUnits: null,
    sortOrder: 70,
  },
  {
    slug: "storage_10gb",
    name: "Stockage supplémentaire (10 Go)",
    description: "Ajoutez 10 Go de stockage pour vos pièces jointes, documents et fichiers.",
    category: "storage",
    billingType: "monthly",
    priceHT: 10_000,
    unit: "Go",
    includedUnits: 10,
    sortOrder: 80,
  },
] as const;

export async function seedAddonCatalog() {
  for (const addon of ADDON_CATALOG_SEED) {
    const existing = await db
      .select({ id: addonCatalogTable.id })
      .from(addonCatalogTable)
      .where(eq(addonCatalogTable.slug, addon.slug))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(addonCatalogTable).values({
        ...addon,
        unit: addon.unit ?? null,
        includedUnits: addon.includedUnits ?? null,
        isActive: true,
      });
    }
  }
}

router.get("/billing/addons", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

    const catalog = await db
      .select()
      .from(addonCatalogTable)
      .where(eq(addonCatalogTable.isActive, true))
      .orderBy(asc(addonCatalogTable.sortOrder));

    const orgAddons = await db
      .select()
      .from(orgAddonsTable)
      .where(eq(orgAddonsTable.organizationId, orgId));

    const orgAddonMap = new Map(orgAddons.map((a) => [a.addonId, a]));

    const result = catalog.map((addon) => {
      const sub = orgAddonMap.get(addon.id) ?? null;
      const tva = Math.round(addon.priceHT * TVA_RATE);
      return {
        ...addon,
        tva,
        priceTTC: addon.priceHT + tva,
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              activatedAt: sub.activatedAt,
              nextRenewalAt: sub.nextRenewalAt,
              usageUsed: sub.usageUsed,
            }
          : null,
        isActive: sub?.status === "active",
      };
    });

    return res.json({ data: result });
  } catch (e) { next(e); }
});

router.post("/billing/addons/:addonId/activate", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { addonId } = req.params as { addonId: string };

    const [addon] = await db
      .select()
      .from(addonCatalogTable)
      .where(and(eq(addonCatalogTable.id, addonId), eq(addonCatalogTable.isActive, true)))
      .limit(1);

    if (!addon) return res.status(404).json({ error: "Add-on introuvable" });

    const existing = await db
      .select()
      .from(orgAddonsTable)
      .where(and(eq(orgAddonsTable.organizationId, orgId), eq(orgAddonsTable.addonId, addonId)))
      .limit(1);

    const now = new Date();
    const nextRenewal = addon.billingType === "monthly"
      ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
      : addon.billingType === "annual"
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : null;

    if (existing.length > 0) {
      await db
        .update(orgAddonsTable)
        .set({ status: "active", activatedAt: now, nextRenewalAt: nextRenewal, updatedAt: now })
        .where(eq(orgAddonsTable.id, existing[0].id));
    } else {
      await db.insert(orgAddonsTable).values({
        organizationId: orgId,
        addonId,
        status: "active",
        activatedAt: now,
        nextRenewalAt: nextRenewal,
        usageUsed: 0,
      });
    }

    return res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post("/billing/addons/:addonId/deactivate", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { addonId } = req.params as { addonId: string };

    await db
      .update(orgAddonsTable)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(orgAddonsTable.organizationId, orgId), eq(orgAddonsTable.addonId, addonId)));

    return res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
