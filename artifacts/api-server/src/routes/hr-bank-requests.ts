import { Router } from "express";
import { db } from "@workspace/db";
import {
  collaboratorsTable,
  bankInfoRequestsTable,
} from "@workspace/db";
import { and, eq, isNull, desc } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function getMyCollab(userId: string, orgId: string) {
  const [collab] = await db.select()
    .from(collaboratorsTable)
    .where(and(
      eq(collaboratorsTable.userId, userId),
      eq(collaboratorsTable.organizationId, orgId),
      isNull(collaboratorsTable.deletedAt),
    ))
    .limit(1);
  return collab ?? null;
}

// ── SELF-SERVICE EMPLOYÉ ──────────────────────────────────────────────────────

/** POST /api/hr/me/bank-request — l'employé soumet ses coordonnées bancaires.
 *  Remplace toute demande pending existante.
 */
router.post("/hr/me/bank-request", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié à votre compte" }); return; }

    const { bankName, bankCode, bankAccountNumber } = req.body;
    if (!bankName && !bankCode && !bankAccountNumber) {
      res.status(400).json({ error: "Au moins un champ est requis (bankName, bankCode ou bankAccountNumber)" }); return;
    }
    if (bankName && typeof bankName !== "string") { res.status(400).json({ error: "bankName doit être une chaîne de caractères" }); return; }
    if (bankName && bankName.length > 100) { res.status(400).json({ error: "bankName ne peut pas dépasser 100 caractères" }); return; }
    if (bankCode && typeof bankCode !== "string") { res.status(400).json({ error: "bankCode doit être une chaîne de caractères" }); return; }
    if (bankCode && !/^\d{3}$/.test(bankCode)) { res.status(400).json({ error: "bankCode doit être un code BCEAO à 3 chiffres (ex : 024)" }); return; }
    if (bankAccountNumber && typeof bankAccountNumber !== "string") { res.status(400).json({ error: "bankAccountNumber doit être une chaîne de caractères" }); return; }
    if (bankAccountNumber && bankAccountNumber.length > 50) { res.status(400).json({ error: "bankAccountNumber ne peut pas dépasser 50 caractères" }); return; }

    await db.update(bankInfoRequestsTable)
      .set({ status: "cancelled" })
      .where(and(
        eq(bankInfoRequestsTable.collaboratorId, collab.id),
        eq(bankInfoRequestsTable.organizationId, orgId),
        eq(bankInfoRequestsTable.status, "pending"),
      ));

    const [request] = await db.insert(bankInfoRequestsTable).values({
      organizationId: orgId,
      collaboratorId: collab.id,
      bankName: bankName || null,
      bankCode: bankCode || null,
      bankAccountNumber: bankAccountNumber || null,
      status: "pending",
    }).returning();

    res.status(201).json(request);
  } catch (e) { next(e); }
});

/** GET /api/hr/me/bank-request — statut de la dernière demande bancaire de l'employé. */
router.get("/hr/me/bank-request", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié à votre compte" }); return; }

    const [request] = await db.select({
      id: bankInfoRequestsTable.id,
      bankName: bankInfoRequestsTable.bankName,
      bankCode: bankInfoRequestsTable.bankCode,
      bankAccountNumber: bankInfoRequestsTable.bankAccountNumber,
      status: bankInfoRequestsTable.status,
      rejectionReason: bankInfoRequestsTable.rejectionReason,
      reviewedAt: bankInfoRequestsTable.reviewedAt,
      createdAt: bankInfoRequestsTable.createdAt,
    })
      .from(bankInfoRequestsTable)
      .where(and(
        eq(bankInfoRequestsTable.collaboratorId, collab.id),
        eq(bankInfoRequestsTable.organizationId, orgId),
      ))
      .orderBy(desc(bankInfoRequestsTable.createdAt))
      .limit(1);

    res.json(request ?? null);
  } catch (e) { next(e); }
});

// ── MANAGER : VALIDATION DES DEMANDES ────────────────────────────────────────

