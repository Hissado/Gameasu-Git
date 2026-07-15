/**
 * Avances sur salaire
 *
 * GET    /api/hr/salary-advances          liste (org)
 * GET    /api/hr/salary-advances/my       mes avances (collaborateur connecté)
 * POST   /api/hr/salary-advances          créer une demande
 * GET    /api/hr/salary-advances/:id      détail
 * PATCH  /api/hr/salary-advances/:id      mettre à jour (draft seulement)
 * POST   /api/hr/salary-advances/:id/submit    soumettre pour approbation
 * POST   /api/hr/salary-advances/:id/approve   approuver
 * POST   /api/hr/salary-advances/:id/reject    rejeter
 * POST   /api/hr/salary-advances/:id/disburse  marquer comme décaissé
 * GET    /api/hr/salary-advances/:id/repayments  échéancier
 *
 * GET    /api/hr/salary-advance-policy    politique (plafonds)
 * PUT    /api/hr/salary-advance-policy    mettre à jour la politique
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  salaryAdvancesTable,
  salaryAdvanceRepaymentsTable,
  salaryAdvancePolicyTable,
  collaboratorsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, desc, asc, or } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const toNum = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

/** Génère l'échéancier de remboursement selon le mode choisi */
function buildRepaymentSchedule(
  advanceId: string,
  orgId: string,
  approvedAmount: number,
  targetPeriod: string,
  mode: string,
  months: number,
  customSchedule?: Array<{ period: string; amount: number }>,
): Array<typeof salaryAdvanceRepaymentsTable.$inferInsert> {
  if (mode === "single") {
    return [{
      organizationId: orgId,
      advanceId,
      period: targetPeriod,
      scheduledAmount: String(approvedAmount),
      status: "pending",
    }];
  }
  if (mode === "custom" && customSchedule?.length) {
    return customSchedule.map((s) => ({
      organizationId: orgId,
      advanceId,
      period: s.period,
      scheduledAmount: String(s.amount),
      status: "pending",
    }));
  }
  // mode "multi" — répartition uniforme sur N mois
  const perMonth = Math.round(approvedAmount / months);
  const [y, m] = targetPeriod.split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(y, m - 1 + i);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const amount = i === months - 1
      ? approvedAmount - perMonth * (months - 1) // solde exact sur la dernière mensualité
      : perMonth;
    return {
      organizationId: orgId,
      advanceId,
      period,
      scheduledAmount: String(amount),
      status: "pending",
    };
  });
}

// ─────────────────────────────────────────────────────────
// POLITIQUE
// ─────────────────────────────────────────────────────────
router.get("/hr/salary-advance-policy", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [policy] = await db.select().from(salaryAdvancePolicyTable)
      .where(eq(salaryAdvancePolicyTable.organizationId, orgId)).limit(1);
    if (!policy) {
      // Politique par défaut si non configurée
      res.json({
        maxPercentOfSalary: 50, maxAbsoluteAmount: 0, maxActiveAdvances: 1,
        maxRepaymentMonths: 6, minTenureMonths: 3,
        approvalWorkflow: "manager_then_hr", notifyHr: true, isActive: true,
      }); return;
    }
    res.json({ ...policy, maxAbsoluteAmount: toNum(policy.maxAbsoluteAmount) });
  } catch (e) { next(e); }
});

