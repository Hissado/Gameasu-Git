/**
 * Expert Portal — API routes
 *
 * Toutes les routes nécessitent une session valide (requireAuth appliqué globalement).
 *
 * Structure :
 *  GET/POST   /api/expert/firms                                          — liste/création cabinets
 *  GET/PATCH  /api/expert/firms/:firmId                                  — détail/màj cabinet
 *  GET/POST   /api/expert/firms/:firmId/members                          — membres du cabinet
 *  PATCH      /api/expert/firms/:firmId/members/:uid                     — changer rôle membre
 *  DELETE     /api/expert/firms/:firmId/members/:uid                     — retirer membre
 *  GET        /api/expert/firms/:firmId/clients                          — orgs liées au cabinet
 *  POST       /api/expert/firms/:firmId/clients                          — lier org existante
 *  POST       /api/expert/firms/:firmId/clients/new-org                  — créer+lier nouvelle org
 *  DELETE     /api/expert/firms/:firmId/clients/:orgId                   — délier client
 *  PATCH      /api/expert/firms/:firmId/clients/:orgId/access            — changer level accès
 *  POST       /api/expert/firms/:firmId/clients/:orgId/switch            — switcher contexte client
 *  GET/POST   /api/expert/firms/:firmId/clients/:orgId/document-requests — demandes doc
 *  PATCH      /api/expert/document-requests/:id                         — màj statut/upload
 *  GET        /api/expert/firms/:firmId/document-requests/upload-url     — URL upload objet
 *  GET        /api/expert/firms/:firmId/dashboard                        — KPIs consolidés
 */
import ExcelJS from "exceljs";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  expertFirmsTable,
  expertFirmMembersTable,
  expertClientAccessTable,
  expertContextSessionsTable,
  documentRequestsTable,
  organizationsTable,
  organizationMembersTable,
  usersTable,
  organizationSubscriptionsTable,
  subscriptionPlansTable,
  invoicesTable,
  projectsTable,
  expenseReportsTable,
} from "@workspace/db";
import { and, eq, inArray, sql, gt } from "drizzle-orm";
import { requireExpertFirmMember, requireExpertClientAccess } from "../lib/expert-auth";
import { audit } from "../lib/audit";
import { sendEmail, buildInvitationEmail } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";
import { ObjectStorageService } from "../lib/objectStorage";
import crypto from "node:crypto";

const router = Router();
const objectStorageService = new ObjectStorageService();

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

  await db.insert(expertFirmMembersTable).values({
    firmId: firm.id,
    userId: req.authUser!.id,
    role: "owner",
    joinedAt: new Date(),
  });

  await audit(req, "expert_firm_create", { entityType: "expert_firm", entityId: firm.id });
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

  const rows = await db
    .update(expertFirmsTable)
    .set(patch)
    .where(eq(expertFirmsTable.id, req.params.firmId as string))
    .returning();
  if (!rows.length) return res.status(404).json({ error: "Cabinet introuvable" });
  const updated = rows[0];
  await audit(req, "expert_firm_update", { entityType: "expert_firm", entityId: updated.id });
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
  await audit(req, "expert_member_invite", { entityType: "expert_firm_member", entityId: member.id });
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
// Sécurité : l'utilisateur DOIT être admin/owner de l'organisation cible pour prouver
// son autorisation — cela empêche de lier n'importe quelle org par UUID sans consentement.
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

  // Vérification de consentement : l'acteur doit être membre admin/owner de l'org cible
  const [orgMembership] = await db
    .select({ role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(and(
      eq(organizationMembersTable.organizationId, orgId),
      eq(organizationMembersTable.userId, req.authUser!.id),
    ))
    .limit(1);

  if (!orgMembership || !["owner", "admin"].includes(orgMembership.role)) {
    return res.status(403).json({
      error: "Vous devez être admin ou owner de cette organisation pour l'associer à votre cabinet.",
    });
  }

  const [existing] = await db
    .select({ id: expertClientAccessTable.id })
    .from(expertClientAccessTable)
    .where(and(
      eq(expertClientAccessTable.firmId, req.params.firmId as string),
      eq(expertClientAccessTable.orgId, orgId),
    ))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(expertClientAccessTable)
      .set({ isActive: true, accessLevel, notes, revokedAt: null, grantedById: req.authUser!.id })
      .where(eq(expertClientAccessTable.id, existing.id))
      .returning();
    await audit(req, "expert_client_link", { entityType: "expert_client_access", entityId: updated.id });
    return res.json(updated);
  }

  const [access] = await db
    .insert(expertClientAccessTable)
    .values({ firmId: req.params.firmId as string, orgId, accessLevel, notes, grantedById: req.authUser!.id })
    .returning();
  await audit(req, "expert_client_link", { entityType: "expert_client_access", entityId: access.id });
  return res.status(201).json(access);
});

