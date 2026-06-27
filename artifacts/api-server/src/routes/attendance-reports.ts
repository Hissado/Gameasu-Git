import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  attendanceSessionsTable, attendanceFlagsTable,
  collaboratorsTable, departmentsTable,
  timesheetEntriesTable, projectsTable,
} from "@workspace/db";
import { and, eq, gte, lte, isNull, inArray } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requirePermission } from "../middlewares/permissions";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseRange(from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = now.toISOString().slice(0, 10);
  return { from: from ?? defaultFrom, to: to ?? defaultTo };
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60), mn = m % 60;
  return `${h}h${mn > 0 ? String(mn).padStart(2, "0") : ""}`;
}

function excelHeader(ws: ExcelJS.Worksheet, row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD04F00" } } };
  });
  row.height = 22;
}

function addMeta(ws: ExcelJS.Worksheet, title: string, period: string) {
  ws.addRow([title]).font = { bold: true, size: 14, color: { argb: "FFF37021" } };
  ws.addRow([`Période : ${period}`]).font = { italic: true, size: 10, color: { argb: "FF555555" } };
  ws.addRow([]);
}

// ── Shared data aggregators ───────────────────────────────────────────────────

type SessionRow = {
  collaboratorId: string;
  effectiveMinutes: number | null;
  expectedMinutes: number | null;
  isLate: boolean | null;
  isEarlyLeave: boolean | null;
  status: string | null;
  workDate: string;
  firstName: string | null;
  lastName: string | null;
  deptName: string | null;
  departmentId: string | null;
};

async function fetchSessions(orgId: string, from: string, to: string, options: {
  collaboratorId?: string; departmentId?: string; status?: string;
}): Promise<SessionRow[]> {
  const conditions = [
    eq(attendanceSessionsTable.organizationId, orgId),
    gte(attendanceSessionsTable.workDate, from),
    lte(attendanceSessionsTable.workDate, to),
  ];
  if (options.collaboratorId) conditions.push(eq(attendanceSessionsTable.collaboratorId, options.collaboratorId));
  if (options.departmentId) conditions.push(eq(attendanceSessionsTable.departmentId, options.departmentId));
  if (options.status) conditions.push(eq(attendanceSessionsTable.status, options.status));

  return db.select({
    collaboratorId: attendanceSessionsTable.collaboratorId,
    effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
    expectedMinutes: attendanceSessionsTable.expectedMinutes,
    isLate: attendanceSessionsTable.isLate,
    isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
    status: attendanceSessionsTable.status,
    workDate: attendanceSessionsTable.workDate,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    deptName: departmentsTable.name,
    departmentId: attendanceSessionsTable.departmentId,
  })
    .from(attendanceSessionsTable)
    .leftJoin(collaboratorsTable, and(
      eq(collaboratorsTable.id, attendanceSessionsTable.collaboratorId),
      isNull(collaboratorsTable.deletedAt),
    ))
    .leftJoin(departmentsTable, and(
      eq(departmentsTable.id, attendanceSessionsTable.departmentId),
      eq(departmentsTable.organizationId, orgId),
    ))
    .where(and(...conditions));
}

function collabName(r: Pick<SessionRow, "firstName" | "lastName" | "collaboratorId">): string {
  return r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.collaboratorId;
}

// ── 1. By collaborator ────────────────────────────────────────────────────────

