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
  execSummaryConfigsTable,
  organizationsTable,
} from "@workspace/db";
import type { ExecSummarySectionConfig } from "@workspace/db";
import { eq, sql, isNull, and, gte, lte, desc, ne, inArray, isNotNull } from "drizzle-orm";
import { requireAuth, requireManagerOrAbove } from "../middlewares/auth";
import { ExcelReportBuilder } from "../lib/excel-engine";

const router = Router();

// ────────────────────────────────────────────────────────────────
// Helper : récupère le nom de l'organisation pour les exports
// ────────────────────────────────────────────────────────────────
async function getOrgName(orgId: string): Promise<string> {
  const rows = await db.select({ name: organizationsTable.name })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);
  return rows[0]?.name ?? "Mon Organisation";
}

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
    const [r, orgName] = await Promise.all([
      buildFinanceReport(period),
      getOrgName(req.authUser!.organizationId),
    ]);

    const xls = new ExcelReportBuilder({ orgName, period, reportTitle: "Rapport Finance" });

    xls.addCoverSheet("Finance & Recouvrement");

    xls.addSummarySheet([
      ExcelReportBuilder.money("Chiffre d'affaires facturé",  r.kpi.invoicedAmount,   null, "up-good",  "Facturation"),
      ExcelReportBuilder.money("Encaissements reçus",         r.kpi.collectedAmount,  null, "up-good",  "Facturation"),
      ExcelReportBuilder.money("Encours total",               r.kpi.outstandingAmount,null, "down-good","Facturation"),
      ExcelReportBuilder.money("Encours en retard",           r.kpi.overdueAmount,    null, "down-good","Facturation"),
      ExcelReportBuilder.num("Factures émises",               r.kpi.invoicedCount,    null, "up-good",  "Facturation"),
      ExcelReportBuilder.num("Factures soldées",              r.kpi.paidCount,        null, "up-good",  "Facturation"),
      ExcelReportBuilder.pct("Taux de recouvrement",          r.kpi.collectionRate,   null, "up-good",  "Recouvrement"),
    ]);

    xls.addDataSheet({
      name: "📅 Évolution mensuelle",
      title: "Évolution mensuelle — Facturation",
      cols: [
        { header: "Mois",              key: "month",    width: 14, format: "text"   },
        { header: "Facturé (FCFA)",    key: "facture",  width: 22, format: "money"  },
        { header: "Encaissé (FCFA)",   key: "encaisse", width: 22, format: "money"  },
      ],
      rows: r.series.map(s => [s.month, s.facture, s.encaisse]),
      totalsRow: true,
    });

    xls.addDataSheet({
      name: "🏆 Top Clients",
      title: "Top Clients — Facturation",
      cols: [
        { header: "Client",             key: "name",   width: 36, format: "text"   },
        { header: "Nb factures",        key: "count",  width: 14, format: "number" },
        { header: "Montant facturé",    key: "amount", width: 24, format: "money"  },
      ],
      rows: r.topClients.map(c => [c.name, c.count, Math.round(c.amount)]),
      totalsRow: true,
    });

    xls.addDataSheet({
      name: "📊 Par statut",
      title: "Répartition des factures par statut",
      cols: [
        { header: "Statut",          key: "status", width: 28, format: "text"   },
        { header: "Nb factures",     key: "count",  width: 14, format: "number" },
        { header: "Montant (FCFA)",  key: "amount", width: 24, format: "money"  },
      ],
      rows: Object.entries(r.byStatus).map(([s, v]) => [INVOICE_STATUS_FR[s] || s, v.count, v.amount]),
      totalsRow: true,
    });

    if (r.overdueList.length) {
      xls.addDataSheet({
        name: "⚠️ Impayés",
        title: "Factures en retard de paiement",
        cols: [
          { header: "Référence",     key: "ref",     width: 18, format: "text"   },
          { header: "Client",        key: "client",  width: 36, format: "text"   },
          { header: "Échéance",      key: "due",     width: 16, format: "text"   },
          { header: "Restant dû",    key: "amount",  width: 22, format: "money"  },
        ],
        rows: r.overdueList.map(o => [o.reference, o.clientName, o.dueDate || "—", Math.round(o.outstanding)]),
        totalsRow: true,
        tabColor: "FFDC2626",
      });
    }

    xls.addNotesSheet([
      { title: "Périmètre de l'analyse", body: `Données issues des factures et encaissements sur la période du ${period.from.toLocaleDateString("fr-FR")} au ${period.to.toLocaleDateString("fr-FR")}.\nEncours = montant facturé non encore encaissé.\nEncours en retard = factures dont la date d'échéance est dépassée.` },
      { title: "Taux de recouvrement", body: `Taux de recouvrement = Encaissements reçus / Chiffre d'affaires facturé × 100.\nUn taux > 90 % est considéré satisfaisant.\nUn taux < 70 % nécessite une action corrective immédiate.` },
      { title: "Devise", body: "Tous les montants sont exprimés en FCFA (Franc CFA de l'Afrique de l'Ouest — XOF).\nTaux de change : 1 EUR ≈ 655,957 FCFA (fixe)." },
    ]);

    await xls.send(res, `rapport-finance-${period.from.toISOString().slice(0, 10)}.xlsx`);
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
    const [r, orgName] = await Promise.all([
      buildSalesReport(period),
      getOrgName(req.authUser!.organizationId),
    ]);

    const xls = new ExcelReportBuilder({ orgName, period, reportTitle: "Rapport Ventes & Commercial" });

    xls.addCoverSheet("Ventes & Pipeline Commercial");

    xls.addSummarySheet([
      ExcelReportBuilder.num("Commandes (nombre)",               r.kpi.ordersCount,       null, "up-good",  "Commandes"),
      ExcelReportBuilder.money("Commandes (montant)",            r.kpi.ordersAmount,      null, "up-good",  "Commandes"),
      ExcelReportBuilder.num("Proformas émises",                 r.kpi.proformasCount,    null, "up-good",  "Proformas"),
      ExcelReportBuilder.num("Proformas converties",             r.kpi.proformasConverted,null, "up-good",  "Proformas"),
      ExcelReportBuilder.pct("Taux conversion proforma→facture", r.kpi.conversionRate,    null, "up-good",  "Proformas"),
      ExcelReportBuilder.num("Opportunités pipeline",            r.kpi.pipelineCount,     null, "up-good",  "Pipeline"),
      ExcelReportBuilder.money("Valeur pipeline total",          r.kpi.pipelineValue,     null, "up-good",  "Pipeline"),
    ]);

    xls.addDataSheet({
      name: "📅 Évolution mensuelle",
      title: "Évolution mensuelle des commandes (12 mois)",
      cols: [
        { header: "Mois",              key: "month",  width: 14, format: "text"   },
        { header: "Nb commandes",      key: "count",  width: 16, format: "number" },
        { header: "Montant (FCFA)",    key: "amount", width: 24, format: "money"  },
      ],
      rows: r.series.map(s => [s.month, s.count, s.amount]),
      totalsRow: true,
    });

    xls.addDataSheet({
      name: "🏆 Top Clients",
      title: "Top Clients — Commandes",
      cols: [
        { header: "Client",           key: "name",   width: 36, format: "text"   },
        { header: "Nb commandes",     key: "count",  width: 16, format: "number" },
        { header: "Montant (FCFA)",   key: "amount", width: 24, format: "money"  },
      ],
      rows: r.topClients.map(c => [c.name, c.count, Math.round(c.amount)]),
      totalsRow: true,
    });

    xls.addDataSheet({
      name: "🎯 Pipeline CRM",
      title: "Pipeline des opportunités par étape",
      cols: [
        { header: "Étape",             key: "stage", width: 24, format: "text"   },
        { header: "Nb opportunités",   key: "count", width: 18, format: "number" },
        { header: "Valeur pot. (FCFA)",key: "value", width: 26, format: "money"  },
      ],
      rows: Object.entries(r.pipeline).map(([stage, v]) => [PIPELINE_STAGE_FR[stage] || stage, v.count, Math.round(v.value)]),
      totalsRow: true,
    });

    xls.addNotesSheet([
      { title: "Périmètre commercial", body: `Commandes et proformas créées du ${period.from.toLocaleDateString("fr-FR")} au ${period.to.toLocaleDateString("fr-FR")}.\nLe pipeline CRM reflète l'état actuel de toutes les opportunités actives (non filtré par période).` },
      { title: "Taux de conversion", body: "Taux de conversion = Proformas converties en facture / Total proformas émises × 100.\nUne opportunité est considérée convertie dès qu'une facture liée à la proforma est créée." },
      { title: "Devise", body: "Tous les montants sont exprimés en FCFA (XOF)." },
    ]);

    await xls.send(res, `rapport-ventes-${period.from.toISOString().slice(0, 10)}.xlsx`);
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
    const [r, orgName] = await Promise.all([
      buildProjectsReport(period),
      getOrgName(req.authUser!.organizationId),
    ]);

    const xls = new ExcelReportBuilder({ orgName, period, reportTitle: "Rapport Portefeuille Projets" });

    xls.addCoverSheet("Gestion de Projets");

    xls.addSummarySheet([
      ExcelReportBuilder.num("Projets (total)",           r.kpi.totalCount,       null, "up-good",   "Portefeuille"),
      ExcelReportBuilder.num("Projets actifs",            r.kpi.activeCount,      null, "up-good",   "Portefeuille"),
      ExcelReportBuilder.num("Projets en retard",         r.kpi.overdueCount,     null, "down-good", "Portefeuille"),
      ExcelReportBuilder.num("Créés sur la période",      r.kpi.newInPeriod,      null, "up-good",   "Portefeuille"),
      ExcelReportBuilder.num("Clôturés sur la période",   r.kpi.completedInPeriod,null, "up-good",   "Portefeuille"),
      ExcelReportBuilder.money("Budget cumulé (total)",   r.kpi.totalBudget,      null, "up-good",   "Financier"),
      ExcelReportBuilder.money("Budget actif",            r.kpi.activeBudget,     null, "up-good",   "Financier"),
      ExcelReportBuilder.pct("Avancement moyen",          r.kpi.avgProgress,      null, "up-good",   "Financier"),
    ]);

    xls.addDataSheet({
      name: "📋 Portefeuille",
      title: "Portefeuille projets — Détail",
      cols: [
        { header: "Projet",           key: "name",     width: 38, format: "text"   },
        { header: "Client",           key: "client",   width: 28, format: "text"   },
        { header: "Statut",           key: "status",   width: 20, format: "text"   },
        { header: "Avancement (%)",   key: "progress", width: 16, format: "number", align: "right" },
        { header: "Budget (FCFA)",    key: "budget",   width: 24, format: "money"  },
        { header: "Échéance",         key: "endDate",  width: 14, format: "text"   },
      ],
      rows: r.topProjects.map(p => [
        p.name, p.clientName,
        PROJECT_STATUS_FR[p.status] || p.status,
        p.progress, p.budget, p.endDate || "—",
      ]),
      totalsRow: true,
    });

    xls.addDataSheet({
      name: "📊 Par statut",
      title: "Répartition par statut",
      cols: [
        { header: "Statut",    key: "status", width: 24, format: "text"   },
        { header: "Projets",   key: "count",  width: 14, format: "number" },
      ],
      rows: Object.entries(r.byStatus).map(([s, c]) => [PROJECT_STATUS_FR[s] || s, c]),
    });

    if (r.overdueList.length) {
      xls.addDataSheet({
        name: "⚠️ Projets en retard",
        title: "Projets en retard — À traiter en priorité",
        cols: [
          { header: "Projet",          key: "name",     width: 38, format: "text"   },
          { header: "Client",          key: "client",   width: 28, format: "text"   },
          { header: "Échéance prévue", key: "endDate",  width: 16, format: "text"   },
          { header: "Avancement (%)",  key: "progress", width: 16, format: "number", align: "right" },
        ],
        rows: r.overdueList.map(p => [p.name, p.clientName, p.endDate || "—", p.progress]),
        tabColor: "FFDC2626",
      });
    }

    xls.addNotesSheet([
      { title: "Définitions", body: "Un projet est considéré en retard si sa date de fin prévue est dépassée et son statut est toujours actif.\nL'avancement est calculé selon le pourcentage de complétion déclaré par le chef de projet." },
      { title: "Périmètre", body: `Tous les projets du portefeuille sont inclus (pas de filtre par période).\nLes projets créés ou clôturés dans la période du ${period.from.toLocaleDateString("fr-FR")} au ${period.to.toLocaleDateString("fr-FR")} sont identifiés séparément.` },
      { title: "Devise", body: "Budgets en FCFA (XOF)." },
    ]);

    await xls.send(res, `rapport-projets-${period.from.toISOString().slice(0, 10)}.xlsx`);
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
    const [r, orgName] = await Promise.all([
      buildHrReport(period),
      getOrgName(req.authUser!.organizationId),
    ]);

    const xls = new ExcelReportBuilder({ orgName, period, reportTitle: "Rapport Ressources Humaines" });

    xls.addCoverSheet("Ressources Humaines & Présence");

    xls.addSummarySheet([
      ExcelReportBuilder.num("Effectif total",                  r.kpi.total,            null, "up-good",   "Effectifs"),
      ExcelReportBuilder.num("Collaborateurs actifs",           r.kpi.active,           null, "up-good",   "Effectifs"),
      ExcelReportBuilder.num("En congé",                        r.kpi.onLeave,          null, "neutral",   "Effectifs"),
      ExcelReportBuilder.num("Sortis",                          r.kpi.terminated,       null, "down-good", "Effectifs"),
      ExcelReportBuilder.num("Heures pointées (période)",       r.kpi.totalHours,       null, "up-good",   "Présence"),
      ExcelReportBuilder.num("Collaborateurs ayant pointé",     r.kpi.distinctCollabs,  null, "up-good",   "Présence"),
      ExcelReportBuilder.num("Retards constatés",               r.kpi.lateCount,        null, "down-good", "Anomalies"),
      ExcelReportBuilder.num("Départs anticipés",               r.kpi.earlyLeaveCount,  null, "down-good", "Anomalies"),
      ExcelReportBuilder.num("Anomalies non résolues",          r.kpi.unresolvedFlags,  null, "down-good", "Anomalies"),
      ExcelReportBuilder.num("Contrats expirant ≤ 60 jours",   r.kpi.expiringContracts,null, "down-good", "Contrats"),
    ]);

    xls.addDataSheet({
      name: "🏢 Par département",
      title: "Effectifs par département",
      cols: [
        { header: "Département",      key: "dept",  width: 32, format: "text"   },
        { header: "Effectif actif",   key: "count", width: 16, format: "number" },
      ],
      rows: Object.entries(r.byDepartment).map(([d, n]) => [d, n]),
      totalsRow: true,
    });

    xls.addDataSheet({
      name: "🏆 Top Présence",
      title: "Top collaborateurs — Heures pointées sur la période",
      cols: [
        { header: "Collaborateur",    key: "name",  width: 36, format: "text"   },
        { header: "Heures pointées",  key: "hours", width: 18, format: "number" },
      ],
      rows: r.topPerformers.map(p => [p.name, p.hours]),
      totalsRow: true,
    });

    if (r.expiringList.length) {
      xls.addDataSheet({
        name: "⚠️ Contrats expirants",
        title: "Contrats expirant dans les 60 jours",
        cols: [
          { header: "Collaborateur", key: "name",     width: 36, format: "text" },
          { header: "Type contrat",  key: "type",     width: 22, format: "text" },
          { header: "Échéance",      key: "endDate",  width: 16, format: "text" },
          { header: "Poste",         key: "jobTitle", width: 28, format: "text" },
        ],
        rows: r.expiringList.map(c => [
          c.collaborator,
          CONTRACT_TYPE_FR[c.type?.toLowerCase()] || c.type,
          c.endDate || "—",
          c.jobTitle || "—",
        ]),
        tabColor: "FFDC2626",
      });
    }

    xls.addNotesSheet([
      { title: "Présence & pointage", body: `Les données de présence couvrent la période du ${period.from.toLocaleDateString("fr-FR")} au ${period.to.toLocaleDateString("fr-FR")}.\nLes heures sont calculées depuis les sessions de pointage validées (heures effectives, hors pauses).` },
      { title: "Anomalies", body: "Un retard est enregistré si l'heure d'arrivée dépasse la tolérance paramétrée.\nUn départ anticipé est enregistré si l'heure de sortie est avant l'heure de fin prévue.\nLes anomalies non résolues nécessitent une validation manuelle par le RH ou le manager." },
      { title: "Contrats expirants", body: "Liste des contrats dont la date de fin est dans les 60 prochains jours.\nAction recommandée : renouvellement ou notification au collaborateur avant échéance." },
    ]);

    await xls.send(res, `rapport-rh-${period.from.toISOString().slice(0, 10)}.xlsx`);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════