router.put("/hr/salary-advance-policy", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const {
      maxPercentOfSalary, maxAbsoluteAmount, maxActiveAdvances,
      maxRepaymentMonths, minTenureMonths, approvalWorkflow, notifyHr,
    } = req.body as Record<string, unknown>;

    const [existing] = await db.select({ id: salaryAdvancePolicyTable.id })
      .from(salaryAdvancePolicyTable)
      .where(eq(salaryAdvancePolicyTable.organizationId, orgId)).limit(1);

    const data = {
      organizationId: orgId,
      maxPercentOfSalary: Number(maxPercentOfSalary ?? 50),
      maxAbsoluteAmount: String(maxAbsoluteAmount ?? 0),
      maxActiveAdvances: Number(maxActiveAdvances ?? 1),
      maxRepaymentMonths: Number(maxRepaymentMonths ?? 6),
      minTenureMonths: Number(minTenureMonths ?? 3),
      approvalWorkflow: String(approvalWorkflow ?? "manager_then_hr"),
      notifyHr: Boolean(notifyHr ?? true),
      updatedById: userId,
    };

    if (existing) {
      const [updated] = await db.update(salaryAdvancePolicyTable)
        .set(data).where(eq(salaryAdvancePolicyTable.id, existing.id)).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(salaryAdvancePolicyTable).values(data).returning();
      res.json(created);
    }
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// LISTE — RH / Manager
// ─────────────────────────────────────────────────────────
router.get("/hr/salary-advances", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status, collaboratorId } = req.query as Record<string, string>;

    const conditions = [eq(salaryAdvancesTable.organizationId, orgId)];
    if (status) conditions.push(eq(salaryAdvancesTable.status, status));
    if (collaboratorId) conditions.push(eq(salaryAdvancesTable.collaboratorId, collaboratorId));

    const advances = await db.select({
      advance: salaryAdvancesTable,
      collaboratorFirstName: collaboratorsTable.firstName,
      collaboratorLastName: collaboratorsTable.lastName,
      collaboratorEmployeeNumber: collaboratorsTable.employeeNumber,
    })
      .from(salaryAdvancesTable)
      .leftJoin(collaboratorsTable, eq(salaryAdvancesTable.collaboratorId, collaboratorsTable.id))
      .where(and(...conditions))
      .orderBy(desc(salaryAdvancesTable.createdAt));

    res.json(advances.map(({ advance, collaboratorFirstName, collaboratorLastName, collaboratorEmployeeNumber }) => ({
      ...advance,
      requestedAmount: toNum(advance.requestedAmount),
      approvedAmount: toNum(advance.approvedAmount),
      remainingAmount: toNum(advance.remainingAmount),
      repaidAmount: toNum(advance.repaidAmount),
      collaboratorName: `${collaboratorFirstName ?? ""} ${collaboratorLastName ?? ""}`.trim(),
      employeeNumber: collaboratorEmployeeNumber,
    })));
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// MES AVANCES — Collaborateur connecté
// ─────────────────────────────────────────────────────────
router.get("/hr/salary-advances/my", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;

    const [collab] = await db.select({ id: collaboratorsTable.id })
      .from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.userId, userId)))
      .limit(1);

    if (!collab) { res.json([]); return; }

    const advances = await db.select().from(salaryAdvancesTable)
      .where(and(
        eq(salaryAdvancesTable.organizationId, orgId),
        eq(salaryAdvancesTable.collaboratorId, collab.id),
      ))
      .orderBy(desc(salaryAdvancesTable.createdAt));

    res.json(advances.map((a) => ({
      ...a,
      requestedAmount: toNum(a.requestedAmount),
      approvedAmount: toNum(a.approvedAmount),
      remainingAmount: toNum(a.remainingAmount),
      repaidAmount: toNum(a.repaidAmount),
    })));
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// CRÉER UNE DEMANDE
// ─────────────────────────────────────────────────────────
router.post("/hr/salary-advances", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const {
      collaboratorId, requestedAmount, targetPeriod,
      repaymentMode, repaymentMonths, repaymentSchedule, reason, attachments,
    } = req.body as {
      collaboratorId: string; requestedAmount: number; targetPeriod: string;
      repaymentMode?: string; repaymentMonths?: number;
      repaymentSchedule?: Array<{ period: string; amount: number }>;
      reason?: string; attachments?: unknown[];
    };

    if (!collaboratorId || !requestedAmount || !targetPeriod) {
      res.status(400).json({ error: "collaboratorId, requestedAmount et targetPeriod sont requis." }); return;
    }
    if (!/^\d{4}-\d{2}$/.test(targetPeriod)) {
      res.status(400).json({ error: "targetPeriod doit être au format YYYY-MM." }); return;
    }

    // Vérification de la politique
    const [policy] = await db.select().from(salaryAdvancePolicyTable)
      .where(eq(salaryAdvancePolicyTable.organizationId, orgId)).limit(1);

    if (policy) {
      // Compter les avances actives
      const activeAdvances = await db.select({ id: salaryAdvancesTable.id })
        .from(salaryAdvancesTable)
        .where(and(
          eq(salaryAdvancesTable.organizationId, orgId),
          eq(salaryAdvancesTable.collaboratorId, collaboratorId),
          // non fermées
          or(
            eq(salaryAdvancesTable.status, "approved"),
            eq(salaryAdvancesTable.status, "disbursed"),
            eq(salaryAdvancesTable.status, "pending_approval"),
          ),
        ));
      if (activeAdvances.length >= policy.maxActiveAdvances) {
        res.status(422).json({ error: `Plafond atteint : maximum ${policy.maxActiveAdvances} avance(s) active(s) simultanée(s).` }); return;
      }
      if (policy.maxAbsoluteAmount && Number(policy.maxAbsoluteAmount) > 0 && requestedAmount > Number(policy.maxAbsoluteAmount)) {
        res.status(422).json({ error: `Le montant dépasse le plafond absolu de ${policy.maxAbsoluteAmount} FCFA.` }); return;
      }
      const months = repaymentMode === "multi" ? (repaymentMonths ?? 1) : 1;
      if (months > policy.maxRepaymentMonths) {
        res.status(422).json({ error: `Remboursement limité à ${policy.maxRepaymentMonths} mensualités.` }); return;
      }
    }

    const [advance] = await db.insert(salaryAdvancesTable).values({
      organizationId: orgId,
      collaboratorId,
      requestedAmount: String(requestedAmount),
      targetPeriod,
      repaymentMode: repaymentMode ?? "single",
      repaymentMonths: repaymentMode === "multi" ? (repaymentMonths ?? 1) : 1,
      repaymentSchedule: repaymentSchedule ?? null,
      reason: reason ?? null,
      attachments: attachments ?? [],
      status: "draft",
      requestedById: userId,
      remainingAmount: String(requestedAmount),
      repaidAmount: "0",
    }).returning();

    res.status(201).json({ ...advance, requestedAmount: toNum(advance.requestedAmount) });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// DÉTAIL
// ─────────────────────────────────────────────────────────
router.get("/hr/salary-advances/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;

    const [advance] = await db.select({
      advance: salaryAdvancesTable,
      collaboratorFirstName: collaboratorsTable.firstName,
      collaboratorLastName: collaboratorsTable.lastName,
    })
      .from(salaryAdvancesTable)
      .leftJoin(collaboratorsTable, eq(salaryAdvancesTable.collaboratorId, collaboratorsTable.id))
      .where(and(eq(salaryAdvancesTable.id, id), eq(salaryAdvancesTable.organizationId, orgId)))
      .limit(1);

    if (!advance) { res.status(404).json({ error: "Avance introuvable." }); return; }

    const repayments = await db.select().from(salaryAdvanceRepaymentsTable)
      .where(eq(salaryAdvanceRepaymentsTable.advanceId, id))
      .orderBy(asc(salaryAdvanceRepaymentsTable.period));

    res.json({
      ...advance.advance,
      requestedAmount: toNum(advance.advance.requestedAmount),
      approvedAmount: toNum(advance.advance.approvedAmount),
      remainingAmount: toNum(advance.advance.remainingAmount),
      repaidAmount: toNum(advance.advance.repaidAmount),
      collaboratorName: `${advance.collaboratorFirstName ?? ""} ${advance.collaboratorLastName ?? ""}`.trim(),
      repayments: repayments.map((r) => ({ ...r, scheduledAmount: toNum(r.scheduledAmount), deductedAmount: toNum(r.deductedAmount) })),
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// SOUMETTRE POUR APPROBATION
// ─────────────────────────────────────────────────────────
router.post("/hr/salary-advances/:id/submit", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;

    const [existing] = await db.select().from(salaryAdvancesTable)
      .where(and(eq(salaryAdvancesTable.id, id), eq(salaryAdvancesTable.organizationId, orgId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Avance introuvable." }); return; }
    if (existing.status !== "draft") { res.status(422).json({ error: "Seule une avance en brouillon peut être soumise." }); return; }

    const [updated] = await db.update(salaryAdvancesTable)
      .set({ status: "pending_approval" })
      .where(eq(salaryAdvancesTable.id, id))
      .returning();
    res.json({ ...updated, requestedAmount: toNum(updated.requestedAmount) });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// APPROUVER
// ─────────────────────────────────────────────────────────
router.post("/hr/salary-advances/:id/approve", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const id = req.params.id as string;
    const { approvedAmount, notes, approvalSignature } = req.body as {
      approvedAmount?: number; notes?: string; approvalSignature?: string;
    };

    const [existing] = await db.select().from(salaryAdvancesTable)
      .where(and(eq(salaryAdvancesTable.id, id), eq(salaryAdvancesTable.organizationId, orgId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Avance introuvable." }); return; }
    if (existing.status !== "pending_approval") {
      res.status(422).json({ error: "Seule une avance en attente d'approbation peut être approuvée." }); return;
    }

    const finalAmount = approvedAmount ?? toNum(existing.requestedAmount);

    const [updated] = await db.update(salaryAdvancesTable)
      .set({
        status: "approved",
        approvedAmount: String(finalAmount),
        remainingAmount: String(finalAmount),
        approvedById: userId,
        approvedAt: new Date(),
        notes: notes ?? existing.notes,
        approvalSignature: approvalSignature ?? null,
      })
      .where(eq(salaryAdvancesTable.id, id))
      .returning();

    // Générer l'échéancier de remboursement
    const schedule = buildRepaymentSchedule(
      id, orgId, finalAmount,
      existing.targetPeriod,
      existing.repaymentMode ?? "single",
      existing.repaymentMonths ?? 1,
      existing.repaymentSchedule as Array<{ period: string; amount: number }> | undefined,
    );
    if (schedule.length > 0) {
      await db.insert(salaryAdvanceRepaymentsTable).values(schedule);
    }

    res.json({ ...updated, approvedAmount: toNum(updated.approvedAmount), remainingAmount: toNum(updated.remainingAmount) });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// REJETER
// ─────────────────────────────────────────────────────────
router.post("/hr/salary-advances/:id/reject", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const id = req.params.id as string;
    const { rejectionNote } = req.body as { rejectionNote?: string };

    const [existing] = await db.select().from(salaryAdvancesTable)
      .where(and(eq(salaryAdvancesTable.id, id), eq(salaryAdvancesTable.organizationId, orgId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Avance introuvable." }); return; }
    if (!["pending_approval", "draft"].includes(existing.status)) {
      res.status(422).json({ error: "Cette avance ne peut plus être rejetée." }); return;
    }

    const [updated] = await db.update(salaryAdvancesTable)
      .set({ status: "rejected", rejectedById: userId, rejectedAt: new Date(), rejectionNote: rejectionNote ?? null })
      .where(eq(salaryAdvancesTable.id, id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// MARQUER COMME DÉCAISSÉ
// ─────────────────────────────────────────────────────────
router.post("/hr/salary-advances/:id/disburse", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const id = req.params.id as string;

    const [existing] = await db.select().from(salaryAdvancesTable)
      .where(and(eq(salaryAdvancesTable.id, id), eq(salaryAdvancesTable.organizationId, orgId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Avance introuvable." }); return; }
    if (existing.status !== "approved") {
      res.status(422).json({ error: "Seule une avance approuvée peut être décaissée." }); return;
    }

    const [updated] = await db.update(salaryAdvancesTable)
      .set({ status: "disbursed", disbursedAt: new Date(), disbursedById: userId })
      .where(eq(salaryAdvancesTable.id, id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────
// ÉCHÉANCIER
// ─────────────────────────────────────────────────────────
router.get("/hr/salary-advances/:id/repayments", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const id = req.params.id as string;
    const repayments = await db.select().from(salaryAdvanceRepaymentsTable)
      .where(and(
        eq(salaryAdvanceRepaymentsTable.advanceId, id),
        eq(salaryAdvanceRepaymentsTable.organizationId, orgId),
      ))
      .orderBy(asc(salaryAdvanceRepaymentsTable.period));
    res.json(repayments.map((r) => ({ ...r, scheduledAmount: toNum(r.scheduledAmount), deductedAmount: toNum(r.deductedAmount) })));
  } catch (e) { next(e); }
});

export default router;
