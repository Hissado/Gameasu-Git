import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType,
  PageBreak, ImageRun, VerticalAlign, TableLayoutType,
  convertInchesToTwip, convertMillimetersToTwip,
} from "docx";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Brand colors (GAMEASU) ───────────────────────────────────────────────────
const C = {
  navy:      "0D1B3E",
  blue:      "1A55D1",
  blueLight: "E8F1FD",
  blueAccent:"2979FF",
  orange:    "F37021",
  orangeLight:"FEF3EC",
  gray50:    "F8F9FC",
  gray100:   "EEF0F5",
  gray300:   "CBD0DE",
  gray600:   "6B7280",
  gray800:   "1F2937",
  white:     "FFFFFF",
  green:     "0D9E6E",
  greenLight:"E6F7F2",
};

// ── Typography helpers ───────────────────────────────────────────────────────
const font = "Calibri";
const fontHeading = "Calibri";

function run(text: string, opts: {
  bold?: boolean; italic?: boolean; size?: number; color?: string;
  allCaps?: boolean; font?: string;
} = {}): TextRun {
  return new TextRun({
    text,
    bold: opts.bold ?? false,
    italics: opts.italic ?? false,
    size: (opts.size ?? 11) * 2,
    color: opts.color ?? C.gray800,
    allCaps: opts.allCaps ?? false,
    font: opts.font ?? font,
  });
}

function para(children: TextRun[], opts: {
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  before?: number; after?: number; lineRule?: string; line?: number;
  indent?: number;
} = {}): Paragraph {
  return new Paragraph({
    children,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: {
      before: convertMillimetersToTwip(opts.before ?? 0),
      after: convertMillimetersToTwip(opts.after ?? 3),
      line: opts.line ?? 276,
    },
    indent: opts.indent ? { left: convertMillimetersToTwip(opts.indent) } : undefined,
  });
}

function h1(text: string, pageBreakBefore = false): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true, size: 28, color: C.white, font: fontHeading,
      }),
    ],
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    spacing: { before: convertMillimetersToTwip(2), after: convertMillimetersToTwip(6) },
    pageBreakBefore,
    shading: { type: ShadingType.SOLID, color: C.navy },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.orange } },
    indent: { left: convertMillimetersToTwip(4), right: convertMillimetersToTwip(4) },
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: true, size: 24, color: C.navy, font: fontHeading }),
    ],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: convertMillimetersToTwip(8), after: convertMillimetersToTwip(4) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.blue } },
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: true, size: 22, color: C.blue, font: fontHeading }),
    ],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: convertMillimetersToTwip(6), after: convertMillimetersToTwip(2) },
  });
}

function body(text: string, opts: { before?: number; after?: number; indent?: number } = {}): Paragraph {
  return para([run(text, { size: 11 })], { before: opts.before, after: opts.after ?? 3, indent: opts.indent });
}

function bullet(text: string, level = 0): Paragraph {
  return new Paragraph({
    children: [run(text, { size: 11 })],
    bullet: { level },
    spacing: { before: convertMillimetersToTwip(1), after: convertMillimetersToTwip(1), line: 276 },
    indent: { left: convertMillimetersToTwip(8 + level * 5) },
  });
}

function callout(text: string, opts: { bg?: string; border?: string; textColor?: string } = {}): Paragraph {
  return new Paragraph({
    children: [run(text, { size: 11, italic: true, color: opts.textColor ?? C.navy })],
    shading: { type: ShadingType.SOLID, color: opts.bg ?? C.blueLight },
    border: {
      left: { style: BorderStyle.THICK, size: 12, color: opts.border ?? C.blue },
    },
    spacing: { before: convertMillimetersToTwip(4), after: convertMillimetersToTwip(4) },
    indent: { left: convertMillimetersToTwip(6), right: convertMillimetersToTwip(6) },
  });
}

function divider(): Paragraph {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.gray300 } },
    spacing: { before: convertMillimetersToTwip(4), after: convertMillimetersToTwip(4) },
  });
}

function spacer(mm = 4): Paragraph {
  return new Paragraph({
    children: [run("")],
    spacing: { before: 0, after: convertMillimetersToTwip(mm) },
  });
}

// ── Tables ───────────────────────────────────────────────────────────────────
function tableHeader(texts: string[], widths: number[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: texts.map((t, i) =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: t, bold: true, size: 20, color: C.white, font })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        })],
        shading: { type: ShadingType.SOLID, color: C.navy },
        width: { size: widths[i], type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
      })
    ),
  });
}

function tableRow(cells: string[], widths: number[], shaded = false): TableRow {
  return new TableRow({
    children: cells.map((t, i) =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: t, size: 20, font })],
          spacing: { before: 60, after: 60 },
        })],
        shading: shaded ? { type: ShadingType.SOLID, color: C.gray50 } : undefined,
        width: { size: widths[i], type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 150, right: 150 },
      })
    ),
  });
}

function simpleTable(headers: string[], rows: string[][], widths: number[]): Table {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableHeader(headers, widths),
      ...rows.map((r, i) => tableRow(r, widths, i % 2 === 0)),
    ],
    borders: {
      insideH: { style: BorderStyle.SINGLE, size: 1, color: C.gray300 },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: C.gray300 },
      top: { style: BorderStyle.SINGLE, size: 2, color: C.navy },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: C.navy },
      left: { style: BorderStyle.SINGLE, size: 2, color: C.navy },
      right: { style: BorderStyle.SINGLE, size: 2, color: C.navy },
    },
  });
}

