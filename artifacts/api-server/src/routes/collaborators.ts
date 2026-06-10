import { Router } from "express";
import { db } from "@workspace/db";
import { collaboratorsTable, tasksTable, contractsTable } from "@workspace/db";
import { eq, sql, isNull, and, desc } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

router.get("/collaborators", async (req, res) => {
  const { search, available, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const orgFilter = and(eq(collaboratorsTable.organizationId, req.authUser!.organizationId), isNull(collaboratorsTable.deletedAt));
  const data = await db.select().from(collaboratorsTable).where(orgFilter).limit(limitNum).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(collaboratorsTable).where(orgFilter);
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
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
  const workload = collabs.map(c => ({
    collaboratorId: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    avatarUrl: c.avatarUrl,
    activeTasks: 0,
    activeProjects: c.currentProjectsCount || 0,
    workloadPercent: Math.min(100, (c.currentProjectsCount || 0) * 25),
  }));
  return res.json(workload);
});

router.get("/collaborators/:id", async (req, res) => {
  const collabs = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.organizationId, req.authUser!.organizationId), eq(collaboratorsTable.id, req.params.id))).limit(1);
  if (!collabs[0]) return res.status(404).json({ error: "Not found" });
  return res.json(collabs[0]);
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
      .where(and(eq(collaboratorsTable.organizationId, req.authUser!.organizationId), eq(collaboratorsTable.id, req.params.id))).returning();
    if (!collab) return res.status(404).json({ error: "Not found" });
    return res.json(collab);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.delete("/collaborators/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(collaboratorsTable).set({ deletedAt: new Date() }).where(and(eq(collaboratorsTable.organizationId, req.authUser!.organizationId), eq(collaboratorsTable.id, req.params.id)));
  return res.status(204).send();
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
  const collabId = req.params.id;

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
