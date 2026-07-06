import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "@workspace/db";
import {
  usersTable, authSessionsTable, expertContextSessionsTable,
  organizationMembersTable,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

export type AuthUser = {
  id: string;
  email: string;
  /** Rôle global de l'utilisateur dans la table users. */
  role: string;
  /**
   * Rôle de l'utilisateur dans l'organisation active (organization_members.role).
   * Présent uniquement si une ligne existe ; null sinon.
   * Valeurs possibles : 'owner' | 'admin' | 'manager' | 'member' | …
   */
  orgRole: string | null;
  firstName: string;
  lastName: string;
  /** Organisation active pour cette session. Toujours définie (partitionnement strict). */
  organizationId: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Résout un token UUID vers un utilisateur via un lookup en base de données.
 * Seuls les tokens UUID v4 stockés dans auth_sessions sont acceptés.
 * L'organisation active est lue depuis session.activeOrgId (multi-org),
 * avec repli sur users.organizationId si non définie.
 *
 * Enrichit aussi orgRole depuis organization_members pour permettre à un
 * owner/admin d'org d'accéder aux endpoints billing même si son role global
 * est un rôle métier (commercial, manager, etc.).
 */
async function resolveToken(rawToken: string): Promise<AuthUser | null> {
  if (!UUID_REGEX.test(rawToken)) {
    return null;
  }

  const now = new Date();
  const sessions = await db
    .select({ userId: authSessionsTable.userId, activeOrgId: authSessionsTable.activeOrgId })
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

  // Priorité : org active de la session ; repli sur org primaire de l'utilisateur
  const organizationId = sessions[0].activeOrgId ?? user.organizationId;

  // Récupérer le rôle d'appartenance dans l'org active
  const [membership] = await db
    .select({ role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.userId, user.id),
        eq(organizationMembersTable.organizationId, organizationId),
      ),
    )
    .limit(1);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    orgRole: membership?.role ?? null,
    firstName: user.firstName,
    lastName: user.lastName,
    organizationId,
  };
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization;
  // Pour les médias (<img src>), le navigateur n'envoie pas de Bearer header.
  // Solution pragmatique : accepter aussi un token via query string.
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

  // Expert context switching: if the request carries a valid context token,
  // scope the request to the target client org instead of the expert's own org.
  const ctxToken = req.headers["x-expert-context-token"];
  if (typeof ctxToken === "string" && ctxToken.length > 0) {
    const now = new Date();
    const [session] = await db
      .select({
        targetOrgId: expertContextSessionsTable.targetOrgId,
        expertUserId: expertContextSessionsTable.expertUserId,
      })
      .from(expertContextSessionsTable)
      .where(
        and(
          eq(expertContextSessionsTable.token, ctxToken),
          gt(expertContextSessionsTable.expiresAt, now),
        ),
      )
      .limit(1);
    // Only apply if the session belongs to the authenticated user (security)
    if (session && session.expertUserId === authUser.id) {
      req.authUser = { ...authUser, organizationId: session.targetOrgId };
    }
  }

  next();
};

/**
 * Un utilisateur est considéré admin si :
 *  - son rôle global (users.role) est 'super_admin' ou 'admin' — héritage historique
 *  - OU son rôle dans l'org active (organization_members.role) est 'owner' ou 'admin'
 *    → permet aux fondateurs d'org multi-tenant d'accéder à la facturation
 *    sans élever leur rôle global
 */
function isEffectiveAdmin(authUser: AuthUser): boolean {
  if (authUser.role === "super_admin" || authUser.role === "admin") return true;
  if (authUser.orgRole === "owner" || authUser.orgRole === "admin") return true;
  return false;
}

export const requireRole = (...roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    // Super-admin et org-owner/admin passent toujours
    if (isEffectiveAdmin(req.authUser)) {
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

export const requireAdmin = requireRole("admin", "super_admin");
export const requireManagerOrAbove = requireRole("manager", "admin", "super_admin");
