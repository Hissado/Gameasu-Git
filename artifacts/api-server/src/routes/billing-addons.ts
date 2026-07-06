import { Router } from "express";
import { db } from "@workspace/db";
import { addonCatalogTable, orgAddonsTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";

const router = Router();

const TVA_RATE = 0.18;

/**
 * Catalogue Gameasu Add-ons — modèle tarifaire :
 *
 * credits  → achat ponctuel d'unités (SMS / emails), priceHT = prix par unité en FCFA HT,
 *             pas d'échéance, solde = creditsPurchased - usageUsed
 *
 * quote    → prix sur devis (support, formation, intégration) selon taille / complexité,
 *             aucun prix affiché, CTA "Demander un devis"
 *
 * monthly  → (non utilisé actuellement, conservé pour extension future)
 */
const ADDON_CATALOG_SEED = [
  // ── Crédits SMS ──────────────────────────────────────────────────────────────
  {
    slug: "sms_custom",
    name: "SMS personnalisés",
    description: "Envoyez des SMS depuis Gameasu avec un expéditeur personnalisé. Prix à l'unité, sans expiration.",
    category: "sms",
    billingType: "credits",
    priceHT: 25,           // 25 FCFA HT / SMS
    unit: "SMS",
    includedUnits: null,
    isActive: true,
    sortOrder: 10,
  },
  {
    slug: "sms_campaigns",
    name: "SMS de masse",
    description: "Campagnes marketing à grande échelle. Tarif dégressif à partir de 5 000 SMS.",
    category: "sms",
    billingType: "credits",
    priceHT: 18,           // 18 FCFA HT / SMS (tarif volume)
    unit: "SMS",
    includedUnits: null,
    isActive: true,
    sortOrder: 20,
  },
  // ── Crédits Email ─────────────────────────────────────────────────────────────
  {
    slug: "email_custom",
    name: "Emails personnalisés",
    description: "Envoyez des emails depuis votre domaine avec vos templates. Prix à l'unité, sans expiration.",
    category: "email",
    billingType: "credits",
    priceHT: 5,            // 5 FCFA HT / email
    unit: "email",
    includedUnits: null,
    isActive: true,
    sortOrder: 30,
  },
  {
    slug: "email_campaigns",
    name: "Campagnes email avancées",
    description: "Automatisations, séquences et analytics avancés. Tarif dégressif à partir de 10 000 emails.",
    category: "email",
    billingType: "credits",
    priceHT: 3,            // 3 FCFA HT / email (tarif volume)
    unit: "email",
    includedUnits: null,
    isActive: true,
    sortOrder: 40,
  },
  // ── Sur devis ─────────────────────────────────────────────────────────────────
  {
    slug: "support_priority",
    name: "Support prioritaire",
    description: "Accès prioritaire au support Gameasu avec SLA dédié. Tarif selon la taille de votre organisation et le niveau de service souhaité.",
    category: "support",
    billingType: "quote",
    priceHT: 0,
    unit: null,
    includedUnits: null,
    isActive: true,
    sortOrder: 50,
  },
  {
    slug: "onboarding",
    name: "Assistance à l'intégration",
    description: "Accompagnement personnalisé pour la mise en place de votre espace Gameasu. Tarif selon la complexité du projet et le périmètre fonctionnel.",
    category: "support",
    billingType: "quote",
    priceHT: 0,
    unit: null,
    includedUnits: null,
    isActive: true,
    sortOrder: 60,
  },
  {
    slug: "training",
    name: "Formation personnalisée",
    description: "Session de formation dédiée à votre équipe, en ligne ou en présentiel. Tarif selon le nombre de participants et le contenu souhaité.",
    category: "support",
    billingType: "quote",
    priceHT: 0,
    unit: null,
    includedUnits: null,
    isActive: true,
    sortOrder: 70,
  },
  // ── Assistant IA ──────────────────────────────────────────────────────────────
  {
    slug: "ai_assistant",
    name: "Gameasu Assistant IA",
    description: "Assistant virtuel IA pour votre organisation : accueil client 24h/24, prise de rendez-vous automatique, support client, qualification de prospects et base de connaissance personnalisée.",
    category: "ai",
    billingType: "monthly",
    priceHT: 25_000,       // 25 000 FCFA HT / mois
    unit: "mois",
    includedUnits: null,
    isActive: true,
    sortOrder: 5,
  },
  {
    slug: "ai_assistant_pro",
    name: "Gameasu Assistant IA Pro",
    description: "Assistant IA Pro avec appels téléphoniques entrants, numéro dédié, clonage vocal sécurisé et intégrations avancées. Tarif selon le volume d'appels et les fonctionnalités souhaitées.",
    category: "ai",
    billingType: "quote",
    priceHT: 0,
    unit: null,
    includedUnits: null,
    isActive: true,
    sortOrder: 6,
  },
  // Stockage désactivé
  {
    slug: "storage_10gb",
    name: "Stockage supplémentaire (10 Go)",
    description: "",
    category: "storage",
    billingType: "monthly",
    priceHT: 0,
    unit: null,
    includedUnits: null,
    isActive: false,       // retiré du catalogue
    sortOrder: 999,
  },
] as const;

export async function seedAddonCatalog() {
  for (const addon of ADDON_CATALOG_SEED) {
    await db
      .insert(addonCatalogTable)
      .values({
        ...addon,
        unit: addon.unit ?? null,
        includedUnits: addon.includedUnits ?? null,
      })
      .onConflictDoUpdate({
        target: addonCatalogTable.slug,
        set: {
          name:          addon.name,
          description:   addon.description,
          category:      addon.category,
          billingType:   addon.billingType,
          priceHT:       addon.priceHT,
          unit:          addon.unit ?? null,
          includedUnits: addon.includedUnits ?? null,
          isActive:      addon.isActive,
          sortOrder:     addon.sortOrder,
          updatedAt:     new Date(),
        },
      });
  }
}

// ─── GET catalogue + état org ─────────────────────────────────────────────────

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
      // Prix effectif : custom (négocié) > catalogue
      const effectivePriceHT = (sub?.customPriceHT != null) ? sub.customPriceHT : addon.priceHT;
      const tva = Math.round(effectivePriceHT * TVA_RATE);
      const balance = sub ? Math.max(0, sub.creditsPurchased - sub.usageUsed) : 0;
      return {
        ...addon,
        tva,
        priceHT: effectivePriceHT,
        catalogPriceHT: addon.priceHT,
        hasCustomPrice: sub?.customPriceHT != null,
        subscription: sub
          ? {
              id:               sub.id,
              status:           sub.status,
              activatedAt:      sub.activatedAt,
              nextRenewalAt:    sub.nextRenewalAt,
              usageUsed:        sub.usageUsed,
              creditsPurchased: sub.creditsPurchased,
              creditsBalance:   balance,
            }
          : null,
        isActive: sub ? ["active", "pending_quote"].includes(sub.status) : false,
      };
    });

    return res.json({ data: result });
  } catch (e) { next(e); }
});

