import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { organizationsTable, organizationMembersTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requireAdmin } from "../middlewares/auth";
import {
  ORG_TYPE_LABELS, FRAMEWORK_LABELS, FRAMEWORK_DESCRIPTIONS,
  getFrameworkForOrgType, seedAccountingFrameworkForOrg,
  type AccountingFramework,
} from "../services/accounting-framework";

const VALID_ORG_TYPES = ["pme", "tpe", "cooperative", "ong", "banque", "microfinance", "assurance", "prevoyance", "administration", "cabinet", "autre"] as const;

const router: IRouter = Router();

router.get("/organizations/current", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id, req.authUser!.organizationId);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  res.json(org);
});

router.patch("/organizations/current", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id, req.authUser!.organizationId);
  if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
  const patch = req.body ?? {};
  const allowed: Record<string, unknown> = {};
  for (const k of [
    "name", "legalName", "industry", "country", "currency", "timezone", "locale",
    "logoUrl", "primaryColor", "secondaryColor", "contactEmail", "contactPhone",
    "address", "taxId",
  ]) {
    if (k in patch) allowed[k] = patch[k];
  }
  const [updated] = await db.update(organizationsTable)
    .set(allowed)
    .where(eq(organizationsTable.id, orgId))
    .returning();
  res.json(updated);
});

// ─── Référentiel comptable (lecture seule pour les membres de l'org) ──────────
// IMPORTANT: doit être déclaré AVANT /organizations/:id pour éviter le conflit Express

