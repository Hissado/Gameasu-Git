import { Router } from "express";
import { db } from "@workspace/db";
import {
  timesheetWeeksTable, timesheetEntriesTable,
  collaboratorsTable, projectsTable, clientsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, isNull, lte, sql, asc } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requirePermission } from "../middlewares/permissions";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod/v4";
import ExcelJS from "exceljs";

const router = Router();
router.use(requireAuth);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveCollaborator(userId: string) {
  const [c] = await db.select({ id: collaboratorsTable.id, firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName })
    .from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.userId, userId), isNull(collaboratorsTable.deletedAt)))
    .limit(1);
  return c ?? null;
}

/** Monday of the ISO week containing `dateStr` (YYYY-MM-DD) */
function toWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/** Recompute totalMinutes / billableMinutes from entries then update the week row */
async function recomputeWeekTotals(weekId: string) {
  const entries = await db.select({
    durationMinutes: timesheetEntriesTable.durationMinutes,
    billable: timesheetEntriesTable.billable,
  }).from(timesheetEntriesTable).where(eq(timesheetEntriesTable.weekId, weekId));

  const totalMinutes = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  const billableMinutes = entries.filter(e => e.billable).reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  await db.update(timesheetWeeksTable).set({ totalMinutes, billableMinutes }).where(eq(timesheetWeeksTable.id, weekId));
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60), min = m % 60;
  return `${h}h${min > 0 ? String(min).padStart(2, "0") : ""}`;
}

// ─── GET /timesheets/weeks — list weeks (filtres: collaboratorId, from, to, status) ─────

router.get("/timesheets/weeks", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const { collaboratorId, from, to, status, mine } = req.query as Record<string, string>;

    let targetCollabId: string | null = null;

    if (mine === "true") {
      const collab = await resolveCollaborator(userId);
      if (!collab) return res.json({ data: [] });
      targetCollabId = collab.id;
    } else if (collaboratorId) {
      targetCollabId = collaboratorId;
    }

    const conds = [eq(timesheetWeeksTable.organizationId, orgId)];
    if (targetCollabId) conds.push(eq(timesheetWeeksTable.collaboratorId, targetCollabId));
    if (from) conds.push(gte(timesheetWeeksTable.weekStart, from));
    if (to) conds.push(lte(timesheetWeeksTable.weekStart, to));
    if (status) conds.push(eq(timesheetWeeksTable.status, status));

    const weeks = await db.select({
      week: timesheetWeeksTable,
      collabFirst: collaboratorsTable.firstName,
      collabLast: collaboratorsTable.lastName,
      reviewerFirst: usersTable.firstName,
      reviewerLast: usersTable.lastName,
    })
      .from(timesheetWeeksTable)
      .leftJoin(collaboratorsTable, eq(timesheetWeeksTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(usersTable, eq(timesheetWeeksTable.reviewedById, usersTable.id))
      .where(and(...conds))
      .orderBy(desc(timesheetWeeksTable.weekStart), collaboratorsTable.lastName);

    return res.json({
      data: weeks.map(w => ({
        ...w.week,
        collaboratorName: `${w.collabFirst ?? ""} ${w.collabLast ?? ""}`.trim(),
        reviewerName: w.reviewerFirst ? `${w.reviewerFirst} ${w.reviewerLast ?? ""}`.trim() : null,
      })),
    });
  } catch (e) { next(e); }
});

// ─── GET /timesheets/weeks/:id/entries — entries for one week ────────────────

router.get("/timesheets/weeks/:id/entries", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });
    const weekId = req.params["id"] as string;

    const [week] = await db.select().from(timesheetWeeksTable)
      .where(and(eq(timesheetWeeksTable.id, weekId), eq(timesheetWeeksTable.organizationId, orgId)))
      .limit(1);
    if (!week) return res.status(404).json({ error: "not_found" });

    const entries = await db.select({
      entry: timesheetEntriesTable,
      projectName: projectsTable.name,
      clientName: clientsTable.name,
    })
      .from(timesheetEntriesTable)
      .leftJoin(projectsTable, eq(timesheetEntriesTable.projectId, projectsTable.id))
      .leftJoin(clientsTable, eq(timesheetEntriesTable.clientId, clientsTable.id))
      .where(eq(timesheetEntriesTable.weekId, weekId))
      .orderBy(asc(timesheetEntriesTable.entryDate));

    return res.json({
      week,
      entries: entries.map(e => ({
        ...e.entry,
        projectName: e.projectName ?? null,
        clientName: e.clientName ?? null,
      })),
    });
  } catch (e) { next(e); }
});

// ─── POST /timesheets/entries — create or upsert an entry ───────────────────

