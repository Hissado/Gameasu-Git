/**
 * Cockpit Team — gestion des utilisateurs internes Cockpit + profil + emails + abonnements.
 *
 * GET  /super-admin/cockpit-users              — liste membres équipe Cockpit (super_admins)
 * POST /super-admin/cockpit-users/invite       — inviter un nouveau membre
 * PATCH /super-admin/cockpit-users/:id/status  — activer / désactiver
 * DELETE /super-admin/cockpit-users/:id        — révoquer l'accès
 * GET  /super-admin/emails                     — historique emails envoyés
 * GET  /super-admin/subscriptions              — abonnements de toutes les orgs
 * GET  /super-admin/me                         — profil du cockpit user connecté
 * PATCH /super-admin/me                        — mettre à jour son profil
 * POST /super-admin/me/change-password         — changer son mot de passe
 * GET  /super-admin/me/sessions                — sessions actives
 * DELETE /super-admin/me/sessions              — déconnecter tous les appareils
 */
import { Router, type IRouter, type RequestHandler } from "express";
import {
  db, usersTable, authSessionsTable, trustedDevicesTable,
  organizationsTable, organizationSubscriptionsTable, subscriptionPlansTable,
  cockpitAuditLogsTable,
} from "@workspace/db";
import { eq, desc, and, gt, not, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { sendEmail, buildInvitationEmail, getPreviewInbox } from "../lib/email";

const router: IRouter = Router();

const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") {
    res.status(403).json({ error: "Accès réservé aux super-administrateurs" });
    return;
  }
  next();
};

async function auditLog(actorId: string, actorEmail: string, action: string, resource: string, resourceId?: string, meta?: unknown) {
  try {
    await db.insert(cockpitAuditLogsTable).values({
      actorId, actorEmail, action, resource,
      resourceId: resourceId ?? undefined,
      metadata: meta as any ?? undefined,
    });
  } catch { /* non-fatal */ }
}

// ── GET /super-admin/cockpit-users ────────────────────────────────────────────
router.get("/super-admin/cockpit-users", sa, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        isActive: usersTable.isActive,
        lastLoginAt: usersTable.lastLoginAt,
        createdAt: usersTable.createdAt,
        invitedAt: usersTable.invitedAt,
        acceptedAt: usersTable.acceptedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "super_admin"))
      .orderBy(desc(usersTable.createdAt));

    return res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

// ── POST /super-admin/cockpit-users/invite ────────────────────────────────────
router.post("/super-admin/cockpit-users/invite", sa, async (req, res, next) => {
  try {
    const { email, firstName, lastName } = req.body as { email: string; firstName: string; lastName: string };
    if (!email?.trim() || !firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ error: "Email, prénom et nom sont requis" });
    }
    const emailLc = email.toLowerCase().trim();

    // Vérifier si l'email existe déjà
    const [existing] = await db.select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.email, emailLc)).limit(1);

    if (existing) {
      if (existing.role === "super_admin") {
        return res.status(409).json({ error: "Cet utilisateur est déjà membre de l'équipe Cockpit" });
      }
      // Upgrade vers super_admin
      await db.update(usersTable)
        .set({ role: "super_admin", isActive: true, invitedAt: new Date(), invitedById: req.authUser!.id })
        .where(eq(usersTable.id, existing.id));
      await auditLog(req.authUser!.id, req.authUser!.email, "cockpit_user.upgrade", "user", existing.id, { email: emailLc });
      return res.json({ ok: true, action: "upgraded", userId: existing.id });
    }

    // Récupérer l'organisation du super_admin appelant pour rattacher le nouvel utilisateur
    const [caller] = await db.select({ organizationId: usersTable.organizationId })
      .from(usersTable).where(eq(usersTable.id, req.authUser!.id)).limit(1);

    // Créer le compte
    const tempPassword = randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const [newUser] = await db.insert(usersTable).values({
      email: emailLc,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password: passwordHash,
      role: "super_admin",
      organizationId: caller!.organizationId,
      isActive: true,
      invitedById: req.authUser!.id,
      invitedAt: new Date(),
      mustChangePassword: true,
    }).returning({ id: usersTable.id });

    // Envoyer l'email d'invitation
    const inviterName = `${req.authUser!.email}`;
    const tpl = buildInvitationEmail({
      recipientName: `${firstName.trim()} ${lastName.trim()}`,
      inviterName,
      orgName: "Gaméasù Cockpit",
      acceptUrl: `${req.headers["x-forwarded-proto"] ?? "https"}://${req.headers.host}/cockpit/`,
      temporaryPassword: tempPassword,
    });
    await sendEmail({ ...tpl, to: emailLc });

    await auditLog(req.authUser!.id, req.authUser!.email, "cockpit_user.invite", "user", newUser.id, { email: emailLc });
    return res.status(201).json({ ok: true, action: "created", userId: newUser.id });
  } catch (e) { next(e); }
});

