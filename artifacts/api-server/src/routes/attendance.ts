import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  attendanceSessionsTable, attendanceRecordsTable, attendanceFlagsTable,
  collaboratorsTable, departmentsTable, usersTable, notificationsTable,
  clockEventSchema,
} from "@workspace/db";
import { and, desc, eq, gte, lte, sql, isNull, inArray } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requirePermission } from "../middlewares/permissions";
import { emitToUser } from "../lib/realtime";

const router: IRouter = Router();

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
async function resolveCollaborator(userId: string): Promise<{ id: string; departmentId: string | null } | null> {
  const [c] = await db.select({ id: collaboratorsTable.id, departmentId: collaboratorsTable.departmentId })
    .from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.userId, userId), isNull(collaboratorsTable.deletedAt)))
    .limit(1);
  return c ?? null;
}

function todayISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function diffMinutes(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

// ── T001 : Alerte manager sur anomalie ───────────────────────────
async function notifyDeptHead(
  orgId: string, collaboratorId: string, departmentId: string | null,
  flagKind: string, description: string,
): Promise<void> {
  if (!departmentId) return;
  try {
    const [dept] = await db.select({ headCollaboratorId: departmentsTable.headCollaboratorId })
      .from(departmentsTable)
      .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.organizationId, orgId)))
      .limit(1);
    if (!dept?.headCollaboratorId) return;
    const [headCollab] = await db.select({ userId: collaboratorsTable.userId })
      .from(collaboratorsTable).where(eq(collaboratorsTable.id, dept.headCollaboratorId)).limit(1);
    if (!headCollab?.userId) return;
    const [collab] = await db.select({ firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName })
      .from(collaboratorsTable).where(eq(collaboratorsTable.id, collaboratorId)).limit(1);
    const kindLabel: Record<string, string> = {
      late: "Retard", long_break: "Pause prolongée", missing_clock_out: "Oubli de pointage départ",
    };
    const [notif] = await db.insert(notificationsTable).values({
      organizationId: orgId,
      userId: headCollab.userId,
      title: `⚠️ Anomalie présence : ${kindLabel[flagKind] ?? flagKind}`,
      body: `${collab ? collab.firstName + " " + collab.lastName : collaboratorId} — ${description}`,
      type: "attendance_flag",
      entityType: "attendance",
    }).returning();
    emitToUser(headCollab.userId, "notification:new", notif);
  } catch { /* silencieux — ne doit pas bloquer le pointage */ }
}