router.get("/attendance/reports/by-collaborator", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const rows = await fetchSessions(orgId, from, to, {
      collaboratorId: req.query["collaboratorId"] as string | undefined,
      departmentId: req.query["departmentId"] as string | undefined,
      status: req.query["status"] as string | undefined,
    });

    const map = new Map<string, { collaboratorId: string; name: string; department: string; workDays: number; totalMinutes: number; lateDays: number; earlyLeaveDays: number; overtimeDays: number }>();
    for (const r of rows) {
      const eff = r.effectiveMinutes ?? 0;
      const exp = r.expectedMinutes ?? 480;
      const e = map.get(r.collaboratorId) ?? { collaboratorId: r.collaboratorId, name: collabName(r), department: r.deptName ?? "—", workDays: 0, totalMinutes: 0, lateDays: 0, earlyLeaveDays: 0, overtimeDays: 0 };
      e.workDays++; e.totalMinutes += eff;
      if (r.isLate) e.lateDays++;
      if (r.isEarlyLeave) e.earlyLeaveDays++;
      if (eff > exp) e.overtimeDays++;
      map.set(r.collaboratorId, e);
    }
    res.json({ from, to, data: [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr")) });
  } catch (e) { next(e); }
});

// ── 2. By department ──────────────────────────────────────────────────────────

router.get("/attendance/reports/by-department", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const rows = await fetchSessions(orgId, from, to, {
      departmentId: req.query["departmentId"] as string | undefined,
      status: req.query["status"] as string | undefined,
    });

    const map = new Map<string, { deptId: string; deptName: string; workDays: number; totalMinutes: number; lateDays: number }>();
    for (const r of rows) {
      const key = r.departmentId ?? "none";
      const e = map.get(key) ?? { deptId: key, deptName: r.deptName ?? "Sans département", workDays: 0, totalMinutes: 0, lateDays: 0 };
      e.workDays++; e.totalMinutes += r.effectiveMinutes ?? 0;
      if (r.isLate) e.lateDays++;
      map.set(key, e);
    }
    const data = [...map.values()].map(e => ({ ...e, totalHours: Math.round(e.totalMinutes / 6) / 10 }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
    res.json({ from, to, data });
  } catch (e) { next(e); }
});

// ── 3. By project (timesheets) ────────────────────────────────────────────────

router.get("/attendance/reports/by-project", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const collaboratorId = req.query["collaboratorId"] as string | undefined;

    const departmentId = req.query["departmentId"] as string | undefined;
    const conditions = [
      eq(timesheetEntriesTable.organizationId, orgId),
      gte(timesheetEntriesTable.entryDate, from),
      lte(timesheetEntriesTable.entryDate, to),
    ];
    if (collaboratorId) conditions.push(eq(timesheetEntriesTable.collaboratorId, collaboratorId));
    if (departmentId) {
      const dc = await db.select({ id: collaboratorsTable.id }).from(collaboratorsTable)
        .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.departmentId, departmentId), isNull(collaboratorsTable.deletedAt)));
      if (!dc.length) return res.json({ from, to, data: [] });
      conditions.push(inArray(timesheetEntriesTable.collaboratorId, dc.map(c => c.id)));
    }

    const entries = await db.select({
      projectId: timesheetEntriesTable.projectId,
      projectName: projectsTable.name,
      collaboratorId: timesheetEntriesTable.collaboratorId,
      durationMinutes: timesheetEntriesTable.durationMinutes,
      billable: timesheetEntriesTable.billable,
    })
      .from(timesheetEntriesTable)
      .leftJoin(projectsTable, eq(projectsTable.id, timesheetEntriesTable.projectId))
      .where(and(...conditions));

    const map = new Map<string, { projectId: string; projectName: string; totalMinutes: number; billableMinutes: number; collaboratorIds: Set<string> }>();
    for (const e of entries) {
      const key = e.projectId ?? "no-project";
      const entry = map.get(key) ?? { projectId: key, projectName: e.projectName ?? "Sans projet", totalMinutes: 0, billableMinutes: 0, collaboratorIds: new Set() };
      entry.totalMinutes += e.durationMinutes ?? 0;
      if (e.billable) entry.billableMinutes += e.durationMinutes ?? 0;
      entry.collaboratorIds.add(e.collaboratorId);
      map.set(key, entry);
    }
    const data = [...map.values()].map(e => ({
      projectId: e.projectId, projectName: e.projectName,
      totalMinutes: e.totalMinutes, totalHours: Math.round(e.totalMinutes / 6) / 10,
      billableMinutes: e.billableMinutes, billableHours: Math.round(e.billableMinutes / 6) / 10,
      collaboratorCount: e.collaboratorIds.size,
      billableRate: e.totalMinutes > 0 ? Math.round((e.billableMinutes / e.totalMinutes) * 100) : 0,
    })).sort((a, b) => b.totalMinutes - a.totalMinutes);

    res.json({ from, to, data });
  } catch (e) { next(e); }
});

