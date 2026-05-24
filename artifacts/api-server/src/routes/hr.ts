import { Router } from "express";
import PDFDocument from "pdfkit";
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
  payslipsTable,
  payrollRunsTable,
} from "@workspace/db";
import { and, asc, eq, isNull, sql, desc, gte, lte, inArray } from "drizzle-orm";
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

// ════════════════════════════════════════════════════════════════
// ÉDITION PROFIL COLLABORATEUR (admin / manager)
// ════════════════════════════════════════════════════════════════

/** PUT /api/hr/collaborators/:id/profile — mise à jour complète par admin/manager.
 *  - Tous les champs RH sont modifiables.
 *  - baseSalary est réservé aux rôles admin/super_admin.
 */
router.put("/hr/collaborators/:id/profile", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const isAdmin = ["admin", "super_admin"].includes(req.authUser!.role);

    const {
      firstName, lastName, email, phone, nationalId, birthDate, address,
      emergencyContact, employeeNumber, departmentId, positionId, position,
      department, managerCollaboratorId, hireDate, employmentStatus, isAvailable,
      avatarUrl, baseSalary,
      // Champs coût employeur
      employerChargeRate, transportAllowance, housingAllowance, mealAllowance,
      otherBenefitsMonthly, weeklyHours,
    } = req.body;

    const updateData: Record<string, unknown> = {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(nationalId !== undefined && { nationalId }),
      ...(birthDate !== undefined && { birthDate: birthDate || null }),
      ...(address !== undefined && { address }),
      ...(emergencyContact !== undefined && { emergencyContact: emergencyContact || null }),
      ...(employeeNumber !== undefined && { employeeNumber }),
      ...(position !== undefined && { position }),
      ...(department !== undefined && { department }),
      ...(departmentId !== undefined && { departmentId: departmentId || null }),
      ...(positionId !== undefined && { positionId: positionId || null }),
      ...(managerCollaboratorId !== undefined && { managerCollaboratorId: managerCollaboratorId || null }),
      ...(hireDate !== undefined && { hireDate: hireDate || null }),
      ...(employmentStatus !== undefined && { employmentStatus }),
      ...(isAvailable !== undefined && { isAvailable }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
      ...(weeklyHours !== undefined && { weeklyHours: weeklyHours != null ? String(weeklyHours) : null }),
    };

    if (isAdmin && baseSalary !== undefined) {
      updateData.baseSalary = baseSalary != null ? String(baseSalary) : null;
    }
    // Champs coût employeur : réservés manager+
    if (employerChargeRate !== undefined) updateData.employerChargeRate = employerChargeRate != null ? String(employerChargeRate) : null;
    if (transportAllowance !== undefined) updateData.transportAllowance = transportAllowance != null ? String(transportAllowance) : "0";
    if (housingAllowance   !== undefined) updateData.housingAllowance   = housingAllowance   != null ? String(housingAllowance)   : "0";
    if (mealAllowance      !== undefined) updateData.mealAllowance      = mealAllowance      != null ? String(mealAllowance)      : "0";
    if (otherBenefitsMonthly !== undefined) updateData.otherBenefitsMonthly = otherBenefitsMonthly != null ? String(otherBenefitsMonthly) : "0";

    const [collab] = await db.update(collaboratorsTable)
      .set(updateData as any)
      .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.id, req.params.id)))
      .returning();
    if (!collab) { res.status(404).json({ error: "Collaborateur introuvable" }); return; }
    res.json(collab);
  } catch (e) { next(e); }
});

/** PATCH /api/hr/collaborators/:id/avatar — mise à jour avatar (admin/manager OU propriétaire).
 *  Body : { avatarUrl: "data:image/..." } — base64 data URL, max 2 Mo.
 */
