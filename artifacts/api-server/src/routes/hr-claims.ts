import { Router } from "express";
import { requirePermission } from "../middlewares/permissions";
import { hasPermission } from "../lib/rbac/permissions";
import {
  db, hrClaimsTable, hrClaimEventsTable, hrClaimAttachmentsTable,
  collaboratorsTable, usersTable, notificationsTable, departmentsTable,
} from "@workspace/db";
import { eq, and, desc, count, sql, inArray, countDistinct } from "drizzle-orm";

const router = Router();

// ── Constantes ─────────────────────────────────────────────────────────────────

const VALID_STATUSES = [
  "brouillon", "soumise", "en_cours", "infos_complementaires",
  "en_traitement", "resolue", "refusee", "cloturee",
] as const;

type ClaimStatus = typeof VALID_STATUSES[number];

// Transitions autorisées depuis chaque statut (manager uniquement)
const ALLOWED_TRANSITIONS: Record<string, ClaimStatus[]> = {
  brouillon:             ["soumise"],
  soumise:               ["en_cours", "refusee"],
  en_cours:              ["infos_complementaires", "en_traitement", "refusee"],
  infos_complementaires: ["en_cours", "en_traitement", "refusee"],
  en_traitement:         ["resolue", "refusee"],
  resolue:               ["cloturee"],
  refusee:               ["cloturee"],
  cloturee:              [],
};

