import { pgTable, text, boolean, timestamp, uuid, jsonb, index, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { projectsTable } from "./projects";
import { organizationsTable } from "./saas";

// ─────────────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────────────
export const rolesTable = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  level: jsonb("level").$type<number>().default(10),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeOrgIdx: uniqueIndex("roles_code_org_uidx").on(t.code, t.organizationId),
}));

// ─────────────────────────────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────────────────────────────
export const permissionsTable = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────
// ROLE_PERMISSIONS
// ─────────────────────────────────────────────────────────────────
export const rolePermissionsTable = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
  permissionCode: text("permission_code").notNull(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  rolePermIdx: uniqueIndex("role_permissions_uidx").on(t.roleId, t.permissionCode),
  roleIdx: index("role_permissions_role_idx").on(t.roleId),
}));

// ─────────────────────────────────────────────────────────────────
// USER_PROJECT_ACCESS
// ─────────────────────────────────────────────────────────────────
export const userProjectAccessTable = pgTable("user_project_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  accessLevel: text("access_level").notNull().default("viewer"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  grantedById: uuid("granted_by_id").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => ({
  userProjectIdx: uniqueIndex("user_project_access_uidx").on(t.userId, t.projectId),
}));

// ─────────────────────────────────────────────────────────────────
// USER_PERMISSION_OVERRIDES
// ─────────────────────────────────────────────────────────────────
// Surcharges individuelles de permissions : grant (ajoute) / deny (retire),
// avec expiration optionnelle. Nom et colonnes alignés sur la table réelle
// utilisée par la résolution des droits et les routes admin (audit P1 §D).
export const userPermissionOverridesTable = pgTable("user_permission_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  permissionCode: text("permission_code").notNull(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  // grant | deny
  type: text("type").notNull().default("grant"),
  reason: text("reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  grantedBy: uuid("granted_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueUserPerm: uniqueIndex("user_permission_overrides_uidx").on(t.userId, t.permissionCode),
  userIdx: index("user_permission_overrides_user_idx").on(t.userId),
}));

// ─────────────────────────────────────────────────────────────────
// AUDIT LOGS (enrichi v2)
// category : "audit" | "navigation"
// severity : "info" | "low" | "medium" | "high" | "critical"
// status   : "success" | "failure" | "denied"
// changes  : [{ field, label, before, after }]
// ─────────────────────────────────────────────────────────────────
export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userEmail: text("user_email"),
  userRole: text("user_role"),
  action: text("action").notNull(),
  category: text("category").notNull().default("audit"),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("success"),
  module: text("module"),
  subModule: text("sub_module"),
  page: text("page"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  entityName: text("entity_name"),
  changes: jsonb("changes"),
  payload: jsonb("payload"),
  errorMessage: text("error_message"),
  sessionId: text("session_id"),
  requestId: text("request_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  browser: text("browser"),
  os: text("os"),
  device: text("device"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("audit_logs_user_idx").on(t.userId),
  orgIdx: index("audit_logs_org_idx").on(t.organizationId),
  entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  actionIdx: index("audit_logs_action_idx").on(t.action),
  categoryIdx: index("audit_logs_category_idx").on(t.category),
  severityIdx: index("audit_logs_severity_idx").on(t.severity),
  createdIdx: index("audit_logs_created_idx").on(t.createdAt),
  moduleIdx: index("audit_logs_module_idx").on(t.module),
}));

// ─────────────────────────────────────────────────────────────────
// SECURITY ALERTS
// type : "multiple_ips"|"brute_force"|"mass_delete"|"mass_export"|
//        "unauthorized_access"|"salary_change"|"role_change"|
//        "2fa_disabled"|"banking_change"|"suspicious_export"
// severity : "medium" | "high" | "critical"
// ─────────────────────────────────────────────────────────────────
export const securityAlertsTable = pgTable("security_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userEmail: text("user_email"),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("high"),
  message: text("message").notNull(),
  detail: jsonb("detail"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("security_alerts_org_idx").on(t.organizationId),
  userIdx: index("security_alerts_user_idx").on(t.userId),
  resolvedIdx: index("security_alerts_resolved_idx").on(t.resolvedAt),
  createdIdx: index("security_alerts_created_idx").on(t.createdAt),
}));

// ─────────────────────────────────────────────────────────────────
// Exports de données — jobs asynchrones
// ─────────────────────────────────────────────────────────────────
export const dataExportsTable = pgTable("data_exports", {
  id:               uuid("id").primaryKey().defaultRandom(),
  organizationId:   uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  requestedById:    uuid("requested_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  requestedByEmail: text("requested_by_email"),
  status:           text("status").notNull().default("pending"),
  requestedAt:      timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  generatedAt:      timestamp("generated_at", { withTimezone: true }),
  expiresAt:        timestamp("expires_at", { withTimezone: true }),
  downloadedAt:     timestamp("downloaded_at", { withTimezone: true }),
  filePath:         text("file_path"),
  fileSize:         integer("file_size"),
  downloadToken:    text("download_token"),
  downloadCount:    integer("download_count").notNull().default(0),
  triggeredBy:      text("triggered_by").notNull().default("manual"),
  reason:           text("reason"),
  errorMessage:     text("error_message"),
  stats:            jsonb("stats"),
  ipAddress:        text("ip_address"),
  userAgent:        text("user_agent"),
});
export type DataExport = typeof dataExportsTable.$inferSelect;

// ─────────────────────────────────────────────────────────────────
// Schémas Zod & types
// ─────────────────────────────────────────────────────────────────
export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({ id: true, createdAt: true });
export const insertUserProjectAccessSchema = createInsertSchema(userProjectAccessTable).omit({ id: true, grantedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export const insertSecurityAlertSchema = createInsertSchema(securityAlertsTable).omit({ id: true, createdAt: true });

export type Role = typeof rolesTable.$inferSelect;
export type Permission = typeof permissionsTable.$inferSelect;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type UserProjectAccess = typeof userProjectAccessTable.$inferSelect;
export type UserPermissionOverride = typeof userPermissionOverridesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type SecurityAlert = typeof securityAlertsTable.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type InsertUserProjectAccess = z.infer<typeof insertUserProjectAccessSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertSecurityAlert = z.infer<typeof insertSecurityAlertSchema>;
