import { Router } from "express";
import { db } from "@workspace/db";
import { equipmentTable, equipmentCategoriesTable } from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";

const router = Router();

router.get("/equipment/categories", async (req, res) => {
  const cats = await db.select().from(equipmentCategoriesTable);
  const withCount = await Promise.all(cats.map(async c => {
    const count = await db.select({ count: sql<number>`count(*)` }).from(equipmentTable).where(eq(equipmentTable.categoryId, c.id));
    return { ...c, equipmentCount: Number(count[0].count) };
  }));
  return res.json(withCount);
});

router.post("/equipment/categories", async (req, res) => {
  const { name, description } = req.body;
  const [cat] = await db.insert(equipmentCategoriesTable).values({ name, description }).returning();
  return res.status(201).json({ ...cat, equipmentCount: 0 });
});

router.get("/equipment/availability", async (req, res) => {
  const all = await db.select().from(equipmentTable).where(isNull(equipmentTable.deletedAt));
  return res.json({
    totalItems: all.length,
    available: all.filter(e => e.status === "available").length,
    rented: all.filter(e => e.status === "rented").length,
    maintenance: all.filter(e => e.status === "maintenance").length,
    retired: all.filter(e => e.status === "retired").length,
  });
});

router.get("/equipment", async (req, res) => {
  const { categoryId, status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({
    equip: equipmentTable,
    categoryName: equipmentCategoriesTable.name,
  })
    .from(equipmentTable)
    .leftJoin(equipmentCategoriesTable, eq(equipmentTable.categoryId, equipmentCategoriesTable.id))
    .where(isNull(equipmentTable.deletedAt))
    .limit(limitNum).offset(offset);

  const data = rows.map(row => ({
    ...row.equip,
    categoryName: row.categoryName,
    dailyRate: row.equip.dailyRate ? Number(row.equip.dailyRate) : null,
  }));

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(equipmentTable).where(isNull(equipmentTable.deletedAt));
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/equipment", async (req, res) => {
  const { name, code, categoryId, description, status, quantity, dailyRate, imageUrl, location } = req.body;
  const [equip] = await db.insert(equipmentTable).values({
    name, code, categoryId, description, status: status || "available",
    quantity: quantity || 1, availableQuantity: quantity || 1,
    dailyRate: dailyRate?.toString(), imageUrl, location,
  }).returning();
  return res.status(201).json({ ...equip, dailyRate: equip.dailyRate ? Number(equip.dailyRate) : null });
});

router.get("/equipment/:id", async (req, res) => {
  const rows = await db.select({
    equip: equipmentTable,
    categoryName: equipmentCategoriesTable.name,
  }).from(equipmentTable)
    .leftJoin(equipmentCategoriesTable, eq(equipmentTable.categoryId, equipmentCategoriesTable.id))
    .where(eq(equipmentTable.id, req.params.id)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].equip, categoryName: rows[0].categoryName, dailyRate: rows[0].equip.dailyRate ? Number(rows[0].equip.dailyRate) : null });
});

router.put("/equipment/:id", async (req, res) => {
  const { name, code, categoryId, description, status, quantity, dailyRate, imageUrl, location } = req.body;
  const [equip] = await db.update(equipmentTable)
    .set({ name, code, categoryId, description, status, quantity, dailyRate: dailyRate?.toString(), imageUrl, location })
    .where(eq(equipmentTable.id, req.params.id)).returning();
  if (!equip) return res.status(404).json({ error: "Not found" });
  return res.json({ ...equip, dailyRate: equip.dailyRate ? Number(equip.dailyRate) : null });
});

router.delete("/equipment/:id", async (req, res) => {
  await db.update(equipmentTable).set({ deletedAt: new Date() }).where(eq(equipmentTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
