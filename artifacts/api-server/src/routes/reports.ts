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
  payslipsTable,
  payrollRunsTable,
  personnelMovementsTable,
  supplierInvoicesTable,
  suppliersTable,
  supplierPaymentsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  chartOfAccountsTable,
  bankAccountsTable,
  bankTransactionsTable,
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

// ════════════════════════════════════════════════════════════════
// MASSE SALARIALE — détail par mois / département
// ════════════════════════════════════════════════════════════════

router.get("/reports/hr/masse-salariale", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const orgId = req.authUser!.organizationId;

    // Cycles de paie sur la période
    const runs = await db.select({ id: payrollRunsTable.id, period: payrollRunsTable.period })
      .from(payrollRunsTable)
      .where(and(
        eq(payrollRunsTable.organizationId, orgId),
        gte(payrollRunsTable.period, period.from.toISOString().slice(0, 7)),
        lte(payrollRunsTable.period, period.to.toISOString().slice(0, 7)),
      ))
      .orderBy(payrollRunsTable.period);

    if (runs.length === 0) {
      res.json({ period: { from: period.fromIso, to: period.toIso }, byMonth: [], byDepartment: [], kpi: { totalGross: 0, totalNet: 0, totalCnssEmployer: 0, totalIrpp: 0, employeeCount: 0 } });
      return;
    }

    const runIds = runs.map(r => r.id);

    const payslips = await db.select({
      period: payslipsTable.period,
      grossSalary: payslipsTable.grossSalary,
      netSalary: payslipsTable.netSalary,
      cnssEmployee: payslipsTable.cnssEmployee,
      cnssEmployer: payslipsTable.cnssEmployer,
      irpp: payslipsTable.irpp,
      ipts: payslipsTable.ipts,
      departmentId: collaboratorsTable.departmentId,
      deptName: departmentsTable.name,
    })
      .from(payslipsTable)
      .leftJoin(collaboratorsTable, eq(payslipsTable.collaboratorId, collaboratorsTable.id))
      .leftJoin(departmentsTable, eq(collaboratorsTable.departmentId, departmentsTable.id))
      .where(and(
        eq(payslipsTable.organizationId, orgId),
        inArray(payslipsTable.payrollRunId, runIds),
      ));

    const byMonth: Record<string, { period: string; gross: number; net: number; cnssEmployer: number; irpp: number; count: number }> = {};
    const byDept: Record<string, { department: string; gross: number; net: number; count: number }> = {};

    let totalGross = 0, totalNet = 0, totalCnssEmployer = 0, totalIrpp = 0;

    for (const p of payslips) {
      const mo = p.period ?? "—";
      const gross = num(p.grossSalary), net = num(p.netSalary), cnssEr = num(p.cnssEmployer), ir = num(p.irpp);
      totalGross += gross; totalNet += net; totalCnssEmployer += cnssEr; totalIrpp += ir;

      if (!byMonth[mo]) byMonth[mo] = { period: mo, gross: 0, net: 0, cnssEmployer: 0, irpp: 0, count: 0 };
      byMonth[mo].gross += gross;
      byMonth[mo].net += net;
      byMonth[mo].cnssEmployer += cnssEr;
      byMonth[mo].irpp += ir;
      byMonth[mo].count++;

      const dname = p.deptName ?? "Sans département";
      if (!byDept[dname]) byDept[dname] = { department: dname, gross: 0, net: 0, count: 0 };
      byDept[dname].gross += gross;
      byDept[dname].net += net;
      byDept[dname].count++;
    }

    res.json({
      period: { from: period.fromIso, to: period.toIso },
      byMonth: Object.values(byMonth).sort((a, b) => a.period.localeCompare(b.period)),
      byDepartment: Object.values(byDept).sort((a, b) => b.gross - a.gross),
      kpi: { totalGross, totalNet, totalCnssEmployer, totalIrpp, employeeCount: payslips.length },
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// TURNOVER — entrées / sorties / taux
// ════════════════════════════════════════════════════════════════

router.get("/reports/hr/turnover", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const orgId = req.authUser!.organizationId;
    const fromDate = period.from.toISOString().slice(0, 10);
    const toDate = period.to.toISOString().slice(0, 10);

    const [collabs, movements] = await Promise.all([
      db.select({ id: collaboratorsTable.id, status: collaboratorsTable.status, employmentStatus: collaboratorsTable.employmentStatus })
        .from(collaboratorsTable).where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt))),
      db.select().from(personnelMovementsTable)
        .where(and(
          eq(personnelMovementsTable.organizationId, orgId),
          gte(personnelMovementsTable.effectiveDate, fromDate),
          lte(personnelMovementsTable.effectiveDate, toDate),
        )).orderBy(personnelMovementsTable.effectiveDate),
    ]);

    const totalEffectif = collabs.length;
    const exits = movements.filter(m => ["departure", "retirement"].includes(m.type));
    const entries = movements.filter(m => m.type === "mutation" || m.type === "promotion"); // no hire type

    const byType: Record<string, number> = {};
    for (const m of movements) {
      byType[m.type] = (byType[m.type] ?? 0) + 1;
    }

    const turnoverRate = totalEffectif > 0 ? Math.round((exits.length / totalEffectif) * 100 * 10) / 10 : 0;

    res.json({
      period: { from: period.fromIso, to: period.toIso },
      kpi: {
        totalEffectif,
        exits: exits.length,
        entries: entries.length,
        turnoverRate,
        activeCount: collabs.filter(c => c.employmentStatus === "active" || c.status === "active").length,
      },
      byType,
      movements: movements.map(m => ({
        id: m.id,
        type: m.type,
        effectiveDate: m.effectiveDate,
        reason: m.reason,
      })),
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// BALANCE ÂGÉE — créances clients
// ════════════════════════════════════════════════════════════════

router.get("/reports/aged-receivables", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoices = await db.select({
      id: invoicesTable.id,
      referenceNumber: invoicesTable.referenceNumber,
      clientId: invoicesTable.clientId,
      clientName: clientsTable.name,
      status: invoicesTable.status,
      totalAmount: invoicesTable.totalAmount,
      paidAmount: invoicesTable.paidAmount,
      dueDate: invoicesTable.dueDate,
      issuedAt: invoicesTable.issuedAt,
    })
      .from(invoicesTable)
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(and(
        eq(invoicesTable.organizationId, orgId),
        inArray(invoicesTable.status, ["pending", "overdue", "partially_paid"]),
      ));

    // Calcul des tranches
    const buckets = {
      current: { label: "Courant (non échu)", amount: 0, count: 0, items: [] as any[] },
      "1-30": { label: "1 – 30 jours", amount: 0, count: 0, items: [] as any[] },
      "31-60": { label: "31 – 60 jours", amount: 0, count: 0, items: [] as any[] },
      "61-90": { label: "61 – 90 jours", amount: 0, count: 0, items: [] as any[] },
      "90+": { label: "+ 90 jours", amount: 0, count: 0, items: [] as any[] },
    };

    let totalOutstanding = 0;

    for (const inv of invoices) {
      const outstanding = num(inv.totalAmount) - num(inv.paidAmount);
      if (outstanding <= 0) continue;
      totalOutstanding += outstanding;

      const dueDateStr = inv.dueDate ?? inv.issuedAt;
      let daysOverdue = 0;
      if (dueDateStr) {
        const due = new Date(dueDateStr);
        due.setHours(0, 0, 0, 0);
        daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      }

      const item = { id: inv.id, reference: inv.referenceNumber, client: inv.clientName ?? "—", outstanding, dueDate: inv.dueDate, daysOverdue };

      let bucket: keyof typeof buckets;
      if (daysOverdue <= 0) bucket = "current";
      else if (daysOverdue <= 30) bucket = "1-30";
      else if (daysOverdue <= 60) bucket = "31-60";
      else if (daysOverdue <= 90) bucket = "61-90";
      else bucket = "90+";

      buckets[bucket].amount += outstanding;
      buckets[bucket].count++;
      buckets[bucket].items.push(item);
    }

    // Balance âgée par client
    const byClient: Record<string, { client: string; total: number; buckets: Record<string, number> }> = {};
    for (const [key, bucket] of Object.entries(buckets)) {
      for (const item of bucket.items) {
        const c = item.client;
        if (!byClient[c]) byClient[c] = { client: c, total: 0, buckets: { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } };
        byClient[c].total += item.outstanding;
        byClient[c].buckets[key] = (byClient[c].buckets[key] ?? 0) + item.outstanding;
      }
    }

    res.json({
      totalOutstanding,
      buckets: Object.entries(buckets).map(([key, b]) => ({
        key,
        label: b.label,
        amount: b.amount,
        count: b.count,
        percent: totalOutstanding > 0 ? Math.round((b.amount / totalOutstanding) * 100) : 0,
      })),
      byClient: Object.values(byClient).sort((a, b) => b.total - a.total).slice(0, 20),
      detail: Object.entries(buckets).flatMap(([bucket, b]) =>
        b.items.map(i => ({ ...i, bucket }))
      ).sort((a, b) => b.daysOverdue - a.daysOverdue),
    });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// Rapport Achats / Fournisseurs
// ────────────────────────────────────────────────────────────────
router.get("/reports/purchases", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to, fromIso, toIso } = parsePeriod(req);
    const fromDate = fromIso;
    const toDate = toIso;

    const invoices = await db
      .select({
        id: supplierInvoicesTable.id,
        supplierId: supplierInvoicesTable.supplierId,
        supplierName: suppliersTable.name,
        totalAmount: supplierInvoicesTable.totalAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        status: supplierInvoicesTable.status,
        invoiceDate: supplierInvoicesTable.invoiceDate,
        dueDate: supplierInvoicesTable.dueDate,
        taxAmount: supplierInvoicesTable.taxAmount,
      })
      .from(supplierInvoicesTable)
      .leftJoin(suppliersTable, eq(supplierInvoicesTable.supplierId, suppliersTable.id))
      .where(
        and(
          eq(supplierInvoicesTable.organizationId, orgId),
          ne(supplierInvoicesTable.status, "cancelled"),
          ne(supplierInvoicesTable.status, "draft"),
          gte(supplierInvoicesTable.invoiceDate, fromDate),
          lte(supplierInvoicesTable.invoiceDate, toDate),
        )
      );

    // KPIs
    let totalAmount = 0, paidAmount = 0, overdueAmount = 0, overdueCount = 0, taxTotal = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const inv of invoices) {
      totalAmount += num(inv.totalAmount);
      paidAmount += num(inv.paidAmount);
      taxTotal += num(inv.taxAmount);
      const outstanding = num(inv.totalAmount) - num(inv.paidAmount);
      if (outstanding > 0 && inv.dueDate && inv.dueDate < today) {
        overdueAmount += outstanding;
        overdueCount++;
      }
    }
    const outstanding = totalAmount - paidAmount;

    // Série mensuelle (12 derniers mois, quel que soit le filtre de période)
    const allInvoices = await db
      .select({ invoiceDate: supplierInvoicesTable.invoiceDate, totalAmount: supplierInvoicesTable.totalAmount, paidAmount: supplierInvoicesTable.paidAmount })
      .from(supplierInvoicesTable)
      .where(and(eq(supplierInvoicesTable.organizationId, orgId), ne(supplierInvoicesTable.status, "cancelled"), ne(supplierInvoicesTable.status, "draft")));
    const monthMap: Record<string, { achat: number; paye: number }> = {};
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 11); cutoff.setDate(1);
    for (const inv of allInvoices) {
      if (!inv.invoiceDate) continue;
      const d = new Date(inv.invoiceDate);
      if (d < cutoff) continue;
      const key = inv.invoiceDate.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { achat: 0, paye: 0 };
      monthMap[key].achat += num(inv.totalAmount);
      monthMap[key].paye += num(inv.paidAmount);
    }
    const series = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    // Top fournisseurs
    const bySupplier: Record<string, { name: string; amount: number; count: number; paid: number }> = {};
    for (const inv of invoices) {
      const sid = inv.supplierId;
      if (!bySupplier[sid]) bySupplier[sid] = { name: inv.supplierName || "—", amount: 0, count: 0, paid: 0 };
      bySupplier[sid].amount += num(inv.totalAmount);
      bySupplier[sid].count++;
      bySupplier[sid].paid += num(inv.paidAmount);
    }
    const topSuppliers = Object.entries(bySupplier)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Répartition par statut
    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const inv of invoices) {
      if (!byStatus[inv.status]) byStatus[inv.status] = { count: 0, amount: 0 };
      byStatus[inv.status].count++;
      byStatus[inv.status].amount += num(inv.totalAmount);
    }

    // Liste des factures en retard
    const overdueList = invoices
      .filter(inv => {
        const outstanding = num(inv.totalAmount) - num(inv.paidAmount);
        return outstanding > 0 && inv.dueDate && inv.dueDate < today;
      })
      .sort((a, b) => num(b.totalAmount) - num(b.paidAmount) - (num(a.totalAmount) - num(a.paidAmount)))
      .slice(0, 10)
      .map(inv => ({
        id: inv.id,
        supplier: inv.supplierName || "—",
        dueDate: inv.dueDate,
        outstanding: num(inv.totalAmount) - num(inv.paidAmount),
        status: inv.status,
      }));

    res.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      kpi: {
        totalAmount, paidAmount, outstanding, overdueAmount, overdueCount,
        taxTotal, invoiceCount: invoices.length,
        paymentRate: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0,
      },
      series,
      topSuppliers,
      byStatus,
      overdueList,
    });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// Compte de résultat (Income Statement) depuis les écritures
