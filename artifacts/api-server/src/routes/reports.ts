import { Router } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
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
  invoicesTable,
  paymentsTable,
  ordersTable,
  proformasTable,
  clientsTable,
  opportunitiesTable,
  collaboratorsTable,
  attendanceSessionsTable,
  attendanceFlagsTable,
  contractsTable,
  departmentsTable,
} from "@workspace/db";
import { eq, sql, isNull, and, gte, lte, desc, ne, inArray, isNotNull } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

// ────────────────────────────────────────────────────────────────
// Helpers communs aux rapports analytiques
// ────────────────────────────────────────────────────────────────

function parsePeriod(req: { query: any }): { from: Date; to: Date; fromIso: string; toIso: string } {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const fromStr = typeof req.query.from === "string" ? req.query.from : "";
  const toStr = typeof req.query.to === "string" ? req.query.to : "";
  // Format attendu : YYYY-MM-DD. On force minuit local pour `from`, fin de journée pour `to`,
  // afin d'éviter les décalages dus à l'interprétation UTC de "YYYY-MM-DD" par new Date().
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;
  let from: Date;
  let to: Date;
  const mF = fromStr.match(ymd);
  if (mF) from = new Date(+mF[1], +mF[2] - 1, +mF[3], 0, 0, 0, 0);
  else from = fromStr ? new Date(fromStr) : defaultFrom;
  const mT = toStr.match(ymd);
  if (mT) to = new Date(+mT[1], +mT[2] - 1, +mT[3], 23, 59, 59, 999);
  else to = toStr ? new Date(toStr) : defaultTo;
  if (isNaN(from.getTime())) from.setTime(defaultFrom.getTime());
  if (isNaN(to.getTime())) to.setTime(defaultTo.getTime());
  return { from, to, fromIso: from.toISOString(), toIso: to.toISOString() };
}

// Labels FR pour les exports Excel (les chaînes en frontend gèrent l'affichage UI).
const INVOICE_STATUS_FR: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", paid: "Payée", partial: "Partiellement payée",
  overdue: "En retard", cancelled: "Annulée", void: "Annulée",
};
const PROJECT_STATUS_FR: Record<string, string> = {
  planning: "En planification", active: "Active", in_progress: "En cours",
  on_hold: "En pause", completed: "Terminée", cancelled: "Annulée",
};
const PIPELINE_STAGE_FR: Record<string, string> = {
  lead: "Prospect", qualified: "Qualifié", proposal: "Proposition",
  negotiation: "Négociation", won: "Gagnée", lost: "Perdue",
};
const CONTRACT_TYPE_FR: Record<string, string> = {
  cdi: "CDI", cdd: "CDD", stage: "Stage", prestation: "Prestation",
  mission: "Mission", apprentissage: "Apprentissage",
};

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

function monthKey(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(amount)) + " FCFA";
}

