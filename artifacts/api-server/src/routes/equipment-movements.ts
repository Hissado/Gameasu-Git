import { Router } from "express";
import { db } from "@workspace/db";
import { equipmentMovementsTable, equipmentTable, rentalsTable, rentalItemsTable } from "@workspace/db";
import { eq, and, lte, gte, or, sql } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

router.get("/equipment/:id/movements", requireAuth, async (req, res) => {
  const movements = await db
    .select()
    .from(equipmentMovementsTable)
    .where(eq(equipmentMovementsTable.equipmentId, req.params.id))
    .orderBy(sql`${equipmentMovementsTable.createdAt} DESC`)
    .limit(100);
  res.json(movements);
});

router.post("/equipment/:id/movements", requireAuth, requireManagerOrAbove, async (req, res) => {
  const { type, fromLocation, toLocation, quantity, notes } = req.body;
  const [mov] = await db
    .insert(equipmentMovementsTable)
    .values({
      equipmentId: req.params.id,
      type,
      fromLocation,
      toLocation,
      quantity: quantity || 1,
      performedById: req.authUser?.id,
      notes,
    })
    .returning();
  if (toLocation) {
    await db.update(equipmentTable).set({ location: toLocation }).where(eq(equipmentTable.id, req.params.id));
  }
  res.status(201).json(mov);
});

// Vérification temporelle de disponibilité
router.get("/equipment/:id/availability-window", requireAuth, async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  if (!from || !to) {
    res.status(400).json({ error: "Paramètres 'from' et 'to' requis (YYYY-MM-DD)" });
    return;
  }

  const equip = await db.select().from(equipmentTable).where(eq(equipmentTable.id, req.params.id)).limit(1);
  if (!equip[0]) {
    res.status(404).json({ error: "Équipement introuvable" });
    return;
  }

  const totalQuantity = equip[0].quantity || 1;

  // Trouver les locations qui se chevauchent
  const overlapping = await db
    .select({
      rental: rentalsTable,
      item: rentalItemsTable,
    })
    .from(rentalItemsTable)
    .innerJoin(rentalsTable, eq(rentalItemsTable.rentalId, rentalsTable.id))
    .where(
      and(
        eq(rentalItemsTable.equipmentId, req.params.id),
        sql`${rentalsTable.status} IN ('confirmed', 'active', 'pending')`,
        // Chevauchement: rental.start <= to && rental.end >= from
        lte(rentalsTable.startDate, to),
        gte(rentalsTable.endDate, from),
      ),
    );

  const reservedQty = overlapping.reduce((s, o) => s + (o.item.quantity || 1), 0);
  const available = Math.max(0, totalQuantity - reservedQty);

  res.json({
    equipmentId: req.params.id,
    equipmentName: equip[0].name,
    period: { from, to },
    totalQuantity,
    reservedQuantity: reservedQty,
    availableQuantity: available,
    isAvailable: available > 0,
    conflicts: overlapping.map((o) => ({
      rentalId: o.rental.id,
      reference: o.rental.referenceNumber,
      status: o.rental.status,
      startDate: o.rental.startDate,
      endDate: o.rental.endDate,
      quantity: o.item.quantity,
    })),
  });
});

export default router;
