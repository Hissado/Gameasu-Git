import { db } from "@workspace/db";
import { permissionsTable, rolesTable, rolePermissionsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { PERMISSIONS, SYSTEM_ROLES } from "./catalog";

/**
 * Seed RBAC — idempotent, exécuté au démarrage du serveur (post-migration).
 *
 * Modèle canonique (= schéma Drizzle, imposé en base par push-force) :
 *   permissions(code UNIQUE, name, module, description)
 *   role_permissions(role_id, permission_code)
 * Le catalogue applicatif (`catalog.ts`) utilise label/category comme
 * vocabulaire métier : ils se stockent dans name/module.
 *
 * NB : ce seed échouait silencieusement en production (insertion sur des
 * colonnes inexistantes label/category → violation NOT NULL sur name),
 * laissant le catalogue de permissions vide et la matrice de droits
 * inconsultable (audit §D). Corrigé — audit P1.
 */
export async function seedRbac(): Promise<{ permissions: number; roles: number }> {
  // 1) Synchroniser le catalogue de permissions (insert manquantes, update libellés).
  const existing = await db.select().from(permissionsTable);
  const byCode = new Map(existing.map((p) => [p.code, p]));
  for (const p of PERMISSIONS) {
    const cur = byCode.get(p.code);
    if (!cur) {
      await db.insert(permissionsTable).values({
        code: p.code, name: p.label, module: p.category, description: p.description,
      });
    } else if (cur.name !== p.label || cur.module !== p.category) {
      await db.update(permissionsTable).set({
        name: p.label, module: p.category, description: p.description,
      }).where(eq(permissionsTable.id, cur.id));
    }
  }

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

    // 3) Permissions du rôle — liens par CODE de permission.
    const targetCodes = seed.permissions === "*" ? PERMISSIONS.map((p) => p.code) : seed.permissions;
    const currentLinks = await db.select().from(rolePermissionsTable)
      .where(eq(rolePermissionsTable.roleId, role.id));
    const currentCodes = new Set(currentLinks.map((l) => l.permissionCode));
    const toAdd = targetCodes.filter((c) => !currentCodes.has(c));
    const toRemove = Array.from(currentCodes).filter((c) => !targetCodes.includes(c));
    if (toAdd.length > 0) {
      await db.insert(rolePermissionsTable).values(
        toAdd.map((permissionCode) => ({ roleId: role!.id, permissionCode })),
      );
    }
    if (toRemove.length > 0) {
      await db.delete(rolePermissionsTable).where(and(
        eq(rolePermissionsTable.roleId, role.id),
        inArray(rolePermissionsTable.permissionCode, toRemove),
      ));
    }
  }

  return { permissions: PERMISSIONS.length, roles: SYSTEM_ROLES.length };
}
