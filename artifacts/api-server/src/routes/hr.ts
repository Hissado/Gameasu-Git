import { Router } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
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
  leaveBalancesTable,
  leavePoliciesTable,
  jobOffersTable,
  candidaciesTable,
  performanceReviewsTable,
  trainingSessionsTable,
  trainingParticipantsTable,
  personnelMovementsTable,
  payslipsTable,
  payrollRunsTable,
  irppBracketsTable,
  attendanceSessionsTable,
  attendanceFlagsTable,
  usersTable,
  bankTransferOrdersTable,
  organizationsTable,
  hrAuditLogsTable,
} from "@workspace/db";
import { and, asc, count, eq, isNull, isNotNull, sql, desc, gte, lte, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { requirePermission } from "../middlewares/permissions";
import { conversationsTable, conversationParticipantsTable } from "@workspace/db";
import { emitToUser } from "../lib/realtime";

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

router.post("/hr/departments", requirePermission("hr.manage"), async (req, res) => {
  const { code, name, description, parentId, headCollaboratorId, color } = req.body;
  if (!code || !name) return res.status(400).json({ error: "code et name requis" });
  try {
    const [d] = await db.insert(departmentsTable).values({
      organizationId: req.authUser!.organizationId, code, name, description, parentId, headCollaboratorId, color }).returning();

    // T004 : Créer automatiquement un groupe de messagerie pour le département
    try {
      const [conv] = await db.insert(conversationsTable).values({
        organizationId: req.authUser!.organizationId,
        type: "group",
        title: `${name} — Équipe`,
      }).returning({ id: conversationsTable.id });
      if (conv) {
        await db.insert(conversationParticipantsTable).values({
          organizationId: req.authUser!.organizationId,
          conversationId: conv.id,
          userId: req.authUser!.id,
        });
        emitToUser(req.authUser!.id, "conversation:new", { id: conv.id, title: `${name} — Équipe`, type: "group" });
      }
    } catch { /* silencieux — ne doit pas bloquer la création du département */ }

    return res.status(201).json(d);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.put("/hr/departments/:id", requirePermission("hr.manage"), async (req, res) => {
  const { code, name, description, parentId, headCollaboratorId, color } = req.body;
  const [d] = await db.update(departmentsTable)
    .set({ code, name, description, parentId, headCollaboratorId, color })
    .where(and(eq(departmentsTable.organizationId, req.authUser!.organizationId), eq(departmentsTable.id, (req.params.id as string)))).returning();
  if (!d) return res.status(404).json({ error: "Not found" });
  return res.json(d);
});

router.delete("/hr/departments/:id", requirePermission("hr.manage"), async (req, res) => {
  await db.delete(departmentsTable).where(and(eq(departmentsTable.organizationId, req.authUser!.organizationId), eq(departmentsTable.id, (req.params.id as string))));
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

router.post("/hr/positions", requirePermission("hr.manage"), async (req, res) => {
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

router.put("/hr/positions/:id", requirePermission("hr.manage"), async (req, res) => {
  const { code, title, departmentId, description, level } = req.body;
  const [p] = await db.update(positionsTable)
    .set({ code, title, departmentId, description, level })
    .where(and(eq(positionsTable.organizationId, req.authUser!.organizationId), eq(positionsTable.id, (req.params.id as string)))).returning();
  if (!p) return res.status(404).json({ error: "Not found" });
  return res.json(p);
});

router.delete("/hr/positions/:id", requirePermission("hr.manage"), async (req, res) => {
  await db.delete(positionsTable).where(and(eq(positionsTable.organizationId, req.authUser!.organizationId), eq(positionsTable.id, (req.params.id as string))));
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

router.post("/hr/contracts", requirePermission("hr.manage"), async (req, res) => {
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

router.put("/hr/contracts/:id", requirePermission("hr.manage"), async (req, res) => {
  const { type, status, startDate, endDate, monthlySalary, currency, jobTitle, workLocation, weeklyHours, terms, signedAt, fileUrl } = req.body;
  const [c] = await db.update(contractsTable).set({
    type, status, startDate, endDate, monthlySalary: monthlySalary?.toString(), currency,
    jobTitle, workLocation, weeklyHours: weeklyHours?.toString(),
    terms, signedAt: signedAt ? new Date(signedAt) : null, fileUrl,
  }).where(and(eq(contractsTable.organizationId, req.authUser!.organizationId), eq(contractsTable.id, (req.params.id as string)))).returning();
  if (!c) return res.status(404).json({ error: "Not found" });
  return res.json(c);
});

router.delete("/hr/contracts/:id", requirePermission("hr.manage"), async (req, res) => {
  await db.delete(contractsTable).where(and(eq(contractsTable.organizationId, req.authUser!.organizationId), eq(contractsTable.id, (req.params.id as string))));
  return res.status(204).send();
});

router.get("/hr/contracts/export.xlsx", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { collaboratorId, status } = req.query as Record<string, string>;
    const wheres: any[] = [eq(contractsTable.organizationId, orgId)];
    if (collaboratorId) wheres.push(eq(contractsTable.collaboratorId, collaboratorId));
    if (status) wheres.push(eq(contractsTable.status, status));
    const rows = await db.select({ c: contractsTable, fn: collaboratorsTable.firstName, ln: collaboratorsTable.lastName })
      .from(contractsTable)
      .leftJoin(collaboratorsTable, eq(contractsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...wheres))
      .orderBy(desc(contractsTable.startDate));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Contrats");
    ws.columns = [
      { header: "Collaborateur", key: "name", width: 26 },
      { header: "Type", key: "type", width: 10 },
      { header: "Intitulé poste", key: "jobTitle", width: 24 },
      { header: "Statut", key: "status", width: 12 },
      { header: "Début", key: "startDate", width: 13 },
      { header: "Fin", key: "endDate", width: 13 },
      { header: "Salaire mensuel (FCFA)", key: "monthlySalary", width: 22 },
      { header: "Lieu", key: "workLocation", width: 18 },
    ];
    const hdr = ws.getRow(1);
    hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
    rows.forEach(({ c, fn, ln }) => ws.addRow({
      name: `${ln ?? ""} ${fn ?? ""}`.trim(),
      type: c.type, jobTitle: c.jobTitle ?? "", status: c.status,
      startDate: c.startDate, endDate: c.endDate ?? "",
      monthlySalary: c.monthlySalary ? Number(c.monthlySalary) : "",
      workLocation: c.workLocation ?? "",
    }));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="contrats.xlsx"`);
    await wb.xlsx.write(res); res.end();
  } catch (e) { next(e); }
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

router.post("/hr/documents", requirePermission("hr.manage"), async (req, res) => {
  const { collaboratorId, type, name, fileUrl, expiresAt, notes } = req.body;
  if (!collaboratorId || !type || !name || !fileUrl) return res.status(400).json({ error: "Champs requis manquants" });
  const [d] = await db.insert(hrDocumentsTable).values({
      organizationId: req.authUser!.organizationId, collaboratorId, type, name, fileUrl, expiresAt, notes }).returning();
  return res.status(201).json(d);
});

router.delete("/hr/documents/:id", requirePermission("hr.manage"), async (req, res) => {
  await db.delete(hrDocumentsTable).where(and(eq(hrDocumentsTable.organizationId, req.authUser!.organizationId), eq(hrDocumentsTable.id, (req.params.id as string))));
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

router.post("/hr/assignments", requirePermission("hr.manage"), async (req, res) => {
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

router.put("/hr/assignments/:id", requirePermission("hr.manage"), async (req, res) => {
  const { role, allocationPct, startDate, endDate, status, notes } = req.body;
  if (allocationPct != null && (typeof allocationPct !== "number" || allocationPct < 0 || allocationPct > 100)) {
    return res.status(400).json({ error: "allocationPct doit être un nombre entre 0 et 100" });
  }
  try {
    const a = await db.transaction(async (tx) => {
      const [updated] = await tx.update(collaboratorAssignmentsTable).set({
        role, allocationPct, startDate, endDate, status, notes,
      }).where(and(eq(collaboratorAssignmentsTable.organizationId, req.authUser!.organizationId), eq(collaboratorAssignmentsTable.id, (req.params.id as string)))).returning();
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

router.delete("/hr/assignments/:id", requirePermission("hr.manage"), async (req, res) => {
  await db.delete(collaboratorAssignmentsTable).where(and(eq(collaboratorAssignmentsTable.organizationId, req.authUser!.organizationId), eq(collaboratorAssignmentsTable.id, (req.params.id as string))));
  return res.status(204).send();
});

// ════════════════════════════════════════════════════════════════
// AUTO-AFFECTATION : rattache les collaborateurs existants aux pôles
// seedés en se basant sur l'ancien champ texte `department` ou
// `position`. Idempotent — n'écrase pas une affectation déjà posée.
// ════════════════════════════════════════════════════════════════
router.post("/hr/auto-assign-departments", requirePermission("hr.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
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

    const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.organizationId, orgId));
    const byCode = new Map(depts.map((d) => [d.code, d.id]));

    const allCollabs = await db.select().from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));
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
  const orgId = req.authUser!.organizationId;
  const collabId = (req.params.id as string);
  const collab = (await db.select().from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.id, collabId), eq(collaboratorsTable.organizationId, orgId))).limit(1))[0];
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

  const [orgRow] = await db.select({
    id: organizationsTable.id,
    name: organizationsTable.name,
    legalName: organizationsTable.legalName,
    logoUrl: organizationsTable.logoUrl,
  }).from(organizationsTable)
    .where(eq(organizationsTable.id, collab.organizationId))
    .limit(1);

  const totalAllocation = assignments
    .filter(a => a.a.status === "active")
    .reduce((s, a) => s + (a.a.allocationPct ?? 0), 0);

  return res.json({
    collaborator: {
      ...collab,
      baseSalary: collab.baseSalary ? Number(collab.baseSalary) : null,
    },
    organization: orgRow ?? null,
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
router.get("/hr/dashboard", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const today = new Date().toISOString().slice(0, 10);

  const [totalCollabs] = await db.select({ n: sql<number>`COUNT(*)` })
    .from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));

  const [activeContracts] = await db.select({ n: sql<number>`COUNT(*)` })
    .from(contractsTable)
    .where(and(eq(contractsTable.organizationId, orgId), eq(contractsTable.status, "active")));

  const byDept = await db.select({
    departmentId: collaboratorsTable.departmentId,
    departmentName: departmentsTable.name,
    n: sql<number>`COUNT(*)`,
  }).from(collaboratorsTable)
    .leftJoin(departmentsTable, and(eq(collaboratorsTable.departmentId, departmentsTable.id), eq(departmentsTable.organizationId, orgId)))
    .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)))
    .groupBy(collaboratorsTable.departmentId, departmentsTable.name);

  const recentHires = await db.select({
    id: collaboratorsTable.id,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    hireDate: collaboratorsTable.hireDate,
    avatarUrl: collaboratorsTable.avatarUrl,
  }).from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt), sql`${collaboratorsTable.hireDate} IS NOT NULL`))
    .orderBy(desc(collaboratorsTable.hireDate)).limit(5);

  // Contrats arrivant à échéance dans 30 jours
  const expiring = await db.select({
    c: contractsTable,
    collabFirst: collaboratorsTable.firstName,
    collabLast: collaboratorsTable.lastName,
    daysLeft: sql<number>`GREATEST(0, (${contractsTable.endDate} - CURRENT_DATE))`,
  }).from(contractsTable)
    .leftJoin(collaboratorsTable, and(eq(contractsTable.collaboratorId, collaboratorsTable.id), eq(collaboratorsTable.organizationId, orgId)))
    .where(and(
      eq(contractsTable.organizationId, orgId),
      eq(contractsTable.status, "active"),
      isNotNull(contractsTable.endDate),
      sql`${contractsTable.endDate} >= CURRENT_DATE`,
      sql`${contractsTable.endDate} <= CURRENT_DATE + INTERVAL '30 days'`,
    ))
    .orderBy(contractsTable.endDate);

  // Masse salariale totale (salaires de base actifs)
  const [masseSal] = await db.select({ total: sql<string>`COALESCE(SUM(${collaboratorsTable.baseSalary}), 0)` })
    .from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));

  // Absents aujourd'hui (congés approuvés couvrant la date du jour)
  const [absentsToday] = await db.select({ n: sql<number>`COUNT(*)` })
    .from(leaveRequestsTable)
    .where(and(
      eq(leaveRequestsTable.organizationId, orgId),
      eq(leaveRequestsTable.status, "approved"),
      sql`${leaveRequestsTable.startDate} <= ${today}`,
      sql`${leaveRequestsTable.endDate} >= ${today}`,
    ));

  // Répartition des âges
  const ageDist = await db.select({
    ageGroup: sql<string>`
      CASE
        WHEN ${collaboratorsTable.birthDate} IS NULL THEN 'Non renseigné'
        WHEN EXTRACT(YEAR FROM AGE(${collaboratorsTable.birthDate}::date)) < 26 THEN '18-25 ans'
        WHEN EXTRACT(YEAR FROM AGE(${collaboratorsTable.birthDate}::date)) < 36 THEN '26-35 ans'
        WHEN EXTRACT(YEAR FROM AGE(${collaboratorsTable.birthDate}::date)) < 46 THEN '36-45 ans'
        ELSE '45+ ans'
      END
    `,
    count: sql<number>`COUNT(*)`,
  }).from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  // Évolution de l'effectif : embauches cumulées par mois sur les 6 derniers mois
  const monthlyHires = await db.select({
    month: sql<string>`TO_CHAR(${collaboratorsTable.hireDate}::date, 'YYYY-MM')`,
    count: sql<number>`COUNT(*)`,
  }).from(collaboratorsTable)
    .where(and(
      eq(collaboratorsTable.organizationId, orgId),
      isNull(collaboratorsTable.deletedAt),
      sql`${collaboratorsTable.hireDate} IS NOT NULL`,
      sql`${collaboratorsTable.hireDate}::date >= CURRENT_DATE - INTERVAL '6 months'`,
    ))
    .groupBy(sql`TO_CHAR(${collaboratorsTable.hireDate}::date, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${collaboratorsTable.hireDate}::date, 'YYYY-MM')`);

  // Charges sociales : depuis les bulletins du mois courant (ou du dernier run clôturé)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const chargesRows = await db.select({
    cnssEmployee: sql<string>`COALESCE(SUM(${payslipsTable.cnssEmployee}),0)`,
    cnssEmployer: sql<string>`COALESCE(SUM(${payslipsTable.cnssEmployer}),0)`,
    irpp: sql<string>`COALESCE(SUM(${payslipsTable.irpp}),0)`,
    ipts: sql<string>`COALESCE(SUM(${payslipsTable.ipts}),0)`,
    grossSalary: sql<string>`COALESCE(SUM(${payslipsTable.grossSalary}),0)`,
    period: payslipsTable.period,
  }).from(payslipsTable)
    .where(and(
      eq(payslipsTable.organizationId, orgId),
      sql`${payslipsTable.period} <= ${currentMonth}`,
    ))
    .groupBy(payslipsTable.period)
    .orderBy(desc(payslipsTable.period))
    .limit(1);

  const charges = chargesRows[0];

  // Anniversaires ce mois-ci
  const currentMonthNum = new Date().getMonth() + 1;
  const birthdaysThisMonth = await db.select({
    id: collaboratorsTable.id,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    avatarUrl: collaboratorsTable.avatarUrl,
    birthDate: collaboratorsTable.birthDate,
  }).from(collaboratorsTable)
    .where(and(
      eq(collaboratorsTable.organizationId, orgId),
      isNull(collaboratorsTable.deletedAt),
      sql`${collaboratorsTable.birthDate} IS NOT NULL`,
      sql`EXTRACT(MONTH FROM ${collaboratorsTable.birthDate}::date) = ${currentMonthNum}`,
    ))
    .orderBy(sql`EXTRACT(DAY FROM ${collaboratorsTable.birthDate}::date)`);

  // Turnover approximatif : départs sur les 12 derniers mois
  const [leaversResult] = await db.select({ n: sql<number>`COUNT(*)` })
    .from(collaboratorsTable)
    .where(and(
      eq(collaboratorsTable.organizationId, orgId),
      sql`${collaboratorsTable.deletedAt} IS NOT NULL`,
      sql`${collaboratorsTable.deletedAt} >= CURRENT_DATE - INTERVAL '12 months'`,
    ));

  // Période d'essai : embauchés il y a moins de 90 jours (proxy)
  const recentHiresTrialPeriod = await db.select({
    id: collaboratorsTable.id,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    hireDate: collaboratorsTable.hireDate,
    avatarUrl: collaboratorsTable.avatarUrl,
  }).from(collaboratorsTable)
    .where(and(
      eq(collaboratorsTable.organizationId, orgId),
      isNull(collaboratorsTable.deletedAt),
      eq(collaboratorsTable.employmentStatus, "active"),
      sql`${collaboratorsTable.hireDate} IS NOT NULL`,
      sql`${collaboratorsTable.hireDate}::date >= CURRENT_DATE - INTERVAL '90 days'`,
    ))
    .orderBy(desc(collaboratorsTable.hireDate))
    .limit(5);

  // Taux d'absence (absents / total)
  const totalCollabsN = Number(totalCollabs?.n ?? 0);
  const absentsN = Number(absentsToday?.n ?? 0);
  const tauxAbsence = totalCollabsN > 0 ? Math.round((absentsN / totalCollabsN) * 100 * 10) / 10 : 0;
  const leaversN = Number(leaversResult?.n ?? 0);
  const tauxTurnover = totalCollabsN > 0 ? Math.round((leaversN / totalCollabsN) * 100 * 100) / 100 : 0;

  return res.json({
    kpis: {
      totalCollaborators: totalCollabsN,
      activeContracts: Number(activeContracts?.n ?? 0),
      departmentsCount: byDept.filter(d => d.departmentName).length,
      contractsExpiringSoon: expiring.length,
      masseSalariale: Number(masseSal?.total ?? 0),
      absentsToday: absentsN,
      tauxAbsence,
      tauxTurnover,
    },
    distributionByDepartment: byDept.map(d => ({
      department: d.departmentName ?? "Non assigné",
      count: Number(d.n),
    })),
    recentHires,
    contractsExpiringSoon: expiring.map(e => ({
      ...e.c,
      collaboratorName: `${e.collabFirst ?? ""} ${e.collabLast ?? ""}`.trim(),
      daysLeft: Number(e.daysLeft),
    })),
    trialPeriodCollaborators: recentHiresTrialPeriod,
    birthdaysThisMonth: birthdaysThisMonth.map(b => ({
      id: b.id,
      name: `${b.firstName} ${b.lastName}`.trim(),
      avatarUrl: b.avatarUrl,
      birthDate: b.birthDate,
      dayOfMonth: b.birthDate ? new Date(b.birthDate).getDate() : null,
    })),
    ageDistribution: ageDist.filter(a => a.ageGroup !== "Non renseigné").map(a => ({
      name: a.ageGroup,
      value: Number(a.count),
    })),
    monthlyHires: monthlyHires.map(m => ({
      month: m.month,
      count: Number(m.count),
    })),
    chargesPayroll: charges ? {
      period: charges.period,
      cnssEmployee: Number(charges.cnssEmployee),
      cnssEmployer: Number(charges.cnssEmployer),
      irpp: Number(charges.irpp),
      ipts: Number(charges.ipts),
      grossSalary: Number(charges.grossSalary),
      chargesSalariales: Number(charges.cnssEmployee) + Number(charges.irpp) + Number(charges.ipts),
      chargesPatronales: Number(charges.cnssEmployer),
      totalCharges: Number(charges.cnssEmployee) + Number(charges.irpp) + Number(charges.ipts) + Number(charges.cnssEmployer),
    } : null,
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
    .where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, (req.params.id as string))))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Demande introuvable" }); return; }
  res.json({ ...row.l, days: Number(row.l.days), collaboratorName: `${row.collabFirst ?? ""} ${row.collabLast ?? ""}`.trim() });
});

router.post("/hr/leaves", requirePermission("hr.manage"), async (req, res) => {
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

router.patch("/hr/leaves/:id/status", requirePermission("hr.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { status, rejectionReason } = req.body;
  if (!["approved", "rejected", "cancelled"].includes(status)) {
    res.status(400).json({ error: "Statut invalide" }); return;
  }
  const [leave] = await db.select().from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, (req.params.id as string))))
    .limit(1);
  if (!leave) { res.status(404).json({ error: "Demande introuvable" }); return; }

  const [updated] = await db.update(leaveRequestsTable).set({
    status,
    approvedById: status === "approved" ? req.authUser!.id : leave.approvedById,
    approvedAt: status === "approved" ? new Date() : null,
    rejectionReason: status === "rejected" ? rejectionReason ?? null : null,
    updatedAt: new Date(),
  }).where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, (req.params.id as string)))).returning();

  if (status === "approved") {
    const leaveYear = new Date(leave.startDate).getFullYear();
    await db.update(leaveBalancesTable).set({
      used: sql`${leaveBalancesTable.used} + ${Number(leave.days)}`,
      updatedAt: new Date(),
    }).where(and(
      eq(leaveBalancesTable.organizationId, orgId),
      eq(leaveBalancesTable.collaboratorId, leave.collaboratorId),
      sql`${leaveBalancesTable.year} = ${leaveYear}`,
      eq(leaveBalancesTable.leaveType, leave.type),
    ));
  }

  res.json(updated);
});

router.delete("/hr/leaves/:id", requirePermission("hr.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [row] = await db.select().from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, (req.params.id as string)))).limit(1);
  if (!row) { res.status(404).json({ error: "Demande introuvable" }); return; }
  await db.delete(leaveRequestsTable).where(and(eq(leaveRequestsTable.organizationId, orgId), eq(leaveRequestsTable.id, (req.params.id as string))));
  res.status(204).send();
});

router.get("/hr/leaves/export.xlsx", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { collaboratorId, status, year } = req.query as Record<string, string>;
    const conds: any[] = [eq(leaveRequestsTable.organizationId, orgId)];
    if (collaboratorId) conds.push(eq(leaveRequestsTable.collaboratorId, collaboratorId));
    if (status) conds.push(eq(leaveRequestsTable.status, status));
    if (year) conds.push(sql`EXTRACT(YEAR FROM ${leaveRequestsTable.startDate}::date) = ${parseInt(year)}`);
    const rows = await db.select({
      r: leaveRequestsTable,
      fn: collaboratorsTable.firstName,
      ln: collaboratorsTable.lastName,
    }).from(leaveRequestsTable)
      .leftJoin(collaboratorsTable, eq(leaveRequestsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...conds))
      .orderBy(desc(leaveRequestsTable.startDate));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Congés");
    ws.columns = [
      { header: "Collaborateur", key: "name", width: 26 },
      { header: "Type", key: "type", width: 16 },
      { header: "Début", key: "startDate", width: 13 },
      { header: "Fin", key: "endDate", width: 13 },
      { header: "Jours", key: "days", width: 8 },
      { header: "Statut", key: "status", width: 12 },
      { header: "Raison", key: "reason", width: 32 },
      { header: "Demandé le", key: "createdAt", width: 16 },
    ];
    const hdr = ws.getRow(1);
    hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
    rows.forEach(({ r, fn, ln }) => ws.addRow({
      name: `${ln ?? ""} ${fn ?? ""}`.trim(),
      type: r.type, startDate: r.startDate, endDate: r.endDate,
      days: Number(r.days), status: r.status, reason: r.reason ?? "",
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString("fr-FR") : "",
    }));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="conges.xlsx"`);
    await wb.xlsx.write(res); res.end();
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// SOLDES DE CONGÉS
// ════════════════════════════════════════════════════════════════

router.get("/hr/leave-balances", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { collaboratorId, year } = req.query as Record<string, string>;
  const targetYear = year ? parseInt(year) : new Date().getFullYear();

  const conds = [
    eq(leaveBalancesTable.organizationId, orgId),
    sql`${leaveBalancesTable.year} = ${targetYear}`,
  ];
  if (collaboratorId) conds.push(eq(leaveBalancesTable.collaboratorId, collaboratorId));

  const rows = await db.select({
    b: leaveBalancesTable,
    firstName: collaboratorsTable.firstName,
    lastName: collaboratorsTable.lastName,
    avatarUrl: collaboratorsTable.avatarUrl,
  }).from(leaveBalancesTable)
    .leftJoin(collaboratorsTable, eq(leaveBalancesTable.collaboratorId, collaboratorsTable.id))
    .where(and(...conds))
    .orderBy(collaboratorsTable.lastName, collaboratorsTable.firstName);

  res.json({ data: rows.map(r => ({
    ...r.b,
    allocated: Number(r.b.allocated),
    used: Number(r.b.used),
    carried: Number(r.b.carried),
    remaining: Number(r.b.allocated) + Number(r.b.carried) - Number(r.b.used),
    collaboratorName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
    collaboratorAvatar: r.avatarUrl,
  })) });
});

router.get("/hr/leave-balances/:collaboratorId", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const targetYear = new Date().getFullYear();
  const rows = await db.select().from(leaveBalancesTable)
    .where(and(
      eq(leaveBalancesTable.organizationId, orgId),
      eq(leaveBalancesTable.collaboratorId, (req.params.collaboratorId as string)),
      sql`${leaveBalancesTable.year} = ${targetYear}`,
    ));
  res.json({ data: rows.map(r => ({
    ...r,
    allocated: Number(r.allocated),
    used: Number(r.used),
    carried: Number(r.carried),
    remaining: Number(r.allocated) + Number(r.carried) - Number(r.used),
  })) });
});

router.post("/hr/leave-balances", requirePermission("hr.manage"), async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const { collaboratorId, year, leaveType, allocated, carried } = req.body;
  if (!collaboratorId || !leaveType) { res.status(400).json({ error: "collaboratorId et leaveType requis" }); return; }
  const targetYear = year ?? new Date().getFullYear();

  const [existing] = await db.select().from(leaveBalancesTable)
    .where(and(
      eq(leaveBalancesTable.organizationId, orgId),
      eq(leaveBalancesTable.collaboratorId, collaboratorId),
      sql`${leaveBalancesTable.year} = ${targetYear}`,
      eq(leaveBalancesTable.leaveType, leaveType),
    )).limit(1);

  if (existing) {
    const [updated] = await db.update(leaveBalancesTable).set({
      allocated: allocated != null ? String(allocated) : existing.allocated,
      carried: carried != null ? String(carried) : existing.carried,
      updatedAt: new Date(),
    }).where(eq(leaveBalancesTable.id, existing.id)).returning();
    res.json({ ...updated, allocated: Number(updated.allocated), used: Number(updated.used), carried: Number(updated.carried), remaining: Number(updated.allocated) + Number(updated.carried) - Number(updated.used) });
  } else {
    const [created] = await db.insert(leaveBalancesTable).values({
      organizationId: orgId,
      collaboratorId,
      year: targetYear,
      leaveType,
      allocated: allocated != null ? String(allocated) : "0",
      used: "0",
      carried: carried != null ? String(carried) : "0",
    }).returning();
    res.status(201).json({ ...created, allocated: Number(created.allocated), used: Number(created.used), carried: Number(created.carried), remaining: Number(created.allocated) + Number(created.carried) - Number(created.used) });
  }
});

// ════════════════════════════════════════════════════════════════
// ÉVALUATIONS DE PERFORMANCE
// ════════════════════════════════════════════════════════════════
router.get("/hr/evaluations", requirePermission("hr.read"), async (req, res, next) => {
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

router.post("/hr/evaluations", requirePermission("hr.manage"), async (req, res, next) => {
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

router.get("/hr/evaluations/:id", requirePermission("hr.read"), async (req, res, next) => {
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
      .where(and(eq(performanceReviewsTable.organizationId, orgId), eq(performanceReviewsTable.id, (req.params.id as string))))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Évaluation introuvable" }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.patch("/hr/evaluations/:id", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [ev] = await db.select().from(performanceReviewsTable)
      .where(and(eq(performanceReviewsTable.organizationId, orgId), eq(performanceReviewsTable.id, (req.params.id as string)))).limit(1);
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

router.delete("/hr/evaluations/:id", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [ev] = await db.select().from(performanceReviewsTable)
      .where(and(eq(performanceReviewsTable.organizationId, orgId), eq(performanceReviewsTable.id, (req.params.id as string)))).limit(1);
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

router.post("/hr/training", requirePermission("hr.manage"), async (req, res, next) => {
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
      .where(and(eq(trainingSessionsTable.organizationId, orgId), eq(trainingSessionsTable.id, (req.params.id as string)))).limit(1);
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

router.patch("/hr/training/:id", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [s] = await db.select().from(trainingSessionsTable)
      .where(and(eq(trainingSessionsTable.organizationId, orgId), eq(trainingSessionsTable.id, (req.params.id as string)))).limit(1);
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

router.post("/hr/training/:id/participants", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [s] = await db.select().from(trainingSessionsTable)
      .where(and(eq(trainingSessionsTable.organizationId, orgId), eq(trainingSessionsTable.id, (req.params.id as string)))).limit(1);
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
router.get("/hr/movements", requirePermission("hr.read"), async (req, res, next) => {
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

router.post("/hr/movements", requirePermission("hr.manage"), async (req, res, next) => {
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

router.get("/hr/movements/:id", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select().from(personnelMovementsTable)
      .where(and(eq(personnelMovementsTable.organizationId, orgId), eq(personnelMovementsTable.id, (req.params.id as string)))).limit(1);
    if (!row) { res.status(404).json({ error: "Mouvement introuvable" }); return; }
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/hr/movements/:id", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [row] = await db.select().from(personnelMovementsTable)
      .where(and(eq(personnelMovementsTable.organizationId, orgId), eq(personnelMovementsTable.id, (req.params.id as string)))).limit(1);
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
router.put("/hr/collaborators/:id/profile", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const isAdmin = ["admin", "super_admin"].includes(req.authUser!.role);

    const {
      firstName, lastName, email, professionalEmail, phone, nationalId, birthDate, address,
      emergencyContact, employeeNumber, departmentId, positionId, position,
      department, managerCollaboratorId, hireDate, employmentStatus, isAvailable,
      avatarUrl, baseSalary,
      // Champs coût employeur
      employerChargeRate, transportAllowance, housingAllowance, mealAllowance,
      otherBenefitsMonthly, weeklyHours,
      // Coordonnées bancaires
      bankName, bankCode, bankAccountNumber,
    } = req.body;

    const updateData: Record<string, unknown> = {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(professionalEmail !== undefined && { professionalEmail: professionalEmail || null }),
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
    // Coordonnées bancaires : validation + persistance (manager+)
    if (bankName !== undefined) {
      if (bankName !== null && bankName !== "" && typeof bankName !== "string") {
        res.status(400).json({ error: "bankName doit être une chaîne de caractères" }); return;
      }
      if (typeof bankName === "string" && bankName.length > 100) {
        res.status(400).json({ error: "bankName ne peut pas dépasser 100 caractères" }); return;
      }
      updateData.bankName = bankName || null;
    }
    if (bankCode !== undefined) {
      if (bankCode !== null && bankCode !== "" && typeof bankCode !== "string") {
        res.status(400).json({ error: "bankCode doit être une chaîne de caractères" }); return;
      }
      if (typeof bankCode === "string" && bankCode !== "" && !/^\d{3}$/.test(bankCode)) {
        res.status(400).json({ error: "bankCode doit être un code BCEAO à 3 chiffres (ex : 024)" }); return;
      }
      updateData.bankCode = bankCode || null;
    }
    if (bankAccountNumber !== undefined) {
      if (bankAccountNumber !== null && bankAccountNumber !== "" && typeof bankAccountNumber !== "string") {
        res.status(400).json({ error: "bankAccountNumber doit être une chaîne de caractères" }); return;
      }
      if (typeof bankAccountNumber === "string" && bankAccountNumber.length > 50) {
        res.status(400).json({ error: "bankAccountNumber ne peut pas dépasser 50 caractères" }); return;
      }
      updateData.bankAccountNumber = bankAccountNumber || null;
    }

    const [collab] = await db.update(collaboratorsTable)
      .set(updateData as any)
      .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.id, (req.params.id as string))))
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
      if (!own || own.id !== (req.params.id as string)) {
        res.status(403).json({ error: "Accès refusé : vous ne pouvez modifier que votre propre avatar" }); return;
      }
    }

    const [collab] = await db.update(collaboratorsTable)
      .set({ avatarUrl })
      .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.id, (req.params.id as string))))
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
      .where(and(eq(payslipsTable.id, (req.params.id as string)), eq(payslipsTable.collaboratorId, collab.id), eq(payslipsTable.organizationId, orgId)))
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
    doc.fontSize(9).text("Gameasu Technology", 440, 18, { width: 115, align: "right" });
    doc.fontSize(8).fillColor("#94a3b8").text("Document officiel", 440, 34, { width: 115, align: "right" });

    // Bloc collaborateur
    doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold").text("Collaborateur", 40, 100);
    doc.moveTo(40, 116).lineTo(555, 116).lineWidth(0.5).stroke("#e2e8f0");
    doc.fillColor("#374151").fontSize(9).font("Helvetica");
    doc.text(`Nom complet : ${fullName}`, 40, 124);
    doc.text(`Poste : ${collab.position ?? "—"}`, 40, 140);
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
      .text("Document généré automatiquement par Gameasu Technology. Ce bulletin est confidentiel.", 40, 776, { align: "center", width: 515 });

    doc.end();
  } catch (e) { next(e); }
});

/** GET /api/payroll/payslips/:id/pdf — export PDF admin (sans restriction collab) */
router.get("/payroll/payslips/:id/pdf", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [payslip] = await db.select().from(payslipsTable)
      .where(and(eq(payslipsTable.id, (req.params.id as string)), eq(payslipsTable.organizationId, orgId)))
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
    doc.fontSize(9).text("Gameasu Technology", 440, 18, { width: 115, align: "right" });

    doc.fillColor("#374151").fontSize(9).font("Helvetica");
    const period = payslip.period;
    const [yr, mo] = period.split("-");
    const moisFr = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    doc.text(`Collaborateur : ${fullName}`, 40, 104);
    doc.text(`Poste : ${collab?.position ?? "—"}`, 40, 120);
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
    doc.fillColor("#94a3b8").fontSize(7).text("Document généré par Gameasu Technology — Confidentiel", 40, 776, { align: "center", width: 515 });
    doc.end();
  } catch (e) { next(e); }
});

/** GET /api/hr/me/contributions — cotisations sociales et fiscales des bulletins validés */
router.get("/hr/me/contributions", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const payslips = await db.select({
      id: payslipsTable.id,
      period: payslipsTable.period,
      grossSalary: payslipsTable.grossSalary,
      cnssEmployee: payslipsTable.cnssEmployee,
      cnssEmployer: payslipsTable.cnssEmployer,
      irpp: payslipsTable.irpp,
      ipts: payslipsTable.ipts,
      status: payslipsTable.status,
    })
      .from(payslipsTable)
      .where(and(
        eq(payslipsTable.collaboratorId, collab.id),
        eq(payslipsTable.organizationId, orgId),
        inArray(payslipsTable.status, ["validated", "paid"])
      ))
      .orderBy(desc(payslipsTable.period));

    const bracketRows = await db.select().from(irppBracketsTable)
      .where(and(eq(irppBracketsTable.organizationId, orgId), eq(irppBracketsTable.isActive, true)))
      .orderBy(asc(irppBracketsTable.sortOrder));

    const brackets = bracketRows.length > 0
      ? bracketRows.map(r => ({ fromAmount: toN(r.fromAmount), toAmount: r.toAmount != null ? toN(r.toAmount) : null, rate: toN(r.rate) }))
      : [
          { fromAmount: 0, toAmount: 900_000, rate: 0 },
          { fromAmount: 900_000, toAmount: 1_500_000, rate: 0.07 },
          { fromAmount: 1_500_000, toAmount: 2_500_000, rate: 0.11 },
          { fromAmount: 2_500_000, toAmount: 4_000_000, rate: 0.15 },
          { fromAmount: 4_000_000, toAmount: 6_000_000, rate: 0.20 },
          { fromAmount: 6_000_000, toAmount: 10_000_000, rate: 0.25 },
          { fromAmount: 10_000_000, toAmount: null, rate: 0.35 },
        ];

    function computeIrppDetail(revenuAnnuel: number): Array<{ label: string; base: number; rate: number; irppAnnuel: number; irppMensuel: number }> {
      const detail: Array<{ label: string; base: number; rate: number; irppAnnuel: number; irppMensuel: number }> = [];
      let prev = 0;
      for (const b of brackets) {
        const upper = b.toAmount ?? Infinity;
        if (revenuAnnuel <= prev) break;
        const base = Math.min(revenuAnnuel, upper) - prev;
        const irppAnnuel = Math.round(base * b.rate);
        if (base > 0) {
          const label = b.toAmount != null
            ? `${Math.round(b.fromAmount).toLocaleString("fr-FR")} – ${Math.round(b.toAmount).toLocaleString("fr-FR")} FCFA`
            : `Au-delà de ${Math.round(b.fromAmount).toLocaleString("fr-FR")} FCFA`;
          detail.push({ label, base, rate: b.rate, irppAnnuel, irppMensuel: Math.round(irppAnnuel / 12) });
        }
        prev = upper;
      }
      return detail;
    }

    const data = payslips.map(p => {
      const gross = toN(p.grossSalary);
      const cnssEmp = toN(p.cnssEmployee);
      const revenuAnnuel = Math.max(0, (gross - cnssEmp) * 12);
      return {
        id: p.id,
        period: p.period,
        grossSalary: gross,
        cnssEmployee: cnssEmp,
        cnssEmployer: toN(p.cnssEmployer),
        irpp: toN(p.irpp),
        ipts: toN(p.ipts),
        status: p.status,
        irppDetail: computeIrppDetail(revenuAnnuel),
      };
    });

    res.json({ data });
  } catch (e) { next(e); }
});

/** GET /hr/me/transfers — virements bancaires reçus par l'employé connecté */
router.get("/hr/me/transfers", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const orgId = req.authUser!.organizationId;
    const collab = await getMyCollab(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur lié" }); return; }

    const orders = await db.select({
      id: bankTransferOrdersTable.id,
      reference: bankTransferOrdersTable.reference,
      status: bankTransferOrdersTable.status,
      currency: bankTransferOrdersTable.currency,
      transferLines: bankTransferOrdersTable.transferLines,
      payrollRunId: bankTransferOrdersTable.payrollRunId,
      completedAt: bankTransferOrdersTable.completedAt,
      submittedAt: bankTransferOrdersTable.submittedAt,
      createdAt: bankTransferOrdersTable.createdAt,
    })
      .from(bankTransferOrdersTable)
      .where(and(
        eq(bankTransferOrdersTable.organizationId, orgId),
        sql`${bankTransferOrdersTable.transferLines} @> ${JSON.stringify([{ collaboratorId: collab.id }])}::jsonb`
      ))
      .orderBy(desc(bankTransferOrdersTable.createdAt));

    const payrollRunIds = [...new Set(orders.map(o => o.payrollRunId).filter(Boolean))] as string[];
    let periodMap = new Map<string, string>();
    if (payrollRunIds.length > 0) {
      const runs = await db.select({ id: payrollRunsTable.id, period: payrollRunsTable.period })
        .from(payrollRunsTable)
        .where(inArray(payrollRunsTable.id, payrollRunIds));
      periodMap = new Map(runs.map(r => [r.id, r.period]));
    }

    const data = orders.map(o => {
      const lines = (o.transferLines ?? []) as Array<{ collaboratorId: string; amount: number; name?: string }>;
      const myLine = lines.find(l => l.collaboratorId === collab.id);
      const period = o.payrollRunId ? (periodMap.get(o.payrollRunId) ?? null) : null;
      return {
        id: o.id,
        reference: o.reference,
        status: o.status,
        currency: o.currency,
        amount: myLine?.amount ?? 0,
        period,
        completedAt: o.completedAt,
        submittedAt: o.submittedAt,
        createdAt: o.createdAt,
      };
    });

    res.json({ data });
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
      days: String(days),
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
      .where(and(eq(leaveRequestsTable.id, (req.params.id as string)), eq(leaveRequestsTable.collaboratorId, collab.id), eq(leaveRequestsTable.organizationId, orgId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Demande introuvable" }); return; }
    if (!["pending"].includes(existing.status)) {
      res.status(400).json({ error: "Seules les demandes en attente peuvent être annulées" }); return;
    }
    const [updated] = await db.update(leaveRequestsTable)
      .set({ status: "cancelled" })
      .where(eq(leaveRequestsTable.id, (req.params.id as string)))
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
      if (r.status === "approved") byType[t].taken += Number(r.days ?? 0);
      else if (r.status === "pending") byType[t].pending += Number(r.days ?? 0);
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
      .orderBy(desc(hrDocumentsTable.uploadedAt));
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
        jobTitle: collaboratorsTable.position,
        departmentId: collaboratorsTable.departmentId,
        avatarUrl: collaboratorsTable.avatarUrl,
        status: collaboratorsTable.employmentStatus,
        managerCollaboratorId: collaboratorsTable.managerCollaboratorId,
      }).from(collaboratorsTable)
        .where(and(
          eq(collaboratorsTable.organizationId, orgId),
          isNull(collaboratorsTable.deletedAt),
          eq(collaboratorsTable.employmentStatus, "active"),
        )),
    ]);
    res.json({ departments: depts, collaborators: collabs });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// #1 — POLITIQUES DE CONGÉS
// ════════════════════════════════════════════════════════════════
router.get("/hr/leave-policies", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select().from(leavePoliciesTable)
      .where(eq(leavePoliciesTable.organizationId, orgId))
      .orderBy(asc(leavePoliciesTable.leaveType));
    res.json({ data: rows });
  } catch (e) { next(e); }
});

router.post("/hr/leave-policies", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const {
      leaveType, isActive, minNoticeDays, maxDaysPerYear, carryOverMax,
      requiresApproval, allowHalfDay, accrualRate, defaultAllocatedDays, description,
    } = req.body as Record<string, any>;
    if (!leaveType) { res.status(400).json({ error: "leaveType requis" }); return; }
    const [row] = await db.insert(leavePoliciesTable).values({
      organizationId: orgId, leaveType,
      isActive: isActive !== false,
      minNoticeDays: minNoticeDays ?? 0,
      maxDaysPerYear: maxDaysPerYear != null ? String(maxDaysPerYear) : null,
      carryOverMax: carryOverMax != null ? String(carryOverMax) : null,
      requiresApproval: requiresApproval !== false,
      allowHalfDay: allowHalfDay ?? false,
      accrualRate: accrualRate != null ? String(accrualRate) : null,
      defaultAllocatedDays: defaultAllocatedDays != null ? String(defaultAllocatedDays) : "0",
      description: description ?? null,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put("/hr/leave-policies/:id", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [existing] = await db.select().from(leavePoliciesTable)
      .where(and(eq(leavePoliciesTable.id, (req.params.id as string)), eq(leavePoliciesTable.organizationId, orgId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Politique introuvable" }); return; }
    const body = req.body as Record<string, any>;
    const [updated] = await db.update(leavePoliciesTable).set({
      leaveType: body.leaveType ?? existing.leaveType,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      minNoticeDays: body.minNoticeDays ?? existing.minNoticeDays,
      maxDaysPerYear: body.maxDaysPerYear != null ? String(body.maxDaysPerYear) : null,
      carryOverMax: body.carryOverMax != null ? String(body.carryOverMax) : null,
      requiresApproval: body.requiresApproval !== undefined ? body.requiresApproval : existing.requiresApproval,
      allowHalfDay: body.allowHalfDay !== undefined ? body.allowHalfDay : existing.allowHalfDay,
      accrualRate: body.accrualRate != null ? String(body.accrualRate) : null,
      defaultAllocatedDays: body.defaultAllocatedDays != null ? String(body.defaultAllocatedDays) : existing.defaultAllocatedDays,
      approverRole: body.approverRole ?? existing.approverRole,
      description: body.description !== undefined ? body.description : existing.description,
    }).where(eq(leavePoliciesTable.id, (req.params.id as string))).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete("/hr/leave-policies/:id", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    await db.delete(leavePoliciesTable)
      .where(and(eq(leavePoliciesTable.id, (req.params.id as string)), eq(leavePoliciesTable.organizationId, orgId)));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// JOURNAL D'AUDIT RH
// ════════════════════════════════════════════════════════════════
router.get("/hr/audit-logs", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { entityType, entityId, action, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const conds: any[] = [eq(hrAuditLogsTable.organizationId, orgId)];
    if (entityType) conds.push(eq(hrAuditLogsTable.entityType, entityType));
    if (entityId) conds.push(eq(hrAuditLogsTable.entityId, entityId));
    if (action) conds.push(eq(hrAuditLogsTable.action, action));
    const rows = await db.select({
      log: hrAuditLogsTable,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    }).from(hrAuditLogsTable)
      .leftJoin(usersTable, eq(hrAuditLogsTable.performedById, usersTable.id))
      .where(and(...conds))
      .orderBy(desc(hrAuditLogsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(hrAuditLogsTable).where(and(...conds));
    res.json({
      data: rows.map(r => ({
        ...r.log,
        performedByName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Système",
      })),
      total: Number(total),
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// #2 — CALENDRIER DES ABSENCES ÉQUIPE
// ════════════════════════════════════════════════════════════════
router.get("/hr/team-calendar", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { start, end } = req.query as { start?: string; end?: string };
    const conditions = [
      eq(leaveRequestsTable.organizationId, orgId),
      eq(leaveRequestsTable.status, "approved"),
    ];
    if (start) conditions.push(gte(leaveRequestsTable.endDate, start));
    if (end) conditions.push(lte(leaveRequestsTable.startDate, end));
    const rows = await db.select({
      id: leaveRequestsTable.id,
      collaboratorId: leaveRequestsTable.collaboratorId,
      type: leaveRequestsTable.type,
      startDate: leaveRequestsTable.startDate,
      endDate: leaveRequestsTable.endDate,
      days: leaveRequestsTable.days,
      status: leaveRequestsTable.status,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      collaboratorAvatar: collaboratorsTable.avatarUrl,
    }).from(leaveRequestsTable)
      .leftJoin(collaboratorsTable, eq(leaveRequestsTable.collaboratorId, collaboratorsTable.id))
      .where(and(...conditions))
      .orderBy(asc(leaveRequestsTable.startDate));
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// #3 — ATTESTATIONS (self-service)
// ════════════════════════════════════════════════════════════════
async function getCollaboratorForUser(userId: string, orgId: string) {
  const [collab] = await db.select().from(collaboratorsTable)
    .where(and(
      eq(collaboratorsTable.organizationId, orgId),
      eq(collaboratorsTable.userId, userId),
      isNull(collaboratorsTable.deletedAt),
    )).limit(1);
  return collab ?? null;
}

async function buildAttestation(collaboratorId: string, orgId: string, type: "travail" | "salaire" | "presence", res: import("express").Response) {
  const [collab] = await db.select().from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.id, collaboratorId), eq(collaboratorsTable.organizationId, orgId))).limit(1);
  if (!collab) { res.status(404).json({ error: "Collaborateur introuvable" }); return; }

  const [contract] = await db.select().from(contractsTable)
    .where(and(
      eq(contractsTable.collaboratorId, collaboratorId),
      eq(contractsTable.status, "active"),
    )).orderBy(desc(contractsTable.startDate)).limit(1);

  const today = new Date();
  const dateStr = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const fullName = `${collab.firstName} ${collab.lastName}`.toUpperCase();
  const poste = collab.position ?? "Collaborateur";
  const anciennete = contract?.startDate
    ? `${Math.floor((today.getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365))} an(s)`
    : "Non précisée";

  const LABELS: Record<string, string> = {
    travail: "ATTESTATION DE TRAVAIL",
    salaire: "ATTESTATION DE SALAIRE",
    presence: "ATTESTATION DE PRÉSENCE",
  };

  const doc = new PDFDocument({ margin: 60, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="attestation_${type}_${collab.lastName.toLowerCase()}.pdf"`);
  doc.pipe(res);

  // En-tête
  doc.fontSize(10).fillColor("#666666").text("GAMEASU AFRICA", 60, 60);
  doc.fontSize(8).fillColor("#999999").text("Plateforme de gestion RH", 60, 75);
  doc.moveTo(60, 95).lineTo(535, 95).strokeColor("#2563EB").lineWidth(2).stroke();

  // Titre
  doc.fontSize(16).fillColor("#1a1a1a").font("Helvetica-Bold")
    .text(LABELS[type] ?? "ATTESTATION", 0, 120, { align: "center" });

  doc.fontSize(10).fillColor("#555555").font("Helvetica")
    .text(`Numéro de référence : ATT-${type.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-8)}`, 0, 148, { align: "center" });

  doc.moveDown(2);

  // Corps
  const soussigne = "La Direction des Ressources Humaines de GAMEASU AFRICA";
  doc.font("Helvetica").fontSize(11).fillColor("#1a1a1a");

  if (type === "travail") {
    doc.text(`${soussigne} atteste que :`, { align: "left" });
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").text(`M./Mme ${fullName}`, { align: "center" });
    doc.font("Helvetica").moveDown(0.5)
      .text(`est bien employé(e) en qualité de ${poste} au sein de notre organisation.`)
      .moveDown(0.5)
      .text(`Type de contrat : ${contract?.type?.toUpperCase() ?? "CDI"}`)
      .text(`Date d'entrée : ${contract?.startDate ? new Date(contract.startDate).toLocaleDateString("fr-FR") : "Non précisée"}`)
      .text(`Ancienneté : ${anciennete}`);
  } else if (type === "salaire") {
    const salaire = contract?.monthlySalary ? `${Number(contract.monthlySalary).toLocaleString("fr-FR")} FCFA` : "Confidentiel";
    doc.text(`${soussigne} atteste que :`, { align: "left" });
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").text(`M./Mme ${fullName}`, { align: "center" });
    doc.font("Helvetica").moveDown(0.5)
      .text(`perçoit une rémunération mensuelle brute de : ${salaire}`)
      .text(`Poste : ${poste}`)
      .text(`Contrat : ${contract?.type?.toUpperCase() ?? "CDI"}`);
  } else {
    doc.text(`${soussigne} atteste que :`, { align: "left" });
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").text(`M./Mme ${fullName}`, { align: "center" });
    doc.font("Helvetica").moveDown(0.5)
      .text(`est présent(e) et actif/active au sein de notre organisation.`)
      .text(`Poste occupé : ${poste}`)
      .text(`Statut : Actif(ve)`);
  }

  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(11)
    .text(`La présente attestation est délivrée à l'intéressé(e) pour faire valoir ce que de droit.`)
    .moveDown(1)
    .text(`Fait à Lomé, le ${dateStr}`, { align: "right" });

  doc.moveDown(2);
  doc.font("Helvetica-Bold").text("La Direction des Ressources Humaines", { align: "right" });

  // Pied de page
  doc.moveTo(60, 760).lineTo(535, 760).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.fontSize(8).fillColor("#999999").font("Helvetica")
    .text("Document généré automatiquement — GAMEASU Africa | www.gameasu.com", 0, 768, { align: "center" });

  doc.end();
}

router.get("/hr/me/attestation/:type", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const userId = req.authUser!.id;
    const type = req.params.type as "travail" | "salaire" | "presence";
    if (!["travail", "salaire", "presence"].includes(type)) { res.status(400).json({ error: "Type invalide" }); return; }
    const collab = await getCollaboratorForUser(userId, orgId);
    if (!collab) { res.status(404).json({ error: "Aucun profil collaborateur associé" }); return; }
    await buildAttestation(collab.id, orgId, type, res);
  } catch (e) { next(e); }
});

router.get("/hr/attestations/:collaboratorId/:type", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const type = req.params.type as "travail" | "salaire" | "presence";
    if (!["travail", "salaire", "presence"].includes(type)) { res.status(400).json({ error: "Type invalide" }); return; }
    await buildAttestation((req.params.collaboratorId as string), orgId, type, res);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// #5 — FEUILLES DE TEMPS (approbation manager)
// ════════════════════════════════════════════════════════════════
router.get("/hr/timesheets", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { start, end, departmentId, approvalStatus } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [eq(attendanceSessionsTable.organizationId, orgId)];
    if (start) conditions.push(gte(attendanceSessionsTable.workDate, start) as any);
    if (end) conditions.push(lte(attendanceSessionsTable.workDate, end) as any);
    if (departmentId) conditions.push(eq(attendanceSessionsTable.departmentId, departmentId) as any);
    if (approvalStatus && approvalStatus !== "all") conditions.push(eq(attendanceSessionsTable.approvalStatus, approvalStatus) as any);

    const rows = await db.select({
      id: attendanceSessionsTable.id,
      collaboratorId: attendanceSessionsTable.collaboratorId,
      workDate: attendanceSessionsTable.workDate,
      clockInAt: attendanceSessionsTable.clockInAt,
      clockOutAt: attendanceSessionsTable.clockOutAt,
      totalMinutes: attendanceSessionsTable.totalMinutes,
      effectiveMinutes: attendanceSessionsTable.effectiveMinutes,
      expectedMinutes: attendanceSessionsTable.expectedMinutes,
      isLate: attendanceSessionsTable.isLate,
      isEarlyLeave: attendanceSessionsTable.isEarlyLeave,
      approvalStatus: attendanceSessionsTable.approvalStatus,
      approvedById: attendanceSessionsTable.approvedById,
      approvalNote: attendanceSessionsTable.approvalNote,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      collaboratorAvatar: collaboratorsTable.avatarUrl,
      departmentName: departmentsTable.name,
    }).from(attendanceSessionsTable)
      .leftJoin(collaboratorsTable, eq(attendanceSessionsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(departmentsTable, eq(attendanceSessionsTable.departmentId, departmentsTable.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceSessionsTable.workDate), asc(collaboratorsTable.lastName));

    const flagCounts = await db.select({
      sessionId: attendanceFlagsTable.sessionId,
      cnt: count(),
    }).from(attendanceFlagsTable)
      .where(and(
        eq(attendanceFlagsTable.organizationId, orgId),
        eq(attendanceFlagsTable.isResolved, false),
      ))
      .groupBy(attendanceFlagsTable.sessionId);
    const flagMap = new Map(flagCounts.map(f => [f.sessionId, Number(f.cnt)]));

    const totalSessions = rows.length;
    const pendingApproval = rows.filter(r => r.approvalStatus === "pending").length;
    const totalHours = Math.round(rows.reduce((sum, r) => sum + (r.effectiveMinutes ?? 0), 0) / 60);
    const lateCount = rows.filter(r => r.isLate).length;
    const flaggedCount = rows.filter(r => flagMap.has(r.id)).length;

    res.json({
      data: rows.map(r => ({ ...r, flagCount: flagMap.get(r.id) ?? 0 })),
      stats: { totalSessions, pendingApproval, totalHours, lateCount, flaggedCount },
    });
  } catch (e) { next(e); }
});

router.patch("/hr/timesheets/:id/approve", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { status, note } = req.body as { status: "approved" | "rejected"; note?: string };
    if (!["approved", "rejected"].includes(status)) { res.status(400).json({ error: "status invalide" }); return; }
    const [existing] = await db.select().from(attendanceSessionsTable)
      .where(and(eq(attendanceSessionsTable.id, (req.params.id as string)), eq(attendanceSessionsTable.organizationId, orgId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Session introuvable" }); return; }
    const [updated] = await db.update(attendanceSessionsTable).set({
      approvalStatus: status,
      approvedById: req.authUser!.id,
      approvedAt: new Date(),
      approvalNote: note ?? null,
    }).where(eq(attendanceSessionsTable.id, (req.params.id as string))).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.post("/hr/timesheets/bulk-approve", requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids requis" }); return; }
    await db.update(attendanceSessionsTable).set({
      approvalStatus: "approved",
      approvedById: req.authUser!.id,
      approvedAt: new Date(),
    }).where(and(
      eq(attendanceSessionsTable.organizationId, orgId),
      inArray(attendanceSessionsTable.id, ids),
      eq(attendanceSessionsTable.approvalStatus, "pending"),
    ));
    res.json({ ok: true, count: ids.length });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// #6 — ALERTES RH (contrats + périodes d'essai)
// ════════════════════════════════════════════════════════════════
router.get("/hr/alerts/upcoming", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const today = new Date();
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const in60 = new Date(today); in60.setDate(in60.getDate() + 60);
    const todayStr = today.toISOString().slice(0, 10);
    const in30Str = in30.toISOString().slice(0, 10);
    const in60Str = in60.toISOString().slice(0, 10);

    // Contrats CDD expirant dans les 60j
    const expiringContracts = await db.select({
      id: contractsTable.id,
      type: contractsTable.type,
      endDate: contractsTable.endDate,
      collaboratorId: collaboratorsTable.id,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      poste: collaboratorsTable.position,
      department: collaboratorsTable.department,
    }).from(contractsTable)
      .leftJoin(collaboratorsTable, eq(contractsTable.collaboratorId, collaboratorsTable.id))
      .where(and(
        eq(contractsTable.organizationId, orgId),
        eq(contractsTable.status, "active"),
        sql`${contractsTable.endDate} IS NOT NULL`,
        gte(contractsTable.endDate, todayStr) as any,
        lte(contractsTable.endDate, in60Str) as any,
      ))
      .orderBy(asc(contractsTable.endDate));

    // Nouveaux contrats commencés dans les 90 derniers jours (période d'essai probable)
    const ninetyDaysAgo = new Date(today); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10);
    const trialEnding = await db.select({
      id: contractsTable.id,
      type: contractsTable.type,
      startDate: contractsTable.startDate,
      collaboratorId: collaboratorsTable.id,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      poste: collaboratorsTable.position,
      department: collaboratorsTable.department,
    }).from(contractsTable)
      .leftJoin(collaboratorsTable, eq(contractsTable.collaboratorId, collaboratorsTable.id))
      .where(and(
        eq(contractsTable.organizationId, orgId),
        eq(contractsTable.status, "active"),
        gte(contractsTable.startDate, ninetyDaysAgoStr) as any,
      ))
      .orderBy(asc(contractsTable.startDate));

    // Anniversaires de contrat ce mois (pour NPS / ancienneté)
    const thisMonth = String(today.getMonth() + 1).padStart(2, "0");
    const anniversaries = await db.select({
      id: contractsTable.id,
      startDate: contractsTable.startDate,
      collaboratorId: collaboratorsTable.id,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
      poste: collaboratorsTable.position,
    }).from(contractsTable)
      .leftJoin(collaboratorsTable, eq(contractsTable.collaboratorId, collaboratorsTable.id))
      .where(and(
        eq(contractsTable.organizationId, orgId),
        eq(contractsTable.status, "active"),
        sql`EXTRACT(MONTH FROM ${contractsTable.startDate}) = ${thisMonth}`,
      ))
      .orderBy(asc(contractsTable.startDate));

    const annivWithYears = anniversaries.map(a => ({
      ...a,
      years: a.startDate ? Math.floor((today.getTime() - new Date(a.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0,
    })).filter(a => a.years >= 1);

    res.json({
      expiringContracts: expiringContracts.map(c => ({
        ...c,
        daysLeft: c.endDate ? Math.ceil((new Date(c.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null,
        urgency: c.endDate && new Date(c.endDate) <= in30 ? "high" : "medium",
      })),
      trialEnding: trialEnding.map(t => ({
        ...t,
        daysSinceStart: t.startDate ? Math.floor((today.getTime() - new Date(t.startDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
      })),
      anniversaries: annivWithYears,
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// #7 — INDICATEURS RH
// ════════════════════════════════════════════════════════════════
router.get("/hr/indicators", requirePermission("hr.read"), async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { year } = req.query as { year?: string };
    const y = year ? Number(year) : new Date().getFullYear();
    const yearStart = `${y}-01-01`, yearEnd = `${y}-12-31`;

    // Headcount de base
    const [{ total }] = await db.select({ total: count() }).from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));
    const [{ active }] = await db.select({ active: count() }).from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt), eq(collaboratorsTable.employmentStatus, "active")));

    // Recrutements de l'année
    const [{ hired }] = await db.select({ hired: count() }).from(contractsTable)
      .where(and(
        eq(contractsTable.organizationId, orgId),
        gte(contractsTable.startDate, yearStart) as any,
        lte(contractsTable.startDate, yearEnd) as any,
      ));

    // Départs (mouvements departure/retirement)
    const [{ departures }] = await db.select({ departures: count() }).from(personnelMovementsTable)
      .where(and(
        eq(personnelMovementsTable.organizationId, orgId),
        inArray(personnelMovementsTable.type, ["departure", "retirement"]),
        gte(personnelMovementsTable.effectiveDate, yearStart) as any,
        lte(personnelMovementsTable.effectiveDate, yearEnd) as any,
      ));

    const turnoverRate = total > 0 ? Math.round((Number(departures) / Number(total)) * 100 * 10) / 10 : 0;

    // Ancienneté moyenne
    const contracts = await db.select({ startDate: contractsTable.startDate }).from(contractsTable)
      .where(and(eq(contractsTable.organizationId, orgId), eq(contractsTable.status, "active")));
    const now = Date.now();
    const avgTenureMs = contracts.length > 0
      ? contracts.reduce((sum, c) => sum + (c.startDate ? now - new Date(c.startDate).getTime() : 0), 0) / contracts.length : 0;
    const avgTenureYears = Math.round(avgTenureMs / (1000 * 60 * 60 * 24 * 365) * 10) / 10;

    // Répartition par type de contrat
    const byContract = await db.select({
      type: contractsTable.type,
      cnt: count(),
    }).from(contractsTable)
      .where(and(eq(contractsTable.organizationId, orgId), eq(contractsTable.status, "active")))
      .groupBy(contractsTable.type);

    const permanentCount = byContract.find(b => b.type === "CDI")?.cnt ?? 0;
    const temporaryCount = byContract.filter(b => b.type !== "CDI").reduce((s, b) => s + Number(b.cnt), 0);

    // Répartition par département
    const byDept = await db.select({
      department: departmentsTable.name,
      cnt: count(),
    }).from(collaboratorsTable)
      .leftJoin(departmentsTable, eq(collaboratorsTable.departmentId, departmentsTable.id))
      .where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt), eq(collaboratorsTable.employmentStatus, "active")))
      .groupBy(departmentsTable.name)
      .orderBy(desc(count()));

    // Absences par mois de l'année
    const absenceRows = await db.select({
      month: sql<string>`TO_CHAR(${leaveRequestsTable.startDate}::date, 'Mon')`,
      monthNum: sql<number>`EXTRACT(MONTH FROM ${leaveRequestsTable.startDate}::date)`,
      days: sql<number>`SUM(${leaveRequestsTable.days})`,
    }).from(leaveRequestsTable)
      .where(and(
        eq(leaveRequestsTable.organizationId, orgId),
        eq(leaveRequestsTable.status, "approved"),
        gte(leaveRequestsTable.startDate, yearStart) as any,
        lte(leaveRequestsTable.startDate, yearEnd) as any,
      ))
      .groupBy(sql`TO_CHAR(${leaveRequestsTable.startDate}::date, 'Mon')`, sql`EXTRACT(MONTH FROM ${leaveRequestsTable.startDate}::date)`)
      .orderBy(sql`EXTRACT(MONTH FROM ${leaveRequestsTable.startDate}::date)`);

    const totalAbsenceDays = absenceRows.reduce((s, r) => s + Number(r.days), 0);
    const absenceDaysPerFTE = Number(active) > 0 ? Math.round((totalAbsenceDays / Number(active)) * 10) / 10 : 0;

    // Absences par département
    const absenceByDeptRaw = await db.select({
      department: departmentsTable.name,
      days: sql<number>`SUM(${leaveRequestsTable.days})`,
    }).from(leaveRequestsTable)
      .leftJoin(collaboratorsTable, eq(leaveRequestsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(departmentsTable, eq(collaboratorsTable.departmentId, departmentsTable.id))
      .where(and(
        eq(leaveRequestsTable.organizationId, orgId),
        eq(leaveRequestsTable.status, "approved"),
        gte(leaveRequestsTable.startDate, yearStart) as any,
        lte(leaveRequestsTable.startDate, yearEnd) as any,
      ))
      .groupBy(departmentsTable.name)
      .orderBy(desc(sql`SUM(${leaveRequestsTable.days})`));

    const absenceTotalDays = absenceByDeptRaw.reduce((s, r) => s + Number(r.days), 0);
    const absencesByDept = absenceByDeptRaw.map(r => ({
      department: r.department ?? "—",
      days: Number(r.days),
      pct: absenceTotalDays > 0 ? Math.round((Number(r.days) / absenceTotalDays) * 100) : 0,
    }));

    // Taux de présence du mois courant
    const thisMonth = new Date(); thisMonth.setDate(1);
    const thisMonthStr = thisMonth.toISOString().slice(0, 10);
    const [{ sessionsThisMonth }] = await db.select({ sessionsThisMonth: count() }).from(attendanceSessionsTable)
      .where(and(eq(attendanceSessionsTable.organizationId, orgId), gte(attendanceSessionsTable.workDate, thisMonthStr) as any));
    const workdaysThisMonth = Math.max(1, Math.ceil((new Date().getDate() * 5) / 7));
    const attendanceRate = Number(active) > 0
      ? Math.min(100, Math.round((Number(sessionsThisMonth) / (Number(active) * workdaysThisMonth)) * 100))
      : 0;

    // Mouvements récents
    const recentMovements = await db.select({
      id: personnelMovementsTable.id,
      type: personnelMovementsTable.type,
      effectiveDate: personnelMovementsTable.effectiveDate,
      collaboratorName: sql<string>`${collaboratorsTable.firstName} || ' ' || ${collaboratorsTable.lastName}`,
    }).from(personnelMovementsTable)
      .leftJoin(collaboratorsTable, eq(personnelMovementsTable.collaboratorId, collaboratorsTable.id))
      .where(and(
        eq(personnelMovementsTable.organizationId, orgId),
        gte(personnelMovementsTable.effectiveDate, yearStart) as any,
      ))
      .orderBy(desc(personnelMovementsTable.effectiveDate))
      .limit(10);

    res.json({
      headcount: Number(total),
      activeCount: Number(active),
      hiredThisYear: Number(hired),
      departuresThisYear: Number(departures),
      turnoverRate,
      avgTenureYears,
      permanentCount: Number(permanentCount),
      temporaryCount,
      absenceDaysPerFTE,
      attendanceRate,
      byDepartment: byDept.map(d => ({ department: d.department ?? "—", count: Number(d.cnt) })),
      byContract: byContract.map(b => ({ type: b.type, count: Number(b.cnt) })),
      absencesByMonth: absenceRows.map(r => ({ month: r.month, days: Number(r.days) })),
      absencesByDept,
      recentMovements,
    });
  } catch (e) { next(e); }
});

export default router;