// ─────────────────────────────────────────────────────────────────
// CRÉER + LIER une nouvelle organisation cliente
// Route placée AVANT /:orgId pour éviter la collision avec :orgId="new-org"
// ─────────────────────────────────────────────────────────────────
router.post("/expert/firms/:firmId/clients/new-org", requireExpertFirmMember, async (req, res) => {
  const actorRole = (req as any).expertMemberRole as string;
  if (actorRole !== "owner" && actorRole !== "admin") {
    return res.status(403).json({ error: "Seuls owner/admin peuvent créer des organisations" });
  }
  const {
    name, slug, country = "TG", industry,
    ownerEmail, ownerFirstName = "Responsable", ownerLastName = "",
    ownerPassword,
    accessLevel = "full",
  } = req.body ?? {};
  if (!name || !slug) return res.status(400).json({ error: "name et slug requis" });
  if (!ownerEmail) return res.status(400).json({ error: "ownerEmail requis" });

  const [slugTaken] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, slug))
    .limit(1);
  if (slugTaken) return res.status(409).json({ error: "Ce slug est déjà utilisé par une organisation" });

  const [org] = await db
    .insert(organizationsTable)
    .values({ name, slug, country, ...(industry ? { industry } : {}) })
    .returning();

  // Générer un token d'invitation sécurisé (one-time, 7 jours)
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Mot de passe temporaire hashé (le vrai accès passe par le lien tokenisé)
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
      // Token d'invitation sécurisé — activé via POST /api/auth/accept-invitation
      passwordResetToken: inviteToken,
      passwordResetTokenExpiresAt: tokenExpiresAt,
      invitedById: req.authUser!.id,
      invitedAt: new Date(),
    })
    .returning();

  await db.insert(organizationMembersTable).values({
    organizationId: org.id,
    userId: owner.id,
    role: "owner",
    isPrimary: true,
  });

  const [access] = await db
    .insert(expertClientAccessTable)
    .values({ firmId: req.params.firmId as string, orgId: org.id, accessLevel, grantedById: req.authUser!.id })
    .returning();

  const inviterName = `${req.authUser!.firstName} ${req.authUser!.lastName}`.trim();
  // URL sécurisée utilisant le token one-time — compatible avec POST /api/auth/accept-invitation
  const acceptUrl = `${getPublicBaseUrl()}/accept-invitation?token=${inviteToken}`;
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

// Délier un client
router.delete(
  "/expert/firms/:firmId/clients/:orgId",
  requireExpertFirmMember,
  requireExpertClientAccess,
  async (req, res) => {
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
    await audit(req, "expert_client_unlink", {
      entityType: "expert_client_access",
      payload: { orgId: req.params.orgId },
    });
    return res.status(204).end();
  },
);

// Changer le niveau d'accès à un client
router.patch(
  "/expert/firms/:firmId/clients/:orgId/access",
  requireExpertFirmMember,
  requireExpertClientAccess,
  async (req, res) => {
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
  },
);

