/**
 * Générateur de PDF pour scénarios de tarification (PDFKit)
 * Format professionnel Gameasu — FCFA
 */
import PDFDocument from "pdfkit";
import type { Writable } from "stream";

export interface PricingPdfData {
  scenarioName: string;
  description?: string | null;
  productName?: string | null;
  clientName?: string | null;
  category?: string | null;
  unit?: string | null;
  quantity?: number | null;
  period?: string | null;
  notes?: string | null;
  shareUrl?: string | null;
  generatedAt: string;
  costBreakdown: { label: string; amount: number; pct: number }[];
  totalCost: number;
  minimumPriceHT: number;
  recommendedPriceHT: number;
  finalPriceHT: number;
  finalPriceTTC: number;
  taxRate: number;
  taxAmount: number;
  grossMarginPct: number;
  netMarginPct: number;
  netProfit: number;
  corporateTax: number;
  marginMode: string;
  marginTarget: number;
  discountPct?: number;
  discountAmount?: number;
  priceHTBrut?: number;
}

export interface OrgPdfData {
  name: string;
  legalName?: string | null;
  address?: string | null;
  taxId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

function fcfa(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " FCFA";
}

function pct(v: number): string {
  return v.toFixed(1) + " %";
}

const GOLD   = "#C8A24B";
const DARK   = "#0F172A";
const GRAY   = "#64748B";
const LIGHT  = "#F8FAFC";
const GREEN  = "#059669";
const RED    = "#DC2626";
const AMBER  = "#D97706";
const BORDER = "#E2E8F0";

export function generatePricingPdf(data: PricingPdfData, org: OrgPdfData, output: Writable): void {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  doc.pipe(output);

  const W = 515;
  let y = 40;

  // ── En-tête : bandeau doré ──────────────────────────────────────────────────
  doc.rect(40, y, W, 58).fill(DARK);

  doc.fontSize(16).font("Helvetica-Bold").fillColor(GOLD)
    .text(org.name.toUpperCase(), 55, y + 9, { width: 300 });
  if (org.legalName && org.legalName !== org.name) {
    doc.fontSize(8).font("Helvetica").fillColor("#94A3B8")
      .text(org.legalName, 55, y + 28, { width: 300 });
  }

  doc.fontSize(13).font("Helvetica-Bold").fillColor("white")
    .text("ANALYSE TARIFAIRE", 370, y + 10, { width: 180, align: "right" });
  doc.fontSize(8).font("Helvetica").fillColor(GOLD)
    .text(data.generatedAt, 370, y + 28, { width: 180, align: "right" });
  doc.fontSize(7).font("Helvetica").fillColor("#94A3B8")
    .text("Gameasu · Pricing stratégique", 370, y + 40, { width: 180, align: "right" });

  y += 66;

  // ── Info organisation (sous-header) ──────────────────────────────────────────
  if (org.address || org.taxId || org.contactEmail || org.contactPhone) {
    doc.rect(40, y, W, 18).fill(LIGHT).stroke(BORDER);
    const infoParts: string[] = [];
    if (org.address) infoParts.push(org.address);
    if (org.taxId) infoParts.push(`NIF : ${org.taxId}`);
    if (org.contactPhone) infoParts.push(`Tél : ${org.contactPhone}`);
    if (org.contactEmail) infoParts.push(org.contactEmail);
    doc.fontSize(7.5).font("Helvetica").fillColor(GRAY)
      .text(infoParts.join("  •  "), 50, y + 5, { width: W - 20 });
    y += 24;
  }

  // ── Bloc scénario + client ───────────────────────────────────────────────────
  const halfW = (W - 8) / 2;

  doc.rect(40, y, halfW, 78).fill(LIGHT).stroke(BORDER);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(GRAY).text("SCÉNARIO", 50, y + 8);
  doc.fontSize(11).font("Helvetica-Bold").fillColor(DARK).text(data.scenarioName, 50, y + 20, { width: halfW - 20 });
  if (data.productName) {
    doc.fontSize(9).font("Helvetica").fillColor(GRAY).text(data.productName, 50, doc.y + 2, { width: halfW - 20 });
  }
  if (data.description) {
    doc.fontSize(8).font("Helvetica").fillColor(GRAY).text(data.description, 50, doc.y + 2, { width: halfW - 20 });
  }
  if (data.period) {
    doc.fontSize(8).font("Helvetica").fillColor(GRAY).text(`Période : ${data.period}`, 50, doc.y + 2, { width: halfW - 20 });
  }

  const col2x = 40 + halfW + 8;
  doc.rect(col2x, y, halfW, 78).fill(LIGHT).stroke(BORDER);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(GRAY).text("CLIENT / PROSPECT", col2x + 10, y + 8);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK)
    .text(data.clientName ?? "Non renseigné", col2x + 10, y + 20, { width: halfW - 20 });
  if (data.category) {
    doc.fontSize(8.5).font("Helvetica").fillColor(GRAY).text(`Catégorie : ${data.category}`, col2x + 10, doc.y + 3, { width: halfW - 20 });
  }
  if (data.quantity && data.unit) {
    doc.fontSize(8.5).font("Helvetica").fillColor(GRAY)
      .text(`Quantité : ${data.quantity} ${data.unit}`, col2x + 10, doc.y + 3, { width: halfW - 20 });
  }

