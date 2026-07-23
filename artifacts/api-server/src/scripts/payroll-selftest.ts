/**
 * Tests de non-régression du MOTEUR DE PAIE UNIQUE (audit P0.4 / phase 4.5).
 * Cas de référence exécutables sans base de données (barème intégré TG-2026.01).
 *
 * Exécution : pnpm --filter @workspace/api-server run test:payroll
 * Échec → code de sortie 1 (utilisable en CI).
 */
import {
  brutVersNet,
  netVersBrut,
  computePayslipAmounts,
  DEFAULT_SCALE_TG,
  TAUX_TOGO,
} from "../lib/payroll-engine";

let failures = 0;
function check(label: string, actual: number, expected: number, tolerance = 0) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) {
    failures++;
    console.error(`✘ ${label} : attendu ${expected}, obtenu ${actual}`);
  } else {
    console.log(`✔ ${label} = ${actual}`);
  }
}
function checkTrue(label: string, cond: boolean) {
  if (!cond) { failures++; console.error(`✘ ${label}`); }
  else console.log(`✔ ${label}`);
}

// ── Cas 1 — Référence validée contre le modèle Excel (feuille SALAIRES) ──────
// Base imposable 86 000 → IRPP = (86 000 − 75 000) × 3 % = 330 FCFA.
// Brut correspondant : base = ROUNDDOWN((Brut × 0,91) × 0,72, −3) = 86 000
// pour Brut = 131 500 (0 personne à charge).
{
  const r = brutVersNet(131_500, 0);
  check("Cas 1 — CNSS salarié (9 % de 131 500)", r.cnssEmployee, Math.round(131_500 * TAUX_TOGO.cnss_salarie));
  check("Cas 1 — base imposable arrondie au millier", r.baseImposableMensuel, 86_000);
  check("Cas 1 — IRPP barème (tranche 3 %)", r.irppMensuel, 330);
  check("Cas 1 — net = brut − CNSS − IRPP", r.net, 131_500 - r.cnssEmployee - 330);
  check("Cas 1 — CNSS patronal (22,5 %)", r.cnssEmployer, Math.round(131_500 * TAUX_TOGO.cnss_patronal));
}

// ── Cas 2 — Salaire sous le SMIG : alerte émise, IRPP nul ────────────────────
{
  const r = brutVersNet(30_000, 0);
  checkTrue("Cas 2 — alerte SMIG présente", r.alerts.length > 0);
  check("Cas 2 — IRPP nul (base sous 75 000)", r.irppMensuel, 0);
  check("Cas 2 — net = brut − CNSS", r.net, 30_000 - Math.round(30_000 * 0.09));
}

// ── Cas 3 — Salaire élevé : toutes les tranches, cohérence interne ───────────
{
  const brut = 2_500_000;
  const r = brutVersNet(brut, 0);
  check("Cas 3 — identité net + retenues = brut", r.net + r.totalRetenues, brut);
  checkTrue("Cas 3 — IRPP progressif > 0", r.irppMensuel > 0);
  checkTrue("Cas 3 — détail des tranches fourni (transparence §4.4)", r.irppDetail.length >= 4);
}

// ── Cas 4 — Personnes à charge : l'IRPP baisse, jamais négatif ───────────────
{
  const sans = brutVersNet(400_000, 0);
  const avec = brutVersNet(400_000, 3);
  checkTrue("Cas 4 — IRPP réduit avec 3 personnes à charge", avec.irppMensuel < sans.irppMensuel);
  checkTrue("Cas 4 — IRPP jamais négatif", avec.irppMensuel >= 0);
  check("Cas 4 — déduction appliquée (3 × 10 000)", avec.deductionCharges, 30_000);
}

// ── Cas 5 — Net → Brut : convergence de l'inversion ─────────────────────────
{
  const cible = 350_000;
  const r = netVersBrut(cible, 0);
  checkTrue(`Cas 5 — netVersBrut converge (écart ${r.convergenceEcart})`, (r.convergenceEcart ?? 99) <= 1);
  const verif = brutVersNet(r.brut, 0);
  check("Cas 5 — aller-retour brut→net", verif.net, r.net);
}

// ── Cas 6 — computePayslipAmounts : identité comptable du bulletin ──────────
// C'est CETTE identité qui garantit l'équilibre de l'écriture de paie
// (postPayrollRun) : brut + patronal = net + CNSS(sal+pat) + IRPP + IPTS.
{
  for (const brut of [85_000, 131_500, 250_000, 400_000, 1_000_000, 2_500_000]) {
    const a = computePayslipAmounts(brut);
    const debits = brut + a.cnssEmployer;
    const credits = a.netSalary + a.cnssEmployee + a.cnssEmployer + a.irpp + a.ipts;
    check(`Cas 6 — équilibre débit/crédit pour brut ${brut}`, debits, credits);
  }
}

// ── Cas 7 — Barème par défaut : IPTS nul (couvert par l'IRPP au Togo) ────────
{
  const a = computePayslipAmounts(500_000);
  check("Cas 7 — IPTS nul dans le barème TG par défaut", a.ipts, 0);
  checkTrue("Cas 7 — version du barème renseignée", DEFAULT_SCALE_TG.version.length > 0);
}

// ── Cas 8 — Barème personnalisé : les taux de la table sont bien appliqués ───
{
  const custom = { ...DEFAULT_SCALE_TG, cnssEmployeeRate: 0.04, cnssEmployerRate: 0.164, iptsRate: 0.02 };
  const a = computePayslipAmounts(300_000, { scale: custom });
  check("Cas 8 — CNSS salarié au taux du barème (4 %)", a.cnssEmployee, Math.round(300_000 * 0.04));
  check("Cas 8 — IPTS au taux du barème (2 %)", a.ipts, Math.round(300_000 * 0.02));
  const debits = 300_000 + a.cnssEmployer;
  const credits = a.netSalary + a.cnssEmployee + a.cnssEmployer + a.irpp + a.ipts;
  check("Cas 8 — équilibre conservé avec barème personnalisé", debits, credits);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) en échec.`);
  process.exit(1);
}
console.log("\nTous les tests de non-régression paie passent.");
