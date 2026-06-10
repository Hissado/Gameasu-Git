/**
 * Paie V2 — Plannings récurrents, Lignes de paie, Corrections, Dashboard
 *
 * GET    /api/payroll/dashboard            KPIs + prochain cycle
 * GET    /api/payroll/schedules            liste des plannings
 * POST   /api/payroll/schedules            créer un planning
 * PATCH  /api/payroll/schedules/:id        modifier
 * DELETE /api/payroll/schedules/:id        supprimer
 *
 * GET    /api/payroll/runs/:id/line-items  lignes par collaborateur (crée si manquant)
 * PATCH  /api/payroll/runs/:id/line-items/:lineId  modifier une ligne
 * POST   /api/payroll/runs/:id/sync-attendance     sync heures depuis présence
 * POST   /api/payroll/runs/:id/import-rows         import bulk rows (JSON)
 *
 * GET    /api/payroll/corrections          liste corrections
 * POST   /api/payroll/corrections          créer correction
 * PATCH  /api/payroll/corrections/:id      approuver/appliquer
 *
 * POST   /api/payroll/seed-demo            données de démo
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  payrollRunsTable,
  payslipsTable,
  collaboratorsTable,
  contractsTable,
  payrollSchedulesTable,
  payrollLineItemsTable,
  payrollCorrectionsTable,
  attendanceSessionsTable,
  leaveRequestsTable,
} from "@workspace/db";
import { and, desc, eq, gte, lte, sql, asc, inArray } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { z } from "zod/v4";

const router = Router();
router.use(requireAuth);

const toNum = (v: unknown) => (v == null ? 0 : Number(v));

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════
router.get("/payroll/dashboard", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

    // Tous les runs de l'org, triés
    const allRuns = await db.select().from(payrollRunsTable)
      .where(eq(payrollRunsTable.organizationId, orgId))
      .orderBy(desc(payrollRunsTable.period));

    // Run en brouillon le plus récent → "À venir"
    const nextRun = allRuns.find(r => r.status === "draft") ?? null;

    // KPIs sur les 12 derniers mois
    const validatedRuns = allRuns.filter(r => r.status === "validated" || r.status === "paid");
    const kpis = {
      totalGross: validatedRuns.reduce((s, r) => s + toNum(r.totalGrossSalary), 0),
      totalNet: validatedRuns.reduce((s, r) => s + toNum(r.totalNetSalary), 0),
      totalCnssEmployer: validatedRuns.reduce((s, r) => s + toNum(r.totalCnssEmployer), 0),
      totalIrpp: validatedRuns.reduce((s, r) => s + toNum(r.totalIrpp), 0),
      avgEmployeeCount: validatedRuns.length > 0
        ? Math.round(validatedRuns.reduce((s, r) => s + (r.employeeCount ?? 0), 0) / validatedRuns.length)
        : 0,
      runCount: allRuns.length,
      draftCount: allRuns.filter(r => r.status === "draft").length,
    };

    // Planning actif
    const [activeSchedule] = await db.select().from(payrollSchedulesTable)
      .where(and(eq(payrollSchedulesTable.organizationId, orgId), eq(payrollSchedulesTable.isActive, true)))
      .limit(1);

    // Calendrier : les 6 derniers runs + prochain calculé
    const calendarItems = allRuns.slice(0, 12).map(r => ({
      period: r.period,
      status: r.status,
      paymentDate: r.paymentDate,
      totalNetSalary: toNum(r.totalNetSalary),
      employeeCount: r.employeeCount,
    }));

    // Corrections en attente
    const pendingCorrections = await db.select({ count: sql<number>`count(*)` })
      .from(payrollCorrectionsTable)
      .where(and(eq(payrollCorrectionsTable.organizationId, orgId), eq(payrollCorrectionsTable.status, "pending")));

    res.json({
      nextRun: nextRun ? {
        ...nextRun,
        totalGrossSalary: toNum(nextRun.totalGrossSalary),
        totalNetSalary: toNum(nextRun.totalNetSalary),
        totalCnssEmployer: toNum(nextRun.totalCnssEmployer),
      } : null,
      activeSchedule: activeSchedule ?? null,
      kpis,
      calendarItems,
      pendingCorrections: Number(pendingCorrections[0]?.count ?? 0),
      recentRuns: allRuns.slice(0, 5).map(r => ({
        ...r,
        totalGrossSalary: toNum(r.totalGrossSalary),
        totalNetSalary: toNum(r.totalNetSalary),
      })),
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════
// PLANNINGS RÉCURRENTS
// ════════════════════════════════════════════════════════
router.get("/payroll/schedules", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(payrollSchedulesTable)
      .where(eq(payrollSchedulesTable.organizationId, orgId))
      .orderBy(desc(payrollSchedulesTable.isActive), asc(payrollSchedulesTable.name));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/payroll/schedules", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      name: z.string().min(1),
      frequency: z.enum(["monthly", "bimonthly", "weekly", "custom"]).default("monthly"),
      cutoffDay1: z.number().int().min(1).max(31).optional(),
      cutoffDay2: z.number().int().min(1).max(31).optional(),
      paymentDelayDays: z.number().int().min(0).max(30).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const [row] = await db.insert(payrollSchedulesTable).values({
      organizationId: orgId,
      ...body,
      createdById: req.authUser!.id,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch("/payroll/schedules/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      name: z.string().optional(),
      frequency: z.enum(["monthly", "bimonthly", "weekly", "custom"]).optional(),
      cutoffDay1: z.number().int().min(1).max(31).optional(),
      cutoffDay2: z.number().int().min(1).max(31).optional(),
      paymentDelayDays: z.number().int().min(0).max(30).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const [row] = await db.update(payrollSchedulesTable)
      .set(body)
      .where(and(eq(payrollSchedulesTable.id, req.params.id), eq(payrollSchedulesTable.organizationId, orgId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Planning introuvable" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/payroll/schedules/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(payrollSchedulesTable)
      .where(and(eq(payrollSchedulesTable.id, req.params.id), eq(payrollSchedulesTable.organizationId, orgId)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════
// LIGNES DE PAIE (données variables par collaborateur)
// ════════════════════════════════════════════════════════

/** Récupère ou crée les lignes de paie pour tous les collaborateurs du run */
router.get("/payroll/runs/:id/line-items", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) return res.status(404).json({ error: "Cycle introuvable" });

    // Collaborateurs actifs avec contrat
    const actives = await db
      .select({
        collaboratorId: collaboratorsTable.id,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        department: collaboratorsTable.department,
        jobTitle: collaboratorsTable.jobTitle,
        poste: collaboratorsTable.poste,
        baseSalary: collaboratorsTable.baseSalary,
        transportAllowance: collaboratorsTable.transportAllowance,
        housingAllowance: collaboratorsTable.housingAllowance,
        contractId: contractsTable.id,
        monthlySalary: contractsTable.monthlySalary,
        weeklyHours: contractsTable.weeklyHours,
      })
      .from(collaboratorsTable)
      .leftJoin(contractsTable, and(
        eq(contractsTable.collaboratorId, collaboratorsTable.id),
        eq(contractsTable.status, "active"),
      ))
      .where(and(
        eq(collaboratorsTable.organizationId, orgId),
        eq(collaboratorsTable.status, "active"),
      ))
      .orderBy(asc(collaboratorsTable.lastName));

    // Lignes existantes
    const existingLines = await db.select().from(payrollLineItemsTable)
      .where(eq(payrollLineItemsTable.payrollRunId, run.id));
    const lineMap = new Map(existingLines.map(l => [l.collaboratorId, l]));

    // Créer les lignes manquantes
    const missing = actives.filter(a => !lineMap.has(a.collaboratorId));
    if (missing.length > 0) {
      const toInsert = missing
        .filter(a => a.contractId || toNum(a.baseSalary) > 0)
        .map(a => {
          const base = toNum(a.monthlySalary) || toNum(a.baseSalary);
          const transport = toNum(a.transportAllowance);
          const housing = toNum(a.housingAllowance);
          const gross = base + transport + housing;
          return {
            organizationId: orgId,
            payrollRunId: run.id,
            collaboratorId: a.collaboratorId,
            totalGross: String(gross),
          };
        });
      if (toInsert.length > 0) {
        const newLines = await db.insert(payrollLineItemsTable).values(toInsert).returning();
        newLines.forEach(l => lineMap.set(l.collaboratorId, l));
      }
    }

    // Assembler la réponse
    const result = actives
      .filter(a => a.contractId || toNum(a.baseSalary) > 0)
      .map(a => {
        const line = lineMap.get(a.collaboratorId);
        const base = toNum(a.monthlySalary) || toNum(a.baseSalary);
        const transport = toNum(a.transportAllowance);
        const housing = toNum(a.housingAllowance);
        return {
          collaboratorId: a.collaboratorId,
          firstName: a.firstName,
          lastName: a.lastName,
          department: a.department,
          jobTitle: a.jobTitle ?? a.poste,
          baseSalary: base,
          transportAllowance: transport,
          housingAllowance: housing,
          lineItemId: line?.id ?? null,
          regularHours: toNum(line?.regularHours),
          overtimeHours: toNum(line?.overtimeHours),
          leaveHours: toNum(line?.leaveHours),
          absenceHours: toNum(line?.absenceHours),
          bonus: toNum(line?.bonus),
          commission: toNum(line?.commission),
          tip: toNum(line?.tip),
          reimbursement: toNum(line?.reimbursement),
          deduction: toNum(line?.deduction),
          payrollCorrection: toNum(line?.payrollCorrection),
          notes: line?.notes ?? "",
          paymentMethod: line?.paymentMethod ?? "bank_transfer",
          totalGross: toNum(line?.totalGross) || (base + transport + housing),
          attendanceSynced: line?.attendanceSynced ?? false,
        };
      });

    res.json({ run: { ...run, totalGrossSalary: toNum(run.totalGrossSalary), totalNetSalary: toNum(run.totalNetSalary) }, lineItems: result });
  } catch (e) { next(e); }
});

