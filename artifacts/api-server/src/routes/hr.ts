import { Router } from "express";
import { db } from "@workspace/db";
import {
  departmentsTable,
  positionsTable,
  contractsTable,
  hrDocumentsTable,
  collaboratorAssignmentsTable,
  collaboratorsTable,
  projectsTable,
  tasksTable,
  equipmentTable,
  leaveRequestsTable,
  jobOffersTable,
  candidaciesTable,
  performanceReviewsTable,
  trainingSessionsTable,
  trainingParticipantsTable,
  personnelMovementsTable,
} from "@workspace/db";
import { and, asc, eq, isNull, sql, desc, gte, lte } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

// ════════════════════════════════════════════════════════════════
// DÉPARTEMENTS / PÔLES
// ════════════════════════════════════════════════════════════════
router.get("/hr/departments", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const rows = await db.select().from(departmentsTable).where(eq(departmentsTable.organizationId, orgId)).orderBy(departmentsTable.name);
  // Compte les collaborateurs et postes par département.
  const counts = await db.select({
    departmentId: collaboratorsTable.departmentId,
    n: sql<number>`COUNT(*)`,
  }).from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)))
    .groupBy(collaboratorsTable.departmentId);
  const byDept = new Map(counts.map(c => [c.departmentId, Number(c.n)]));
  return res.json({ data: rows.map(d => ({ ...d, collaboratorsCount: byDept.get(d.id) ?? 0 })) });
});

