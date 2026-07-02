/**
 * Rapports RH — 8 types de rapports, filtres multi-sélection département/collaborateur.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  collaboratorsTable, departmentsTable, positionsTable,
  contractsTable, leaveRequestsTable, personnelMovementsTable,
  attendanceSessionsTable, attendanceFlagsTable,
  payslipsTable,
} from "@workspace/db";
import { and, eq, gte, lte, isNull, desc, inArray } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);
router.use(requireManagerOrAbove);

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  promotion: "Promotion",
  mutation: "Mutation",
  reclassification: "Reclassification",
  departure: "Départ",
  retirement: "Retraite",
  disciplinary: "Disciplinaire",
};

// ── Helpers ───────────────────────────────────────────────────────────

function parseIds(param: string | string[] | undefined): string[] {
  if (!param) return [];
  if (Array.isArray(param)) return param.filter(Boolean);
  return param.split(",").map(s => s.trim()).filter(Boolean);
}

async function getCollabMap(orgId: string) {
  const rows = await db.select({
    id: collaboratorsTable.id,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    departmentId: collaboratorsTable.departmentId,
    positionId: collaboratorsTable.positionId,
    employmentStatus: collaboratorsTable.employmentStatus,
    hireDate: collaboratorsTable.hireDate,
    baseSalary: collaboratorsTable.baseSalary,
  }).from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));
  return new Map(rows.map(r => [r.id, r]));
}

async function getDeptMap(orgId: string) {
  const rows = await db.select({ id: departmentsTable.id, name: departmentsTable.name })
    .from(departmentsTable).where(eq(departmentsTable.organizationId, orgId));
  return new Map(rows.map(r => [r.id, r.name]));
}

function filterByDepts(deptIds: string[], deptId: string | null | undefined) {
  if (deptIds.length === 0) return true;
  return !!deptId && deptIds.includes(deptId);
}

// ── 1. Présences ──────────────────────────────────────────────────────

router.get("/hr/reports/attendance", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to, collaboratorIds: cParam, departmentIds: dParam } = req.query as Record<string, string>;
    const collabIds = parseIds(cParam);
    const deptIds = parseIds(dParam);

    const filters = [eq(attendanceSessionsTable.organizationId, orgId)];
    if (from) filters.push(gte(attendanceSessionsTable.workDate, from));
    if (to) filters.push(lte(attendanceSessionsTable.workDate, to));
    if (collabIds.length > 0) filters.push(inArray(attendanceSessionsTable.collaboratorId, collabIds));

    const sessions = await db.select({
      collaboratorId: attendanceSessionsTable.collaboratorId,
      workDate: attendanceSessionsTable.workDate,
      effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
      isLate: attendanceSessionsTable.isLate,
      isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
    }).from(attendanceSessionsTable).where(and(...filters)).orderBy(desc(attendanceSessionsTable.workDate));

    const [collabMap, deptMap] = await Promise.all([getCollabMap(orgId), getDeptMap(orgId)]);

    const byCollab = new Map<string, { name: string; dept: string; sessions: typeof sessions }>();
    for (const s of sessions) {
      const c = collabMap.get(s.collaboratorId);
      if (!filterByDepts(deptIds, c?.departmentId)) continue;
      if (!byCollab.has(s.collaboratorId)) {
        const deptName = c?.departmentId ? (deptMap.get(c.departmentId) ?? "—") : "—";
        byCollab.set(s.collaboratorId, { name: c ? `${c.firstName} ${c.lastName}` : "Inconnu", dept: deptName, sessions: [] });
      }
      byCollab.get(s.collaboratorId)!.sessions.push(s);
    }

    const rows = Array.from(byCollab.entries()).map(([, d]) => {
      const totalMin = d.sessions.reduce((sum, s) => sum + (s.effectiveMinutes ?? 0), 0);
      return {
        collaborateur: d.name, departement: d.dept,
        joursPresents: d.sessions.length,
        totalHeures: Math.round(totalMin / 6) / 10,
        retards: d.sessions.filter(s => s.isLate).length,
        departAnticipe: d.sessions.filter(s => s.isEarlyLeave).length,
      };
    });

    res.json({
      report: "attendance", count: rows.length,
      totals: {
        joursPresents: rows.reduce((s, r) => s + r.joursPresents, 0),
        totalHeures: Math.round(rows.reduce((s, r) => s + r.totalHeures, 0) * 10) / 10,
        retards: rows.reduce((s, r) => s + r.retards, 0),
      },
      rows,
    });
  } catch (e) { next(e); }
});

// ── 2. Retards & anomalies ────────────────────────────────────────────

router.get("/hr/reports/lateness", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to, collaboratorIds: cParam, departmentIds: dParam, kind } = req.query as Record<string, string>;
    const collabIds = parseIds(cParam);
    const deptIds = parseIds(dParam);

    const filters = [eq(attendanceFlagsTable.organizationId, orgId)];
    if (from) filters.push(gte(attendanceFlagsTable.workDate, from));
    if (to) filters.push(lte(attendanceFlagsTable.workDate, to));
    if (collabIds.length > 0) filters.push(inArray(attendanceFlagsTable.collaboratorId, collabIds));
    if (kind) filters.push(eq(attendanceFlagsTable.kind, kind));

    const flags = await db.select({
      collaboratorId: attendanceFlagsTable.collaboratorId,
      workDate: attendanceFlagsTable.workDate,
      kind: attendanceFlagsTable.kind,
      severity: attendanceFlagsTable.severity,
      isResolved: attendanceFlagsTable.isResolved,
      description: attendanceFlagsTable.description,
    }).from(attendanceFlagsTable).where(and(...filters)).orderBy(desc(attendanceFlagsTable.workDate));

    const [collabMap, deptMap] = await Promise.all([getCollabMap(orgId), getDeptMap(orgId)]);

    const rows = flags
      .filter(f => filterByDepts(deptIds, collabMap.get(f.collaboratorId)?.departmentId))
      .map(f => {
        const c = collabMap.get(f.collaboratorId);
        return {
          collaborateur: c ? `${c.firstName} ${c.lastName}` : "Inconnu",
          departement: c?.departmentId ? (deptMap.get(c.departmentId) ?? "—") : "—",
          date: f.workDate, anomalie: f.kind, severite: f.severity,
          resolu: f.isResolved ? "Oui" : "Non", description: f.description ?? "—",
        };
      });

    res.json({ report: "lateness", count: rows.length, rows });
  } catch (e) { next(e); }
});

// ── 3. Heures travaillées ─────────────────────────────────────────────

router.get("/hr/reports/worked-hours", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to, collaboratorIds: cParam, departmentIds: dParam } = req.query as Record<string, string>;
    const collabIds = parseIds(cParam);
    const deptIds = parseIds(dParam);

    const filters = [eq(attendanceSessionsTable.organizationId, orgId)];
    if (from) filters.push(gte(attendanceSessionsTable.workDate, from));
    if (to) filters.push(lte(attendanceSessionsTable.workDate, to));
    if (collabIds.length > 0) filters.push(inArray(attendanceSessionsTable.collaboratorId, collabIds));

    const sessions = await db.select({
      collaboratorId: attendanceSessionsTable.collaboratorId,
      workDate: attendanceSessionsTable.workDate,
      effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
      breakMinutes: attendanceSessionsTable.breakMinutes,
      expectedMinutes: attendanceSessionsTable.expectedMinutes,
      clockInAt: attendanceSessionsTable.clockInAt,
      clockOutAt: attendanceSessionsTable.clockOutAt,
    }).from(attendanceSessionsTable).where(and(...filters)).orderBy(desc(attendanceSessionsTable.workDate));

    const [collabMap, deptMap] = await Promise.all([getCollabMap(orgId), getDeptMap(orgId)]);

    const rows = sessions
      .filter(s => filterByDepts(deptIds, collabMap.get(s.collaboratorId)?.departmentId))
      .map(s => {
        const c = collabMap.get(s.collaboratorId);
        const effective = s.effectiveMinutes ?? 0;
        const expected = s.expectedMinutes ?? 480;
        return {
          collaborateur: c ? `${c.firstName} ${c.lastName}` : "Inconnu",
          departement: c?.departmentId ? (deptMap.get(c.departmentId) ?? "—") : "—",
          date: s.workDate,
          heuresEffectives: Math.round(effective / 6) / 10,
          heuresPrevues: Math.round(expected / 6) / 10,
          heuresPauses: Math.round((s.breakMinutes ?? 0) / 6) / 10,
          heuresSupp: effective > expected ? Math.round((effective - expected) / 6) / 10 : 0,
          entree: s.clockInAt ? new Date(s.clockInAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—",
          sortie: s.clockOutAt ? new Date(s.clockOutAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—",
        };
      });

    res.json({
      report: "worked-hours", count: rows.length,
      totals: {
        totalEffectif: Math.round(rows.reduce((s, r) => s + r.heuresEffectives, 0) * 10) / 10,
        totalSupp: Math.round(rows.reduce((s, r) => s + r.heuresSupp, 0) * 10) / 10,
      },
      rows,
    });
  } catch (e) { next(e); }
});

// ── 4. Congés & absences ──────────────────────────────────────────────

router.get("/hr/reports/leaves", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to, collaboratorIds: cParam, departmentIds: dParam, type, status } = req.query as Record<string, string>;
    const collabIds = parseIds(cParam);
    const deptIds = parseIds(dParam);

    const filters = [eq(leaveRequestsTable.organizationId, orgId)];
    if (from) filters.push(gte(leaveRequestsTable.startDate, from));
    if (to) filters.push(lte(leaveRequestsTable.endDate, to));
    if (collabIds.length > 0) filters.push(inArray(leaveRequestsTable.collaboratorId, collabIds));
    if (type) filters.push(eq(leaveRequestsTable.type, type));
    if (status) filters.push(eq(leaveRequestsTable.status, status));

    const requests = await db.select({
      collaboratorId: leaveRequestsTable.collaboratorId,
      type: leaveRequestsTable.type,
      startDate: leaveRequestsTable.startDate,
      endDate: leaveRequestsTable.endDate,
      days: leaveRequestsTable.days,
      status: leaveRequestsTable.status,
      reason: leaveRequestsTable.reason,
    }).from(leaveRequestsTable).where(and(...filters)).orderBy(desc(leaveRequestsTable.startDate));

    const [collabMap, deptMap] = await Promise.all([getCollabMap(orgId), getDeptMap(orgId)]);

    const rows = requests
      .filter(r => filterByDepts(deptIds, collabMap.get(r.collaboratorId)?.departmentId))
      .map(r => {
        const c = collabMap.get(r.collaboratorId);
        return {
          collaborateur: c ? `${c.firstName} ${c.lastName}` : "Inconnu",
          departement: c?.departmentId ? (deptMap.get(c.departmentId) ?? "—") : "—",
          type: r.type, debut: r.startDate, fin: r.endDate,
          jours: Math.round(Number(r.days ?? 0) * 10) / 10,
          statut: r.status, raison: r.reason ?? "—",
        };
      });

    res.json({
      report: "leaves", count: rows.length,
      totals: { totalJours: Math.round(rows.reduce((s, r) => s + r.jours, 0) * 10) / 10 },
      rows,
    });
  } catch (e) { next(e); }
});

// ── 5. Effectifs ──────────────────────────────────────────────────────

router.get("/hr/reports/headcount", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { departmentIds: dParam, collaboratorIds: cParam, status, contractType } = req.query as Record<string, string>;
    const deptIds = parseIds(dParam);
    const collabIds = parseIds(cParam);

    const filters = [eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)];
    if (deptIds.length > 0) filters.push(inArray(collaboratorsTable.departmentId, deptIds));
    if (collabIds.length > 0) filters.push(inArray(collaboratorsTable.id, collabIds));
    if (status) filters.push(eq(collaboratorsTable.employmentStatus, status));

    const collabs = await db.select({
      id: collaboratorsTable.id,
      firstName: collaboratorsTable.firstName,
      lastName: collaboratorsTable.lastName,
      departmentId: collaboratorsTable.departmentId,
      positionId: collaboratorsTable.positionId,
      employmentStatus: collaboratorsTable.employmentStatus,
      hireDate: collaboratorsTable.hireDate,
      baseSalary: collaboratorsTable.baseSalary,
    }).from(collaboratorsTable).where(and(...filters)).orderBy(collaboratorsTable.lastName);

    const deptMap = await getDeptMap(orgId);
    const positions = await db.select({ id: positionsTable.id, title: positionsTable.title })
      .from(positionsTable).where(eq(positionsTable.organizationId, orgId));
    const posMap = new Map(positions.map(p => [p.id, p.title]));

    const contractRows = await db.select({
      collaboratorId: contractsTable.collaboratorId,
      type: contractsTable.type, status: contractsTable.status, endDate: contractsTable.endDate,
    }).from(contractsTable).where(eq(contractsTable.organizationId, orgId));

    const activeContracts = new Map<string, { type: string; status: string; endDate: string | null }>();
    for (const c of contractRows) {
      if (!activeContracts.has(c.collaboratorId) || c.status === "active") activeContracts.set(c.collaboratorId, c);
    }

    const rows = collabs
      .filter(c => !contractType || activeContracts.get(c.id)?.type === contractType)
      .map(c => ({
        collaborateur: `${c.firstName} ${c.lastName}`,
        departement: c.departmentId ? (deptMap.get(c.departmentId) ?? "—") : "—",
        poste: c.positionId ? (posMap.get(c.positionId) ?? "—") : "—",
        typeContrat: activeContracts.get(c.id)?.type ?? "—",
        dateEmbauche: c.hireDate ?? null,
        statut: c.employmentStatus,
        salaireBase: c.baseSalary ? Math.round(Number(c.baseSalary)) : null,
      }));

    res.json({ report: "headcount", count: rows.length, rows });
  } catch (e) { next(e); }
});

// ── 6. Paie ───────────────────────────────────────────────────────────

router.get("/hr/reports/payroll", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { period, collaboratorIds: cParam, departmentIds: dParam, status } = req.query as Record<string, string>;
    const collabIds = parseIds(cParam);
    const deptIds = parseIds(dParam);

    const filters = [eq(payslipsTable.organizationId, orgId)];
    if (collabIds.length > 0) filters.push(inArray(payslipsTable.collaboratorId, collabIds));
    if (period) filters.push(eq(payslipsTable.period, period));
    if (status) filters.push(eq(payslipsTable.status, status));

    const payslips = await db.select({
      collaboratorId: payslipsTable.collaboratorId,
      period: payslipsTable.period,
      grossSalary: payslipsTable.grossSalary,
      netSalary: payslipsTable.netSalary,
      cnssEmployee: payslipsTable.cnssEmployee,
      cnssEmployer: payslipsTable.cnssEmployer,
      irpp: payslipsTable.irpp,
      status: payslipsTable.status,
    }).from(payslipsTable).where(and(...filters)).orderBy(desc(payslipsTable.period));

    const [collabMap, deptMap] = await Promise.all([getCollabMap(orgId), getDeptMap(orgId)]);

    const rows = payslips
      .filter(p => filterByDepts(deptIds, collabMap.get(p.collaboratorId)?.departmentId))
      .map(p => {
        const c = collabMap.get(p.collaboratorId);
        return {
          collaborateur: c ? `${c.firstName} ${c.lastName}` : "Inconnu",
          departement: c?.departmentId ? (deptMap.get(c.departmentId) ?? "—") : "—",
          periode: p.period,
          brut: Math.round(Number(p.grossSalary ?? 0)),
          net: Math.round(Number(p.netSalary ?? 0)),
          cnssCollab: Math.round(Number(p.cnssEmployee ?? 0)),
          cnssPatronal: Math.round(Number(p.cnssEmployer ?? 0)),
          irpp: Math.round(Number(p.irpp ?? 0)),
          statut: p.status,
        };
      });

    res.json({
      report: "payroll", count: rows.length,
      totals: {
        brut: rows.reduce((s, r) => s + r.brut, 0),
        net: rows.reduce((s, r) => s + r.net, 0),
        cnssPatronal: rows.reduce((s, r) => s + r.cnssPatronal, 0),
      },
      rows,
    });
  } catch (e) { next(e); }
});

// ── 7. Contrats ───────────────────────────────────────────────────────

router.get("/hr/reports/contracts", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { collaboratorIds: cParam, departmentIds: dParam, type, status, expiringBefore } = req.query as Record<string, string>;
    const collabIds = parseIds(cParam);
    const deptIds = parseIds(dParam);

    const filters = [eq(contractsTable.organizationId, orgId)];
    if (collabIds.length > 0) filters.push(inArray(contractsTable.collaboratorId, collabIds));
    if (type) filters.push(eq(contractsTable.type, type));
    if (status) filters.push(eq(contractsTable.status, status));
    if (expiringBefore) filters.push(lte(contractsTable.endDate, expiringBefore));

    const contracts = await db.select({
      collaboratorId: contractsTable.collaboratorId,
      type: contractsTable.type,
      status: contractsTable.status,
      startDate: contractsTable.startDate,
      endDate: contractsTable.endDate,
      monthlySalary: contractsTable.monthlySalary,
      jobTitle: contractsTable.jobTitle,
    }).from(contractsTable).where(and(...filters)).orderBy(desc(contractsTable.startDate));

    const [collabMap, deptMap] = await Promise.all([getCollabMap(orgId), getDeptMap(orgId)]);

    const rows = contracts
      .filter(c => filterByDepts(deptIds, collabMap.get(c.collaboratorId)?.departmentId))
      .map(c => {
        const collab = collabMap.get(c.collaboratorId);
        return {
          collaborateur: collab ? `${collab.firstName} ${collab.lastName}` : "Inconnu",
          departement: collab?.departmentId ? (deptMap.get(collab.departmentId) ?? "—") : "—",
          type: c.type, statut: c.status, debut: c.startDate, fin: c.endDate ?? null,
          salaireMensuel: c.monthlySalary ? Math.round(Number(c.monthlySalary)) : null,
          poste: c.jobTitle ?? "—",
        };
      });

    res.json({ report: "contracts", count: rows.length, rows });
  } catch (e) { next(e); }
});

// ── 8. Mouvements ─────────────────────────────────────────────────────

router.get("/hr/reports/movements", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to, collaboratorIds: cParam, departmentIds: dParam, type } = req.query as Record<string, string>;
    const collabIds = parseIds(cParam);
    const deptIds = parseIds(dParam);

    const filters = [eq(personnelMovementsTable.organizationId, orgId)];
    if (from) filters.push(gte(personnelMovementsTable.effectiveDate, from));
    if (to) filters.push(lte(personnelMovementsTable.effectiveDate, to));
    if (collabIds.length > 0) filters.push(inArray(personnelMovementsTable.collaboratorId, collabIds));
    if (type) filters.push(eq(personnelMovementsTable.type, type));

    const movements = await db.select({
      collaboratorId: personnelMovementsTable.collaboratorId,
      type: personnelMovementsTable.type,
      effectiveDate: personnelMovementsTable.effectiveDate,
      previousDepartmentId: personnelMovementsTable.previousDepartmentId,
      newDepartmentId: personnelMovementsTable.newDepartmentId,
      previousSalary: personnelMovementsTable.previousSalary,
      newSalary: personnelMovementsTable.newSalary,
      reason: personnelMovementsTable.reason,
    }).from(personnelMovementsTable).where(and(...filters)).orderBy(desc(personnelMovementsTable.effectiveDate));

    const [collabMap, deptMap] = await Promise.all([getCollabMap(orgId), getDeptMap(orgId)]);

    const rows = movements
      .filter(m => filterByDepts(deptIds, collabMap.get(m.collaboratorId)?.departmentId))
      .map(m => {
        const c = collabMap.get(m.collaboratorId);
        return {
          collaborateur: c ? `${c.firstName} ${c.lastName}` : "Inconnu",
          type: MOVEMENT_TYPE_LABELS[m.type] ?? m.type, dateEffet: m.effectiveDate,
          departementPrecedent: m.previousDepartmentId ? (deptMap.get(m.previousDepartmentId) ?? "—") : "—",
          departementActuel: m.newDepartmentId ? (deptMap.get(m.newDepartmentId) ?? "—") : "—",
          salairePrecedent: m.previousSalary ? Math.round(Number(m.previousSalary)) : null,
          nouveauSalaire: m.newSalary ? Math.round(Number(m.newSalary)) : null,
          motif: m.reason ?? "—",
        };
      });

    res.json({ report: "movements", count: rows.length, rows });
  } catch (e) { next(e); }
});

export default router;
