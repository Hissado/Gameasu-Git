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
  wb.creator = "Gameasu";
  wb.created = new Date();
  wb.modified = new Date();

  // ── Feuille 1 : Données ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Données", { views: [{ state: "frozen", xSplit: 0, ySplit: 3 }] });
  ws.properties.tabColor = { argb: ORANGE };

  // Titre en A1
  ws.mergeCells("A1", `${colLetter(mod.fields.length)}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = `Template d'import — ${mod.label}  |  Gameasu`;
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
  ws.headerFooter.oddHeader = `&L&B${mod.label}&RGameasu — Template d'import`;
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
    ["6", "Dans Gameasu, aller dans Paramètres → Migration & Import."],
    ["7", "Sélectionner le module correspondant et téléverser votre fichier."],
    ["8", "Vérifier le mapping des colonnes proposé par Gameasu."],
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

// ── Template complet d'intégration ────────────────────────────────────────────

export async function generateCompleteTemplate(res: Response): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gameasu";
  wb.created = new Date();

  // ── Onglet 1 : Guide d'intégration ──────────────────────────────────────
  const wg = wb.addWorksheet("Guide d'intégration");
  wg.properties.tabColor = { argb: ORANGE };
  wg.getColumn(1).width = 6;
  wg.getColumn(2).width = 36;
  wg.getColumn(3).width = 22;
  wg.getColumn(4).width = 30;

  wg.mergeCells("A1", "D1");
  const gtitle = wg.getCell("A1");
  gtitle.value = "Template complet d'intégration — Gaméasù";
  gtitle.fill = DARK_FILL;
  gtitle.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  gtitle.alignment = { vertical: "middle", horizontal: "center" };
  wg.getRow(1).height = 44;

  wg.mergeCells("A2", "D2");
  const gsub = wg.getCell("A2");
  gsub.value = `Généré le ${new Date().toLocaleDateString("fr-FR")}  |  Chaque onglet correspond à un module Gameasu`;
  gsub.fill = LIGHT_FILL;
  gsub.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  gsub.alignment = { vertical: "middle", horizontal: "center" };
  wg.getRow(2).height = 22;

  wg.mergeCells("A4", "D4");
  const ordreTitle = wg.getCell("A4");
  ordreTitle.value = "Ordre recommandé d'importation";
  ordreTitle.fill = HEADER_FILL;
  ordreTitle.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  ordreTitle.alignment = { vertical: "middle", horizontal: "center" };
  wg.getRow(4).height = 28;

  const orderHeader = wg.getRow(5);
  ["#", "Module", "Onglet dans ce fichier", "Remarque"].forEach((h, i) => {
    const c = orderHeader.getCell(i + 1);
    c.value = h; c.fill = HEADER_FILL;
    c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.border = allBorders(); c.alignment = { vertical: "middle", horizontal: "center" };
  });
  orderHeader.height = 22;

  const ORDER = [
    [1,  "Départements",       "departments",      "À importer en premier (référencé par collaborateurs)"],
    [2,  "Utilisateurs",       "users",            "Mot de passe temporaire généré automatiquement"],
    [3,  "Plan comptable",     "chart_of_accounts","Comptes SYSCOHADA + balances d'ouverture"],
    [4,  "Clients",            "clients",          "Clients et prospects CRM"],
    [5,  "Contacts clients",   "contacts",         "Importer après les clients"],
    [6,  "Fournisseurs",       "suppliers",        "Sous-traitants, prestataires"],
    [7,  "Produits & Services","services",         "Catalogue facturable"],
    [8,  "Factures clients",   "invoices",         "Soldes ouverts — importer après clients"],
    [9,  "Encaissements",      "payments",         "Importer après les factures"],
    [10, "Collaborateurs",     "collaborators",    "RH — importer après départements"],
    [11, "Projets",            "projects",         "Portefeuille chantiers"],
    [12, "Équipements",        "equipment",        "Parc matériel"],
  ];

  ORDER.forEach(([num, label, sheet, note], idx) => {
    const r = wg.getRow(6 + idx);
    r.height = 20;
    const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
    const cells = [num, label, sheet, note];
    cells.forEach((val, ci) => {
      const c = r.getCell(ci + 1);
      c.value = val as string | number;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ci === 0 ? ORANGE : bg } };
      c.font = { size: 9, bold: ci === 0, color: { argb: ci === 0 ? "FFFFFFFF" : "FF1E293B" } };
      c.border = allBorders();
      c.alignment = { vertical: "middle" };
    });
  });

  // Légende
  const legRow = wg.getRow(6 + ORDER.length + 2);
  wg.mergeCells(`A${legRow.number}`, `D${legRow.number}`);
  legRow.getCell(1).value = "💡 Comment utiliser ce fichier : Ouvrez l'onglet du module voulu → remplissez les données → supprimez la ligne Exemple → importez dans Gameasu via Admin > Migration & Import";
  legRow.getCell(1).font = { italic: true, size: 9, color: { argb: "FF475569" } };
  legRow.getCell(1).fill = LIGHT_FILL;
  legRow.height = 32;
  legRow.getCell(1).alignment = { wrapText: true, vertical: "middle" };

  // ── Onglet par module ────────────────────────────────────────────────────
  for (const mod of MODULES) {
    const ws = wb.addWorksheet(mod.label.slice(0, 31)); // Excel tab max 31 chars
    ws.properties.tabColor = { argb: mod.category === "RH" ? "FF8B5CF6" : mod.category === "Ventes" ? "FF10B981" : mod.category === "Comptabilité" ? "FFF59E0B" : mod.category === "Admin" ? "FF3B82F6" : ORANGE };
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

    // Titre
    ws.mergeCells("A1", `${colLetter(mod.fields.length)}1`);
    const tc = ws.getCell("A1");
    tc.value = `${mod.label} — Template d'import Gaméasù`;
    tc.fill = DARK_FILL; tc.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    tc.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 28;

    // Légende
    ws.mergeCells("A2", `${colLetter(mod.fields.length)}2`);
    const lc = ws.getCell("A2");
    lc.value = `🟠 Obligatoire * | 🟢 Optionnel | ${mod.fields.filter(f => f.required).length} champ(s) obligatoire(s) sur ${mod.fields.length}`;
    lc.fill = LIGHT_FILL; lc.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    lc.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(2).height = 18;

    // Headers
    const hr = ws.getRow(3);
    hr.height = 24;
    mod.fields.forEach((field, ci) => {
      const c = hr.getCell(ci + 1);
      c.value = `${field.label}${field.required ? " *" : ""}`;
      c.fill = HEADER_FILL; c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
      c.border = allBorders();
      ws.getColumn(ci + 1).width = Math.max(field.label.length + 4, 16);
    });

    // Example row
    const er = ws.getRow(4);
    er.height = 18;
    mod.fields.forEach((field, ci) => {
      const c = er.getCell(ci + 1);
      c.value = field.examples;
      c.fill = field.required ? REQ_FILL : OPT_FILL;
      c.font = { italic: true, size: 9, color: { argb: "FF94A3B8" } };
      c.border = allBorders();
      if (field.type === "enum" && field.acceptedValues) {
        c.dataValidation = { type: "list", allowBlank: !field.required, formulae: [`"${field.acceptedValues.join(",")}"`] };
      }
    });

    // 40 blank rows
    for (let r = 5; r <= 45; r++) {
      const dr = ws.getRow(r);
      dr.height = 17;
      mod.fields.forEach((field, ci) => {
        const c = dr.getCell(ci + 1);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: r % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" } };
        c.border = allBorders();
        if (field.type === "enum" && field.acceptedValues) {
          c.dataValidation = { type: "list", allowBlank: !field.required, formulae: [`"${field.acceptedValues.join(",")}"`] };
        }
      });
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="template-complet-integration-gameasu.xlsx"');
  await wb.xlsx.write(res);
}

// ── Rapport d'erreurs Excel ────────────────────────────────────────────────────

export async function generateErrorReport(
  sessionId: string,
  moduleName: string,
  errors: Array<{ row: number; message: string }>,
  res: Response,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gameasu";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rapport d'erreurs");
  ws.properties.tabColor = { argb: "FFEF4444" };
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

  // Titre
  ws.mergeCells("A1", "D1");
  const t = ws.getCell("A1");
  t.value = `Rapport d'erreurs d'import — ${moduleName}`;
  t.fill = DARK_FILL; t.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  t.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  ws.mergeCells("A2", "D2");
  const sub = ws.getCell("A2");
  sub.value = `Session : ${sessionId}  |  ${errors.length} erreur(s) détectée(s)  |  Généré le ${new Date().toLocaleDateString("fr-FR")}`;
  sub.fill = LIGHT_FILL; sub.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  sub.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 20;

  // Headers
  const hr = ws.getRow(3);
  hr.height = 24;
  ["N° Ligne", "Message d'erreur", "Action recommandée"].forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h; c.fill = HEADER_FILL;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.border = allBorders(); c.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 60;
  ws.getColumn(3).width = 50;

  // Error rows
  errors.forEach((err, idx) => {
    const r = ws.getRow(4 + idx);
    r.height = 20;
    const bg = idx % 2 === 0 ? "FFFEF2F2" : "FFFFFFFF";

    const rowCell = r.getCell(1);
    rowCell.value = err.row;
    rowCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } };
    rowCell.font = { bold: true, size: 9 }; rowCell.border = allBorders();
    rowCell.alignment = { vertical: "middle", horizontal: "center" };

    const msgCell = r.getCell(2);
    msgCell.value = err.message;
    msgCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    msgCell.font = { size: 9 }; msgCell.border = allBorders();
    msgCell.alignment = { vertical: "middle", wrapText: true };

    const actionCell = r.getCell(3);
    actionCell.value = guessAction(err.message);
    actionCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
    actionCell.font = { size: 9, italic: true, color: { argb: "FFF97316" } };
    actionCell.border = allBorders();
    actionCell.alignment = { vertical: "middle", wrapText: true };
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="rapport-erreurs-${sessionId.slice(0, 8)}.xlsx"`);
  await wb.xlsx.write(res);
}

function guessAction(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("manquant") || m.includes("obligatoire")) return "Remplir le champ obligatoire indiqué";
  if (m.includes("email")) return "Vérifier le format de l'email (ex: nom@domaine.com)";
  if (m.includes("date")) return "Utiliser le format JJ/MM/AAAA (ex: 01/01/2024)";
  if (m.includes("montant") || m.includes("numérique")) return "Entrer un nombre sans espaces ni symboles (ex: 150000)";
  if (m.includes("introuvable")) return "Vérifier que l'entrée référencée a bien été importée avant";
  if (m.includes("déjà existant") || m.includes("conflict")) return "Modifier le code/référence pour le rendre unique";
  if (m.includes("valeur") && m.includes("acceptée")) return "Consulter la colonne Valeurs acceptées dans la feuille Instructions";
  return "Corriger la valeur et re-importer le fichier corrigé";
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
