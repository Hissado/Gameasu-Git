import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  attendanceSessionsTable, attendanceFlagsTable,
  collaboratorsTable, departmentsTable,
  timesheetEntriesTable, projectsTable,
  attendanceRecordsTable,
  usersTable, notificationsTable,
  organizationsTable,
} from "@workspace/db";
import { and, eq, gte, lte, isNull, inArray, desc, sql } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requirePermission } from "../middlewares/permissions";
import { hasPermission } from "../lib/rbac/permissions";
import { sendEmail } from "../lib/email";
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
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E1A39" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF1D4ED8" } } };
  });
  row.height = 22;
}

function addMeta(ws: ExcelJS.Worksheet, title: string, period: string) {
  ws.addRow([title]).font = { bold: true, size: 14, color: { argb: "FF0E1A39" } };
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
      wb.creator = "Gameasu"; wb.created = new Date();
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
    doc.fillColor("#0E1A39").fontSize(16).font("Helvetica-Bold").text("Gameasu — Rapport de présences", { align: "center" });
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
    doc.rect(x, y, pageW, headerH).fill("#0E1A39");
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

    doc.moveDown(1).fillColor("#999999").fontSize(7).text(`Généré le ${new Date().toLocaleDateString("fr-FR")} — Gameasu`, { align: "right" });
    doc.end();
  } catch (e) { next(e); }
});

// ── 7. Registre plat des pointages individuels (avec filtre Méthode/source) ──

router.get("/attendance/reports/records", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const sourceFilter = req.query["source"] as string | undefined;
    const collaboratorId = req.query["collaboratorId"] as string | undefined;
    const departmentId = req.query["departmentId"] as string | undefined;
    const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "100"), 10)));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(attendanceRecordsTable.organizationId, orgId),
      gte(attendanceRecordsTable.occurredAt, new Date(from + "T00:00:00.000Z")),
      lte(attendanceRecordsTable.occurredAt, new Date(to + "T23:59:59.999Z")),
    ];
    if (sourceFilter) conditions.push(eq(attendanceRecordsTable.source, sourceFilter as "kiosk" | "qr" | "app" | "manual"));
    if (collaboratorId) conditions.push(eq(attendanceRecordsTable.collaboratorId, collaboratorId));

    // Filtre département via join collaborateur
    let collaboratorIds: string[] | null = null;
    if (departmentId) {
      const dc = await db.select({ id: collaboratorsTable.id })
        .from(collaboratorsTable)
        .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.departmentId, departmentId), isNull(collaboratorsTable.deletedAt)));
      collaboratorIds = dc.map(c => c.id);
      if (collaboratorIds.length === 0) return res.json({ from, to, total: 0, page, limit, data: [] });
      conditions.push(inArray(attendanceRecordsTable.collaboratorId, collaboratorIds));
    }

    const records = await db
      .select({
        id: attendanceRecordsTable.id,
        collaboratorId: attendanceRecordsTable.collaboratorId,
        kind: attendanceRecordsTable.kind,
        source: attendanceRecordsTable.source,
        occurredAt: attendanceRecordsTable.occurredAt,
        status: attendanceRecordsTable.status,
        locationLabel: attendanceRecordsTable.locationLabel,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        deptName: departmentsTable.name,
      })
      .from(attendanceRecordsTable)
      .leftJoin(collaboratorsTable, and(
        eq(collaboratorsTable.id, attendanceRecordsTable.collaboratorId),
        isNull(collaboratorsTable.deletedAt),
      ))
      .leftJoin(departmentsTable, and(
        eq(departmentsTable.id, collaboratorsTable.departmentId),
        eq(departmentsTable.organizationId, orgId),
      ))
      .where(and(...conditions))
      .orderBy(desc(attendanceRecordsTable.occurredAt))
      .limit(limit)
      .offset(offset);

    const data = records.map(r => ({
      id: r.id,
      collaboratorId: r.collaboratorId,
      collaboratorName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.collaboratorId,
      department: r.deptName ?? "—",
      kind: r.kind,
      source: r.source ?? "manual",
      methode: r.source === "qr" ? "QR" : r.source === "kiosk" ? "Kiosque" : r.source === "app" ? "Application" : "Manuel",
      occurredAt: r.occurredAt,
      status: r.status,
      locationLabel: r.locationLabel,
    }));

    // Total réel (toute la période, sans pagination)
    const [countRow] = await db
      .select({ c: sql`count(*)::int` })
      .from(attendanceRecordsTable)
      .leftJoin(collaboratorsTable, and(
        eq(collaboratorsTable.id, attendanceRecordsTable.collaboratorId),
        isNull(collaboratorsTable.deletedAt),
      ))
      .where(and(...conditions));
    const total = Number((countRow as any)?.c ?? data.length);

    res.json({ from, to, total, page, limit, data });
  } catch (e) { next(e); }
});

