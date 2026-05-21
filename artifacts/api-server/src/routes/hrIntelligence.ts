/**
 * Phase 10 — RH IA.
 *  - GET /api/hr/intelligence/overview            : KPI synthèse RH.
 *  - GET /api/hr/intelligence/absenteeism?days=30 : taux d'absentéisme + collaborateurs à risque.
 *  - GET /api/hr/intelligence/workload?days=14    : charge par collaborateur (surcharge / sous-charge).
 *  - GET /api/hr/intelligence/expiring?days=90    : contrats et documents qui expirent.
 *
 * 100 % heuristique. Permission `hr.read`.
 */
import { Router, type IRouter } from "express";
import {
  db,
  collaboratorsTable,
  attendanceSessionsTable,
  contractsTable,
  hrDocumentsTable,
  departmentsTable,
} from "@workspace/db";
import { and, eq, isNull, gte, lte, ne, sql } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { getCurrentOrganizationId } from "../lib/tenant";

const router: IRouter = Router();

function fmtISODate(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number): Date { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function parseDays(raw: unknown, def: number, lo: number, hi: number): number | null {
  if (raw === undefined || raw === null || raw === "") return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return clamp(Math.round(n), lo, hi);
}

async function loadActiveCollaborators() {
  return db
    .select({
      id: collaboratorsTable.id,
      firstName: collaboratorsTable.firstName,
      lastName: collaboratorsTable.lastName,
      email: collaboratorsTable.email,
      employmentStatus: collaboratorsTable.employmentStatus,
      departmentId: collaboratorsTable.departmentId,
      hireDate: collaboratorsTable.hireDate,
    })
    .from(collaboratorsTable)
    .where(and(isNull(collaboratorsTable.deletedAt), eq(collaboratorsTable.employmentStatus, "active")));
}

// Compte les jours ouvrés (lun-ven) entre deux dates inclusives.
function workingDaysBetween(from: Date, to: Date): number {
  let n = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// ─── Overview ──────────────────────────────────────────────────────────
router.get("/hr/intelligence/overview", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const collaborators = await loadActiveCollaborators();
    const now = new Date();
    const from = addDays(now, -30);

    const sessions = await db
      .select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        workDate: attendanceSessionsTable.workDate,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        isLate: attendanceSessionsTable.isLate,
        isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
        status: attendanceSessionsTable.status,
      })
      .from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, fmtISODate(from)),
        lte(attendanceSessionsTable.workDate, fmtISODate(now)),
      ));

    const workDays = workingDaysBetween(from, now);
    const totalExpected = collaborators.length * workDays;
    const presentSessions = sessions.length;
    const lateSessions = sessions.filter((s) => s.isLate).length;
    const earlyLeave = sessions.filter((s) => s.isEarlyLeave).length;
    const totalEffectiveHours = sessions.reduce((s, x) => s + (x.effectiveMinutes ?? 0), 0) / 60;
    const totalExpectedHours = sessions.reduce((s, x) => s + (x.expectedMinutes ?? 480), 0) / 60;
    const absenceRate = totalExpected > 0 ? Math.max(0, 1 - presentSessions / totalExpected) : 0;
    const latenessRate = presentSessions > 0 ? lateSessions / presentSessions : 0;
    const productivityRate = totalExpectedHours > 0 ? totalEffectiveHours / totalExpectedHours : 0;

    // Contrats expirant <90j
    const in90 = addDays(now, 90);
    const contracts = await db
      .select({ id: contractsTable.id, status: contractsTable.status, endDate: contractsTable.endDate })
      .from(contractsTable)
      .where(and(eq(contractsTable.status, "active")));
    const expiringContracts = contracts.filter((c) => c.endDate && new Date(c.endDate) <= in90 && new Date(c.endDate) >= now).length;

    // Documents qui expirent
    const docs = await db
      .select({ id: hrDocumentsTable.id, expiresAt: hrDocumentsTable.expiresAt })
      .from(hrDocumentsTable);
    const expiringDocs = docs.filter((d) => d.expiresAt && new Date(d.expiresAt) <= in90 && new Date(d.expiresAt) >= now).length;
    const expiredDocs = docs.filter((d) => d.expiresAt && new Date(d.expiresAt) < now).length;

    return res.json({
      headcount: collaborators.length,
      workDays,
      presentSessions,
      absenceRate: Math.round(absenceRate * 1000) / 10, // %
      latenessRate: Math.round(latenessRate * 1000) / 10,
      productivityRate: Math.round(productivityRate * 1000) / 10,
      lateSessions,
      earlyLeave,
      totalEffectiveHours: Math.round(totalEffectiveHours),
      totalExpectedHours: Math.round(totalExpectedHours),
      expiringContracts,
      expiringDocs,
      expiredDocs,
    });
  } catch (e) { next(e); }
});

