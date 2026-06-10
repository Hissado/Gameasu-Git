/**
 * #13 Registre légal, #15 Signature électronique, #16 Déclarations fiscales, #17 Avantages sociaux
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  signatureRequestsTable,
  taxDeclarationsTable,
  benefitPlansTable,
  employeeBenefitsTable,
  collaboratorsTable,
  contractsTable,
  departmentsTable,
  positionsTable,
  payrollRunsTable,
  payslipsTable,
} from "@workspace/db";
import { and, eq, desc, asc, or, sql } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { z } from "zod/v4";
import { randomBytes } from "crypto";
import PDFDocument from "pdfkit";

const router = Router();
router.use(requireAuth);

const toNum = (v: unknown) => (v == null ? 0 : Number(v));
const formatFCFA = (v: number) => `${v.toLocaleString("fr-FR")} FCFA`;

// ══════════════════════════════════════════════════════════
// #13 — REGISTRE DU PERSONNEL LÉGAL
// ══════════════════════════════════════════════════════════
router.get("/hr/legal-register", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { format } = req.query as Record<string, string>;

    const collabs = await db
      .select({
        id: collaboratorsTable.id,
        matricule: collaboratorsTable.matricule,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        poste: collaboratorsTable.poste,
        gender: collaboratorsTable.gender,
        nationality: collaboratorsTable.nationality,
        birthDate: collaboratorsTable.birthDate,
        hireDate: collaboratorsTable.hireDate,
        endDate: collaboratorsTable.endDate,
        status: collaboratorsTable.status,
        department: departmentsTable.name,
      })
      .from(collaboratorsTable)
      .leftJoin(departmentsTable, eq(collaboratorsTable.departmentId, departmentsTable.id))
      .where(and(eq(collaboratorsTable.organizationId, orgId)))
      .orderBy(asc(collaboratorsTable.lastName));

    // Récupérer les contrats actifs
    const contracts = await db.select({
      collaboratorId: contractsTable.collaboratorId,
      type: contractsTable.type,
      startDate: contractsTable.startDate,
      endDate: contractsTable.endDate,
      status: contractsTable.status,
    }).from(contractsTable).where(and(eq(contractsTable.organizationId, orgId), eq(contractsTable.status, "active")));
    const contractMap: Record<string, (typeof contracts)[0]> = {};
    for (const c of contracts) contractMap[c.collaboratorId] = c;

    const data = collabs.map(c => ({
      ...c,
      contractType: contractMap[c.id]?.type ?? "—",
      contractStart: contractMap[c.id]?.startDate ?? null,
      contractEnd: contractMap[c.id]?.endDate ?? null,
    }));

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=registre-personnel.pdf");
      doc.pipe(res);
      doc.fontSize(14).font("Helvetica-Bold").text("REGISTRE DU PERSONNEL", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(9).font("Helvetica").text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, { align: "center" });
      doc.moveDown(1);
      const headers = ["Matricule", "Nom Prénom", "Poste", "Département", "Type contrat", "Entrée", "Sortie", "Nationalité"];
      const colWidths = [55, 120, 90, 80, 70, 60, 60, 75];
      let x = 40;
      doc.fontSize(8).font("Helvetica-Bold");
      headers.forEach((h, i) => { doc.text(h, x, doc.y, { width: colWidths[i], continued: i < headers.length - 1 }); x += colWidths[i]; });
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(800, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(7);
      for (const r of data) {
        let rowX = 40;
        const rowY = doc.y;
        const cols = [
          r.matricule ?? "—",
          `${r.lastName} ${r.firstName}`,
          r.poste ?? "—",
          r.department ?? "—",
          r.contractType,
          r.contractStart ? new Date(r.contractStart).toLocaleDateString("fr-FR") : "—",
          r.contractEnd ? new Date(r.contractEnd).toLocaleDateString("fr-FR") : "—",
          r.nationality ?? "—",
        ];
        cols.forEach((c, i) => {
          doc.text(String(c), rowX, rowY, { width: colWidths[i], continued: i < cols.length - 1 });
          rowX += colWidths[i];
        });
        doc.moveDown(0.5);
        if (doc.y > 520) { doc.addPage(); }
      }
      doc.end();
    } else {
      res.json({ items: data, total: data.length });
    }
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════
// #15 — SIGNATURE ÉLECTRONIQUE
// ══════════════════════════════════════════════════════════
router.get("/hr/signature-requests", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(signatureRequestsTable)
      .where(eq(signatureRequestsTable.organizationId, orgId))
      .orderBy(desc(signatureRequestsTable.createdAt));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/hr/signature-requests", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      documentType: z.string(),
      documentId: z.string().uuid().optional(),
      documentLabel: z.string(),
      signatoryId: z.string().uuid().optional(),
      signatoryEmail: z.string().email(),
      signatoryName: z.string(),
      expiresInDays: z.number().optional(),
    }).parse(req.body);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + (body.expiresInDays ?? 7) * 86400000);
    const [row] = await db.insert(signatureRequestsTable).values({
      organizationId: orgId,
      documentType: body.documentType,
      documentId: body.documentId,
      documentLabel: body.documentLabel,
      signatoryId: body.signatoryId,
      signatoryEmail: body.signatoryEmail,
      signatoryName: body.signatoryName,
      token,
      expiresAt,
      requestedById: req.authUser!.userId,
    }).returning();
    // En production : envoyer un email avec le lien /sign/:token
    res.status(201).json({ ...row, signLink: `/sign/${token}` });
  } catch (e) { next(e); }
});

router.patch("/hr/signature-requests/:token/sign", async (req, res, next) => {
  try {
    const body = z.object({
      signatureData: z.string().optional(),
      ipAddress: z.string().optional(),
    }).parse(req.body);
    const now = new Date();
    const [row] = await db.update(signatureRequestsTable)
      .set({ status: "signed", signedAt: now, signatureData: body.signatureData, ipAddress: body.ipAddress })
      .where(and(eq(signatureRequestsTable.token, req.params.token), eq(signatureRequestsTable.status, "pending"), sql`${signatureRequestsTable.expiresAt} > ${now.toISOString()}`))
      .returning();
    if (!row) return res.status(404).json({ error: "Lien invalide, déjà signé ou expiré" });
    res.json({ ok: true, message: "Document signé avec succès" });
  } catch (e) { next(e); }
});

router.patch("/hr/signature-requests/:id/cancel", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.update(signatureRequestsTable)
      .set({ status: "cancelled" })
      .where(and(eq(signatureRequestsTable.id, req.params.id), eq(signatureRequestsTable.organizationId, orgId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════
// #16 — DÉCLARATIONS FISCALES
// ══════════════════════════════════════════════════════════
router.get("/hr/tax-declarations", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { period, type } = req.query as Record<string, string>;
    const conditions = [eq(taxDeclarationsTable.organizationId, orgId)];
    if (period) conditions.push(eq(taxDeclarationsTable.period, period));
    if (type) conditions.push(eq(taxDeclarationsTable.type, type));
    const rows = await db.select().from(taxDeclarationsTable)
      .where(and(...conditions))
      .orderBy(desc(taxDeclarationsTable.period), desc(taxDeclarationsTable.createdAt));
    res.json(rows.map(r => ({ ...r, totalAmount: toNum(r.totalAmount) })));
  } catch (e) { next(e); }
});

router.post("/hr/tax-declarations", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      type: z.enum(["irpp", "cnss", "ipts", "tva", "is", "autre"]),
      period: z.string(),
      totalAmount: z.number().optional(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const [row] = await db.insert(taxDeclarationsTable).values({
      organizationId: orgId,
      type: body.type,
      period: body.period,
      totalAmount: String(body.totalAmount ?? 0),
      dueDate: body.dueDate,
      notes: body.notes,
      createdById: req.authUser!.userId,
    }).returning();
    res.status(201).json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

// Générer depuis le run de paie
router.post("/hr/tax-declarations/generate/:runId", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const run = await db.query.payrollRunsTable.findFirst({ where: and(eq(payrollRunsTable.id, req.params.runId), eq(payrollRunsTable.organizationId, orgId)) });
    if (!run) return res.status(404).json({ error: "Run non trouvé" });
    const declarations = [];
    const types: Array<{ type: "irpp" | "cnss" | "ipts"; amount: string | null | undefined }> = [
      { type: "irpp", amount: run.totalIrpp },
      { type: "cnss", amount: String((toNum(run.totalCnssEmployee) + toNum(run.totalCnssEmployer))) },
      { type: "ipts", amount: run.totalIpts },
    ];
    for (const { type, amount } of types) {
      const [row] = await db.insert(taxDeclarationsTable).values({
        organizationId: orgId,
        type,
        period: run.period,
        totalAmount: String(amount ?? 0),
        status: "generated",
        createdById: req.authUser!.userId,
        details: { payrollRunId: run.id },
      }).returning();
      declarations.push({ ...row, totalAmount: toNum(row.totalAmount) });
    }
    res.status(201).json(declarations);
  } catch (e) { next(e); }
});

router.patch("/hr/tax-declarations/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      status: z.enum(["draft", "generated", "submitted", "validated", "rejected"]).optional(),
      referenceNumber: z.string().optional(),
      totalAmount: z.number().optional(),
      dueDate: z.string().optional(),
      submittedAt: z.string().optional(),
      validatedAt: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const updates: Record<string, unknown> = {
      status: body.status,
      referenceNumber: body.referenceNumber,
      notes: body.notes,
      dueDate: body.dueDate,
      totalAmount: body.totalAmount != null ? String(body.totalAmount) : undefined,
    };
    if (body.status === "submitted") {
      updates.submittedAt = body.submittedAt ? new Date(body.submittedAt) : new Date();
    } else if (body.submittedAt) {
      updates.submittedAt = new Date(body.submittedAt);
    }
    if (body.status === "validated") {
      updates.validatedAt = body.validatedAt ? new Date(body.validatedAt) : new Date();
    } else if (body.validatedAt) {
      updates.validatedAt = new Date(body.validatedAt);
    }
    const [row] = await db.update(taxDeclarationsTable).set(updates)
      .where(and(eq(taxDeclarationsTable.id, req.params.id), eq(taxDeclarationsTable.organizationId, orgId))).returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════
// #17 — AVANTAGES SOCIAUX
// ══════════════════════════════════════════════════════════
router.get("/hr/benefits/plans", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const plans = await db.select().from(benefitPlansTable)
      .where(eq(benefitPlansTable.organizationId, orgId))
      .orderBy(asc(benefitPlansTable.type));
    // Compter les inscrits
    const enroll = await db.select({ planId: employeeBenefitsTable.benefitPlanId })
      .from(employeeBenefitsTable).where(and(eq(employeeBenefitsTable.organizationId, orgId), eq(employeeBenefitsTable.status, "active")));
    const countMap: Record<string, number> = {};
    for (const e of enroll) countMap[e.planId] = (countMap[e.planId] ?? 0) + 1;
    res.json(plans.map(p => ({ ...p, employeeContribution: toNum(p.employeeContribution), employerContribution: toNum(p.employerContribution), enrolledCount: countMap[p.id] ?? 0 })));
  } catch (e) { next(e); }
});

router.post("/hr/benefits/plans", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      name: z.string(),
      type: z.string(),
      provider: z.string().optional(),
      description: z.string().optional(),
      employeeContribution: z.number().optional(),
      employerContribution: z.number().optional(),
      contributionMode: z.enum(["fixed", "percentage"]).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const [row] = await db.insert(benefitPlansTable).values({
      organizationId: orgId,
      name: body.name,
      type: body.type,
      provider: body.provider,
      description: body.description,
      employeeContribution: String(body.employeeContribution ?? 0),
      employerContribution: String(body.employerContribution ?? 0),
      contributionMode: body.contributionMode ?? "fixed",
      isActive: body.isActive ?? true,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put("/hr/benefits/plans/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({ name: z.string().optional(), type: z.string().optional(), provider: z.string().optional(), description: z.string().optional(), employeeContribution: z.number().optional(), employerContribution: z.number().optional(), isActive: z.boolean().optional() }).parse(req.body);
    const updates = { ...body, employeeContribution: body.employeeContribution != null ? String(body.employeeContribution) : undefined, employerContribution: body.employerContribution != null ? String(body.employerContribution) : undefined };
    const [row] = await db.update(benefitPlansTable).set(updates).where(and(eq(benefitPlansTable.id, req.params.id), eq(benefitPlansTable.organizationId, orgId))).returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/hr/benefits/plans/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(benefitPlansTable).where(and(eq(benefitPlansTable.id, req.params.id), eq(benefitPlansTable.organizationId, orgId)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Inscriptions
router.get("/hr/benefits/enrollments", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db
      .select({
        id: employeeBenefitsTable.id,
        collaboratorId: employeeBenefitsTable.collaboratorId,
        benefitPlanId: employeeBenefitsTable.benefitPlanId,
        enrollmentDate: employeeBenefitsTable.enrollmentDate,
        endDate: employeeBenefitsTable.endDate,
        status: employeeBenefitsTable.status,
        notes: employeeBenefitsTable.notes,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        planName: benefitPlansTable.name,
        planType: benefitPlansTable.type,
      })
      .from(employeeBenefitsTable)
      .leftJoin(collaboratorsTable, eq(employeeBenefitsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(benefitPlansTable, eq(employeeBenefitsTable.benefitPlanId, benefitPlansTable.id))
      .where(eq(employeeBenefitsTable.organizationId, orgId))
      .orderBy(desc(employeeBenefitsTable.enrollmentDate));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/hr/benefits/enrollments", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      collaboratorId: z.string().uuid(),
      benefitPlanId: z.string().uuid(),
      enrollmentDate: z.string(),
      endDate: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const [row] = await db.insert(employeeBenefitsTable).values({
      organizationId: orgId,
      collaboratorId: body.collaboratorId,
      benefitPlanId: body.benefitPlanId,
      enrollmentDate: body.enrollmentDate,
      endDate: body.endDate,
      status: body.status ?? "active",
      notes: body.notes,
      createdById: req.authUser!.userId,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put("/hr/benefits/enrollments/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({ status: z.string().optional(), endDate: z.string().optional(), notes: z.string().optional() }).parse(req.body);
    const [row] = await db.update(employeeBenefitsTable).set(body).where(and(eq(employeeBenefitsTable.id, req.params.id), eq(employeeBenefitsTable.organizationId, orgId))).returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

export default router;