router.patch("/hr/collaborators/:id/avatar", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const { avatarUrl } = req.body;

    if (!avatarUrl) { res.status(400).json({ error: "avatarUrl requis" }); return; }
    if (typeof avatarUrl === "string" && avatarUrl.length > 2.8 * 1024 * 1024) {
      res.status(400).json({ error: "Image trop volumineuse (max 2 Mo)" }); return;
    }

    const isManagerOrAbove = ["admin", "super_admin", "manager"].includes(req.authUser!.role);
    if (!isManagerOrAbove) {
      const [own] = await db.select({ id: collaboratorsTable.id })
        .from(collaboratorsTable)
        .where(and(eq(collaboratorsTable.userId, userId), eq(collaboratorsTable.organizationId, orgId)))
        .limit(1);
      if (!own || own.id !== req.params.id) {
        res.status(403).json({ error: "Accès refusé : vous ne pouvez modifier que votre propre avatar" }); return;
      }
    }

    const [collab] = await db.update(collaboratorsTable)
      .set({ avatarUrl })
      .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.id, req.params.id)))
      .returning({ id: collaboratorsTable.id, avatarUrl: collaboratorsTable.avatarUrl });
    if (!collab) { res.status(404).json({ error: "Collaborateur introuvable" }); return; }
    res.json(collab);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// MON PROFIL (self-service utilisateur)
// ════════════════════════════════════════════════════════════════

/** GET /api/hr/me/profile — profil collaborateur de l'utilisateur connecté (via userId). */
router.get("/hr/me/profile", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const [collab] = await db.select().from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.userId, userId), eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)))
      .limit(1);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié à votre compte" }); return; }
    res.json(collab);
  } catch (e) { next(e); }
});

/** PATCH /api/hr/me/profile — auto-modification des champs non sensibles.
 *  Champs autorisés : phone, address, emergencyContact, avatarUrl.
 *  Tout autre champ est ignoré (pas de modification de salaire/poste/statut en self-service).
 */
router.patch("/hr/me/profile", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const [existing] = await db.select({ id: collaboratorsTable.id })
      .from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.userId, userId), eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Aucun profil collaborateur lié à votre compte" }); return; }

    const { phone, address, emergencyContact, avatarUrl } = req.body;
    if (avatarUrl && typeof avatarUrl === "string" && avatarUrl.length > 2.8 * 1024 * 1024) {
      res.status(400).json({ error: "Image trop volumineuse (max 2 Mo)" }); return;
    }

    const updateData: Record<string, unknown> = {};
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact || null;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;

    const [collab] = await db.update(collaboratorsTable)
      .set(updateData as any)
      .where(eq(collaboratorsTable.id, existing.id))
      .returning();
    res.json(collab);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// SELF-SERVICE COLLABORATEUR — /hr/me/*
// ════════════════════════════════════════════════════════════════

async function getMyCollab(userId: string, orgId: string) {
  const [collab] = await db.select().from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.userId, userId), eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)))
    .limit(1);
  return collab ?? null;
}

const toN = (v: unknown): number => (v == null ? 0 : Number(v));
const fmtFCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

/** GET /hr/me/payslips — bulletins de paie de l'employé connecté */
router.get("/hr/me/payslips", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const payslips = await db.select({
      id: payslipsTable.id,
      period: payslipsTable.period,
      baseSalary: payslipsTable.baseSalary,
      grossSalary: payslipsTable.grossSalary,
      netSalary: payslipsTable.netSalary,
      cnssEmployee: payslipsTable.cnssEmployee,
      cnssEmployer: payslipsTable.cnssEmployer,
      irpp: payslipsTable.irpp,
      ipts: payslipsTable.ipts,
      status: payslipsTable.status,
      paidAt: payslipsTable.paidAt,
      runStatus: payrollRunsTable.status,
    })
      .from(payslipsTable)
      .leftJoin(payrollRunsTable, eq(payslipsTable.payrollRunId, payrollRunsTable.id))
      .where(and(eq(payslipsTable.collaboratorId, collab.id), eq(payslipsTable.organizationId, orgId)))
      .orderBy(desc(payslipsTable.period));

    res.json(payslips.map(p => ({
      ...p,
      baseSalary: toN(p.baseSalary), grossSalary: toN(p.grossSalary), netSalary: toN(p.netSalary),
      cnssEmployee: toN(p.cnssEmployee), cnssEmployer: toN(p.cnssEmployer),
      irpp: toN(p.irpp), ipts: toN(p.ipts),
    })));
  } catch (e) { next(e); }
});

