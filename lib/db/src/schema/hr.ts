import { pgTable, text, timestamp, uuid, numeric, integer, boolean, date, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _uniqueIndex = uniqueIndex; // évite l'avertissement non-utilisé après nettoyage
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collaboratorsTable } from "./collaborators";
import { projectsTable } from "./projects";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";

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
// RECRUTEMENT — OFFRES D'EMPLOI
// ────────────────────────────────────────────────────────────────
export const jobOffersTable = pgTable("job_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  title: text("title").notNull(),
  departmentId: uuid("department_id").references(() => departmentsTable.id),
  positionId: uuid("position_id").references(() => positionsTable.id),
  // CDI | CDD | stage | prestation | alternance | freelance
  contractType: text("contract_type").notNull().default("CDI"),
  // open | in_review | closed | cancelled
  status: text("status").notNull().default("open"),
  description: text("description"),
  requirements: text("requirements"),
  responsibilities: text("responsibilities"),
  location: text("location"),
  salaryMin: numeric("salary_min", { precision: 14, scale: 2 }),
  salaryMax: numeric("salary_max", { precision: 14, scale: 2 }),
  currency: text("currency").default("XOF"),
  isRemote: boolean("is_remote").default(false),
  openDate: date("open_date"),
  closeDate: date("close_date"),
  maxCandidates: integer("max_candidates"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  refOrgIdx: uniqueIndex("job_offers_org_ref_uidx").on(t.organizationId, t.reference),
  statusIdx: index("job_offers_status_idx").on(t.status),
}));

// ────────────────────────────────────────────────────────────────
// RECRUTEMENT — CANDIDATURES
// ────────────────────────────────────────────────────────────────
export const candidaciesTable = pgTable("candidacies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  jobOfferId: uuid("job_offer_id").notNull().references(() => jobOffersTable.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  cvUrl: text("cv_url"),
  coverLetterUrl: text("cover_letter_url"),
  linkedinUrl: text("linkedin_url"),
  // new | cv_review | phone_screen | interview | assessment | offer | hired | rejected
  stage: text("stage").notNull().default("new"),
  rating: integer("rating"), // 1-5
  source: text("source"), // linkedin | indeed | referral | direct | etc.
  notes: text("notes"),
  interviewDate: timestamp("interview_date", { withTimezone: true }),
  interviewNotes: text("interview_notes"),
  offerDate: date("offer_date"),
  offeredSalary: numeric("offered_salary", { precision: 14, scale: 2 }),
  rejectionReason: text("rejection_reason"),
  hiredCollaboratorId: uuid("hired_collaborator_id").references(() => collaboratorsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  jobOfferIdx: index("candidacies_job_offer_idx").on(t.jobOfferId),
  stageIdx: index("candidacies_stage_idx").on(t.stage),
}));

// ────────────────────────────────────────────────────────────────
// ÉVALUATIONS DE PERFORMANCE
// ────────────────────────────────────────────────────────────────
export const performanceReviewsTable = pgTable("performance_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").references(() => collaboratorsTable.id),
  // annual | semi_annual | quarterly | probation | 360
  type: text("type").notNull().default("annual"),
  // Période évaluée (ex: "2026", "2026-Q1")
  period: text("period").notNull(),
  reviewDate: date("review_date"),
  // Note globale : 1=Insuffisant, 2=En développement, 3=Satisfaisant, 4=Bien, 5=Excellent
  overallRating: integer("overall_rating"),
  // Critères d'évaluation: [{label, rating, comment}]
  criteria: jsonb("criteria").default([]),
  strengths: text("strengths"),
  areasForImprovement: text("areas_for_improvement"),
  goals: text("goals"),
  // draft | submitted | acknowledged | validated
  status: text("status").notNull().default("draft"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  collabIdx: index("perf_reviews_collab_idx").on(t.collaboratorId),
  periodIdx: index("perf_reviews_period_idx").on(t.period),
}));

// ────────────────────────────────────────────────────────────────
// FORMATIONS
// ────────────────────────────────────────────────────────────────
export const trainingSessionsTable = pgTable("training_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // interne | externe | e_learning | conference | coaching
  type: text("type").notNull().default("externe"),
  provider: text("provider"),
  description: text("description"),
  location: text("location"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  durationHours: numeric("duration_hours", { precision: 6, scale: 1 }),
  cost: numeric("cost", { precision: 14, scale: 2 }),
  currency: text("currency").default("XOF"),
  maxParticipants: integer("max_participants"),
  // planned | ongoing | completed | cancelled
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  statusIdx: index("training_status_idx").on(t.status),
}));

export const trainingParticipantsTable = pgTable("training_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  trainingSessionId: uuid("training_session_id").notNull().references(() => trainingSessionsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  // registered | confirmed | attended | absent | certified
  status: text("status").notNull().default("registered"),
  score: numeric("score", { precision: 5, scale: 2 }),
  certificationDate: date("certification_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sessionCollabIdx: uniqueIndex("training_participants_session_collab_uidx").on(t.trainingSessionId, t.collaboratorId),
}));

