/**
 * Module Paie — Cycles de paie & Bulletins individuels
 *
 * Routes :
 *  GET    /api/payroll/runs                 liste des cycles
 *  POST   /api/payroll/runs                 créer un cycle (draft)
 *  GET    /api/payroll/runs/:id             détail + bulletins
 *  PATCH  /api/payroll/runs/:id             mettre à jour
 *  POST   /api/payroll/runs/:id/generate    générer les bulletins depuis les contrats actifs
 *  POST   /api/payroll/runs/:id/validate    valider le cycle (-> validated)
 *  DELETE /api/payroll/runs/:id             supprimer (draft seulement)
 *
 *  GET    /api/payroll/payslips             liste des bulletins (filtrable par période, collab)
 *  GET    /api/payroll/payslips/:id         fiche bulletin
 *  PATCH  /api/payroll/payslips/:id         modifier un bulletin (draft)
 *
 *  GET    /api/payroll/livre               livre de paie (regroupé par période)
 */
import { Router } from "express";
import { PassThrough } from "stream";
import { ZipArchive } from "archiver";
import { db } from "@workspace/db";
import {
  payrollRunsTable,
  payslipsTable,
  collaboratorsTable,
  contractsTable,
  organizationsTable,
} from "@workspace/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { generatePayslipPdf } from "../lib/payslip-pdf";

const router = Router();
router.use(requireAuth);

// ──────────────────────────────────────────────────────────
// Barème IRPP Togo (annuel, en XOF)
// ──────────────────────────────────────────────────────────
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
  let irpp = 0;
  let prev = 0;
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

const toNum = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

// ──────────────────────────────────────────────────────────
// CYCLES DE PAIE
// ──────────────────────────────────────────────────────────
router.get("/payroll/runs", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const runs = await db.select().from(payrollRunsTable)
      .where(eq(payrollRunsTable.organizationId, orgId))
      .orderBy(desc(payrollRunsTable.period));
    res.json(runs.map((r) => ({
      ...r,
      totalGrossSalary: toNum(r.totalGrossSalary),
      totalCnssEmployee: toNum(r.totalCnssEmployee),
      totalCnssEmployer: toNum(r.totalCnssEmployer),
      totalIrpp: toNum(r.totalIrpp),
      totalIpts: toNum(r.totalIpts),
      totalNetSalary: toNum(r.totalNetSalary),
    })));
  } catch (e) { next(e); }
});

router.post("/payroll/runs", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { period, notes, runDate, paymentDate } = req.body as {
      period: string; notes?: string; runDate?: string; paymentDate?: string;
    };
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      res.status(400).json({ error: "La période doit être au format YYYY-MM" }); return;
    }
    // Vérifier qu'il n'existe pas déjà un run pour cette période/org
    const [existing] = await db.select({ id: payrollRunsTable.id })
      .from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.period, period)))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: `Un cycle de paie pour la période ${period} existe déjà.` }); return;
    }
    const [run] = await db.insert(payrollRunsTable).values({
      organizationId: orgId,
      period,
      notes: notes || null,
      runDate: runDate || undefined,
      paymentDate: paymentDate || undefined,
      createdById: req.authUser!.id,
    }).returning();
    res.status(201).json(run);
  } catch (e) { next(e); }
});

