/**
 * Module Recrutement — Offres d'emploi & Candidatures
 *
 *  GET    /api/recruitment/jobs              liste des offres
 *  POST   /api/recruitment/jobs              créer une offre
 *  GET    /api/recruitment/jobs/:id          détail offre + candidatures
 *  PATCH  /api/recruitment/jobs/:id          modifier
 *  DELETE /api/recruitment/jobs/:id          supprimer
 *
 *  GET    /api/recruitment/candidacies        liste candidatures (filtrable par jobId, status)
 *  POST   /api/recruitment/candidacies        nouvelle candidature
 *  GET    /api/recruitment/candidacies/:id    détail
 *  PATCH  /api/recruitment/candidacies/:id    modifier (statut, notes…)
 *  DELETE /api/recruitment/candidacies/:id    supprimer
 *
 *  GET    /api/recruitment/pipeline           kanban groupé par statut
 *  GET    /api/recruitment/stats              KPI
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { jobOffersTable, candidaciesTable } from "@workspace/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// ──────────────────────────────────────────────────────────
// OFFRES D'EMPLOI
// ──────────────────────────────────────────────────────────
router.get("/recruitment/jobs", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select({
      id: jobOffersTable.id,
      reference: jobOffersTable.reference,
      title: jobOffersTable.title,
      departmentId: jobOffersTable.departmentId,
      location: jobOffersTable.location,
      contractType: jobOffersTable.contractType,
      status: jobOffersTable.status,
      openDate: jobOffersTable.openDate,
      closeDate: jobOffersTable.closeDate,
      currency: jobOffersTable.currency,
      salaryMin: jobOffersTable.salaryMin,
      salaryMax: jobOffersTable.salaryMax,
      maxCandidates: jobOffersTable.maxCandidates,
      isRemote: jobOffersTable.isRemote,
      candidacyCount: sql<number>`(
        SELECT COUNT(*) FROM "candidacies" WHERE "candidacies"."job_offer_id" = "job_offers"."id"
      )`,
    }).from(jobOffersTable)
      .where(eq(jobOffersTable.organizationId, orgId))
      .orderBy(desc(jobOffersTable.openDate));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/recruitment/jobs", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const {
      title, department, location, type, status, description, requirements,
      openDate, closeDate, experienceLevel, salaryCurrency, salaryMin, salaryMax,
      targetCount, notes,
    } = req.body as {
      title: string; department?: string; location?: string; type?: string; status?: string;
      description?: string; requirements?: string; openDate?: string; closeDate?: string;
      experienceLevel?: string; salaryCurrency?: string; salaryMin?: string; salaryMax?: string;
      targetCount?: number; notes?: string;
    };
    if (!title) { res.status(400).json({ error: "Le titre est requis" }); return; }
    const [row] = await db.insert(jobOffersTable).values({
      organizationId: orgId,
      title, department, location, type, status, description, requirements,
      openDate, closeDate, experienceLevel, salaryCurrency,
      salaryMin: salaryMin ? String(salaryMin) : undefined,
      salaryMax: salaryMax ? String(salaryMax) : undefined,
      targetCount, notes,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/recruitment/jobs/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [offer] = await db.select().from(jobOffersTable)
      .where(and(eq(jobOffersTable.organizationId, orgId), eq(jobOffersTable.id, req.params.id)))
      .limit(1);
    if (!offer) { res.status(404).json({ error: "Offre introuvable" }); return; }
    const candidacies = await db.select().from(candidaciesTable)
      .where(eq(candidaciesTable.jobOfferId, offer.id))
      .orderBy(desc(candidaciesTable.createdAt));
    res.json({ ...offer, candidacies });
  } catch (e) { next(e); }
});

router.patch("/recruitment/jobs/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [offer] = await db.select().from(jobOffersTable)
      .where(and(eq(jobOffersTable.organizationId, orgId), eq(jobOffersTable.id, req.params.id)))
      .limit(1);
    if (!offer) { res.status(404).json({ error: "Offre introuvable" }); return; }
    const { title, department, location, type, status, description, requirements,
      openDate, closeDate, experienceLevel, salaryMin, salaryMax, targetCount, notes } =
      req.body as Record<string, unknown>;
    const [updated] = await db.update(jobOffersTable).set({
      ...(title != null && { title: String(title) }),
      ...(department != null && { department: String(department) }),
      ...(location != null && { location: String(location) }),
      ...(type != null && { type: String(type) }),
      ...(status != null && { status: String(status) }),
      ...(description != null && { description: String(description) }),
      ...(requirements != null && { requirements: String(requirements) }),
      ...(openDate != null && { openDate: String(openDate) }),
      ...(closeDate != null && { closeDate: String(closeDate) }),
      ...(experienceLevel != null && { experienceLevel: String(experienceLevel) }),
      ...(salaryMin != null && { salaryMin: String(salaryMin) }),
      ...(salaryMax != null && { salaryMax: String(salaryMax) }),
      ...(targetCount != null && { targetCount: Number(targetCount) }),
      ...(notes != null && { notes: String(notes) }),
    }).where(eq(jobOffersTable.id, offer.id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete("/recruitment/jobs/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [offer] = await db.select().from(jobOffersTable)
      .where(and(eq(jobOffersTable.organizationId, orgId), eq(jobOffersTable.id, req.params.id)))
      .limit(1);
    if (!offer) { res.status(404).json({ error: "Offre introuvable" }); return; }
    await db.delete(candidaciesTable).where(eq(candidaciesTable.jobOfferId, offer.id));
    await db.delete(jobOffersTable).where(eq(jobOffersTable.id, offer.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// CANDIDATURES
// ──────────────────────────────────────────────────────────
router.get("/recruitment/candidacies", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { jobId, status } = req.query as { jobId?: string; status?: string };
    const conditions = [eq(candidaciesTable.organizationId, orgId)];
    if (jobId) conditions.push(eq(candidaciesTable.jobOfferId, jobId));
    if (status) conditions.push(eq(candidaciesTable.status, status));
    const rows = await db.select({
      id: candidaciesTable.id,
      jobOfferId: candidaciesTable.jobOfferId,
      candidateName: candidaciesTable.candidateName,
      candidateEmail: candidaciesTable.candidateEmail,
      candidatePhone: candidaciesTable.candidatePhone,
      status: candidaciesTable.status,
      source: candidaciesTable.source,
      experienceYears: candidaciesTable.experienceYears,
      currentCompany: candidaciesTable.currentCompany,
      interviewDate: candidaciesTable.interviewDate,
      createdAt: candidaciesTable.createdAt,
      jobTitle: jobOffersTable.title,
      jobDepartment: jobOffersTable.department,
    }).from(candidaciesTable)
      .leftJoin(jobOffersTable, eq(candidaciesTable.jobOfferId, jobOffersTable.id))
      .where(and(...conditions))
      .orderBy(desc(candidaciesTable.createdAt));
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/recruitment/candidacies", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const {
      jobOfferId, candidateName, candidateEmail, candidatePhone,
      status, source, resumeUrl, coverLetter, experienceYears,
      currentCompany, expectedSalary, interviewDate, notes,
    } = req.body as {
      jobOfferId: string; candidateName: string; candidateEmail?: string; candidatePhone?: string;
      status?: string; source?: string; resumeUrl?: string; coverLetter?: string;
      experienceYears?: number; currentCompany?: string; expectedSalary?: string;
      interviewDate?: string; notes?: string;
    };
    if (!jobOfferId || !candidateName) {
      res.status(400).json({ error: "jobOfferId et candidateName sont requis" }); return;
    }
    const [offer] = await db.select().from(jobOffersTable)
      .where(and(eq(jobOffersTable.organizationId, orgId), eq(jobOffersTable.id, jobOfferId)))
      .limit(1);
    if (!offer) { res.status(404).json({ error: "Offre introuvable" }); return; }
    const [row] = await db.insert(candidaciesTable).values({
      organizationId: orgId,
      jobOfferId, candidateName, candidateEmail, candidatePhone,
      status, source, resumeUrl, coverLetter,
      experienceYears,
      currentCompany,
      expectedSalary: expectedSalary ? String(expectedSalary) : undefined,
      interviewDate, notes,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get("/recruitment/candidacies/:id", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [c] = await db.select({
      id: candidaciesTable.id,
      jobOfferId: candidaciesTable.jobOfferId,
      candidateName: candidaciesTable.candidateName,
      candidateEmail: candidaciesTable.candidateEmail,
      candidatePhone: candidaciesTable.candidatePhone,
      status: candidaciesTable.status,
      source: candidaciesTable.source,
      resumeUrl: candidaciesTable.resumeUrl,
      coverLetter: candidaciesTable.coverLetter,
      experienceYears: candidaciesTable.experienceYears,
      currentCompany: candidaciesTable.currentCompany,
      expectedSalary: candidaciesTable.expectedSalary,
      interviewDate: candidaciesTable.interviewDate,
      notes: candidaciesTable.notes,
      evaluationScore: candidaciesTable.evaluationScore,
      evaluationNotes: candidaciesTable.evaluationNotes,
      rejectionReason: candidaciesTable.rejectionReason,
      createdAt: candidaciesTable.createdAt,
      updatedAt: candidaciesTable.updatedAt,
      jobTitle: jobOffersTable.title,
      jobDepartment: jobOffersTable.department,
    }).from(candidaciesTable)
      .leftJoin(jobOffersTable, eq(candidaciesTable.jobOfferId, jobOffersTable.id))
      .where(and(eq(candidaciesTable.organizationId, orgId), eq(candidaciesTable.id, req.params.id)))
      .limit(1);
    if (!c) { res.status(404).json({ error: "Candidature introuvable" }); return; }
    res.json(c);
  } catch (e) { next(e); }
});

router.patch("/recruitment/candidacies/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [c] = await db.select().from(candidaciesTable)
      .where(and(eq(candidaciesTable.organizationId, orgId), eq(candidaciesTable.id, req.params.id)))
      .limit(1);
    if (!c) { res.status(404).json({ error: "Candidature introuvable" }); return; }
    const upd = req.body as Record<string, unknown>;
    const [updated] = await db.update(candidaciesTable).set({
      ...(upd.status != null && { status: String(upd.status) }),
      ...(upd.interviewDate != null && { interviewDate: String(upd.interviewDate) }),
      ...(upd.notes != null && { notes: String(upd.notes) }),
      ...(upd.evaluationScore != null && { evaluationScore: Number(upd.evaluationScore) }),
      ...(upd.evaluationNotes != null && { evaluationNotes: String(upd.evaluationNotes) }),
      ...(upd.rejectionReason != null && { rejectionReason: String(upd.rejectionReason) }),
      ...(upd.source != null && { source: String(upd.source) }),
    }).where(eq(candidaciesTable.id, c.id)).returning();
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete("/recruitment/candidacies/:id", requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [c] = await db.select().from(candidaciesTable)
      .where(and(eq(candidaciesTable.organizationId, orgId), eq(candidaciesTable.id, req.params.id)))
      .limit(1);
    if (!c) { res.status(404).json({ error: "Candidature introuvable" }); return; }
    await db.delete(candidaciesTable).where(eq(candidaciesTable.id, c.id));
    res.status(204).send();
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// PIPELINE + STATS
// ──────────────────────────────────────────────────────────
router.get("/recruitment/pipeline", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const rows = await db.select({
      id: candidaciesTable.id,
      candidateName: candidaciesTable.candidateName,
      status: candidaciesTable.status,
      source: candidaciesTable.source,
      interviewDate: candidaciesTable.interviewDate,
      evaluationScore: candidaciesTable.evaluationScore,
      createdAt: candidaciesTable.createdAt,
      jobOfferId: candidaciesTable.jobOfferId,
      jobTitle: jobOffersTable.title,
      jobDepartment: jobOffersTable.department,
    }).from(candidaciesTable)
      .leftJoin(jobOffersTable, eq(candidaciesTable.jobOfferId, jobOffersTable.id))
      .where(eq(candidaciesTable.organizationId, orgId))
      .orderBy(desc(candidaciesTable.createdAt));

    const STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"];
    const grouped: Record<string, typeof rows> = {};
    STAGES.forEach((s) => { grouped[s] = []; });
    rows.forEach((r) => {
      const st = r.status ?? "new";
      (grouped[st] ??= []).push(r);
    });
    res.json(grouped);
  } catch (e) { next(e); }
});

router.get("/recruitment/stats", async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [counts] = await db.select({
      totalJobs: sql<number>`COUNT(DISTINCT "job_offers"."id")`,
      openJobs: sql<number>`COUNT(DISTINCT CASE WHEN "job_offers"."status" = 'open' THEN "job_offers"."id" END)`,
      totalCandidacies: sql<number>`COUNT("candidacies"."id")`,
      hired: sql<number>`SUM(CASE WHEN "candidacies"."stage" = 'hired' THEN 1 ELSE 0 END)`,
      inInterview: sql<number>`SUM(CASE WHEN "candidacies"."stage" = 'interview' THEN 1 ELSE 0 END)`,
    }).from(jobOffersTable)
      .leftJoin(candidaciesTable, eq(candidaciesTable.jobOfferId, jobOffersTable.id))
      .where(eq(jobOffersTable.organizationId, orgId));
    res.json(counts);
  } catch (e) { next(e); }
});

export default router;
