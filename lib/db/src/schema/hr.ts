import { pgTable, text, timestamp, uuid, numeric, integer, date, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _uniqueIndex = uniqueIndex; // évite l'avertissement non-utilisé après nettoyage
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collaboratorsTable } from "./collaborators";
import { projectsTable } from "./projects";
import { organizationsTable } from "./saas";

/**
 * Module RH (Ressources Humaines).
 *
 * - departments : structure organisationnelle (pôles : Pilotage, Opérations, Matériel,
 *   Commercial, Comptabilité, Communication, RH).
 * - positions   : postes/fonctions rattachés à un département.
 * - contracts   : contrats de travail (CDI, CDD, stage, prestation, mission).
 * - hr_documents: pièces RH (pièce d'identité, diplôme, contrat signé, etc.).
 * - collaborator_assignments : affectation d'un collaborateur à un projet
 *   (pour la synchronisation Opérations ↔ RH ↔ Commercial).
 *
 * Rôles internes et hiérarchie : portés par collaboratorsTable (managerCollaboratorId,
 * departmentId, positionId, ajoutés via l'extension de schéma).
 */

// ────────────────────────────────────────────────────────────────
// DÉPARTEMENTS / PÔLES
// ────────────────────────────────────────────────────────────────
export const departmentsTable = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // Hiérarchie de départements (sous-pôle).
  parentId: uuid("parent_id"),
  // Responsable du département (collaborateur).
  headCollaboratorId: uuid("head_collaborator_id").references(() => collaboratorsTable.id),
  color: text("color"), // pour l'UI
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  codeIdx: uniqueIndex("departments_org_code_uidx").on(t.organizationId, t.code),
}));

// ────────────────────────────────────────────────────────────────
// POSTES / FONCTIONS
// ────────────────────────────────────────────────────────────────
export const positionsTable = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  departmentId: uuid("department_id").references(() => departmentsTable.id),
  description: text("description"),
  // Niveau hiérarchique : 1 (junior) → 5 (direction).
  level: integer("level").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  codeIdx: uniqueIndex("positions_org_code_uidx").on(t.organizationId, t.code),
  deptIdx: index("positions_department_idx").on(t.departmentId),
}));

// ────────────────────────────────────────────────────────────────
// CONTRATS DE TRAVAIL
// ────────────────────────────────────────────────────────────────
export const contractsTable = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  // CDI | CDD | stage | prestation | mission | apprentissage
  type: text("type").notNull(),
  // draft | active | suspended | terminated | expired
  status: text("status").notNull().default("active"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  monthlySalary: numeric("monthly_salary", { precision: 14, scale: 2 }),
  currency: text("currency").default("XOF"),
  jobTitle: text("job_title"),
  workLocation: text("work_location"),
  weeklyHours: numeric("weekly_hours", { precision: 5, scale: 2 }),
  // Conditions particulières (jsonb : avantages, primes, clauses).
  terms: jsonb("terms"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  collabIdx: index("contracts_collaborator_idx").on(t.collaboratorId),
  statusIdx: index("contracts_status_idx").on(t.status),
}));

// ────────────────────────────────────────────────────────────────
// DOCUMENTS RH
// ────────────────────────────────────────────────────────────────
export const hrDocumentsTable = pgTable("hr_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  // identity | diploma | contract | medical | certification | other
  type: text("type").notNull(),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  expiresAt: date("expires_at"),
  notes: text("notes"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  collabIdx: index("hr_documents_collaborator_idx").on(t.collaboratorId),
  typeIdx: index("hr_documents_type_idx").on(t.type),
}));

// ────────────────────────────────────────────────────────────────
// AFFECTATIONS PROJET — synchronisation RH ↔ Opérations
// ────────────────────────────────────────────────────────────────
export const collaboratorAssignmentsTable = pgTable("collaborator_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  // chef_chantier | conducteur | technicien | ouvrier | superviseur | autre
  role: text("role").notNull(),
  // Pourcentage d'allocation (0-100) — pour calculer la charge.
  allocationPct: integer("allocation_pct").default(100),
  startDate: date("start_date"),
  endDate: date("end_date"),
  // active | finished | cancelled
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  collabIdx: index("collab_assignments_collab_idx").on(t.collaboratorId),
  projectIdx: index("collab_assignments_project_idx").on(t.projectId),
}));

// ────────────────────────────────────────────────────────────────
// DEMANDES D'ABSENCES / CONGÉS
// ────────────────────────────────────────────────────────────────
export const leaveRequestsTable = pgTable("leave_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  // congé_payé | RTT | maladie | maternité | paternité | sans_solde | formation | exceptionnel | autre
  type: text("type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  // Nombre de jours ouvrables (calculé ou saisi)
  days: numeric("days", { precision: 5, scale: 1 }).notNull().default("1"),
  reason: text("reason"),
  // pending | approved | rejected | cancelled
  status: text("status").notNull().default("pending"),
  approvedById: uuid("approved_by_id").references(() => collaboratorsTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  collabIdx: index("leave_requests_collaborator_idx").on(t.collaboratorId),
  statusIdx: index("leave_requests_status_idx").on(t.status),
  dateIdx: index("leave_requests_date_idx").on(t.startDate),
}));

// ────────────────────────────────────────────────────────────────
// Schémas Zod & Types
// ────────────────────────────────────────────────────────────────
export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPositionSchema = createInsertSchema(positionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractSchema = createInsertSchema(contractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHrDocumentSchema = createInsertSchema(hrDocumentsTable).omit({ id: true, uploadedAt: true });
export const insertCollabAssignmentSchema = createInsertSchema(collaboratorAssignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });

export const insertLeaveRequestSchema = createInsertSchema(leaveRequestsTable).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true });

export type Department = typeof departmentsTable.$inferSelect;
export type Position = typeof positionsTable.$inferSelect;
export type Contract = typeof contractsTable.$inferSelect;
export type HrDocument = typeof hrDocumentsTable.$inferSelect;
export type CollaboratorAssignment = typeof collaboratorAssignmentsTable.$inferSelect;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
