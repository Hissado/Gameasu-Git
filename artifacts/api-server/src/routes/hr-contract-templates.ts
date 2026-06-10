/**
 * #10 — Génération automatique de contrats PDF depuis template
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { contractTemplatesTable, contractsTable, collaboratorsTable, positionsTable, departmentsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { z } from "zod/v4";
import PDFDocument from "pdfkit";

const router = Router();
router.use(requireAuth);

// ─── CRUD Templates ──────────────────────────────────────
router.get("/hr/contract-templates", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(contractTemplatesTable)
      .where(eq(contractTemplatesTable.organizationId, orgId))
      .orderBy(desc(contractTemplatesTable.updatedAt));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/hr/contract-templates", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      name: z.string(),
      contractType: z.string(),
      description: z.string().optional(),
      templateBody: z.string(),
      variables: z.array(z.object({ key: z.string(), label: z.string(), required: z.boolean().optional() })).optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    if (body.isDefault) {
      await db.update(contractTemplatesTable)
        .set({ isDefault: false })
        .where(and(eq(contractTemplatesTable.organizationId, orgId), eq(contractTemplatesTable.contractType, body.contractType)));
    }
    const [row] = await db.insert(contractTemplatesTable).values({
      organizationId: orgId,
      name: body.name,
      contractType: body.contractType,
      description: body.description,
      templateBody: body.templateBody,
      variables: body.variables ?? [],
      isDefault: body.isDefault ?? false,
      isActive: body.isActive ?? true,
      createdById: req.authUser!.userId,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/hr/contract-templates/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const row = await db.query.contractTemplatesTable.findFirst({
      where: and(eq(contractTemplatesTable.id, req.params.id), eq(contractTemplatesTable.organizationId, orgId)),
    });
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

router.put("/hr/contract-templates/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      name: z.string().optional(),
      contractType: z.string().optional(),
      description: z.string().optional(),
      templateBody: z.string().optional(),
      variables: z.array(z.object({ key: z.string(), label: z.string(), required: z.boolean().optional() })).optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const [row] = await db.update(contractTemplatesTable)
      .set({ ...body, version: db.query.contractTemplatesTable ? undefined : undefined })
      .where(and(eq(contractTemplatesTable.id, req.params.id), eq(contractTemplatesTable.organizationId, orgId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/hr/contract-templates/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(contractTemplatesTable)
      .where(and(eq(contractTemplatesTable.id, req.params.id), eq(contractTemplatesTable.organizationId, orgId)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── Génération PDF depuis template + contrat ─────────────
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `[${key}]`);
}

router.post("/hr/contracts/:id/generate-pdf", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { templateId } = z.object({ templateId: z.string().uuid().optional() }).parse(req.body);

    const contract = await db.query.contractsTable.findFirst({
      where: and(eq(contractsTable.id, req.params.id), eq(contractsTable.organizationId, orgId)),
    });
    if (!contract) return res.status(404).json({ error: "Contrat non trouvé" });

    const collab = await db.query.collaboratorsTable.findFirst({
      where: eq(collaboratorsTable.id, contract.collaboratorId),
    });

    let template = null;
    if (templateId) {
      template = await db.query.contractTemplatesTable.findFirst({
        where: and(eq(contractTemplatesTable.id, templateId), eq(contractTemplatesTable.organizationId, orgId)),
      });
    } else {
      const rows = await db.select().from(contractTemplatesTable)
        .where(and(eq(contractTemplatesTable.organizationId, orgId), eq(contractTemplatesTable.contractType, contract.type), eq(contractTemplatesTable.isDefault, true)));
      template = rows[0] ?? null;
    }

    const fullName = collab ? `${collab.firstName} ${collab.lastName}` : "N/A";
    const vars: Record<string, string> = {
      nom: collab?.lastName ?? "",
      prenom: collab?.firstName ?? "",
      nom_complet: fullName,
      poste: collab?.poste ?? "",
      date_debut: contract.startDate ? new Date(contract.startDate).toLocaleDateString("fr-FR") : "",
      date_fin: contract.endDate ? new Date(contract.endDate).toLocaleDateString("fr-FR") : "Indéterminée",
      salaire_mensuel: contract.monthlySalary ? `${Number(contract.monthlySalary).toLocaleString("fr-FR")} FCFA` : "",
      type_contrat: contract.type?.toUpperCase() ?? "",
      date_signature: new Date().toLocaleDateString("fr-FR"),
    };

    const bodyText = template
      ? interpolate(template.templateBody, vars)
      : `CONTRAT DE TRAVAIL — ${contract.type?.toUpperCase()}\n\nEntre les soussignés :\n\nL'employeur et ${fullName},\n\nIl est convenu ce qui suit :\n\nPoste : ${vars.poste}\nDate de début : ${vars.date_debut}\nSalaire mensuel brut : ${vars.salaire_mensuel}\n\nFait le ${vars.date_signature}`;

    const doc = new PDFDocument({ margin: 60, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="contrat-${contract.id}.pdf"`);
    doc.pipe(res);

    // En-tête
    doc.fontSize(16).font("Helvetica-Bold").text("CONTRAT DE TRAVAIL", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica").text(`Type : ${contract.type?.toUpperCase()}`, { align: "center" });
    doc.moveDown(1.5);
    doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(1);

    // Corps
    doc.fontSize(11).font("Helvetica").text(bodyText, { lineGap: 4 });
    doc.moveDown(2);

    // Zone de signature
    doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(1);
    doc.fontSize(10).text("Signature du collaborateur :", 60, doc.y);
    doc.text("Signature de l'employeur :", 320, doc.y - 12);
    doc.moveDown(2);
    doc.text("_________________________", 60);
    doc.text("_________________________", 320, doc.y - 12);

    doc.end();
  } catch (e) { next(e); }
});

export default router;
