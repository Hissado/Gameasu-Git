/**
 * Migration Templates — génère des fichiers Excel professionnels
 * avec feuille Données + feuille Instructions pour chaque module.
 */
import ExcelJS from "exceljs";
import type { Response } from "express";
import { MODULES, type ModuleDef } from "./migration-engine.js";

const ORANGE = "FFF37021";
const DARK   = "FF1E293B";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
const DARK_FILL:   ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
const LIGHT_FILL:  ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const REQ_FILL:    ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
const OPT_FILL:    ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };

function thinBorder(): ExcelJS.Border {
  return { style: "thin" as const, color: { argb: "FFE2E8F0" } };
}

function allBorders(): Partial<ExcelJS.Borders> {
  const b = thinBorder();
  return { top: b, bottom: b, left: b, right: b };
}

export async function generateTemplate(mod: ModuleDef, res: Response): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gaméasù";
  wb.created = new Date();
  wb.modified = new Date();

  // ── Feuille 1 : Données ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Données", { views: [{ state: "frozen", xSplit: 0, ySplit: 3 }] });
  ws.properties.tabColor = { argb: ORANGE };

  // Titre en A1
  ws.mergeCells("A1", `${colLetter(mod.fields.length)}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = `Template d'import — ${mod.label}  |  Gaméasù`;
  titleCell.fill = DARK_FILL;
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 32;

  // Légende en A2
  ws.mergeCells("A2", `${colLetter(mod.fields.length)}2`);
  const legendCell = ws.getCell("A2");
  legendCell.value = "🟠 Champs obligatoires (fond orangé)   |   🟢 Champs optionnels (fond vert)   |   Ligne 3 = exemple, supprimer avant import";
  legendCell.fill = LIGHT_FILL;
  legendCell.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  legendCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 20;

  // En-têtes en ligne 3
  const headerRow = ws.getRow(3);
  headerRow.height = 26;
  mod.fields.forEach((field, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = `${field.label}${field.required ? " *" : ""}`;
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = allBorders();
    ws.getColumn(colIdx + 1).width = Math.max(field.label.length + 4, 18);
  });

  // Ligne d'exemple en ligne 4
  const exampleRow = ws.getRow(4);
  exampleRow.height = 20;
  mod.fields.forEach((field, colIdx) => {
    const cell = exampleRow.getCell(colIdx + 1);
    cell.value = field.examples;
    cell.fill = field.required ? REQ_FILL : OPT_FILL;
    cell.font = { italic: true, size: 9, color: { argb: "FF94A3B8" } };
    cell.alignment = { vertical: "middle" };
    cell.border = allBorders();
  });

  // 50 lignes vides pour la saisie
  for (let r = 5; r <= 55; r++) {
    const dataRow = ws.getRow(r);
    dataRow.height = 18;
    mod.fields.forEach((field, colIdx) => {
      const cell = dataRow.getCell(colIdx + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: r % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" } };
      cell.border = allBorders();
      if (field.type === "enum" && field.acceptedValues) {
        cell.dataValidation = {
          type: "list",
          allowBlank: !field.required,
          formulae: [`"${field.acceptedValues.join(",")}"`],
          showErrorMessage: true,
          errorTitle: "Valeur invalide",
          error: `Choisir parmi : ${field.acceptedValues.join(", ")}`,
        };
      }
    });
  }

  // Print setup
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.headerFooter.oddHeader = `&L&B${mod.label}&RGaméasù — Template d'import`;
  ws.headerFooter.oddFooter = "&LConfidentiel&CPage &P / &N&RGénéré le " + new Date().toLocaleDateString("fr-FR");

  // ── Feuille 2 : Instructions ────────────────────────────────────────────────
  const wi = wb.addWorksheet("Instructions");
  wi.properties.tabColor = { argb: "FF3B82F6" };

  const iTitle = wi.getCell("A1");
  wi.mergeCells("A1", "G1");
  iTitle.value = `Instructions — Import ${mod.label}`;
  iTitle.fill = DARK_FILL;
  iTitle.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  iTitle.alignment = { vertical: "middle", horizontal: "center" };
  wi.getRow(1).height = 36;

  wi.mergeCells("A2", "G2");
  wi.getCell("A2").value = `${mod.description} — ${mod.fields.length} champs disponibles, dont ${mod.fields.filter(f => f.required).length} obligatoires.`;
  wi.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF475569" } };
  wi.getCell("A2").fill = LIGHT_FILL;
  wi.getRow(2).height = 22;

  // Tableau descriptif des champs
  const iHeader = wi.getRow(4);
  ["Champ", "Obligatoire", "Type", "Exemple", "Valeurs acceptées", "Noms de colonnes reconnus", "Notes"].forEach((h, i) => {
    const c = iHeader.getCell(i + 1);
    c.value = h;
    c.fill = HEADER_FILL;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.border = allBorders();
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  iHeader.height = 24;
  wi.getColumn(1).width = 24;
  wi.getColumn(2).width = 14;
  wi.getColumn(3).width = 14;
  wi.getColumn(4).width = 28;
  wi.getColumn(5).width = 36;
  wi.getColumn(6).width = 48;
  wi.getColumn(7).width = 36;
  wi.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  mod.fields.forEach((field, idx) => {
    const row = wi.getRow(5 + idx);
    row.height = 20;
    const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
    const reqBg = field.required ? "FFFFF3E0" : bg;
    [
      field.label,
      field.required ? "✅ Oui" : "Non",
      { string: "Texte", number: "Nombre", date: "Date (JJ/MM/AAAA)", email: "Email", phone: "Téléphone", enum: "Liste" }[field.type],
      field.examples,
      field.acceptedValues?.join(", ") ?? "—",
      [field.key, ...field.aliases.slice(0, 8)].join(", "),
      field.hint ?? (field.type === "date" ? "Format: JJ/MM/AAAA ou AAAA-MM-JJ" : field.type === "enum" ? "Respecter la casse" : ""),
    ].forEach((val, ci) => {
      const c = row.getCell(ci + 1);
      c.value = val ?? "";
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ci === 0 ? reqBg : bg } };
      c.border = allBorders();
      c.font = { size: 9, bold: ci === 0 };
      c.alignment = { vertical: "middle", wrapText: ci === 5 };
    });
  });

  // ── Feuille 3 : Procédure ───────────────────────────────────────────────────
  const wp = wb.addWorksheet("Procédure");
  wp.properties.tabColor = { argb: "FF10B981" };
  wp.getColumn(1).width = 6;
  wp.getColumn(2).width = 80;

  const steps = [
    ["1", `Ouvrir la feuille "Données" de ce fichier.`],
    ["2", "Remplir les colonnes en respectant les types indiqués dans la feuille Instructions."],
    ["3", "Les colonnes marquées * sont obligatoires. Les autres sont facultatives."],
    ["4", "Supprimer la ligne d'exemple (ligne 4) avant d'importer."],
    ["5", "Enregistrer le fichier au format Excel (.xlsx) ou CSV."],
    ["6", "Dans Gaméasù, aller dans Paramètres → Migration & Import."],
    ["7", "Sélectionner le module correspondant et téléverser votre fichier."],
    ["8", "Vérifier le mapping des colonnes proposé par Gaméasù."],
    ["9", "Lancer la validation pour détecter les erreurs avant l'import."],
    ["10", "Corriger les erreurs signalées, puis lancer l'import définitif."],
    ["11", "Vérifier les données importées dans le module concerné."],
  ];

  wp.mergeCells("A1", "B1");
  const procTitle = wp.getCell("A1");
  procTitle.value = `Procédure d'import — ${mod.label}`;
  procTitle.fill = DARK_FILL;
  procTitle.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  procTitle.alignment = { vertical: "middle", horizontal: "center" };
  wp.getRow(1).height = 32;

  steps.forEach(([num, text], idx) => {
    const r = wp.getRow(3 + idx);
    r.height = 22;
    const numCell = r.getCell(1);
    numCell.value = num;
    numCell.fill = HEADER_FILL;
    numCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    numCell.alignment = { horizontal: "center", vertical: "middle" };
    numCell.border = allBorders();
    const textCell = r.getCell(2);
    textCell.value = text;
    textCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC" } };
    textCell.font = { size: 10 };
    textCell.alignment = { vertical: "middle" };
    textCell.border = allBorders();
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="template-${mod.id}-gameasutech.xlsx"`);
  await wb.xlsx.write(res);
}

export function getModuleTemplate(moduleId: string): ModuleDef | undefined {
  return MODULES.find(m => m.id === moduleId);
}

function colLetter(n: number): string {
  let result = "";
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
