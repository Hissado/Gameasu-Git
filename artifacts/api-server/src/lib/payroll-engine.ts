/**
 * Moteur de calcul paie Gameasu — Source unique de vérité
 *
 * Formules conformes au modèle Excel de référence (feuille SALAIRES)
 * et au Code Général des Impôts du Togo.
 *
 * Règles fondamentales (validées colonne par colonne vs Excel) :
 *
 *  AX - CNSS salarié       : Brut × 9 %
 *  AY - Base après CNSS    : Brut − AX
 *  AZ - Abattement 28 %    : AY × 0,28
 *  BA - Base imposable      : AY − AZ − (nbPersonnesCharge × 10 000 FCFA/mois)
 *  BB - Base arrondie       : ROUNDDOWN(BA, −3)  → millier inférieur
 *  BC - IRPP                : barème progressif mensuel 8 tranches (CGI Togo)
 *  BD - Total retenues      : AX + BC
 *  BE - Salaire net         : Brut − BD
 *  BF - CNSS patronal       : Brut × 22,5 %
 *  BG - Provision congés    : (Brut + BF) / 30 × 2,5
 *  BH - Coût total employeur: Brut + BF + BG
 *
 *  IRPP — barème mensuel CGI Togo (seuils = annuel ÷ 12) :
 *    ≤ 75 000              → 0 %
 *    75 001 – 250 000      → 3 %
 *    250 001 – 500 000     → 10 %
 *    500 001 – 750 000     → 15 %
 *    750 001 – 1 000 000   → 20 %
 *    1 000 001 – 1 250 000 → 25 %
 *    1 250 001 – 1 666 667 → 30 %
 *    > 1 666 667           → 35 %
 *
 *  Note : les seuils mensuels × 12 donnent les seuils annuels CGI :
 *    0 / 900K / 3M / 6M / 9M / 12M / 15M / 20M / +∞
 */

// ─── Barème IRPP Togo — seuils MENSUELS (XOF) ────────────────────────────────
// Source : feuille SALAIRES, cellule BC + note "seuils annuels ÷ 12"
// Validé : base 86 000 FCFA/mois → IRPP = (86 000 − 75 000) × 3 % = 330 FCFA ✓
export const IRPP_BRACKETS_TOGO_MENSUEL = [
  { up:          75_000, rate: 0    },  // 0 %   — exonéré
  { up:         250_000, rate: 0.03 },  // 3 %   — tranche 2
  { up:         500_000, rate: 0.10 },  // 10 %  — tranche 3
  { up:         750_000, rate: 0.15 },  // 15 %  — tranche 4
  { up:       1_000_000, rate: 0.20 },  // 20 %  — tranche 5
  { up:       1_250_000, rate: 0.25 },  // 25 %  — tranche 6
  { up:       1_666_667, rate: 0.30 },  // 30 %  — tranche 7
  { up: Infinity,        rate: 0.35 },  // 35 %  — tranche 8
] as const;

// Alias annuels pour l'API (× 12) — compatibilité irppBracketsTable
export const IRPP_BRACKETS_TOGO_ANNUEL = IRPP_BRACKETS_TOGO_MENSUEL.map(b => ({
  up:   b.up === Infinity ? Infinity : b.up * 12,
  rate: b.rate,
}));

// ─── Taux légaux Togo ─────────────────────────────────────────────────────────
export const TAUX_TOGO = {
  cnss_salarie:       0.09,   // 9 %  — AX = Brut × 9 %
  cnss_patronal:      0.225,  // 22,5 % — BF = Brut × 22,5 %  (CNSS + AT/MP + Famille)
  /** Abattement forfaitaire appliqué à (Brut − CNSS) pour obtenir la base imposable.
   *  28 % = frais professionnels (20 %) + déductions légales (8 %) — CGI Togo. */
  abattement_base:    0.28,
  /** Déduction mensuelle par personne à charge (colonne G, max 6 personnes).
   *  Source : feuille SALAIRES col. BA — 10 000 FCFA/mois/personne. */
  deduction_charge:   10_000,
  smig:               35_000, // SMIG mensuel FCFA
};