const STATUS_LABELS: Record<string, string> = {
  soumise:               "Soumise",
  en_cours:              "En cours d'analyse",
  infos_complementaires: "Informations complémentaires requises",
  en_traitement:         "En traitement",
  resolue:               "Résolue",
  refusee:               "Refusée",
  cloturee:              "Clôturée",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function isHrManager(userId: string): Promise<boolean> {
  return hasPermission(userId, "hr.manage");
}

async function getCollaboratorForUser(userId: string, orgId: string): Promise<string | null> {
  const rows = await db
    .select({ id: collaboratorsTable.id })
    .from(collaboratorsTable)
    .where(and(
      eq(collaboratorsTable.userId as any, userId),
      eq(collaboratorsTable.organizationId, orgId),
    ))
    .limit(1);
  return rows[0]?.id ?? null;
}

function generateReference(seq: number): string {
  return `REC-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

function validateStatus(s: unknown): s is ClaimStatus {
  return VALID_STATUSES.includes(s as ClaimStatus);
}

// ── GET /hr/claims/stats ──────────────────────────────────────────────────────
router.get("/hr/claims/stats", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Total + statuts + catégories + priorités
    const [totRow] = await db
      .select({ total: count() })
      .from(hrClaimsTable)
      .where(eq(hrClaimsTable.organizationId, orgId));

    const byStatus = await db
      .select({ status: hrClaimsTable.status, cnt: count() })
      .from(hrClaimsTable)
      .where(eq(hrClaimsTable.organizationId, orgId))
      .groupBy(hrClaimsTable.status);

    const byCategory = await db
      .select({ category: hrClaimsTable.category, cnt: count() })
      .from(hrClaimsTable)
      .where(eq(hrClaimsTable.organizationId, orgId))
      .groupBy(hrClaimsTable.category)
      .orderBy(desc(count()));

    const byPriority = await db
      .select({ priority: hrClaimsTable.priority, cnt: count() })
      .from(hrClaimsTable)
      .where(eq(hrClaimsTable.organizationId, orgId))
      .groupBy(hrClaimsTable.priority);

    // Résolues ce mois
    const [resolvedThisMonthRow] = await db
      .select({ cnt: count() })
      .from(hrClaimsTable)
      .where(and(
        eq(hrClaimsTable.organizationId, orgId),
        eq(hrClaimsTable.status, "resolue"),
        sql`${hrClaimsTable.resolvedAt} >= ${firstDayOfMonth}::timestamptz`,
      ));

    // Délai moyen de traitement (soumise → résolue), en jours
    const [avgDelayRow] = await db.execute(sql`
      SELECT
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400))::int AS avg_days
      FROM hr_claims
      WHERE organization_id = ${orgId}
        AND status = 'resolue'
        AND resolved_at IS NOT NULL
    `);

    // Volume par département
    const byDept = await db.execute(sql`
      SELECT
        d.id AS dept_id,
        d.name AS dept_name,
        COUNT(hc.id)::int AS cnt
      FROM hr_claims hc
      JOIN collaborators c ON hc.collaborator_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE hc.organization_id = ${orgId}
      GROUP BY d.id, d.name
      ORDER BY cnt DESC
    `);

    res.json({
      total: Number(totRow?.total ?? 0),
      resolvedThisMonth: Number(resolvedThisMonthRow?.cnt ?? 0),
      avgProcessingDays: (avgDelayRow as any)?.avg_days ?? null,
      byStatus: byStatus.map(r => ({ status: r.status, count: Number(r.cnt) })),
      byCategory: byCategory.map(r => ({ category: r.category, count: Number(r.cnt) })),
      byPriority: byPriority.map(r => ({ priority: r.priority, count: Number(r.cnt) })),
      byDepartment: (byDept as any[]).map(r => ({
        deptId: r.dept_id,
        deptName: r.dept_name ?? "Non rattaché",
        count: Number(r.cnt),
      })),
    });
  } catch (e) { next(e); }
});

// ── GET /hr/claims ────────────────────────────────────────────────────────────
router.get("/hr/claims", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;
    const manager = await isHrManager(userId);

    const {
      status, category, priority,
      collaboratorId: filterCollabId, departmentId: filterDeptId,
      limit = "50", offset = "0",
    } = req.query as Record<string, string>;

    // Non-managers only see their own claims
    let ownCollabId: string | null = null;
    if (!manager) {
      ownCollabId = await getCollaboratorForUser(userId, orgId);
      if (!ownCollabId) return res.json({ data: [], total: 0 });
    }

    // For department filter, resolve collaborator IDs in that department
    let deptCollabIds: string[] | null = null;
    if (manager && filterDeptId) {
      const rows = await db
        .select({ id: collaboratorsTable.id })
        .from(collaboratorsTable)
        .where(and(
          eq(collaboratorsTable.organizationId, orgId),
          eq(collaboratorsTable.departmentId as any, filterDeptId),
        ));
      deptCollabIds = rows.map(r => r.id);
      if (deptCollabIds.length === 0) return res.json({ data: [], total: 0 });
    }

    const conditions = [eq(hrClaimsTable.organizationId, orgId)];
    if (!manager && ownCollabId) conditions.push(eq(hrClaimsTable.collaboratorId, ownCollabId));
    if (manager && filterCollabId) conditions.push(eq(hrClaimsTable.collaboratorId, filterCollabId));
    if (deptCollabIds) conditions.push(inArray(hrClaimsTable.collaboratorId, deptCollabIds));
    if (status) conditions.push(eq(hrClaimsTable.status, status));
    if (category) conditions.push(eq(hrClaimsTable.category, category));
    if (priority) conditions.push(eq(hrClaimsTable.priority, priority));

    // Real total count (for pagination)
    const [totalRow] = await db
      .select({ total: count() })
      .from(hrClaimsTable)
      .where(and(...conditions));

    const rows = await db
      .select({
        id: hrClaimsTable.id,
        reference: hrClaimsTable.reference,
        category: hrClaimsTable.category,
        subject: hrClaimsTable.subject,
        status: hrClaimsTable.status,
        priority: hrClaimsTable.priority,
        isAnonymous: hrClaimsTable.isAnonymous,
        targetDate: hrClaimsTable.targetDate,
        resolvedAt: hrClaimsTable.resolvedAt,
        createdAt: hrClaimsTable.createdAt,
        updatedAt: hrClaimsTable.updatedAt,
        collaboratorId: hrClaimsTable.collaboratorId,
        collabFirstName: collaboratorsTable.firstName,
        collabLastName: collaboratorsTable.lastName,
        assignedToId: hrClaimsTable.assignedToId,
        assignedFirstName: usersTable.firstName,
        assignedLastName: usersTable.lastName,
      })
      .from(hrClaimsTable)
      .leftJoin(collaboratorsTable, eq(hrClaimsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(usersTable, eq(hrClaimsTable.assignedToId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(hrClaimsTable.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const data = rows.map(r => ({
      id: r.id,
      reference: r.reference,
      category: r.category,
      subject: r.subject,
      status: r.status,
      priority: r.priority,
      isAnonymous: r.isAnonymous,
      targetDate: r.targetDate,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      collaboratorId: r.collaboratorId,
      collaboratorName: (r.isAnonymous && !manager)
        ? "Anonyme"
        : `${r.collabFirstName ?? ""} ${r.collabLastName ?? ""}`.trim(),
      assignedToId: r.assignedToId,
      assignedToName: r.assignedFirstName
        ? `${r.assignedFirstName} ${r.assignedLastName ?? ""}`.trim()
        : null,
    }));

    res.json({ data, total: Number(totalRow?.total ?? 0) });
  } catch (e) { next(e); }
});

// ── POST /hr/claims ───────────────────────────────────────────────────────────
router.post("/hr/claims", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;
    const manager = await isHrManager(userId);

    const { category, subject, description, priority = "normale", isAnonymous = false, targetDate } = req.body;
    if (!category || !subject || !description) {
      return res.status(400).json({ error: "Champs obligatoires manquants (catégorie, objet, description)" });
    }

    // collaboratorId resolution — security: non-managers are forced to their own profile
    let collaboratorId: string | null = null;
    if (manager && req.body.collaboratorId) {
      const [check] = await db
        .select({ id: collaboratorsTable.id })
        .from(collaboratorsTable)
        .where(and(
          eq(collaboratorsTable.id, req.body.collaboratorId as string),
          eq(collaboratorsTable.organizationId, orgId),
        ))
        .limit(1);
      if (!check) return res.status(400).json({ error: "Collaborateur introuvable dans cette organisation" });
      collaboratorId = check.id;
    } else {
      // Regular employee — always their own collaborator profile (ignores body.collaboratorId)
      collaboratorId = await getCollaboratorForUser(userId, orgId);
    }

    if (!collaboratorId) {
      return res.status(400).json({ error: "Profil collaborateur introuvable. Contactez un administrateur." });
    }

    // Auto-generate unique reference
    const [cntRow] = await db
      .select({ cnt: count() })
      .from(hrClaimsTable)
      .where(eq(hrClaimsTable.organizationId, orgId));
    const reference = generateReference(Number(cntRow?.cnt ?? 0) + 1);

    const [claim] = await db.insert(hrClaimsTable).values({
      organizationId: orgId,
      collaboratorId,
      reference,
      category,
      subject,
      description,
      status: "soumise",
      priority,
      isAnonymous: Boolean(isAnonymous),
      targetDate: targetDate ?? null,
    }).returning();

    // Initial timeline event
    await db.insert(hrClaimEventsTable).values({
      organizationId: orgId,
      claimId: claim.id,
      authorId: userId,
      kind: "status_change",
      fromStatus: "brouillon",
      toStatus: "soumise",
      content: "Réclamation soumise",
      isInternal: false,
    });

    // Notify HR managers (non-blocking)
    notifyHrManagers(orgId, userId, claim.id, claim.reference, claim.subject).catch(() => { /* non-blocking */ });

    res.status(201).json(claim);
  } catch (e) { next(e); }
});

// ── GET /hr/claims/:id ────────────────────────────────────────────────────────
router.get("/hr/claims/:id", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;
    const manager = await isHrManager(userId);

    const [claim] = await db
      .select({
        id: hrClaimsTable.id,
        reference: hrClaimsTable.reference,
        category: hrClaimsTable.category,
        subject: hrClaimsTable.subject,
        description: hrClaimsTable.description,
        status: hrClaimsTable.status,
        priority: hrClaimsTable.priority,
        isAnonymous: hrClaimsTable.isAnonymous,
        targetDate: hrClaimsTable.targetDate,
        resolvedAt: hrClaimsTable.resolvedAt,
        resolutionNote: hrClaimsTable.resolutionNote,
        createdAt: hrClaimsTable.createdAt,
        updatedAt: hrClaimsTable.updatedAt,
        collaboratorId: hrClaimsTable.collaboratorId,
        collabFirstName: collaboratorsTable.firstName,
        collabLastName: collaboratorsTable.lastName,
        assignedToId: hrClaimsTable.assignedToId,
        assignedFirstName: usersTable.firstName,
        assignedLastName: usersTable.lastName,
      })
      .from(hrClaimsTable)
      .leftJoin(collaboratorsTable, eq(hrClaimsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(usersTable, eq(hrClaimsTable.assignedToId, usersTable.id))
      .where(and(
        eq(hrClaimsTable.id, req.params.id as string),
        eq(hrClaimsTable.organizationId, orgId),
      ))
      .limit(1);

    if (!claim) return res.status(404).json({ error: "Réclamation introuvable" });

    // Access control: non-managers can only view their own claims
    if (!manager) {
      const ownCollabId = await getCollaboratorForUser(userId, orgId);
      if (ownCollabId !== claim.collaboratorId) {
        return res.status(403).json({ error: "Accès interdit" });
      }
    }

    // Timeline events
    const allEvents = await db
      .select({
        id: hrClaimEventsTable.id,
        kind: hrClaimEventsTable.kind,
        fromStatus: hrClaimEventsTable.fromStatus,
        toStatus: hrClaimEventsTable.toStatus,
        content: hrClaimEventsTable.content,
        isInternal: hrClaimEventsTable.isInternal,
        createdAt: hrClaimEventsTable.createdAt,
        authorId: hrClaimEventsTable.authorId,
        authorFirstName: usersTable.firstName,
        authorLastName: usersTable.lastName,
      })
      .from(hrClaimEventsTable)
      .leftJoin(usersTable, eq(hrClaimEventsTable.authorId, usersTable.id))
      .where(and(
        eq(hrClaimEventsTable.claimId, claim.id),
        eq(hrClaimEventsTable.organizationId, orgId),
      ))
      .orderBy(hrClaimEventsTable.createdAt);

    const events = (manager ? allEvents : allEvents.filter(e => !e.isInternal)).map(e => ({
      ...e,
      authorName: e.authorFirstName ? `${e.authorFirstName} ${e.authorLastName ?? ""}`.trim() : "Système",
      authorFirstName: undefined,
      authorLastName: undefined,
    }));

    // Pièces jointes
    const attachments = await db
      .select({
        id: hrClaimAttachmentsTable.id,
        fileName: hrClaimAttachmentsTable.fileName,
        fileUrl: hrClaimAttachmentsTable.fileUrl,
        mimeType: hrClaimAttachmentsTable.mimeType,
        size: hrClaimAttachmentsTable.size,
        createdAt: hrClaimAttachmentsTable.createdAt,
        uploadedById: hrClaimAttachmentsTable.uploadedById,
      })
      .from(hrClaimAttachmentsTable)
      .where(and(
        eq(hrClaimAttachmentsTable.claimId, claim.id),
        eq(hrClaimAttachmentsTable.organizationId, orgId),
      ))
      .orderBy(hrClaimAttachmentsTable.createdAt);

    // Allowed status transitions for this claim
    const allowedTransitions = manager ? (ALLOWED_TRANSITIONS[claim.status] ?? []) : [];

    res.json({
      id: claim.id,
      reference: claim.reference,
      category: claim.category,
      subject: claim.subject,
      description: claim.description,
      status: claim.status,
      priority: claim.priority,
      isAnonymous: claim.isAnonymous,
      targetDate: claim.targetDate,
      resolvedAt: claim.resolvedAt,
      resolutionNote: claim.resolutionNote,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
      collaboratorId: claim.collaboratorId,
      collaboratorName: (claim.isAnonymous && !manager)
        ? "Anonyme"
        : `${claim.collabFirstName ?? ""} ${claim.collabLastName ?? ""}`.trim(),
      assignedToId: claim.assignedToId,
      assignedToName: claim.assignedFirstName
        ? `${claim.assignedFirstName} ${claim.assignedLastName ?? ""}`.trim()
        : null,
      allowedTransitions,
      events,
      attachments,
    });
  } catch (e) { next(e); }
});

// ── PATCH /:id/status — changement de statut avec validation des transitions ──
router.patch("/hr/claims/:id/status", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;
    const { status: newStatus, comment, isInternal = false, resolutionNote } = req.body;

    if (!validateStatus(newStatus)) {
      return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(", ")}` });
    }

    const [existing] = await db
      .select({
        id: hrClaimsTable.id,
        status: hrClaimsTable.status,
        collaboratorId: hrClaimsTable.collaboratorId,
        reference: hrClaimsTable.reference,
        subject: hrClaimsTable.subject,
      })
      .from(hrClaimsTable)
      .where(and(
        eq(hrClaimsTable.id, req.params.id as string),
        eq(hrClaimsTable.organizationId, orgId),
      ))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Réclamation introuvable" });

    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return res.status(422).json({
        error: `Transition interdite : ${existing.status} → ${newStatus}`,
        allowedTransitions: allowed,
      });
    }

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "resolue" || newStatus === "refusee" || newStatus === "cloturee") {
      updates.resolvedAt = new Date();
    }
    if (resolutionNote !== undefined) updates.resolutionNote = resolutionNote;

    await db.update(hrClaimsTable).set(updates).where(eq(hrClaimsTable.id, existing.id));

    await db.insert(hrClaimEventsTable).values({
      organizationId: orgId,
      claimId: existing.id,
      authorId: userId,
      kind: "status_change",
      fromStatus: existing.status,
      toStatus: newStatus,
      content: comment ?? null,
      isInternal: Boolean(isInternal),
    });

    // Notify collaborator (non-blocking)
    notifyCollaborator(orgId, existing.collaboratorId, existing.id, existing.reference, newStatus).catch(() => { /* non-blocking */ });

    const [updated] = await db.select().from(hrClaimsTable).where(eq(hrClaimsTable.id, existing.id)).limit(1);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── PATCH /:id — mise à jour générale (assignment, priority, targetDate) ──────
