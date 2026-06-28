import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, authSessionsTable, twoFactorCodesTable, trustedDevicesTable, organizationsTable } from "@workspace/db";
import { eq, and, gt, lt } from "drizzle-orm";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { audit } from "../lib/audit";
import { sendEmail, buildPasswordResetEmail, buildTwoFactorEmail } from "../lib/email";
import { getPublicBaseUrl, getCockpitBaseUrl } from "../lib/url";
import { userPermissions } from "../lib/rbac/permissions";

const router = Router();

// ─── Constants ───────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;
const TRUSTED_DEVICE_TTL_DAYS = 60;
const TWO_FA_TTL_MINUTES = 10;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Vérifie le mot de passe : supporte bcrypt et plaintext legacy (migration transparente). */
async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

/** Retourne true si stored est déjà un hash bcrypt. */
function isBcrypt(stored: string): boolean {
  return stored.startsWith("$2b$") || stored.startsWith("$2a$");
}

/** Crée une session dans auth_sessions et retourne le token UUID. */
async function createSession(userId: string, req: { ip?: string; headers?: Record<string, unknown> }): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(authSessionsTable).values({
    token,
    userId,
    expiresAt,
    userAgent: (req.headers?.["user-agent"] as string) ?? null,
    ipAddress: (req.ip ?? null) as any,
  });
  return token;
}

/**
 * Résout un Bearer token UUID vers un userId en DB.
 * Lève une erreur 401 via callback si le token est invalide/expiré.
 * Retourne null si auth header absent (laisser l'appelant décider).
 */
async function resolveSessionToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader) return null;
  const raw = authHeader.replace("Bearer ", "");
  if (!UUID_REGEX.test(raw)) return null;
  const now = new Date();
  const [session] = await db
    .select({ userId: authSessionsTable.userId })
    .from(authSessionsTable)
    .where(and(eq(authSessionsTable.token, raw), gt(authSessionsTable.expiresAt, now)))
    .limit(1);
  return session?.userId ?? null;
}

/** Purge les sessions expirées d'un utilisateur (best-effort, non bloquant). */
function purgeExpiredSessions(userId: string) {
  db.delete(authSessionsTable)
    .where(and(eq(authSessionsTable.userId, userId), lt(authSessionsTable.expiresAt, new Date())))
    .catch(() => {});
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Étape 1 : vérifier identifiants + appareil de confiance → envoyer OTP 2FA
router.post("/auth/login", async (req, res) => {
  const { email, password, deviceToken } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, String(email).toLowerCase()))
    .limit(1);

  if (!user) {
    // Timing-safe : ne pas révéler l'existence du compte
    await bcrypt.compare(password, "$2b$12$invalidhashfortimingsafety000000000000000000000000000");
    await audit({ ip: req.ip, headers: req.headers } as any, "login_failed", {
      entityType: "user",
      payload: { email, reason: "user_not_found" },
      organizationId: "00000000-0000-0000-0000-000000000000",
    });
    return res.status(401).json({ error: "Identifiants incorrects" });
  }

  const passwordOk = await verifyPassword(String(password), user.password);
  if (!passwordOk) {
    await audit(
      { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
      "login_failed",
      { entityType: "user", entityId: user.id, payload: { reason: "wrong_password" } },
    );
    return res.status(401).json({ error: "Identifiants incorrects" });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "Compte désactivé. Contactez votre administrateur." });
  }

  // Migration transparente : si mot de passe en clair, on le hache maintenant
  if (!isBcrypt(user.password)) {
    const hashed = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));
  }

  purgeExpiredSessions(user.id);

  // Vérifier appareil de confiance (bypass 2FA)
  if (deviceToken && typeof deviceToken === "string") {
    const devices = await db
      .select()
      .from(trustedDevicesTable)
      .where(and(eq(trustedDevicesTable.userId, user.id), gt(trustedDevicesTable.expiresAt, new Date())))
      .limit(20);

    for (const device of devices) {
      if (!device.revokedAt && await bcrypt.compare(deviceToken, device.deviceTokenHash)) {
        const token = await createSession(user.id, req);
        await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
        await audit(
          { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
          "login",
          { entityType: "user", entityId: user.id, payload: { method: "trusted_device" } },
        );
        const perms = await userPermissions(user.id);
        return res.json({
          token,
          user: {
            id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
            role: user.role, avatarUrl: user.avatarUrl, isClient: user.isClient,
            mustChangePassword: user.mustChangePassword, permissions: perms,
          },
        });
      }
    }
  }

  // Générer code OTP 6 chiffres
  const code = String(randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  const tempToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TWO_FA_TTL_MINUTES * 60 * 1000);

  // Invalider les anciens codes non utilisés de cet utilisateur
  await db.delete(twoFactorCodesTable).where(
    and(eq(twoFactorCodesTable.userId, user.id), eq(twoFactorCodesTable.used, false)),
  );

  await db.insert(twoFactorCodesTable).values({ userId: user.id, tempToken, codeHash, expiresAt });

  // Envoyer email 2FA
  const emailTpl = buildTwoFactorEmail({
    recipientName: `${user.firstName} ${user.lastName}`,
    code,
    expirationMinutes: TWO_FA_TTL_MINUTES,
  });
  await sendEmail({ ...emailTpl, to: user.email });

  await audit(
    { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
    "login_2fa_sent",
    { entityType: "user", entityId: user.id },
  );

  // En développement, exposer le code OTP dans la réponse pour éviter d'avoir besoin d'un vrai serveur mail
  const devOtp = process.env.NODE_ENV !== "production" ? code : undefined;

  return res.json({ status: "2fa_required", tempToken, ...(devOtp ? { devOtp } : {}) });
});