router.patch("/payroll/runs/:id/line-items/:lineId", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      regularHours: z.number().min(0).optional(),
      overtimeHours: z.number().min(0).optional(),
      leaveHours: z.number().min(0).optional(),
      absenceHours: z.number().min(0).optional(),
      bonus: z.number().optional(),
      commission: z.number().optional(),
      tip: z.number().optional(),
      reimbursement: z.number().min(0).optional(),
      deduction: z.number().min(0).optional(),
      payrollCorrection: z.number().optional(),
      notes: z.string().optional(),
      paymentMethod: z.enum(["cash", "bank_transfer", "mobile_money", "check", "other"]).optional(),
      totalGross: z.number().optional(),
    }).parse(req.body);

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) {
        updates[k] = typeof v === "number" ? String(v) : v;
      }
    }

    const [line] = await db.update(payrollLineItemsTable)
      .set(updates)
      .where(and(
        eq(payrollLineItemsTable.id, req.params.lineId),
        eq(payrollLineItemsTable.organizationId, orgId),
        eq(payrollLineItemsTable.payrollRunId, req.params.id),
      ))
      .returning();
    if (!line) return res.status(404).json({ error: "Ligne introuvable" });
    res.json({ ...line, totalGross: toNum(line.totalGross) });
  } catch (e) { next(e); }
});

