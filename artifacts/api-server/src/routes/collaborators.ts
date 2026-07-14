import { Router } from "express";
import { db } from "@workspace/db";
import { collaboratorsTable, tasksTable, contractsTable, usersTable, hrAuditLogsTable } from "@workspace/db";
import { eq, sql, isNull, isNotNull, inArray, and, desc, ne, notInArray } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

router.get("/collaborators", async (req, res) => {
  const { search, available, status, departmentId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [
    eq(collaboratorsTable.organizationId, req.authUser!.organizationId),
    isNull(collaboratorsTable.deletedAt) as any,
  ];

  if (departmentId && departmentId !== "all") {
    conditions.push(eq(collaboratorsTable.departmentId, departmentId) as any);
  }

  if (status === "active") {
    conditions.push(eq(collaboratorsTable.employmentStatus, "active") as any);
  } else if (status === "inactive") {
    conditions.push(ne(collaboratorsTable.employmentStatus, "active") as any);
  } else if (status === "unavailable") {
    conditions.push(eq(collaboratorsTable.isAvailable, false) as any);
    conditions.push(eq(collaboratorsTable.employmentStatus, "active") as any);
  }

  const orgFilter = and(...conditions);
  const data = await db.select().from(collaboratorsTable).where(orgFilter).limit(limitNum).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(collaboratorsTable).where(orgFilter);

  const expiryMap: Record<string, number> = {};
  if (data.length > 0) {
    try {
      const ids = data.map(c => c.id);
      const expiryRows = await db
        .select({
          collaboratorId: contractsTable.collaboratorId,
          daysLeft: sql<number>`GREATEST(0, EXTRACT(day FROM (${contractsTable.endDate}::date - CURRENT_DATE))::int)`,
        })
        .from(contractsTable)
        .where(and(
          eq(contractsTable.organizationId, req.authUser!.organizationId),
          eq(contractsTable.status, "active"),
          isNotNull(contractsTable.endDate),
          sql`${contractsTable.endDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
          sql`${contractsTable.endDate}::date >= CURRENT_DATE`,
          sql`${contractsTable.endDate}::date <= CURRENT_DATE + INTERVAL '30 days'`,
          inArray(contractsTable.collaboratorId, ids),
        ));
      for (const row of expiryRows) {
        const current = expiryMap[row.collaboratorId];
        if (current == null || row.daysLeft < current) {
          expiryMap[row.collaboratorId] = row.daysLeft;
        }
      }
    } catch {
      // expiry enrichment is best-effort; don't fail the list endpoint
    }
  }

  // ── Active task count per collaborator (via collaborator.userId → task.assigneeId) ──
  const activeTasksMap: Record<string, number> = {};
  if (data.length > 0) {
    try {
      const userIds = data.map(c => c.userId).filter((id): id is string => id != null);
      if (userIds.length > 0) {
        const taskRows = await db
          .select({
            assigneeId: tasksTable.assigneeId,
            count: sql<number>`count(*)::int`,
          })
          .from(tasksTable)
          .where(and(
            eq(tasksTable.organizationId, req.authUser!.organizationId),
            isNull(tasksTable.deletedAt),
            ne(tasksTable.status, "done"),
            inArray(tasksTable.assigneeId, userIds),
          ))
          .groupBy(tasksTable.assigneeId);
        const tasksByUserId: Record<string, number> = {};
        for (const row of taskRows) {
          if (row.assigneeId) tasksByUserId[row.assigneeId] = row.count;
        }
        for (const c of data) {
          if (c.userId) activeTasksMap[c.id] = tasksByUserId[c.userId] ?? 0;
        }
      }
    } catch {
      // active task enrichment is best-effort; don't fail the list endpoint
    }
  }

  const enriched = data.map(c => ({
    ...c,
    contractExpiresInDays: expiryMap[c.id] ?? null,
    activeTasks: activeTasksMap[c.id] ?? 0,
  }));

  return res.json({ data: enriched, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

async function generateUniqueKioskCode(orgId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const candidate = String(1000 + Math.floor(Math.random() * 9000));
    const existing = await db
      .select({ id: collaboratorsTable.id })
      .from(collaboratorsTable)
      .where(and(
        eq(collaboratorsTable.organizationId, orgId),
        eq(collaboratorsTable.kioskCode, candidate),
        isNull(collaboratorsTable.deletedAt),
      ))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  // Fallback : timestamp-based unique suffix
  return String(Date.now()).slice(-4);
}

router.post("/collaborators", requireManagerOrAbove, async (req, res) => {
  const {
    firstName, lastName, email, phone, position, department, isAvailable,
    departmentId, positionId, employeeNumber, hireDate, baseSalary,
    employerChargeRate, transportAllowance, housingAllowance, mealAllowance,
    otherBenefitsMonthly, weeklyHours,
  } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: "firstName et lastName requis" });
  try {
    const orgId = req.authUser!.organizationId;
    const kioskCode = await generateUniqueKioskCode(orgId);
    const [collab] = await db.insert(collaboratorsTable).values({
      organizationId: orgId,
      firstName, lastName, email, phone, position, department,
      isAvailable: isAvailable !== false,
      departmentId: departmentId || null,
      positionId: positionId || null,
      employeeNumber: employeeNumber || null,
      hireDate: hireDate || null,
      baseSalary: baseSalary != null ? baseSalary.toString() : null,
      employerChargeRate: employerChargeRate != null ? employerChargeRate.toString() : "18.4",
      transportAllowance: transportAllowance != null ? transportAllowance.toString() : "0",
      housingAllowance: housingAllowance != null ? housingAllowance.toString() : "0",
      mealAllowance: mealAllowance != null ? mealAllowance.toString() : "0",
      otherBenefitsMonthly: otherBenefitsMonthly != null ? otherBenefitsMonthly.toString() : "0",
      weeklyHours: weeklyHours != null ? weeklyHours.toString() : "40",
      kioskCode,
    }).returning({ id: collaboratorsTable.id, firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName, email: collaboratorsTable.email, phone: collaboratorsTable.phone, position: collaboratorsTable.position, department: collaboratorsTable.department, isAvailable: collaboratorsTable.isAvailable, organizationId: collaboratorsTable.organizationId, avatarUrl: collaboratorsTable.avatarUrl, kioskCode: collaboratorsTable.kioskCode, employeeNumber: collaboratorsTable.employeeNumber, hireDate: collaboratorsTable.hireDate, employmentStatus: collaboratorsTable.employmentStatus, departmentId: collaboratorsTable.departmentId, positionId: collaboratorsTable.positionId, createdAt: collaboratorsTable.createdAt, updatedAt: collaboratorsTable.updatedAt });
    return res.status(201).json(collab);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.get("/collaborators/workload", async (req, res) => {
  const collabs = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.organizationId, req.authUser!.organizationId), isNull(collaboratorsTable.deletedAt)));

  // Batch-query active tasks (status != 'done', not deleted) for all collaborators with a linked user
  const tasksByUserId: Record<string, number> = {};
  const userIds = collabs.map(c => c.userId).filter((id): id is string => id != null);
  if (userIds.length > 0) {
    try {
      const taskRows = await db
        .select({
          assigneeId: tasksTable.assigneeId,
          count: sql<number>`count(*)::int`,
        })
        .from(tasksTable)
        .where(and(
          eq(tasksTable.organizationId, req.authUser!.organizationId),
          isNull(tasksTable.deletedAt),
          ne(tasksTable.status, "done"),
          inArray(tasksTable.assigneeId, userIds),
        ))
        .groupBy(tasksTable.assigneeId);
      for (const row of taskRows) {
        if (row.assigneeId) tasksByUserId[row.assigneeId] = row.count;
      }
    } catch {
      // best-effort
    }
  }

  const workload = collabs.map(c => {
    const activeTasks = c.userId ? (tasksByUserId[c.userId] ?? 0) : 0;
    const activeProjects = c.currentProjectsCount || 0;
    // Workload: each active task contributes 10%, each project 25%, capped at 100%
    const workloadPercent = Math.min(100, activeTasks * 10 + activeProjects * 25);
    return {
      collaboratorId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      avatarUrl: c.avatarUrl,
      activeTasks,
      activeProjects,
      workloadPercent,
    };
  });
  return res.json(workload);
});

router.get("/collaborators/:id", async (req, res) => {
  const collabs = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.organizationId, req.authUser!.organizationId), eq(collaboratorsTable.id, (req.params.id as string)))).limit(1);
  if (!collabs[0]) return res.status(404).json({ error: "Not found" });

  let contractExpiresInDays: number | null = null;
  try {
    const expiryRows = await db
      .select({
        daysLeft: sql<number>`GREATEST(0, EXTRACT(day FROM (${contractsTable.endDate}::date - CURRENT_DATE))::int)`,
      })
      .from(contractsTable)
      .where(and(
        eq(contractsTable.organizationId, req.authUser!.organizationId),
        eq(contractsTable.collaboratorId, (req.params.id as string)),
        eq(contractsTable.status, "active"),
        isNotNull(contractsTable.endDate),
        sql`${contractsTable.endDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
        sql`${contractsTable.endDate}::date >= CURRENT_DATE`,
        sql`${contractsTable.endDate}::date <= CURRENT_DATE + INTERVAL '30 days'`,
      ))
      .orderBy(contractsTable.endDate)
      .limit(1);
    contractExpiresInDays = expiryRows.length > 0 ? expiryRows[0].daysLeft : null;
  } catch {
    // expiry enrichment is best-effort
  }

  let linkedUser: { id: string; firstName: string | null; lastName: string | null; email: string } | null = null;
  if (collabs[0].userId) {
    const [u] = await db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    }).from(usersTable).where(eq(usersTable.id, collabs[0].userId)).limit(1);
    linkedUser = u ?? null;
  }

  return res.json({ ...collabs[0], contractExpiresInDays, linkedUser });
});

router.put("/collaborators/:id", requireManagerOrAbove, async (req, res) => {
  const {
    firstName, lastName, email, phone, position, department, isAvailable,
    departmentId, positionId, employeeNumber, hireDate, baseSalary,
    managerCollaboratorId, employmentStatus,
    employerChargeRate, transportAllowance, housingAllowance, mealAllowance,
    otherBenefitsMonthly, weeklyHours,
  } = req.body;
  try {
    const [before] = await db.select().from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.organizationId, req.authUser!.organizationId), eq(collaboratorsTable.id, (req.params.id as string))))
      .limit(1);
    const [collab] = await db.update(collaboratorsTable)
      .set({
        firstName, lastName, email, phone, position, department, isAvailable,
        departmentId: departmentId === "" ? null : departmentId,
        positionId: positionId === "" ? null : positionId,
        employeeNumber, hireDate,
        baseSalary: baseSalary != null ? baseSalary.toString() : undefined,
        managerCollaboratorId: managerCollaboratorId === "" ? null : managerCollaboratorId,
        employmentStatus,
        ...(employerChargeRate != null && { employerChargeRate: employerChargeRate.toString() }),
        ...(transportAllowance != null && { transportAllowance: transportAllowance.toString() }),
        ...(housingAllowance != null && { housingAllowance: housingAllowance.toString() }),
        ...(mealAllowance != null && { mealAllowance: mealAllowance.toString() }),
        ...(otherBenefitsMonthly != null && { otherBenefitsMonthly: otherBenefitsMonthly.toString() }),
        ...(weeklyHours != null && { weeklyHours: weeklyHours.toString() }),
      })
      .where(and(eq(collaboratorsTable.organizationId, req.authUser!.organizationId), eq(collaboratorsTable.id, (req.params.id as string)))).returning();
    if (!collab) return res.status(404).json({ error: "Not found" });
    if (before) {
      const auditFields: Array<{ key: keyof typeof before; action: string }> = [
        { key: "baseSalary", action: "salary_update" },
        { key: "departmentId", action: "department_change" },
        { key: "positionId", action: "position_change" },
        { key: "employmentStatus", action: "status_change" },
      ];
      const entries: any[] = [];
      for (const f of auditFields) {
        const oldVal = before[f.key] != null ? String(before[f.key]) : null;
        const newVal = collab[f.key] != null ? String(collab[f.key]) : null;
        if (oldVal !== newVal) {
          entries.push({
            organizationId: req.authUser!.organizationId,
            performedById: req.authUser!.id,
            action: f.action,
            entityType: "collaborator",
            entityId: collab.id,
            entityName: `${collab.firstName} ${collab.lastName}`,
            fieldChanged: f.key,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      }
      if (entries.length > 0) await db.insert(hrAuditLogsTable).values(entries).catch(() => {});
    }
    return res.json(collab);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.delete("/collaborators/:id", requireManagerOrAbove, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const collabId = req.params.id as string;
  const [existing] = await db.select({ firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName })
    .from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.id, collabId)))
    .limit(1);
  await db.update(collaboratorsTable).set({ deletedAt: new Date() })
    .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.id, collabId)));
  if (existing) {
    await db.insert(hrAuditLogsTable).values({
      organizationId: orgId,
      performedById: req.authUser!.id,
      action: "deletion",
      entityType: "collaborator",
      entityId: collabId,
      entityName: `${existing.firstName} ${existing.lastName}`,
      fieldChanged: "deletedAt",
      oldValue: null,
      newValue: new Date().toISOString(),
    }).catch(() => {});
  }
  return res.status(204).send();
});