// Anti-bruteforce OTP : nombre d'échecs de vérification par tempToken (en mémoire).
// Au-delà du seuil, le code 2FA est invalidé → l'utilisateur doit recommencer la
// connexion. Empêche le bruteforce d'un code à 6 chiffres dans sa fenêtre de validité.
const twoFaAttempts = new Map<string, number>();
const MAX_2FA_ATTEMPTS = 5;

// ─── POST /api/auth/login/verify-2fa ─────────────────────────────────────────
// Étape 2 : valider le code OTP → créer la session définitive
router.post("/auth/login/verify-2fa", async (req, res) => {
  const { tempToken, code, rememberMe } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ error: "Token temporaire et code requis" });
  }

  const [record] = await db
    .select()
    .from(twoFactorCodesTable)
    .where(
      and(
        eq(twoFactorCodesTable.tempToken, String(tempToken)),
        eq(twoFactorCodesTable.used, false),
        gt(twoFactorCodesTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    return res.status(400).json({ error: "Code expiré ou invalide. Recommencez la connexion." });
  }

  const codeOk = await bcrypt.compare(String(code).trim(), record.codeHash);
  if (!codeOk) {
    const attemptKey = String(tempToken);
    const attempts = (twoFaAttempts.get(attemptKey) ?? 0) + 1;
    twoFaAttempts.set(attemptKey, attempts);
    const locked = attempts >= MAX_2FA_ATTEMPTS;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId)).limit(1);
    if (user) {
      await audit(
        { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
        locked ? "login_2fa_locked" : "login_2fa_failed",
        { entityType: "user", entityId: user.id },
      );
    }
    if (locked) {
      // Trop d'échecs : on invalide le code pour forcer une nouvelle connexion.
      await db.update(twoFactorCodesTable).set({ used: true }).where(eq(twoFactorCodesTable.id, record.id));
      twoFaAttempts.delete(attemptKey);
      return res.status(429).json({ error: "Trop de tentatives. Recommencez la connexion." });
    }
    return res.status(400).json({ error: "Code de vérification incorrect." });
  }

  // Marquer comme utilisé
  twoFaAttempts.delete(String(tempToken));
  await db.update(twoFactorCodesTable).set({ used: true }).where(eq(twoFactorCodesTable.id, record.id));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId)).limit(1);
  if (!user || !user.isActive) {
    return res.status(403).json({ error: "Compte introuvable ou désactivé." });
  }

  const token = await createSession(user.id, req);
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  let newDeviceToken: string | undefined;
  if (rememberMe) {
    const rawDeviceToken = randomBytes(32).toString("hex");
    const deviceTokenHash = await bcrypt.hash(rawDeviceToken, 10);
    const devExpiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const ua = req.headers["user-agent"] ?? "";
    const label = ua.length > 0 ? ua.slice(0, 120) : "Appareil inconnu";
    await db.insert(trustedDevicesTable).values({
      userId: user.id, deviceTokenHash, label,
      expiresAt: devExpiresAt, ipAddress: (req.ip ?? null) as any,
    });
    newDeviceToken = rawDeviceToken;
    await audit(
      { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
      "trusted_device_added",
      { entityType: "user", entityId: user.id, payload: { label } },
    );
  }

  await audit(
    { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
    "login_2fa_success",
    { entityType: "user", entityId: user.id },
  );

  const perms = await userPermissions(user.id);
  return res.json({
    token,
    ...(newDeviceToken ? { deviceToken: newDeviceToken } : {}),
    user: {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, avatarUrl: user.avatarUrl, isClient: user.isClient,
      mustChangePassword: user.mustChangePassword, permissions: perms,
    },
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res) => {
  const auth = (req.headers.authorization as string);
  if (auth) {
    const raw = auth.replace("Bearer ", "");
    if (UUID_REGEX.test(raw)) {
      await db.delete(authSessionsTable).where(eq(authSessionsTable.token, raw)).catch(() => {});
    }
  }
  return res.json({ success: true });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res) => {
  const userId = await resolveSessionToken((req.headers.authorization as string));
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const perms = await userPermissions(user.id);

  // Fetch org details for branding (name, logo)
  let orgName: string | null = null;
  let orgLegalName: string | null = null;
  let orgLogoUrl: string | null = null;
  if (user.organizationId) {
    const [org] = await db
      .select({ name: organizationsTable.name, legalName: organizationsTable.legalName, logoUrl: organizationsTable.logoUrl })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, user.organizationId))
      .limit(1);
    if (org) { orgName = org.name; orgLegalName = org.legalName; orgLogoUrl = org.logoUrl; }
  }

  return res.json({
    id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    role: user.role, avatarUrl: user.avatarUrl, phone: user.phone ?? null,
    isClient: user.isClient, mustChangePassword: user.mustChangePassword,
    departmentId: user.departmentId, permissions: perms,
    organizationId: user.organizationId,
    organizationName: orgName,
    organizationLegalName: orgLegalName,
    organizationLogoUrl: orgLogoUrl,
  });
});

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────
router.patch("/auth/me", async (req, res) => {
  const userId = await resolveSessionToken((req.headers.authorization as string));
  if (!userId) return res.status(401).json({ error: "Authentification requise" });

  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!u) return res.status(401).json({ error: "Utilisateur introuvable" });

  const { phone, avatarUrl, email } = req.body || {};
  const patch: Record<string, string | null> = {};
  if (phone !== undefined) patch.phone = phone || null;
  if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl || null;
  if (email !== undefined && email) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
    if (existing.length > 0 && existing[0].id !== userId) {
      return res.status(409).json({ error: "Cette adresse e-mail est déjà utilisée par un autre compte." });
    }
    patch.email = normalizedEmail;
  }
  if (Object.keys(patch).length > 0) {
    await db.update(usersTable).set(patch).where(eq(usersTable.id, userId));
  }
  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return res.json({
    id: updated.id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName,
    role: updated.role, avatarUrl: updated.avatarUrl, phone: updated.phone ?? null,
  });
});

