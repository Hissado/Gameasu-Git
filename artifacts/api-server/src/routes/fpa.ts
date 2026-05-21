import { Router } from "express";
import { db } from "@workspace/db";
import {
  budgetsTable, budgetLinesTable,
  fiscalPeriodsTable, chartOfAccountsTable,
  journalEntriesTable, journalEntryLinesTable,
  projectsTable, departmentsTable, servicesTable, usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, lte, sql, inArray, isNull } from "drizzle-orm";
import { requireManagerOrAbove, requireAdmin } from "../middlewares/auth";
import ExcelJS from "exceljs";

const router = Router();

const toNum = (v: string | number | null | undefined): number => (v == null ? 0 : Number(v));

// ─── HELPERS ────────────────────────────────────────────────────────────────

function listMonths(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur <= last) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

function monthOfDate(iso: string): string {
  return iso.slice(0, 7);
}

async function loadBudgetWithLines(budgetId: string) {
  const [budget] = await db.select().from(budgetsTable).where(eq(budgetsTable.id, budgetId)).limit(1);
  if (!budget) return null;
  const lines = await db.select().from(budgetLinesTable).where(eq(budgetLinesTable.budgetId, budgetId));
  return { budget, lines };
}

async function loadFiscalPeriod(id: string) {
  const [fp] = await db.select().from(fiscalPeriodsTable).where(eq(fiscalPeriodsTable.id, id)).limit(1);
  return fp || null;
}

/**
 * Calcule les "actuels" comptables agrégés par compte × mois pour un périmètre.
 * - filtre dates : entryDate ∈ [fiscalPeriod.start, fiscalPeriod.end]
 * - filtre statut : seuls les écritures `posted` comptent
 * - filtre projets : projectId IN (projectIds) si fourni (sinon: tout)
 * - applique le sens normal du compte : expense→ debit−credit, revenue→ credit−debit
 */
async function computeActuals(opts: {
  fiscalStart: string;
  fiscalEnd: string;
  accountIds: string[];
  projectIds?: string[];          // undefined = company-wide
}): Promise<Map<string, number>> {
  // clé : `${accountId}::${YYYY-MM}` → montant
  const map = new Map<string, number>();
  if (opts.accountIds.length === 0) return map;

  const conds = [
    eq(journalEntriesTable.status, "posted"),
    gte(journalEntriesTable.entryDate, opts.fiscalStart),
    lte(journalEntriesTable.entryDate, opts.fiscalEnd),
    inArray(journalEntryLinesTable.accountId, opts.accountIds),
  ];
  if (opts.projectIds && opts.projectIds.length > 0) {
    conds.push(inArray(journalEntryLinesTable.projectId, opts.projectIds));
  } else if (opts.projectIds && opts.projectIds.length === 0) {
    // périmètre explicitement vide → aucun actuel
    return map;
  }

  const rows = await db.select({
    accountId: journalEntryLinesTable.accountId,
    period: sql<string>`substring(${journalEntriesTable.entryDate}, 1, 7)`,
    normalBalance: chartOfAccountsTable.normalBalance,
    debit: sql<string>`sum(${journalEntryLinesTable.debit})`,
    credit: sql<string>`sum(${journalEntryLinesTable.credit})`,
  })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(...conds))
    .groupBy(journalEntryLinesTable.accountId, sql`substring(${journalEntriesTable.entryDate}, 1, 7)`, chartOfAccountsTable.normalBalance);

  for (const r of rows) {
    const debit = toNum(r.debit);
    const credit = toNum(r.credit);
    const amount = r.normalBalance === "credit" ? (credit - debit) : (debit - credit);
    map.set(`${r.accountId}::${r.period}`, amount);
  }
  return map;
}