router.post("/hr/departments", requireManagerOrAbove, async (req, res) => {
  const { code, name, description, parentId, headCollaboratorId, color } = req.body;
  if (!code || !name) return res.status(400).json({ error: "code et name requis" });
  try {
    const [d] = await db.insert(departmentsTable).values({
      organizationId: req.authUser!.organizationId, code, name, description, parentId, headCollaboratorId, color }).returning();
    return res.status(201).json(d);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.put("/hr/departments/:id", requireManagerOrAbove, async (req, res) => {
  const { code, name, description, parentId, headCollaboratorId, color } = req.body;
  const [d] = await db.update(departmentsTable)
    .set({ code, name, description, parentId, headCollaboratorId, color })
    .where(and(eq(departmentsTable.organizationId, req.authUser!.organizationId), eq(departmentsTable.id, req.params.id))).returning();
  if (!d) return res.status(404).json({ error: "Not found" });
  return res.json(d);
});

router.delete("/hr/departments/:id", requireManagerOrAbove, async (req, res) => {
  await db.delete(departmentsTable).where(and(eq(departmentsTable.organizationId, req.authUser!.organizationId), eq(departmentsTable.id, req.params.id)));
  return res.status(204).send();
});

// ════════════════════════════════════════════════════════════════
// POSTES / FONCTIONS
// ════════════════════════════════════════════════════════════════
router.get("/hr/positions", async (req, res) => {
  const { departmentId } = req.query as Record<string, string>;
  const conds: any[] = [eq(positionsTable.organizationId, req.authUser!.organizationId)];
  if (departmentId) conds.push(eq(positionsTable.departmentId, departmentId));
  const rows = await db.select({
    pos: positionsTable,
    deptName: departmentsTable.name,
  }).from(positionsTable)
    .leftJoin(departmentsTable, eq(positionsTable.departmentId, departmentsTable.id))
    .where(and(...conds))
    .orderBy(positionsTable.title);
  return res.json({ data: rows.map(r => ({ ...r.pos, departmentName: r.deptName })) });
});

router.post("/hr/positions", requireManagerOrAbove, async (req, res) => {
  const { code, title, departmentId, description, level } = req.body;
  if (!code || !title) return res.status(400).json({ error: "code et title requis" });
  try {
    const [p] = await db.insert(positionsTable).values({
      organizationId: req.authUser!.organizationId, code, title, departmentId, description, level }).returning();
    return res.status(201).json(p);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.put("/hr/positions/:id", requireManagerOrAbove, async (req, res) => {
  const { code, title, departmentId, description, level } = req.body;
  const [p] = await db.update(positionsTable)
    .set({ code, title, departmentId, description, level })
    .where(and(eq(positionsTable.organizationId, req.authUser!.organizationId), eq(positionsTable.id, req.params.id))).returning();
  if (!p) return res.status(404).json({ error: "Not found" });
  return res.json(p);
});

router.delete("/hr/positions/:id", requireManagerOrAbove, async (req, res) => {
  await db.delete(positionsTable).where(and(eq(positionsTable.organizationId, req.authUser!.organizationId), eq(positionsTable.id, req.params.id)));
  return res.status(204).send();
});

// ════════════════════════════════════════════════════════════════
// CONTRATS
// ════════════════════════════════════════════════════════════════
router.get("/hr/contracts", async (req, res) => {
  const { collaboratorId, status } = req.query as Record<string, string>;
  const wheres: any[] = [eq(contractsTable.organizationId, req.authUser!.organizationId)];
  if (collaboratorId) wheres.push(eq(contractsTable.collaboratorId, collaboratorId));
  if (status) wheres.push(eq(contractsTable.status, status));
  const rows = await db.select({
    c: contractsTable,
    collabFirst: collaboratorsTable.firstName,
    collabLast: collaboratorsTable.lastName,
  }).from(contractsTable)
    .leftJoin(collaboratorsTable, eq(contractsTable.collaboratorId, collaboratorsTable.id))
    .where(and(...wheres))
    .orderBy(desc(contractsTable.startDate));
  return res.json({ data: rows.map(r => ({
    ...r.c,
    collaboratorName: `${r.collabFirst ?? ""} ${r.collabLast ?? ""}`.trim(),
    monthlySalary: r.c.monthlySalary ? Number(r.c.monthlySalary) : null,
  })) });
});

router.post("/hr/contracts", requireManagerOrAbove, async (req, res) => {
  const { collaboratorId, type, status, startDate, endDate, monthlySalary, currency, jobTitle, workLocation, weeklyHours, terms, signedAt, fileUrl } = req.body;
  if (!collaboratorId || !type || !startDate) return res.status(400).json({ error: "collaboratorId, type, startDate requis" });
  const [c] = await db.insert(contractsTable).values({
      organizationId: req.authUser!.organizationId,
    collaboratorId, type, status: status || "active",
    startDate, endDate, monthlySalary: monthlySalary?.toString(), currency,
    jobTitle, workLocation, weeklyHours: weeklyHours?.toString(),
    terms, signedAt: signedAt ? new Date(signedAt) : null, fileUrl,
  }).returning();
  return res.status(201).json(c);
});

router.put("/hr/contracts/:id", requireManagerOrAbove, async (req, res) => {
  const { type, status, startDate, endDate, monthlySalary, currency, jobTitle, workLocation, weeklyHours, terms, signedAt, fileUrl } = req.body;
  const [c] = await db.update(contractsTable).set({
    type, status, startDate, endDate, monthlySalary: monthlySalary?.toString(), currency,
    jobTitle, workLocation, weeklyHours: weeklyHours?.toString(),
    terms, signedAt: signedAt ? new Date(signedAt) : null, fileUrl,
  }).where(and(eq(contractsTable.organizationId, req.authUser!.organizationId), eq(contractsTable.id, req.params.id))).returning();
  if (!c) return res.status(404).json({ error: "Not found" });
  return res.json(c);
});

router.delete("/hr/contracts/:id", requireManagerOrAbove, async (req, res) => {
  await db.delete(contractsTable).where(and(eq(contractsTable.organizationId, req.authUser!.organizationId), eq(contractsTable.id, req.params.id)));
  return res.status(204).send();
});

// ════════════════════════════════════════════════════════════════
// DOCUMENTS RH
// ════════════════════════════════════════════════════════════════
router.get("/hr/documents", async (req, res) => {
  const { collaboratorId } = req.query as Record<string, string>;
  const conds: any[] = [eq(hrDocumentsTable.organizationId, req.authUser!.organizationId)];
  if (collaboratorId) conds.push(eq(hrDocumentsTable.collaboratorId, collaboratorId));
  const rows = await db.select().from(hrDocumentsTable).where(and(...conds)).orderBy(desc(hrDocumentsTable.uploadedAt));
  return res.json({ data: rows });
});

router.post("/hr/documents", requireManagerOrAbove, async (req, res) => {
  const { collaboratorId, type, name, fileUrl, expiresAt, notes } = req.body;
  if (!collaboratorId || !type || !name || !fileUrl) return res.status(400).json({ error: "Champs requis manquants" });
  const [d] = await db.insert(hrDocumentsTable).values({
      organizationId: req.authUser!.organizationId, collaboratorId, type, name, fileUrl, expiresAt, notes }).returning();
  return res.status(201).json(d);
});

router.delete("/hr/documents/:id", requireManagerOrAbove, async (req, res) => {
  await db.delete(hrDocumentsTable).where(and(eq(hrDocumentsTable.organizationId, req.authUser!.organizationId), eq(hrDocumentsTable.id, req.params.id)));
  return res.status(204).send();
});

// ════════════════════════════════════════════════════════════════
// AFFECTATIONS — synchronisation RH ↔ Opérations
// ════════════════════════════════════════════════════════════════
router.get("/hr/assignments", async (req, res) => {
  const { collaboratorId, projectId, status } = req.query as Record<string, string>;
  const wheres: any[] = [eq(collaboratorAssignmentsTable.organizationId, req.authUser!.organizationId)];
  if (collaboratorId) wheres.push(eq(collaboratorAssignmentsTable.collaboratorId, collaboratorId));
  if (projectId) wheres.push(eq(collaboratorAssignmentsTable.projectId, projectId));
  if (status) wheres.push(eq(collaboratorAssignmentsTable.status, status));
  const rows = await db.select({
    a: collaboratorAssignmentsTable,
    collabFirst: collaboratorsTable.firstName,
    collabLast: collaboratorsTable.lastName,
    collabAvatar: collaboratorsTable.avatarUrl,
    projectName: projectsTable.name,
  }).from(collaboratorAssignmentsTable)
    .leftJoin(collaboratorsTable, eq(collaboratorAssignmentsTable.collaboratorId, collaboratorsTable.id))
    .leftJoin(projectsTable, eq(collaboratorAssignmentsTable.projectId, projectsTable.id))
    .where(and(...wheres))
    .orderBy(desc(collaboratorAssignmentsTable.createdAt));
  return res.json({ data: rows.map(r => ({
    ...r.a,
    collaboratorName: `${r.collabFirst ?? ""} ${r.collabLast ?? ""}`.trim(),
    collaboratorAvatar: r.collabAvatar,
    projectName: r.projectName,
  })) });
});

router.post("/hr/assignments", requireManagerOrAbove, async (req, res) => {
  const { collaboratorId, projectId, role, allocationPct, startDate, endDate, status, notes } = req.body;
  if (!collaboratorId || !projectId || !role) return res.status(400).json({ error: "collaboratorId, projectId, role requis" });
  const alloc = allocationPct ?? 100;
  if (typeof alloc !== "number" || alloc < 0 || alloc > 100) {
    return res.status(400).json({ error: "allocationPct doit être un nombre entre 0 et 100" });
  }
  try {
    // Atomicité : insert + recalcul du compteur dans la même transaction.
    const a = await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(collaboratorAssignmentsTable).values({
      organizationId: req.authUser!.organizationId,
        collaboratorId, projectId, role,
        allocationPct: alloc,
        startDate, endDate, status: status || "active", notes,
      }).returning();
      await tx.execute(sql`
        UPDATE ${collaboratorsTable}
           SET current_projects_count = (
             SELECT COUNT(DISTINCT project_id) FROM ${collaboratorAssignmentsTable}
              WHERE collaborator_id = ${collaboratorId} AND status = 'active'
           )
         WHERE id = ${collaboratorId}
      `);
      return inserted;
    });
    return res.status(201).json(a);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.put("/hr/assignments/:id", requireManagerOrAbove, async (req, res) => {
  const { role, allocationPct, startDate, endDate, status, notes } = req.body;
  if (allocationPct != null && (typeof allocationPct !== "number" || allocationPct < 0 || allocationPct > 100)) {
    return res.status(400).json({ error: "allocationPct doit être un nombre entre 0 et 100" });
  }
  try {
    const a = await db.transaction(async (tx) => {
      const [updated] = await tx.update(collaboratorAssignmentsTable).set({
        role, allocationPct, startDate, endDate, status, notes,
      }).where(and(eq(collaboratorAssignmentsTable.organizationId, req.authUser!.organizationId), eq(collaboratorAssignmentsTable.id, req.params.id))).returning();
      if (!updated) return null;
      if (status) {
        await tx.execute(sql`
          UPDATE ${collaboratorsTable}
             SET current_projects_count = (
               SELECT COUNT(DISTINCT project_id) FROM ${collaboratorAssignmentsTable}
                WHERE collaborator_id = ${updated.collaboratorId} AND status = 'active'
             )
           WHERE id = ${updated.collaboratorId}
        `);
      }
      return updated;
    });
    if (!a) return res.status(404).json({ error: "Not found" });
    return res.json(a);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.delete("/hr/assignments/:id", requireManagerOrAbove, async (req, res) => {
  await db.delete(collaboratorAssignmentsTable).where(and(eq(collaboratorAssignmentsTable.organizationId, req.authUser!.organizationId), eq(collaboratorAssignmentsTable.id, req.params.id)));
  return res.status(204).send();
});

// ════════════════════════════════════════════════════════════════
// AUTO-AFFECTATION : rattache les collaborateurs existants aux pôles
// seedés en se basant sur l'ancien champ texte `department` ou
// `position`. Idempotent — n'écrase pas une affectation déjà posée.
// ════════════════════════════════════════════════════════════════
router.post("/hr/auto-assign-departments", requireManagerOrAbove, async (_req, res) => {
  try {
    // Mapping mots-clés → code département seedé
    const KEYWORD_MAP: Array<{ kw: RegExp; code: string }> = [
      { kw: /(direction|pilotage|dg|directeur|général)/i, code: "DIR" },
      { kw: /(opération|chantier|chef|conducteur|ouvrier|maçon|btp|travaux)/i, code: "OPS" },
      { kw: /(matériel|parc|mécano|mécanicien|engin|logistique)/i, code: "MAT" },
      { kw: /(commercial|vente|devis|facture|client)/i, code: "COM" },
      { kw: /(rh|ressources humaines|paie|recrutement)/i, code: "RH" },
      { kw: /(comptabilité|comptable|finance|trésorerie)/i, code: "CPT" },
      { kw: /(communication|marketing|marcom)/i, code: "MKT" },
    ];

    const depts = await db.select().from(departmentsTable);
    const byCode = new Map(depts.map((d) => [d.code, d.id]));

    const allCollabs = await db.select().from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt));
    let updated = 0; const summary: Array<{ id: string; name: string; assigned: string }> = [];

    for (const c of allCollabs) {
      if (c.departmentId) continue; // déjà affecté
      const haystack = `${c.department ?? ""} ${c.position ?? ""}`.trim();
      let matched: string | null = null;
      for (const { kw, code } of KEYWORD_MAP) {
        if (kw.test(haystack)) { matched = code; break; }
      }
      if (!matched) matched = "OPS"; // défaut : Opérations (cœur métier terrain)
      const deptId = byCode.get(matched);
      if (!deptId) continue;
      await db.update(collaboratorsTable).set({ departmentId: deptId })
        .where(eq(collaboratorsTable.id, c.id));
      updated++;
      summary.push({ id: c.id, name: `${c.firstName} ${c.lastName}`, assigned: matched });
    }

    return res.json({ updated, total: allCollabs.length, summary });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// VUE 360° collaborateur — aggregat cross-modules
// (projets, tâches, équipements responsable, contrats, documents)
// ════════════════════════════════════════════════════════════════
router.get("/hr/collaborators/:id/overview", async (req, res) => {
  const collabId = req.params.id;
  const collab = (await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, collabId)).limit(1))[0];
  if (!collab) return res.status(404).json({ error: "Not found" });

  const [dept, position, manager] = await Promise.all([
    collab.departmentId ? db.select().from(departmentsTable).where(eq(departmentsTable.id, collab.departmentId)).limit(1) : Promise.resolve([]),
    collab.positionId ? db.select().from(positionsTable).where(eq(positionsTable.id, collab.positionId)).limit(1) : Promise.resolve([]),
    collab.managerCollaboratorId ? db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, collab.managerCollaboratorId)).limit(1) : Promise.resolve([]),
  ]);

  const assignments = await db.select({
    a: collaboratorAssignmentsTable,
    projectName: projectsTable.name,
    projectStatus: projectsTable.status,
  }).from(collaboratorAssignmentsTable)
    .leftJoin(projectsTable, eq(collaboratorAssignmentsTable.projectId, projectsTable.id))
    .where(eq(collaboratorAssignmentsTable.collaboratorId, collabId));

  // Tâches : on lie via user (si collaborateur a un compte)
  const tasks = collab.userId ? await db.select().from(tasksTable)
    .where(and(eq(tasksTable.assigneeId, collab.userId), isNull(tasksTable.deletedAt as any))).limit(50) : [];

  // Équipements dont il est responsable
  const equipments = await db.select().from(equipmentTable)
    .where(eq(equipmentTable.responsibleCollaboratorId, collabId));

  // Projets dirigés
  const ledProjects = await db.select().from(projectsTable)
    .where(eq(projectsTable.leadCollaboratorId, collabId));

  const contracts = await db.select().from(contractsTable)
    .where(eq(contractsTable.collaboratorId, collabId)).orderBy(desc(contractsTable.startDate));

  const documents = await db.select().from(hrDocumentsTable)
    .where(eq(hrDocumentsTable.collaboratorId, collabId)).orderBy(desc(hrDocumentsTable.uploadedAt));

  const totalAllocation = assignments
    .filter(a => a.a.status === "active")
    .reduce((s, a) => s + (a.a.allocationPct ?? 0), 0);

  return res.json({
    collaborator: {
      ...collab,
      baseSalary: collab.baseSalary ? Number(collab.baseSalary) : null,
    },
    department: dept[0] ?? null,
    position: position[0] ?? null,
    manager: manager[0] ? { id: manager[0].id, firstName: manager[0].firstName, lastName: manager[0].lastName } : null,
    assignments: assignments.map(a => ({ ...a.a, projectName: a.projectName, projectStatus: a.projectStatus })),
    tasks,
    equipments,
    ledProjects,
    contracts: contracts.map(c => ({ ...c, monthlySalary: c.monthlySalary ? Number(c.monthlySalary) : null })),
    documents,
    workload: {
      activeAssignments: assignments.filter(a => a.a.status === "active").length,
      totalAllocationPct: totalAllocation,
      activeTasks: tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length,
      responsibleEquipmentsCount: equipments.length,
      ledProjectsCount: ledProjects.length,
    },
  });
});

// ════════════════════════════════════════════════════════════════
// DASHBOARD RH
// ════════════════════════════════════════════════════════════════
router.get("/hr/dashboard", async (_req, res) => {
  const [totalCollabs] = await db.select({ n: sql<number>`COUNT(*)` })
    .from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt));

  const [activeContracts] = await db.select({ n: sql<number>`COUNT(*)` })
    .from(contractsTable).where(eq(contractsTable.status, "active"));

  const byDept = await db.select({
    departmentId: collaboratorsTable.departmentId,
    departmentName: departmentsTable.name,
    n: sql<number>`COUNT(*)`,
  }).from(collaboratorsTable)
    .leftJoin(departmentsTable, eq(collaboratorsTable.departmentId, departmentsTable.id))
    .where(isNull(collaboratorsTable.deletedAt))
    .groupBy(collaboratorsTable.departmentId, departmentsTable.name);

  const recentHires = await db.select({
    id: collaboratorsTable.id,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    hireDate: collaboratorsTable.hireDate,
    avatarUrl: collaboratorsTable.avatarUrl,
  }).from(collaboratorsTable)
    .where(and(isNull(collaboratorsTable.deletedAt), sql`${collaboratorsTable.hireDate} IS NOT NULL`))
    .orderBy(desc(collaboratorsTable.hireDate)).limit(5);

  // Contrats arrivant à échéance dans 30 jours
  const expiring = await db.select({
    c: contractsTable,
    collabFirst: collaboratorsTable.firstName,
    collabLast: collaboratorsTable.lastName,
  }).from(contractsTable)
    .leftJoin(collaboratorsTable, eq(contractsTable.collaboratorId, collaboratorsTable.id))
    .where(sql`${contractsTable.status} = 'active' AND ${contractsTable.endDate} IS NOT NULL AND ${contractsTable.endDate} <= CURRENT_DATE + INTERVAL '30 days'`);

  return res.json({
    kpis: {
      totalCollaborators: Number(totalCollabs?.n ?? 0),
      activeContracts: Number(activeContracts?.n ?? 0),
      departmentsCount: byDept.filter(d => d.departmentName).length,
      contractsExpiringSoon: expiring.length,
    },
    distributionByDepartment: byDept.map(d => ({
      department: d.departmentName ?? "Non assigné",
      count: Number(d.n),
    })),
    recentHires,
    contractsExpiringSoon: expiring.map(e => ({
      ...e.c,
      collaboratorName: `${e.collabFirst ?? ""} ${e.collabLast ?? ""}`.trim(),
    })),
  });
});

// ════════════════════════════════════════════════════════════════
// ABSENCES / CONGÉS
// ════════════════════════════════════════════════════════════════

router.get("/hr/leaves", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { collaboratorId, status, year } = req.query as Record<string, string>;

  const conditions = [eq(leaveRequestsTable.organizationId, orgId)];
  if (collaboratorId) conditions.push(eq(leaveRequestsTable.collaboratorId, collaboratorId));
  if (status && status !== "all") conditions.push(eq(leaveRequestsTable.status, status));
  if (year) {
    const y = parseInt(year);
    conditions.push(gte(leaveRequestsTable.startDate, `${y}-01-01`));
    conditions.push(lte(leaveRequestsTable.endDate, `${y}-12-31`));
  }

  const rows = await db.select({
    l: leaveRequestsTable,
    collabFirst: collaboratorsTable.firstName,
    collabLast: collaboratorsTable.lastName,
    collabAvatar: collaboratorsTable.avatarUrl,
  }).from(leaveRequestsTable)
    .leftJoin(collaboratorsTable, eq(leaveRequestsTable.collaboratorId, collaboratorsTable.id))
    .where(and(...conditions))
    .orderBy(desc(leaveRequestsTable.startDate));

  res.json({ data: rows.map(r => ({
    ...r.l,
    days: Number(r.l.days),
    collaboratorName: `${r.collabFirst ?? ""} ${r.collabLast ?? ""}`.trim(),
    collaboratorAvatar: r.collabAvatar,
  })) });
});

router.get("/hr/leaves/stats", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()));

  const [pending] = await db.select({ n: sql<number>`COUNT(*)` })
    .from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.status, "pending")));

  const approvedThisYear = await db.select({ n: sql<number>`COUNT(*)`, days: sql<string>`COALESCE(SUM(${leaveRequestsTable.days}),0)` })
    .from(leaveRequestsTable)
    .where(and(
      eq(leaveRequestsTable.organizationId, orgId),
      eq(leaveRequestsTable.status, "approved"),
      gte(leaveRequestsTable.startDate, `${year}-01-01`),
      lte(leaveRequestsTable.startDate, `${year}-12-31`),
    ));

  const byType = await db.select({
    type: leaveRequestsTable.type,
    n: sql<number>`COUNT(*)`,
    totalDays: sql<string>`COALESCE(SUM(${leaveRequestsTable.days}),0)`,
  }).from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.status, "approved"), gte(leaveRequestsTable.startDate, `${year}-01-01`), lte(leaveRequestsTable.startDate, `${year}-12-31`)))
    .groupBy(leaveRequestsTable.type);

  res.json({
    pendingCount: Number(pending?.n ?? 0),
    approvedCount: Number(approvedThisYear[0]?.n ?? 0),
    approvedDays: Number(approvedThisYear[0]?.days ?? 0),
    byType: byType.map(t => ({ type: t.type, count: Number(t.n), days: Number(t.totalDays) })),
  });
});

