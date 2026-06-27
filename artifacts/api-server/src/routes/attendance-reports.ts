import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  attendanceSessionsTable, attendanceFlagsTable,
  collaboratorsTable, departmentsTable,
} from "@workspace/db";
import { and, eq, gte, lte, isNull } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requirePermission } from "../middlewares/permissions";
import ExcelJS from "exceljs";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveOrgId(userId: string): Promise<string | null> {
  return getCurrentOrganizationId(userId);
}

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

function headerStyle(ws: ExcelJS.Worksheet, row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD04F00" } } };
  });
  row.height = 22;
}

// ── 1. Heures par collaborateur ───────────────────────────────────────────────

router.get("/attendance/reports/by-collaborator", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await resolveOrgId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const collaboratorId = req.query["collaboratorId"] as string | undefined;
    const departmentId = req.query["departmentId"] as string | undefined;

    const conditions = [
      eq(attendanceSessionsTable.organizationId, orgId),
      gte(attendanceSessionsTable.workDate, from),
      lte(attendanceSessionsTable.workDate, to),
      eq(attendanceSessionsTable.status, "closed"),
    ];
    if (collaboratorId) conditions.push(eq(attendanceSessionsTable.collaboratorId, collaboratorId));
    if (departmentId) conditions.push(eq(attendanceSessionsTable.departmentId, departmentId));

    const rows = await db
      .select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        isLate: attendanceSessionsTable.isLate,
        isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
        workDate: attendanceSessionsTable.workDate,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        deptName: departmentsTable.name,
      })
      .from(attendanceSessionsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceSessionsTable.collaboratorId))
      .leftJoin(departmentsTable, and(
        eq(departmentsTable.id, attendanceSessionsTable.departmentId),
        eq(departmentsTable.organizationId, orgId),
      ))
      .where(and(...conditions));

    // Aggregate by collaborator
    const map = new Map<string, {
      collaboratorId: string; name: string; department: string;
      workDays: number; totalMinutes: number; lateDays: number; earlyLeaveDays: number; overtimeDays: number;
    }>();
    for (const r of rows) {
      const eff = r.effectiveMinutes ?? 0;
      const exp = r.expectedMinutes ?? 480;
      const key = r.collaboratorId;
      const e = map.get(key) ?? {
        collaboratorId: key,
        name: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : key,
        department: r.deptName ?? "—",
        workDays: 0, totalMinutes: 0, lateDays: 0, earlyLeaveDays: 0, overtimeDays: 0,
      };
      e.workDays++;
      e.totalMinutes += eff;
      if (r.isLate) e.lateDays++;
      if (r.isEarlyLeave) e.earlyLeaveDays++;
      if (eff > exp) e.overtimeDays++;
      map.set(key, e);
    }

    const data = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    res.json({ from, to, data });
  } catch (e) { next(e); }
});

// ── 2. Heures par département ─────────────────────────────────────────────────

router.get("/attendance/reports/by-department", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await resolveOrgId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);

    const rows = await db
      .select({
        deptId: attendanceSessionsTable.departmentId,
        deptName: departmentsTable.name,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        isLate: attendanceSessionsTable.isLate,
      })
      .from(attendanceSessionsTable)
      .leftJoin(departmentsTable, and(
        eq(departmentsTable.id, attendanceSessionsTable.departmentId),
        eq(departmentsTable.organizationId, orgId),
      ))
      .where(and(
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, from),
        lte(attendanceSessionsTable.workDate, to),
        eq(attendanceSessionsTable.status, "closed"),
      ));

    const map = new Map<string, { deptId: string; deptName: string; workDays: number; totalMinutes: number; lateDays: number; headcount: Set<string> }>();
    for (const r of rows) {
      const key = r.deptId ?? "sans-dept";
      const e = map.get(key) ?? { deptId: key, deptName: r.deptName ?? "Sans département", workDays: 0, totalMinutes: 0, lateDays: 0, headcount: new Set() };
      e.workDays++;
      e.totalMinutes += r.effectiveMinutes ?? 0;
      if (r.isLate) e.lateDays++;
      map.set(key, e);
    }

    const data = [...map.values()].map(e => ({
      deptId: e.deptId, deptName: e.deptName,
      workDays: e.workDays, totalMinutes: e.totalMinutes,
      totalHours: Math.round(e.totalMinutes / 6) / 10,
      lateDays: e.lateDays,
    })).sort((a, b) => b.totalMinutes - a.totalMinutes);

    res.json({ from, to, data });
  } catch (e) { next(e); }
});