// Sync heures depuis présence pour la période du run
router.post("/payroll/runs/:id/sync-attendance", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) return res.status(404).json({ error: "Cycle introuvable" });
    if (run.status !== "draft") return res.status(400).json({ error: "Seul un brouillon peut être synchronisé" });

    // Dates de la période (YYYY-MM → premier et dernier jour)
    const [year, month] = run.period.split("-").map(Number);
    const firstDay = `${run.period}-01`;
    const lastDay = `${run.period}-${new Date(year, month, 0).getDate().toString().padStart(2, "0")}`;

    // Agréger les heures depuis attendance_sessions
    const sessions = await db.select({
      collaboratorId: attendanceSessionsTable.collaboratorId,
      totalMinutes: sql<number>`SUM(${attendanceSessionsTable.effectiveMinutes})`,
      daysWorked: sql<number>`COUNT(*)`,
    })
      .from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, firstDay),
        lte(attendanceSessionsTable.workDate, lastDay),
        eq(attendanceSessionsTable.status, "closed"),
      ))
      .groupBy(attendanceSessionsTable.collaboratorId);

    // Congés approuvés
    const leaves = await db.select({
      collaboratorId: leaveRequestsTable.collaboratorId,
      days: sql<number>`SUM(${leaveRequestsTable.days})`,
    })
      .from(leaveRequestsTable)
      .where(and(
        eq(leaveRequestsTable.organizationId, orgId),
        eq(leaveRequestsTable.status, "approved"),
        gte(leaveRequestsTable.startDate, firstDay),
        lte(leaveRequestsTable.endDate, lastDay),
      ))
      .groupBy(leaveRequestsTable.collaboratorId);

    const sessionMap = new Map(sessions.map(s => [s.collaboratorId, s]));
    const leaveMap = new Map(leaves.map(l => [l.collaboratorId, l]));

    // Mettre à jour les lignes existantes
    let synced = 0;
    const lines = await db.select().from(payrollLineItemsTable)
      .where(eq(payrollLineItemsTable.payrollRunId, run.id));

    for (const line of lines) {
      const session = sessionMap.get(line.collaboratorId);
      const leave = leaveMap.get(line.collaboratorId);
      if (!session && !leave) continue;

      const totalH = session ? Math.round(toNum(session.totalMinutes) / 60 * 10) / 10 : 0;
      const standardH = 8 * (toNum(session?.daysWorked) || 0); // 8h/jour théorique
      const regularH = Math.min(totalH, standardH);
      const overtimeH = Math.max(0, totalH - standardH);
      const leaveH = leave ? toNum(leave.days) * 8 : 0;

      await db.update(payrollLineItemsTable)
        .set({
          regularHours: String(regularH),
          overtimeHours: String(overtimeH),
          leaveHours: String(leaveH),
          attendanceSynced: true,
          attendanceSyncedAt: new Date(),
        })
        .where(eq(payrollLineItemsTable.id, line.id));
      synced++;
    }

    res.json({ synced, total: lines.length, message: `${synced} collaborateur(s) synchronisé(s) depuis la présence` });
  } catch (e) { next(e); }
});

