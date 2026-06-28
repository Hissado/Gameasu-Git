/**
 * Moteur de tarification Gameasu — modèle dégressif par utilisateur.
 *
 * Paliers HT (FCFA) :
 *   1er utilisateur       → 10 000
 *   2e–5e utilisateur     → 5 000 / user
 *   6e–10e utilisateur    → 2 000 / user
 *   11e–50e utilisateur   → 1 000 / user
 *   > 50 utilisateurs     → tarification personnalisée (null)
 *
 * TVA : 18 % — appliquée uniquement au checkout.
 * Les montants sont toujours affichés HT avant paiement.
 */

export const TVA_RATE = 0.18;
export const MAX_AUTO_USERS = 50;

export type Pricing = {
  userCount: number;
  amountHT: number;
  tva: number;
  ttc: number;
  isEnterprise: false;
};

export type EnterprisePricing = {
  userCount: number;
  amountHT: null;
  tva: null;
  ttc: null;
  isEnterprise: true;
};

export type PricingResult = Pricing | EnterprisePricing;

/** Calcule le montant HT pour N utilisateurs. Retourne null si > 50. */
export function calcAmountHT(userCount: number): number | null {
  if (userCount > MAX_AUTO_USERS) return null;
  if (userCount < 1) return 0;

  let total = 0;
  // 1er utilisateur
  total += 10_000;
  // 2e–5e (max 4 users)
  const u2to5 = Math.max(0, Math.min(userCount - 1, 4));
  total += u2to5 * 5_000;
  // 6e–10e (max 5 users)
  const u6to10 = Math.max(0, Math.min(userCount - 5, 5));
  total += u6to10 * 2_000;
  // 11e–50e
  const u11to50 = Math.max(0, userCount - 10);
  total += u11to50 * 1_000;

  return total;
}

/** Calcule la ventilation complète HT / TVA / TTC pour N utilisateurs. */
export function calcPricing(userCount: number): PricingResult {
  const amountHT = calcAmountHT(userCount);
  if (amountHT === null) {
    return { userCount, amountHT: null, tva: null, ttc: null, isEnterprise: true };
  }
  const tva = Math.round(amountHT * TVA_RATE);
  const ttc = amountHT + tva;
  return { userCount, amountHT, tva, ttc, isEnterprise: false };
}

/** Grille lisible des paliers pour affichage en frontend. */
export const PRICING_TIERS = [
  { label: "1er utilisateur",      range: "1",     unitPrice: 10_000 },
  { label: "2e – 5e utilisateur",  range: "2–5",   unitPrice: 5_000 },
  { label: "6e – 10e utilisateur", range: "6–10",  unitPrice: 2_000 },
  { label: "11e – 50e utilisateur",range: "11–50", unitPrice: 1_000 },
  { label: "Plus de 50 utilisateurs", range: "50+", unitPrice: null },
] as const;
