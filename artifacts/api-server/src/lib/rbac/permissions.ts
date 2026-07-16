import { db } from "@workspace/db";
import {
  rolesTable, rolePermissionsTable,
  userProjectAccessTable, collaboratorsTable, collaboratorAssignmentsTable, usersTable,
  userClientAccessTable, projectsTable, userPermissionOverridesTable,
} from "@workspace/db";
import { eq, and, isNull, or, inArray, asc, sql } from "drizzle-orm";

/**
 * Service RBAC : résolution des permissions et des projets accessibles.
 * Cache mémoire 30s par utilisateur pour éviter les appels DB répétitifs sur
 * chaque requête (les changements admin invalident en restartant le serveur ;
 * pour la production on basculera sur Redis ou un signal d'invalidation).
 */

type CacheEntry = { perms: Set<string>; projectIds: Set<string> | null; clientIds: Set<string> | null; expiresAt: number };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30_000;
const cacheKey = (userId: string) => `u:${userId}`;

export function invalidatePermissionsCache(userId?: string) {
  if (userId) CACHE.delete(cacheKey(userId));
  else CACHE.clear();
}

async function loadEntry(userId: string): Promise<CacheEntry> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return { perms: new Set(), projectIds: new Set(), clientIds: new Set(), expiresAt: Date.now() + TTL_MS };

  // Permissions = celles du rôle de l'utilisateur (résolu par code).
  // Priorité : rôle custom de l'org > rôle système (code identique impossible par contrainte DB).
  const [role] = await db.select().from(rolesTable).where(
    and(
      eq(rolesTable.code, user.role),
      or(eq(rolesTable.isSystem, true), eq(rolesTable.organizationId, user.organizationId)),
    )
  ).orderBy(rolesTable.isSystem).limit(1); // isSystem=false (custom) sort avant isSystem=true
  let perms = new Set<string>();
  if (role) {
    // DB réelle : role_permissions(role_id, permission_id UUID → permissions.id)
    // Le schema Drizzle est désaligné (permissionCode text n'existe pas en DB) ;
    // on utilise du SQL brut pour coller à la structure réelle.
    const rows = await db.execute(sql`
      SELECT p.code FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ${role.id}
    `);
    perms = new Set((rows.rows as Array<{ code: string }>).map((r) => r.code));
  }

  // Surcharges individuelles : grant (ajoute) et deny (retire), expirées ignorées.
  // DB table réelle : user_permission_overrides (schema Drizzle dit user_perm_overrides — désaligné).
  const now = new Date();
  const overridesResult = await db.execute(sql`
    SELECT permission_code, type, expires_at
    FROM user_permission_overrides
    WHERE user_id = ${userId}
  `);
  for (const ov of overridesResult.rows as Array<{ permission_code: string; type: string; expires_at: Date | null }>) {
    if (ov.expires_at && new Date(ov.expires_at) < now) continue;
    if (ov.type === "grant") perms.add(ov.permission_code);
    else if (ov.type === "deny") perms.delete(ov.permission_code);
  }

  // Clients accessibles : null si bypass (clients.read_all), sinon table user_client_access.
  let clientIds: Set<string> | null = null;
  if (!perms.has("clients.read_all") && !perms.has("projects.read_all")) {
    const directClients = await db
      .select({ cid: userClientAccessTable.clientId })
      .from(userClientAccessTable)
      .where(eq(userClientAccessTable.userId, userId));
    clientIds = new Set(directClients.map((d) => d.cid));
  }

  // Projets accessibles : si projects.read_all → null (= tous), sinon union :
  //   - user_project_access.userId (ACL projet directe)
  //   - collaborator_assignments du collaborator lié à user (dimension RH)
  //   - projects.clientId ∈ clientIds (héritage client → projets du client)
  let projectIds: Set<string> | null = null;
  if (!perms.has("projects.read_all")) {
    const direct = await db
      .select({ pid: userProjectAccessTable.projectId })
      .from(userProjectAccessTable)
      .where(eq(userProjectAccessTable.userId, userId));
    const collab = await db
      .select({ pid: collaboratorAssignmentsTable.projectId })
      .from(collaboratorAssignmentsTable)
      .innerJoin(collaboratorsTable, eq(collaboratorsTable.id, collaboratorAssignmentsTable.collaboratorId))
      .where(and(
        eq(collaboratorsTable.userId, userId),
        isNull(collaboratorsTable.deletedAt),
        or(eq(collaboratorAssignmentsTable.status, "active"), isNull(collaboratorAssignmentsTable.status)),
      ));
    let inheritedFromClients: { pid: string }[] = [];
    if (clientIds && clientIds.size > 0) {
      inheritedFromClients = await db
        .select({ pid: projectsTable.id })
        .from(projectsTable)
        .where(inArray(projectsTable.clientId, Array.from(clientIds)));
    }
    projectIds = new Set([
      ...direct.map((d) => d.pid),
      ...collab.map((d) => d.pid),
      ...inheritedFromClients.map((d) => d.pid),
    ]);
  }

  return { perms, projectIds, clientIds, expiresAt: Date.now() + TTL_MS };
}

async function getEntry(userId: string): Promise<CacheEntry> {
  const key = cacheKey(userId);
  const cached = CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const entry = await loadEntry(userId);
  CACHE.set(key, entry);
  return entry;
}

/** Renvoie true si l'utilisateur dispose de la permission (code unique). */
export async function hasPermission(userId: string, code: string): Promise<boolean> {
  const e = await getEntry(userId);
  return e.perms.has(code);
}

/** Renvoie l'ensemble des permissions de l'utilisateur. */
export async function userPermissions(userId: string): Promise<string[]> {
  const e = await getEntry(userId);
  return Array.from(e.perms);
}

/**
 * Renvoie la liste des projets accessibles à l'utilisateur.
 * `null` = accès total (permission `projects.read_all`).
 */
export async function userAccessibleProjectIds(userId: string): Promise<string[] | null> {
  const e = await getEntry(userId);
  return e.projectIds ? Array.from(e.projectIds) : null;
}

/** Vérifie l'accès à un projet précis. */
export async function userHasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const ids = await userAccessibleProjectIds(userId);
  if (ids === null) return true;
  return ids.includes(projectId);
}

/**
 * Renvoie la liste des clients accessibles à l'utilisateur.
 * `null` = accès total (permission `clients.read_all` ou `projects.read_all`).
 */
export async function userAccessibleClientIds(userId: string): Promise<string[] | null> {
  const e = await getEntry(userId);
  return e.clientIds ? Array.from(e.clientIds) : null;
}

/** Vérifie l'accès à un client précis. */
export async function userHasClientAccess(userId: string, clientId: string): Promise<boolean> {
  const ids = await userAccessibleClientIds(userId);
  if (ids === null) return true;
  return ids.includes(clientId);
}
