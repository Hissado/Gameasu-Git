/**
 * Module Pointage & Paie BTP — Gameasu
 *
 * Logique basée sur le modèle Excel "Pointage Modèle" (BTP Togo / Convention collective BTP).
 * Période de paie : du 26 du mois précédent au 25 du mois courant.
 * Heures sup calculées semaine par semaine (lundi→dimanche).
 * CNSS salarié 9%, employeur 22.5%. IRPP barème progressif togolais.
 * Arrondi final au 100 FCFA supérieur.
 */
import { pgTable, text, timestamp, uuid, numeric, integer, boolean, jsonb, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizationsTable } from "./saas";
import { collaboratorsTable } from "./collaborators";
import { usersTable } from "./users";

// ─────────────────────────────────────────────────────────────────────────
// PARAMÈTRES DE PAIE BTP PAR ORGANISATION
// ─────────────────────────────────────────────────────────────────────────
export const btpPayrollSettingsTable = pgTable("btp_payroll_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),

  // Durée légale
  hoursPerWeek: numeric("hours_per_week", { precision: 5, scale: 2 }).notNull().default("40"),
  hoursPerDayStandard: numeric("hours_per_day_standard", { precision: 4, scale: 2 }).notNull().default("8"),
  // Diviseur légal = 40h × 52 sem ÷ 12 mois = 173.33
  hourlyRateDivisor: numeric("hourly_rate_divisor", { precision: 6, scale: 2 }).notNull().default("173.33"),

  // Période de paie (jour du mois)
  periodStartDay: integer("period_start_day").notNull().default(26),
  periodEndDay: integer("period_end_day").notNull().default(25),

  // Taux de majoration HS (configurable par tenant)
  hs20Rate: numeric("hs20_rate", { precision: 4, scale: 2 }).notNull().default("1.20"),   // 41e→48e h/sem
  hs40Rate: numeric("hs40_rate", { precision: 4, scale: 2 }).notNull().default("1.40"),   // au-delà 48e h/sem
  hsSundayRate: numeric("hs_sunday_rate", { precision: 4, scale: 2 }).notNull().default("1.65"), // dim/fériés (configurable)
  hsNightRate: numeric("hs_night_rate", { precision: 4, scale: 2 }).notNull().default("1.65"),   // nuit 22h-5h
  hsSundayNightRate: numeric("hs_sunday_night_rate", { precision: 4, scale: 2 }).notNull().default("2.00"), // nuit dim/fériés

  // CNSS
  cnssEmployeeRate: numeric("cnss_employee_rate", { precision: 5, scale: 4 }).notNull().default("0.09"),
  cnssEmployerRate: numeric("cnss_employer_rate", { precision: 5, scale: 4 }).notNull().default("0.225"),

  // IRPP
  irppAbatementRate: numeric("irpp_abatement_rate", { precision: 5, scale: 4 }).notNull().default("0.28"),
  irppChargePerDependent: numeric("irpp_charge_per_dependent", { precision: 10, scale: 2 }).notNull().default("10000"),
  irppMaxDependents: integer("irpp_max_dependents").notNull().default(6),

  // Congés payés
  leaveAccrualDaysPerMonth: numeric("leave_accrual_days_per_month", { precision: 4, scale: 2 }).notNull().default("2.5"),

  // Absence : calcul base jours civils du mois (30 ou 31)
  absenceBaseCalendarDays: boolean("absence_base_calendar_days").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgUidx: uniqueIndex("btp_payroll_settings_org_uidx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────────────────────
// GROUPES DE PAIE (catégories salariales avec paramètres propres)
// Ex : "BTP Terrain" (26→25), "Employés de bureau" (1→30)
// ─────────────────────────────────────────────────────────────────────────
export const btpPayGroupsTable = pgTable("btp_pay_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),

  // Durée légale
  hoursPerWeek: numeric("hours_per_week", { precision: 5, scale: 2 }).notNull().default("40"),
  hoursPerDayStandard: numeric("hours_per_day_standard", { precision: 4, scale: 2 }).notNull().default("8"),
  hourlyRateDivisor: numeric("hourly_rate_divisor", { precision: 6, scale: 2 }).notNull().default("173.33"),

  // Période de paie
  periodStartDay: integer("period_start_day").notNull().default(26),
  periodEndDay: integer("period_end_day").notNull().default(25),

  // Taux de majoration HS
  hs20Rate: numeric("hs20_rate", { precision: 4, scale: 2 }).notNull().default("1.20"),
  hs40Rate: numeric("hs40_rate", { precision: 4, scale: 2 }).notNull().default("1.40"),
  hsSundayRate: numeric("hs_sunday_rate", { precision: 4, scale: 2 }).notNull().default("1.65"),
  hsNightRate: numeric("hs_night_rate", { precision: 4, scale: 2 }).notNull().default("1.65"),
  hsSundayNightRate: numeric("hs_sunday_night_rate", { precision: 4, scale: 2 }).notNull().default("2.00"),

  // CNSS
  cnssEmployeeRate: numeric("cnss_employee_rate", { precision: 5, scale: 4 }).notNull().default("0.09"),
  cnssEmployerRate: numeric("cnss_employer_rate", { precision: 5, scale: 4 }).notNull().default("0.225"),

  // IRPP
  irppAbatementRate: numeric("irpp_abatement_rate", { precision: 5, scale: 4 }).notNull().default("0.28"),
  irppChargePerDependent: numeric("irpp_charge_per_dependent", { precision: 10, scale: 2 }).notNull().default("10000"),
  irppMaxDependents: integer("irpp_max_dependents").notNull().default(6),

  // Congés
  leaveAccrualDaysPerMonth: numeric("leave_accrual_days_per_month", { precision: 4, scale: 2 }).notNull().default("2.5"),
  absenceBaseCalendarDays: boolean("absence_base_calendar_days").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgNameIdx: index("btp_pay_groups_org_idx").on(t.organizationId),
}));

