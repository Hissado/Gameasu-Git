import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { organizationsTable, organizationMembersTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getCurrentOrganizationId } from "../lib/tenant";
import { requireAdmin } from "../middlewares/auth";
import {
  ORG_TYPE_LABELS, FRAMEWORK_LABELS, FRAMEWORK_DESCRIPTIONS,
  type AccountingFramework,
} from "../services/accounting-framework";

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
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);
    if (!org) return res.status(404).json({ error: "Introuvable" });
    const framework = (org.accountingFramework ?? "SYSCOHADA") as AccountingFramework;
    const orgType = org.orgType ?? "enterprise";
    return res.json({
      orgType,
      orgTypeLabel: ORG_TYPE_LABELS[orgType as keyof typeof ORG_TYPE_LABELS] ?? orgType,
      accountingFramework: framework,
      frameworkLabel: FRAMEWORK_LABELS[framework] ?? framework,
      frameworkDescription: FRAMEWORK_DESCRIPTIONS[framework] ?? "",
    });
  } catch (e) {
    console.error(e);
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
