import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { audit } from "../lib/audit";
import { sendEmail, buildPasswordResetEmail } from "../lib/email";
import { userPermissions } from "../lib/rbac/permissions";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.email, String(email).toLowerCase())).limit(1);
  const user = users[0];
  if (!user || user.password !== password) {
    await audit({ ip: req.ip, headers: req.headers } as any, "login_failed", { entityType: "user", payload: { email } });
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: "Compte désactivé" });
  }
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  const token = Buffer.from(`${user.id}:${user.email}`).toString("base64");
  await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email } } as any, "login", { entityType: "user", entityId: user.id });
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isClient: user.isClient,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

router.post("/auth/logout", (req, res) => {
  return res.json({ success: true });
});

router.put("/auth/password", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Authentification requise" });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Mot de passe actuel et nouveau mot de passe requis" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caractères" });
  }
  try {
    const decoded = Buffer.from(auth.replace("Bearer ", ""), "base64").toString();
    const [userId] = decoded.split(":");
    if (!userId) return res.status(401).json({ error: "Token invalide" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
    if (user.password !== currentPassword) {
      return res.status(403).json({ error: "Mot de passe actuel incorrect" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'actuel" });
    }
    await db.update(usersTable).set({ password: newPassword }).where(eq(usersTable.id, userId));
    return res.json({ success: true });
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }
});

router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = Buffer.from(auth.replace("Bearer ", ""), "base64").toString();
    const [userId] = decoded.split(":");
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const perms = await userPermissions(user.id);
    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      phone: user.phone ?? null,
      isClient: user.isClient,
      mustChangePassword: user.mustChangePassword,
      departmentId: user.departmentId,
      permissions: perms,
    });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

/** PATCH /api/auth/me — mise à jour des informations de base de l'utilisateur connecté. */
router.patch("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = Buffer.from(auth.replace("Bearer ", ""), "base64").toString();
    const [userId] = decoded.split(":");
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users[0]) return res.status(401).json({ error: "Unauthorized" });
    const { phone, avatarUrl } = req.body || {};
    const patch: Record<string, string | null> = {};
    if (phone !== undefined) patch.phone = phone || null;
    if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl || null;
    if (Object.keys(patch).length > 0) {
      await db.update(usersTable).set(patch).where(eq(usersTable.id, userId));
    }
    const updated = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const u = updated[0];
    return res.json({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      avatarUrl: u.avatarUrl,
      phone: u.phone ?? null,
    });
  } catch {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────────────
// Onboarding : invitation, change-password forcé, mot de passe oublié
// ──────────────────────────────────────────────────────────────────

/** Change le mot de passe (utilisateur connecté). Lève le flag mustChangePassword. */
router.post("/auth/change-password", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Authentification requise" });
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caractères" });
  }
  try {
    const decoded = Buffer.from(auth.replace("Bearer ", ""), "base64").toString();
    const [userId] = decoded.split(":");
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
    if (!currentPassword || user.password !== currentPassword) {
      return res.status(403).json({ error: "Mot de passe actuel incorrect" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'actuel" });
    }
    await db.update(usersTable).set({
      password: newPassword,
      mustChangePassword: false,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
      acceptedAt: user.acceptedAt ?? new Date(),
    }).where(eq(usersTable.id, userId));
    await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email } } as any, "password_change", { entityType: "user", entityId: user.id });
    return res.json({ success: true });
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }
});

/** Accepte une invitation : valide token + définit le mot de passe + retourne un token de session. */
router.post("/auth/accept-invitation", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== "string" || !token) return res.status(400).json({ error: "Token requis" });
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit comporter au moins 8 caractères" });
  }
  const [user] = await db.select().from(usersTable).where(and(
    eq(usersTable.passwordResetToken, token),
    gt(usersTable.passwordResetTokenExpiresAt, new Date()),
  )).limit(1);
  if (!user) return res.status(400).json({ error: "Token invalide ou expiré" });
  await db.update(usersTable).set({
    password: newPassword,
    mustChangePassword: false,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    acceptedAt: new Date(),
    lastLoginAt: new Date(),
  }).where(eq(usersTable.id, user.id));
  const sessionToken = Buffer.from(`${user.id}:${user.email}`).toString("base64");
  await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email } } as any, "invitation_accept", { entityType: "user", entityId: user.id });
  return res.json({
    token: sessionToken,
    user: {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, avatarUrl: user.avatarUrl, isClient: user.isClient,
      mustChangePassword: false,
    },
  });
});

/** Demande de réinitialisation. Réponse uniforme pour ne pas révéler l'existence d'un compte. */
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== "string" || !email) return res.status(400).json({ error: "Email requis" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (user && user.isActive) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await db.update(usersTable).set({
      passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt,
    }).where(eq(usersTable.id, user.id));
    const baseUrl = (process.env.PUBLIC_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "localhost"}`).replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const tpl = buildPasswordResetEmail({ recipientName: `${user.firstName} ${user.lastName}`, resetUrl });
    await sendEmail({ ...tpl, to: user.email });
    await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email } } as any, "password_reset_request", { entityType: "user", entityId: user.id });
  }
  return res.json({ success: true, message: "Si un compte existe, un email de réinitialisation a été envoyé." });
});

/** Validation du token + nouveau mot de passe. */
router.post("/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== "string" || !token) return res.status(400).json({ error: "Token requis" });
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit comporter au moins 8 caractères" });
  }
  const [user] = await db.select().from(usersTable).where(and(
    eq(usersTable.passwordResetToken, token),
    gt(usersTable.passwordResetTokenExpiresAt, new Date()),
  )).limit(1);
  if (!user) return res.status(400).json({ error: "Token invalide ou expiré" });
  await db.update(usersTable).set({
    password: newPassword,
    mustChangePassword: false,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
  }).where(eq(usersTable.id, user.id));
  await audit({ ip: req.ip, headers: req.headers, authUser: { id: user.id, email: user.email } } as any, "password_reset_complete", { entityType: "user", entityId: user.id });
  return res.json({ success: true });
});

export default router;
