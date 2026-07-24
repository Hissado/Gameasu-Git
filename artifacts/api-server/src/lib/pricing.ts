/**
 * Moteur de tarification Gameasu — source de vérité centralisée.
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
 *
 * TVA : 18 % incluse dans les prix affichés TTC.
 */

export const TVA_RATE = 0.18;

export const PERIODICITY_DISCOUNTS = {
  monthly:    { label: "Mensuel",     discount: 0,    months: 1  },
  quarterly:  { label: "Trimestriel", discount: 0.10, months: 3  },
  semiannual: { label: "Semestriel",  discount: 0.15, months: 6  },
  annual:     { label: "Annuel",      discount: 0.20, months: 12 },
} as const;

export type Periodicity = keyof typeof PERIODICITY_DISCOUNTS;

export const PLAN_CATALOG = [
  {
    code: "STARTER",
    name: "Starter",
    tagline: "Démarrer simplement",
    description: "Pour les petites équipes qui structurent leur activité.",
    monthlyPriceTTC: 4_000,
    moduleCount: 7,
    maxSeats: null as number | null,
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
    description: "Pour les organisations en expansion qui veulent vendre et facturer.",
    monthlyPriceTTC: 7_000,
    moduleCount: 15,
    maxSeats: null as number | null,
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
    description: "Pour les structures multi-services qui pilotent finance et opérations.",
    monthlyPriceTTC: 10_000,
    moduleCount: 24,
    maxSeats: null as number | null,
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
    description: "Pour les groupes et grandes organisations à exigences avancées.",
    monthlyPriceTTC: 0,
    moduleCount: null as number | null,
    maxSeats: null as number | null,
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

/** Retrouve un plan par son code (insensible à la casse). */
export function getPlan(code: string) {
  return PLAN_CATALOG.find(p => p.code === code.toUpperCase()) ?? null;
}

/**
 * Calcule le détail HT / TVA / TTC pour un plan, un nombre de sièges
 * et une périodicité.
 */
export function calcPlanPricing(opts: {
  planCode: string;
  seats: number;
  periodicity?: Periodicity;
}): {
  priceTTCPerSeat: number;
  priceHTPerSeat:  number;
  totalHT:         number;
  tva:             number;
  totalTTC:        number;
  discount:        number;
  months:          number;
  isEnterprise:    false;
} | null {
  const plan = getPlan(opts.planCode);
  if (!plan || plan.isEnterprise || Number(plan.monthlyPriceTTC) === 0) return null;

  const pd = PERIODICITY_DISCOUNTS[opts.periodicity ?? "monthly"];
  const discountedTTCPerSeat = Math.round(plan.monthlyPriceTTC * (1 - pd.discount));
  const totalTTC = discountedTTCPerSeat * opts.seats * pd.months;
  const totalHT  = Math.round(totalTTC / (1 + TVA_RATE));
  const tva      = totalTTC - totalHT;

  return {
    priceTTCPerSeat: discountedTTCPerSeat,
    priceHTPerSeat:  Math.round(discountedTTCPerSeat / (1 + TVA_RATE)),
    totalHT,
    tva,
    totalTTC,
    discount:  pd.discount,
    months:    pd.months,
    isEnterprise: false,
  };
}

// ─── Compatibilité arrière ────────────────────────────────────────
// Les fonctions suivantes sont conservées pour les routes qui les importent.
// Elles utilisent maintenant le modèle plan-based (PREMIUM par défaut).

export const MAX_AUTO_USERS = 100;

export type Pricing = {
  userCount: number; amountHT: number; tva: number; ttc: number; isEnterprise: false;
};
export type EnterprisePricing = {
  userCount: number; amountHT: null; tva: null; ttc: null; isEnterprise: true;
};
export type PricingResult = Pricing | EnterprisePricing;

/** Calcule le montant HT mensuel pour N sièges sur un plan donné. */
export function calcAmountHT(seats: number, planCode = "PREMIUM"): number | null {
  const plan = getPlan(planCode);
  if (!plan || plan.isEnterprise) return null;
  const priceHT = Math.round(plan.monthlyPriceTTC / (1 + TVA_RATE));
  return priceHT * seats;
}

/** Calcule HT + TVA + TTC pour N sièges. */
export function calcPricing(seats: number, planCode = "PREMIUM"): PricingResult {
  const amountHT = calcAmountHT(seats, planCode);
  if (amountHT === null) {
    return { userCount: seats, amountHT: null, tva: null, ttc: null, isEnterprise: true };
  }
  const tva = Math.round(amountHT * TVA_RATE);
  return { userCount: seats, amountHT, tva, ttc: amountHT + tva, isEnterprise: false };
}

/** Grille des plans pour affichage en frontend. */
export const PRICING_TIERS = PLAN_CATALOG.map(p => ({
  code:       p.code,
  label:      p.name,
  unitPrice:  p.isEnterprise ? null : p.monthlyPriceTTC,
  moduleCount: p.moduleCount,
  badge:      p.badge,
}));