// ─── Absentéisme & retards par collaborateur ───────────────────────────
router.get("/hr/intelligence/absenteeism", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const days = parseDays(req.query["days"], 30, 7, 180);
    if (days === null) return res.status(400).json({ error: "invalid_days" });
    const collaborators = await loadActiveCollaborators();
    const now = new Date();
    const from = addDays(now, -days);
    const workDays = workingDaysBetween(from, now);

    const sessions = await db
      .select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        workDate: attendanceSessionsTable.workDate,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
        isLate: attendanceSessionsTable.isLate,
        isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
      })
      .from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, fmtISODate(from)),
        lte(attendanceSessionsTable.workDate, fmtISODate(now)),
      ));

    const byCollab = new Map<string, typeof sessions>();
    for (const s of sessions) {
      if (!byCollab.has(s.collaboratorId)) byCollab.set(s.collaboratorId, []);
      byCollab.get(s.collaboratorId)!.push(s);
    }

    const ranked = collaborators.map((c) => {
      const arr = byCollab.get(c.id) ?? [];
      const present = arr.length;
      const absentDays = Math.max(0, workDays - present);
      const lateCount = arr.filter((s) => s.isLate).length;
      const earlyLeaveCount = arr.filter((s) => s.isEarlyLeave).length;
      const absenceRate = workDays > 0 ? absentDays / workDays : 0;
      const latenessRate = present > 0 ? lateCount / present : 0;
      // Score risque RH 0..100 : 60 % absentéisme + 30 % retards + 10 % départs anticipés
      const score = Math.round(absenceRate * 60 + latenessRate * 30 + (present > 0 ? (earlyLeaveCount / present) : 0) * 10);
      const tier: "critical" | "high" | "medium" | "low" =
        score >= 50 ? "critical" : score >= 30 ? "high" : score >= 15 ? "medium" : "low";
      return {
        collaboratorId: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        departmentId: c.departmentId,
        workDays,
        presentDays: present,
        absentDays,
        lateCount,
        earlyLeaveCount,
        absenceRate: Math.round(absenceRate * 1000) / 10,
        latenessRate: Math.round(latenessRate * 1000) / 10,
        score,
        tier,
      };
    }).sort((a, b) => b.score - a.score);

    return res.json({
      days,
      workDays,
      count: ranked.length,
      ranked,
    });
  } catch (e) { next(e); }
});

