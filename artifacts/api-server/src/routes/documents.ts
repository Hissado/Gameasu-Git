import { Router } from "express";
import { db, documentsTable } from "@workspace/db";
import { and, eq, isNull, sql, desc, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/documents", async (req, res) => {
  const { entityType, entityId, category, search = "", limit = "50" } = req.query as Record<string, string>;
  const conds: any[] = [isNull(documentsTable.deletedAt)];
  if (entityType) conds.push(eq(documentsTable.entityType, entityType));
  if (entityId) conds.push(eq(documentsTable.entityId, entityId));
  if (category) conds.push(eq(documentsTable.category, category));
  if (search) conds.push(or(ilike(documentsTable.name, `%${search}%`), ilike(documentsTable.description, `%${search}%`)));
  const data = await db.select().from(documentsTable).where(and(...conds)).orderBy(desc(documentsTable.createdAt)).limit(Number(limit));
  return res.json({ data });
});

router.get("/documents/stats", async (_req, res) => {
  const byEntity = await db.select({
    entityType: documentsTable.entityType,
    count: sql<number>`count(*)`,
  }).from(documentsTable).where(isNull(documentsTable.deletedAt)).groupBy(documentsTable.entityType);
  const byCategory = await db.select({
    category: documentsTable.category,
    count: sql<number>`count(*)`,
  }).from(documentsTable).where(isNull(documentsTable.deletedAt)).groupBy(documentsTable.category);
  const total = await db.select({ c: sql<number>`count(*)` }).from(documentsTable).where(isNull(documentsTable.deletedAt));
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
  }).where(eq(documentsTable.id, req.params.id)).returning();
  if (!d) return res.status(404).json({ error: "Not found" });
  return res.json(d);
});

router.delete("/documents/:id", async (req, res) => {
  await db.update(documentsTable).set({ deletedAt: new Date() }).where(eq(documentsTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