router.patch("/collaborators/:id/link-user", requireManagerOrAbove, async (req, res) => {
  const { userId } = req.body; // null to unlink
  const [collab] = await db.update(collaboratorsTable)
    .set({ userId: userId ?? null })
    .where(and(
      eq(collaboratorsTable.organizationId, req.authUser!.organizationId),
      eq(collaboratorsTable.id, (req.params.id as string)),
    ))
    .returning();
  if (!collab) return res.status(404).json({ error: "Collaborateur introuvable" });
  return res.json(collab);
});

// ════════════════════════════════════════════════════════════════
// COÛT EMPLOYEUR RÉEL — endpoint dédié pour le calculateur tarifaire
// Renvoie le taux horaire et journalier calculé depuis :
//   - salaire brut (profil ou contrat actif en fallback)
//   - charges patronales (profil ou défaut 18,4%)
//   - avantages (transport + logement + repas + autres)
//   - heures hebdomadaires (profil ou contrat ou défaut 40h)
// ════════════════════════════════════════════════════════════════
router.get("/collaborators/:id/employer-cost", async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const collabId = (req.params.id as string);

  const [collab] = await db.select().from(collaboratorsTable)
    .where(and(eq(collaboratorsTable.organizationId, orgId), eq(collaboratorsTable.id, collabId), isNull(collaboratorsTable.deletedAt)))
    .limit(1);
  if (!collab) return res.status(404).json({ error: "Collaborateur introuvable" });

  // Contrat actif en fallback si le profil n'a pas de salaire
  const [activeContract] = await db.select().from(contractsTable)
    .where(and(
      eq(contractsTable.organizationId, orgId),
      eq(contractsTable.collaboratorId, collabId),
      eq(contractsTable.status, "active"),
    ))
    .orderBy(desc(contractsTable.startDate))
    .limit(1);

  // Résolution des valeurs (profil > contrat actif > défaut)
  const baseSalary = collab.baseSalary
    ? Number(collab.baseSalary)
    : (activeContract?.monthlySalary ? Number(activeContract.monthlySalary) : 0);

  const weeklyHoursVal = collab.weeklyHours
    ? Number(collab.weeklyHours)
    : (activeContract?.weeklyHours ? Number(activeContract.weeklyHours) : 40);

  const employerChargeRate = collab.employerChargeRate
    ? Number(collab.employerChargeRate)
    : 18.4;

  const transportAllowance = Number(collab.transportAllowance ?? 0);
  const housingAllowance   = Number(collab.housingAllowance ?? 0);
  const mealAllowance      = Number(collab.mealAllowance ?? 0);
  const otherBenefits      = Number(collab.otherBenefitsMonthly ?? 0);
  const totalBenefits      = transportAllowance + housingAllowance + mealAllowance + otherBenefits;

  // Calcul coût horaire réel
  const monthlyHours = (weeklyHoursVal * 52) / 12;
  const monthlyCostEmployeur = baseSalary * (1 + employerChargeRate / 100) + totalBenefits;
  const hourlyRate  = monthlyHours > 0 && monthlyCostEmployeur > 0 ? monthlyCostEmployeur / monthlyHours : 0;
  const hoursPerDay = weeklyHoursVal / 5;
  const dailyRate   = hourlyRate * hoursPerDay;

  return res.json({
    collaboratorId: collab.id,
    firstName: collab.firstName,
    lastName: collab.lastName,
    position: collab.position,
    employmentStatus: collab.employmentStatus,
    // Données source
    baseSalary,
    weeklyHours: weeklyHoursVal,
    employerChargeRate,
    transportAllowance,
    housingAllowance,
    mealAllowance,
    otherBenefitsMonthly: otherBenefits,
    totalBenefitsMonthly: totalBenefits,
    // Contrat actif (si présent)
    contractId:            activeContract?.id ?? null,
    contractType:          activeContract?.type ?? null,
    contractMonthlySalary: activeContract?.monthlySalary ? Number(activeContract.monthlySalary) : null,
    contractWeeklyHours:   activeContract?.weeklyHours   ? Number(activeContract.weeklyHours)   : null,
    // Résultats calculés
    monthlyHours: parseFloat(monthlyHours.toFixed(2)),
    monthlyCostEmployeur: parseFloat(monthlyCostEmployeur.toFixed(2)),
    hourlyRate:  parseFloat(hourlyRate.toFixed(2)),
    dailyRate:   parseFloat(dailyRate.toFixed(2)),
    // Source de chaque valeur (pour debug / UI)
    salarySource:      collab.baseSalary ? "profile" : (activeContract?.monthlySalary ? "contract" : "none"),
    weeklyHoursSource: collab.weeklyHours ? "profile" : (activeContract?.weeklyHours  ? "contract" : "default"),
  });
});

export default router;
