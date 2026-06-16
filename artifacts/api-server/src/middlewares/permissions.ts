import type { RequestHandler } from "express";
import { hasPermission, userHasProjectAccess, userPermissions } from "../lib/rbac/permissions";

/**
 * Middleware générique : exige une permission précise.
 * Si l'utilisateur a `admin.access` + une perm "manage" du même domaine, ça passe
 * automatiquement (les rôles admin/super_admin ont toutes les permissions via le seed).
 */
export const requirePermission = (code: string): RequestHandler => {
  return async (req, res, next) => {
    if (!req.authUser) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    const ok = await hasPermission(req.authUser.id, code);
    if (!ok) {
      res.status(403).json({ error: "Accès refusé", detail: `Permission requise : ${code}` });
      return;
    }
    next();
  };
};

/** Au moins une des permissions listées suffit. */
export const requireAnyPermission = (...codes: string[]): RequestHandler => {
  return async (req, res, next) => {
    if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
    const perms = await userPermissions(req.authUser.id);
    if (!codes.some((c) => perms.includes(c))) {
      res.status(403).json({ error: "Accès refusé", detail: `Une de ces permissions est requise : ${codes.join(", ")}` });
      return;
    }
    next();
  };
};

/**
 * Vérifie l'accès au projet identifié par `req.params[paramName]`.
 * Bypass si l'utilisateur a `projects.read_all`.
 */
export const requireProjectAccess = (paramName = "id"): RequestHandler => {
  return async (req, res, next) => {
    if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
    const projectId = req.params[paramName] as string;
    if (!projectId) { res.status(400).json({ error: "Identifiant projet manquant" }); return; }
    const ok = await userHasProjectAccess(req.authUser.id, projectId);
    if (!ok) {
      res.status(403).json({ error: "Accès refusé à ce projet" });
      return;
    }
    next();
  };
};

/**
 * Bloque toute requête si l'utilisateur a `mustChangePassword=true`,
 * sauf les routes d'auth (logout, me, change-password). Renvoie 423 (Locked)
 * pour que le frontend redirige automatiquement vers /change-password.
 */
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/change-password",
  "/api/auth/password",
]);

export const enforcePasswordChange: RequestHandler = async (req, res, next) => {
  if (!req.authUser) return next();
  if (PASSWORD_CHANGE_ALLOWED_PATHS.has(req.originalUrl.split("?")[0])) return next();
  // Lecture rapide du flag (sans cache pour éviter la fenêtre incohérente).
  const { db, usersTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [u] = await db.select({ mustChangePassword: usersTable.mustChangePassword })
    .from(usersTable).where(eq(usersTable.id, req.authUser.id)).limit(1);
  if (u?.mustChangePassword) {
    res.status(423).json({
      error: "Changement de mot de passe requis",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
    return;
  }
  next();
};