router.get("/hr/leaves/:id", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [row] = await db.select({
    l: leaveRequestsTable,
    collabFirst: collaboratorsTable.firstName,
    collabLast: collaboratorsTable.lastName,
  }).from(leaveRequestsTable)
    .leftJoin(collaboratorsTable, eq(leaveRequestsTable.collaboratorId, collaboratorsTable.id))
    .where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, req.params.id)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Demande introuvable" }); return; }
  res.json({ ...row.l, days: Number(row.l.days), collaboratorName: `${row.collabFirst ?? ""} ${row.collabLast ?? ""}`.trim() });
});

router.post("/hr/leaves", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { collaboratorId, type, startDate, endDate, days, reason, notes } = req.body;
  if (!collaboratorId || !type || !startDate || !endDate) {
    res.status(400).json({ error: "Champs requis : collaborateur, type, dates" }); return;
  }
  const [row] = await db.insert(leaveRequestsTable).values({
    organizationId: orgId,
    collaboratorId,
    type,
    startDate,
    endDate,
    days: days != null ? String(days) : "1",
    reason: reason ?? null,
    notes: notes ?? null,
    status: "pending",
  }).returning();
  res.status(201).json(row);
});

router.patch("/hr/leaves/:id/status", requireManagerOrAbove, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { status, rejectionReason } = req.body;
  if (!["approved", "rejected", "cancelled"].includes(status)) {
    res.status(400).json({ error: "Statut invalide" }); return;
  }
  const [leave] = await db.select().from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, req.params.id)))
    .limit(1);
  if (!leave) { res.status(404).json({ error: "Demande introuvable" }); return; }

  const [updated] = await db.update(leaveRequestsTable).set({
    status,
    approvedById: status === "approved" ? req.authUser!.id : leave.approvedById,
    approvedAt: status === "approved" ? new Date() : null,
    rejectionReason: status === "rejected" ? rejectionReason ?? null : null,
    updatedAt: new Date(),
  }).where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, req.params.id))).returning();
  res.json(updated);
});

