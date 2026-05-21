import { pgTable, text, boolean, timestamp, uuid, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";

// ─────────────────────────────────────────────────────────────────
// NEXORA — Couche commune d'intelligence et d'automatisation
// Tables transverses utilisables par tous les modules métier pour
// stocker insights, scores, risques, recommandations, résumés,
// règles d'automatisation et logs d'exécution.
// ─────────────────────────────────────────────────────────────────

// Scores intelligents (santé client, risque projet, score opportunité, etc.)
export const smartScoresTable = pgTable("smart_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // client | project | opportunity | task | collaborator | equipment | rental | service
  entityId: uuid("entity_id").notNull(),
  scoreType: text("score_type").notNull(), // health | risk | opportunity | priority | engagement
  value: integer("value").notNull(), // 0-100
  tier: text("tier"), // critical | low | medium | high | excellent
  factors: jsonb("factors").$type<Array<{ key: string; label: string; weight: number; value: number; reason?: string }>>().default([]),
  computedBy: text("computed_by").default("heuristic"), // heuristic | ai
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("smart_scores_entity_idx").on(t.entityType, t.entityId),
  orgIdx: index("smart_scores_org_idx").on(t.organizationId),
  typeIdx: index("smart_scores_type_idx").on(t.scoreType),
}));

// Drapeaux de risque détectés
export const riskFlagsTable = pgTable("risk_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  category: text("category").notNull(), // financial | operational | commercial | hr | compliance | technical
  title: text("title").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedById: uuid("resolved_by_id").references(() => usersTable.id),
  resolutionNote: text("resolution_note"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("risk_flags_entity_idx").on(t.entityType, t.entityId),
  orgIdx: index("risk_flags_org_idx").on(t.organizationId),
  severityIdx: index("risk_flags_severity_idx").on(t.severity),
  unresolvedIdx: index("risk_flags_unresolved_idx").on(t.isResolved),
}));

// Insights / signaux faibles surfacés à l'utilisateur
export const insightsTable = pgTable("insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // anomaly | opportunity | trend | reminder | celebration
  scope: text("scope").notNull().default("workspace"), // workspace | client | project | service | finance | rh
  scopeId: uuid("scope_id"),
  audienceRole: text("audience_role"), // direction | manager | finance | commercial | rh | ops | all
  title: text("title").notNull(),
  body: text("body"),
  severity: text("severity").default("info"), // info | warning | critical | success
  actionLabel: text("action_label"),
  actionUrl: text("action_url"),
  metadata: jsonb("metadata").default({}),
  generatedBy: text("generated_by").default("heuristic"),
  isRead: boolean("is_read").notNull().default(false),
  isPinned: boolean("is_pinned").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("insights_org_idx").on(t.organizationId),
  scopeIdx: index("insights_scope_idx").on(t.scope, t.scopeId),
  kindIdx: index("insights_kind_idx").on(t.kind),
  unreadIdx: index("insights_unread_idx").on(t.isRead, t.isDismissed),
}));

// Recommandations d'actions ("prochaine meilleure action")
export const recommendationsTable = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // client | project | opportunity | task | invoice | rental | collaborator | workspace
  entityId: uuid("entity_id"),
  action: text("action").notNull(), // free text ou clé d'action (send_followup, escalate, renew, etc.)
  title: text("title").notNull(),
  reason: text("reason"),
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  impact: text("impact"), // commercial | operational | financial | retention | risk
  ctaLabel: text("cta_label"),
  ctaUrl: text("cta_url"),
  metadata: jsonb("metadata").default({}),
  generatedBy: text("generated_by").default("heuristic"),
  isApplied: boolean("is_applied").notNull().default(false),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  appliedById: uuid("applied_by_id").references(() => usersTable.id),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("recommendations_org_idx").on(t.organizationId),
  entityIdx: index("recommendations_entity_idx").on(t.entityType, t.entityId),
  priorityIdx: index("recommendations_priority_idx").on(t.priority),
  openIdx: index("recommendations_open_idx").on(t.isApplied, t.isDismissed),
}));

