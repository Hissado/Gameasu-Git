/**
 * Configuration tarifaire Gameasu — copie frontend.
 *
 * SOURCE DE VÉRITÉ : artifacts/api-server/src/lib/pricing.ts
 * (synchronisé manuellement — toute modification doit être répercutée des deux côtés)
 *
 * Tarifs TTC (TVA 18 % incluse) par utilisateur / mois :
 *   Starter      → 4 000 FCFA / util / mois  (7 modules)
 *   Business     → 7 000 FCFA / util / mois  (15 modules)  ★ Populaire
 *   Premium      → 10 000 FCFA / util / mois (24 modules)  ✦ Complet
 *   Personnalisée (Enterprise) → Sur devis
 *
 * Remises par périodicité :
 *   Mensuel      → 0 %
 *   Trimestriel  → −10 %
 *   Semestriel   → −15 %
 *   Annuel       → −20 %
 */

export const TVA_RATE = 0.18;

export const PERIODICITY_OPTIONS = [
  { value: "monthly",    label: "Mensuel",     discount: 0,    months: 1  },
  { value: "quarterly",  label: "Trimestriel", discount: 0.10, months: 3  },
  { value: "semiannual", label: "Semestriel",  discount: 0.15, months: 6  },
  { value: "annual",     label: "Annuel",      discount: 0.20, months: 12 },
] as const;

export type Periodicity = typeof PERIODICITY_OPTIONS[number]["value"];

export const PLAN_CATALOG = [
  {
    code: "STARTER",
    name: "Starter",
    tagline: "Démarrer simplement",
    monthlyPriceTTC: 4_000,
    moduleCount: 7,
    isFeatured: false,
    badge: null as string | null,
    isEnterprise: false as const,
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
    monthlyPriceTTC: 7_000,
    moduleCount: 15,
    isFeatured: true,
    badge: "Populaire",
    isEnterprise: false as const,
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
    monthlyPriceTTC: 10_000,
    moduleCount: 24,
    isFeatured: false,
    badge: "Complet",
    isEnterprise: false as const,
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
    monthlyPriceTTC: 0,
    moduleCount: null as number | null,
    isFeatured: false,
    badge: null as string | null,
    isEnterprise: true as const,
    features: [
      "Tous les modules activés",
      "Utilisateurs illimités",
      "SSO, audit avancé & SLA",
      "Hébergement souverain disponible",
      "Intégrations & customisations sur-mesure",
    ],
  },
] as const;

export type PlanCode = typeof PLAN_CATALOG[number]["code"];

export function getPlan(code: string) {
  return PLAN_CATALOG.find(p => p.code === code.toUpperCase()) ?? null;
}

export function getPeriodicity(value: string) {
  return PERIODICITY_OPTIONS.find(p => p.value === value) ?? PERIODICITY_OPTIONS[0];
}

/**
 * Calcule HT / TVA / TTC pour un plan, N sièges et une périodicité.
 * Retourne les montants pour UNE période (ex: 3 mois si trimestriel).
 */
export function calcPlanPricing(opts: {
  planCode: string;
  seats: number;
  periodicity?: Periodicity;
}) {
  const plan = getPlan(opts.planCode);
  if (!plan || plan.isEnterprise) {
    return { amountHT: null, tva: null, ttc: null, isEnterprise: true as const, priceTTCPerSeat: null, discount: 0, months: 1 };
  }
  const pd = getPeriodicity(opts.periodicity ?? "monthly");
  const discountedTTCPerSeat = Math.round(plan.monthlyPriceTTC * (1 - pd.discount));
  const totalTTC = discountedTTCPerSeat * opts.seats;
  const totalHT  = Math.round(totalTTC / (1 + TVA_RATE));
  const tva      = totalTTC - totalHT;
  return {
    amountHT:       totalHT,
    tva,
    ttc:            totalTTC,
    isEnterprise:   false as const,
    priceTTCPerSeat: discountedTTCPerSeat,
    discount:       pd.discount,
    months:         pd.months,
  };
}

/**
 * Prix annuel par siège (prix mensuel × 12 × remise annuelle).
 * Utilisé pour afficher le prix annualisé sur les cartes.
 */
export function annualPricePerSeat(planCode: string): number | null {
  const plan = getPlan(planCode);
  if (!plan || plan.isEnterprise) return null;
  const annualDiscount = PERIODICITY_OPTIONS.find(p => p.value === "annual")!.discount;
  return Math.round(plan.monthlyPriceTTC * (1 - annualDiscount));
}
