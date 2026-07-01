/**
 * Expert Portal — API routes
 *
 * Toutes les routes sont sous /api/expert et nécessitent une session valide (requireAuth
 * est appliqué globalement dans routes/index.ts avant ce router).
 *
 * Structure :
 *  GET/POST   /api/expert/firms                        — liste / création de cabinets
 *  GET/PATCH  /api/expert/firms/:firmId                — détail / mise à jour
 *  GET/POST   /api/expert/firms/:firmId/members        — membres du cabinet
 *  DELETE     /api/expert/firms/:firmId/members/:uid   — retrait d'un membre
 *  GET        /api/expert/firms/:firmId/clients        — clients liés au cabinet
 *  POST       /api/expert/firms/:firmId/clients        — lier une org existante
 *  DELETE     /api/expert/firms/:firmId/clients/:orgId — délier un client
 *  POST       /api/expert/firms/:firmId/clients/new-org — créer + lier une nouvelle org
 *  PATCH      /api/expert/firms/:firmId/clients/:orgId/access — changer level d'accès
 *  GET        /api/expert/firms/:firmId/clients/:orgId/document-requests — demandes doc
 *  POST       /api/expert/firms/:firmId/clients/:orgId/document-requests — créer demande
 *  PATCH      /api/expert/document-requests/:id        — màj statut/upload
 *  GET        /api/expert/firms/:firmId/dashboard      — KPIs consolidés
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  expertFirmsTable,
  expertFirmMembersTable,
  expertClientAccessTable,
  documentRequestsTable,
  organizationsTable,
  organizationMembersTable,
  usersTable,
  organizationSubscriptionsTable,
  subscriptionPlansTable,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireExpertFirmMember, requireExpertClientAccess } from "../lib/expert-auth";
import { audit } from "../lib/audit";
import { sendEmail, buildInvitationEmail } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";
import crypto from "node:crypto";

const router = Router();

// ─────────────────────────────────────────────────────────────────
// HELPER — liste les firmIds auxquels l'utilisateur appartient
// ─────────────────────────────────────────────────────────────────
async function userFirmIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ firmId: expertFirmMembersTable.firmId })
    .from(expertFirmMembersTable)
    .where(eq(expertFirmMembersTable.userId, userId));
  return rows.map((r) => r.firmId);
}

// ─────────────────────────────────────────────────────────────────
// FIRMS — liste et création
// ─────────────────────────────────────────────────────────────────
router.get("/expert/firms", async (req, res) => {
  const firmIds = await userFirmIds(req.authUser!.id);
  if (!firmIds.length) return res.json([]);
  const firms = await db
    .select()
    .from(expertFirmsTable)
    .where(inArray(expertFirmsTable.id, firmIds));
  return res.json(firms);
});

router.post("/expert/firms", async (req, res) => {
  const { name, slug, country, email, phone, address, logoUrl, plan } = req.body ?? {};
  if (!name || !slug) return res.status(400).json({ error: "name et slug requis" });

  const [existing] = await db
    .select({ id: expertFirmsTable.id })
    .from(expertFirmsTable)
    .where(eq(expertFirmsTable.slug, slug))
    .limit(1);
  if (existing) return res.status(409).json({ error: "Ce slug est déjà utilisé" });

  const [firm] = await db
    .insert(expertFirmsTable)
    .values({ name, slug, country, email, phone, address, logoUrl, plan, createdById: req.authUser!.id })
    .returning();

  // Le créateur devient owner automatiquement
  await db.insert(expertFirmMembersTable).values({
    firmId: firm.id,
    userId: req.authUser!.id,
    role: "owner",
    joinedAt: new Date(),
  });

  await audit(req, "create", { entityType: "expert_firm", entityId: firm.id });
  return res.status(201).json(firm);
});

// ─────────────────────────────────────────────────────────────────
// FIRM DETAIL
// ─────────────────────────────────────────────────────────────────
router.get("/expert/firms/:firmId", requireExpertFirmMember, async (req, res) => {
  const [firm] = await db
    .select()
    .from(expertFirmsTable)
    .where(eq(expertFirmsTable.id, req.params.firmId as string))
    .limit(1);
  if (!firm) return res.status(404).json({ error: "Cabinet introuvable" });
  return res.json(firm);
});

router.patch("/expert/firms/:firmId", requireExpertFirmMember, async (req, res) => {
  const role = (req as any).expertMemberRole as string;
  if (role !== "owner" && role !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent modifier le cabinet" });
  }
  const { name, country, email, phone, address, logoUrl, plan } = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (country !== undefined) patch.country = country;
  if (email !== undefined) patch.email = email;
  if (phone !== undefined) patch.phone = phone;
  if (address !== undefined) patch.address = address;
  if (logoUrl !== undefined) patch.logoUrl = logoUrl;
  if (plan !== undefined) patch.plan = plan;

  const [updated] = await db
    .update(expertFirmsTable)
    .set(patch)
    .where(eq(expertFirmsTable.id, req.params.firmId as string))
    .returning();
  await audit(req, "update", { entityType: "expert_firm", entityId: updated.id });
  return res.json(updated);
});

// ─────────────────────────────────────────────────────────────────
// MEMBERS
// ─────────────────────────────────────────────────────────────────
router.get("/expert/firms/:firmId/members", requireExpertFirmMember, async (req, res) => {
  const rows = await db
    .select({
      member: expertFirmMembersTable,
      user: {
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        avatarUrl: usersTable.avatarUrl,
      },
    })
    .from(expertFirmMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, expertFirmMembersTable.userId))
    .where(eq(expertFirmMembersTable.firmId, req.params.firmId as string));
  return res.json(rows.map((r) => ({ ...r.member, user: r.user })));
});

router.post("/expert/firms/:firmId/members", requireExpertFirmMember, async (req, res) => {
  const actorRole = (req as any).expertMemberRole as string;
  if (actorRole !== "owner" && actorRole !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent inviter des membres" });
  }
  const { userId, role = "member" } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: "userId requis" });

  const [existing] = await db
    .select({ id: expertFirmMembersTable.id })
    .from(expertFirmMembersTable)
    .where(and(
      eq(expertFirmMembersTable.firmId, req.params.firmId as string),
      eq(expertFirmMembersTable.userId, userId),
    ))
    .limit(1);
  if (existing) return res.status(409).json({ error: "Cet utilisateur est déjà membre du cabinet" });

  const [member] = await db
    .insert(expertFirmMembersTable)
    .values({ firmId: req.params.firmId as string, userId, role })
    .returning();
  await audit(req, "invite", { entityType: "expert_firm_member", entityId: member.id });
  return res.status(201).json(member);
});

router.patch("/expert/firms/:firmId/members/:uid", requireExpertFirmMember, async (req, res) => {
  const actorRole = (req as any).expertMemberRole as string;
  if (actorRole !== "owner" && actorRole !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent modifier les rôles" });
  }
  const { role } = req.body ?? {};
  if (!role) return res.status(400).json({ error: "role requis" });

  const [updated] = await db
    .update(expertFirmMembersTable)
    .set({ role })
    .where(and(
      eq(expertFirmMembersTable.firmId, req.params.firmId as string),
      eq(expertFirmMembersTable.userId, req.params.uid as string),
    ))
    .returning();
  if (!updated) return res.status(404).json({ error: "Membre introuvable" });
  return res.json(updated);
});

router.delete("/expert/firms/:firmId/members/:uid", requireExpertFirmMember, async (req, res) => {
  const actorRole = (req as any).expertMemberRole as string;
  if (actorRole !== "owner" && actorRole !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent retirer des membres" });
  }
  if (req.params.uid === req.authUser!.id) {
    return res.status(409).json({ error: "Vous ne pouvez pas vous retirer vous-même" });
  }
  await db.delete(expertFirmMembersTable).where(and(
    eq(expertFirmMembersTable.firmId, req.params.firmId as string),
    eq(expertFirmMembersTable.userId, req.params.uid as string),
  ));
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────
// CLIENTS — organisations liées au cabinet
// ─────────────────────────────────────────────────────────────────
router.get("/expert/firms/:firmId/clients", requireExpertFirmMember, async (req, res) => {
  const rows = await db
    .select({
      access: expertClientAccessTable,
      org: {
        id: organizationsTable.id,
        name: organizationsTable.name,
        slug: organizationsTable.slug,
        country: organizationsTable.country,
        logoUrl: organizationsTable.logoUrl,
        isActive: organizationsTable.isActive,
      },
    })
    .from(expertClientAccessTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, expertClientAccessTable.orgId))
    .where(and(
      eq(expertClientAccessTable.firmId, req.params.firmId as string),
      eq(expertClientAccessTable.isActive, true),
    ));
  return res.json(rows.map((r) => ({ ...r.access, org: r.org })));
});

// Lier une organisation existante au cabinet
router.post("/expert/firms/:firmId/clients", requireExpertFirmMember, async (req, res) => {
  const actorRole = (req as any).expertMemberRole as string;
  if (actorRole !== "owner" && actorRole !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent lier des clients" });
  }
  const { orgId, accessLevel = "read", notes } = req.body ?? {};
  if (!orgId) return res.status(400).json({ error: "orgId requis" });

  const [org] = await db.select({ id: organizationsTable.id }).from(organizationsTable)
    .where(eq(organizationsTable.id, orgId)).limit(1);
  if (!org) return res.status(404).json({ error: "Organisation introuvable" });

  const [existing] = await db
    .select({ id: expertClientAccessTable.id })
    .from(expertClientAccessTable)
    .where(and(
      eq(expertClientAccessTable.firmId, req.params.firmId as string),
      eq(expertClientAccessTable.orgId, orgId),
    ))
    .limit(1);

  if (existing) {
    // Réactiver si déjà lié mais inactif
    const [updated] = await db
      .update(expertClientAccessTable)
      .set({ isActive: true, accessLevel, notes, revokedAt: null, grantedById: req.authUser!.id })
      .where(eq(expertClientAccessTable.id, existing.id))
      .returning();
    await audit(req, "client_access_grant", { entityType: "expert_client_access", entityId: updated.id });
    return res.json(updated);
  }

  const [access] = await db
    .insert(expertClientAccessTable)
    .values({ firmId: req.params.firmId as string, orgId, accessLevel, notes, grantedById: req.authUser!.id })
    .returning();
  await audit(req, "client_access_grant", { entityType: "expert_client_access", entityId: access.id });
  return res.status(201).json(access);
});

// Délier un client
router.delete("/expert/firms/:firmId/clients/:orgId", requireExpertFirmMember, requireExpertClientAccess, async (req, res) => {
  const actorRole = (req as any).expertMemberRole as string;
  if (actorRole !== "owner" && actorRole !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent délier des clients" });
  }
  await db
    .update(expertClientAccessTable)
    .set({ isActive: false, revokedAt: new Date() })
    .where(and(
      eq(expertClientAccessTable.firmId, req.params.firmId as string),
      eq(expertClientAccessTable.orgId, req.params.orgId as string),
    ));
  await audit(req, "client_access_revoke", {
    entityType: "expert_client_access",
    payload: { orgId: req.params.orgId },
  });
  return res.status(204).end();
});

// Changer le niveau d'accès à un client
router.patch("/expert/firms/:firmId/clients/:orgId/access", requireExpertFirmMember, requireExpertClientAccess, async (req, res) => {
  const actorRole = (req as any).expertMemberRole as string;
  if (actorRole !== "owner" && actorRole !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent modifier les accès" });
  }
  const { accessLevel, notes } = req.body ?? {};
  if (!accessLevel) return res.status(400).json({ error: "accessLevel requis" });

  const [updated] = await db
    .update(expertClientAccessTable)
    .set({ accessLevel, notes })
    .where(and(
      eq(expertClientAccessTable.firmId, req.params.firmId as string),
      eq(expertClientAccessTable.orgId, req.params.orgId as string),
    ))
    .returning();
  return res.json(updated);
});

// ─────────────────────────────────────────────────────────────────
// CRÉER + LIER une nouvelle organisation cliente
// ─────────────────────────────────────────────────────────────────
router.post("/expert/firms/:firmId/clients/new-org", requireExpertFirmMember, async (req, res) => {
  const actorRole = (req as any).expertMemberRole as string;
  if (actorRole !== "owner" && actorRole !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent créer des organisations" });
  }
  const {
    name, slug, country = "TG",
    ownerEmail, ownerFirstName = "Responsable", ownerLastName = "",
    ownerPassword,
    accessLevel = "full",
  } = req.body ?? {};
  if (!name || !slug) return res.status(400).json({ error: "name et slug requis" });
  if (!ownerEmail) return res.status(400).json({ error: "ownerEmail requis" });

  // Vérifier que le slug n'est pas pris
  const [slugTaken] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, slug))
    .limit(1);
  if (slugTaken) return res.status(409).json({ error: "Ce slug est déjà utilisé par une organisation" });

  // Créer l'organisation
  const [org] = await db
    .insert(organizationsTable)
    .values({ name, slug, country })
    .returning();

  // Créer l'utilisateur owner (mot de passe temporaire si non fourni)
  const tempPassword = ownerPassword || crypto.randomBytes(6).toString("hex");
  const bcrypt = await import("bcryptjs");
  const hashed = await bcrypt.hash(tempPassword, 10);

  const [owner] = await db
    .insert(usersTable)
    .values({
      organizationId: org.id,
      email: ownerEmail,
      password: hashed,
      firstName: ownerFirstName,
      lastName: ownerLastName,
      role: "admin",
      mustChangePassword: true,
    })
    .returning();

  await db.insert(organizationMembersTable).values({
    organizationId: org.id,
    userId: owner.id,
    role: "owner",
    isPrimary: true,
  });

  // Lier au cabinet
  const [access] = await db
    .insert(expertClientAccessTable)
    .values({ firmId: req.params.firmId as string, orgId: org.id, accessLevel, grantedById: req.authUser!.id })
    .returning();

  // Envoyer l'email d'invitation au responsable
  const inviterName = `${req.authUser!.firstName} ${req.authUser!.lastName}`.trim();
  const acceptUrl = `${getPublicBaseUrl()}/accept-invite?email=${encodeURIComponent(ownerEmail)}`;
  const emailMsg = buildInvitationEmail({
    recipientName: `${ownerFirstName} ${ownerLastName}`.trim(),
    inviterName,
    orgName: name,
    acceptUrl,
    temporaryPassword: tempPassword,
  });
  emailMsg.to = ownerEmail;
  await sendEmail(emailMsg);

  await audit(req, "create", { entityType: "organization", entityId: org.id, payload: { firmId: req.params.firmId, ownerEmail } });
  return res.status(201).json({ org, owner: { ...owner, password: undefined }, access, invitationUrl: acceptUrl });
});

// ─────────────────────────────────────────────────────────────────
// DOCUMENT REQUESTS
// ─────────────────────────────────────────────────────────────────
router.get(
  "/expert/firms/:firmId/clients/:orgId/document-requests",
  requireExpertFirmMember,
  requireExpertClientAccess,
  async (req, res) => {
    const rows = await db
      .select()
      .from(documentRequestsTable)
      .where(and(
        eq(documentRequestsTable.firmId, req.params.firmId as string),
        eq(documentRequestsTable.orgId, req.params.orgId as string),
      ));
    return res.json(rows);
  },
);

router.post(
  "/expert/firms/:firmId/clients/:orgId/document-requests",
  requireExpertFirmMember,
  requireExpertClientAccess,
  async (req, res) => {
    const { title, description, dueDate } = req.body ?? {};
    if (!title) return res.status(400).json({ error: "title requis" });

    const [request] = await db
      .insert(documentRequestsTable)
      .values({
        firmId: req.params.firmId as string,
        orgId: req.params.orgId as string,
        title,
        description,
        dueDate,
        requestedById: req.authUser!.id,
      })
      .returning();
    await audit(req, "create", {
      entityType: "document_request",
      entityId: request.id,
      organizationId: req.authUser!.organizationId,
    });
    return res.status(201).json(request);
  },
);

// Mise à jour statut / upload d'un document (accessible à tout membre du cabinet
// qui a accès au client — pas de :orgId dans la route puisque la demande porte ses propres firmId/orgId)
router.patch("/expert/document-requests/:id", async (req, res) => {
  const reqId = req.params.id as string;
  const [existing] = await db
    .select()
    .from(documentRequestsTable)
    .where(eq(documentRequestsTable.id, reqId))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Demande introuvable" });

  // Vérifier que l'utilisateur est membre du cabinet concerné
  const [member] = await db
    .select({ id: expertFirmMembersTable.id })
    .from(expertFirmMembersTable)
    .where(and(
      eq(expertFirmMembersTable.firmId, existing.firmId),
      eq(expertFirmMembersTable.userId, req.authUser!.id),
    ))
    .limit(1);
  if (!member) return res.status(403).json({ error: "Accès refusé" });

  const { status, fileUrl, fileName } = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (status !== undefined) {
    patch.status = status;
    patch.respondedById = req.authUser!.id;
    patch.respondedAt = new Date();
  }
  if (fileUrl !== undefined) patch.fileUrl = fileUrl;
  if (fileName !== undefined) patch.fileName = fileName;

  const [updated] = await db
    .update(documentRequestsTable)
    .set(patch)
    .where(eq(documentRequestsTable.id, reqId))
    .returning();
  return res.json(updated);
});

// ─────────────────────────────────────────────────────────────────
// DASHBOARD CONSOLIDÉ — KPIs agrégés sur tous les clients du cabinet
// ─────────────────────────────────────────────────────────────────
router.get("/expert/firms/:firmId/dashboard", requireExpertFirmMember, async (req, res) => {
  const firmId = req.params.firmId as string;

  // Récupérer les orgs actives liées au cabinet
  const accessRows = await db
    .select({ orgId: expertClientAccessTable.orgId })
    .from(expertClientAccessTable)
    .where(and(
      eq(expertClientAccessTable.firmId, firmId),
      eq(expertClientAccessTable.isActive, true),
    ));

  const orgIds = accessRows.map((r) => r.orgId);
  const clientCount = orgIds.length;

  if (!orgIds.length) {
    return res.json({
      clientCount: 0,
      activeSubscriptions: 0,
      pendingDocumentRequests: 0,
      clients: [],
    });
  }

  // Abonnements actifs
  const [{ activeSubscriptions }] = await db
    .select({ activeSubscriptions: sql<number>`count(*)` })
    .from(organizationSubscriptionsTable)
    .where(and(
      inArray(organizationSubscriptionsTable.organizationId, orgIds),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ));

  // Demandes de documents en attente
  const [{ pendingDocumentRequests }] = await db
    .select({ pendingDocumentRequests: sql<number>`count(*)` })
    .from(documentRequestsTable)
    .where(and(
      eq(documentRequestsTable.firmId, firmId),
      eq(documentRequestsTable.status, "en_attente"),
    ));

  // Détail par client (org + abonnement courant)
  const clientDetails = await db
    .select({
      org: {
        id: organizationsTable.id,
        name: organizationsTable.name,
        slug: organizationsTable.slug,
        country: organizationsTable.country,
        logoUrl: organizationsTable.logoUrl,
        isActive: organizationsTable.isActive,
      },
      sub: {
        status: organizationSubscriptionsTable.status,
        billingCycle: organizationSubscriptionsTable.billingCycle,
        currentPeriodEnd: organizationSubscriptionsTable.currentPeriodEnd,
      },
      plan: {
        code: subscriptionPlansTable.code,
        name: subscriptionPlansTable.name,
      },
      access: {
        accessLevel: expertClientAccessTable.accessLevel,
        grantedAt: expertClientAccessTable.grantedAt,
      },
    })
    .from(organizationsTable)
    .leftJoin(
      organizationSubscriptionsTable,
      and(
        eq(organizationSubscriptionsTable.organizationId, organizationsTable.id),
        eq(organizationSubscriptionsTable.isCurrent, true),
      ),
    )
    .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
    .innerJoin(
      expertClientAccessTable,
      and(
        eq(expertClientAccessTable.orgId, organizationsTable.id),
        eq(expertClientAccessTable.firmId, firmId),
        eq(expertClientAccessTable.isActive, true),
      ),
    )
    .where(inArray(organizationsTable.id, orgIds));

  return res.json({
    clientCount,
    activeSubscriptions: Number(activeSubscriptions),
    pendingDocumentRequests: Number(pendingDocumentRequests),
    clients: clientDetails,
  });
});

export default router;