// ─────────────────────────────────────────────────────────────────
// SWITCH — créer une session de contexte expert pour une org cliente
// ─────────────────────────────────────────────────────────────────
router.post(
  "/expert/firms/:firmId/clients/:orgId/switch",
  requireExpertFirmMember,
  requireExpertClientAccess,
  async (req, res) => {
    const firmId = req.params.firmId as string;
    const orgId = req.params.orgId as string;

    // Invalider les tokens existants de cet expert pour ce même client
    await db.delete(expertContextSessionsTable).where(and(
      eq(expertContextSessionsTable.expertUserId, req.authUser!.id),
      eq(expertContextSessionsTable.firmId, firmId),
      eq(expertContextSessionsTable.targetOrgId, orgId),
    ));

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h

    const [session] = await db
      .insert(expertContextSessionsTable)
      .values({
        token,
        expertUserId: req.authUser!.id,
        firmId,
        targetOrgId: orgId,
        expiresAt,
      })
      .returning();

    await audit(req, "client_access_grant", {
      entityType: "expert_context_session",
      entityId: session.id,
      payload: { firmId, targetOrgId: orgId, expiresAt },
    });

    return res.status(201).json({
      contextToken: token,
      targetOrgId: orgId,
      expiresAt,
    });
  },
);

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
    await audit(req, "expert_doc_request_create", {
      entityType: "document_request",
      entityId: request.id,
      organizationId: req.authUser!.organizationId,
    });
    return res.status(201).json(request);
  },
);

// Générer une URL de téléversement (object storage) pour joindre un fichier à une demande doc
router.get(
  "/expert/firms/:firmId/document-requests/upload-url",
  requireExpertFirmMember,
  async (_req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      return res.json({ uploadURL, objectPath });
    } catch (e: any) {
      return res.status(503).json({ error: "Object storage non disponible", detail: e?.message });
    }
  },
);

/**
 * Mise à jour statut + upload d'une demande de document.
 * Vérifie que l'utilisateur est bien membre du cabinet propriétaire de la demande
 * ET que la liaison firm→org est toujours active.
 */
router.patch("/expert/document-requests/:id", async (req, res) => {
  const reqId = req.params.id as string;
  const [existing] = await db
    .select()
    .from(documentRequestsTable)
    .where(eq(documentRequestsTable.id, reqId))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Demande introuvable" });

  // Vérifier membership du cabinet
  const [member] = await db
    .select({ id: expertFirmMembersTable.id })
    .from(expertFirmMembersTable)
    .where(and(
      eq(expertFirmMembersTable.firmId, existing.firmId),
      eq(expertFirmMembersTable.userId, req.authUser!.id),
    ))
    .limit(1);
  if (!member) return res.status(403).json({ error: "Accès refusé : vous n'êtes pas membre de ce cabinet" });

  // Vérifier que l'accès firm→org est toujours actif
  const [activeAccess] = await db
    .select({ id: expertClientAccessTable.id })
    .from(expertClientAccessTable)
    .where(and(
      eq(expertClientAccessTable.firmId, existing.firmId),
      eq(expertClientAccessTable.orgId, existing.orgId),
      eq(expertClientAccessTable.isActive, true),
    ))
    .limit(1);
  if (!activeAccess) {
    return res.status(403).json({ error: "Accès refusé : ce cabinet n'a plus accès à ce client" });
  }

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

  await audit(req, "expert_doc_request_update", {
    entityType: "document_request",
    entityId: updated.id,
    organizationId: req.authUser!.organizationId,
    payload: { status, hasFile: !!fileUrl },
  });

  return res.json(updated);
});

