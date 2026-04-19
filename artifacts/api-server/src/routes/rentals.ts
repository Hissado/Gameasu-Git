import { Router } from "express";
import { db } from "@workspace/db";
import { rentalsTable, rentalItemsTable, inspectionsTable, logisticsOperationsTable, clientsTable, equipmentTable, usersTable } from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

// RENTALS
router.get("/rentals", async (req, res) => {
  const { status, clientId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({
    rental: rentalsTable,
    clientName: clientsTable.name,
  }).from(rentalsTable)
    .leftJoin(clientsTable, eq(rentalsTable.clientId, clientsTable.id))
    .limit(limitNum).offset(offset);

  const data = rows.map(row => ({
    ...row.rental,
    clientName: row.clientName,
    totalCost: row.rental.totalCost ? Number(row.rental.totalCost) : null,
  }));
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(rentalsTable);
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/rentals", requireManagerOrAbove, async (req, res) => {
  const { clientId, status, startDate, endDate, notes, items } = req.body;
  const refNum = `RNT-${Date.now().toString(36).toUpperCase()}`;
  const [rental] = await db.insert(rentalsTable).values({
    referenceNumber: refNum, clientId, status: status || "pending", startDate, endDate, notes,
  }).returning();

  if (items && items.length > 0) {
    for (const item of items) {
      const equip = await db.select().from(equipmentTable).where(eq(equipmentTable.id, item.equipmentId)).limit(1);
      const dailyRate = equip[0]?.dailyRate ? Number(equip[0].dailyRate) : 0;
      await db.insert(rentalItemsTable).values({
        rentalId: rental.id,
        equipmentId: item.equipmentId,
        quantity: item.quantity,
        dailyRate: dailyRate.toString(),
      });
    }
  }

  return res.status(201).json({ ...rental, totalCost: rental.totalCost ? Number(rental.totalCost) : null });
});

router.get("/rentals/:id", async (req, res) => {
  const rows = await db.select({
    rental: rentalsTable,
    clientName: clientsTable.name,
  }).from(rentalsTable)
    .leftJoin(clientsTable, eq(rentalsTable.clientId, clientsTable.id))
    .where(eq(rentalsTable.id, req.params.id)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });

  const items = await db.select({
    item: rentalItemsTable,
    equipmentName: equipmentTable.name,
  }).from(rentalItemsTable)
    .leftJoin(equipmentTable, eq(rentalItemsTable.equipmentId, equipmentTable.id))
    .where(eq(rentalItemsTable.rentalId, req.params.id));

  return res.json({
    ...rows[0].rental,
    clientName: rows[0].clientName,
    totalCost: rows[0].rental.totalCost ? Number(rows[0].rental.totalCost) : null,
    items: items.map(i => ({
      equipmentId: i.item.equipmentId,
      equipmentName: i.equipmentName,
      quantity: i.item.quantity,
      dailyRate: i.item.dailyRate ? Number(i.item.dailyRate) : 0,
      subtotal: i.item.subtotal ? Number(i.item.subtotal) : 0,
    })),
  });
});

router.put("/rentals/:id", requireManagerOrAbove, async (req, res) => {
  const { clientId, status, startDate, endDate, notes } = req.body;
  const [rental] = await db.update(rentalsTable)
    .set({ clientId, status, startDate, endDate, notes })
    .where(eq(rentalsTable.id, req.params.id)).returning();
  if (!rental) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rental, totalCost: rental.totalCost ? Number(rental.totalCost) : null });
});