router.delete("/hr/leaves/:id", requireManagerOrAbove, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [row] = await db.select().from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, req.params.id))).limit(1);
  if (!row) { res.status(404).json({ error: "Demande introuvable" }); return; }
  await db.delete(leaveRequestsTable).where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, req.params.id)));
  res.status(204).send();
});

// ════════════════════════════════════════════════════════════════
// ÉVALUATIONS DE PERFORMANCE
// ════════════════════════════════════════════════════════════════
router.get("/hr/evaluations", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { period, status } = req.query as { period?: string; status?: string };
    const conditions = [eq(performanceReviewsTable.organizationId, orgId)];
    if (period) conditions.push(eq(performanceReviewsTable.period, period));
    if (status) conditions.push(eq(performanceReviewsTable.status, status));
    const rows = await db.select({
      id: performanceReviewsTable.id,
      collaboratorId: performanceReviewsTable.collaboratorId,
      type: performanceReviewsTable.type,
      period: performanceReviewsTable.period,
      reviewDate: performanceReviewsTable.reviewDate,
      overallRating: performanceReviewsTable.overallRating,
      status: performanceReviewsTable.status,
      createdAt: performanceReviewsTable.createdAt,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      department: collaboratorsTable.department,
      jobTitle: collaboratorsTable.position,
    }).from(performanceReviewsTable)
      .leftJoin(collaboratorsTable, eq(performanceReviewsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...conditions))
      .orderBy(desc(performanceReviewsTable.reviewDate));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/hr/evaluations", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { collaboratorId, reviewerId, type, period, reviewDate, overallRating, criteria, strengths, areasForImprovement, goals, status, notes } =
      req.body as {
        collaboratorId: string; reviewerId?: string; type?: string; period: string;
        reviewDate?: string; overallRating?: number; criteria?: unknown[]; strengths?: string;
        areasForImprovement?: string; goals?: string; status?: string; notes?: string;
      };
    if (!collaboratorId || !period) { res.status(400).json({ error: "collaboratorId et period requis" }); return; }
    const [row] = await db.insert(performanceReviewsTable).values({
      organizationId: orgId, collaboratorId, reviewerId, type, period, reviewDate,
      overallRating, criteria, strengths, areasForImprovement, goals, status, notes,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/hr/evaluations/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select({
      id: performanceReviewsTable.id,
      collaboratorId: performanceReviewsTable.collaboratorId,
      reviewerId: performanceReviewsTable.reviewerId,
      type: performanceReviewsTable.type,
      period: performanceReviewsTable.period,
      reviewDate: performanceReviewsTable.reviewDate,
      overallRating: performanceReviewsTable.overallRating,
      criteria: performanceReviewsTable.criteria,
      strengths: performanceReviewsTable.strengths,
      areasForImprovement: performanceReviewsTable.areasForImprovement,
      goals: performanceReviewsTable.goals,
      status: performanceReviewsTable.status,
      notes: performanceReviewsTable.notes,
      acknowledgedAt: performanceReviewsTable.acknowledgedAt,
      createdAt: performanceReviewsTable.createdAt,
      updatedAt: performanceReviewsTable.updatedAt,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      department: collaboratorsTable.department,
      jobTitle: collaboratorsTable.position,
    }).from(performanceReviewsTable)
      .leftJoin(collaboratorsTable, eq(performanceReviewsTable.collaboratorId, collaboratorsTable.id))
      .where(and(eq(performanceReviewsTable.organizationId, orgId), eq(performanceReviewsTable.id, req.params.id)))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Évaluation introuvable" }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.patch("/hr/evaluations/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [ev] = await db.select().from(performanceReviewsTable)
      .where(and(eq(performanceReviewsTable.organizationId, orgId), eq(performanceReviewsTable.id, req.params.id))).limit(1);
    if (!ev) { res.status(404).json({ error: "Évaluation introuvable" }); return; }
    const upd = req.body as Record<string, unknown>;
    const [updated] = await db.update(performanceReviewsTable).set({
      ...(upd.reviewDate != null && { reviewDate: String(upd.reviewDate) }),
      ...(upd.overallRating != null && { overallRating: Number(upd.overallRating) }),
      ...(upd.criteria != null && { criteria: upd.criteria }),
      ...(upd.strengths != null && { strengths: String(upd.strengths) }),
      ...(upd.areasForImprovement != null && { areasForImprovement: String(upd.areasForImprovement) }),
      ...(upd.goals != null && { goals: String(upd.goals) }),
      ...(upd.status != null && { status: String(upd.status) }),
      ...(upd.notes != null && { notes: String(upd.notes) }),
      ...(upd.status === "acknowledged" && { acknowledgedAt: new Date() }),
    }).where(eq(performanceReviewsTable.id, ev.id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete("/hr/evaluations/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [ev] = await db.select().from(performanceReviewsTable)
      .where(and(eq(performanceReviewsTable.organizationId, orgId), eq(performanceReviewsTable.id, req.params.id))).limit(1);
    if (!ev) { res.status(404).json({ error: "Évaluation introuvable" }); return; }
    await db.delete(performanceReviewsTable).where(eq(performanceReviewsTable.id, ev.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// FORMATIONS
// ════════════════════════════════════════════════════════════════
router.get("/hr/training", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status } = req.query as { status?: string };
    const conditions = [eq(trainingSessionsTable.organizationId, orgId)];
    if (status) conditions.push(eq(trainingSessionsTable.status, status));
    const rows = await db.select({
      id: trainingSessionsTable.id,
      title: trainingSessionsTable.title,
      type: trainingSessionsTable.type,
      provider: trainingSessionsTable.provider,
      location: trainingSessionsTable.location,
      startDate: trainingSessionsTable.startDate,
      endDate: trainingSessionsTable.endDate,
      durationHours: trainingSessionsTable.durationHours,
      cost: trainingSessionsTable.cost,
      currency: trainingSessionsTable.currency,
      maxParticipants: trainingSessionsTable.maxParticipants,
      status: trainingSessionsTable.status,
      participantCount: sql<number>`(
        SELECT COUNT(*) FROM training_participants WHERE training_participants.training_session_id = ${trainingSessionsTable.id}
      )`,
    }).from(trainingSessionsTable)
      .where(and(...conditions))
      .orderBy(desc(trainingSessionsTable.startDate));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/hr/training", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { title, type, provider, description, location, startDate, endDate, durationHours, cost, maxParticipants, status, notes } =
      req.body as {
        title: string; type?: string; provider?: string; description?: string; location?: string;
        startDate?: string; endDate?: string; durationHours?: number; cost?: number;
        maxParticipants?: number; status?: string; notes?: string;
      };
    if (!title) { res.status(400).json({ error: "Le titre est requis" }); return; }
    const [row] = await db.insert(trainingSessionsTable).values({
      organizationId: orgId, title, type, provider, description, location, startDate, endDate,
      durationHours: durationHours != null ? String(durationHours) : undefined,
      cost: cost != null ? String(cost) : undefined,
      maxParticipants, status, notes,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/hr/training/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [session] = await db.select().from(trainingSessionsTable)
      .where(and(eq(trainingSessionsTable.organizationId, orgId), eq(trainingSessionsTable.id, req.params.id))).limit(1);
    if (!session) { res.status(404).json({ error: "Formation introuvable" }); return; }
    const participants = await db.select({
      id: trainingParticipantsTable.id,
      collaboratorId: trainingParticipantsTable.collaboratorId,
      status: trainingParticipantsTable.status,
      score: trainingParticipantsTable.score,
      certificationDate: trainingParticipantsTable.certificationDate,
      notes: trainingParticipantsTable.notes,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      department: collaboratorsTable.department,
    }).from(trainingParticipantsTable)
      .leftJoin(collaboratorsTable, eq(trainingParticipantsTable.collaboratorId, collaboratorsTable.id))
      .where(eq(trainingParticipantsTable.trainingSessionId, session.id))
      .orderBy(asc(collaboratorsTable.lastName));
    res.json({ ...session, participants });
  } catch (e) { next(e); }
});

router.patch("/hr/training/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [s] = await db.select().from(trainingSessionsTable)
      .where(and(eq(trainingSessionsTable.organizationId, orgId), eq(trainingSessionsTable.id, req.params.id))).limit(1);
    if (!s) { res.status(404).json({ error: "Formation introuvable" }); return; }
    const upd = req.body as Record<string, unknown>;
    const [updated] = await db.update(trainingSessionsTable).set({
      ...(upd.title != null && { title: String(upd.title) }),
      ...(upd.status != null && { status: String(upd.status) }),
      ...(upd.provider != null && { provider: String(upd.provider) }),
      ...(upd.location != null && { location: String(upd.location) }),
      ...(upd.startDate != null && { startDate: String(upd.startDate) }),
      ...(upd.endDate != null && { endDate: String(upd.endDate) }),
      ...(upd.notes != null && { notes: String(upd.notes) }),
      ...(upd.cost != null && { cost: String(upd.cost) }),
      ...(upd.maxParticipants != null && { maxParticipants: Number(upd.maxParticipants) }),
    }).where(eq(trainingSessionsTable.id, s.id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.post("/hr/training/:id/participants", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [s] = await db.select().from(trainingSessionsTable)
      .where(and(eq(trainingSessionsTable.organizationId, orgId), eq(trainingSessionsTable.id, req.params.id))).limit(1);
    if (!s) { res.status(404).json({ error: "Formation introuvable" }); return; }
    const { collaboratorId, status } = req.body as { collaboratorId: string; status?: string };
    if (!collaboratorId) { res.status(400).json({ error: "collaboratorId requis" }); return; }
    const [p] = await db.insert(trainingParticipantsTable).values({
      organizationId: orgId,
      trainingSessionId: s.id,
      collaboratorId,
      status: status ?? "registered",
    }).returning();
    res.status(201).json(p);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// MOUVEMENTS DU PERSONNEL
// ════════════════════════════════════════════════════════════════
router.get("/hr/movements", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { type } = req.query as { type?: string };
    const conditions = [eq(personnelMovementsTable.organizationId, orgId)];
    if (type) conditions.push(eq(personnelMovementsTable.type, type));
    const rows = await db.select({
      id: personnelMovementsTable.id,
      collaboratorId: personnelMovementsTable.collaboratorId,
      type: personnelMovementsTable.type,
      effectiveDate: personnelMovementsTable.effectiveDate,
      previousSalary: personnelMovementsTable.previousSalary,
      newSalary: personnelMovementsTable.newSalary,
      reason: personnelMovementsTable.reason,
      createdAt: personnelMovementsTable.createdAt,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      department: collaboratorsTable.department,
      jobTitle: collaboratorsTable.position,
    }).from(personnelMovementsTable)
      .leftJoin(collaboratorsTable, eq(personnelMovementsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...conditions))
      .orderBy(desc(personnelMovementsTable.effectiveDate));
    res.json(rows.map((r) => ({
      ...r,
      previousSalary: r.previousSalary != null ? Number(r.previousSalary) : null,
      newSalary: r.newSalary != null ? Number(r.newSalary) : null,
    })));
  } catch (e) { next(e); }
});

router.post("/hr/movements", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const {
      collaboratorId, type, effectiveDate,
      previousDepartmentId, previousPositionId, previousSalary,
      newDepartmentId, newPositionId, newSalary,
      reason, approvedById, notes,
    } = req.body as {
      collaboratorId: string; type: string; effectiveDate: string;
      previousDepartmentId?: string; previousPositionId?: string; previousSalary?: number;
      newDepartmentId?: string; newPositionId?: string; newSalary?: number;
      reason?: string; approvedById?: string; notes?: string;
    };
    if (!collaboratorId || !type || !effectiveDate) {
      res.status(400).json({ error: "collaboratorId, type et effectiveDate requis" }); return;
    }
    const [row] = await db.insert(personnelMovementsTable).values({
      organizationId: orgId,
      collaboratorId, type, effectiveDate,
      previousDepartmentId, previousPositionId,
      previousSalary: previousSalary != null ? String(previousSalary) : undefined,
      newDepartmentId, newPositionId,
      newSalary: newSalary != null ? String(newSalary) : undefined,
      reason, approvedById, notes,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/hr/movements/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select().from(personnelMovementsTable)
      .where(and(eq(personnelMovementsTable.organizationId, orgId), eq(personnelMovementsTable.id, req.params.id))).limit(1);
    if (!row) { res.status(404).json({ error: "Mouvement introuvable" }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/hr/movements/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select().from(personnelMovementsTable)
      .where(and(eq(personnelMovementsTable.organizationId, orgId), eq(personnelMovementsTable.id, req.params.id))).limit(1);
    if (!row) { res.status(404).json({ error: "Mouvement introuvable" }); return; }
    await db.delete(personnelMovementsTable).where(eq(personnelMovementsTable.id, row.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