// ─── Validation helpers ────────────────────────────────────────────────────
const VALID_SCOPES = ["company", "project", "department", "service", "activity"] as const;
const VALID_KINDS = ["budget", "forecast"] as const;
const VALID_STATUSES = ["draft", "active", "archived"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const isUuid = (v: any) => typeof v === "string" && UUID_RE.test(v);

// Toutes les routes FP&A exposent des données financières sensibles → manager+
router.use("/fpa", requireManagerOrAbove);

// ════════════════════════════════════════════════════════════════════════════
// BUDGETS — CRUD + versioning
// ════════════════════════════════════════════════════════════════════════════

router.get("/fpa/budgets", async (req, res) => {
  const { fiscalPeriodId, scope, scopeId, kind, status } = req.query as Record<string, string>;
  const conds = [] as any[];
  if (fiscalPeriodId) conds.push(eq(budgetsTable.fiscalPeriodId, fiscalPeriodId));
  if (scope) conds.push(eq(budgetsTable.scope, scope));
  if (scopeId) conds.push(eq(budgetsTable.scopeId, scopeId));
  else if (scope === "company") conds.push(isNull(budgetsTable.scopeId));
  if (kind) conds.push(eq(budgetsTable.kind, kind));
  if (status) conds.push(eq(budgetsTable.status, status));
  const rows = await db.select({
    budget: budgetsTable,
    fiscalPeriodName: fiscalPeriodsTable.name,
    creatorFirstName: usersTable.firstName,
    creatorLastName: usersTable.lastName,
    totalAmount: sql<string>`coalesce((select sum(amount) from budget_lines bl where bl.budget_id = ${budgetsTable.id}), 0)`,
  })
    .from(budgetsTable)
    .leftJoin(fiscalPeriodsTable, eq(budgetsTable.fiscalPeriodId, fiscalPeriodsTable.id))
    .leftJoin(usersTable, eq(budgetsTable.createdById, usersTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(budgetsTable.createdAt));
  return res.json({
    data: rows.map((r) => ({
      ...r.budget,
      fiscalPeriodName: r.fiscalPeriodName,
      creatorName: r.creatorFirstName ? `${r.creatorFirstName} ${r.creatorLastName || ""}`.trim() : null,
      totalAmount: toNum(r.totalAmount),
    })),
  });
});

router.get("/fpa/budgets/:id", async (req, res) => {
  const data = await loadBudgetWithLines(req.params.id);
  if (!data) return res.status(404).json({ error: "Budget introuvable" });
  return res.json({
    ...data.budget,
    lines: data.lines.map((l) => ({ ...l, amount: toNum(l.amount) })),
  });
});

/**
 * Insertion atomique avec retry sur collision de version.
 * En concurrence, deux POST simultanés peuvent calculer le même `nextVersion` ;
 * la contrainte unique `budgets_version_uidx` lèvera et on retry (max 5 fois).
 */
async function insertBudgetWithVersion(payload: {
  name: string; kind: string; fiscalPeriodId: string;
  scope: string; scopeId: string | null; projectIds: string[];
  notes?: string | null; basedOnId?: string | null; status: string;
  createdById?: string | null;
}) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const existing = await tx.select({ v: budgetsTable.versionNumber }).from(budgetsTable).where(and(
          eq(budgetsTable.fiscalPeriodId, payload.fiscalPeriodId),
          eq(budgetsTable.scope, payload.scope),
          eq(budgetsTable.kind, payload.kind),
          payload.scopeId ? eq(budgetsTable.scopeId, payload.scopeId) : isNull(budgetsTable.scopeId),
        ));
        const nextVersion = (existing.reduce((m, r) => Math.max(m, r.v), 0) || 0) + 1;
        const [b] = await tx.insert(budgetsTable).values({
          ...payload, versionNumber: nextVersion,
        }).returning();
        return b;
      });
    } catch (e: any) {
      if (e?.code === "23505" && attempt < 9) continue;   // unique_violation → retry
      throw e;
    }
  }
  throw new Error("Impossible de créer le budget après plusieurs tentatives concurrentes");
}

router.post("/fpa/budgets", async (req, res) => {
  const userId = req.authUser!.id;
  const {
    name, kind = "budget", fiscalPeriodId, scope = "company", scopeId = null,
    projectIds = [], notes, basedOnId = null,
  } = req.body || {};

  // Validation stricte
  if (typeof name !== "string" || name.trim().length === 0) return res.status(400).json({ error: "name requis" });
  if (!isUuid(fiscalPeriodId)) return res.status(400).json({ error: "fiscalPeriodId UUID requis" });
  if (!VALID_SCOPES.includes(scope)) return res.status(400).json({ error: "scope invalide" });
  if (!VALID_KINDS.includes(kind)) return res.status(400).json({ error: "kind invalide (budget|forecast)" });
  if (scope === "company") {
    if (scopeId !== null && scopeId !== undefined && scopeId !== "") {
      return res.status(400).json({ error: "scopeId doit être null pour scope=company" });
    }
  } else {
    if (!isUuid(scopeId)) return res.status(400).json({ error: "scopeId UUID requis pour ce périmètre" });
  }
  if (basedOnId != null && !isUuid(basedOnId)) return res.status(400).json({ error: "basedOnId invalide" });
  const cleanProjectIds = Array.isArray(projectIds) ? projectIds.filter(isUuid) : [];

  // Vérifie l'existence des références
  const [fp] = await db.select({ id: fiscalPeriodsTable.id }).from(fiscalPeriodsTable)
    .where(eq(fiscalPeriodsTable.id, fiscalPeriodId)).limit(1);
  if (!fp) return res.status(404).json({ error: "Période fiscale introuvable" });

  try {
    const budget = await insertBudgetWithVersion({
      name: name.trim(), kind, fiscalPeriodId,
      scope, scopeId: scope === "company" ? null : scopeId,
      projectIds: cleanProjectIds,
      notes: notes ?? null, basedOnId: basedOnId ?? null,
      status: "draft", createdById: userId,
    });
    if (basedOnId) {
      const srcLines = await db.select().from(budgetLinesTable).where(eq(budgetLinesTable.budgetId, basedOnId));
      if (srcLines.length > 0) {
        await db.insert(budgetLinesTable).values(srcLines.map((l) => ({
          budgetId: budget.id, accountId: l.accountId, period: l.period, amount: l.amount, notes: l.notes,
        })));
      }
    }
    return res.status(201).json(budget);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Erreur création" });
  }
});

router.put("/fpa/budgets/:id", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const { name, notes, projectIds, status } = req.body || {};
  const upd: any = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name invalide" });
    upd.name = name.trim();
  }
  if (notes !== undefined) upd.notes = typeof notes === "string" ? notes : null;
  if (projectIds !== undefined) {
    if (!Array.isArray(projectIds)) return res.status(400).json({ error: "projectIds doit être un tableau" });
    upd.projectIds = projectIds.filter(isUuid);
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: "status invalide" });
    upd.status = status;
  }
  const [b] = await db.update(budgetsTable).set(upd).where(eq(budgetsTable.id, req.params.id)).returning();
  if (!b) return res.status(404).json({ error: "Introuvable" });
  return res.json(b);
});

router.delete("/fpa/budgets/:id", requireAdmin, async (req, res) => {
  const [b] = await db.select().from(budgetsTable).where(eq(budgetsTable.id, req.params.id)).limit(1);
  if (!b) return res.status(404).json({ error: "Introuvable" });
  if (b.status === "active") return res.status(400).json({ error: "Archivez d'abord cette version active" });
  await db.delete(budgetsTable).where(eq(budgetsTable.id, req.params.id));
  return res.status(204).send();
});