// ────────────────────────────────────────────────────────────────
// MOUVEMENTS DU PERSONNEL
// ────────────────────────────────────────────────────────────────
export const personnelMovementsTable = pgTable("personnel_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  // promotion | mutation | reclassification | departure | retirement | disciplinary
  type: text("type").notNull(),
  effectiveDate: date("effective_date").notNull(),
  // Avant
  previousDepartmentId: uuid("previous_department_id").references(() => departmentsTable.id),
  previousPositionId: uuid("previous_position_id").references(() => positionsTable.id),
  previousSalary: numeric("previous_salary", { precision: 14, scale: 2 }),
  // Après
  newDepartmentId: uuid("new_department_id").references(() => departmentsTable.id),
  newPositionId: uuid("new_position_id").references(() => positionsTable.id),
  newSalary: numeric("new_salary", { precision: 14, scale: 2 }),
  reason: text("reason"),
  approvedById: uuid("approved_by_id").references(() => collaboratorsTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  collabIdx: index("personnel_movements_collab_idx").on(t.collaboratorId),
  typeIdx: index("personnel_movements_type_idx").on(t.type),
  dateIdx: index("personnel_movements_date_idx").on(t.effectiveDate),
}));

// ────────────────────────────────────────────────────────────────
// POLITIQUES DE CONGÉS
// ────────────────────────────────────────────────────────────────
export const leavePoliciesTable = pgTable("leave_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  leaveType: text("leave_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Délai minimum de préavis en jours calendaires
  minNoticeDays: integer("min_notice_days").notNull().default(0),
  // Plafond de jours par an (null = illimité)
  maxDaysPerYear: numeric("max_days_per_year", { precision: 5, scale: 1 }),
  // Report max depuis l'année précédente (null = pas de report)
  carryOverMax: numeric("carry_over_max", { precision: 5, scale: 1 }),
  // Nécessite approbation manager
  requiresApproval: boolean("requires_approval").notNull().default(true),
  // Autorise demi-journée
  allowHalfDay: boolean("allow_half_day").notNull().default(false),
  // Taux d'acquisition mensuel (jours/mois)
  accrualRate: numeric("accrual_rate", { precision: 5, scale: 2 }),
  // Alloué par défaut à l'initialisation des soldes annuels
  defaultAllocatedDays: numeric("default_allocated_days", { precision: 5, scale: 1 }).default("0"),
  // Niveau d'approbation : auto | manager | hr | manager_then_hr
  approverRole: text("approver_role").notNull().default("manager"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uniq: uniqueIndex("leave_policies_org_type_uidx").on(t.organizationId, t.leaveType),
  orgIdx: index("leave_policies_org_idx").on(t.organizationId),
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
// SOLDES DE CONGÉS
// ────────────────────────────────────────────────────────────────
export const leaveBalancesTable = pgTable("leave_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  leaveType: text("leave_type").notNull(),
  allocated: numeric("allocated", { precision: 5, scale: 1 }).notNull().default("0"),
  used: numeric("used", { precision: 5, scale: 1 }).notNull().default("0"),
  carried: numeric("carried", { precision: 5, scale: 1 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uniq: uniqueIndex("leave_balances_collab_year_type_uniq").on(t.collaboratorId, t.year, t.leaveType),
  orgIdx: index("leave_balances_org_idx").on(t.organizationId),
  collabIdx: index("leave_balances_collab_idx").on(t.collaboratorId),
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
export const insertLeaveBalanceSchema = createInsertSchema(leaveBalancesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeavePolicySchema = createInsertSchema(leavePoliciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobOfferSchema = createInsertSchema(jobOffersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCandidacySchema = createInsertSchema(candidaciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPerformanceReviewSchema = createInsertSchema(performanceReviewsTable).omit({ id: true, createdAt: true, updatedAt: true, acknowledgedAt: true });
export const insertTrainingSessionSchema = createInsertSchema(trainingSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPersonnelMovementSchema = createInsertSchema(personnelMovementsTable).omit({ id: true, createdAt: true });

export type Department = typeof departmentsTable.$inferSelect;
export type Position = typeof positionsTable.$inferSelect;
export type Contract = typeof contractsTable.$inferSelect;
export type HrDocument = typeof hrDocumentsTable.$inferSelect;
export type CollaboratorAssignment = typeof collaboratorAssignmentsTable.$inferSelect;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type LeaveBalance = typeof leaveBalancesTable.$inferSelect;
export type LeavePolicy = typeof leavePoliciesTable.$inferSelect;
export type JobOffer = typeof jobOffersTable.$inferSelect;
export type Candidacy = typeof candidaciesTable.$inferSelect;
export type PerformanceReview = typeof performanceReviewsTable.$inferSelect;
export type TrainingSession = typeof trainingSessionsTable.$inferSelect;
export type PersonnelMovement = typeof personnelMovementsTable.$inferSelect;

// ─────────────────────────────────────────────────────────
// TEMPLATES DE CONTRATS (#10)
// ─────────────────────────────────────────────────────────
export const contractTemplatesTable = pgTable("contract_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // CDI | CDD | Stage | Consultant | Freelance | Autre
  contractType: text("contract_type").notNull(),
  description: text("description"),
  // Corps du template avec variables {{nom}}, {{poste}}, {{salaire}}, etc.
  templateBody: text("template_body").notNull(),
  // Variables disponibles (jsonb [{key, label, required}])
  variables: jsonb("variables").default([]),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  version: integer("version").notNull().default(1),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("ct_org_idx").on(t.organizationId),
  typeIdx: index("ct_type_idx").on(t.contractType),
}));

export const insertContractTemplateSchema = createInsertSchema(contractTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type ContractTemplate = typeof contractTemplatesTable.$inferSelect;

// ─────────────────────────────────────────────────────────
// DEMANDES DE MISE À JOUR COORDONNÉES BANCAIRES
// ─────────────────────────────────────────────────────────
export const bankInfoRequestsTable = pgTable("bank_info_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  // Nouvelles coordonnées proposées
  bankName: text("bank_name"),
  bankCode: text("bank_code"),
  bankAccountNumber: text("bank_account_number"),
  // Workflow : pending | approved | rejected
  status: text("status").notNull().default("pending"),
  // Manager qui a traité la demande
  reviewedById: uuid("reviewed_by_id").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("bir_org_idx").on(t.organizationId),
  collabIdx: index("bir_collab_idx").on(t.collaboratorId),
  statusIdx: index("bir_status_idx").on(t.status),
}));

export type BankInfoRequest = typeof bankInfoRequestsTable.$inferSelect;

// ─────────────────────────────────────────────────────────
// JOURNAL D'AUDIT RH
// ─────────────────────────────────────────────────────────
export const hrAuditLogsTable = pgTable("hr_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  performedById: uuid("performed_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  // salary_update | department_change | position_change | status_change | deletion | contract_update | leave_decision
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  entityName: text("entity_name"),
  fieldChanged: text("field_changed"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index("hr_audit_logs_org_idx").on(t.organizationId),
  entityIdx: index("hr_audit_logs_entity_idx").on(t.entityType, t.entityId),
  actionIdx: index("hr_audit_logs_action_idx").on(t.action),
  dateIdx: index("hr_audit_logs_date_idx").on(t.createdAt),
}));

export type HrAuditLog = typeof hrAuditLogsTable.$inferSelect;

// ─────────────────────────────────────────────────────────
// RÉCLAMATIONS RH
// ─────────────────────────────────────────────────────────
export const hrClaimsTable = pgTable("hr_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  // Référence lisible (ex: REC-2026-0042)
  reference: text("reference").notNull(),
  // salaire | conges | conditions_travail | harcelement | discrimination | securite | avantages | carriere | autre
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  // brouillon | soumise | en_cours | infos_complementaires | en_traitement | resolue | refusee | cloturee
  status: text("status").notNull().default("brouillon"),
  // faible | normale | haute | urgente
  priority: text("priority").notNull().default("normale"),
  // Responsable RH assigné
  assignedToId: uuid("assigned_to_id").references(() => usersTable.id, { onDelete: "set null" }),
  // Date cible de résolution
  targetDate: date("target_date"),
  // Date de résolution effective
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
  // Anonymisée : la réclamation ne montre pas le nom du collaborateur aux managers de niveau intermédiaire
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("hr_claims_org_idx").on(t.organizationId),
  collabIdx: index("hr_claims_collab_idx").on(t.collaboratorId),
  statusIdx: index("hr_claims_status_idx").on(t.status),
  refOrgIdx: uniqueIndex("hr_claims_ref_org_uidx").on(t.organizationId, t.reference),
}));

export const hrClaimEventsTable = pgTable("hr_claim_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  claimId: uuid("claim_id").notNull().references(() => hrClaimsTable.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  // status_change | comment | info_request | resolution | attachment
  kind: text("kind").notNull().default("comment"),
  // Pour status_change : ancien statut
  fromStatus: text("from_status"),
  // Pour status_change : nouveau statut
  toStatus: text("to_status"),
  content: text("content"),
  // Visible uniquement par les RH/managers (pas par l'employé)
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  claimIdx: index("hr_claim_events_claim_idx").on(t.claimId),
  orgIdx: index("hr_claim_events_org_idx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────
// PIÈCES JOINTES — RÉCLAMATIONS RH
// ─────────────────────────────────────────────────────────
export const hrClaimAttachmentsTable = pgTable("hr_claim_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  claimId: uuid("claim_id").notNull().references(() => hrClaimsTable.id, { onDelete: "cascade" }),
  uploadedById: uuid("uploaded_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  // Nom d'affichage original
  fileName: text("file_name").notNull(),
  // URL de stockage (objectPath ou URL signée)
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type"),
  // Taille en octets
  size: integer("size"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  claimIdx: index("hr_claim_attachments_claim_idx").on(t.claimId),
  orgIdx: index("hr_claim_attachments_org_idx").on(t.organizationId),
}));

export type HrClaim = typeof hrClaimsTable.$inferSelect;
export type HrClaimEvent = typeof hrClaimEventsTable.$inferSelect;
export type HrClaimAttachment = typeof hrClaimAttachmentsTable.$inferSelect;
