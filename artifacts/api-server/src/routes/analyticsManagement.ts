/**
 * CAGE — Comptabilité Analytique de Gestion
 * Routes : /api/analytics/*
 */
import { Router } from "express";
import { and, asc, desc, eq, gte, lte, sql, isNull, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  analyticalAccountsTable,
  analyticalEntriesTable,
  allocationRulesTable,
  costCentersTable,
  journalEntryLinesTable,
  journalEntriesTable,
  chartOfAccountsTable,
  projectsTable,
  clientsTable,
} from "@workspace/db/schema";
import { requireManagerOrAbove } from "../middlewares/auth";

const router = Router();
const toNum = (v: unknown) => (v == null ? 0 : typeof v === "string" ? parseFloat(v) || 0 : Number(v));

// ────────────────────────────────────────────────────────────────
// COMPTES ANALYTIQUES
// ────────────────────────────────────────────────────────────────
router.get("/analytics/accounts", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(analyticalAccountsTable)
      .where(eq(analyticalAccountsTable.organizationId, orgId))
      .orderBy(asc(analyticalAccountsTable.code));
    res.json({ data: rows });
  } catch (e) { next(e); }
});

router.post("/analytics/accounts", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { code, name, axis, type, description } = req.body as {
      code: string; name: string; axis?: string; type?: string; description?: string;
    };
    if (!code || !name) { res.status(400).json({ error: "code et name requis" }); return; }
    const [row] = await db.insert(analyticalAccountsTable).values({
      organizationId: orgId, code, name,
      axis: axis ?? "nature", type: type ?? "charges", description,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch("/analytics/accounts/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { code, name, axis, type, description, isActive } = req.body as {
      code?: string; name?: string; axis?: string; type?: string; description?: string; isActive?: boolean;
    };
    const [row] = await db.update(analyticalAccountsTable)
      .set({ code, name, axis, type, description, isActive })
      .where(and(eq(analyticalAccountsTable.id, req.params.id), eq(analyticalAccountsTable.organizationId, orgId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Compte introuvable" }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/analytics/accounts/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(analyticalAccountsTable)
      .where(and(eq(analyticalAccountsTable.id, req.params.id), eq(analyticalAccountsTable.organizationId, orgId)));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// IMPUTATIONS ANALYTIQUES
// ────────────────────────────────────────────────────────────────
router.get("/analytics/entries", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to, costCenterId, accountId, costType, projectId, clientId, limit: limitQ, offset: offsetQ } = req.query as Record<string, string>;
    const conditions = [eq(analyticalEntriesTable.organizationId, orgId)];
    if (from) conditions.push(gte(analyticalEntriesTable.date, from));
    if (to) conditions.push(lte(analyticalEntriesTable.date, to));
    if (costCenterId) conditions.push(eq(analyticalEntriesTable.costCenterId, costCenterId));
    if (accountId) conditions.push(eq(analyticalEntriesTable.accountId, accountId));
    if (costType) conditions.push(eq(analyticalEntriesTable.costType, costType));
    if (projectId) conditions.push(eq(analyticalEntriesTable.projectId, projectId));
    if (clientId) conditions.push(eq(analyticalEntriesTable.clientId, clientId));

    const lim = Math.min(parseInt(limitQ ?? "200", 10), 500);
    const off = parseInt(offsetQ ?? "0", 10);

    const rows = await db
      .select({
        entry: analyticalEntriesTable,
        accountCode: analyticalAccountsTable.code,
        accountName: analyticalAccountsTable.name,
        ccCode: costCentersTable.code,
        ccName: costCentersTable.name,
        projectName: projectsTable.name,
        clientName: clientsTable.name,
      })
      .from(analyticalEntriesTable)
      .leftJoin(analyticalAccountsTable, eq(analyticalEntriesTable.accountId, analyticalAccountsTable.id))
      .leftJoin(costCentersTable, eq(analyticalEntriesTable.costCenterId, costCentersTable.id))
      .leftJoin(projectsTable, eq(analyticalEntriesTable.projectId, projectsTable.id))
      .leftJoin(clientsTable, eq(analyticalEntriesTable.clientId, clientsTable.id))
      .where(and(...conditions))
      .orderBy(desc(analyticalEntriesTable.date))
      .limit(lim).offset(off);

    const total = await db.select({ n: sql<string>`COUNT(*)` })
      .from(analyticalEntriesTable).where(and(...conditions));

    res.json({ data: rows, total: parseInt(total[0]?.n ?? "0", 10) });
  } catch (e) { next(e); }
});

router.post("/analytics/entries", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { date, period, accountId, costCenterId, amount, costType, label, reference, projectId, clientId } = req.body as {
      date: string; period: string; accountId?: string; costCenterId?: string;
      amount: number; costType?: string; label: string; reference?: string;
      projectId?: string; clientId?: string;
    };
    if (!date || !period || amount == null || !label) {
      res.status(400).json({ error: "date, period, amount et label requis" }); return;
    }
    const [row] = await db.insert(analyticalEntriesTable).values({
      organizationId: orgId,
      date, period,
      accountId: accountId || null,
      costCenterId: costCenterId || null,
      amount: String(amount),
      costType: costType ?? "direct",
      label, reference,
      projectId: projectId || null,
      clientId: clientId || null,
      createdBy: req.authUser!.id,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch("/analytics/entries/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { date, period, accountId, costCenterId, amount, costType, label, reference, projectId, clientId } = req.body as Record<string, unknown>;
    const [row] = await db.update(analyticalEntriesTable).set({
      date: date as string | undefined,
      period: period as string | undefined,
      accountId: (accountId as string | null) ?? undefined,
      costCenterId: (costCenterId as string | null) ?? undefined,
      amount: amount != null ? String(amount) : undefined,
      costType: costType as string | undefined,
      label: label as string | undefined,
      reference: reference as string | null | undefined,
      projectId: (projectId as string | null) ?? undefined,
      clientId: (clientId as string | null) ?? undefined,
    }).where(and(eq(analyticalEntriesTable.id, req.params.id), eq(analyticalEntriesTable.organizationId, orgId))).returning();
    if (!row) { res.status(404).json({ error: "Imputation introuvable" }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/analytics/entries/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(analyticalEntriesTable)
      .where(and(eq(analyticalEntriesTable.id, req.params.id), eq(analyticalEntriesTable.organizationId, orgId)));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// CLÉS DE RÉPARTITION
// ────────────────────────────────────────────────────────────────
router.get("/analytics/allocation-rules", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(allocationRulesTable)
      .where(eq(allocationRulesTable.organizationId, orgId))
      .orderBy(asc(allocationRulesTable.name));
    res.json({ data: rows });
  } catch (e) { next(e); }
});

router.post("/analytics/allocation-rules", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { name, description, targetCostType, allocations } = req.body as {
      name: string; description?: string; targetCostType?: string; allocations?: object[];
    };
    if (!name) { res.status(400).json({ error: "name requis" }); return; }
    const [row] = await db.insert(allocationRulesTable).values({
      organizationId: orgId, name, description, targetCostType,
      allocations: allocations ?? [],
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch("/analytics/allocation-rules/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { name, description, targetCostType, allocations, isActive } = req.body as Record<string, unknown>;
    const [row] = await db.update(allocationRulesTable).set({
      name: name as string | undefined,
      description: description as string | null | undefined,
      targetCostType: targetCostType as string | null | undefined,
      allocations: allocations as object[] | undefined,
      isActive: isActive as boolean | undefined,
    }).where(and(eq(allocationRulesTable.id, req.params.id), eq(allocationRulesTable.organizationId, orgId))).returning();
    if (!row) { res.status(404).json({ error: "Règle introuvable" }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/analytics/allocation-rules/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(allocationRulesTable)
      .where(and(eq(allocationRulesTable.id, req.params.id), eq(allocationRulesTable.organizationId, orgId)));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// RAPPORTS ANALYTIQUES
// ════════════════════════════════════════════════════════════════

function buildDateConds(from?: string, to?: string) {
  const c = [];
  if (from) c.push(gte(analyticalEntriesTable.date, from));
  if (to) c.push(lte(analyticalEntriesTable.date, to));
  return c;
}

// Dashboard analytique global
router.get("/analytics/reports/dashboard", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to } = req.query as { from?: string; to?: string };

    const conds = [eq(analyticalEntriesTable.organizationId, orgId), ...buildDateConds(from, to)];

    // Agrégation globale
    const [agg] = await db.select({
      totalCharges: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`,
      totalProduits: sql<string>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`,
      nbImputations: sql<string>`COUNT(*)`,
    }).from(analyticalEntriesTable).where(and(...conds));

    // Par type de coût
    const byCostType = await db.select({
      costType: analyticalEntriesTable.costType,
      total: sql<string>`SUM(ABS(amount))`,
    }).from(analyticalEntriesTable)
      .where(and(...conds))
      .groupBy(analyticalEntriesTable.costType)
      .orderBy(desc(sql`SUM(ABS(amount))`));

    // Tendance mensuelle (12 derniers mois)
    const byMonth = await db.select({
      period: analyticalEntriesTable.period,
      charges: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`,
      produits: sql<string>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`,
    }).from(analyticalEntriesTable)
      .where(and(...conds))
      .groupBy(analyticalEntriesTable.period)
      .orderBy(asc(analyticalEntriesTable.period))
      .limit(24);

    // Top centres de coût par consommation
    const topCC = await db.select({
      costCenterId: analyticalEntriesTable.costCenterId,
      ccCode: costCentersTable.code,
      ccName: costCentersTable.name,
      totalCharges: sql<string>`SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)`,
      totalProduits: sql<string>`SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)`,
    }).from(analyticalEntriesTable)
      .leftJoin(costCentersTable, eq(analyticalEntriesTable.costCenterId, costCentersTable.id))
      .where(and(...conds, sql`${analyticalEntriesTable.costCenterId} IS NOT NULL`))
      .groupBy(analyticalEntriesTable.costCenterId, costCentersTable.code, costCentersTable.name)
      .orderBy(desc(sql`SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)`))
      .limit(10);

    const charges = toNum(agg?.totalCharges);
    const produits = toNum(agg?.totalProduits);
    res.json({
      totalCharges: charges,
      totalProduits: produits,
      margeNette: produits - charges,
      nbImputations: parseInt(agg?.nbImputations ?? "0", 10),
      byCostType: byCostType.map(r => ({ costType: r.costType, total: toNum(r.total) })),
      byMonth: byMonth.map(r => ({ period: r.period, charges: toNum(r.charges), produits: toNum(r.produits) })),
      topCostCenters: topCC.map(r => ({
        id: r.costCenterId, code: r.ccCode, name: r.ccName,
        charges: toNum(r.totalCharges), produits: toNum(r.totalProduits),
        marge: toNum(r.totalProduits) - toNum(r.totalCharges),
      })),
    });
  } catch (e) { next(e); }
});

// Rapport par centre de coût — charges directes/indirectes/produits/marge
router.get("/analytics/reports/by-cost-center", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to } = req.query as { from?: string; to?: string };

    const centers = await db.select().from(costCentersTable)
      .where(and(eq(costCentersTable.organizationId, orgId), eq(costCentersTable.isActive, true)))
      .orderBy(asc(costCentersTable.code));

    const conds = [eq(analyticalEntriesTable.organizationId, orgId), ...buildDateConds(from, to)];

    // Imputations analytiques directes par CC
    const analyticByCC = await db.select({
      costCenterId: analyticalEntriesTable.costCenterId,
      chargesDirect: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 AND cost_type = 'direct' THEN amount ELSE 0 END), 0)`,
      chargesIndirect: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 AND cost_type = 'indirect' THEN amount ELSE 0 END), 0)`,
      chargesVariable: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 AND cost_type = 'variable' THEN amount ELSE 0 END), 0)`,
      chargesFixes: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 AND cost_type = 'fixe' THEN amount ELSE 0 END), 0)`,
      chargesTotal: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`,
      produits: sql<string>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`,
    }).from(analyticalEntriesTable)
      .where(and(...conds, sql`${analyticalEntriesTable.costCenterId} IS NOT NULL`))
      .groupBy(analyticalEntriesTable.costCenterId);

    // Imputations depuis comptabilité générale (journal_entry_lines) avec cost_center_id
    // On ne retient que les écritures validées (posted) sur comptes de charges class 6
    const jeConds = [
      eq(journalEntryLinesTable.organizationId, orgId),
      eq(journalEntriesTable.status, "posted"),
      eq(chartOfAccountsTable.classNum, 6),
    ];
    if (from) jeConds.push(gte(journalEntriesTable.entryDate, from));
    if (to) jeConds.push(lte(journalEntriesTable.entryDate, to));

    const journalByCC = await db.select({
      costCenterId: sql<string>`"journal_entry_lines"."cost_center_id"`,
      totalDebit: sql<string>`SUM("journal_entry_lines"."debit")`,
      totalCredit: sql<string>`SUM("journal_entry_lines"."credit")`,
    }).from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
      .where(and(...jeConds, sql`"journal_entry_lines"."cost_center_id" IS NOT NULL`))
      .groupBy(sql`"journal_entry_lines"."cost_center_id"`);

    const analyticMap = new Map(analyticByCC.map(r => [r.costCenterId, r]));
    const journalMap = new Map(journalByCC.map(r => [r.costCenterId, r]));

    const result = centers.map(cc => {
      const a = analyticMap.get(cc.id);
      const j = journalMap.get(cc.id);
      const chargesAnalytic = toNum(a?.chargesTotal);
      const produitsAnalytic = toNum(a?.produits);
      const journalNet = j ? toNum(j.totalDebit) - toNum(j.totalCredit) : 0;
      const budget = cc.budgetAmount != null ? toNum(cc.budgetAmount) : null;
      const chargesTotal = chargesAnalytic || journalNet; // priorité analytique
      const marge = produitsAnalytic - chargesTotal;

      return {
        id: cc.id, code: cc.code, name: cc.name, type: cc.type, color: cc.color,
        budget,
        chargesDirect: toNum(a?.chargesDirect),
        chargesIndirect: toNum(a?.chargesIndirect),
        chargesVariable: toNum(a?.chargesVariable),
        chargesFixes: toNum(a?.chargesFixes),
        chargesTotal,
        produits: produitsAnalytic,
        marge,
        tauxMarge: produitsAnalytic > 0 ? Math.round((marge / produitsAnalytic) * 100) : null,
        budgetEcart: budget != null ? chargesTotal - budget : null,
        budgetPct: budget != null && budget > 0 ? Math.round((chargesTotal / budget) * 100) : null,
        // Source comptable si pas d'entrées analytiques directes
        journalDebit: j ? toNum(j.totalDebit) : 0,
        journalCredit: j ? toNum(j.totalCredit) : 0,
      };
    });
    res.json({ data: result });
  } catch (e) { next(e); }
});

// Rapport par projet
router.get("/analytics/reports/by-project", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to } = req.query as { from?: string; to?: string };
    const conds = [eq(analyticalEntriesTable.organizationId, orgId), ...buildDateConds(from, to),
      sql`${analyticalEntriesTable.projectId} IS NOT NULL`];

    const rows = await db.select({
      projectId: analyticalEntriesTable.projectId,
      projectName: projectsTable.name,
      projectStatus: projectsTable.status,
      charges: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`,
      produits: sql<string>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`,
      nbImputations: sql<string>`COUNT(*)`,
    }).from(analyticalEntriesTable)
      .leftJoin(projectsTable, eq(analyticalEntriesTable.projectId, projectsTable.id))
      .where(and(...conds))
      .groupBy(analyticalEntriesTable.projectId, projectsTable.name, projectsTable.status)
      .orderBy(desc(sql`SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)`));

    res.json({ data: rows.map(r => ({
      id: r.projectId, name: r.projectName, status: r.projectStatus,
      charges: toNum(r.charges), produits: toNum(r.produits),
      marge: toNum(r.produits) - toNum(r.charges),
      tauxMarge: toNum(r.produits) > 0 ? Math.round(((toNum(r.produits) - toNum(r.charges)) / toNum(r.produits)) * 100) : null,
      nbImputations: parseInt(r.nbImputations, 10),
    })) });
  } catch (e) { next(e); }
});

