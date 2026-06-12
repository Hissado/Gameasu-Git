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
  bankTransferAuditLogTable,
  collaboratorsTable,
  payrollRunsTable,
  payslipsTable,
  notificationsTable,
  usersTable,
  organizationMembersTable,
} from "@workspace/db";
import { and, eq, desc, asc, inArray, gte, lte, count } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { z } from "zod/v4";
import { sendEmail } from "../lib/email";

const router = Router();
router.use(requireAuth);

const toNum = (v: unknown) => (v == null ? 0 : Number(v));
const formatFCFA = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} FCFA`;

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
    const updatedByAlias = usersTable;
    const rows = await db
      .select({
        id: bankTransferOrdersTable.id,
        organizationId: bankTransferOrdersTable.organizationId,
        payrollRunId: bankTransferOrdersTable.payrollRunId,
        reference: bankTransferOrdersTable.reference,
        status: bankTransferOrdersTable.status,
        totalAmount: bankTransferOrdersTable.totalAmount,
        currency: bankTransferOrdersTable.currency,
        bankReference: bankTransferOrdersTable.bankReference,
        transferLines: bankTransferOrdersTable.transferLines,
        submittedAt: bankTransferOrdersTable.submittedAt,
        completedAt: bankTransferOrdersTable.completedAt,
        errorMessage: bankTransferOrdersTable.errorMessage,
        notes: bankTransferOrdersTable.notes,
        createdById: bankTransferOrdersTable.createdById,
        updatedById: bankTransferOrdersTable.updatedById,
        createdAt: bankTransferOrdersTable.createdAt,
        updatedAt: bankTransferOrdersTable.updatedAt,
        updatedByFirstName: updatedByAlias.firstName,
        updatedByLastName: updatedByAlias.lastName,
      })
      .from(bankTransferOrdersTable)
      .leftJoin(updatedByAlias, eq(bankTransferOrdersTable.updatedById, updatedByAlias.id))
      .where(eq(bankTransferOrdersTable.organizationId, orgId))
      .orderBy(desc(bankTransferOrdersTable.createdAt));
    res.json(rows.map(r => ({
      ...r,
      totalAmount: toNum(r.totalAmount),
      updatedByName: r.updatedByFirstName ? `${r.updatedByFirstName} ${r.updatedByLastName ?? ""}`.trim() : null,
    })));
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
    const userId = req.authUser!.userId;
    const body = z.object({
      status: z.enum(["pending", "processing", "submitted", "completed", "failed", "cancelled"]).optional(),
      bankReference: z.string().optional(),
      errorMessage: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    // Fetch current state before update (for audit diff)
    const [current] = await db.select({
      status: bankTransferOrdersTable.status,
      reference: bankTransferOrdersTable.reference,
      totalAmount: bankTransferOrdersTable.totalAmount,
    })
      .from(bankTransferOrdersTable)
      .where(and(eq(bankTransferOrdersTable.id, req.params.id), eq(bankTransferOrdersTable.organizationId, orgId)));
    if (!current) return res.status(404).json({ error: "Non trouvé" });

    const updates: Record<string, unknown> = { ...body, updatedById: userId };
    if (body.status === "submitted") updates.submittedAt = new Date();
    if (body.status === "completed") updates.completedAt = new Date();

    const [row] = await db.update(bankTransferOrdersTable)
      .set(updates)
      .where(and(eq(bankTransferOrdersTable.id, req.params.id), eq(bankTransferOrdersTable.organizationId, orgId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Non trouvé" });

    // ── Journal d'audit ─────────────────────────────────
    if (body.status && body.status !== current.status) {
      await db.insert(bankTransferAuditLogTable).values({
        organizationId: orgId,
        bankTransferOrderId: row.id,
        userId,
        action: "status_change",
        oldStatus: current.status,
        newStatus: body.status,
        metadata: {
          reference: row.reference,
          bankReference: body.bankReference ?? null,
          errorMessage: body.errorMessage ?? null,
        },
      });

      // ── Notifications in-app (tous les managers/admins de l'org) ────
      try {
        const members = await db.select({ userId: organizationMembersTable.userId })
          .from(organizationMembersTable)
          .where(eq(organizationMembersTable.organizationId, orgId));

        const users = members.length
          ? await db.select({ id: usersTable.id, role: usersTable.role, email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName })
              .from(usersTable)
              .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, members.map(m => m.userId))))
          : [];

        const hrUsers = users.filter(u => ["admin", "manager", "super_admin"].includes(u.role ?? ""));

        const statusLabels: Record<string, string> = {
          submitted: "Soumis à la banque",
          completed: "Exécuté",
          failed: "Échec",
          cancelled: "Annulé",
          processing: "En traitement",
          pending: "En attente",
        };
        const notifTitle = `Virement ${row.reference} — ${statusLabels[body.status] ?? body.status}`;
        const notifBody = `Le statut de l'ordre de virement ${row.reference} (${formatFCFA(toNum(row.totalAmount))}) est passé de « ${statusLabels[current.status] ?? current.status} » à « ${statusLabels[body.status] ?? body.status} ».`;

        if (hrUsers.length) {
          await db.insert(notificationsTable).values(
            hrUsers.map(u => ({
              organizationId: orgId,
              userId: u.id,
              title: notifTitle,
              body: notifBody,
              type: body.status === "failed" ? "error" : body.status === "completed" ? "success" : "info",
              entityType: "bank_transfer",
              entityId: row.id,
            }))
          );

          // ── Email de confirmation (statuts clés uniquement) ──────────
          if (body.status === "submitted" || body.status === "completed" || body.status === "failed") {
            const actorUser = users.find(u => u.id === userId);
            const actorName = actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : "Un responsable RH";
            const emailSubject = body.status === "submitted"
              ? `Virement ${row.reference} soumis à la banque`
              : body.status === "completed"
              ? `Virement ${row.reference} exécuté avec succès`
              : `Virement ${row.reference} — échec`;

            const statusColor = body.status === "completed" ? "#16a34a" : body.status === "failed" ? "#dc2626" : "#2563eb";
            const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#1e1e2e;padding:24px 32px;">
    <span style="color:#f37021;font-size:22px;font-weight:bold;">Gaméasù</span>
    <span style="color:#9ca3af;font-size:14px;margin-left:12px;">RH · Virements bancaires</span>
  </div>
  <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;">
    <h2 style="margin:0 0 16px;color:#111827;">${emailSubject}</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:40%;">Référence</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${row.reference}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Montant total</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${formatFCFA(toNum(row.totalAmount))} XOF</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Nouveau statut</td><td style="padding:8px 0;"><span style="background:${statusColor}1a;color:${statusColor};padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${statusLabels[body.status] ?? body.status}</span></td></tr>
      ${body.bankReference ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Réf. banque</td><td style="padding:8px 0;font-family:monospace;font-size:14px;">${body.bankReference}</td></tr>` : ""}
      ${body.errorMessage ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Message d'erreur</td><td style="padding:8px 0;color:#dc2626;font-size:14px;">${body.errorMessage}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Modifié par</td><td style="padding:8px 0;font-size:14px;">${actorName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:8px 0;font-size:14px;">${new Date().toLocaleString("fr-FR")}</td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin:0;">Ce message est envoyé automatiquement par Gaméasù. Ne pas répondre à cet email.</p>
  </div>
</div>`;
            const emailText = `${emailSubject}\n\nRéférence : ${row.reference}\nMontant : ${formatFCFA(toNum(row.totalAmount))} XOF\nStatut : ${statusLabels[body.status] ?? body.status}\nModifié par : ${actorName}\nDate : ${new Date().toLocaleString("fr-FR")}`;

            for (const u of hrUsers) {
              if (u.email) {
                sendEmail({ to: u.email, subject: emailSubject, html: emailHtml, text: emailText, category: "bank_transfer" }).catch(() => {/* ignore */});
              }
            }
          }
        }

        // ── Email aux bénéficiaires quand le virement est exécuté ──────
        if (body.status === "completed") {
          const lines = (row.transferLines ?? []) as Array<{
            collaboratorId?: string;
            amount?: number;
            name?: string;
            iban?: string;
          }>;

          if (lines.length > 0) {
            const collaboratorIds = lines
              .map(l => l.collaboratorId)
              .filter((id): id is string => Boolean(id));

            // Récupérer les collaborateurs de cette organisation uniquement
            const collabRows = collaboratorIds.length
              ? await db.select({
                  id: collaboratorsTable.id,
                  firstName: collaboratorsTable.firstName,
                  lastName: collaboratorsTable.lastName,
                  professionalEmail: collaboratorsTable.professionalEmail,
                  userId: collaboratorsTable.userId,
                })
                .from(collaboratorsTable)
                .where(and(
                  eq(collaboratorsTable.organizationId, orgId),
                  inArray(collaboratorsTable.id, collaboratorIds),
                ))
              : [];

            // Récupérer les emails des comptes utilisateur liés — uniquement
            // ceux qui sont membres de cette organisation
            const orgMemberUserIds = new Set(members.map(m => m.userId).filter((id): id is string => id !== null));
            const linkedUserIds = collabRows
              .map(c => c.userId)
              .filter((id): id is string => id !== null && orgMemberUserIds.has(id));
            const userEmailRows = linkedUserIds.length
              ? await db.select({ id: usersTable.id, email: usersTable.email })
                  .from(usersTable)
                  .where(inArray(usersTable.id, linkedUserIds))
              : [];
            const userEmailMap = new Map(userEmailRows.map(u => [u.id, u.email]));

            // Récupérer la période depuis le run de paie — filtré par organisation
            let period: string | null = null;
            if (row.payrollRunId) {
              const [runRow] = await db.select({ period: payrollRunsTable.period })
                .from(payrollRunsTable)
                .where(and(
                  eq(payrollRunsTable.organizationId, orgId),
                  eq(payrollRunsTable.id, row.payrollRunId),
                ));
              period = runRow?.period ?? null;
            }

            const periodLabel = period
              ? new Date(`${period}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
              : null;

            const collabMap = new Map(collabRows.map(c => [c.id, c]));
            const sentEmails = new Set<string>();

            for (const line of lines) {
              if (!line.collaboratorId) continue;
              const collab = collabMap.get(line.collaboratorId);
              if (!collab) continue;

              const recipientEmail =
                collab.professionalEmail ||
                (collab.userId ? userEmailMap.get(collab.userId) : null);
              if (!recipientEmail) continue;

              // Dédupliquer : un seul email par adresse
              if (sentEmails.has(recipientEmail)) continue;
              sentEmails.add(recipientEmail);

              const recipientName = line.name || `${collab.firstName ?? ""} ${collab.lastName ?? ""}`.trim();
              const netAmount = formatFCFA(toNum(line.amount));
              const subjectEmployee = `Votre virement de salaire a été exécuté${periodLabel ? ` — ${periodLabel}` : ""}`;

              const htmlEmployee = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#1e1e2e;padding:24px 32px;">
    <span style="color:#f37021;font-size:22px;font-weight:bold;">Gaméasù</span>
    <span style="color:#9ca3af;font-size:14px;margin-left:12px;">RH · Paie</span>
  </div>
  <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;">
    <h2 style="margin:0 0 8px;color:#111827;">Votre virement a été effectué</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Bonjour <strong>${recipientName}</strong>,</p>
    <p style="font-size:14px;color:#374151;margin:0 0 24px;">
      Nous vous informons que votre virement de salaire a été exécuté avec succès par votre employeur.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Montant net viré</div>
      <div style="font-size:32px;font-weight:700;color:#16a34a;">${netAmount}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${periodLabel ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:40%;">Période</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${periodLabel}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Référence de l'ordre</td><td style="padding:8px 0;font-family:monospace;font-size:14px;">${row.reference}</td></tr>
      ${row.bankReference ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Réf. banque</td><td style="padding:8px 0;font-family:monospace;font-size:14px;">${row.bankReference}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Date d'exécution</td><td style="padding:8px 0;font-size:14px;">${new Date().toLocaleDateString("fr-FR")}</td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin:0;">
      Ce virement devrait apparaître sur votre compte bancaire dans un délai de 1 à 3 jours ouvrés selon votre établissement.<br>
      Ce message est envoyé automatiquement par Gaméasù. Ne pas répondre à cet email.
    </p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center;">© ${new Date().getFullYear()} Gaméasù — Tous droits réservés</div>
</div>`;

              const textEmployee = [
                `Bonjour ${recipientName},`,
                ``,
                `Votre virement de salaire a été exécuté avec succès.`,
                ``,
                `Montant net : ${netAmount}`,
                periodLabel ? `Période : ${periodLabel}` : null,
                `Référence : ${row.reference}`,
                row.bankReference ? `Réf. banque : ${row.bankReference}` : null,
                `Date : ${new Date().toLocaleDateString("fr-FR")}`,
                ``,
                `Ce virement devrait apparaître sur votre compte dans 1 à 3 jours ouvrés.`,
              ].filter(Boolean).join("\n");

              sendEmail({
                to: recipientEmail,
                subject: subjectEmployee,
                html: htmlEmployee,
                text: textEmployee,
                category: "bank_transfer_employee",
              }).catch(() => {/* ne pas bloquer */});
            }
          }
        }
      } catch {/* ne pas bloquer la réponse si notifications échouent */}
    }

    res.json({ ...row, totalAmount: toNum(row.totalAmount) });
  } catch (e) { next(e); }
});

