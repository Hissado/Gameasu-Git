/**
 * Cockpit Admin — routes étendues pour le Gaméasù Cockpit.
 * Toutes les routes exigent le rôle super_admin (middleware `sa`).
 *
 *  GET  /super-admin/tickets              — tous les tickets (cross-tenant)
 *  PATCH /super-admin/tickets/:id         — changer status/priority/assignee
 *  POST  /super-admin/tickets/:id/comments — ajouter un commentaire
 *  GET  /super-admin/incidents            — liste incidents plateforme
 *  POST /super-admin/incidents            — créer un incident
 *  PATCH /super-admin/incidents/:id       — mettre à jour un incident
 *  GET  /super-admin/audit-logs           — journal d'audit cockpit
 *  POST /super-admin/audit-logs           — enregistrer une action
 *  GET  /super-admin/health               — métriques santé système
 */
import { Router, type IRouter, type RequestHandler } from "express";
import {
  db,
  ticketsTable,
  organizationsTable,
  usersTable,
  ticketCommentsTable,
  incidentsTable,
  cockpitAuditLogsTable,
} from "@workspace/db";
import { eq, desc, and, sql, gte } from "drizzle-orm";

const router: IRouter = Router();

const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") {
    res.status(403).json({ error: "Accès réservé aux super-administrateurs" });
    return;
  }
  next();
};

async function recordAudit(actorId: string | null, actorEmail: string | null, action: string, resource: string, resourceId?: string, metadata?: unknown) {
  try {
    await db.insert(cockpitAuditLogsTable).values({
      actorId: actorId ?? undefined,
      actorEmail: actorEmail ?? undefined,
      action,
      resource,
      resourceId: resourceId ?? undefined,
      metadata: metadata as any ?? undefined,
    });
  } catch {
    // non-fatal
  }
}

// ── Tickets cross-tenant ──────────────────────────────────────────────────────

router.get("/super-admin/tickets", sa, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: ticketsTable.id,
        subject: ticketsTable.subject,
        category: ticketsTable.category,
        priority: ticketsTable.priority,
        status: ticketsTable.status,
        createdAt: ticketsTable.createdAt,
        updatedAt: ticketsTable.updatedAt,
        resolvedAt: ticketsTable.resolvedAt,
        orgId: organizationsTable.id,
        orgName: organizationsTable.name,
        orgSlug: organizationsTable.slug,
        createdByName: usersTable.name,
        createdByEmail: usersTable.email,
      })
      .from(ticketsTable)
      .leftJoin(organizationsTable, eq(organizationsTable.id, ticketsTable.organizationId))
      .leftJoin(usersTable, eq(usersTable.id, ticketsTable.createdById))
      .orderBy(desc(ticketsTable.createdAt));

    const commentCounts = await db
      .select({
        ticketId: ticketCommentsTable.ticketId,
        c: sql<number>`count(*)::int`,
      })
      .from(ticketCommentsTable)
      .groupBy(ticketCommentsTable.ticketId);
    const commentMap = new Map(commentCounts.map((r) => [r.ticketId, r.c]));

    return res.json({
      count: rows.length,
      rows: rows.map((r) => ({ ...r, commentCount: commentMap.get(r.id) ?? 0 })),
    });
  } catch (e) { next(e); }
});

router.patch("/super-admin/tickets/:id", sa, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, priority, assigneeId } = req.body as { status?: string; priority?: string; assigneeId?: string | null };
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (status) {
      update.status = status;
      if (status === "resolved") update.resolvedAt = new Date();
      if (status === "open" || status === "in_progress") update.resolvedAt = null;
    }
    if (priority) update.priority = priority;
    if (assigneeId !== undefined) update.assigneeId = assigneeId ?? null;

    await db.update(ticketsTable).set(update as any).where(eq(ticketsTable.id, id));
    await recordAudit(req.authUser!.id, req.authUser!.email, "ticket.update", "ticket", id, update);
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post("/super-admin/tickets/:id/comments", sa, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body } = req.body as { body: string };
    if (!body?.trim()) { res.status(400).json({ error: "Le commentaire ne peut pas être vide" }); return; }
    const [comment] = await db.insert(ticketCommentsTable).values({
      ticketId: id,
      authorId: req.authUser!.id,
      body: body.trim(),
    }).returning();
    await recordAudit(req.authUser!.id, req.authUser!.email, "ticket.comment", "ticket", id);
    return res.status(201).json(comment);
  } catch (e) { next(e); }
});

