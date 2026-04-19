import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization;
  // Pour les médias (<img src>), le navigateur n'envoie pas de Bearer header.
  // Solution pragmatique pour MVP : accepter aussi un token via query string.
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
  if (!auth && !queryToken) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  try {
    const rawToken = queryToken ?? auth!.replace("Bearer ", "");
    const decoded = Buffer.from(rawToken, "base64").toString();
    const [userId] = decoded.split(":");
    if (!userId) {
      res.status(401).json({ error: "Token invalide" });
      return;
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Utilisateur introuvable ou désactivé" });
      return;
    }
    req.authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
};

export const requireRole = (...roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    // super_admin et admin ont accès à tout
    if (req.authUser.role === "super_admin" || req.authUser.role === "admin") {
      next();
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({
        error: "Accès refusé",
        detail: `Cette action requiert un des rôles : ${roles.join(", ")}`,
      });
      return;
    }
    next();
  };
};

// Raccourcis selon la matrice RBAC du cahier des charges §5.2
export const requireAdmin = requireRole("admin", "super_admin");
export const requireManagerOrAbove = requireRole("manager", "admin", "super_admin");