router.get("/organizations/accounting-framework", async (req, res) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id, req.authUser!.organizationId);
    if (!orgId) return res.status(404).json({ error: "Aucun espace de travail" });
    const [org] = await db
      .select({
        orgType: organizationsTable.orgType,
        accountingFramework: organizationsTable.accountingFramework,
        configuredAt: organizationsTable.updatedAt,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);
    if (!org) return res.status(404).json({ error: "Introuvable" });
    const framework = (org.accountingFramework ?? "syscohada") as AccountingFramework;
    const orgType = org.orgType ?? "pme";
    return res.json({
      orgType,
      orgTypeLabel: ORG_TYPE_LABELS[orgType as keyof typeof ORG_TYPE_LABELS] ?? orgType,
      accountingFramework: framework,
      frameworkLabel: FRAMEWORK_LABELS[framework] ?? framework,
      frameworkDescription: FRAMEWORK_DESCRIPTIONS[framework] ?? "",
      configuredAt: org.configuredAt,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── GET /api/organizations/:id/accounting-config ─────────────────────────────
// Lecture de la configuration comptable d'une org spécifique (admin requis).

router.get("/organizations/:id/accounting-config", requireAdmin, async (req, res) => {
  try {
    // IDOR guard: l'appelant doit appartenir à l'organisation cible
    const callerOrgId = await getCurrentOrganizationId(req.authUser!.id, req.authUser!.organizationId);
    if (!callerOrgId || callerOrgId !== (req.params.id as string)) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    const [org] = await db
      .select({ orgType: organizationsTable.orgType, accountingFramework: organizationsTable.accountingFramework })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, req.params.id as string))
      .limit(1);
    if (!org) return res.status(404).json({ error: "Introuvable" });
    const framework = (org.accountingFramework ?? "syscohada") as AccountingFramework;
    const orgType = org.orgType ?? "pme";
    return res.json({
      orgType,
      orgTypeLabel:         ORG_TYPE_LABELS[orgType as keyof typeof ORG_TYPE_LABELS] ?? orgType,
      accountingFramework:  framework,
      frameworkLabel:       FRAMEWORK_LABELS[framework] ?? framework,
      frameworkDescription: FRAMEWORK_DESCRIPTIONS[framework] ?? "",
    });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── PATCH /api/organizations/:id/accounting-config ───────────────────────────
// Mise à jour du type d'organisation → recalcul + sauvegarde du référentiel.

router.patch("/organizations/:id/accounting-config", requireAdmin, async (req, res) => {
  try {
    // IDOR guard: l'appelant doit appartenir à l'organisation cible
    const callerOrgId = await getCurrentOrganizationId(req.authUser!.id, req.authUser!.organizationId);
    if (!callerOrgId || callerOrgId !== (req.params.id as string)) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    const VALID_FRAMEWORKS = ["syscohada", "syscohada_smt", "sycebnl", "pcb", "microfinance", "cima", "cipres", "pce", "autre"] as const;
    const { orgType, accountingFramework: overrideFramework } = req.body ?? {};
    if (!orgType || !(VALID_ORG_TYPES as readonly string[]).includes(orgType)) {
      return res.status(400).json({ error: `Type d'organisation invalide. Valeurs acceptées : ${VALID_ORG_TYPES.join(", ")}` });
    }
    // accountingFramework peut être fourni en override (cas cockpit super-admin) ; sinon calculé par mapping.
    const recommendedFramework = getFrameworkForOrgType(orgType);
    const framework = (overrideFramework && (VALID_FRAMEWORKS as readonly string[]).includes(overrideFramework)
      ? overrideFramework
      : recommendedFramework) as AccountingFramework;
    const [updated] = await db
      .update(organizationsTable)
      .set({ orgType, accountingFramework: framework, updatedAt: new Date() })
      .where(eq(organizationsTable.id, req.params.id as string))
      .returning({ id: organizationsTable.id, orgType: organizationsTable.orgType, accountingFramework: organizationsTable.accountingFramework });
    if (!updated) return res.status(404).json({ error: "Introuvable" });
    // Seed best-effort (idempotent)
    seedAccountingFrameworkForOrg(updated.id, framework).catch(() => {});
    return res.json({
      orgType: updated.orgType,
      orgTypeLabel:         ORG_TYPE_LABELS[orgType as keyof typeof ORG_TYPE_LABELS] ?? orgType,
      accountingFramework:  updated.accountingFramework,
      frameworkLabel:       FRAMEWORK_LABELS[framework] ?? framework,
      frameworkDescription: FRAMEWORK_DESCRIPTIONS[framework] ?? "",
      recommendedFramework,
      configuredAt:         new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/organizations", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(organizationsTable);
  res.json(rows);
});

router.get("/organizations/:id", requireAdmin, async (req, res) => {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, (req.params.id as string))).limit(1);
  if (!org) return res.status(404).json({ error: "Introuvable" });
  res.json(org);
});

router.post("/organizations", requireAdmin, async (req, res) => {
  const { slug, name, ...rest } = req.body ?? {};
  if (!slug || !name) return res.status(400).json({ error: "slug et name requis" });
  const [org] = await db.insert(organizationsTable).values({ slug, name, ...rest }).returning();
  res.status(201).json(org);
});

// Membres
router.get("/organization-members", async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id, req.authUser!.organizationId);
  if (!orgId) return res.json([]);
  const rows = await db.select({
    member: organizationMembersTable,
    user: usersTable,
  })
    .from(organizationMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, organizationMembersTable.userId))
    .where(eq(organizationMembersTable.organizationId, orgId));
  res.json(rows.map((r) => ({
    id: r.member.id,
    organizationId: r.member.organizationId,
    role: r.member.role,
    isPrimary: r.member.isPrimary,
    joinedAt: r.member.joinedAt,
    user: {
      id: r.user.id, email: r.user.email,
      firstName: r.user.firstName, lastName: r.user.lastName,
      role: r.user.role, isActive: r.user.isActive, avatarUrl: r.user.avatarUrl,
    },
  })));
});

router.patch("/organization-members/:id", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id, req.authUser!.organizationId);
  const { role } = req.body ?? {};
  if (!role) return res.status(400).json({ error: "role requis" });
  const [m] = await db.update(organizationMembersTable)
    .set({ role })
    .where(and(eq(organizationMembersTable.id, (req.params.id as string)), eq(organizationMembersTable.organizationId, orgId!)))
    .returning();
  if (!m) return res.status(404).json({ error: "Membre introuvable" });
  res.json(m);
});

router.delete("/organization-members/:id", requireAdmin, async (req, res) => {
  const orgId = await getCurrentOrganizationId(req.authUser!.id, req.authUser!.organizationId);
  await db.delete(organizationMembersTable)
    .where(and(eq(organizationMembersTable.id, (req.params.id as string)), eq(organizationMembersTable.organizationId, orgId!)));
  res.status(204).end();
});

export default router;