// ── PATCH /super-admin/cockpit-users/:id/status ───────────────────────────────
router.patch("/super-admin/cockpit-users/:id/status", sa, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    // Empêcher de se désactiver soi-même
    if (id === req.authUser!.id) {
      return res.status(400).json({ error: "Vous ne pouvez pas désactiver votre propre compte" });
    }

    const [target] = await db.select({ id: usersTable.id, role: usersTable.role, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!target) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (target.role !== "super_admin") return res.status(403).json({ error: "Cet utilisateur n'est pas un membre Cockpit" });

    await db.update(usersTable).set({ isActive }).where(eq(usersTable.id, id));

    if (!isActive) {
      // Révoquer toutes les sessions actives
      await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, id));
    }

    await auditLog(req.authUser!.id, req.authUser!.email,
      isActive ? "cockpit_user.activate" : "cockpit_user.deactivate",
      "user", id, { email: target.email });

    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── DELETE /super-admin/cockpit-users/:id ────────────────────────────────────
router.delete("/super-admin/cockpit-users/:id", sa, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.authUser!.id) {
      return res.status(400).json({ error: "Vous ne pouvez pas révoquer votre propre accès" });
    }

    const [target] = await db.select({ id: usersTable.id, role: usersTable.role, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!target) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (target.role !== "super_admin") return res.status(403).json({ error: "Non autorisé" });

    // Rétrograder vers admin (pas de suppression définitive)
    await db.update(usersTable).set({ role: "admin", isActive: false }).where(eq(usersTable.id, id));
    await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, id));

    await auditLog(req.authUser!.id, req.authUser!.email, "cockpit_user.revoke", "user", id, { email: target.email });
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GET /super-admin/emails ───────────────────────────────────────────────────
router.get("/super-admin/emails", sa, async (_req, res) => {
  const inbox = getPreviewInbox(200);
  return res.json({ count: inbox.length, rows: inbox });
});

// ── GET /super-admin/subscriptions ───────────────────────────────────────────
router.get("/super-admin/subscriptions", sa, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: organizationSubscriptionsTable.id,
        orgId: organizationSubscriptionsTable.organizationId,
        orgName: organizationsTable.name,
        orgSlug: organizationsTable.slug,
        planName: subscriptionPlansTable.name,
        planCode: subscriptionPlansTable.code,
        status: organizationSubscriptionsTable.status,
        billingCycle: organizationSubscriptionsTable.billingCycle,
        seats: organizationSubscriptionsTable.seats,
        unitPrice: organizationSubscriptionsTable.unitPrice,
        currency: organizationSubscriptionsTable.currency,
        isCurrent: organizationSubscriptionsTable.isCurrent,
        currentPeriodStart: organizationSubscriptionsTable.currentPeriodStart,
        currentPeriodEnd: organizationSubscriptionsTable.currentPeriodEnd,
        trialEndsAt: organizationSubscriptionsTable.trialEndsAt,
        autopayEnabled: organizationSubscriptionsTable.autopayEnabled,
        createdAt: organizationSubscriptionsTable.createdAt,
      })
      .from(organizationSubscriptionsTable)
      .leftJoin(organizationsTable, eq(organizationsTable.id, organizationSubscriptionsTable.organizationId))
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .orderBy(desc(organizationSubscriptionsTable.createdAt));

    const totalMrr = rows
      .filter(r => r.isCurrent && r.status === "active")
      .reduce((s, r) => s + (r.billingCycle === "annual" ? Math.round(r.unitPrice * r.seats / 12) : r.unitPrice * r.seats), 0);

    return res.json({ count: rows.length, totalMrr, rows });
  } catch (e) { next(e); }
});