function applyExcelBranding(ws: ExcelJS.Worksheet, title: string, period: { from: Date; to: Date }) {
  ws.mergeCells("A1:F1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `GAMÉASÙ — ${title}`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8A24B" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 28;
  ws.mergeCells("A2:F2");
  const sub = ws.getCell("A2");
  sub.value = `Période : ${period.from.toLocaleDateString("fr-FR")} → ${period.to.toLocaleDateString("fr-FR")}  •  Généré le ${new Date().toLocaleString("fr-FR")}`;
  sub.font = { italic: true, color: { argb: "FF666666" }, size: 10 };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 20;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
  row.height = 22;
}

async function sendXlsx(res: import("express").Response, wb: ExcelJS.Workbook, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

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

  doc.fontSize(20).fillColor("#C8A24B").text("GAMÉASÙ", { align: "left" });
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
    doc.fontSize(11).fillColor("#C8A24B").text(cat, { continued: false });
    doc.fontSize(10).fillColor("#333").text(
      `   Total: ${stats.total}  •  Dispo: ${stats.available}  •  Location: ${stats.rented}  •  Maintenance: ${stats.maintenance}`,
    );
    doc.moveDown(0.3);
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#999").text("GAMÉASÙ — Document confidentiel — Généré automatiquement par la plateforme.", { align: "center" });

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

// ════════════════════════════════════════════════════════════════
// FINANCE — Facturation, encaissement, créances
// ════════════════════════════════════════════════════════════════

async function buildFinanceReport(period: { from: Date; to: Date }) {
  const { from, to } = period;
  const todayStr = new Date().toISOString().slice(0, 10);

  const invoices = await db.select().from(invoicesTable);
  const inPeriod = invoices.filter((inv) => {
    const ref = inv.issuedAt ? new Date(inv.issuedAt) : new Date(inv.createdAt);
    return ref >= from && ref <= to;
  });

  const invoicedAmount = inPeriod.reduce((s, i) => s + num(i.totalAmount), 0);
  const invoicedCount = inPeriod.length;
  const paidCount = inPeriod.filter((i) => i.status === "paid").length;

  const outstandingAll = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.status !== "void");
  const outstandingAmount = outstandingAll.reduce((s, i) => s + (num(i.totalAmount) - num(i.paidAmount)), 0);
  const overdue = outstandingAll.filter((i) => i.dueDate && i.dueDate < todayStr);
  const overdueAmount = overdue.reduce((s, i) => s + (num(i.totalAmount) - num(i.paidAmount)), 0);

  const payments = await db.select().from(paymentsTable).where(and(gte(paymentsTable.paidAt, from), lte(paymentsTable.paidAt, to)));
  const collectedAmount = payments.reduce((s, p) => s + num(p.amount), 0);

  // Évolution mensuelle sur les 12 derniers mois (relative à `to`)
  const monthsBack = 12;
  const series: Array<{ month: string; facture: number; encaisse: number }> = [];
  const baseDate = new Date(to.getFullYear(), to.getMonth(), 1);
  const monthFacture: Record<string, number> = {};
  const monthEncaisse: Record<string, number> = {};
  for (const inv of invoices) {
    const k = monthKey(inv.issuedAt || inv.createdAt);
    if (k) monthFacture[k] = (monthFacture[k] || 0) + num(inv.totalAmount);
  }
  const allPayments = await db.select().from(paymentsTable);
  for (const p of allPayments) {
    const k = monthKey(p.paidAt || p.createdAt);
    if (k) monthEncaisse[k] = (monthEncaisse[k] || 0) + num(p.amount);
  }
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
    const k = monthKey(d);
    series.push({
      month: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      facture: Math.round(monthFacture[k] || 0),
      encaisse: Math.round(monthEncaisse[k] || 0),
    });
  }

  // Top clients par CA facturé sur la période
  const clientNames = new Map<string, string>();
  const clients = await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable);
  clients.forEach((c) => clientNames.set(c.id, c.name));
  const byClient: Record<string, { id: string; name: string; amount: number; count: number }> = {};
  for (const inv of inPeriod) {
    if (!inv.clientId) continue;
    if (!byClient[inv.clientId]) byClient[inv.clientId] = { id: inv.clientId, name: clientNames.get(inv.clientId) || "—", amount: 0, count: 0 };
    byClient[inv.clientId].amount += num(inv.totalAmount);
    byClient[inv.clientId].count += 1;
  }
  const topClients = Object.values(byClient).sort((a, b) => b.amount - a.amount).slice(0, 5);

  // Répartition par statut
  const byStatus: Record<string, { count: number; amount: number }> = {};
  for (const inv of inPeriod) {
    const k = inv.status || "draft";
    if (!byStatus[k]) byStatus[k] = { count: 0, amount: 0 };
    byStatus[k].count += 1;
    byStatus[k].amount += num(inv.totalAmount);
  }

  const overdueList = overdue
    .map((i) => ({
      id: i.id,
      reference: i.referenceNumber,
      clientName: i.clientId ? clientNames.get(i.clientId) || "—" : "—",
      dueDate: i.dueDate,
      outstanding: num(i.totalAmount) - num(i.paidAmount),
    }))
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 10);

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    kpi: {
      invoicedAmount,
      invoicedCount,
      paidCount,
      collectedAmount,
      outstandingAmount,
      outstandingCount: outstandingAll.length,
      overdueAmount,
      overdueCount: overdue.length,
      collectionRate: invoicedAmount > 0 ? Math.round((collectedAmount / invoicedAmount) * 100) : 0,
    },
    series,
    topClients,
    byStatus,
    overdueList,
  };
}

router.get("/reports/finance", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const report = await buildFinanceReport(period);
    res.json(report);
  } catch (e) { next(e); }
});