router.patch("/hr/claims/:id", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;

    const [existing] = await db
      .select({ id: hrClaimsTable.id, status: hrClaimsTable.status })
      .from(hrClaimsTable)
      .where(and(
        eq(hrClaimsTable.id, req.params.id as string),
        eq(hrClaimsTable.organizationId, orgId),
      ))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Réclamation introuvable" });

    const { assignedToId, targetDate, priority, comment, isInternal = false } = req.body;
    const updates: Record<string, unknown> = {};
    if (assignedToId !== undefined) updates.assignedToId = assignedToId || null;
    if (targetDate !== undefined) updates.targetDate = targetDate || null;
    if (priority) updates.priority = priority;

    if (Object.keys(updates).length > 0) {
      await db.update(hrClaimsTable).set(updates).where(eq(hrClaimsTable.id, existing.id));
    }

    if (comment?.trim()) {
      await db.insert(hrClaimEventsTable).values({
        organizationId: orgId,
        claimId: existing.id,
        authorId: userId,
        kind: "comment",
        content: comment.trim(),
        isInternal: Boolean(isInternal),
      });
    }

    const [updated] = await db.select().from(hrClaimsTable).where(eq(hrClaimsTable.id, existing.id)).limit(1);
    res.json(updated);
  } catch (e) { next(e); }
});

