/**
 * ExcelReportBuilder — Professional Excel workbook generator for Gameasu reports.
 * Produces enterprise-grade, multi-sheet, formula-driven Excel files.
 */

import ExcelJS from "exceljs";
import type { Response } from "express";

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  brandDark:     "FF0F1A3A",  // Gameasu navy #0F1A3A
  brandOrange:   "FFC8A24B",  // Gameasu gold #C8A24B
  orange50:      "FFFFF7ED",
  orange100:     "FFFFEDD5",
  slate800:      "FF1E293B",
  slate700:      "FF334155",
  slate600:      "FF475569",
  slate400:      "FF94A3B8",
  slate200:      "FFE2E8F0",
  slate100:      "FFF1F5F9",
  slate50:       "FFF8FAFC",
  white:         "FFFFFFFF",
  green50:       "FFF0FDF4",
  green600:      "FF16A34A",
  green700:      "FF15803D",
  red50:         "FFFEF2F2",
  red600:        "FFDC2626",
  amber50:       "FFFEFCE8",
  amber600:      "FFD97706",
  transparent:   "00000000",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type KpiItem = {
  label: string;
  value: number;
  prevValue?: number | null;
  format?: "money" | "percent" | "number" | "text";
  direction?: "up-good" | "down-good" | "neutral";
  unit?: string;
  category?: string;
};

export type ColDef = {
  header: string;
  key: string;
  width?: number;
  format?: "money" | "percent" | "number" | "date" | "text";
  align?: "left" | "right" | "center";
};

export type NoteItem = { title: string; body: string };

// ─── Formats ─────────────────────────────────────────────────────────────────
const FMT = {
  money:   '#,##0 "FCFA"',
  percent: '0.0"%"',
  number:  "#,##0",
  date:    "DD/MM/YYYY",
  text:    "@",
};

function fmtVal(v: number, fmt: KpiItem["format"] = "number"): string {
  if (fmt === "money") {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " FCFA";
  }
  if (fmt === "percent") return v.toFixed(1) + " %";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);
}

// ─── Border helpers ───────────────────────────────────────────────────────────
const thinBorder = (color: string = C.slate200): Partial<ExcelJS.Borders> => ({
  top:    { style: "thin", color: { argb: color } },
  bottom: { style: "thin", color: { argb: color } },
  left:   { style: "thin", color: { argb: color } },
  right:  { style: "thin", color: { argb: color } },
});
const thickBottom = (color: string = C.brandOrange): Partial<ExcelJS.Borders> => ({
  bottom: { style: "medium", color: { argb: color } },
});

// ─── Worksheet helper (tab color via properties, not options) ─────────────────
function addSheet(wb: ExcelJS.Workbook, name: string, tabColor?: string): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name);
  if (tabColor) ws.properties.tabColor = { argb: tabColor };
  return ws;
}

// ─── ExcelReportBuilder ───────────────────────────────────────────────────────

export class ExcelReportBuilder {
  private wb: ExcelJS.Workbook;
  readonly orgName:  string;
  readonly period:   { from: Date; to: Date };
  readonly reportTitle: string;
  private generatedBy: string;

  constructor(opts: {
    orgName: string;
    period: { from: Date; to: Date };
    reportTitle: string;
    generatedBy?: string;
  }) {
    this.wb          = new ExcelJS.Workbook();
    this.orgName     = opts.orgName;
    this.period      = opts.period;
    this.reportTitle = opts.reportTitle;
    this.generatedBy = opts.generatedBy ?? "Gameasu Platform";

    // Workbook metadata
    this.wb.creator  = this.generatedBy;
    this.wb.created  = new Date();
    this.wb.modified = new Date();
    this.wb.title    = opts.reportTitle;
    this.wb.subject  = opts.orgName;
    this.wb.keywords = "Gameasu, Rapport, Finance, Gestion";
    this.wb.description = `Rapport généré automatiquement par Gameasu pour ${opts.orgName}`;
  }

