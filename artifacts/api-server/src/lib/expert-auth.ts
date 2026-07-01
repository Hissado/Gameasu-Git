/**
 * Middlewares de sécurité Expert Portal.
 *
 * requireExpertFirmMember  — vérifie que req.authUser est membre du cabinet :firmId
 * requireExpertClientAccess — vérifie que le cabinet a un accès actif à l'org cible
 */
import type { RequestHandler } from "express";
import { db } from "@workspace/db";
import { expertFirmMembersTable, expertClientAccessTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Vérifie que l'utilisateur connecté est membre du cabinet identifié par
 * `req.params.firmId`. Renvoie 403 sinon.
 */
export const requireExpertFirmMember: RequestHandler = async (req, res, next) => {
  if (!req.authUser) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  const firmId = req.params.firmId as string;
  if (!firmId) {
    res.status(400).json({ error: "firmId manquant" });
    return;
  }
  const [member] = await db
    .select({ id: expertFirmMembersTable.id, role: expertFirmMembersTable.role })
    .from(expertFirmMembersTable)
    .where(
      and(
        eq(expertFirmMembersTable.firmId, firmId),
        eq(expertFirmMembersTable.userId, req.authUser.id),
      ),
    )
    .limit(1);

  if (!member) {
    res.status(403).json({ error: "Accès refusé : vous n'êtes pas membre de ce cabinet" });
    return;
  }
  // Expose le rôle cabinet pour les gardes owner/admin éventuelles en aval
  (req as any).expertMemberRole = member.role;
  next();
};

/**
 * Vérifie que le cabinet (:firmId) a un accès actif à l'organisation (:orgId).
 * Doit être chaîné après requireExpertFirmMember.
 */
export const requireExpertClientAccess: RequestHandler = async (req, res, next) => {
  const firmId = req.params.firmId as string;
  const orgId = req.params.orgId as string;
  if (!firmId || !orgId) {
    res.status(400).json({ error: "firmId et orgId requis" });
    return;
  }
  const [access] = await db
    .select({ id: expertClientAccessTable.id, accessLevel: expertClientAccessTable.accessLevel })
    .from(expertClientAccessTable)
    .where(
      and(
        eq(expertClientAccessTable.firmId, firmId),
        eq(expertClientAccessTable.orgId, orgId),
        eq(expertClientAccessTable.isActive, true),
      ),
    )
    .limit(1);

  if (!access) {
    res.status(403).json({ error: "Accès refusé : ce cabinet n'a pas accès à ce client" });
    return;
  }
  (req as any).expertAccessLevel = access.accessLevel;
  next();
};
