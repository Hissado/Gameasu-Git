import { pgTable, text, boolean, timestamp, uuid, integer, date, jsonb, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable } from "./saas";

/**
 * Collaborateurs / employés EDOLE.
 *
 * - Le champ legacy `position` (text) est conservé pour rétro-compat ; les
 *   nouveaux enregistrements doivent utiliser `positionId` (FK vers
 *   `positions`). Idem pour `department` → `departmentId`.
 * - `userId` (optionnel) lie un collaborateur à un compte utilisateur de la
 *   plateforme (accès portail). Tous les collaborateurs ne sont pas users.
 * - `managerCollaboratorId` permet de modéliser la hiérarchie interne.
 */
export const collaboratorsTable = pgTable("collaborators", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // Identification
  employeeNumber: text("employee_number"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),

  // Liaison RH (nouveau)
  departmentId: uuid("department_id"),       // FK gérée par drizzle au runtime (évite cycle import)
  positionId: uuid("position_id"),
  managerCollaboratorId: uuid("manager_collaborator_id"),
  userId: uuid("user_id").references(() => usersTable.id),

  // Champs legacy (texte libre) — toujours utilisables, complétés au fur et à mesure.
  position: text("position"),
  department: text("department"),

  // Données employé
  hireDate: date("hire_date"),
  birthDate: date("birth_date"),
  nationalId: text("national_id"),
  address: text("address"),
  emergencyContact: jsonb("emergency_contact"), // { name, phone, relation }
  baseSalary: numeric("base_salary", { precision: 14, scale: 2 }),

  // ── Coût employeur réel (utilisé par le calculateur tarifaire)
  // Taux de charges patronales en % (CNSS 16,4% + IPTS 2% = 18,4% par défaut au Togo).
  employerChargeRate: numeric("employer_charge_rate", { precision: 6, scale: 3 }).default("18.4"),
  // Avantages mensuels en espèces (transport, logement, repas, autres).
  transportAllowance: numeric("transport_allowance", { precision: 14, scale: 2 }).default("0"),
  housingAllowance: numeric("housing_allowance", { precision: 14, scale: 2 }).default("0"),
  mealAllowance: numeric("meal_allowance", { precision: 14, scale: 2 }).default("0"),
  // Autres avantages récurrents en FCFA/mois (assurance, téléphone, véhicule…).
  otherBenefitsMonthly: numeric("other_benefits_monthly", { precision: 14, scale: 2 }).default("0"),
  // Durée de travail hebdomadaire de référence pour le calcul du taux horaire.
  weeklyHours: numeric("weekly_hours", { precision: 5, scale: 2 }).default("40"),

  // Email professionnel (utilisé en priorité pour les bulletins de paie)
  professionalEmail: text("professional_email"),

  // Coordonnées bancaires (pour virements de salaires)
  bankName: text("bank_name"),
  bankCode: text("bank_code"),         // Code banque BCEAO (ex: "024" pour Ecobank Togo)
  bankAccountNumber: text("bank_account_number"), // Numéro de compte ou IBAN

  // Kiosk
  kioskCode: text("kiosk_code"), // code à 4 chiffres unique par organisation pour le kiosk

  // active | on_leave | terminated | retired
  employmentStatus: text("employment_status").notNull().default("active"),

  // Disponibilité & charge
  isAvailable: boolean("is_available").notNull().default(true),
  currentProjectsCount: integer("current_projects_count").default(0),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  empNumberIdx: index("collaborators_emp_number_idx").on(t.employeeNumber),
  deptIdx: index("collaborators_department_idx").on(t.departmentId),
  posIdx: index("collaborators_position_idx").on(t.positionId),
  mgrIdx: index("collaborators_manager_idx").on(t.managerCollaboratorId),
}));

export const insertCollaboratorSchema = createInsertSchema(collaboratorsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;
export type Collaborator = typeof collaboratorsTable.$inferSelect;