// ── 3. Retards & absences ─────────────────────────────────────────────────────

router.get("/attendance/reports/delays-absences", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await resolveOrgId(userId);
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
    if (departmentId) {
      // join collaborators to filter by dept
      // We'll filter in app code below
    }

    const rows = await db
      .select({
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

    // Summary by collaborator
    const summaryMap = new Map<string, { name: string; dept: string; late: number; earlyLeave: number; missing: number; other: number }>();
    for (const r of filtered) {
      const key = r.collaboratorId;
      const e = summaryMap.get(key) ?? {
        name: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : key,
        dept: r.deptName ?? "—", late: 0, earlyLeave: 0, missing: 0, other: 0,
      };
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

// ── 4. Heures supplémentaires ────────────────────────────────────────────────

router.get("/attendance/reports/overtime", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await resolveOrgId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const collaboratorId = req.query["collaboratorId"] as string | undefined;
    const departmentId = req.query["departmentId"] as string | undefined;

    const conditions = [
      eq(attendanceSessionsTable.organizationId, orgId),
      gte(attendanceSessionsTable.workDate, from),
      lte(attendanceSessionsTable.workDate, to),
      eq(attendanceSessionsTable.status, "closed"),
    ];
    if (collaboratorId) conditions.push(eq(attendanceSessionsTable.collaboratorId, collaboratorId));
    if (departmentId) conditions.push(eq(attendanceSessionsTable.departmentId, departmentId));

    const rows = await db
      .select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        workDate: attendanceSessionsTable.workDate,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        deptName: departmentsTable.name,
      })
      .from(attendanceSessionsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceSessionsTable.collaboratorId))
      .leftJoin(departmentsTable, and(
        eq(departmentsTable.id, attendanceSessionsTable.departmentId),
        eq(departmentsTable.organizationId, orgId),
      ))
      .where(and(...conditions));

    const map = new Map<string, {
      collaboratorId: string; name: string; department: string;
      workDays: number; totalEffMinutes: number; totalOvertimeMinutes: number; overtimeDays: number;
    }>();

    for (const r of rows) {
      const eff = r.effectiveMinutes ?? 0;
      const exp = r.expectedMinutes ?? 480;
      const ot = Math.max(0, eff - exp);
      const key = r.collaboratorId;
      const e = map.get(key) ?? {
        collaboratorId: key,
        name: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : key,
        department: r.deptName ?? "—",
        workDays: 0, totalEffMinutes: 0, totalOvertimeMinutes: 0, overtimeDays: 0,
      };
      e.workDays++;
      e.totalEffMinutes += eff;
      e.totalOvertimeMinutes += ot;
      if (ot > 0) e.overtimeDays++;
      map.set(key, e);
    }

    const data = [...map.values()]
      .filter(e => e.totalOvertimeMinutes > 0)
      .sort((a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes);

    res.json({ from, to, data });
  } catch (e) { next(e); }
});

// ── 5. Rapport mensuel (planning vs réel) ────────────────────────────────────