// ── 4. Delays & absences ──────────────────────────────────────────────────────

router.get("/attendance/reports/delays-absences", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const collaboratorId = req.query["collaboratorId"] as string | undefined;
    const departmentId = req.query["departmentId"] as string | undefined;

    const conditions = [
      eq(attendanceFlagsTable.organizationId, orgId),
      gte(attendanceFlagsTable.workDate, from),
      lte(attendanceFlagsTable.workDate, to),
    ];
    if (collaboratorId) conditions.push(eq(attendanceFlagsTable.collaboratorId, collaboratorId));

    const rows = await db.select({
      flagId: attendanceFlagsTable.id,
      flagKind: attendanceFlagsTable.kind,
      flagSeverity: attendanceFlagsTable.severity,
      workDate: attendanceFlagsTable.workDate,
      description: attendanceFlagsTable.description,
      isResolved: attendanceFlagsTable.isResolved,
      collaboratorId: attendanceFlagsTable.collaboratorId,
      firstName: collaboratorsTable.firstName,
      lastName: collaboratorsTable.lastName,
      deptId: collaboratorsTable.departmentId,
      deptName: departmentsTable.name,
    })
      .from(attendanceFlagsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceFlagsTable.collaboratorId))
      .leftJoin(departmentsTable, and(
        eq(departmentsTable.id, collaboratorsTable.departmentId),
        eq(departmentsTable.organizationId, orgId),
      ))
      .where(and(...conditions))
      .orderBy(attendanceFlagsTable.workDate);

    const filtered = departmentId ? rows.filter(r => r.deptId === departmentId) : rows;

    const summaryMap = new Map<string, { name: string; dept: string; late: number; earlyLeave: number; missing: number; other: number }>();
    for (const r of filtered) {
      const key = r.collaboratorId;
      const name = r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : key;
      const e = summaryMap.get(key) ?? { name, dept: r.deptName ?? "—", late: 0, earlyLeave: 0, missing: 0, other: 0 };
      if (r.flagKind === "late") e.late++;
      else if (r.flagKind === "early_leave") e.earlyLeave++;
      else if (r.flagKind === "missing_clock_out" || r.flagKind === "missing_clock_in") e.missing++;
      else e.other++;
      summaryMap.set(key, e);
    }

    res.json({
      from, to,
      detail: filtered.map(r => ({
        id: r.flagId, kind: r.flagKind, severity: r.flagSeverity,
        workDate: r.workDate, description: r.description, isResolved: r.isResolved,
        collaboratorName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.collaboratorId,
        department: r.deptName ?? "—",
      })),
      summary: [...summaryMap.values()].sort((a, b) => (b.late + b.earlyLeave + b.missing) - (a.late + a.earlyLeave + a.missing)),
    });
  } catch (e) { next(e); }
});

// ── 5. Overtime ───────────────────────────────────────────────────────────────

router.get("/attendance/reports/overtime", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const rows = await fetchSessions(orgId, from, to, {
      collaboratorId: req.query["collaboratorId"] as string | undefined,
      departmentId: req.query["departmentId"] as string | undefined,
      status: req.query["status"] as string | undefined,
    });

    const map = new Map<string, { collaboratorId: string; name: string; department: string; workDays: number; totalEffMinutes: number; totalOvertimeMinutes: number; overtimeDays: number }>();
    for (const r of rows) {
      const eff = r.effectiveMinutes ?? 0;
      const exp = r.expectedMinutes ?? 480;
      const ot = Math.max(0, eff - exp);
      const key = r.collaboratorId;
      const e = map.get(key) ?? { collaboratorId: key, name: collabName(r), department: r.deptName ?? "—", workDays: 0, totalEffMinutes: 0, totalOvertimeMinutes: 0, overtimeDays: 0 };
      e.workDays++; e.totalEffMinutes += eff; e.totalOvertimeMinutes += ot;
      if (ot > 0) e.overtimeDays++;
      map.set(key, e);
    }
    const data = [...map.values()].filter(e => e.totalOvertimeMinutes > 0).sort((a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes);
    res.json({ from, to, data });
  } catch (e) { next(e); }
});