/** GET /hr/me/payslips/:id/pdf — télécharger son bulletin de paie en PDF */
router.get("/hr/me/payslips/:id/pdf", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const [payslip] = await db.select().from(payslipsTable)
      .where(and(eq(payslipsTable.id, req.params.id), eq(payslipsTable.collaboratorId, collab.id), eq(payslipsTable.organizationId, orgId)))
      .limit(1);
    if (!payslip) { res.status(404).json({ error: "Bulletin introuvable" }); return; }

    const fullName = `${collab.firstName} ${collab.lastName}`;
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="bulletin-${payslip.period}-${collab.lastName}.pdf"`);
    doc.pipe(res);

    // En-tête fond sombre
    doc.rect(0, 0, 595, 80).fill("#0f172a");
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold").text("BULLETIN DE PAIE", 40, 18);
    doc.fontSize(10).font("Helvetica").text(`Période : ${payslip.period}`, 40, 48);
    doc.fontSize(9).text("Gaméasù Technology", 440, 18, { width: 115, align: "right" });
    doc.fontSize(8).fillColor("#94a3b8").text("Document officiel", 440, 34, { width: 115, align: "right" });

    // Bloc collaborateur
    doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold").text("Collaborateur", 40, 100);
    doc.moveTo(40, 116).lineTo(555, 116).lineWidth(0.5).stroke("#e2e8f0");
    doc.fillColor("#374151").fontSize(9).font("Helvetica");
    doc.text(`Nom complet : ${fullName}`, 40, 124);
    doc.text(`Poste : ${collab.jobTitle ?? "—"}`, 40, 140);
    const period = payslip.period;
    const [yr, mo] = period.split("-");
    const moisFr = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const moisLabel = moisFr[parseInt(mo, 10) - 1] ?? mo;
    doc.text(`Période de paie : ${moisLabel} ${yr}`, 300, 124);
    doc.text(`Statut : ${payslip.status === "validated" ? "Validé" : payslip.status === "paid" ? "Payé" : "En cours"}`, 300, 140);

    // En-tête tableau
    const tableTop = 180;
    doc.rect(40, tableTop, 515, 22).fill("#1e293b");
    doc.fillColor("white").fontSize(9).font("Helvetica-Bold");
    doc.text("Élément de rémunération", 50, tableTop + 7);
    doc.text("Montant (FCFA)", 430, tableTop + 7, { width: 115, align: "right" });

    // Lignes
    const gains: Array<[string, number]> = [
      ["Salaire de base", toN(payslip.baseSalary)],
    ];
    if (payslip.additions && Array.isArray(payslip.additions)) {
      for (const a of payslip.additions as Array<{ label: string; amount: number }>) {
        gains.push([a.label ?? "Prime", toN(a.amount)]);
      }
    }
    gains.push(["Salaire brut", toN(payslip.grossSalary)]);

    let y = tableTop + 28;
    let altRow = false;
    for (const [label, amount] of gains) {
      if (altRow) doc.rect(40, y - 2, 515, 18).fill("#f8fafc");
      altRow = !altRow;
      doc.fillColor(label === "Salaire brut" ? "#0f172a" : "#374151")
        .font(label === "Salaire brut" ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9);
      doc.text(label, 50, y);
      doc.fillColor("#047857").text(fmtFCFA(amount), 430, y, { width: 115, align: "right" });
      y += 18;
    }

    // Séparateur retenues
    y += 4;
    doc.rect(40, y, 515, 20).fill("#fef3c7");
    doc.fillColor("#92400e").fontSize(8).font("Helvetica-Bold").text("RETENUES SALARIALES", 50, y + 6);
    y += 26;

    const retenues: Array<[string, number]> = [
      ["CNSS salarié (4%)", toN(payslip.cnssEmployee)],
      ["IPTS — Impôt sur salaires (2%)", toN(payslip.ipts)],
      ["IRPP — Impôt sur le revenu", toN(payslip.irpp)],
    ];
    altRow = false;
    let totalRetenues = 0;
    for (const [label, amount] of retenues) {
      if (altRow) doc.rect(40, y - 2, 515, 18).fill("#fef9f0");
      altRow = !altRow;
      doc.fillColor("#374151").font("Helvetica").fontSize(9).text(label, 50, y);
      doc.fillColor("#dc2626").text(`- ${fmtFCFA(amount)}`, 430, y, { width: 115, align: "right" });
      totalRetenues += amount;
      y += 18;
    }

    // NET À PAYER
    y += 8;
    doc.rect(40, y, 515, 38).fill("#0f172a");
    doc.fillColor("white").fontSize(13).font("Helvetica-Bold");
    doc.text("NET À PAYER", 50, y + 12);
    doc.text(fmtFCFA(toN(payslip.netSalary)), 350, y + 12, { width: 195, align: "right" });

    // Charges patronales
    y += 56;
    doc.rect(40, y, 515, 30).fill("#f1f5f9");
    doc.fillColor("#64748b").fontSize(8).font("Helvetica");
    doc.text(`Charges patronales CNSS (16,4%) : ${fmtFCFA(toN(payslip.cnssEmployer))}`, 50, y + 6);
    doc.text(`Coût total employeur : ${fmtFCFA(toN(payslip.grossSalary) + toN(payslip.cnssEmployer))}`, 50, y + 18);

    // Pied de page
    doc.moveTo(40, 770).lineTo(555, 770).lineWidth(0.5).stroke("#e2e8f0");
    doc.fillColor("#94a3b8").fontSize(7).font("Helvetica")
      .text("Document généré automatiquement par Gaméasù Technology. Ce bulletin est confidentiel.", 40, 776, { align: "center", width: 515 });

    doc.end();
  } catch (e) { next(e); }
});

/** GET /api/payroll/payslips/:id/pdf — export PDF admin (sans restriction collab) */
router.get("/payroll/payslips/:id/pdf", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [payslip] = await db.select().from(payslipsTable)
      .where(and(eq(payslipsTable.id, req.params.id), eq(payslipsTable.organizationId, orgId)))
      .limit(1);
    if (!payslip) { res.status(404).json({ error: "Bulletin introuvable" }); return; }

    const [collab] = await db.select().from(collaboratorsTable)
      .where(eq(collaboratorsTable.id, payslip.collaboratorId))
      .limit(1);

    const fullName = collab ? `${collab.firstName} ${collab.lastName}` : "Collaborateur";
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="bulletin-${payslip.period}-${collab?.lastName ?? "collab"}.pdf"`);
    doc.pipe(res);

    doc.rect(0, 0, 595, 80).fill("#0f172a");
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold").text("BULLETIN DE PAIE", 40, 18);
    doc.fontSize(10).font("Helvetica").text(`Période : ${payslip.period}`, 40, 48);
    doc.fontSize(9).text("Gaméasù Technology", 440, 18, { width: 115, align: "right" });

    doc.fillColor("#374151").fontSize(9).font("Helvetica");
    const period = payslip.period;
    const [yr, mo] = period.split("-");
    const moisFr = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    doc.text(`Collaborateur : ${fullName}`, 40, 104);
    doc.text(`Poste : ${collab?.jobTitle ?? "—"}`, 40, 120);
    doc.text(`Période : ${moisFr[parseInt(mo, 10) - 1] ?? mo} ${yr}`, 300, 104);
    doc.text(`Statut : ${payslip.status === "validated" ? "Validé" : payslip.status === "paid" ? "Payé" : "Brouillon"}`, 300, 120);

    const tableTop = 156;
    doc.rect(40, tableTop, 515, 22).fill("#1e293b");
    doc.fillColor("white").fontSize(9).font("Helvetica-Bold");
    doc.text("Élément", 50, tableTop + 7);
    doc.text("Montant (FCFA)", 430, tableTop + 7, { width: 115, align: "right" });

    let y = tableTop + 28;
    const items: Array<[string, number, boolean]> = [
      ["Salaire de base", toN(payslip.baseSalary), false],
      ["Salaire brut", toN(payslip.grossSalary), true],
      ["- CNSS salarié (4%)", -toN(payslip.cnssEmployee), false],
      ["- IPTS (2%)", -toN(payslip.ipts), false],
      ["- IRPP", -toN(payslip.irpp), false],
    ];
    for (const [label, amount, bold] of items) {
      doc.fillColor("#374151").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).text(label, 50, y);
      doc.fillColor(amount >= 0 ? "#047857" : "#dc2626")
        .text(fmtFCFA(Math.abs(amount)), 430, y, { width: 115, align: "right" });
      y += 18;
    }

    y += 6;
    doc.rect(40, y, 515, 36).fill("#0f172a");
    doc.fillColor("white").fontSize(13).font("Helvetica-Bold");
    doc.text("NET À PAYER", 50, y + 11);
    doc.text(fmtFCFA(toN(payslip.netSalary)), 350, y + 11, { width: 195, align: "right" });

    y += 52;
    doc.fillColor("#64748b").fontSize(8).font("Helvetica");
    doc.text(`Charges patronales CNSS (16,4%) : ${fmtFCFA(toN(payslip.cnssEmployer))}  |  Coût total employeur : ${fmtFCFA(toN(payslip.grossSalary) + toN(payslip.cnssEmployer))}`, 40, y, { width: 515, align: "center" });

    doc.moveTo(40, 770).lineTo(555, 770).lineWidth(0.5).stroke("#e2e8f0");
    doc.fillColor("#94a3b8").fontSize(7).text("Document généré par Gaméasù Technology — Confidentiel", 40, 776, { align: "center", width: 515 });
    doc.end();
  } catch (e) { next(e); }
});

