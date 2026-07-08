/**
 * Seed données de démonstration — Module Contrôle fiscal préalable
 * Rattaché exclusivement à Hissado Consulting (orgId passé en paramètre).
 *
 * 7 scénarios couvrant tous les statuts :
 *   1. TVA Juin 2025       → Prêt à soumettre  (score 94, sans anomalie bloquante)
 *   2. TVA Mai 2025        → Corrections requises (TVA incohérente — bloquant)
 *   3. TVA Avr 2025        → En vérification   (justificatifs partiels)
 *   4. IS Exercice 2024    → Soumis             (IS annuel, toutes anomalies résolues)
 *   5. Retenues T1 2025    → Corrections requises (doublon bloquant)
 *   6. TVA Mars 2025       → Conforme           (corrigée, history complète)
 *   7. TVA Juil 2025       → Brouillon          (en cours de saisie)
 *
 * Idempotent : skip si déjà semé (détecte via `fiscal_declarations` pour cet orgId).
 */

import { db } from "./index";
import { eq, and } from "drizzle-orm";
import {
  fiscalDeclarationsTable,
  fiscalAnomaliesTable,
  fiscalChecksTable,
  fiscalDeclarationHistoryTable,
  fiscalSettingsTable,
  usersTable,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DT = (yyyy: number, mm: number, dd: number, hh = 10, min = 0) =>
  new Date(`${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);

// 12 points de contrôle standard à insérer pour chaque déclaration
const ALL_CHECKS = [
  { code: "vat_consistency",          label: "Cohérence TVA collectée / ventes" },
  { code: "vat_deductible_justified", label: "TVA déductible justifiée" },
  { code: "payment_reconciliation",   label: "Paiements rapprochés" },
  { code: "revenue_consistency",      label: "CA déclaré = CA comptable" },
  { code: "vat_rate_correct",         label: "Taux de TVA corrects" },
  { code: "no_duplicate",            label: "Doublons de déclaration absents" },
  { code: "period_entries",          label: "Écritures dans la bonne période" },
  { code: "fiscal_period_correct",   label: "Période fiscale correcte" },
  { code: "withholding",             label: "Retenues à la source déclarées" },
  { code: "thresholds",              label: "Seuils fiscaux respectés" },
  { code: "notes_present",           label: "Notes explicatives présentes" },
  { code: "responsible_assigned",    label: "Responsable désigné" },
];

function checks(passed: Record<string, { ok: boolean; detail?: string }>): Array<{
  checkCode: string; checkLabel: string; passed: boolean; detail?: string;
}> {
  return ALL_CHECKS.map(c => ({
    checkCode: c.code,
    checkLabel: c.label,
    passed: passed[c.code]?.ok ?? true,
    detail: passed[c.code]?.detail,
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function seedFiscalControl(orgId: string) {
  // Idempotence : skip si déjà semé pour cet org
  const existing = await db.select({ id: fiscalDeclarationsTable.id })
    .from(fiscalDeclarationsTable)
    .where(eq(fiscalDeclarationsTable.organizationId, orgId))
    .limit(1);
  if (existing.length > 0) {
    console.log("  [fiscal-control] déjà semé — skip.");
    return;
  }

  // Récupérer les user IDs Hissado
  const users = await db.select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.organizationId, orgId));

  const byEmail = Object.fromEntries(users.map(u => [u.email, u.id]));
  const finId   = byEmail["finance@hissadoconsulting.com"]!;
  const comptaId = byEmail["compta@hissadoconsulting.com"] ?? finId;
  const dgId    = byEmail["direction@hissadoconsulting.com"]!;
  const auditId = byEmail["audit@hissadoconsulting.com"] ?? finId;

  // ── Paramètres fiscaux Hissado ─────────────────────────────────────────────
  await db.insert(fiscalSettingsTable).values({
    organizationId: orgId,
    country: "TG",
    taxAuthority: "OTR",
    taxAuthorityLabel: "Office Togolais des Recettes (OTR)",
    vatRate: 18,
    withholdingRate: 3,
    fiscalYearStartMonth: 1,
    currency: "XOF",
    updatedById: finId,
  }).onConflictDoNothing();

  // ══════════════════════════════════════════════════════════════════════════
  // SCÉNARIO 1 — TVA Juin 2025 — PRÊT À SOUMETTRE (score 94)
  // ══════════════════════════════════════════════════════════════════════════
  const [s1] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "tva", typeLabel: "TVA",
    period: "2025-06", periodLabel: "Juin 2025",
    status: "pret",
    conformityScore: 94,
    declaredRevenue:        95_500_000,
    declaredVatCollected:   17_190_000,
    declaredVatDeductible:   3_420_000,
    declaredNetVat:         13_770_000,
    dueDate: "2025-07-15",
    notes: "Déclaration TVA mensuelle juin 2025. CA issu des missions de conseil ORABANK, BSIC et NSIA. TVA déductible sur achats informatiques et frais généraux. Aucun avoir sur la période. Vérifiée par Sylvie Kpossou le 14/07/2025.",
    responsibleId: comptaId,
    createdById: comptaId,
    lastCheckedAt: DT(2025, 7, 14, 9, 30),
    createdAt: DT(2025, 7, 1, 8, 0),
    updatedAt: DT(2025, 7, 14, 9, 30),
  }).returning();

  await db.insert(fiscalChecksTable).values(checks({
    vat_consistency:          { ok: true,  detail: "TVA collectée 17 190 000 FCFA — attendue 17 190 000 FCFA (CA × 18%). Écart nul." },
    vat_deductible_justified: { ok: true,  detail: "19 factures fournisseurs, toutes justifiées." },
    payment_reconciliation:   { ok: true,  detail: "Toutes les factures de la période sont lettrées." },
    revenue_consistency:      { ok: true,  detail: "CA déclaré = CA comptable (comptes 70xxx). Écart : 0 FCFA." },
    vat_rate_correct:         { ok: true,  detail: "Taux 18% OTR appliqué sur l'ensemble des lignes." },
    no_duplicate:             { ok: true,  detail: "Aucune autre déclaration TVA pour juin 2025." },
    period_entries:           { ok: true,  detail: "Toutes les écritures sont dans la période 01/06–30/06/2025." },
    fiscal_period_correct:    { ok: true,  detail: "Exercice 2025 ouvert et valide." },
    withholding:              { ok: true,  detail: "Retenues à la source déclarées pour 3 prestataires externes." },
    thresholds:               { ok: true,  detail: "Aucun seuil dépassé." },
    notes_present:            { ok: true,  detail: "Notes explicatives complètes (215 caractères)." },
    responsible_assigned:     { ok: true,  detail: "Sylvie Kpossou — Comptable." },
  }).map(c => ({ ...c, declarationId: s1!.id })));

  // 1 anomalie faible initiale, résolue
  const [a1] = await db.insert(fiscalAnomaliesTable).values({
    declarationId: s1!.id, organizationId: orgId,
    level: "faible", category: "Documentation",
    checkCode: "notes_present",
    title: "Notes initiales insuffisantes",
    detail: "Les notes de la version brouillon étaient trop courtes (< 30 caractères).",
    recommendedAction: "Développer les notes pour expliquer les montants et les particularités de la période.",
    resolved: true, resolvedAt: DT(2025, 7, 14, 9, 15),
    resolvedById: comptaId,
    resolutionNote: "Notes complétées avec la liste des missions et le détail des achats déductibles.",
    source: "auto",
  }).returning();

  await db.insert(fiscalDeclarationHistoryTable).values([
    {
      declarationId: s1!.id, organizationId: orgId,
      eventType: "created", eventLabel: "Déclaration créée",
      detail: "TVA — Juin 2025",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 7, 1, 8, 0),
    },
    {
      declarationId: s1!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Contrôle lancé — 1 anomalie détectée",
      detail: "Score : 83%", metadata: { score: 83, anomalyCount: 1, checkCount: 12 },
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 7, 10, 14, 0),
    },
    {
      declarationId: s1!.id, organizationId: orgId,
      eventType: "anomaly_resolved", eventLabel: "Anomalie résolue : Notes initiales insuffisantes",
      detail: "Notes complétées avec la liste des missions et le détail des achats déductibles.",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 7, 14, 9, 15),
    },
    {
      declarationId: s1!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Second contrôle — 0 anomalie",
      detail: "Score : 94%", metadata: { score: 94, anomalyCount: 0, checkCount: 12 },
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 7, 14, 9, 30),
    },
    {
      declarationId: s1!.id, organizationId: orgId,
      eventType: "status_changed", eventLabel: "Statut modifié : marquée prête à soumettre",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 7, 14, 10, 45),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SCÉNARIO 2 — TVA Mai 2025 — CORRECTIONS REQUISES (TVA incohérente, bloquant)
  // ══════════════════════════════════════════════════════════════════════════
  const [s2] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "tva", typeLabel: "TVA",
    period: "2025-05", periodLabel: "Mai 2025",
    status: "corrections",
    conformityScore: 52,
    declaredRevenue:        78_200_000,
    declaredVatCollected:   10_440_000,   // devrait être 14 076 000 FCFA (18%) — sous-déclaré
    declaredVatDeductible:   2_100_000,
    declaredNetVat:          8_340_000,
    dueDate: "2025-06-15",
    notes: "TVA mai 2025.",
    responsibleId: comptaId,
    createdById: comptaId,
    lastCheckedAt: DT(2025, 6, 12, 11, 20),
    createdAt: DT(2025, 6, 1, 9, 0),
    updatedAt: DT(2025, 6, 12, 11, 20),
  }).returning();

  await db.insert(fiscalChecksTable).values(checks({
    vat_consistency: {
      ok: false,
      detail: "TVA déclarée : 10 440 000 FCFA. Attendue sur CA 78 200 000 FCFA × 18% = 14 076 000 FCFA. Écart : 3 636 000 FCFA (25,8% — seuil > 10% → bloquant).",
    },
    vat_deductible_justified: { ok: true, detail: "12 factures fournisseurs vérifiées." },
    payment_reconciliation: { ok: false, detail: "3 factures clients (total 8 750 000 FCFA) non lettrées sur la période." },
    revenue_consistency: { ok: false, detail: "CA déclaré : 78 200 000 FCFA. CA comptable (comptes 70xxx) : 83 940 000 FCFA. Écart : 5 740 000 FCFA." },
    notes_present: { ok: false, detail: "Notes trop courtes (16 caractères) — insuffisantes pour l'audit." },
    responsible_assigned: { ok: true, detail: "Sylvie Kpossou." },
    no_duplicate:      { ok: true },
    vat_rate_correct:  { ok: true },
    period_entries:    { ok: true },
    fiscal_period_correct: { ok: true },
    withholding:       { ok: true },
    thresholds:        { ok: true },
  }).map(c => ({ ...c, declarationId: s2!.id })));

  await db.insert(fiscalAnomaliesTable).values([
    {
      declarationId: s2!.id, organizationId: orgId,
      level: "bloquant", category: "TVA",
      checkCode: "vat_consistency",
      title: "TVA collectée sous-déclarée — écart critique",
      detail: "TVA déclarée : 10 440 000 FCFA. TVA théorique sur CA (18%) : 14 076 000 FCFA. Sous-déclaration de 3 636 000 FCFA soit 25,8%. Ce niveau d'écart dépasse le seuil toléré de 10% et bloque la soumission.",
      recommendedAction: "Vérifier les factures clients du mois de mai, s'assurer qu'aucune n'a été oubliée dans la déclaration. Recalculer la TVA collectée et corriger le montant déclaré.",
      linkedModule: "factures_clients", linkedPath: "/invoices",
      resolved: false, source: "auto",
    },
    {
      declarationId: s2!.id, organizationId: orgId,
      level: "eleve", category: "Cohérence",
      checkCode: "revenue_consistency",
      title: "Chiffre d'affaires déclaré inférieur au CA comptable",
      detail: "CA déclaré : 78 200 000 FCFA. CA comptable (comptes 70xxx, statut posté) : 83 940 000 FCFA. Différence non expliquée : 5 740 000 FCFA. Possibles causes : facture non incluse, avoir non déduit, erreur de période.",
      recommendedAction: "Rapprocher les factures émises en mai avec les écritures comptables et identifier les 5 740 000 FCFA manquants.",
      linkedModule: "comptabilite", linkedPath: "/comptabilite/ecritures",
      resolved: false, source: "auto",
    },
    {
      declarationId: s2!.id, organizationId: orgId,
      level: "moyen", category: "Rapprochement",
      checkCode: "payment_reconciliation",
      title: "3 factures clients non lettrées",
      detail: "FAC-HC-2025-011 (2 400 000 FCFA), FAC-HC-2025-013 (3 200 000 FCFA), FAC-HC-2025-016 (3 150 000 FCFA) — partiellement réglées sans lettrage dans Gameasu.",
      recommendedAction: "Effectuer le lettrage des paiements reçus pour ces 3 factures dans le module Paiements.",
      linkedModule: "paiements", linkedPath: "/payments",
      resolved: false, source: "auto",
    },
    {
      declarationId: s2!.id, organizationId: orgId,
      level: "faible", category: "Documentation",
      checkCode: "notes_present",
      title: "Notes explicatives insuffisantes",
      detail: "Les notes de la déclaration sont trop courtes (16 caractères). L'OTR exige une justification des montants en cas de contrôle.",
      recommendedAction: "Compléter les notes avec le détail des missions, clients, et la justification des montants déclarés.",
      resolved: false, source: "auto",
    },
  ]);

  await db.insert(fiscalDeclarationHistoryTable).values([
    {
      declarationId: s2!.id, organizationId: orgId,
      eventType: "created", eventLabel: "Déclaration créée",
      detail: "TVA — Mai 2025",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 6, 1, 9, 0),
    },
    {
      declarationId: s2!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Contrôle lancé — 4 anomalies détectées",
      detail: "Score : 52% — Déclaration non conforme, corrections requises.",
      metadata: { score: 52, anomalyCount: 4, checkCount: 12 },
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 6, 12, 11, 20),
    },
    {
      declarationId: s2!.id, organizationId: orgId,
      eventType: "status_changed", eventLabel: "Statut modifié : corrections requises",
      detail: "1 anomalie bloquante détectée — soumission impossible.",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 6, 12, 11, 20),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SCÉNARIO 3 — TVA Avril 2025 — EN VÉRIFICATION (score 72)
  // ══════════════════════════════════════════════════════════════════════════
  const [s3] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "tva", typeLabel: "TVA",
    period: "2025-04", periodLabel: "Avril 2025",
    status: "en_verification",
    conformityScore: 72,
    declaredRevenue:        65_800_000,
    declaredVatCollected:   11_844_000,
    declaredVatDeductible:   4_860_000,
    declaredNetVat:          6_984_000,
    dueDate: "2025-05-15",
    notes: "TVA avril 2025 — en cours de vérification par la DAF. Certaines factures fournisseurs reçues tardivement.",
    responsibleId: comptaId,
    createdById: comptaId,
    lastCheckedAt: DT(2025, 5, 8, 15, 0),
    createdAt: DT(2025, 5, 1, 8, 30),
    updatedAt: DT(2025, 5, 8, 15, 0),
  }).returning();

  await db.insert(fiscalChecksTable).values(checks({
    vat_consistency:   { ok: true, detail: "TVA cohérente (11 844 000 ≈ 65 800 000 × 18%). Écart < 2%." },
    vat_deductible_justified: { ok: false, detail: "4 factures fournisseurs sans pièce jointe sur 23 au total. TVA déductible concernée : 720 000 FCFA." },
    payment_reconciliation: { ok: true, detail: "Toutes les factures lettrées." },
    revenue_consistency: { ok: true, detail: "CA cohérent avec les écritures comptables." },
    notes_present: { ok: false, detail: "Notes présentes mais insuffisantes (< 50 caractères)." },
    responsible_assigned: { ok: true },
    no_duplicate: { ok: true },
    vat_rate_correct: { ok: true },
    period_entries: { ok: true },
    fiscal_period_correct: { ok: true },
    withholding: { ok: true },
    thresholds: { ok: true },
  }).map(c => ({ ...c, declarationId: s3!.id })));

  await db.insert(fiscalAnomaliesTable).values([
    {
      declarationId: s3!.id, organizationId: orgId,
      level: "eleve", category: "Justificatifs",
      checkCode: "vat_deductible_justified",
      title: "4 factures fournisseurs sans justificatif",
      detail: "Les factures F-LOGITEK-2025-04-07 (240 000 FCFA), F-LOGITEK-2025-04-12 (180 000 FCFA), F-CANAL-2025-04-01 (195 000 FCFA) et F-PRINT-2025-04-19 (105 000 FCFA) n'ont pas de pièce jointe. TVA déductible à risque : 720 000 FCFA.",
      recommendedAction: "Contacter les fournisseurs pour obtenir les factures originales et les ajouter dans Gameasu avant soumission à l'OTR.",
      linkedModule: "fournisseurs", linkedPath: "/comptabilite/fournisseurs",
      resolved: false, source: "auto",
    },
    {
      declarationId: s3!.id, organizationId: orgId,
      level: "faible", category: "Documentation",
      checkCode: "notes_present",
      title: "Notes insuffisantes pour l'audit",
      detail: "La note actuelle (48 caractères) ne décrit pas suffisamment les particularités de la période.",
      recommendedAction: "Développer les notes en détaillant les principales missions, les achats significatifs et tout événement fiscal notable.",
      resolved: false, source: "auto",
    },
  ]);

  await db.insert(fiscalDeclarationHistoryTable).values([
    {
      declarationId: s3!.id, organizationId: orgId,
      eventType: "created", eventLabel: "Déclaration créée",
      detail: "TVA — Avril 2025",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 5, 1, 8, 30),
    },
    {
      declarationId: s3!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Contrôle lancé — 2 anomalies détectées",
      detail: "Score : 72%",
      metadata: { score: 72, anomalyCount: 2, checkCount: 12 },
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 5, 8, 15, 0),
    },
    {
      declarationId: s3!.id, organizationId: orgId,
      eventType: "status_changed", eventLabel: "Statut modifié : mise en vérification",
      detail: "Transmis à la DAF pour validation.",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 5, 8, 15, 5),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SCÉNARIO 4 — IS Exercice 2024 — SOUMIS (annuel, score 96)
  // ══════════════════════════════════════════════════════════════════════════
  const [s4] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "is", typeLabel: "Impôt sur sociétés",
    period: "2024", periodLabel: "Exercice 2024",
    status: "soumis",
    conformityScore: 96,
    declaredRevenue:     820_000_000,
    declaredVatCollected: null,
    declaredVatDeductible: null,
    declaredNetVat: null,
    declaredAmount:      36_900_000,   // IS à 27% sur résultat fiscal 136,7M FCFA
    dueDate: "2025-03-31",
    taxAuthority: "OTR",
    notes: "Déclaration IS exercice 2024. Résultat fiscal : 136 700 000 FCFA. Taux IS 27%. IS brut : 36 909 000 FCFA arrondi à 36 900 000 FCFA. Acomptes versés en 2024 : 12 000 000 FCFA (4 versements trimestriels). Solde à payer : 24 900 000 FCFA. Exercice clôturé au 31/12/2024. Déposé à l'OTR le 28/03/2025. Accusé réception N° OTR-2025-IS-00847.",
    responsibleId: finId,
    createdById: finId,
    lastCheckedAt: DT(2025, 3, 20, 14, 0),
    submittedAt: DT(2025, 3, 28, 11, 30),
    createdAt: DT(2025, 2, 15, 9, 0),
    updatedAt: DT(2025, 3, 28, 11, 30),
  }).returning();

  await db.insert(fiscalChecksTable).values(checks({
    vat_consistency:          { ok: true, detail: "Non applicable (IS annuel)." },
    vat_deductible_justified: { ok: true, detail: "Non applicable (IS annuel)." },
    payment_reconciliation:   { ok: true, detail: "4 acomptes IS 2024 rapprochés avec les écritures (comptes 447)." },
    revenue_consistency:      { ok: true, detail: "CA 2024 déclaré : 820 000 000 FCFA = CA comptable audit interne." },
    vat_rate_correct:         { ok: true, detail: "Taux IS 27% conforme barème OTR 2024." },
    no_duplicate:             { ok: true, detail: "Unique déclaration IS pour l'exercice 2024." },
    period_entries:           { ok: true, detail: "Toutes les écritures de l'exercice 2024 incluses." },
    fiscal_period_correct:    { ok: true, detail: "Exercice 2024 clôturé le 31/12/2024." },
    withholding:              { ok: true, detail: "Retenues à la source prestataires 2024 déclarées." },
    thresholds:               { ok: true, detail: "IS > 10M FCFA — télédéclaration obligatoire respectée." },
    notes_present:            { ok: true, detail: "Notes complètes : détail du résultat fiscal, acomptes, solde." },
    responsible_assigned:     { ok: true, detail: "Mawuena Agbeko — DAF." },
  }).map(c => ({ ...c, declarationId: s4!.id })));

  // 1 anomalie élevée résolue (retraitement dépréciation)
  await db.insert(fiscalAnomaliesTable).values({
    declarationId: s4!.id, organizationId: orgId,
    level: "eleve", category: "Cohérence",
    checkCode: "revenue_consistency",
    title: "Retraitement dépréciation non intégré initialement",
    detail: "Le retraitement fiscal de la dépréciation d'un matériel IT (2 400 000 FCFA) avait été omis dans la première version de la déclaration, réduisant artificiellement la base IS.",
    recommendedAction: "Intégrer le retraitement dans la liasse fiscale et recalculer le résultat fiscal imposable.",
    resolved: true,
    resolvedAt: DT(2025, 3, 20, 14, 0),
    resolvedById: finId,
    resolutionNote: "Retraitement intégré : résultat fiscal corrigé de 134 300 000 FCFA à 136 700 000 FCFA. IS recalculé à 36 909 000 FCFA.",
    source: "auto",
  });

  await db.insert(fiscalDeclarationHistoryTable).values([
    {
      declarationId: s4!.id, organizationId: orgId,
      eventType: "created", eventLabel: "Déclaration IS créée",
      detail: "Impôt sur sociétés — Exercice 2024",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 2, 15, 9, 0),
    },
    {
      declarationId: s4!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Premier contrôle — 1 anomalie détectée",
      detail: "Score : 83%",
      metadata: { score: 83, anomalyCount: 1, checkCount: 12 },
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 3, 5, 10, 0),
    },
    {
      declarationId: s4!.id, organizationId: orgId,
      eventType: "anomaly_resolved", eventLabel: "Anomalie résolue : Retraitement dépréciation",
      detail: "Résultat fiscal recalculé, IS ajusté à 36 900 000 FCFA.",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 3, 20, 14, 0),
    },
    {
      declarationId: s4!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Second contrôle — 0 anomalie",
      detail: "Score : 96%",
      metadata: { score: 96, anomalyCount: 0, checkCount: 12 },
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 3, 20, 14, 30),
    },
    {
      declarationId: s4!.id, organizationId: orgId,
      eventType: "status_changed", eventLabel: "Statut modifié : marquée prête à soumettre",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 3, 25, 9, 0),
    },
    {
      declarationId: s4!.id, organizationId: orgId,
      eventType: "status_changed", eventLabel: "Statut modifié : soumise à l'administration fiscale",
      detail: "Déposée à l'OTR le 28/03/2025. Accusé réception N° OTR-2025-IS-00847.",
      actorId: dgId, actorName: "Kodjo Hissado",
      createdAt: DT(2025, 3, 28, 11, 30),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SCÉNARIO 5 — Retenues à la source T1 2025 — CORRECTIONS REQUISES (bloquant doublon)
  // ══════════════════════════════════════════════════════════════════════════
  const [s5] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "retenues_source", typeLabel: "Retenues à la source",
    period: "2025-T1", periodLabel: "T1 2025 (Jan–Mar)",
    status: "corrections",
    conformityScore: 41,
    declaredRevenue: null,
    declaredVatCollected: null,
    declaredVatDeductible: null,
    declaredNetVat: null,
    declaredAmount:  3_240_000,   // 3% retenues sur honoraires prestataires 108M FCFA
    dueDate: "2025-04-15",
    notes: "",
    responsibleId: comptaId,
    createdById: comptaId,
    lastCheckedAt: DT(2025, 4, 8, 10, 30),
    createdAt: DT(2025, 4, 2, 8, 0),
    updatedAt: DT(2025, 4, 8, 10, 30),
  }).returning();

  // Créer une 2e déclaration doublon pour déclencher la règle "no_duplicate"
  const [s5b] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "retenues_source", typeLabel: "Retenues à la source",
    period: "2025-T1", periodLabel: "T1 2025 (Jan–Mar)",
    status: "brouillon",
    conformityScore: null,
    declaredAmount: 2_985_000,
    dueDate: "2025-04-15",
    notes: "Doublon — à supprimer. Saisie erronée du 03/04/2025.",
    responsibleId: comptaId,
    createdById: comptaId,
    createdAt: DT(2025, 4, 3, 11, 0),
    updatedAt: DT(2025, 4, 3, 11, 0),
  }).returning();

  await db.insert(fiscalChecksTable).values(checks({
    no_duplicate: { ok: false, detail: "1 autre déclaration Retenues à la source pour T1 2025 (ID: …-s5b) — saisie en doublon détectée." },
    notes_present: { ok: false, detail: "Notes vides — aucune explication fournie." },
    responsible_assigned: { ok: true, detail: "Sylvie Kpossou." },
    withholding: { ok: false, detail: "Taux de retenue 3% appliqué mais non vérifié pour tous les prestataires de la période." },
    vat_consistency: { ok: true }, payment_reconciliation: { ok: true },
    revenue_consistency: { ok: true }, vat_rate_correct: { ok: true },
    vat_deductible_justified: { ok: true }, period_entries: { ok: true },
    fiscal_period_correct: { ok: true }, thresholds: { ok: true },
  }).map(c => ({ ...c, declarationId: s5!.id })));

  await db.insert(fiscalAnomaliesTable).values([
    {
      declarationId: s5!.id, organizationId: orgId,
      level: "bloquant", category: "Conformité",
      checkCode: "no_duplicate",
      title: "Doublon détecté — 2 déclarations pour la même période",
      detail: "Deux déclarations 'Retenues à la source' existent pour T1 2025 dans Gameasu. Montants différents : 3 240 000 FCFA et 2 985 000 FCFA. La soumission des deux serait une erreur grave vis-à-vis de l'OTR.",
      recommendedAction: "Identifier la déclaration correcte et supprimer ou archiver l'autre. Vérifier le montant exact des retenues à verser.",
      linkedPath: "/comptabilite/controle-fiscal",
      resolved: false, source: "auto",
    },
    {
      declarationId: s5!.id, organizationId: orgId,
      level: "moyen", category: "Documentation",
      checkCode: "notes_present",
      title: "Notes explicatives absentes",
      detail: "Aucune note n'accompagne cette déclaration. L'OTR peut demander le détail des prestataires soumis à retenue.",
      recommendedAction: "Lister les prestataires externes, les montants d'honoraires et le calcul des retenues (3% × honoraires HT).",
      resolved: false, source: "auto",
    },
    {
      declarationId: s5!.id, organizationId: orgId,
      level: "moyen", category: "TVA",
      checkCode: "withholding",
      title: "Taux de retenue non vérifié pour tous les prestataires",
      detail: "3 prestataires dont le statut (personne physique vs morale) détermine le taux applicable (3% ou 5%) n'ont pas été vérifiés.",
      recommendedAction: "Demander les attestations fiscales de Logitek Togo SARL, Cabinet Martial & Associés et TotalEnergies Togo pour confirmer le taux applicable.",
      resolved: false, source: "auto",
    },
  ]);

  await db.insert(fiscalDeclarationHistoryTable).values([
    {
      declarationId: s5!.id, organizationId: orgId,
      eventType: "created", eventLabel: "Déclaration créée",
      detail: "Retenues à la source — T1 2025",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 4, 2, 8, 0),
    },
    {
      declarationId: s5!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Contrôle lancé — 3 anomalies dont 1 bloquante",
      detail: "Score : 41% — Doublon bloquant détecté.",
      metadata: { score: 41, anomalyCount: 3, checkCount: 12 },
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 4, 8, 10, 30),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SCÉNARIO 6 — TVA Mars 2025 — CONFORME (corrigée, score 89)
  // ══════════════════════════════════════════════════════════════════════════
  const [s6] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "tva", typeLabel: "TVA",
    period: "2025-03", periodLabel: "Mars 2025",
    status: "conforme",
    conformityScore: 89,
    declaredRevenue:        58_200_000,
    declaredVatCollected:   10_476_000,
    declaredVatDeductible:   2_880_000,
    declaredNetVat:          7_596_000,
    dueDate: "2025-04-15",
    notes: "TVA mars 2025. Mission Ecobank terminée (32M FCFA). 2 avoirs émis pour remises commerciales (1,8M FCFA TTC). TVA déductible sur achats IT Logitek et frais imprimerie. Toutes les factures justifiées après correction du 09/04/2025.",
    responsibleId: comptaId,
    createdById: comptaId,
    lastCheckedAt: DT(2025, 4, 9, 16, 0),
    createdAt: DT(2025, 4, 1, 9, 0),
    updatedAt: DT(2025, 4, 9, 16, 0),
  }).returning();

  await db.insert(fiscalChecksTable).values(checks({
    vat_consistency:          { ok: true, detail: "TVA collectée nette des avoirs : 10 476 000 FCFA. Attendue : 10 476 000 FCFA. Écart nul." },
    vat_deductible_justified: { ok: true, detail: "Après ajout des 2 pièces manquantes — toutes justifiées." },
    payment_reconciliation:   { ok: true, detail: "Toutes les factures du mois lettrées." },
    revenue_consistency:      { ok: false, detail: "Écart résiduel 120 000 FCFA dû à un arrondi de TVA sur avoir — non bloquant." },
    notes_present:            { ok: true, detail: "Notes complètes (328 caractères)." },
    responsible_assigned:     { ok: true },
    no_duplicate: { ok: true }, vat_rate_correct: { ok: true },
    period_entries: { ok: true }, fiscal_period_correct: { ok: true },
    withholding: { ok: true }, thresholds: { ok: true },
  }).map(c => ({ ...c, declarationId: s6!.id })));

  // 2 anomalies résolues
  const [a6a] = await db.insert(fiscalAnomaliesTable).values({
    declarationId: s6!.id, organizationId: orgId,
    level: "eleve", category: "Justificatifs",
    checkCode: "vat_deductible_justified",
    title: "2 factures fournisseurs sans justificatif",
    detail: "F-LOGITEK-2025-03-15 (315 000 FCFA) et F-PRINT-2025-03-22 (97 500 FCFA) manquaient de pièce jointe.",
    recommendedAction: "Obtenir et joindre les factures PDF de Logitek Togo et Print Express.",
    resolved: true,
    resolvedAt: DT(2025, 4, 9, 11, 0),
    resolvedById: comptaId,
    resolutionNote: "Factures PDF reçues par email et téléchargées dans Gameasu le 09/04/2025.",
    source: "auto",
  }).returning();

  const [a6b] = await db.insert(fiscalAnomaliesTable).values({
    declarationId: s6!.id, organizationId: orgId,
    level: "faible", category: "Cohérence",
    checkCode: "revenue_consistency",
    title: "Écart résiduel de 120 000 FCFA — arrondi d'avoir",
    detail: "Les 2 avoirs émis en mars ont généré un écart d'arrondi de 120 000 FCFA entre le CA comptable et le CA déclaré. Inférieur au seuil d'alerte.",
    recommendedAction: "Documenter l'arrondi dans les notes et vérifier que l'avoir correctif est bien comptabilisé.",
    resolved: true,
    resolvedAt: DT(2025, 4, 9, 15, 0),
    resolvedById: finId,
    resolutionNote: "Arrondi validé par la DAF — montant < 0,2% du CA, acceptable pour l'OTR. Avoir comptabilisé en OD le 09/04.",
    source: "auto",
  }).returning();

  await db.insert(fiscalDeclarationHistoryTable).values([
    {
      declarationId: s6!.id, organizationId: orgId,
      eventType: "created", eventLabel: "Déclaration créée",
      detail: "TVA — Mars 2025",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 4, 1, 9, 0),
    },
    {
      declarationId: s6!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Premier contrôle — 2 anomalies détectées",
      detail: "Score : 67%",
      metadata: { score: 67, anomalyCount: 2, checkCount: 12 },
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 4, 7, 10, 0),
    },
    {
      declarationId: s6!.id, organizationId: orgId,
      eventType: "anomaly_resolved", eventLabel: "Anomalie résolue : 2 factures fournisseurs sans justificatif",
      detail: "Factures PDF reçues et téléchargées dans Gameasu.",
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 4, 9, 11, 0),
    },
    {
      declarationId: s6!.id, organizationId: orgId,
      eventType: "anomaly_resolved", eventLabel: "Anomalie résolue : Écart résiduel de 120 000 FCFA",
      detail: "Avoir correctif comptabilisé, arrondi validé par la DAF.",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 4, 9, 15, 0),
    },
    {
      declarationId: s6!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Second contrôle — 0 anomalie bloquante",
      detail: "Score : 89%",
      metadata: { score: 89, anomalyCount: 0, checkCount: 12 },
      actorId: comptaId, actorName: "Sylvie Kpossou",
      createdAt: DT(2025, 4, 9, 16, 0),
    },
    {
      declarationId: s6!.id, organizationId: orgId,
      eventType: "status_changed", eventLabel: "Statut modifié : marquée conforme",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 4, 9, 16, 30),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SCÉNARIO 7 — TVA Juillet 2025 — BROUILLON (en cours de saisie)
  // ══════════════════════════════════════════════════════════════════════════
  const [s7] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "tva", typeLabel: "TVA",
    period: "2025-07", periodLabel: "Juillet 2025",
    status: "brouillon",
    conformityScore: null,
    declaredRevenue:       102_400_000,
    declaredVatCollected:   18_432_000,
    declaredVatDeductible:   3_960_000,
    declaredNetVat:         14_472_000,
    dueDate: "2025-08-15",
    notes: "",
    responsibleId: comptaId,
    createdById: comptaId,
    createdAt: DT(2025, 7, 31, 17, 30),
    updatedAt: DT(2025, 7, 31, 17, 30),
  }).returning();

  await db.insert(fiscalDeclarationHistoryTable).values({
    declarationId: s7!.id, organizationId: orgId,
    eventType: "created", eventLabel: "Déclaration créée — brouillon",
    detail: "TVA — Juillet 2025. Contrôle à lancer avant le 15/08/2025.",
    actorId: comptaId, actorName: "Sylvie Kpossou",
    createdAt: DT(2025, 7, 31, 17, 30),
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCÉNARIO BONUS — Acompte fiscal T2 2025 — ARCHIVÉ (soumis et classé)
  // ══════════════════════════════════════════════════════════════════════════
  const [s8] = await db.insert(fiscalDeclarationsTable).values({
    organizationId: orgId,
    type: "acompte", typeLabel: "Acompte fiscal",
    period: "2025-T2", periodLabel: "T2 2025 (Avr–Jun)",
    status: "archive",
    conformityScore: 100,
    declaredRevenue: null,
    declaredVatCollected: null,
    declaredVatDeductible: null,
    declaredNetVat: null,
    declaredAmount:  9_000_000,
    dueDate: "2025-07-15",
    notes: "Acompte IS T2 2025 — 3e versement trimestriel. Calculé sur base IS 2024 (36 900 000 FCFA) / 4 = 9 225 000 FCFA, arrondi à 9 000 000 FCFA après déduction crédit IS 2023. Virement OTR reçu le 14/07/2025.",
    responsibleId: finId,
    createdById: finId,
    lastCheckedAt: DT(2025, 7, 10, 11, 0),
    submittedAt:    DT(2025, 7, 14, 9, 0),
    archivedAt:     DT(2025, 7, 15, 14, 0),
    createdAt: DT(2025, 7, 1, 8, 0),
    updatedAt: DT(2025, 7, 15, 14, 0),
  }).returning();

  await db.insert(fiscalChecksTable).values(ALL_CHECKS.map(c => ({
    declarationId: s8!.id,
    checkCode: c.code,
    checkLabel: c.label,
    passed: true,
    detail: "Contrôle passé.",
  })));

  await db.insert(fiscalDeclarationHistoryTable).values([
    {
      declarationId: s8!.id, organizationId: orgId,
      eventType: "created", eventLabel: "Déclaration créée",
      detail: "Acompte IS — T2 2025",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 7, 1, 8, 0),
    },
    {
      declarationId: s8!.id, organizationId: orgId,
      eventType: "check_run", eventLabel: "Contrôle lancé — 0 anomalie",
      detail: "Score : 100%",
      metadata: { score: 100, anomalyCount: 0, checkCount: 12 },
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 7, 10, 11, 0),
    },
    {
      declarationId: s8!.id, organizationId: orgId,
      eventType: "status_changed", eventLabel: "Statut modifié : soumise à l'administration fiscale",
      detail: "Bordereau de paiement OTR #BV-2025-07-14-HC soumis.",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 7, 14, 9, 0),
    },
    {
      declarationId: s8!.id, organizationId: orgId,
      eventType: "status_changed", eventLabel: "Statut modifié : archivée",
      detail: "Classée après confirmation de réception par l'OTR.",
      actorId: finId, actorName: "Mawuena Agbeko",
      createdAt: DT(2025, 7, 15, 14, 0),
    },
  ]);

  console.log("  [fiscal-control] ✅ 8 déclarations + checks + anomalies + historique semés.");
}
