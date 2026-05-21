/**
 * Operations Command Center — Gaméasù.
 *
 * Module Opérations & Logistique multi-secteurs (BTP, retail, restauration,
 * services, ONG…). Couvre missions, dispatching, suivi terrain, preuves
 * d'exécution, incidents, checklists / playbooks, coûts et KPI.
 *
 * Toutes les tables sont tenant-scoped via `organization_id NOT NULL`.
 */
import { pgTable, text, timestamp, uuid, integer, numeric, jsonb, doublePrecision, boolean, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { equipmentTable } from "./equipment";

// Catalogue de modèles de mission (playbooks) — créés par tenant.
export const operationsPlaybooksTable = pgTable("operations_playbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // delivery_standard, installation, collect, transfer, intervention, control, supply, custom
  name: text("name").notNull(),
  description: text("description"),
  defaultPriority: text("default_priority").default("normal"),
  estimatedDurationMin: integer("estimated_duration_min"),
  defaultChecklistJson: jsonb("default_checklist_json").$type<Array<{ phase: string; label: string; required?: boolean }>>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({ orgIdx: index("ops_playbooks_org_idx").on(t.organizationId) }));

// Mission opérationnelle.
export const operationsMissionsTable = pgTable("operations_missions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(), // OPS-2026-0001
  kind: text("kind").notNull(), // delivery | collect | transfer | install | intervention | supply | site_visit | custom
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("normal"), // low | normal | high | urgent
  status: text("status").notNull().default("planned"),
  // planned | assigned | awaiting_departure | en_route | on_site | in_progress | completed | blocked | cancelled
  clientId: uuid("client_id").references(() => clientsTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  playbookId: uuid("playbook_id").references(() => operationsPlaybooksTable.id),
  // Logistique
  originAddress: text("origin_address"),
  originLat: doublePrecision("origin_lat"),
  originLng: doublePrecision("origin_lng"),
  destinationAddress: text("destination_address"),
  destinationLat: doublePrecision("destination_lat"),
  destinationLng: doublePrecision("destination_lng"),
  // Planning
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  actualStart: timestamp("actual_start", { withTimezone: true }),
  actualEnd: timestamp("actual_end", { withTimezone: true }),
  // Affectations
  responsibleUserId: uuid("responsible_user_id").references(() => usersTable.id),
  teamUserIds: jsonb("team_user_ids").$type<string[]>().default([]),
  vehicleEquipmentId: uuid("vehicle_equipment_id").references(() => equipmentTable.id),
  // Charge utile (équipement / colis embarqués)
  payloadJson: jsonb("payload_json").$type<Array<{ equipmentId?: string; label: string; plannedQty: number; actualQty?: number }>>().default([]),
  // Coûts (snapshot estimé/réel)
  estimatedCostFcfa: numeric("estimated_cost_fcfa", { precision: 15, scale: 2 }),
  actualCostFcfa: numeric("actual_cost_fcfa", { precision: 15, scale: 2 }),
  isBillable: boolean("is_billable").default(false),
  // Métadonnées
  tagsJson: jsonb("tags_json").$type<string[]>().default([]),
  notes: text("notes"),
  summaryJson: jsonb("summary_json").$type<{ planned?: string; achieved?: string; gaps?: string; nextActions?: string }>(),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  orgIdx: index("ops_missions_org_idx").on(t.organizationId),
  statusIdx: index("ops_missions_status_idx").on(t.status),
  responsibleIdx: index("ops_missions_responsible_idx").on(t.responsibleUserId),
}));

// Étapes / arrêts (tournée multi-stops).
export const operationsMissionStopsTable = pgTable("operations_mission_stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  missionId: uuid("mission_id").notNull().references(() => operationsMissionsTable.id, { onDelete: "cascade" }),
  ordering: integer("ordering").notNull().default(0),
  label: text("label").notNull(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  departedAt: timestamp("departed_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"), // pending | arrived | done | skipped
  notes: text("notes"),
}, (t) => ({ missionIdx: index("ops_stops_mission_idx").on(t.missionId) }));

// Check-in / check-out terrain.
export const operationsCheckinsTable = pgTable("operations_checkins", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  missionId: uuid("mission_id").notNull().references(() => operationsMissionsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id),
  kind: text("kind").notNull(), // check_in | check_out
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  accuracyMeters: integer("accuracy_meters"),
  locationLabel: text("location_label"),
  notes: text("notes"),
}, (t) => ({
  missionIdx: index("ops_checkins_mission_idx").on(t.missionId),
  orgIdx: index("ops_checkins_org_idx").on(t.organizationId),
}));

// Preuves d'exécution (POD).
export const operationsProofsTable = pgTable("operations_proofs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  missionId: uuid("mission_id").notNull().references(() => operationsMissionsTable.id, { onDelete: "cascade" }),
  recipientName: text("recipient_name"),
  signatureDataUrl: text("signature_data_url"),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  comment: text("comment"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  validatedById: uuid("validated_by_id").references(() => usersTable.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("valid"), // valid | rejected | pending_review
}, (t) => ({ missionIdx: index("ops_proofs_mission_idx").on(t.missionId) }));

// Incidents terrain.
export const operationsIncidentsTable = pgTable("operations_incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  missionId: uuid("mission_id").references(() => operationsMissionsTable.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  // delay | breakdown | absence | client_unavailable | missing_material | loading_error |
  // dispute | accident | non_conformity | site_blocked | other
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  status: text("status").notNull().default("open"), // open | in_progress | resolved | dismissed
  description: text("description"),
  correctiveAction: text("corrective_action"),
  attachmentsJson: jsonb("attachments_json").$type<string[]>().default([]),
  reportedById: uuid("reported_by_id").references(() => usersTable.id),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedById: uuid("resolved_by_id").references(() => usersTable.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => ({
  orgIdx: index("ops_incidents_org_idx").on(t.organizationId),
  statusIdx: index("ops_incidents_status_idx").on(t.status),
}));

// Checklists rattachées à une mission.
export const operationsChecklistsTable = pgTable("operations_checklists", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  missionId: uuid("mission_id").notNull().references(() => operationsMissionsTable.id, { onDelete: "cascade" }),
  phase: text("phase").notNull(), // pre_departure | arrival | execution | end | return
  title: text("title").notNull(),
  totalItems: integer("total_items").notNull().default(0),
  doneItems: integer("done_items").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | in_progress | done
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ missionIdx: index("ops_checklists_mission_idx").on(t.missionId) }));

export const operationsChecklistItemsTable = pgTable("operations_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  checklistId: uuid("checklist_id").notNull().references(() => operationsChecklistsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  required: boolean("required").default(false),
  done: boolean("done").default(false),
  doneById: uuid("done_by_id").references(() => usersTable.id),
  doneAt: timestamp("done_at", { withTimezone: true }),
  note: text("note"),
  ordering: integer("ordering").default(0),
});

// Coûts détaillés (multi-lignes par mission).
export const operationsCostsTable = pgTable("operations_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  missionId: uuid("mission_id").notNull().references(() => operationsMissionsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // transport | fuel | labor | material | tolls | per_diem | other
  label: text("label").notNull(),
  amountFcfa: numeric("amount_fcfa", { precision: 15, scale: 2 }).notNull(),
  isEstimate: boolean("is_estimate").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ missionIdx: index("ops_costs_mission_idx").on(t.missionId) }));