/** GET /api/hr/bank-requests — liste des demandes bancaires (filtrable par status). */
router.get("/hr/bank-requests", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const statusFilter = req.query.status as string | undefined;

    const conditions = [eq(bankInfoRequestsTable.organizationId, orgId)];
    if (statusFilter) conditions.push(eq(bankInfoRequestsTable.status, statusFilter));

    const requests = await db.select({
      id: bankInfoRequestsTable.id,
      collaboratorId: bankInfoRequestsTable.collaboratorId,
      bankName: bankInfoRequestsTable.bankName,
      bankCode: bankInfoRequestsTable.bankCode,
      bankAccountNumber: bankInfoRequestsTable.bankAccountNumber,
      status: bankInfoRequestsTable.status,
      rejectionReason: bankInfoRequestsTable.rejectionReason,
      reviewedAt: bankInfoRequestsTable.reviewedAt,
      createdAt: bankInfoRequestsTable.createdAt,
      collaboratorFirstName: collaboratorsTable.firstName,
      collaboratorLastName: collaboratorsTable.lastName,
      collaboratorAvatarUrl: collaboratorsTable.avatarUrl,
      collaboratorJobTitle: collaboratorsTable.position,
    })
      .from(bankInfoRequestsTable)
      .innerJoin(collaboratorsTable, eq(bankInfoRequestsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...conditions))
      .orderBy(desc(bankInfoRequestsTable.createdAt));

    res.json({ data: requests });
  } catch (e) { next(e); }
});

/** PATCH /api/hr/bank-requests/:id/approve — approuve et applique les nouvelles coordonnées. */
router.patch("/hr/bank-requests/:id/approve", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [request] = await db.select()
      .from(bankInfoRequestsTable)
      .where(and(
        eq(bankInfoRequestsTable.id, req.params.id),
        eq(bankInfoRequestsTable.organizationId, orgId),
      ))
      .limit(1);
    if (!request) { res.status(404).json({ error: "Demande introuvable" }); return; }
    if (request.status !== "pending") { res.status(409).json({ error: "Cette demande a déjà été traitée" }); return; }

    await db.update(collaboratorsTable)
      .set({
        ...(request.bankName !== null && { bankName: request.bankName }),
        ...(request.bankCode !== null && { bankCode: request.bankCode }),
        ...(request.bankAccountNumber !== null && { bankAccountNumber: request.bankAccountNumber }),
      })
      .where(and(
        eq(collaboratorsTable.id, request.collaboratorId),
        eq(collaboratorsTable.organizationId, orgId),
      ));

    const [updated] = await db.update(bankInfoRequestsTable)
      .set({ status: "approved", reviewedById: req.authUser!.id, reviewedAt: new Date() })
      .where(and(
        eq(bankInfoRequestsTable.id, request.id),
        eq(bankInfoRequestsTable.organizationId, orgId),
      ))
      .returning();

    res.json(updated);
  } catch (e) { next(e); }
});

/** PATCH /api/hr/bank-requests/:id/reject — rejette avec motif optionnel. */
router.patch("/hr/bank-requests/:id/reject", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [request] = await db.select()
      .from(bankInfoRequestsTable)
      .where(and(
        eq(bankInfoRequestsTable.id, req.params.id),
        eq(bankInfoRequestsTable.organizationId, orgId),
      ))
      .limit(1);
    if (!request) { res.status(404).json({ error: "Demande introuvable" }); return; }
    if (request.status !== "pending") { res.status(409).json({ error: "Cette demande a déjà été traitée" }); return; }

    const { rejectionReason } = req.body;
    const [updated] = await db.update(bankInfoRequestsTable)
      .set({ status: "rejected", reviewedById: req.authUser!.id, reviewedAt: new Date(), rejectionReason: rejectionReason || null })
      .where(and(
        eq(bankInfoRequestsTable.id, request.id),
        eq(bankInfoRequestsTable.organizationId, orgId),
      ))
      .returning();

    res.json(updated);
  } catch (e) { next(e); }
});

export default router;