router.get("/super-admin/tickets/:id/comments", sa, async (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = await db
      .select({
        id: ticketCommentsTable.id,
        body: ticketCommentsTable.body,
        createdAt: ticketCommentsTable.createdAt,
        authorName: usersTable.name,
        authorEmail: usersTable.email,
      })
      .from(ticketCommentsTable)
      .leftJoin(usersTable, eq(usersTable.id, ticketCommentsTable.authorId))
      .where(eq(ticketCommentsTable.ticketId, id))
      .orderBy(ticketCommentsTable.createdAt);
    return res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

// ── Incidents ─────────────────────────────────────────────────────────────────

router.get("/super-admin/incidents", sa, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: incidentsTable.id,
        title: incidentsTable.title,
        description: incidentsTable.description,
        severity: incidentsTable.severity,
        status: incidentsTable.status,
        affectedServices: incidentsTable.affectedServices,
        resolvedAt: incidentsTable.resolvedAt,
        createdAt: incidentsTable.createdAt,
        updatedAt: incidentsTable.updatedAt,
        createdByName: usersTable.name,
      })
      .from(incidentsTable)
      .leftJoin(usersTable, eq(usersTable.id, incidentsTable.createdById))
      .orderBy(desc(incidentsTable.createdAt));
    return res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

router.post("/super-admin/incidents", sa, async (req, res, next) => {
  try {
    const { title, description, severity, affectedServices } = req.body as {
      title: string; description?: string; severity?: string; affectedServices?: string;
    };
    if (!title?.trim()) { res.status(400).json({ error: "Le titre est requis" }); return; }
    const [row] = await db.insert(incidentsTable).values({
      title: title.trim(),
      description: description?.trim() ?? undefined,
      severity: severity ?? "medium",
      affectedServices: affectedServices?.trim() ?? undefined,
      createdById: req.authUser!.id,
    }).returning();
    await recordAudit(req.authUser!.id, req.authUser!.email, "incident.create", "incident", row.id, { title, severity });
    return res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch("/super-admin/incidents/:id", sa, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, severity, description, affectedServices } = req.body as {
      status?: string; severity?: string; description?: string; affectedServices?: string;
    };
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (status) {
      update.status = status;
      if (status === "resolved") update.resolvedAt = new Date();
    }
    if (severity) update.severity = severity;
    if (description !== undefined) update.description = description;
    if (affectedServices !== undefined) update.affectedServices = affectedServices;

    await db.update(incidentsTable).set(update as any).where(eq(incidentsTable.id, id));
    await recordAudit(req.authUser!.id, req.authUser!.email, "incident.update", "incident", id, update);
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Audit logs ────────────────────────────────────────────────────────────────

router.get("/super-admin/audit-logs", sa, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db
      .select({
        id: cockpitAuditLogsTable.id,
        action: cockpitAuditLogsTable.action,
        resource: cockpitAuditLogsTable.resource,
        resourceId: cockpitAuditLogsTable.resourceId,
        metadata: cockpitAuditLogsTable.metadata,
        createdAt: cockpitAuditLogsTable.createdAt,
        actorEmail: cockpitAuditLogsTable.actorEmail,
        actorName: usersTable.name,
      })
      .from(cockpitAuditLogsTable)
      .leftJoin(usersTable, eq(usersTable.id, cockpitAuditLogsTable.actorId))
      .orderBy(desc(cockpitAuditLogsTable.createdAt))
      .limit(limit);

    const [total] = await db.select({ c: sql<number>`count(*)::int` }).from(cockpitAuditLogsTable);
    return res.json({ total: total?.c ?? 0, rows });
  } catch (e) { next(e); }
});

router.post("/super-admin/audit-logs", sa, async (req, res, next) => {
  try {
    const { action, resource, resourceId, metadata } = req.body as {
      action: string; resource: string; resourceId?: string; metadata?: unknown;
    };
    if (!action || !resource) { res.status(400).json({ error: "action et resource sont requis" }); return; }
    await recordAudit(req.authUser!.id, req.authUser!.email, action, resource, resourceId, metadata);
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── System health ─────────────────────────────────────────────────────────────

router.get("/super-admin/health", sa, async (_req, res, next) => {
  try {
    const since24h = new Date(Date.now() - 24 * 3600_000);
    const since1h = new Date(Date.now() - 3600_000);

    const [dbCheck] = await db.select({ now: sql<string>`now()::text` }).from(ticketsTable).limit(1).catch(() => [null]);

    const [openTickets] = await db.select({ c: sql<number>`count(*)::int` }).from(ticketsTable).where(eq(ticketsTable.status, "open"));
    const [openIncidents] = await db.select({ c: sql<number>`count(*)::int` }).from(incidentsTable).where(and(eq(incidentsTable.status, "open")));
    const [criticalIncidents] = await db.select({ c: sql<number>`count(*)::int` }).from(incidentsTable)
      .where(and(eq(incidentsTable.status, "open"), eq(incidentsTable.severity, "critical")));

    const [auditLast24h] = await db.select({ c: sql<number>`count(*)::int` }).from(cockpitAuditLogsTable).where(gte(cockpitAuditLogsTable.createdAt, since24h));
    const [auditLast1h] = await db.select({ c: sql<number>`count(*)::int` }).from(cockpitAuditLogsTable).where(gte(cockpitAuditLogsTable.createdAt, since1h));

    return res.json({
      status: criticalIncidents?.c ? "degraded" : openIncidents?.c ? "warning" : "healthy",
      database: { ok: !!dbCheck },
      uptime: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1_048_576),
      openTickets: openTickets?.c ?? 0,
      openIncidents: openIncidents?.c ?? 0,
      criticalIncidents: criticalIncidents?.c ?? 0,
      auditLast24h: auditLast24h?.c ?? 0,
      auditLast1h: auditLast1h?.c ?? 0,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) { next(e); }
});

export default router;
