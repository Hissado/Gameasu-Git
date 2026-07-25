/**
 * Demandes RH (Pointage §10) — workflow générique
 * Demande → Étude → Pièces justificatives, pour :
 *   permission | business_travel | mission | sickness | accident
 *
 *  GET    /api/hr/requests?type=&status=   liste (org)
 *  POST   /api/hr/requests                 créer une demande (auto : requester)
 *  GET    /api/hr/requests/:id             détail
 *  PATCH  /api/hr/requests/:id             MAJ statut/décision (hr.manage_leaves)
 *                                          ou pièces jointes par le demandeur
 */
import { Router } from "express";
import { db, hrRequestsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { hasPermission } from "../lib/rbac/permissions";

const router = Router();

const TYPES = ["permission", "business_travel", "mission", "sickness", "accident"];
const STATUSES = ["submitted", "under_review", "approved", "rejected"];
// Transitions autorisées (côté décideur).
const TRANSITIONS: Record<string, string[]> = {
  submitted:    ["under_review", "approved", "rejected"],
  under_review: ["approved", "rejected"],
  approved:     [],
  rejected:     ["under_review"],
};

router.get("/hr/requests", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { type, status } = req.query as { type?: string; status?: string };
    const conds = [eq(hrRequestsTable.organizationId, orgId)];
    if (type) conds.push(eq(hrRequestsTable.type, type));
    if (status) conds.push(eq(hrRequestsTable.status, status));
    const rows = await db.select().from(hrRequestsTable).where(and(...conds)).orderBy(desc(hrRequestsTable.createdAt));
    res.json({ data: rows });
  } catch (e) { next(e); }
});

router.post("/hr/requests", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { type, subject, description, startDate, endDate, attachments } = req.body ?? {};
    if (!TYPES.includes(type)) { res.status(400).json({ error: `Type invalide (attendu : ${TYPES.join(", ")})` }); return; }
    if (!subject || !String(subject).trim()) { res.status(400).json({ error: "L'objet de la demande est requis" }); return; }
    const [row] = await db.insert(hrRequestsTable).values({
      organizationId: orgId,
      type, subject: String(subject).trim(),
      description: description ?? null,
      startDate: startDate || null,
      endDate: endDate || null,
      status: "submitted",
      requesterId: req.authUser!.id,
      attachments: Array.isArray(attachments) ? attachments : [],
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/hr/requests/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select().from(hrRequestsTable)
      .where(and(eq(hrRequestsTable.organizationId, orgId), eq(hrRequestsTable.id, (req.params.id as string)))).limit(1);
    if (!row) { res.status(404).json({ error: "Demande introuvable" }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.patch("/hr/requests/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const [row] = await db.select().from(hrRequestsTable)
      .where(and(eq(hrRequestsTable.organizationId, orgId), eq(hrRequestsTable.id, (req.params.id as string)))).limit(1);
    if (!row) { res.status(404).json({ error: "Demande introuvable" }); return; }

    const { status, reviewNotes, rejectionReason, attachments } = req.body ?? {};
    const canDecide = await hasPermission(userId, "hr.manage_leaves");
    const isOwner = row.requesterId === userId;

    const set: Record<string, unknown> = {};

    // Le demandeur peut compléter ses pièces justificatives tant que non décidé.
    if (attachments !== undefined) {
      if (!canDecide && !isOwner) { res.status(403).json({ error: "Accès refusé" }); return; }
      if (!Array.isArray(attachments)) { res.status(400).json({ error: "attachments doit être une liste" }); return; }
      set.attachments = attachments;
    }

    // La décision (changement de statut) est réservée au décideur.
    if (status !== undefined) {
      if (!canDecide) { res.status(403).json({ error: "Accès refusé", detail: "Permission requise : hr.manage_leaves" }); return; }
      if (!STATUSES.includes(status)) { res.status(400).json({ error: "Statut invalide" }); return; }
      if (status !== row.status && !(TRANSITIONS[row.status] ?? []).includes(status)) {
        res.status(409).json({ error: `Transition non autorisée : ${row.status} → ${status}` }); return;
      }
      set.status = status;
      if (reviewNotes !== undefined) set.reviewNotes = reviewNotes;
      if (status === "approved" || status === "rejected") {
        set.reviewerId = userId;
        set.decidedAt = new Date();
        if (status === "rejected") set.rejectionReason = rejectionReason ?? null;
      }
    }

    if (Object.keys(set).length === 0) { res.status(400).json({ error: "Aucune modification" }); return; }
    const [updated] = await db.update(hrRequestsTable).set(set)
      .where(and(eq(hrRequestsTable.organizationId, orgId), eq(hrRequestsTable.id, row.id))).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

export default router;