// ─── PUT /api/auth/password ───────────────────────────────────────────────────
router.put("/auth/password", async (req, res) => {
  const userId = await resolveSessionToken((req.headers.authorization as string));
  if (!userId) return res.status(401).json({ error: "Authentification requise" });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Mot de passe actuel et nouveau requis" });
  if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caractères" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });

  const ok = await verifyPassword(String(currentPassword), user.password);
  if (!ok) return res.status(403).json({ error: "Mot de passe actuel incorrect" });
  if (String(currentPassword) === String(newPassword)) return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'actuel" });

  const hashed = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
  await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, userId));
  return res.json({ success: true });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post("/auth/change-password", async (req, res) => {
  const userId = await resolveSessionToken((req.headers.authorization as string));
  if (!userId) return res.status(401).json({ error: "Authentification requise" });

  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caractères" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });

  if (!currentPassword || !(await verifyPassword(String(currentPassword), user.password))) {
    return res.status(403).json({ error: "Mot de passe actuel incorrect" });
  }
  if (String(currentPassword) === String(newPassword)) return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'actuel" });

  const hashed = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
  await db.update(usersTable).set({
    password: hashed, mustChangePassword: false,
    passwordResetToken: null, passwordResetTokenExpiresAt: null,
    acceptedAt: user.acceptedAt ?? new Date(),
  }).where(eq(usersTable.id, user.id));

  await audit(
    { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
    "password_change",
    { entityType: "user", entityId: user.id },
  );
  return res.json({ success: true });
});

// ─── POST /api/auth/accept-invitation ─────────────────────────────────────────
router.post("/auth/accept-invitation", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== "string" || !token) return res.status(400).json({ error: "Token requis" });
  if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "Le mot de passe doit comporter au moins 8 caractères" });

  const [user] = await db.select().from(usersTable).where(
    and(eq(usersTable.passwordResetToken, token), gt(usersTable.passwordResetTokenExpiresAt, new Date())),
  ).limit(1);
  if (!user) return res.status(400).json({ error: "Token invalide ou expiré" });

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.update(usersTable).set({
    password: hashed, mustChangePassword: false,
    passwordResetToken: null, passwordResetTokenExpiresAt: null,
    acceptedAt: new Date(), lastLoginAt: new Date(),
  }).where(eq(usersTable.id, user.id));

  const sessionToken = await createSession(user.id, req);
  await audit(
    { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
    "invitation_accept",
    { entityType: "user", entityId: user.id },
  );
  await audit(
    { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
    "user_activated",
    { entityType: "user", entityId: user.id, payload: { email: user.email, role: user.role } },
  );
  // Email de confirmation à l'utilisateur activé (non bloquant)
  sendEmail({
    to: user.email,
    subject: "Votre compte Gameasu est activé",
    text: `Bonjour ${user.firstName},\n\nVotre compte Gameasu a bien été activé. Vous êtes désormais connecté(e) à la plateforme.\n\nL'équipe Gameasu`,
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f7f7f7;padding:24px;color:#111"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee"><div style="background:#0b0b0b;color:#fff;padding:24px 28px"><div style="color:#FF6B00;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:6px">GAMEASU</div><h1 style="margin:0;font-size:22px">Compte activé ✓</h1></div><div style="padding:24px 28px;line-height:1.6"><p>Bonjour <strong>${user.firstName} ${user.lastName}</strong>,</p><p>Votre compte Gameasu a bien été activé. Vous pouvez désormais vous connecter à la plateforme avec vos identifiants.</p><p style="font-size:13px;color:#555">Cet email confirme l'activation de votre accès. Contactez votre administrateur si vous n'êtes pas à l'origine de cette action.</p></div></div></body></html>`,
  }).catch(() => {});
  // Notification à l'admin/inviteur : confirmation que l'invité s'est activé (non bloquant)
  if (user.invitedById) {
    db.select({ email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, user.invitedById)).limit(1)
      .then(([inviter]) => {
        if (!inviter?.email) return;
        sendEmail({
          to: inviter.email,
          subject: `Invitation acceptée — ${user.firstName} ${user.lastName} a activé son compte`,
          text: `Bonjour ${inviter.firstName},\n\nL'utilisateur ${user.firstName} ${user.lastName} (${user.email}) a activé son compte Gameasu.\n\nL'équipe Gameasu`,
          html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f7f7f7;padding:24px;color:#111"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee"><div style="background:#0b0b0b;color:#fff;padding:24px 28px"><div style="color:#FF6B00;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:6px">GAMEASU</div><h1 style="margin:0;font-size:22px">Invitation acceptée ✓</h1></div><div style="padding:24px 28px;line-height:1.6"><p>Bonjour <strong>${inviter.firstName} ${inviter.lastName}</strong>,</p><p>L'utilisateur que vous avez invité a activé son compte :</p><ul style="margin:12px 0;padding-left:20px"><li><strong>${user.firstName} ${user.lastName}</strong></li><li>${user.email}</li><li>Rôle : ${user.role}</li></ul><p style="font-size:13px;color:#555">Il peut désormais accéder à la plateforme.</p></div></div></body></html>`,
        }).catch(() => {});
      }).catch(() => {});
  }
  return res.json({
    token: sessionToken,
    user: {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, avatarUrl: user.avatarUrl, isClient: user.isClient, mustChangePassword: false,
    },
  });
});