// ─────────────────────────────────────────────────────────────────────────
// AFFECTATION COLLABORATEUR → GROUPE DE PAIE
// ─────────────────────────────────────────────────────────────────────────
export const btpCollaboratorGroupTable = pgTable("btp_collaborator_groups", {
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  payGroupId: uuid("pay_group_id").notNull().references(() => btpPayGroupsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: index("btp_collab_group_pk_idx").on(t.collaboratorId),
  groupIdx: index("btp_collab_group_group_idx").on(t.payGroupId),
}));

// ─────────────────────────────────────────────────────────────────────────
// JOURS FÉRIÉS (PAR ORGANISATION)
// ─────────────────────────────────────────────────────────────────────────
export const btpHolidaysTable = pgTable("btp_holidays", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  label: text("label").notNull(),
  isRecurringYearly: boolean("is_recurring_yearly").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgDateIdx: uniqueIndex("btp_holidays_org_date_uidx").on(t.organizationId, t.date),
}));

// ─────────────────────────────────────────────────────────────────────────
// PÉRIODES DE PAIE BTP
// ─────────────────────────────────────────────────────────────────────────
export const btpPayPeriodsTable = pgTable("btp_pay_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // Groupe de paie (null = paramètres globaux par défaut)
  payGroupId: uuid("pay_group_id").references(() => btpPayGroupsTable.id, { onDelete: "set null" }),
  // Ex: "2026-06 (Bureau)" — inclure le groupe si multi-groupe
  label: text("label").notNull(),
  startDate: date("start_date").notNull(), // 26 du mois précédent
  endDate: date("end_date").notNull(),     // 25 du mois courant
  // Jours ouvrables totaux du mois (dénominateur de proratisation — commun à tous les agents)
  totalWorkingDays: integer("total_working_days"),
  // draft | open | locked
  status: text("status").notNull().default("draft"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedById: uuid("locked_by_id").references(() => usersTable.id),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgLabelUidx: uniqueIndex("btp_pay_periods_org_label_uidx").on(t.organizationId, t.label),
  statusIdx: index("btp_pay_periods_status_idx").on(t.status),
}));

