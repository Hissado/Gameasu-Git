/**
 * Cockpit Admin — routes étendues pour le Gameasu Cockpit.
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
  expertFirmsTable,
  expertFirmMembersTable,
  expertClientAccessTable,
  documentRequestsTable,
  expertFirmInvitationsTable,
} from "@workspace/db";
import { eq, desc, and, sql, gte, isNull } from "drizzle-orm";
import crypto from "node:crypto";
import { buildExpertFirmInvitationEmail, sendEmail } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";

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
        createdByName: sql<string>`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
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
    const { id } = req.params as Record<string, string>;
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
    const { id } = req.params as Record<string, string>;
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
    const { id } = req.params as Record<string, string>;
    const rows = await db
      .select({
        id: ticketCommentsTable.id,
        body: ticketCommentsTable.body,
        createdAt: ticketCommentsTable.createdAt,
        authorName: sql<string>`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
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
        createdByName: sql<string>`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
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
    const { id } = req.params as Record<string, string>;
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
    const limit = Math.min(Number((req.query.limit as string)) || 50, 200);
    const rows = await db
      .select({
        id: cockpitAuditLogsTable.id,
        action: cockpitAuditLogsTable.action,
        resource: cockpitAuditLogsTable.resource,
        resourceId: cockpitAuditLogsTable.resourceId,
        metadata: cockpitAuditLogsTable.metadata,
        createdAt: cockpitAuditLogsTable.createdAt,
        actorEmail: cockpitAuditLogsTable.actorEmail,
        actorName: sql<string>`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
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

// ── Expert Firms (cabinets) ───────────────────────────────────────────────────

// GET /super-admin/expert-firms — liste + KPIs globaux
router.get("/super-admin/expert-firms", sa, async (_req, res, next) => {
  try {
    const [totals] = await db
      .select({
        totalFirms: sql<number>`count(*)::int`,
        activeFirms: sql<number>`count(*) filter (where ${expertFirmsTable.isActive})::int`,
      })
      .from(expertFirmsTable);

    const [clientTotals] = await db
      .select({ totalClients: sql<number>`count(*)::int` })
      .from(expertClientAccessTable)
      .where(eq(expertClientAccessTable.isActive, true));

    const [docTotals] = await db
      .select({ pendingDocs: sql<number>`count(*)::int` })
      .from(documentRequestsTable)
      .where(eq(documentRequestsTable.status, "en_attente"));

    const firms = await db
      .select({
        id: expertFirmsTable.id,
        name: expertFirmsTable.name,
        slug: expertFirmsTable.slug,
        country: expertFirmsTable.country,
        email: expertFirmsTable.email,
        plan: expertFirmsTable.plan,
        isActive: expertFirmsTable.isActive,
        createdAt: expertFirmsTable.createdAt,
        memberCount: sql<number>`(select count(*)::int from expert_firm_members efm where efm.firm_id = ${expertFirmsTable.id})`,
        clientCount: sql<number>`(select count(*)::int from expert_client_access eca where eca.firm_id = ${expertFirmsTable.id} and eca.is_active = true)`,
        pendingDocCount: sql<number>`(select count(*)::int from document_requests dr where dr.firm_id = ${expertFirmsTable.id} and dr.status = 'en_attente')`,
      })
      .from(expertFirmsTable)
      .orderBy(desc(expertFirmsTable.createdAt));

    return res.json({
      kpis: {
        totalFirms: totals?.totalFirms ?? 0,
        activeFirms: totals?.activeFirms ?? 0,
        totalClients: clientTotals?.totalClients ?? 0,
        pendingDocs: docTotals?.pendingDocs ?? 0,
      },
      firms,
    });
  } catch (e) { next(e); }
});

// GET /super-admin/expert-firms/:id — détail d'un cabinet
router.get("/super-admin/expert-firms/:id", sa, async (req, res, next) => {
  try {
    const firmId = req.params.id as string;

    const [firm] = await db
      .select()
      .from(expertFirmsTable)
      .where(eq(expertFirmsTable.id, firmId))
      .limit(1);
    if (!firm) return res.status(404).json({ error: "Cabinet introuvable" });

    const members = await db
      .select({
        id: expertFirmMembersTable.id,
        userId: expertFirmMembersTable.userId,
        role: expertFirmMembersTable.role,
        invitedAt: expertFirmMembersTable.invitedAt,
        joinedAt: expertFirmMembersTable.joinedAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
      })
      .from(expertFirmMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, expertFirmMembersTable.userId))
      .where(eq(expertFirmMembersTable.firmId, firmId));

    const clients = await db
      .select({
        id: expertClientAccessTable.id,
        orgId: expertClientAccessTable.orgId,
        accessLevel: expertClientAccessTable.accessLevel,
        isActive: expertClientAccessTable.isActive,
        grantedAt: expertClientAccessTable.grantedAt,
        orgName: organizationsTable.name,
        orgCountry: organizationsTable.country,
      })
      .from(expertClientAccessTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, expertClientAccessTable.orgId))
      .where(eq(expertClientAccessTable.firmId, firmId))
      .orderBy(desc(expertClientAccessTable.grantedAt));

    const docs = await db
      .select({
        id: documentRequestsTable.id,
        title: documentRequestsTable.title,
        status: documentRequestsTable.status,
        dueDate: documentRequestsTable.dueDate,
        createdAt: documentRequestsTable.createdAt,
        orgId: documentRequestsTable.orgId,
        orgName: organizationsTable.name,
      })
      .from(documentRequestsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, documentRequestsTable.orgId))
      .where(and(eq(documentRequestsTable.firmId, firmId), isNull(documentRequestsTable.respondedAt)))
      .orderBy(desc(documentRequestsTable.createdAt))
      .limit(20);

    return res.json({ firm, members, clients, docs });
  } catch (e) { next(e); }
});

// POST /super-admin/expert-firms/invite — créer un cabinet + envoyer l'invitation
router.post("/super-admin/expert-firms/invite", sa, async (req, res, next) => {
  try {
    const {
      firmName,
      country = "TG",
      plan = "starter",
      adminFirstName,
      adminLastName,
      adminEmail,
    } = req.body as {
      firmName?: string;
      country?: string;
      plan?: string;
      adminFirstName?: string;
      adminLastName?: string;
      adminEmail?: string;
    };

    if (!firmName?.trim()) return res.status(400).json({ error: "firmName est requis." });
    if (!adminEmail?.trim()) return res.status(400).json({ error: "adminEmail est requis." });
    if (!adminFirstName?.trim() || !adminLastName?.trim()) {
      return res.status(400).json({ error: "adminFirstName et adminLastName sont requis." });
    }

    const email = adminEmail.trim().toLowerCase();

    // Vérifier que l'email n'est pas déjà utilisé
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (existing) {
      return res.status(409).json({ error: `Un compte existe déjà avec l'adresse ${email}.` });
    }

    // Générer un slug unique pour le cabinet
    const baseSlug = firmName.trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      const [dup] = await db
        .select({ id: expertFirmsTable.id })
        .from(expertFirmsTable)
        .where(eq(expertFirmsTable.slug, slug))
        .limit(1);
      if (!dup) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Créer le cabinet (inactif — activé lors de l'acceptation)
    const [firm] = await db
      .insert(expertFirmsTable)
      .values({
        name: firmName.trim(),
        slug,
        country,
        plan,
        email,
        isActive: false,
        createdById: req.authUser?.id ?? null,
      })
      .returning();

    // Créer l'invitation (72h)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await db.insert(expertFirmInvitationsTable).values({
      token,
      firmId: firm.id,
      email,
      status: "pending",
      invitedByAdminId: req.authUser?.id ?? null,
      expiresAt,
    });

    // Construire le lien et envoyer l'email
    const acceptUrl = `${getPublicBaseUrl()}/accept-expert-invitation?token=${token}`;
    const msg = buildExpertFirmInvitationEmail({ firmName: firm.name, plan: firm.plan, acceptUrl });
    msg.to = email;

    try {
      await sendEmail(msg);
    } catch (emailErr: any) {
      req.log?.warn({ err: emailErr }, "Expert firm invitation email failed");
      // Rollback: suppress the firm and invitation we just created so the admin
      // sees a real error and can retry with a valid email address.
      await db.delete(expertFirmInvitationsTable).where(eq(expertFirmInvitationsTable.firmId, firm.id));
      await db.delete(expertFirmsTable).where(eq(expertFirmsTable.id, firm.id));
      return res.status(502).json({
        error: "L'email d'invitation n'a pas pu être envoyé. Vérifiez l'adresse et réessayez.",
      });
    }

    await recordAudit(
      req.authUser?.id ?? null,
      req.authUser?.email ?? null,
      "invite_expert_firm",
      "expert_firm",
      firm.id,
      { firmName: firm.name, adminEmail: email, plan, country },
    );

    return res.status(201).json({
      firm: { id: firm.id, name: firm.name, slug: firm.slug, plan: firm.plan, isActive: firm.isActive },
      invitation: { email, expiresAt },
    });
  } catch (e) { next(e); }
});

// PATCH /super-admin/expert-firms/:id — activer / désactiver
router.patch("/super-admin/expert-firms/:id", sa, async (req, res, next) => {
  try {
    const firmId = req.params.id as string;
    const { isActive } = req.body as { isActive: unknown };
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive doit être un booléen (true ou false)" });
    }

    const [updated] = await db
      .update(expertFirmsTable)
      .set({ isActive: Boolean(isActive) })
      .where(eq(expertFirmsTable.id, firmId))
      .returning({ id: expertFirmsTable.id, name: expertFirmsTable.name, isActive: expertFirmsTable.isActive });

    if (!updated) return res.status(404).json({ error: "Cabinet introuvable" });

    await recordAudit(
      req.authUser?.id ?? null,
      req.authUser?.email ?? null,
      isActive ? "activate_expert_firm" : "suspend_expert_firm",
      "expert_firm",
      firmId,
      { name: updated.name },
    );

    return res.json(updated);
  } catch (e) { next(e); }
});

export default router;
