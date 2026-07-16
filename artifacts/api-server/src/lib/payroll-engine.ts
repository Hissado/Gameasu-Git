/**
 * Moteur de calcul paie Gaméasù — Source unique de vérité
 *
 * Formules conformes au CGI Togo et validées contre le modèle Excel de référence.
 *
 * Règles fondamentales :
 *  - CNSS salarial     : 9 % du brut
 *  - CNSS patronal     : 16,4 % du brut (taux légal Togo)
 *  - Charges patronales totales (simulation) : 22,5 % du brut
 *  - Provision congés  : 10,22 % du brut  (30 jours / an)
 *  - Base imposable IRPP (mensuelle) :
 *      floor(Brut × 91 % × 72 % / 1000) × 1000
 *      (91 % = après CNSS 9 %, 72 % = après abattements combinés 28 %)
 *  - IRPP : barème progressif 8 tranches CGI Togo, annualisé puis / 12
 *  - Pas d'IPTS séparé : intégré dans l'abattement combiné de 28 %
 */

// ─── Barème IRPP Togo — 8 tranches (annuel en XOF) ───────────────────────────
// Conforme au Code Général des Impôts (CGI) du Togo
// Validé : base 1 032 000 FCFA/an → 3 960 FCFA/an = 330 FCFA/mois ✓
export const IRPP_BRACKETS_TOGO = [
  { up: 900_000,    rate: 0    },   // exonéré
  { up: 1_200_000,  rate: 0.03 },   // 3 %
  { up: 2_500_000,  rate: 0.07 },   // 7 %
  { up: 4_000_000,  rate: 0.11 },   // 11 %
  { up: 6_000_000,  rate: 0.15 },   // 15 %
  { up: 10_000_000, rate: 0.20 },   // 20 %
  { up: 15_000_000, rate: 0.25 },   // 25 %
  { up: Infinity,   rate: 0.30 },   // 30 %
] as const;