// Rapport par client
router.get("/analytics/reports/by-client", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to } = req.query as { from?: string; to?: string };
    const conds = [eq(analyticalEntriesTable.organizationId, orgId), ...buildDateConds(from, to),
      sql`${analyticalEntriesTable.clientId} IS NOT NULL`];

    const rows = await db.select({
      clientId: analyticalEntriesTable.clientId,
      clientName: clientsTable.name,
      charges: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`,
      produits: sql<string>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`,
      nbImputations: sql<string>`COUNT(*)`,
    }).from(analyticalEntriesTable)
      .leftJoin(clientsTable, eq(analyticalEntriesTable.clientId, clientsTable.id))
      .where(and(...conds))
      .groupBy(analyticalEntriesTable.clientId, clientsTable.name)
      .orderBy(desc(sql`SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)`));

    res.json({ data: rows.map(r => ({
      id: r.clientId, name: r.clientName,
      charges: toNum(r.charges), produits: toNum(r.produits),
      marge: toNum(r.produits) - toNum(r.charges),
      tauxMarge: toNum(r.produits) > 0 ? Math.round(((toNum(r.produits) - toNum(r.charges)) / toNum(r.produits)) * 100) : null,
      nbImputations: parseInt(r.nbImputations, 10),
    })) });
  } catch (e) { next(e); }
});