// ── GET /super-admin/me ───────────────────────────────────────────────────────
router.get("/super-admin/me", sa, async (req, res, next) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        phone: usersTable.phone,
        avatarUrl: usersTable.avatarUrl,
        isActive: usersTable.isActive,
        lastLoginAt: usersTable.lastLoginAt,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.authUser!.id))
      .limit(1);

    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    return res.json(user);
  } catch (e) { next(e); }
});

// ── PATCH /super-admin/me ─────────────────────────────────────────────────────
router.patch("/super-admin/me", sa, async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body as { firstName?: string; lastName?: string; phone?: string };
    const update: Record<string, unknown> = {};
    if (firstName?.trim()) update.firstName = firstName.trim();
    if (lastName?.trim()) update.lastName = lastName.trim();
    if (phone !== undefined) update.phone = phone?.trim() || null;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Aucun champ à mettre à jour" });
    }

    await db.update(usersTable).set(update as any).where(eq(usersTable.id, req.authUser!.id));
    await auditLog(req.authUser!.id, req.authUser!.email, "profile.update", "user", req.authUser!.id, update);
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /super-admin/me/change-password ──────────────────────────────────────
router.post("/super-admin/me/change-password", sa, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Mot de passe actuel et nouveau mot de passe requis" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
    }

    const [user] = await db.select({ id: usersTable.id, password: usersTable.password })
      .from(usersTable).where(eq(usersTable.id, req.authUser!.id)).limit(1);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ error: "Mot de passe actuel incorrect" });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ password: hash, mustChangePassword: false }).where(eq(usersTable.id, user.id));

    await auditLog(req.authUser!.id, req.authUser!.email, "profile.change_password", "user", user.id);
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GET /super-admin/me/sessions ─────────────────────────────────────────────
router.get("/super-admin/me/sessions", sa, async (req, res, next) => {
  try {
    const sessions = await db
      .select({
        id: authSessionsTable.id,
        userAgent: authSessionsTable.userAgent,
        ipAddress: authSessionsTable.ipAddress,
        createdAt: authSessionsTable.createdAt,
        expiresAt: authSessionsTable.expiresAt,
      })
      .from(authSessionsTable)
      .where(
        and(
          eq(authSessionsTable.userId, req.authUser!.id),
          gt(authSessionsTable.expiresAt, new Date()),
        )
      )
      .orderBy(desc(authSessionsTable.createdAt));

    const devices = await db
      .select({
        id: trustedDevicesTable.id,
        label: trustedDevicesTable.label,
        ipAddress: trustedDevicesTable.ipAddress,
        createdAt: trustedDevicesTable.createdAt,
        expiresAt: trustedDevicesTable.expiresAt,
        revokedAt: trustedDevicesTable.revokedAt,
      })
      .from(trustedDevicesTable)
      .where(
        and(
          eq(trustedDevicesTable.userId, req.authUser!.id),
          gt(trustedDevicesTable.expiresAt, new Date()),
        )
      )
      .orderBy(desc(trustedDevicesTable.createdAt));

    return res.json({ sessions, trustedDevices: devices });
  } catch (e) { next(e); }
});

// ── DELETE /super-admin/me/sessions ──────────────────────────────────────────
router.delete("/super-admin/me/sessions", sa, async (req, res, next) => {
  try {
    const currentToken = req.headers.authorization?.replace("Bearer ", "");
    if (currentToken) {
      // Supprimer toutes les sessions SAUF la courante
      const all = await db.select({ id: authSessionsTable.id, token: authSessionsTable.token })
        .from(authSessionsTable)
        .where(eq(authSessionsTable.userId, req.authUser!.id));

      for (const s of all) {
        if (s.token !== currentToken) {
          await db.delete(authSessionsTable).where(eq(authSessionsTable.id, s.id));
        }
      }
    } else {
      await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, req.authUser!.id));
    }
    // Révoquer aussi les appareils de confiance
    await db.delete(trustedDevicesTable).where(eq(trustedDevicesTable.userId, req.authUser!.id));

    await auditLog(req.authUser!.id, req.authUser!.email, "profile.revoke_sessions", "user", req.authUser!.id);
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