/** GET /hr/me/contract — contrat actif de l'employé connecté */
router.get("/hr/me/contract", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const [contract] = await db.select().from(contractsTable)
      .where(and(eq(contractsTable.collaboratorId, collab.id), eq(contractsTable.organizationId, orgId), eq(contractsTable.status, "active")))
      .orderBy(desc(contractsTable.startDate))
      .limit(1);
    if (!contract) { res.status(404).json({ error: "Aucun contrat actif" }); return; }
    res.json({ ...contract, monthlySalary: contract.monthlySalary ? Number(contract.monthlySalary) : null });
  } catch (e) { next(e); }
});

/** GET /hr/me/leave-requests */
router.get("/hr/me/leave-requests", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }
    const rows = await db.select().from(leaveRequestsTable)
      .where(and(eq(leaveRequestsTable.collaboratorId, collab.id), eq(leaveRequestsTable.organizationId, orgId)))
      .orderBy(desc(leaveRequestsTable.createdAt));
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /hr/me/leave-requests — soumettre une demande de congé */
router.post("/hr/me/leave-requests", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const { type, startDate, endDate, reason } = req.body as { type: string; startDate: string; endDate: string; reason?: string };
    if (!type || !startDate || !endDate) {
      res.status(400).json({ error: "type, startDate et endDate sont requis" }); return;
    }
    const s = new Date(startDate), e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) {
      res.status(400).json({ error: "Dates invalides" }); return;
    }
    let days = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }
    if (days <= 0) { res.status(400).json({ error: "Aucun jour ouvré dans la période sélectionnée" }); return; }

    const [created] = await db.insert(leaveRequestsTable).values({
      organizationId: orgId,
      collaboratorId: collab.id,
      type,
      startDate,
      endDate,
      days,
      reason: reason ?? null,
      status: "pending",
    }).returning();
    res.status(201).json(created);
  } catch (e) { next(e); }
});

