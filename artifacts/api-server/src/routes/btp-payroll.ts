/**
 * Module Pointage & Paie BTP — routes API
 *
 * Endpoints :
 *  GET/POST   /api/btp/settings                                 — paramètres de paie org
 *  PUT        /api/btp/settings                                 — màj paramètres
 *  GET/POST   /api/btp/holidays                                 — jours fériés
 *  DELETE     /api/btp/holidays/:id
 *  GET/POST   /api/btp/periods                                  — périodes de paie
 *  GET        /api/btp/periods/:id                              — détail période
 *  PATCH      /api/btp/periods/:id                              — màj (statut, notes)
 *  GET        /api/btp/periods/:id/attendance                   — lignes de pointage
 *  PUT        /api/btp/periods/:id/attendance                   — sauvegarder lignes (bulk)
 *  POST       /api/btp/periods/:id/calculate                    — calculer rapports mensuels
 *  GET        /api/btp/periods/:id/reports                      — rapports calculés
 *  PATCH      /api/btp/periods/:id/reports/:collaboratorId      — ajuster manuellement un rapport
 *  GET        /api/btp/periods/:id/export/pointage.xlsx         — export Excel pointage
 *  GET        /api/btp/periods/:id/export/salaires.xlsx         — export Excel salaires
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  btpPayrollSettingsTable,
  btpHolidaysTable,
  btpPayPeriodsTable,
  btpAttendanceLinesTable,
  btpPeriodReportsTable,
  btpExportsTable,
  collaboratorsTable,
  departmentsTable,
  positionsTable,
  contractsTable,
  organizationsTable,
  attendanceSessionsTable,
} from "@workspace/db";
import { and, eq, inArray, sql, asc, desc, gte, lte } from "drizzle-orm";
import ExcelJS from "exceljs";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function orgId(req: any): string {
  return req.authUser!.organizationId as string;
}

function requireAdmin(req: any, res: any): boolean {
  const role = req.authUser?.role;
  if (role !== "admin" && role !== "super_admin" && role !== "manager") {
    res.status(403).json({ error: "Accès réservé aux administrateurs RH" });
    return false;
  }
  return true;
}

/** Jours fériés de l'org pour une année donnée (date string "YYYY-MM-DD") */
async function getHolidayDates(organizationId: string, year: number): Promise<Set<string>> {
  const rows = await db.select({ date: btpHolidaysTable.date })
    .from(btpHolidaysTable)
    .where(eq(btpHolidaysTable.organizationId, organizationId));
  const set = new Set<string>();
  for (const r of rows) {
    const d = new Date(r.date);
    if (d.getFullYear() === year || r.date.startsWith(`${year - 1}-`) || r.date.startsWith(`${year + 1}-`)) {
      // recurring: same month-day regardless of year
      set.add(r.date.slice(5)); // "MM-DD"
    }
  }
  return set;
}

/** Vrai si date est dimanche */
function isSunday(d: Date): boolean {
  return d.getDay() === 0;
}

/** Vrai si date est férié (par mois-jour) */
function isHoliday(d: Date, holidays: Set<string>): boolean {
  const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return holidays.has(key);
}

/**
 * Calcule le nombre de jours ouvrables d'une période (dimanches/fériés exclus)
 * → dénominateur de proratisation (W_total_mois)
 */