// ── Highlighted card (2-col info panel) ─────────────────────────────────────
function infoCard(label: string, value: string, labelColor = C.blue): Table {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: 20, color: labelColor, font })],
              spacing: { before: 80, after: 40 },
            })],
            shading: { type: ShadingType.SOLID, color: C.blueLight },
            width: { size: 28, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: value, size: 20, font })],
              spacing: { before: 80, after: 40 },
            })],
            width: { size: 72, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: C.gray300 },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: C.gray300 },
      left: { style: BorderStyle.THICK, size: 10, color: C.blue },
      right: { style: BorderStyle.SINGLE, size: 1, color: C.gray300 },
      insideH: { style: BorderStyle.NONE, size: 0, color: C.white },
      insideV: { style: BorderStyle.NONE, size: 0, color: C.white },
    },
  });
}

// ── Logo image ───────────────────────────────────────────────────────────────
const logoPath = path.join(__dirname, "gameasu-logo.png");
const logoData = fs.readFileSync(logoPath);

function logoImage(w = 120, h = 40): ImageRun {
  return new ImageRun({
    data: logoData,
    transformation: { width: w, height: h },
    type: "png",
  });
}

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENT SECTIONS
// ════════════════════════════════════════════════════════════════════════════

// ── 1. Cover page ────────────────────────────────────────────────────────────
function coverPage(): Paragraph[] {
  return [
    // Navy header band
    new Paragraph({
      children: [new TextRun({ text: "", size: 2 })],
      shading: { type: ShadingType.SOLID, color: C.navy },
      spacing: { before: 0, after: convertMillimetersToTwip(6) },
    }),
    spacer(8),
    // Logo
    new Paragraph({
      children: [logoImage(200, 67)],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: convertMillimetersToTwip(12) },
    }),
    // Orange separator
    new Paragraph({
      children: [],
      border: { bottom: { style: BorderStyle.THICK, size: 12, color: C.orange } },
      spacing: { before: 0, after: convertMillimetersToTwip(16) },
    }),
    // CONFIDENTIEL badge
    para([run("DOCUMENT CONFIDENTIEL", { bold: true, size: 9, color: C.orange, allCaps: true })],
      { align: AlignmentType.CENTER, after: 8 }),
    // Main title
    para([run("Proposition de partenariat stratégique", { bold: true, size: 24, color: C.navy })],
      { align: AlignmentType.CENTER, before: 2, after: 4 }),
    // Subtitle
    new Paragraph({
      children: [new TextRun({
        text: "Gameasu au service de la professionnalisation des entrepreneurs,\ncoopératives et structures accompagnées par le MDBESS",
        size: 22, color: C.blue, font, italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: convertMillimetersToTwip(16) },
    }),
    divider(),
    spacer(6),
    // Metadata table
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 80, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          new TableCell({
            children: [para([run("Destinataire", { bold: true, size: 11, color: C.navy })])],
            shading: { type: ShadingType.SOLID, color: C.blueLight },
            width: { size: 35, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
          new TableCell({
            children: [para([run("Ministère du Développement à la Base et de l'Économie Sociale et Solidaire (MDBESS) — République Togolaise", { size: 11 })])],
            width: { size: 65, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
        ]}),
        new TableRow({ children: [
          new TableCell({
            children: [para([run("Émetteur", { bold: true, size: 11, color: C.navy })])],
            shading: { type: ShadingType.SOLID, color: C.gray50 },
            width: { size: 35, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
          new TableCell({
            children: [para([run("Gameasu — Équipe Partenariats Institutionnels", { size: 11 })])],
            shading: { type: ShadingType.SOLID, color: C.gray50 },
            width: { size: 65, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
        ]}),
        new TableRow({ children: [
          new TableCell({
            children: [para([run("Date", { bold: true, size: 11, color: C.navy })])],
            shading: { type: ShadingType.SOLID, color: C.blueLight },
            width: { size: 35, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
          new TableCell({
            children: [para([run("Juillet 2026", { size: 11 })])],
            width: { size: 65, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
        ]}),
        new TableRow({ children: [
          new TableCell({
            children: [para([run("Objet", { bold: true, size: 11, color: C.navy })])],
            shading: { type: ShadingType.SOLID, color: C.gray50 },
            width: { size: 35, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
          new TableCell({
            children: [para([run("Proposition de partenariat pour l'équipement numérique et l'accompagnement des bénéficiaires du MDBESS", { size: 11 })])],
            shading: { type: ShadingType.SOLID, color: C.gray50 },
            width: { size: 65, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
        ]}),
        new TableRow({ children: [
          new TableCell({
            children: [para([run("Version", { bold: true, size: 11, color: C.navy })])],
            shading: { type: ShadingType.SOLID, color: C.blueLight },
            width: { size: 35, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
          new TableCell({
            children: [para([run("v1.0 — Diffusion restreinte", { size: 11 })])],
            width: { size: 65, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 150, right: 150 },
          }),
        ]}),
      ],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: C.navy },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: C.navy },
        left: { style: BorderStyle.THICK, size: 10, color: C.blue },
        right: { style: BorderStyle.SINGLE, size: 2, color: C.navy },
        insideH: { style: BorderStyle.SINGLE, size: 1, color: C.gray300 },
        insideV: { style: BorderStyle.SINGLE, size: 1, color: C.gray300 },
      },
    }),
    spacer(12),
    para([
      run("Ce document est confidentiel et destiné exclusivement aux représentants du Ministère du Développement à la Base et de l'Économie Sociale et Solidaire.", {
        size: 9, italic: true, color: C.gray600,
      }),
    ], { align: AlignmentType.CENTER }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 2. Table of contents (manual) ────────────────────────────────────────────
function tableOfContents(): (Paragraph | Table)[] {
  const items = [
    ["01", "Résumé exécutif", "3"],
    ["02", "Le ministère, ses programmes et le chaînon manquant", "4"],
    ["03", "Gameasu : un outil et un accompagnement", "5"],
    ["04", "Ce que Gameasu change pour les bénéficiaires", "6"],
    ["05", "Ce que Gameasu apporte au ministère", "7"],
    ["06", "Le tableau de bord institutionnel", "8"],
    ["07", "Dispositifs de partenariat proposés", "9"],
    ["08", "Financer l'accès à l'ERP", "11"],
    ["09", "Programme pilote de 6 mois", "12"],
    ["10", "Plan de mise en œuvre", "13"],
    ["11", "Formations proposées", "14"],
    ["12", "Gouvernance, sécurité et confidentialité", "15"],
    ["13", "Résultats attendus", "16"],
    ["14", "Recommandations finales", "17"],
  ];
  return [
    h2("Table des matières"),
    spacer(2),
    ...items.map(([num, title, page]) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${num}   `, bold: true, size: 20, color: C.blue, font }),
          new TextRun({ text: title, size: 20, font }),
          new TextRun({ text: `   ·   page ${page}`, size: 20, color: C.gray600, font }),
        ],
        border: { bottom: { style: BorderStyle.DOTTED, size: 1, color: C.gray300 } },
        spacing: { before: convertMillimetersToTwip(2), after: convertMillimetersToTwip(2) },
      })
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 3. Résumé exécutif ───────────────────────────────────────────────────────
function resumeExecutif(): (Paragraph | Table)[] {
  return [
    h1("01 — Résumé exécutif"),
    callout(
      "Le MDBESS forme et finance chaque année des milliers d'entrepreneurs, de coopératives et de groupements. Un même constat traverse tous les dispositifs : une fois la formation dispensée ou le financement décaissé, les bénéficiaires retournent à une gestion manuelle, et le ministère perd la trace de l'impact réel de ses actions.",
      { bg: C.blueLight, border: C.blue },
    ),
    spacer(3),
    body("Gameasu est un ERP tout-en-un conçu pour les réalités des PME, coopératives et associations de l'Afrique de l'Ouest francophone. Disponible en français, accessible sur ordinateur comme sur téléphone, il couvre l'intégralité du cycle de gestion : ventes, clients, facturation, dépenses, trésorerie, stocks, projets, budgets, ressources humaines et rapports — réunis dans une application unique."),
    body("Proposé en partenariat institutionnel au MDBESS, il comble précisément le chaînon manquant identifié dans tous les programmes du ministère : il donne à l'entrepreneur un outil qu'il conserve après la formation, et il remonte au ministère des données d'activité réelles, continues et agrégées, en remplacement du reporting déclaratif."),
    spacer(3),
    h3("Ce que cette proposition recommande"),
    bullet("Lancer un programme pilote de 6 mois sur une cohorte de 50 à 100 bénéficiaires — jeunes entrepreneurs, femmes entrepreneures, coopératives et TPME — dans deux à trois régions."),
    bullet("Adosser ce pilote aux dispositifs existants du ministère (PAJEC, FAIEJ, ANADEB) pour maximiser la pertinence et minimiser les coûts d'activation."),
    bullet("Mesurer l'impact sur des critères chiffrés arrêtés conjointement, puis décider d'une extension progressive sur la base des résultats."),
    spacer(3),
    simpleTable(
      ["Indicateur clé", "Valeur cible à 6 mois"],
      [
        ["Taux d'activation de la cohorte", "≥ 80 %"],
        ["Taux d'usage actif mensuel", "≥ 60 %"],
        ["Factures émises par la cohorte", "≥ 500"],
        ["Satisfaction moyenne des bénéficiaires", "≥ 4 / 5"],
      ],
      [60, 40],
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 4. Contexte ─────────────────────────────────────────────────────────────
function contexte(): (Paragraph | Table)[] {
  return [
    h1("02 — Le ministère, ses programmes et le chaînon manquant"),
    h2("Le MDBESS en chiffres"),
    body("Le Ministère du Développement à la Base et de l'Économie Sociale et Solidaire (MDBESS) porte une mission d'une portée considérable : structurer les communautés à la base, soutenir l'économie sociale et solidaire, et accompagner les jeunes vers leur autonomisation économique sur l'ensemble du territoire togolais."),
    spacer(2),
    simpleTable(
      ["Programme", "Portée", "Dotation / Résultats"],
      [
        ["PAJEC (ADTPME)", "9 230 TPME visées", "28 milliards FCFA (BAD, KfW, État togolais)"],
        ["FAIEJ", "Financement de projets jeunes", "7 000 projets financés — 27 000 emplois créés"],
        ["Réseau d'agences", "ADTPME, FAIEJ, ANADEB, ANPGF, ANVT", "Présence nationale"],
        ["Inclusion financière", "Filets sociaux", "350 000 bénéficiaires"],
        ["Jeunesse & volontariat", "Formation, emploi", "160 000 jeunes — 49 000 volontaires"],
        ["Emploi & entrepreneuriat", "Formation + financement", "9 250 personnes formées — 15 500 emplois créés"],
      ],
      [30, 35, 35],
    ),
    spacer(4),
    h2("Le chaînon manquant"),
    callout(
      "Former et financer ne suffit pas si les bénéficiaires ne disposent pas ensuite d'un outil simple pour gérer, suivre et structurer leur activité au quotidien.",
      { bg: C.orangeLight, border: C.orange, textColor: C.navy },
    ),
    body("L'analyse des dispositifs existants fait ressortir un besoin récurrent : les programmes forment et financent massivement, mais les bénéficiaires restent en gestion manuelle après l'intervention. Le PAJEC a d'ailleurs été conçu pour corriger la limite des programmes antérieurs, où les bénéficiaires étaient accompagnés puis livrés à eux-mêmes. Gameasu s'inscrit directement dans cette logique de continuité."),
    body("Le ministère manque également de données fiables pour mesurer l'impact réel de ses actions et répondre aux exigences de redevabilité de ses bailleurs. Gameasu répond à ce double besoin : un outil de gestion pour le bénéficiaire, un système de suivi pour le ministère."),
    spacer(2),
    simpleTable(
      ["Étape", "Situation actuelle", "Avec Gameasu"],
      [
        ["Formation", "Solide — programmes structurés", "Formation directement dans l'outil"],
        ["Financement", "Structuré — PAJEC, FAIEJ", "Suivi post-financement assuré"],
        ["Gestion quotidienne", "Manuelle — cahiers, carnets", "Numérique, centralisée, traçable"],
        ["Suivi du ministère", "Déclaratif, ponctuel", "Données réelles, continues, agrégées"],
        ["Redevabilité bailleurs", "Difficile à documenter", "Rapport d'impact chiffré et fiable"],
      ],
      [25, 37, 38],
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 5. Présentation Gameasu ───────────────────────────────────────────────────
function presentationGameasu(): (Paragraph | Table)[] {
  return [
    h1("03 — Gameasu : un outil et un accompagnement"),
    body("Gameasu n'est pas un simple logiciel. C'est une plateforme de gestion tout-en-un doublée d'un accompagnement humain assuré par des experts — praticiens de la finance, de la comptabilité, de la gestion commerciale et de la conduite de projet."),
    spacer(2),
    h2("Une couverture fonctionnelle complète"),
    simpleTable(
      ["Module", "Ce qu'il permet"],
      [
        ["Ventes & CRM", "Suivi des clients, opportunités, pipeline commercial"],
        ["Facturation", "Devis, proformas, factures professionnelles, relances"],
        ["Dépenses", "Saisie, catégorisation, contrôle des charges"],
        ["Trésorerie", "Suivi en temps réel, prévisions de cash-flow"],
        ["Stocks & Inventaire", "Gestion des entrées/sorties, valorisation, alertes"],
        ["Projets & Budgets", "Planification, suivi budgétaire, avancement"],
        ["Ressources humaines", "Collaborateurs, contrats, présences, paie simplifiée"],
        ["Rapports & Tableaux de bord", "KPI, graphiques, exports PDF et Excel"],
        ["Comptabilité (SYSCOHADA)", "Plan comptable, journal, états financiers"],
      ],
      [35, 65],
    ),
    spacer(4),
    h2("Les atouts distinctifs de Gameasu"),
    bullet("Interface entièrement en français, pensée pour des utilisateurs non spécialistes"),
    bullet("Accessible sur ordinateur comme sur téléphone mobile"),
    bullet("Architecture multi-tenant : chaque organisation dispose de son espace cloisonné et sécurisé"),
    bullet("Accompagnement humain : experts disponibles pour la formation et le support"),
    bullet("Conformité aux normes comptables SYSCOHADA"),
    bullet("Hébergement sécurisé, données chiffrées, accès journalisés"),
    bullet("Support en français, adapté aux réalités des PME d'Afrique de l'Ouest"),
    spacer(3),
    callout(
      "Gameasu remplace les cahiers, carnets de reçus et fichiers épars par un registre numérique unique et traçable. Chaque ressource, chaque charge est enregistrée — une discipline de gestion qui prolonge la formation bien après la fin des sessions.",
      { bg: C.blueLight, border: C.blue },
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 6. Bénéfices pour les bénéficiaires ────────────────────────────────────
function beneficesBeneficiaires(): (Paragraph | Table)[] {
  return [
    h1("04 — Ce que Gameasu change pour les bénéficiaires"),
    body("La valeur du partenariat ne se mesure pas seulement au niveau du ministère : elle se joue d'abord dans le quotidien de l'entrepreneur, de la femme entrepreneure ou de la coopérative qui utilise l'outil."),
    spacer(2),
    simpleTable(
      ["Bénéfice", "Impact concret"],
      [
        ["Fin de la gestion à vue", "Vision claire des ventes, dépenses et marge réelle dès les premières semaines d'usage"],
        ["Crédibilité financière", "Factures professionnelles, historique de ventes et états de trésorerie pour les banques et bailleurs"],
        ["Continuité de l'apprentissage", "Chaque notion de gestion est appliquée dans l'outil — l'entrepreneur repart avec un système opérationnel"],
        ["Séparation finances perso / activité", "Construction d'un historique vérifiable qui appuie les prochains dossiers de financement"],
        ["Réduction de l'informel", "Facturation traçable, stocks suivis, charges enregistrées — passage progressif au formel"],
        ["Accès aux marchés publics", "Production rapide de devis, factures et rapports d'activité conformes aux exigences institutionnelles"],
        ["Inclusion financière", "Dossier solide pour accéder au crédit et aux subventions"],
      ],
      [35, 65],
    ),
    spacer(3),
    h2("Profils de bénéficiaires ciblés"),
    bullet("Jeunes entrepreneurs issus des programmes FAIEJ et ANVT"),
    bullet("Femmes entrepreneures et groupements féminins"),
    bullet("Coopératives agricoles et d'artisanat"),
    bullet("TPME accompagnées par l'ADTPME dans le cadre du PAJEC"),
    bullet("Structures de l'économie sociale et solidaire"),
    bullet("Bénéficiaires de crédits ou subventions en suivi post-financement"),
    spacer(3),
    callout(
      "Un entrepreneur qui peut produire, en quelques clics, un historique de ventes, un état de trésorerie ou un rapport d'activités présente un dossier plus solide face à une banque ou un bailleur qu'un dossier fondé sur des estimations mémorielles.",
      { bg: C.greenLight, border: C.green, textColor: C.navy },
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 7. Bénéfices pour le ministère ──────────────────────────────────────────
function beneficesMinistere(): (Paragraph | Table)[] {
  return [
    h1("05 — Ce que Gameasu apporte au ministère"),
    body("Au-delà des bénéficiaires, Gameasu transforme les capacités de pilotage, de redevabilité et de mesure d'impact du ministère lui-même."),
    spacer(2),
    simpleTable(
      ["Besoin du ministère", "Ce que Gameasu apporte"],
      [
        ["Suivi post-formation et post-financement", "Données d'usage réelles — ventes, factures, dépenses — en continu"],
        ["Mesure de l'impact des programmes", "Indicateurs chiffrés et agrégés, non déclaratifs"],
        ["Redevabilité envers les bailleurs", "Rapports fiables (BAD, KfW, AFD, PNUD, GIZ)"],
        ["Pilotage des cohortes", "Tableau de bord institutionnel en temps réel"],
        ["Recensement de l'ESS", "Données d'activité structurées par secteur et région"],
        ["Inclusion financière", "Traçabilité des bénéficiaires — historique d'activité vérifiable"],
        ["Extension territoriale", "Réseau de formateurs internes — démultiplication via les agences"],
      ],
      [40, 60],
    ),
    spacer(4),
    callout(
      "Le ministère passe ainsi d'un reporting largement déclaratif à des indicateurs alimentés par l'usage effectif de l'outil — une transformation majeure pour la redevabilité et la crédibilité face aux partenaires techniques et financiers.",
      { bg: C.blueLight, border: C.blue },
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 8. Tableau de bord institutionnel ───────────────────────────────────────
function tableauBordInstitutionnel(): (Paragraph | Table)[] {
  return [
    h1("06 — Le tableau de bord institutionnel"),
    body("L'usage quotidien de Gameasu par les bénéficiaires produit un flux de données d'activité réelles que le tableau de bord institutionnel consolide, de manière agrégée, pour le ministère et ses agences."),
    spacer(2),
    h2("Indicateurs disponibles en temps réel"),
    simpleTable(
      ["Catégorie", "Indicateurs"],
      [
        ["Adoption", "Bénéficiaires intégrés · Comptes actifs · Taux d'usage mensuel"],
        ["Activité économique", "Factures émises · Ventes suivies · Dépenses enregistrées"],
        ["Projets & emploi", "Projets actifs · Emplois suivis ou créés · Stocks gérés"],
        ["Géographie & secteurs", "Répartition par région · Répartition par filière"],
        ["Formation", "Sessions suivies · Progressions · Badges obtenus"],
        ["Financement", "Bénéficiaires post-crédit · Taux d'usage post-décaissement"],
      ],
      [30, 70],
    ),
    spacer(3),
    h2("Gouvernance de la donnée — principes"),
    bullet("Seules des données agrégées et anonymisées sont exposées au niveau institutionnel"),
    bullet("Aucune donnée nominative individuelle n'est accessible sans base légale"),
    bullet("Le consentement des bénéficiaires est recueilli dès l'ouverture du compte"),
    bullet("Hébergement sécurisé et chiffré — accès journalisés et attribués par rôle"),
    bullet("Conformité à la loi togolaise sur la protection des données personnelles"),
    bullet("Séparation stricte des données par organisation (architecture multi-tenant)"),
    spacer(3),
    callout(
      "Cette centralisation de données est une première au niveau institutionnel togolais : le ministère dispose d'un outil de pilotage de ses programmes fondé sur des données d'activité réelles et non sur des déclarations ponctuelles.",
      { bg: C.orangeLight, border: C.orange, textColor: C.navy },
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 9. Dispositifs de partenariat ───────────────────────────────────────────
function dispositifsPartenariat(): (Paragraph | Table)[] {
  return [
    h1("07 — Dispositifs de partenariat proposés"),
    body("Plutôt que plusieurs dispositifs indépendants, le partenariat repose sur une logique unique — équiper, former, suivre — déclinée selon le point d'entrée choisi par le ministère."),
    spacer(2),
    h2("Les trois briques fondamentales"),
    simpleTable(
      ["Brique", "Description"],
      [
        ["① Accès à l'ERP", "Licence institutionnelle pour les entrepreneurs, TPME, coopératives et structures accompagnées par le ministère et ses agences"],
        ["② Formation à la gestion dans l'outil", "Chaque notion enseignée — vente, dépense, trésorerie, budget — est appliquée en direct dans l'organisation Gameasu du participant"],
        ["③ Tableau de bord institutionnel", "Vision agrégée et continue de l'adoption et de l'activité des cohortes pour le ministère et ses agences"],
      ],
      [25, 75],
    ),
    spacer(4),
    h2("Les extensions disponibles"),
    simpleTable(
      ["Option", "Description", "Cible prioritaire"],
      [
        [
          "Programme « Entrepreneur digitalisé »",
          "Accompagnement du passage d'une gestion manuelle vers Gameasu en 90 jours, avec badge à la clé",
          "Cohortes PAJEC / FAIEJ",
        ],
        [
          "Formation sectorielle & métier",
          "Renforcement des compétences commerciales, financières et organisationnelles filière par filière",
          "Tous bénéficiaires",
        ],
        [
          "Formation de formateurs",
          "Transfert de compétences aux conseillers et agents du ministère et de ses agences — levier de durabilité et d'extension territoriale",
          "FAIEJ, ADTPME, ANADEB",
        ],
        [
          "Accompagnement post-financement",
          "Adosser Gameasu aux dispositifs de crédit et de subvention pour suivre l'usage des fonds après le décaissement",
          "PAJEC, FAIEJ, ANPGF",
        ],
      ],
      [28, 47, 25],
    ),
    spacer(3),
    callout(
      "La voie la plus crédible pour engager la collaboration reste le programme pilote de six mois, qui réunit les trois briques fondamentales sur une cohorte restreinte — avant toute décision de généralisation.",
      { bg: C.blueLight, border: C.blue },
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 10. Financement ──────────────────────────────────────────────────────────
function financement(): (Paragraph | Table)[] {
  return [
    h1("08 — Financer l'accès à l'ERP"),
    body("Gameasu est un service commercial : chaque organisation dispose d'un abonnement dont le coût couvre la fourniture, l'accompagnement et le support. La question n'est pas de savoir si l'ERP est gratuit, mais qui prend en charge le coût et selon quelle proportion."),
    spacer(2),
    simpleTable(
      ["Option", "Mécanisme", "Avantages", "Points d'attention"],
      [
        ["① Licence ministérielle", "Le ministère prend en charge l'accès pour une cohorte définie — tarif dégressif selon le volume", "Simple pour le bénéficiaire — mise en œuvre rapide", "Repose entièrement sur le budget ministériel"],
        ["② Co-financement", "Le ministère prend en charge l'essentiel, le bénéficiaire verse une contribution symbolique", "Responsabilisation — améliore le taux d'usage effectif", "Nécessite un mécanisme de collecte"],
        ["③ Package formation + ERP", "Forfait intégrant accès, formation, accompagnement et reporting en un seul contrat", "Gestion budgétaire simplifiée — idéal pour les cohortes PAJEC/FAIEJ", "Contrat plus structuré à négocier"],
        ["④ Financement bailleurs", "Porté par BAD, KfW, AFD, PNUD, GIZ au titre des services non financiers ou de la digitalisation", "Sans budget supplémentaire pour le ministère", "Travail préalable de positionnement auprès des bailleurs"],
      ],
      [22, 28, 28, 22],
    ),
    spacer(4),
    h2("Séquence recommandée"),
    bullet("Phase pilote : financement subventionné par le ministère (ou bailleur) pour valider l'impact"),
    bullet("Régime de croisière : package formation + ERP adossé aux cohortes PAJEC et FAIEJ"),
    bullet("Extension : co-financement bailleur avec contribution symbolique du bénéficiaire"),
    spacer(3),
    callout(
      "Cette progression permet au ministère de ne jamais engager de budget conséquent avant d'avoir la preuve, chiffrée sur le pilote, que l'investissement produit les résultats attendus.",
      { bg: C.greenLight, border: C.green, textColor: C.navy },
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 11. Programme pilote ─────────────────────────────────────────────────────
function programmePilote(): (Paragraph | Table)[] {
  return [
    h1("09 — Programme pilote de 6 mois"),
    callout(
      "Le pilote est la porte d'entrée recommandée : il réunit l'accès à l'ERP, la formation et le tableau de bord institutionnel sur une cohorte restreinte, avant toute décision de généralisation.",
      { bg: C.blueLight, border: C.blue },
    ),
    spacer(3),
    h2("Paramètres du pilote"),
    simpleTable(
      ["Paramètre", "Valeur"],
      [
        ["Durée", "6 mois"],
        ["Taille de la cohorte", "50 à 100 bénéficiaires"],
        ["Profils ciblés", "Jeunes entrepreneurs, femmes entrepreneures, coopératives, TPME, groupements"],
        ["Zones géographiques", "2 à 3 régions — à définir conjointement avec le ministère"],
        ["Dispositifs associés", "PAJEC (ADTPME), FAIEJ, ANADEB"],
        ["Livrables", "Formation initiale · Accompagnement mensuel · Support continu · Rapports intermédiaire et final"],
      ],
      [35, 65],
    ),
    spacer(4),
    h2("Calendrier du pilote"),
    simpleTable(
      ["Période", "Étape", "Actions clés"],
      [
        ["Mois 1", "Lancement", "Sélection conjointe de la cohorte · Ouverture des comptes · Formation initiale (2 jours)"],
        ["Mois 2–5", "Usage & accompagnement", "Usage quotidien · Accompagnement mensuel · Assistance technique continue"],
        ["Mois 3", "Rapport intermédiaire", "Bilan à mi-parcours · Ajustements si nécessaire"],
        ["Mois 6", "Rapport final", "Analyse des résultats · Feuille de route d'extension chiffrée"],
      ],
      [15, 28, 57],
    ),
    spacer(4),
    h2("Critères de succès — mesurés conjointement"),
    simpleTable(
      ["Indicateur", "Cible"],
      [
        ["Taux d'activation de la cohorte", "≥ 80 %"],
        ["Usage actif mensuel au 6e mois", "≥ 60 %"],
        ["Factures émises par la cohorte", "≥ 500"],
        ["Satisfaction moyenne des bénéficiaires", "≥ 4 / 5"],
      ],
      [65, 35],
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 12. Plan de mise en œuvre ────────────────────────────────────────────────
function planMiseEnOeuvre(): (Paragraph | Table)[] {
  return [
    h1("10 — Plan de mise en œuvre"),
    simpleTable(
      ["Phase", "Période", "Objectifs", "Livrables clés"],
      [
        [
          "Phase 1 — Diagnostic",
          "Mois 0 à 1",
          "Identifier les besoins — choisir les cohortes et régions — définir les modules prioritaires",
          "Convention signée · Protocole de gouvernance des données",
        ],
        [
          "Phase 2 — Pilote",
          "Mois 1 à 7",
          "Déployer Gameasu auprès du groupe test — former, accompagner, collecter les retours",
          "Formation initiale · Rapport intermédiaire · Rapport final",
        ],
        [
          "Phase 3 — Évaluation",
          "Mois 7 à 9",
          "Analyser l'utilisation et les résultats — préparer la décision de passage à l'échelle",
          "Rapport d'évaluation · Recommandations d'extension",
        ],
        [
          "Phase 4 — Extension",
          "À partir du mois 9",
          "Élargir à de nouvelles cohortes et régions — former des formateurs internes — mettre en production le tableau de bord institutionnel",
          "Programme d'extension · Formateurs internes certifiés",
        ],
      ],
      [22, 14, 37, 27],
    ),
    spacer(4),
    callout(
      "La formation de formateurs internes dès la phase d'extension est un levier de durabilité clé : elle réduit les coûts récurrents et ancre le dispositif territorialement via le réseau existant des agences du ministère.",
      { bg: C.orangeLight, border: C.orange, textColor: C.navy },
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 13. Formations ───────────────────────────────────────────────────────────
function formations(): (Paragraph | Table)[] {
  return [
    h1("11 — Formations proposées"),
    body("Gameasu propose deux types de formation, complémentaires et dispensées par des experts praticiens."),
    spacer(2),
    h2("Formation à l'utilisation de l'ERP"),
    body("Objectif : maîtriser Gameasu pour gérer son organisation de manière autonome."),
    simpleTable(
      ["Module de formation", "Contenu"],
      [
        ["Prise en main", "Navigation, configuration de base, paramétrage de l'organisation"],
        ["Ventes & clients", "Saisie des ventes, gestion du portefeuille client, suivi des relances"],
        ["Facturation", "Création de devis, proformas et factures — suivi des paiements"],
        ["Dépenses & charges", "Enregistrement, catégorisation, rapprochement"],
        ["Trésorerie", "Suivi en temps réel, prévisions, alertes de seuil"],
        ["Stocks", "Entrées / sorties, valorisation, alertes de rupture"],
        ["Rapports & tableaux de bord", "Lecture des KPI, export PDF/Excel, interprétation des données"],
      ],
      [35, 65],
    ),
    spacer(4),
    h2("Formation métier & gestion d'entreprise"),
    body("Objectif : renforcer les compétences de gestion pour professionnaliser l'activité au-delà de l'outil."),
    simpleTable(
      ["Domaine", "Thèmes abordés"],
      [
        ["Gestion financière", "Budget, trésorerie, seuil de rentabilité, financement"],
        ["Comptabilité simplifiée", "SYSCOHADA, journal, bilans, états de résultat"],
        ["Commerce & vente", "Stratégie de prix, gestion des clients, relances, négociation"],
        ["Marketing", "Positionnement, acquisition client, fidélisation"],
        ["Ressources humaines", "Contrats, présences, paie simplifiée, recrutement"],
        ["Gestion de projet", "Planification, suivi budgétaire, pilotage de la performance"],
        ["Pilotage de la performance", "Indicateurs clés, analyse des écarts, décisions correctives"],
      ],
      [35, 65],
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 14. Gouvernance & sécurité ───────────────────────────────────────────────
function gouvernance(): (Paragraph | Table)[] {
  return [
    h1("12 — Gouvernance, sécurité et confidentialité"),
    body("Le partenariat repose sur une gouvernance claire et une protection rigoureuse des données personnelles des bénéficiaires."),
    spacer(2),
    h2("Répartition des rôles"),
    simpleTable(
      ["Acteur", "Rôle"],
      [
        ["Gameasu", "Fourniture et maintenance de la plateforme · Formation · Support technique · Tableau de bord institutionnel · Sécurité des données"],
        ["MDBESS", "Identification et orientation des bénéficiaires · Validation des cohortes · Pilotage institutionnel · Suivi du tableau de bord"],
        ["Agences (ADTPME, FAIEJ, ANADEB…)", "Relais terrain · Sélection des bénéficiaires · Accompagnement de proximité · Remontée des retours terrain"],
        ["Bénéficiaires", "Utilisation de la plateforme · Consentement éclairé · Participation aux formations · Alimentation des données"],
      ],
      [30, 70],
    ),
    spacer(4),
    h2("Principes de sécurité et de confidentialité"),
    bullet("Architecture multi-tenant : chaque organisation dispose d'un espace cloisonné — aucune donnée individuelle n'est partagée entre bénéficiaires"),
    bullet("Données agrégées et anonymisées exclusivement exposées au niveau institutionnel"),
    bullet("Consentement éclairé recueilli à l'ouverture de chaque compte"),
    bullet("Hébergement sécurisé et chiffré — certificats SSL/TLS"),
    bullet("Accès journalisés et attribués par rôle — audit trail complet"),
    bullet("Conformité à la loi togolaise sur la protection des données personnelles"),
    bullet("Droit à l'oubli et à la portabilité des données garantis"),
    bullet("Séparation stricte entre les données de gestion des bénéficiaires et les données institutionnelles"),
    spacer(3),
    callout(
      "La protection des données personnelles est traitée comme un pilier du partenariat — condition de l'adhésion aussi bien institutionnelle qu'individuelle. Une convention de partenariat et un protocole de gouvernance des données seront signés avant tout démarrage.",
      { bg: C.blueLight, border: C.blue },
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 15. Résultats attendus ───────────────────────────────────────────────────
function resultatsAttendus(): (Paragraph | Table)[] {
  return [
    h1("13 — Résultats attendus"),
    body("Les résultats sont mesurés à deux niveaux : l'impact sur les bénéficiaires, et la valeur créée pour le ministère."),
    spacer(2),
    h2("Pour les bénéficiaires"),
    simpleTable(
      ["Résultat", "Indicateur de mesure"],
      [
        ["Professionnalisation de la gestion", "% de bénéficiaires ayant produit au moins une facture / un rapport"],
        ["Visibilité financière", "% déclarant une meilleure compréhension de leur trésorerie"],
        ["Crédibilité auprès des banques", "% ayant soumis un dossier de crédit avec données Gameasu"],
        ["Réduction de la gestion informelle", "Volume de ventes et dépenses enregistrées dans l'outil"],
        ["Pérennité de l'activité", "Taux de bénéficiaires toujours actifs à 6 mois et 12 mois"],
        ["Accès au financement", "Nombre de nouveaux crédits ou subventions obtenus"],
      ],
      [50, 50],
    ),
    spacer(3),
    h2("Pour le ministère"),
    simpleTable(
      ["Résultat", "Indicateur de mesure"],
      [
        ["Suivi post-financement renforcé", "% de bénéficiaires post-crédit utilisant Gameasu activement"],
        ["Rapports d'impact fiables", "Indicateurs d'activité réels vs déclaratifs — écart mesuré"],
        ["Redevabilité bailleurs améliorée", "Qualité et précision des rapports fournis à BAD, KfW, AFD"],
        ["Extension territoriale", "Nombre de formateurs internes formés — couverture régionale"],
        ["Donnée ESS structurée", "Nombre d'entités de l'ESS intégrées et actives sur la plateforme"],
        ["Image de modernisation", "Visibilité nationale et internationale du programme de digitalisation"],
      ],
      [50, 50],
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── 16. Recommandations finales ──────────────────────────────────────────────
function recommandations(): (Paragraph | Table)[] {
  return [
    h1("14 — Recommandations finales"),
    callout(
      "Lancer un pilote de 6 mois avec une cohorte limitée, mesurer l'impact sur des critères chiffrés arrêtés conjointement, ajuster le dispositif, puis envisager une extension progressive — c'est l'approche la plus crédible face à un ministère et à des bailleurs exigeants en matière de résultats.",
      { bg: C.orangeLight, border: C.orange, textColor: C.navy },
    ),
    spacer(4),
    h2("Quatre recommandations stratégiques"),
    simpleTable(
      ["Recommandation", "Justification"],
      [
        [
          "01 — Engager par la preuve",
          "Proposer d'abord le pilote de 6 mois avec des critères de succès chiffrés arrêtés conjointement. C'est l'approche la plus crédible face à un ministère et à des bailleurs exigeants.",
        ],
        [
          "02 — Ancrer dans les dispositifs existants",
          "Prioriser les cohortes du PAJEC (ADTPME) et du FAIEJ, dont la logique d'accompagnement continu appelle directement cet outillage. Évite de créer une structure parallèle.",
        ],
        [
          "03 — Construire la durabilité dès le départ",
          "Intégrer la formation de formateurs internes dès la phase d'extension pour réduire les coûts récurrents et ancrer le dispositif territorialement via le réseau existant des agences.",
        ],
        [
          "04 — Faire de la donnée un argument central",
          "Le tableau de bord institutionnel répond à un besoin stratégique — pilotage, redevabilité, recensement ESS — et différencie Gameasu de toute offre logicielle classique.",
        ],
      ],
      [30, 70],
    ),
    spacer(6),
    divider(),
    spacer(4),
    para([
      run("Gameasu se tient à la disposition du Ministère du Développement à la Base et de l'Économie Sociale et Solidaire pour présenter cette proposition, organiser une démonstration de la plateforme et co-construire les termes d'un premier programme pilote.", {
        size: 11, italic: true, color: C.navy,
      }),
    ], { align: AlignmentType.CENTER }),
    spacer(6),
    // Closing logo + contact
    new Paragraph({
      children: [logoImage(160, 54)],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertMillimetersToTwip(4), after: convertMillimetersToTwip(4) },
    }),
    para([
      run("Gameasu — Équipe Partenariats Institutionnels  ·  contact@gameasu.com  ·  www.gameasu.com", {
        size: 10, color: C.gray600,
      }),
    ], { align: AlignmentType.CENTER }),
    para([
      run("Document confidentiel — diffusion restreinte — Juillet 2026", {
        size: 9, italic: true, color: C.gray600,
      }),
    ], { align: AlignmentType.CENTER }),
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// ASSEMBLE & WRITE
// ════════════════════════════════════════════════════════════════════════════

async function main() {
  const sections = [
    ...coverPage(),
    ...tableOfContents(),
    ...resumeExecutif(),
    ...contexte(),
    ...presentationGameasu(),
    ...beneficesBeneficiaires(),
    ...beneficesMinistere(),
    ...tableauBordInstitutionnel(),
    ...dispositifsPartenariat(),
    ...financement(),
    ...programmePilote(),
    ...planMiseEnOeuvre(),
    ...formations(),
    ...gouvernance(),
    ...resultatsAttendus(),
    ...recommandations(),
  ];

  const doc = new Document({
    creator: "Gameasu",
    title: "Proposition de partenariat stratégique — MDBESS",
    description: "Gameasu au service de la professionnalisation des entrepreneurs accompagnés par le MDBESS",
    keywords: "Gameasu, MDBESS, partenariat, ERP, entrepreneuriat, Togo",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.1),
            },
          },
        },
        children: sections,
      },
    ],
    styles: {
      default: {
        document: {
          run: { font, size: 22 },
        },
      },
    },
  });

  const outPath = path.join(process.cwd(), "Gameasu_Partenariat_MDBESS_2026.docx");
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  console.log(`✅  Document généré : ${outPath}  (${(buf.length / 1024).toFixed(0)} Ko)`);
}

main().catch(console.error);
