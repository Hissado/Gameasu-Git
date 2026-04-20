import { db } from "@workspace/db";
import {
  rolesTable, rolePermissionsTable, permissionsTable,
  userProjectAccessTable, collaboratorsTable, collaboratorAssignmentsTable, usersTable,
} from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";

/**
 * Service RBAC : résolution des permissions et des projets accessibles.
 * Cache mémoire 30s par utilisateur pour éviter les appels DB répétitifs sur
 * chaque requête (les changements admin invalident en restartant le serveur ;
 * pour la production on basculera sur Redis ou un signal d'invalidation).
 */

type CacheEntry = { perms: Set<string>; projectIds: Set<string> | null; expiresAt: number };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30_000;
const cacheKey = (userId: string) => `u:${userId}`;

export function invalidatePermissionsCache(userId?: string) {
  if (userId) CACHE.delete(cacheKey(userId));
  else CACHE.clear();
}

async function loadEntry(userId: string): Promise<CacheEntry> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return { perms: new Set(), projectIds: new Set(), expiresAt: Date.now() + TTL_MS };

  // Permissions = celles du rôle de l'utilisateur (résolu par code).
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.code, user.role)).limit(1);
  let perms = new Set<string>();
  if (role) {
    const rows = await db
      .select({ code: permissionsTable.code })
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
      .where(eq(rolePermissionsTable.roleId, role.id));
    perms = new Set(rows.map((r) => r.code));
  }

  // Projets accessibles : si projects.read_all → null (= tous), sinon union :
  //   - user_project_access.userId
  //   - collaborator_assignments du collaborator lié à user
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
    projectIds = new Set([...direct.map((d) => d.pid), ...collab.map((d) => d.pid)]);
  }

  return { perms, projectIds, expiresAt: Date.now() + TTL_MS };
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
