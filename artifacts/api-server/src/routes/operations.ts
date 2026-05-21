/**
 * Operations Command Center — endpoints multi-secteurs.
 *
 *  - GET    /api/operations/overview               : KPI + alertes + activité récente
 *  - GET    /api/operations/missions               : liste filtrable (status/kind/priority/q)
 *  - POST   /api/operations/missions               : créer
 *  - GET    /api/operations/missions/:id           : détail enrichi (checkins, proofs, incidents, checklists, costs)
 *  - PATCH  /api/operations/missions/:id           : modifier
 *  - DELETE /api/operations/missions/:id           : archiver (soft delete)
 *  - POST   /api/operations/missions/:id/assign    : assigner responsable/équipe/véhicule
 *  - POST   /api/operations/missions/:id/status    : changer statut + horodatage auto
 *  - POST   /api/operations/missions/:id/check-in  : arrivée terrain
 *  - POST   /api/operations/missions/:id/check-out : départ terrain
 *  - POST   /api/operations/missions/:id/proof     : preuve d'exécution
 *  - POST   /api/operations/missions/:id/incident  : ouvrir un incident
 *  - POST   /api/operations/missions/:id/cost      : ajouter un coût
 *  - POST   /api/operations/missions/:id/summary   : générer résumé final
 *  - GET    /api/operations/dispatch               : tableau dispatching + recommandations
 *  - GET    /api/operations/incidents              : liste incidents (filtres)
 *  - PATCH  /api/operations/incidents/:id          : MAJ incident
 *  - GET    /api/operations/checklists/templates   : modèles par défaut
 *  - GET    /api/operations/performance            : KPI agrégés
 *  - GET    /api/operations/map                    : points géolocalisés
 *  - GET    /api/operations/calendar               : missions par date
 *  - GET    /api/operations/playbooks              : playbooks tenant
 *
 * Tous les endpoints sont scoppés par organisation et requièrent
 * `operations.view` au minimum.
 */
import { Router, type IRouter } from "express";
import {
  db,
  operationsMissionsTable,
  operationsMissionStopsTable,
  operationsCheckinsTable,
  operationsProofsTable,
  operationsIncidentsTable,
  operationsChecklistsTable,
  operationsChecklistItemsTable,
  operationsCostsTable,
  operationsPlaybooksTable,
  usersTable,
  clientsTable,
  projectsTable,
  equipmentTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, asc, gte, inArray, ilike, or } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { getCurrentOrganizationId } from "../lib/tenant";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────

const MISSION_KINDS = [
  "delivery", "collect", "transfer", "install",
  "intervention", "supply", "site_visit", "custom",
] as const;

const STATUS_FLOW = [
  "planned", "assigned", "awaiting_departure", "en_route",
  "on_site", "in_progress", "completed", "blocked", "cancelled",
] as const;

const DEFAULT_CHECKLISTS: Record<string, Array<{ phase: string; label: string; required?: boolean }>> = {
  delivery: [
    { phase: "pre_departure", label: "Bon de livraison signé", required: true },
    { phase: "pre_departure", label: "Chargement vérifié", required: true },
    { phase: "pre_departure", label: "Carnet de bord renseigné" },
    { phase: "arrival", label: "Confirmation présence client" },
    { phase: "execution", label: "Déchargement avec client" },
    { phase: "end", label: "Bon de livraison contre-signé", required: true },
    { phase: "end", label: "Photo preuve de livraison", required: true },
    { phase: "return", label: "Retour véhicule au dépôt" },
  ],
  install: [
    { phase: "pre_departure", label: "Outillage embarqué", required: true },
    { phase: "pre_departure", label: "Plans d'installation imprimés" },
    { phase: "arrival", label: "Briefing client" },
    { phase: "execution", label: "Pose réalisée selon plan", required: true },
    { phase: "execution", label: "Test de fonctionnement", required: true },
    { phase: "end", label: "Procès-verbal de réception signé", required: true },
    { phase: "end", label: "Photo avant/après" },
  ],
  collect: [
    { phase: "pre_departure", label: "Bordereau d'enlèvement prêt", required: true },
    { phase: "arrival", label: "Comptage avec client" },
    { phase: "execution", label: "Chargement sécurisé", required: true },
    { phase: "end", label: "Signature bordereau", required: true },
    { phase: "return", label: "Décharge au dépôt" },
  ],
  intervention: [
    { phase: "pre_departure", label: "Diagnostic préalable lu" },
    { phase: "pre_departure", label: "Pièces de rechange embarquées" },
    { phase: "arrival", label: "Accès site validé" },
    { phase: "execution", label: "Mise en sécurité", required: true },
    { phase: "execution", label: "Intervention réalisée", required: true },
    { phase: "end", label: "Rapport d'intervention signé", required: true },
  ],
  transfer: [
    { phase: "pre_departure", label: "Liste de transfert validée", required: true },
    { phase: "arrival", label: "Réception dépôt destination" },
    { phase: "end", label: "Bordereau de transfert signé", required: true },
  ],
  supply: [
    { phase: "pre_departure", label: "Bon de commande joint" },
    { phase: "arrival", label: "Contrôle quantité / qualité", required: true },
    { phase: "end", label: "Bon de réception signé", required: true },
  ],
  site_visit: [
    { phase: "arrival", label: "Pointage GPS" },
    { phase: "execution", label: "Photos site" },
    { phase: "end", label: "Compte-rendu de visite" },
  ],
  custom: [
    { phase: "pre_departure", label: "Briefing mission" },
    { phase: "end", label: "Compte-rendu signé" },
  ],
};

