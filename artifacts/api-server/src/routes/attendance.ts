import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  attendanceSessionsTable, attendanceRecordsTable, attendanceFlagsTable,
  attendanceCorrectionsTable,
  collaboratorsTable, departmentsTable, usersTable, notificationsTable,
  clockEventSchema,
} from "@workspace/db";
import { and, desc, eq, gte, lte, sql, isNull, inArray } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requirePermission } from "../middlewares/permissions";
import { emitToUser } from "../lib/realtime";
import { z } from "zod/v4";

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
  const overtimeMinutes = Math.max(0, effectiveMinutes - (s.expectedMinutes ?? 480));
  await db.update(attendanceSessionsTable).set({
    clockInAt: clockIn,
    clockOutAt: clockOut,
    totalMinutes,
    breakMinutes,
    effectiveMinutes,
    overtimeMinutes,
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
    // expectedMinutes : dérivé de weeklyHours du collaborateur (supposé 5j/semaine)
    // → weeklyHours / 5 × 60. Défaut 40h/semaine = 480 min/jour.
    const weeklyH = parseFloat(String(collab.weeklyHours ?? "40"));
    const expectedMinutes = Math.round((weeklyH / 5) * 60);
    const [created] = await db.insert(attendanceSessionsTable).values({
      organizationId: orgId,
      collaboratorId: collab.id,
      userId,
      departmentId: collab.departmentId,
      projectId: body.projectId ?? null,
      workDate,
      status: "open",
      expectedMinutes,
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
    let flagged = 0;
    let closed = 0;
    for (const s of stale) {
      // Créer le flag missing_clock_out si inexistant
      const [existingFlag] = await db.select().from(attendanceFlagsTable)
        .where(and(eq(attendanceFlagsTable.sessionId, s.id), eq(attendanceFlagsTable.kind, "missing_clock_out")))
        .limit(1);
      if (!existingFlag) {
        await db.insert(attendanceFlagsTable).values({
          organizationId: orgId, collaboratorId: s.collaboratorId, sessionId: s.id,
          kind: "missing_clock_out", severity: "high", workDate: s.workDate,
          description: "Aucun pointage de départ enregistré pour la journée.",
        });
        flagged++;
      }

      // Clôturer la session périmée si elle a un clock_in
      // → insère un clock_out synthétique en fin de journée standard (17h UTC)
      // → recompute overtime pour que les totaux soient persistés en DB
      const [clockInRecord] = await db.select({ id: attendanceRecordsTable.id })
        .from(attendanceRecordsTable)
        .where(and(
          eq(attendanceRecordsTable.sessionId, s.id),
          eq(attendanceRecordsTable.kind, "clock_in"),
        ))
        .limit(1);
      if (clockInRecord) {
        const [alreadyClockOut] = await db.select({ id: attendanceRecordsTable.id })
          .from(attendanceRecordsTable)
          .where(and(eq(attendanceRecordsTable.sessionId, s.id), eq(attendanceRecordsTable.kind, "clock_out")))
          .limit(1);
        if (!alreadyClockOut) {
          // Fin de journée standard : workDate à 17:00 UTC
          const syntheticClockOut = new Date(`${s.workDate}T17:00:00.000Z`);
          await db.insert(attendanceRecordsTable).values({
            organizationId: orgId,
            sessionId: s.id,
            collaboratorId: s.collaboratorId,
            kind: "clock_out",
            occurredAt: syntheticClockOut,
            comment: "Pointage de départ automatique — session oubliée (scan anomalies)",
            status: "synthetic",
            source: "system",
          });
        }
        await db.update(attendanceSessionsTable)
          .set({ status: "closed" })
          .where(eq(attendanceSessionsTable.id, s.id));
        // Recompute overtimeMinutes et effectiveMinutes avec le clock_out synthétique
        await recomputeSession(s.id);
        closed++;
      }
    }
    res.json({ scanned: stale.length, flagged, closed, message: `${flagged} signalement(s) créé(s), ${closed} session(s) clôturée(s)` });
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

// ── Corrections de pointage ──────────────────────────────────────────────────

// GET corrections (manager: toutes; collab: les siennes)
router.get("/attendance/corrections", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const isManager = req.authUser!.role !== "collaborator";
    if (isManager) {
      const rows = await db.select({
        correction: attendanceCorrectionsTable,
        collaborator: { firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName },
        workDate: attendanceSessionsTable.workDate,
      })
        .from(attendanceCorrectionsTable)
        .leftJoin(collaboratorsTable, eq(collaboratorsTable.id, attendanceCorrectionsTable.collaboratorId))
        .leftJoin(attendanceSessionsTable, eq(attendanceSessionsTable.id, attendanceCorrectionsTable.sessionId))
        .where(eq(attendanceCorrectionsTable.organizationId, orgId))
        .orderBy(desc(attendanceCorrectionsTable.createdAt))
        .limit(200);
      return res.json({
        data: rows.map(r => ({
          ...r.correction,
          collaboratorName: r.collaborator ? `${r.collaborator.firstName} ${r.collaborator.lastName}` : "—",
          workDate: r.workDate ?? null,
        })),
      });
    } else {
      const collab = await resolveCollaborator(userId);
      if (!collab) return res.json({ data: [] });
      const rows = await db.select({
        correction: attendanceCorrectionsTable,
        workDate: attendanceSessionsTable.workDate,
      })
        .from(attendanceCorrectionsTable)
        .leftJoin(attendanceSessionsTable, eq(attendanceSessionsTable.id, attendanceCorrectionsTable.sessionId))
        .where(and(eq(attendanceCorrectionsTable.organizationId, orgId), eq(attendanceCorrectionsTable.collaboratorId, collab.id)))
        .orderBy(desc(attendanceCorrectionsTable.createdAt))
        .limit(100);
      return res.json({ data: rows.map(r => ({ ...r.correction, workDate: r.workDate ?? null })) });
    }
  } catch (e) { next(e); }
});

// POST correction (collab soumet une demande)
router.post("/attendance/corrections", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const collab = await resolveCollaborator(userId);
    if (!collab) return res.status(404).json({ error: "no_collaborator_linked" });
    const body = z.object({
      sessionId: z.string().uuid(),
      kind: z.enum(["clock_in", "clock_out", "break", "duration", "other"]),
      currentAt: z.string().optional(), // heure actuellement enregistrée (pour comparaison manager)
      proposedAt: z.string().optional(), // heure que le collaborateur juge correcte
      reason: z.string().min(5).max(1000),
    }).parse(req.body);
    const [session] = await db.select().from(attendanceSessionsTable)
      .where(and(
        eq(attendanceSessionsTable.id, body.sessionId),
        eq(attendanceSessionsTable.collaboratorId, collab.id),
        eq(attendanceSessionsTable.organizationId, orgId),
      ))
      .limit(1);
    if (!session) return res.status(404).json({ error: "session_not_found" });
    const [corr] = await db.insert(attendanceCorrectionsTable).values({
      organizationId: orgId,
      collaboratorId: collab.id,
      sessionId: body.sessionId,
      kind: body.kind,
      currentAt: body.currentAt ? new Date(body.currentAt) : null,
      proposedAt: body.proposedAt ? new Date(body.proposedAt) : null,
      reason: body.reason,
      status: "pending",
    }).returning();
    res.status(201).json(corr);
  } catch (e) { next(e); }
});

