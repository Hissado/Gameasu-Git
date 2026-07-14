import { Router } from "express";
import { requireManagerOrAbove } from "../middlewares/auth";
import {
  db, hrClaimsTable, hrClaimEventsTable, collaboratorsTable, usersTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function isManagerRole(role: string | null | undefined) {
  return ["admin", "super_admin", "manager", "owner"].includes(role ?? "");
}

async function getCollaboratorForUser(userId: string, orgId: string): Promise<string | null> {
  const rows = await db
    .select({ id: collaboratorsTable.id })
    .from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.userId as any, userId), eq(collaboratorsTable.organizationId, orgId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

function generateReference(seq: number): string {
  const year = new Date().getFullYear();
  return `REC-${year}-${String(seq).padStart(4, "0")}`;
}

// ── GET /hr/claims/stats ──────────────────────────────────────────────────────
router.get("/hr/claims/stats", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;

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

    res.json({
      total: Number(totRow?.total ?? 0),
      byStatus: byStatus.map(r => ({ status: r.status, count: Number(r.cnt) })),
      byCategory: byCategory.map(r => ({ category: r.category, count: Number(r.cnt) })),
      byPriority: byPriority.map(r => ({ priority: r.priority, count: Number(r.cnt) })),
    });
  } catch (e) { next(e); }
});

// ── GET /hr/claims ────────────────────────────────────────────────────────────
router.get("/hr/claims", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId, role, orgRole } = req.authUser!;
    const manager = isManagerRole(role) || isManagerRole(orgRole);

    const { status, category, priority, limit = "50", offset = "0" } = req.query as Record<string, string>;

    // Non-managers only see their own claims
    let collaboratorId: string | null = null;
    if (!manager) {
      collaboratorId = await getCollaboratorForUser(userId, orgId);
      if (!collaboratorId) return res.json({ data: [], total: 0 });
    }

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
        collaboratorFirstName: collaboratorsTable.firstName,
        collaboratorLastName: collaboratorsTable.lastName,
        assignedToId: hrClaimsTable.assignedToId,
        assignedToName: usersTable.name,
      })
      .from(hrClaimsTable)
      .leftJoin(collaboratorsTable, eq(hrClaimsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(usersTable, eq(hrClaimsTable.assignedToId, usersTable.id))
      .where(and(
        eq(hrClaimsTable.organizationId, orgId),
        collaboratorId ? eq(hrClaimsTable.collaboratorId, collaboratorId) : undefined,
        status ? eq(hrClaimsTable.status, status) : undefined,
        category ? eq(hrClaimsTable.category, category) : undefined,
        priority ? eq(hrClaimsTable.priority, priority) : undefined,
      ))
      .orderBy(desc(hrClaimsTable.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const data = rows.map(r => ({
      ...r,
      collaboratorName: (r.isAnonymous && !manager)
        ? "Anonyme"
        : `${r.collaboratorFirstName ?? ""} ${r.collaboratorLastName ?? ""}`.trim(),
      collaboratorFirstName: undefined,
      collaboratorLastName: undefined,
    }));

    res.json({ data, total: data.length });
  } catch (e) { next(e); }
});

// ── POST /hr/claims ───────────────────────────────────────────────────────────
router.post("/hr/claims", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId, role, orgRole } = req.authUser!;
    const manager = isManagerRole(role) || isManagerRole(orgRole);

    const { category, subject, description, priority = "normale", isAnonymous = false, targetDate } = req.body;
    if (!category || !subject || !description) {
      return res.status(400).json({ error: "Champs obligatoires manquants (catégorie, objet, description)" });
    }

    // collaboratorId resolution — security: non-managers are forced to their own profile
    let collaboratorId: string | null = null;
    if (manager && req.body.collaboratorId) {
      // Manager submitting for another collaborator — verify it belongs to the org
      const [check] = await db
        .select({ id: collaboratorsTable.id })
        .from(collaboratorsTable)
        .where(and(eq(collaboratorsTable.id, req.body.collaboratorId as string), eq(collaboratorsTable.organizationId, orgId)))
        .limit(1);
      if (!check) return res.status(400).json({ error: "Collaborateur introuvable dans cette organisation" });
      collaboratorId = check.id;
    } else {
      // Regular employee — always their own collaborator profile
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
    const seq = Number(cntRow?.cnt ?? 0) + 1;
    const reference = generateReference(seq);

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
    try {
      const managers = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(
          eq(usersTable.organizationId, orgId),
          sql`${usersTable.role} IN ('admin', 'super_admin', 'manager')`,
        ));

      if (managers.length > 0) {
        await db.insert(notificationsTable).values(
          managers.map(m => ({
            organizationId: orgId,
            userId: m.id,
            title: "Nouvelle réclamation RH",
            body: `Réf. ${reference} — ${subject}`,
            type: "hr_claim",
            entityType: "hr_claim",
            entityId: claim.id,
          }))
        );
      }
    } catch { /* non-blocking */ }

    res.status(201).json(claim);
  } catch (e) { next(e); }
});