// ─── Barème versionné (table unique de règles) ───────────────────────────────
// Le moteur lit un `PayrollScale` : soit le barème actif en base
// (`payroll_rate_scales`, paramétrable par organisation avec dates d'effet),
// soit le barème national intégré ci-dessous. TOUT calcul de paie de
// l'application doit passer par ce moteur — aucun taux ne doit être codé en
// dur ailleurs (routes, exports, frontend).

export interface PayrollScaleBracket {
  /** Plafond mensuel de la tranche (null = dernière tranche, sans plafond). */
  up: number | null;
  rate: number;
}

export interface PayrollScale {
  version: string;               // ex. "TG-2026.01"
  country: string;               // ISO-3166 alpha-2
  regime: string;                // "general" (extensible : régimes sectoriels)
  cnssEmployeeRate: number;      // part salariale CNSS (0.09 = 9 %)
  cnssEmployerRate: number;      // part patronale (0.225 = 22,5 %)
  abatementRate: number;         // abattement base imposable (0.28 = 28 %)
  dependentDeduction: number;    // FCFA/mois/personne à charge
  smig: number;                  // SMIG mensuel FCFA
  iptsRate: number;              // 0 au Togo : l'IRPP couvre les salaires
  irppBracketsMonthly: PayrollScaleBracket[];
}

/** Barème national par défaut (Togo) — repli si aucun barème actif en base. */
export const DEFAULT_SCALE_TG: PayrollScale = {
  version: "TG-2026.01",
  country: "TG",
  regime: "general",
  cnssEmployeeRate: TAUX_TOGO.cnss_salarie,
  cnssEmployerRate: TAUX_TOGO.cnss_patronal,
  abatementRate: TAUX_TOGO.abattement_base,
  dependentDeduction: TAUX_TOGO.deduction_charge,
  smig: TAUX_TOGO.smig,
  iptsRate: 0,
  irppBracketsMonthly: IRPP_BRACKETS_TOGO_MENSUEL.map((b) => ({
    up: b.up === Infinity ? null : b.up,
    rate: b.rate,
  })),
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
  cnssEmployee: number;         // AX : Brut × 9 %
  baseApresAbattement: number;  // AY - AZ : (Brut − CNSS) × 72 %
  deductionCharges: number;     // nbPersonnes × 10 000 FCFA/mois
  baseImposableMensuel: number; // BB : ROUNDDOWN(BA, −3)
  irppMensuel: number;          // BC : barème progressif mensuel
  totalRetenues: number;        // BD : CNSS + IRPP
  net: number;                  // BE : Brut − BD
  // Employeur
  cnssEmployer: number;         // BF : Brut × 22,5 %
  provisionConges: number;      // BG : (Brut + BF) / 30 × 2,5
  coutEmployeurMensuel: number; // BH : Brut + BF + BG
  coutEmployeurAnnuel: number;
  // Méta
  alerts: string[];
  irppDetail: IrppTranche[];
  convergenceEcart?: number;
}

// ─── Calcul IRPP mensuel ──────────────────────────────────────────────────────

/**
 * Calcule l'IRPP **mensuel** selon le barème progressif CGI Togo (8 tranches).
 * @param baseMensuelle  Base imposable mensuelle (BB = ROUNDDOWN) en FCFA
 */