router.get("/payroll/runs/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) { res.status(404).json({ error: "Cycle introuvable" }); return; }

    const payslips = await db
      .select({
        id: payslipsTable.id,
        collaboratorId: payslipsTable.collaboratorId,
        period: payslipsTable.period,
        baseSalary: payslipsTable.baseSalary,
        grossSalary: payslipsTable.grossSalary,
        cnssEmployee: payslipsTable.cnssEmployee,
        cnssEmployer: payslipsTable.cnssEmployer,
        irpp: payslipsTable.irpp,
        ipts: payslipsTable.ipts,
        netSalary: payslipsTable.netSalary,
        status: payslipsTable.status,
        transportAllowance: payslipsTable.transportAllowance,
        housingAllowance: payslipsTable.housingAllowance,
        mealAllowance: payslipsTable.mealAllowance,
        collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
        collaboratorCode: collaboratorsTable.employeeNumber,
        department: collaboratorsTable.department,
      })
      .from(payslipsTable)
      .leftJoin(collaboratorsTable, eq(payslipsTable.collaboratorId, collaboratorsTable.id))
      .where(eq(payslipsTable.payrollRunId, run.id))
      .orderBy(asc(collaboratorsTable.lastName));

    res.json({
      ...run,
      totalGrossSalary: toNum(run.totalGrossSalary),
      totalCnssEmployee: toNum(run.totalCnssEmployee),
      totalCnssEmployer: toNum(run.totalCnssEmployer),
      totalIrpp: toNum(run.totalIrpp),
      totalIpts: toNum(run.totalIpts),
      totalNetSalary: toNum(run.totalNetSalary),
      payslips: payslips.map((p) => ({
        ...p,
        baseSalary: toNum(p.baseSalary),
        grossSalary: toNum(p.grossSalary),
        cnssEmployee: toNum(p.cnssEmployee),
        cnssEmployer: toNum(p.cnssEmployer),
        irpp: toNum(p.irpp),
        ipts: toNum(p.ipts),
        netSalary: toNum(p.netSalary),
        transportAllowance: toNum(p.transportAllowance),
        housingAllowance: toNum(p.housingAllowance),
        mealAllowance: toNum(p.mealAllowance),
      })),
    });
  } catch (e) { next(e); }
});

router.patch("/payroll/runs/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) { res.status(404).json({ error: "Cycle introuvable" }); return; }
    if (run.status !== "draft") { res.status(400).json({ error: "Seul un cycle en brouillon peut être modifié" }); return; }
    const { notes, runDate, paymentDate } = req.body as { notes?: string; runDate?: string; paymentDate?: string };
    const [updated] = await db.update(payrollRunsTable)
      .set({ notes, runDate, paymentDate })
      .where(eq(payrollRunsTable.id, run.id))
      .returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.post("/payroll/runs/:id/generate", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) { res.status(404).json({ error: "Cycle introuvable" }); return; }
    if (run.status !== "draft") { res.status(400).json({ error: "Le cycle n'est pas en brouillon" }); return; }

    // Récupérer les collaborateurs actifs avec contrats actifs
    const actives = await db
      .select({
        collaboratorId: collaboratorsTable.id,
        contractId: contractsTable.id,
        baseSalary: collaboratorsTable.baseSalary,
        transportAllowance: collaboratorsTable.transportAllowance,
        housingAllowance: collaboratorsTable.housingAllowance,
      })
      .from(collaboratorsTable)
      .leftJoin(
        contractsTable,
        and(
          eq(contractsTable.collaboratorId, collaboratorsTable.id),
          eq(contractsTable.status, "active"),
        )
      )
      .where(
        and(
          eq(collaboratorsTable.organizationId, orgId),
          eq(collaboratorsTable.employmentStatus, "active"),
        )
      );

    // Déduplique : un seul contrat par collaborateur (premier contrat actif trouvé)
    const seen = new Set<string>();
    const toInsert = actives
      .filter((a) => {
        if (!a.contractId || a.baseSalary == null) return false;
        if (seen.has(a.collaboratorId)) return false;
        seen.add(a.collaboratorId);
        return true;
      })
      .map((a) => {
        const base = toNum(a.baseSalary);
        const transport = toNum(a.transportAllowance);
        const housing = toNum(a.housingAllowance);
        const gross = base + transport + housing;
        const { cnssEmployee, cnssEmployer, irpp, ipts, netSalary } = computePayslipAmounts(gross);
        return {
          organizationId: orgId,
          payrollRunId: run.id,
          collaboratorId: a.collaboratorId,
          contractId: a.contractId!,
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
        };
      });

    if (toInsert.length === 0) {
      res.status(400).json({ error: "Aucun collaborateur actif avec contrat actif trouvé" }); return;
    }

    // Insérer (ou ignorer doublons)
    await db.delete(payslipsTable).where(eq(payslipsTable.payrollRunId, run.id));
    await db.insert(payslipsTable).values(toInsert);

    // Recalculer les totaux
    const totals = toInsert.reduce(
      (acc, p) => ({
        grossSalary: acc.grossSalary + toNum(p.grossSalary),
        cnssEmployee: acc.cnssEmployee + toNum(p.cnssEmployee),
        cnssEmployer: acc.cnssEmployer + toNum(p.cnssEmployer),
        irpp: acc.irpp + toNum(p.irpp),
        ipts: acc.ipts + toNum(p.ipts),
        netSalary: acc.netSalary + toNum(p.netSalary),
      }),
      { grossSalary: 0, cnssEmployee: 0, cnssEmployer: 0, irpp: 0, ipts: 0, netSalary: 0 }
    );

    const [updated] = await db.update(payrollRunsTable).set({
      employeeCount: toInsert.length,
      totalGrossSalary: String(Math.round(totals.grossSalary)),
      totalCnssEmployee: String(Math.round(totals.cnssEmployee)),
      totalCnssEmployer: String(Math.round(totals.cnssEmployer)),
      totalIrpp: String(Math.round(totals.irpp)),
      totalIpts: String(Math.round(totals.ipts)),
      totalNetSalary: String(Math.round(totals.netSalary)),
    }).where(eq(payrollRunsTable.id, run.id)).returning();

    res.json({ run: updated, count: toInsert.length });
  } catch (e) { next(e); }
});