  // ── 1. Cover sheet ─────────────────────────────────────────────────────────
  addCoverSheet(category = "Rapport de Gestion"): this {
    const ws = addSheet(this.wb, "📋 Couverture", C.brandOrange);
    ws.columns = [
      { width: 4 },
      { width: 32 },
      { width: 32 },
      { width: 28 },
      { width: 4 },
    ];

    const per = this.period;
    const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    // Helper to merge & style
    const set = (r: number, c: number, span: number, v: string | number | null, style: Partial<ExcelJS.Style> = {}) => {
      if (span > 1) ws.mergeCells(r, c, r, c + span - 1);
      const cell = ws.getCell(r, c);
      cell.value = v;
      Object.assign(cell, { style: { ...style } });
      cell.font       = style.font       ?? {};
      cell.fill       = style.fill       ?? { type: "pattern", pattern: "none" };
      cell.alignment  = style.alignment  ?? {};
      cell.border     = style.border     ?? {};
      return cell;
    };

    // Dark header band (rows 1-14)
    for (let r = 1; r <= 14; r++) {
      for (let c = 1; c <= 5; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandDark } };
      }
      ws.getRow(r).height = 20;
    }

    // Row 2: Organization name
    ws.getRow(2).height = 26;
    set(2, 2, 3, this.orgName, {
      font: { name: "Calibri", bold: true, size: 18, color: { argb: C.brandOrange } },
      alignment: { vertical: "middle", horizontal: "left" },
    });

    // Row 4: Category
    ws.getRow(4).height = 16;
    set(4, 2, 3, category.toUpperCase(), {
      font: { name: "Calibri", size: 9, color: { argb: C.slate400 }, bold: true },
      alignment: { vertical: "middle", horizontal: "left" },
    });

    // Row 5-7: Report title
    ws.getRow(5).height = 36;
    set(5, 2, 3, this.reportTitle, {
      font: { name: "Calibri", bold: true, size: 28, color: { argb: C.white } },
      alignment: { vertical: "middle", horizontal: "left" },
    });

    // Row 9: Period
    ws.getRow(9).height = 22;
    set(9, 2, 3, `Période d'analyse : ${fmt(per.from)}  –  ${fmt(per.to)}`, {
      font: { name: "Calibri", size: 12, color: { argb: C.slate200 } },
      alignment: { vertical: "middle", horizontal: "left" },
    });

    // Row 10: Generation date
    set(10, 2, 3, `Rapport généré le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, {
      font: { name: "Calibri", size: 10, color: { argb: C.slate400 } },
      alignment: { vertical: "middle", horizontal: "left" },
    });

    // Row 11: Generated by
    set(11, 2, 3, `Généré par : ${this.generatedBy}`, {
      font: { name: "Calibri", size: 10, color: { argb: C.slate400 } },
      alignment: { vertical: "middle", horizontal: "left" },
    });

    // Orange separator line (row 13)
    ws.getRow(13).height = 4;
    for (let c = 2; c <= 4; c++) {
      ws.getCell(13, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandOrange } };
    }

    // Light area (rows 16+)
    for (let r = 15; r <= 35; r++) {
      ws.getRow(r).height = 20;
      for (let c = 1; c <= 5; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate50 } };
      }
    }

    // Row 16: Metadata grid header
    set(16, 2, 1, "Paramètre", {
      font: { name: "Calibri", bold: true, size: 9, color: { argb: C.slate600 } },
      alignment: { horizontal: "left", indent: 1 },
      border: thinBorder(),
    });
    set(16, 3, 2, "Valeur", {
      font: { name: "Calibri", bold: true, size: 9, color: { argb: C.slate600 } },
      alignment: { horizontal: "left", indent: 1 },
      border: thinBorder(),
    });

    const metaRows: [string, string][] = [
      ["Organisation",       this.orgName],
      ["Titre du rapport",   this.reportTitle],
      ["Catégorie",          category],
      ["Période début",      fmt(per.from)],
      ["Période fin",        fmt(per.to)],
      ["Date de génération", new Date().toLocaleDateString("fr-FR")],
      ["Devise",             "FCFA (XOF)"],
      ["Version",            "1.0"],
      ["Plateforme",         "Gameasu Management Platform"],
    ];
    metaRows.forEach(([key, val], i) => {
      const r = 17 + i;
      ws.getRow(r).height = 18;
      set(r, 2, 1, key, {
        font: { name: "Calibri", size: 10, color: { argb: C.slate700 } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? C.white : C.slate50 } },
        alignment: { horizontal: "left", indent: 1 },
        border: thinBorder(C.slate200),
      });
      set(r, 3, 2, val, {
        font: { name: "Calibri", size: 10, bold: true, color: { argb: C.slate800 } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? C.white : C.slate50 } },
        alignment: { horizontal: "left", indent: 1 },
        border: thinBorder(C.slate200),
      });
    });

    // Confidentiality box (row 30-33)
    for (let r = 30; r <= 33; r++) {
      ws.getRow(r).height = 18;
      for (let c = 2; c <= 4; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.orange50 } };
        ws.getCell(r, c).border = thinBorder(C.brandOrange);
      }
    }
    ws.mergeCells(30, 2, 30, 4);
    ws.getCell(30, 2).value = "⚠  DOCUMENT CONFIDENTIEL";
    ws.getCell(30, 2).font = { name: "Calibri", bold: true, size: 11, color: { argb: C.brandOrange } };
    ws.getCell(30, 2).alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells(31, 2, 33, 4);
    ws.getCell(31, 2).value =
      "Ce document contient des informations financières confidentielles réservées exclusivement à l'usage " +
      "de la Direction, du Conseil d'Administration et des parties prenantes autorisées. " +
      "Toute diffusion non autorisée est strictement interdite.";
    ws.getCell(31, 2).font = { name: "Calibri", size: 9, color: { argb: C.slate700 }, italic: true };
    ws.getCell(31, 2).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    // Print setup
    ws.pageSetup = { fitToPage: true, fitToHeight: 1, fitToWidth: 1, orientation: "portrait" };

    return this;
  }

  // ── 2. KPI Summary sheet ───────────────────────────────────────────────────
  addSummarySheet(kpis: KpiItem[], sheetName = "📊 Résumé Exécutif"): this {
    const ws = addSheet(this.wb, sheetName, C.slate800);
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
    ws.columns = [
      { width: 2 },
      { width: 30 },
      { width: 20 },
      { width: 20 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 2 },
    ];

    // Header rows 1-3
    ws.getRow(1).height = 32;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 24;

    for (let r = 1; r <= 4; r++)
      for (let c = 1; c <= 8; c++)
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandDark } };

    ws.mergeCells("B1:G1");
    ws.getCell("B1").value = `${this.reportTitle} — Résumé Exécutif`;
    ws.getCell("B1").font = { name: "Calibri", bold: true, size: 16, color: { argb: C.white } };
    ws.getCell("B1").alignment = { vertical: "middle", horizontal: "left" };

    ws.mergeCells("B2:G2");
    ws.getCell("B2").value = `${this.orgName}  ·  ${this.period.from.toLocaleDateString("fr-FR")} – ${this.period.to.toLocaleDateString("fr-FR")}`;
    ws.getCell("B2").font = { name: "Calibri", size: 10, color: { argb: C.slate400 } };
    ws.getCell("B2").alignment = { vertical: "middle", horizontal: "left" };

    // Column headers (row 4)
    const hdrs = ["Indicateur", "Valeur", "Période N-1", "Variation", "Var. %", "Statut"];
    hdrs.forEach((h, i) => {
      const cell = ws.getCell(4, 2 + i);
      cell.value = h;
      cell.font  = { name: "Calibri", bold: true, size: 10, color: { argb: C.white } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate700 } };
      cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", indent: i === 0 ? 1 : 0 };
      cell.border = thinBorder(C.slate600);
    });

    // KPI rows
    let currentCat = "";
    let dataRow = 5;

    for (const kpi of kpis) {
      // Category separator
      if (kpi.category && kpi.category !== currentCat) {
        currentCat = kpi.category;
        ws.getRow(dataRow).height = 22;
        for (let c = 1; c <= 8; c++)
          ws.getCell(dataRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate800 } };
        ws.mergeCells(dataRow, 2, dataRow, 7);
        ws.getCell(dataRow, 2).value = kpi.category.toUpperCase();
        ws.getCell(dataRow, 2).font = { name: "Calibri", bold: true, size: 9, color: { argb: C.brandOrange } };
        ws.getCell(dataRow, 2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        dataRow++;
      }

      const row = ws.getRow(dataRow);
      row.height = 22;
      const isAlt = (dataRow % 2 === 0);
      const bg = isAlt ? C.slate50 : C.white;

      for (let c = 1; c <= 8; c++)
        ws.getCell(dataRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

      // Label
      const labelCell = ws.getCell(dataRow, 2);
      labelCell.value = kpi.label;
      labelCell.font  = { name: "Calibri", size: 11, color: { argb: C.slate800 } };
      labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      labelCell.border = thinBorder(C.slate200);

      // Value
      const valCell = ws.getCell(dataRow, 3);
      valCell.value = kpi.value;
      valCell.numFmt = kpi.format === "money" ? FMT.money : kpi.format === "percent" ? FMT.percent : FMT.number;
      valCell.font   = { name: "Calibri", bold: true, size: 11, color: { argb: C.slate800 } };
      valCell.alignment = { vertical: "middle", horizontal: "right" };
      valCell.border = thinBorder(C.slate200);

      // Prev value
      const prevCell = ws.getCell(dataRow, 4);
      prevCell.value     = kpi.prevValue ?? null;
      prevCell.numFmt    = kpi.format === "money" ? FMT.money : kpi.format === "percent" ? FMT.percent : FMT.number;
      prevCell.font      = { name: "Calibri", size: 10, color: { argb: C.slate400 } };
      prevCell.alignment = { vertical: "middle", horizontal: "right" };
      prevCell.border    = thinBorder(C.slate200);

      // Absolute variance (formula-driven)
      const varCell = ws.getCell(dataRow, 5);
      if (kpi.prevValue != null && kpi.prevValue !== 0) {
        varCell.value  = { formula: `C${dataRow}-D${dataRow}` };
        varCell.numFmt = kpi.format === "money" ? FMT.money : kpi.format === "percent" ? FMT.percent : FMT.number;
        varCell.font   = { name: "Calibri", size: 10 };
      } else {
        varCell.value = "—";
      }
      varCell.alignment = { vertical: "middle", horizontal: "right" };
      varCell.border    = thinBorder(C.slate200);

      // % variance (formula)
      const pctCell = ws.getCell(dataRow, 6);
      if (kpi.prevValue != null && kpi.prevValue !== 0) {
        pctCell.value  = { formula: `IFERROR((C${dataRow}-D${dataRow})/ABS(D${dataRow}),0)` };
        pctCell.numFmt = '0.0"%"';
        pctCell.font   = { name: "Calibri", size: 10 };
      } else {
        pctCell.value = "—";
      }
      pctCell.alignment = { vertical: "middle", horizontal: "center" };
      pctCell.border    = thinBorder(C.slate200);

      // Status indicator (formula-driven)
      const statusCell = ws.getCell(dataRow, 7);
      if (kpi.prevValue != null && kpi.prevValue !== 0) {
        const goodSign = kpi.direction === "down-good" ? "<" : ">";
        statusCell.value = {
          formula: `IF(E${dataRow}${goodSign}0,"✅ Favorable",IF(ABS(F${dataRow})<=5,"⚠️ Stable","❌ Défavorable"))`,
        };
      } else {
        statusCell.value = "◼ N/A";
      }
      statusCell.font = { name: "Calibri", size: 10 };
      statusCell.alignment = { vertical: "middle", horizontal: "center" };
      statusCell.border = thinBorder(C.slate200);

      dataRow++;
    }

    // Total row
    ws.getRow(dataRow).height = 4;
    for (let c = 1; c <= 8; c++)
      ws.getCell(dataRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandOrange } };

    // Conditional formatting for variance column (col 6 = F)
    const dataRange = `F5:F${dataRow - 1}`;
    ws.addConditionalFormatting({
      ref: dataRange,
      rules: [
        {
          type: "cellIs", operator: "greaterThan", formulae: ["0"], priority: 1,
          style: { font: { color: { argb: C.green600 }, bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: C.green50 } } },
        },
        {
          type: "cellIs", operator: "lessThan", formulae: ["0"], priority: 2,
          style: { font: { color: { argb: C.red600 }, bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: C.red50 } } },
        },
      ],
    });

    ws.pageSetup = {
      fitToPage: true, fitToHeight: 0, fitToWidth: 1,
      orientation: "landscape",
      printTitlesRow: "4:4",
    };

    return this;
  }

  // ── 3. Formatted data sheet ────────────────────────────────────────────────
  addDataSheet(opts: {
    name: string;
    title?: string;
    cols: ColDef[];
    rows: (string | number | null)[][];
    freezeRows?: number;
    totalsRow?: boolean;
    tabColor?: string;
  }): this {
    const ws = addSheet(this.wb, opts.name, opts.tabColor ?? C.slate700);

    // Period sub-header
    ws.columns = [
      { width: 2 },
      ...opts.cols.map(c => ({ width: c.width ?? 20 })),
      { width: 2 },
    ];

    // Title rows
    ws.getRow(1).height = 28;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 20;

    const totalCols = opts.cols.length + 2;
    for (let r = 1; r <= 3; r++)
      for (let c = 1; c <= totalCols; c++)
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandDark } };

    ws.mergeCells(1, 2, 1, totalCols - 1);
    ws.getCell(1, 2).value = opts.title ?? opts.name;
    ws.getCell(1, 2).font = { name: "Calibri", bold: true, size: 14, color: { argb: C.white } };
    ws.getCell(1, 2).alignment = { vertical: "middle", horizontal: "left" };

    ws.mergeCells(2, 2, 2, totalCols - 1);
    ws.getCell(2, 2).value = `${this.orgName}  ·  ${this.period.from.toLocaleDateString("fr-FR")} – ${this.period.to.toLocaleDateString("fr-FR")}`;
    ws.getCell(2, 2).font = { name: "Calibri", size: 9, color: { argb: C.slate400 } };
    ws.getCell(2, 2).alignment = { vertical: "middle", horizontal: "left" };

    // Column header row (row 3)
    opts.cols.forEach((col, i) => {
      const cell = ws.getCell(3, 2 + i);
      cell.value = col.header;
      cell.font  = { name: "Calibri", bold: true, size: 10, color: { argb: C.white } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate700 } };
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align ?? (col.format === "text" || col.format === undefined ? "left" : "right"),
        indent: 1,
      };
      cell.border = thinBorder(C.slate600);
    });

    ws.views = [{ state: "frozen", xSplit: 0, ySplit: opts.freezeRows ?? 3 }];

    // Data rows
    const startRow = 4;
    opts.rows.forEach((rowData, ri) => {
      const r = startRow + ri;
      const row = ws.getRow(r);
      row.height = 18;
      const bg = ri % 2 === 0 ? C.white : C.slate50;
      for (let c = 1; c <= totalCols; c++)
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

      rowData.forEach((val, i) => {
        const col = opts.cols[i];
        if (!col) return;
        const cell = ws.getCell(r, 2 + i);
        cell.value = val;
        cell.font  = { name: "Calibri", size: 10, color: { argb: C.slate800 } };
        cell.alignment = {
          vertical: "middle",
          horizontal: col.align ?? (col.format === "text" || col.format === undefined || col.format === "date" ? "left" : "right"),
          indent: 1,
        };
        cell.border = thinBorder(C.slate200);
        if (col.format && col.format !== "text") cell.numFmt = FMT[col.format];
      });
    });

    // Totals row (SUM formulas)
    if (opts.totalsRow && opts.rows.length > 0) {
      const totRow = startRow + opts.rows.length;
      ws.getRow(totRow).height = 22;
      for (let c = 1; c <= totalCols; c++)
        ws.getCell(totRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate800 } };

      ws.getCell(totRow, 2).value = "TOTAL";
      ws.getCell(totRow, 2).font  = { name: "Calibri", bold: true, size: 10, color: { argb: C.white } };
      ws.getCell(totRow, 2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

      opts.cols.forEach((col, i) => {
        if (col.format !== "money" && col.format !== "number") return;
        const colLetter = String.fromCharCode(66 + i); // B=66
        const cell = ws.getCell(totRow, 2 + i);
        cell.value  = { formula: `SUM(${colLetter}${startRow}:${colLetter}${totRow - 1})` };
        cell.numFmt = col.format === "money" ? FMT.money : FMT.number;
        cell.font   = { name: "Calibri", bold: true, size: 10, color: { argb: C.white } };
        cell.alignment = { vertical: "middle", horizontal: "right" };
      });
    }

    // Auto-filter on header row
    if (opts.rows.length > 0) {
      const lastCol = String.fromCharCode(65 + opts.cols.length); // offset by 1 for col B start
      ws.autoFilter = { from: { row: 3, column: 2 }, to: { row: 3, column: 1 + opts.cols.length } };
    }

    // Print setup
    ws.pageSetup = {
      fitToPage: true, fitToHeight: 0, fitToWidth: 1,
      orientation: "landscape",
      printTitlesRow: "3:3",
    };
    ws.headerFooter = {
      oddHeader: `&L&"Calibri,Bold"${this.orgName}&C${opts.title ?? opts.name}&R&"Calibri"&D`,
      oddFooter:  `&LConfidentiel — Usage interne&C&P / &N&RGameasu Platform`,
    };

    return this;
  }

  // ── 4. Variance / analysis sheet ─────────────────────────────────────────
  addVarianceSheet(opts: {
    name?: string;
    title?: string;
    items: Array<{
      label: string;
      budget: number;
      actual: number;
      category?: string;
    }>;
  }): this {
    const sheetName = opts.name ?? "📈 Budget vs Réel";
    const ws = addSheet(this.wb, sheetName, C.green700);

    ws.columns = [
      { width: 2 },
      { width: 36 },
      { width: 20 },
      { width: 20 },
      { width: 18 },
      { width: 14 },
      { width: 14 },
      { width: 2 },
    ];

    // Header
    ws.getRow(1).height = 28;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 22;
    for (let r = 1; r <= 3; r++)
      for (let c = 1; c <= 8; c++)
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandDark } };

    ws.mergeCells("B1:G1");
    ws.getCell("B1").value = opts.title ?? "Analyse Budget vs Réel";
    ws.getCell("B1").font  = { name: "Calibri", bold: true, size: 14, color: { argb: C.white } };
    ws.getCell("B1").alignment = { vertical: "middle", horizontal: "left" };

    ws.mergeCells("B2:G2");
    ws.getCell("B2").value = `${this.orgName}  ·  ${this.period.from.toLocaleDateString("fr-FR")} – ${this.period.to.toLocaleDateString("fr-FR")}`;
    ws.getCell("B2").font  = { name: "Calibri", size: 9, color: { argb: C.slate400 } };
    ws.getCell("B2").alignment = { vertical: "middle", horizontal: "left" };

    // Col headers
    ["Ligne", "Budget", "Réalisé", "Écart absolu", "Écart %", "Statut"].forEach((h, i) => {
      const cell = ws.getCell(3, 2 + i);
      cell.value = h;
      cell.font  = { name: "Calibri", bold: true, size: 10, color: { argb: C.white } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate700 } };
      cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", indent: i === 0 ? 1 : 0 };
      cell.border = thinBorder(C.slate600);
    });

    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

    let dataRow = 4;
    let currentCat = "";

    for (const item of opts.items) {
      if (item.category && item.category !== currentCat) {
        currentCat = item.category;
        const r = dataRow++;
        ws.getRow(r).height = 20;
        for (let c = 1; c <= 8; c++)
          ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate800 } };
        ws.mergeCells(r, 2, r, 7);
        ws.getCell(r, 2).value = item.category.toUpperCase();
        ws.getCell(r, 2).font  = { name: "Calibri", bold: true, size: 9, color: { argb: C.brandOrange } };
        ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      }

      const r = dataRow;
      const bg = (r % 2 === 0) ? C.white : C.slate50;
      ws.getRow(r).height = 18;
      for (let c = 1; c <= 8; c++)
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

      // Label
      ws.getCell(r, 2).value = item.label;
      ws.getCell(r, 2).font  = { name: "Calibri", size: 10, color: { argb: C.slate800 } };
      ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      ws.getCell(r, 2).border = thinBorder(C.slate200);

      // Budget
      ws.getCell(r, 3).value = item.budget;
      ws.getCell(r, 3).numFmt = FMT.money;
      ws.getCell(r, 3).font = { name: "Calibri", size: 10 };
      ws.getCell(r, 3).alignment = { vertical: "middle", horizontal: "right" };
      ws.getCell(r, 3).border = thinBorder(C.slate200);

      // Actual
      ws.getCell(r, 4).value = item.actual;
      ws.getCell(r, 4).numFmt = FMT.money;
      ws.getCell(r, 4).font = { name: "Calibri", size: 10, bold: true };
      ws.getCell(r, 4).alignment = { vertical: "middle", horizontal: "right" };
      ws.getCell(r, 4).border = thinBorder(C.slate200);

      // Écart (formula)
      ws.getCell(r, 5).value = { formula: `D${r}-C${r}` };
      ws.getCell(r, 5).numFmt = FMT.money;
      ws.getCell(r, 5).font = { name: "Calibri", size: 10 };
      ws.getCell(r, 5).alignment = { vertical: "middle", horizontal: "right" };
      ws.getCell(r, 5).border = thinBorder(C.slate200);

      // % écart (formula)
      ws.getCell(r, 6).value = { formula: `IFERROR((D${r}-C${r})/ABS(C${r}),0)` };
      ws.getCell(r, 6).numFmt = '0.0"%"';
      ws.getCell(r, 6).font = { name: "Calibri", size: 10 };
      ws.getCell(r, 6).alignment = { vertical: "middle", horizontal: "center" };
      ws.getCell(r, 6).border = thinBorder(C.slate200);

      // Statut
      ws.getCell(r, 7).value = { formula: `IF(E${r}>0,"✅ Favorable",IF(ABS(E${r})<C${r}*0.05,"⚠️ Écart mineur","❌ Dépassement"))` };
      ws.getCell(r, 7).font  = { name: "Calibri", size: 10 };
      ws.getCell(r, 7).alignment = { vertical: "middle", horizontal: "center" };
      ws.getCell(r, 7).border = thinBorder(C.slate200);

      dataRow++;
    }

    // Conditional formatting
    ws.addConditionalFormatting({
      ref: `E4:E${dataRow - 1}`,
      rules: [
        { type: "cellIs", operator: "greaterThan",  formulae: ["0"], priority: 1, style: { font: { color: { argb: C.green600 }, bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: C.green50 } } } },
        { type: "cellIs", operator: "lessThan",     formulae: ["0"], priority: 2, style: { font: { color: { argb: C.red600 },   bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: C.red50 }   } } },
      ],
    });

    ws.autoFilter = { from: { row: 3, column: 2 }, to: { row: 3, column: 7 } };
    ws.pageSetup  = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape", printTitlesRow: "3:3" };

    return this;
  }

  // ── 5. Notes / methodology sheet ──────────────────────────────────────────
  addNotesSheet(notes: NoteItem[]): this {
    const ws = addSheet(this.wb, "📝 Notes & Méthodologie", C.slate400);
    ws.columns = [{ width: 2 }, { width: 24 }, { width: 68 }, { width: 2 }];

    ws.getRow(1).height = 28;
    for (let c = 1; c <= 4; c++)
      ws.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandDark } };
    ws.mergeCells("B1:C1");
    ws.getCell("B1").value = "Notes, Méthodologie & Hypothèses";
    ws.getCell("B1").font  = { name: "Calibri", bold: true, size: 14, color: { argb: C.white } };
    ws.getCell("B1").alignment = { vertical: "middle", horizontal: "left" };

    let r = 3;
    notes.forEach((note, i) => {
      ws.getRow(r).height = 22;
      ws.mergeCells(r, 2, r, 3);
      ws.getCell(r, 2).value = `${i + 1}. ${note.title}`;
      ws.getCell(r, 2).font  = { name: "Calibri", bold: true, size: 11, color: { argb: C.brandOrange } };
      ws.getCell(r, 2).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.orange50 } };
      ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      ws.getCell(r, 2).border = { ...thickBottom(), ...thinBorder() } as ExcelJS.Borders;
      r++;

      ws.getRow(r).height = 14;
      r++;

      const lines = note.body.split("\n").filter(Boolean);
      lines.forEach(line => {
        ws.getRow(r).height = 18;
        ws.getCell(r, 2).value = "▸";
        ws.getCell(r, 2).font  = { name: "Calibri", size: 10, color: { argb: C.brandOrange } };
        ws.getCell(r, 3).value = line;
        ws.getCell(r, 3).font  = { name: "Calibri", size: 10, color: { argb: C.slate700 } };
        ws.getCell(r, 3).alignment = { vertical: "top", wrapText: true };
        r++;
      });
      r += 2;
    });

    // Audit trail
    ws.getRow(r).height = 20;
    ws.mergeCells(r, 2, r, 3);
    ws.getCell(r, 2).value = "Informations d'audit";
    ws.getCell(r, 2).font  = { name: "Calibri", bold: true, size: 10, color: { argb: C.slate600 } };
    ws.getCell(r, 2).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate100 } };
    r++;
    const auditLines = [
      `Organisation : ${this.orgName}`,
      `Rapport : ${this.reportTitle}`,
      `Période : ${this.period.from.toLocaleDateString("fr-FR")} – ${this.period.to.toLocaleDateString("fr-FR")}`,
      `Date de génération : ${new Date().toLocaleString("fr-FR")}`,
      `Généré par : ${this.generatedBy}`,
      `Devise : FCFA (XOF)`,
    ];
    auditLines.forEach(line => {
      ws.getRow(r).height = 18;
      ws.mergeCells(r, 2, r, 3);
      ws.getCell(r, 2).value = line;
      ws.getCell(r, 2).font  = { name: "Calibri", size: 9, italic: true, color: { argb: C.slate400 } };
      ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      r++;
    });

    return this;
  }

  // ── Send response ─────────────────────────────────────────────────────────
  async send(res: Response, filename: string): Promise<void> {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await this.wb.xlsx.write(res);
    res.end();
  }

  // ── Quick KPI list helper ─────────────────────────────────────────────────
  static money(label: string, value: number, prev?: number | null, dir: KpiItem["direction"] = "up-good", cat?: string): KpiItem {
    return { label, value, prevValue: prev ?? null, format: "money", direction: dir, category: cat };
  }
  static pct(label: string, value: number, prev?: number | null, dir: KpiItem["direction"] = "up-good", cat?: string): KpiItem {
    return { label, value, prevValue: prev ?? null, format: "percent", direction: dir, category: cat };
  }
  static num(label: string, value: number, prev?: number | null, dir: KpiItem["direction"] = "up-good", cat?: string): KpiItem {
    return { label, value, prevValue: prev ?? null, format: "number", direction: dir, category: cat };
  }
}