// ────────────────────────────────────────────────────────────────
router.get("/reports/finance/income-statement", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { fromIso, toIso } = parsePeriod(req);

    // Toutes les lignes d'écritures VALIDÉES de la période
    const lines = await db
      .select({
        classNum: chartOfAccountsTable.classNum,
        accountLabel: chartOfAccountsTable.label,
        accountCode: chartOfAccountsTable.code,
        debit: journalEntryLinesTable.debit,
        credit: journalEntryLinesTable.credit,
        entryDate: journalEntriesTable.entryDate,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
      .where(
        and(
          eq(journalEntriesTable.organizationId, orgId),
          eq(journalEntriesTable.status, "posted"),
          gte(journalEntriesTable.entryDate, fromIso),
          lte(journalEntriesTable.entryDate, toIso),
        )
      );

    // Produits (classe 7) : solde = credit - debit
    // Charges (classe 6) : solde = debit - credit
    const revenueByAccount: Record<string, { code: string; label: string; amount: number }> = {};
    const expenseByAccount: Record<string, { code: string; label: string; amount: number }> = {};
    const monthMap: Record<string, { revenue: number; expense: number }> = {};

    for (const line of lines) {
      const d = num(line.debit);
      const c = num(line.credit);
      const month = (line.entryDate || "").slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { revenue: 0, expense: 0 };

      if (line.classNum === 7) {
        const bal = c - d;
        const key = line.accountCode;
        if (!revenueByAccount[key]) revenueByAccount[key] = { code: line.accountCode, label: line.accountLabel, amount: 0 };
        revenueByAccount[key].amount += bal;
        monthMap[month].revenue += bal;
      } else if (line.classNum === 6) {
        const bal = d - c;
        const key = line.accountCode;
        if (!expenseByAccount[key]) expenseByAccount[key] = { code: line.accountCode, label: line.accountLabel, amount: 0 };
        expenseByAccount[key].amount += bal;
        monthMap[month].expense += bal;
      }
    }

    const revenues = Object.values(revenueByAccount).filter(r => r.amount !== 0).sort((a, b) => b.amount - a.amount);
    const expenses = Object.values(expenseByAccount).filter(e => e.amount !== 0).sort((a, b) => b.amount - a.amount);
    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const netResult = totalRevenue - totalExpense;
    const series = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, revenue: v.revenue, expense: v.expense, result: v.revenue - v.expense }));

    res.json({ revenues, expenses, totalRevenue, totalExpense, netResult, series, hasData: lines.length > 0 });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// Bilan simplifié (Balance Sheet) depuis les écritures