// ─────────────────────────────────────────────────────────────────
// DASHBOARD CONSOLIDÉ — KPIs agrégés sur tous les clients du cabinet
// ─────────────────────────────────────────────────────────────────
router.get("/expert/firms/:firmId/dashboard", requireExpertFirmMember, async (req, res) => {
  const firmId = req.params.firmId as string;

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
      totalInvoiced: 0,
      totalPaid: 0,
      activeProjects: 0,
      clients: [],
    });
  }

  // Abonnements actifs
  const [subRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(organizationSubscriptionsTable)
    .where(and(
      inArray(organizationSubscriptionsTable.organizationId, orgIds),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ));

  // Demandes de documents en attente
  const [pendingRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documentRequestsTable)
    .where(and(
      eq(documentRequestsTable.firmId, firmId),
      eq(documentRequestsTable.status, "en_attente"),
    ));

  // KPIs factures : montant total facturé et montant total payé
  const [invoiceKpi] = await db
    .select({
      totalInvoiced: sql<number>`coalesce(sum(${invoicesTable.totalAmount}::numeric), 0)`,
      totalPaid: sql<number>`coalesce(sum(${invoicesTable.paidAmount}::numeric), 0)`,
    })
    .from(invoicesTable)
    .where(and(
      inArray(invoicesTable.organizationId, orgIds),
      sql`${invoicesTable.status} not in ('draft', 'cancelled')`,
    ));

  // Projets actifs (en cours / en pause)
  const [projectRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(projectsTable)
    .where(and(
      inArray(projectsTable.organizationId, orgIds),
      sql`${projectsTable.status} in ('in_progress', 'on_hold', 'active')`,
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
    activeSubscriptions: Number(subRow.count),
    pendingDocumentRequests: Number(pendingRow.count),
    totalInvoiced: Number(invoiceKpi.totalInvoiced),
    totalPaid: Number(invoiceKpi.totalPaid),
    activeProjects: Number(projectRow.count),
    clients: clientDetails,
  });
});

// ─────────────────────────────────────────────────────────────────
// KPIs PAR CLIENT — GET /expert/firms/:firmId/client-kpis
// ─────────────────────────────────────────────────────────────────
router.get("/expert/firms/:firmId/client-kpis", requireExpertFirmMember, async (req, res) => {
  const { firmId } = req.params as Record<string, string>;

  const accessRows = await db
    .select({ orgId: expertClientAccessTable.orgId })
    .from(expertClientAccessTable)
    .where(and(
      eq(expertClientAccessTable.firmId, firmId),
      eq(expertClientAccessTable.isActive, true),
    ));

  const orgIds = accessRows.map((r) => r.orgId);
  if (!orgIds.length) return res.json([]);

  const invoiceKpis = await db
    .select({
      orgId: invoicesTable.organizationId,
      totalInvoiced: sql<number>`coalesce(sum(${invoicesTable.totalAmount}::numeric), 0)`,
      totalPaid: sql<number>`coalesce(sum(${invoicesTable.paidAmount}::numeric), 0)`,
    })
    .from(invoicesTable)
    .where(and(
      inArray(invoicesTable.organizationId, orgIds),
      sql`${invoicesTable.status} not in ('draft', 'cancelled')`,
    ))
    .groupBy(invoicesTable.organizationId);

  const projectKpis = await db
    .select({
      orgId: projectsTable.organizationId,
      activeProjects: sql<number>`count(*)`,
    })
    .from(projectsTable)
    .where(and(
      inArray(projectsTable.organizationId, orgIds),
      sql`${projectsTable.status} in ('in_progress', 'on_hold', 'active')`,
    ))
    .groupBy(projectsTable.organizationId);

  const docKpis = await db
    .select({
      orgId: documentRequestsTable.orgId,
      pendingDocs: sql<number>`count(*)`,
    })
    .from(documentRequestsTable)
    .where(and(
      eq(documentRequestsTable.firmId, firmId),
      inArray(documentRequestsTable.orgId, orgIds),
      eq(documentRequestsTable.status, "en_attente"),
    ))
    .groupBy(documentRequestsTable.orgId);

  const unpaidKpis = await db
    .select({
      orgId: invoicesTable.organizationId,
      unpaidInvoices: sql<number>`count(*)`,
    })
    .from(invoicesTable)
    .where(and(
      inArray(invoicesTable.organizationId, orgIds),
      sql`${invoicesTable.status} in ('sent', 'overdue', 'partial')`,
    ))
    .groupBy(invoicesTable.organizationId);

  const expenseKpis = await db
    .select({
      orgId: expenseReportsTable.organizationId,
      totalExpenses: sql<number>`coalesce(sum(${expenseReportsTable.totalAmount}::numeric), 0)`,
    })
    .from(expenseReportsTable)
    .where(and(
      inArray(expenseReportsTable.organizationId, orgIds),
      sql`${expenseReportsTable.status} in ('approved', 'paid')`,
    ))
    .groupBy(expenseReportsTable.organizationId);

  const invMap    = Object.fromEntries(invoiceKpis.map((r) => [r.orgId, r]));
  const projMap   = Object.fromEntries(projectKpis.map((r) => [r.orgId, r]));
  const docMap    = Object.fromEntries(docKpis.map((r) => [r.orgId, r]));
  const unpaidMap = Object.fromEntries(unpaidKpis.map((r) => [r.orgId, r]));
  const expMap    = Object.fromEntries(expenseKpis.map((r) => [r.orgId, r]));

  return res.json(orgIds.map((orgId) => ({
    orgId,
    totalInvoiced:  Number(invMap[orgId]?.totalInvoiced  ?? 0),
    totalPaid:      Number(invMap[orgId]?.totalPaid      ?? 0),
    activeProjects: Number(projMap[orgId]?.activeProjects ?? 0),
    pendingDocs:    Number(docMap[orgId]?.pendingDocs    ?? 0),
    unpaidInvoices: Number(unpaidMap[orgId]?.unpaidInvoices ?? 0),
    totalExpenses:  Number(expMap[orgId]?.totalExpenses  ?? 0),
  })));
});