router.post("/fpa/budgets/:id/duplicate", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const userId = req.authUser!.id;
  const src = await loadBudgetWithLines(req.params.id);
  if (!src) return res.status(404).json({ error: "Source introuvable" });
  const { name, kind } = req.body || {};
  const newKind = kind || src.budget.kind;
  if (!VALID_KINDS.includes(newKind)) return res.status(400).json({ error: "kind invalide" });
  try {
    const b = await insertBudgetWithVersion({
      name: (typeof name === "string" && name.trim()) ? name.trim() : `${src.budget.name} (copie)`,
      kind: newKind,
      fiscalPeriodId: src.budget.fiscalPeriodId,
      scope: src.budget.scope, scopeId: src.budget.scopeId,
      projectIds: src.budget.projectIds || [],
      notes: src.budget.notes, basedOnId: src.budget.id,
      status: "draft", createdById: userId,
    });
    if (src.lines.length > 0) {
      await db.insert(budgetLinesTable).values(src.lines.map((l) => ({
        budgetId: b.id, accountId: l.accountId, period: l.period, amount: l.amount, notes: l.notes,
      })));
    }
    return res.status(201).json(b);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Erreur duplication" });
  }
});

/**
 * Activation atomique : archivage de l'ancienne version active + activation
 * dans une seule transaction. Empêche l'état "deux versions actives" en concurrence.
 */
router.post("/fpa/budgets/:id/activate", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  try {
    const updated = await db.transaction(async (tx) => {
      const [b] = await tx.select().from(budgetsTable).where(eq(budgetsTable.id, req.params.id)).limit(1);
      if (!b) throw Object.assign(new Error("Introuvable"), { httpStatus: 404 });
      await tx.update(budgetsTable).set({ status: "archived" }).where(and(
        eq(budgetsTable.fiscalPeriodId, b.fiscalPeriodId),
        eq(budgetsTable.scope, b.scope),
        eq(budgetsTable.kind, b.kind),
        eq(budgetsTable.status, "active"),
        b.scopeId ? eq(budgetsTable.scopeId, b.scopeId) : isNull(budgetsTable.scopeId),
      ));
      const [u] = await tx.update(budgetsTable).set({ status: "active" })
        .where(eq(budgetsTable.id, req.params.id)).returning();
      return u;
    });
    return res.json(updated);
  } catch (e: any) {
    return res.status(e.httpStatus || 500).json({ error: e.message || "Erreur activation" });
  }
});

// ─── BUDGET LINES — bulk upsert ─────────────────────────────────────────────

router.put("/fpa/budgets/:id/lines", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const { lines } = req.body || {};
  if (!Array.isArray(lines)) return res.status(400).json({ error: "lines doit être un tableau" });
  const [b] = await db.select().from(budgetsTable).where(eq(budgetsTable.id, req.params.id)).limit(1);
  if (!b) return res.status(404).json({ error: "Introuvable" });
  const fp = await loadFiscalPeriod(b.fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période fiscale introuvable" });
  const validMonths = new Set(listMonths(fp.startDate, fp.endDate));

  // Validation stricte par ligne
  const distinctAccountIds = new Set<string>();
  for (const l of lines) {
    if (!isUuid(l?.accountId)) return res.status(400).json({ error: "accountId UUID requis" });
    if (typeof l.period !== "string" || !MONTH_RE.test(l.period)) {
      return res.status(400).json({ error: `period invalide: ${l.period}` });
    }
    if (!validMonths.has(l.period)) {
      return res.status(400).json({ error: `period ${l.period} hors période fiscale` });
    }
    const amt = Number(l.amount);
    if (!Number.isFinite(amt)) return res.status(400).json({ error: "amount doit être un nombre fini" });
    distinctAccountIds.add(l.accountId);
  }
  if (distinctAccountIds.size > 0) {
    const present = await db.select({ id: chartOfAccountsTable.id })
      .from(chartOfAccountsTable).where(inArray(chartOfAccountsTable.id, Array.from(distinctAccountIds)));
    if (present.length !== distinctAccountIds.size) {
      return res.status(400).json({ error: "Au moins un compte référencé n'existe pas" });
    }
  }

  // Stratégie : remplacement complet pour ce budget.
  await db.transaction(async (tx) => {
    await tx.delete(budgetLinesTable).where(eq(budgetLinesTable.budgetId, req.params.id));
    if (lines.length > 0) {
      await tx.insert(budgetLinesTable).values(lines.map((l: any) => ({
        budgetId: req.params.id,
        accountId: l.accountId,
        period: l.period,
        amount: String(l.amount),
        notes: l.notes ?? null,
      })));
    }
  });
  const fresh = await db.select().from(budgetLinesTable).where(eq(budgetLinesTable.budgetId, req.params.id));
  return res.json({ data: fresh.map((l) => ({ ...l, amount: toNum(l.amount) })) });
});

// ════════════════════════════════════════════════════════════════════════════
// VARIANCE — actual vs budget par compte × mois
// ════════════════════════════════════════════════════════════════════════════