// ────────────────────────────────────────────────────────────────
router.get("/reports/finance/balance-sheet", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { toIso } = parsePeriod(req);

    // Toutes les lignes VALIDÉES jusqu'à la date "to" (bilan = cumulatif)
    const lines = await db
      .select({
        classNum: chartOfAccountsTable.classNum,
        accountCode: chartOfAccountsTable.code,
        accountLabel: chartOfAccountsTable.label,
        accountType: chartOfAccountsTable.type,
        normalBalance: chartOfAccountsTable.normalBalance,
        debit: journalEntryLinesTable.debit,
        credit: journalEntryLinesTable.credit,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
      .where(
        and(
          eq(journalEntriesTable.organizationId, orgId),
          eq(journalEntriesTable.status, "posted"),
          lte(journalEntriesTable.entryDate, toIso),
        )
      );

    // Soldes par compte (débit - crédit pour actif normal, crédit - débit pour passif normal)
    const accountBal: Record<string, { code: string; label: string; classNum: number; type: string; normalBalance: string; balance: number }> = {};
    for (const line of lines) {
      const key = line.accountCode;
      if (!accountBal[key]) {
        accountBal[key] = { code: key, label: line.accountLabel, classNum: line.classNum, type: line.accountType, normalBalance: line.normalBalance, balance: 0 };
      }
      // Solde = débit - crédit (positif si solde débiteur)
      accountBal[key].balance += num(line.debit) - num(line.credit);
    }

    const accounts = Object.values(accountBal);

    // ACTIF : classe 2 (immobilisations), 3 (stocks), 4 débiteurs (créances), 5 (trésorerie)
    const fixedAssets = accounts.filter(a => a.classNum === 2 && a.balance > 0);
    const stocks = accounts.filter(a => a.classNum === 3 && a.balance > 0);
    const receivables = accounts.filter(a => a.classNum === 4 && a.balance > 0); // solde débiteur = créances
    const treasury = accounts.filter(a => a.classNum === 5 && a.balance > 0);
    const totalAssets = [...fixedAssets, ...stocks, ...receivables, ...treasury].reduce((s, a) => s + a.balance, 0);

    // PASSIF : classe 1 (capitaux + emprunts), 4 créditeurs (dettes fournisseurs)
    const equity = accounts.filter(a => a.classNum === 1 && a.balance < 0).map(a => ({ ...a, balance: -a.balance }));
    const payables = accounts.filter(a => a.classNum === 4 && a.balance < 0).map(a => ({ ...a, balance: -a.balance })); // solde créditeur = dettes
    const totalLiabilities = [...equity, ...payables].reduce((s, a) => s + a.balance, 0);

    res.json({
      assets: {
        fixedAssets: fixedAssets.sort((a, b) => b.balance - a.balance).slice(0, 10),
        stocks: stocks.sort((a, b) => b.balance - a.balance).slice(0, 10),
        receivables: receivables.sort((a, b) => b.balance - a.balance).slice(0, 10),
        treasury: treasury.sort((a, b) => b.balance - a.balance).slice(0, 10),
        total: totalAssets,
      },
      liabilities: {
        equity: equity.sort((a, b) => b.balance - a.balance).slice(0, 10),
        payables: payables.sort((a, b) => b.balance - a.balance).slice(0, 10),
        total: totalLiabilities,
      },
      balance: totalAssets - totalLiabilities,
      hasData: lines.length > 0,
    });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// Balance âgée fournisseurs
// ────────────────────────────────────────────────────────────────
router.get("/reports/aged-payables", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const supplierSearch = typeof req.query.supplier === "string" ? req.query.supplier.toLowerCase() : "";
    const statusFilter = typeof req.query.status === "string" ? req.query.status : "";

    const invoices = await db
      .select({
        id: supplierInvoicesTable.id,
        referenceNumber: supplierInvoicesTable.referenceNumber,
        supplierId: supplierInvoicesTable.supplierId,
        supplierName: suppliersTable.name,
        totalAmount: supplierInvoicesTable.totalAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        dueDate: supplierInvoicesTable.dueDate,
        invoiceDate: supplierInvoicesTable.invoiceDate,
        status: supplierInvoicesTable.status,
      })
      .from(supplierInvoicesTable)
      .leftJoin(suppliersTable, eq(supplierInvoicesTable.supplierId, suppliersTable.id))
      .where(
        and(
          eq(supplierInvoicesTable.organizationId, orgId),
          ne(supplierInvoicesTable.status, "cancelled"),
          ne(supplierInvoicesTable.status, "paid"),
          ne(supplierInvoicesTable.status, "draft"),
        )
      );

    const buckets = {
      current:  { label: "À échoir",  amount: 0, count: 0, items: [] as any[] },
      "1-30":   { label: "1–30 j",    amount: 0, count: 0, items: [] as any[] },
      "31-60":  { label: "31–60 j",   amount: 0, count: 0, items: [] as any[] },
      "61-90":  { label: "61–90 j",   amount: 0, count: 0, items: [] as any[] },
      "90+":    { label: "> 90 j",    amount: 0, count: 0, items: [] as any[] },
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let totalOutstanding = 0;

    for (const inv of invoices) {
      if (supplierSearch && !(inv.supplierName ?? "").toLowerCase().includes(supplierSearch)) continue;
      if (statusFilter && inv.status !== statusFilter) continue;
      const outstanding = num(inv.totalAmount) - num(inv.paidAmount);
      if (outstanding <= 0) continue;
      totalOutstanding += outstanding;

      const dueDateStr = inv.dueDate ?? inv.invoiceDate;
      let daysOverdue = 0;
      if (dueDateStr) {
        const due = new Date(dueDateStr);
        due.setHours(0, 0, 0, 0);
        daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      }

      const item = {
        id: inv.id,
        reference: inv.referenceNumber,
        supplier: inv.supplierName ?? "—",
        outstanding,
        dueDate: inv.dueDate,
        daysOverdue,
        status: inv.status,
      };

      let bucket: keyof typeof buckets;
      if (daysOverdue <= 0)       bucket = "current";
      else if (daysOverdue <= 30) bucket = "1-30";
      else if (daysOverdue <= 60) bucket = "31-60";
      else if (daysOverdue <= 90) bucket = "61-90";
      else                        bucket = "90+";

      buckets[bucket].amount += outstanding;
      buckets[bucket].count++;
      buckets[bucket].items.push(item);
    }

    // Par fournisseur
    const bySupplier: Record<string, { supplier: string; total: number }> = {};
    for (const [, bucket] of Object.entries(buckets)) {
      for (const item of bucket.items) {
        const s = item.supplier;
        if (!bySupplier[s]) bySupplier[s] = { supplier: s, total: 0 };
        bySupplier[s].total += item.outstanding;
      }
    }

    res.json({
      totalOutstanding,
      buckets: Object.entries(buckets).map(([key, b]) => ({
        key, label: b.label, amount: b.amount, count: b.count,
        percent: totalOutstanding > 0 ? Math.round((b.amount / totalOutstanding) * 100) : 0,
      })),
      bySupplier: Object.values(bySupplier).sort((a, b) => b.total - a.total).slice(0, 20),
      detail: Object.entries(buckets)
        .flatMap(([bucket, b]) => b.items.map(i => ({ ...i, bucket })))
        .sort((a, b) => b.daysOverdue - a.daysOverdue),
    });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// Tableau des flux de trésorerie (méthode indirecte)
// ────────────────────────────────────────────────────────────────
router.get("/reports/finance/cash-flow", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { fromIso, toIso } = parsePeriod(req);

    // Toutes les lignes postées jusqu'à "to" pour balances cumulatives
    const allPostedLines = await db
      .select({
        classNum: chartOfAccountsTable.classNum,
        accountCode: chartOfAccountsTable.code,
        accountLabel: chartOfAccountsTable.label,
        accountType: chartOfAccountsTable.type,
        debit: journalEntryLinesTable.debit,
        credit: journalEntryLinesTable.credit,
        entryDate: journalEntriesTable.entryDate,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
      .where(and(eq(journalEntriesTable.organizationId, orgId), eq(journalEntriesTable.status, "posted")));

    // Lignes de la période uniquement
    const periodLines = allPostedLines.filter(l => l.entryDate >= fromIso && l.entryDate <= toIso);
    // Lignes avant la période (pour les soldes d'ouverture)
    const prevLines = allPostedLines.filter(l => l.entryDate < fromIso);

    // Calcule le solde net (débit - crédit) pour une liste de lignes filtrées par classe
    const netByClass = (lines: typeof allPostedLines, classes: number[]) => {
      let d = 0, c = 0;
      for (const l of lines) {
        if (classes.includes(l.classNum)) { d += num(l.debit); c += num(l.credit); }
      }
      return d - c; // positif = débiteur
    };

    // ── RÉSULTAT NET (classe 7 produits - classe 6 charges) ──────────
    const periodRevenue = netByClass(periodLines, [7]); // créditeur → négatif car débit-crédit
    const periodExpense = netByClass(periodLines, [6]); // débiteur → positif
    // Produits nets = crédit - débit (classe 7 normale credit)
    const revenues = periodLines.filter(l => l.classNum === 7).reduce((s, l) => s + num(l.credit) - num(l.debit), 0);
    const expenses = periodLines.filter(l => l.classNum === 6).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const netIncome = revenues - expenses;

    // ── AMORTISSEMENTS (classe 68 - dotations aux amortissements) ────
    const depreciation = periodLines.filter(l => l.accountCode?.startsWith("68")).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);

    // ── VARIATIONS BFR ───────────────────────────────────────────────
    // Class 3 (stocks): aug stocks = emploi cash (négatif), dim = source
    const stockStart = prevLines.filter(l => l.classNum === 3).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const stockEnd = allPostedLines.filter(l => l.classNum === 3 && l.entryDate <= toIso).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const stockChange = -(stockEnd - stockStart); // augmentation = négatif

    // Class 4 débiteur (créances clients): aug = emploi cash
    const arStart = prevLines.filter(l => l.classNum === 4).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const arEnd = allPostedLines.filter(l => l.classNum === 4 && l.entryDate <= toIso).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    // arStart/arEnd peuvent être positifs (créances) ou négatifs (dettes)
    const arChange = -(arEnd - arStart); // augmentation créances = négatif; augmentation dettes = positif

    const operatingCashFlow = netIncome + depreciation + stockChange + arChange;

    // ── INVESTISSEMENT (classe 2) ────────────────────────────────────
    const investStart = prevLines.filter(l => l.classNum === 2).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const investEnd = allPostedLines.filter(l => l.classNum === 2 && l.entryDate <= toIso).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const investingCashFlow = -(investEnd - investStart); // augmentation immos = sortie de tréso

    // ── FINANCEMENT (classe 1 sauf capitaux propres proprement dit) ──
    const finStart = prevLines.filter(l => l.classNum === 1).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const finEnd = allPostedLines.filter(l => l.classNum === 1 && l.entryDate <= toIso).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const financingCashFlow = -(finEnd - finStart); // augmentation dettes fin = entrée de tréso (signe inversé car solde passif)

    // ── TRÉSORERIE (classe 5) ────────────────────────────────────────
    const cashStart = prevLines.filter(l => l.classNum === 5).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const cashEnd = allPostedLines.filter(l => l.classNum === 5 && l.entryDate <= toIso).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const netCashChange = cashEnd - cashStart;

    // Série mensuelle des flux de trésorerie classe 5
    const monthMap: Record<string, number> = {};
    for (const l of periodLines.filter(ln => ln.classNum === 5)) {
      const m = (l.entryDate || "").slice(0, 7);
      if (!monthMap[m]) monthMap[m] = 0;
      monthMap[m] += num(l.debit) - num(l.credit);
    }
    const series = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, netFlow]) => ({ month, netFlow }));

    res.json({
      hasData: allPostedLines.length > 0,
      opening: {
        cashAndEquivalents: cashStart,
      },
      closing: {
        cashAndEquivalents: cashEnd,
      },
      operating: {
        netIncome,
        depreciation,
        workingCapitalChanges: {
          stocks: stockChange,
          receivablesAndPayables: arChange,
        },
        total: operatingCashFlow,
      },
      investing: {
        fixedAssetChanges: investingCashFlow,
        total: investingCashFlow,
      },
      financing: {
        debtChanges: financingCashFlow,
        total: financingCashFlow,
      },
      netCashChange,
      series,
    });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// Rapprochement bancaire
// ────────────────────────────────────────────────────────────────
router.get("/reports/finance/reconciliation", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { fromIso, toIso } = parsePeriod(req);

    // Comptes bancaires de l'organisation
    const accounts = await db
      .select({
        id: bankAccountsTable.id,
        name: bankAccountsTable.name,
        type: bankAccountsTable.type,
        bankName: bankAccountsTable.bankName,
        accountNumber: bankAccountsTable.accountNumber,
        openingBalance: bankAccountsTable.openingBalance,
        currency: bankAccountsTable.currency,
        isActive: bankAccountsTable.isActive,
      })
      .from(bankAccountsTable)
      .where(and(eq(bankAccountsTable.organizationId, orgId), eq(bankAccountsTable.isActive, true)));

    // Mouvements bancaires sur la période
    const transactions = await db
      .select({
        id: bankTransactionsTable.id,
        bankAccountId: bankTransactionsTable.bankAccountId,
        transactionDate: bankTransactionsTable.transactionDate,
        label: bankTransactionsTable.label,
        amount: bankTransactionsTable.amount,
        reference: bankTransactionsTable.reference,
        isReconciled: bankTransactionsTable.isReconciled,
        reconciledLineId: bankTransactionsTable.reconciledLineId,
      })
      .from(bankTransactionsTable)
      .where(
        and(
          eq(bankTransactionsTable.organizationId, orgId),
          gte(bankTransactionsTable.transactionDate, fromIso),
          lte(bankTransactionsTable.transactionDate, toIso),
        )
      );

    // Statistiques globales
    let totalReconciled = 0, totalUnreconciled = 0, reconciledCount = 0, unreconciledCount = 0;
    let totalDebits = 0, totalCredits = 0;
    for (const t of transactions) {
      const amt = num(t.amount);
      if (t.isReconciled) { totalReconciled += Math.abs(amt); reconciledCount++; }
      else { totalUnreconciled += Math.abs(amt); unreconciledCount++; }
      if (amt >= 0) totalCredits += amt;
      else totalDebits += Math.abs(amt);
    }

    // Par compte bancaire
    const byAccount: Record<string, {
      name: string; bankName: string | null; accountNumber: string | null;
      reconciledCount: number; unreconciledCount: number;
      reconciledAmount: number; unreconciledAmount: number;
      totalIn: number; totalOut: number;
    }> = {};
    for (const acc of accounts) {
      byAccount[acc.id] = {
        name: acc.name, bankName: acc.bankName, accountNumber: acc.accountNumber,
        reconciledCount: 0, unreconciledCount: 0, reconciledAmount: 0, unreconciledAmount: 0,
        totalIn: 0, totalOut: 0,
      };
    }
    for (const t of transactions) {
      if (!byAccount[t.bankAccountId]) continue;
      const ba = byAccount[t.bankAccountId];
      const amt = num(t.amount);
      if (t.isReconciled) { ba.reconciledCount++; ba.reconciledAmount += Math.abs(amt); }
      else { ba.unreconciledCount++; ba.unreconciledAmount += Math.abs(amt); }
      if (amt >= 0) ba.totalIn += amt;
      else ba.totalOut += Math.abs(amt);
    }

    // Transactions non rapprochées (liste détaillée)
    const unreconciledList = transactions
      .filter(t => !t.isReconciled)
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, 50)
      .map(t => ({
        id: t.id,
        bankAccountId: t.bankAccountId,
        bankAccountName: accounts.find(a => a.id === t.bankAccountId)?.name ?? "—",
        date: t.transactionDate,
        label: t.label,
        amount: num(t.amount),
        reference: t.reference,
      }));

    const reconciliationRate = transactions.length > 0
      ? Math.round((reconciledCount / transactions.length) * 100) : 100;

    res.json({
      period: { from: fromIso, to: toIso },
      accounts: accounts.map(a => ({ ...a, ...byAccount[a.id] })),
      kpi: {
        totalTransactions: transactions.length,
        reconciledCount, unreconciledCount, reconciliationRate,
        totalReconciled, totalUnreconciled,
        totalDebits, totalCredits,
      },
      unreconciledList,
      hasData: transactions.length > 0,
    });
  } catch (e) { next(e); }
});

// ────────────────────────────────────────────────────────────────
// Rapport de gestion (Management Report — enrichi)
// ────────────────────────────────────────────────────────────────
router.get("/reports/management", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { fromIso, toIso } = parsePeriod(req);

    // ── Période précédente (N-1 an) ──────────────────────────────────
    const fromDate = new Date(fromIso);
    const toDate   = new Date(toIso);
    const prevFrom = new Date(fromDate); prevFrom.setFullYear(prevFrom.getFullYear() - 1);
    const prevTo   = new Date(toDate);   prevTo.setFullYear(prevTo.getFullYear() - 1);
    const prevFromIso = prevFrom.toISOString().slice(0, 10);
    const prevToIso   = prevTo.toISOString().slice(0, 10);

    // ── Finance : écritures comptables (période + N-1) ───────────────
    const [allPeriodLines, prevPeriodLines] = await Promise.all([
      db.select({
        classNum: chartOfAccountsTable.classNum,
        accountCode: chartOfAccountsTable.code,
        accountLabel: chartOfAccountsTable.label,
        debit: journalEntryLinesTable.debit,
        credit: journalEntryLinesTable.credit,
        entryDate: journalEntriesTable.entryDate,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
      .where(and(
        eq(journalEntriesTable.organizationId, orgId),
        eq(journalEntriesTable.status, "posted"),
        gte(journalEntriesTable.entryDate, fromIso),
        lte(journalEntriesTable.entryDate, toIso),
      )),
      db.select({
        classNum: chartOfAccountsTable.classNum,
        debit: journalEntryLinesTable.debit,
        credit: journalEntryLinesTable.credit,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
      .where(and(
        eq(journalEntriesTable.organizationId, orgId),
        eq(journalEntriesTable.status, "posted"),
        gte(journalEntriesTable.entryDate, prevFromIso),
        lte(journalEntriesTable.entryDate, prevToIso),
      )),
    ]);

    // Agrégations P&L période courante
    const revenues = allPeriodLines.filter(l => l.classNum === 7).reduce((s, l) => s + num(l.credit) - num(l.debit), 0);
    const expenses = allPeriodLines.filter(l => l.classNum === 6).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const netResult = revenues - expenses;
    const depreciation = allPeriodLines.filter(l => l.accountCode?.startsWith("68")).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const ebitda = netResult + depreciation;
    const margin = revenues > 0 ? Math.round((netResult / revenues) * 1000) / 10 : 0;
    const grossProfit = revenues - allPeriodLines.filter(l => l.classNum === 6 && (l.accountCode?.startsWith("60") || l.accountCode?.startsWith("61") || l.accountCode?.startsWith("62"))).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const grossMargin = revenues > 0 ? Math.round((grossProfit / revenues) * 1000) / 10 : 0;
    const operatingExpenseRatio = revenues > 0 ? Math.round((expenses / revenues) * 1000) / 10 : 0;

    // Agrégations P&L période N-1
    const prevRevenues = prevPeriodLines.filter(l => l.classNum === 7).reduce((s, l) => s + num(l.credit) - num(l.debit), 0);
    const prevExpenses = prevPeriodLines.filter(l => l.classNum === 6).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const prevNetResult = prevRevenues - prevExpenses;
    const prevMargin = prevRevenues > 0 ? Math.round((prevNetResult / prevRevenues) * 1000) / 10 : 0;

    // Séries mensuelles
    const monthlyMap: Record<string, { revenues: number; expenses: number }> = {};
    for (const l of allPeriodLines) {
      const m = (l.entryDate || "").slice(0, 7);
      if (!monthlyMap[m]) monthlyMap[m] = { revenues: 0, expenses: 0 };
      if (l.classNum === 7) monthlyMap[m].revenues += num(l.credit) - num(l.debit);
      if (l.classNum === 6) monthlyMap[m].expenses += num(l.debit) - num(l.credit);
    }
    const series = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, revenues: v.revenues, expenses: v.expenses, netResult: v.revenues - v.expenses }));

    // Ventilation des charges par compte (top 10)
    const expenseByAccount: Record<string, { code: string; label: string; amount: number }> = {};
    for (const l of allPeriodLines.filter(ll => ll.classNum === 6)) {
      const k = l.accountCode ?? "??";
      if (!expenseByAccount[k]) expenseByAccount[k] = { code: l.accountCode ?? "", label: l.accountLabel ?? k, amount: 0 };
      expenseByAccount[k].amount += num(l.debit) - num(l.credit);
    }
    const expenseBreakdown = Object.values(expenseByAccount)
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(e => ({ ...e, percent: expenses > 0 ? Math.round((e.amount / expenses) * 1000) / 10 : 0 }));

    // ── Trésorerie ───────────────────────────────────────────────────
    const [cashPeriodLines, cashInPeriodLines] = await Promise.all([
      db.select({ debit: journalEntryLinesTable.debit, credit: journalEntryLinesTable.credit })
        .from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
        .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
        .where(and(
          eq(journalEntriesTable.organizationId, orgId), eq(journalEntriesTable.status, "posted"),
          eq(chartOfAccountsTable.classNum, 5), lte(journalEntriesTable.entryDate, toIso),
        )),
      db.select({ debit: journalEntryLinesTable.debit, credit: journalEntryLinesTable.credit })
        .from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
        .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
        .where(and(
          eq(journalEntriesTable.organizationId, orgId), eq(journalEntriesTable.status, "posted"),
          eq(chartOfAccountsTable.classNum, 5),
          gte(journalEntriesTable.entryDate, fromIso), lte(journalEntriesTable.entryDate, toIso),
        )),
    ]);
    const cashPosition = cashPeriodLines.reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const cashIn  = cashInPeriodLines.filter(l => num(l.debit) > 0).reduce((s, l) => s + num(l.debit), 0);
    const cashOut = cashInPeriodLines.filter(l => num(l.credit) > 0).reduce((s, l) => s + num(l.credit), 0);

    // ── Créances clients par client ───────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const arByClientRaw = await db
      .select({
        clientId: invoicesTable.clientId,
        clientName: clientsTable.name,
        totalAmount: invoicesTable.totalAmount,
        paidAmount: invoicesTable.paidAmount,
        dueDate: invoicesTable.dueDate,
      })
      .from(invoicesTable)
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(and(
        eq(invoicesTable.organizationId, orgId),
        ne(invoicesTable.status, "cancelled"), ne(invoicesTable.status, "draft"),
      ));
    const arMap: Record<string, { name: string; outstanding: number; overdue: number }> = {};
    let arOutstanding = 0, arOverdue = 0;
    for (const inv of arByClientRaw) {
      const outstanding = num(inv.totalAmount) - num(inv.paidAmount);
      if (outstanding <= 0) continue;
      const key = inv.clientId ?? "unknown";
      if (!arMap[key]) arMap[key] = { name: inv.clientName ?? "Client inconnu", outstanding: 0, overdue: 0 };
      arMap[key].outstanding += outstanding;
      arOutstanding += outstanding;
      if (inv.dueDate && inv.dueDate < today) { arMap[key].overdue += outstanding; arOverdue += outstanding; }
    }
    const topArClients = Object.values(arMap)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10)
      .map(c => ({ ...c, percent: arOutstanding > 0 ? Math.round((c.outstanding / arOutstanding) * 1000) / 10 : 0 }));

    // ── Dettes fournisseurs par fournisseur ───────────────────────────
    const apBySupplierRaw = await db
      .select({
        supplierId: supplierInvoicesTable.supplierId,
        supplierName: suppliersTable.name,
        totalAmount: supplierInvoicesTable.totalAmount,
        paidAmount: supplierInvoicesTable.paidAmount,
        dueDate: supplierInvoicesTable.dueDate,
      })
      .from(supplierInvoicesTable)
      .leftJoin(suppliersTable, eq(supplierInvoicesTable.supplierId, suppliersTable.id))
      .where(and(
        eq(supplierInvoicesTable.organizationId, orgId),
        ne(supplierInvoicesTable.status, "cancelled"), ne(supplierInvoicesTable.status, "draft"),
      ));
    const apMap: Record<string, { name: string; outstanding: number; overdue: number }> = {};
    let apOutstanding = 0, apOverdue = 0;
    for (const inv of apBySupplierRaw) {
      const outstanding = num(inv.totalAmount) - num(inv.paidAmount);
      if (outstanding <= 0) continue;
      const key = inv.supplierId ?? "unknown";
      if (!apMap[key]) apMap[key] = { name: inv.supplierName ?? "Fournisseur inconnu", outstanding: 0, overdue: 0 };
      apMap[key].outstanding += outstanding;
      apOutstanding += outstanding;
      if (inv.dueDate && inv.dueDate < today) { apMap[key].overdue += outstanding; apOverdue += outstanding; }
    }
    const topApSuppliers = Object.values(apMap)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10)
      .map(s => ({ ...s, percent: apOutstanding > 0 ? Math.round((s.outstanding / apOutstanding) * 1000) / 10 : 0 }));

    // ── Achats période ────────────────────────────────────────────────
    const purchases = await db
      .select({ totalAmount: supplierInvoicesTable.totalAmount })
      .from(supplierInvoicesTable)
      .where(and(
        eq(supplierInvoicesTable.organizationId, orgId),
        ne(supplierInvoicesTable.status, "cancelled"), ne(supplierInvoicesTable.status, "draft"),
        gte(supplierInvoicesTable.invoiceDate, fromIso), lte(supplierInvoicesTable.invoiceDate, toIso),
      ));
    const totalPurchases = purchases.reduce((s, p) => s + num(p.totalAmount), 0);

    // ── Projets ──────────────────────────────────────────────────────
    const projects = await db.select({ status: projectsTable.status, budget: projectsTable.budget, progress: projectsTable.progress, endDate: projectsTable.endDate })
      .from(projectsTable).where(and(eq(projectsTable.organizationId, orgId), isNull(projectsTable.deletedAt)));
    const activeProjectsList = projects.filter(p => p.status === "active");
    const overdueProjectsList = activeProjectsList.filter(p => p.endDate && p.endDate < today);
    const totalBudget = activeProjectsList.reduce((s, p) => s + num(p.budget), 0);
    const avgProgress = activeProjectsList.length > 0 ? Math.round(activeProjectsList.reduce((s, p) => s + (p.progress ?? 0), 0) / activeProjectsList.length) : 0;

    // ── RH ───────────────────────────────────────────────────────────
    const collaborators = await db.select({ employmentStatus: collaboratorsTable.employmentStatus })
      .from(collaboratorsTable).where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));
    const activeCollab = collaborators.filter(c => c.employmentStatus === "active").length;
    const activeContracts = await db.select({ type: contractsTable.type })
      .from(contractsTable)
      .innerJoin(collaboratorsTable, eq(contractsTable.collaboratorId, collaboratorsTable.id))
      .where(and(eq(contractsTable.organizationId, orgId), eq(contractsTable.status, "active")));
    const byContractType: Record<string, number> = {};
    for (const c of activeContracts) byContractType[c.type] = (byContractType[c.type] || 0) + 1;

    // ── Ratios de liquidité ───────────────────────────────────────────
    const dailyRevenue = revenues / Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
    const dailyPurchases = totalPurchases / Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
    const debtorsDays   = dailyRevenue   > 0 ? Math.round(arOutstanding   / dailyRevenue)   : 0;
    const creditorsDays = dailyPurchases > 0 ? Math.round(apOutstanding   / dailyPurchases) : 0;

    res.json({
      period: { from: fromIso, to: toIso },
      prev: { revenues: prevRevenues, expenses: prevExpenses, netResult: prevNetResult, margin: prevMargin, from: prevFromIso, to: prevToIso },
      finance: {
        revenues, expenses, netResult, ebitda,
        margin, grossProfit, grossMargin, operatingExpenseRatio,
        totalPurchases, cashIn, cashOut,
      },
      liquidity: {
        cashPosition, arOutstanding, arOverdue, apOutstanding, apOverdue,
        workingCapital: cashPosition + arOutstanding - apOutstanding,
        debtorsDays, creditorsDays,
      },
      series,
      topArClients,
      topApSuppliers,
      expenseBreakdown,
      operations: {
        activeProjects: activeProjectsList.length, overdueProjects: overdueProjectsList.length,
        totalBudget, avgProgress,
        completedProjects: projects.filter(p => p.status === "completed").length,
        totalProjects: projects.length,
      },
      hr: { activeCollab, byContractType },
      hasData: true,
    });
  } catch (e) { next(e); }
});

export default router;