// ── Shared comment handler (POST /:id/events et /:id/comments) ───────────────
async function handleAddComment(req: any, res: any, next: any) {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;
    const manager = await isHrManager(userId);

    const [claim] = await db
      .select({ id: hrClaimsTable.id, collaboratorId: hrClaimsTable.collaboratorId })
      .from(hrClaimsTable)
      .where(and(
        eq(hrClaimsTable.id, req.params.id as string),
        eq(hrClaimsTable.organizationId, orgId),
      ))
      .limit(1);

    if (!claim) return res.status(404).json({ error: "Réclamation introuvable" });

    if (!manager) {
      const ownCollabId = await getCollaboratorForUser(userId, orgId);
      if (ownCollabId !== claim.collaboratorId) {
        return res.status(403).json({ error: "Accès interdit" });
      }
    }

    const { content, isInternal = false } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Le contenu du commentaire est requis" });

    const [event] = await db.insert(hrClaimEventsTable).values({
      organizationId: orgId,
      claimId: claim.id,
      authorId: userId,
      kind: "comment",
      content: content.trim(),
      isInternal: manager ? Boolean(isInternal) : false,
    }).returning();

    res.status(201).json(event);
  } catch (e) { next(e); }
}

// ── POST /:id/events ──────────────────────────────────────────────────────────
router.post("/hr/claims/:id/events", handleAddComment);