// INSPECTIONS
router.get("/inspections", async (req, res) => {
  const { rentalId, type, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({
    inspection: inspectionsTable,
    conductedByName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(inspectionsTable)
    .leftJoin(usersTable, eq(inspectionsTable.conductedById, usersTable.id))
    .limit(limitNum).offset(offset);

  const data = rows.map(row => ({
    ...row.inspection,
    conductedByName: row.conductedByName,
    hasDispute: row.inspection.hasDispute === "true",
    retentionAmount: row.inspection.retentionAmount ? Number(row.inspection.retentionAmount) : null,
  }));
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(inspectionsTable);
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/inspections", requireManagerOrAbove, async (req, res) => {
  const { rentalId, type, notes, hasDispute, disputeNotes, retentionAmount, photos } = req.body;
  const [insp] = await db.insert(inspectionsTable).values({
    rentalId, type, notes, hasDispute: hasDispute ? "true" : "false", disputeNotes,
    retentionAmount: retentionAmount?.toString(), conductedById: req.authUser?.id, photos: photos || [],
  }).returning();
  return res.status(201).json({ ...insp, hasDispute: insp.hasDispute === "true", retentionAmount: insp.retentionAmount ? Number(insp.retentionAmount) : null });
});

router.get("/inspections/:id", async (req, res) => {
  const rows = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, req.params.id)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0], hasDispute: rows[0].hasDispute === "true", retentionAmount: rows[0].retentionAmount ? Number(rows[0].retentionAmount) : null });
});

router.put("/inspections/:id", requireManagerOrAbove, async (req, res) => {
  const { type, notes, hasDispute, disputeNotes, retentionAmount, photos } = req.body;
  const [insp] = await db.update(inspectionsTable)
    .set({ type, notes, hasDispute: hasDispute ? "true" : "false", disputeNotes, retentionAmount: retentionAmount?.toString(), photos })
    .where(eq(inspectionsTable.id, req.params.id)).returning();
  if (!insp) return res.status(404).json({ error: "Not found" });
  return res.json({ ...insp, hasDispute: insp.hasDispute === "true", retentionAmount: insp.retentionAmount ? Number(insp.retentionAmount) : null });
});

// Endpoint dédié à la comparaison des deux états (départ vs retour) d'une location
router.get("/rentals/:id/inspections", async (req, res) => {
  const inspections = await db
    .select({
      i: inspectionsTable,
      conductedByName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
    })
    .from(inspectionsTable)
    .leftJoin(usersTable, eq(inspectionsTable.conductedById, usersTable.id))
    .where(eq(inspectionsTable.rentalId, req.params.id));

  const data = inspections.map((row) => ({
    ...row.i,
    conductedByName: row.conductedByName,
    hasDispute: row.i.hasDispute === "true",
    retentionAmount: row.i.retentionAmount ? Number(row.i.retentionAmount) : null,
  }));

  return res.json({
    rentalId: req.params.id,
    departure: data.find((d) => d.type === "departure") || null,
    returnInspection: data.find((d) => d.type === "return") || null,
    all: data,
  });
});

// LOGISTICS
router.get("/logistics", async (req, res) => {
  const { type, status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({
    op: logisticsOperationsTable,
    responsibleName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(logisticsOperationsTable)
    .leftJoin(usersTable, eq(logisticsOperationsTable.responsibleId, usersTable.id))
    .limit(limitNum).offset(offset);

  const data = rows.map(row => ({ ...row.op, responsibleName: row.responsibleName }));
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(logisticsOperationsTable);
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/logistics", requireManagerOrAbove, async (req, res) => {
  const { type, status, rentalId, responsibleId, address, scheduledAt, notes } = req.body;
  const [op] = await db.insert(logisticsOperationsTable).values({
    type, status: status || "scheduled", rentalId, responsibleId, address,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, notes,
  }).returning();
  return res.status(201).json(op);
});

router.put("/logistics/:id", requireManagerOrAbove, async (req, res) => {
  const { type, status, rentalId, responsibleId, address, scheduledAt, notes } = req.body;
  const [op] = await db.update(logisticsOperationsTable)
    .set({ type, status, rentalId, responsibleId, address, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, notes })
    .where(eq(logisticsOperationsTable.id, req.params.id)).returning();
  if (!op) return res.status(404).json({ error: "Not found" });
  return res.json(op);
});

export default router;
