/**
 * #12 — Notes de frais
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { expenseReportsTable, expenseItemsTable, collaboratorsTable } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { z } from "zod/v4";

const router = Router();
router.use(requireAuth);

const toNum = (v: unknown) => (v == null ? 0 : Number(v));

// ─── RAPPORTS DE FRAIS ───────────────────────────────────
router.get("/hr/expenses", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status, collaboratorId, mine } = req.query as Record<string, string>;
    const filters = [eq(expenseReportsTable.organizationId, orgId)];
    if (status) filters.push(eq(expenseReportsTable.status, status));
    if (collaboratorId) filters.push(eq(expenseReportsTable.collaboratorId, collaboratorId));

    // Collaborateur courant
    let myCollabId: string | null = null;
    if (mine === "1") {
      const c = await db.query.collaboratorsTable.findFirst({ where: and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.userId, req.authUser!.id)) });
      if (c) { myCollabId = c.id; filters.push(eq(expenseReportsTable.collaboratorId, c.id)); }
    }

    const rows = await db
      .select({
        id: expenseReportsTable.id,
        title: expenseReportsTable.title,
        description: expenseReportsTable.description,
        status: expenseReportsTable.status,
        totalAmount: expenseReportsTable.totalAmount,
        currency: expenseReportsTable.currency,
        periodStart: expenseReportsTable.periodStart,
        periodEnd: expenseReportsTable.periodEnd,
        submittedAt: expenseReportsTable.submittedAt,
        approvedAt: expenseReportsTable.approvedAt,
        paidAt: expenseReportsTable.paidAt,
        rejectionReason: expenseReportsTable.rejectionReason,
        notes: expenseReportsTable.notes,
        collaboratorId: expenseReportsTable.collaboratorId,
        createdAt: expenseReportsTable.createdAt,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        poste: collaboratorsTable.position,
        avatarUrl: collaboratorsTable.avatarUrl,
      })
      .from(expenseReportsTable)
      .leftJoin(collaboratorsTable, eq(expenseReportsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...filters))
      .orderBy(desc(expenseReportsTable.createdAt));

    res.json(rows.map(r => ({ ...r, totalAmount: toNum(r.totalAmount) })));
  } catch (e) { next(e); }
});

router.post("/hr/expenses", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({
      collaboratorId: z.string().uuid().optional(),
      title: z.string(),
      description: z.string().optional(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    let collaboratorId = body.collaboratorId;
    if (!collaboratorId) {
      const c = await db.query.collaboratorsTable.findFirst({ where: and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.userId, req.authUser!.id)) });
      if (c) collaboratorId = c.id;
    }
    if (!collaboratorId) return res.status(400).json({ error: "Collaborateur non trouvé" });

    const [row] = await db.insert(expenseReportsTable).values({
      organizationId: orgId,
      collaboratorId,
      title: body.title,
      description: body.description,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      notes: body.notes,
    }).returning();
    res.status(201).json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

router.get("/hr/expenses/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const report = await db.query.expenseReportsTable.findFirst({
      where: and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId)),
    });
    if (!report) return res.status(404).json({ error: "Non trouvé" });
    const items = await db.select().from(expenseItemsTable).where(eq(expenseItemsTable.expenseReportId, report.id)).orderBy(desc(expenseItemsTable.expenseDate));
    res.json({ ...report, totalAmount: toNum(report.totalAmount), items: items.map(i => ({ ...i, amount: toNum(i.amount) })) });
  } catch (e) { next(e); }
});

router.patch("/hr/expenses/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const body = z.object({ title: z.string().optional(), description: z.string().optional(), periodStart: z.string().optional(), periodEnd: z.string().optional(), notes: z.string().optional() }).parse(req.body);
    const [row] = await db.update(expenseReportsTable).set(body)
      .where(and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId), eq(expenseReportsTable.status, "draft")))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé ou non modifiable" });
    res.json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

router.delete("/hr/expenses/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(expenseReportsTable).where(and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId), eq(expenseReportsTable.status, "draft")));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── ITEMS ───────────────────────────────────────────────
router.post("/hr/expenses/:id/items", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const report = await db.query.expenseReportsTable.findFirst({ where: and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId)) });
    if (!report) return res.status(404).json({ error: "Non trouvé" });
    if (!["draft", "submitted"].includes(report.status)) return res.status(400).json({ error: "Rapport non modifiable" });

    const body = z.object({
      category: z.string(),
      description: z.string(),
      amount: z.number().positive(),
      expenseDate: z.string(),
      receiptUrl: z.string().optional(),
      isBillable: z.boolean().optional(),
      projectId: z.string().uuid().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const [item] = await db.insert(expenseItemsTable).values({ expenseReportId: report.id, ...body, amount: String(body.amount) }).returning();

    // Recalcul du total
    const items = await db.select({ amount: expenseItemsTable.amount }).from(expenseItemsTable).where(eq(expenseItemsTable.expenseReportId, report.id));
    const total = items.reduce((s, i) => s + toNum(i.amount), 0);
    await db.update(expenseReportsTable).set({ totalAmount: String(total) }).where(eq(expenseReportsTable.id, report.id));

    res.status(201).json({ ...item, amount: toNum(item.amount) });
  } catch (e) { next(e); }
});

router.delete("/hr/expenses/:id/items/:itemId", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const report = await db.query.expenseReportsTable.findFirst({ where: and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId)) });
    if (!report || !["draft"].includes(report.status)) return res.status(400).json({ error: "Non modifiable" });
    await db.delete(expenseItemsTable).where(and(eq(expenseItemsTable.id, req.params.itemId), eq(expenseItemsTable.expenseReportId, report.id)));
    const items = await db.select({ amount: expenseItemsTable.amount }).from(expenseItemsTable).where(eq(expenseItemsTable.expenseReportId, report.id));
    const total = items.reduce((s, i) => s + toNum(i.amount), 0);
    await db.update(expenseReportsTable).set({ totalAmount: String(total) }).where(eq(expenseReportsTable.id, report.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── WORKFLOW ────────────────────────────────────────────
router.post("/hr/expenses/:id/submit", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.update(expenseReportsTable)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId), eq(expenseReportsTable.status, "draft")))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé ou déjà soumis" });
    res.json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

router.post("/hr/expenses/:id/approve", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.update(expenseReportsTable)
      .set({ status: "approved", approvedById: req.authUser!.id, approvedAt: new Date() })
      .where(and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId), eq(expenseReportsTable.status, "submitted")))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé ou non soumis" });
    res.json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

router.post("/hr/expenses/:id/reject", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { reason } = z.object({ reason: z.string() }).parse(req.body);
    const [row] = await db.update(expenseReportsTable)
      .set({ status: "rejected", rejectionReason: reason, approvedById: req.authUser!.id, approvedAt: new Date() })
      .where(and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId), eq(expenseReportsTable.status, "submitted")))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé ou non soumis" });
    res.json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

router.post("/hr/expenses/:id/pay", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.update(expenseReportsTable)
      .set({ status: "paid", paidAt: new Date(), paidById: req.authUser!.id })
      .where(and(eq(expenseReportsTable.id, req.params.id), eq(expenseReportsTable.organizationId, orgId), eq(expenseReportsTable.status, "approved")))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé ou non approuvé" });
    res.json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

export default router;