// ─────────────────────────────────────────────────────────────────
// INVITE CLIENT MEMBER — POST /expert/firms/:firmId/clients/:orgId/invite-member
// ─────────────────────────────────────────────────────────────────
router.post(
  "/expert/firms/:firmId/clients/:orgId/invite-member",
  requireExpertFirmMember,
  requireExpertClientAccess,
  async (req, res) => {
    const { firmId, orgId } = req.params as Record<string, string>;
    const { firstName, lastName, email, role = "member" } = req.body ?? {};
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "firstName, lastName et email sont requis" });
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);
    if (existing) return res.status(409).json({ error: "Un compte avec cet email existe déjà" });

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tempPassword = crypto.randomBytes(6).toString("hex");
    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(tempPassword, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        organizationId: orgId,
        email: email.toLowerCase().trim(),
        password: hashed,
        firstName,
        lastName,
        role,
        mustChangePassword: true,
        passwordResetToken: inviteToken,
        passwordResetTokenExpiresAt: tokenExpiresAt,
        invitedById: req.authUser!.id,
        invitedAt: new Date(),
      })
      .returning();

    const [org] = await db
      .select({ name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);

    const inviterName = `${req.authUser!.firstName} ${req.authUser!.lastName}`.trim();
    const acceptUrl = `${getPublicBaseUrl()}/accept-invitation?token=${inviteToken}`;
    const emailMsg = buildInvitationEmail({
      recipientName: `${firstName} ${lastName}`.trim(),
      inviterName,
      orgName: org?.name ?? "votre organisation",
      acceptUrl,
      temporaryPassword: tempPassword,
    });
    emailMsg.to = email;
    await sendEmail(emailMsg);

    await audit(req, "create", {
      entityType: "user",
      entityId: user.id,
      payload: { firmId, orgId, email },
    });

    return res.status(201).json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
  },
);

