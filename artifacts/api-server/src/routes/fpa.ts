import { Router } from "express";
import { db } from "@workspace/db";
import {
  budgetsTable, budgetLinesTable,
  fiscalPeriodsTable, chartOfAccountsTable,
  journalEntriesTable, journalEntryLinesTable,
  projectsTable, departmentsTable, servicesTable, usersTable,
  invoicesTable, supplierInvoicesTable, suppliersTable, bankAccountsTable,
} from "@workspace/db";
import { clientsTable } from "@workspace/db";
import { and, asc, desc, eq, gte, lte, sql, inArray, isNull } from "drizzle-orm";
import { requireManagerOrAbove, requireAdmin } from "../middlewares/auth";
import { requirePermission } from "../middlewares/permissions";
import { ExcelReportBuilder } from "../lib/excel-engine";
import { organizationsTable } from "@workspace/db";

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

async function loadBudgetWithLines(orgId: string, budgetId: string) {
  const [budget] = await db.select().from(budgetsTable).where(and(eq(budgetsTable.organizationId, orgId), eq(budgetsTable.id, budgetId))).limit(1);
  if (!budget) return null;
  const lines = await db.select().from(budgetLinesTable).where(eq(budgetLinesTable.budgetId, budgetId));
  return { budget, lines };
}

