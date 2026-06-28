/**
 * Clôture des périodes financières — Gameasu
 * Month-end close, year-end close, checklists, audit trail.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  periodMonthsTable, closingChecklistItemsTable, closingAuditLogTable,
  fiscalPeriodsTable, journalEntriesTable, invoicesTable, paymentsTable,
  supplierInvoicesTable, payslipsTable,
  expenseReportsTable, DEFAULT_CHECKLIST_ITEMS,
} from "@workspace/db/schema";
import { eq, and, desc, asc, sql, gte, lte, inArray, count } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove, requireAdmin } from "../middlewares/auth.js";

const router = Router();
const toNum = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logAudit(
  orgId: string,
  action: string,
  userId: string | undefined,
  userName: string | undefined,
  periodMonthId: string | null,
  fiscalPeriodId: string | null,
  month: string | null,
  reason?: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(closingAuditLogTable).values({
    organizationId: orgId,
    action,
    userId,
    userName,
    periodMonthId,
    fiscalPeriodId,
    month,
    reason,
    metadata: metadata ?? {},
  });
}

async function getOrCreatePeriodMonth(orgId: string, month: string) {
  const [existing] = await db.select().from(periodMonthsTable)
    .where(and(eq(periodMonthsTable.organizationId, orgId), eq(periodMonthsTable.month, month)));
  if (existing) return existing;

  // Find matching fiscal period
  const year = month.slice(0, 4);
  const [fp] = await db.select({ id: fiscalPeriodsTable.id })
    .from(fiscalPeriodsTable)
    .where(and(
      eq(fiscalPeriodsTable.organizationId, orgId),
      gte(fiscalPeriodsTable.startDate, `${year}-01-01`),
      lte(fiscalPeriodsTable.endDate, `${year}-12-31`),
    )).limit(1);

  if (!fp) throw new Error(`Aucun exercice fiscal trouvé pour l'année ${year}`);

  const [created] = await db.insert(periodMonthsTable).values({
    organizationId: orgId,
    fiscalPeriodId: fp.id,
    month,
    status: "open",
  }).returning();
  return created;
}

async function createDefaultChecklist(orgId: string, periodMonthId: string) {
  const existing = await db.select({ id: closingChecklistItemsTable.id })
    .from(closingChecklistItemsTable).where(eq(closingChecklistItemsTable.periodMonthId, periodMonthId));
  if (existing.length > 0) return;

  await db.insert(closingChecklistItemsTable).values(
    DEFAULT_CHECKLIST_ITEMS.map(item => ({
      organizationId: orgId,
      periodMonthId,
      itemKey: item.key,
      label: item.label,
      description: item.description,
      sortOrder: item.sortOrder,
      status: "pending" as const,
    }))
  );
}

// Calcule les stats comptables d'un mois
async function computeMonthStats(orgId: string, month: string) {
  const from = `${month}-01`;
  const to = `${month}-31`;

  const [inv] = await db.select({ total: count(), pending: sql<string>`COALESCE(SUM(CASE WHEN status NOT IN ('paid','cancelled') THEN 1 ELSE 0 END), 0)` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.organizationId, orgId), gte(invoicesTable.issuedAt, from), lte(invoicesTable.issuedAt, to)));

  const [pmt] = await db.select({ total: count() })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.organizationId, orgId), gte(paymentsTable.paidAt, new Date(`${from}T00:00:00Z`)), lte(paymentsTable.paidAt, new Date(`${to}T23:59:59Z`))));

  const [si] = await db.select({ total: count() })
    .from(supplierInvoicesTable)
    .where(and(eq(supplierInvoicesTable.organizationId, orgId), gte(supplierInvoicesTable.invoiceDate, from), lte(supplierInvoicesTable.invoiceDate, to)));

  const [je] = await db.select({ total: count(), posted: sql<string>`COALESCE(SUM(CASE WHEN status='posted' THEN 1 ELSE 0 END), 0)` })
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.organizationId, orgId), gte(journalEntriesTable.entryDate, from), lte(journalEntriesTable.entryDate, to)));

  const [ps] = await db.select({ total: count() })
    .from(payslipsTable)
    .where(and(eq(payslipsTable.organizationId, orgId), eq(payslipsTable.period, month)));

  const [exp] = await db.select({ total: count(), pending: sql<string>`COALESCE(SUM(CASE WHEN status NOT IN ('approved','rejected') THEN 1 ELSE 0 END), 0)` })
    .from(expenseReportsTable)
    .where(and(eq(expenseReportsTable.organizationId, orgId), gte(expenseReportsTable.submittedAt, new Date(`${from}T00:00:00Z`)), lte(expenseReportsTable.submittedAt, new Date(`${to}T23:59:59Z`))));

  return {
    invoices: { total: inv?.total ?? 0, pending: toNum(inv?.pending) },
    payments: { total: pmt?.total ?? 0 },
    supplierInvoices: { total: si?.total ?? 0 },
    journalEntries: { total: je?.total ?? 0, posted: toNum(je?.posted) },
    payslips: { total: ps?.total ?? 0 },
    expenses: { total: exp?.total ?? 0, pending: toNum(exp?.pending) },
  };
}

// ── GET /period-close/months — liste des mois pour un exercice ────────────────

router.get("/period-close/months", requireAuth, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { year } = req.query as { year?: string };

    // Auto-init fiscal periods if missing
    const fyYear = year ?? String(new Date().getFullYear());
    const [fp] = await db.select().from(fiscalPeriodsTable)
      .where(and(
        eq(fiscalPeriodsTable.organizationId, orgId),
        gte(fiscalPeriodsTable.startDate, `${fyYear}-01-01`),
        lte(fiscalPeriodsTable.endDate, `${fyYear}-12-31`),
      )).limit(1);

    const months = await db.select().from(periodMonthsTable)
      .where(and(eq(periodMonthsTable.organizationId, orgId)))
      .orderBy(desc(periodMonthsTable.month));

    // Build 12-month view for the selected year
    const monthMap = new Map(months.map(m => [m.month, m]));
    const monthList = Array.from({ length: 12 }, (_, i) => {
      const m = `${fyYear}-${String(i + 1).padStart(2, "0")}`;
      return monthMap.get(m) ?? { month: m, status: "open", id: null, organizationId: orgId, fiscalPeriodId: fp?.id ?? null };
    });

    res.json({
      fiscalPeriod: fp ?? null,
      months: monthList,
      summary: {
        closed: monthList.filter(m => ["closed", "locked"].includes(m.status)).length,
        total: 12,
      },
    });
  } catch (e) { next(e); }
});

// ── GET /period-close/months/:month — détail + stats + checklist ──────────────

router.get("/period-close/months/:month", requireAuth, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const month = req.params.month as string;
    if (!/^\d{4}-\d{2}$/.test(month)) { res.status(400).json({ error: "Format month invalide (YYYY-MM)" }); return; }

    const pm = await getOrCreatePeriodMonth(orgId, month);
    const checklist = await db.select().from(closingChecklistItemsTable)
      .where(eq(closingChecklistItemsTable.periodMonthId, pm.id))
      .orderBy(asc(closingChecklistItemsTable.sortOrder));

    const stats = await computeMonthStats(orgId, month);
    const checklistProgress = checklist.length > 0
      ? Math.round((checklist.filter(i => i.status === "done" || i.status === "na").length / checklist.length) * 100)
      : 0;

    res.json({ period: pm, checklist, stats, checklistProgress });
  } catch (e) { next(e); }
});

// ── POST /period-close/months/:month/start-review — passe en mode revue ──────

router.post("/period-close/months/:month/start-review", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const month = req.params.month as string;

    const pm = await getOrCreatePeriodMonth(orgId, month);
    if (pm.status !== "open") { res.status(400).json({ error: "Le mois n'est pas en statut 'ouvert'" }); return; }

    const [updated] = await db.update(periodMonthsTable).set({ status: "review", updatedAt: new Date() })
      .where(eq(periodMonthsTable.id, pm.id)).returning();

    // Crée la checklist par défaut si elle n'existe pas
    await createDefaultChecklist(orgId, pm.id);

    await logAudit(orgId, "month_opened", req.authUser!.id, `${req.authUser!.firstName} ${req.authUser!.lastName}`, pm.id, pm.fiscalPeriodId, month);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── POST /period-close/months/:month/close — clôture mensuelle ───────────────

router.post("/period-close/months/:month/close", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const month = req.params.month as string;
    const { notes } = req.body as { notes?: string };

    const pm = await getOrCreatePeriodMonth(orgId, month);
    if (pm.status === "closed" || pm.status === "locked") {
      res.status(400).json({ error: "Ce mois est déjà clôturé" }); return;
    }

    const [updated] = await db.update(periodMonthsTable).set({
      status: "closed",
      closedAt: new Date(),
      closedById: req.authUser!.id,
      closedByName: `${req.authUser!.firstName} ${req.authUser!.lastName}`,
      notes,
      updatedAt: new Date(),
    }).where(eq(periodMonthsTable.id, pm.id)).returning();

    await createDefaultChecklist(orgId, pm.id);

    // Auto-compléter l'item "period_approved"
    await db.update(closingChecklistItemsTable).set({
      status: "done", completedAt: new Date(), completedByName: `${req.authUser!.firstName} ${req.authUser!.lastName}`, updatedAt: new Date(),
    }).where(and(
      eq(closingChecklistItemsTable.periodMonthId, pm.id),
      eq(closingChecklistItemsTable.itemKey, "period_approved"),
    ));

    await logAudit(orgId, "month_closed", req.authUser!.id, `${req.authUser!.firstName} ${req.authUser!.lastName}`, pm.id, pm.fiscalPeriodId, month, notes);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── POST /period-close/months/:month/approve — approbation direction ──────────

router.post("/period-close/months/:month/approve", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const month = req.params.month as string;

    const [pm] = await db.select().from(periodMonthsTable)
      .where(and(eq(periodMonthsTable.organizationId, orgId), eq(periodMonthsTable.month, month)));
    if (!pm) { res.status(404).json({ error: "Mois introuvable" }); return; }
    if (pm.status !== "closed") { res.status(400).json({ error: "Le mois doit être clôturé avant l'approbation" }); return; }

    const [updated] = await db.update(periodMonthsTable).set({
      status: "locked",
      approvedAt: new Date(),
      approvedById: req.authUser!.id,
      approvedByName: `${req.authUser!.firstName} ${req.authUser!.lastName}`,
      updatedAt: new Date(),
    }).where(eq(periodMonthsTable.id, pm.id)).returning();

    await logAudit(orgId, "month_approved", req.authUser!.id, `${req.authUser!.firstName} ${req.authUser!.lastName}`, pm.id, pm.fiscalPeriodId, month);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── POST /period-close/months/:month/reopen — réouverture contrôlée ──────────

router.post("/period-close/months/:month/reopen", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const month = req.params.month as string;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) { res.status(400).json({ error: "Un motif de réouverture est obligatoire" }); return; }

    const [pm] = await db.select().from(periodMonthsTable)
      .where(and(eq(periodMonthsTable.organizationId, orgId), eq(periodMonthsTable.month, month)));
    if (!pm) { res.status(404).json({ error: "Mois introuvable" }); return; }
    if (pm.status === "open") { res.status(400).json({ error: "Le mois est déjà ouvert" }); return; }

    const [updated] = await db.update(periodMonthsTable).set({
      status: "review",
      reopenedAt: new Date(),
      reopenedById: req.authUser!.id,
      reopenedByName: `${req.authUser!.firstName} ${req.authUser!.lastName}`,
      reopenReason: reason,
      closedAt: null as unknown as Date,
      closedById: null as unknown as string,
      closedByName: null,
      updatedAt: new Date(),
    }).where(eq(periodMonthsTable.id, pm.id)).returning();

    await logAudit(orgId, "month_reopened", req.authUser!.id, `${req.authUser!.firstName} ${req.authUser!.lastName}`, pm.id, pm.fiscalPeriodId, month, reason);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── PATCH /period-close/checklist/:id — mise à jour d'un item ────────────────

router.patch("/period-close/checklist/:id", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status, comments, assignedToName, dueDate } = req.body as Record<string, string>;

    const [item] = await db.select().from(closingChecklistItemsTable)
      .where(and(eq(closingChecklistItemsTable.id, req.params.id as string), eq(closingChecklistItemsTable.organizationId, orgId)));
    if (!item) { res.status(404).json({ error: "Item introuvable" }); return; }

    const updates: Partial<typeof closingChecklistItemsTable.$inferInsert> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (comments !== undefined) updates.comments = comments;
    if (assignedToName !== undefined) updates.assignedToName = assignedToName;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (status === "done") {
      updates.completedAt = new Date();
      updates.completedByName = `${req.authUser!.firstName} ${req.authUser!.lastName}`;
    } else if (status === "pending" || status === "in_progress") {
      updates.completedAt = null as unknown as Date;
      updates.completedByName = null;
    }

    const [updated] = await db.update(closingChecklistItemsTable).set(updates)
      .where(eq(closingChecklistItemsTable.id, req.params.id as string)).returning();

    await logAudit(orgId, "checklist_updated", req.authUser!.id, `${req.authUser!.firstName} ${req.authUser!.lastName}`, item.periodMonthId, null, null,
      undefined, { itemKey: item.itemKey, oldStatus: item.status, newStatus: status });

    res.json(updated);
  } catch (e) { next(e); }
});

// ── POST /period-close/checklist/:periodMonthId/create-all — init checklist ──

router.post("/period-close/checklist/:periodMonthId/create-all", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const periodMonthId = req.params.periodMonthId as string;

    const [pm] = await db.select().from(periodMonthsTable)
      .where(and(eq(periodMonthsTable.id, periodMonthId), eq(periodMonthsTable.organizationId, orgId)));
    if (!pm) { res.status(404).json({ error: "Période mensuelle introuvable" }); return; }

    // Delete and recreate
    await db.delete(closingChecklistItemsTable).where(eq(closingChecklistItemsTable.periodMonthId, periodMonthId));
    await createDefaultChecklist(orgId, periodMonthId);

    const items = await db.select().from(closingChecklistItemsTable)
      .where(eq(closingChecklistItemsTable.periodMonthId, periodMonthId))
      .orderBy(asc(closingChecklistItemsTable.sortOrder));
    res.json({ items });
  } catch (e) { next(e); }
});

// ── GET /period-close/years — exercices fiscaux avec statut clôture ───────────

router.get("/period-close/years", requireAuth, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const years = await db.select().from(fiscalPeriodsTable)
      .where(eq(fiscalPeriodsTable.organizationId, orgId))
      .orderBy(desc(fiscalPeriodsTable.startDate));

    // Enrichit avec le nb de mois clôturés
    const allMonths = await db.select({ month: periodMonthsTable.month, status: periodMonthsTable.status, fpId: periodMonthsTable.fiscalPeriodId })
      .from(periodMonthsTable).where(eq(periodMonthsTable.organizationId, orgId));

    const monthsByFp = new Map<string, typeof allMonths>();
    for (const m of allMonths) {
      if (!monthsByFp.has(m.fpId)) monthsByFp.set(m.fpId, []);
      monthsByFp.get(m.fpId)!.push(m);
    }

    res.json({
      years: years.map(y => {
        const mths = monthsByFp.get(y.id) ?? [];
        return {
          ...y,
          closedMonths: mths.filter(m => ["closed", "locked"].includes(m.status)).length,
          totalMonths: 12,
          allMonthsClosed: mths.filter(m => ["closed", "locked"].includes(m.status)).length >= 12,
        };
      }),
    });
  } catch (e) { next(e); }
});

// ── POST /period-close/years/:id/close — clôture exercice ────────────────────

router.post("/period-close/years/:id/close", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = req.body as { reason?: string };

    const [fp] = await db.select().from(fiscalPeriodsTable)
      .where(and(eq(fiscalPeriodsTable.organizationId, orgId), eq(fiscalPeriodsTable.id, req.params.id as string)));
    if (!fp) { res.status(404).json({ error: "Exercice fiscal introuvable" }); return; }
    if (fp.status === "closed") { res.status(400).json({ error: "Exercice déjà clôturé" }); return; }

    // Vérifier que tous les mois sont fermés
    const months = await db.select().from(periodMonthsTable)
      .where(and(eq(periodMonthsTable.organizationId, orgId), eq(periodMonthsTable.fiscalPeriodId, fp.id)));
    const openMonths = months.filter(m => m.status === "open" || m.status === "review");

    if (openMonths.length > 0 && !req.body.force) {
      res.status(422).json({
        error: `${openMonths.length} mois non clôturé(s). Clôturez tous les mois avant de fermer l'exercice, ou utilisez force=true.`,
        openMonths: openMonths.map(m => m.month),
      });
      return;
    }

    const [updated] = await db.update(fiscalPeriodsTable).set({
      status: "closed",
      closedAt: new Date(),
      closedById: req.authUser!.id,
    }).where(eq(fiscalPeriodsTable.id, fp.id)).returning();

    await logAudit(orgId, "year_closed", req.authUser!.id, `${req.authUser!.firstName} ${req.authUser!.lastName}`, null, fp.id, fp.startDate.slice(0, 4), reason);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── POST /period-close/years/:id/reopen — réouverture exercice ───────────────

router.post("/period-close/years/:id/reopen", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) { res.status(400).json({ error: "Motif de réouverture obligatoire" }); return; }

    const [fp] = await db.select().from(fiscalPeriodsTable)
      .where(and(eq(fiscalPeriodsTable.organizationId, orgId), eq(fiscalPeriodsTable.id, req.params.id as string)));
    if (!fp) { res.status(404).json({ error: "Exercice introuvable" }); return; }

    const [updated] = await db.update(fiscalPeriodsTable).set({
      status: "open", closedAt: null as unknown as Date, closedById: null as unknown as string,
    }).where(eq(fiscalPeriodsTable.id, fp.id)).returning();

    await logAudit(orgId, "year_reopened", req.authUser!.id, `${req.authUser!.firstName} ${req.authUser!.lastName}`, null, fp.id, fp.startDate.slice(0, 4), reason);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── GET /period-close/audit — historique complet des actions ──────────────────

router.get("/period-close/audit", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { month, action, limit = "50" } = req.query as Record<string, string>;

    const conds: Parameters<typeof and>[0][] = [eq(closingAuditLogTable.organizationId, orgId)];
    if (month) conds.push(eq(closingAuditLogTable.month, month));
    if (action) conds.push(eq(closingAuditLogTable.action, action));

    const logs = await db.select().from(closingAuditLogTable)
      .where(and(...conds))
      .orderBy(desc(closingAuditLogTable.createdAt))
      .limit(parseInt(limit));

    res.json({ logs });
  } catch (e) { next(e); }
});

// ── GET /period-close/status — statut global (pour widget dashboard) ──────────

router.get("/period-close/status", requireAuth, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const currentYear = String(new Date().getFullYear());
    const currentMonth = new Date().toISOString().slice(0, 7);

    const months = await db.select({ month: periodMonthsTable.month, status: periodMonthsTable.status })
      .from(periodMonthsTable).where(eq(periodMonthsTable.organizationId, orgId));

    const thisYear = months.filter(m => m.month.startsWith(currentYear));
    const closedThisYear = thisYear.filter(m => ["closed", "locked"].includes(m.status)).length;

    const [currentPm] = await db.select().from(periodMonthsTable)
      .where(and(eq(periodMonthsTable.organizationId, orgId), eq(periodMonthsTable.month, currentMonth)));

    res.json({
      currentMonth,
      currentMonthStatus: currentPm?.status ?? "open",
      closedThisYear,
      currentYear,
      lastClosed: months.filter(m => ["closed", "locked"].includes(m.status)).sort((a, b) => b.month.localeCompare(a.month))[0]?.month ?? null,
    });
  } catch (e) { next(e); }
});

export default router;