// CSV HELPER + EXPORTS CSV
// ════════════════════════════════════════════════════════════════

function sendCsv(res: import("express").Response, rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csv);
}

router.get("/reports/finance/export.csv", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const r = await buildFinanceReport(period);
    const rows: (string | number)[][] = [
      ["GAMÉASÙ — Rapport Finance"],
      [`Période : ${period.from.toLocaleDateString("fr-FR")} → ${period.to.toLocaleDateString("fr-FR")}  |  Généré le : ${new Date().toLocaleString("fr-FR")}`],
      [],
      ["Indicateur", "Valeur"],
      ["Chiffre d'affaires facturé", r.kpi.invoicedAmount],
      ["Encaissements reçus", r.kpi.collectedAmount],
      ["Encours total", r.kpi.outstandingAmount],
      ["Encours en retard", r.kpi.overdueAmount],
      ["Factures émises", r.kpi.invoicedCount],
      ["Factures soldées", r.kpi.paidCount],
      ["Taux de recouvrement (%)", r.kpi.collectionRate],
      [],
      ["Mois", "Facturé (FCFA)", "Encaissé (FCFA)"],
      ...r.series.map((s) => [s.month, s.facture, s.encaisse]),
      [],
      ["Top clients", "Nombre de factures", "Montant facturé (FCFA)"],
      ...r.topClients.map((c) => [c.name, c.count, Math.round(c.amount)]),
    ];
    if (r.overdueList.length) {
      rows.push([]);
      rows.push(["Référence", "Client", "Échéance", "Restant dû (FCFA)"]);
      r.overdueList.forEach((o) => rows.push([o.reference, o.clientName, o.dueDate || "—", Math.round(o.outstanding)]));
    }
    sendCsv(res, rows, `rapport-finance-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) { next(e); }
});

router.get("/reports/sales/export.csv", requireAuth, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const r = await buildSalesReport(period);
    const rows: (string | number)[][] = [
      ["GAMÉASÙ — Rapport Ventes"],
      [`Période : ${period.from.toLocaleDateString("fr-FR")} → ${period.to.toLocaleDateString("fr-FR")}  |  Généré le : ${new Date().toLocaleString("fr-FR")}`],
      [],
      ["Indicateur", "Valeur"],
      ["Commandes (nombre)", r.kpi.ordersCount],
      ["Commandes (montant FCFA)", r.kpi.ordersAmount],
      ["Proformas émises", r.kpi.proformasCount],
      ["Proformas converties", r.kpi.proformasConverted],
      ["Taux de conversion (%)", r.kpi.conversionRate],
      ["Pipeline — valeur potentielle (FCFA)", Math.round(r.kpi.pipelineValue)],
      [],
      ["Mois", "Commandes", "Montant (FCFA)"],
      ...r.series.map((s) => [s.month, s.count, s.amount]),
      [],
      ["Top clients", "Commandes", "Montant (FCFA)"],
      ...r.topClients.map((c) => [c.name, c.count, Math.round(c.amount)]),
      [],
      ["Pipeline — Étape", "Opportunités", "Valeur potentielle (FCFA)"],
      ...Object.entries(r.pipeline).map(([stage, v]) => [stage, v.count, Math.round(v.value)]),
    ];
    sendCsv(res, rows, `rapport-ventes-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) { next(e); }
});