// Import bulk rows (JSON)
router.post("/payroll/runs/:id/import-rows", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) return res.status(404).json({ error: "Cycle introuvable" });
    if (run.status !== "draft") return res.status(400).json({ error: "Seul un brouillon peut être importé" });

    const body = z.object({
      rows: z.array(z.object({
        collaboratorId: z.string().uuid(),
        bonus: z.number().optional(),
        commission: z.number().optional(),
        reimbursement: z.number().optional(),
        deduction: z.number().optional(),
        regularHours: z.number().optional(),
        overtimeHours: z.number().optional(),
        notes: z.string().optional(),
      })),
    }).parse(req.body);

    let imported = 0;
    let errors: string[] = [];

    for (const row of body.rows) {
      try {
        const existing = await db.select().from(payrollLineItemsTable)
          .where(and(
            eq(payrollLineItemsTable.payrollRunId, run.id),
            eq(payrollLineItemsTable.collaboratorId, row.collaboratorId),
          ))
          .limit(1);

        const updates: Record<string, unknown> = {};
        if (row.bonus !== undefined) updates.bonus = String(row.bonus);
        if (row.commission !== undefined) updates.commission = String(row.commission);
        if (row.reimbursement !== undefined) updates.reimbursement = String(row.reimbursement);
        if (row.deduction !== undefined) updates.deduction = String(row.deduction);
        if (row.regularHours !== undefined) updates.regularHours = String(row.regularHours);
        if (row.overtimeHours !== undefined) updates.overtimeHours = String(row.overtimeHours);
        if (row.notes !== undefined) updates.notes = row.notes;

        if (existing.length > 0) {
          await db.update(payrollLineItemsTable).set(updates)
            .where(eq(payrollLineItemsTable.id, existing[0].id));
        } else {
          await db.insert(payrollLineItemsTable).values({
            organizationId: orgId,
            payrollRunId: run.id,
            collaboratorId: row.collaboratorId,
            ...updates,
          });
        }
        imported++;
      } catch {
        errors.push(row.collaboratorId);
      }
    }

    res.json({ imported, errors, total: body.rows.length });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════
