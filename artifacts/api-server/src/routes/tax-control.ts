import { Router } from "express";
import { db } from "@workspace/db";
import {
  fiscalDeclarationsTable, fiscalAnomaliesTable, fiscalChecksTable,
  fiscalDeclarationHistoryTable, fiscalSettingsTable,
  usersTable, journalEntryLinesTable, journalEntriesTable,
  invoicesTable, supplierInvoicesTable, chartOfAccountsTable,
} from "@workspace/db";
import { and, eq, desc, isNull, sql, inArray, count } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

// ─── Helper ──────────────────────────────────────────────────────────────────
async function getOrCreateFiscalSettings(orgId: string) {
  const [existing] = await db.select().from(fiscalSettingsTable)
    .where(eq(fiscalSettingsTable.organizationId, orgId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(fiscalSettingsTable)
    .values({ organizationId: orgId }).returning();
  return created;
}

// ─── Helper : conversion période → plage de dates ────────────────────────────
function parsePeriodToDateRange(period: string): { startDate: string; endDate: string } {
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1]);
    const month = parseInt(monthMatch[2]);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      startDate: `${year}-${String(month).padStart(2, "0")}-01`,
      endDate:   `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/i);
  if (quarterMatch) {
    const year = parseInt(quarterMatch[1]);
    const q = parseInt(quarterMatch[2]);
    const sm = (q - 1) * 3 + 1;
    const em = q * 3;
    const lastDay = new Date(year, em, 0).getDate();
    return {
      startDate: `${year}-${String(sm).padStart(2, "0")}-01`,
      endDate:   `${year}-${String(em).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  const yearMatch = period.match(/^(\d{4})$/);
  if (yearMatch) {
    return { startDate: `${yearMatch[1]}-01-01`, endDate: `${yearMatch[1]}-12-31` };
  }
  const y = new Date().getFullYear();
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

// ─── DÉFINITION DES RÈGLES DE CONTRÔLE ──────────────────────────────────────
const CHECK_DEFINITIONS = [
  { code: "vat_consistency",          label: "Cohérence TVA collectée / ventes" },
  { code: "vat_ledger",               label: "TVA collectée = Grand livre (comptes 443x/4457x)" },
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

// ─── Moteur de contrôle ──────────────────────────────────────────────────────
async function runComplianceCheck(orgId: string, declarationId: string): Promise<{
  score: number;
  checks: Array<{ code: string; label: string; passed: boolean; detail?: string }>;
  anomalies: Array<{
    level: "bloquant" | "eleve" | "moyen" | "faible";
    category: string; checkCode: string; title: string; detail: string;
    recommendedAction: string; linkedModule?: string; linkedPath?: string;
  }>;
}> {
  const [decl] = await db.select().from(fiscalDeclarationsTable)
    .where(and(eq(fiscalDeclarationsTable.id, declarationId), eq(fiscalDeclarationsTable.organizationId, orgId))).limit(1);
  if (!decl) throw new Error("Déclaration introuvable");

  const settings = await getOrCreateFiscalSettings(orgId);
  const vatRate = settings.vatRate / 100;

  const checkResults: Array<{ code: string; label: string; passed: boolean; detail?: string }> = [];
  const anomalies: any[] = [];

  for (const def of CHECK_DEFINITIONS) {
    let passed = true;
    let detail: string | undefined;
    let anomaly: any = null;

    switch (def.code) {
      case "vat_consistency": {
        if (decl.declaredVatCollected != null && decl.declaredRevenue != null) {
          const expected = Math.round(decl.declaredRevenue * vatRate);
          const diff = Math.abs(expected - decl.declaredVatCollected);
          const threshold = Math.round(expected * 0.02);
          if (diff > threshold && expected > 0) {
            passed = false;
            detail = `TVA déclarée : ${decl.declaredVatCollected.toLocaleString("fr")} FCFA. Attendue : ${expected.toLocaleString("fr")} FCFA. Écart : ${diff.toLocaleString("fr")} FCFA.`;
            anomaly = {
              level: diff > expected * 0.1 ? "bloquant" : "eleve",
              category: "TVA",
              checkCode: def.code,
              title: "TVA collectée incohérente avec les ventes",
              detail,
              recommendedAction: "Vérifier les factures clients et les taux de TVA appliqués.",
              linkedModule: "factures_clients",
              linkedPath: "/factures",
            };
          } else {
            detail = "TVA cohérente avec le CA déclaré.";
          }
        } else {
          detail = "Montants non renseignés — contrôle ignoré.";
        }
        break;
      }
      case "vat_ledger": {
        if (decl.type !== "tva") {
          passed = true;
          detail = "Contrôle non applicable à ce type de déclaration.";
          break;
        }
        try {
          const { startDate, endDate } = parsePeriodToDateRange(decl.period);
          // Comptes TVA collectée SYSCOHADA : 443x (4431-4434) + 4457x
          const vatRow = await db.select({
            collected: sql<string>`COALESCE(SUM(${(journalEntryLinesTable as any).credit} - ${(journalEntryLinesTable as any).debit}), 0)`,
          })
            .from(journalEntryLinesTable as any)
            .leftJoin(journalEntriesTable as any, eq((journalEntryLinesTable as any).entryId, (journalEntriesTable as any).id))
            .leftJoin(chartOfAccountsTable, eq((journalEntryLinesTable as any).accountId, chartOfAccountsTable.id))
            .where(and(
              eq((journalEntriesTable as any).organizationId, orgId),
              eq((journalEntriesTable as any).status as any, "posted"),
              sql`(${chartOfAccountsTable.code} LIKE '443%' OR ${chartOfAccountsTable.code} LIKE '4457%')`,
              sql`${(journalEntriesTable as any).entryDate} >= ${startDate}`,
              sql`${(journalEntriesTable as any).entryDate} <= ${endDate}`,
            ));
          const ledgerVat = Math.round(Number(vatRow[0]?.collected ?? 0));

          if (ledgerVat <= 0) {
            detail = `Aucune écriture TVA collectée (comptes 443x/4457x) trouvée pour la période ${decl.periodLabel}.`;
            passed = true;
            break;
          }

          if (decl.declaredVatCollected == null) {
            // Auto-remplissage : met à jour la déclaration avec la valeur du grand livre
            await db.update(fiscalDeclarationsTable)
              .set({ declaredVatCollected: ledgerVat })
              .where(eq(fiscalDeclarationsTable.id, declarationId));
            detail = `TVA collectée auto-remplie depuis le grand livre : ${ledgerVat.toLocaleString("fr")} FCFA (comptes 443x/4457x, période ${decl.periodLabel}).`;
            passed = true;
          } else {
            const diff = Math.abs(ledgerVat - decl.declaredVatCollected);
            const tolerance = Math.round(ledgerVat * 0.02);
            if (diff > tolerance) {
              passed = false;
              detail = `TVA déclarée : ${decl.declaredVatCollected.toLocaleString("fr")} FCFA. Grand livre (443x/4457x) : ${ledgerVat.toLocaleString("fr")} FCFA. Écart : ${diff.toLocaleString("fr")} FCFA.`;
              anomaly = {
                level: diff > ledgerVat * 0.1 ? "bloquant" : "eleve",
                category: "TVA",
                checkCode: def.code,
                title: "TVA collectée déclarée ≠ Grand livre",
                detail,
                recommendedAction: "Vérifier les écritures des comptes 443x et 4457x, puis corriger le montant déclaré.",
                linkedPath: "/comptabilite/ecritures",
              };
            } else {
              detail = `TVA collectée conforme au grand livre : ${ledgerVat.toLocaleString("fr")} FCFA.`;
            }
          }
        } catch {
          detail = "Contrôle ignoré (données comptables insuffisantes).";
          passed = true;
        }
        break;
      }
      case "vat_deductible_justified": {
        try {
          const [row] = await db.select({ cnt: count() }).from(supplierInvoicesTable)
            .where(and(
              eq(supplierInvoicesTable.organizationId, orgId),
              isNull((supplierInvoicesTable as any).attachmentPath)
            ));
          const unj = Number(row?.cnt ?? 0);
          if (unj > 0) {
            passed = false;
            detail = `${unj} facture(s) fournisseur sans pièce justificative.`;
            anomaly = {
              level: "eleve",
              category: "Justificatifs",
              checkCode: def.code,
              title: "TVA déductible sans justificatif",
              detail,
              recommendedAction: "Ajouter les pièces jointes manquantes dans le module Achats.",
              linkedPath: "/comptabilite/fournisseurs",
            };
          } else {
            detail = "Toutes les factures fournisseurs sont justifiées.";
          }
        } catch {
          detail = "Contrôle ignoré (colonne attachmentPath absente).";
        }
        break;
      }
      case "payment_reconciliation": {
        try {
          const [row] = await db.select({ cnt: count() }).from(invoicesTable)
            .where(and(
              eq(invoicesTable.organizationId, orgId),
              eq(invoicesTable.status as any, "partial")
            ));
          const partial = Number(row?.cnt ?? 0);
          if (partial > 0) {
            passed = false;
            detail = `${partial} facture(s) partiellement réglée(s) non lettrée(s).`;
            anomaly = {
              level: "moyen",
              category: "Rapprochement",
              checkCode: def.code,
              title: "Paiements non rapprochés",
              detail,
              recommendedAction: "Effectuer le lettrage dans le module Paiements.",
              linkedModule: "paiements",
              linkedPath: "/paiements",
            };
          } else {
            detail = "Paiements correctement rapprochés.";
          }
        } catch {
          detail = "Contrôle ignoré.";
        }
        break;
      }
      case "revenue_consistency": {
        if (decl.declaredRevenue != null) {
          try {
            const [row] = await db.select({
              total: sql<string>`COALESCE(SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END),0)`,
            })
              .from(journalEntryLinesTable as any)
              .leftJoin(journalEntriesTable as any, eq((journalEntryLinesTable as any).entryId, (journalEntriesTable as any).id))
              .leftJoin(chartOfAccountsTable, eq((journalEntryLinesTable as any).accountId, chartOfAccountsTable.id))
              .where(and(
                eq((journalEntriesTable as any).organizationId, orgId),
                eq((journalEntriesTable as any).status as any, "posted"),
                sql`${chartOfAccountsTable.classNum} = 7`
              ));
            const accounting = Math.round(Number(row?.total ?? 0));
            const diff = Math.abs(accounting - decl.declaredRevenue);
            if (accounting > 0 && diff > 50000) {
              passed = false;
              detail = `CA déclaré : ${decl.declaredRevenue.toLocaleString("fr")} FCFA. CA comptable : ${accounting.toLocaleString("fr")} FCFA. Écart : ${diff.toLocaleString("fr")} FCFA.`;
              anomaly = {
                level: "moyen",
                category: "Cohérence",
                checkCode: def.code,
                title: "Chiffre d'affaires déclaré vs comptable",
                detail,
                recommendedAction: "Vérifier les avoirs, remises et corrections non comptabilisées.",
                linkedPath: "/comptabilite/ecritures",
              };
            } else {
              detail = "CA cohérent avec les écritures comptables.";
            }
          } catch {
            detail = "Contrôle ignoré.";
          }
        } else {
          detail = "CA non renseigné — contrôle ignoré.";
        }
        break;
      }
      case "no_duplicate": {
        const [row] = await db.select({ cnt: count() }).from(fiscalDeclarationsTable)
          .where(and(
            eq(fiscalDeclarationsTable.organizationId, orgId),
            eq(fiscalDeclarationsTable.type, decl.type),
            eq(fiscalDeclarationsTable.period, decl.period),
          ));
        const dupes = Number(row?.cnt ?? 0);
        if (dupes > 1) {
          passed = false;
          detail = `${dupes - 1} autre(s) déclaration(s) ${decl.typeLabel} pour la même période détectée(s).`;
          anomaly = {
            level: "bloquant",
            category: "Conformité",
            checkCode: def.code,
            title: "Doublon de déclaration détecté",
            detail,
            recommendedAction: "Supprimer la déclaration en double avant de soumettre.",
            linkedPath: "/comptabilite/controle-fiscal",
          };
        } else {
          detail = "Aucun doublon détecté.";
        }
        break;
      }
      case "responsible_assigned": {
        if (!decl.responsibleId) {
          passed = false;
          detail = "Aucun responsable désigné pour cette déclaration.";
          anomaly = {
            level: "faible",
            category: "Documentation",
            checkCode: def.code,
            title: "Responsable de déclaration non désigné",
            detail,
            recommendedAction: "Assigner un responsable de la déclaration dans les paramètres.",
          };
        } else {
          detail = "Responsable assigné.";
        }
        break;
      }
      case "notes_present": {
        if (!decl.notes || decl.notes.trim().length < 10) {
          passed = false;
          detail = "Notes explicatives absentes ou trop courtes.";
          anomaly = {
            level: "faible",
            category: "Documentation",
            checkCode: def.code,
            title: "Notes explicatives manquantes",
            detail,
            recommendedAction: "Ajouter des notes expliquant les montants et les choix fiscaux.",
          };
        } else {
          detail = "Notes explicatives présentes.";
        }
        break;
      }
      default:
        passed = true;
        detail = "Contrôle effectué.";
    }

    checkResults.push({ code: def.code, label: def.label, passed, detail });
    if (anomaly) anomalies.push(anomaly);
  }

  const passedCount = checkResults.filter(c => c.passed).length;
  const score = Math.round((passedCount / checkResults.length) * 100);

  return { score, checks: checkResults, anomalies };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARAMÈTRES FISCAUX
// ─────────────────────────────────────────────────────────────────────────────
router.get("/fiscal-settings", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const settings = await getOrCreateFiscalSettings(orgId);
    res.json(settings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/fiscal-settings", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { country, taxAuthority, taxAuthorityLabel, vatRate, withholdingRate, fiscalYearStartMonth } = req.body;
    const [existing] = await db.select({ id: fiscalSettingsTable.id })
      .from(fiscalSettingsTable).where(eq(fiscalSettingsTable.organizationId, orgId)).limit(1);
    if (existing) {
      const [updated] = await db.update(fiscalSettingsTable)
        .set({ country, taxAuthority, taxAuthorityLabel, vatRate, withholdingRate, fiscalYearStartMonth, updatedAt: new Date(), updatedById: req.authUser!.id })
        .where(eq(fiscalSettingsTable.organizationId, orgId)).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(fiscalSettingsTable)
        .values({ organizationId: orgId, country, taxAuthority, taxAuthorityLabel, vatRate, withholdingRate, fiscalYearStartMonth, updatedById: req.authUser!.id })
        .returning();
      res.json(created);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DÉCLARATIONS
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tax-declarations", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status, type } = req.query as Record<string, string>;

    const conditions = [eq(fiscalDeclarationsTable.organizationId, orgId)];
    if (status && status !== "all") conditions.push(eq(fiscalDeclarationsTable.status, status));
    if (type && type !== "all") conditions.push(eq(fiscalDeclarationsTable.type, type));

    const declarations = await db.select({
      id: fiscalDeclarationsTable.id,
      type: fiscalDeclarationsTable.type,
      typeLabel: fiscalDeclarationsTable.typeLabel,
      period: fiscalDeclarationsTable.period,
      periodLabel: fiscalDeclarationsTable.periodLabel,
      status: fiscalDeclarationsTable.status,
      conformityScore: fiscalDeclarationsTable.conformityScore,
      declaredRevenue: fiscalDeclarationsTable.declaredRevenue,
      declaredVatCollected: fiscalDeclarationsTable.declaredVatCollected,
      declaredNetVat: fiscalDeclarationsTable.declaredNetVat,
      declaredAmount: fiscalDeclarationsTable.declaredAmount,
      dueDate: fiscalDeclarationsTable.dueDate,
      lastCheckedAt: fiscalDeclarationsTable.lastCheckedAt,
      createdAt: fiscalDeclarationsTable.createdAt,
      responsibleId: fiscalDeclarationsTable.responsibleId,
      responsibleName: sql<string>`(SELECT CONCAT(u.first_name,' ',u.last_name) FROM users u WHERE u.id = ${fiscalDeclarationsTable.responsibleId})`,
    }).from(fiscalDeclarationsTable)
      .where(and(...conditions))
      .orderBy(desc(fiscalDeclarationsTable.createdAt));

    const ids = declarations.map(d => d.id);
    const anomalyCounts = ids.length > 0
      ? await db.select({
          declarationId: fiscalAnomaliesTable.declarationId,
          level: fiscalAnomaliesTable.level,
          cnt: count(),
        }).from(fiscalAnomaliesTable)
          .where(and(
            inArray(fiscalAnomaliesTable.declarationId, ids),
            eq(fiscalAnomaliesTable.resolved, false)
          ))
          .groupBy(fiscalAnomaliesTable.declarationId, fiscalAnomaliesTable.level)
      : [];

    const anomalyMap: Record<string, Record<string, number>> = {};
    for (const row of anomalyCounts) {
      if (!anomalyMap[row.declarationId]) anomalyMap[row.declarationId] = {};
      anomalyMap[row.declarationId][row.level] = Number(row.cnt);
    }

    res.json({ data: declarations.map(d => ({ ...d, anomalies: anomalyMap[d.id] ?? {} })) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/tax-declarations/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;

    const [decl] = await db.select().from(fiscalDeclarationsTable)
      .where(and(eq(fiscalDeclarationsTable.id, id), eq(fiscalDeclarationsTable.organizationId, orgId))).limit(1);
    if (!decl) return void res.status(404).json({ error: "Déclaration introuvable" });

    const anomalies = await db.select().from(fiscalAnomaliesTable)
      .where(eq(fiscalAnomaliesTable.declarationId, id))
      .orderBy(
        sql`CASE level WHEN 'bloquant' THEN 0 WHEN 'eleve' THEN 1 WHEN 'moyen' THEN 2 ELSE 3 END`,
        desc(fiscalAnomaliesTable.createdAt)
      );

    const checks = await db.select().from(fiscalChecksTable)
      .where(eq(fiscalChecksTable.declarationId, id))
      .orderBy(fiscalChecksTable.checkLabel);

    const history = await db.select({
      id: fiscalDeclarationHistoryTable.id,
      eventType: fiscalDeclarationHistoryTable.eventType,
      eventLabel: fiscalDeclarationHistoryTable.eventLabel,
      detail: fiscalDeclarationHistoryTable.detail,
      metadata: fiscalDeclarationHistoryTable.metadata,
      actorName: fiscalDeclarationHistoryTable.actorName,
      createdAt: fiscalDeclarationHistoryTable.createdAt,
    }).from(fiscalDeclarationHistoryTable)
      .where(eq(fiscalDeclarationHistoryTable.declarationId, id))
      .orderBy(desc(fiscalDeclarationHistoryTable.createdAt))
      .limit(50);

    const settings = await getOrCreateFiscalSettings(orgId);

    res.json({ data: { ...decl, anomalies, checks, history, fiscalSettings: settings } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/tax-declarations", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const user = req.authUser!;
    const {
      type, typeLabel, period, periodLabel, dueDate,
      declaredRevenue, declaredVatCollected, declaredVatDeductible, declaredNetVat, declaredAmount,
      notes, responsibleId,
    } = req.body;

    const [decl] = await db.insert(fiscalDeclarationsTable).values({
      organizationId: orgId,
      type, typeLabel, period, periodLabel, dueDate,
      declaredRevenue: declaredRevenue ? Number(declaredRevenue) : null,
      declaredVatCollected: declaredVatCollected ? Number(declaredVatCollected) : null,
      declaredVatDeductible: declaredVatDeductible ? Number(declaredVatDeductible) : null,
      declaredNetVat: declaredNetVat ? Number(declaredNetVat) : null,
      declaredAmount: declaredAmount ? Number(declaredAmount) : null,
      notes,
      responsibleId: responsibleId || user.id,
      createdById: user.id,
      status: "brouillon",
    }).returning();

    await db.insert(fiscalDeclarationHistoryTable).values({
      declarationId: decl.id,
      organizationId: orgId,
      eventType: "created",
      eventLabel: "Déclaration créée",
      detail: `${typeLabel} — ${periodLabel}`,
      actorId: user.id,
      actorName: `${user.firstName} ${user.lastName}`,
    });

    res.status(201).json(decl);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/tax-declarations/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const user = req.authUser!;

    const [existing] = await db.select({ id: fiscalDeclarationsTable.id, status: fiscalDeclarationsTable.status })
      .from(fiscalDeclarationsTable)
      .where(and(eq(fiscalDeclarationsTable.id, id), eq(fiscalDeclarationsTable.organizationId, orgId))).limit(1);
    if (!existing) return void res.status(404).json({ error: "Déclaration introuvable" });

    const {
      status, notes, dueDate,
      declaredRevenue, declaredVatCollected, declaredVatDeductible, declaredNetVat, declaredAmount,
      responsibleId,
    } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (declaredRevenue !== undefined) updates.declaredRevenue = Number(declaredRevenue);
    if (declaredVatCollected !== undefined) updates.declaredVatCollected = Number(declaredVatCollected);
    if (declaredVatDeductible !== undefined) updates.declaredVatDeductible = Number(declaredVatDeductible);
    if (declaredNetVat !== undefined) updates.declaredNetVat = Number(declaredNetVat);
    if (declaredAmount !== undefined) updates.declaredAmount = Number(declaredAmount);
    if (responsibleId !== undefined) updates.responsibleId = responsibleId;
    if (status === "soumis") updates.submittedAt = new Date();
    if (status === "archive") updates.archivedAt = new Date();

    const [updated] = await db.update(fiscalDeclarationsTable).set(updates)
      .where(and(eq(fiscalDeclarationsTable.id, id), eq(fiscalDeclarationsTable.organizationId, orgId)))
      .returning();

    if (status && status !== existing.status) {
      const LABELS: Record<string, string> = {
        brouillon: "remise en brouillon", en_verification: "mise en vérification",
        corrections: "corrections requises", conforme: "marquée conforme",
        pret: "marquée prête à soumettre", soumis: "soumise à l'administration fiscale",
        archive: "archivée",
      };
      await db.insert(fiscalDeclarationHistoryTable).values({
        declarationId: id,
        organizationId: orgId,
        eventType: "status_changed",
        eventLabel: `Statut modifié : ${LABELS[status] ?? status}`,
        actorId: user.id,
        actorName: `${user.firstName} ${user.lastName}`,
      });
    }

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/tax-declarations/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const [existing] = await db.select({ status: fiscalDeclarationsTable.status })
      .from(fiscalDeclarationsTable)
      .where(and(eq(fiscalDeclarationsTable.id, id), eq(fiscalDeclarationsTable.organizationId, orgId))).limit(1);
    if (!existing) return void res.status(404).json({ error: "Introuvable" });
    if (existing.status === "soumis") return void res.status(409).json({ error: "Impossible de supprimer une déclaration déjà soumise." });
    await db.delete(fiscalDeclarationsTable).where(and(eq(fiscalDeclarationsTable.id, id), eq(fiscalDeclarationsTable.organizationId, orgId)));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LANCER LE CONTRÔLE
// ─────────────────────────────────────────────────────────────────────────────
router.post("/tax-declarations/:id/run-check", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const user = req.authUser!;

    const [decl] = await db.select().from(fiscalDeclarationsTable)
      .where(and(eq(fiscalDeclarationsTable.id, id), eq(fiscalDeclarationsTable.organizationId, orgId))).limit(1);
    if (!decl) return void res.status(404).json({ error: "Déclaration introuvable" });

    const { score, checks, anomalies: detectedAnomalies } = await runComplianceCheck(orgId, id);

    await db.delete(fiscalAnomaliesTable).where(and(
      eq(fiscalAnomaliesTable.declarationId, id),
      eq(fiscalAnomaliesTable.source, "auto"),
      eq(fiscalAnomaliesTable.resolved, false),
    ));

    if (detectedAnomalies.length > 0) {
      await db.insert(fiscalAnomaliesTable).values(
        detectedAnomalies.map(a => ({ ...a, declarationId: id, organizationId: orgId }))
      );
    }

    await db.delete(fiscalChecksTable).where(eq(fiscalChecksTable.declarationId, id));
    if (checks.length > 0) {
      await db.insert(fiscalChecksTable).values(
        checks.map(c => ({
          declarationId: id,
          checkCode: c.code,
          checkLabel: c.label,
          passed: c.passed,
          detail: c.detail,
        }))
      );
    }

    const hasBlocking = detectedAnomalies.some(a => a.level === "bloquant");
    const newStatus = hasBlocking || detectedAnomalies.length > 0 ? "corrections"
      : score >= 90 ? "conforme"
      : "en_verification";

    await db.update(fiscalDeclarationsTable).set({
      conformityScore: score,
      status: newStatus,
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(fiscalDeclarationsTable.id, id), eq(fiscalDeclarationsTable.organizationId, orgId)));

    await db.insert(fiscalDeclarationHistoryTable).values({
      declarationId: id,
      organizationId: orgId,
      eventType: "check_run",
      eventLabel: `Contrôle lancé — ${detectedAnomalies.length} anomalie(s) détectée(s)`,
      detail: `Score : ${score}%`,
      metadata: { score, anomalyCount: detectedAnomalies.length, checkCount: checks.length },
      actorId: user.id,
      actorName: `${user.firstName} ${user.lastName}`,
    });

    res.json({ score, status: newStatus, anomalyCount: detectedAnomalies.length, checks });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ANOMALIES — RÉSOLUTION
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/tax-declarations/:id/anomalies/:anomalyId", async (req: Request, res: Response) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { id, anomalyId } = req.params as Record<string, string>;
    const user = req.authUser!;
    const { resolved, resolutionNote } = req.body;

    const [anom] = await db.select({ id: fiscalAnomaliesTable.id, title: fiscalAnomaliesTable.title })
      .from(fiscalAnomaliesTable)
      .where(and(eq(fiscalAnomaliesTable.id, anomalyId), eq(fiscalAnomaliesTable.declarationId, id))).limit(1);
    if (!anom) return void res.status(404).json({ error: "Anomalie introuvable" });

    const [updated] = await db.update(fiscalAnomaliesTable).set({
      resolved: Boolean(resolved),
      resolvedAt: resolved ? new Date() : null,
      resolvedById: resolved ? user.id : null,
      resolutionNote: resolutionNote ?? null,
    }).where(eq(fiscalAnomaliesTable.id, anomalyId)).returning();

    if (resolved) {
      await db.insert(fiscalDeclarationHistoryTable).values({
        declarationId: id,
        organizationId: orgId,
        eventType: "anomaly_resolved",
        eventLabel: `Anomalie résolue : ${anom.title}`,
        detail: resolutionNote || undefined,
        actorId: user.id,
        actorName: `${user.firstName} ${user.lastName}`,
      });
    }

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