  y += 86;

  // ── Helper : sectionTitle ────────────────────────────────────────────────────
  function sectionTitle(title: string, rowY: number): number {
    doc.rect(40, rowY, W, 16).fill("#1E293B");
    doc.fontSize(8).font("Helvetica-Bold").fillColor(GOLD)
      .text(title, 50, rowY + 4, { width: W - 20 });
    return rowY + 16;
  }

  // ── Helper : ligne tableau ───────────────────────────────────────────────────
  function tableRow(
    cols: string[], xs: number[], widths: number[], rowY: number,
    bg = "white", bold = false, color = DARK,
  ): number {
    doc.rect(40, rowY, W, 15).fill(bg).stroke(BORDER);
    cols.forEach((c, i) => {
      doc.fontSize(8.5).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(color)
        .text(c, xs[i], rowY + 4, { width: widths[i], align: i === 0 ? "left" : "right" });
    });
    return rowY + 15;
  }

  // ── Section 1 : Détail des coûts ─────────────────────────────────────────────
  y = sectionTitle("DÉTAIL DES COÛTS", y);

  // Header colonnes
  doc.rect(40, y, W, 14).fill(DARK);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("POSTE DE COÛT", 50, y + 4, { width: 280 });
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("MONTANT", 330, y + 4, { width: 100, align: "right" });
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("% DU TOTAL", 432, y + 4, { width: 100, align: "right" });
  y += 14;

  const costXs = [50, 330, 432];
  const costWs = [270, 100, 100];
  let rowIdx = 0;
  for (const row of data.costBreakdown) {
    if (row.amount <= 0) continue;
    const bg = rowIdx % 2 === 0 ? "white" : LIGHT;
    y = tableRow(
      [row.label, fcfa(row.amount), pct(row.pct)],
      costXs, costWs, y, bg,
    );
    rowIdx++;
  }

  // Total coûts
  y = tableRow(["COÛT DE REVIENT TOTAL", fcfa(data.totalCost), "100,0 %"], costXs, costWs, y, DARK, true, "white");
  y += 8;

  // ── Section 2 : Analyse des prix ─────────────────────────────────────────────
  y = sectionTitle("ANALYSE DES PRIX ET MARGES", y);

  // Prix cibles
  const priceRows: [string, string, string][] = [];

  if ((data.discountAmount ?? 0) > 0 && (data.priceHTBrut ?? 0) > 0) {
    priceRows.push(["Prix catalogue HT (avant remise)", fcfa(data.priceHTBrut!), ""]);
    priceRows.push([`Remise commerciale (${(data.discountPct ?? 0).toFixed(1)}%)`, "−" + fcfa(data.discountAmount!), ""]);
  }
  priceRows.push(["Prix HT (facturé)", fcfa(data.finalPriceHT), ""]);
  priceRows.push([`TVA (${data.taxRate}%)`, fcfa(data.taxAmount), ""]);
  priceRows.push(["Prix TTC", fcfa(data.finalPriceTTC), ""]);

  const pxs = [50, 340, 460];
  const pws = [280, 115, 70];

  doc.rect(40, y, W, 14).fill(DARK);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("RUBRIQUE", 50, y + 4, { width: 280 });
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("VALEUR", 340, y + 4, { width: 115, align: "right" });
  y += 14;

  rowIdx = 0;
  for (const [label, val] of priceRows) {
    const bg = rowIdx % 2 === 0 ? "white" : LIGHT;
    const isTTC = label.startsWith("Prix TTC");
    y = tableRow([label, val], pxs, pws, y, isTTC ? "#FEF9EE" : bg, isTTC, isTTC ? GOLD : DARK);
    rowIdx++;
  }

  y += 4;

  // Marges
  const marginRows: [string, string, string][] = [
    ["Coût de revient total", fcfa(data.totalCost), ""],
    ["Marge brute (coût complet)", fcfa(data.finalPriceHT - data.totalCost), pct(data.grossMarginPct)],
    ["IS incrémental estimé", data.corporateTax > 0 ? fcfa(data.corporateTax) : "Non applicable", ""],
    ["Bénéfice net", fcfa(data.netProfit), pct(data.netMarginPct)],
  ];

  doc.rect(40, y, W, 14).fill("#334155");
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("RUBRIQUE MARGE", 50, y + 4, { width: 280 });
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("MONTANT", 340, y + 4, { width: 100, align: "right" });
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("TAUX", 440, y + 4, { width: 80, align: "right" });
  y += 14;

  const mgxs = [50, 340, 440];
  const mgws = [280, 95, 75];