// Résumés assistant (workspace, client, projet, dashboard…) générés périodiquement
export const assistantSummariesTable = pgTable("assistant_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // workspace | client | project | conversation | dashboard | finance | rh
  scopeId: uuid("scope_id"),
  period: text("period"), // day | week | month | quarter | adhoc
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  title: text("title"),
  content: text("content").notNull(),
  highlights: jsonb("highlights").$type<string[]>().default([]),
  nextActions: jsonb("next_actions").$type<string[]>().default([]),
  metadata: jsonb("metadata").default({}),
  generatedBy: text("generated_by").default("heuristic"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("assistant_summaries_org_idx").on(t.organizationId),
  scopeIdx: index("assistant_summaries_scope_idx").on(t.scope, t.scopeId),
  periodIdx: index("assistant_summaries_period_idx").on(t.period),
}));

// Règles d'automatisation transversales
export const automationRulesTable = pgTable("automation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(),
  // ex. invoice.issued, invoice.overdue, payment.received, proforma.pending,
  // service.renewal_due, rental.due_soon, document.missing, project.at_risk,
  // client.inactive, lead.hot, task.critical_pending, schedule.cron
  triggerConfig: jsonb("trigger_config").default({}),
  conditions: jsonb("conditions").$type<Array<{ field: string; op: string; value: unknown }>>().default([]),
  actions: jsonb("actions").$type<Array<{ kind: string; params: Record<string, unknown> }>>().notNull(),
  // ex. { kind: "send_email", params: {...} }, { kind: "send_whatsapp" },
  // { kind: "create_task" }, { kind: "notify_manager" }, { kind: "set_status" },
  // { kind: "add_tag" }, { kind: "generate_summary" }, { kind: "generate_recommendation" }
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  runCount: integer("run_count").notNull().default(0),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("automation_rules_org_idx").on(t.organizationId),
  triggerIdx: index("automation_rules_trigger_idx").on(t.triggerType),
  activeIdx: index("automation_rules_active_idx").on(t.isActive),
}));

// Journal d'exécution des règles
export const automationLogsTable = pgTable("automation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").references(() => automationRulesTable.id, { onDelete: "cascade" }),
  ruleName: text("rule_name"),
  triggerType: text("trigger_type"),
  triggeredBy: text("triggered_by"), // event | cron | manual
  payload: jsonb("payload").default({}),
  actionsExecuted: jsonb("actions_executed").$type<Array<{ kind: string; ok: boolean; result?: unknown; error?: string }>>().default([]),
  status: text("status").notNull().default("ok"), // ok | partial | failed
  error: text("error"),
  durationMs: integer("duration_ms"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("automation_logs_org_idx").on(t.organizationId),
  ruleIdx: index("automation_logs_rule_idx").on(t.ruleId),
  statusIdx: index("automation_logs_status_idx").on(t.status),
  executedIdx: index("automation_logs_executed_idx").on(t.executedAt),
}));

// ─────────────────────────────────────────────────────────────────
// Zod
// ─────────────────────────────────────────────────────────────────
export const insertSmartScoreSchema = createInsertSchema(smartScoresTable);
export const insertRiskFlagSchema = createInsertSchema(riskFlagsTable);
export const insertInsightSchema = createInsertSchema(insightsTable);
export const insertRecommendationSchema = createInsertSchema(recommendationsTable);
export const insertAssistantSummarySchema = createInsertSchema(assistantSummariesTable);
export const insertAutomationRuleSchema = createInsertSchema(automationRulesTable);
export const insertAutomationLogSchema = createInsertSchema(automationLogsTable);

export type SmartScore = typeof smartScoresTable.$inferSelect;
export type RiskFlag = typeof riskFlagsTable.$inferSelect;
export type Insight = typeof insightsTable.$inferSelect;
export type Recommendation = typeof recommendationsTable.$inferSelect;
export type AssistantSummary = typeof assistantSummariesTable.$inferSelect;
export type AutomationRule = typeof automationRulesTable.$inferSelect;
export type AutomationLog = typeof automationLogsTable.$inferSelect;

export const SCORE_TIER_THRESHOLDS = {
  critical: 25,
  low: 50,
  medium: 70,
  high: 85,
} as const;

export function tierForScore(value: number): "critical" | "low" | "medium" | "high" | "excellent" {
  if (value < SCORE_TIER_THRESHOLDS.critical) return "critical";
  if (value < SCORE_TIER_THRESHOLDS.low) return "low";
  if (value < SCORE_TIER_THRESHOLDS.medium) return "medium";
  if (value < SCORE_TIER_THRESHOLDS.high) return "high";
  return "excellent";
}

void z;
