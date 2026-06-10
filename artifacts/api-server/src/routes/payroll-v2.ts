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

// ─── Calculs SYSCOHADA Togo (identiques à payroll.ts) ─────────────────────
function computeIrppAnnuel(revenuImposableAnnuel: number): number {
  const tranches = [
    { plafond: 900_000, taux: 0 },
    { plafond: 1_500_000, taux: 0.07 },
    { plafond: 2_500_000, taux: 0.11 },
    { plafond: 4_000_000, taux: 0.15 },
    { plafond: 6_000_000, taux: 0.20 },
    { plafond: 10_000_000, taux: 0.25 },
    { plafond: Infinity, taux: 0.35 },
  ];
  let irpp = 0, prev = 0;
  for (const { plafond, taux } of tranches) {
    if (revenuImposableAnnuel <= prev) break;
    const base = Math.min(revenuImposableAnnuel, plafond) - prev;
    irpp += base * taux;
    prev = plafond;
  }
  return Math.round(irpp);
}
function computePayslipAmounts(grossSalary: number) {
  const cnssEmployee = Math.round(grossSalary * 0.04);
  const cnssEmployer = Math.round(grossSalary * 0.164);
  const ipts = Math.round(grossSalary * 0.02);
  const revenuImposableMensuel = Math.max(0, grossSalary - cnssEmployee);
  const irppMensuel = Math.round(computeIrppAnnuel(revenuImposableMensuel * 12) / 12);
  const netSalary = Math.round(grossSalary - cnssEmployee - irppMensuel - ipts);
  return { cnssEmployee, cnssEmployer, irpp: irppMensuel, ipts, netSalary };
}

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

    // Calendrier : runs historiques + 6 prochains cycles projetés depuis le planning actif
    const historicalItems = allRuns.slice(0, 6).map(r => ({
      period: r.period,
      status: r.status,
      paymentDate: r.paymentDate ?? null,
      totalNetSalary: toNum(r.totalNetSalary),
      employeeCount: r.employeeCount ?? 0,
      isFuture: false,
    }));

    const existingPeriods = new Set(allRuns.map(r => r.period));

    // Generate forward-looking periods from schedule frequency
    const futureItems: typeof historicalItems = [];
    if (activeSchedule) {
      const today = new Date();
      let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
      const { frequency, cutoffDay1, cutoffDay2, paymentDelayDays = 3 } = activeSchedule;
      let generated = 0;
      while (generated < 6) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth(); // 0-indexed
        const periodStr = `${year}-${String(month + 1).padStart(2, "0")}`;
        if (!existingPeriods.has(periodStr)) {
          // Compute payment date based on frequency
          let payDay: Date;
          if (frequency === "bimonthly") {
            const cutoff = cutoffDay2 ?? 28;
            payDay = new Date(year, month, Math.min(cutoff + (paymentDelayDays ?? 3), 31));
          } else if (frequency === "weekly") {
            payDay = new Date(year, month, (cutoffDay1 ?? 5) + (paymentDelayDays ?? 3));
          } else {
            payDay = new Date(year, month, Math.min((cutoffDay1 ?? 28) + (paymentDelayDays ?? 3), 31));
          }
          // Clamp to last day of month
          const lastDay = new Date(year, month + 1, 0).getDate();
          if (payDay.getDate() > lastDay) payDay.setDate(lastDay);

          futureItems.push({
            period: periodStr,
            status: "scheduled",
            paymentDate: payDay.toISOString().split("T")[0],
            totalNetSalary: 0,
            employeeCount: kpis.avgEmployeeCount,
            isFuture: true,
          });
          generated++;
        }
        // Advance by 1 month
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        if (generated === 0 && cursor.getFullYear() > today.getFullYear() + 2) break; // safety
      }
    }

    // Merge: historical first, then upcoming projections — no duplicate periods
    const calendarItems = [
      ...historicalItems,
      ...futureItems.filter(f => !existingPeriods.has(f.period)),
    ];

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
      .where(and(eq(payrollSchedulesTable.id, req.params.id), eq(payrollSchedulesTable.organizationId, orgId))!)
      .returning();
    if (!row) return res.status(404).json({ error: "Planning introuvable" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/payroll/schedules/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(payrollSchedulesTable)
      .where(and(eq(payrollSchedulesTable.id, req.params.id), eq(payrollSchedulesTable.organizationId, orgId))!);
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
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id))!)
      .limit(1);
    if (!run) return res.status(404).json({ error: "Cycle introuvable" });

    // Collaborateurs actifs avec contrat
    const actives = await db
      .select({
        collaboratorId: collaboratorsTable.id,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        department: collaboratorsTable.department,
        position: collaboratorsTable.position,
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
        eq(collaboratorsTable.employmentStatus, "active"),
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
          jobTitle: a.position ?? null,
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
    }).parse(req.body);

    // Fetch existing line (org-scoped via run ownership)
    const [existing] = await db.select().from(payrollLineItemsTable)
      .where(and(
        eq(payrollLineItemsTable.id, req.params.lineId),
        eq(payrollLineItemsTable.organizationId, orgId),
        eq(payrollLineItemsTable.payrollRunId, req.params.id),
      )!)
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Ligne introuvable" });

    // Merge patch with existing values for totalGross computation
    const merged = {
      bonus: body.bonus ?? toNum(existing.bonus),
      commission: body.commission ?? toNum(existing.commission),
      tip: body.tip ?? toNum(existing.tip),
      reimbursement: body.reimbursement ?? toNum(existing.reimbursement),
      deduction: body.deduction ?? toNum(existing.deduction),
      payrollCorrection: body.payrollCorrection ?? toNum(existing.payrollCorrection),
    };

    // Get collaborator salary for authoritative totalGross
    const [collab] = await db.select({
      baseSalary: collaboratorsTable.baseSalary,
      transportAllowance: collaboratorsTable.transportAllowance,
      housingAllowance: collaboratorsTable.housingAllowance,
      monthlySalary: contractsTable.monthlySalary,
    })
      .from(collaboratorsTable)
      .leftJoin(contractsTable, and(
        eq(contractsTable.collaboratorId, collaboratorsTable.id),
        eq(contractsTable.status, "active"),
      ))
      .where(eq(collaboratorsTable.id, existing.collaboratorId))
      .limit(1);

    const base = collab ? (toNum(collab.monthlySalary) || toNum(collab.baseSalary)) : 0;
    const transport = collab ? toNum(collab.transportAllowance) : 0;
    const housing = collab ? toNum(collab.housingAllowance) : 0;
    const computedGross = Math.max(0,
      base + transport + housing
      + merged.bonus + merged.commission + merged.tip
      + merged.reimbursement + merged.payrollCorrection
      - merged.deduction,
    );

    const updates: Record<string, unknown> = { totalGross: String(computedGross) };
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) updates[k] = typeof v === "number" ? String(v) : v;
    }

    const [line] = await db.update(payrollLineItemsTable)
      .set(updates)
      .where(eq(payrollLineItemsTable.id, existing.id))
      .returning();
    res.json({ ...line, totalGross: toNum(line.totalGross) });
  } catch (e) { next(e); }
});

