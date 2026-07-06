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
import { sendEmail, getPreviewInbox } from "../lib/email";
import { getCockpitBaseUrl } from "../lib/url";

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

    // Org plateforme du super-admin appelant (rattachement des membres Cockpit).
    const [caller] = await db.select({ organizationId: usersTable.organizationId })
      .from(usersTable).where(eq(usersTable.id, req.authUser!.id)).limit(1);

    // Jeton de définition de mot de passe (lien à usage unique, valable 7 jours).
    // Aucun mot de passe temporaire n'est exposé par email.
    const unusablePassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    const inviteToken = randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Lien sécurisé vers le Cockpit (/cockpit/reset-password). On résout l'URL
    // publique de façon centralisée (jamais l'en-tête Host, faux derrière le proxy).
    const baseOrigin = getCockpitBaseUrl();
    const setupUrl = `${baseOrigin}/cockpit/reset-password?token=${inviteToken}`;
    const sendInviteEmail = () => sendEmail({
      to: emailLc,
      subject: "Invitation à l'équipe Gameasu Cockpit",
      text: `Bonjour ${firstName.trim()},\n\nVous avez été invité(e) par ${req.authUser!.email} à rejoindre l'équipe d'administration Gameasu Cockpit en tant que super-administrateur.\n\nDéfinissez votre mot de passe (lien valable 7 jours) :\n${setupUrl}\n\nL'équipe Gameasu`,
      html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f7f7f7;padding:24px;color:#111"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee"><div style="background:#0b0b0b;color:#fff;padding:24px 28px"><div style="color:#3B82F6;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:6px">GAMEASU COCKPIT</div><h1 style="margin:0;font-size:22px">Invitation équipe</h1></div><div style="padding:24px 28px;line-height:1.6"><p>Bonjour <strong>${firstName.trim()} ${lastName.trim()}</strong>,</p><p>Vous avez été invité(e) par <strong>${req.authUser!.email}</strong> à rejoindre l'équipe d'administration <strong>Gameasu Cockpit</strong> en tant que super-administrateur.</p><p style="text-align:center;margin:24px 0"><a href="${setupUrl}" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Définir mon mot de passe</a></p><p style="font-size:13px;color:#555">Lien valable 7 jours. Si le bouton ne fonctionne pas, copiez ce lien :<br><span style="word-break:break-all;color:#0066cc">${setupUrl}</span></p></div></div></body></html>`,
    });

    // Email déjà existant
    const [existing] = await db.select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.email, emailLc)).limit(1);

    if (existing) {
      if (existing.role === "super_admin") {
        return res.status(409).json({ error: "Cet utilisateur est déjà membre de l'équipe Cockpit" });
      }
      // Élévation sécurisée : rattachement à l'org plateforme, mot de passe rendu
      // inutilisable et (re)définition forcée via le même lien sécurisé. Les sessions
      // et appareils de confiance existants (côté tenant) sont invalidés pour éviter
      // qu'un ancien mot de passe tenant ne donne un accès super-admin.
      await db.update(usersTable).set({
        role: "super_admin",
        isActive: true,
        organizationId: caller!.organizationId,
        password: unusablePassword,
        mustChangePassword: true,
        passwordResetToken: inviteToken,
        passwordResetTokenExpiresAt: inviteExpiresAt,
        invitedAt: new Date(),
        invitedById: req.authUser!.id,
      }).where(eq(usersTable.id, existing.id));
      await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, existing.id));
      await db.delete(trustedDevicesTable).where(eq(trustedDevicesTable.userId, existing.id));
      await sendInviteEmail();
      await auditLog(req.authUser!.id, req.authUser!.email, "cockpit_user.upgrade", "user", existing.id, { email: emailLc });
      return res.json({ ok: true, action: "upgraded", userId: existing.id });
    }

    // Création d'un nouveau compte
    const [newUser] = await db.insert(usersTable).values({
      email: emailLc,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password: unusablePassword,
      role: "super_admin",
      organizationId: caller!.organizationId,
      isActive: true,
      invitedById: req.authUser!.id,
      invitedAt: new Date(),
      mustChangePassword: true,
      passwordResetToken: inviteToken,
      passwordResetTokenExpiresAt: inviteExpiresAt,
    }).returning({ id: usersTable.id });

    await sendInviteEmail();

    await auditLog(req.authUser!.id, req.authUser!.email, "cockpit_user.invite", "user", newUser.id, { email: emailLc });
    return res.status(201).json({ ok: true, action: "created", userId: newUser.id });
  } catch (e) { next(e); }
});

// ── PATCH /super-admin/cockpit-users/:id/status ───────────────────────────────
router.patch("/super-admin/cockpit-users/:id/status", sa, async (req, res, next) => {
  try {
    const { id } = req.params as Record<string, string>;
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
    const { id } = req.params as Record<string, string>;

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
        orgContactEmail: organizationsTable.contactEmail,
        // Timestamp d'activation (début de la première période active)
        activatedAt: organizationSubscriptionsTable.currentPeriodStart,
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
    const currentToken = (req.headers.authorization as string)?.replace("Bearer ", "");
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
