import { pgTable, text, timestamp, uuid, jsonb, integer, date, numeric, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";
import { collaboratorsTable } from "./collaborators";
import { projectsTable } from "./projects";
import { departmentsTable } from "./hr";

// ─────────────────────────────────────────────────────────────────
// NEXORA — Système de pointage géolocalisé (Phase 18)
// attendance_sessions : journée de travail d'un collaborateur (regroupe clock-in/out + pauses)
// attendance_records  : événement atomique (clock_in, clock_out, break_start, break_end)
//                       avec latitude/longitude/adresse/source_device
// attendance_flags    : anomalies détectées (retard, oubli, pointage hors zone, etc.)
// ─────────────────────────────────────────────────────────────────

export const attendanceSessionsTable = pgTable("attendance_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id),
  departmentId: uuid("department_id").references(() => departmentsTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  workDate: date("work_date").notNull(),
  status: text("status").notNull().default("open"), // open | closed | abandoned
  clockInAt: timestamp("clock_in_at", { withTimezone: true }),
  clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
  totalMinutes: integer("total_minutes").default(0),
  breakMinutes: integer("break_minutes").default(0),
  effectiveMinutes: integer("effective_minutes").default(0),
  expectedMinutes: integer("expected_minutes").default(480), // 8h par défaut
  isLate: boolean("is_late").default(false),
  isEarlyLeave: boolean("is_early_leave").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("att_sessions_org_idx").on(t.organizationId),
  collabIdx: index("att_sessions_collab_idx").on(t.collaboratorId),
  dateIdx: index("att_sessions_date_idx").on(t.workDate),
  uniqDayCollab: uniqueIndex("att_sessions_collab_day_uidx").on(t.collaboratorId, t.workDate),
}));

export const attendanceRecordsTable = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => attendanceSessionsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id),
  kind: text("kind").notNull(), // clock_in | clock_out | break_start | break_end
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  accuracyMeters: integer("accuracy_meters"),
  locationLabel: text("location_label"),
  sourceDevice: text("source_device"),
  ipAddress: text("ip_address"),
  comment: text("comment"),
  status: text("status").default("validated"), // validated | pending | rejected
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("att_records_org_idx").on(t.organizationId),
  collabIdx: index("att_records_collab_idx").on(t.collaboratorId),
  sessionIdx: index("att_records_session_idx").on(t.sessionId),
  kindIdx: index("att_records_kind_idx").on(t.kind),
  occurredIdx: index("att_records_occurred_idx").on(t.occurredAt),
}));

export const attendanceFlagsTable = pgTable("attendance_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => attendanceSessionsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // late | early_leave | missing_clock_out | missing_clock_in | long_break | out_of_zone | duplicate | suspicious
  severity: text("severity").notNull().default("medium"), // low | medium | high
  workDate: date("work_date"),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedById: uuid("resolved_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("att_flags_org_idx").on(t.organizationId),
  collabIdx: index("att_flags_collab_idx").on(t.collaboratorId),
  kindIdx: index("att_flags_kind_idx").on(t.kind),
  unresolvedIdx: index("att_flags_unresolved_idx").on(t.isResolved),
}));

export const insertAttendanceSessionSchema = createInsertSchema(attendanceSessionsTable);
export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecordsTable);
export const insertAttendanceFlagSchema = createInsertSchema(attendanceFlagsTable);

export const clockEventSchema = z.object({
  kind: z.enum(["clock_in", "clock_out", "break_start", "break_end"]),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().int().min(0).max(100_000).optional(),
  locationLabel: z.string().max(500).optional(),
  sourceDevice: z.string().max(200).optional(),
  comment: z.string().max(1000).optional(),
  projectId: z.string().uuid().optional(),
});
export type ClockEventInput = z.infer<typeof clockEventSchema>;