// Sync heures depuis présence pour la période du run
router.post("/payroll/runs/:id/sync-attendance", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id))!)
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
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id))!)
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

// POST /payroll/runs/:id/submit — recompute payslips from line-items, update run totals, validate atomically
router.post("/payroll/runs/:id/submit", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id))!)
      .limit(1);
    if (!run) return res.status(404).json({ error: "Cycle introuvable" });
    if (run.status !== "draft") return res.status(400).json({ error: "Seul un brouillon peut être soumis" });

    // Get all line items for this run
    const lineItems = await db.select().from(payrollLineItemsTable)
      .where(eq(payrollLineItemsTable.payrollRunId, run.id));
    if (lineItems.length === 0) {
      return res.status(400).json({ error: "Aucune ligne de paie. Utilisez d'abord « Préparer la paie »." });
    }

    // Get collaborator salary data in one query
    const collabIds = [...new Set(lineItems.map(l => l.collaboratorId))];
    const collabs = await db.select({
      id: collaboratorsTable.id,
      baseSalary: collaboratorsTable.baseSalary,
      transportAllowance: collaboratorsTable.transportAllowance,
      housingAllowance: collaboratorsTable.housingAllowance,
      monthlySalary: contractsTable.monthlySalary,
      contractId: contractsTable.id,
    })
      .from(collaboratorsTable)
      .leftJoin(contractsTable, and(
        eq(contractsTable.collaboratorId, collaboratorsTable.id),
        eq(contractsTable.status, "active"),
      ))
      .where(inArray(collaboratorsTable.id, collabIds));
    const collabMap = new Map(collabs.map(c => [c.id, c]));

    // Compute payslip data from each line item
    let totalGrossSalary = 0, totalCnssEmployee = 0, totalCnssEmployer = 0;
    let totalIrpp = 0, totalIpts = 0, totalNetSalary = 0;

    const payslipRows = lineItems.map(line => {
      const c = collabMap.get(line.collaboratorId);
      const base = c ? (toNum(c.monthlySalary) || toNum(c.baseSalary)) : 0;
      const transport = c ? toNum(c.transportAllowance) : 0;
      const housing = c ? toNum(c.housingAllowance) : 0;
      const variable = toNum(line.bonus) + toNum(line.commission) + toNum(line.tip)
        + toNum(line.reimbursement) + toNum(line.payrollCorrection);
      const deduction = toNum(line.deduction);
      const gross = Math.max(0, base + transport + housing + variable - deduction);
      const { cnssEmployee, cnssEmployer, irpp, ipts, netSalary } = computePayslipAmounts(gross);

      totalGrossSalary += gross;
      totalCnssEmployee += cnssEmployee;
      totalCnssEmployer += cnssEmployer;
      totalIrpp += irpp;
      totalIpts += ipts;
      totalNetSalary += netSalary;

      return {
        organizationId: orgId,
        payrollRunId: run.id,
        collaboratorId: line.collaboratorId,
        contractId: c?.contractId ?? null,
        period: run.period,
        baseSalary: String(base),
        transportAllowance: String(transport),
        housingAllowance: String(housing),
        grossSalary: String(gross),
        cnssEmployee: String(cnssEmployee),
        cnssEmployer: String(cnssEmployer),
        irpp: String(irpp),
        ipts: String(ipts),
        netSalary: String(netSalary),
        status: "validated" as const,
      };
    });

    // Delete and re-insert payslips (atomic replacement)
    await db.delete(payslipsTable).where(eq(payslipsTable.payrollRunId, run.id));
    if (payslipRows.length > 0) await db.insert(payslipsTable).values(payslipRows);

    // Update run totals and validate
    const [updated] = await db.update(payrollRunsTable).set({
      status: "validated",
      validatedById: req.authUser!.id,
      validatedAt: new Date(),
      employeeCount: payslipRows.length,
      totalGrossSalary: String(Math.round(totalGrossSalary)),
      totalCnssEmployee: String(Math.round(totalCnssEmployee)),
      totalCnssEmployer: String(Math.round(totalCnssEmployer)),
      totalIrpp: String(Math.round(totalIrpp)),
      totalIpts: String(Math.round(totalIpts)),
      totalNetSalary: String(Math.round(totalNetSalary)),
    }).where(eq(payrollRunsTable.id, run.id)).returning();

    res.json({
      ...updated,
      employeeCount: payslipRows.length,
      totalGrossSalary: Math.round(totalGrossSalary),
      totalNetSalary: Math.round(totalNetSalary),
    });
  } catch (e) { next(e); }
});

