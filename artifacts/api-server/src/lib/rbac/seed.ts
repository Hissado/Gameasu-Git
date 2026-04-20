import { db } from "@workspace/db";
import { permissionsTable, rolesTable, rolePermissionsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { PERMISSIONS, SYSTEM_ROLES } from "./catalog";

/**
 * Idempotent : crée/aligne les permissions et les rôles système avec leurs
 * permissions. À exécuter au démarrage du serveur (post-migration).
 */
export async function seedRbac(): Promise<{ permissions: number; roles: number }> {
  // 1) Synchroniser le catalogue de permissions (insert manquantes, update label/cat).
  const existing = await db.select().from(permissionsTable);
  const byCode = new Map(existing.map((p) => [p.code, p]));
  for (const p of PERMISSIONS) {
    const cur = byCode.get(p.code);
    if (!cur) {
      await db.insert(permissionsTable).values({
        code: p.code, label: p.label, category: p.category, description: p.description,
      });
    } else if (cur.label !== p.label || cur.category !== p.category) {
      await db.update(permissionsTable).set({
        label: p.label, category: p.category, description: p.description,
      }).where(eq(permissionsTable.id, cur.id));
    }
  }

  const allPerms = await db.select().from(permissionsTable);
  const permByCode = new Map(allPerms.map((p) => [p.code, p]));

  // 2) Synchroniser les rôles système.
  const existingRoles = await db.select().from(rolesTable);
  const roleByCode = new Map(existingRoles.map((r) => [r.code, r]));
  for (const seed of SYSTEM_ROLES) {
    let role = roleByCode.get(seed.code);
    if (!role) {
      const [created] = await db.insert(rolesTable).values({
        code: seed.code, name: seed.name, description: seed.description,
        isSystem: true, level: seed.level,
      }).returning();
      role = created;
      roleByCode.set(seed.code, created);
    } else {
      // On force isSystem + libellé pour les rôles système (la valeur level/permissions
      // peut diverger volontairement par l'admin pour les non-system, mais ici système).
      await db.update(rolesTable).set({
        name: seed.name, description: seed.description, isSystem: true, level: seed.level,
      }).where(eq(rolesTable.id, role.id));
    }
    // 3) Permissions du rôle
    const targetCodes = seed.permissions === "*" ? PERMISSIONS.map((p) => p.code) : seed.permissions;
    const targetIds = targetCodes
      .map((c) => permByCode.get(c)?.id)
      .filter((x): x is string => Boolean(x));
    const currentLinks = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, role.id));
    const currentIds = new Set(currentLinks.map((l) => l.permissionId));
    const toAdd = targetIds.filter((id) => !currentIds.has(id));
    const toRemove = Array.from(currentIds).filter((id) => !targetIds.includes(id));
    if (toAdd.length > 0) {
      await db.insert(rolePermissionsTable).values(
        toAdd.map((permissionId) => ({ roleId: role!.id, permissionId })),
      );
    }
    if (toRemove.length > 0) {
      const { and } = await import("drizzle-orm");
      await db.delete(rolePermissionsTable).where(and(
        eq(rolePermissionsTable.roleId, role.id),
        inArray(rolePermissionsTable.permissionId, toRemove),
      ));
    }
  }

  return { permissions: PERMISSIONS.length, roles: SYSTEM_ROLES.length };
}
