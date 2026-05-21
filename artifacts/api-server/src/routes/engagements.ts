import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientServicesTable, serviceSectionsTable, clientsTable,
  tasksTable, usersTable,
} from "@workspace/db";
import { and, eq, isNull, inArray, desc, asc, sql } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { userAccessibleClientIds, userHasClientAccess } from "../lib/rbac/permissions";
import { audit } from "../lib/audit";

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: any) => typeof v === "string" && UUID_RE.test(v);

async function ensureEngagementAccess(req: any, engagementId: string): Promise<{ ok: boolean; engagement?: any; status?: number; error?: string }> {
  if (!isUuid(engagementId)) return { ok: false, status: 400, error: "id invalide" };
  const [eng] = await db.select().from(clientServicesTable).where(and(eq(clientServicesTable.organizationId, req.authUser!.organizationId), eq(clientServicesTable.id, engagementId))).limit(1);
  if (!eng || eng.deletedAt) return { ok: false, status: 404, error: "Engagement introuvable" };
  const allowed = await userHasClientAccess(req.authUser.id, eng.clientId);
  if (!allowed) return { ok: false, status: 403, error: "Accès refusé à cet engagement" };
  return { ok: true, engagement: eng };
}

// ─── ENGAGEMENTS (client_services) ─────────────────────────────────
router.get("/engagements", requirePermission("services.read"), async (req, res) => {
  const { clientId, isRecurring } = req.query as Record<string, string>;
  const accessible = await userAccessibleClientIds(req.authUser!.id);
  const conds: any[] = [eq(clientServicesTable.organizationId, req.authUser!.organizationId), isNull(clientServicesTable.deletedAt)];
  if (accessible !== null) {
    if (accessible.length === 0) return res.json({ data: [] });
    conds.push(inArray(clientServicesTable.clientId, accessible));
  }
  if (clientId && isUuid(clientId)) conds.push(eq(clientServicesTable.clientId, clientId));
  if (isRecurring === "true") conds.push(eq(clientServicesTable.isRecurring, true));
  if (isRecurring === "false") conds.push(eq(clientServicesTable.isRecurring, false));

  const rows = await db.select({
    eng: clientServicesTable,
    clientName: clientsTable.name,
    ownerName: sql<string>`COALESCE(${usersTable.firstName} || ' ' || ${usersTable.lastName}, NULL)`,
  })
    .from(clientServicesTable)
    .leftJoin(clientsTable, eq(clientsTable.id, clientServicesTable.clientId))
    .leftJoin(usersTable, eq(usersTable.id, clientServicesTable.ownerId))
    .where(and(...conds))
    .orderBy(desc(clientServicesTable.createdAt));
  return res.json({
    data: rows.map(r => ({ ...r.eng, clientName: r.clientName, ownerName: r.ownerName })),
  });
});

router.post("/engagements", requirePermission("services.manage"), async (req, res) => {
  const { clientId, name, description, isRecurring, recurrencePattern, ownerId, startDate, endDate, status, catalogId } = req.body || {};
  if (!isUuid(clientId)) return res.status(400).json({ error: "clientId requis" });
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name requis" });
  const allowed = await userHasClientAccess(req.authUser!.id, clientId);
  if (!allowed) return res.status(403).json({ error: "Accès refusé à ce client" });
  const [created] = await db.insert(clientServicesTable).values({
      organizationId: req.authUser!.organizationId,
    clientId, name, description: description || null,
    isRecurring: !!isRecurring,
    recurrencePattern: recurrencePattern || null,
    ownerId: isUuid(ownerId) ? ownerId : null,
    startDate: startDate || null, endDate: endDate || null,
    status: status || "active",
    catalogId: isUuid(catalogId) ? catalogId : null,
  }).returning();
  await audit(req, "create", { entityType: "engagement", entityId: created.id, payload: { name, clientId } });
  return res.status(201).json(created);
});

router.get("/engagements/:id", requirePermission("services.read"), async (req, res) => {
  const check = await ensureEngagementAccess(req, req.params.id);
  if (!check.ok) return res.status(check.status!).json({ error: check.error });
  const eng = check.engagement;
  const sections = await db.select().from(serviceSectionsTable)
    .where(eq(serviceSectionsTable.clientServiceId, eng.id))
    .orderBy(asc(serviceSectionsTable.position));
  const tasks = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.serviceId, eng.id), isNull(tasksTable.deletedAt)))
    .orderBy(asc(tasksTable.createdAt));
  const [client] = await db.select({ id: clientsTable.id, name: clientsTable.name })
    .from(clientsTable).where(eq(clientsTable.id, eng.clientId)).limit(1);
  return res.json({ ...eng, client, sections, tasks });
});

router.put("/engagements/:id", requirePermission("services.manage"), async (req, res) => {
  const check = await ensureEngagementAccess(req, req.params.id);
  if (!check.ok) return res.status(check.status!).json({ error: check.error });
  const { name, description, isRecurring, recurrencePattern, ownerId, startDate, endDate, status } = req.body || {};
  const patch: any = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (isRecurring !== undefined) patch.isRecurring = !!isRecurring;
  if (recurrencePattern !== undefined) patch.recurrencePattern = recurrencePattern;
  if (ownerId !== undefined) patch.ownerId = isUuid(ownerId) ? ownerId : null;
  if (startDate !== undefined) patch.startDate = startDate;
  if (endDate !== undefined) patch.endDate = endDate;
  if (status !== undefined) patch.status = status;
  const [updated] = await db.update(clientServicesTable).set(patch)
    .where(and(eq(clientServicesTable.organizationId, req.authUser!.organizationId), eq(clientServicesTable.id, req.params.id))).returning();
  await audit(req, "update", { entityType: "engagement", entityId: req.params.id, payload: patch });
  return res.json(updated);
});