// ── GET /hr/claims/:id ────────────────────────────────────────────────────────
router.get("/hr/claims/:id", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId, role, orgRole } = req.authUser!;
    const manager = isManagerRole(role) || isManagerRole(orgRole);

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
        collaboratorFirstName: collaboratorsTable.firstName,
        collaboratorLastName: collaboratorsTable.lastName,
        assignedToId: hrClaimsTable.assignedToId,
        assignedToName: usersTable.name,
      })
      .from(hrClaimsTable)
      .leftJoin(collaboratorsTable, eq(hrClaimsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(usersTable, eq(hrClaimsTable.assignedToId, usersTable.id))
      .where(and(eq(hrClaimsTable.id, req.params.id as string), eq(hrClaimsTable.organizationId, orgId)))
      .limit(1);

    if (!claim) return res.status(404).json({ error: "Réclamation introuvable" });

    // Access control: non-managers can only view their own claims
    if (!manager) {
      const collabId = await getCollaboratorForUser(userId, orgId);
      if (collabId !== claim.collaboratorId) {
        return res.status(403).json({ error: "Accès interdit" });
      }
    }

    // Timeline events (internal notes filtered for non-managers)
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
        authorName: usersTable.name,
      })
      .from(hrClaimEventsTable)
      .leftJoin(usersTable, eq(hrClaimEventsTable.authorId, usersTable.id))
      .where(and(
        eq(hrClaimEventsTable.claimId, claim.id),
        eq(hrClaimEventsTable.organizationId, orgId),
      ))
      .orderBy(hrClaimEventsTable.createdAt);

    const events = manager ? allEvents : allEvents.filter(e => !e.isInternal);

    res.json({
      ...claim,
      collaboratorName: (claim.isAnonymous && !manager)
        ? "Anonyme"
        : `${claim.collaboratorFirstName ?? ""} ${claim.collaboratorLastName ?? ""}`.trim(),
      collaboratorFirstName: undefined,
      collaboratorLastName: undefined,
      events,
    });
  } catch (e) { next(e); }
});

// ── PATCH /hr/claims/:id ──────────────────────────────────────────────────────
router.patch("/hr/claims/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId } = req.authUser!;

    const [existing] = await db
      .select({ id: hrClaimsTable.id, status: hrClaimsTable.status, collaboratorId: hrClaimsTable.collaboratorId, reference: hrClaimsTable.reference, subject: hrClaimsTable.subject })
      .from(hrClaimsTable)
      .where(and(eq(hrClaimsTable.id, req.params.id as string), eq(hrClaimsTable.organizationId, orgId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Réclamation introuvable" });

    const { status, assignedToId, targetDate, resolutionNote, priority, comment, isInternal = false } = req.body;

    const updates: Record<string, unknown> = {};
    if (status && status !== existing.status) updates.status = status;
    if (assignedToId !== undefined) updates.assignedToId = assignedToId || null;
    if (targetDate !== undefined) updates.targetDate = targetDate || null;
    if (resolutionNote !== undefined) updates.resolutionNote = resolutionNote;
    if (priority) updates.priority = priority;
    if (status === "resolue" || status === "refusee") updates.resolvedAt = new Date();

    if (Object.keys(updates).length > 0) {
      await db.update(hrClaimsTable).set(updates).where(eq(hrClaimsTable.id, existing.id));
    }

    // Create timeline event
    if (status && status !== existing.status) {
      await db.insert(hrClaimEventsTable).values({
        organizationId: orgId,
        claimId: existing.id,
        authorId: userId,
        kind: "status_change",
        fromStatus: existing.status,
        toStatus: status,
        content: comment ?? null,
        isInternal: Boolean(isInternal),
      });

      // Notify the collaborator (non-blocking)
      try {
        const [collabUser] = await db
          .select({ userId: collaboratorsTable.userId })
          .from(collaboratorsTable)
          .where(eq(collaboratorsTable.id, existing.collaboratorId))
          .limit(1);

        if (collabUser?.userId) {
          const STATUS_LABELS: Record<string, string> = {
            en_cours: "En cours d'analyse",
            infos_complementaires: "Informations complémentaires requises",
            en_traitement: "En traitement",
            resolue: "Résolue",
            refusee: "Refusée",
            cloturee: "Clôturée",
          };
          await db.insert(notificationsTable).values({
            organizationId: orgId,
            userId: collabUser.userId as string,
            title: "Mise à jour de votre réclamation",
            body: `${existing.reference} — ${STATUS_LABELS[status] ?? status}`,
            type: "hr_claim",
            entityType: "hr_claim",
            entityId: existing.id,
          });
        }
      } catch { /* non-blocking */ }
    } else if (comment) {
      // Comment without status change
      await db.insert(hrClaimEventsTable).values({
        organizationId: orgId,
        claimId: existing.id,
        authorId: userId,
        kind: "comment",
        content: comment,
        isInternal: Boolean(isInternal),
      });
    }

    const [updated] = await db
      .select()
      .from(hrClaimsTable)
      .where(eq(hrClaimsTable.id, existing.id))
      .limit(1);

    res.json(updated);
  } catch (e) { next(e); }
});

// ── POST /hr/claims/:id/events (commentaire libre) ────────────────────────────
router.post("/hr/claims/:id/events", async (req, res, next) => {
  try {
    const { organizationId: orgId, id: userId, role, orgRole } = req.authUser!;
    const manager = isManagerRole(role) || isManagerRole(orgRole);

    const [claim] = await db
      .select({ id: hrClaimsTable.id, collaboratorId: hrClaimsTable.collaboratorId })
      .from(hrClaimsTable)
      .where(and(eq(hrClaimsTable.id, req.params.id as string), eq(hrClaimsTable.organizationId, orgId)))
      .limit(1);

    if (!claim) return res.status(404).json({ error: "Réclamation introuvable" });

    // Non-managers can only comment on their own claims
    if (!manager) {
      const collabId = await getCollaboratorForUser(userId, orgId);
      if (collabId !== claim.collaboratorId) {
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
});

export default router;