// ── 8. Send monthly report by email ──────────────────────────────────────────

/**
 * Génère et envoie le rapport mensuel de présence par e-mail à tous les
 * utilisateurs actifs de l'organisation ayant la permission `attendance.view`.
 *
 * Retourne { sent: number, skipped: number, errors: string[] }.
 */
export async function sendMonthlyAttendanceReport(
  orgId: string,
  year: number,
  month: number,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];

  // ── 1. Organisation ──────────────────────────────────────────────────────
  const [org] = await db
    .select({ id: organizationsTable.id, name: organizationsTable.name })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);
  if (!org) return { sent: 0, skipped: 0, errors: ["Organisation introuvable"] };

  // ── 2. Utilisateurs avec attendance.view (permission effective = rôle + surcharges) ──
  // On utilise hasPermission() qui applique exactement la même logique que le middleware
  // auth : permissions du rôle + grants individuels + deny overrides. Cela garantit que
  // - les utilisateurs avec une surcharge deny ne reçoivent PAS le rapport
  // - les utilisateurs avec une surcharge grant (sans rôle éligible) reçoivent le rapport
  const allOrgUsers = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.isActive, true)));

  const users: { id: string; email: string; firstName: string; lastName: string }[] = [];
  for (const u of allOrgUsers) {
    try {
      if (await hasPermission(u.id, "attendance.view")) {
        users.push(u);
      }
    } catch {
      // erreur RBAC pour un utilisateur → on l'ignore silencieusement
    }
  }

  if (users.length === 0) {
    return { sent: 0, skipped: 0, errors: ["Aucun destinataire avec permission attendance.view"] };
  }

  // ── 3. Données du rapport mensuel ────────────────────────────────────────
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  let expectedDays = 0;
  for (
    let d = new Date(from + "T12:00:00Z");
    d <= new Date(to + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) expectedDays++;
  }

  const sessions = await fetchSessions(orgId, from, to, {});
  const collabMap = new Map<
    string,
    { name: string; dept: string; present: number; late: number; early: number; effMins: number; otMins: number }
  >();
  for (const r of sessions) {
    const eff = r.effectiveMinutes ?? 0;
    const exp = r.expectedMinutes ?? 480;
    const e = collabMap.get(r.collaboratorId) ?? {
      name: collabName(r),
      dept: r.deptName ?? "—",
      present: 0,
      late: 0,
      early: 0,
      effMins: 0,
      otMins: 0,
    };
    if (r.status === "closed") e.present++;
    e.effMins += eff;
    e.otMins += Math.max(0, eff - exp);
    if (r.isLate) e.late++;
    if (r.isEarlyLeave) e.early++;
    collabMap.set(r.collaboratorId, e);
  }

  const summary = [...collabMap.values()].map((e) => ({
    ...e,
    absent: expectedDays - e.present,
    rate: expectedDays > 0 ? Math.round((e.present / expectedDays) * 100) : 0,
  }));

  // KPI globaux pour le résumé HTML
  const totalCollabs = summary.length;
  const avgRate =
    totalCollabs > 0
      ? Math.round(summary.reduce((s, e) => s + e.rate, 0) / totalCollabs)
      : 0;
  const totalLate = summary.reduce((s, e) => s + e.late, 0);
  const totalOtMins = summary.reduce((s, e) => s + e.otMins, 0);

  // ── 4. Pièce jointe Excel ─────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gameasu";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Présences ${String(month).padStart(2, "0")}-${year}`);
  addMeta(ws, `Rapport mensuel de présence — ${monthLabel}`, `${String(month).padStart(2, "0")}/${year}`);
  const headers = [
    "Collaborateur", "Département", "J. ouvrés", "Présents",
    "Absents", "Taux (%)", "Heures eff.", "H. sup.", "Retards",
  ];
  ws.columns = headers.map((_, i) => ({ key: String(i), width: i === 0 ? 28 : i === 1 ? 22 : 14 }));
  excelHeader(ws, ws.addRow(headers));
  for (const e of summary) {
    ws.addRow([
      e.name, e.dept, expectedDays, e.present, e.absent,
      `${e.rate}%`, fmtMinutes(e.effMins), fmtMinutes(e.otMins), e.late,
    ]);
  }

  const xlsxBuffer = await wb.xlsx.writeBuffer();
  const xlsxBase64 = Buffer.from(xlsxBuffer).toString("base64");
  const fname = `gameasu-presences-mensuel-${year}-${String(month).padStart(2, "0")}.xlsx`;

  // ── 5. Corps HTML de l'e-mail ─────────────────────────────────────────────
  const tableRows = summary
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map((e) => {
      const rateColor = e.rate >= 90 ? "#16a34a" : e.rate >= 70 ? "#d97706" : "#dc2626";
      return `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:6px 10px;font-size:13px">${e.name}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${e.dept}</td>
        <td style="padding:6px 10px;text-align:center;font-size:13px">${e.present}/${expectedDays}</td>
        <td style="padding:6px 10px;text-align:center;font-size:13px;font-weight:600;color:${rateColor}">${e.rate}%</td>
        <td style="padding:6px 10px;text-align:center;font-size:12px;color:#555">${e.late}</td>
        <td style="padding:6px 10px;text-align:center;font-size:12px;color:#555">${fmtMinutes(e.otMins)}</td>
      </tr>`;
    })
    .join("");

  const buildHtml = (recipientName: string) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f2f4f7;font-family:Inter,-apple-system,Arial,sans-serif;color:#111">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#080E1C 0%,#0C1830 100%);padding:28px">
    <div style="color:#F37021;font-weight:800;letter-spacing:3px;font-size:11px;margin-bottom:8px;text-transform:uppercase">${org.name} — Gameasu</div>
    <div style="color:#fff;font-size:20px;font-weight:700">Rapport mensuel de présence</div>
    <div style="color:#8fa3c0;font-size:13px;margin-top:6px">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</div>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 16px;font-size:14px;color:#444">Bonjour <strong>${recipientName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555">
      Voici le rapport automatique de présence pour <strong>${monthLabel}</strong>.
      Le fichier Excel détaillé est joint à cet e-mail.
    </p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 24px">
      <div style="background:#f8f9fb;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#0E1A39">${avgRate}%</div>
        <div style="font-size:11px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px">Taux moyen</div>
      </div>
      <div style="background:#f8f9fb;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#d97706">${totalLate}</div>
        <div style="font-size:11px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px">Retards</div>
      </div>
      <div style="background:#f8f9fb;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#2563eb">${fmtMinutes(totalOtMins)}</div>
        <div style="font-size:11px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px">H. sup. totales</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-family:Inter,Arial,sans-serif;margin-bottom:20px">
      <thead><tr style="background:#f8f8f8">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Collaborateur</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Département</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Présents</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Taux</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Retards</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">H. sup.</th>
      </tr></thead>
      <tbody>${tableRows || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#aaa">Aucune donnée pour cette période</td></tr>'}</tbody>
    </table>
    <p style="font-size:12px;color:#aaa">Le fichier Excel joint contient le détail complet (${totalCollabs} collaborateur${totalCollabs !== 1 ? "s" : ""}).</p>
  </div>
  <div style="background:#fafafa;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">
    © ${new Date().getFullYear()} ${org.name} — Rapport automatique Gameasu · ${monthLabel}
  </div>
</div></body></html>`;

  const buildText = (recipientName: string) =>
    `Rapport mensuel de présence — ${monthLabel}\n` +
    `Bonjour ${recipientName},\n\n` +
    `Taux moyen de présence : ${avgRate}%\n` +
    `Retards : ${totalLate}\n` +
    `Heures supplémentaires : ${fmtMinutes(totalOtMins)}\n\n` +
    `Collaborateurs : ${totalCollabs}\nPièce jointe : ${fname}\n\n` +
    `Rapport automatique Gameasu — ${org.name}`;

  // ── 6. Envoi et log ────────────────────────────────────────────────────────
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const recipientName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      const result = await sendEmail({
        to: user.email,
        subject: `Rapport de présence ${monthLabel} — ${org.name}`,
        html: buildHtml(recipientName),
        text: buildText(recipientName),
        category: "attendance_report",
        attachments: [{ filename: fname, content: xlsxBase64 }],
      });

      if (result.delivered) {
        sent++;
        // Log notification
        await db.insert(notificationsTable).values({
          organizationId: orgId,
          userId: user.id,
          title: `Rapport de présence ${monthLabel} envoyé`,
          body: `Le rapport mensuel de présence (${totalCollabs} collaborateurs, taux moyen ${avgRate}%) a été envoyé par e-mail.`,
          type: "report_sent",
          entityType: `attendance:monthly:${year}-${String(month).padStart(2, "0")}`,
        });
      } else {
        skipped++;
        errors.push(`${user.email}: ${result.error ?? "échec envoi"}`);
      }
    } catch (e: any) {
      skipped++;
      errors.push(`${user.email}: ${e?.message ?? "erreur inconnue"}`);
    }
  }

  return { sent, skipped, errors };
}

router.post("/attendance/reports/send-monthly", requirePermission("attendance.manage"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const now = new Date();
    const year = parseInt(String(req.body?.year ?? now.getFullYear()), 10);
    const month = parseInt(String(req.body?.month ?? now.getMonth() + 1), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "Paramètres year/month invalides" });
    }

    const result = await sendMonthlyAttendanceReport(orgId, year, month);
    res.json({ ok: true, year, month, ...result });
  } catch (e) {
    next(e);
  }
});

export default router;