// ─────────────────────────────────────────────────────────────────
// XLSX EXPORT — GET /expert/firms/:firmId/export-report.xlsx
// ─────────────────────────────────────────────────────────────────
router.get(
  "/expert/firms/:firmId/export-report.xlsx",
  requireExpertFirmMember,
  async (req, res) => {
    const { firmId } = req.params as Record<string, string>;

    // 1. Clients avec nom org + plan
    const clients = await db
      .select({
        orgId: expertClientAccessTable.orgId,
        accessLevel: expertClientAccessTable.accessLevel,
        isActive: expertClientAccessTable.isActive,
        orgName: organizationsTable.name,
        orgCountry: organizationsTable.country,
        planName: subscriptionPlansTable.name,
      })
      .from(expertClientAccessTable)
      .leftJoin(organizationsTable, eq(organizationsTable.id, expertClientAccessTable.orgId))
      .leftJoin(
        organizationSubscriptionsTable,
        and(
          eq(organizationSubscriptionsTable.organizationId, expertClientAccessTable.orgId),
          eq(organizationSubscriptionsTable.isCurrent, true),
        ),
      )
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(and(
        eq(expertClientAccessTable.firmId, firmId),
        eq(expertClientAccessTable.isActive, true),
      ));

    const orgIds = clients.map((c) => c.orgId);

    // 2. KPIs (mêmes requêtes que client-kpis)
    const [invoiceKpis, projectKpis, docKpis, unpaidKpis, expKpis] = await Promise.all([
      orgIds.length
        ? db.select({
            orgId: invoicesTable.organizationId,
            totalInvoiced: sql<number>`coalesce(sum(${invoicesTable.totalAmount}::numeric), 0)`,
            totalPaid: sql<number>`coalesce(sum(${invoicesTable.paidAmount}::numeric), 0)`,
          })
          .from(invoicesTable)
          .where(and(
            inArray(invoicesTable.organizationId, orgIds),
            sql`${invoicesTable.status} not in ('draft', 'cancelled')`,
          ))
          .groupBy(invoicesTable.organizationId)
        : Promise.resolve([]),
      orgIds.length
        ? db.select({
            orgId: projectsTable.organizationId,
            count: sql<number>`count(*)`,
          })
          .from(projectsTable)
          .where(and(
            inArray(projectsTable.organizationId, orgIds),
            sql`${projectsTable.status} in ('in_progress', 'on_hold', 'active')`,
          ))
          .groupBy(projectsTable.organizationId)
        : Promise.resolve([]),
      orgIds.length
        ? db.select({
            orgId: documentRequestsTable.orgId,
            count: sql<number>`count(*)`,
          })
          .from(documentRequestsTable)
          .where(and(
            eq(documentRequestsTable.firmId, firmId),
            inArray(documentRequestsTable.orgId, orgIds),
            eq(documentRequestsTable.status, "en_attente"),
          ))
          .groupBy(documentRequestsTable.orgId)
        : Promise.resolve([]),
      orgIds.length
        ? db.select({
            orgId: invoicesTable.organizationId,
            count: sql<number>`count(*)`,
          })
          .from(invoicesTable)
          .where(and(
            inArray(invoicesTable.organizationId, orgIds),
            sql`${invoicesTable.status} in ('sent', 'overdue', 'partial')`,
          ))
          .groupBy(invoicesTable.organizationId)
        : Promise.resolve([]),
      orgIds.length
        ? db.select({
            orgId: expenseReportsTable.organizationId,
            totalExpenses: sql<number>`coalesce(sum(${expenseReportsTable.totalAmount}::numeric), 0)`,
          })
          .from(expenseReportsTable)
          .where(and(
            inArray(expenseReportsTable.organizationId, orgIds),
            sql`${expenseReportsTable.status} in ('approved', 'paid')`,
          ))
          .groupBy(expenseReportsTable.organizationId)
        : Promise.resolve([]),
    ]);

    const invMap    = Object.fromEntries(invoiceKpis.map((r) => [r.orgId, r]));
    const projMap   = Object.fromEntries(projectKpis.map((r) => [r.orgId, r]));
    const docMap    = Object.fromEntries(docKpis.map((r) => [r.orgId, r]));
    const unpaidMap = Object.fromEntries(unpaidKpis.map((r) => [r.orgId, r]));
    const expXlsMap = Object.fromEntries(expKpis.map((r) => [r.orgId, r]));

    // 3. Excel workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaméasù";
    wb.created = new Date();

    const ws = wb.addWorksheet("Rapport clients");
    ws.columns = [
      { key: "org",    width: 30 },
      { key: "pays",   width: 8  },
      { key: "plan",   width: 18 },
      { key: "acces",  width: 16 },
      { key: "statut", width: 10 },
      { key: "ca",     width: 22 },
      { key: "enc",    width: 22 },
      { key: "treso",  width: 22 },
      { key: "dep",    width: 22 },
      { key: "proj",   width: 14 },
      { key: "docs",   width: 14 },
      { key: "fact",   width: 16 },
    ];

    const headerRow = ws.addRow([
      "Organisation", "Pays", "Plan", "Niveau d'accès", "Statut",
      "CA facturé (FCFA)", "Encaissé (FCFA)", "Trésorerie (FCFA)", "Dépenses (FCFA)",
      "Projets actifs", "Docs en attente", "Factures impayées",
    ]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
    headerRow.alignment = { vertical: "middle" };
    headerRow.height = 18;

    let totInv = 0, totPaid = 0, totExp = 0, totProj = 0, totDocs = 0, totUnpaid = 0;

    for (const c of clients) {
      const inv    = Number(invMap[c.orgId]?.totalInvoiced ?? 0);
      const paid   = Number(invMap[c.orgId]?.totalPaid ?? 0);
      const exp    = Number(expXlsMap[c.orgId]?.totalExpenses ?? 0);
      const proj   = Number(projMap[c.orgId]?.count ?? 0);
      const docs   = Number(docMap[c.orgId]?.count ?? 0);
      const unpaid = Number(unpaidMap[c.orgId]?.count ?? 0);
      totInv += inv; totPaid += paid; totExp += exp; totProj += proj; totDocs += docs; totUnpaid += unpaid;

      const row = ws.addRow([
        c.orgName ?? "", c.orgCountry ?? "", c.planName ?? "—", c.accessLevel,
        c.isActive ? "Actif" : "Inactif",
        inv, paid, paid, exp, proj, docs, unpaid,
      ]);
      row.getCell(6).numFmt = '#,##0 "FCFA"';
      row.getCell(7).numFmt = '#,##0 "FCFA"';
      row.getCell(8).numFmt = '#,##0 "FCFA"';
      row.getCell(9).numFmt = '#,##0 "FCFA"';
    }

    const totRow = ws.addRow([
      "TOTAL", "", "", "", "", totInv, totPaid, totPaid, totExp, totProj, totDocs, totUnpaid,
    ]);
    totRow.font = { bold: true };
    totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEEE" } };
    totRow.getCell(6).numFmt = '#,##0 "FCFA"';
    totRow.getCell(7).numFmt = '#,##0 "FCFA"';
    totRow.getCell(8).numFmt = '#,##0 "FCFA"';

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="rapport-expert-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  },
);

// ─────────────────────────────────────────────────────────────────
// CONTEXT SESSION VALIDATION — utilitaire pour d'autres routes
// ─────────────────────────────────────────────────────────────────
/**
 * Valide un token de contexte expert et retourne les infos de session.
 * Utilisé par les routes client-scoped du portail expert.
 */
export async function resolveExpertContextToken(token: string) {
  const now = new Date();
  const [session] = await db
    .select()
    .from(expertContextSessionsTable)
    .where(and(
      eq(expertContextSessionsTable.token, token),
      gt(expertContextSessionsTable.expiresAt, now),
    ))
    .limit(1);
  return session ?? null;
}

export default router;
