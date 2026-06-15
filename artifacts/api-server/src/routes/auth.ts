import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, authSessionsTable, twoFactorCodesTable, trustedDevicesTable } from "@workspace/db";
import { eq, and, gt, lt } from "drizzle-orm";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { audit } from "../lib/audit";
import { sendEmail, buildPasswordResetEmail, buildTwoFactorEmail } from "../lib/email";
import { userPermissions } from "../lib/rbac/permissions";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;
const TRUSTED_DEVICE_TTL_DAYS = 60;
const TWO_FA_TTL_MINUTES = 10;

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

/** Purge les sessions expirées (best-effort, non bloquant). */
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
    await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "login_failed", {
      entityType: "user",
      entityId: user.id,
      payload: { reason: "wrong_password" },
    });
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

  // Vérifier appareil de confiance
  if (deviceToken && typeof deviceToken === "string") {
    const devices = await db
      .select()
      .from(trustedDevicesTable)
      .where(and(eq(trustedDevicesTable.userId, user.id), gt(trustedDevicesTable.expiresAt, new Date())))
      .limit(20);

    for (const device of devices) {
      if (!device.revokedAt && await bcrypt.compare(deviceToken, device.deviceTokenHash)) {
        // Appareil de confiance reconnu → bypass 2FA
        const token = await createSession(user.id, req);
        await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
        await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "login", {
          entityType: "user", entityId: user.id, payload: { method: "trusted_device" },
        });
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

  await db.insert(twoFactorCodesTable).values({
    userId: user.id,
    tempToken,
    codeHash,
    expiresAt,
  });

  // Envoyer email 2FA
  const emailTpl = buildTwoFactorEmail({
    recipientName: `${user.firstName} ${user.lastName}`,
    code,
    expirationMinutes: TWO_FA_TTL_MINUTES,
  });
  await sendEmail({ ...emailTpl, to: user.email });

  await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "login_2fa_sent", {
    entityType: "user", entityId: user.id,
  });

  return res.json({ status: "2fa_required", tempToken });
});

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
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId)).limit(1);
    if (user) {
      await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "login_2fa_failed", {
        entityType: "user", entityId: user.id,
      });
    }
    return res.status(400).json({ error: "Code de vérification incorrect." });
  }

  // Marquer comme utilisé
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
      userId: user.id,
      deviceTokenHash,
      label,
      expiresAt: devExpiresAt,
      ipAddress: (req.ip ?? null) as any,
    });
    newDeviceToken = rawDeviceToken;
    await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "trusted_device_added", {
      entityType: "user", entityId: user.id, payload: { label },
    });
  }

  await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "login_2fa_success", {
    entityType: "user", entityId: user.id,
  });

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

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth) {
    const rawToken = auth.replace("Bearer ", "");
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(rawToken)) {
      await db.delete(authSessionsTable).where(eq(authSessionsTable.token, rawToken)).catch(() => {});
    }
  }
  return res.json({ success: true });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  // Résoudre le token (session UUID ou Base64 legacy)
  const rawToken = auth.replace("Bearer ", "");

  let userId: string | null = null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(rawToken)) {
    const now = new Date();
    const [session] = await db
      .select({ userId: authSessionsTable.userId })
      .from(authSessionsTable)
      .where(and(eq(authSessionsTable.token, rawToken), gt(authSessionsTable.expiresAt, now)))
      .limit(1);
    userId = session?.userId ?? null;
  } else {
    try {
      const decoded = Buffer.from(rawToken, "base64").toString();
      [userId] = decoded.split(":");
    } catch { /* ignore */ }
  }

  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const perms = await userPermissions(user.id);
  return res.json({
    id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    role: user.role, avatarUrl: user.avatarUrl, phone: user.phone ?? null,
    isClient: user.isClient, mustChangePassword: user.mustChangePassword,
    departmentId: user.departmentId, permissions: perms,
  });
});

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────
router.patch("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  try {
    const rawToken = auth.replace("Bearer ", "");
    let userId: string | null = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(rawToken)) {
      const now = new Date();
      const [session] = await db.select({ userId: authSessionsTable.userId }).from(authSessionsTable)
        .where(and(eq(authSessionsTable.token, rawToken), gt(authSessionsTable.expiresAt, now))).limit(1);
      userId = session?.userId ?? null;
    } else {
      const decoded = Buffer.from(rawToken, "base64").toString();
      [userId] = decoded.split(":");
    }
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!u) return res.status(401).json({ error: "Unauthorized" });
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
    return res.json({ id: updated.id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName, role: updated.role, avatarUrl: updated.avatarUrl, phone: updated.phone ?? null });
  } catch {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── PUT /api/auth/password ───────────────────────────────────────────────────
router.put("/auth/password", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Authentification requise" });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Mot de passe actuel et nouveau requis" });
  if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caractères" });
  try {
    const rawToken = auth.replace("Bearer ", "");
    let userId: string | null = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(rawToken)) {
      const now = new Date();
      const [s] = await db.select({ userId: authSessionsTable.userId }).from(authSessionsTable)
        .where(and(eq(authSessionsTable.token, rawToken), gt(authSessionsTable.expiresAt, now))).limit(1);
      userId = s?.userId ?? null;
    } else {
      const decoded = Buffer.from(rawToken, "base64").toString();
      [userId] = decoded.split(":");
    }
    if (!userId) return res.status(401).json({ error: "Token invalide" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
    const ok = await verifyPassword(String(currentPassword), user.password);
    if (!ok) return res.status(403).json({ error: "Mot de passe actuel incorrect" });
    if (String(currentPassword) === String(newPassword)) return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'actuel" });
    const hashed = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, userId));
    return res.json({ success: true });
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post("/auth/change-password", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Authentification requise" });
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caractères" });
  try {
    const rawToken = auth.replace("Bearer ", "");
    let userId: string | null = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(rawToken)) {
      const now = new Date();
      const [s] = await db.select({ userId: authSessionsTable.userId }).from(authSessionsTable)
        .where(and(eq(authSessionsTable.token, rawToken), gt(authSessionsTable.expiresAt, now))).limit(1);
      userId = s?.userId ?? null;
    } else {
      const decoded = Buffer.from(rawToken, "base64").toString();
      [userId] = decoded.split(":");
    }
    if (!userId) return res.status(401).json({ error: "Token invalide" });
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
    await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "password_change", {
      entityType: "user", entityId: user.id,
    });
    return res.json({ success: true });
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }
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
  await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "invitation_accept", {
    entityType: "user", entityId: user.id,
  });
  return res.json({
    token: sessionToken,
    user: {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, avatarUrl: user.avatarUrl, isClient: user.isClient, mustChangePassword: false,
    },
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== "string" || !email) return res.status(400).json({ error: "Email requis" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (user && user.isActive) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.update(usersTable).set({ passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt }).where(eq(usersTable.id, user.id));
    const baseUrl = (process.env.PUBLIC_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "localhost"}`).replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const tpl = buildPasswordResetEmail({ recipientName: `${user.firstName} ${user.lastName}`, resetUrl });
    await sendEmail({ ...tpl, to: user.email });
    await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "password_reset_request", {
      entityType: "user", entityId: user.id,
    });
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
  await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email, organizationId: user.organizationId } } as any, "password_reset_complete", {
    entityType: "user", entityId: user.id,
  });
  return res.json({ success: true });
});

export default router;