// ─── Taux légaux Togo ─────────────────────────────────────────────────────────
export const TAUX_TOGO = {
  cnss_salarie:      0.09,   // 9 % cotisations salariales
  cnss_patronal:     0.164,  // 16,4 % CNSS patronal (légal)
  charges_patronales: 0.225, // 22,5 % charges patronales totales (simulation)
  conges:            0.1022, // 10,22 % provision congés payés
  /** Abattement combiné appliqué au net-CNSS pour obtenir la base imposable.
   *  28 % = abattement forfaitaire frais pro (20 %) + déductions légales (8 %)
   *  Résultat : Brut × 91 % × 72 % arrondi au millier vers le bas. */
  abattement_base:   0.28,
  smig:              35_000, // SMIG mensuel FCFA
  reduction_par_part: 15_000, // FCFA/an de réduction IRPP par part fiscale
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IrppTranche {
  label: string;
  base: number;
  taux: number;
  montant: number;
}

export interface PayrollDetail {
  brut: number;
  cnssEmployee: number;      // 9 % du brut
  baseImposableMensuel: number;  // floor(brut × 91 % × 72 % / 1 000) × 1 000
  irppAnnuel: number;
  irppMensuel: number;
  net: number;               // brut − CNSS − IRPP mensuel
  // Employeur
  cnssEmployer: number;      // 16,4 % CNSS patronal (légal)
  chargesPatronales: number; // 22,5 % total (simulation)
  provisionConges: number;   // 10,22 %
  coutEmployeurMensuel: number;  // brut + chargesPatronales + provisionConges
  coutEmployeurAnnuel: number;
  // Méta
  alerts: string[];
  irppDetail: IrppTranche[];
  convergenceEcart?: number;
}

// ─── Calcul de l'IRPP annuel ─────────────────────────────────────────────────

/**
 * Calcule l'IRPP annuel selon le barème progressif CGI Togo (8 tranches).
 * @param revenuAnnuelImposable  Base imposable annuelle en FCFA
 * @param nbParts                Nombre de parts fiscales (personnes à charge)
 * @param reductionParPart       Réduction en FCFA/an par part (défaut 15 000)
 */
export function calcIrppAnnuel(
  revenuAnnuelImposable: number,
  nbParts = 0,
  reductionParPart = TAUX_TOGO.reduction_par_part,
): { irpp: number; detail: IrppTranche[] } {
  const reduction = nbParts * reductionParPart;
  const base = Math.max(0, revenuAnnuelImposable - reduction);
  let tax = 0;
  let prev = 0;
  const detail: IrppTranche[] = [];
  for (const { up, rate } of IRPP_BRACKETS_TOGO) {
    if (base <= prev) break;
    const plafond = up === Infinity ? base : up;
    const slice = Math.min(base, plafond) - prev;
    const sliceTax = Math.round(slice * rate);
    if (slice > 0 && rate > 0) {
      const prevFmt = prev.toLocaleString("fr-FR");
      const upFmt   = up === Infinity ? "+" : up.toLocaleString("fr-FR");
      detail.push({
        label: up === Infinity
          ? `Au-delà de ${prevFmt} FCFA`
          : `De ${prevFmt} à ${upFmt} FCFA`,
        base: slice,
        taux: rate * 100,
        montant: sliceTax,
      });
    }
    tax += sliceTax;
    prev = plafond;
  }
  return { irpp: Math.round(tax), detail };
}

// ─── Brut → Net ──────────────────────────────────────────────────────────────

/**
 * Calcule toutes les charges à partir du salaire brut.
 *
 * Base imposable mensuelle = floor(Brut × 91 % × 72 % / 1 000) × 1 000
 * — conforme à la formule "Brut × 91 % × 72 % arrondi au millier vers le bas"
 *   du modèle Excel de référence (CGI Togo).
 */
export function brutVersNet(
  brut: number,
  nbParts = 0,
  reductionParPart = TAUX_TOGO.reduction_par_part,
): PayrollDetail {
  // Cotisations salariales : 9 %
  const cnssEmployee = Math.round(brut * TAUX_TOGO.cnss_salarie);

  // Base imposable mensuelle — arrondi au millier inférieur
  const baseImposableMensuel = Math.floor(
    brut * (1 - TAUX_TOGO.cnss_salarie) * (1 - TAUX_TOGO.abattement_base) / 1000,
  ) * 1000;

  // IRPP
  const { irpp: irppAnnuel, detail } = calcIrppAnnuel(
    baseImposableMensuel * 12,
    nbParts,
    reductionParPart,
  );
  const irppMensuel = Math.round(irppAnnuel / 12);

  // Net à payer : brut − CNSS − IRPP (pas d'IPTS séparé)
  const net = brut - cnssEmployee - irppMensuel;

  // Charges employeur
  const cnssEmployer       = Math.round(brut * TAUX_TOGO.cnss_patronal);
  const chargesPatronales  = Math.round(brut * TAUX_TOGO.charges_patronales);
  const provisionConges    = Math.round(brut * TAUX_TOGO.conges);
  const coutEmployeurMensuel = brut + chargesPatronales + provisionConges;

  const alerts: string[] = [];
  if (brut > 0 && brut < TAUX_TOGO.smig) {
    alerts.push(`Salaire brut inférieur au SMIG (${TAUX_TOGO.smig.toLocaleString("fr-FR")} FCFA/mois).`);
  }

  return {
    brut,
    cnssEmployee,
    baseImposableMensuel,
    irppAnnuel,
    irppMensuel,
    net,
    cnssEmployer,
    chargesPatronales,
    provisionConges,
    coutEmployeurMensuel,
    coutEmployeurAnnuel: coutEmployeurMensuel * 12,
    alerts,
    irppDetail: detail,
  };
}

// ─── Net → Brut ──────────────────────────────────────────────────────────────

/**
 * Trouve le salaire brut correspondant à un net souhaité.
 * Algorithme itératif convergent (300 passes, amortissement 90 %).
 */
export function netVersBrut(
  netSouhaite: number,
  nbParts = 0,
  reductionParPart = TAUX_TOGO.reduction_par_part,
): PayrollDetail {
  if (netSouhaite <= 0) return brutVersNet(0, nbParts, reductionParPart);

  // Estimation initiale : net / (1 − CNSS%) — sans IRPP
  let brut = netSouhaite / (1 - TAUX_TOGO.cnss_salarie);
  let ecart = 0;
  for (let i = 0; i < 300; i++) {
    const r = brutVersNet(brut, nbParts, reductionParPart);
    ecart = netSouhaite - r.net;
    if (Math.abs(ecart) < 0.5) break;
    brut += ecart * 0.9;
  }
  brut = Math.round(brut);
  const result = brutVersNet(brut, nbParts, reductionParPart);
  return { ...result, convergenceEcart: Math.abs(netSouhaite - result.net) };
}

// ─── Barème formaté pour API (compatible irppBracketsTable) ──────────────────

export const DEFAULT_IRPP_BRACKETS_API = IRPP_BRACKETS_TOGO.map((b, i) => ({
  fromAmount: i === 0 ? 0 : IRPP_BRACKETS_TOGO[i - 1].up,
  toAmount: b.up === Infinity ? null : b.up,
  rate: b.rate,
  sortOrder: i,
}));
