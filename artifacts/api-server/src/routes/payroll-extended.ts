/**
 * Paie étendue :
 *  #8  Paie hors-cycle (prime/acompte/régularisation)
 *  #9  Tranches IRPP paramétrables + exonérations
 *  #14 Ordres de virement bancaire
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  offCyclePaymentsTable,
  irppBracketsTable,
  taxExemptionsTable,
  bankTransferOrdersTable,
  collaboratorsTable,
  payrollRunsTable,
  payslipsTable,
} from "@workspace/db";
import { and, eq, desc, asc, sql } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { z } from "zod/v4";

const router = Router();
router.use(requireAuth);

const toNum = (v: unknown) => (v == null ? 0 : Number(v));

// ─────────────────────────────────────────────────────────
// IRPP par défaut Togo (barème annuel XOF)
// ─────────────────────────────────────────────────────────
const DEFAULT_BRACKETS = [
  { fromAmount: 0, toAmount: 900_000, rate: 0 },
  { fromAmount: 900_000, toAmount: 1_500_000, rate: 0.07 },
  { fromAmount: 1_500_000, toAmount: 2_500_000, rate: 0.11 },
  { fromAmount: 2_500_000, toAmount: 4_000_000, rate: 0.15 },
  { fromAmount: 4_000_000, toAmount: 6_000_000, rate: 0.20 },
  { fromAmount: 6_000_000, toAmount: 10_000_000, rate: 0.25 },
  { fromAmount: 10_000_000, toAmount: null, rate: 0.35 },
];

// ══════════════════════════════════════════════════════════
// #9 — TRANCHES IRPP
// ══════════════════════════════════════════════════════════
router.get("/payroll/irpp-brackets", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(irppBracketsTable)
      .where(and(eq(irppBracketsTable.organizationId, orgId), eq(irppBracketsTable.isActive, true)))
      .orderBy(asc(irppBracketsTable.sortOrder));
    if (rows.length === 0) {
      return res.json({ brackets: DEFAULT_BRACKETS, isDefault: true });
    }
    res.json({
      brackets: rows.map(r => ({
        ...r,
        fromAmount: toNum(r.fromAmount),
        toAmount: r.toAmount != null ? toNum(r.toAmount) : null,
        rate: toNum(r.rate),
      })),
      isDefault: false,
    });
  } catch (e) { next(e); }
});

router.post("/payroll/irpp-brackets", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { brackets } = z.object({ brackets: z.array(z.object({
      fromAmount: z.number(),
      toAmount: z.number().nullable().optional(),
      rate: z.number(),
      sortOrder: z.number().optional(),
    })) }).parse(req.body);
    // Remplace toutes les tranches existantes
    await db.delete(irppBracketsTable).where(eq(irppBracketsTable.organizationId, orgId));
    const rows = await db.insert(irppBracketsTable).values(
      brackets.map((b, i) => ({
        organizationId: orgId,
        fromAmount: String(b.fromAmount),
        toAmount: b.toAmount != null ? String(b.toAmount) : null,
        rate: String(b.rate),
        sortOrder: b.sortOrder ?? i,
      }))
    ).returning();
    res.json(rows);
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════
// #9 — EXONÉRATIONS FISCALES
// ══════════════════════════════════════════════════════════
router.get("/payroll/tax-exemptions", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db
      .select({
        id: taxExemptionsTable.id,
        organizationId: taxExemptionsTable.organizationId,
        collaboratorId: taxExemptionsTable.collaboratorId,
        exemptionType: taxExemptionsTable.exemptionType,
        fixedAmount: taxExemptionsTable.fixedAmount,
        percentage: taxExemptionsTable.percentage,
        reason: taxExemptionsTable.reason,
        startDate: taxExemptionsTable.startDate,
        endDate: taxExemptionsTable.endDate,
        isActive: taxExemptionsTable.isActive,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
      })
      .from(taxExemptionsTable)
      .leftJoin(collaboratorsTable, eq(taxExemptionsTable.collaboratorId, collaboratorsTable.id))
      .where(eq(taxExemptionsTable.organizationId, orgId))
      .orderBy(desc(taxExemptionsTable.isActive));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/payroll/tax-exemptions", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      collaboratorId: z.string().uuid().nullable().optional(),
      exemptionType: z.enum(["irpp", "cnss", "ipts", "all"]),
      fixedAmount: z.number().nullable().optional(),
      percentage: z.number().nullable().optional(),
      reason: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const [row] = await db.insert(taxExemptionsTable).values({
      organizationId: orgId,
      collaboratorId: body.collaboratorId ?? null,
      exemptionType: body.exemptionType,
      fixedAmount: body.fixedAmount != null ? String(body.fixedAmount) : null,
      percentage: body.percentage != null ? String(body.percentage) : null,
      reason: body.reason,
      startDate: body.startDate,
      endDate: body.endDate,
      createdById: req.authUser!.userId,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put("/payroll/tax-exemptions/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { id } = req.params;
    const body = z.object({
      exemptionType: z.enum(["irpp", "cnss", "ipts", "all"]).optional(),
      fixedAmount: z.number().nullable().optional(),
      percentage: z.number().nullable().optional(),
      reason: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const [row] = await db.update(taxExemptionsTable)
      .set({ ...body, fixedAmount: body.fixedAmount != null ? String(body.fixedAmount) : undefined, percentage: body.percentage != null ? String(body.percentage) : undefined })
      .where(and(eq(taxExemptionsTable.id, id), eq(taxExemptionsTable.organizationId, orgId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/payroll/tax-exemptions/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(taxExemptionsTable).where(and(eq(taxExemptionsTable.id, req.params.id), eq(taxExemptionsTable.organizationId, orgId)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════
// #8 — PAIE HORS-CYCLE
// ══════════════════════════════════════════════════════════
router.get("/payroll/off-cycle", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { period, status, collaboratorId } = req.query as Record<string, string>;
    const filters = [eq(offCyclePaymentsTable.organizationId, orgId)];
    if (period) filters.push(eq(offCyclePaymentsTable.period, period));
    if (status) filters.push(eq(offCyclePaymentsTable.status, status));
    if (collaboratorId) filters.push(eq(offCyclePaymentsTable.collaboratorId, collaboratorId));

    const rows = await db
      .select({
        id: offCyclePaymentsTable.id,
        type: offCyclePaymentsTable.type,
        label: offCyclePaymentsTable.label,
        amount: offCyclePaymentsTable.amount,
        netAmount: offCyclePaymentsTable.netAmount,
        irpp: offCyclePaymentsTable.irpp,
        cnssEmployee: offCyclePaymentsTable.cnssEmployee,
        currency: offCyclePaymentsTable.currency,
        period: offCyclePaymentsTable.period,
        paymentDate: offCyclePaymentsTable.paymentDate,
        status: offCyclePaymentsTable.status,
        reason: offCyclePaymentsTable.reason,
        notes: offCyclePaymentsTable.notes,
        collaboratorId: offCyclePaymentsTable.collaboratorId,
        approvedAt: offCyclePaymentsTable.approvedAt,
        paidAt: offCyclePaymentsTable.paidAt,
        createdAt: offCyclePaymentsTable.createdAt,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        poste: collaboratorsTable.poste,
      })
      .from(offCyclePaymentsTable)
      .leftJoin(collaboratorsTable, eq(offCyclePaymentsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...filters))
      .orderBy(desc(offCyclePaymentsTable.createdAt));

    // Totaux par type
    const totals = rows.reduce((acc: Record<string, number>, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + toNum(r.amount);
      acc._total = (acc._total ?? 0) + toNum(r.amount);
      return acc;
    }, {});

    res.json({ items: rows.map(r => ({ ...r, amount: toNum(r.amount), netAmount: toNum(r.netAmount), irpp: toNum(r.irpp), cnssEmployee: toNum(r.cnssEmployee) })), totals });
  } catch (e) { next(e); }
});

router.post("/payroll/off-cycle", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      collaboratorId: z.string().uuid(),
      type: z.enum(["prime", "acompte", "regularisation", "indemnite", "autre"]),
      label: z.string(),
      amount: z.number().positive(),
      period: z.string().regex(/^\d{4}-\d{2}$/),
      paymentDate: z.string().optional(),
      reason: z.string().optional(),
      notes: z.string().optional(),
      payrollRunId: z.string().uuid().optional(),
    }).parse(req.body);

    // Calcul fiscal simplifié (prime est soumise à IRPP + CNSS + IPTS)
    const cnssEmployee = Math.round(body.amount * 0.04);
    const irppMensuel = Math.round((body.amount * 12 * 0.15) / 12); // approx 15% marginal
    const ipts = Math.round(body.amount * 0.02);
    const netAmount = body.amount - cnssEmployee - irppMensuel - ipts;

    const [row] = await db.insert(offCyclePaymentsTable).values({
      organizationId: orgId,
      collaboratorId: body.collaboratorId,
      type: body.type,
      label: body.label,
      amount: String(body.amount),
      period: body.period,
      paymentDate: body.paymentDate,
      reason: body.reason,
      notes: body.notes,
      payrollRunId: body.payrollRunId,
      irpp: String(irppMensuel),
      cnssEmployee: String(cnssEmployee),
      netAmount: String(netAmount),
      createdById: req.authUser!.userId,
    }).returning();
    res.status(201).json({ ...row, amount: toNum(row.amount), netAmount: toNum(row.netAmount) });
  } catch (e) { next(e); }
});

router.patch("/payroll/off-cycle/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      label: z.string().optional(),
      amount: z.number().optional(),
      paymentDate: z.string().optional(),
      reason: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const [row] = await db.update(offCyclePaymentsTable)
      .set({ ...body, amount: body.amount != null ? String(body.amount) : undefined })
      .where(and(eq(offCyclePaymentsTable.id, req.params.id), eq(offCyclePaymentsTable.organizationId, orgId), eq(offCyclePaymentsTable.status, "draft")))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé ou non modifiable" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/payroll/off-cycle/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(offCyclePaymentsTable)
      .where(and(eq(offCyclePaymentsTable.id, req.params.id), eq(offCyclePaymentsTable.organizationId, orgId), eq(offCyclePaymentsTable.status, "draft")));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post("/payroll/off-cycle/:id/approve", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.update(offCyclePaymentsTable)
      .set({ status: "approved", approvedById: req.authUser!.userId, approvedAt: new Date() })
      .where(and(eq(offCyclePaymentsTable.id, req.params.id), eq(offCyclePaymentsTable.organizationId, orgId), eq(offCyclePaymentsTable.status, "draft")))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé ou déjà approuvé" });
    res.json(row);
  } catch (e) { next(e); }
});

router.post("/payroll/off-cycle/:id/pay", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.update(offCyclePaymentsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(and(eq(offCyclePaymentsTable.id, req.params.id), eq(offCyclePaymentsTable.organizationId, orgId), eq(offCyclePaymentsTable.status, "approved")))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé ou non approuvé" });
    res.json(row);
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════
// #14 — ORDRES DE VIREMENT BANCAIRE
// ══════════════════════════════════════════════════════════
router.get("/payroll/transfer-orders", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(bankTransferOrdersTable)
      .where(eq(bankTransferOrdersTable.organizationId, orgId))
      .orderBy(desc(bankTransferOrdersTable.createdAt));
    res.json(rows.map(r => ({ ...r, totalAmount: toNum(r.totalAmount) })));
  } catch (e) { next(e); }
});

router.post("/payroll/transfer-orders", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      payrollRunId: z.string().uuid().optional(),
      reference: z.string(),
      totalAmount: z.number(),
      transferLines: z.array(z.object({
        collaboratorId: z.string(),
        name: z.string(),
        iban: z.string().optional(),
        amount: z.number(),
      })).optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const [row] = await db.insert(bankTransferOrdersTable).values({
      organizationId: orgId,
      payrollRunId: body.payrollRunId,
      reference: body.reference,
      totalAmount: String(body.totalAmount),
      transferLines: body.transferLines ?? [],
      notes: body.notes,
      createdById: req.authUser!.userId,
    }).returning();
    res.status(201).json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

router.patch("/payroll/transfer-orders/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      status: z.enum(["pending", "processing", "submitted", "completed", "failed", "cancelled"]).optional(),
      bankReference: z.string().optional(),
      errorMessage: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const updates: Record<string, unknown> = { ...body };
    if (body.status === "submitted") updates.submittedAt = new Date();
    if (body.status === "completed") updates.completedAt = new Date();
    const [row] = await db.update(bankTransferOrdersTable)
      .set(updates)
      .where(and(eq(bankTransferOrdersTable.id, req.params.id), eq(bankTransferOrdersTable.organizationId, orgId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

// Helper : génère les lignes de virement depuis un run (payslips + infos bancaires collaborateurs)
async function buildTransferLines(runId: string, orgId: string) {
  const payslips = await db.select({
    collaboratorId: payslipsTable.collaboratorId,
    netSalary: payslipsTable.netSalary,
  }).from(payslipsTable).where(eq(payslipsTable.payrollRunId, runId));

  const collabs = await db.select({
    id: collaboratorsTable.id,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    bankName: collaboratorsTable.bankName,
    bankCode: collaboratorsTable.bankCode,
    bankAccountNumber: collaboratorsTable.bankAccountNumber,
  }).from(collaboratorsTable).where(eq(collaboratorsTable.organizationId, orgId));
  const collabMap = Object.fromEntries(collabs.map(c => [c.id, c]));

  return payslips.map(p => {
    const c = collabMap[p.collaboratorId];
    return {
      collaboratorId: p.collaboratorId,
      name: c ? `${c.firstName} ${c.lastName}` : "—",
      iban: c?.bankAccountNumber ?? "",
      bankName: c?.bankName ?? "",
      bankCode: c?.bankCode ?? "",
      amount: toNum(p.netSalary),
    };
  });
}

// Générer ordre de virement depuis un run validé (alias legacy)
router.post("/payroll/runs/:id/generate-transfer", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const run = await db.query.payrollRunsTable.findFirst({ where: and(eq(payrollRunsTable.id, req.params.id), eq(payrollRunsTable.organizationId, orgId)) });
    if (!run) return res.status(404).json({ error: "Run non trouvé" });
    if (run.status !== "validated" && run.status !== "paid") return res.status(400).json({ error: "Le run doit être validé" });

    const lines = await buildTransferLines(run.id, orgId);
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const ref = `VIR-${run.period}-${Date.now().toString(36).toUpperCase()}`;
    const [order] = await db.insert(bankTransferOrdersTable).values({
      organizationId: orgId,
      payrollRunId: run.id,
      reference: ref,
      totalAmount: String(total),
      transferLines: lines,
      createdById: req.authUser!.userId,
    }).returning();
    res.status(201).json({ ...order, totalAmount: toNum(order.totalAmount) });
  } catch (e) { next(e); }
});

// POST /api/payroll/runs/:id/bank-transfer-order — endpoint canonique BCEAO/UEMOA
router.post("/payroll/runs/:id/bank-transfer-order", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const run = await db.query.payrollRunsTable.findFirst({
      where: and(eq(payrollRunsTable.id, req.params.id), eq(payrollRunsTable.organizationId, orgId)),
    });
    if (!run) return res.status(404).json({ error: "Cycle de paie introuvable" });
    if (run.status !== "validated" && run.status !== "paid") {
      return res.status(400).json({ error: "Le cycle de paie doit être validé pour générer un ordre de virement" });
    }

    const body = z.object({
      notes: z.string().optional(),
    }).optional().parse(req.body ?? {}) ?? {};

    const lines = await buildTransferLines(run.id, orgId);
    if (lines.length === 0) {
      return res.status(400).json({ error: "Aucun bulletin de paie trouvé pour ce cycle" });
    }
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const ref = `VIR-BCEAO-${run.period}-${Date.now().toString(36).toUpperCase()}`;

    const [order] = await db.insert(bankTransferOrdersTable).values({
      organizationId: orgId,
      payrollRunId: run.id,
      reference: ref,
      totalAmount: String(total),
      currency: "XOF",
      transferLines: lines,
      notes: body.notes ?? `Salaires ${run.period} — ${lines.length} bénéficiaire(s)`,
      createdById: req.authUser!.userId,
    }).returning();

    res.status(201).json({ ...order, totalAmount: toNum(order.totalAmount) });
  } catch (e) { next(e); }
});

// GET /api/payroll/transfer-orders/:id/export.csv — export CSV format BCEAO/UEMOA
router.get("/payroll/transfer-orders/:id/export.csv", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [order] = await db.select().from(bankTransferOrdersTable)
      .where(and(eq(bankTransferOrdersTable.id, req.params.id), eq(bankTransferOrdersTable.organizationId, orgId)));
    if (!order) return res.status(404).json({ error: "Ordre de virement introuvable" });

    const lines = (order.transferLines as Array<{
      collaboratorId: string; name: string; iban?: string;
      bankName?: string; bankCode?: string; amount: number;
    }>) ?? [];

    // Récupérer la période depuis le run lié
    let period = "";
    if (order.payrollRunId) {
      const [run] = await db.select({ period: payrollRunsTable.period })
        .from(payrollRunsTable).where(eq(payrollRunsTable.id, order.payrollRunId));
      period = run?.period ?? "";
    }

    const motif = period ? `Salaires ${period}` : "Virement de salaires";

    // Générer CSV — format attendu par ECOBANK/UTB/BIA Togo
    const csvRows: string[] = [
      // En-tête
      ["Référence ordre", "IBAN / N° compte", "Code banque", "Établissement", "Nom bénéficiaire", "Montant net (XOF)", "Devise", "Motif"].join(";"),
    ];

    for (const l of lines) {
      csvRows.push([
        order.reference,
        l.iban ?? "",
        (l as { bankCode?: string }).bankCode ?? "",
        (l as { bankName?: string }).bankName ?? "",
        l.name,
        String(Math.round(l.amount)),
        "XOF",
        motif,
      ].join(";"));
    }

    // Ligne total
    csvRows.push([
      "", "", "", "",
      "TOTAL",
      String(Math.round(toNum(order.totalAmount))),
      "XOF",
      "",
    ].join(";"));

    const csvContent = "\uFEFF" + csvRows.join("\r\n"); // BOM UTF-8 pour Excel
    const filename = `${order.reference}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (e) { next(e); }
});

// GET /api/payroll/transfer-orders/:id/export.xlsx — export XLS format BCEAO/UEMOA
router.get("/payroll/transfer-orders/:id/export.xlsx", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [order] = await db.select().from(bankTransferOrdersTable)
      .where(and(eq(bankTransferOrdersTable.id, req.params.id), eq(bankTransferOrdersTable.organizationId, orgId)));
    if (!order) return res.status(404).json({ error: "Ordre de virement introuvable" });

    const lines = (order.transferLines as Array<{
      collaboratorId: string; name: string; iban?: string;
      bankName?: string; bankCode?: string; amount: number;
    }>) ?? [];

    let period = "";
    if (order.payrollRunId) {
      const [run] = await db.select({ period: payrollRunsTable.period })
        .from(payrollRunsTable).where(eq(payrollRunsTable.id, order.payrollRunId));
      period = run?.period ?? "";
    }
    const motif = period ? `Salaires ${period}` : "Virement de salaires";

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaméasù Plateforme";
    wb.created = new Date();

    const ws = wb.addWorksheet("Ordre de virement");

    // Titre
    ws.mergeCells("A1:H1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `Ordre de virement — ${order.reference}`;
    titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 30;

    // Sous-titre
    ws.mergeCells("A2:H2");
    const subCell = ws.getCell("A2");
    subCell.value = `Référence : ${order.reference}  |  Total : ${toNum(order.totalAmount).toLocaleString("fr-FR")} XOF  |  ${lines.length} bénéficiaire(s)`;
    subCell.font = { italic: true, size: 10 };
    subCell.alignment = { horizontal: "center" };

    ws.addRow([]);

    // En-tête colonnes
    const headerRow = ws.addRow(["Référence ordre", "IBAN / N° compte", "Code banque", "Établissement", "Nom bénéficiaire", "Montant net (XOF)", "Devise", "Motif"]);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
      cell.alignment = { horizontal: "center" };
      cell.border = { bottom: { style: "thin" } };
    });
    ws.getRow(4).height = 20;

    // Lignes de virement
    let rowIdx = 5;
    for (const l of lines) {
      const row = ws.addRow([
        order.reference,
        l.iban ?? "",
        (l as { bankCode?: string }).bankCode ?? "",
        (l as { bankName?: string }).bankName ?? "",
        l.name,
        Math.round(l.amount),
        "XOF",
        motif,
      ]);
      if (rowIdx % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6EE" } };
        });
      }
      const amountCell = row.getCell(6);
      amountCell.numFmt = '#,##0" XOF"';
      rowIdx++;
    }

    // Ligne total
    const totalRow = ws.addRow(["", "", "", "", "TOTAL", Math.round(toNum(order.totalAmount)), "XOF", ""]);
    totalRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2CC" } };
    });
    totalRow.getCell(6).numFmt = '#,##0" XOF"';

    // Largeurs
    ws.columns = [
      { width: 28 }, { width: 24 }, { width: 14 }, { width: 20 },
      { width: 28 }, { width: 20 }, { width: 10 }, { width: 30 },
    ];

    const filename = `${order.reference}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

export default router;