// Contribution marginale — charges variables vs fixes, seuil de rentabilité
router.get("/analytics/reports/contribution", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to } = req.query as { from?: string; to?: string };
    const conds = [eq(analyticalEntriesTable.organizationId, orgId), ...buildDateConds(from, to)];

    const [agg] = await db.select({
      chargesVariables: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 AND cost_type = 'variable' THEN amount ELSE 0 END), 0)`,
      chargesFixes: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 AND (cost_type = 'fixe' OR cost_type = 'indirect') THEN amount ELSE 0 END), 0)`,
      chargesTotal: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`,
      produitsTotal: sql<string>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`,
    }).from(analyticalEntriesTable).where(and(...conds));

    // Par CC
    const byCC = await db.select({
      costCenterId: analyticalEntriesTable.costCenterId,
      ccCode: costCentersTable.code,
      ccName: costCentersTable.name,
      chargesVariables: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 AND cost_type = 'variable' THEN amount ELSE 0 END), 0)`,
      chargesFixes: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 AND (cost_type = 'fixe' OR cost_type = 'indirect') THEN amount ELSE 0 END), 0)`,
      produits: sql<string>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`,
    }).from(analyticalEntriesTable)
      .leftJoin(costCentersTable, eq(analyticalEntriesTable.costCenterId, costCentersTable.id))
      .where(and(...conds, sql`${analyticalEntriesTable.costCenterId} IS NOT NULL`))
      .groupBy(analyticalEntriesTable.costCenterId, costCentersTable.code, costCentersTable.name)
      .orderBy(desc(sql`SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)`));

    const cv = toNum(agg?.chargesVariables);
    const cf = toNum(agg?.chargesFixes);
    const ca = toNum(agg?.produitsTotal);
    const mcv = ca - cv; // Marge sur coût variable
    const tauxContribution = ca > 0 ? mcv / ca : 0;
    const pointMort = tauxContribution > 0 ? cf / tauxContribution : null;

    res.json({
      chargesVariables: cv,
      chargesFixes: cf,
      chargesTotal: toNum(agg?.chargesTotal),
      chiffreAffaires: ca,
      margeContribution: mcv,
      tauxContribution: Math.round(tauxContribution * 10000) / 100, // en %
      pointMort,
      byCC: byCC.map(r => {
        const _cv = toNum(r.chargesVariables);
        const _cf = toNum(r.chargesFixes);
        const _ca = toNum(r.produits);
        const _mc = _ca - _cv;
        return {
          id: r.costCenterId, code: r.ccCode, name: r.ccName,
          chargesVariables: _cv, chargesFixes: _cf, produits: _ca,
          margeContribution: _mc,
          tauxContribution: _ca > 0 ? Math.round((_mc / _ca) * 10000) / 100 : 0,
        };
      }),
    });
  } catch (e) { next(e); }
});

// Compte de résultat analytique par axe (nature de charge/produit)
router.get("/analytics/reports/income-statement", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to } = req.query as { from?: string; to?: string };
    const conds = [eq(analyticalEntriesTable.organizationId, orgId), ...buildDateConds(from, to)];

    const rows = await db.select({
      accountId: analyticalEntriesTable.accountId,
      accountCode: analyticalAccountsTable.code,
      accountName: analyticalAccountsTable.name,
      accountType: analyticalAccountsTable.type,
      axis: analyticalAccountsTable.axis,
      total: sql<string>`SUM(amount)`,
      abs: sql<string>`SUM(ABS(amount))`,
    }).from(analyticalEntriesTable)
      .leftJoin(analyticalAccountsTable, eq(analyticalEntriesTable.accountId, analyticalAccountsTable.id))
      .where(and(...conds))
      .groupBy(analyticalEntriesTable.accountId, analyticalAccountsTable.code, analyticalAccountsTable.name, analyticalAccountsTable.type, analyticalAccountsTable.axis)
      .orderBy(asc(analyticalAccountsTable.code));

    const produits = rows.filter(r => toNum(r.total) < 0);
    const charges = rows.filter(r => toNum(r.total) >= 0);
    const totalProduits = produits.reduce((s, r) => s + Math.abs(toNum(r.total)), 0);
    const totalCharges = charges.reduce((s, r) => s + toNum(r.total), 0);

    res.json({
      produits: produits.map(r => ({ id: r.accountId, code: r.accountCode, name: r.accountName, axis: r.axis, amount: Math.abs(toNum(r.total)) })),
      charges: charges.map(r => ({ id: r.accountId, code: r.accountCode, name: r.accountName, axis: r.axis, amount: toNum(r.total) })),
      totalProduits,
      totalCharges,
      resultat: totalProduits - totalCharges,
      tauxMarge: totalProduits > 0 ? Math.round(((totalProduits - totalCharges) / totalProduits) * 100) : 0,
    });
  } catch (e) { next(e); }
});

export default router;