// POST /payroll/runs/:id/import-csv — server-side CSV parsing with validation preview
router.post("/payroll/runs/:id/import-csv", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id))!)
      .limit(1);
    if (!run) return res.status(404).json({ error: "Cycle introuvable" });
    if (run.status !== "draft") return res.status(400).json({ error: "Seul un brouillon peut être importé" });

    const body = z.object({
      csv: z.string().min(1),
      apply: z.boolean().default(false),
    }).parse(req.body);

    const csvLines = body.csv.trim().split(/\r?\n/).filter(l => l.trim());
    if (csvLines.length < 2) return res.status(400).json({ error: "CSV vide ou sans données" });

    const sep = csvLines[0].includes(";") ? ";" : ",";

    // Normalize header: strip accents, lowercase
    const normalize = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const headers = csvLines[0].split(sep).map(normalize);
    const dataRows = csvLines.slice(1);

    // Get existing line items + collaborator names
    const existingLines = await db.select().from(payrollLineItemsTable)
      .where(eq(payrollLineItemsTable.payrollRunId, run.id));
    const collabIds = existingLines.map(l => l.collaboratorId);
    const collabs = collabIds.length > 0
      ? await db.select({ id: collaboratorsTable.id, firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName })
          .from(collaboratorsTable).where(inArray(collaboratorsTable.id, collabIds))
      : [];

    const lineByCollabId = new Map(existingLines.map(l => [l.collaboratorId, l]));
    const collabByName = new Map(collabs.map(c => [`${c.firstName} ${c.lastName}`.toLowerCase(), c.id]));
    const collabById = new Map(collabs.map(c => [c.id, c]));

    // Field mapping: CSV header → DB field
    const FIELD_MAP: Record<string, string> = {
      bonus: "bonus", prime: "bonus", primes: "bonus",
      commission: "commission", commissions: "commission",
      remboursement: "reimbursement", remboursements: "reimbursement", reimbursement: "reimbursement",
      deduction: "deduction", deductions: "deduction", retenue: "deduction", retenuespeciale: "deduction",
      h_regulieres: "regularHours", heures_regulieres: "regularHours", regularhours: "regularHours",
      h_sup: "overtimeHours", heures_sup: "overtimeHours", overtimehours: "overtimeHours",
      tip: "tip", pourboire: "tip",
      notes: "notes", remarques: "notes",
    };

    type PreviewRow = { collaboratorId: string; name: string; matched: boolean; fields: Record<string, number | string>; error?: string };
    const preview: PreviewRow[] = [];
    const updates: Array<{ lineId: string; patch: Record<string, string> }> = [];
    const unmatched: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i].split(sep);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = cells[idx]?.trim() ?? ""; });

      // Identify collaborator
      const idCol = row["id"] || row["collaborator_id"] || row["collaboratorid"];
      const nomCol = row["nom"] || row["name"] || row["collaborateur"] || row["prenom_nom"];
      let collabId: string | undefined = idCol || collabByName.get((nomCol ?? "").toLowerCase());

      const line = collabId ? lineByCollabId.get(collabId) : undefined;
      if (!line || !collabId) {
        const label = nomCol ?? idCol ?? `Ligne ${i + 2}`;
        unmatched.push(`Ligne ${i + 2}: "${label}" non trouvé dans ce cycle`);
        preview.push({ collaboratorId: "", name: label, matched: false, fields: {} });
        continue;
      }

      const c = collabById.get(collabId);
      const name = c ? `${c.firstName} ${c.lastName}` : collabId;
      const fields: Record<string, number | string> = {};
      const patch: Record<string, string> = {};

      for (const [header, value] of Object.entries(row)) {
        const field = FIELD_MAP[header];
        if (!field || !value) continue;
        if (field === "notes") {
          fields[field] = value;
          patch[field] = value;
        } else {
          const num = parseFloat(value.replace(/\s/g, "").replace(",", "."));
          if (!isNaN(num)) {
            fields[field] = num;
            patch[field] = String(num);
          }
        }
      }

      preview.push({ collaboratorId: collabId, name, matched: true, fields, ...(Object.keys(patch).length === 0 ? { error: "Aucune colonne reconnue" } : {}) });
      if (Object.keys(patch).length > 0) updates.push({ lineId: line.id, patch });
    }

    let applied = 0;
    if (body.apply && updates.length > 0) {
      for (const { lineId, patch } of updates) {
        await db.update(payrollLineItemsTable).set(patch).where(eq(payrollLineItemsTable.id, lineId));
        applied++;
      }
    }

    res.json({ preview, unmatched, matched: updates.length, total: dataRows.length, applied });
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

    // Multi-tenant ownership validation
    const [collabCheck] = await db.select({ id: collaboratorsTable.id })
      .from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.id, body.collaboratorId), eq(collaboratorsTable.organizationId, orgId)))
      .limit(1);
    if (!collabCheck) return res.status(400).json({ error: "Collaborateur introuvable dans cette organisation" });

    if (body.sourceRunId) {
      const [srcRun] = await db.select({ id: payrollRunsTable.id }).from(payrollRunsTable)
        .where(and(eq(payrollRunsTable.id, body.sourceRunId), eq(payrollRunsTable.organizationId, orgId)))
        .limit(1);
      if (!srcRun) return res.status(400).json({ error: "Cycle source introuvable dans cette organisation" });
    }
    if (body.targetRunId) {
      const [tgtRun] = await db.select({ id: payrollRunsTable.id }).from(payrollRunsTable)
        .where(and(eq(payrollRunsTable.id, body.targetRunId), eq(payrollRunsTable.organizationId, orgId)))
        .limit(1);
      if (!tgtRun) return res.status(400).json({ error: "Cycle cible introuvable dans cette organisation" });
    }

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

    // Fetch the correction first
    const [correction] = await db.select().from(payrollCorrectionsTable)
      .where(and(eq(payrollCorrectionsTable.id, req.params.id), eq(payrollCorrectionsTable.organizationId, orgId))!)
      .limit(1);
    if (!correction) return res.status(404).json({ error: "Correction introuvable" });

    const updates: Record<string, unknown> = { ...body };
    if (body.status === "approved") { updates.approvedById = req.authUser!.id; updates.approvedAt = new Date(); }
    if (body.status === "applied") updates.appliedAt = new Date();

    // ── Injection dans la ligne de paie quand status → "applied" ──
    let offCycleCreated = false;
    let resolvedTargetRunId: string | null = null;

    if (body.status === "applied") {
      // Validate that the explicit targetRunId belongs to this org
      if (body.targetRunId) {
        const [tgtOwnership] = await db.select({ id: payrollRunsTable.id })
          .from(payrollRunsTable)
          .where(and(eq(payrollRunsTable.id, body.targetRunId), eq(payrollRunsTable.organizationId, orgId)))
          .limit(1);
        if (!tgtOwnership) return res.status(400).json({ error: "Cycle cible introuvable dans cette organisation" });
      }

      // Resolve target run: explicit (already validated above) > correction.targetRunId (re-validate) > next draft > create off-cycle
      if (!body.targetRunId && correction.targetRunId) {
        const [storedOwnership] = await db.select({ id: payrollRunsTable.id })
          .from(payrollRunsTable)
          .where(and(eq(payrollRunsTable.id, correction.targetRunId), eq(payrollRunsTable.organizationId, orgId)))
          .limit(1);
        // If the stored targetRunId exists and belongs to org, use it; otherwise fall through to next-draft logic
        if (storedOwnership) resolvedTargetRunId = correction.targetRunId;
      } else {
        resolvedTargetRunId = body.targetRunId ?? null;
      }

      if (!resolvedTargetRunId) {
        const [draftRun] = await db.select({ id: payrollRunsTable.id })
          .from(payrollRunsTable)
          .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.status, "draft")))
          .orderBy(asc(payrollRunsTable.period))
          .limit(1);
        if (draftRun) {
          resolvedTargetRunId = draftRun.id;
        } else {
          // Create a minimal off-cycle draft run
          const now = new Date();
          const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const [newRun] = await db.insert(payrollRunsTable).values({
            organizationId: orgId,
            period,
            status: "draft",
            notes: `Off-cycle — correction régularisée (${toNum(correction.amount) >= 0 ? "+" : ""}${toNum(correction.amount).toLocaleString("fr-FR")} FCFA)`,
            createdById: req.authUser!.id,
          }).returning();
          resolvedTargetRunId = newRun.id;
          offCycleCreated = true;
        }
      }

      updates.targetRunId = resolvedTargetRunId;

      // Upsert payrollCorrection in the target run's line item for this collaborator
      const [existingLine] = await db.select({
        id: payrollLineItemsTable.id,
        payrollCorrection: payrollLineItemsTable.payrollCorrection,
      })
        .from(payrollLineItemsTable)
        .where(and(
          eq(payrollLineItemsTable.payrollRunId, resolvedTargetRunId),
          eq(payrollLineItemsTable.collaboratorId, correction.collaboratorId),
        ))
        .limit(1);

      const corrAmount = toNum(correction.amount);
      if (existingLine) {
        const newTotal = toNum(existingLine.payrollCorrection) + corrAmount;
        await db.update(payrollLineItemsTable)
          .set({ payrollCorrection: String(newTotal) })
          .where(eq(payrollLineItemsTable.id, existingLine.id));
      } else {
        await db.insert(payrollLineItemsTable).values({
          organizationId: orgId,
          payrollRunId: resolvedTargetRunId,
          collaboratorId: correction.collaboratorId,
          payrollCorrection: String(corrAmount),
        });
      }
    }

    const [row] = await db.update(payrollCorrectionsTable)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updates as any)
      .where(eq(payrollCorrectionsTable.id, req.params.id))
      .returning();

    res.json({ ...row, amount: toNum(row.amount), offCycleCreated, targetRunId: resolvedTargetRunId ?? row.targetRunId });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════
