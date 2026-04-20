import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = users[0];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = Buffer.from(`${user.id}:${user.email}`).toString("base64");
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
    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isClient: user.isClient,
    });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