async function buildChecklistsForMission(missionId: string, orgId: string, kind: string) {
  const template = DEFAULT_CHECKLISTS[kind] ?? DEFAULT_CHECKLISTS.custom;
  const byPhase = new Map<string, Array<{ label: string; required?: boolean }>>();
  for (const it of template) {
    if (!byPhase.has(it.phase)) byPhase.set(it.phase, []);
    byPhase.get(it.phase)!.push({ label: it.label, required: it.required });
  }
  for (const [phase, items] of byPhase) {
    const [cl] = await db.insert(operationsChecklistsTable).values({
      organizationId: orgId, missionId, phase,
      title: phaseLabel(phase),
      totalItems: items.length, doneItems: 0, status: "pending",
    }).returning();
    if (cl) {
      await db.insert(operationsChecklistItemsTable).values(
        items.map((it, idx) => ({
          checklistId: cl.id, label: it.label, required: it.required ?? false,
          done: false, ordering: idx,
        })),
      );
    }
  }
}

function phaseLabel(p: string): string {
  return ({
    pre_departure: "Avant départ",
    arrival: "Arrivée sur site",
    execution: "Exécution",
    end: "Fin de mission",
    return: "Retour",
  } as Record<string, string>)[p] ?? p;
}

async function generateReference(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  // Calcule le max numérique existant pour l'année + org (résistant aux trous, pas aux courses concurrentes).
  const rows = await db.select({ ref: operationsMissionsTable.reference })
    .from(operationsMissionsTable)
    .where(and(
      eq(operationsMissionsTable.organizationId, orgId),
      sql`${operationsMissionsTable.reference} like ${`OPS-${year}-%`}`,
    ));
  let max = 0;
  for (const r of rows) {
    const m = /OPS-\d{4}-(\d+)/.exec(r.ref ?? "");
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return `OPS-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function generateReferenceWithRetry(orgId: string, tryCreate: (ref: string) => Promise<boolean>) {
  for (let i = 0; i < 5; i++) {
    const ref = await generateReference(orgId);
    try {
      if (await tryCreate(ref)) return ref;
    } catch (e: any) {
      if (!/duplicate|unique/i.test(e?.message ?? "")) throw e;
    }
  }
  throw new Error("Impossible de générer une référence de mission unique après 5 tentatives.");
}

// ─── Overview ────────────────────────────────────────────────────────

router.get("/operations/overview", requirePermission("operations.view"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.json({ counts: {}, totals: {}, recent: [], alerts: [] });

    const baseOrg = and(eq(operationsMissionsTable.organizationId, orgId), isNull(operationsMissionsTable.deletedAt));

    const statusRows = await db.select({
      status: operationsMissionsTable.status,
      c: sql<number>`count(*)::int`,
    }).from(operationsMissionsTable).where(baseOrg).groupBy(operationsMissionsTable.status);
    const byStatus: Record<string, number> = {};
    for (const r of statusRows) byStatus[r.status] = r.c;

    const kindRows = await db.select({
      kind: operationsMissionsTable.kind,
      c: sql<number>`count(*)::int`,
    }).from(operationsMissionsTable).where(baseOrg).groupBy(operationsMissionsTable.kind);
    const byKind: Record<string, number> = {};
    for (const r of kindRows) byKind[r.kind] = r.c;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const [{ today }] = await db.select({ today: sql<number>`count(*)::int` })
      .from(operationsMissionsTable)
      .where(and(baseOrg, sql`${operationsMissionsTable.scheduledStart} >= ${todayStart}`, sql`${operationsMissionsTable.scheduledStart} <= ${todayEnd}`));

    const [openIncidents] = await db.select({ c: sql<number>`count(*)::int` })
      .from(operationsIncidentsTable)
      .where(and(eq(operationsIncidentsTable.organizationId, orgId), sql`${operationsIncidentsTable.status} in ('open','in_progress')`));

    const recent = await db.select({
      id: operationsMissionsTable.id,
      reference: operationsMissionsTable.reference,
      title: operationsMissionsTable.title,
      kind: operationsMissionsTable.kind,
      status: operationsMissionsTable.status,
      priority: operationsMissionsTable.priority,
      scheduledStart: operationsMissionsTable.scheduledStart,
      destinationAddress: operationsMissionsTable.destinationAddress,
    }).from(operationsMissionsTable).where(baseOrg)
      .orderBy(desc(operationsMissionsTable.createdAt)).limit(10);

    // Alertes : missions en retard de départ ou bloquées
    const lateThreshold = new Date(Date.now() - 30 * 60000);
    const lateRows = await db.select({
      id: operationsMissionsTable.id,
      reference: operationsMissionsTable.reference,
      title: operationsMissionsTable.title,
      scheduledStart: operationsMissionsTable.scheduledStart,
      status: operationsMissionsTable.status,
    }).from(operationsMissionsTable).where(and(
      baseOrg,
      sql`${operationsMissionsTable.scheduledStart} is not null and ${operationsMissionsTable.scheduledStart} < ${lateThreshold}`,
      sql`${operationsMissionsTable.status} in ('planned','assigned','awaiting_departure')`,
    )).limit(20);

    const blockedRows = await db.select({
      id: operationsMissionsTable.id,
      reference: operationsMissionsTable.reference,
      title: operationsMissionsTable.title,
    }).from(operationsMissionsTable).where(and(baseOrg, eq(operationsMissionsTable.status, "blocked"))).limit(20);

    const alerts = [
      ...lateRows.map((r) => ({ kind: "late_departure", missionId: r.id, reference: r.reference, title: r.title, scheduledStart: r.scheduledStart })),
      ...blockedRows.map((r) => ({ kind: "blocked", missionId: r.id, reference: r.reference, title: r.title })),
    ];

    return res.json({
      counts: { byStatus, byKind, today, openIncidents: openIncidents?.c ?? 0 },
      recent, alerts,
    });
  } catch (e) { next(e); }
});

// ─── Missions ────────────────────────────────────────────────────────

router.get("/operations/missions", requirePermission("operations.view"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.json({ data: [], total: 0 });
    const { status, kind, priority, q, responsibleUserId, limit = "50" } = req.query as Record<string, string>;
    const conds: any[] = [eq(operationsMissionsTable.organizationId, orgId), isNull(operationsMissionsTable.deletedAt)];
    if (status) conds.push(eq(operationsMissionsTable.status, status));
    if (kind) conds.push(eq(operationsMissionsTable.kind, kind));
    if (priority) conds.push(eq(operationsMissionsTable.priority, priority));
    if (responsibleUserId) conds.push(eq(operationsMissionsTable.responsibleUserId, responsibleUserId));
    if (q) conds.push(or(
      ilike(operationsMissionsTable.title, `%${q}%`),
      ilike(operationsMissionsTable.reference, `%${q}%`),
      ilike(operationsMissionsTable.destinationAddress, `%${q}%`),
    ));

    const rows = await db.select({
      m: operationsMissionsTable,
      responsibleName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
      clientName: clientsTable.name,
      projectName: projectsTable.name,
      vehicleName: equipmentTable.name,
    }).from(operationsMissionsTable)
      .leftJoin(usersTable, eq(operationsMissionsTable.responsibleUserId, usersTable.id))
      .leftJoin(clientsTable, eq(operationsMissionsTable.clientId, clientsTable.id))
      .leftJoin(projectsTable, eq(operationsMissionsTable.projectId, projectsTable.id))
      .leftJoin(equipmentTable, eq(operationsMissionsTable.vehicleEquipmentId, equipmentTable.id))
      .where(and(...conds))
      .orderBy(desc(operationsMissionsTable.createdAt))
      .limit(Number(limit));

    const data = rows.map((r) => ({
      ...r.m,
      responsibleName: r.responsibleName,
      clientName: r.clientName,
      projectName: r.projectName,
      vehicleName: r.vehicleName,
    }));
    return res.json({ data, total: data.length });
  } catch (e) { next(e); }
});

router.post("/operations/missions", requirePermission("operations.manage"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(400).json({ error: "Organisation introuvable" });

    const body = req.body ?? {};
    const kind = MISSION_KINDS.includes(body.kind) ? body.kind : "custom";
    const reference = await generateReference(orgId);

    const [mission] = await db.insert(operationsMissionsTable).values({
      organizationId: orgId,
      reference,
      kind,
      title: body.title ?? "Nouvelle mission",
      description: body.description,
      priority: body.priority ?? "normal",
      status: "planned",
      clientId: body.clientId || null,
      projectId: body.projectId || null,
      playbookId: body.playbookId || null,
      originAddress: body.originAddress,
      originLat: body.originLat,
      originLng: body.originLng,
      destinationAddress: body.destinationAddress,
      destinationLat: body.destinationLat,
      destinationLng: body.destinationLng,
      scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
      scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
      responsibleUserId: body.responsibleUserId || null,
      teamUserIds: Array.isArray(body.teamUserIds) ? body.teamUserIds : [],
      vehicleEquipmentId: body.vehicleEquipmentId || null,
      payloadJson: Array.isArray(body.payloadJson) ? body.payloadJson : [],
      estimatedCostFcfa: body.estimatedCostFcfa ?? null,
      isBillable: !!body.isBillable,
      tagsJson: Array.isArray(body.tagsJson) ? body.tagsJson : [],
      notes: body.notes,
      createdById: req.authUser!.id,
    }).returning();

    if (mission) await buildChecklistsForMission(mission.id, orgId, kind);
    return res.status(201).json(mission);
  } catch (e) { next(e); }
});

router.get("/operations/missions/:id", requirePermission("operations.view"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const [m] = await db.select().from(operationsMissionsTable)
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)));
    if (!m) return res.status(404).json({ error: "not_found" });

    const [responsible] = m.responsibleUserId ? await db.select({
      id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
    }).from(usersTable).where(eq(usersTable.id, m.responsibleUserId)) : [null];
    const [client] = m.clientId ? await db.select().from(clientsTable).where(eq(clientsTable.id, m.clientId)) : [null];
    const [project] = m.projectId ? await db.select().from(projectsTable).where(eq(projectsTable.id, m.projectId)) : [null];

    const stops = await db.select().from(operationsMissionStopsTable)
      .where(eq(operationsMissionStopsTable.missionId, m.id))
      .orderBy(asc(operationsMissionStopsTable.ordering));
    const checkins = await db.select().from(operationsCheckinsTable)
      .where(eq(operationsCheckinsTable.missionId, m.id)).orderBy(desc(operationsCheckinsTable.at));
    const proofs = await db.select().from(operationsProofsTable)
      .where(eq(operationsProofsTable.missionId, m.id)).orderBy(desc(operationsProofsTable.validatedAt));
    const incidents = await db.select().from(operationsIncidentsTable)
      .where(eq(operationsIncidentsTable.missionId, m.id)).orderBy(desc(operationsIncidentsTable.reportedAt));
    const costs = await db.select().from(operationsCostsTable)
      .where(eq(operationsCostsTable.missionId, m.id));

    const checklists = await db.select().from(operationsChecklistsTable)
      .where(eq(operationsChecklistsTable.missionId, m.id));
    const checklistIds = checklists.map((c) => c.id);
    const items = checklistIds.length
      ? await db.select().from(operationsChecklistItemsTable)
        .where(inArray(operationsChecklistItemsTable.checklistId, checklistIds))
        .orderBy(asc(operationsChecklistItemsTable.ordering))
      : [];
    const checklistsEnriched = checklists.map((c) => ({
      ...c,
      items: items.filter((i) => i.checklistId === c.id),
    }));

    return res.json({
      mission: m,
      responsible: responsible ? { id: responsible.id, name: `${responsible.firstName} ${responsible.lastName}` } : null,
      client, project,
      stops, checkins, proofs, incidents, costs,
      checklists: checklistsEnriched,
    });
  } catch (e) { next(e); }
});

router.patch("/operations/missions/:id", requirePermission("operations.manage"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const patch: any = {};
    const allowed = [
      "title", "description", "priority", "status", "clientId", "projectId",
      "originAddress", "originLat", "originLng",
      "destinationAddress", "destinationLat", "destinationLng",
      "scheduledStart", "scheduledEnd", "actualStart", "actualEnd",
      "responsibleUserId", "teamUserIds", "vehicleEquipmentId",
      "payloadJson", "estimatedCostFcfa", "actualCostFcfa", "isBillable",
      "tagsJson", "notes", "summaryJson",
    ];
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    if (patch.scheduledStart) patch.scheduledStart = new Date(patch.scheduledStart);
    if (patch.scheduledEnd) patch.scheduledEnd = new Date(patch.scheduledEnd);
    if (patch.actualStart) patch.actualStart = new Date(patch.actualStart);
    if (patch.actualEnd) patch.actualEnd = new Date(patch.actualEnd);
    const [m] = await db.update(operationsMissionsTable).set(patch)
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)))
      .returning();
    if (!m) return res.status(404).json({ error: "not_found" });
    return res.json(m);
  } catch (e) { next(e); }
});

router.delete("/operations/missions/:id", requirePermission("operations.manage"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const [m] = await db.update(operationsMissionsTable).set({ deletedAt: new Date() })
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)))
      .returning();
    if (!m) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post("/operations/missions/:id/assign", requirePermission("operations.assign"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const { responsibleUserId, teamUserIds, vehicleEquipmentId } = req.body ?? {};
    const patch: any = {};
    if (responsibleUserId !== undefined) patch.responsibleUserId = responsibleUserId || null;
    if (Array.isArray(teamUserIds)) patch.teamUserIds = teamUserIds;
    if (vehicleEquipmentId !== undefined) patch.vehicleEquipmentId = vehicleEquipmentId || null;
    // Si la mission était planned et qu'on assigne un responsable → assigned
    const [current] = await db.select().from(operationsMissionsTable)
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)));
    if (!current) return res.status(404).json({ error: "not_found" });
    if (current.status === "planned" && patch.responsibleUserId) patch.status = "assigned";
    const [m] = await db.update(operationsMissionsTable).set(patch)
      .where(eq(operationsMissionsTable.id, req.params.id)).returning();
    return res.json(m);
  } catch (e) { next(e); }
});

router.post("/operations/missions/:id/status", requirePermission("operations.manage"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const status = String(req.body?.status ?? "");
    if (!STATUS_FLOW.includes(status as any)) return res.status(400).json({ error: "invalid_status" });
    const patch: any = { status };
    if (status === "en_route" || status === "in_progress") patch.actualStart = new Date();
    if (status === "completed" || status === "cancelled") patch.actualEnd = new Date();
    const [m] = await db.update(operationsMissionsTable).set(patch)
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)))
      .returning();
    if (!m) return res.status(404).json({ error: "not_found" });
    return res.json(m);
  } catch (e) { next(e); }
});

router.post("/operations/missions/:id/check-in", requirePermission("operations.checkin"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const [m] = await db.select().from(operationsMissionsTable)
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)));
    if (!m) return res.status(404).json({ error: "not_found" });
    const { lat, lng, accuracyMeters, locationLabel, notes } = req.body ?? {};
    const [c] = await db.insert(operationsCheckinsTable).values({
      organizationId: orgId, missionId: m.id, userId: req.authUser!.id,
      kind: "check_in", lat, lng, accuracyMeters, locationLabel, notes,
    }).returning();
    if (m.status === "en_route" || m.status === "assigned" || m.status === "awaiting_departure" || m.status === "planned") {
      await db.update(operationsMissionsTable).set({ status: "on_site", actualStart: m.actualStart ?? new Date() })
        .where(eq(operationsMissionsTable.id, m.id));
    }
    return res.status(201).json(c);
  } catch (e) { next(e); }
});

router.post("/operations/missions/:id/check-out", requirePermission("operations.checkin"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const [m] = await db.select().from(operationsMissionsTable)
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)));
    if (!m) return res.status(404).json({ error: "not_found" });
    const { lat, lng, accuracyMeters, locationLabel, notes } = req.body ?? {};
    const [c] = await db.insert(operationsCheckinsTable).values({
      organizationId: orgId, missionId: m.id, userId: req.authUser!.id,
      kind: "check_out", lat, lng, accuracyMeters, locationLabel, notes,
    }).returning();
    return res.status(201).json(c);
  } catch (e) { next(e); }
});

router.post("/operations/missions/:id/proof", requirePermission("operations.manage"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const [m] = await db.select().from(operationsMissionsTable)
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)));
    if (!m) return res.status(404).json({ error: "not_found" });
    const b = req.body ?? {};
    const [p] = await db.insert(operationsProofsTable).values({
      organizationId: orgId, missionId: m.id,
      recipientName: b.recipientName, signatureDataUrl: b.signatureDataUrl,
      photoUrls: Array.isArray(b.photoUrls) ? b.photoUrls : [],
      comment: b.comment, lat: b.lat, lng: b.lng,
      validatedById: req.authUser!.id, status: b.status ?? "valid",
    }).returning();
    return res.status(201).json(p);
  } catch (e) { next(e); }
});

router.post("/operations/missions/:id/incident", requirePermission("operations.incidents"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const b = req.body ?? {};
    const [i] = await db.insert(operationsIncidentsTable).values({
      organizationId: orgId, missionId: req.params.id,
      kind: b.kind ?? "other", severity: b.severity ?? "medium",
      description: b.description, correctiveAction: b.correctiveAction,
      attachmentsJson: Array.isArray(b.attachmentsJson) ? b.attachmentsJson : [],
      reportedById: req.authUser!.id,
    }).returning();
    return res.status(201).json(i);
  } catch (e) { next(e); }
});

router.post("/operations/missions/:id/cost", requirePermission("operations.manage"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const b = req.body ?? {};
    const [c] = await db.insert(operationsCostsTable).values({
      organizationId: orgId, missionId: req.params.id,
      kind: b.kind ?? "other", label: b.label ?? "Coût",
      amountFcfa: String(b.amountFcfa ?? "0"), isEstimate: !!b.isEstimate,
    }).returning();
    return res.status(201).json(c);
  } catch (e) { next(e); }
});

router.post("/operations/missions/:id/summary", requirePermission("operations.manage"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const [m] = await db.select().from(operationsMissionsTable)
      .where(and(eq(operationsMissionsTable.id, req.params.id), eq(operationsMissionsTable.organizationId, orgId)));
    if (!m) return res.status(404).json({ error: "not_found" });
    const [incCount] = await db.select({ c: sql<number>`count(*)::int` }).from(operationsIncidentsTable)
      .where(eq(operationsIncidentsTable.missionId, m.id));
    const [proofCount] = await db.select({ c: sql<number>`count(*)::int` }).from(operationsProofsTable)
      .where(eq(operationsProofsTable.missionId, m.id));
    const plannedDur = m.scheduledStart && m.scheduledEnd
      ? Math.round((new Date(m.scheduledEnd).getTime() - new Date(m.scheduledStart).getTime()) / 60000) : null;
    const actualDur = m.actualStart && m.actualEnd
      ? Math.round((new Date(m.actualEnd).getTime() - new Date(m.actualStart).getTime()) / 60000) : null;
    const gapMin = plannedDur != null && actualDur != null ? actualDur - plannedDur : null;
    const summary = {
      planned: `Prévu : ${plannedDur ?? "–"} min, démarrage ${m.scheduledStart ? new Date(m.scheduledStart).toLocaleString("fr-FR") : "–"}`,
      achieved: `Réalisé : ${actualDur ?? "–"} min, ${proofCount?.c ?? 0} preuve(s) jointe(s)`,
      gaps: gapMin != null ? `Écart durée : ${gapMin > 0 ? "+" : ""}${gapMin} min` : "Écart non mesurable",
      nextActions: (incCount?.c ?? 0) > 0
        ? `Traiter ${incCount.c} incident(s) ouvert(s)`
        : "Aucune action correctrice requise",
    };
    const [updated] = await db.update(operationsMissionsTable).set({ summaryJson: summary })
      .where(eq(operationsMissionsTable.id, m.id)).returning();
    return res.json({ summary: updated.summaryJson });
  } catch (e) { next(e); }
});

// ─── Dispatching ─────────────────────────────────────────────────────

router.get("/operations/dispatch", requirePermission("operations.dispatch"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.json({ unassigned: [], available: { users: [], vehicles: [] } });
    const unassigned = await db.select().from(operationsMissionsTable).where(and(
      eq(operationsMissionsTable.organizationId, orgId),
      isNull(operationsMissionsTable.deletedAt),
      sql`${operationsMissionsTable.status} in ('planned','blocked')`,
    )).orderBy(asc(operationsMissionsTable.scheduledStart)).limit(50);

    const users = await db.select({
      id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role,
    }).from(usersTable).where(eq(usersTable.isActive, true)).limit(50);

    // Charge actuelle par utilisateur
    const loadRows = await db.select({
      uid: operationsMissionsTable.responsibleUserId,
      c: sql<number>`count(*)::int`,
    }).from(operationsMissionsTable).where(and(
      eq(operationsMissionsTable.organizationId, orgId),
      isNull(operationsMissionsTable.deletedAt),
      sql`${operationsMissionsTable.status} in ('assigned','en_route','on_site','in_progress')`,
    )).groupBy(operationsMissionsTable.responsibleUserId);
    const loadMap = new Map(loadRows.map((r) => [r.uid, r.c]));

    const enriched = users.map((u) => ({
      ...u, name: `${u.firstName} ${u.lastName}`,
      activeMissions: loadMap.get(u.id) ?? 0,
      availability: (loadMap.get(u.id) ?? 0) === 0 ? "available" : (loadMap.get(u.id) ?? 0) < 3 ? "light" : "busy",
    }));

    const vehicles = await db.select({
      id: equipmentTable.id, name: equipmentTable.name, status: equipmentTable.status,
    }).from(equipmentTable).where(isNull(equipmentTable.deletedAt)).limit(50);

    return res.json({ unassigned, available: { users: enriched, vehicles } });
  } catch (e) { next(e); }
});

// ─── Incidents ───────────────────────────────────────────────────────

router.get("/operations/incidents", requirePermission("operations.incidents"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.json({ data: [] });
    const { status, severity } = req.query as Record<string, string>;
    const conds: any[] = [eq(operationsIncidentsTable.organizationId, orgId)];
    if (status) conds.push(eq(operationsIncidentsTable.status, status));
    if (severity) conds.push(eq(operationsIncidentsTable.severity, severity));
    const rows = await db.select({
      i: operationsIncidentsTable,
      missionRef: operationsMissionsTable.reference,
      missionTitle: operationsMissionsTable.title,
    }).from(operationsIncidentsTable)
      .leftJoin(operationsMissionsTable, eq(operationsIncidentsTable.missionId, operationsMissionsTable.id))
      .where(and(...conds))
      .orderBy(desc(operationsIncidentsTable.reportedAt))
      .limit(100);
    return res.json({ data: rows.map((r) => ({ ...r.i, missionRef: r.missionRef, missionTitle: r.missionTitle })) });
  } catch (e) { next(e); }
});

router.patch("/operations/incidents/:id", requirePermission("operations.incidents"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    const patch: any = {};
    for (const k of ["status", "severity", "correctiveAction", "description"]) if (k in req.body) patch[k] = req.body[k];
    if (patch.status === "resolved") {
      patch.resolvedAt = new Date();
      patch.resolvedById = req.authUser!.id;
    }
    const [i] = await db.update(operationsIncidentsTable).set(patch)
      .where(and(eq(operationsIncidentsTable.id, req.params.id), eq(operationsIncidentsTable.organizationId, orgId)))
      .returning();
    if (!i) return res.status(404).json({ error: "not_found" });
    return res.json(i);
  } catch (e) { next(e); }
});

// ─── Checklists ──────────────────────────────────────────────────────

router.get("/operations/checklists/templates", requirePermission("operations.checklists"), async (_req, res) => {
  return res.json({ templates: DEFAULT_CHECKLISTS });
});

router.patch("/operations/checklist-items/:id", requirePermission("operations.checklists"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.status(404).json({ error: "not_found" });
    // Vérifie l'appartenance tenant via jointure parent checklist.
    const [owner] = await db.select({ id: operationsChecklistItemsTable.id })
      .from(operationsChecklistItemsTable)
      .innerJoin(operationsChecklistsTable, eq(operationsChecklistsTable.id, operationsChecklistItemsTable.checklistId))
      .where(and(
        eq(operationsChecklistItemsTable.id, req.params.id),
        eq(operationsChecklistsTable.organizationId, orgId),
      ));
    if (!owner) return res.status(404).json({ error: "not_found" });
    const done = !!req.body?.done;
    const [item] = await db.update(operationsChecklistItemsTable).set({
      done, doneAt: done ? new Date() : null, doneById: done ? req.authUser!.id : null,
      note: req.body?.note,
    }).where(eq(operationsChecklistItemsTable.id, req.params.id)).returning();
    if (!item) return res.status(404).json({ error: "not_found" });
    // Recalcul progression
    const items = await db.select().from(operationsChecklistItemsTable)
      .where(eq(operationsChecklistItemsTable.checklistId, item.checklistId));
    const total = items.length;
    const doneCount = items.filter((i) => i.done).length;
    const status = doneCount === 0 ? "pending" : doneCount === total ? "done" : "in_progress";
    await db.update(operationsChecklistsTable).set({ totalItems: total, doneItems: doneCount, status })
      .where(eq(operationsChecklistsTable.id, item.checklistId));
    return res.json(item);
  } catch (e) { next(e); }
});

// ─── Performance ─────────────────────────────────────────────────────

router.get("/operations/performance", requirePermission("operations.performance"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.json({});
    const baseOrg = and(eq(operationsMissionsTable.organizationId, orgId), isNull(operationsMissionsTable.deletedAt));
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(operationsMissionsTable).where(baseOrg);
    const [{ completed }] = await db.select({ completed: sql<number>`count(*)::int` }).from(operationsMissionsTable).where(and(baseOrg, eq(operationsMissionsTable.status, "completed")));
    const [{ onTime }] = await db.select({ onTime: sql<number>`count(*)::int` }).from(operationsMissionsTable).where(and(
      baseOrg, eq(operationsMissionsTable.status, "completed"),
      sql`${operationsMissionsTable.actualEnd} is not null and ${operationsMissionsTable.scheduledEnd} is not null and ${operationsMissionsTable.actualEnd} <= ${operationsMissionsTable.scheduledEnd}`,
    ));
    const [{ incidents }] = await db.select({ incidents: sql<number>`count(*)::int` }).from(operationsIncidentsTable)
      .where(eq(operationsIncidentsTable.organizationId, orgId));
    const [{ avgDur }] = await db.select({
      avgDur: sql<number>`coalesce(avg(extract(epoch from (${operationsMissionsTable.actualEnd} - ${operationsMissionsTable.actualStart}))/60), 0)::int`,
    }).from(operationsMissionsTable).where(and(baseOrg, eq(operationsMissionsTable.status, "completed")));
    const [{ totalCost }] = await db.select({
      totalCost: sql<number>`coalesce(sum(amount_fcfa), 0)::float`,
    }).from(operationsCostsTable).where(eq(operationsCostsTable.organizationId, orgId));

    const byKind = await db.select({
      kind: operationsMissionsTable.kind,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`sum(case when ${operationsMissionsTable.status}='completed' then 1 else 0 end)::int`,
      avgDur: sql<number>`coalesce(avg(extract(epoch from (${operationsMissionsTable.actualEnd} - ${operationsMissionsTable.actualStart}))/60), 0)::int`,
    }).from(operationsMissionsTable).where(baseOrg).groupBy(operationsMissionsTable.kind);

    const byResponsible = await db.select({
      userId: operationsMissionsTable.responsibleUserId,
      name: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`sum(case when ${operationsMissionsTable.status}='completed' then 1 else 0 end)::int`,
    }).from(operationsMissionsTable)
      .leftJoin(usersTable, eq(operationsMissionsTable.responsibleUserId, usersTable.id))
      .where(baseOrg)
      .groupBy(operationsMissionsTable.responsibleUserId, usersTable.firstName, usersTable.lastName);

    return res.json({
      kpi: {
        total, completed,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        onTimeRate: completed ? Math.round((onTime / completed) * 100) : 0,
        incidentRate: total ? Math.round((incidents / total) * 100) : 0,
        avgDurationMin: avgDur, totalCostFcfa: totalCost,
      },
      byKind, byResponsible,
    });
  } catch (e) { next(e); }
});

// ─── Map ─────────────────────────────────────────────────────────────

router.get("/operations/map", requirePermission("operations.view"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.json({ points: [] });
    const rows = await db.select({
      id: operationsMissionsTable.id,
      reference: operationsMissionsTable.reference,
      title: operationsMissionsTable.title,
      status: operationsMissionsTable.status,
      kind: operationsMissionsTable.kind,
      lat: operationsMissionsTable.destinationLat,
      lng: operationsMissionsTable.destinationLng,
      address: operationsMissionsTable.destinationAddress,
    }).from(operationsMissionsTable).where(and(
      eq(operationsMissionsTable.organizationId, orgId),
      isNull(operationsMissionsTable.deletedAt),
      sql`${operationsMissionsTable.destinationLat} is not null`,
      sql`${operationsMissionsTable.destinationLng} is not null`,
    )).limit(200);
    return res.json({ points: rows });
  } catch (e) { next(e); }
});

// ─── Calendar ────────────────────────────────────────────────────────

router.get("/operations/calendar", requirePermission("operations.view"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.json({ items: [] });
    const start = req.query.start ? new Date(String(req.query.start)) : new Date(Date.now() - 7 * 86400000);
    const end = req.query.end ? new Date(String(req.query.end)) : new Date(Date.now() + 30 * 86400000);
    const rows = await db.select({
      id: operationsMissionsTable.id,
      reference: operationsMissionsTable.reference,
      title: operationsMissionsTable.title,
      status: operationsMissionsTable.status,
      kind: operationsMissionsTable.kind,
      scheduledStart: operationsMissionsTable.scheduledStart,
      scheduledEnd: operationsMissionsTable.scheduledEnd,
      priority: operationsMissionsTable.priority,
    }).from(operationsMissionsTable).where(and(
      eq(operationsMissionsTable.organizationId, orgId),
      isNull(operationsMissionsTable.deletedAt),
      sql`${operationsMissionsTable.scheduledStart} is not null`,
      gte(operationsMissionsTable.scheduledStart, start),
      sql`${operationsMissionsTable.scheduledStart} <= ${end}`,
    )).orderBy(asc(operationsMissionsTable.scheduledStart));
    return res.json({ items: rows });
  } catch (e) { next(e); }
});

router.get("/operations/playbooks", requirePermission("operations.view"), async (req, res, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) return res.json({ data: [] });
    const rows = await db.select().from(operationsPlaybooksTable)
      .where(eq(operationsPlaybooksTable.organizationId, orgId)).orderBy(asc(operationsPlaybooksTable.name));
    return res.json({ data: rows, defaults: Object.keys(DEFAULT_CHECKLISTS) });
  } catch (e) { next(e); }
});

export default router;
