/**
 * Générateur de bulletin de paie PDF (PDFKit)
 * Format SYSCOHADA — Configurable selon le pays de l'organisation
 */
import PDFDocument from "pdfkit";
import type { Writable } from "stream";

export interface PayslipData {
  id: string;
  period: string;
  collaboratorName: string;
  collaboratorCode?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  baseSalary: number;
  transportAllowance: number;
  housingAllowance: number;
  mealAllowance: number;
  additions?: { label: string; amount: number }[] | null;
  deductions?: { label: string; amount: number }[] | null;
  grossSalary: number;
  cnssEmployee: number;
  cnssEmployer: number;
  irpp: number;
  ipts: number;
  netSalary: number;
  paymentDate?: string | null;
  status: string;
}

export interface OrgData {
  name: string;
  legalName?: string | null;
  address?: string | null;
  taxId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoUrl?: string | null;
}

function fcfa(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " FCFA";
}

function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];
  const m = parseInt(month, 10);
  return `${months[m - 1] ?? month} ${year}`;
}

export function generatePayslipPdf(
  payslip: PayslipData,
  org: OrgData,
  output: Writable,
): void {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  doc.pipe(output);

  const W = 515;
  const NAVY   = "#0E1A39";
  const BLUE   = "#2563EB";
  const DARK   = "#0F172A";
  const GRAY   = "#64748B";
  const LIGHT  = "#F8FAFC";
  const RED    = "#DC2626";
  const ORANGE = "#F37021";

  let y = 40;

  // ── En-tête : bandeau marine Gameasu ─────────────────────────────────────
  doc.rect(40, y, W, 54).fill(NAVY);
  doc.fontSize(18).font("Helvetica-Bold").fillColor("white")
    .text(org.name.toUpperCase(), 55, y + 8, { width: 300 });
  doc.fontSize(9).font("Helvetica").fillColor("white")
    .text(org.legalName ?? "", 55, y + 30, { width: 300 });

  doc.fontSize(14).font("Helvetica-Bold").fillColor("white")
    .text("BULLETIN DE PAIE", 370, y + 12, { width: 180, align: "right" });
  doc.fontSize(10).font("Helvetica").fillColor("white")
    .text(periodLabel(payslip.period), 370, y + 32, { width: 180, align: "right" });

  y += 62;

  // ── Bloc coordonnées employeur + employé ─────────────────────────────────
  const colW = (W - 8) / 2;

  doc.rect(40, y, colW, 72).fill(LIGHT).stroke("#E2E8F0");
  doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY).text("EMPLOYEUR", 50, y + 8);
  doc.fontSize(9).font("Helvetica").fillColor(DARK);
  doc.text(org.legalName ?? org.name, 50, y + 20, { width: colW - 20 });
  if (org.address) doc.text(org.address, 50, doc.y, { width: colW - 20 });
  if (org.taxId) doc.text(`NIF : ${org.taxId}`, 50, doc.y, { width: colW - 20 });
  if (org.contactPhone) doc.text(`Tél : ${org.contactPhone}`, 50, doc.y, { width: colW - 20 });

  const col2x = 40 + colW + 8;
  doc.rect(col2x, y, colW, 72).fill(LIGHT).stroke("#E2E8F0");
  doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY).text("EMPLOYÉ", col2x + 10, y + 8);
  doc.fontSize(9).font("Helvetica").fillColor(DARK);
  doc.text(payslip.collaboratorName, col2x + 10, y + 20, { width: colW - 20 });
  if (payslip.collaboratorCode) doc.text(`Matricule : ${payslip.collaboratorCode}`, col2x + 10, doc.y, { width: colW - 20 });
  if (payslip.jobTitle) doc.text(`Poste : ${payslip.jobTitle}`, col2x + 10, doc.y, { width: colW - 20 });
  if (payslip.department) doc.text(`Département : ${payslip.department}`, col2x + 10, doc.y, { width: colW - 20 });

  y += 80;

  // ── Tableau SYSCOHADA ────────────────────────────────────────────────────
  function tableHeader(labels: string[], xs: number[], widths: number[], rowY: number) {
    doc.rect(40, rowY, W, 18).fill(DARK);
    labels.forEach((lbl, i) => {
      doc.fontSize(8).font("Helvetica-Bold").fillColor("white")
        .text(lbl, xs[i], rowY + 5, { width: widths[i], align: i === 0 ? "left" : "right" });
    });
  }

  function tableRow(
    cols: string[],
    xs: number[],
    widths: number[],
    rowY: number,
    bg: string = "white",
    bold = false,
    color = DARK,
  ) {
    doc.rect(40, rowY, W, 16).fill(bg).stroke("#E2E8F0");
    cols.forEach((c, i) => {
      doc.fontSize(8.5)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor(color)
        .text(c, xs[i], rowY + 4, { width: widths[i], align: i === 0 ? "left" : "right" });
    });
    return rowY + 16;
  }

  const cols4x = [50, 250, 360, 450];
  const cols4w = [190, 100, 80, 95];
  const LABELS4 = ["RUBRIQUE", "BASE", "TAUX", "MONTANT"];

  // Section Éléments de rémunération
  doc.rect(40, y, W, 14).fill("#F1F5F9");
  doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY)
    .text("ÉLÉMENTS DE RÉMUNÉRATION", 50, y + 3);
  y += 14;

  tableHeader(LABELS4, cols4x, cols4w, y);
  y += 18;

  const rows: [string, string, string, number][] = [
    ["Salaire de base", fcfa(payslip.baseSalary), "", payslip.baseSalary],
    ["Indemnité de transport", fcfa(payslip.baseSalary), "", payslip.transportAllowance],
    ["Indemnité de logement", fcfa(payslip.baseSalary), "", payslip.housingAllowance],
  ];
  if (payslip.mealAllowance > 0) {
    rows.push(["Indemnité de repas", fcfa(payslip.baseSalary), "", payslip.mealAllowance]);
  }
  const additions = (payslip.additions as { label: string; amount: number }[] | null) ?? [];
  for (const a of additions) {
    if (a.amount > 0) rows.push([a.label, "", "", a.amount]);
  }

  rows.forEach(([label, base, taux, montant], i) => {
    y = tableRow(
      [label, base, taux, fcfa(montant)],
      cols4x, cols4w, y,
      i % 2 === 0 ? "white" : LIGHT,
    );
  });

  y = tableRow(
    ["SALAIRE BRUT", "", "", fcfa(payslip.grossSalary)],
    cols4x, cols4w, y, "#EFF6FF", true, BLUE,
  );

  y += 10;

  // Section Cotisations & Retenues
  doc.rect(40, y, W, 14).fill("#F1F5F9");
  doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY)
    .text("COTISATIONS ET RETENUES SALARIALES", 50, y + 3);
  y += 14;

  tableHeader(LABELS4, cols4x, cols4w, y);
  y += 18;

  const retenues: [string, string, string, number][] = [
    ["Cotisations salariales (CNSS)", fcfa(payslip.grossSalary), "9,00 %", payslip.cnssEmployee],
    ["IRPP (barème progressif 8 tranches CGI)", "Base imposable mensuelle", "", payslip.irpp],
  ];
  if (payslip.ipts > 0) {
    retenues.push(["IPTS — impôt proportionnel", fcfa(payslip.grossSalary), "", payslip.ipts]);
  }
  const deductions = (payslip.deductions as { label: string; amount: number }[] | null) ?? [];
  for (const d of deductions) {
    if (d.amount > 0) retenues.push([d.label, "", "", d.amount]);
  }

  const totalRetenues = payslip.cnssEmployee + payslip.irpp + (payslip.ipts ?? 0)
    + deductions.reduce((s, d) => s + (d.amount ?? 0), 0);

  retenues.forEach(([label, base, taux, montant], i) => {
    y = tableRow(
      [label, base, taux, fcfa(montant)],
      cols4x, cols4w, y,
      i % 2 === 0 ? "white" : LIGHT,
      false, RED,
    );
  });

  y = tableRow(
    ["TOTAL RETENUES", "", "", fcfa(totalRetenues)],
    cols4x, cols4w, y, "#FEF2F2", true, RED,
  );

  y += 10;

  // Section Charges patronales (information)
  doc.rect(40, y, W, 14).fill("#F1F5F9");
  doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY)
    .text("CHARGES PATRONALES (information)", 50, y + 3);
  y += 14;

  const cols3x = [50, 340, 450];
  const cols3w = [280, 100, 95];

  doc.rect(40, y, W, 18).fill(DARK);
  ["RUBRIQUE", "TAUX", "MONTANT"].forEach((lbl, i) => {
    doc.fontSize(8).font("Helvetica-Bold").fillColor("white")
      .text(lbl, cols3x[i], y + 5, { width: cols3w[i], align: i === 0 ? "left" : "right" });
  });
  y += 18;

  y = tableRow(
    ["CNSS employeur (accident, retraite, allocations familiales)", "16,40 %", fcfa(payslip.cnssEmployer)],
    cols3x, cols3w, y, LIGHT,
  );

  y += 12;

  // ── Bloc NET À PAYER ─────────────────────────────────────────────────────
  doc.rect(40, y, W, 36).fill(ORANGE);
  doc.fontSize(10).font("Helvetica-Bold").fillColor("white")
    .text("NET À PAYER", 55, y + 6);
  doc.fontSize(18).font("Helvetica-Bold").fillColor("white")
    .text(fcfa(payslip.netSalary), 280, y + 4, { width: 270, align: "right" });
  y += 36;

  y += 8;

  // ── Ligne mode de paiement / date ────────────────────────────────────────
  if (payslip.paymentDate) {
    doc.fontSize(8).font("Helvetica").fillColor(GRAY)
      .text(`Date de paiement : ${new Date(payslip.paymentDate).toLocaleDateString("fr-FR")}`, 40, y, { width: W });
    y += 12;
  }

  // ── Pied de page ─────────────────────────────────────────────────────────
  doc.rect(40, 780, W, 1).fill("#E2E8F0");
  doc.fontSize(7.5).font("Helvetica").fillColor(GRAY)
    .text(
      "Bulletin de paie établi conformément à la législation applicable. À conserver sans limitation de durée.",
      40, 784, { width: W, align: "center" },
    );

  doc.end();
}