  rowIdx = 0;
  for (const [label, val, taux] of marginRows) {
    const bg = rowIdx % 2 === 0 ? "white" : LIGHT;
    const isNet = label.startsWith("Bénéfice");
    const color = isNet ? (data.netMarginPct < 0 ? RED : GREEN) : DARK;
    y = tableRow([label, val, taux], mgxs, mgws, y, bg, isNet, color);
    rowIdx++;
  }

  y += 8;

  // ── Section 3 : Prix cibles ────────────────────────────────────────────────
  y = sectionTitle("PRIX CIBLES", y);

  const targetRows: [string, string, string, string][] = [
    ["Prix minimum HT", "Seuil de rentabilité", fcfa(data.minimumPriceHT), RED],
    ["Prix recommandé HT", `Marge cible : ${data.marginTarget}%`, fcfa(data.recommendedPriceHT), GREEN],
    ["Prix final HT", "Prix retenu", fcfa(data.finalPriceHT), GOLD],
  ];

  doc.rect(40, y, W, 14).fill(DARK);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("PRIX", 50, y + 4, { width: 150 });
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("DESCRIPTION", 195, y + 4, { width: 200 });
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("white")
    .text("MONTANT HT", 395, y + 4, { width: 120, align: "right" });
  y += 14;

  for (const [label, desc, val, color] of targetRows) {
    const bg = label.startsWith("Prix final") ? "#FEF9EE" : "white";
    doc.rect(40, y, W, 17).fill(bg).stroke(BORDER);
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(color).text(label, 50, y + 5, { width: 140 });
    doc.fontSize(8.5).font("Helvetica").fillColor(GRAY).text(desc, 195, y + 5, { width: 190 });
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(color).text(val, 395, y + 5, { width: 120, align: "right" });
    y += 17;
  }

  // Marge de sécurité
  if (data.finalPriceHT > 0 && data.minimumPriceHT > 0) {
    const safetyMargin = data.finalPriceHT - data.minimumPriceHT;
    const safetyColor = safetyMargin >= 0 ? GREEN : RED;
    doc.rect(40, y, W, 14).fill(safetyMargin >= 0 ? "#F0FDF4" : "#FEF2F2").stroke(BORDER);
    doc.fontSize(8).font("Helvetica").fillColor(safetyColor)
      .text(`Marge de sécurité vs prix minimum : ${fcfa(Math.abs(safetyMargin))} ${safetyMargin >= 0 ? "au-dessus" : "en-dessous"} du seuil`, 50, y + 3, { width: W - 20 });
    y += 14;
  }

  y += 8;

  // ── Section 4 : Hypothèses ────────────────────────────────────────────────────
  const MARGIN_MODE_LABELS: Record<string, string> = {
    net: "Marge nette cible", gross: "Marge brute cible", markup: "Coefficient de majoration",
  };

  y = sectionTitle("HYPOTHÈSES ET PARAMÈTRES", y);
  const hypotheses: [string, string][] = [
    ["Mode de marge", MARGIN_MODE_LABELS[data.marginMode] ?? data.marginMode],
    ["Cible de marge", `${data.marginTarget} %`],
    ["Taux TVA", `${data.taxRate} %`],
  ];
  if ((data.discountPct ?? 0) > 0) {
    hypotheses.push(["Remise commerciale", `${(data.discountPct ?? 0).toFixed(1)} %`]);
  }

  const hxs = [50, 340];
  const hws = [285, 175];

  rowIdx = 0;
  for (const [label, val] of hypotheses) {
    const bg = rowIdx % 2 === 0 ? "white" : LIGHT;
    y = tableRow([label, val], hxs, hws, y, bg);
    rowIdx++;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────────
  if (data.notes) {
    y += 8;
    y = sectionTitle("NOTES", y);
    doc.rect(40, y, W, 0).fill("white");
    const noteHeight = Math.max(28, Math.min(80, data.notes.split("\n").length * 12 + 12));
    doc.rect(40, y, W, noteHeight).fill(LIGHT).stroke(BORDER);
    doc.fontSize(8.5).font("Helvetica").fillColor(DARK)
      .text(data.notes, 50, y + 7, { width: W - 20, lineGap: 3 });
    y += noteHeight + 8;
  }

  // ── Pied de page ─────────────────────────────────────────────────────────────
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    const pageBottom = doc.page.height - 30;
    doc.rect(40, pageBottom - 14, W, 14).fill(DARK);
    doc.fontSize(7).font("Helvetica").fillColor("#94A3B8")
      .text(
        `Gameasu · Analyse tarifaire confidentielle · Généré le ${data.generatedAt}`,
        50, pageBottom - 10, { width: 300 },
      );
    doc.fontSize(7).font("Helvetica").fillColor(GOLD)
      .text(`Page ${i + 1} / ${pageCount}`, 400, pageBottom - 10, { width: 140, align: "right" });
  }

  doc.end();
}