async function recomputeSession(sessionId: string): Promise<void> {
  const [s] = await db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.id, sessionId)).limit(1);
  if (!s) return;
  const recs = await db.select().from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.sessionId, sessionId))
    .orderBy(attendanceRecordsTable.occurredAt);
  let clockIn: Date | null = null;
  let clockOut: Date | null = null;
  let breakStart: Date | null = null;
  let breakMinutes = 0;
  for (const r of recs) {
    if (r.kind === "clock_in" && !clockIn) clockIn = r.occurredAt;
    if (r.kind === "clock_out") clockOut = r.occurredAt;
    if (r.kind === "break_start") breakStart = r.occurredAt;
    if (r.kind === "break_end" && breakStart) {
      breakMinutes += diffMinutes(breakStart, r.occurredAt);
      breakStart = null;
    }
  }
  const totalMinutes = clockIn ? diffMinutes(clockIn, clockOut ?? new Date()) : 0;
  const effectiveMinutes = Math.max(0, totalMinutes - breakMinutes);
  // Détection retard (après 09h00) et early leave (avant 17h00)
  let isLate = false;
  let isEarlyLeave = false;
  if (clockIn) {
    const lateThreshold = new Date(clockIn);
    lateThreshold.setHours(9, 0, 0, 0);
    isLate = clockIn.getTime() > lateThreshold.getTime();
  }
  if (clockOut) {
    const earlyThreshold = new Date(clockOut);
    earlyThreshold.setHours(17, 0, 0, 0);
    isEarlyLeave = clockOut.getTime() < earlyThreshold.getTime();
  }
  await db.update(attendanceSessionsTable).set({
    clockInAt: clockIn,
    clockOutAt: clockOut,
    totalMinutes,
    breakMinutes,
    effectiveMinutes,
    isLate,
    isEarlyLeave,
    status: clockOut ? "closed" : "open",
  }).where(eq(attendanceSessionsTable.id, sessionId));

  // Flags : détection retard, oubli, longue pause
  if (isLate) {
    const existing = await db.select().from(attendanceFlagsTable)
      .where(and(eq(attendanceFlagsTable.sessionId, sessionId), eq(attendanceFlagsTable.kind, "late")))
      .limit(1);
    if (!existing[0]) {
      const desc = `Arrivée tardive à ${clockIn?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      await db.insert(attendanceFlagsTable).values({
        organizationId: s.organizationId, collaboratorId: s.collaboratorId, sessionId,
        kind: "late", severity: "medium", workDate: s.workDate, description: desc,
      });
      void notifyDeptHead(s.organizationId, s.collaboratorId, s.departmentId, "late", desc);
    }
  }
  if (breakMinutes > 90) {
    const existing = await db.select().from(attendanceFlagsTable)
      .where(and(eq(attendanceFlagsTable.sessionId, sessionId), eq(attendanceFlagsTable.kind, "long_break")))
      .limit(1);
    if (!existing[0]) {
      const desc = `Pause prolongée (${breakMinutes} min)`;
      await db.insert(attendanceFlagsTable).values({
        organizationId: s.organizationId, collaboratorId: s.collaboratorId, sessionId,
        kind: "long_break", severity: "low", workDate: s.workDate, description: desc,
      });
      void notifyDeptHead(s.organizationId, s.collaboratorId, s.departmentId, "long_break", desc);
    }
  }
}

async function postClockEvent(req: Request, res: Response, kind: "clock_in" | "clock_out" | "break_start" | "break_end") {
  const userId = req.authUser!.id;
  const orgId = await getCurrentOrganizationId(userId);
  if (!orgId) return res.status(403).json({ error: "no_organization" });
  const collab = await resolveCollaborator(userId);
  if (!collab) return res.status(404).json({ error: "no_collaborator_linked", message: "Aucun collaborateur lié à votre compte." });

  const body = clockEventSchema.parse({ ...req.body, kind });
  const workDate = todayISO();

  // Récupère ou crée la session du jour
  let [session] = await db.select().from(attendanceSessionsTable)
    .where(and(
      eq(attendanceSessionsTable.collaboratorId, collab.id),
      eq(attendanceSessionsTable.workDate, workDate),
      eq(attendanceSessionsTable.organizationId, orgId),
    ))
    .limit(1);
  if (!session) {
    const [created] = await db.insert(attendanceSessionsTable).values({
      organizationId: orgId,
      collaboratorId: collab.id,
      userId,
      departmentId: collab.departmentId,
      projectId: body.projectId ?? null,
      workDate,
      status: "open",
    }).returning();
    session = created;
  }

  // Machine à états stricte : on collecte l'état dérivé de tous les events
  const allRecs = await db.select().from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.sessionId, session.id))
    .orderBy(desc(attendanceRecordsTable.occurredAt));
  const lastKind = allRecs[0]?.kind;
  const hasClockIn = allRecs.some((r) => r.kind === "clock_in");
  const hasClockOut = allRecs.some((r) => r.kind === "clock_out");
  const onBreak = lastKind === "break_start";

  if (kind === "clock_in") {
    if (hasClockIn && !hasClockOut) {
      return res.status(409).json({ error: "already_clocked_in", message: "Vous êtes déjà pointé(e) en arrivée aujourd'hui." });
    }
    if (hasClockOut) {
      return res.status(409).json({ error: "session_closed", message: "Votre journée est déjà clôturée." });
    }
  }
  if (kind === "clock_out") {
    if (!hasClockIn) {
      return res.status(409).json({ error: "not_clocked_in", message: "Aucune arrivée pointée — impossible de pointer le départ." });
    }
    if (hasClockOut) {
      return res.status(409).json({ error: "already_clocked_out", message: "Vous êtes déjà pointé(e) en départ." });
    }
    if (onBreak) {
      return res.status(409).json({ error: "on_break", message: "Terminez votre pause avant de pointer le départ." });
    }
  }
  if (kind === "break_start") {
    if (!hasClockIn) {
      return res.status(409).json({ error: "not_clocked_in", message: "Pointez votre arrivée avant de prendre une pause." });
    }
    if (hasClockOut) {
      return res.status(409).json({ error: "session_closed", message: "Journée déjà clôturée." });
    }
    if (onBreak) {
      return res.status(409).json({ error: "already_on_break", message: "Vous êtes déjà en pause." });
    }
  }
  if (kind === "break_end" && !onBreak) {
    return res.status(409).json({ error: "no_break_to_end", message: "Aucune pause à terminer." });
  }

  const ipAddress = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0]?.trim() || null;

  const [rec] = await db.insert(attendanceRecordsTable).values({
    organizationId: orgId,
    sessionId: session.id,
    collaboratorId: collab.id,
    userId,
    kind,
    occurredAt: new Date(),
    latitude: body.latitude !== undefined ? String(body.latitude) : null,
    longitude: body.longitude !== undefined ? String(body.longitude) : null,
    accuracyMeters: body.accuracyMeters ?? null,
    locationLabel: body.locationLabel ?? null,
    sourceDevice: body.sourceDevice ?? req.headers["user-agent"]?.toString().slice(0, 200) ?? null,
    ipAddress,
    comment: body.comment ?? null,
    status: "validated",
  }).returning();

  await recomputeSession(session.id);
  const [refreshed] = await db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.id, session.id)).limit(1);
  res.json({ session: refreshed, record: rec });
}

router.post("/attendance/clock-in", requirePermission("attendance.clock"), (req, res, next) => postClockEvent(req, res, "clock_in").catch(next));
router.post("/attendance/clock-out", requirePermission("attendance.clock"), (req, res, next) => postClockEvent(req, res, "clock_out").catch(next));
router.post("/attendance/break-start", requirePermission("attendance.clock"), (req, res, next) => postClockEvent(req, res, "break_start").catch(next));
router.post("/attendance/break-end", requirePermission("attendance.clock"), (req, res, next) => postClockEvent(req, res, "break_end").catch(next));

// Mon état du jour
router.get("/attendance/me/today", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const collab = await resolveCollaborator(userId);
    if (!collab) return res.json({ session: null, records: [], collaborator: null });
    const workDate = todayISO();
    const [session] = await db.select().from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.collaboratorId, collab.id),
        eq(attendanceSessionsTable.workDate, workDate),
        eq(attendanceSessionsTable.organizationId, orgId),
      ))
      .limit(1);
    const records = session
      ? await db.select().from(attendanceRecordsTable).where(eq(attendanceRecordsTable.sessionId, session.id)).orderBy(attendanceRecordsTable.occurredAt)
      : [];
    res.json({ session: session ?? null, records, collaborator: collab });
  } catch (e) { next(e); }
});

// Mon historique
router.get("/attendance/me/history", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const collab = await resolveCollaborator(userId);
    if (!collab) return res.json({ data: [] });
    const limit = Math.min(Number(req.query["limit"] ?? 30), 365);
    const rows = await db.select().from(attendanceSessionsTable)
      .where(and(eq(attendanceSessionsTable.collaboratorId, collab.id), eq(attendanceSessionsTable.organizationId, orgId)))
      .orderBy(desc(attendanceSessionsTable.workDate))
      .limit(limit);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// Tableau RH des présences (tous les collab d'un jour donné)
router.get("/attendance/dashboard", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const date = String(req.query["date"] ?? todayISO());

    const sessions = await db.select({
      session: attendanceSessionsTable,
      collaborator: collaboratorsTable,
      department: departmentsTable,
    })
      .from(attendanceSessionsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceSessionsTable.collaboratorId))
      .leftJoin(departmentsTable, eq(departmentsTable.id, attendanceSessionsTable.departmentId))
      .where(and(eq(attendanceSessionsTable.organizationId, orgId), eq(attendanceSessionsTable.workDate, date)));

    const total = sessions.length;
    const present = sessions.filter((s) => s.session.clockInAt).length;
    const late = sessions.filter((s) => s.session.isLate).length;
    const onBreak = sessions.filter((s) => s.session.status === "open" && (s.session.breakMinutes ?? 0) > 0 && !s.session.clockOutAt).length;
    const closed = sessions.filter((s) => s.session.status === "closed").length;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.session.effectiveMinutes ?? 0), 0);

    res.json({
      date,
      summary: { total, present, late, onBreak, closed, totalHours: Math.round(totalMinutes / 6) / 10 },
      sessions: sessions.map((s) => ({
        ...s.session,
        collaboratorName: s.collaborator ? `${s.collaborator.firstName} ${s.collaborator.lastName}` : "—",
        departmentName: s.department?.name ?? null,
      })),
    });
  } catch (e) { next(e); }
});

// Historique d'un collab (RH)
router.get("/attendance/collaborator/:id/history", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const id = String(req.params["id"]);
    const limit = Math.min(Number(req.query["limit"] ?? 60), 365);
    const rows = await db.select().from(attendanceSessionsTable)
      .where(and(eq(attendanceSessionsTable.collaboratorId, id), eq(attendanceSessionsTable.organizationId, orgId)))
      .orderBy(desc(attendanceSessionsTable.workDate))
      .limit(limit);
    const records = rows.length
      ? await db.select().from(attendanceRecordsTable)
          .where(and(
            eq(attendanceRecordsTable.organizationId, orgId),
            eq(attendanceRecordsTable.collaboratorId, id),
            gte(attendanceRecordsTable.occurredAt, new Date(Date.now() - limit * 24 * 3600 * 1000)),
          ))
          .orderBy(desc(attendanceRecordsTable.occurredAt))
      : [];
    res.json({ sessions: rows, records });
  } catch (e) { next(e); }
});

// Anomalies
router.get("/attendance/anomalies", requirePermission("attendance.view_anomalies"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const resolved = req.query["resolved"] === "true";
    const rows = await db.select({
      flag: attendanceFlagsTable,
      collaborator: collaboratorsTable,
    })
      .from(attendanceFlagsTable)
      .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceFlagsTable.collaboratorId))
      .where(and(eq(attendanceFlagsTable.organizationId, orgId), eq(attendanceFlagsTable.isResolved, resolved)))
      .orderBy(desc(attendanceFlagsTable.createdAt))
      .limit(200);
    res.json({
      data: rows.map((r) => ({
        ...r.flag,
        collaboratorName: r.collaborator ? `${r.collaborator.firstName} ${r.collaborator.lastName}` : "—",
      })),
    });
  } catch (e) { next(e); }
});

// Résoudre une anomalie
router.post("/attendance/anomalies/:id/resolve", requirePermission("attendance.manage"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const id = String(req.params["id"]);
    const result = await db.update(attendanceFlagsTable)
      .set({ isResolved: true, resolvedAt: new Date(), resolvedById: userId })
      .where(and(eq(attendanceFlagsTable.id, id), eq(attendanceFlagsTable.organizationId, orgId)))
      .returning();
    if (!result[0]) return res.status(404).json({ error: "not_found" });
    res.json(result[0]);
  } catch (e) { next(e); }
});

// Job (manuel) de détection d'oublis : à appeler sur cron côté infra
router.post("/attendance/scan-anomalies", requirePermission("attendance.manage"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const yISO = todayISO(yesterday);
    const stale = await db.select().from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.organizationId, orgId),
        eq(attendanceSessionsTable.workDate, yISO),
        eq(attendanceSessionsTable.status, "open"),
      ));
    let created = 0;
    for (const s of stale) {
      const exists = await db.select().from(attendanceFlagsTable)
        .where(and(eq(attendanceFlagsTable.sessionId, s.id), eq(attendanceFlagsTable.kind, "missing_clock_out")))
        .limit(1);
      if (!exists[0]) {
        await db.insert(attendanceFlagsTable).values({
          organizationId: orgId, collaboratorId: s.collaboratorId, sessionId: s.id,
          kind: "missing_clock_out", severity: "high", workDate: s.workDate,
          description: "Aucun pointage de départ enregistré pour la journée.",
        });
        created++;
      }
    }
    res.json({ scanned: stale.length, flagged: created });
  } catch (e) { next(e); }
});

// ── T005 : Résumé présences pour la Paie ─────────────────────────
router.get("/attendance/payroll-summary", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const period = String(req.query["period"] ?? new Date().toISOString().slice(0, 7));
    const match = /^(\d{4})-(\d{2})$/.exec(period);
    if (!match) return res.status(400).json({ error: "Format invalide. Utilisez YYYY-MM." });
    const year = parseInt(match[1]!), month = parseInt(match[2]!);
    const startDate = `${period}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${period}-${String(lastDay).padStart(2, "0")}`;

    const sessions = await db.select({
      collaboratorId: attendanceSessionsTable.collaboratorId,
      effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
      status: attendanceSessionsTable.status,
      isLate: attendanceSessionsTable.isLate,
    })
      .from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.organizationId, orgId),
        gte(attendanceSessionsTable.workDate, startDate),
        lte(attendanceSessionsTable.workDate, endDate),
      ));

    const map = new Map<string, { effectiveMinutes: number; workDays: number; lateDays: number }>();
    for (const s of sessions) {
      const e = map.get(s.collaboratorId) ?? { effectiveMinutes: 0, workDays: 0, lateDays: 0 };
      e.effectiveMinutes += s.effectiveMinutes ?? 0;
      if (s.status === "closed") e.workDays++;
      if (s.isLate) e.lateDays++;
      map.set(s.collaboratorId, e);
    }

    const ids = [...map.keys()];
    const collabs = ids.length
      ? await db.select({ id: collaboratorsTable.id, firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName, baseSalary: collaboratorsTable.baseSalary })
          .from(collaboratorsTable).where(inArray(collaboratorsTable.id, ids))
      : [];
    const nameMap = new Map(collabs.map(c => [c.id, { name: `${c.firstName} ${c.lastName}`, baseSalary: c.baseSalary }]));

    const data = [...map.entries()].map(([collaboratorId, stats]) => ({
      collaboratorId,
      collaboratorName: nameMap.get(collaboratorId)?.name ?? collaboratorId,
      baseSalary: nameMap.get(collaboratorId)?.baseSalary ?? 0,
      effectiveMinutes: stats.effectiveMinutes,
      effectiveHours: Math.round(stats.effectiveMinutes / 6) / 10,
      workDays: stats.workDays,
      lateDays: stats.lateDays,
    }));

    res.json({ period, data });
  } catch (e) { next(e); }
});

// Users users
const _u = usersTable;
void _u;
const _sql = sql;
void _sql;
const _lte = lte;
void _lte;

export default router;