const entrySchema = z.object({
  entryDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId:       z.string().uuid().nullish(),
  clientId:        z.string().uuid().nullish(),
  durationMinutes: z.number().int().min(0).max(1440),
  description:     z.string().max(2000).nullish(),
  billable:        z.boolean().default(true),
});

router.post("/timesheets/entries", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const collab = await resolveCollaborator(userId);
    if (!collab) return res.status(404).json({ error: "no_collaborator_linked" });

    const body = entrySchema.parse(req.body);
    const weekStart = toWeekStart(body.entryDate);

    // Upsert the week row
    const [week] = await db.insert(timesheetWeeksTable)
      .values({ organizationId: orgId, collaboratorId: collab.id, userId, weekStart, status: "draft" })
      .onConflictDoUpdate({ target: [timesheetWeeksTable.collaboratorId, timesheetWeeksTable.weekStart], set: { updatedAt: new Date() } })
      .returning();

    if (week.status === "submitted" || week.status === "approved") {
      return res.status(409).json({ error: "week_locked", message: "Cette semaine est soumise ou approuvée — aucune modification possible." });
    }

    const [entry] = await db.insert(timesheetEntriesTable).values({
      organizationId: orgId,
      weekId: week.id,
      collaboratorId: collab.id,
      entryDate: body.entryDate,
      projectId: body.projectId ?? null,
      clientId: body.clientId ?? null,
      durationMinutes: body.durationMinutes,
      description: body.description ?? null,
      billable: body.billable,
    }).returning();

    await recomputeWeekTotals(week.id);
    return res.status(201).json({ entry, weekId: week.id });
  } catch (e) { next(e); }
});

// ─── PATCH /timesheets/entries/:id ──────────────────────────────────────────

router.patch("/timesheets/entries/:id", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const collab = await resolveCollaborator(userId);
    if (!collab) return res.status(404).json({ error: "no_collaborator_linked" });

    const entryId = req.params["id"] as string;
    const [existing] = await db.select({ weekId: timesheetEntriesTable.weekId, collaboratorId: timesheetEntriesTable.collaboratorId })
      .from(timesheetEntriesTable)
      .where(and(eq(timesheetEntriesTable.id, entryId), eq(timesheetEntriesTable.organizationId, orgId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.collaboratorId !== collab.id) return res.status(403).json({ error: "forbidden" });

    const [week] = await db.select({ status: timesheetWeeksTable.status }).from(timesheetWeeksTable).where(eq(timesheetWeeksTable.id, existing.weekId)).limit(1);
    if (week?.status === "submitted" || week?.status === "approved") {
      return res.status(409).json({ error: "week_locked" });
    }

    const body = entrySchema.partial().parse(req.body);
    const [updated] = await db.update(timesheetEntriesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(timesheetEntriesTable.id, entryId))
      .returning();

    await recomputeWeekTotals(existing.weekId);
    return res.json(updated);
  } catch (e) { next(e); }
});

// ─── DELETE /timesheets/entries/:id ─────────────────────────────────────────

router.delete("/timesheets/entries/:id", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const collab = await resolveCollaborator(userId);
    if (!collab) return res.status(404).json({ error: "no_collaborator_linked" });

    const entryId = req.params["id"] as string;
    const [existing] = await db.select({ weekId: timesheetEntriesTable.weekId, collaboratorId: timesheetEntriesTable.collaboratorId })
      .from(timesheetEntriesTable)
      .where(and(eq(timesheetEntriesTable.id, entryId), eq(timesheetEntriesTable.organizationId, orgId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.collaboratorId !== collab.id) return res.status(403).json({ error: "forbidden" });

    await db.delete(timesheetEntriesTable).where(eq(timesheetEntriesTable.id, entryId));
    await recomputeWeekTotals(existing.weekId);
    return res.status(204).send();
  } catch (e) { next(e); }
});

// ─── POST /timesheets/weeks/:id/submit ──────────────────────────────────────

router.post("/timesheets/weeks/:id/submit", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const collab = await resolveCollaborator(userId);
    if (!collab) return res.status(404).json({ error: "no_collaborator_linked" });

    const weekId = req.params["id"] as string;
    const [week] = await db.select().from(timesheetWeeksTable)
      .where(and(eq(timesheetWeeksTable.id, weekId), eq(timesheetWeeksTable.organizationId, orgId), eq(timesheetWeeksTable.collaboratorId, collab.id)))
      .limit(1);
    if (!week) return res.status(404).json({ error: "not_found" });
    if (week.status !== "draft" && week.status !== "rejected") {
      return res.status(409).json({ error: "cannot_submit", message: `Statut actuel : ${week.status}` });
    }

    const [updated] = await db.update(timesheetWeeksTable)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(eq(timesheetWeeksTable.id, weekId))
      .returning();
    return res.json(updated);
  } catch (e) { next(e); }
});