// ─── POST acheter des crédits (SMS / email) ───────────────────────────────────

router.post("/billing/addons/:addonId/buy-credits", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { addonId } = req.params as { addonId: string };
    const { quantity } = req.body as { quantity: number };

    if (!quantity || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "Quantité invalide" });
    }

    const [addon] = await db
      .select()
      .from(addonCatalogTable)
      .where(and(eq(addonCatalogTable.id, addonId), eq(addonCatalogTable.isActive, true)))
      .limit(1);

    if (!addon) return res.status(404).json({ error: "Add-on introuvable" });
    if (addon.billingType !== "credits") {
      return res.status(400).json({ error: "Cet add-on ne supporte pas l'achat de crédits" });
    }

    const priceHTTotal  = addon.priceHT * quantity;
    const tvaTotal      = Math.round(priceHTTotal * TVA_RATE);
    const priceTTCTotal = priceHTTotal + tvaTotal;

    const existing = await db
      .select()
      .from(orgAddonsTable)
      .where(and(eq(orgAddonsTable.organizationId, orgId), eq(orgAddonsTable.addonId, addonId)))
      .limit(1);

    const now = new Date();
    if (existing.length > 0) {
      await db
        .update(orgAddonsTable)
        .set({
          status:           "active",
          activatedAt:      existing[0].activatedAt ?? now,
          creditsPurchased: sql`${orgAddonsTable.creditsPurchased} + ${quantity}`,
          updatedAt:        now,
        })
        .where(eq(orgAddonsTable.id, existing[0].id));
    } else {
      await db.insert(orgAddonsTable).values({
        organizationId:   orgId,
        addonId,
        status:           "active",
        activatedAt:      now,
        nextRenewalAt:    null,
        usageUsed:        0,
        creditsPurchased: quantity,
      });
    }

    return res.json({
      ok: true,
      quantity,
      unit:         addon.unit,
      priceHTTotal,
      tvaTotal,
      priceTTCTotal,
    });
  } catch (e) { next(e); }
});

// ─── POST demander un devis (support / formation / intégration) ───────────────

router.post("/billing/addons/:addonId/request-quote", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { addonId } = req.params as { addonId: string };
    const { notes } = req.body as { notes?: string };

    const [addon] = await db
      .select()
      .from(addonCatalogTable)
      .where(and(eq(addonCatalogTable.id, addonId), eq(addonCatalogTable.isActive, true)))
      .limit(1);

    if (!addon) return res.status(404).json({ error: "Add-on introuvable" });
    if (addon.billingType !== "quote") {
      return res.status(400).json({ error: "Cet add-on n'est pas sur devis" });
    }

    const existing = await db
      .select()
      .from(orgAddonsTable)
      .where(and(eq(orgAddonsTable.organizationId, orgId), eq(orgAddonsTable.addonId, addonId)))
      .limit(1);

    const now = new Date();
    if (existing.length > 0) {
      await db
        .update(orgAddonsTable)
        .set({ status: "pending_quote", notes: notes ?? existing[0].notes, updatedAt: now })
        .where(eq(orgAddonsTable.id, existing[0].id));
    } else {
      await db.insert(orgAddonsTable).values({
        organizationId: orgId,
        addonId,
        status:         "pending_quote",
        activatedAt:    null,
        nextRenewalAt:  null,
        usageUsed:      0,
        creditsPurchased: 0,
        notes:          notes ?? null,
      });
    }

    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── POST activer / désactiver (mensuel — pour extension future) ──────────────

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
        status:         "active",
        activatedAt:    now,
        nextRenewalAt:  nextRenewal,
        usageUsed:      0,
        creditsPurchased: 0,
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
