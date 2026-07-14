import { Router } from "express";
import {
  db, hrClaimsTable, hrClaimEventsTable, collaboratorsTable, usersTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";

const router = Router();

function requireHrManage(req: any, res: any, next: any) {
  const role = req.user?.role;
  if (!["admin", "super_admin", "manager"].includes(role) && !req.user?.permissions?.includes("hr.manage")) {
    return res.status(403).json({ error: "Accès réservé aux gestionnaires RH" });
  }
  next();
}

async function getCollaboratorForUser(userId: string, orgId: string) {
  const rows = await db
    .select({ id: collaboratorsTable.id })
    .from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.userId, userId as any), eq(collaboratorsTable.organizationId, orgId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

function generateReference(seq: number) {
  const year = new Date().getFullYear();
  return `REC-${year}-${String(seq).padStart(4, "0")}`;
}

// ── GET /api/hr/claims/stats ──────────────────────────────────────────────────
router.get("/api/hr/claims/stats", requireHrManage, async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId;

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

// ── GET /api/hr/claims ────────────────────────────────────────────────────────
router.get("/api/hr/claims", async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const isManager = ["admin", "super_admin", "manager"].includes(req.user!.role ?? "");

    const { status, category, priority, limit = "50", offset = "0" } = req.query as Record<string, string>;

    let collaboratorId: string | null = null;
    if (!isManager) {
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
      collaboratorName: (r.isAnonymous && !isManager)
        ? "Anonyme"
        : `${r.collaboratorFirstName ?? ""} ${r.collaboratorLastName ?? ""}`.trim(),
      collaboratorFirstName: undefined,
      collaboratorLastName: undefined,
    }));

    res.json({ data, total: data.length });
  } catch (e) { next(e); }
});

// ── POST /api/hr/claims ───────────────────────────────────────────────────────
router.post("/api/hr/claims", async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;

    const { category, subject, description, priority = "normale", isAnonymous = false, targetDate } = req.body;
    if (!category || !subject || !description) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    // Déterminer le collaboratorId (manager peut soumettre pour un autre)
    let collaboratorId: string | null = req.body.collaboratorId ?? null;
    if (!collaboratorId) {
      collaboratorId = await getCollaboratorForUser(userId, orgId);
    }
    if (!collaboratorId) {
      return res.status(400).json({ error: "Profil collaborateur introuvable" });
    }

    // Générer la référence
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

    // Événement initial
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

    // Notification aux managers RH
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
            body: `Référence ${reference} — ${subject}`,
            type: "hr_claim",
            entityType: "hr_claim",
            entityId: claim.id,
          }))
        );
      }
    } catch { /* non bloquant */ }

    res.status(201).json(claim);
  } catch (e) { next(e); }
});

// ── GET /api/hr/claims/:id ────────────────────────────────────────────────────
router.get("/api/hr/claims/:id", async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const isManager = ["admin", "super_admin", "manager"].includes(req.user!.role ?? "");

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

    // Contrôle accès : collaborateur ne voit que ses propres réclamations
    if (!isManager) {
      const collabId = await getCollaboratorForUser(userId, orgId);
      if (collabId !== claim.collaboratorId) return res.status(403).json({ error: "Accès interdit" });
    }

    // Événements (filtrer les internes pour les non-managers)
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

    const events = isManager ? allEvents : allEvents.filter(e => !e.isInternal);

    res.json({
      ...claim,
      collaboratorName: (claim.isAnonymous && !isManager)
        ? "Anonyme"
        : `${claim.collaboratorFirstName ?? ""} ${claim.collaboratorLastName ?? ""}`.trim(),
      collaboratorFirstName: undefined,
      collaboratorLastName: undefined,
      events,
    });
  } catch (e) { next(e); }
});

// ── PATCH /api/hr/claims/:id ──────────────────────────────────────────────────
router.patch("/api/hr/claims/:id", requireHrManage, async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;

    const [existing] = await db
      .select({ id: hrClaimsTable.id, status: hrClaimsTable.status })
      .from(hrClaimsTable)
      .where(and(eq(hrClaimsTable.id, req.params.id as string), eq(hrClaimsTable.organizationId, orgId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Réclamation introuvable" });

    const { status, assignedToId, targetDate, resolutionNote, priority, comment, isInternal = false } = req.body;

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (assignedToId !== undefined) updates.assignedToId = assignedToId;
    if (targetDate !== undefined) updates.targetDate = targetDate;
    if (resolutionNote !== undefined) updates.resolutionNote = resolutionNote;
    if (priority) updates.priority = priority;
    if (status === "resolue" || status === "refusee") updates.resolvedAt = new Date();

    if (Object.keys(updates).length > 0) {
      await db.update(hrClaimsTable).set(updates).where(eq(hrClaimsTable.id, existing.id));
    }

    // Événement de changement de statut
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

      // Notifier le collaborateur
      try {
        const [claimFull] = await db
          .select({ collaboratorId: hrClaimsTable.collaboratorId, reference: hrClaimsTable.reference, subject: hrClaimsTable.subject })
          .from(hrClaimsTable)
          .where(eq(hrClaimsTable.id, existing.id))
          .limit(1);

        if (claimFull) {
          const [collabUser] = await db
            .select({ userId: collaboratorsTable.userId })
            .from(collaboratorsTable)
            .where(eq(collaboratorsTable.id, claimFull.collaboratorId))
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
              userId: collabUser.userId,
              title: "Mise à jour de votre réclamation",
              body: `${claimFull.reference} — ${STATUS_LABELS[status] ?? status}`,
              type: "hr_claim",
              entityType: "hr_claim",
              entityId: existing.id,
            });
          }
        }
      } catch { /* non bloquant */ }
    } else if (comment) {
      // Simple commentaire sans changement de statut
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

// ── POST /api/hr/claims/:id/events ────────────────────────────────────────────
router.post("/api/hr/claims/:id/events", async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const isManager = ["admin", "super_admin", "manager"].includes(req.user!.role ?? "");

    const [claim] = await db
      .select({ id: hrClaimsTable.id, collaboratorId: hrClaimsTable.collaboratorId })
      .from(hrClaimsTable)
      .where(and(eq(hrClaimsTable.id, req.params.id as string), eq(hrClaimsTable.organizationId, orgId)))
      .limit(1);

    if (!claim) return res.status(404).json({ error: "Réclamation introuvable" });

    // Vérification accès collaborateur
    if (!isManager) {
      const collabId = await getCollaboratorForUser(userId, orgId);
      if (collabId !== claim.collaboratorId) return res.status(403).json({ error: "Accès interdit" });
    }

    const { content, isInternal = false } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Contenu requis" });

    const [event] = await db.insert(hrClaimEventsTable).values({
      organizationId: orgId,
      claimId: claim.id,
      authorId: userId,
      kind: "comment",
      content: content.trim(),
      isInternal: isManager ? Boolean(isInternal) : false,
    }).returning();

    res.status(201).json(event);
  } catch (e) { next(e); }
});

export default router;