router.get("/reports/finance/export.xlsx", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const r = await buildFinanceReport(period);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Synthèse");
    applyExcelBranding(ws, "Rapport Finance", period);
    ws.addRow([]);
    const k = ws.addRow(["Indicateur", "Valeur"]);
    styleHeaderRow(k);
    ws.columns = [{ width: 36 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];
    const lines: Array<[string, string]> = [
      ["Chiffre d'affaires facturé", formatFCFA(r.kpi.invoicedAmount)],
      ["Encaissements reçus", formatFCFA(r.kpi.collectedAmount)],
      ["Encours total", formatFCFA(r.kpi.outstandingAmount)],
      ["Encours en retard", formatFCFA(r.kpi.overdueAmount)],
      ["Factures émises", String(r.kpi.invoicedCount)],
      ["Factures soldées", String(r.kpi.paidCount)],
      ["Taux de recouvrement", `${r.kpi.collectionRate} %`],
    ];
    lines.forEach((l) => ws.addRow(l));

    ws.addRow([]);
    const h2 = ws.addRow(["Évolution mensuelle", "Facturé", "Encaissé"]);
    styleHeaderRow(h2);
    r.series.forEach((s) => ws.addRow([s.month, s.facture, s.encaisse]));

    ws.addRow([]);
    const h3 = ws.addRow(["Top clients", "Factures", "Montant facturé"]);
    styleHeaderRow(h3);
    r.topClients.forEach((c) => ws.addRow([c.name, c.count, c.amount]));

    ws.addRow([]);
    const hS = ws.addRow(["Répartition par statut", "Factures", "Montant"]);
    styleHeaderRow(hS);
    Object.entries(r.byStatus).forEach(([s, v]) => ws.addRow([INVOICE_STATUS_FR[s] || s, v.count, v.amount]));

    if (r.overdueList.length) {
      ws.addRow([]);
      const h4 = ws.addRow(["Référence", "Client", "Échéance", "Restant dû"]);
      styleHeaderRow(h4);
      r.overdueList.forEach((o) => ws.addRow([o.reference, o.clientName, o.dueDate || "—", o.outstanding]));
    }

    await sendXlsx(res, wb, `rapport-finance-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// VENTES — Commandes, proformas, pipeline opportunités
// ════════════════════════════════════════════════════════════════

async function buildSalesReport(period: { from: Date; to: Date }) {
  const { from, to } = period;
  const orders = await db.select().from(ordersTable).where(and(isNull(ordersTable.deletedAt), gte(ordersTable.createdAt, from), lte(ordersTable.createdAt, to)));
  const proformas = await db.select().from(proformasTable).where(and(gte(proformasTable.createdAt, from), lte(proformasTable.createdAt, to)));
  const invoicesAll = await db.select().from(invoicesTable);

  const ordersAmount = orders.reduce((s, o) => s + num(o.totalAmount), 0);
  const proformasAmount = proformas.reduce((s, p) => s + num(p.totalAmount), 0);
  const convertedProformaIds = new Set(invoicesAll.filter((i) => i.proformaId).map((i) => i.proformaId as string));
  const proformasConverted = proformas.filter((p) => convertedProformaIds.has(p.id)).length;

  const clients = await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable);
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));

  const byClient: Record<string, { id: string; name: string; amount: number; count: number }> = {};
  for (const o of orders) {
    if (!o.clientId) continue;
    if (!byClient[o.clientId]) byClient[o.clientId] = { id: o.clientId, name: clientNames.get(o.clientId) || "—", amount: 0, count: 0 };
    byClient[o.clientId].amount += num(o.totalAmount);
    byClient[o.clientId].count += 1;
  }
  const topClients = Object.values(byClient).sort((a, b) => b.amount - a.amount).slice(0, 5);

  // Évolution mensuelle commandes (12 mois)
  const allOrders = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));
  const monthOrders: Record<string, { count: number; amount: number }> = {};
  for (const o of allOrders) {
    const k = monthKey(o.createdAt);
    if (!k) continue;
    if (!monthOrders[k]) monthOrders[k] = { count: 0, amount: 0 };
    monthOrders[k].count += 1;
    monthOrders[k].amount += num(o.totalAmount);
  }
  const series: Array<{ month: string; count: number; amount: number }> = [];
  const baseDate = new Date(to.getFullYear(), to.getMonth(), 1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
    const k = monthKey(d);
    series.push({
      month: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      count: monthOrders[k]?.count || 0,
      amount: Math.round(monthOrders[k]?.amount || 0),
    });
  }

  // Pipeline opportunités (état actuel — non filtré sur période)
  const opps = await db.select().from(opportunitiesTable).where(isNull(opportunitiesTable.deletedAt));
  const pipeline: Record<string, { count: number; value: number }> = {};
  for (const op of opps) {
    const k = op.stage || "lead";
    if (!pipeline[k]) pipeline[k] = { count: 0, value: 0 };
    pipeline[k].count += 1;
    pipeline[k].value += num(op.value);
  }
  const pipelineTotalValue = Object.values(pipeline).reduce((s, v) => s + v.value, 0);

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    kpi: {
      ordersCount: orders.length,
      ordersAmount,
      proformasCount: proformas.length,
      proformasAmount,
      proformasConverted,
      conversionRate: proformas.length > 0 ? Math.round((proformasConverted / proformas.length) * 100) : 0,
      pipelineCount: opps.length,
      pipelineValue: pipelineTotalValue,
    },
    series,
    topClients,
    pipeline,
  };
}

router.get("/reports/sales", requireAuth, async (req, res, next) => {
  try { res.json(await buildSalesReport(parsePeriod(req))); } catch (e) { next(e); }
});

router.get("/reports/sales/export.xlsx", requireAuth, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const r = await buildSalesReport(period);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Ventes");
    applyExcelBranding(ws, "Rapport Ventes", period);
    ws.columns = [{ width: 36 }, { width: 22 }, { width: 22 }, { width: 22 }];
    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Indicateur", "Valeur"]));
    [
      ["Commandes (nombre)", String(r.kpi.ordersCount)],
      ["Commandes (montant)", formatFCFA(r.kpi.ordersAmount)],
      ["Proformas émises", String(r.kpi.proformasCount)],
      ["Proformas converties en facture", String(r.kpi.proformasConverted)],
      ["Taux de conversion proforma → facture", `${r.kpi.conversionRate} %`],
      ["Pipeline opportunités (valeur)", formatFCFA(r.kpi.pipelineValue)],
    ].forEach((l) => ws.addRow(l));

    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Évolution mensuelle", "Commandes", "Montant"]));
    r.series.forEach((s) => ws.addRow([s.month, s.count, s.amount]));

    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Top clients", "Commandes", "Montant"]));
    r.topClients.forEach((c) => ws.addRow([c.name, c.count, c.amount]));

    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Pipeline (étape)", "Opportunités", "Valeur potentielle"]));
    Object.entries(r.pipeline).forEach(([stage, v]) => ws.addRow([PIPELINE_STAGE_FR[stage] || stage, v.count, Math.round(v.value)]));

    await sendXlsx(res, wb, `rapport-ventes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// PROJETS — Portefeuille, retards, marges
// ════════════════════════════════════════════════════════════════

async function buildProjectsReport(period: { from: Date; to: Date }) {
  const { from, to } = period;
  const allProjects = await db.select().from(projectsTable).where(isNull(projectsTable.deletedAt));
  const todayStr = new Date().toISOString().slice(0, 10);

  const totalCount = allProjects.length;
  const byStatus: Record<string, number> = {};
  for (const p of allProjects) byStatus[p.status] = (byStatus[p.status] || 0) + 1;

  const active = allProjects.filter((p) => p.status !== "completed" && p.status !== "cancelled");
  const overdue = active.filter((p) => p.endDate && p.endDate < todayStr);
  const totalBudget = allProjects.reduce((s, p) => s + num(p.budget), 0);
  const activeBudget = active.reduce((s, p) => s + num(p.budget), 0);
  const avgProgress = active.length > 0 ? Math.round(active.reduce((s, p) => s + (p.progress || 0), 0) / active.length) : 0;

  // Projets créés ou clôturés dans la période
  const newInPeriod = allProjects.filter((p) => {
    const d = new Date(p.createdAt);
    return d >= from && d <= to;
  });
  const completedInPeriod = allProjects.filter((p) => {
    if (p.status !== "completed") return false;
    const d = new Date(p.updatedAt);
    return d >= from && d <= to;
  });

  const clients = await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable);
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));

  const topProjects = [...allProjects]
    .sort((a, b) => num(b.budget) - num(a.budget))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      progress: p.progress || 0,
      budget: num(p.budget),
      clientName: p.clientId ? clientNames.get(p.clientId) || "—" : "—",
      endDate: p.endDate,
    }));

  const overdueList = overdue
    .map((p) => ({
      id: p.id,
      name: p.name,
      endDate: p.endDate,
      progress: p.progress || 0,
      clientName: p.clientId ? clientNames.get(p.clientId) || "—" : "—",
    }))
    .sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""))
    .slice(0, 10);

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    kpi: {
      totalCount,
      activeCount: active.length,
      overdueCount: overdue.length,
      newInPeriod: newInPeriod.length,
      completedInPeriod: completedInPeriod.length,
      totalBudget,
      activeBudget,
      avgProgress,
    },
    byStatus,
    topProjects,
    overdueList,
  };
}