/** PATCH /hr/me/leave-requests/:id/cancel — annuler sa propre demande de congé */
router.patch("/hr/me/leave-requests/:id/cancel", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const [existing] = await db.select().from(leaveRequestsTable)
      .where(and(eq(leaveRequestsTable.id, req.params.id), eq(leaveRequestsTable.collaboratorId, collab.id), eq(leaveRequestsTable.organizationId, orgId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Demande introuvable" }); return; }
    if (!["pending"].includes(existing.status)) {
      res.status(400).json({ error: "Seules les demandes en attente peuvent être annulées" }); return;
    }
    const [updated] = await db.update(leaveRequestsTable)
      .set({ status: "cancelled" })
      .where(eq(leaveRequestsTable.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (e) { next(e); }
});

/** GET /hr/me/leave-balance — solde de congés par type */
router.get("/hr/me/leave-balance", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const requests = await db.select({
      type: leaveRequestsTable.type,
      days: leaveRequestsTable.days,
      status: leaveRequestsTable.status,
    }).from(leaveRequestsTable).where(and(
      eq(leaveRequestsTable.collaboratorId, collab.id),
      eq(leaveRequestsTable.organizationId, orgId),
      gte(leaveRequestsTable.startDate, yearStart),
      lte(leaveRequestsTable.startDate, yearEnd),
    ));

    const annualRights: Record<string, number> = {
      congé_payé: 26, RTT: 10, maladie: 15, maternité: 98,
      paternité: 10, sans_solde: 0, formation: 5, exceptionnel: 3,
    };

    const byType: Record<string, { taken: number; pending: number; right: number; remaining: number }> = {};
    for (const r of requests) {
      const t = r.type ?? "autre";
      if (!byType[t]) byType[t] = { taken: 0, pending: 0, right: annualRights[t] ?? 0, remaining: 0 };
      if (r.status === "approved") byType[t].taken += r.days ?? 0;
      else if (r.status === "pending") byType[t].pending += r.days ?? 0;
    }
    if (!byType["congé_payé"]) byType["congé_payé"] = { taken: 0, pending: 0, right: 26, remaining: 26 };
    for (const t of Object.keys(byType)) {
      byType[t].remaining = Math.max(0, byType[t].right - byType[t].taken);
    }
    res.json({ year, byType });
  } catch (e) { next(e); }
});

/** GET /hr/me/documents — documents RH de l'employé */
router.get("/hr/me/documents", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }
    const docs = await db.select().from(hrDocumentsTable)
      .where(and(eq(hrDocumentsTable.collaboratorId, collab.id), eq(hrDocumentsTable.organizationId, orgId)))
      .orderBy(desc(hrDocumentsTable.createdAt));
    res.json(docs);
  } catch (e) { next(e); }
});