router.delete("/engagements/:id", requirePermission("services.manage"), async (req, res) => {
  const check = await ensureEngagementAccess(req, req.params.id);
  if (!check.ok) return res.status(check.status!).json({ error: check.error });
  await db.update(clientServicesTable).set({ deletedAt: new Date() })
    .where(and(eq(clientServicesTable.organizationId, req.authUser!.organizationId), eq(clientServicesTable.id, req.params.id)));
  await audit(req, "delete", { entityType: "engagement", entityId: req.params.id });
  return res.status(204).send();
});

// ─── SECTIONS ──────────────────────────────────────────────────────
router.post("/engagements/:id/sections", requirePermission("services.manage"), async (req, res) => {
  const check = await ensureEngagementAccess(req, req.params.id);
  if (!check.ok) return res.status(check.status!).json({ error: check.error });
  const { name, position } = req.body || {};
  if (!name) return res.status(400).json({ error: "name requis" });
  const [created] = await db.insert(serviceSectionsTable).values({
      organizationId: req.authUser!.organizationId,
    clientServiceId: req.params.id, name,
    position: typeof position === "number" ? position : 0,
  }).returning();
  return res.status(201).json(created);
});

router.put("/sections/:id", requirePermission("services.manage"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const [section] = await db.select().from(serviceSectionsTable).where(and(eq(serviceSectionsTable.organizationId, req.authUser!.organizationId), eq(serviceSectionsTable.id, req.params.id))).limit(1);
  if (!section) return res.status(404).json({ error: "Introuvable" });
  const check = await ensureEngagementAccess(req, section.clientServiceId);
  if (!check.ok) return res.status(check.status!).json({ error: check.error });
  const patch: any = {};
  if (req.body?.name !== undefined) patch.name = req.body.name;
  if (req.body?.position !== undefined) patch.position = req.body.position;
  const [updated] = await db.update(serviceSectionsTable).set(patch)
    .where(eq(serviceSectionsTable.id, req.params.id)).returning();
  return res.json(updated);
});

router.delete("/sections/:id", requirePermission("services.manage"), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "id invalide" });
  const [section] = await db.select().from(serviceSectionsTable).where(and(eq(serviceSectionsTable.organizationId, req.authUser!.organizationId), eq(serviceSectionsTable.id, req.params.id))).limit(1);
  if (!section) return res.status(404).json({ error: "Introuvable" });
  const check = await ensureEngagementAccess(req, section.clientServiceId);
  if (!check.ok) return res.status(check.status!).json({ error: check.error });
  // Détacher les tâches puis supprimer.
  await db.update(tasksTable).set({ sectionId: null }).where(eq(tasksTable.sectionId, req.params.id));
  await db.delete(serviceSectionsTable).where(eq(serviceSectionsTable.id, req.params.id));
  return res.status(204).send();
});

// ─── TÂCHES D'ENGAGEMENT ───────────────────────────────────────────
router.post("/engagements/:id/tasks", requirePermission("services.manage"), async (req, res) => {
  const check = await ensureEngagementAccess(req, req.params.id);
  if (!check.ok) return res.status(check.status!).json({ error: check.error });
  const { title, description, status, priority, assigneeId, parentTaskId, sectionId, dueDate } = req.body || {};
  if (!title) return res.status(400).json({ error: "title requis" });

  // Intégrité : sectionId doit appartenir à cet engagement.
  let validSectionId: string | null = null;
  if (isUuid(sectionId)) {
    const [sec] = await db.select().from(serviceSectionsTable).where(eq(serviceSectionsTable.id, sectionId)).limit(1);
    if (!sec || sec.clientServiceId !== req.params.id) {
      return res.status(400).json({ error: "Section invalide pour cet engagement" });
    }
    validSectionId = sec.id;
  }
  // Intégrité : parentTaskId doit appartenir à cet engagement.
  let validParentId: string | null = null;
  if (isUuid(parentTaskId)) {
    const [pt] = await db.select().from(tasksTable).where(eq(tasksTable.id, parentTaskId)).limit(1);
    if (!pt || pt.serviceId !== req.params.id) {
      return res.status(400).json({ error: "Tâche parente invalide pour cet engagement" });
    }
    validParentId = pt.id;
  }

  const [created] = await db.insert(tasksTable).values({
      organizationId: req.authUser!.organizationId,
    title, description: description || null,
    status: status || "todo",
    priority: priority || "medium",
    serviceId: req.params.id,
    sectionId: validSectionId,
    assigneeId: isUuid(assigneeId) ? assigneeId : null,
    parentTaskId: validParentId,
    dueDate: dueDate || null,
  }).returning();
  await audit(req, "create", { entityType: "task", entityId: created.id, payload: { engagementId: req.params.id, title } });
  return res.status(201).json(created);
});

export default router;