// Anti-abus : limite les demandes de réinitialisation par IP+email (5 / 15 min).
const forgotPwdAttempts = new Map<string, { count: number; resetAt: number }>();
function forgotRateLimited(key: string): boolean {
  const now = Date.now();
  const e = forgotPwdAttempts.get(key);
  if (!e || now > e.resetAt) { forgotPwdAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); return false; }
  e.count += 1;
  return e.count > 5;
}

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== "string" || !email) return res.status(400).json({ error: "Email requis" });

  const GENERIC_OK = { success: true, message: "Si un compte existe, un email de réinitialisation a été envoyé." };
  if (forgotRateLimited(`${req.ip}:${email.toLowerCase()}`)) return res.json(GENERIC_OK);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (user && user.isActive) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.update(usersTable).set({ passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt }).where(eq(usersTable.id, user.id));
    const origin = getPublicBaseUrl();
    // Super-admin → Cockpit (/cockpit/) ; utilisateur tenant → ERP (/).
    const cockpitOrigin = getCockpitBaseUrl();
    const resetUrl = user.role === "super_admin"
      ? `${cockpitOrigin}/cockpit/reset-password?token=${token}`
      : `${origin}/reset-password?token=${token}`;
    const tpl = buildPasswordResetEmail({ recipientName: `${user.firstName} ${user.lastName}`, resetUrl });
    await sendEmail({ ...tpl, to: user.email });
    await audit(
      { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
      "password_reset_request",
      { entityType: "user", entityId: user.id },
    );
  }
  return res.json({ success: true, message: "Si un compte existe, un email de réinitialisation a été envoyé." });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post("/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== "string" || !token) return res.status(400).json({ error: "Token requis" });
  if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "Le mot de passe doit comporter au moins 8 caractères" });

  const [user] = await db.select().from(usersTable).where(
    and(eq(usersTable.passwordResetToken, token), gt(usersTable.passwordResetTokenExpiresAt, new Date())),
  ).limit(1);
  if (!user) return res.status(400).json({ error: "Token invalide ou expiré" });

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.update(usersTable).set({
    password: hashed, mustChangePassword: false,
    passwordResetToken: null, passwordResetTokenExpiresAt: null,
  }).where(eq(usersTable.id, user.id));

  await audit(
    { ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any,
    "password_reset_complete",
    { entityType: "user", entityId: user.id },
  );
  return res.json({ success: true });
});

export default router;