export function calcIrppMensuel(
  baseMensuelle: number,
  brackets: ReadonlyArray<{ up: number | null; rate: number }> = DEFAULT_SCALE_TG.irppBracketsMonthly,
): { irpp: number; detail: IrppTranche[] } {
  const base = Math.max(0, baseMensuelle);
  let tax = 0;
  let prev = 0;
  const detail: IrppTranche[] = [];

  for (const { up: upRaw, rate } of brackets) {
    const up = upRaw ?? Infinity;
    if (base <= prev) break;
    const plafond = up === Infinity ? base : up;
    const slice   = Math.min(base, plafond) - prev;
    const sliceTax = Math.round(slice * rate);
    if (slice > 0 && rate > 0) {
      const prevFmt = prev.toLocaleString("fr-FR");
      const upFmt   = up === Infinity ? "+" : up.toLocaleString("fr-FR");
      detail.push({
        label:   up === Infinity ? `Au-delà de ${prevFmt} FCFA` : `De ${prevFmt} à ${upFmt} FCFA`,
        base:    slice,
        taux:    rate * 100,
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
 * Chaîne de calcul conforme au modèle Excel (feuille SALAIRES) :
 *   AX = Brut × 9 %
 *   AY = Brut − AX
 *   AZ = AY × 28 %
 *   BA = AY − AZ − (nbPersonnesCharge × 10 000)
 *   BB = ROUNDDOWN(BA, −3)
 *   BC = barème progressif mensuel appliqué à BB
 *   BD = AX + BC
 *   BE = Brut − BD
 *   BF = Brut × 22,5 %
 *   BG = (Brut + BF) / 30 × 2,5
 *   BH = Brut + BF + BG
 *
 * @param brut               Salaire brut mensuel
 * @param nbPersonnesCharge  Nombre de personnes à charge (max 6 — col. G SALAIRES)
 */
export function brutVersNet(
  brut: number,
  nbPersonnesCharge = 0,
  scale: PayrollScale = DEFAULT_SCALE_TG,
): PayrollDetail {
  const nbCharge = Math.min(6, Math.max(0, Math.round(nbPersonnesCharge)));

  // AX — Cotisations salariales CNSS (9 %)
  const cnssEmployee = Math.round(brut * scale.cnssEmployeeRate);

  // AY — Assiette après CNSS
  const ay = brut - cnssEmployee;

  // AZ — Abattement 28 %
  const az = ay * scale.abatementRate;

  // BA — Base avant arrondi : AY − AZ − déductions charges
  const deductionCharges = nbCharge * scale.dependentDeduction;
  const ba = ay - az - deductionCharges;  // = AY × 72 % − charges

  // BB — Base imposable arrondie au millier inférieur
  const baseImposableMensuel = Math.max(0, Math.floor(ba / 1000) * 1000);

  // Partie non arrondie utilisée pour affichage (AY − AZ)
  const baseApresAbattement = Math.round(ay - az);

  // BC — IRPP mensuel (barème progressif)
  const { irpp: irppMensuel, detail } = calcIrppMensuel(baseImposableMensuel, scale.irppBracketsMonthly);

  // BD — Total retenues légales
  const totalRetenues = cnssEmployee + irppMensuel;

  // BE — Salaire net
  const net = brut - totalRetenues;

  // BF — CNSS patronal (22,5 %)
  const cnssEmployer = Math.round(brut * scale.cnssEmployerRate);

  // BG — Provision congés payés : (Brut + CNSS patron) / 30 × 2,5
  const provisionConges = Math.round((brut + cnssEmployer) / 30 * 2.5);

  // BH — Coût total employeur
  const coutEmployeurMensuel = brut + cnssEmployer + provisionConges;

  const alerts: string[] = [];
  if (brut > 0 && brut < scale.smig) {
    alerts.push(`Salaire brut inférieur au SMIG (${scale.smig.toLocaleString("fr-FR")} FCFA/mois).`);
  }

  return {
    brut,
    cnssEmployee,
    baseApresAbattement,
    deductionCharges,
    baseImposableMensuel,
    irppMensuel,
    totalRetenues,
    net,
    cnssEmployer,
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
  nbPersonnesCharge = 0,
  scale: PayrollScale = DEFAULT_SCALE_TG,
): PayrollDetail {
  if (netSouhaite <= 0) return brutVersNet(0, nbPersonnesCharge, scale);

  let brut = netSouhaite / (1 - scale.cnssEmployeeRate);
  for (let i = 0; i < 300; i++) {
    const r = brutVersNet(brut, nbPersonnesCharge, scale);
    const ecart = netSouhaite - r.net;
    if (Math.abs(ecart) < 0.5) break;
    brut += ecart * 0.9;
  }
  brut = Math.round(brut);
  const result = brutVersNet(brut, nbPersonnesCharge, scale);
  return { ...result, convergenceEcart: Math.abs(netSouhaite - result.net) };
}

// ─── Barème formaté pour API (compatible irppBracketsTable) ──────────────────

export const DEFAULT_IRPP_BRACKETS_API = IRPP_BRACKETS_TOGO_MENSUEL.map((b, i) => ({
  fromAmount: i === 0 ? 0 : IRPP_BRACKETS_TOGO_MENSUEL[i - 1].up,
  toAmount:   b.up === Infinity ? null : b.up,
  rate:       b.rate,
  sortOrder:  i,
}));

// ─── Barème actif (base de données, repli barème national) ──────────────────

/**
 * Charge le barème de paie actif pour une organisation à une date donnée.
 * Priorité : barème propre à l'organisation > barème national (organizationId
 * NULL) > barème intégré `DEFAULT_SCALE_TG`. La table peut ne pas encore
 * exister (migration non appliquée) : le repli intégré garantit le service.
 */
export async function getActivePayrollScale(
  organizationId?: string,
  forDate?: string,
): Promise<PayrollScale & { source: "organization" | "national" | "builtin" }> {
  const target = forDate ?? new Date().toISOString().slice(0, 10);
  try {
    const { db, payrollRateScalesTable } = await import("@workspace/db");
    const { and, eq, isNull, lte, sql, desc } = await import("drizzle-orm");
    const activeCond = and(
      eq(payrollRateScalesTable.regime, "general"),
      lte(payrollRateScalesTable.effectiveFrom, target),
      sql`(${payrollRateScalesTable.effectiveTo} IS NULL OR ${payrollRateScalesTable.effectiveTo} >= ${target})`,
    );
    const pick = async (orgCond: ReturnType<typeof eq> | ReturnType<typeof isNull>) => {
      const rows = await db.select().from(payrollRateScalesTable)
        .where(and(activeCond, orgCond))
        .orderBy(desc(payrollRateScalesTable.effectiveFrom))
        .limit(1);
      return rows[0];
    };
    const row = (organizationId ? await pick(eq(payrollRateScalesTable.organizationId, organizationId)) : undefined)
      ?? await pick(isNull(payrollRateScalesTable.organizationId));
    if (row) {
      return {
        version: row.version,
        country: row.country,
        regime: row.regime,
        cnssEmployeeRate: Number(row.cnssEmployeeRate),
        cnssEmployerRate: Number(row.cnssEmployerRate),
        abatementRate: Number(row.abatementRate),
        dependentDeduction: Number(row.dependentDeduction),
        smig: Number(row.smig),
        iptsRate: Number(row.iptsRate),
        irppBracketsMonthly: (row.irppBrackets ?? DEFAULT_SCALE_TG.irppBracketsMonthly) as PayrollScaleBracket[],
        source: row.organizationId ? "organization" : "national",
      };
    }
  } catch {
    // Table absente ou base indisponible : repli sur le barème intégré.
  }
  return { ...DEFAULT_SCALE_TG, source: "builtin" };
}

// ─── Montants de bulletin (forme attendue par les cycles de paie) ────────────

export interface PayslipAmounts {
  cnssEmployee: number;
  cnssEmployer: number;
  irpp: number;
  ipts: number;
  netSalary: number;
}

/**
 * Calcule les montants d'un bulletin à partir du brut — UNIQUE point d'entrée
 * pour les cycles de paie, bulletins, simulateurs, exports et comptabilité.
 * L'IPTS n'existe pas au Togo pour les salaires (couverts par l'IRPP) : il ne
 * devient non nul que si le barème actif définit un `iptsRate` explicite.
 */
export function computePayslipAmounts(
  grossSalary: number,
  opts: { dependents?: number; scale?: PayrollScale } = {},
): PayslipAmounts {
  const scale = opts.scale ?? DEFAULT_SCALE_TG;
  const r = brutVersNet(grossSalary, opts.dependents ?? 0, scale);
  const ipts = Math.round(grossSalary * scale.iptsRate);
  return {
    cnssEmployee: r.cnssEmployee,
    cnssEmployer: r.cnssEmployer,
    irpp: r.irppMensuel,
    ipts,
    netSalary: r.net - ipts,
  };
}

// ─── Compat. ancienne signature (nbParts / reductionParPart → nbPersonnesCharge) ─
// Conservé pour ne pas casser les imports existants dans payroll.ts
export function calcIrppAnnuel(
  revenuAnnuelImposable: number,
  nbParts = 0,
): { irpp: number; detail: IrppTranche[] } {
  const baseMensuelle = Math.max(0, Math.floor(revenuAnnuelImposable / 12 / 1000) * 1000);
  const { irpp, detail } = calcIrppMensuel(baseMensuelle);
  // Retourne l'annuel pour compatibilité
  return {
    irpp: irpp * 12,
    detail: detail.map(d => ({ ...d, base: d.base * 12, montant: d.montant * 12 })),
  };
}
