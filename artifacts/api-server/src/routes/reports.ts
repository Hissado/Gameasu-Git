import { Router } from "express";
import PDFDocument from "pdfkit";
import { db } from "@workspace/db";
import {
  equipmentTable,
  equipmentCategoriesTable,
  rentalsTable,
  rentalItemsTable,
  equipmentMovementsTable,
  usersTable,
  tasksTable,
  projectsTable,
  dailyStockReportsTable,
} from "@workspace/db";
import { eq, sql, isNull, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

router.get("/reports/stock-daily", requireAuth, async (_req, res) => {
  const equipment = await db
    .select({ e: equipmentTable, categoryName: equipmentCategoriesTable.name })
    .from(equipmentTable)
    .leftJoin(equipmentCategoriesTable, eq(equipmentTable.categoryId, equipmentCategoriesTable.id))
    .where(isNull(equipmentTable.deletedAt));

  const byCategory: Record<string, { total: number; available: number; rented: number; maintenance: number; items: any[] }> = {};
  let totals = { total: 0, available: 0, rented: 0, maintenance: 0 };

  for (const row of equipment) {
    const cat = row.categoryName || "Sans catégorie";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, available: 0, rented: 0, maintenance: 0, items: [] };
    const qty = row.e.quantity || 1;
    byCategory[cat].total += qty;
    totals.total += qty;
    if (row.e.status === "available") {
      byCategory[cat].available += qty;
      totals.available += qty;
    } else if (row.e.status === "rented") {
      byCategory[cat].rented += qty;
      totals.rented += qty;
    } else if (row.e.status === "maintenance") {
      byCategory[cat].maintenance += qty;
      totals.maintenance += qty;
    }
    byCategory[cat].items.push({ id: row.e.id, name: row.e.name, code: row.e.code, status: row.e.status, quantity: qty });
  }

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const movements = await db
    .select()
    .from(equipmentMovementsTable)
    .where(gte(equipmentMovementsTable.createdAt, yesterday));

  res.json({
    generatedAt: today.toISOString(),
    period: { from: yesterday.toISOString(), to: today.toISOString() },
    totals,
    byCategory,
    movements24h: movements.length,
  });
});

router.get("/reports/stock-daily/pdf", requireAuth, async (_req, res) => {
  const equipment = await db
    .select({ e: equipmentTable, categoryName: equipmentCategoriesTable.name })
    .from(equipmentTable)
    .leftJoin(equipmentCategoriesTable, eq(equipmentTable.categoryId, equipmentCategoriesTable.id))
    .where(isNull(equipmentTable.deletedAt));

  const byCategory: Record<string, { total: number; available: number; rented: number; maintenance: number }> = {};
  let totals = { total: 0, available: 0, rented: 0, maintenance: 0 };

  for (const row of equipment) {
    const cat = row.categoryName || "Sans catégorie";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, available: 0, rented: 0, maintenance: 0 };
    const qty = row.e.quantity || 1;
    byCategory[cat].total += qty;
    totals.total += qty;
    if (row.e.status === "available") { byCategory[cat].available += qty; totals.available += qty; }
    else if (row.e.status === "rented") { byCategory[cat].rented += qty; totals.rented += qty; }
    else if (row.e.status === "maintenance") { byCategory[cat].maintenance += qty; totals.maintenance += qty; }
  }

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="rapport-stock-${new Date().toISOString().slice(0, 10)}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).fillColor("#F26B1F").text("EDOLE AFRICA", { align: "left" });
  doc.fontSize(10).fillColor("#666").text("Le pilotage d'entreprise nouvelle génération");
  doc.moveDown();

  doc.fontSize(16).fillColor("#000").text("Rapport journalier du stock", { align: "center" });
  doc.fontSize(10).fillColor("#666").text(`Généré le ${new Date().toLocaleDateString("fr-FR", { dateStyle: "full" })}`, { align: "center" });
  doc.moveDown(2);

  doc.fontSize(13).fillColor("#000").text("Synthèse globale");
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#333");
  doc.text(`Total équipements : ${totals.total}`);
  doc.text(`Disponible : ${totals.available}`);
  doc.text(`En location : ${totals.rented}`);
  doc.text(`En maintenance : ${totals.maintenance}`);
  doc.moveDown(1.5);

  doc.fontSize(13).fillColor("#000").text("Détail par catégorie");
  doc.moveDown(0.5);
  for (const [cat, stats] of Object.entries(byCategory)) {
    doc.fontSize(11).fillColor("#F26B1F").text(cat, { continued: false });
    doc.fontSize(10).fillColor("#333").text(
      `   Total: ${stats.total}  •  Dispo: ${stats.available}  •  Location: ${stats.rented}  •  Maintenance: ${stats.maintenance}`,
    );
    doc.moveDown(0.3);
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#999").text("EDOLE AFRICA — Document confidentiel — Généré automatiquement par la plateforme.", { align: "center" });

  doc.end();
});