// ─────────────────────────────────────────────────────────────────────────
// LIGNES DE POINTAGE JOURNALIER PAR AGENT
// ─────────────────────────────────────────────────────────────────────────
// Statuts : 'present' (valeur numérique) | 'holiday' (H) | 'sick' (M) | 'absent' (A) | 'leave' (C)
export const btpAttendanceLinesTable = pgTable("btp_attendance_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  payPeriodId: uuid("pay_period_id").notNull().references(() => btpPayPeriodsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
  recordDate: date("record_date").notNull(),
  // Statut : present | holiday | sick | absent | leave
  status: text("status").notNull().default("present"),
  // Heures travaillées (si status=present, sinon 0)
  hoursWorked: numeric("hours_worked", { precision: 5, scale: 2 }).notNull().default("0"),
  // Heures supplémentaires de la journée (saisie manuelle, colonne paire du modèle Excel)
  overtimeHours: numeric("overtime_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  // HS 100% nuit dim/fériés de la journée
  overtime100Hours: numeric("overtime_100_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  periodCollabDateUidx: uniqueIndex("btp_attendance_lines_period_collab_date_uidx").on(t.payPeriodId, t.collaboratorId, t.recordDate),
  periodCollabIdx: index("btp_attendance_lines_period_collab_idx").on(t.payPeriodId, t.collaboratorId),
}));