// SEED DÉMO (idempotent)
// ════════════════════════════════════════════════════════
router.post("/payroll/seed-demo", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

    // 1. Planning bimensuel actif
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

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const existingRuns = await db.select().from(payrollRunsTable)
      .where(eq(payrollRunsTable.organizationId, orgId));
    const hasCurrent = existingRuns.some(r => r.period === currentPeriod);
    const hasPrev = existingRuns.some(r => r.period === prevPeriod);

    // Collaborateurs actifs avec contrat
    const actives = await db.select({
      collaboratorId: collaboratorsTable.id,
      contractId: contractsTable.id,
      baseSalary: collaboratorsTable.baseSalary,
      transportAllowance: collaboratorsTable.transportAllowance,
      housingAllowance: collaboratorsTable.housingAllowance,
      monthlySalary: contractsTable.monthlySalary,
    })
      .from(collaboratorsTable)
      .leftJoin(contractsTable, and(
        eq(contractsTable.collaboratorId, collaboratorsTable.id),
        eq(contractsTable.status, "active"),
      ))
      .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.employmentStatus, "active"))!)
      .limit(5);

    // 2. Run mois précédent validé avec bulletins réels
    if (!hasPrev && actives.length > 0) {
      const prevPayDay = new Date(prevYear, prevMonth, 28);
      const [prevRun] = await db.insert(payrollRunsTable).values({
        organizationId: orgId,
        period: prevPeriod,
        status: "validated",
        paymentDate: prevPayDay.toISOString().split("T")[0],
        notes: "Cycle validé — exemple démo",
        createdById: req.authUser!.id,
        validatedById: req.authUser!.id,
        validatedAt: new Date(prevYear, prevMonth - 1, 26),
        employeeCount: actives.length,
      }).returning();

      let tGross = 0, tCnssEmp = 0, tCnssEr = 0, tIrpp = 0, tIpts = 0, tNet = 0;
      const prevPayslips = actives.map(a => {
        const base = toNum(a.monthlySalary) || toNum(a.baseSalary) || 250_000;
        const transport = toNum(a.transportAllowance) || 25_000;
        const housing = toNum(a.housingAllowance) || 0;
        const gross = base + transport + housing;
        const { cnssEmployee, cnssEmployer, irpp, ipts, netSalary } = computePayslipAmounts(gross);
        tGross += gross; tCnssEmp += cnssEmployee; tCnssEr += cnssEmployer;
        tIrpp += irpp; tIpts += ipts; tNet += netSalary;
        return {
          organizationId: orgId, payrollRunId: prevRun.id,
          collaboratorId: a.collaboratorId, contractId: a.contractId ?? undefined,
          period: prevPeriod,
          baseSalary: String(base), transportAllowance: String(transport), housingAllowance: String(housing),
          grossSalary: String(gross),
          cnssEmployee: String(cnssEmployee), cnssEmployer: String(cnssEmployer),
          irpp: String(irpp), ipts: String(ipts), netSalary: String(netSalary),
          status: "validated" as const,
        };
      });
      if (prevPayslips.length > 0) await db.insert(payslipsTable).values(prevPayslips);
      await db.update(payrollRunsTable).set({
        totalGrossSalary: String(Math.round(tGross)),
        totalCnssEmployee: String(Math.round(tCnssEmp)),
        totalCnssEmployer: String(Math.round(tCnssEr)),
        totalIrpp: String(Math.round(tIrpp)),
        totalIpts: String(Math.round(tIpts)),
        totalNetSalary: String(Math.round(tNet)),
      }).where(eq(payrollRunsTable.id, prevRun.id));

      // 3. Correction démo sur le run précédent
      const existingCorrections = await db.select().from(payrollCorrectionsTable)
        .where(eq(payrollCorrectionsTable.organizationId, orgId));
      if (existingCorrections.length === 0 && actives[0]) {
        await db.insert(payrollCorrectionsTable).values({
          organizationId: orgId,
          collaboratorId: actives[0].collaboratorId,
          sourceRunId: prevRun.id,
          amount: "35000",
          reason: "Heures supplémentaires non comptabilisées",
          description: `Régularisation de 5h sup × 7 000 FCFA/h sur la période ${prevPeriod}`,
          status: "pending",
          createdById: req.authUser!.id,
        });
      }
    }

    // 4. Run mois courant en draft avec lignes peuplées
    let currentRunId: string | null = null;
    if (!hasCurrent) {
      const payDay = new Date(now.getFullYear(), now.getMonth(), 28);
      const [currentRun] = await db.insert(payrollRunsTable).values({
        organizationId: orgId,
        period: currentPeriod,
        status: "draft",
        paymentDate: payDay.toISOString().split("T")[0],
        notes: "Cycle bimensuel — à valider avant le 25",
        createdById: req.authUser!.id,
      }).returning();
      currentRunId = currentRun.id;
    } else {
      currentRunId = existingRuns.find(r => r.period === currentPeriod)?.id ?? null;
    }

    // Injecter des lignes variables démo dans le run courant
    if (currentRunId && actives.length > 0) {
      const existingLines = await db.select().from(payrollLineItemsTable)
        .where(eq(payrollLineItemsTable.payrollRunId, currentRunId));
      if (existingLines.length === 0) {
        const demoVariables = [
          { bonus: 75_000, commission: 0, reimbursement: 15_000, deduction: 0 },
          { bonus: 50_000, commission: 120_000, reimbursement: 0, deduction: 0 },
          { bonus: 0, commission: 0, reimbursement: 25_000, deduction: 10_000 },
          { bonus: 100_000, commission: 0, reimbursement: 0, deduction: 0 },
          { bonus: 30_000, commission: 45_000, reimbursement: 8_000, deduction: 5_000 },
        ];
        const linesToInsert = actives.slice(0, 5).map((a, i) => {
          const vars = demoVariables[i] ?? demoVariables[0];
          const base = toNum(a.monthlySalary) || toNum(a.baseSalary) || 250_000;
          const transport = toNum(a.transportAllowance) || 25_000;
          const housing = toNum(a.housingAllowance) || 0;
          const gross = Math.max(0, base + transport + housing + vars.bonus + vars.commission + vars.reimbursement - vars.deduction);
          return {
            organizationId: orgId,
            payrollRunId: currentRunId!,
            collaboratorId: a.collaboratorId,
            bonus: String(vars.bonus),
            commission: String(vars.commission),
            reimbursement: String(vars.reimbursement),
            deduction: String(vars.deduction),
            regularHours: "160",
            totalGross: String(gross),
          };
        });
        if (linesToInsert.length > 0) await db.insert(payrollLineItemsTable).values(linesToInsert);
      }
    }

    res.json({ ok: true, message: `Données de démo créées (${actives.length} collaborateurs, run ${currentPeriod} + ${prevPeriod})` });
  } catch (e) { next(e); }
});

export default router;