// ── 6. Monthly ────────────────────────────────────────────────────────────────

router.get("/attendance/reports/monthly", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const now = new Date();
    const year = parseInt((req.query["year"] as string) ?? String(now.getFullYear()));
    const month = parseInt((req.query["month"] as string) ?? String(now.getMonth() + 1));
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let expectedDays = 0;
    for (let d = new Date(from + "T12:00:00Z"); d <= new Date(to + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay();
      if (dow >= 1 && dow <= 5) expectedDays++;
    }

    const rows = await fetchSessions(orgId, from, to, {
      collaboratorId: req.query["collaboratorId"] as string | undefined,
      departmentId: req.query["departmentId"] as string | undefined,
      status: req.query["status"] as string | undefined,
    });

    const collabMap = new Map<string, { collaboratorId: string; name: string; department: string; presentDays: number; lateDays: number; earlyLeaveDays: number; totalEffMinutes: number; overtimeMinutes: number }>();
    for (const r of rows) {
      const eff = r.effectiveMinutes ?? 0;
      const exp = r.expectedMinutes ?? 480;
      const key = r.collaboratorId;
      const e = collabMap.get(key) ?? { collaboratorId: key, name: collabName(r), department: r.deptName ?? "—", presentDays: 0, lateDays: 0, earlyLeaveDays: 0, totalEffMinutes: 0, overtimeMinutes: 0 };
      if (r.status === "closed") e.presentDays++;
      e.totalEffMinutes += eff;
      if (r.isLate) e.lateDays++;
      if (r.isEarlyLeave) e.earlyLeaveDays++;
      e.overtimeMinutes += Math.max(0, eff - exp);
      collabMap.set(key, e);
    }

    const summary = [...collabMap.values()].map(e => ({
      ...e,
      expectedDays,
      absentDays: expectedDays - e.presentDays,
      attendanceRate: expectedDays > 0 ? Math.round((e.presentDays / expectedDays) * 100) : 0,
      totalHours: Math.round(e.totalEffMinutes / 6) / 10,
      overtimeHours: Math.round(e.overtimeMinutes / 6) / 10,
    })).sort((a, b) => a.name.localeCompare(b.name, "fr"));

    res.json({ year, month, from, to, expectedDays, summary });
  } catch (e) { next(e); }
});

// ── Export (xlsx | pdf) ───────────────────────────────────────────────────────

