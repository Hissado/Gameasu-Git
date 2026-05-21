import { Router } from "express";
import { db, servicesTable } from "@workspace/db";
import { and, eq, isNull, sql, ilike } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

router.get("/services", async (req, res) => {
  const { search = "", category = "", active } = req.query as Record<string, string>;
  const conds: any[] = [
    eq(servicesTable.organizationId, req.authUser!.organizationId),
    isNull(servicesTable.deletedAt),
  ];
  if (search) conds.push(ilike(servicesTable.name, `%${search}%`));
  if (category) conds.push(eq(servicesTable.category, category));
  if (active === "true") conds.push(eq(servicesTable.isActive, true));
  const data = await db.select().from(servicesTable).where(and(...conds)).orderBy(servicesTable.name);
  return res.json({ data });
});

router.get("/services/:id", async (req, res) => {
  const [s] = await db.select().from(servicesTable).where(and(eq(servicesTable.organizationId, req.authUser!.organizationId), eq(servicesTable.id, req.params.id))).limit(1);
  if (!s) return res.status(404).json({ error: "Not found" });
  return res.json(s);
});

router.post("/services", requireManagerOrAbove, async (req, res) => {
  try {
    const { code, name, category, unit, unitPrice, description, isActive } = req.body;
    if (!code || !name) return res.status(400).json({ error: "code et name requis" });
    const [s] = await db.insert(servicesTable).values({
      organizationId: req.authUser!.organizationId,
      code, name, category, unit: unit || "forfait",
      unitPrice: unitPrice != null ? String(unitPrice) : "0",
      description, isActive: isActive ?? true,
    }).returning();
    return res.status(201).json(s);
  } catch (e: any) {
    if (e.code === "23505") return res.status(409).json({ error: "Code déjà utilisé" });
    return res.status(400).json({ error: e.message });
  }
});

router.put("/services/:id", requireManagerOrAbove, async (req, res) => {
  try {
    const { code, name, category, unit, unitPrice, description, isActive } = req.body;
    const [s] = await db.update(servicesTable).set({
      code, name, category, unit, description, isActive,
      ...(unitPrice != null ? { unitPrice: String(unitPrice) } : {}),
    }).where(and(eq(servicesTable.organizationId, req.authUser!.organizationId), eq(servicesTable.id, req.params.id))).returning();
    if (!s) return res.status(404).json({ error: "Not found" });
    return res.json(s);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.delete("/services/:id", requireManagerOrAbove, async (req, res) => {
  await db.update(servicesTable).set({ deletedAt: new Date() }).where(and(eq(servicesTable.organizationId, req.authUser!.organizationId), eq(servicesTable.id, req.params.id)));
  return res.status(204).send();
});

router.get("/services-stats/summary", async (req, res) => {
  const rows = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) filter (where is_active = true)`,
    avgPrice: sql<number>`coalesce(avg(unit_price), 0)`,
  }).from(servicesTable).where(and(eq(servicesTable.organizationId, req.authUser!.organizationId), isNull(servicesTable.deletedAt)));
  return res.json({
    total: Number(rows[0].total),
    active: Number(rows[0].active),
    avgPrice: Number(rows[0].avgPrice),
  });
});

export default router;
