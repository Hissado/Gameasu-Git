import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  organizationsTable,
  usersTable,
  userPresenceTable,
  cockpitAuditLogsTable,
  incidentsTable,
  rolePermissionsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

export interface DeleteOrganizationReport {
  organizationId: string;
  usersRemoved: number;
}

/**
 * Suppression DÉFINITIVE d'une organisation (tenant) et de toutes ses données.
 *
 * Le schéma repose massivement sur des FK `onDelete: cascade` scoppées par
 * `organizationId` : supprimer la ligne `organizations` purge en cascade ~167
 * tables enfants (CRM, projets, RH, finance, stock, messagerie, kiosk…).
 *
 * ⚠️ Exception : 4 tables référencent `users` en `NO ACTION`. Comme les
 * utilisateurs de l'organisation sont eux-mêmes supprimés en cascade, ces
 * références bloqueraient la suppression. On les neutralise donc AVANT le
 * cascade, dans la même transaction :
 *   - user_presence.user_id      (NOT NULL, PK)  → suppression des lignes
 *   - cockpit_audit_logs.actor_id (nullable)     → mise à NULL (on conserve le log)
 *   - incidents.created_by_id     (nullable)     → mise à NULL (on conserve l'incident)
 *   - role_permissions.granted_by_id (nullable)  → mise à NULL (on conserve le grant)
 *
 * Si une nouvelle table ajoute une FK `NO ACTION`/`RESTRICT` vers une table
 * purgée par le cascade, elle devra être traitée ici de la même manière.
 *
 * Opération IRRÉVERSIBLE. Réservée au super-admin via endpoint protégé ; les
 * gardes métier (org plateforme / org par défaut) sont appliquées par l'appelant.
 */
export async function deleteOrganization(organizationId: string): Promise<DeleteOrganizationReport> {
  return db.transaction(async (tx) => {
    // Sous-requête des utilisateurs du tenant (réutilisée pour scopper le nettoyage
    // des FK bloquantes) — évite de charger des milliers d'IDs en mémoire / de
    // dépasser la limite de paramètres sur de très grosses organisations.
    const orgUserIds = tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.organizationId, organizationId));

    const [{ count: usersRemoved }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.organizationId, organizationId));

    // Neutralise les 4 FK NO ACTION vers users AVANT le cascade.
    await tx.delete(userPresenceTable).where(inArray(userPresenceTable.userId, orgUserIds));
    await tx
      .update(cockpitAuditLogsTable)
      .set({ actorId: null })
      .where(inArray(cockpitAuditLogsTable.actorId, orgUserIds));
    await tx
      .update(incidentsTable)
      .set({ createdById: null })
      .where(inArray(incidentsTable.createdById, orgUserIds));
    await tx
      .update(rolePermissionsTable)
      .set({ grantedById: null })
      .where(inArray(rolePermissionsTable.grantedById, orgUserIds));

    // Le cascade FK nettoie toutes les tables enfants scoppées par organizationId.
    await tx.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));

    logger.warn(
      { organizationId, usersRemoved },
      "deleteOrganization: organisation et données associées supprimées définitivement",
    );

    return { organizationId, usersRemoved };
  });
}