// PATCH correction (manager approuve ou rejette)
router.patch("/attendance/corrections/:id", requirePermission("attendance.manage"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const body = z.object({
      status: z.enum(["approved", "rejected"]),
      reviewComment: z.string().max(500).optional(),
    }).parse(req.body);
    const id = String(req.params["id"]);
    const [updated] = await db.update(attendanceCorrectionsTable)
      .set({ status: body.status, reviewerId: userId, reviewedAt: new Date(), reviewComment: body.reviewComment ?? null })
      .where(and(eq(attendanceCorrectionsTable.id, id), eq(attendanceCorrectionsTable.organizationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "not_found" });

    // ── Application de la correction approuvée ────────────────────────────
    if (body.status === "approved" && updated.proposedAt) {
      const note = `Correction approuvée le ${new Date().toLocaleDateString("fr-FR")} — ${updated.reason.slice(0, 200)}`;
      const recordKind = updated.kind === "clock_in" ? "clock_in"
        : updated.kind === "clock_out" ? "clock_out"
        : null;

      if (recordKind) {
        // clock_in / clock_out : mise à jour ou création du record de pointage
        const [existing] = await db.select().from(attendanceRecordsTable)
          .where(and(
            eq(attendanceRecordsTable.sessionId, updated.sessionId),
            eq(attendanceRecordsTable.kind, recordKind),
          ))
          .orderBy(desc(attendanceRecordsTable.occurredAt))
          .limit(1);
        if (existing) {
          await db.update(attendanceRecordsTable)
            .set({ occurredAt: updated.proposedAt, comment: note, status: "corrected" })
            .where(eq(attendanceRecordsTable.id, existing.id));
        } else {
          await db.insert(attendanceRecordsTable).values({
            organizationId: orgId,
            sessionId: updated.sessionId,
            collaboratorId: updated.collaboratorId,
            kind: recordKind,
            occurredAt: updated.proposedAt,
            comment: note,
            status: "corrected",
            source: "manual",
          });
        }
        await recomputeSession(updated.sessionId);
      } else if (updated.kind === "break") {
        // Pause : mettre à jour le dernier break_end (fin de pause corrigée)
        const [lastBreakEnd] = await db.select().from(attendanceRecordsTable)
          .where(and(
            eq(attendanceRecordsTable.sessionId, updated.sessionId),
            eq(attendanceRecordsTable.kind, "break_end"),
          ))
          .orderBy(desc(attendanceRecordsTable.occurredAt))
          .limit(1);
        if (lastBreakEnd) {
          await db.update(attendanceRecordsTable)
            .set({ occurredAt: updated.proposedAt, comment: note, status: "corrected" })
            .where(eq(attendanceRecordsTable.id, lastBreakEnd.id));
        }
        await recomputeSession(updated.sessionId);
      } else {
        // duration / other : recompute pour cohérence
        await recomputeSession(updated.sessionId);
      }
    } else if (body.status === "rejected") {
      // Rejet : pas de modification des records, mais on recompute pour s'assurer
      // que les totaux sont à jour (cas où d'autres corrections auraient été appliquées)
      await recomputeSession(updated.sessionId);
    }

    res.json(updated);
  } catch (e) { next(e); }
});

const _u = usersTable; void _u;
const _sql = sql; void _sql;
const _lte = lte; void _lte;

export default router;