async function buildVarianceReport(budgetId: string) {
  const data = await loadBudgetWithLines(budgetId);
  if (!data) return null;
  const fp = await loadFiscalPeriod(data.budget.fiscalPeriodId);
  if (!fp) return null;
  const months = listMonths(fp.startDate, fp.endDate);

  const accountIds = Array.from(new Set(data.lines.map((l) => l.accountId)));
  const accounts = accountIds.length > 0
    ? await db.select().from(chartOfAccountsTable).where(inArray(chartOfAccountsTable.id, accountIds))
    : [];
  const accById = new Map(accounts.map((a) => [a.id, a]));

  const projectIds = data.budget.scope === "company"
    ? undefined
    : data.budget.scope === "project" && data.budget.scopeId
      ? [data.budget.scopeId]
      : (data.budget.projectIds || []);

  const actuals = await computeActuals({
    fiscalStart: fp.startDate, fiscalEnd: fp.endDate,
    accountIds, projectIds,
  });

  // Construction des cellules : pour chaque (account × month), montant budget + actual + variance.
  const budgetByCell = new Map<string, number>();
  for (const l of data.lines) {
    budgetByCell.set(`${l.accountId}::${l.period}`, toNum(l.amount));
  }

  const rows = accountIds.map((aid) => {
    const acc = accById.get(aid);
    const cells = months.map((m) => {
      const budget = budgetByCell.get(`${aid}::${m}`) || 0;
      const actual = actuals.get(`${aid}::${m}`) || 0;
      const variance = actual - budget;
      const variancePct = budget !== 0 ? (variance / Math.abs(budget)) * 100 : (actual !== 0 ? 100 : 0);
      return { period: m, budget, actual, variance, variancePct };
    });
    const totalBudget = cells.reduce((s, c) => s + c.budget, 0);
    const totalActual = cells.reduce((s, c) => s + c.actual, 0);
    const totalVariance = totalActual - totalBudget;
    const totalVariancePct = totalBudget !== 0 ? (totalVariance / Math.abs(totalBudget)) * 100 : (totalActual !== 0 ? 100 : 0);
    return {
      accountId: aid,
      accountCode: acc?.code || "",
      accountLabel: acc?.label || "(compte introuvable)",
      classNum: acc?.classNum || 0,
      normalBalance: acc?.normalBalance || "debit",
      cells,
      totalBudget, totalActual, totalVariance, totalVariancePct,
    };
  }).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  // Totaux globaux par mois.
  const monthlyTotals = months.map((m) => {
    const budget = rows.reduce((s, r) => s + (r.cells.find((c) => c.period === m)?.budget || 0), 0);
    const actual = rows.reduce((s, r) => s + (r.cells.find((c) => c.period === m)?.actual || 0), 0);
    return { period: m, budget, actual, variance: actual - budget };
  });

  return {
    budget: data.budget,
    fiscalPeriod: fp,
    months,
    rows,
    monthlyTotals,
    totals: {
      budget: monthlyTotals.reduce((s, m) => s + m.budget, 0),
      actual: monthlyTotals.reduce((s, m) => s + m.actual, 0),
      variance: monthlyTotals.reduce((s, m) => s + m.variance, 0),
    },
  };
}

router.get("/fpa/variance", async (req, res) => {
  const { budgetId } = req.query as Record<string, string>;
  if (!budgetId) return res.status(400).json({ error: "budgetId requis" });
  const report = await buildVarianceReport(budgetId);
  if (!report) return res.status(404).json({ error: "Budget ou période introuvable" });
  return res.json(report);
});

// ─── ACTUAL vs FORECAST ─────────────────────────────────────────────────────
// Compare un forecast (kind=forecast) au réalisé. Mêmes règles d'agrégation.

router.get("/fpa/actual-vs-forecast", async (req, res) => {
  const { forecastId } = req.query as Record<string, string>;
  if (!forecastId) return res.status(400).json({ error: "forecastId requis" });
  const report = await buildVarianceReport(forecastId);
  if (!report) return res.status(404).json({ error: "Forecast introuvable" });
  if (report.budget.kind !== "forecast") {
    return res.status(400).json({ error: "Le budget fourni n'est pas un forecast" });
  }
  return res.json(report);
});

// ─── PROJECTION FIN D'ANNÉE ─────────────────────────────────────────────────
// Pour chaque compte : actuals YTD + budget pour les mois restants
// + projection linéaire (extrapolation actuels YTD).