// ── POST /:id/comments — alias requis par le contrat API ─────────────────────
router.post("/hr/claims/:id/comments", handleAddComment);

// ── GET /:id/attachments ──────────────────────────────────────────────────────
router.get("/hr/claims/:id/attachments", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;
    const manager = await isHrManager(userId);

    const [claim] = await db
      .select({ id: hrClaimsTable.id, collaboratorId: hrClaimsTable.collaboratorId })
      .from(hrClaimsTable)
      .where(and(
        eq(hrClaimsTable.id, req.params.id as string),
        eq(hrClaimsTable.organizationId, orgId),
      ))
      .limit(1);

    if (!claim) return res.status(404).json({ error: "Réclamation introuvable" });

    if (!manager) {
      const ownCollabId = await getCollaboratorForUser(userId, orgId);
      if (ownCollabId !== claim.collaboratorId) return res.status(403).json({ error: "Accès interdit" });
    }

    const attachments = await db
      .select({
        id: hrClaimAttachmentsTable.id,
        fileName: hrClaimAttachmentsTable.fileName,
        fileUrl: hrClaimAttachmentsTable.fileUrl,
        mimeType: hrClaimAttachmentsTable.mimeType,
        size: hrClaimAttachmentsTable.size,
        createdAt: hrClaimAttachmentsTable.createdAt,
        uploadedById: hrClaimAttachmentsTable.uploadedById,
        uploaderFirstName: usersTable.firstName,
        uploaderLastName: usersTable.lastName,
      })
      .from(hrClaimAttachmentsTable)
      .leftJoin(usersTable, eq(hrClaimAttachmentsTable.uploadedById, usersTable.id))
      .where(and(
        eq(hrClaimAttachmentsTable.claimId, claim.id),
        eq(hrClaimAttachmentsTable.organizationId, orgId),
      ))
      .orderBy(hrClaimAttachmentsTable.createdAt);

    res.json(attachments.map(a => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
      uploadedById: a.uploadedById,
      uploaderName: a.uploaderFirstName
        ? `${a.uploaderFirstName} ${a.uploaderLastName ?? ""}`.trim()
        : null,
    })));
  } catch (e) { next(e); }
});