function countWorkingDays(start: Date, end: Date, holidays: Set<string>): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    if (!isSunday(d) && !isHoliday(d, holidays)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Toutes les semaines lundi→dimanche qui intersectent [start, end] */
function getWeeksInPeriod(start: Date, end: Date): Array<{ weekStart: Date; weekEnd: Date }> {
  const weeks: Array<{ weekStart: Date; weekEnd: Date }> = [];
  // Trouver le lundi de la semaine contenant start
  const first = new Date(start);
  const dow = first.getDay() === 0 ? 6 : first.getDay() - 1; // lundi=0 … dim=6
  first.setDate(first.getDate() - dow);

  const d = new Date(first);
  while (d <= end) {
    const ws = new Date(d);
    const we = new Date(d);
    we.setDate(we.getDate() + 6);
    weeks.push({ weekStart: ws, weekEnd: we });
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

/** Barème IRPP mensuel Togo (CGI) */
function computeIrpp(monthlyBase: number): number {
  if (monthlyBase <= 0) return 0;
  const b = Math.floor(monthlyBase / 1000) * 1000; // arrondi millier inférieur
  if (b <= 75000) return 0;
  if (b <= 250000) return (b - 75000) * 0.03;
  if (b <= 500000) return (b - 250000) * 0.10 + 5250;
  if (b <= 750000) return (b - 500000) * 0.15 + 30250;
  if (b <= 1000000) return (b - 750000) * 0.20 + 67750;
  if (b <= 1250000) return (b - 1000000) * 0.25 + 117750;
  if (b <= 1666667) return (b - 1250000) * 0.30 + 180250;
  return (b - 1666667) * 0.35 + 305250;
}

/**
 * Calcule les tranches HS d'une semaine à partir des lignes de pointage.
 *
 * @param lines   lignes de la semaine (filtrées par date)
 * @param carryover heures déjà payées le mois précédent pour cette semaine à cheval
 * @param holidays set des "MM-DD" fériés
 * @param rates   taux de la config BTP
 */
function computeWeekHours(
  lines: Array<{ recordDate: string; status: string; hoursWorked: string; overtimeHours: string; overtime100Hours: string }>,
  carryover: number,
  holidays: Set<string>,
  rates: { hs20: number; hs40: number; hsSunday: number; hs100: number },
) {
  let hoursNormal = 0;
  let hoursHs20 = 0;
  let hoursHs40 = 0;
  let hoursHsSunday = 0;
  let hoursHs100 = 0;
  let totalWeek = 0;

  for (const line of lines) {
    const d = new Date(line.recordDate);
    const hw = parseFloat(line.hoursWorked) || 0;
    const ot = parseFloat(line.overtimeHours) || 0;
    const ot100 = parseFloat(line.overtime100Hours) || 0;

    if (line.status === "holiday" || isSunday(d) || isHoliday(d, holidays)) {
      // Heures dim/fériés → tranche sunday
      hoursHsSunday += hw + ot;
      hoursHs100 += ot100;
    } else if (line.status === "present") {
      totalWeek += hw + ot;
      hoursHs100 += ot100;
    }
  }

  // Appliquer le report semaine à cheval
  const effectiveTotal = totalWeek + carryover;

  // Tranches semaine (hors dim/fériés)
  if (effectiveTotal <= 40) {
    hoursNormal = effectiveTotal;
  } else if (effectiveTotal <= 48) {
    hoursNormal = 40;
    hoursHs20 = effectiveTotal - 40;
  } else {
    hoursNormal = 40;
    hoursHs20 = 8;
    hoursHs40 = effectiveTotal - 48;
  }

  return { hoursNormal, hoursHs20, hoursHs40, hoursHsSunday, hoursHs100, totalWeek };
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

router.get("/btp/settings", async (req, res) => {
  try {
    const oid = orgId(req);
    const [settings] = await db.select().from(btpPayrollSettingsTable)
      .where(eq(btpPayrollSettingsTable.organizationId, oid)).limit(1);
    if (!settings) {
      // Créer des settings par défaut
      const [created] = await db.insert(btpPayrollSettingsTable)
        .values({ organizationId: oid })
        .returning();
      return res.json(created);
    }
    return res.json(settings);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

router.put("/btp/settings", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    const {
      hoursPerWeek, hoursPerDayStandard, hourlyRateDivisor,
      periodStartDay, periodEndDay,
      hs20Rate, hs40Rate, hsSundayRate, hsNightRate, hsSundayNightRate,
      cnssEmployeeRate, cnssEmployerRate,
      irppAbatementRate, irppChargePerDependent, irppMaxDependents,
      leaveAccrualDaysPerMonth, absenceBaseCalendarDays,
    } = req.body ?? {};

    const [existing] = await db.select({ id: btpPayrollSettingsTable.id })
      .from(btpPayrollSettingsTable).where(eq(btpPayrollSettingsTable.organizationId, oid)).limit(1);

    const values: any = {};
    if (hoursPerWeek !== undefined) values.hoursPerWeek = String(hoursPerWeek);
    if (hoursPerDayStandard !== undefined) values.hoursPerDayStandard = String(hoursPerDayStandard);
    if (hourlyRateDivisor !== undefined) values.hourlyRateDivisor = String(hourlyRateDivisor);
    if (periodStartDay !== undefined) values.periodStartDay = periodStartDay;
    if (periodEndDay !== undefined) values.periodEndDay = periodEndDay;
    if (hs20Rate !== undefined) values.hs20Rate = String(hs20Rate);
    if (hs40Rate !== undefined) values.hs40Rate = String(hs40Rate);
    if (hsSundayRate !== undefined) values.hsSundayRate = String(hsSundayRate);
    if (hsNightRate !== undefined) values.hsNightRate = String(hsNightRate);
    if (hsSundayNightRate !== undefined) values.hsSundayNightRate = String(hsSundayNightRate);
    if (cnssEmployeeRate !== undefined) values.cnssEmployeeRate = String(cnssEmployeeRate);
    if (cnssEmployerRate !== undefined) values.cnssEmployerRate = String(cnssEmployerRate);
    if (irppAbatementRate !== undefined) values.irppAbatementRate = String(irppAbatementRate);
    if (irppChargePerDependent !== undefined) values.irppChargePerDependent = String(irppChargePerDependent);
    if (irppMaxDependents !== undefined) values.irppMaxDependents = irppMaxDependents;
    if (leaveAccrualDaysPerMonth !== undefined) values.leaveAccrualDaysPerMonth = String(leaveAccrualDaysPerMonth);
    if (absenceBaseCalendarDays !== undefined) values.absenceBaseCalendarDays = absenceBaseCalendarDays;

    if (existing) {
      const [updated] = await db.update(btpPayrollSettingsTable).set(values)
        .where(eq(btpPayrollSettingsTable.organizationId, oid)).returning();
      return res.json(updated);
    }
    const [created] = await db.insert(btpPayrollSettingsTable)
      .values({ organizationId: oid, ...values }).returning();
    return res.json(created);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

// ─── HOLIDAYS ─────────────────────────────────────────────────────────────────

router.get("/btp/holidays", async (req, res) => {
  try {
    const oid = orgId(req);
    const rows = await db.select().from(btpHolidaysTable)
      .where(eq(btpHolidaysTable.organizationId, oid))
      .orderBy(asc(btpHolidaysTable.date));
    return res.json(rows);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

router.post("/btp/holidays", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    const { date, label, isRecurringYearly = true } = req.body ?? {};
    if (!date || !label) return res.status(400).json({ error: "date et label requis" });
    const [row] = await db.insert(btpHolidaysTable)
      .values({ organizationId: oid, date, label, isRecurringYearly })
      .onConflictDoNothing().returning();
    return res.status(201).json(row);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

router.delete("/btp/holidays/:id", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    await db.delete(btpHolidaysTable).where(
      and(eq(btpHolidaysTable.id, req.params.id as string), eq(btpHolidaysTable.organizationId, oid))
    );
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

// ─── PERIODS ──────────────────────────────────────────────────────────────────

router.get("/btp/periods", async (req, res) => {
  try {
    const oid = orgId(req);
    const rows = await db.select().from(btpPayPeriodsTable)
      .where(eq(btpPayPeriodsTable.organizationId, oid))
      .orderBy(desc(btpPayPeriodsTable.startDate));
    return res.json(rows);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

router.post("/btp/periods", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    const { label, startDate, endDate, notes } = req.body ?? {};
    if (!label || !startDate || !endDate) return res.status(400).json({ error: "label, startDate, endDate requis" });

    // Calculer les jours ouvrables
    const holidays = await getHolidayDates(oid, new Date(startDate).getFullYear());
    const totalWorkingDays = countWorkingDays(new Date(startDate), new Date(endDate), holidays);

    const [row] = await db.insert(btpPayPeriodsTable)
      .values({ organizationId: oid, label, startDate, endDate, totalWorkingDays, notes, createdById: req.authUser!.id })
      .returning();
    return res.status(201).json(row);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Cette période existe déjà" });
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/btp/periods/:id", async (req, res) => {
  try {
    const oid = orgId(req);
    const [period] = await db.select().from(btpPayPeriodsTable)
      .where(and(eq(btpPayPeriodsTable.id, req.params.id as string), eq(btpPayPeriodsTable.organizationId, oid))).limit(1);
    if (!period) return res.status(404).json({ error: "Période introuvable" });
    return res.json(period);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

router.patch("/btp/periods/:id", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    const { status, notes, totalWorkingDays } = req.body ?? {};
    const values: any = {};
    if (status !== undefined) {
      values.status = status;
      if (status === "locked") { values.lockedAt = new Date(); values.lockedById = req.authUser!.id; }
    }
    if (notes !== undefined) values.notes = notes;
    if (totalWorkingDays !== undefined) values.totalWorkingDays = totalWorkingDays;
    const [updated] = await db.update(btpPayPeriodsTable).set(values)
      .where(and(eq(btpPayPeriodsTable.id, req.params.id as string), eq(btpPayPeriodsTable.organizationId, oid)))
      .returning();
    return res.json(updated);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

// ─── ATTENDANCE LINES ─────────────────────────────────────────────────────────

router.get("/btp/periods/:id/attendance", async (req, res) => {
  try {
    const oid = orgId(req);
    const periodId = req.params.id as string;

    const [period] = await db.select().from(btpPayPeriodsTable)
      .where(and(eq(btpPayPeriodsTable.id, periodId), eq(btpPayPeriodsTable.organizationId, oid))).limit(1);
    if (!period) return res.status(404).json({ error: "Période introuvable" });

    // Liste des collaborateurs actifs de l'org
    const collabs = await db.select({
      id: collaboratorsTable.id,
      firstName: collaboratorsTable.firstName,
      lastName: collaboratorsTable.lastName,
      employeeNumber: collaboratorsTable.employeeNumber,
      departmentId: collaboratorsTable.departmentId,
      positionId: collaboratorsTable.positionId,
      baseSalary: collaboratorsTable.baseSalary,
    }).from(collaboratorsTable)
      .where(and(
        eq(collaboratorsTable.organizationId, oid),
        eq(collaboratorsTable.employmentStatus, "active"),
      ));

    const lines = await db.select().from(btpAttendanceLinesTable)
      .where(and(
        eq(btpAttendanceLinesTable.payPeriodId, periodId),
        eq(btpAttendanceLinesTable.organizationId, oid),
      )).orderBy(asc(btpAttendanceLinesTable.collaboratorId), asc(btpAttendanceLinesTable.recordDate));

    return res.json({ period, collaborators: collabs, lines });
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

// Sauvegarder les lignes de pointage en lot (upsert)
router.put("/btp/periods/:id/attendance", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    const periodId = req.params.id as string;
    const [period] = await db.select({ status: btpPayPeriodsTable.status })
      .from(btpPayPeriodsTable)
      .where(and(eq(btpPayPeriodsTable.id, periodId), eq(btpPayPeriodsTable.organizationId, oid))).limit(1);
    if (!period) return res.status(404).json({ error: "Période introuvable" });
    if (period.status === "locked") return res.status(403).json({ error: "Période verrouillée" });

    const { lines } = req.body ?? {};
    if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ error: "lines[] requis" });

    const toUpsert = lines.map((l: any) => ({
      organizationId: oid,
      payPeriodId: periodId,
      collaboratorId: l.collaboratorId,
      recordDate: l.recordDate,
      status: l.status ?? "present",
      hoursWorked: String(l.hoursWorked ?? 0),
      overtimeHours: String(l.overtimeHours ?? 0),
      overtime100Hours: String(l.overtime100Hours ?? 0),
      notes: l.notes,
    }));

    await db.insert(btpAttendanceLinesTable).values(toUpsert)
      .onConflictDoUpdate({
        target: [btpAttendanceLinesTable.payPeriodId, btpAttendanceLinesTable.collaboratorId, btpAttendanceLinesTable.recordDate],
        set: {
          status: sql`excluded.status`,
          hoursWorked: sql`excluded.hours_worked`,
          overtimeHours: sql`excluded.overtime_hours`,
          overtime100Hours: sql`excluded.overtime_100_hours`,
          notes: sql`excluded.notes`,
        },
      });

    return res.json({ ok: true, count: toUpsert.length });
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

// ─── PREFILL FROM KIOSK ────────────────────────────────────────────────────────
/**
 * POST /api/btp/periods/:id/prefill-from-kiosk
 * Lit les sessions de pointage Kiosk (attendance_sessions) sur la période
 * et pré-remplit btp_attendance_lines sans écraser les lignes déjà saisies.
 * Logique :
 *  - session.status = "closed" + effectiveMinutes > 0  → P, heures = effectiveMinutes / 60
 *  - session.status = "abandoned" ou effectiveMinutes = 0 → A (absent)
 *  - Aucune session ce jour → inchangé (on n'écrase pas)
 */
router.post("/btp/periods/:id/prefill-from-kiosk", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    const periodId = req.params.id as string;

    const [period] = await db.select().from(btpPayPeriodsTable)
      .where(and(eq(btpPayPeriodsTable.id, periodId), eq(btpPayPeriodsTable.organizationId, oid))).limit(1);
    if (!period) return res.status(404).json({ error: "Période introuvable" });
    if (period.status === "locked") return res.status(403).json({ error: "Période verrouillée" });

    // Sessions Kiosk sur la plage de dates de la période
    const sessions = await db.select({
      collaboratorId: attendanceSessionsTable.collaboratorId,
      workDate: attendanceSessionsTable.workDate,
      status: attendanceSessionsTable.status,
      effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
    }).from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.organizationId, oid),
        gte(attendanceSessionsTable.workDate, period.startDate),
        lte(attendanceSessionsTable.workDate, period.endDate),
      ));

    if (sessions.length === 0) {
      return res.json({ prefilled: 0, message: "Aucun badgeage Kiosk trouvé sur cette période" });
    }

    // Lignes déjà saisies manuellement (on ne les écrasera pas)
    const existingLines = await db.select({
      collaboratorId: btpAttendanceLinesTable.collaboratorId,
      recordDate: btpAttendanceLinesTable.recordDate,
    }).from(btpAttendanceLinesTable)
      .where(and(
        eq(btpAttendanceLinesTable.payPeriodId, periodId),
        eq(btpAttendanceLinesTable.organizationId, oid),
      ));

    const existingSet = new Set(existingLines.map((l) => `${l.collaboratorId}:${l.recordDate}`));

    // Construire les nouvelles lignes uniquement pour les jours sans saisie
    const toInsert = sessions
      .filter((s) => !existingSet.has(`${s.collaboratorId}:${s.workDate}`))
      .map((s) => {
        const closed = s.status === "closed" && (s.effectiveMinutes ?? 0) > 0;
        const hoursWorked = closed ? Math.round(((s.effectiveMinutes ?? 0) / 60) * 100) / 100 : 0;
        return {
          organizationId: oid,
          payPeriodId: periodId,
          collaboratorId: s.collaboratorId,
          recordDate: s.workDate,
          status: closed ? "present" : "absent",
          hoursWorked: String(hoursWorked),
          overtimeHours: "0",
          overtime100Hours: "0",
          notes: "Import Kiosk",
        };
      });

    if (toInsert.length > 0) {
      await db.insert(btpAttendanceLinesTable).values(toInsert);
    }

    return res.json({
      prefilled: toInsert.length,
      skipped: sessions.length - toInsert.length,
      message: `${toInsert.length} ligne(s) importées depuis le Kiosk (${sessions.length - toInsert.length} déjà saisies, inchangées)`,
    });
  } catch (e) {
    return res.status(500).json({ error: "Erreur import Kiosk" });
  }
});

// ─── CALCULATE ────────────────────────────────────────────────────────────────

router.post("/btp/periods/:id/calculate", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    const periodId = req.params.id as string;

    const [period] = await db.select().from(btpPayPeriodsTable)
      .where(and(eq(btpPayPeriodsTable.id, periodId), eq(btpPayPeriodsTable.organizationId, oid))).limit(1);
    if (!period) return res.status(404).json({ error: "Période introuvable" });

    const [settings] = await db.select().from(btpPayrollSettingsTable)
      .where(eq(btpPayrollSettingsTable.organizationId, oid)).limit(1);
    if (!settings) return res.status(400).json({ error: "Paramètres de paie non configurés" });

    const holidays = await getHolidayDates(oid, new Date(period.startDate).getFullYear());

    // Lignes de pointage de la période
    const lines = await db.select().from(btpAttendanceLinesTable)
      .where(and(eq(btpAttendanceLinesTable.payPeriodId, periodId), eq(btpAttendanceLinesTable.organizationId, oid)));

    // Regrouper par collaborateur
    const byCollab = new Map<string, typeof lines>();
    for (const l of lines) {
      if (!byCollab.has(l.collaboratorId)) byCollab.set(l.collaboratorId, []);
      byCollab.get(l.collaboratorId)!.push(l);
    }

    // Contrats actifs
    const collabIds = [...byCollab.keys()];
    if (collabIds.length === 0) return res.json({ calculated: 0 });

    const collabs = await db.select({
      id: collaboratorsTable.id,
      firstName: collaboratorsTable.firstName,
      lastName: collaboratorsTable.lastName,
      baseSalary: collaboratorsTable.baseSalary,
    }).from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.organizationId, oid), inArray(collaboratorsTable.id, collabIds)));

    const contracts = await db.select().from(contractsTable)
      .where(and(
        eq(contractsTable.organizationId, oid),
        eq(contractsTable.status, "active"),
        inArray(contractsTable.collaboratorId, collabIds),
      ));
    const contractByCollab = new Map<string, typeof contracts[0]>();
    for (const c of contracts) contractByCollab.set(c.collaboratorId, c);

    const totalWorkingDays = period.totalWorkingDays ?? 26;
    const rates = {
      hs20: parseFloat(settings.hs20Rate),
      hs40: parseFloat(settings.hs40Rate),
      hsSunday: parseFloat(settings.hsSundayRate),
      hs100: parseFloat(settings.hsSundayNightRate),
      cnssEmployee: parseFloat(settings.cnssEmployeeRate),
      cnssEmployer: parseFloat(settings.cnssEmployerRate),
      irppAbatement: parseFloat(settings.irppAbatementRate),
      chargePerDep: parseFloat(settings.irppChargePerDependent),
      maxDep: settings.irppMaxDependents,
      divisor: parseFloat(settings.hourlyRateDivisor),
      leaveAccrual: parseFloat(settings.leaveAccrualDaysPerMonth),
    };

    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    const weeks = getWeeksInPeriod(startDate, endDate);

    const results: any[] = [];

    for (const collab of collabs) {
      const collabLines = byCollab.get(collab.id) ?? [];
      const contract = contractByCollab.get(collab.id);

      // Comptage jours
      let daysPresent = 0, daysHoliday = 0, daysSick = 0, daysAbsent = 0, daysLeave = 0;
      for (const l of collabLines) {
        const d = new Date(l.recordDate);
        if (d < startDate || d > endDate) continue;
        switch (l.status) {
          case "present": daysPresent++; break;
          case "holiday": daysHoliday++; break;
          case "sick": daysSick++; break;
          case "absent": daysAbsent++; break;
          case "leave": daysLeave++; break;
        }
      }
      const daysTotalValorized = daysPresent + daysHoliday + daysSick;

      // Report mois précédent (BN) — passé dans req.body par collaborateur si besoin
      const carryoverMap: Record<string, number> = req.body?.carryoverHours ?? {};
      const carryover = parseFloat(carryoverMap[collab.id] ?? "0") || 0;

      // Calcul hebdomadaire
      let hoursNormalTotal = 0, hoursHs20Total = 0, hoursHs40Total = 0;
      let hoursHsSundayTotal = 0, hoursHs100Total = 0;
      const weeklyBreakdown: any[] = [];

      for (let wi = 0; wi < weeks.length; wi++) {
        const { weekStart, weekEnd } = weeks[wi];
        const weekLines = collabLines.filter((l) => {
          const d = new Date(l.recordDate);
          return d >= weekStart && d <= weekEnd;
        });
        const carry = wi === 0 ? carryover : 0;
        const wk = computeWeekHours(
          weekLines.map((l) => ({
            recordDate: l.recordDate,
            status: l.status,
            hoursWorked: l.hoursWorked,
            overtimeHours: l.overtimeHours,
            overtime100Hours: l.overtime100Hours,
          })),
          carry,
          holidays,
          rates,
        );
        hoursNormalTotal += wk.hoursNormal;
        hoursHs20Total += wk.hoursHs20;
        hoursHs40Total += wk.hoursHs40;
        hoursHsSundayTotal += wk.hoursHsSunday;
        hoursHs100Total += wk.hoursHs100;
        weeklyBreakdown.push({ week: wi + 1, weekStart: weekStart.toISOString().slice(0, 10), weekEnd: weekEnd.toISOString().slice(0, 10), ...wk });
      }

      // Salaire de base depuis contrat ou collab
      const baseSalary = parseFloat(String(contract?.monthlySalary ?? collab.baseSalary ?? 0));
      const sursalaire = 0; // Sursalaire saisi manuellement dans le rapport
      const hourlyRate = (baseSalary + sursalaire) / rates.divisor;

      // Proratisation
      const baseSalaryProrated = totalWorkingDays > 0
        ? (baseSalary / totalWorkingDays) * daysTotalValorized
        : baseSalary;
      const sursalaireProrated = 0;

      // Montants HS
      const amountHs20 = hourlyRate * rates.hs20 * hoursHs20Total;
      const amountHs40 = hourlyRate * rates.hs40 * hoursHs40Total;
      const amountHsSunday = hourlyRate * rates.hsSunday * hoursHsSundayTotal;
      const amountHs100 = hourlyRate * rates.hs100 * hoursHs100Total;

      // Brut
      const grossSalary = baseSalaryProrated + sursalaireProrated + amountHs20 + amountHs40 + amountHsSunday + amountHs100;

      // CNSS salarié
      const cnssEmployee = grossSalary * rates.cnssEmployee;

      // IRPP
      const afterCnss = grossSalary - cnssEmployee;
      const abatement = afterCnss * rates.irppAbatement;
      const dependentsDeduct = Math.min(collab.id ? 0 : 0, rates.maxDep) * rates.chargePerDep; // dependents depuis report si fourni
      const irppBase = afterCnss - abatement - dependentsDeduct;
      const irppAmount = computeIrpp(irppBase);
      const totalDeductions = cnssEmployee + irppAmount;
      const netSalary = grossSalary - totalDeductions;

      // Charges employeur
      const cnssEmployer = grossSalary * rates.cnssEmployer;
      const leaveProvision = (grossSalary + cnssEmployer) / 30 * rates.leaveAccrual;
      const totalEmployerCost = grossSalary + cnssEmployer + leaveProvision;

      // Arrondi final au 100 FCFA supérieur
      const netFinal = Math.ceil(netSalary / 100) * 100;

      const reportValues = {
        organizationId: oid,
        payPeriodId: periodId,
        collaboratorId: collab.id,
        employmentType: "variable",
        daysPresent,
        daysHoliday,
        daysSick,
        daysAbsent,
        daysLeave,
        daysTotalValorized,
        hoursNormal: String(hoursNormalTotal.toFixed(2)),
        hoursHs20: String(hoursHs20Total.toFixed(2)),
        hoursHs40: String(hoursHs40Total.toFixed(2)),
        hoursHsSunday: String(hoursHsSundayTotal.toFixed(2)),
        hoursHs100: String(hoursHs100Total.toFixed(2)),
        prevMonthCarryoverHours: String(carryover),
        baseSalary: String(baseSalary.toFixed(2)),
        sursalaire: "0",
        hourlyRate: String(hourlyRate.toFixed(4)),
        baseSalaryProrated: String(baseSalaryProrated.toFixed(2)),
        sursalaireProrated: "0",
        amountHs20: String(amountHs20.toFixed(2)),
        amountHs40: String(amountHs40.toFixed(2)),
        amountHsSunday: String(amountHsSunday.toFixed(2)),
        amountHs100: String(amountHs100.toFixed(2)),
        amountForfait: "0",
        forfaitHourlyRate: "0",
        grossSalary: String(grossSalary.toFixed(2)),
        cnssEmployee: String(cnssEmployee.toFixed(2)),
        irppBase: String(Math.floor(irppBase / 1000) * 1000),
        irppAmount: String(irppAmount.toFixed(2)),
        totalDeductions: String(totalDeductions.toFixed(2)),
        netSalary: String(netSalary.toFixed(2)),
        cnssEmployer: String(cnssEmployer.toFixed(2)),
        leaveProvision: String(leaveProvision.toFixed(2)),
        totalEmployerCost: String(totalEmployerCost.toFixed(2)),
        netFinal: String(netFinal.toFixed(2)),
        ratesSnapshot: rates as any,
        weeklyBreakdown: weeklyBreakdown as any,
        status: "draft",
      };

      await db.insert(btpPeriodReportsTable).values(reportValues)
        .onConflictDoUpdate({
          target: [btpPeriodReportsTable.payPeriodId, btpPeriodReportsTable.collaboratorId],
          set: { ...reportValues, updatedAt: new Date() } as any,
        });

      results.push({ collaboratorId: collab.id, grossSalary: grossSalary.toFixed(2), netFinal });
    }

    return res.json({ calculated: results.length, results });
  } catch (e) { req.log?.error({ err: e }, "BTP calculate error"); return res.status(500).json({ error: "Erreur de calcul" }); }
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────

router.get("/btp/periods/:id/reports", async (req, res) => {
  try {
    const oid = orgId(req);
    const periodId = req.params.id as string;
    const reports = await db.select({
      report: btpPeriodReportsTable,
      firstName: collaboratorsTable.firstName,
      lastName: collaboratorsTable.lastName,
      employeeNumber: collaboratorsTable.employeeNumber,
    }).from(btpPeriodReportsTable)
      .innerJoin(collaboratorsTable, eq(collaboratorsTable.id, btpPeriodReportsTable.collaboratorId))
      .where(and(
        eq(btpPeriodReportsTable.payPeriodId, periodId),
        eq(btpPeriodReportsTable.organizationId, oid),
      )).orderBy(asc(collaboratorsTable.lastName));
    return res.json(reports);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

// Ajustement manuel d'un rapport (primes, avances, etc.)
router.patch("/btp/periods/:id/reports/:collaboratorId", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const oid = orgId(req);
    const { id: periodId, collaboratorId } = req.params;
    const allowed = [
      "primeResponsabilite", "primeSalissure", "indemTransport", "indemFinContrat",
      "bonusDimanchesCount", "bonusDimanchesUnit", "vaccinationFees", "medicalFees",
      "advanceSalary", "sursalaire", "forfaitHourlyRate", "hoursForfait",
      "dependentsCount", "prevMonthCarryoverHours", "status",
    ];
    const patch: any = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = typeof req.body[k] === "number" ? String(req.body[k]) : req.body[k];
    }

    const [existing] = await db.select({ id: btpPeriodReportsTable.id })
      .from(btpPeriodReportsTable)
      .where(and(
        eq(btpPeriodReportsTable.payPeriodId, periodId as string),
        eq(btpPeriodReportsTable.collaboratorId, collaboratorId as string),
        eq(btpPeriodReportsTable.organizationId, oid),
      )).limit(1);
    if (!existing) return res.status(404).json({ error: "Rapport introuvable" });

    const [updated] = await db.update(btpPeriodReportsTable).set(patch)
      .where(eq(btpPeriodReportsTable.id, existing.id)).returning();

    // Recalcul partiel si primes touchées
    return res.json(updated);
  } catch (e) { return res.status(500).json({ error: "Erreur serveur" }); }
});

// ─── EXPORT EXCEL ─────────────────────────────────────────────────────────────

async function buildPointageExcel(
  oid: string, periodId: string,
): Promise<ExcelJS.Workbook | null> {
  const [period] = await db.select().from(btpPayPeriodsTable)
    .where(and(eq(btpPayPeriodsTable.id, periodId), eq(btpPayPeriodsTable.organizationId, oid))).limit(1);
  if (!period) return null;

  const [org] = await db.select({ name: organizationsTable.name })
    .from(organizationsTable).where(eq(organizationsTable.id, oid)).limit(1);

  const collabs = await db.select({
    id: collaboratorsTable.id,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    employeeNumber: collaboratorsTable.employeeNumber,
  }).from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, oid), eq(collaboratorsTable.employmentStatus, "active")));

  const lines = await db.select().from(btpAttendanceLinesTable)
    .where(and(eq(btpAttendanceLinesTable.payPeriodId, periodId), eq(btpAttendanceLinesTable.organizationId, oid)));

  const holidays = await getHolidayDates(oid, new Date(period.startDate).getFullYear());

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gameasu ERP";
  wb.created = new Date();

  const ws = wb.addWorksheet("POINTAGE", { views: [{ state: "frozen", xSplit: 4, ySplit: 4 }] });

  // ── Couleurs et styles ────────────────────────────────────────────────
  const ORANGE = "FFF37021";
  const DARK = "FF0D1B2A";
  const GREY_HEADER = "FFD9D9D9";
  const LIGHT_BLUE = "FFD6E4F0";
  const SUNDAY_COLOR = "FFFCE4D6";
  const HOLIDAY_COLOR = "FFFFD700";
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  // ── Génération des dates ───────────────────────────────────────────────
  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const dates: Date[] = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  // ── Ligne 1 : titre ───────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, 4 + dates.length * 2 + 5);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `FICHE DE POINTAGE — ${org?.name ?? ""} — Période : ${period.label} (${period.startDate} → ${period.endDate})`;
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // ── Ligne 2 : en-têtes fixes ──────────────────────────────────────────
  const fixedHeaders = ["N°", "Nom & Prénoms", "Badge", "Poste"];
  for (let i = 0; i < fixedHeaders.length; i++) {
    const cell = ws.getCell(2, i + 1);
    cell.value = fixedHeaders[i];
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
  }
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 14;

  // ── En-têtes dates (paires statut/HS) ─────────────────────────────────
  const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  let col = 5;
  for (const date of dates) {
    const dow = date.getDay();
    const isSun = dow === 0;
    const isHol = isHoliday(date, holidays);
    const dayLabel = `${DOW[dow === 0 ? 6 : dow - 1]} ${date.getDate()}`;
    const bgColor = (isSun || isHol) ? HOLIDAY_COLOR : LIGHT_BLUE;

    // Colonne statut
    const c1 = ws.getCell(2, col);
    c1.value = dayLabel;
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    c1.font = { bold: true, size: 8, color: { argb: DARK } };
    c1.alignment = { horizontal: "center", vertical: "middle", textRotation: 90 };
    c1.border = border;
    ws.getColumn(col).width = 5;

    // Colonne HS
    const c2 = ws.getCell(2, col + 1);
    c2.value = "HS";
    c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEEE" } };
    c2.font = { size: 7, color: { argb: "FF666666" } };
    c2.alignment = { horizontal: "center", vertical: "middle", textRotation: 90 };
    c2.border = border;
    ws.getColumn(col + 1).width = 4;
    col += 2;
  }

  // Colonnes totaux
  const totHeaders = ["Jours P", "J.Fér.", "Abs", "Congé", "Total H.Norm.", "HS 20%", "HS 40%", "HS Dim/Fér.", "Net FCFA"];
  for (const h of totHeaders) {
    const c = ws.getCell(2, col);
    c.value = h;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    c.font = headerFont;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border;
    ws.getColumn(col).width = 9;
    col++;
  }
  ws.getRow(2).height = 60;

  // ── Lignes agents ──────────────────────────────────────────────────────
  const lineByCollabDate = new Map<string, typeof lines[0]>();
  for (const l of lines) lineByCollabDate.set(`${l.collaboratorId}:${l.recordDate}`, l);

  const reports = await db.select().from(btpPeriodReportsTable)
    .where(and(eq(btpPeriodReportsTable.payPeriodId, periodId), eq(btpPeriodReportsTable.organizationId, oid)));
  const reportByCollab = new Map(reports.map((r) => [r.collaboratorId, r]));

  let rowNum = 3;
  let agentNum = 1;
  for (const c of collabs) {
    const row = ws.getRow(rowNum);
    row.getCell(1).value = agentNum++;
    row.getCell(2).value = `${c.lastName} ${c.firstName}`;
    row.getCell(3).value = c.employeeNumber ?? "";
    row.getCell(4).value = "";

    // Appliquer style cellules fixes
    for (let ci = 1; ci <= 4; ci++) {
      row.getCell(ci).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      row.getCell(ci).border = border;
      row.getCell(ci).font = { size: 9 };
    }

    let dc = 5;
    for (const date of dates) {
      const key = `${c.id}:${date.toISOString().slice(0, 10)}`;
      const line = lineByCollabDate.get(key);
      const isSun = date.getDay() === 0;
      const isHol = isHoliday(date, holidays);
      const isWeekend = isSun || isHol;

      // Statut cell
      const sc = row.getCell(dc);
      if (line) {
        switch (line.status) {
          case "present": sc.value = parseFloat(line.hoursWorked); break;
          case "holiday": sc.value = "H"; break;
          case "sick": sc.value = "M"; break;
          case "absent": sc.value = "A"; break;
          case "leave": sc.value = "C"; break;
        }
      } else if (isWeekend) {
        sc.value = "H";
      }
      sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isWeekend ? SUNDAY_COLOR : "FFFFFFFF" } };
      sc.alignment = { horizontal: "center", vertical: "middle" };
      sc.font = { size: 9 };
      sc.border = border;

      // HS cell
      const hc = row.getCell(dc + 1);
      if (line && parseFloat(line.overtimeHours) > 0) hc.value = parseFloat(line.overtimeHours);
      hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEEE" } };
      hc.alignment = { horizontal: "center" };
      hc.font = { size: 8, color: { argb: "FF888888" } };
      hc.border = border;
      dc += 2;
    }

    // Totaux depuis report
    const rep = reportByCollab.get(c.id);
    const totals = [
      rep?.daysPresent ?? "",
      rep?.daysHoliday ?? "",
      rep?.daysAbsent ?? "",
      rep?.daysLeave ?? "",
      rep ? parseFloat(rep.hoursNormal) : "",
      rep ? parseFloat(rep.hoursHs20) : "",
      rep ? parseFloat(rep.hoursHs40) : "",
      rep ? parseFloat(rep.hoursHsSunday) : "",
      rep ? Math.ceil(parseFloat(rep.netFinal)) : "",
    ];
    for (let ti = 0; ti < totals.length; ti++) {
      const tc = row.getCell(dc + ti);
      tc.value = totals[ti];
      tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ti === totals.length - 1 ? "FFE2EFDA" : "FFF9F9F9" } };
      tc.border = border;
      tc.alignment = { horizontal: "center" };
      tc.font = { size: 9, bold: ti === totals.length - 1 };
      if (ti === totals.length - 1 && totals[ti]) {
        tc.numFmt = '#,##0" FCFA"';
      }
    }

    row.height = 18;
    rowNum++;
  }

  // ── Ligne totaux globaux ──────────────────────────────────────────────
  const sumRow = ws.getRow(rowNum);
  sumRow.getCell(2).value = "TOTAUX";
  sumRow.getCell(2).font = { bold: true, size: 10 };
  sumRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY_HEADER } };
  for (let i = 1; i <= col - 1; i++) {
    sumRow.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY_HEADER } };
    sumRow.getCell(i).border = border;
  }
  // Somme colonne Net FCFA
  if (rowNum > 3) {
    const netCol = col - 1;
    sumRow.getCell(netCol).value = { formula: `SUM(${ws.getColumn(netCol).letter}3:${ws.getColumn(netCol).letter}${rowNum - 1})` };
    sumRow.getCell(netCol).numFmt = '#,##0" FCFA"';
    sumRow.getCell(netCol).font = { bold: true, size: 10 };
  }
  sumRow.height = 20;

  return wb;
}

async function buildSalairesExcel(oid: string, periodId: string): Promise<ExcelJS.Workbook | null> {
  const [period] = await db.select().from(btpPayPeriodsTable)
    .where(and(eq(btpPayPeriodsTable.id, periodId), eq(btpPayPeriodsTable.organizationId, oid))).limit(1);
  if (!period) return null;

  const [org] = await db.select({ name: organizationsTable.name })
    .from(organizationsTable).where(eq(organizationsTable.id, oid)).limit(1);

  const reports = await db.select({
    report: btpPeriodReportsTable,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    employeeNumber: collaboratorsTable.employeeNumber,
  }).from(btpPeriodReportsTable)
    .innerJoin(collaboratorsTable, eq(collaboratorsTable.id, btpPeriodReportsTable.collaboratorId))
    .where(and(eq(btpPeriodReportsTable.payPeriodId, periodId), eq(btpPeriodReportsTable.organizationId, oid)))
    .orderBy(asc(collaboratorsTable.lastName));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gameasu ERP";
  wb.created = new Date();
  const ws = wb.addWorksheet("SALAIRES");

  const ORANGE = "FFF37021";
  const DARK = "FF0D1B2A";
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
  const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  // Titre
  const nbCols = 25;
  ws.mergeCells(1, 1, 1, nbCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `ÉTATS DE SALAIRES — ${org?.name ?? ""} — ${period.label}`;
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  const headers = [
    "N°", "Nom & Prénoms", "Badge",
    "Jours Val.", "H.Norm.",
    "Sal.Base", "Sal.Base Prorat.",
    "TH", "HS20%nb", "HS20%mnt", "HS40%nb", "HS40%mnt", "HSDim%nb", "HSDim%mnt",
    "Brut", "CNSS 9%", "IRPP",
    "Total Ret.", "Net",
    "CNSS Empl.", "Prov.Congés", "Coût Empl.",
    "Avances", "Net Final",
    "Statut",
  ];
  for (let i = 0; i < headers.length; i++) {
    const c = ws.getCell(2, i + 1);
    c.value = headers[i];
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    c.font = headerFont;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border;
  }
  ws.getRow(2).height = 50;

  const widths = [5, 22, 10, 8, 8, 12, 12, 10, 8, 12, 8, 12, 8, 12, 14, 12, 10, 10, 14, 12, 12, 14, 10, 14, 10];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const fcfa = '#,##0" FCFA"';

  let rowNum = 3;
  let num = 1;
  let totalBrut = 0, totalNet = 0, totalCnssEmpl = 0, totalNetFinal = 0;

  for (const { report: r, firstName, lastName, employeeNumber } of reports) {
    const row = ws.getRow(rowNum);
    const isEven = rowNum % 2 === 0;
    const rowBg = isEven ? "FFF7F7F7" : "FFFFFFFF";

    const vals = [
      num++,
      `${lastName} ${firstName}`,
      employeeNumber ?? "",
      r.daysTotalValorized,
      parseFloat(r.hoursNormal),
      parseFloat(r.baseSalary),
      parseFloat(r.baseSalaryProrated),
      parseFloat(r.hourlyRate),
      parseFloat(r.hoursHs20),
      parseFloat(r.amountHs20),
      parseFloat(r.hoursHs40),
      parseFloat(r.amountHs40),
      parseFloat(r.hoursHsSunday),
      parseFloat(r.amountHsSunday),
      parseFloat(r.grossSalary),
      parseFloat(r.cnssEmployee),
      parseFloat(r.irppAmount),
      parseFloat(r.totalDeductions),
      parseFloat(r.netSalary),
      parseFloat(r.cnssEmployer),
      parseFloat(r.leaveProvision),
      parseFloat(r.totalEmployerCost),
      parseFloat(r.advanceSalary),
      parseFloat(r.netFinal),
      r.status === "validated" ? "Validé" : "Brouillon",
    ];

    const fcfaCols = new Set([6, 7, 10, 12, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24]);

    for (let i = 0; i < vals.length; i++) {
      const c = row.getCell(i + 1);
      c.value = vals[i];
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      c.border = border;
      c.font = { size: 9 };
      c.alignment = { horizontal: typeof vals[i] === "number" ? "right" : "center", vertical: "middle" };
      if (fcfaCols.has(i + 1) && typeof vals[i] === "number") c.numFmt = fcfa;
    }

    totalBrut += parseFloat(r.grossSalary);
    totalNet += parseFloat(r.netSalary);
    totalCnssEmpl += parseFloat(r.cnssEmployer);
    totalNetFinal += parseFloat(r.netFinal);
    row.height = 18;
    rowNum++;
  }

  // Totaux
  const sumRow = ws.getRow(rowNum);
  sumRow.getCell(2).value = "TOTAUX";
  sumRow.getCell(2).font = { bold: true };
  const totalVals: Record<number, number> = {
    15: totalBrut, 19: totalNet, 20: totalCnssEmpl, 24: totalNetFinal,
  };
  for (let i = 1; i <= nbCols; i++) {
    const c = sumRow.getCell(i);
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0CC" } };
    c.border = border;
    c.font = { bold: true, size: 9 };
    if (totalVals[i] !== undefined) {
      c.value = totalVals[i];
      c.numFmt = fcfa;
    }
  }
  sumRow.height = 22;

  return wb;
}

router.get("/btp/periods/:id/export/pointage.xlsx", async (req, res) => {
  try {
    const oid = orgId(req);
    const wb = await buildPointageExcel(oid, req.params.id as string);
    if (!wb) return res.status(404).json({ error: "Période introuvable" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="pointage-${req.params.id}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { return res.status(500).json({ error: "Erreur génération Excel" }); }
});

router.get("/btp/periods/:id/export/salaires.xlsx", async (req, res) => {
  try {
    const oid = orgId(req);
    const wb = await buildSalairesExcel(oid, req.params.id as string);
    if (!wb) return res.status(404).json({ error: "Période introuvable" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="salaires-${req.params.id}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { return res.status(500).json({ error: "Erreur génération Excel" }); }
});

export default router;
