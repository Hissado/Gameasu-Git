/**
 * Modules #15 Signature électronique, #16 Déclarations fiscales, #17 Avantages sociaux
 */
import { pgTable, text, timestamp, uuid, numeric, boolean, index, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { organizationsTable } from "./saas";
import { collaboratorsTable } from "./collaborators";
import { usersTable } from "./users";

// ─────────────────────────────────────────────────────────
// SIGNATURE ÉLECTRONIQUE (#15)
// ─────────────────────────────────────────────────────────
export const signatureRequestsTable = pgTable("signature_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // Type de document : contrat | offre | attestation | avenant | autre
  documentType: text("document_type").notNull(),
  documentId: uuid("document_id"), // référence vers le document source
  documentLabel: text("document_label").notNull(),
  signatoryId: uuid("signatory_id").references(() => collaboratorsTable.id),
  signatoryEmail: text("signatory_email").notNull(),
  signatoryName: text("signatory_name").notNull(),
  // Token unique pour le lien de signature
  token: text("token").notNull(),
  // pending | signed | declined | expired | cancelled
  status: text("status").notNull().default("pending"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  declinedReason: text("declined_reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  // Données de signature (image base64 ou référence)
  signatureData: text("signature_data"),
  ipAddress: text("ip_address"),
  // PDF signé stocké (URL)
  signedDocumentUrl: text("signed_document_url"),
  requestedById: uuid("requested_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("sig_req_org_idx").on(t.organizationId),
  tokenIdx: index("sig_req_token_idx").on(t.token),
  statusIdx: index("sig_req_status_idx").on(t.status),
}));

// ─────────────────────────────────────────────────────────
// DÉCLARATIONS FISCALES DGI (#16)
// ─────────────────────────────────────────────────────────
export const taxDeclarationsTable = pgTable("tax_declarations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // irpp | cnss | ipts | tva | is | autre
  type: text("type").notNull(),
  period: text("period").notNull(), // "YYYY-MM" ou "YYYY-QN" ou "YYYY"
  // draft | generated | submitted | validated | rejected
  status: text("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("XOF"),
  // Numéro de référence DGI
  referenceNumber: text("reference_number"),
  dueDate: date("due_date"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  // Détails calculés (jsonb)
  details: jsonb("details").default({}),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("tax_decl_org_idx").on(t.organizationId),
  periodIdx: index("tax_decl_period_idx").on(t.period),
  typeIdx: index("tax_decl_type_idx").on(t.type),
}));

// ─────────────────────────────────────────────────────────
// AVANTAGES SOCIAUX (#17)
// ─────────────────────────────────────────────────────────
export const benefitPlansTable = pgTable("benefit_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // assurance_sante | assurance_vie | retraite | tickets_repas | transport | autre
  type: text("type").notNull(),
  provider: text("provider"),
  description: text("description"),
  // Cotisations (en XOF ou %)
  employeeContribution: numeric("employee_contribution", { precision: 14, scale: 2 }).default("0"),
  employerContribution: numeric("employer_contribution", { precision: 14, scale: 2 }).default("0"),
  // fixed | percentage
  contributionMode: text("contribution_mode").notNull().default("fixed"),
  currency: text("currency").notNull().default("XOF"),
  isActive: boolean("is_active").notNull().default(true),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("benefit_plans_org_idx").on(t.organizationId),
}));

export const employeeBenefitsTable = pgTable("employee_benefits", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id),
  benefitPlanId: uuid("benefit_plan_id").notNull().references(() => benefitPlansTable.id),
  enrollmentDate: date("enrollment_date").notNull(),
  endDate: date("end_date"),
  // active | inactive | pending | suspended
  status: text("status").notNull().default("active"),
  // Cotisation personnalisée (override du plan)
  employeeContributionOverride: numeric("employee_contribution_override", { precision: 14, scale: 2 }),
  employerContributionOverride: numeric("employer_contribution_override", { precision: 14, scale: 2 }),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("emp_ben_org_idx").on(t.organizationId),
  collabIdx: index("emp_ben_collab_idx").on(t.collaboratorId),
  planIdx: index("emp_ben_plan_idx").on(t.benefitPlanId),
}));

export const insertSignatureRequestSchema = createInsertSchema(signatureRequestsTable).omit({ id: true, createdAt: true, updatedAt: true, signedAt: true, declinedAt: true });
export const insertTaxDeclarationSchema = createInsertSchema(taxDeclarationsTable).omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true, validatedAt: true });
export const insertBenefitPlanSchema = createInsertSchema(benefitPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmployeeBenefitSchema = createInsertSchema(employeeBenefitsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type SignatureRequest = typeof signatureRequestsTable.$inferSelect;
export type TaxDeclaration = typeof taxDeclarationsTable.$inferSelect;
export type BenefitPlan = typeof benefitPlansTable.$inferSelect;
export type EmployeeBenefit = typeof employeeBenefitsTable.$inferSelect;