router.get("/reports/projects", requireAuth, async (req, res, next) => {
  try { res.json(await buildProjectsReport(parsePeriod(req))); } catch (e) { next(e); }
});

router.get("/reports/projects/export.xlsx", requireAuth, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const r = await buildProjectsReport(period);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Projets");
    applyExcelBranding(ws, "Rapport Projets", period);
    ws.columns = [{ width: 36 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];
    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Indicateur", "Valeur"]));
    [
      ["Projets (total)", String(r.kpi.totalCount)],
      ["Projets actifs", String(r.kpi.activeCount)],
      ["Projets en retard", String(r.kpi.overdueCount)],
      ["Créés sur la période", String(r.kpi.newInPeriod)],
      ["Clôturés sur la période", String(r.kpi.completedInPeriod)],
      ["Budget cumulé", formatFCFA(r.kpi.totalBudget)],
      ["Budget actif", formatFCFA(r.kpi.activeBudget)],
      ["Avancement moyen", `${r.kpi.avgProgress} %`],
    ].forEach((l) => ws.addRow(l));

    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Statut", "Nombre"]));
    Object.entries(r.byStatus).forEach(([s, c]) => ws.addRow([PROJECT_STATUS_FR[s] || s, c]));

    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Projet", "Client", "Statut", "Avancement", "Budget"]));
    r.topProjects.forEach((p) => ws.addRow([p.name, p.clientName, PROJECT_STATUS_FR[p.status] || p.status, `${p.progress} %`, p.budget]));

    if (r.overdueList.length) {
      ws.addRow([]);
      styleHeaderRow(ws.addRow(["Projets en retard", "Client", "Échéance", "Avancement"]));
      r.overdueList.forEach((p) => ws.addRow([p.name, p.clientName, p.endDate || "—", `${p.progress} %`]));
    }

    await sendXlsx(res, wb, `rapport-projets-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// RH — Effectifs, présence, anomalies
// ════════════════════════════════════════════════════════════════

async function buildHrReport(period: { from: Date; to: Date }) {
  const { from, to } = period;
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);

  const collaborators = await db.select().from(collaboratorsTable).where(isNull(collaboratorsTable.deletedAt));
  const total = collaborators.length;
  const active = collaborators.filter((c) => c.employmentStatus === "active").length;
  const onLeave = collaborators.filter((c) => c.employmentStatus === "on_leave").length;
  const terminated = collaborators.filter((c) => c.employmentStatus === "terminated").length;

  // Sessions de pointage sur la période
  const sessions = await db
    .select()
    .from(attendanceSessionsTable)
    .where(and(gte(attendanceSessionsTable.workDate, fromDate), lte(attendanceSessionsTable.workDate, toDate)));

  const totalMinutes = sessions.reduce((s, x) => s + (x.effectiveMinutes || 0), 0);
  const lateCount = sessions.filter((s) => s.isLate).length;
  const earlyLeaveCount = sessions.filter((s) => s.isEarlyLeave).length;
  const distinctCollabs = new Set(sessions.map((s) => s.collaboratorId)).size;

  // Anomalies présence
  const flags = await db
    .select()
    .from(attendanceFlagsTable)
    .where(and(gte(attendanceFlagsTable.workDate, fromDate), lte(attendanceFlagsTable.workDate, toDate)));
  const flagsByKind: Record<string, number> = {};
  for (const f of flags) flagsByKind[f.kind] = (flagsByKind[f.kind] || 0) + 1;
  const unresolvedFlags = flags.filter((f) => !f.isResolved).length;

  // Top heures pointées
  const minutesByCollab: Record<string, number> = {};
  for (const s of sessions) minutesByCollab[s.collaboratorId] = (minutesByCollab[s.collaboratorId] || 0) + (s.effectiveMinutes || 0);
  const collabNames = new Map(collaborators.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
  const topPerformers = Object.entries(minutesByCollab)
    .map(([id, minutes]) => ({ id, name: collabNames.get(id) || "—", hours: +(minutes / 60).toFixed(1), minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  // Répartition par département (effectifs actifs)
  const departments = await db.select().from(departmentsTable);
  const deptNames = new Map(departments.map((d) => [d.id, d.name]));
  const byDepartment: Record<string, number> = {};
  for (const c of collaborators) {
    if (c.employmentStatus !== "active") continue;
    const k = (c.departmentId && deptNames.get(c.departmentId)) || c.department || "Non assigné";
    byDepartment[k] = (byDepartment[k] || 0) + 1;
  }

  // Contrats expirants dans 60 jours
  const horizon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expiringContracts = await db
    .select()
    .from(contractsTable)
    .where(and(eq(contractsTable.status, "active"), isNotNull(contractsTable.endDate), lte(contractsTable.endDate, horizon)));
  const expiringList = expiringContracts.slice(0, 10).map((c) => ({
    id: c.id,
    collaborator: collabNames.get(c.collaboratorId) || "—",
    type: c.type,
    endDate: c.endDate,
    jobTitle: c.jobTitle,
  }));

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    kpi: {
      total,
      active,
      onLeave,
      terminated,
      totalHours: Math.round(totalMinutes / 60),
      distinctCollabs,
      lateCount,
      earlyLeaveCount,
      unresolvedFlags,
      flagsTotal: flags.length,
      expiringContracts: expiringContracts.length,
    },
    flagsByKind,
    topPerformers,
    byDepartment,
    expiringList,
  };
}

router.get("/reports/hr", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try { res.json(await buildHrReport(parsePeriod(req))); } catch (e) { next(e); }
});

router.get("/reports/hr/export.xlsx", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const r = await buildHrReport(period);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("RH");
    applyExcelBranding(ws, "Rapport RH", period);
    ws.columns = [{ width: 36 }, { width: 22 }, { width: 22 }, { width: 22 }];
    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Indicateur", "Valeur"]));
    [
      ["Effectif total", String(r.kpi.total)],
      ["Actifs", String(r.kpi.active)],
      ["En congé", String(r.kpi.onLeave)],
      ["Sortis", String(r.kpi.terminated)],
      ["Heures pointées (période)", String(r.kpi.totalHours)],
      ["Collaborateurs ayant pointé", String(r.kpi.distinctCollabs)],
      ["Retards", String(r.kpi.lateCount)],
      ["Départs anticipés", String(r.kpi.earlyLeaveCount)],
      ["Anomalies non résolues", String(r.kpi.unresolvedFlags)],
      ["Contrats expirants ≤ 60 j", String(r.kpi.expiringContracts)],
    ].forEach((l) => ws.addRow(l));

    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Département", "Effectif actif"]));
    Object.entries(r.byDepartment).forEach(([d, n]) => ws.addRow([d, n]));

    ws.addRow([]);
    styleHeaderRow(ws.addRow(["Top collaborateurs", "Heures pointées"]));
    r.topPerformers.forEach((p) => ws.addRow([p.name, p.hours]));

    if (r.expiringList.length) {
      ws.addRow([]);
      styleHeaderRow(ws.addRow(["Contrat expirant", "Type", "Échéance", "Poste"]));
      r.expiringList.forEach((c) => ws.addRow([c.collaborator, CONTRACT_TYPE_FR[c.type?.toLowerCase()] || c.type, c.endDate || "—", c.jobTitle || "—"]));
    }

    await sendXlsx(res, wb, `rapport-rh-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// VUE D'ENSEMBLE — agrégat compact pour le tableau de bord rapports
// ════════════════════════════════════════════════════════════════

router.get("/reports/overview", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const [finance, sales, projects, hr] = await Promise.all([
      buildFinanceReport(period),
      buildSalesReport(period),
      buildProjectsReport(period),
      buildHrReport(period),
    ]);
    res.json({
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      finance: { kpi: finance.kpi, series: finance.series.slice(-6) },
      sales: { kpi: sales.kpi, series: sales.series.slice(-6) },
      projects: { kpi: projects.kpi },
      hr: { kpi: hr.kpi },
    });
  } catch (e) { next(e); }
});

export default router;
