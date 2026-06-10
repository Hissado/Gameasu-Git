/**
 * #11 — Onboarding digital : templates de checklist + processus par collaborateur
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  onboardingTemplatesTable,
  onboardingTemplateItemsTable,
  onboardingProcessesTable,
  onboardingProcessItemsTable,
  collaboratorsTable,
} from "@workspace/db";
import { and, eq, asc, desc } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { z } from "zod/v4";

const router = Router();
router.use(requireAuth);

// ─── TEMPLATES ───────────────────────────────────────────
router.get("/hr/onboarding/templates", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const templates = await db.select().from(onboardingTemplatesTable)
      .where(and(eq(onboardingTemplatesTable.organizationId, orgId), eq(onboardingTemplatesTable.isActive, true)))
      .orderBy(desc(onboardingTemplatesTable.createdAt));
    // Compter les items par template
    const itemCounts = await db.select({ templateId: onboardingTemplateItemsTable.templateId })
      .from(onboardingTemplateItemsTable);
    const countMap: Record<string, number> = {};
    for (const r of itemCounts) { countMap[r.templateId] = (countMap[r.templateId] ?? 0) + 1; }
    res.json(templates.map(t => ({ ...t, itemCount: countMap[t.id] ?? 0 })));
  } catch (e) { next(e); }
});

router.post("/hr/onboarding/templates", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      name: z.string(),
      description: z.string().optional(),
      targetRole: z.string().optional(),
      isDefault: z.boolean().optional(),
    }).parse(req.body);
    const [row] = await db.insert(onboardingTemplatesTable).values({
      organizationId: orgId,
      name: body.name,
      description: body.description,
      targetRole: body.targetRole,
      isDefault: body.isDefault ?? false,
      createdById: req.authUser!.userId,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/hr/onboarding/templates/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const tpl = await db.query.onboardingTemplatesTable.findFirst({
      where: and(eq(onboardingTemplatesTable.id, req.params.id), eq(onboardingTemplatesTable.organizationId, orgId)),
    });
    if (!tpl) return res.status(404).json({ error: "Non trouvé" });
    const items = await db.select().from(onboardingTemplateItemsTable)
      .where(eq(onboardingTemplateItemsTable.templateId, tpl.id))
      .orderBy(asc(onboardingTemplateItemsTable.sortOrder));
    res.json({ ...tpl, items });
  } catch (e) { next(e); }
});

router.put("/hr/onboarding/templates/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({ name: z.string().optional(), description: z.string().optional(), targetRole: z.string().optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional() }).parse(req.body);
    const [row] = await db.update(onboardingTemplatesTable).set(body)
      .where(and(eq(onboardingTemplatesTable.id, req.params.id), eq(onboardingTemplatesTable.organizationId, orgId))).returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/hr/onboarding/templates/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(onboardingTemplatesTable).where(and(eq(onboardingTemplatesTable.id, req.params.id), eq(onboardingTemplatesTable.organizationId, orgId)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── TEMPLATE ITEMS ──────────────────────────────────────
router.post("/hr/onboarding/templates/:id/items", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const tpl = await db.query.onboardingTemplatesTable.findFirst({ where: and(eq(onboardingTemplatesTable.id, req.params.id), eq(onboardingTemplatesTable.organizationId, orgId)) });
    if (!tpl) return res.status(404).json({ error: "Template non trouvé" });
    const body = z.object({
      title: z.string(),
      description: z.string().optional(),
      assignedTo: z.string().optional(),
      category: z.string().optional(),
      dueAfterDays: z.number().optional(),
      isRequired: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }).parse(req.body);
    const [row] = await db.insert(onboardingTemplateItemsTable).values({ templateId: tpl.id, ...body }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put("/hr/onboarding/template-items/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().optional(), description: z.string().optional(), assignedTo: z.string().optional(), category: z.string().optional(), dueAfterDays: z.number().optional(), isRequired: z.boolean().optional(), sortOrder: z.number().optional() }).parse(req.body);
    const [row] = await db.update(onboardingTemplateItemsTable).set(body).where(eq(onboardingTemplateItemsTable.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/hr/onboarding/template-items/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    await db.delete(onboardingTemplateItemsTable).where(eq(onboardingTemplateItemsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── PROCESSUS ────────────────────────────────────────────
router.get("/hr/onboarding/processes", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db
      .select({
        id: onboardingProcessesTable.id,
        collaboratorId: onboardingProcessesTable.collaboratorId,
        templateId: onboardingProcessesTable.templateId,
        startDate: onboardingProcessesTable.startDate,
        targetCompletionDate: onboardingProcessesTable.targetCompletionDate,
        status: onboardingProcessesTable.status,
        completedAt: onboardingProcessesTable.completedAt,
        notes: onboardingProcessesTable.notes,
        createdAt: onboardingProcessesTable.createdAt,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        poste: collaboratorsTable.poste,
        avatarUrl: collaboratorsTable.avatarUrl,
      })
      .from(onboardingProcessesTable)
      .leftJoin(collaboratorsTable, eq(onboardingProcessesTable.collaboratorId, collaboratorsTable.id))
      .where(eq(onboardingProcessesTable.organizationId, orgId))
      .orderBy(desc(onboardingProcessesTable.createdAt));

    // Calcul du taux de complétion par process
    const items = await db.select({ processId: onboardingProcessItemsTable.processId, status: onboardingProcessItemsTable.status })
      .from(onboardingProcessItemsTable);
    const itemMap: Record<string, { total: number; done: number }> = {};
    for (const i of items) {
      if (!itemMap[i.processId]) itemMap[i.processId] = { total: 0, done: 0 };
      itemMap[i.processId].total++;
      if (i.status === "completed") itemMap[i.processId].done++;
    }
    res.json(rows.map(r => ({
      ...r,
      progress: itemMap[r.id] ? Math.round((itemMap[r.id].done / itemMap[r.id].total) * 100) : 0,
      totalItems: itemMap[r.id]?.total ?? 0,
      doneItems: itemMap[r.id]?.done ?? 0,
    })));
  } catch (e) { next(e); }
});

router.post("/hr/onboarding/processes", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      collaboratorId: z.string().uuid(),
      templateId: z.string().uuid().optional(),
      startDate: z.string(),
      targetCompletionDate: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const [process] = await db.insert(onboardingProcessesTable).values({
      organizationId: orgId,
      collaboratorId: body.collaboratorId,
      templateId: body.templateId,
      startDate: body.startDate,
      targetCompletionDate: body.targetCompletionDate,
      notes: body.notes,
      createdById: req.authUser!.userId,
    }).returning();

    // Créer les items depuis le template si fourni
    if (body.templateId) {
      const templateItems = await db.select().from(onboardingTemplateItemsTable)
        .where(eq(onboardingTemplateItemsTable.templateId, body.templateId))
        .orderBy(asc(onboardingTemplateItemsTable.sortOrder));
      if (templateItems.length > 0) {
        const startDate = new Date(body.startDate);
        await db.insert(onboardingProcessItemsTable).values(
          templateItems.map(item => ({
            processId: process.id,
            title: item.title,
            description: item.description,
            assignedTo: item.assignedTo,
            category: item.category,
            dueDate: item.dueAfterDays ? new Date(startDate.getTime() + item.dueAfterDays * 86400000).toISOString().split("T")[0] : null,
            isRequired: item.isRequired,
            sortOrder: item.sortOrder,
          }))
        );
      }
    }
    res.status(201).json(process);
  } catch (e) { next(e); }
});

router.get("/hr/onboarding/processes/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const process = await db.query.onboardingProcessesTable.findFirst({
      where: and(eq(onboardingProcessesTable.id, req.params.id), eq(onboardingProcessesTable.organizationId, orgId)),
    });
    if (!process) return res.status(404).json({ error: "Non trouvé" });
    const items = await db.select().from(onboardingProcessItemsTable)
      .where(eq(onboardingProcessItemsTable.processId, process.id))
      .orderBy(asc(onboardingProcessItemsTable.sortOrder));
    res.json({ ...process, items });
  } catch (e) { next(e); }
});

router.post("/hr/onboarding/processes/:id/items/:itemId/complete", requireAuth, async (req, res, next) => {
  try {
    const { notes } = z.object({ notes: z.string().optional() }).parse(req.body);
    const [row] = await db.update(onboardingProcessItemsTable)
      .set({ status: "completed", completedAt: new Date(), completedById: req.authUser!.userId, notes: notes ?? null })
      .where(and(eq(onboardingProcessItemsTable.id, req.params.itemId), eq(onboardingProcessItemsTable.processId, req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    // Vérifier si tout est complété
    const remaining = await db.select({ id: onboardingProcessItemsTable.id })
      .from(onboardingProcessItemsTable)
      .where(and(eq(onboardingProcessItemsTable.processId, req.params.id), eq(onboardingProcessItemsTable.status, "pending"), eq(onboardingProcessItemsTable.isRequired, true)));
    if (remaining.length === 0) {
      await db.update(onboardingProcessesTable).set({ status: "completed", completedAt: new Date() }).where(eq(onboardingProcessesTable.id, req.params.id));
    }
    res.json(row);
  } catch (e) { next(e); }
});

router.post("/hr/onboarding/processes/:id/items/:itemId/skip", requireManagerOrAbove, async (req, res, next) => {
  try {
    const { notes } = z.object({ notes: z.string().optional() }).parse(req.body);
    const [row] = await db.update(onboardingProcessItemsTable)
      .set({ status: "skipped", notes: notes ?? null })
      .where(and(eq(onboardingProcessItemsTable.id, req.params.itemId), eq(onboardingProcessItemsTable.processId, req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });
    res.json(row);
  } catch (e) { next(e); }
});

export default router;
