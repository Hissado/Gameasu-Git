import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "@workspace/db";
import { usersTable, authSessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  /** Organisation tenant de l'utilisateur. Toujours définie (partitionnement strict). */
  organizationId: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

/**
 * Résout un token vers un utilisateur.
 * Stratégie :
 * 1) UUID session token → lookup dans auth_sessions (préféré, sécurisé)
 * 2) Base64 legacy (userId:email) → lookup direct user (rétrocompat sessions existantes)
 */
async function resolveToken(rawToken: string): Promise<AuthUser | null> {
  // Stratégie 1 : session UUID (format UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(rawToken)) {
    const now = new Date();
    const sessions = await db
      .select({ userId: authSessionsTable.userId })
      .from(authSessionsTable)
      .where(and(eq(authSessionsTable.token, rawToken), gt(authSessionsTable.expiresAt, now)))
      .limit(1);
    if (!sessions[0]) return null;
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, sessions[0].userId))
      .limit(1);
    const user = users[0];
    if (!user || !user.isActive || !user.organizationId) return null;
    return { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, organizationId: user.organizationId };
  }

  // Stratégie 2 : Base64 legacy — rétrocompat pour les sessions déjà en localStorage
  try {
    const decoded = Buffer.from(rawToken, "base64").toString();
    const [userId] = decoded.split(":");
    if (!userId) return null;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user || !user.isActive || !user.organizationId) return null;
    return { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, organizationId: user.organizationId };
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
  if (!auth && !queryToken) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  const rawToken = queryToken ?? auth!.replace("Bearer ", "");
  const authUser = await resolveToken(rawToken);
  if (!authUser) {
    res.status(401).json({ error: "Token invalide ou session expirée" });
    return;
  }
  req.authUser = authUser;
  next();
};

export const requireRole = (...roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    if (req.authUser.role === "super_admin" || req.authUser.role === "admin") {
      next();
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "Accès refusé", detail: `Cette action requiert un des rôles : ${roles.join(", ")}` });
      return;
    }
    next();
  };
};

export const requireAdmin = requireRole("admin", "super_admin");
export const requireManagerOrAbove = requireRole("manager", "admin", "super_admin");
