import { Router, type Request } from "express";
import { db, documentsTable } from "@workspace/db";
import { and, eq, isNull, sql, desc, ilike, or, inArray, ne } from "drizzle-orm";
import { userAccessibleProjectIds } from "../lib/rbac/permissions";

const router = Router();

/**
 * ACL documents : on restreint les documents rattachés à un projet (entityType=project)
 * aux projets accessibles. Les documents non liés à un projet (clients, équipement,
 * collaborateurs, autres) restent visibles selon les permissions de leur module.
 */
async function buildProjectAclCond(req: Request) {
  if (!req.authUser) return undefined;
  const accessible = await userAccessibleProjectIds(req.authUser.id);
  if (accessible === null) return undefined; // bypass admin
  if (accessible.length === 0) {
    return ne(documentsTable.entityType, "project");
  }
  return or(
    ne(documentsTable.entityType, "project"),
    and(eq(documentsTable.entityType, "project"), inArray(documentsTable.entityId, accessible)),
  );
}

router.get("/documents", async (req, res) => {
  const { entityType, entityId, category, search = "", limit = "50" } = req.query as Record<string, string>;
  const conds: any[] = [
    eq(documentsTable.organizationId, req.authUser!.organizationId),
    isNull(documentsTable.deletedAt),
  ];
  if (entityType) conds.push(eq(documentsTable.entityType, entityType));
  if (entityId) conds.push(eq(documentsTable.entityId, entityId));
  if (category) conds.push(eq(documentsTable.category, category));
  if (search) conds.push(or(ilike(documentsTable.name, `%${search}%`), ilike(documentsTable.description, `%${search}%`)));
  const acl = await buildProjectAclCond(req);
  if (acl) conds.push(acl);
  const data = await db.select().from(documentsTable).where(and(...conds)).orderBy(desc(documentsTable.createdAt)).limit(Number(limit));
  return res.json({ data });
});

router.get("/documents/stats", async (req, res) => {
  // ACL : restreindre les stats aux documents accessibles à l'utilisateur.
  const acl = await buildProjectAclCond(req);
  const baseConds: any[] = [
    eq(documentsTable.organizationId, req.authUser!.organizationId),
    isNull(documentsTable.deletedAt),
  ];
  if (acl) baseConds.push(acl);
  const where = and(...baseConds);
  const byEntity = await db.select({
    entityType: documentsTable.entityType,
    count: sql<number>`count(*)`,
  }).from(documentsTable).where(where).groupBy(documentsTable.entityType);
  const byCategory = await db.select({
    category: documentsTable.category,
    count: sql<number>`count(*)`,
  }).from(documentsTable).where(where).groupBy(documentsTable.category);
  const total = await db.select({ c: sql<number>`count(*)` }).from(documentsTable).where(where);
  return res.json({
    total: Number(total[0].c),
    byEntity: byEntity.map((r) => ({ entityType: r.entityType || "non_classé", count: Number(r.count) })),
    byCategory: byCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
  });
});

router.post("/documents", async (req: any, res) => {
  try {
    const { name, fileUrl, mimeType, size, category, entityType, entityId, description, tags } = req.body;
    if (!name || !fileUrl) return res.status(400).json({ error: "name et fileUrl requis" });
    const [d] = await db.insert(documentsTable).values({
      organizationId: req.authUser!.organizationId,
      name, fileUrl, mimeType, size: size ? Number(size) : null,
      category: category || "other",
      entityType, entityId, description,
      tags: Array.isArray(tags) ? tags : [],
      uploadedBy: req.user?.id || null,
    }).returning();
    return res.status(201).json(d);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.put("/documents/:id", async (req, res) => {
  const { name, category, entityType, entityId, description, tags } = req.body;
  const [d] = await db.update(documentsTable).set({
    name, category, entityType, entityId, description,
    ...(tags ? { tags } : {}),
  }).where(and(eq(documentsTable.organizationId, req.authUser!.organizationId), eq(documentsTable.id, (req.params.id as string)))).returning();
  if (!d) return res.status(404).json({ error: "Not found" });
  return res.json(d);
});

router.delete("/documents/:id", async (req, res) => {
  await db.update(documentsTable).set({ deletedAt: new Date() }).where(and(eq(documentsTable.organizationId, req.authUser!.organizationId), eq(documentsTable.id, (req.params.id as string))));
  return res.status(204).send();
});

export default router;