// Historique des snapshots journaliers du parc
router.get("/reports/stock-daily/history", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(dailyStockReportsTable)
    .orderBy(desc(dailyStockReportsTable.createdAt))
    .limit(30);
  res.json(rows);
});

// Capture (snapshot) le rapport journalier dans dailyStockReportsTable
router.post("/reports/stock-daily/snapshot", requireAuth, requireManagerOrAbove, async (req, res) => {
  const equipment = await db
    .select({ e: equipmentTable, categoryName: equipmentCategoriesTable.name })
    .from(equipmentTable)
    .leftJoin(equipmentCategoriesTable, eq(equipmentTable.categoryId, equipmentCategoriesTable.id))
    .where(isNull(equipmentTable.deletedAt));

  const byCategory: Record<string, { total: number; available: number; rented: number; maintenance: number }> = {};
  let totals = { total: 0, available: 0, rented: 0, maintenance: 0 };
  for (const row of equipment) {
    const cat = row.categoryName || "Sans catégorie";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, available: 0, rented: 0, maintenance: 0 };
    const qty = row.e.quantity || 1;
    byCategory[cat].total += qty;
    totals.total += qty;
    if (row.e.status === "available") { byCategory[cat].available += qty; totals.available += qty; }
    else if (row.e.status === "rented") { byCategory[cat].rented += qty; totals.rented += qty; }
    else if (row.e.status === "maintenance") { byCategory[cat].maintenance += qty; totals.maintenance += qty; }
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const movements = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(equipmentMovementsTable)
    .where(gte(equipmentMovementsTable.createdAt, yesterday));

  const [snapshot] = await db
    .insert(dailyStockReportsTable)
    .values({
      reportDate: new Date().toISOString().slice(0, 10),
      totalEquipment: totals.total,
      available: totals.available,
      rented: totals.rented,
      maintenance: totals.maintenance,
      movements24h: Number(movements[0]?.count || 0),
      byCategory,
      generatedById: req.authUser?.id,
    })
    .returning();
  res.status(201).json(snapshot);
});

router.get("/reports/workload", requireAuth, async (_req, res) => {
  // Agrégation en 2 requêtes agrégées (au lieu de 3N+1) :
  //   1) compteur tâches + tâches actives par assigneeId
  //   2) compteur projets distincts par assigneeId
  const users = await db.select().from(usersTable).where(eq(usersTable.isActive, true));

  const taskAgg = await db
    .select({
      assigneeId: tasksTable.assigneeId,
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${tasksTable.status} != 'done')`,
    })
    .from(tasksTable)
    .where(isNull(tasksTable.deletedAt))
    .groupBy(tasksTable.assigneeId);

  const projectAgg = await db
    .select({
      assigneeId: tasksTable.assigneeId,
      projects: sql<number>`count(distinct ${projectsTable.id})`,
    })
    .from(tasksTable)
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(and(isNull(tasksTable.deletedAt), isNull(projectsTable.deletedAt)))
    .groupBy(tasksTable.assigneeId);

  const taskMap = new Map(taskAgg.map((r) => [r.assigneeId, r]));
  const projMap = new Map(projectAgg.map((r) => [r.assigneeId, Number(r.projects)]));

  const result = users.map((u) => {
    const t = taskMap.get(u.id);
    const active = Number(t?.active || 0);
    return {
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
      totalTasks: Number(t?.total || 0),
      activeTasks: active,
      activeProjects: projMap.get(u.id) || 0,
      load: Math.min(100, Math.round((active / 10) * 100)),
    };
  });
  res.json(result);
});

export default router;