/** GET /hr/me/training — formations de l'employé connecté */
router.get("/hr/me/training", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const sessions = await db.select({
      sessionId: trainingSessionsTable.id,
      title: trainingSessionsTable.title,
      description: trainingSessionsTable.description,
      startDate: trainingSessionsTable.startDate,
      endDate: trainingSessionsTable.endDate,
      location: trainingSessionsTable.location,
      sessionStatus: trainingSessionsTable.status,
      participantStatus: trainingParticipantsTable.status,
      score: trainingParticipantsTable.score,
      certificationDate: trainingParticipantsTable.certificationDate,
    }).from(trainingParticipantsTable)
      .innerJoin(trainingSessionsTable, eq(trainingParticipantsTable.trainingSessionId, trainingSessionsTable.id))
      .where(and(
        eq(trainingParticipantsTable.collaboratorId, collab.id),
        eq(trainingSessionsTable.organizationId, orgId),
      ))
      .orderBy(desc(trainingSessionsTable.startDate));
    res.json(sessions);
  } catch (e) { next(e); }
});

/** GET /hr/me/evaluations — évaluations de performance de l'employé */
router.get("/hr/me/evaluations", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }
    const evals = await db.select().from(performanceReviewsTable)
      .where(and(eq(performanceReviewsTable.collaboratorId, collab.id), eq(performanceReviewsTable.organizationId, orgId)))
      .orderBy(desc(performanceReviewsTable.reviewDate));
    res.json(evals);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// ORGANIGRAMME VISUEL RH
// ════════════════════════════════════════════════════════════════

/** GET /hr/orgchart — arbre hiérarchique par département */
router.get("/hr/orgchart", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [depts, collabs] = await Promise.all([
      db.select().from(departmentsTable).where(eq(departmentsTable.organizationId, orgId)).orderBy(departmentsTable.name),
      db.select({
        id: collaboratorsTable.id,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        jobTitle: collaboratorsTable.jobTitle,
        departmentId: collaboratorsTable.departmentId,
        avatarUrl: collaboratorsTable.avatarUrl,
        status: collaboratorsTable.status,
      }).from(collaboratorsTable)
        .where(and(
          eq(collaboratorsTable.organizationId, orgId),
          isNull(collaboratorsTable.deletedAt),
          eq(collaboratorsTable.status, "active"),
        )),
    ]);
    res.json({ departments: depts, collaborators: collabs });
  } catch (e) { next(e); }
});

export default router;