router.get("/reports/projects/export.csv", requireAuth, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const r = await buildProjectsReport(period);
    const rows: (string | number)[][] = [
      ["GAMÉASÙ — Rapport Projets"],
      [`Période : ${period.from.toLocaleDateString("fr-FR")} → ${period.to.toLocaleDateString("fr-FR")}  |  Généré le : ${new Date().toLocaleString("fr-FR")}`],
      [],
      ["Indicateur", "Valeur"],
      ["Projets total", r.kpi.totalCount],
      ["Projets actifs", r.kpi.activeCount],
      ["Projets en retard", r.kpi.overdueCount],
      ["Nouveaux (période)", r.kpi.newInPeriod],
      ["Clôturés (période)", r.kpi.completedInPeriod],
      ["Budget total (FCFA)", Math.round(r.kpi.totalBudget)],
      ["Budget actif (FCFA)", Math.round(r.kpi.activeBudget)],
      ["Avancement moyen (%)", r.kpi.avgProgress],
      [],
      ["Projet", "Statut", "Avancement (%)", "Budget (FCFA)", "Client"],
      ...r.topProjects.map((p) => [p.name, PROJECT_STATUS_FR[p.status] ?? p.status, p.progress, Math.round(p.budget), p.clientName]),
    ];
    if (r.overdueList.length) {
      rows.push([]);
      rows.push(["Projets en retard", "Échéance", "Avancement (%)", "Client"]);
      r.overdueList.forEach((p) => rows.push([p.name, p.endDate || "—", p.progress, p.clientName]));
    }
    sendCsv(res, rows, `rapport-projets-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) { next(e); }
});

router.get("/reports/hr/export.csv", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const r = await buildHrReport(period);
    const rows: (string | number)[][] = [
      ["GAMÉASÙ — Rapport RH"],
      [`Période : ${period.from.toLocaleDateString("fr-FR")} → ${period.to.toLocaleDateString("fr-FR")}  |  Généré le : ${new Date().toLocaleString("fr-FR")}`],
      [],
      ["Indicateur", "Valeur"],
      ["Effectif total", r.kpi.total],
      ["Actifs", r.kpi.active],
      ["En congé", r.kpi.onLeave],
      ["Sortis", r.kpi.terminated],
      ["Heures pointées (période)", r.kpi.totalHours],
      ["Collaborateurs ayant pointé", r.kpi.distinctCollabs],
      ["Retards", r.kpi.lateCount],
      ["Départs anticipés", r.kpi.earlyLeaveCount],
      ["Anomalies non résolues", r.kpi.unresolvedFlags],
      ["Contrats expirants ≤ 60 j", r.kpi.expiringContracts],
      [],
      ["Département", "Effectif actif"],
      ...Object.entries(r.byDepartment).map(([d, n]) => [d, n]),
      [],
      ["Top collaborateurs", "Heures pointées"],
      ...r.topPerformers.map((p) => [p.name, p.hours]),
    ];
    if (r.expiringList.length) {
      rows.push([]);
      rows.push(["Contrat expirant", "Type", "Échéance", "Poste"]);
      r.expiringList.forEach((c) => rows.push([c.collaborator, CONTRACT_TYPE_FR[c.type?.toLowerCase()] ?? c.type, c.endDate || "—", c.jobTitle || "—"]));
    }
    sendCsv(res, rows, `rapport-rh-${new Date().toISOString().slice(0, 10)}.csv`);
  } catch (e) { next(e); }
});

router.get("/reports/overview/export.xlsx", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const [finance, sales, projects, hr, orgName] = await Promise.all([
      buildFinanceReport(period),
      buildSalesReport(period),
      buildProjectsReport(period),
      buildHrReport(period),
      getOrgName(req.authUser!.organizationId),
    ]);

    const xls = new ExcelReportBuilder({ orgName, period, reportTitle: "Rapport de Synthèse Globale" });

    xls.addCoverSheet("Tableau de Bord Direction");

    // Résumé exécutif multi-domaines
    xls.addSummarySheet([
      // Finance
      ExcelReportBuilder.money("CA facturé",                finance.kpi.invoicedAmount,  null, "up-good",  "Finance"),
      ExcelReportBuilder.money("Encaissements reçus",       finance.kpi.collectedAmount, null, "up-good",  "Finance"),
      ExcelReportBuilder.pct("Taux de recouvrement",        finance.kpi.collectionRate,  null, "up-good",  "Finance"),
      ExcelReportBuilder.money("Encours en retard",         finance.kpi.overdueAmount,   null, "down-good","Finance"),
      // Ventes
      ExcelReportBuilder.num("Commandes",                   sales.kpi.ordersCount,       null, "up-good",  "Ventes & Commercial"),
      ExcelReportBuilder.money("Montant commandes",         sales.kpi.ordersAmount,      null, "up-good",  "Ventes & Commercial"),
      ExcelReportBuilder.pct("Taux conversion proforma",    sales.kpi.conversionRate,    null, "up-good",  "Ventes & Commercial"),
      ExcelReportBuilder.money("Pipeline CRM",              sales.kpi.pipelineValue,     null, "up-good",  "Ventes & Commercial"),
      // Projets
      ExcelReportBuilder.num("Projets actifs",              projects.kpi.activeCount,    null, "up-good",  "Gestion de Projets"),
      ExcelReportBuilder.num("Projets en retard",           projects.kpi.overdueCount,   null, "down-good","Gestion de Projets"),
      ExcelReportBuilder.pct("Avancement moyen",            projects.kpi.avgProgress,    null, "up-good",  "Gestion de Projets"),
      ExcelReportBuilder.money("Budget total portefeuille", projects.kpi.totalBudget,    null, "up-good",  "Gestion de Projets"),
      // RH
      ExcelReportBuilder.num("Effectif total",              hr.kpi.total,                null, "up-good",  "Ressources Humaines"),
      ExcelReportBuilder.num("Collaborateurs actifs",       hr.kpi.active,               null, "up-good",  "Ressources Humaines"),
      ExcelReportBuilder.num("Heures pointées",             hr.kpi.totalHours,           null, "up-good",  "Ressources Humaines"),
      ExcelReportBuilder.num("Anomalies non résolues",      hr.kpi.unresolvedFlags,      null, "down-good","Ressources Humaines"),
    ]);

    // Feuille détail Finance
    xls.addDataSheet({
      name: "💰 Finance",
      title: "Finance — Évolution mensuelle",
      cols: [
        { header: "Mois",            key: "month",    width: 14, format: "text"  },
        { header: "Facturé (FCFA)",  key: "facture",  width: 24, format: "money" },
        { header: "Encaissé (FCFA)", key: "encaisse", width: 24, format: "money" },
      ],
      rows: finance.series.map(s => [s.month, s.facture, s.encaisse]),
      totalsRow: true,
    });

    // Feuille détail Projets
    xls.addDataSheet({
      name: "🚀 Projets",
      title: "Portefeuille Projets",
      cols: [
        { header: "Projet",          key: "name",     width: 38, format: "text"   },
        { header: "Statut",          key: "status",   width: 20, format: "text"   },
        { header: "Avancement (%)",  key: "progress", width: 16, format: "number", align: "right" },
        { header: "Budget (FCFA)",   key: "budget",   width: 24, format: "money"  },
        { header: "Client",          key: "client",   width: 28, format: "text"   },
      ],
      rows: projects.topProjects.map(p => [
        p.name,
        PROJECT_STATUS_FR[p.status] ?? p.status,
        p.progress,
        p.budget,
        p.clientName,
      ]),
      totalsRow: true,
    });

    // Feuille détail RH
    xls.addDataSheet({
      name: "👥 RH",
      title: "Ressources Humaines — Effectifs par département",
      cols: [
        { header: "Département",    key: "dept",  width: 32, format: "text"   },
        { header: "Effectif actif", key: "count", width: 16, format: "number" },
      ],
      rows: Object.entries(hr.byDepartment).map(([d, n]) => [d, n]),
      totalsRow: true,
    });

    xls.addNotesSheet([
      { title: "Périmètre de la synthèse", body: `Ce rapport consolide les données de tous les modules Gaméasù pour la période du ${period.from.toLocaleDateString("fr-FR")} au ${period.to.toLocaleDateString("fr-FR")}.\nChaque onglet correspond à un domaine fonctionnel distinct.` },
      { title: "Interprétation des KPIs", body: "Les indicateurs marqués ✅ sont favorables, ⚠️ stables (variation < 5 %), ❌ défavorables.\nLa colonne Variation calcule automatiquement l'écart par rapport à la période N-1 si disponible." },
      { title: "Usage recommandé", body: "Ce classeur est conçu pour être utilisé en Comité de Direction ou en réunion de pilotage.\nLes données peuvent être filtrées et triées directement dans Excel sans modification des formules." },
    ]);

    await xls.send(res, `rapport-synthese-${period.from.toISOString().slice(0, 10)}.xlsx`);
  } catch (e) { next(e); }
});

router.get("/reports/overview/export.csv", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    const [finance, sales, projects, hr] = await Promise.all([
      buildFinanceReport(period),
      buildSalesReport(period),
      buildProjectsReport(period),
      buildHrReport(period),
    ]);
    const rows: (string | number)[][] = [
      ["GAMÉASÙ — Rapport de Synthèse"],
      [`Période : ${period.from.toLocaleDateString("fr-FR")} → ${period.to.toLocaleDateString("fr-FR")}  |  Généré le : ${new Date().toLocaleString("fr-FR")}`],
      [],
      ["=== FINANCE ==="],
      ["CA facturé (FCFA)", finance.kpi.invoicedAmount, "Encaissé (FCFA)", finance.kpi.collectedAmount],
      ["Encours en retard (FCFA)", finance.kpi.overdueAmount, "Taux recouvrement (%)", finance.kpi.collectionRate],
      [],
      ["=== VENTES ==="],
      ["Commandes", sales.kpi.ordersCount, "Montant (FCFA)", sales.kpi.ordersAmount],
      ["Pipeline (FCFA)", Math.round(sales.kpi.pipelineValue), "Taux conversion (%)", sales.kpi.conversionRate],
      [],
      ["=== PROJETS ==="],
      ["Actifs", projects.kpi.activeCount, "En retard", projects.kpi.overdueCount],
      ["Avancement moyen (%)", projects.kpi.avgProgress, "Budget total (FCFA)", Math.round(projects.kpi.totalBudget)],
      [],
      ["=== RH ==="],
      ["Effectif total", hr.kpi.total, "Actifs", hr.kpi.active],
      ["Heures pointées", hr.kpi.totalHours, "Anomalies", hr.kpi.unresolvedFlags],
    ];
    sendCsv(res, rows, `rapport-synthese-${new Date().toISOString().slice(0, 10)}.csv`);
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
      db.select({ id: collaboratorsTable.id, status: collaboratorsTable.employmentStatus, employmentStatus: collaboratorsTable.employmentStatus })
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
// Décaissements (paiements fournisseurs + sorties de tréso)
// ────────────────────────────────────────────────────────────────
router.get("/reports/finance/decaissements", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { from, to, fromIso, toIso } = parsePeriod(req);

    // ── Paiements fournisseurs de la période ─────────────────────
    const supplierPmts = await db
      .select({
        id: supplierPaymentsTable.id,
        amount: supplierPaymentsTable.amount,
        method: supplierPaymentsTable.method,
        paidAt: supplierPaymentsTable.paidAt,
        reference: supplierPaymentsTable.reference,
        supplierName: suppliersTable.name,
        invoiceRef: supplierInvoicesTable.referenceNumber,
      })
      .from(supplierPaymentsTable)
      .leftJoin(supplierInvoicesTable, eq(supplierPaymentsTable.supplierInvoiceId, supplierInvoicesTable.id))
      .leftJoin(suppliersTable, eq(supplierInvoicesTable.supplierId, suppliersTable.id))
      .where(and(
        eq(supplierPaymentsTable.organizationId, orgId),
        gte(supplierPaymentsTable.paidAt, from),
        lte(supplierPaymentsTable.paidAt, to),
      ))
      .orderBy(desc(supplierPaymentsTable.paidAt));

    const total = supplierPmts.reduce((s, p) => s + num(p.amount), 0);

    // ── Agrégation par fournisseur ────────────────────────────────
    const bySupplier: Record<string, { name: string; total: number; count: number }> = {};
    for (const p of supplierPmts) {
      const k = p.supplierName ?? "Fournisseur non renseigné";
      if (!bySupplier[k]) bySupplier[k] = { name: k, total: 0, count: 0 };
      bySupplier[k].total += num(p.amount);
      bySupplier[k].count++;
    }
    const topSuppliers = Object.values(bySupplier)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(s => ({ ...s, percent: total > 0 ? Math.round((s.total / total) * 1000) / 10 : 0 }));

    // ── Agrégation par mode de paiement ──────────────────────────
    const byMethod: Record<string, number> = {};
    for (const p of supplierPmts) {
      const m = p.method ?? "other";
      byMethod[m] = (byMethod[m] || 0) + num(p.amount);
    }
    const methodBreakdown = Object.entries(byMethod)
      .sort(([, a], [, b]) => b - a)
      .map(([method, amount]) => ({ method, amount, percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0 }));

    // ── Séries mensuelles ─────────────────────────────────────────
    const monthlyMap: Record<string, number> = {};
    for (const p of supplierPmts) {
      const m = new Date(p.paidAt).toISOString().slice(0, 7);
      monthlyMap[m] = (monthlyMap[m] || 0) + num(p.amount);
    }
    const series = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    res.json({
      period: { from: fromIso, to: toIso },
      total,
      count: supplierPmts.length,
      topSuppliers,
      methodBreakdown,
      series,
      transactions: supplierPmts.slice(0, 50).map(p => ({
        id: p.id,
        date: new Date(p.paidAt).toISOString().slice(0, 10),
        supplier: p.supplierName ?? "—",
        invoiceRef: p.invoiceRef ?? "—",
        method: p.method,
        amount: num(p.amount),
        reference: p.reference ?? "",
      })),
      hasData: supplierPmts.length > 0,
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

    // ── YTD (Cumul depuis le 1er janvier de l'exercice) ──────────────
    const ytdFromStr     = `${toDate.getFullYear()}-01-01`;
    const prevYtdToStr   = `${toDate.getFullYear() - 1}-${toIso.slice(5)}`;
    const prevYtdFromStr = `${toDate.getFullYear() - 1}-01-01`;

    let ytdRevenues = revenues, ytdExpenses = expenses;
    if (fromIso > ytdFromStr) {
      const ytdLines = await db.select({
        classNum: chartOfAccountsTable.classNum,
        debit:    journalEntryLinesTable.debit,
        credit:   journalEntryLinesTable.credit,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
      .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
      .where(and(
        eq(journalEntriesTable.organizationId, orgId), eq(journalEntriesTable.status, "posted"),
        gte(journalEntriesTable.entryDate, ytdFromStr), lte(journalEntriesTable.entryDate, toIso),
      ));
      ytdRevenues = ytdLines.filter(l => l.classNum === 7).reduce((s, l) => s + num(l.credit) - num(l.debit), 0);
      ytdExpenses = ytdLines.filter(l => l.classNum === 6).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    }
    const ytdNetResult = ytdRevenues - ytdExpenses;
    const ytdMargin    = ytdRevenues > 0 ? Math.round((ytdNetResult / ytdRevenues) * 1000) / 10 : 0;
    const ytdOer       = ytdRevenues > 0 ? Math.round((ytdExpenses  / ytdRevenues) * 1000) / 10 : 0;

    const prevYtdLines = prevYtdFromStr <= prevYtdToStr ? await db.select({
      classNum: chartOfAccountsTable.classNum,
      debit:    journalEntryLinesTable.debit,
      credit:   journalEntryLinesTable.credit,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
    .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
    .where(and(
      eq(journalEntriesTable.organizationId, orgId), eq(journalEntriesTable.status, "posted"),
      gte(journalEntriesTable.entryDate, prevYtdFromStr), lte(journalEntriesTable.entryDate, prevYtdToStr),
    )) : [];
    const prevYtdRevenues  = prevYtdLines.filter(l => l.classNum === 7).reduce((s, l) => s + num(l.credit) - num(l.debit), 0);
    const prevYtdExpenses  = prevYtdLines.filter(l => l.classNum === 6).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const prevYtdNetResult = prevYtdRevenues - prevYtdExpenses;
    const prevYtdMargin    = prevYtdRevenues > 0 ? Math.round((prevYtdNetResult / prevYtdRevenues) * 1000) / 10 : 0;
    const prevYtdOer       = prevYtdRevenues > 0 ? Math.round((prevYtdExpenses  / prevYtdRevenues) * 1000) / 10 : 0;

    // ── Seuil de rentabilité (Break-Even) ─────────────────────────────
    const bepVariableCosts = Math.min(totalPurchases, expenses);
    const bepFixedCosts    = Math.max(0, expenses - bepVariableCosts);
    const bepContribRatio  = revenues > 0 ? (revenues - bepVariableCosts) / revenues : 0;
    const bepPoint         = bepContribRatio > 0 ? Math.round(bepFixedCosts / bepContribRatio) : (expenses > 0 ? expenses : null);
    const bepOperatingResult = revenues - expenses;

    // ── Score de santé financière ──────────────────────────────────────
    const prevOerNum = prevRevenues > 0 ? Math.round((prevExpenses / prevRevenues) * 1000) / 10 : 0;
    const wc         = cashPosition + arOutstanding - apOutstanding;
    const healthChecks = [
      { cat: "Croissance",  label: "Revenus totaux",         curr: revenues,              prev: prevRevenues,   target: "Croissant",  targetNum: null as number | null, achieved: revenues >= prevRevenues,         importance: "Élevé",    isMoney: true,  isPercent: false },
      { cat: "Croissance",  label: "Résultat net",           curr: netResult,             prev: prevNetResult,  target: "Croissant",  targetNum: null as number | null, achieved: netResult >= prevNetResult,         importance: "Élevé",    isMoney: true,  isPercent: false },
      { cat: "Croissance",  label: "Marge nette",            curr: margin,                prev: prevMargin,     target: "Croissante", targetNum: null as number | null, achieved: margin >= prevMargin,               importance: "Élevé",    isMoney: false, isPercent: true  },
      { cat: "Croissance",  label: "Trésorerie",             curr: cashPosition,          prev: null as number | null, target: "≥ 0", targetNum: 0 as number | null,    achieved: cashPosition >= 0,                  importance: "Élevé",    isMoney: true,  isPercent: false },
      { cat: "Rentabilité", label: "Ratio charges/produits", curr: operatingExpenseRatio, prev: prevOerNum,     target: "≤ 80%",      targetNum: 80 as number | null,   achieved: operatingExpenseRatio <= 80,        importance: "Élevé",    isMoney: false, isPercent: true  },
      { cat: "Rentabilité", label: "Résultat net ≥ 0",       curr: netResult,             prev: null as number | null, target: "≥ 0", targetNum: 0 as number | null,    achieved: netResult >= 0,                     importance: "Critique", isMoney: true,  isPercent: false },
      { cat: "Rentabilité", label: "Marge nette ≥ 0%",       curr: margin,                prev: null as number | null, target: "≥ 0%", targetNum: 0 as number | null,  achieved: margin >= 0,                        importance: "Critique", isMoney: false, isPercent: true  },
      { cat: "Liquidité",   label: "Trésorerie ≥ 0",         curr: cashPosition,          prev: null as number | null, target: "≥ 0", targetNum: 0 as number | null,    achieved: cashPosition >= 0,                  importance: "Élevé",    isMoney: true,  isPercent: false },
      { cat: "Liquidité",   label: "Fonds de roulement",     curr: wc,                    prev: null as number | null, target: "≥ 0", targetNum: 0 as number | null,    achieved: wc >= 0,                            importance: "Critique", isMoney: true,  isPercent: false },
      { cat: "Liquidité",   label: "Créances en retard",     curr: arOverdue,             prev: null as number | null, target: "0",   targetNum: 0 as number | null,    achieved: arOverdue === 0,                    importance: "Moyen",    isMoney: true,  isPercent: false },
      { cat: "Solvabilité", label: "Dettes en retard",       curr: apOverdue,             prev: null as number | null, target: "0",   targetNum: 0 as number | null,    achieved: apOverdue === 0,                    importance: "Élevé",    isMoney: true,  isPercent: false },
      { cat: "Solvabilité", label: "Capitaux propres (FR)",  curr: wc,                    prev: null as number | null, target: "≥ 0", targetNum: 0 as number | null,    achieved: wc >= 0,                            importance: "Critique", isMoney: true,  isPercent: false },
    ];
    const healthAchieved = healthChecks.filter(c => c.achieved).length;
    const healthTotal    = healthChecks.length;
    const healthScorePct = Math.round((healthAchieved / healthTotal) * 100);

    // ── Infos organisation ───────────────────────────────────────────────────
    const [orgRow] = await db.select({
      name: organizationsTable.name,
      legalName: organizationsTable.legalName,
      logoUrl: organizationsTable.logoUrl,
      country: organizationsTable.country,
    }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);

    res.json({
      org: {
        name:      orgRow?.name      ?? "Mon Organisation",
        legalName: orgRow?.legalName ?? orgRow?.name ?? "Mon Organisation",
        logoUrl:   orgRow?.logoUrl   ?? null,
        country:   orgRow?.country   ?? "TG",
      },
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
      ytd: {
        revenues: ytdRevenues, expenses: ytdExpenses, netResult: ytdNetResult,
        margin: ytdMargin, oer: ytdOer,
        prevRevenues: prevYtdRevenues, prevExpenses: prevYtdExpenses, prevNetResult: prevYtdNetResult,
        prevMargin: prevYtdMargin, prevOer: prevYtdOer, from: ytdFromStr, to: toIso,
      },
      breakEven: {
        bep: bepPoint, fixedCosts: bepFixedCosts, variableCosts: bepVariableCosts,
        contributionRatio: bepContribRatio, operatingResult: bepOperatingResult,
      },
      healthScore: { score: healthScorePct, achieved: healthAchieved, total: healthTotal, checks: healthChecks },
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

// ── Management Report — Export Excel professionnel ──────────────────────────

router.get("/reports/management/export.xlsx", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const period = parsePeriod(req);
    // Réutiliser le même endpoint via fetch interne serait complexe — on duplique
    // l'essentiel du calcul P&L pour l'export, en appelant les helpers existants.
    const orgId = req.authUser!.organizationId;
    const { fromIso, toIso } = period;
    const prevFrom = new Date(period.from); prevFrom.setFullYear(prevFrom.getFullYear() - 1);
    const prevTo   = new Date(period.to);   prevTo.setFullYear(prevTo.getFullYear()   - 1);
    const prevFromIso = prevFrom.toISOString().slice(0, 10);
    const prevToIso   = prevTo.toISOString().slice(0, 10);

    const [allPeriodLines, prevPeriodLines, orgRow] = await Promise.all([
      db.select({ classNum: chartOfAccountsTable.classNum, accountCode: chartOfAccountsTable.code, accountLabel: chartOfAccountsTable.label, debit: journalEntryLinesTable.debit, credit: journalEntryLinesTable.credit, entryDate: journalEntriesTable.entryDate })
        .from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
        .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
        .where(and(eq(journalEntriesTable.organizationId, orgId), eq(journalEntriesTable.status, "posted"), gte(journalEntriesTable.entryDate, fromIso), lte(journalEntriesTable.entryDate, toIso))),
      db.select({ classNum: chartOfAccountsTable.classNum, debit: journalEntryLinesTable.debit, credit: journalEntryLinesTable.credit })
        .from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
        .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
        .where(and(eq(journalEntriesTable.organizationId, orgId), eq(journalEntriesTable.status, "posted"), gte(journalEntriesTable.entryDate, prevFromIso), lte(journalEntriesTable.entryDate, prevToIso))),
      db.select({ name: organizationsTable.name }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1),
    ]);

    const revenues  = allPeriodLines.filter(l => l.classNum === 7).reduce((s, l) => s + num(l.credit) - num(l.debit), 0);
    const expenses  = allPeriodLines.filter(l => l.classNum === 6).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const netResult = revenues - expenses;
    const depreciation = allPeriodLines.filter(l => l.accountCode?.startsWith("68")).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const ebitda       = netResult + depreciation;
    const grossProfit  = revenues - allPeriodLines.filter(l => l.classNum === 6 && (l.accountCode?.startsWith("60") || l.accountCode?.startsWith("61") || l.accountCode?.startsWith("62"))).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const grossMargin  = revenues > 0 ? Math.round((grossProfit  / revenues) * 1000) / 10 : 0;
    const netMargin    = revenues > 0 ? Math.round((netResult    / revenues) * 1000) / 10 : 0;
    const oer          = revenues > 0 ? Math.round((expenses     / revenues) * 1000) / 10 : 0;
    const prevRevenues = prevPeriodLines.filter(l => l.classNum === 7).reduce((s, l) => s + num(l.credit) - num(l.debit), 0);
    const prevExpenses = prevPeriodLines.filter(l => l.classNum === 6).reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const prevNetResult= prevRevenues - prevExpenses;
    const prevMargin   = prevRevenues > 0 ? Math.round((prevNetResult / prevRevenues) * 1000) / 10 : 0;

    // Séries mensuelles
    const monthlyMap: Record<string, { revenues: number; expenses: number }> = {};
    for (const l of allPeriodLines) {
      const m = (l.entryDate || "").slice(0, 7);
      if (!monthlyMap[m]) monthlyMap[m] = { revenues: 0, expenses: 0 };
      if (l.classNum === 7) monthlyMap[m].revenues += num(l.credit) - num(l.debit);
      if (l.classNum === 6) monthlyMap[m].expenses += num(l.debit)  - num(l.credit);
    }
    const series = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, revenues: Math.round(v.revenues), expenses: Math.round(v.expenses), net: Math.round(v.revenues - v.expenses) }));

    // Ventilation des charges
    const expByAcc: Record<string, { code: string; label: string; amount: number }> = {};
    for (const l of allPeriodLines.filter(ll => ll.classNum === 6)) {
      const k = l.accountCode ?? "??";
      if (!expByAcc[k]) expByAcc[k] = { code: l.accountCode ?? "", label: l.accountLabel ?? k, amount: 0 };
      expByAcc[k].amount += num(l.debit) - num(l.credit);
    }
    const expenseBreakdown = Object.values(expByAcc).filter(e => e.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 15);

    // Projets actifs
    const [projectsRaw, arRaw, apRaw, cashRaw] = await Promise.all([
      db.select({ status: projectsTable.status, budget: projectsTable.budget, progress: projectsTable.progress })
        .from(projectsTable).where(and(eq(projectsTable.organizationId, orgId), isNull(projectsTable.deletedAt))),
      db.select({ totalAmount: invoicesTable.totalAmount, paidAmount: invoicesTable.paidAmount, dueDate: invoicesTable.dueDate })
        .from(invoicesTable)
        .where(and(eq(invoicesTable.organizationId, orgId), ne(invoicesTable.status, "cancelled"), ne(invoicesTable.status, "draft"))),
      db.select({ totalAmount: supplierInvoicesTable.totalAmount, paidAmount: supplierInvoicesTable.paidAmount, dueDate: supplierInvoicesTable.dueDate })
        .from(supplierInvoicesTable)
        .where(and(eq(supplierInvoicesTable.organizationId, orgId), ne(supplierInvoicesTable.status, "cancelled"), ne(supplierInvoicesTable.status, "draft"))),
      db.select({ debit: journalEntryLinesTable.debit, credit: journalEntryLinesTable.credit })
        .from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entryId, journalEntriesTable.id))
        .innerJoin(chartOfAccountsTable, eq(journalEntryLinesTable.accountId, chartOfAccountsTable.id))
        .where(and(eq(journalEntriesTable.organizationId, orgId), eq(journalEntriesTable.status, "posted"), eq(chartOfAccountsTable.classNum, 5), lte(journalEntriesTable.entryDate, toIso))),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const activeProjects   = projectsRaw.filter(p => p.status === "active");
    const avgProgress      = activeProjects.length > 0 ? Math.round(activeProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / activeProjects.length) : 0;
    const totalBudget      = activeProjects.reduce((s, p) => s + num(p.budget), 0);
    const cashPosition     = cashRaw.reduce((s, l) => s + num(l.debit) - num(l.credit), 0);
    const arOutstanding    = arRaw.reduce((s, i) => s + Math.max(0, num(i.totalAmount) - num(i.paidAmount)), 0);
    const arOverdue        = arRaw.filter(i => i.dueDate && i.dueDate < today).reduce((s, i) => s + Math.max(0, num(i.totalAmount) - num(i.paidAmount)), 0);
    const apOutstanding    = apRaw.reduce((s, i) => s + Math.max(0, num(i.totalAmount) - num(i.paidAmount)), 0);
    const workingCapital   = cashPosition + arOutstanding - apOutstanding;

    const orgName = orgRow[0]?.name ?? "Mon Organisation";
    const xls = new ExcelReportBuilder({ orgName, period, reportTitle: "Rapport de Gestion" });

    xls.addCoverSheet("Pilotage de la Performance");

    xls.addSummarySheet([
      ExcelReportBuilder.money("Revenus totaux",                 revenues,      prevRevenues,   "up-good",  "Compte de Résultat"),
      ExcelReportBuilder.money("Charges totales",                expenses,      prevExpenses,   "down-good","Compte de Résultat"),
      ExcelReportBuilder.money("Résultat net",                   netResult,     prevNetResult,  "up-good",  "Compte de Résultat"),
      ExcelReportBuilder.money("Marge brute",                    grossProfit,   null,           "up-good",  "Compte de Résultat"),
      ExcelReportBuilder.money("EBITDA",                         ebitda,        null,           "up-good",  "Compte de Résultat"),
      ExcelReportBuilder.pct("Taux de marge nette",              netMargin,     prevMargin,     "up-good",  "Compte de Résultat"),
      ExcelReportBuilder.pct("Marge brute (%)",                  grossMargin,   null,           "up-good",  "Compte de Résultat"),
      ExcelReportBuilder.pct("Ratio charges/produits",           oer,           null,           "down-good","Compte de Résultat"),
      ExcelReportBuilder.money("Position trésorerie",            cashPosition,  null,           "up-good",  "Trésorerie & BFR"),
      ExcelReportBuilder.money("Créances clients",               arOutstanding, null,           "down-good","Trésorerie & BFR"),
      ExcelReportBuilder.money("Créances en retard",             arOverdue,     null,           "down-good","Trésorerie & BFR"),
      ExcelReportBuilder.money("Dettes fournisseurs",            apOutstanding, null,           "down-good","Trésorerie & BFR"),
      ExcelReportBuilder.money("Fonds de roulement net",         workingCapital,null,           "up-good",  "Trésorerie & BFR"),
      ExcelReportBuilder.num("Projets actifs",                   activeProjects.length, null,   "up-good",  "Opérations"),
      ExcelReportBuilder.pct("Avancement moyen projets",         avgProgress,   null,           "up-good",  "Opérations"),
      ExcelReportBuilder.money("Budget total portefeuille",      totalBudget,   null,           "up-good",  "Opérations"),
    ]);

    // P&L mensuel
    xls.addDataSheet({
      name: "📈 P&L Mensuel",
      title: "Compte de Résultat — Évolution mensuelle",
      cols: [
        { header: "Mois",            key: "month",    width: 12, format: "text"   },
        { header: "Revenus (FCFA)",  key: "revenues", width: 26, format: "money"  },
        { header: "Charges (FCFA)",  key: "expenses", width: 26, format: "money"  },
        { header: "Résultat (FCFA)", key: "net",      width: 26, format: "money"  },
      ],
      rows: series.map(s => [s.month, s.revenues, s.expenses, s.net]),
      totalsRow: true,
    });

    // Budget vs Réel projets
    xls.addVarianceSheet({
      name: "📊 Analyse P&L",
      title: "Comparaison Période N vs N-1",
      items: [
        { label: "Revenus",          budget: prevRevenues,  actual: revenues,   category: "Compte de Résultat" },
        { label: "Charges",          budget: prevExpenses,  actual: expenses,   category: "Compte de Résultat" },
        { label: "Résultat net",     budget: prevNetResult, actual: netResult,  category: "Compte de Résultat" },
        { label: "Créances clients", budget: 0,             actual: arOutstanding, category: "Bilan simplifié" },
        { label: "Dettes fournisseurs", budget: 0,          actual: apOutstanding, category: "Bilan simplifié" },
        { label: "Trésorerie",       budget: 0,             actual: cashPosition,  category: "Bilan simplifié" },
      ],
    });

    // Ventilation charges
    xls.addDataSheet({
      name: "💸 Ventilation Charges",
      title: "Détail des charges par compte SYSCOHADA",
      cols: [
        { header: "Compte",         key: "code",    width: 12, format: "text"   },
        { header: "Libellé",        key: "label",   width: 48, format: "text"   },
        { header: "Montant (FCFA)", key: "amount",  width: 26, format: "money"  },
        { header: "% / Total",      key: "pct",     width: 14, format: "percent" },
      ],
      rows: expenseBreakdown.map(e => [
        e.code, e.label, Math.round(e.amount),
        expenses > 0 ? Math.round((e.amount / expenses) * 1000) / 10 : 0,
      ]),
      totalsRow: true,
    });

    xls.addNotesSheet([
      { title: "Périmètre du rapport de gestion", body: `Rapport de gestion basé sur les écritures comptables validées (statut "posted").\nPériode analysée : ${period.from.toLocaleDateString("fr-FR")} – ${period.to.toLocaleDateString("fr-FR")}.\nComparatif N-1 : ${prevFrom.toLocaleDateString("fr-FR")} – ${prevTo.toLocaleDateString("fr-FR")}.` },
      { title: "Plan comptable SYSCOHADA", body: "Revenus : comptes de classe 7 (Produits)\nCharges : comptes de classe 6 (Charges)\nMarge brute : Revenus – Coûts matières (60x, 61x, 62x)\nEBITDA : Résultat net + Dotations aux amortissements (68x)" },
      { title: "Trésorerie & BFR", body: "Trésorerie nette = solde des comptes de classe 5 cumulé à la date de fin.\nFonds de roulement net = Trésorerie + Créances clients – Dettes fournisseurs.\nDélai de recouvrement (DSO) et délai de règlement fournisseurs (DPO) calculés sur base du CA et des achats journaliers." },
      { title: "Usage du classeur", body: "Ce classeur Excel est conçu pour un usage en Comité de Direction.\nLes formules de la feuille Résumé Exécutif se recalculent automatiquement si les données sont mises à jour.\nLes colonnes Variation et Var. % utilisent IFERROR pour éviter les erreurs de division par zéro." },
    ]);

    await xls.send(res, `rapport-gestion-${period.from.toISOString().slice(0, 10)}.xlsx`);
  } catch (e) { next(e); }
});

// ── Exec Summary Config ──────────────────────────────────────────────────────

const DEFAULT_EXEC_SECTIONS: ExecSummarySectionConfig[] = [
  { id: "commercial",    title: "Performance commerciale",  enabled: true,  order: 0, thresholds: { metric: "revenueChange", greenMin: 5,  orangeMin: 0  } },
  { id: "profitability", title: "Rentabilité",              enabled: true,  order: 1, thresholds: { metric: "margin",        greenMin: 20, orangeMin: 10 } },
  { id: "liquidity",     title: "Liquidité & Trésorerie",   enabled: true,  order: 2, thresholds: { metric: "cashPosition"                               } },
  { id: "operations",    title: "Activité opérationnelle",  enabled: true,  order: 3, thresholds: { metric: "avgProgress",   greenMin: 75, orangeMin: 40 } },
  { id: "hr",            title: "Ressources humaines",      enabled: false, order: 4, thresholds: {}                                                      },
  { id: "receivables",   title: "Créances & Recouvrement",  enabled: false, order: 5, thresholds: { metric: "debtorsDays",   greenMin: 30, orangeMin: 60 } },
];

router.get("/reports/exec-summary-config", requireAuth, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const [cfg] = await db.select().from(execSummaryConfigsTable).where(eq(execSummaryConfigsTable.organizationId, orgId));
    if (!cfg || !cfg.sections?.length) return void res.json({ sections: DEFAULT_EXEC_SECTIONS });
    const savedIds = new Set(cfg.sections.map((s: ExecSummarySectionConfig) => s.id));
    const merged = [
      ...cfg.sections,
      ...DEFAULT_EXEC_SECTIONS.filter(s => !savedIds.has(s.id)).map((s, i) => ({ ...s, order: cfg.sections.length + i })),
    ];
    res.json({ sections: merged });
  } catch (e) { next(e); }
});

router.put("/reports/exec-summary-config", requireAuth, requireManagerOrAbove, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const { sections } = req.body as { sections: ExecSummarySectionConfig[] };
    if (!Array.isArray(sections)) return void res.status(400).json({ error: "sections must be an array" });
    const [existing] = await db.select({ id: execSummaryConfigsTable.id }).from(execSummaryConfigsTable).where(eq(execSummaryConfigsTable.organizationId, orgId));
    if (existing) {
      await db.update(execSummaryConfigsTable).set({ sections, updatedAt: new Date() }).where(eq(execSummaryConfigsTable.organizationId, orgId));
    } else {
      await db.insert(execSummaryConfigsTable).values({ organizationId: orgId, sections });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