// ─────────────────────────────────────────────────────────────────────────
// RAPPORT MENSUEL PAR AGENT (calculé à partir des lignes de pointage)
// ─────────────────────────────────────────────────────────────────────────
export const btpPeriodReportsTable = pgTable("btp_period_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  payPeriodId: uuid("pay_period_id").notNull().references(() => btpPayPeriodsTable.id, { onDelete: "cascade" }),
  collaboratorId: uuid("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),

  // Type de salarié
  employmentType: text("employment_type").notNull().default("variable"), // variable | fixe | etabli

  // ── Comptage jours ──────────────────────────────────────────────────────
  daysPresent: integer("days_present").notNull().default(0),   // R
  daysHoliday: integer("days_holiday").notNull().default(0),   // S
  daysSick: integer("days_sick").notNull().default(0),         // T
  daysAbsent: integer("days_absent").notNull().default(0),     // U
  daysLeave: integer("days_leave").notNull().default(0),       // V
  daysTotalValorized: integer("days_total_valorized").notNull().default(0), // W = R+S+T

  // ── Heures totales ──────────────────────────────────────────────────────
  hoursNormal: numeric("hours_normal", { precision: 7, scale: 2 }).notNull().default("0"),   // BH
  hoursHs20: numeric("hours_hs20", { precision: 7, scale: 2 }).notNull().default("0"),       // BI
  hoursHs40: numeric("hours_hs40", { precision: 7, scale: 2 }).notNull().default("0"),       // BJ
  hoursHsSunday: numeric("hours_hs_sunday", { precision: 7, scale: 2 }).notNull().default("0"), // BK
  hoursHs100: numeric("hours_hs100", { precision: 7, scale: 2 }).notNull().default("0"),     // BL
  hoursForfait: numeric("hours_forfait", { precision: 7, scale: 2 }).notNull().default("0"), // BM (ETABLI only)

  // Report semaine à cheval du mois précédent
  prevMonthCarryoverHours: numeric("prev_month_carryover_hours", { precision: 7, scale: 2 }).notNull().default("0"), // BN

  // ── Salaires ────────────────────────────────────────────────────────────
  baseSalary: numeric("base_salary", { precision: 14, scale: 2 }).notNull().default("0"),         // U col
  sursalaire: numeric("sursalaire", { precision: 14, scale: 2 }).notNull().default("0"),           // W col
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 4 }).notNull().default("0"),          // Z col
  baseSalaryProrated: numeric("base_salary_prorated", { precision: 14, scale: 2 }).notNull().default("0"), // V col
  sursalaireProrated: numeric("sursalaire_prorated", { precision: 14, scale: 2 }).notNull().default("0"),  // X col

  // ── Montants HS ─────────────────────────────────────────────────────────
  amountHs20: numeric("amount_hs20", { precision: 14, scale: 2 }).notNull().default("0"),
  amountHs40: numeric("amount_hs40", { precision: 14, scale: 2 }).notNull().default("0"),
  amountHsSunday: numeric("amount_hs_sunday", { precision: 14, scale: 2 }).notNull().default("0"),
  amountHs100: numeric("amount_hs100", { precision: 14, scale: 2 }).notNull().default("0"),
  amountForfait: numeric("amount_forfait", { precision: 14, scale: 2 }).notNull().default("0"),
  forfaitHourlyRate: numeric("forfait_hourly_rate", { precision: 10, scale: 2 }).notNull().default("0"), // AI

  // ── Primes & indemnités ─────────────────────────────────────────────────
  primeResponsabilite: numeric("prime_responsabilite", { precision: 14, scale: 2 }).notNull().default("0"),
  primeSalissure: numeric("prime_salissure", { precision: 14, scale: 2 }).notNull().default("0"),
  indemTransport: numeric("indem_transport", { precision: 14, scale: 2 }).notNull().default("0"),
  indemFinContrat: numeric("indem_fin_contrat", { precision: 14, scale: 2 }).notNull().default("0"),
  bonusDimanchesCount: integer("bonus_dimanches_count").notNull().default(0),
  bonusDimanchesUnit: numeric("bonus_dimanches_unit", { precision: 10, scale: 2 }).notNull().default("0"),
  bonusDimanchesTotal: numeric("bonus_dimanches_total", { precision: 14, scale: 2 }).notNull().default("0"),

  // ── Calcul brut ─────────────────────────────────────────────────────────
  grossSalary: numeric("gross_salary", { precision: 14, scale: 2 }).notNull().default("0"),       // AW

  // ── Retenues légales ────────────────────────────────────────────────────
  cnssEmployee: numeric("cnss_employee", { precision: 14, scale: 2 }).notNull().default("0"),     // AX
  irppBase: numeric("irpp_base", { precision: 14, scale: 2 }).notNull().default("0"),             // BA arrondi
  irppAmount: numeric("irpp_amount", { precision: 14, scale: 2 }).notNull().default("0"),         // BC
  totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }).notNull().default("0"), // BD
  netSalary: numeric("net_salary", { precision: 14, scale: 2 }).notNull().default("0"),           // BE

  // ── Charges employeur ───────────────────────────────────────────────────
  cnssEmployer: numeric("cnss_employer", { precision: 14, scale: 2 }).notNull().default("0"),     // BF
  leaveProvision: numeric("leave_provision", { precision: 14, scale: 2 }).notNull().default("0"), // BG
  totalEmployerCost: numeric("total_employer_cost", { precision: 14, scale: 2 }).notNull().default("0"), // BH

  // ── Divers à déduire du net ─────────────────────────────────────────────
  vaccinationFees: numeric("vaccination_fees", { precision: 14, scale: 2 }).notNull().default("0"), // BI
  medicalFees: numeric("medical_fees", { precision: 14, scale: 2 }).notNull().default("0"),         // BJ
  advanceSalary: numeric("advance_salary", { precision: 14, scale: 2 }).notNull().default("0"),     // BK
  netFinal: numeric("net_final", { precision: 14, scale: 2 }).notNull().default("0"),              // BM arrondi

  // Nombre de personnes à charge (pour IRPP)
  dependentsCount: integer("dependents_count").notNull().default(0),

  // Statut du rapport
  status: text("status").notNull().default("draft"), // draft | validated

  // Snapshot des taux utilisés (auditabilité)
  ratesSnapshot: jsonb("rates_snapshot"),

  // Détail hebdomadaire (6 semaines) stocké en JSONB pour l'export
  weeklyBreakdown: jsonb("weekly_breakdown"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  periodCollabUidx: uniqueIndex("btp_period_reports_period_collab_uidx").on(t.payPeriodId, t.collaboratorId),
  periodIdx: index("btp_period_reports_period_idx").on(t.payPeriodId),
}));

// ─────────────────────────────────────────────────────────────────────────
// EXPORTS EXCEL
// ─────────────────────────────────────────────────────────────────────────
export const btpExportsTable = pgTable("btp_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  payPeriodId: uuid("pay_period_id").notNull().references(() => btpPayPeriodsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("pointage"), // pointage | salaires | complet
  fileUrl: text("file_url"),
  generatedById: uuid("generated_by_id").references(() => usersTable.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});
