import { Router } from "express";
import QRCode from "qrcode";
import { db } from "@workspace/db";
import { equipmentTable, equipmentCategoriesTable } from "@workspace/db";
import { eq, sql, isNull, and } from "drizzle-orm";
import { requireManagerOrAbove, requireAdmin } from "../middlewares/auth";

const router = Router();

// QR code (PNG image) pour identifier physiquement un équipement
router.get("/equipment/:id/qrcode", async (req, res) => {
  const [eq1] = await db.select().from(equipmentTable).where(and(eq(equipmentTable.organizationId, req.authUser!.organizationId), eq(equipmentTable.id, req.params.id))).limit(1);
  if (!eq1) {
    res.status(404).json({ error: "Équipement introuvable" });
    return;
  }
  const payload = JSON.stringify({ id: eq1.id, code: eq1.code, name: eq1.name });
  const png = await QRCode.toBuffer(payload, { type: "png", width: 320, margin: 2 });
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(png);
});

// Régénère et persiste le payload QR sur l'équipement
router.post("/equipment/:id/qrcode", requireManagerOrAbove, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [eq1] = await db.select().from(equipmentTable).where(and(eq(equipmentTable.organizationId, orgId), eq(equipmentTable.id, req.params.id))).limit(1);
  if (!eq1) {
    res.status(404).json({ error: "Équipement introuvable" });
    return;
  }
  const payload = JSON.stringify({ id: eq1.id, code: eq1.code, name: eq1.name });
  const dataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 2 });
  const [updated] = await db.update(equipmentTable).set({ qrCode: dataUrl }).where(and(eq(equipmentTable.organizationId, orgId), eq(equipmentTable.id, req.params.id))).returning();
  res.json({ id: updated.id, qrCode: updated.qrCode });
});


router.get("/equipment/categories", async (req, res) => {
  const cats = await db.select().from(equipmentCategoriesTable);
  const withCount = await Promise.all(cats.map(async c => {
    const count = await db.select({ count: sql<number>`count(*)` }).from(equipmentTable).where(eq(equipmentTable.categoryId, c.id));
    return { ...c, equipmentCount: Number(count[0].count) };
  }));
  return res.json(withCount);
});

router.post("/equipment/categories", requireManagerOrAbove, async (req, res) => {
  const { name, description } = req.body;
  const [cat] = await db.insert(equipmentCategoriesTable).values({ name, description }).returning();
  return res.status(201).json({ ...cat, equipmentCount: 0 });
});

router.get("/equipment/availability", async (req, res) => {
  const all = await db.select().from(equipmentTable).where(and(eq(equipmentTable.organizationId, req.authUser!.organizationId), isNull(equipmentTable.deletedAt)));
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

  const orgFilter = and(eq(equipmentTable.organizationId, req.authUser!.organizationId), isNull(equipmentTable.deletedAt));
  const rows = await db.select({
    equip: equipmentTable,
    categoryName: equipmentCategoriesTable.name,
  })
    .from(equipmentTable)
    .leftJoin(equipmentCategoriesTable, eq(equipmentTable.categoryId, equipmentCategoriesTable.id))
    .where(orgFilter)
    .limit(limitNum).offset(offset);

  const data = rows.map(row => ({
    ...row.equip,
    categoryName: row.categoryName,
    dailyRate: row.equip.dailyRate ? Number(row.equip.dailyRate) : null,
  }));

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(equipmentTable).where(orgFilter);
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/equipment", requireManagerOrAbove, async (req, res) => {
  const { name, code, categoryId, description, status, quantity, dailyRate, imageUrl, photos, variant, location } = req.body;
  const [equip] = await db.insert(equipmentTable).values({
    organizationId: req.authUser!.organizationId,
    name, code, categoryId, description, status: status || "available",
    quantity: quantity || 1, availableQuantity: quantity || 1,
    dailyRate: dailyRate?.toString(), imageUrl, photos: photos || [], variant, location,
  }).returning();
  return res.status(201).json({ ...equip, dailyRate: equip.dailyRate ? Number(equip.dailyRate) : null });
});

router.get("/equipment/:id", async (req, res) => {
  const rows = await db.select({
    equip: equipmentTable,
    categoryName: equipmentCategoriesTable.name,
  }).from(equipmentTable)
    .leftJoin(equipmentCategoriesTable, eq(equipmentTable.categoryId, equipmentCategoriesTable.id))
    .where(and(eq(equipmentTable.organizationId, req.authUser!.organizationId), eq(equipmentTable.id, req.params.id))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].equip, categoryName: rows[0].categoryName, dailyRate: rows[0].equip.dailyRate ? Number(rows[0].equip.dailyRate) : null });
});

router.put("/equipment/:id", requireManagerOrAbove, async (req, res) => {
  const { name, code, categoryId, description, status, quantity, dailyRate, imageUrl, photos, variant, location } = req.body;
  const [equip] = await db.update(equipmentTable)
    .set({ name, code, categoryId, description, status, quantity, dailyRate: dailyRate?.toString(), imageUrl, photos, variant, location })
    .where(and(eq(equipmentTable.organizationId, req.authUser!.organizationId), eq(equipmentTable.id, req.params.id))).returning();
  if (!equip) return res.status(404).json({ error: "Not found" });
  return res.json({ ...equip, dailyRate: equip.dailyRate ? Number(equip.dailyRate) : null });
});

router.delete("/equipment/:id", requireAdmin, async (req, res) => {
  await db.update(equipmentTable).set({ deletedAt: new Date() }).where(and(eq(equipmentTable.organizationId, req.authUser!.organizationId), eq(equipmentTable.id, req.params.id)));
  return res.status(204).send();
});

export default router;