// CORRECTIONS DE PAIE
// ════════════════════════════════════════════════════════
router.get("/payroll/corrections", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status } = req.query as { status?: string };
    const filters = [eq(payrollCorrectionsTable.organizationId, orgId)];
    if (status) filters.push(eq(payrollCorrectionsTable.status, status));

    const rows = await db
      .select({
        id: payrollCorrectionsTable.id,
        collaboratorId: payrollCorrectionsTable.collaboratorId,
        amount: payrollCorrectionsTable.amount,
        reason: payrollCorrectionsTable.reason,
        description: payrollCorrectionsTable.description,
        status: payrollCorrectionsTable.status,
        sourceRunId: payrollCorrectionsTable.sourceRunId,
        targetRunId: payrollCorrectionsTable.targetRunId,
        createdAt: payrollCorrectionsTable.createdAt,
        approvedAt: payrollCorrectionsTable.approvedAt,
        appliedAt: payrollCorrectionsTable.appliedAt,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
      })
      .from(payrollCorrectionsTable)
      .leftJoin(collaboratorsTable, eq(payrollCorrectionsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...filters))
      .orderBy(desc(payrollCorrectionsTable.createdAt));

    // Résoudre les périodes des runs en une seule requête
    const runIds = [...new Set([
      ...rows.map(r => r.sourceRunId).filter(Boolean),
      ...rows.map(r => r.targetRunId).filter(Boolean),
    ])] as string[];
    const runs = runIds.length > 0
      ? await db.select({ id: payrollRunsTable.id, period: payrollRunsTable.period })
          .from(payrollRunsTable).where(inArray(payrollRunsTable.id, runIds))
      : [];
    const runMap = new Map(runs.map(r => [r.id, r.period]));

    res.json(rows.map(r => ({
      ...r,
      amount: toNum(r.amount),
      sourcePeriod: r.sourceRunId ? (runMap.get(r.sourceRunId) ?? null) : null,
      targetPeriod: r.targetRunId ? (runMap.get(r.targetRunId) ?? null) : null,
    })));
  } catch (e) { next(e); }
});

router.post("/payroll/corrections", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      collaboratorId: z.string().uuid(),
      sourceRunId: z.string().uuid().optional(),
      amount: z.number(),
      reason: z.string().min(1),
      description: z.string().optional(),
      targetRunId: z.string().uuid().optional(),
    }).parse(req.body);

    const [row] = await db.insert(payrollCorrectionsTable).values({
      organizationId: orgId,
      collaboratorId: body.collaboratorId,
      sourceRunId: body.sourceRunId,
      amount: String(body.amount),
      reason: body.reason,
      description: body.description,
      targetRunId: body.targetRunId,
      createdById: req.authUser!.id,
    }).returning();
    res.status(201).json({ ...row, amount: toNum(row.amount) });
  } catch (e) { next(e); }
});

router.patch("/payroll/corrections/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      status: z.enum(["approved", "applied", "rejected"]).optional(),
      targetRunId: z.string().uuid().optional(),
      description: z.string().optional(),
    }).parse(req.body);

    const updates: Record<string, unknown> = { ...body };
    if (body.status === "approved") updates.approvedById = req.authUser!.id;
    if (body.status === "approved") updates.approvedAt = new Date();
    if (body.status === "applied") updates.appliedAt = new Date();

    const [row] = await db.update(payrollCorrectionsTable)
      .set(updates)
      .where(and(eq(payrollCorrectionsTable.id, req.params.id), eq(payrollCorrectionsTable.organizationId, orgId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Correction introuvable" });
    res.json({ ...row, amount: toNum(row.amount) });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════
// SEED DÉMO (idempotent)
// ════════════════════════════════════════════════════════
router.post("/payroll/seed-demo", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

    // Planning bimensuel actif
    const existingSchedules = await db.select().from(payrollSchedulesTable)
      .where(eq(payrollSchedulesTable.organizationId, orgId));
    if (existingSchedules.length === 0) {
      await db.insert(payrollSchedulesTable).values({
        organizationId: orgId,
        name: "Paie bimensuelle principale",
        frequency: "bimonthly",
        cutoffDay1: 15,
        cutoffDay2: 28,
        paymentDelayDays: 3,
        description: "Cycle de paie bimensuel pour les collaborateurs permanents",
        isActive: true,
        createdById: req.authUser!.id,
      });
    }

    // Run du mois courant en draft (si pas encore créé)
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const existingRuns = await db.select().from(payrollRunsTable)
      .where(eq(payrollRunsTable.organizationId, orgId));
    const hasCurrentRun = existingRuns.some(r => r.period === currentPeriod);

    if (!hasCurrentRun) {
      const payDay = new Date(now.getFullYear(), now.getMonth(), 28);
      await db.insert(payrollRunsTable).values({
        organizationId: orgId,
        period: currentPeriod,
        status: "draft",
        paymentDate: payDay.toISOString().split("T")[0],
        notes: "Cycle bimensuel — à valider avant le 25",
        createdById: req.authUser!.id,
      });
    }

    res.json({ ok: true, message: "Données de démo créées" });
  } catch (e) { next(e); }
});

export default router;
