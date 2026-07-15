/**
 * Module Onboarding Digital (#11)
 * - onboarding_templates      : modèles de checklist réutilisables
 * - onboarding_template_items : étapes d'un modèle
 * - onboarding_processes      : instance d'onboarding pour un collaborateur
 * - onboarding_process_items  : état de chaque étape pour un process donné
 */
import { pgTable, text, timestamp, uuid, boolean, integer, index, uniqueIndex, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { organizationsTable } from "./saas";
import { collaboratorsTable } from "./collaborators";
import { usersTable } from "./users";

export const onboardingTemplatesTable = pgTable("onboarding_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // Type de poste ciblé (ou null = générique)
  targetRole: text("target_role"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("onb_tpl_org_idx").on(t.organizationId),
}));

export const onboardingTemplateItemsTable = pgTable("onboarding_template_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").notNull().references(() => onboardingTemplatesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  // admin | it | hr | manager | collaborateur
  assignedTo: text("assigned_to").notNull().default("hr"),
  // Catégorie : documents | équipement | accès | formation | rencontre | autre
  category: text("category").notNull().default("autre"),
  dueAfterDays: integer("due_after_days").notNull().default(1),
  isRequired: boolean("is_required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tplIdx: index("onb_tpl_items_tpl_idx").on(t.templateId),
}));

export const onboardingProcessesTable = pgTable("onboarding_processes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id),
  templateId: uuid("template_id").references(() => onboardingTemplatesTable.id),
  startDate: date("start_date").notNull(),
  targetCompletionDate: date("target_completion_date"),
  // in_progress | completed | cancelled
  status: text("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("onb_proc_org_idx").on(t.organizationId),
  collabIdx: index("onb_proc_collab_idx").on(t.collaboratorId),
}));

export const onboardingProcessItemsTable = pgTable("onboarding_process_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id").notNull().references(() => onboardingProcessesTable.id, { onDelete: "cascade" }),
  // Copie dénormalisée de l'item template (pour historique)
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: text("assigned_to").notNull().default("hr"),
  category: text("category").notNull().default("autre"),
  dueDate: date("due_date"),
  isRequired: boolean("is_required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // pending | completed | skipped
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedById: uuid("completed_by_id").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  processIdx: index("onb_proc_items_proc_idx").on(t.processId),
}));

export const insertOnboardingTemplateSchema = createInsertSchema(onboardingTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOnboardingTemplateItemSchema = createInsertSchema(onboardingTemplateItemsTable).omit({ id: true, createdAt: true });
export const insertOnboardingProcessSchema = createInsertSchema(onboardingProcessesTable).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertOnboardingProcessItemSchema = createInsertSchema(onboardingProcessItemsTable).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });

export type OnboardingTemplate = typeof onboardingTemplatesTable.$inferSelect;
export type OnboardingTemplateItem = typeof onboardingTemplateItemsTable.$inferSelect;
export type OnboardingProcess = typeof onboardingProcessesTable.$inferSelect;
export type OnboardingProcessItem = typeof onboardingProcessItemsTable.$inferSelect;

// ── Progression des visites guidées UI ──────────────────────────────────────────
export const uiTourProgressTable = pgTable("ui_tour_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  pathKey: text("path_key").notNull(),
  currentStep: integer("current_step").notNull().default(0),
  isDone: boolean("is_done").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  userModulePathIdx: uniqueIndex("ui_tour_progress_user_module_path_idx").on(t.userId, t.moduleKey, t.pathKey),
}));
