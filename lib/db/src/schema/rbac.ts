import { pgTable, text, boolean, timestamp, uuid, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { projectsTable } from "./projects";
import { organizationsTable } from "./saas";

/**
 * Système RBAC dynamique :
 * - `roles` : rôles personnalisables (super_admin, admin, manager, collaborator + custom)
 * - `permissions` : catalogue de permissions (code unique, ex. "users.invite")
 * - `role_permissions` : matrice rôles × permissions
 * - `user_project_access` : ACL projet utilisateur direct (complémentaire à
 *   `collaborator_assignments` qui modélise la dimension RH)
 * - `audit_logs` : trace des actions sensibles (create/update/delete sur ressources critiques)
 */

// ─────────────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────────────
export const rolesTable = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),               // ex. "admin", "chef_chantier"
  name: text("name").notNull(),               // libellé affiché
  description: text("description"),
  // Rôles système : non supprimables, code immuable, organizationId=null
  isSystem: boolean("is_system").notNull().default(false),
  // Niveau hiérarchique (1=base → 100=super_admin) pour comparer "au-dessus de"
  level: jsonb("level").$type<number>().default(10),
  // Pour les rôles personnalisés : organisation propriétaire. null = rôle système global.
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // Pour les rôles système (org_id IS NULL) : PG ne contraint pas les NULLs entre eux, unicité garantie par le seed.
  // Pour les rôles custom : unicité (organization_id, code) par org.
  codeOrgUidx: uniqueIndex("roles_code_org_uidx").on(t.organizationId, t.code),
  orgIdx: index("roles_org_idx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────────────
// PERMISSIONS (catalogue figé géré par seed)
// ─────────────────────────────────────────────────────────────────
export const permissionsTable = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),               // ex. "users.invite", "projects.delete"
  label: text("label").notNull(),             // libellé FR
  category: text("category").notNull(),       // ex. "Utilisateurs", "Projets", "Comptabilité"
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeUidx: uniqueIndex("permissions_code_uidx").on(t.code),
  catIdx: index("permissions_category_idx").on(t.category),
}));

// ─────────────────────────────────────────────────────────────────
// ROLE_PERMISSIONS
// ─────────────────────────────────────────────────────────────────
export const rolePermissionsTable = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissionsTable.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  grantedById: uuid("granted_by_id").references(() => usersTable.id),
}, (t) => ({
  pk: uniqueIndex("role_permissions_pk").on(t.roleId, t.permissionId),
  permIdx: index("role_permissions_perm_idx").on(t.permissionId),
}));

// ─────────────────────────────────────────────────────────────────
// USER_PROJECT_ACCESS — ACL directe utilisateur × projet
// ─────────────────────────────────────────────────────────────────
export const userProjectAccessTable = pgTable("user_project_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  // viewer | editor | manager — niveau d'action sur ce projet
  accessLevel: text("access_level").notNull().default("viewer"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  grantedById: uuid("granted_by_id").references(() => usersTable.id),
}, (t) => ({
  uniq: uniqueIndex("user_project_access_uidx").on(t.userId, t.projectId),
  userIdx: index("user_project_access_user_idx").on(t.userId),
  projectIdx: index("user_project_access_project_idx").on(t.projectId),
}));

// ─────────────────────────────────────────────────────────────────
// USER_PERMISSION_OVERRIDES — surcharges individuelles (grant / deny)
// ─────────────────────────────────────────────────────────────────
export const userPermissionOverridesTable = pgTable("user_permission_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  permissionCode: text("permission_code").notNull(),
  // 'grant' = ajout au-dessus du rôle | 'deny' = retrait même si le rôle le donne
  type: text("type").notNull().$type<"grant" | "deny">(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  reason: text("reason"),
  grantedBy: uuid("granted_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueUserPerm: uniqueIndex("user_perm_overrides_uidx").on(t.userId, t.permissionCode),
  userIdx: index("user_perm_overrides_user_idx").on(t.userId),
}));

// ─────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────
export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userEmail: text("user_email"),              // dénormalisé pour conserver la trace si user supprimé
  // create | update | delete | login | logout | invite | role_change | permission_change | password_change | …
  action: text("action").notNull(),
  entityType: text("entity_type"),            // "user", "role", "project", "department", …
  entityId: uuid("entity_id"),
  // Détails de la mutation : { before?, after?, meta? }
  payload: jsonb("payload"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("audit_logs_user_idx").on(t.userId),
  entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  actionIdx: index("audit_logs_action_idx").on(t.action),
  createdIdx: index("audit_logs_created_idx").on(t.createdAt),
}));

// ─────────────────────────────────────────────────────────────────
// Schémas Zod & types
// ─────────────────────────────────────────────────────────────────
export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({ id: true, createdAt: true });
export const insertUserProjectAccessSchema = createInsertSchema(userProjectAccessTable).omit({ id: true, grantedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });

export type Role = typeof rolesTable.$inferSelect;
export type Permission = typeof permissionsTable.$inferSelect;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type UserProjectAccess = typeof userProjectAccessTable.$inferSelect;
export type UserPermissionOverride = typeof userPermissionOverridesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type InsertUserProjectAccess = z.infer<typeof insertUserProjectAccessSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