// ─── Charge / surcharge ────────────────────────────────────────────────
router.get("/hr/intelligence/workload", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const days = parseDays(req.query["days"], 14, 7, 90);
    if (days === null) return res.status(400).json({ error: "invalid_days" });
    const collaborators = await loadActiveCollaborators();
    const now = new Date();
    const from = addDays(now, -days);

    const sessions = await db
      .select({
        collaboratorId: attendanceSessionsTable.collaboratorId,
        effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
        expectedMinutes: attendanceSessionsTable.expectedMinutes,
      })
      .from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, fmtISODate(from)),
        lte(attendanceSessionsTable.workDate, fmtISODate(now)),
      ));

    const byCollab = new Map<string, { eff: number; exp: number; sessions: number }>();
    for (const s of sessions) {
      const acc = byCollab.get(s.collaboratorId) ?? { eff: 0, exp: 0, sessions: 0 };
      acc.eff += s.effectiveMinutes ?? 0;
      acc.exp += s.expectedMinutes ?? 480;
      acc.sessions++;
      byCollab.set(s.collaboratorId, acc);
    }

    const rows = collaborators.map((c) => {
      const a = byCollab.get(c.id) ?? { eff: 0, exp: 0, sessions: 0 };
      const ratio = a.exp > 0 ? a.eff / a.exp : 0;
      // surcharge : >115 % ; ok 85-115 % ; sous-charge 50-85 % ; absent <50 %
      const status: "overload" | "ok" | "under" | "absent" =
        a.sessions === 0 ? "absent" :
        ratio > 1.15 ? "overload" :
        ratio >= 0.85 ? "ok" :
        ratio >= 0.5 ? "under" : "absent";
      return {
        collaboratorId: c.id,
        name: `${c.firstName} ${c.lastName}`,
        departmentId: c.departmentId,
        sessions: a.sessions,
        effectiveHours: Math.round(a.eff / 6) / 10,
        expectedHours: Math.round(a.exp / 6) / 10,
        ratio: Math.round(ratio * 1000) / 10, // %
        status,
      };
    }).sort((a, b) => b.ratio - a.ratio);

    const counts = { overload: 0, ok: 0, under: 0, absent: 0 };
    for (const r of rows) counts[r.status]++;

    return res.json({ days, count: rows.length, counts, rows });
  } catch (e) { next(e); }
});

// ─── Contrats & documents qui expirent ─────────────────────────────────
router.get("/hr/intelligence/expiring", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const days = parseDays(req.query["days"], 90, 7, 365);
    if (days === null) return res.status(400).json({ error: "invalid_days" });
    const now = new Date();
    const horizon = addDays(now, days);

    const contracts = await db
      .select({
        id: contractsTable.id,
        collaboratorId: contractsTable.collaboratorId,
        type: contractsTable.type,
        status: contractsTable.status,
        startDate: contractsTable.startDate,
        endDate: contractsTable.endDate,
        jobTitle: contractsTable.jobTitle,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
      })
      .from(contractsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, contractsTable.collaboratorId))
      .where(eq(contractsTable.status, "active"));

    const contractRows = contracts
      .filter((c) => c.endDate && new Date(c.endDate) <= horizon)
      .map((c) => {
        const end = new Date(c.endDate!);
        const daysLeft = Math.floor((end.getTime() - now.getTime()) / 86_400_000);
        return {
          id: c.id,
          collaboratorId: c.collaboratorId,
          name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
          type: c.type,
          jobTitle: c.jobTitle,
          endDate: c.endDate,
          daysLeft,
          severity: (daysLeft < 0 ? "high" : daysLeft <= 30 ? "high" : daysLeft <= 60 ? "medium" : "low") as "low" | "medium" | "high",
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const docs = await db
      .select({
        id: hrDocumentsTable.id,
        collaboratorId: hrDocumentsTable.collaboratorId,
        type: hrDocumentsTable.type,
        name: hrDocumentsTable.name,
        expiresAt: hrDocumentsTable.expiresAt,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
      })
      .from(hrDocumentsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, hrDocumentsTable.collaboratorId));

    const docRows = docs
      .filter((d) => d.expiresAt && new Date(d.expiresAt) <= horizon)
      .map((d) => {
        const exp = new Date(d.expiresAt!);
        const daysLeft = Math.floor((exp.getTime() - now.getTime()) / 86_400_000);
        return {
          id: d.id,
          collaboratorId: d.collaboratorId,
          collaboratorName: `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim(),
          type: d.type,
          name: d.name,
          expiresAt: d.expiresAt,
          daysLeft,
          severity: (daysLeft < 0 ? "high" : daysLeft <= 30 ? "high" : daysLeft <= 60 ? "medium" : "low") as "low" | "medium" | "high",
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    return res.json({
      days,
      contracts: { count: contractRows.length, rows: contractRows },
      documents: { count: docRows.length, rows: docRows },
    });
  } catch (e) { next(e); }
});

export default router;