router.get("/attendance/reports/monthly", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await resolveOrgId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const now = new Date();
    const year = parseInt((req.query["year"] as string) ?? String(now.getFullYear()));
    const month = parseInt((req.query["month"] as string) ?? String(now.getMonth() + 1));
    const collaboratorId = req.query["collaboratorId"] as string | undefined;
    const departmentId = req.query["departmentId"] as string | undefined;

    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Count working days (Mon-Fri) in month
    let expectedDays = 0;
    for (let d = new Date(from + "T12:00:00Z"); d <= new Date(to + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay();
      if (dow >= 1 && dow <= 5) expectedDays++;
    }

    const conditions = [
      eq(attendanceSessionsTable.organizationId, orgId),
      gte(attendanceSessionsTable.workDate, from),
      lte(attendanceSessionsTable.workDate, to),
    ];
    if (collaboratorId) conditions.push(eq(attendanceSessionsTable.collaboratorId, collaboratorId));
    if (departmentId) conditions.push(eq(attendanceSessionsTable.departmentId, departmentId));

    const rows = await db
      .select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        workDate: attendanceSessionsTable.workDate,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        status: attendanceSessionsTable.status,
        isLate: attendanceSessionsTable.isLate,
        isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        deptName: departmentsTable.name,
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
      .where(and(...conditions))
      .orderBy(attendanceSessionsTable.workDate);

    const collabMap = new Map<string, {
      collaboratorId: string; name: string; department: string;
      presentDays: number; lateDays: number; earlyLeaveDays: number;
      totalEffMinutes: number; overtimeMinutes: number;
    }>();
    for (const r of rows) {
      const eff = r.effectiveMinutes ?? 0;
      const exp = r.expectedMinutes ?? 480;
      const key = r.collaboratorId;
      const e = collabMap.get(key) ?? {
        collaboratorId: key,
        name: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : key,
        department: r.deptName ?? "—",
        presentDays: 0, lateDays: 0, earlyLeaveDays: 0,
        totalEffMinutes: 0, overtimeMinutes: 0,
      };
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

// ── Export Excel ──────────────────────────────────────────────────────────────

router.get("/attendance/reports/:reportType/export.xlsx", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await resolveOrgId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const reportType = req.params["reportType"] as string;
    const { from, to } = parseRange(req.query["from"] as string, req.query["to"] as string);
    const collaboratorId = req.query["collaboratorId"] as string | undefined;
    const departmentId = req.query["departmentId"] as string | undefined;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaméasù";
    wb.created = new Date();

    // Helper: add cover info
    function addMeta(ws: ExcelJS.Worksheet, title: string) {
      ws.addRow([title]);
      ws.lastRow!.font = { bold: true, size: 14, color: { argb: "FFF37021" } };
      ws.addRow([`Période : ${from} → ${to}`]);
      ws.lastRow!.font = { italic: true, size: 10, color: { argb: "FF555555" } };
      ws.addRow([]);
    }

    if (reportType === "by-collaborator") {
      const conditions = [
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, from),
        lte(attendanceSessionsTable.workDate, to),
        eq(attendanceSessionsTable.status, "closed"),
      ];
      if (collaboratorId) conditions.push(eq(attendanceSessionsTable.collaboratorId, collaboratorId));
      if (departmentId) conditions.push(eq(attendanceSessionsTable.departmentId, departmentId));

      const rows = await db.select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        isLate: attendanceSessionsTable.isLate,
        isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        deptName: departmentsTable.name,
      })
        .from(attendanceSessionsTable)
        .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceSessionsTable.collaboratorId))
        .leftJoin(departmentsTable, and(eq(departmentsTable.id, attendanceSessionsTable.departmentId), eq(departmentsTable.organizationId, orgId)))
        .where(and(...conditions));

      const map2 = new Map<string, { name: string; dept: string; days: number; mins: number; late: number; early: number; ot: number }>();
      for (const r of rows) {
        const eff = r.effectiveMinutes ?? 0;
        const exp = r.expectedMinutes ?? 480;
        const key = r.collaboratorId;
        const e = map2.get(key) ?? { name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(), dept: r.deptName ?? "—", days: 0, mins: 0, late: 0, early: 0, ot: 0 };
        e.days++; e.mins += eff;
        if (r.isLate) e.late++;
        if (r.isEarlyLeave) e.early++;
        if (eff > exp) e.ot++;
        map2.set(key, e);
      }

      const ws = wb.addWorksheet("Par collaborateur");
      ws.columns = [
        { key: "name", width: 28 }, { key: "dept", width: 22 },
        { key: "days", width: 12 }, { key: "hours", width: 14 },
        { key: "late", width: 10 }, { key: "early", width: 14 }, { key: "ot", width: 14 },
      ];
      addMeta(ws, "Heures travaillées par collaborateur");
      const hdr = ws.addRow(["Collaborateur", "Département", "Jours travaillés", "Heures effectives", "Retards", "Départs anticipés", "Jours heures sup."]);
      headerStyle(ws, hdr);
      for (const [, e] of map2) {
        ws.addRow([e.name, e.dept, e.days, fmtMinutes(e.mins), e.late, e.early, e.ot]);
      }

    } else if (reportType === "by-department") {
      const rows = await db.select({
        deptId: attendanceSessionsTable.departmentId,
        deptName: departmentsTable.name,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        isLate: attendanceSessionsTable.isLate,
      })
        .from(attendanceSessionsTable)
        .leftJoin(departmentsTable, and(eq(departmentsTable.id, attendanceSessionsTable.departmentId), eq(departmentsTable.organizationId, orgId)))
        .where(and(eq(attendanceSessionsTable.organizationId, orgId), gte(attendanceSessionsTable.workDate, from), lte(attendanceSessionsTable.workDate, to), eq(attendanceSessionsTable.status, "closed")));

      const map2 = new Map<string, { name: string; days: number; mins: number; late: number }>();
      for (const r of rows) {
        const key = r.deptId ?? "none";
        const e = map2.get(key) ?? { name: r.deptName ?? "—", days: 0, mins: 0, late: 0 };
        e.days++; e.mins += r.effectiveMinutes ?? 0;
        if (r.isLate) e.late++;
        map2.set(key, e);
      }
      const ws = wb.addWorksheet("Par département");
      ws.columns = [{ key: "name", width: 28 }, { key: "days", width: 14 }, { key: "hours", width: 18 }, { key: "late", width: 12 }];
      addMeta(ws, "Heures par département");
      const hdr = ws.addRow(["Département", "Jours travaillés", "Heures effectives", "Retards"]);
      headerStyle(ws, hdr);
      for (const [, e] of map2) {
        ws.addRow([e.name, e.days, fmtMinutes(e.mins), e.late]);
      }

    } else if (reportType === "delays-absences") {
      const flagRows = await db.select({
        kind: attendanceFlagsTable.kind,
        severity: attendanceFlagsTable.severity,
        workDate: attendanceFlagsTable.workDate,
        description: attendanceFlagsTable.description,
        isResolved: attendanceFlagsTable.isResolved,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        deptName: departmentsTable.name,
      })
        .from(attendanceFlagsTable)
        .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceFlagsTable.collaboratorId))
        .leftJoin(departmentsTable, and(eq(departmentsTable.id, collaboratorsTable.departmentId), eq(departmentsTable.organizationId, orgId)))
        .where(and(eq(attendanceFlagsTable.organizationId, orgId), gte(attendanceFlagsTable.workDate, from), lte(attendanceFlagsTable.workDate, to)));

      const ws = wb.addWorksheet("Retards & absences");
      ws.columns = [
        { key: "date", width: 13 }, { key: "name", width: 26 }, { key: "dept", width: 22 },
        { key: "kind", width: 20 }, { key: "severity", width: 12 }, { key: "desc", width: 40 }, { key: "resolved", width: 12 },
      ];
      addMeta(ws, "Retards et anomalies de présence");
      const hdr = ws.addRow(["Date", "Collaborateur", "Département", "Type", "Sévérité", "Description", "Résolu"]);
      headerStyle(ws, hdr);
      const kindLabel: Record<string, string> = {
        late: "Retard", early_leave: "Départ anticipé", missing_clock_out: "Oubli départ",
        missing_clock_in: "Oubli arrivée", long_break: "Pause prolongée",
      };
      for (const r of flagRows) {
        ws.addRow([r.workDate, `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(), r.deptName ?? "—",
          kindLabel[r.kind] ?? r.kind, r.severity, r.description ?? "", r.isResolved ? "Oui" : "Non"]);
      }

    } else if (reportType === "overtime") {
      const conditions = [
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, from),
        lte(attendanceSessionsTable.workDate, to),
        eq(attendanceSessionsTable.status, "closed"),
      ];
      if (collaboratorId) conditions.push(eq(attendanceSessionsTable.collaboratorId, collaboratorId));
      if (departmentId) conditions.push(eq(attendanceSessionsTable.departmentId, departmentId));

      const rows = await db.select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        deptName: departmentsTable.name,
      })
        .from(attendanceSessionsTable)
        .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceSessionsTable.collaboratorId))
        .leftJoin(departmentsTable, and(eq(departmentsTable.id, attendanceSessionsTable.departmentId), eq(departmentsTable.organizationId, orgId)))
        .where(and(...conditions));

      const map2 = new Map<string, { name: string; dept: string; workDays: number; effMins: number; otMins: number; otDays: number }>();
      for (const r of rows) {
        const eff = r.effectiveMinutes ?? 0;
        const exp = r.expectedMinutes ?? 480;
        const ot = Math.max(0, eff - exp);
        const key = r.collaboratorId;
        const e = map2.get(key) ?? { name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(), dept: r.deptName ?? "—", workDays: 0, effMins: 0, otMins: 0, otDays: 0 };
        e.workDays++; e.effMins += eff; e.otMins += ot;
        if (ot > 0) e.otDays++;
        map2.set(key, e);
      }
      const ws = wb.addWorksheet("Heures supplémentaires");
      ws.columns = [{ key: "name", width: 28 }, { key: "dept", width: 22 }, { key: "days", width: 12 }, { key: "eff", width: 16 }, { key: "ot", width: 18 }, { key: "otd", width: 12 }];
      addMeta(ws, "Heures supplémentaires par collaborateur");
      const hdr = ws.addRow(["Collaborateur", "Département", "Jours travaillés", "Heures effectives", "Heures sup. totales", "Jours en heures sup."]);
      headerStyle(ws, hdr);
      for (const [, e] of map2) {
        if (e.otMins > 0) ws.addRow([e.name, e.dept, e.workDays, fmtMinutes(e.effMins), fmtMinutes(e.otMins), e.otDays]);
      }

    } else if (reportType === "monthly") {
      const now2 = new Date();
      const year = parseInt((req.query["year"] as string) ?? String(now2.getFullYear()));
      const month = parseInt((req.query["month"] as string) ?? String(now2.getMonth() + 1));
      const mFrom = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const mTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      let expDays = 0;
      for (let d = new Date(mFrom + "T12:00:00Z"); d <= new Date(mTo + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
        const dow = d.getUTCDay();
        if (dow >= 1 && dow <= 5) expDays++;
      }

      const conditions = [
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, mFrom),
        lte(attendanceSessionsTable.workDate, mTo),
      ];
      if (collaboratorId) conditions.push(eq(attendanceSessionsTable.collaboratorId, collaboratorId));
      if (departmentId) conditions.push(eq(attendanceSessionsTable.departmentId, departmentId));

      const rows = await db.select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        workDate: attendanceSessionsTable.workDate,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        status: attendanceSessionsTable.status,
        isLate: attendanceSessionsTable.isLate,
        isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        deptName: departmentsTable.name,
      })
        .from(attendanceSessionsTable)
        .leftJoin(collaboratorsTable, and(eq(collaboratorsTable.id, attendanceSessionsTable.collaboratorId), isNull(collaboratorsTable.deletedAt)))
        .leftJoin(departmentsTable, and(eq(departmentsTable.id, attendanceSessionsTable.departmentId), eq(departmentsTable.organizationId, orgId)))
        .where(and(...conditions))
        .orderBy(attendanceSessionsTable.workDate);

      const collabMap2 = new Map<string, { name: string; dept: string; present: number; late: number; early: number; effMins: number; otMins: number }>();
      for (const r of rows) {
        const eff = r.effectiveMinutes ?? 0;
        const exp = r.expectedMinutes ?? 480;
        const key = r.collaboratorId;
        const e = collabMap2.get(key) ?? { name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(), dept: r.deptName ?? "—", present: 0, late: 0, early: 0, effMins: 0, otMins: 0 };
        if (r.status === "closed") e.present++;
        e.effMins += eff;
        e.otMins += Math.max(0, eff - exp);
        if (r.isLate) e.late++;
        if (r.isEarlyLeave) e.early++;
        collabMap2.set(key, e);
      }

      const ws = wb.addWorksheet("Rapport mensuel");
      ws.columns = [
        { key: "name", width: 28 }, { key: "dept", width: 22 },
        { key: "expected", width: 12 }, { key: "present", width: 12 }, { key: "absent", width: 12 },
        { key: "rate", width: 14 }, { key: "hours", width: 16 }, { key: "ot", width: 18 },
        { key: "late", width: 10 }, { key: "early", width: 14 },
      ];
      addMeta(ws, `Rapport mensuel de présence — ${month}/${year}`);
      const hdr = ws.addRow(["Collaborateur", "Département", "Jours ouvrés", "Jours présents", "Jours absents", "Taux présence", "Heures effectives", "Heures sup.", "Retards", "Départs anticipés"]);
      headerStyle(ws, hdr);
      for (const [, e] of collabMap2) {
        const absent = expDays - e.present;
        const rate = expDays > 0 ? Math.round((e.present / expDays) * 100) : 0;
        ws.addRow([e.name, e.dept, expDays, e.present, absent, `${rate}%`, fmtMinutes(e.effMins), fmtMinutes(e.otMins), e.late, e.early]);
      }
    } else {
      return res.status(400).json({ error: "Type de rapport inconnu" });
    }

    const reportLabels: Record<string, string> = {
      "by-collaborator": "heures-par-collaborateur",
      "by-department": "heures-par-departement",
      "delays-absences": "retards-absences",
      "overtime": "heures-supplementaires",
      "monthly": "rapport-mensuel",
    };
    const fname = `gameasu-presences-${reportLabels[reportType] ?? reportType}-${from}-${to}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

export default router;