router.get("/attendance/reports/:reportType/export", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const reportType = req.params["reportType"] as string;
    const VALID_TYPES = new Set(["by-collaborator","by-department","by-project","delays-absences","overtime","monthly"]);
    if (!VALID_TYPES.has(reportType)) return res.status(400).json({ error: `Type de rapport invalide : ${reportType}` });
    const format = (req.query["format"] as string | undefined) ?? "xlsx";
    if (format !== "xlsx" && format !== "pdf") return res.status(400).json({ error: "Format invalide. Utilisez format=xlsx ou format=pdf." });

    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const collaboratorId = req.query["collaboratorId"] as string | undefined;
    const departmentId = req.query["departmentId"] as string | undefined;
    const statusFilter = req.query["status"] as string | undefined;
    const year = parseInt((req.query["year"] as string) ?? String(new Date().getFullYear()));
    const month = parseInt((req.query["month"] as string) ?? String(new Date().getMonth() + 1));
    const period = reportType === "monthly"
      ? `${String(month).padStart(2, "0")}/${year}`
      : `${from} → ${to}`;

    const typeLabel: Record<string, string> = {
      "by-collaborator": "heures-par-collaborateur",
      "by-department": "heures-par-departement",
      "by-project": "heures-par-projet",
      "delays-absences": "retards-absences",
      "overtime": "heures-supplementaires",
      "monthly": "rapport-mensuel",
    };
    const fname = `gameasu-presences-${typeLabel[reportType] ?? reportType}-${from}-${to}.${format}`;

    // ── Collect data ────────────────────────────────────────────────────────

    type Row = string | number;
    type TableData = { headers: string[]; rows: Row[][]; title: string };

    async function buildTableData(): Promise<TableData> {
      if (reportType === "by-collaborator") {
        const sessions = await fetchSessions(orgId!, from, to, { collaboratorId, departmentId, status: statusFilter });
        const map = new Map<string, { name: string; dept: string; days: number; mins: number; late: number; early: number; ot: number }>();
        for (const r of sessions) {
          const eff = r.effectiveMinutes ?? 0;
          const exp = r.expectedMinutes ?? 480;
          const e = map.get(r.collaboratorId) ?? { name: collabName(r), dept: r.deptName ?? "—", days: 0, mins: 0, late: 0, early: 0, ot: 0 };
          e.days++; e.mins += eff;
          if (r.isLate) e.late++;
          if (r.isEarlyLeave) e.early++;
          if (eff > exp) e.ot++;
          map.set(r.collaboratorId, e);
        }
        return {
          title: "Heures travaillées par collaborateur",
          headers: ["Collaborateur", "Département", "Jours", "Heures eff.", "Retards", "Dép. anticipés", "J. h.sup."],
          rows: [...map.values()].map(e => [e.name, e.dept, e.days, fmtMinutes(e.mins), e.late, e.early, e.ot]),
        };
      }

      if (reportType === "by-department") {
        const sessions = await fetchSessions(orgId!, from, to, { departmentId, status: statusFilter });
        const map = new Map<string, { name: string; days: number; mins: number; late: number }>();
        for (const r of sessions) {
          const key = r.departmentId ?? "none";
          const e = map.get(key) ?? { name: r.deptName ?? "—", days: 0, mins: 0, late: 0 };
          e.days++; e.mins += r.effectiveMinutes ?? 0;
          if (r.isLate) e.late++;
          map.set(key, e);
        }
        return {
          title: "Heures par département",
          headers: ["Département", "Jours travaillés", "Heures effectives", "Retards"],
          rows: [...map.values()].map(e => [e.name, e.days, fmtMinutes(e.mins), e.late]),
        };
      }

      if (reportType === "by-project") {
        const conditions = [
          eq(timesheetEntriesTable.organizationId, orgId!),
          gte(timesheetEntriesTable.entryDate, from),
          lte(timesheetEntriesTable.entryDate, to),
        ];
        if (collaboratorId) conditions.push(eq(timesheetEntriesTable.collaboratorId, collaboratorId));
        const entries = await db.select({
          projectId: timesheetEntriesTable.projectId,
          projectName: projectsTable.name,
          collaboratorId: timesheetEntriesTable.collaboratorId,
          durationMinutes: timesheetEntriesTable.durationMinutes,
          billable: timesheetEntriesTable.billable,
        })
          .from(timesheetEntriesTable)
          .leftJoin(projectsTable, eq(projectsTable.id, timesheetEntriesTable.projectId))
          .where(and(...conditions));
        const map = new Map<string, { name: string; mins: number; billMins: number; colSet: Set<string> }>();
        for (const e of entries) {
          const key = e.projectId ?? "none";
          const en = map.get(key) ?? { name: e.projectName ?? "Sans projet", mins: 0, billMins: 0, colSet: new Set() };
          en.mins += e.durationMinutes ?? 0;
          if (e.billable) en.billMins += e.durationMinutes ?? 0;
          en.colSet.add(e.collaboratorId);
          map.set(key, en);
        }
        return {
          title: "Heures par projet (feuilles de temps)",
          headers: ["Projet", "Heures totales", "Heures facturables", "Taux facturable", "Collaborateurs"],
          rows: [...map.values()].map(e => [
            e.name, fmtMinutes(e.mins), fmtMinutes(e.billMins),
            e.mins > 0 ? `${Math.round((e.billMins / e.mins) * 100)}%` : "—",
            e.colSet.size,
          ]),
        };
      }

      if (reportType === "delays-absences") {
        const conditions2 = [
          eq(attendanceFlagsTable.organizationId, orgId!),
          gte(attendanceFlagsTable.workDate, from),
          lte(attendanceFlagsTable.workDate, to),
        ];
        if (collaboratorId) conditions2.push(eq(attendanceFlagsTable.collaboratorId, collaboratorId));
        const flagRows = await db.select({
          kind: attendanceFlagsTable.kind, severity: attendanceFlagsTable.severity,
          workDate: attendanceFlagsTable.workDate, description: attendanceFlagsTable.description,
          isResolved: attendanceFlagsTable.isResolved,
          firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName,
          deptName: departmentsTable.name, deptId: collaboratorsTable.departmentId,
        })
          .from(attendanceFlagsTable)
          .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceFlagsTable.collaboratorId))
          .leftJoin(departmentsTable, and(eq(departmentsTable.id, collaboratorsTable.departmentId), eq(departmentsTable.organizationId, orgId!)))
          .where(and(...conditions2));
        const filtered = departmentId ? flagRows.filter(r => r.deptId === departmentId) : flagRows;
        const kindLabel: Record<string, string> = {
          late: "Retard", early_leave: "Départ anticipé", missing_clock_out: "Oubli départ",
          missing_clock_in: "Oubli arrivée", long_break: "Pause prolongée",
        };
        return {
          title: "Retards et anomalies de présence",
          headers: ["Date", "Collaborateur", "Département", "Type", "Sévérité", "Description", "Résolu"],
          rows: filtered.map(r => [
            r.workDate ?? "—", `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(), r.deptName ?? "—",
            kindLabel[r.kind] ?? r.kind, r.severity ?? "—", r.description ?? "—", r.isResolved ? "Oui" : "Non",
          ]),
        };
      }

      if (reportType === "overtime") {
        const sessions = await fetchSessions(orgId!, from, to, { collaboratorId, departmentId, status: statusFilter });
        const map = new Map<string, { name: string; dept: string; days: number; effMins: number; otMins: number; otDays: number }>();
        for (const r of sessions) {
          const eff = r.effectiveMinutes ?? 0;
          const exp = r.expectedMinutes ?? 480;
          const ot = Math.max(0, eff - exp);
          const e = map.get(r.collaboratorId) ?? { name: collabName(r), dept: r.deptName ?? "—", days: 0, effMins: 0, otMins: 0, otDays: 0 };
          e.days++; e.effMins += eff; e.otMins += ot;
          if (ot > 0) e.otDays++;
          map.set(r.collaboratorId, e);
        }
        return {
          title: "Heures supplémentaires par collaborateur",
          headers: ["Collaborateur", "Département", "Jours travaillés", "Heures eff.", "H.sup. totales", "Jours h.sup."],
          rows: [...map.values()].filter(e => e.otMins > 0).map(e => [e.name, e.dept, e.days, fmtMinutes(e.effMins), fmtMinutes(e.otMins), e.otDays]),
        };
      }

      // monthly
      const mFrom = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay2 = new Date(year, month, 0).getDate();
      const mTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay2).padStart(2, "0")}`;
      let expDays = 0;
      for (let d = new Date(mFrom + "T12:00:00Z"); d <= new Date(mTo + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
        const dow = d.getUTCDay(); if (dow >= 1 && dow <= 5) expDays++;
      }
      const sessions2 = await fetchSessions(orgId!, mFrom, mTo, { collaboratorId, departmentId, status: statusFilter });
      const cm = new Map<string, { name: string; dept: string; present: number; late: number; early: number; effMins: number; otMins: number }>();
      for (const r of sessions2) {
        const eff = r.effectiveMinutes ?? 0;
        const exp = r.expectedMinutes ?? 480;
        const e = cm.get(r.collaboratorId) ?? { name: collabName(r), dept: r.deptName ?? "—", present: 0, late: 0, early: 0, effMins: 0, otMins: 0 };
        if (r.status === "closed") e.present++;
        e.effMins += eff; e.otMins += Math.max(0, eff - exp);
        if (r.isLate) e.late++;
        if (r.isEarlyLeave) e.early++;
        cm.set(r.collaboratorId, e);
      }
      return {
        title: `Rapport mensuel de présence — ${String(month).padStart(2, "0")}/${year}`,
        headers: ["Collaborateur", "Département", "J. ouvrés", "Présents", "Absents", "Taux", "Heures eff.", "H.sup.", "Retards"],
        rows: [...cm.values()].map(e => {
          const absent = expDays - e.present;
          const rate = expDays > 0 ? Math.round((e.present / expDays) * 100) : 0;
          return [e.name, e.dept, expDays, e.present, absent, `${rate}%`, fmtMinutes(e.effMins), fmtMinutes(e.otMins), e.late];
        }),
      };
    }

    const tableData = await buildTableData();

    // ── Render ───────────────────────────────────────────────────────────────

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Gaméasù"; wb.created = new Date();
      const ws = wb.addWorksheet(tableData.title.slice(0, 31));
      addMeta(ws, tableData.title, period);
      ws.columns = tableData.headers.map((h, i) => ({ key: String(i), width: i === 0 ? 28 : i === 1 ? 22 : 16 }));
      const hdr = ws.addRow(tableData.headers);
      excelHeader(ws, hdr);
      for (const row of tableData.rows) ws.addRow(row);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
      await wb.xlsx.write(res);
      res.end();
      return;
    }

    // PDF via pdfkit
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    doc.pipe(res);

    // Title
    doc.fillColor("#F37021").fontSize(16).font("Helvetica-Bold").text("Gaméasù — Rapport de présences", { align: "center" });
    doc.moveDown(0.3);
    doc.fillColor("#333333").fontSize(11).font("Helvetica-Bold").text(tableData.title, { align: "center" });
    doc.fillColor("#666666").fontSize(9).font("Helvetica").text(`Période : ${period}`, { align: "center" });
    doc.moveDown(0.8);

    // Table
    const cols = tableData.headers.length;
    const pageW = doc.page.width - 72; // margins 36*2
    const colW = Math.floor(pageW / cols);
    const rowH = 18;
    const headerH = 22;

    // Header row
    let x = 36, y = doc.y;
    doc.rect(x, y, pageW, headerH).fill("#F37021");
    tableData.headers.forEach((h, i) => {
      doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold")
        .text(h, x + i * colW + 2, y + 5, { width: colW - 4, align: "center", lineBreak: false });
    });
    y += headerH;

    // Data rows
    let rowIdx = 0;
    for (const row of tableData.rows) {
      if (y + rowH > doc.page.height - 36) {
        doc.addPage({ margin: 36, size: "A4", layout: "landscape" });
        y = 36;
      }
      const bgColor = rowIdx % 2 === 0 ? "#FFFFFF" : "#F9F9F9";
      doc.rect(36, y, pageW, rowH).fill(bgColor);
      doc.rect(36, y, pageW, rowH).stroke("#DDDDDD");
      row.forEach((cell, i) => {
        const txt = String(cell ?? "—");
        const align = i === 0 ? "left" : "center";
        doc.fillColor("#333333").fontSize(8).font("Helvetica")
          .text(txt, x + i * colW + 2, y + 5, { width: colW - 4, align, lineBreak: false });
      });
      y += rowH;
      rowIdx++;
    }

    doc.moveDown(1).fillColor("#999999").fontSize(7).text(`Généré le ${new Date().toLocaleDateString("fr-FR")} — Gaméasù`, { align: "right" });
    doc.end();
  } catch (e) { next(e); }
});

export default router;
