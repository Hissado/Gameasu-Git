import { pgTable, text, timestamp, uuid, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizationsTable } from "./saas";

// ─────────────────────────────────────────────────────────────────
// NEXORA — Administration avancée (Phase 21)
// role_templates : modèles de rôles réutilisables (par secteur ou métier)
// sector_presets : presets sectoriels (BTP, négoce, services, etc.)
// ─────────────────────────────────────────────────────────────────

export const roleTemplatesTable = pgTable("role_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sector: text("sector"), // btp | negoce | services | logistique | distribution | mixte
  permissions: jsonb("permissions").$type<string[]>().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  codeIdx: index("role_templates_code_idx").on(t.code),
  orgIdx: index("role_templates_org_idx").on(t.organizationId),
}));

export const sectorPresetsTable = pgTable("sector_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  defaultModules: jsonb("default_modules").$type<string[]>().default([]),
  defaultRoleTemplates: jsonb("default_role_templates").$type<string[]>().default([]),
  recommendedPlanCode: text("recommended_plan_code"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeUidx: uniqueIndex("sector_presets_code_uidx").on(t.code),
}));

// ─────────────────────────────────────────────────────────────────
// Plan usage insights (Phase 22) — suivi consommation / suggestions d'upgrade
// ─────────────────────────────────────────────────────────────────
export const planUsageInsightsTable = pgTable("plan_usage_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // seats_threshold | module_usage | feature_request | upgrade_recommended
  severity: text("severity").default("info"),
  title: text("title").notNull(),
  body: text("body"),
  recommendedPlanCode: text("recommended_plan_code"),
  metadata: jsonb("metadata").default({}),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("plan_usage_insights_org_idx").on(t.organizationId),
}));