router.get("/fpa/year-end-projection", async (req, res) => {
  const { budgetId, asOfDate } = req.query as Record<string, string>;
  if (!budgetId) return res.status(400).json({ error: "budgetId requis" });
  const v = await buildVarianceReport(budgetId);
  if (!v) return res.status(404).json({ error: "Budget introuvable" });
  const today = asOfDate || new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const projection = v.rows.map((r) => {
    const ytdMonths = r.cells.filter((c) => c.period <= currentMonth);
    const remaining = r.cells.filter((c) => c.period > currentMonth);
    const ytdActual = ytdMonths.reduce((s, c) => s + c.actual, 0);
    const remainingBudget = remaining.reduce((s, c) => s + c.budget, 0);
    const projectedTotal = ytdActual + remainingBudget;

    const monthsElapsed = ytdMonths.length;
    const monthsTotal = r.cells.length;
    const linearProjection = monthsElapsed > 0 ? (ytdActual / monthsElapsed) * monthsTotal : 0;

    const annualBudget = r.totalBudget;
    const projectedVariance = projectedTotal - annualBudget;
    const projectedVariancePct = annualBudget !== 0
      ? (projectedVariance / Math.abs(annualBudget)) * 100 : 0;
    return {
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountLabel: r.accountLabel,
      annualBudget,
      ytdActual,
      remainingBudget,
      projectedTotal,
      linearProjection,
      projectedVariance,
      projectedVariancePct,
    };
  });

  const totals = {
    annualBudget: projection.reduce((s, r) => s + r.annualBudget, 0),
    ytdActual: projection.reduce((s, r) => s + r.ytdActual, 0),
    projectedTotal: projection.reduce((s, r) => s + r.projectedTotal, 0),
    linearProjection: projection.reduce((s, r) => s + r.linearProjection, 0),
  };
  return res.json({
    budget: v.budget, fiscalPeriod: v.fiscalPeriod, asOfDate: today, currentMonth,
    rows: projection, totals,
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SYNTHÈSES — par projet / département
// ════════════════════════════════════════════════════════════════════════════

router.get("/fpa/by-project", async (req, res) => {
  const { fiscalPeriodId } = req.query as Record<string, string>;
  if (!fiscalPeriodId) return res.status(400).json({ error: "fiscalPeriodId requis" });
  const fp = await loadFiscalPeriod(fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période introuvable" });

  const budgets = await db.select().from(budgetsTable).where(and(
    eq(budgetsTable.fiscalPeriodId, fiscalPeriodId),
    eq(budgetsTable.scope, "project"),
    eq(budgetsTable.kind, "budget"),
    eq(budgetsTable.status, "active"),
  ));

  // Total budgétaire par projet (depuis les lignes)
  const budgetTotals = new Map<string, number>();
  if (budgets.length > 0) {
    const ids = budgets.map((b) => b.id);
    const lineSums = await db.select({
      budgetId: budgetLinesTable.budgetId,
      total: sql<string>`sum(${budgetLinesTable.amount})`,
    }).from(budgetLinesTable).where(inArray(budgetLinesTable.budgetId, ids))
      .groupBy(budgetLinesTable.budgetId);
    for (const row of lineSums) {
      const b = budgets.find((bb) => bb.id === row.budgetId);
      if (b?.scopeId) budgetTotals.set(b.scopeId, (budgetTotals.get(b.scopeId) || 0) + toNum(row.total));
    }
  }

  // Actuels par projet : somme débit-crédit (charges) + crédit-débit (produits) par projetId
  const allActuals = await db.select({
    projectId: journalEntryLinesTable.projectId,
    normalBalance: chartOfAccountsTable.normalBalance,
    debit: sql<string>`sum(${journalEntryLinesTable.debit})`,
    credit: sql<string>`sum(${journalEntryLinesTable.credit})`,
  }).from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(
      eq(journalEntriesTable.status, "posted"),
      gte(journalEntriesTable.entryDate, fp.startDate),
      lte(journalEntriesTable.entryDate, fp.endDate),
      sql`${journalEntryLinesTable.projectId} IS NOT NULL`,
      inArray(chartOfAccountsTable.classNum, [6, 7]),
    ))
    .groupBy(journalEntryLinesTable.projectId, chartOfAccountsTable.normalBalance);

  const expensesByProject = new Map<string, number>();
  const revenuesByProject = new Map<string, number>();
  for (const r of allActuals) {
    if (!r.projectId) continue;
    const debit = toNum(r.debit);
    const credit = toNum(r.credit);
    if (r.normalBalance === "debit") {
      expensesByProject.set(r.projectId, (expensesByProject.get(r.projectId) || 0) + debit - credit);
    } else {
      revenuesByProject.set(r.projectId, (revenuesByProject.get(r.projectId) || 0) + credit - debit);
    }
  }

  const allProjectIds = new Set<string>();
  budgets.forEach((b) => { if (b.scopeId) allProjectIds.add(b.scopeId); });
  expensesByProject.forEach((_v, k) => allProjectIds.add(k));
  revenuesByProject.forEach((_v, k) => allProjectIds.add(k));

  const projects = allProjectIds.size > 0
    ? await db.select().from(projectsTable).where(inArray(projectsTable.id, Array.from(allProjectIds)))
    : [];

  const rows = projects.map((p) => {
    const totalBudget = budgetTotals.get(p.id) || 0;
    const expenses = expensesByProject.get(p.id) || 0;
    const revenues = revenuesByProject.get(p.id) || 0;
    const margin = revenues - expenses;
    const consumption = totalBudget !== 0 ? (expenses / totalBudget) * 100 : 0;
    return {
      projectId: p.id,
      projectName: p.name,
      projectStatus: p.status,
      annualBudget: totalBudget,
      revenues,
      expenses,
      margin,
      budgetConsumptionPct: consumption,
      hasBudget: totalBudget > 0,
    };
  }).sort((a, b) => b.expenses - a.expenses);

  return res.json({
    fiscalPeriod: fp,
    rows,
    totals: {
      annualBudget: rows.reduce((s, r) => s + r.annualBudget, 0),
      revenues: rows.reduce((s, r) => s + r.revenues, 0),
      expenses: rows.reduce((s, r) => s + r.expenses, 0),
      margin: rows.reduce((s, r) => s + r.margin, 0),
    },
  });
});

router.get("/fpa/by-department", async (req, res) => {
  const { fiscalPeriodId } = req.query as Record<string, string>;
  if (!fiscalPeriodId) return res.status(400).json({ error: "fiscalPeriodId requis" });
  const fp = await loadFiscalPeriod(fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période introuvable" });

  const departments = await db.select().from(departmentsTable);
  const budgets = await db.select().from(budgetsTable).where(and(
    eq(budgetsTable.fiscalPeriodId, fiscalPeriodId),
    eq(budgetsTable.scope, "department"),
    eq(budgetsTable.kind, "budget"),
    eq(budgetsTable.status, "active"),
  ));

  const rows: Array<{
    departmentId: string; departmentName: string;
    annualBudget: number; actuals: number; variance: number; consumptionPct: number;
    projectIds: string[];
  }> = [];

  for (const d of departments) {
    const dBudget = budgets.find((b) => b.scopeId === d.id);
    let total = 0;
    if (dBudget) {
      const sums = await db.select({ s: sql<string>`sum(amount)` })
        .from(budgetLinesTable).where(eq(budgetLinesTable.budgetId, dBudget.id));
      total = toNum(sums[0]?.s);
    }
    const projectIds = dBudget?.projectIds || [];
    let actuals = 0;
    if (projectIds.length > 0) {
      const r = await db.select({
        debit: sql<string>`sum(${journalEntryLinesTable.debit})`,
        credit: sql<string>`sum(${journalEntryLinesTable.credit})`,
      }).from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
        .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
        .where(and(
          eq(journalEntriesTable.status, "posted"),
          gte(journalEntriesTable.entryDate, fp.startDate),
          lte(journalEntriesTable.entryDate, fp.endDate),
          inArray(journalEntryLinesTable.projectId, projectIds),
          eq(chartOfAccountsTable.classNum, 6),
        ));
      actuals = toNum(r[0]?.debit) - toNum(r[0]?.credit);
    }
    rows.push({
      departmentId: d.id, departmentName: d.name,
      annualBudget: total, actuals, variance: actuals - total,
      consumptionPct: total !== 0 ? (actuals / total) * 100 : 0,
      projectIds,
    });
  }
  return res.json({
    fiscalPeriod: fp,
    rows: rows.sort((a, b) => b.annualBudget - a.annualBudget),
    totals: {
      annualBudget: rows.reduce((s, r) => s + r.annualBudget, 0),
      actuals: rows.reduce((s, r) => s + r.actuals, 0),
      variance: rows.reduce((s, r) => s + r.variance, 0),
    },
  });
});

// ─── KPI SUMMARY ────────────────────────────────────────────────────────────

router.get("/fpa/summary", async (req, res) => {
  const { fiscalPeriodId } = req.query as Record<string, string>;
  if (!fiscalPeriodId) return res.status(400).json({ error: "fiscalPeriodId requis" });
  const fp = await loadFiscalPeriod(fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période introuvable" });

  // Budget entreprise actif
  const [companyBudget] = await db.select().from(budgetsTable).where(and(
    eq(budgetsTable.fiscalPeriodId, fiscalPeriodId),
    eq(budgetsTable.scope, "company"),
    eq(budgetsTable.kind, "budget"),
    eq(budgetsTable.status, "active"),
  )).limit(1);

  let totalBudget = 0, totalActual = 0;
  let topVariances: Array<{ accountCode: string; accountLabel: string; variance: number; variancePct: number }> = [];
  let monthly: Array<{ period: string; budget: number; actual: number }> = [];
  if (companyBudget) {
    const v = await buildVarianceReport(companyBudget.id);
    if (v) {
      totalBudget = v.totals.budget;
      totalActual = v.totals.actual;
      monthly = v.monthlyTotals.map((m) => ({ period: m.period, budget: m.budget, actual: m.actual }));
      topVariances = v.rows
        .map((r) => ({
          accountCode: r.accountCode,
          accountLabel: r.accountLabel,
          variance: r.totalVariance,
          variancePct: r.totalVariancePct,
        }))
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
        .slice(0, 8);
    }
  }

  // Décompte des budgets par scope
  const scopeCounts = await db.select({
    scope: budgetsTable.scope,
    kind: budgetsTable.kind,
    count: sql<string>`count(*)`,
  }).from(budgetsTable).where(eq(budgetsTable.fiscalPeriodId, fiscalPeriodId))
    .groupBy(budgetsTable.scope, budgetsTable.kind);

  return res.json({
    fiscalPeriod: fp,
    companyBudget: companyBudget || null,
    totals: {
      budget: totalBudget,
      actual: totalActual,
      variance: totalActual - totalBudget,
      executionPct: totalBudget !== 0 ? (totalActual / totalBudget) * 100 : 0,
    },
    monthly,
    topVariances,
    scopeCounts: scopeCounts.map((s) => ({ scope: s.scope, kind: s.kind, count: parseInt(s.count) })),
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS EXCEL
// ════════════════════════════════════════════════════════════════════════════

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEA580C" } };
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const SUBHEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1F2937" } };
const TOTAL_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEF3C7" } };
const FCFA_FORMAT = '#,##0 "FCFA"';
const PCT_FORMAT = '0.0"%"';

function applyMoneyFormat(cell: ExcelJS.Cell) { cell.numFmt = FCFA_FORMAT; }
function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
  });
  row.height = 22;
}
function styleTotalRow(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.fill = TOTAL_FILL;
    c.font = { bold: true };
    c.border = { top: { style: "double" }, bottom: { style: "double" } };
  });
}

async function sendWorkbook(res: any, wb: ExcelJS.Workbook, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// EXPORT — Budget détail (matrice account × mois)
router.get("/fpa/export/budget/:id.xlsx", async (req, res) => {
  const data = await loadBudgetWithLines(req.params.id);
  if (!data) return res.status(404).json({ error: "Introuvable" });
  const fp = await loadFiscalPeriod(data.budget.fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période introuvable" });
  const months = listMonths(fp.startDate, fp.endDate);
  const accountIds = Array.from(new Set(data.lines.map((l) => l.accountId)));
  const accounts = accountIds.length > 0
    ? await db.select().from(chartOfAccountsTable).where(inArray(chartOfAccountsTable.id, accountIds))
    : [];
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const cellMap = new Map<string, number>();
  for (const l of data.lines) cellMap.set(`${l.accountId}::${l.period}`, toNum(l.amount));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gaméasù — FP&A";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Budget ${data.budget.versionNumber}`);
  ws.mergeCells(1, 1, 1, months.length + 4);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${data.budget.name} — ${fp.name} (v${data.budget.versionNumber})`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFEA580C" } };
  titleCell.alignment = { horizontal: "center" };
  ws.addRow([]);

  const header = ["Code", "Compte", "Classe", ...months, "Total annuel"];
  const headerRow = ws.addRow(header);
  styleHeaderRow(headerRow);

  for (const aid of accountIds.sort((a, b) => (accById.get(a)?.code || "").localeCompare(accById.get(b)?.code || ""))) {
    const acc = accById.get(aid);
    const cells = months.map((m) => cellMap.get(`${aid}::${m}`) || 0);
    const total = cells.reduce((s, v) => s + v, 0);
    const row = ws.addRow([acc?.code || "", acc?.label || "", acc?.classNum || "", ...cells, total]);
    for (let i = 4; i <= header.length; i++) applyMoneyFormat(row.getCell(i));
  }

  // Totaux par mois
  const totalsByMonth = months.map((m) => {
    let t = 0;
    for (const aid of accountIds) t += cellMap.get(`${aid}::${m}`) || 0;
    return t;
  });
  const totalRow = ws.addRow(["", "TOTAL", "", ...totalsByMonth, totalsByMonth.reduce((s, v) => s + v, 0)]);
  styleTotalRow(totalRow);
  for (let i = 4; i <= header.length; i++) applyMoneyFormat(totalRow.getCell(i));

  ws.columns.forEach((col, i) => {
    col.width = i === 1 ? 36 : i === 0 ? 12 : 16;
  });

  await sendWorkbook(res, wb, `budget-${data.budget.name.replace(/[^a-z0-9]/gi, "_")}-v${data.budget.versionNumber}.xlsx`);
});

// EXPORT — Rapport de variance (actual vs budget)
router.get("/fpa/export/variance/:budgetId.xlsx", async (req, res) => {
  const v = await buildVarianceReport(req.params.budgetId);
  if (!v) return res.status(404).json({ error: "Introuvable" });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gaméasù — FP&A";
  wb.created = new Date();

  // Onglet 1 : synthèse globale
  const wsSummary = wb.addWorksheet("Synthèse");
  wsSummary.mergeCells(1, 1, 1, 5);
  const t = wsSummary.getCell(1, 1);
  t.value = `Analyse de variance — ${v.budget.name} (${v.fiscalPeriod.name})`;
  t.font = { bold: true, size: 14, color: { argb: "FFEA580C" } };
  t.alignment = { horizontal: "center" };
  wsSummary.addRow([]);
  const summaryHeader = wsSummary.addRow(["Mois", "Budget", "Réalisé", "Écart (FCFA)", "Écart (%)"]);
  styleHeaderRow(summaryHeader);
  for (const m of v.monthlyTotals) {
    const pct = m.budget !== 0 ? (m.variance / Math.abs(m.budget)) * 100 : 0;
    const r = wsSummary.addRow([m.period, m.budget, m.actual, m.variance, pct]);
    applyMoneyFormat(r.getCell(2));
    applyMoneyFormat(r.getCell(3));
    applyMoneyFormat(r.getCell(4));
    r.getCell(5).numFmt = PCT_FORMAT;
  }
  const totalsRow = wsSummary.addRow([
    "TOTAL", v.totals.budget, v.totals.actual, v.totals.variance,
    v.totals.budget !== 0 ? (v.totals.variance / Math.abs(v.totals.budget)) * 100 : 0,
  ]);
  styleTotalRow(totalsRow);
  applyMoneyFormat(totalsRow.getCell(2));
  applyMoneyFormat(totalsRow.getCell(3));
  applyMoneyFormat(totalsRow.getCell(4));
  totalsRow.getCell(5).numFmt = PCT_FORMAT;
  wsSummary.columns.forEach((c, i) => { c.width = i === 0 ? 14 : 18; });

  // Onglet 2 : détail par compte × mois
  const wsDetail = wb.addWorksheet("Détail par compte");
  const detailHeader = ["Code", "Compte", ...v.months.flatMap((m) => [`${m} Budget`, `${m} Réalisé`, `${m} Écart`]), "Total Budget", "Total Réalisé", "Total Écart", "Écart %"];
  const dHeader = wsDetail.addRow(detailHeader);
  styleHeaderRow(dHeader);
  for (const r of v.rows) {
    const cells: any[] = [r.accountCode, r.accountLabel];
    for (const c of r.cells) cells.push(c.budget, c.actual, c.variance);
    cells.push(r.totalBudget, r.totalActual, r.totalVariance, r.totalVariancePct);
    const row = wsDetail.addRow(cells);
    for (let i = 3; i <= cells.length - 1; i++) applyMoneyFormat(row.getCell(i));
    row.getCell(cells.length).numFmt = PCT_FORMAT;
  }
  wsDetail.columns.forEach((c, i) => { c.width = i === 1 ? 32 : 14; });
  wsDetail.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  await sendWorkbook(res, wb, `variance-${v.budget.name.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
});

// EXPORT — Forecast vs réalisé
router.get("/fpa/export/forecast/:forecastId.xlsx", async (req, res) => {
  const v = await buildVarianceReport(req.params.forecastId);
  if (!v) return res.status(404).json({ error: "Introuvable" });
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gaméasù — FP&A";
  const ws = wb.addWorksheet("Forecast vs réalisé");
  ws.mergeCells(1, 1, 1, 6);
  const t = ws.getCell(1, 1);
  t.value = `Prévisionnel vs réalisé — ${v.budget.name} (${v.fiscalPeriod.name})`;
  t.font = { bold: true, size: 14, color: { argb: "FFEA580C" } };
  t.alignment = { horizontal: "center" };
  ws.addRow([]);
  const h = ws.addRow(["Code", "Compte", "Forecast", "Réalisé", "Écart", "Écart %"]);
  styleHeaderRow(h);
  for (const r of v.rows) {
    const row = ws.addRow([r.accountCode, r.accountLabel, r.totalBudget, r.totalActual, r.totalVariance, r.totalVariancePct]);
    applyMoneyFormat(row.getCell(3));
    applyMoneyFormat(row.getCell(4));
    applyMoneyFormat(row.getCell(5));
    row.getCell(6).numFmt = PCT_FORMAT;
  }
  const tr = ws.addRow(["", "TOTAL", v.totals.budget, v.totals.actual, v.totals.variance,
    v.totals.budget !== 0 ? (v.totals.variance / Math.abs(v.totals.budget)) * 100 : 0]);
  styleTotalRow(tr);
  for (let i = 3; i <= 5; i++) applyMoneyFormat(tr.getCell(i));
  tr.getCell(6).numFmt = PCT_FORMAT;
  ws.columns.forEach((c, i) => { c.width = i === 1 ? 32 : 16; });
  await sendWorkbook(res, wb, `forecast-${v.budget.name.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
});

// EXPORT — Synthèse par projet
router.get("/fpa/export/by-project/:fiscalPeriodId.xlsx", async (req, res) => {
  // On récupère la même donnée que l'endpoint JSON
  req.query.fiscalPeriodId = req.params.fiscalPeriodId;
  const fp = await loadFiscalPeriod(req.params.fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période introuvable" });

  // Réutilise la logique en dupliquant : appel direct à la fonction n'est pas pratique
  // → on reproduit ici la requête synthèse simplifiée.
  const projectsAll = await db.select().from(projectsTable);
  const exp = await db.select({
    projectId: journalEntryLinesTable.projectId,
    debit: sql<string>`sum(${journalEntryLinesTable.debit})`,
    credit: sql<string>`sum(${journalEntryLinesTable.credit})`,
  }).from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(
      eq(journalEntriesTable.status, "posted"),
      gte(journalEntriesTable.entryDate, fp.startDate),
      lte(journalEntriesTable.entryDate, fp.endDate),
      sql`${journalEntryLinesTable.projectId} IS NOT NULL`,
      eq(chartOfAccountsTable.classNum, 6),
    )).groupBy(journalEntryLinesTable.projectId);
  const rev = await db.select({
    projectId: journalEntryLinesTable.projectId,
    debit: sql<string>`sum(${journalEntryLinesTable.debit})`,
    credit: sql<string>`sum(${journalEntryLinesTable.credit})`,
  }).from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(
      eq(journalEntriesTable.status, "posted"),
      gte(journalEntriesTable.entryDate, fp.startDate),
      lte(journalEntriesTable.entryDate, fp.endDate),
      sql`${journalEntryLinesTable.projectId} IS NOT NULL`,
      eq(chartOfAccountsTable.classNum, 7),
    )).groupBy(journalEntryLinesTable.projectId);

  const expMap = new Map(exp.map((r) => [r.projectId!, toNum(r.debit) - toNum(r.credit)]));
  const revMap = new Map(rev.map((r) => [r.projectId!, toNum(r.credit) - toNum(r.debit)]));

  const budgets = await db.select().from(budgetsTable).where(and(
    eq(budgetsTable.fiscalPeriodId, fp.id),
    eq(budgetsTable.scope, "project"),
    eq(budgetsTable.status, "active"),
    eq(budgetsTable.kind, "budget"),
  ));
  const budgetTotalsMap = new Map<string, number>();
  if (budgets.length) {
    const sums = await db.select({
      budgetId: budgetLinesTable.budgetId,
      total: sql<string>`sum(${budgetLinesTable.amount})`,
    }).from(budgetLinesTable).where(inArray(budgetLinesTable.budgetId, budgets.map((b) => b.id)))
      .groupBy(budgetLinesTable.budgetId);
    for (const s of sums) {
      const b = budgets.find((bb) => bb.id === s.budgetId);
      if (b?.scopeId) budgetTotalsMap.set(b.scopeId, toNum(s.total));
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gaméasù — FP&A";
  const ws = wb.addWorksheet("Synthèse par projet");
  ws.mergeCells(1, 1, 1, 7);
  const t = ws.getCell(1, 1);
  t.value = `Synthèse projet — ${fp.name}`;
  t.font = { bold: true, size: 14, color: { argb: "FFEA580C" } };
  t.alignment = { horizontal: "center" };
  ws.addRow([]);
  const h = ws.addRow(["Projet", "Statut", "Budget annuel", "Produits", "Charges", "Marge", "Conso. budget %"]);
  styleHeaderRow(h);
  let tBudget = 0, tRev = 0, tExp = 0;
  for (const p of projectsAll) {
    const b = budgetTotalsMap.get(p.id) || 0;
    const r = revMap.get(p.id) || 0;
    const e = expMap.get(p.id) || 0;
    if (b === 0 && r === 0 && e === 0) continue;
    tBudget += b; tRev += r; tExp += e;
    const row = ws.addRow([p.name, p.status, b, r, e, r - e, b !== 0 ? (e / b) * 100 : 0]);
    for (let i = 3; i <= 6; i++) applyMoneyFormat(row.getCell(i));
    row.getCell(7).numFmt = PCT_FORMAT;
  }
  const tr = ws.addRow(["TOTAL", "", tBudget, tRev, tExp, tRev - tExp, tBudget !== 0 ? (tExp / tBudget) * 100 : 0]);
  styleTotalRow(tr);
  for (let i = 3; i <= 6; i++) applyMoneyFormat(tr.getCell(i));
  tr.getCell(7).numFmt = PCT_FORMAT;
  ws.columns.forEach((c, i) => { c.width = i === 0 ? 32 : 16; });
  await sendWorkbook(res, wb, `synthese-projets-${fp.name.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
});

export default router;