// ─── PATCH /timesheets/weeks/:id/review — approve or reject (manager) ───────

const reviewSchema = z.object({
  action:  z.enum(["approved", "rejected"]),
  comment: z.string().max(1000).optional(),
});

router.patch("/timesheets/weeks/:id/review", requirePermission("attendance.manage"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const weekId = req.params["id"] as string;
    const body = reviewSchema.parse(req.body);

    const [week] = await db.select().from(timesheetWeeksTable)
      .where(and(eq(timesheetWeeksTable.id, weekId), eq(timesheetWeeksTable.organizationId, orgId)))
      .limit(1);
    if (!week) return res.status(404).json({ error: "not_found" });
    if (week.status !== "submitted") {
      return res.status(409).json({ error: "not_submitted", message: "La semaine doit être soumise avant d'être examinée." });
    }

    const [updated] = await db.update(timesheetWeeksTable)
      .set({ status: body.action, reviewedAt: new Date(), reviewedById: userId, reviewComment: body.comment ?? null })
      .where(eq(timesheetWeeksTable.id, weekId))
      .returning();
    return res.json(updated);
  } catch (e) { next(e); }
});

// ─── GET /timesheets/summary — récap par collaborateur sur une période ───────

router.get("/timesheets/summary", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const { from, to } = req.query as Record<string, string>;
    const conds = [eq(timesheetWeeksTable.organizationId, orgId)];
    if (from) conds.push(gte(timesheetWeeksTable.weekStart, from));
    if (to)   conds.push(lte(timesheetWeeksTable.weekStart, to));

    const weeks = await db.select({
      collaboratorId:  timesheetWeeksTable.collaboratorId,
      totalMinutes:    timesheetWeeksTable.totalMinutes,
      billableMinutes: timesheetWeeksTable.billableMinutes,
      status:          timesheetWeeksTable.status,
      firstName:       collaboratorsTable.firstName,
      lastName:        collaboratorsTable.lastName,
    })
      .from(timesheetWeeksTable)
      .leftJoin(collaboratorsTable, eq(timesheetWeeksTable.collaboratorId, collaboratorsTable.id))
      .where(and(...conds));

    type SummaryRow = { collaboratorId: string; name: string; totalMinutes: number; billableMinutes: number; nonBillableMinutes: number; weekCount: number; approvedWeeks: number };
    const map = new Map<string, SummaryRow>();
    for (const w of weeks) {
      const key = w.collaboratorId;
      const e = map.get(key) ?? { collaboratorId: key, name: `${w.firstName ?? ""} ${w.lastName ?? ""}`.trim(), totalMinutes: 0, billableMinutes: 0, nonBillableMinutes: 0, weekCount: 0, approvedWeeks: 0 };
      e.totalMinutes    += w.totalMinutes ?? 0;
      e.billableMinutes += w.billableMinutes ?? 0;
      e.nonBillableMinutes = e.totalMinutes - e.billableMinutes;
      e.weekCount++;
      if (w.status === "approved") e.approvedWeeks++;
      map.set(key, e);
    }

    return res.json({ data: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (e) { next(e); }
});

// ─── GET /timesheets/export — Excel export ────────────────────────────────

router.get("/timesheets/export", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const { from, to, collaboratorId } = req.query as Record<string, string>;

    // Load weeks + entries
    const weekConds = [eq(timesheetWeeksTable.organizationId, orgId)];
    if (from) weekConds.push(gte(timesheetWeeksTable.weekStart, from));
    if (to)   weekConds.push(lte(timesheetWeeksTable.weekStart, to));
    if (collaboratorId) weekConds.push(eq(timesheetWeeksTable.collaboratorId, collaboratorId));

    const weeks = await db.select({ week: timesheetWeeksTable, firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName })
      .from(timesheetWeeksTable)
      .leftJoin(collaboratorsTable, eq(timesheetWeeksTable.collaboratorId, collaboratorsTable.id))
      .where(and(...weekConds));

    const weekIds = weeks.map(w => w.week.id);
    const entries = weekIds.length
      ? await db.select({ e: timesheetEntriesTable, projectName: projectsTable.name, clientName: clientsTable.name })
          .from(timesheetEntriesTable)
          .leftJoin(projectsTable, eq(timesheetEntriesTable.projectId, projectsTable.id))
          .leftJoin(clientsTable, eq(timesheetEntriesTable.clientId, clientsTable.id))
          .where(inArray(timesheetEntriesTable.weekId, weekIds))
          .orderBy(asc(timesheetEntriesTable.entryDate))
      : [];

    const wb = new ExcelJS.Workbook();
    wb.creator = "Gaméasù";

    const ORANGE = "FFF37021";
    const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };

    function addSheet(name: string, cols: string[], rows: (string | number)[][]) {
      const ws = wb.addWorksheet(name);
      ws.addRow(cols);
      const hRow = ws.getRow(1);
      hRow.eachCell(cell => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.border = { bottom: { style: "thin", color: { argb: "FFD46000" } } };
      });
      hRow.height = 20;
      rows.forEach(r => ws.addRow(r));
      ws.columns.forEach(c => { c.width = Math.max(12, ...(c.values ?? []).map(v => String(v ?? "").length)); });
    }

    // Sheet 1 — Entrées détaillées
    const entryRows = entries.map(e => {
      const weekRow = weeks.find(w => w.week.id === e.e.weekId);
      return [
        `${weekRow?.firstName ?? ""} ${weekRow?.lastName ?? ""}`.trim(),
        e.e.entryDate,
        e.clientName ?? "—",
        e.projectName ?? "—",
        fmtMinutes(e.e.durationMinutes ?? 0),
        e.e.billable ? "Oui" : "Non",
        e.e.description ?? "",
      ];
    });
    addSheet("Entrées détaillées", ["Collaborateur", "Date", "Client", "Projet", "Durée", "Facturable", "Description"], entryRows);

    // Sheet 2 — Par collaborateur
    type CollabAgg = { name: string; total: number; billable: number };
    const byCollab = new Map<string, CollabAgg>();
    entries.forEach(e => {
      const w = weeks.find(wk => wk.week.id === e.e.weekId);
      const name = `${w?.firstName ?? ""} ${w?.lastName ?? ""}`.trim();
      const agg = byCollab.get(name) ?? { name, total: 0, billable: 0 };
      agg.total += e.e.durationMinutes ?? 0;
      if (e.e.billable) agg.billable += e.e.durationMinutes ?? 0;
      byCollab.set(name, agg);
    });
    addSheet("Par collaborateur",
      ["Collaborateur", "Total heures", "Heures facturables", "Heures non facturables"],
      [...byCollab.values()].map(a => [a.name, fmtMinutes(a.total), fmtMinutes(a.billable), fmtMinutes(a.total - a.billable)]),
    );

    // Sheet 3 — Par projet
    type ProjAgg = { name: string; total: number; billable: number };
    const byProject = new Map<string, ProjAgg>();
    entries.forEach(e => {
      const name = e.projectName ?? "Sans projet";
      const agg = byProject.get(name) ?? { name, total: 0, billable: 0 };
      agg.total += e.e.durationMinutes ?? 0;
      if (e.e.billable) agg.billable += e.e.durationMinutes ?? 0;
      byProject.set(name, agg);
    });
    addSheet("Par projet",
      ["Projet", "Total heures", "Heures facturables", "Heures non facturables"],
      [...byProject.values()].map(a => [a.name, fmtMinutes(a.total), fmtMinutes(a.billable), fmtMinutes(a.total - a.billable)]),
    );

    // Sheet 4 — Par client
    type ClientAgg = { name: string; total: number; billable: number };
    const byClient = new Map<string, ClientAgg>();
    entries.forEach(e => {
      const name = e.clientName ?? "Sans client";
      const agg = byClient.get(name) ?? { name, total: 0, billable: 0 };
      agg.total += e.e.durationMinutes ?? 0;
      if (e.e.billable) agg.billable += e.e.durationMinutes ?? 0;
      byClient.set(name, agg);
    });
    addSheet("Par client",
      ["Client", "Total heures", "Heures facturables", "Heures non facturables"],
      [...byClient.values()].map(a => [a.name, fmtMinutes(a.total), fmtMinutes(a.billable), fmtMinutes(a.total - a.billable)]),
    );

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="feuilles-de-temps-${from ?? "all"}-${to ?? "all"}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

// ─── GET /timesheets/projects-clients — lists for selects ────────────────────

router.get("/timesheets/projects-clients", requirePermission("attendance.clock"), async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = await getCurrentOrganizationId(userId);
    if (!orgId) return res.status(403).json({ error: "no_organization" });

    const [projects, clients] = await Promise.all([
      db.select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status })
        .from(projectsTable)
        .where(and(eq(projectsTable.organizationId, orgId), isNull(projectsTable.deletedAt as any)))
        .orderBy(asc(projectsTable.name)),
      db.select({ id: clientsTable.id, name: clientsTable.name })
        .from(clientsTable)
        .where(eq(clientsTable.organizationId, orgId))
        .orderBy(asc(clientsTable.name)),
    ]);
    return res.json({ projects, clients });
  } catch (e) { next(e); }
});

// Unused imports suppression
void sql;

export default router;