// GET /api/payroll/transfer-orders/:id/audit-log — journal d'audit
router.get("/payroll/transfer-orders/:id/audit-log", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const entries = await db
      .select({
        id: bankTransferAuditLogTable.id,
        action: bankTransferAuditLogTable.action,
        oldStatus: bankTransferAuditLogTable.oldStatus,
        newStatus: bankTransferAuditLogTable.newStatus,
        metadata: bankTransferAuditLogTable.metadata,
        createdAt: bankTransferAuditLogTable.createdAt,
        userId: bankTransferAuditLogTable.userId,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(bankTransferAuditLogTable)
      .leftJoin(usersTable, eq(bankTransferAuditLogTable.userId, usersTable.id))
      .where(and(
        eq(bankTransferAuditLogTable.bankTransferOrderId, req.params.id),
        eq(bankTransferAuditLogTable.organizationId, orgId),
      ))
      .orderBy(desc(bankTransferAuditLogTable.createdAt));
    res.json(entries);
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

// ══════════════════════════════════════════════════════════
// JOURNAL D'AUDIT GLOBAL DES VIREMENTS
// ══════════════════════════════════════════════════════════

// GET /api/payroll/transfer-audit-log/authors — auteurs distincts (pour filtre)
router.get("/payroll/transfer-audit-log/authors", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db
      .selectDistinct({
        userId: bankTransferAuditLogTable.userId,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(bankTransferAuditLogTable)
      .leftJoin(usersTable, eq(bankTransferAuditLogTable.userId, usersTable.id))
      .where(eq(bankTransferAuditLogTable.organizationId, orgId));
    res.json(rows.filter(r => r.userId != null).map(r => ({
      userId: r.userId,
      name: r.firstName ? `${r.firstName} ${r.lastName ?? ""}`.trim() : "Système",
    })));
  } catch (e) { next(e); }
});

// GET /api/payroll/transfer-audit-log — journal global avec filtres + pagination
router.get("/payroll/transfer-audit-log", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { dateFrom, dateTo, status, userId: authorId, page = "1", limit = "50" } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const filters = [eq(bankTransferAuditLogTable.organizationId, orgId)];
    if (dateFrom) filters.push(gte(bankTransferAuditLogTable.createdAt, new Date(dateFrom)));
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filters.push(lte(bankTransferAuditLogTable.createdAt, end));
    }
    if (status) filters.push(eq(bankTransferAuditLogTable.newStatus, status));
    if (authorId) filters.push(eq(bankTransferAuditLogTable.userId, authorId));

    const [{ total }] = await db
      .select({ total: count() })
      .from(bankTransferAuditLogTable)
      .where(and(...filters));

    const entries = await db
      .select({
        id: bankTransferAuditLogTable.id,
        action: bankTransferAuditLogTable.action,
        oldStatus: bankTransferAuditLogTable.oldStatus,
        newStatus: bankTransferAuditLogTable.newStatus,
        metadata: bankTransferAuditLogTable.metadata,
        createdAt: bankTransferAuditLogTable.createdAt,
        userId: bankTransferAuditLogTable.userId,
        bankTransferOrderId: bankTransferAuditLogTable.bankTransferOrderId,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        reference: bankTransferOrdersTable.reference,
        totalAmount: bankTransferOrdersTable.totalAmount,
      })
      .from(bankTransferAuditLogTable)
      .leftJoin(usersTable, eq(bankTransferAuditLogTable.userId, usersTable.id))
      .leftJoin(bankTransferOrdersTable, eq(bankTransferAuditLogTable.bankTransferOrderId, bankTransferOrdersTable.id))
      .where(and(...filters))
      .orderBy(desc(bankTransferAuditLogTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      items: entries.map(e => ({
        ...e,
        totalAmount: toNum(e.totalAmount),
        authorName: e.firstName ? `${e.firstName} ${e.lastName ?? ""}`.trim() : "Système",
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (e) { next(e); }
});

// GET /api/payroll/transfer-audit-log/export.csv
router.get("/payroll/transfer-audit-log/export.csv", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { dateFrom, dateTo, status, userId: authorId } = req.query as Record<string, string>;

    const filters = [eq(bankTransferAuditLogTable.organizationId, orgId)];
    if (dateFrom) filters.push(gte(bankTransferAuditLogTable.createdAt, new Date(dateFrom)));
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filters.push(lte(bankTransferAuditLogTable.createdAt, end));
    }
    if (status) filters.push(eq(bankTransferAuditLogTable.newStatus, status));
    if (authorId) filters.push(eq(bankTransferAuditLogTable.userId, authorId));

    const entries = await db
      .select({
        id: bankTransferAuditLogTable.id,
        action: bankTransferAuditLogTable.action,
        oldStatus: bankTransferAuditLogTable.oldStatus,
        newStatus: bankTransferAuditLogTable.newStatus,
        metadata: bankTransferAuditLogTable.metadata,
        createdAt: bankTransferAuditLogTable.createdAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        reference: bankTransferOrdersTable.reference,
        totalAmount: bankTransferOrdersTable.totalAmount,
      })
      .from(bankTransferAuditLogTable)
      .leftJoin(usersTable, eq(bankTransferAuditLogTable.userId, usersTable.id))
      .leftJoin(bankTransferOrdersTable, eq(bankTransferAuditLogTable.bankTransferOrderId, bankTransferOrdersTable.id))
      .where(and(...filters))
      .orderBy(desc(bankTransferAuditLogTable.createdAt));

    const statusLabels: Record<string, string> = {
      submitted: "Soumis", completed: "Exécuté", failed: "Échec",
      cancelled: "Annulé", processing: "En traitement", pending: "En attente",
    };

    const csvRows: string[] = [
      ["Date", "Auteur", "Référence ordre", "Montant (XOF)", "Statut précédent", "Nouveau statut", "Réf. banque", "Message d'erreur"].join(";"),
    ];
    for (const e of entries) {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      csvRows.push([
        new Date(e.createdAt).toLocaleString("fr-FR"),
        e.firstName ? `${e.firstName} ${e.lastName ?? ""}`.trim() : "Système",
        e.reference ?? "",
        Math.round(toNum(e.totalAmount)),
        e.oldStatus ? (statusLabels[e.oldStatus] ?? e.oldStatus) : "",
        e.newStatus ? (statusLabels[e.newStatus] ?? e.newStatus) : "",
        meta.bankReference ? String(meta.bankReference) : "",
        meta.errorMessage ? String(meta.errorMessage) : "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    }

    const filename = `journal-audit-virements-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csvRows.join("\r\n"));
  } catch (e) { next(e); }
});

// GET /api/payroll/transfer-audit-log/export.xlsx
router.get("/payroll/transfer-audit-log/export.xlsx", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { dateFrom, dateTo, status, userId: authorId } = req.query as Record<string, string>;

    const filters = [eq(bankTransferAuditLogTable.organizationId, orgId)];
    if (dateFrom) filters.push(gte(bankTransferAuditLogTable.createdAt, new Date(dateFrom)));
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filters.push(lte(bankTransferAuditLogTable.createdAt, end));
    }
    if (status) filters.push(eq(bankTransferAuditLogTable.newStatus, status));
    if (authorId) filters.push(eq(bankTransferAuditLogTable.userId, authorId));

    const entries = await db
      .select({
        id: bankTransferAuditLogTable.id,
        action: bankTransferAuditLogTable.action,
        oldStatus: bankTransferAuditLogTable.oldStatus,
        newStatus: bankTransferAuditLogTable.newStatus,
        metadata: bankTransferAuditLogTable.metadata,
        createdAt: bankTransferAuditLogTable.createdAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        reference: bankTransferOrdersTable.reference,
        totalAmount: bankTransferOrdersTable.totalAmount,
      })
      .from(bankTransferAuditLogTable)
      .leftJoin(usersTable, eq(bankTransferAuditLogTable.userId, usersTable.id))
      .leftJoin(bankTransferOrdersTable, eq(bankTransferAuditLogTable.bankTransferOrderId, bankTransferOrdersTable.id))
      .where(and(...filters))
      .orderBy(desc(bankTransferAuditLogTable.createdAt));

    const statusLabels: Record<string, string> = {
      submitted: "Soumis", completed: "Exécuté", failed: "Échec",
      cancelled: "Annulé", processing: "En traitement", pending: "En attente",
    };

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaméasù Plateforme";
    wb.created = new Date();

    const ws = wb.addWorksheet("Journal d'audit virements");

    ws.mergeCells("A1:H1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "Journal d'audit — Ordres de virement";
    titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 30;

    const subParts: string[] = [];
    if (dateFrom) subParts.push(`Du ${new Date(dateFrom).toLocaleDateString("fr-FR")}`);
    if (dateTo) subParts.push(`au ${new Date(dateTo).toLocaleDateString("fr-FR")}`);
    if (status) subParts.push(`Statut : ${statusLabels[status] ?? status}`);
    subParts.push(`${entries.length} événement(s)`);

    ws.mergeCells("A2:H2");
    const subCell = ws.getCell("A2");
    subCell.value = subParts.join("  |  ");
    subCell.font = { italic: true, size: 10 };
    subCell.alignment = { horizontal: "center" };

    ws.addRow([]);

    const headerRow = ws.addRow(["Date", "Auteur", "Référence ordre", "Montant (XOF)", "Statut précédent", "Nouveau statut", "Réf. banque", "Message d'erreur"]);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
      cell.alignment = { horizontal: "center" };
      cell.border = { bottom: { style: "thin" } };
    });
    ws.getRow(4).height = 20;

    let rowIdx = 5;
    for (const e of entries) {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const row = ws.addRow([
        new Date(e.createdAt).toLocaleString("fr-FR"),
        e.firstName ? `${e.firstName} ${e.lastName ?? ""}`.trim() : "Système",
        e.reference ?? "—",
        Math.round(toNum(e.totalAmount)),
        e.oldStatus ? (statusLabels[e.oldStatus] ?? e.oldStatus) : "—",
        e.newStatus ? (statusLabels[e.newStatus] ?? e.newStatus) : "—",
        meta.bankReference ? String(meta.bankReference) : "",
        meta.errorMessage ? String(meta.errorMessage) : "",
      ]);
      if (rowIdx % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6EE" } };
        });
      }
      row.getCell(4).numFmt = '#,##0" XOF"';
      rowIdx++;
    }

    ws.columns = [
      { width: 22 }, { width: 24 }, { width: 28 }, { width: 20 },
      { width: 18 }, { width: 18 }, { width: 22 }, { width: 36 },
    ];

    const filename = `journal-audit-virements-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

export default router;
