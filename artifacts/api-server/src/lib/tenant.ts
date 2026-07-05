/**
 * Contexte tenant Gameasu.
 * Pour cette première itération SaaS, chaque utilisateur est rattaché
 * à une et une seule organisation via `organization_members`. On expose un
 * helper `getCurrentOrganizationId(userId)` utilisé par toutes les routes
 * `/api/organizations*`, `/api/subscriptions*`, `/api/billing*`, etc.
 *
 * Le partitionnement des données métier (clients, projets, factures, …) par
 * organisation est une étape ultérieure : la première itération scope
 * uniquement la couche workspace/abonnement/facturation.
 */
import { db } from "@workspace/db";
import { organizationMembersTable, organizationSubscriptionsTable, subscriptionPlansTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Retourne l'organisation à laquelle appartient l'utilisateur courant.
 * AUCUN fallback : un utilisateur sans membership ne peut accéder à
 * aucun contexte tenant — les routes SaaS doivent renvoyer 403.
 * (Le seed SaaS rattache déjà tous les utilisateurs seedés à
 * l'organisation `gameasu-demo`.)
 */
/**
 * Résout l'organisation courante dans l'ordre de priorité suivant :
 *  1. activeOrgId fourni par le middleware requireAuth (session.activeOrgId) — source of truth multi-org
 *  2. Première membership en DB (fallback hors-contexte request)
 */
export async function getCurrentOrganizationId(userId: string, activeOrgId?: string | null): Promise<string | null> {
  if (activeOrgId) return activeOrgId;
  const member = await db.select({ orgId: organizationMembersTable.organizationId })
    .from(organizationMembersTable)
    .where(eq(organizationMembersTable.userId, userId))
    .limit(1);
  return member[0]?.orgId ?? null;
}

export async function getCurrentSubscription(orgId: string) {
  const rows = await db.select({
    sub: organizationSubscriptionsTable,
    plan: subscriptionPlansTable,
  })
    .from(organizationSubscriptionsTable)
    .innerJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ))
    .limit(1);
  return rows[0] ?? null;
}