async function loadFiscalPeriod(orgId: string, id: string) {
  const [fp] = await db.select().from(fiscalPeriodsTable).where(and(eq(fiscalPeriodsTable.organizationId, orgId), eq(fiscalPeriodsTable.id, id))).limit(1);
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
  organizationId: string;
  fiscalStart: string;
  fiscalEnd: string;
  accountIds: string[];
  projectIds?: string[];          // undefined = company-wide
}): Promise<Map<string, number>> {
  // clé : `${accountId}::${YYYY-MM}` → montant
  const map = new Map<string, number>();
  if (opts.accountIds.length === 0) return map;

  const conds = [
    eq(journalEntriesTable.organizationId, opts.organizationId),
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
  const conds: any[] = [eq(budgetsTable.organizationId, req.authUser!.organizationId)];
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
    .where(and(...conds))
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
  const data = await loadBudgetWithLines(req.authUser!.organizationId, (req.params.id as string));
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
async function insertBudgetWithVersion(orgId: string, payload: {
  name: string; kind: string; fiscalPeriodId: string;
  scope: string; scopeId: string | null; projectIds: string[];
  notes?: string | null; basedOnId?: string | null; status: string;
  createdById?: string | null;
}) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const existing = await tx.select({ v: budgetsTable.versionNumber }).from(budgetsTable).where(and(
          eq(budgetsTable.organizationId, orgId),
          eq(budgetsTable.fiscalPeriodId, payload.fiscalPeriodId),
          eq(budgetsTable.scope, payload.scope),
          eq(budgetsTable.kind, payload.kind),
          payload.scopeId ? eq(budgetsTable.scopeId, payload.scopeId) : isNull(budgetsTable.scopeId),
        ));
        const nextVersion = (existing.reduce((m, r) => Math.max(m, r.v), 0) || 0) + 1;
        const [b] = await tx.insert(budgetsTable).values({
          organizationId: orgId,
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

router.post("/fpa/budgets", requirePermission("fpa.manage"), async (req, res) => {
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
  const orgId = req.authUser!.organizationId;
  const [fp] = await db.select({ id: fiscalPeriodsTable.id }).from(fiscalPeriodsTable)
    .where(and(eq(fiscalPeriodsTable.organizationId, orgId), eq(fiscalPeriodsTable.id, fiscalPeriodId))).limit(1);
  if (!fp) return res.status(404).json({ error: "Période fiscale introuvable" });

  try {
    const budget = await insertBudgetWithVersion(orgId, {
      name: name.trim(), kind, fiscalPeriodId,
      scope, scopeId: scope === "company" ? null : scopeId,
      projectIds: cleanProjectIds,
      notes: notes ?? null, basedOnId: basedOnId ?? null,
      status: "draft", createdById: userId,
    });
    if (basedOnId) {
      const [srcBudget] = await db.select().from(budgetsTable).where(and(eq(budgetsTable.organizationId, orgId), eq(budgetsTable.id, basedOnId))).limit(1);
      if (!srcBudget) return res.status(404).json({ error: "Budget source introuvable" });
      const srcLines = await db.select().from(budgetLinesTable).where(eq(budgetLinesTable.budgetId, basedOnId));
      if (srcLines.length > 0) {
        await db.insert(budgetLinesTable).values(srcLines.map((l) => ({
          organizationId: budget.organizationId, budgetId: budget.id, accountId: l.accountId, period: l.period, amount: l.amount, notes: l.notes,
        })));
      }
    }
    return res.status(201).json(budget);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Erreur création" });
  }
});

router.put("/fpa/budgets/:id", requirePermission("fpa.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
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
  const [b] = await db.update(budgetsTable).set(upd).where(and(eq(budgetsTable.organizationId, req.authUser!.organizationId), eq(budgetsTable.id, (req.params.id as string)))).returning();
  if (!b) return res.status(404).json({ error: "Introuvable" });
  return res.json(b);
});

router.delete("/fpa/budgets/:id", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [b] = await db.select().from(budgetsTable).where(and(eq(budgetsTable.organizationId, orgId), eq(budgetsTable.id, (req.params.id as string)))).limit(1);
  if (!b) return res.status(404).json({ error: "Introuvable" });
  if (b.status === "active") return res.status(400).json({ error: "Archivez d'abord cette version active" });
  await db.delete(budgetsTable).where(and(eq(budgetsTable.organizationId, orgId), eq(budgetsTable.id, (req.params.id as string))));
  return res.status(204).send();
});

router.post("/fpa/budgets/:id/duplicate", requirePermission("fpa.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const userId = req.authUser!.id;
  const orgId = req.authUser!.organizationId;
  const src = await loadBudgetWithLines(orgId, (req.params.id as string));
  if (!src) return res.status(404).json({ error: "Source introuvable" });
  const { name, kind } = req.body || {};
  const newKind = kind || src.budget.kind;
  if (!VALID_KINDS.includes(newKind)) return res.status(400).json({ error: "kind invalide" });
  try {
    const b = await insertBudgetWithVersion(orgId, {
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
        organizationId: b.organizationId, budgetId: b.id, accountId: l.accountId, period: l.period, amount: l.amount, notes: l.notes,
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
router.post("/fpa/budgets/:id/activate", requirePermission("fpa.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const orgId = req.authUser!.organizationId;
  try {
    const updated = await db.transaction(async (tx) => {
      const [b] = await tx.select().from(budgetsTable).where(and(eq(budgetsTable.organizationId, orgId), eq(budgetsTable.id, (req.params.id as string)))).limit(1);
      if (!b) throw Object.assign(new Error("Introuvable"), { httpStatus: 404 });
      await tx.update(budgetsTable).set({ status: "archived" }).where(and(
        eq(budgetsTable.organizationId, orgId),
        eq(budgetsTable.fiscalPeriodId, b.fiscalPeriodId),
        eq(budgetsTable.scope, b.scope),
        eq(budgetsTable.kind, b.kind),
        eq(budgetsTable.status, "active"),
        b.scopeId ? eq(budgetsTable.scopeId, b.scopeId) : isNull(budgetsTable.scopeId),
      ));
      const [u] = await tx.update(budgetsTable).set({ status: "active" })
        .where(and(eq(budgetsTable.organizationId, orgId), eq(budgetsTable.id, (req.params.id as string)))).returning();
      return u;
    });
    return res.json(updated);
  } catch (e: any) {
    return res.status(e.httpStatus || 500).json({ error: e.message || "Erreur activation" });
  }
});

// ─── BUDGET LINES — bulk upsert ─────────────────────────────────────────────

router.put("/fpa/budgets/:id/lines", requirePermission("fpa.manage"), async (req, res) => {
  if (!isUuid((req.params.id as string))) return res.status(400).json({ error: "id invalide" });
  const orgId = req.authUser!.organizationId;
  const { lines } = req.body || {};
  if (!Array.isArray(lines)) return res.status(400).json({ error: "lines doit être un tableau" });
  const [b] = await db.select().from(budgetsTable).where(and(eq(budgetsTable.organizationId, orgId), eq(budgetsTable.id, (req.params.id as string)))).limit(1);
  if (!b) return res.status(404).json({ error: "Introuvable" });
  const fp = await loadFiscalPeriod(orgId, b.fiscalPeriodId);
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
      .from(chartOfAccountsTable).where(and(eq(chartOfAccountsTable.organizationId, orgId), inArray(chartOfAccountsTable.id, Array.from(distinctAccountIds))));
    if (present.length !== distinctAccountIds.size) {
      return res.status(400).json({ error: "Au moins un compte référencé n'existe pas" });
    }
  }

  // Stratégie : remplacement complet pour ce budget.
  await db.transaction(async (tx) => {
    await tx.delete(budgetLinesTable).where(eq(budgetLinesTable.budgetId, (req.params.id as string)));
    if (lines.length > 0) {
      await tx.insert(budgetLinesTable).values(lines.map((l: any) => ({
        organizationId: orgId,
        budgetId: (req.params.id as string),
        accountId: l.accountId,
        period: l.period,
        amount: String(l.amount),
        notes: l.notes ?? null,
      })));
    }
  });
  const fresh = await db.select().from(budgetLinesTable).where(eq(budgetLinesTable.budgetId, (req.params.id as string)));
  return res.json({ data: fresh.map((l) => ({ ...l, amount: toNum(l.amount) })) });
});

// ════════════════════════════════════════════════════════════════════════════
// VARIANCE — actual vs budget par compte × mois
// ════════════════════════════════════════════════════════════════════════════

async function buildVarianceReport(orgId: string, budgetId: string) {
  const data = await loadBudgetWithLines(orgId, budgetId);
  if (!data) return null;
  const fp = await loadFiscalPeriod(orgId, data.budget.fiscalPeriodId);
  if (!fp) return null;
  const months = listMonths(fp.startDate, fp.endDate);

  const accountIds = Array.from(new Set(data.lines.map((l) => l.accountId)));
  const accounts = accountIds.length > 0
    ? await db.select().from(chartOfAccountsTable).where(and(eq(chartOfAccountsTable.organizationId, orgId), inArray(chartOfAccountsTable.id, accountIds)))
    : [];
  const accById = new Map(accounts.map((a) => [a.id, a]));

  const projectIds = data.budget.scope === "company"
    ? undefined
    : data.budget.scope === "project" && data.budget.scopeId
      ? [data.budget.scopeId]
      : (data.budget.projectIds || []);

  const actuals = await computeActuals({
    organizationId: orgId,
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
  const report = await buildVarianceReport(req.authUser!.organizationId, budgetId);
  if (!report) return res.status(404).json({ error: "Budget ou période introuvable" });
  return res.json(report);
});

// ─── ACTUAL vs FORECAST ─────────────────────────────────────────────────────
// Compare un forecast (kind=forecast) au réalisé. Mêmes règles d'agrégation.

router.get("/fpa/actual-vs-forecast", async (req, res) => {
  const { forecastId } = req.query as Record<string, string>;
  if (!forecastId) return res.status(400).json({ error: "forecastId requis" });
  const report = await buildVarianceReport(req.authUser!.organizationId, forecastId);
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
  const v = await buildVarianceReport(req.authUser!.organizationId, budgetId);
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
  const orgId = req.authUser!.organizationId;
  const fp = await loadFiscalPeriod(orgId, fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période introuvable" });

  const budgets = await db.select().from(budgetsTable).where(and(
    eq(budgetsTable.organizationId, orgId),
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
      eq(journalEntriesTable.organizationId, orgId),
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
    ? await db.select().from(projectsTable).where(and(eq(projectsTable.organizationId, orgId), inArray(projectsTable.id, Array.from(allProjectIds))))
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
  const orgId = req.authUser!.organizationId;
  const fp = await loadFiscalPeriod(orgId, fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période introuvable" });

  const departments = await db.select().from(departmentsTable).where(eq(departmentsTable.organizationId, orgId));
  const budgets = await db.select().from(budgetsTable).where(and(
    eq(budgetsTable.organizationId, orgId),
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
          eq(journalEntriesTable.organizationId, orgId),
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
  const orgId = req.authUser!.organizationId;
  const fp = await loadFiscalPeriod(orgId, fiscalPeriodId);
  if (!fp) return res.status(404).json({ error: "Période introuvable" });

  // Budget entreprise actif
  const [companyBudget] = await db.select().from(budgetsTable).where(and(
    eq(budgetsTable.organizationId, orgId),
    eq(budgetsTable.fiscalPeriodId, fiscalPeriodId),
    eq(budgetsTable.scope, "company"),
    eq(budgetsTable.kind, "budget"),
    eq(budgetsTable.status, "active"),
  )).limit(1);

  let totalBudget = 0, totalActual = 0;
  let topVariances: Array<{ accountCode: string; accountLabel: string; variance: number; variancePct: number }> = [];
  let monthly: Array<{ period: string; budget: number; actual: number }> = [];
  if (companyBudget) {
    const v = await buildVarianceReport(orgId, companyBudget.id);
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
  }).from(budgetsTable).where(and(eq(budgetsTable.organizationId, orgId), eq(budgetsTable.fiscalPeriodId, fiscalPeriodId)))
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
// EXPORTS EXCEL — template unifié via ExcelReportBuilder
// ════════════════════════════════════════════════════════════════════════════

async function getOrgName(orgId: string): Promise<string> {
  const rows = await db.select({ name: organizationsTable.name })
    .from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  return rows[0]?.name ?? "Mon Organisation";
}

function fpPeriod(fp: { startDate: string; endDate: string }) {
  return {
    from: new Date(fp.startDate + "T00:00:00Z"),
    to:   new Date(fp.endDate   + "T00:00:00Z"),
  };
}

function accountCategory(code: string): string {
  if (code.startsWith("7")) return "Produits (classe 7)";
  if (code.startsWith("6")) return "Charges (classe 6)";
  if (code.startsWith("5")) return "Trésorerie (classe 5)";
  if (code.startsWith("4")) return "Tiers (classe 4)";
  if (code.startsWith("2")) return "Immobilisations (classe 2)";
  return "Autres";
}

// EXPORT — Budget détail (matrice account × mois)
router.get("/fpa/export/budget/:id.xlsx", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const data = await loadBudgetWithLines(orgId, (req.params.id as string));
    if (!data) return res.status(404).json({ error: "Introuvable" });
    const fp = await loadFiscalPeriod(orgId, data.budget.fiscalPeriodId);
    if (!fp) return res.status(404).json({ error: "Période introuvable" });

    const [orgName, months] = [await getOrgName(orgId), listMonths(fp.startDate, fp.endDate)];
    const accountIds = Array.from(new Set(data.lines.map((l) => l.accountId)));
    const accounts = accountIds.length > 0
      ? await db.select().from(chartOfAccountsTable)
          .where(and(eq(chartOfAccountsTable.organizationId, orgId), inArray(chartOfAccountsTable.id, accountIds)))
      : [];
    const accById = new Map(accounts.map((a) => [a.id, a]));
    const cellMap = new Map<string, number>();
    for (const l of data.lines) cellMap.set(`${l.accountId}::${l.period}`, toNum(l.amount));

    const grandTotal = accountIds.reduce((s, aid) =>
      s + months.reduce((ms, m) => ms + (cellMap.get(`${aid}::${m}`) || 0), 0), 0);

    const xls = new ExcelReportBuilder({
      orgName,
      period: fpPeriod(fp),
      reportTitle: `${data.budget.name} (v${data.budget.versionNumber})`,
    });

    xls.addCoverSheet("Pilotage Financier — FP&A");

    xls.addSummarySheet([
      ExcelReportBuilder.money("Total budgété (exercice)", grandTotal, null, "neutral", "Vue d'ensemble"),
      ExcelReportBuilder.num("Nombre de comptes", accountIds.length, null, "neutral", "Vue d'ensemble"),
      ExcelReportBuilder.num("Nombre de périodes", months.length, null, "neutral", "Vue d'ensemble"),
    ]);

    const monthLabels = months.map((m) => {
      const [y, mo] = m.split("-");
      return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("fr-FR", { month: "short", year: "2-digit" });
    });
    const cols = [
      { header: "Code",  key: "code",  width: 10, format: "text" as const },
      { header: "Compte", key: "label", width: 38, format: "text" as const },
      { header: "Classe", key: "cls",   width: 10, format: "text" as const },
      ...months.map((m, i) => ({ header: monthLabels[i]!, key: m, width: 14, format: "money" as const })),
      { header: "Total annuel", key: "total", width: 18, format: "money" as const },
    ];
    const rows = accountIds
      .sort((a, b) => (accById.get(a)?.code || "").localeCompare(accById.get(b)?.code || ""))
      .map((aid) => {
        const acc = accById.get(aid);
        const cells = months.map((m) => cellMap.get(`${aid}::${m}`) || 0);
        return [acc?.code || "", acc?.label || "", acc?.classNum?.toString() || "",
          ...cells, cells.reduce((s, v) => s + v, 0)] as (string | number | null)[];
      });

    xls.addDataSheet({
      name: "📊 Matrice Budget",
      title: `${data.budget.name} — Matrice Budget × Mois`,
      cols,
      rows,
      totalsRow: true,
    });

    xls.addNotesSheet([
      { title: "Nature du document", body: `Budget prévisionnel ${fp.name}.\nVersion ${data.budget.versionNumber} — Statut : ${data.budget.status}.\nPérimètre : ${data.budget.scope} / Type : ${data.budget.kind}.` },
      { title: "Plan comptable", body: "Les codes de comptes suivent le plan SYSCOHADA révisé.\nClasse 6 = Charges d'exploitation. Classe 7 = Produits d'exploitation." },
      { title: "Devise", body: "Tous les montants sont exprimés en FCFA (Franc CFA de l'Afrique de l'Ouest — XOF).\nTaux de change : 1 EUR ≈ 655,957 FCFA (fixe)." },
    ]);

    await xls.send(res, `budget-${data.budget.name.replace(/[^a-z0-9]/gi, "_")}-v${data.budget.versionNumber}.xlsx`);
  } catch (e) { next(e); }
});

// EXPORT — Rapport de variance (actual vs budget)
router.get("/fpa/export/variance/:budgetId.xlsx", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const v = await buildVarianceReport(orgId, (req.params.budgetId as string));
    if (!v) return res.status(404).json({ error: "Introuvable" });

    const orgName = await getOrgName(orgId);
    const executionPct = v.totals.budget !== 0 ? (v.totals.actual / v.totals.budget) * 100 : 0;

    const xls = new ExcelReportBuilder({
      orgName,
      period: fpPeriod(v.fiscalPeriod),
      reportTitle: `Analyse de Variance — ${v.budget.name}`,
    });

    xls.addCoverSheet("FP&A — Budget vs Réalisé");

    xls.addSummarySheet([
      ExcelReportBuilder.money("Budget total (exercice)", v.totals.budget, null, "neutral", "Vue d'ensemble"),
      ExcelReportBuilder.money("Réalisé total (exercice)", v.totals.actual, null, "up-good", "Vue d'ensemble"),
      ExcelReportBuilder.money("Écart absolu (Réalisé − Budget)", v.totals.variance, null, "up-good", "Vue d'ensemble"),
      ExcelReportBuilder.pct("Taux d'exécution budgétaire", executionPct, null, "up-good", "Vue d'ensemble"),
    ]);

    xls.addDataSheet({
      name: "📅 Évolution mensuelle",
      title: "Budget vs Réalisé — Évolution mensuelle",
      cols: [
        { header: "Période",         key: "period",   width: 14, format: "text"    as const },
        { header: "Budget (FCFA)",   key: "budget",   width: 22, format: "money"   as const },
        { header: "Réalisé (FCFA)",  key: "actual",   width: 22, format: "money"   as const },
        { header: "Écart (FCFA)",    key: "variance", width: 22, format: "money"   as const },
        { header: "Écart %",         key: "pct",      width: 14, format: "percent" as const },
      ],
      rows: v.monthlyTotals.map((m) => {
        const pct = m.budget !== 0 ? (m.variance / Math.abs(m.budget)) * 100 : 0;
        return [m.period, m.budget, m.actual, m.variance, pct];
      }),
      totalsRow: false,
    });

    xls.addVarianceSheet({
      name: "📊 Variance par compte",
      title: "Analyse de variance par compte SYSCOHADA",
      items: v.rows.map((r) => ({
        label:    `${r.accountCode} — ${r.accountLabel}`,
        budget:   r.totalBudget,
        actual:   r.totalActual,
        category: accountCategory(r.accountCode),
      })),
    });

    xls.addNotesSheet([
      { title: "Définition de la variance", body: "Écart = Réalisé − Budget.\nUn écart positif sur les produits est favorable (plus de recettes que prévu).\nUn écart négatif sur les charges est favorable (moins de dépenses que prévu).\nL'interprétation dépend toujours de la nature du compte (classe 6 ou 7)." },
      { title: "Périmètre", body: `Budget : ${v.budget.name} — ${v.fiscalPeriod.name}.\nDonnées réalisées issues des écritures comptables au statut « Validé » (posted).` },
      { title: "Devise", body: "Tous les montants sont exprimés en FCFA (Franc CFA de l'Afrique de l'Ouest — XOF)." },
    ]);

    await xls.send(res, `variance-${v.budget.name.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
  } catch (e) { next(e); }
});

// EXPORT — Forecast vs réalisé
router.get("/fpa/export/forecast/:forecastId.xlsx", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const v = await buildVarianceReport(orgId, (req.params.forecastId as string));
    if (!v) return res.status(404).json({ error: "Introuvable" });

    const orgName = await getOrgName(orgId);
    const realisationPct = v.totals.budget !== 0 ? (v.totals.actual / v.totals.budget) * 100 : 0;

    const xls = new ExcelReportBuilder({
      orgName,
      period: fpPeriod(v.fiscalPeriod),
      reportTitle: `Prévisionnel vs Réalisé — ${v.budget.name}`,
    });

    xls.addCoverSheet("FP&A — Forecast vs Réalisé");

    xls.addSummarySheet([
      ExcelReportBuilder.money("Forecast total", v.totals.budget, null, "neutral", "Vue d'ensemble"),
      ExcelReportBuilder.money("Réalisé total", v.totals.actual, null, "up-good", "Vue d'ensemble"),
      ExcelReportBuilder.money("Écart Forecast vs Réalisé", v.totals.variance, null, "up-good", "Vue d'ensemble"),
      ExcelReportBuilder.pct("Taux de réalisation du forecast", realisationPct, null, "up-good", "Vue d'ensemble"),
    ]);

    xls.addVarianceSheet({
      name: "📈 Forecast vs Réalisé",
      title: "Forecast vs Réalisé par compte SYSCOHADA",
      items: v.rows.map((r) => ({
        label:    `${r.accountCode} — ${r.accountLabel}`,
        budget:   r.totalBudget,
        actual:   r.totalActual,
        category: accountCategory(r.accountCode),
      })),
    });

    xls.addNotesSheet([
      { title: "Lecture du document", body: "Colonne « Budget » = valeur forecast révisée approuvée.\nColonne « Réalisé » = données comptables postées au moment de l'export.\nÉcart = Réalisé − Forecast." },
      { title: "Périmètre", body: `Forecast : ${v.budget.name} — ${v.fiscalPeriod.name}.\nDonnées réalisées issues des écritures comptables au statut « Validé » (posted).` },
      { title: "Devise", body: "Tous les montants sont exprimés en FCFA (Franc CFA de l'Afrique de l'Ouest — XOF)." },
    ]);

    await xls.send(res, `forecast-${v.budget.name.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
  } catch (e) { next(e); }
});

// EXPORT — Synthèse par projet
router.get("/fpa/export/by-project/:fiscalPeriodId.xlsx", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const fp = await loadFiscalPeriod(orgId, (req.params.fiscalPeriodId as string));
    if (!fp) return res.status(404).json({ error: "Période introuvable" });

    const orgName = await getOrgName(orgId);

    const projectsAll = await db.select().from(projectsTable).where(eq(projectsTable.organizationId, orgId));
    const [expRows, revRows] = await Promise.all([
      db.select({
        projectId: journalEntryLinesTable.projectId,
        debit:  sql<string>`sum(${journalEntryLinesTable.debit})`,
        credit: sql<string>`sum(${journalEntryLinesTable.credit})`,
      }).from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
        .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
        .where(and(
          eq(journalEntriesTable.organizationId, orgId),
          eq(journalEntriesTable.status, "posted"),
          gte(journalEntriesTable.entryDate, fp.startDate),
          lte(journalEntriesTable.entryDate, fp.endDate),
          sql`${journalEntryLinesTable.projectId} IS NOT NULL`,
          eq(chartOfAccountsTable.classNum, 6),
        )).groupBy(journalEntryLinesTable.projectId),
      db.select({
        projectId: journalEntryLinesTable.projectId,
        debit:  sql<string>`sum(${journalEntryLinesTable.debit})`,
        credit: sql<string>`sum(${journalEntryLinesTable.credit})`,
      }).from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
        .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
        .where(and(
          eq(journalEntriesTable.organizationId, orgId),
          eq(journalEntriesTable.status, "posted"),
          gte(journalEntriesTable.entryDate, fp.startDate),
          lte(journalEntriesTable.entryDate, fp.endDate),
          sql`${journalEntryLinesTable.projectId} IS NOT NULL`,
          eq(chartOfAccountsTable.classNum, 7),
        )).groupBy(journalEntryLinesTable.projectId),
    ]);

    const expMap = new Map(expRows.map((r) => [r.projectId!, toNum(r.debit) - toNum(r.credit)]));
    const revMap = new Map(revRows.map((r) => [r.projectId!, toNum(r.credit) - toNum(r.debit)]));

    const budgets = await db.select().from(budgetsTable).where(and(
      eq(budgetsTable.organizationId, orgId),
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
      }).from(budgetLinesTable)
        .where(inArray(budgetLinesTable.budgetId, budgets.map((b) => b.id)))
        .groupBy(budgetLinesTable.budgetId);
      for (const s of sums) {
        const b = budgets.find((bb) => bb.id === s.budgetId);
        if (b?.scopeId) budgetTotalsMap.set(b.scopeId, toNum(s.total));
      }
    }

    const STATUS_FR: Record<string, string> = {
      active: "En cours", completed: "Terminé", on_hold: "En pause",
      cancelled: "Annulé", planning: "Planification",
    };

    let tBudget = 0, tRev = 0, tExp = 0;
    const dataRows: (string | number | null)[][] = [];
    for (const p of projectsAll) {
      const b = budgetTotalsMap.get(p.id) || 0;
      const r = revMap.get(p.id) || 0;
      const e = expMap.get(p.id) || 0;
      if (b === 0 && r === 0 && e === 0) continue;
      tBudget += b; tRev += r; tExp += e;
      dataRows.push([p.name, STATUS_FR[p.status] || p.status, b, r, e, r - e, b !== 0 ? (e / b) * 100 : 0]);
    }

    const xls = new ExcelReportBuilder({
      orgName,
      period: fpPeriod(fp),
      reportTitle: `Synthèse par Projet — ${fp.name}`,
    });

    xls.addCoverSheet("FP&A — Synthèse Projets");

    xls.addSummarySheet([
      ExcelReportBuilder.money("Budget total (projets)", tBudget, null, "neutral", "Vue d'ensemble"),
      ExcelReportBuilder.money("Produits réalisés", tRev, null, "up-good", "Vue d'ensemble"),
      ExcelReportBuilder.money("Charges réalisées", tExp, null, "down-good", "Vue d'ensemble"),
      ExcelReportBuilder.money("Marge brute", tRev - tExp, null, "up-good", "Vue d'ensemble"),
      ExcelReportBuilder.num("Nombre de projets actifs", dataRows.length, null, "neutral", "Vue d'ensemble"),
    ]);

    xls.addDataSheet({
      name: "📁 Synthèse par projet",
      title: `Synthèse financière par projet — ${fp.name}`,
      cols: [
        { header: "Projet",           key: "name",   width: 34, format: "text"    as const },
        { header: "Statut",           key: "status", width: 16, format: "text"    as const },
        { header: "Budget annuel",    key: "budget", width: 22, format: "money"   as const },
        { header: "Produits",         key: "rev",    width: 22, format: "money"   as const },
        { header: "Charges",          key: "exp",    width: 22, format: "money"   as const },
        { header: "Marge",            key: "margin", width: 22, format: "money"   as const },
        { header: "Conso. budget %",  key: "conso",  width: 16, format: "percent" as const },
      ],
      rows: dataRows,
      totalsRow: true,
    });

    xls.addNotesSheet([
      { title: "Définitions", body: "Produits = somme des écritures créditant les comptes classe 7 (produits d'exploitation).\nCharges = somme des écritures débitant les comptes classe 6 (charges d'exploitation).\nMarge = Produits − Charges.\nConso. budget = Charges / Budget × 100." },
      { title: "Périmètre", body: `Période fiscale : ${fp.name} (${fp.startDate} → ${fp.endDate}).\nSeuls les projets ayant au moins un mouvement ou un budget sont inclus.\nDonnées comptables issues des écritures au statut « Validé » (posted).` },
      { title: "Devise", body: "Tous les montants sont exprimés en FCFA (Franc CFA de l'Afrique de l'Ouest — XOF)." },
    ]);

    await xls.send(res, `synthese-projets-${fp.name.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// CASH FLOW / GESTION DE TRÉSORERIE
// Sources : comptes classe 5 (mouvements réels) + factures clients (AR)
//           + factures fournisseurs (AP) + soldes bancaires
// ════════════════════════════════════════════════════════════════════════════
router.get("/fpa/cashflow", async (req, res) => {
  const { fiscalPeriodId } = req.query as Record<string, string>;
  if (!fiscalPeriodId) { res.status(400).json({ error: "fiscalPeriodId requis" }); return; }
  const orgId = req.authUser!.organizationId;
  const fp = await loadFiscalPeriod(orgId, fiscalPeriodId);
  if (!fp) { res.status(404).json({ error: "Période introuvable" }); return; }

  // ── 1. Comptes de trésorerie (classe 5) ──────────────────────────────────
  const class5 = await db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code, label: chartOfAccountsTable.label })
    .from(chartOfAccountsTable)
    .where(and(eq(chartOfAccountsTable.organizationId, orgId), eq(chartOfAccountsTable.classNum, 5), eq(chartOfAccountsTable.isActive, true)));
  const class5Ids = class5.map((a) => a.id);

  // ── 2. Solde d'ouverture (cumul des soldes initiaux des comptes bancaires) ──
  const bankAccs = await db.select({ openingBalance: bankAccountsTable.openingBalance })
    .from(bankAccountsTable)
    .where(and(eq(bankAccountsTable.organizationId, orgId), eq(bankAccountsTable.isActive, true)));
  const openingBalance = bankAccs.reduce((s, b) => s + toNum(b.openingBalance), 0);

  // ── 3. Solde actuel : ouverture + tous mouvements postés sur classe 5 ──────
  let currentBalance = openingBalance;
  if (class5Ids.length > 0) {
    const totals = (await db.select({
      d: sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      c: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    }).from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .where(and(
        eq(journalEntriesTable.organizationId, orgId),
        eq(journalEntriesTable.status, "posted"),
        inArray(journalEntryLinesTable.accountId, class5Ids),
      )))[0];
    currentBalance = openingBalance + toNum(totals.d) - toNum(totals.c);
  }

  // ── 4. Flux mensuels sur la période fiscale ──────────────────────────────
  const months = listMonths(fp.startDate, fp.endDate);
  const monthMap = new Map<string, { inflows: number; outflows: number }>();
  if (class5Ids.length > 0) {
    const rows = await db.select({
      period: sql<string>`substring(${journalEntriesTable.entryDate}, 1, 7)`,
      inflows:  sql<string>`COALESCE(SUM(${journalEntryLinesTable.debit}), 0)`,
      outflows: sql<string>`COALESCE(SUM(${journalEntryLinesTable.credit}), 0)`,
    }).from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .where(and(
        eq(journalEntriesTable.organizationId, orgId),
        eq(journalEntriesTable.status, "posted"),
        gte(journalEntriesTable.entryDate, fp.startDate),
        lte(journalEntriesTable.entryDate, fp.endDate),
        inArray(journalEntryLinesTable.accountId, class5Ids),
      ))
      .groupBy(sql`substring(${journalEntriesTable.entryDate}, 1, 7)`)
      .orderBy(asc(sql`substring(${journalEntriesTable.entryDate}, 1, 7)`));
    for (const r of rows) monthMap.set(r.period, { inflows: toNum(r.inflows), outflows: toNum(r.outflows) });
  }

  // Construire la courbe mensuelle avec solde cumulatif
  let cumulBalance = openingBalance;
  const today = new Date().toISOString().slice(0, 7);
  const monthly = months.map((period) => {
    const d = monthMap.get(period) ?? { inflows: 0, outflows: 0 };
    const net = d.inflows - d.outflows;
    cumulBalance += net;
    return { period, inflows: Math.round(d.inflows), outflows: Math.round(d.outflows), net: Math.round(net), balance: Math.round(cumulBalance) };
  });

  // ── 5. Burn rate : moyenne des 3 derniers mois avec activité ─────────────
  const pastActive = monthly.filter((m) => m.period < today && (m.inflows > 0 || m.outflows > 0));
  const last3 = pastActive.slice(-3);
  const burnRate = last3.length > 0 ? last3.reduce((s, m) => s + m.net, 0) / last3.length : 0;
  const avgMonthlyInflows  = pastActive.length > 0 ? pastActive.reduce((s, m) => s + m.inflows, 0) / pastActive.length : 0;
  const avgMonthlyOutflows = pastActive.length > 0 ? pastActive.reduce((s, m) => s + m.outflows, 0) / pastActive.length : 0;

  // Runway et Zero Cash Date
  const runwayMonths  = burnRate < 0 && currentBalance > 0 ? currentBalance / Math.abs(burnRate) : null;
  let zeroCashDate: string | null = null;
  if (runwayMonths !== null) {
    const zd = new Date();
    zd.setMonth(zd.getMonth() + Math.floor(runwayMonths));
    zeroCashDate = zd.toISOString().slice(0, 7);
  }

  // ── 6. Créances clients (AR) — factures non entièrement payées ────────────
  const arRows = await db.select({
    id: invoicesTable.id,
    referenceNumber: invoicesTable.referenceNumber,
    totalAmount: invoicesTable.totalAmount,
    paidAmount: invoicesTable.paidAmount,
    dueDate: invoicesTable.dueDate,
    issuedAt: invoicesTable.issuedAt,
    clientName: clientsTable.name,
  }).from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(and(
      eq(invoicesTable.organizationId, orgId),
      sql`COALESCE(${invoicesTable.totalAmount}::numeric, 0) - COALESCE(${invoicesTable.paidAmount}::numeric, 0) > 0`,
    ))
    .orderBy(asc(invoicesTable.dueDate))
    .limit(30);

  const todayStr = new Date().toISOString().slice(0, 10);
  const ar = arRows.map((i) => ({
    id: i.id,
    reference: i.referenceNumber,
    clientName: i.clientName ?? "—",
    amount: Math.round(toNum(i.totalAmount) - toNum(i.paidAmount)),
    dueDate: i.dueDate,
    overdue: !!(i.dueDate && i.dueDate < todayStr),
  }));
  const totalAR = ar.reduce((s, i) => s + i.amount, 0);

  // ── 7. Dettes fournisseurs (AP) — factures non entièrement payées ─────────
  const apRows = await db.select({
    id: supplierInvoicesTable.id,
    referenceNumber: supplierInvoicesTable.referenceNumber,
    totalAmount: supplierInvoicesTable.totalAmount,
    paidAmount: supplierInvoicesTable.paidAmount,
    dueDate: supplierInvoicesTable.dueDate,
    supplierName: suppliersTable.name,
  }).from(supplierInvoicesTable)
    .leftJoin(suppliersTable, eq(supplierInvoicesTable.supplierId, suppliersTable.id))
    .where(and(
      eq(supplierInvoicesTable.organizationId, orgId),
      sql`COALESCE(${supplierInvoicesTable.totalAmount}::numeric, 0) - COALESCE(${supplierInvoicesTable.paidAmount}::numeric, 0) > 0`,
    ))
    .orderBy(asc(supplierInvoicesTable.dueDate))
    .limit(30);

  const ap = apRows.map((i) => ({
    id: i.id,
    reference: i.referenceNumber,
    supplierName: i.supplierName ?? "—",
    amount: Math.round(toNum(i.totalAmount) - toNum(i.paidAmount)),
    dueDate: i.dueDate,
    overdue: !!(i.dueDate && i.dueDate < todayStr),
  }));
  const totalAP = ap.reduce((s, i) => s + i.amount, 0);

  // ── 8. Projection 12 mois depuis aujourd'hui ─────────────────────────────
  const arByMonth = new Map<string, number>();
  const apByMonth = new Map<string, number>();
  for (const inv of ar) { const m = inv.dueDate?.slice(0, 7); if (m) arByMonth.set(m, (arByMonth.get(m) || 0) + inv.amount); }
  for (const inv of ap) { const m = inv.dueDate?.slice(0, 7); if (m) apByMonth.set(m, (apByMonth.get(m) || 0) + inv.amount); }

  const projMonths: string[] = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(); d.setMonth(d.getMonth() + i);
    projMonths.push(d.toISOString().slice(0, 7));
  }
  let pBase = currentBalance, pOpt = currentBalance, pPes = currentBalance;
  const projection = projMonths.map((period) => {
    const arIn  = arByMonth.get(period) || 0;
    const apOut = apByMonth.get(period) || 0;
    const baseNet = burnRate + arIn - apOut;
    pBase = Math.max(0, pBase + baseNet);
    pOpt  = Math.max(0, pOpt  + baseNet * 1.2);
    pPes  = Math.max(0, pPes  + baseNet * 0.8);
    return { period, base: Math.round(pBase), optimiste: Math.round(pOpt), pessimiste: Math.round(pPes), arIn, apOut };
  });

  // ── 9. Alertes ────────────────────────────────────────────────────────────
  type Alert = { type: string; severity: "critical" | "warning" | "info"; title: string; detail: string; period?: string };
  const alerts: Alert[] = [];

  if (runwayMonths !== null) {
    const m = Math.floor(runwayMonths);
    if (m <= 1)      alerts.push({ type: "zero_cash", severity: "critical", title: "Rupture de trésorerie imminente", detail: `Zero cash date estimée dans ${m} mois (${zeroCashDate}) au rythme actuel.`, period: zeroCashDate! });
    else if (m <= 3) alerts.push({ type: "zero_cash", severity: "critical", title: "Trésorerie critique", detail: `Solde estimé à zéro dans ${m} mois (${zeroCashDate}). Action urgente requise.`, period: zeroCashDate! });
    else if (m <= 6) alerts.push({ type: "zero_cash", severity: "warning", title: "Trésorerie sous surveillance", detail: `Zero cash date estimée à ${zeroCashDate} (${m} mois). Surveiller les encaissements.`, period: zeroCashDate! });
    else if (m <= 12) alerts.push({ type: "zero_cash", severity: "info", title: "Vigilance trésorerie", detail: `Zero cash date projetée à ${zeroCashDate} (${m} mois).`, period: zeroCashDate! });
  }
  const overdueAR = ar.filter((i) => i.overdue);
  if (overdueAR.length > 0) alerts.push({ type: "ar_overdue", severity: "warning", title: `${overdueAR.length} facture(s) client en retard`, detail: `Total à recouvrer : ${overdueAR.reduce((s, i) => s + i.amount, 0).toLocaleString("fr-FR")} FCFA` });
  const overdueAP = ap.filter((i) => i.overdue);
  if (overdueAP.length > 0) alerts.push({ type: "ap_overdue", severity: "warning", title: `${overdueAP.length} facture(s) fournisseur en retard`, detail: `Total dû : ${overdueAP.reduce((s, i) => s + i.amount, 0).toLocaleString("fr-FR")} FCFA` });
  const lowProjPeriods = projection.filter((p) => p.base > 0 && p.base < currentBalance * 0.15);
  if (lowProjPeriods.length > 0) alerts.push({ type: "low_balance", severity: "info", title: "Solde projeté bas", detail: `Le solde projeté descend sous 15 % du solde actuel à partir de ${lowProjPeriods[0].period}.`, period: lowProjPeriods[0].period });

  res.json({
    fiscalPeriod: fp,
    kpis: {
      currentBalance: Math.round(currentBalance),
      openingBalance: Math.round(openingBalance),
      burnRate: Math.round(burnRate),
      runwayMonths: runwayMonths !== null ? Math.round(runwayMonths * 10) / 10 : null,
      zeroCashDate,
      totalAR,
      totalAP,
      netPosition: Math.round(currentBalance + totalAR - totalAP),
      avgMonthlyInflows: Math.round(avgMonthlyInflows),
      avgMonthlyOutflows: Math.round(avgMonthlyOutflows),
    },
    monthly,
    projection,
    ar,
    ap,
    alerts,
    class5Accounts: class5.map((a) => ({ code: a.code, label: a.label })),
  });
});

export default router;