router.post("/payroll/runs/:id/validate", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) { res.status(404).json({ error: "Cycle introuvable" }); return; }
    if (run.status !== "draft") { res.status(400).json({ error: "Seul un brouillon peut être validé" }); return; }

    const [updated] = await db.update(payrollRunsTable).set({
      status: "validated",
      validatedById: req.authUser!.id,
      validatedAt: new Date(),
    }).where(eq(payrollRunsTable.id, run.id)).returning();

    await db.update(payslipsTable).set({ status: "validated" })
      .where(eq(payslipsTable.payrollRunId, run.id));

    res.json(updated);
  } catch (e) { next(e); }
});

router.delete("/payroll/runs/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) { res.status(404).json({ error: "Cycle introuvable" }); return; }
    if (run.status !== "draft") { res.status(400).json({ error: "Impossible de supprimer un cycle non-brouillon" }); return; }
    await db.delete(payslipsTable).where(eq(payslipsTable.payrollRunId, run.id));
    await db.delete(payrollRunsTable).where(eq(payrollRunsTable.id, run.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// BULLETINS
// ──────────────────────────────────────────────────────────
router.get("/payroll/payslips", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { period, collaboratorId } = req.query as { period?: string; collaboratorId?: string };
    const conditions = [eq(payslipsTable.organizationId, orgId)];
    if (period) conditions.push(eq(payslipsTable.period, period));
    if (collaboratorId) conditions.push(eq(payslipsTable.collaboratorId, collaboratorId));

    const rows = await db
      .select({
        id: payslipsTable.id,
        payrollRunId: payslipsTable.payrollRunId,
        collaboratorId: payslipsTable.collaboratorId,
        period: payslipsTable.period,
        baseSalary: payslipsTable.baseSalary,
        grossSalary: payslipsTable.grossSalary,
        cnssEmployee: payslipsTable.cnssEmployee,
        cnssEmployer: payslipsTable.cnssEmployer,
        irpp: payslipsTable.irpp,
        ipts: payslipsTable.ipts,
        netSalary: payslipsTable.netSalary,
        status: payslipsTable.status,
        transportAllowance: payslipsTable.transportAllowance,
        housingAllowance: payslipsTable.housingAllowance,
        mealAllowance: payslipsTable.mealAllowance,
        additions: payslipsTable.additions,
        deductions: payslipsTable.deductions,
        collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
        collaboratorCode: collaboratorsTable.employeeNumber,
        department: collaboratorsTable.department,
      })
      .from(payslipsTable)
      .leftJoin(collaboratorsTable, eq(payslipsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...conditions))
      .orderBy(desc(payslipsTable.period), asc(collaboratorsTable.lastName));

    res.json(rows.map((p) => ({
      ...p,
      baseSalary: toNum(p.baseSalary),
      grossSalary: toNum(p.grossSalary),
      cnssEmployee: toNum(p.cnssEmployee),
      cnssEmployer: toNum(p.cnssEmployer),
      irpp: toNum(p.irpp),
      ipts: toNum(p.ipts),
      netSalary: toNum(p.netSalary),
      transportAllowance: toNum(p.transportAllowance),
      housingAllowance: toNum(p.housingAllowance),
      mealAllowance: toNum(p.mealAllowance),
    })));
  } catch (e) { next(e); }
});

router.get("/payroll/payslips/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [p] = await db
      .select({
        id: payslipsTable.id,
        payrollRunId: payslipsTable.payrollRunId,
        collaboratorId: payslipsTable.collaboratorId,
        period: payslipsTable.period,
        baseSalary: payslipsTable.baseSalary,
        grossSalary: payslipsTable.grossSalary,
        cnssEmployee: payslipsTable.cnssEmployee,
        cnssEmployer: payslipsTable.cnssEmployer,
        irpp: payslipsTable.irpp,
        ipts: payslipsTable.ipts,
        netSalary: payslipsTable.netSalary,
        status: payslipsTable.status,
        transportAllowance: payslipsTable.transportAllowance,
        housingAllowance: payslipsTable.housingAllowance,
        mealAllowance: payslipsTable.mealAllowance,
        additions: payslipsTable.additions,
        deductions: payslipsTable.deductions,
        notes: payslipsTable.notes,
        organizationId: payslipsTable.organizationId,
        collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
        collaboratorCode: collaboratorsTable.employeeNumber,
        department: collaboratorsTable.department,
        jobTitle: contractsTable.jobTitle,
        runStatus: payrollRunsTable.status,
      })
      .from(payslipsTable)
      .leftJoin(collaboratorsTable, eq(payslipsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(contractsTable, eq(payslipsTable.contractId, contractsTable.id))
      .leftJoin(payrollRunsTable, eq(payslipsTable.payrollRunId, payrollRunsTable.id))
      .where(and(eq(payslipsTable.organizationId, orgId), eq(payslipsTable.id, req.params.id)))
      .limit(1);
    if (!p) { res.status(404).json({ error: "Bulletin introuvable" }); return; }
    res.json({
      ...p,
      baseSalary: toNum(p.baseSalary),
      grossSalary: toNum(p.grossSalary),
      cnssEmployee: toNum(p.cnssEmployee),
      cnssEmployer: toNum(p.cnssEmployer),
      irpp: toNum(p.irpp),
      ipts: toNum(p.ipts),
      netSalary: toNum(p.netSalary),
      transportAllowance: toNum(p.transportAllowance),
      housingAllowance: toNum(p.housingAllowance),
      mealAllowance: toNum(p.mealAllowance),
    });
  } catch (e) { next(e); }
});

router.patch("/payroll/payslips/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [p] = await db.select().from(payslipsTable)
      .where(and(eq(payslipsTable.organizationId, orgId), eq(payslipsTable.id, req.params.id)))
      .limit(1);
    if (!p) { res.status(404).json({ error: "Bulletin introuvable" }); return; }
    if (p.status !== "draft") { res.status(400).json({ error: "Seul un bulletin brouillon peut être modifié" }); return; }
    const { notes, additions, deductions, transportAllowance, housingAllowance, mealAllowance } =
      req.body as { notes?: string; additions?: unknown[]; deductions?: unknown[]; transportAllowance?: number; housingAllowance?: number; mealAllowance?: number };

    const transport = transportAllowance ?? toNum(p.transportAllowance);
    const housing = housingAllowance ?? toNum(p.housingAllowance);
    const meal = mealAllowance ?? toNum(p.mealAllowance);
    const base = toNum(p.baseSalary);
    const addAmt = (additions ?? (p.additions as { amount: number }[]) ?? []).reduce((s: number, a: { amount: number }) => s + toNum(a.amount), 0);
    const gross = base + transport + housing + meal + addAmt;
    const { cnssEmployee, cnssEmployer, irpp, ipts, netSalary } = computePayslipAmounts(gross);

    const [updated] = await db.update(payslipsTable).set({
      notes,
      additions: additions as unknown as typeof p.additions ?? p.additions,
      deductions: deductions as unknown as typeof p.deductions ?? p.deductions,
      transportAllowance: String(transport),
      housingAllowance: String(housing),
      mealAllowance: String(meal),
      grossSalary: String(gross),
      cnssEmployee: String(cnssEmployee),
      cnssEmployer: String(cnssEmployer),
      irpp: String(irpp),
      ipts: String(ipts),
      netSalary: String(netSalary),
    }).where(eq(payslipsTable.id, p.id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// PDF — BULLETIN INDIVIDUEL
// GET /api/payroll/payslips/:id/pdf
// ──────────────────────────────────────────────────────────
router.get("/payroll/payslips/:id/pdf", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

    const [p] = await db
      .select({
        id: payslipsTable.id,
        payrollRunId: payslipsTable.payrollRunId,
        period: payslipsTable.period,
        baseSalary: payslipsTable.baseSalary,
        grossSalary: payslipsTable.grossSalary,
        cnssEmployee: payslipsTable.cnssEmployee,
        cnssEmployer: payslipsTable.cnssEmployer,
        irpp: payslipsTable.irpp,
        ipts: payslipsTable.ipts,
        netSalary: payslipsTable.netSalary,
        transportAllowance: payslipsTable.transportAllowance,
        housingAllowance: payslipsTable.housingAllowance,
        mealAllowance: payslipsTable.mealAllowance,
        additions: payslipsTable.additions,
        deductions: payslipsTable.deductions,
        status: payslipsTable.status,
        collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
        collaboratorCode: collaboratorsTable.employeeNumber,
        department: collaboratorsTable.department,
        jobTitle: contractsTable.jobTitle,
        paymentDate: payrollRunsTable.paymentDate,
      })
      .from(payslipsTable)
      .leftJoin(collaboratorsTable, eq(payslipsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(contractsTable, eq(payslipsTable.contractId, contractsTable.id))
      .leftJoin(payrollRunsTable, eq(payslipsTable.payrollRunId, payrollRunsTable.id))
      .where(and(eq(payslipsTable.organizationId, orgId), eq(payslipsTable.id, req.params.id)))
      .limit(1);

    if (!p) { res.status(404).json({ error: "Bulletin introuvable" }); return; }

    const [org] = await db
      .select({
        name: organizationsTable.name,
        legalName: organizationsTable.legalName,
        address: organizationsTable.address,
        taxId: organizationsTable.taxId,
        contactEmail: organizationsTable.contactEmail,
        contactPhone: organizationsTable.contactPhone,
        logoUrl: organizationsTable.logoUrl,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);

    const safeName = (p.collaboratorName ?? "bulletin").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `bulletin_${p.period}_${safeName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    generatePayslipPdf(
      {
        id: p.id,
        period: p.period,
        collaboratorName: p.collaboratorName ?? "—",
        collaboratorCode: p.collaboratorCode,
        department: p.department,
        jobTitle: p.jobTitle,
        baseSalary: toNum(p.baseSalary),
        transportAllowance: toNum(p.transportAllowance),
        housingAllowance: toNum(p.housingAllowance),
        mealAllowance: toNum(p.mealAllowance),
        additions: p.additions as { label: string; amount: number }[] | null,
        deductions: p.deductions as { label: string; amount: number }[] | null,
        grossSalary: toNum(p.grossSalary),
        cnssEmployee: toNum(p.cnssEmployee),
        cnssEmployer: toNum(p.cnssEmployer),
        irpp: toNum(p.irpp),
        ipts: toNum(p.ipts),
        netSalary: toNum(p.netSalary),
        paymentDate: p.paymentDate,
        status: p.status ?? "draft",
      },
      org ?? { name: "Organisation" },
      res,
    );
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// PDF ZIP — TOUS LES BULLETINS D'UN CYCLE
// GET /api/payroll/runs/:id/pdf-zip
// ──────────────────────────────────────────────────────────
router.get("/payroll/runs/:id/pdf-zip", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

    const [run] = await db.select().from(payrollRunsTable)
      .where(and(eq(payrollRunsTable.organizationId, orgId), eq(payrollRunsTable.id, req.params.id)))
      .limit(1);
    if (!run) { res.status(404).json({ error: "Cycle introuvable" }); return; }

    const payslips = await db
      .select({
        id: payslipsTable.id,
        period: payslipsTable.period,
        baseSalary: payslipsTable.baseSalary,
        grossSalary: payslipsTable.grossSalary,
        cnssEmployee: payslipsTable.cnssEmployee,
        cnssEmployer: payslipsTable.cnssEmployer,
        irpp: payslipsTable.irpp,
        ipts: payslipsTable.ipts,
        netSalary: payslipsTable.netSalary,
        transportAllowance: payslipsTable.transportAllowance,
        housingAllowance: payslipsTable.housingAllowance,
        mealAllowance: payslipsTable.mealAllowance,
        additions: payslipsTable.additions,
        deductions: payslipsTable.deductions,
        status: payslipsTable.status,
        collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
        collaboratorCode: collaboratorsTable.employeeNumber,
        department: collaboratorsTable.department,
        jobTitle: contractsTable.jobTitle,
      })
      .from(payslipsTable)
      .leftJoin(collaboratorsTable, eq(payslipsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(contractsTable, eq(payslipsTable.contractId, contractsTable.id))
      .where(eq(payslipsTable.payrollRunId, run.id))
      .orderBy(asc(collaboratorsTable.lastName));

    if (payslips.length === 0) {
      res.status(400).json({ error: "Aucun bulletin dans ce cycle" }); return;
    }

    const [org] = await db
      .select({
        name: organizationsTable.name,
        legalName: organizationsTable.legalName,
        address: organizationsTable.address,
        taxId: organizationsTable.taxId,
        contactEmail: organizationsTable.contactEmail,
        contactPhone: organizationsTable.contactPhone,
        logoUrl: organizationsTable.logoUrl,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);

    const zipFilename = `bulletins_paie_${run.period}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.pipe(res);

    archive.on("error", (err) => { next(err); });

    for (const p of payslips) {
      const safeName = (p.collaboratorName ?? "bulletin").replace(/[^a-zA-Z0-9_-]/g, "_");
      const pdfFilename = `bulletin_${p.period}_${safeName}.pdf`;

      const pass = new PassThrough();
      archive.append(pass, { name: pdfFilename });

      generatePayslipPdf(
        {
          id: p.id,
          period: p.period,
          collaboratorName: p.collaboratorName ?? "—",
          collaboratorCode: p.collaboratorCode,
          department: p.department,
          jobTitle: p.jobTitle,
          baseSalary: toNum(p.baseSalary),
          transportAllowance: toNum(p.transportAllowance),
          housingAllowance: toNum(p.housingAllowance),
          mealAllowance: toNum(p.mealAllowance),
          additions: p.additions as { label: string; amount: number }[] | null,
          deductions: p.deductions as { label: string; amount: number }[] | null,
          grossSalary: toNum(p.grossSalary),
          cnssEmployee: toNum(p.cnssEmployee),
          cnssEmployer: toNum(p.cnssEmployer),
          irpp: toNum(p.irpp),
          ipts: toNum(p.ipts),
          netSalary: toNum(p.netSalary),
          paymentDate: run.paymentDate,
          status: p.status ?? "draft",
        },
        org ?? { name: "Organisation" },
        pass,
      );
    }

    await archive.finalize();
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// LIVRE DE PAIE
// ──────────────────────────────────────────────────────────
router.get("/payroll/livre", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db
      .select({
        period: payrollRunsTable.period,
        status: payrollRunsTable.status,
        runId: payrollRunsTable.id,
        employeeCount: payrollRunsTable.employeeCount,
        totalGrossSalary: payrollRunsTable.totalGrossSalary,
        totalCnssEmployee: payrollRunsTable.totalCnssEmployee,
        totalCnssEmployer: payrollRunsTable.totalCnssEmployer,
        totalIrpp: payrollRunsTable.totalIrpp,
        totalIpts: payrollRunsTable.totalIpts,
        totalNetSalary: payrollRunsTable.totalNetSalary,
        paymentDate: payrollRunsTable.paymentDate,
      })
      .from(payrollRunsTable)
      .where(eq(payrollRunsTable.organizationId, orgId))
      .orderBy(desc(payrollRunsTable.period));

    res.json(rows.map((r) => ({
      ...r,
      totalGrossSalary: toNum(r.totalGrossSalary),
      totalCnssEmployee: toNum(r.totalCnssEmployee),
      totalCnssEmployer: toNum(r.totalCnssEmployer),
      totalIrpp: toNum(r.totalIrpp),
      totalIpts: toNum(r.totalIpts),
      totalNetSalary: toNum(r.totalNetSalary),
    })));
  } catch (e) { next(e); }
});

export default router;