// ── POST /:id/attachments ─────────────────────────────────────────────────────
router.post("/hr/claims/:id/attachments", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;
    const manager = await isHrManager(userId);

    const [claim] = await db
      .select({ id: hrClaimsTable.id, collaboratorId: hrClaimsTable.collaboratorId, status: hrClaimsTable.status })
      .from(hrClaimsTable)
      .where(and(
        eq(hrClaimsTable.id, req.params.id as string),
        eq(hrClaimsTable.organizationId, orgId),
      ))
      .limit(1);

    if (!claim) return res.status(404).json({ error: "Réclamation introuvable" });

    if (!manager) {
      const ownCollabId = await getCollaboratorForUser(userId, orgId);
      if (ownCollabId !== claim.collaboratorId) return res.status(403).json({ error: "Accès interdit" });
      if (["cloturee", "resolue", "refusee"].includes(claim.status)) {
        return res.status(422).json({ error: "Impossible d'ajouter une pièce jointe à une réclamation clôturée/résolue/refusée" });
      }
    }

    const { fileName, fileUrl, mimeType, size } = req.body;
    if (!fileName || !fileUrl) {
      return res.status(400).json({ error: "fileName et fileUrl sont requis" });
    }

    const [attachment] = await db.insert(hrClaimAttachmentsTable).values({
      organizationId: orgId,
      claimId: claim.id,
      uploadedById: userId,
      fileName,
      fileUrl,
      mimeType: mimeType ?? null,
      size: size ? Number(size) : null,
    }).returning();

    // Add timeline event
    await db.insert(hrClaimEventsTable).values({
      organizationId: orgId,
      claimId: claim.id,
      authorId: userId,
      kind: "attachment",
      content: `Pièce jointe ajoutée : ${fileName}`,
      isInternal: false,
    });

    res.status(201).json(attachment);
  } catch (e) { next(e); }
});

// ── Notification helpers ──────────────────────────────────────────────────────

async function notifyHrManagers(
  orgId: string, excludeUserId: string, claimId: string, reference: string, subject: string,
) {
  const managers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      eq(usersTable.organizationId, orgId),
      sql`${usersTable.role} IN ('admin', 'super_admin', 'manager')`,
      sql`${usersTable.id} != ${excludeUserId}`,
    ));

  if (managers.length === 0) return;

  await db.insert(notificationsTable).values(
    managers.map(m => ({
      organizationId: orgId,
      userId: m.id,
      title: "Nouvelle réclamation RH",
      body: `Réf. ${reference} — ${subject}`,
      type: "hr_claim",
      entityType: "hr_claim",
      entityId: claimId,
    }))
  );
}

async function notifyCollaborator(
  orgId: string, collaboratorId: string, claimId: string, reference: string, newStatus: string,
) {
  const [collab] = await db
    .select({ userId: collaboratorsTable.userId })
    .from(collaboratorsTable)
    .where(eq(collaboratorsTable.id, collaboratorId))
    .limit(1);

  if (!collab?.userId) return;

  await db.insert(notificationsTable).values({
    organizationId: orgId,
    userId: collab.userId as string,
    title: "Mise à jour de votre réclamation",
    body: `${reference} — ${STATUS_LABELS[newStatus] ?? newStatus}`,
    type: "hr_claim",
    entityType: "hr_claim",
    entityId: claimId,
  });
}

export default router;
