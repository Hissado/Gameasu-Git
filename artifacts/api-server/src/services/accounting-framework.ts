/**
 * Référentiels comptables par type d'organisation.
 * Chaque référentiel dispose de son propre plan de comptes minimal (MVP).
 * Le mapping orgType → accountingFramework est la source de vérité unique.
 */

import { db } from "@workspace/db";
import {
  chartOfAccountsTable,
  journalsTable,
  fiscalPeriodsTable,
  bankAccountsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgType =
  | "pme"            // Entreprise, PME, SA, SARL, SAS, GIE
  | "tpe"            // Très petite entreprise, microentreprise, indépendant
  | "cooperative"    // Coopérative, groupement d'intérêt économique (GIE)
  | "ong"            // Association, ONG, Fondation, OSBL
  | "banque"         // Banque, établissement de crédit
  | "microfinance"   // Institution de microfinance, SFD
  | "assurance"      // Compagnie d'assurance, mutuelle d'assurance
  | "prevoyance"     // Caisse de prévoyance, sécurité sociale
  | "administration" // Collectivité publique, administration
  | "cabinet"        // Cabinet comptable, profession libérale
  | "autre";         // Autre type d'organisation

export type AccountingFramework =
  | "syscohada"       // Entreprise/PME en zone OHADA
  | "syscohada_smt"   // Très petite entreprise (Système Minimal de Trésorerie)
  | "sycebnl"         // Entités à but non lucratif (associations/ONGs)
  | "pcb"             // Plan Comptable Bancaire UMOA (banques)
  | "microfinance"    // Système Financier Décentralisé (microfinance)
  | "cima"            // Plan comptable des assurances CIMA
  | "cipres"          // Référentiel CIPRES (prévoyance sociale)
  | "pce"             // Plan Comptable de l'État (administrations)
  | "autre";          // Autre référentiel non répertorié

// ─── Mapping orgType → framework ──────────────────────────────────────────────

export const ORG_TYPE_TO_FRAMEWORK: Record<OrgType, AccountingFramework> = {
  pme:            "syscohada",
  tpe:            "syscohada_smt",
  cooperative:    "syscohada",
  ong:            "sycebnl",
  banque:         "pcb",
  microfinance:   "microfinance",
  assurance:      "cima",
  prevoyance:     "cipres",
  administration: "pce",
  cabinet:        "syscohada",
  autre:          "syscohada",
};

// ─── Labels lisibles ──────────────────────────────────────────────────────────

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  pme:            "Entreprise / PME",
  tpe:            "Très petite entreprise (TPE)",
  cooperative:    "Coopérative / GIE",
  ong:            "Association / ONG / Fondation",
  banque:         "Banque / Établissement de crédit",
  microfinance:   "Institution de microfinance (SFD)",
  assurance:      "Compagnie d'assurance",
  prevoyance:     "Organisme de prévoyance sociale",
  administration: "Administration publique",
  cabinet:        "Cabinet / Profession libérale",
  autre:          "Autre type d'organisation",
};

export const FRAMEWORK_LABELS: Record<AccountingFramework, string> = {
  syscohada:      "SYSCOHADA — Système Comptable OHADA",
  syscohada_smt:  "SYSCOHADA SMT — Système Minimal de Trésorerie",
  sycebnl:        "SYCEBNL — Entités à But Non Lucratif",
  pcb:            "PCB UMOA — Plan Comptable Bancaire",
  microfinance:   "SFD — Système Financier Décentralisé",
  cima:           "CIMA — Assurances",
  cipres:         "CIPRES — Prévoyance Sociale",
  pce:            "PCE — Plan Comptable de l'État",
  autre:          "Autre référentiel",
};

export const FRAMEWORK_DESCRIPTIONS: Record<AccountingFramework, string> = {
  syscohada:     "Référentiel comptable commun à la zone OHADA (17 pays). Adapté aux entreprises, PME, SA, SARL et GIE.",
  syscohada_smt: "Version simplifiée du SYSCOHADA pour les très petites entreprises et micro-entreprises. Comptabilité de trésorerie.",
  sycebnl:       "Système Comptable des Entités à But Non Lucratif. Adapté aux associations, ONG, fondations et mutuelles.",
  pcb:           "Plan Comptable Bancaire de l'UMOA. Obligatoire pour les banques et établissements financiers de l'Union.",
  microfinance:  "Référentiel comptable des Systèmes Financiers Décentralisés (microfinance, coopératives d'épargne-crédit).",
  cima:          "Plan comptable des assurances selon le code CIMA (Conférence Interafricaine des Marchés d'Assurances).",
  cipres:        "Référentiel CIPRES pour les organismes de protection sociale et de prévoyance en Afrique de l'Ouest.",
  pce:           "Plan Comptable de l'État, adapté aux collectivités publiques, mairies et administrations d'État.",
  autre:         "Référentiel comptable personnalisé ou non répertorié dans le catalogue standard.",
};

// ─── Utilitaire ───────────────────────────────────────────────────────────────

export function getFrameworkForOrgType(orgType: string): AccountingFramework {
  return ORG_TYPE_TO_FRAMEWORK[orgType as OrgType] ?? "syscohada";
}

// ─── Helpers communs ──────────────────────────────────────────────────────────

type Acc = {
  code: string;
  label: string;
  classNum: number;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | "off_balance";
  normalBalance: "debit" | "credit";
  isPostable?: boolean;
};

const JOURNALS_STANDARD = [
  { code: "VTE", label: "Journal des ventes",   type: "sales",    defaultAccountCode: "411" },
  { code: "ACH", label: "Journal des achats",   type: "purchase", defaultAccountCode: "401" },
  { code: "BNQ", label: "Journal de banque",    type: "bank",     defaultAccountCode: "521" },
  { code: "CAI", label: "Journal de caisse",    type: "cash",     defaultAccountCode: "571" },
  { code: "OD",  label: "Opérations diverses",  type: "misc",     defaultAccountCode: null  },
];

// Préfixes de comptes « système » : requis par les automatisations Gameasu
// (clients, fournisseurs, banque, caisse, TVA, ventes, achats, paie, virements).
// Un compte dont le code commence par l'un d'eux est marqué isSystem → non
// supprimable et non désactivable sans substitut (§5/§6).
const SYSTEM_ACCOUNT_PREFIXES = [
  "401", "411", "443", "445", "512", "521", "531", "571", "581",
  "60", "70", "66", "421", "422", "431", "447",
];

export function isSystemAccountCode(code: string): boolean {
  const c = code.trim();
  return SYSTEM_ACCOUNT_PREFIXES.some((p) => c.startsWith(p));
}

async function insertAccounts(orgId: string, accounts: Acc[], framework: AccountingFramework) {
  const existing = await db.select({ code: chartOfAccountsTable.code })
    .from(chartOfAccountsTable)
    .where(eq(chartOfAccountsTable.organizationId, orgId));
  const existingCodes = new Set(existing.map((r) => r.code));
  const toInsert = accounts.filter((a) => !existingCodes.has(a.code));
  if (toInsert.length > 0) {
    await db.insert(chartOfAccountsTable).values(
      toInsert.map((a) => ({
        organizationId: orgId,
        code: a.code, label: a.label, classNum: a.classNum,
        type: a.type, normalBalance: a.normalBalance,
        isPostable: a.isPostable ?? true,
        // Traçabilité & classification (plan comptable propre à l'organisation).
        origin: "template",
        sourceFramework: framework,
        isSystem: isSystemAccountCode(a.code),
        level: Math.max(1, a.code.trim().length - 1),
        applicableFrameworks: [framework],
      })),
    );
  }
}

async function insertJournals(orgId: string, jours: typeof JOURNALS_STANDARD) {
  const allAccounts = await db.select().from(chartOfAccountsTable)
    .where(eq(chartOfAccountsTable.organizationId, orgId));
  const accByCode = new Map(allAccounts.map((a) => [a.code, a.id]));

  const existingJ = await db.select({ code: journalsTable.code }).from(journalsTable)
    .where(eq(journalsTable.organizationId, orgId));
  const existingJCodes = new Set(existingJ.map((r) => r.code));

  for (const j of jours) {
    if (existingJCodes.has(j.code)) continue;
    await db.insert(journalsTable).values({
      organizationId: orgId,
      code: j.code, label: j.label, type: j.type,
      defaultAccountId: j.defaultAccountCode ? (accByCode.get(j.defaultAccountCode) ?? null) : null,
    });
  }
}

async function ensureFiscalPeriod(orgId: string) {
  const periods = await db.select().from(fiscalPeriodsTable)
    .where(eq(fiscalPeriodsTable.organizationId, orgId));
  if (periods.length === 0) {
    const year = new Date().getFullYear();
    await db.insert(fiscalPeriodsTable).values({
      organizationId: orgId,
      name: `Exercice ${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      status: "open",
    });
  }
}

async function ensureBankAccounts(orgId: string, bankCode: string, cashCode: string) {
  const banks = await db.select().from(bankAccountsTable)
    .where(eq(bankAccountsTable.organizationId, orgId));
  if (banks.length > 0) return;
  const allAccounts = await db.select().from(chartOfAccountsTable)
    .where(eq(chartOfAccountsTable.organizationId, orgId));
  const accByCode = new Map(allAccounts.map((a) => [a.code, a.id]));
  const bankId = accByCode.get(bankCode);
  const cashId = accByCode.get(cashCode);
  if (bankId) {
    await db.insert(bankAccountsTable).values({
      organizationId: orgId, name: "Banque principale",
      type: "bank", accountId: bankId, currency: "XOF", openingBalance: "0",
    });
  }
  if (cashId) {
    await db.insert(bankAccountsTable).values({
      organizationId: orgId, name: "Caisse principale",
      type: "cash", accountId: cashId, currency: "XOF", openingBalance: "0",
    });
  }
}

// ─── SYSCOHADA — Entreprise / PME (standard) ─────────────────────────────────

const SYSCOHADA_ACCOUNTS: Acc[] = [
  { code: "10",   label: "Capital",                                      classNum: 1, type: "equity",    normalBalance: "credit", isPostable: false },
  { code: "101",  label: "Capital social",                               classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "11",   label: "Réserves",                                     classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "12",   label: "Report à nouveau",                             classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "13",   label: "Résultat net de l'exercice",                   classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "16",   label: "Emprunts et dettes assimilées",                classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "21",   label: "Immobilisations incorporelles",                classNum: 2, type: "asset",     normalBalance: "debit",  isPostable: false },
  { code: "211",  label: "Frais de recherche et de développement",       classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "24",   label: "Matériel",                                     classNum: 2, type: "asset",     normalBalance: "debit",  isPostable: false },
  { code: "241",  label: "Matériel et outillage industriel",             classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "244",  label: "Matériel et mobilier de bureau",               classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "245",  label: "Matériel de transport",                        classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "28",   label: "Amortissements",                               classNum: 2, type: "asset",     normalBalance: "credit", isPostable: false },
  { code: "2841", label: "Amortissement matériel et outillage",          classNum: 2, type: "asset",     normalBalance: "credit" },
  { code: "2844", label: "Amortissement matériel et mobilier bureau",    classNum: 2, type: "asset",     normalBalance: "credit" },
  { code: "2845", label: "Amortissement matériel de transport",          classNum: 2, type: "asset",     normalBalance: "credit" },
  { code: "31",   label: "Marchandises",                                 classNum: 3, type: "asset",     normalBalance: "debit" },
  { code: "32",   label: "Matières premières et fournitures",            classNum: 3, type: "asset",     normalBalance: "debit" },
  { code: "401",  label: "Fournisseurs",                                 classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "411",  label: "Clients",                                      classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "4191", label: "Clients - Avances et acomptes reçus",          classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "421",  label: "Personnel - Rémunérations dues",               classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "431",  label: "Sécurité sociale (CNPS)",                      classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "441",  label: "État - Impôts sur les bénéfices",              classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "4431", label: "État - TVA facturée (collectée)",              classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "4452", label: "État - TVA récupérable sur achats",            classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "4455", label: "État - TVA due",                               classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "475",  label: "Cautions versées et reçues",                   classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "521",  label: "Banques",                                      classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "531",  label: "Chèques postaux",                              classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "571",  label: "Caisse",                                       classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "601",  label: "Achats de marchandises",                       classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "604",  label: "Achats stockés de matières et fournitures",    classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "605",  label: "Autres achats (eau, électricité, fournitures)",classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "608",  label: "Achats d'emballages",                          classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "611",  label: "Transports sur achats",                        classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "614",  label: "Transports du personnel",                      classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "622",  label: "Locations et charges locatives",               classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "624",  label: "Entretien, réparations et maintenance",        classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "625",  label: "Primes d'assurance",                           classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "627",  label: "Publicité, publications, relations publiques", classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "628",  label: "Frais de télécommunications",                  classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "631",  label: "Frais bancaires",                              classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "641",  label: "Impôts et taxes directs",                      classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "661",  label: "Rémunérations directes versées au personnel",  classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "664",  label: "Charges sociales",                             classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "671",  label: "Intérêts des emprunts",                        classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "681",  label: "Dotations aux amortissements d'exploitation",  classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "701",  label: "Ventes de marchandises",                       classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "706",  label: "Services vendus (prestations de services)",    classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "707",  label: "Produits accessoires",                         classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "7071", label: "Locations de matériel",                        classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "758",  label: "Produits divers de gestion courante",          classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "771",  label: "Intérêts de prêts",                            classNum: 7, type: "revenue",   normalBalance: "credit" },
];

// ─── SYSCOHADA SMT — Très petite entreprise (Système Minimal de Trésorerie) ──

const SYSCOHADA_SMT_ACCOUNTS: Acc[] = [
  { code: "10",   label: "Capital",                                      classNum: 1, type: "equity",    normalBalance: "credit", isPostable: false },
  { code: "101",  label: "Capital personnel / apport",                   classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "16",   label: "Emprunts",                                     classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "24",   label: "Matériel d'exploitation",                      classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "31",   label: "Stock de marchandises",                        classNum: 3, type: "asset",     normalBalance: "debit" },
  { code: "401",  label: "Fournisseurs",                                 classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "411",  label: "Clients",                                      classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "441",  label: "État - Impôts et taxes",                       classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "521",  label: "Banques",                                      classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "571",  label: "Caisse",                                       classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "601",  label: "Achats de marchandises",                       classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "605",  label: "Fournitures et autres achats",                 classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "622",  label: "Loyers",                                       classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "661",  label: "Charges de personnel",                         classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "641",  label: "Impôts et taxes",                              classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "701",  label: "Recettes — ventes de marchandises",            classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "706",  label: "Recettes — prestations de services",           classNum: 7, type: "revenue",   normalBalance: "credit" },
];

// ─── SYCEBNL — Association / ONG / Fondation ─────────────────────────────────

const SYCEBNL_ACCOUNTS: Acc[] = [
  { code: "10",   label: "Fonds propres",                                classNum: 1, type: "equity",    normalBalance: "credit", isPostable: false },
  { code: "101",  label: "Fonds associatifs",                            classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "102",  label: "Réserves",                                     classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "12",   label: "Report à nouveau",                             classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "13",   label: "Résultat net de l'exercice",                   classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "16",   label: "Emprunts et subventions remboursables",        classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "24",   label: "Équipements et mobilier",                      classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "28",   label: "Amortissements des immobilisations",           classNum: 2, type: "asset",     normalBalance: "credit" },
  { code: "35",   label: "Stocks consommables et fournitures",           classNum: 3, type: "asset",     normalBalance: "debit" },
  { code: "401",  label: "Fournisseurs",                                 classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "411",  label: "Débiteurs divers",                             classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "441",  label: "État — retenues fiscales",                     classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "461",  label: "Dons et subventions à recevoir",               classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "521",  label: "Banques",                                      classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "571",  label: "Caisse",                                       classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "601",  label: "Achats de fournitures et consommables",        classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "622",  label: "Locations et charges locatives",               classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "624",  label: "Entretien et maintenance",                     classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "627",  label: "Communication et sensibilisation",             classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "628",  label: "Frais de télécommunications",                  classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "661",  label: "Salaires et indemnités du personnel",          classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "664",  label: "Charges sociales",                             classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "681",  label: "Dotations aux amortissements",                 classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "706",  label: "Prestations de services / activités",          classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "751",  label: "Cotisations des membres",                      classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "754",  label: "Dons et legs reçus",                           classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "755",  label: "Subventions reçues",                           classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "758",  label: "Autres produits divers",                       classNum: 7, type: "revenue",   normalBalance: "credit" },
];

// ─── PCB UMOA — Banque / Établissement de crédit ──────────────────────────────

const PCB_UMOA_ACCOUNTS: Acc[] = [
  { code: "10",   label: "Capital, dotations et réserves",               classNum: 1, type: "equity",    normalBalance: "credit", isPostable: false },
  { code: "101",  label: "Capital social",                               classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "106",  label: "Réserves légales et statutaires",              classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "13",   label: "Résultat net",                                 classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "16",   label: "Emprunts subordonnés",                         classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "20",   label: "Opérations avec les établissements de crédit", classNum: 2, type: "asset",     normalBalance: "debit",  isPostable: false },
  { code: "201",  label: "Comptes ordinaires débiteurs",                 classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "21",   label: "Opérations avec la clientèle",                 classNum: 2, type: "asset",     normalBalance: "debit",  isPostable: false },
  { code: "211",  label: "Crédits à court terme",                        classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "212",  label: "Crédits à moyen terme",                        classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "213",  label: "Crédits à long terme",                         classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "25",   label: "Portefeuille titres",                          classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "30",   label: "Ressources émanant des établissements de crédit",classNum:3, type: "liability", normalBalance: "credit", isPostable: false },
  { code: "301",  label: "Comptes ordinaires créditeurs",                classNum: 3, type: "liability", normalBalance: "credit" },
  { code: "31",   label: "Comptes de la clientèle",                      classNum: 3, type: "liability", normalBalance: "credit", isPostable: false },
  { code: "311",  label: "Dépôts à vue (comptes courants)",              classNum: 3, type: "liability", normalBalance: "credit" },
  { code: "312",  label: "Dépôts à terme",                               classNum: 3, type: "liability", normalBalance: "credit" },
  { code: "313",  label: "Comptes d'épargne",                            classNum: 3, type: "liability", normalBalance: "credit" },
  { code: "40",   label: "Comptes de régularisation actif",              classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "41",   label: "Comptes de régularisation passif",             classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "50",   label: "Caisse et avoirs",                             classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "501",  label: "Caisse",                                       classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "521",  label: "Compte BCEAO",                                 classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "60",   label: "Charges sur opérations de trésorerie",         classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "61",   label: "Charges sur opérations avec la clientèle",     classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "65",   label: "Charges générales d'exploitation",             classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "651",  label: "Frais de personnel",                           classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "652",  label: "Impôts et taxes",                              classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "66",   label: "Dotations aux amortissements et provisions",   classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "70",   label: "Produits sur opérations de trésorerie",        classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "71",   label: "Produits sur opérations avec la clientèle",    classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "711",  label: "Intérêts sur crédits à la clientèle",          classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "75",   label: "Commissions et autres produits",               classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "76",   label: "Reprises de provisions",                       classNum: 7, type: "revenue",   normalBalance: "credit" },
];

// ─── SFD — Institution de microfinance ──────────────────────────────────────

const SFD_ACCOUNTS: Acc[] = [
  { code: "10",   label: "Capital, dotations et fonds propres",          classNum: 1, type: "equity",    normalBalance: "credit", isPostable: false },
  { code: "101",  label: "Capital / Fonds de dotation",                  classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "102",  label: "Fonds de garantie",                            classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "13",   label: "Résultat net de l'exercice",                   classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "16",   label: "Emprunts et ressources empruntées",            classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "21",   label: "Crédits octroyés à la clientèle",              classNum: 2, type: "asset",     normalBalance: "debit",  isPostable: false },
  { code: "211",  label: "Crédits à court terme",                        classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "212",  label: "Crédits à moyen terme",                        classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "219",  label: "Provisions sur créances douteuses",            classNum: 2, type: "asset",     normalBalance: "credit" },
  { code: "25",   label: "Immobilisations corporelles",                  classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "31",   label: "Dépôts et épargne des membres",                classNum: 3, type: "liability", normalBalance: "credit", isPostable: false },
  { code: "311",  label: "Dépôts à vue (parts sociales)",                classNum: 3, type: "liability", normalBalance: "credit" },
  { code: "312",  label: "Épargne volontaire",                           classNum: 3, type: "liability", normalBalance: "credit" },
  { code: "313",  label: "Épargne bloquée",                              classNum: 3, type: "liability", normalBalance: "credit" },
  { code: "401",  label: "Fournisseurs",                                 classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "441",  label: "État - Impôts et taxes",                       classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "521",  label: "Banque (compte courant)",                      classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "571",  label: "Caisse",                                       classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "65",   label: "Charges générales d'exploitation",             classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "661",  label: "Frais de personnel",                           classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "671",  label: "Charges financières sur ressources",           classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "681",  label: "Dotations aux amortissements et provisions",   classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "711",  label: "Intérêts et commissions sur crédits",          classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "715",  label: "Frais d'adhésion et de dossier",               classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "758",  label: "Subventions et dons",                          classNum: 7, type: "revenue",   normalBalance: "credit" },
];

// ─── CIMA — Compagnie d'assurance ─────────────────────────────────────────────

const CIMA_ACCOUNTS: Acc[] = [
  { code: "10",   label: "Capital, réserves et provisions réglementées", classNum: 1, type: "equity",    normalBalance: "credit", isPostable: false },
  { code: "101",  label: "Capital social",                               classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "102",  label: "Réserve légale",                               classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "13",   label: "Résultat net",                                 classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "14",   label: "Provisions techniques",                        classNum: 1, type: "liability", normalBalance: "credit", isPostable: false },
  { code: "141",  label: "Provisions pour primes non acquises (PPNA)",   classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "142",  label: "Provisions pour sinistres à payer (PSAP)",     classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "16",   label: "Emprunts et dettes",                           classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "20",   label: "Placements et investissements",                classNum: 2, type: "asset",     normalBalance: "debit",  isPostable: false },
  { code: "201",  label: "Placements immobiliers",                       classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "202",  label: "Valeurs mobilières",                           classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "25",   label: "Immobilisations corporelles d'exploitation",   classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "401",  label: "Fournisseurs",                                 classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "411",  label: "Assurés — primes à recevoir",                  classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "421",  label: "Personnel",                                    classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "441",  label: "État - Impôts et taxes",                       classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "521",  label: "Banques",                                      classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "571",  label: "Caisse",                                       classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "601",  label: "Sinistres payés (branche vie)",                classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "602",  label: "Sinistres payés (branche non-vie)",            classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "605",  label: "Commissions sur primes cédées en réassurance", classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "651",  label: "Frais de personnel",                           classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "652",  label: "Commissions d'apporteurs d'affaires",          classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "681",  label: "Dotations aux amortissements et provisions",   classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "701",  label: "Primes émises (branche vie)",                  classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "702",  label: "Primes émises (branche non-vie)",              classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "710",  label: "Produits des placements",                      classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "758",  label: "Autres produits techniques",                   classNum: 7, type: "revenue",   normalBalance: "credit" },
];

// ─── CIPRES — Organisme de prévoyance sociale ─────────────────────────────────

const CIPRES_ACCOUNTS: Acc[] = [
  { code: "10",   label: "Fonds propres et réserves",                    classNum: 1, type: "equity",    normalBalance: "credit", isPostable: false },
  { code: "101",  label: "Fonds patrimoniaux",                           classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "102",  label: "Réserves techniques",                          classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "13",   label: "Résultat de l'exercice",                       classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "14",   label: "Provisions techniques (prestations futures)",   classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "16",   label: "Emprunts",                                     classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "20",   label: "Placements financiers",                        classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "25",   label: "Immobilisations corporelles",                  classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "411",  label: "Cotisants — créances de cotisations",          classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "421",  label: "Personnel — rémunérations dues",               classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "431",  label: "Assurés sociaux — prestations à payer",        classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "441",  label: "État - taxes et cotisations reversées",        classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "521",  label: "Banques",                                      classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "571",  label: "Caisse",                                       classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "601",  label: "Prestations versées (retraites, pensions)",    classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "602",  label: "Prestations versées (AT/MP, famille)",         classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "651",  label: "Frais de personnel",                           classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "664",  label: "Charges sociales patronales",                  classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "681",  label: "Dotations aux amortissements et provisions",   classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "701",  label: "Cotisations patronales reçues",                classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "702",  label: "Cotisations salariales reçues",                classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "710",  label: "Produits financiers des placements",           classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "758",  label: "Subventions de l'État",                        classNum: 7, type: "revenue",   normalBalance: "credit" },
];

// ─── PCE — Administration publique / Collectivité ─────────────────────────────

const PCE_ACCOUNTS: Acc[] = [
  { code: "10",   label: "Dotations de l'État et fonds publics",         classNum: 1, type: "equity",    normalBalance: "credit", isPostable: false },
  { code: "101",  label: "Dotations permanentes",                        classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "12",   label: "Report à nouveau",                             classNum: 1, type: "equity",    normalBalance: "credit" },
  { code: "16",   label: "Emprunts de l'État / emprunts obligataires",   classNum: 1, type: "liability", normalBalance: "credit" },
  { code: "21",   label: "Immobilisations incorporelles",                classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "23",   label: "Immobilisations corporelles",                  classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "24",   label: "Infrastructure et équipements publics",        classNum: 2, type: "asset",     normalBalance: "debit" },
  { code: "28",   label: "Amortissements",                               classNum: 2, type: "asset",     normalBalance: "credit" },
  { code: "31",   label: "Stocks",                                       classNum: 3, type: "asset",     normalBalance: "debit" },
  { code: "401",  label: "Fournisseurs",                                 classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "411",  label: "Débiteurs — redevables de l'État",             classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "421",  label: "Personnel — rémunérations dues",               classNum: 4, type: "liability", normalBalance: "credit" },
  { code: "441",  label: "Comptes de liaison avec le Trésor",            classNum: 4, type: "asset",     normalBalance: "debit" },
  { code: "521",  label: "Compte courant Trésor",                        classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "571",  label: "Caisse de menues dépenses",                    classNum: 5, type: "asset",     normalBalance: "debit" },
  { code: "601",  label: "Achats de fournitures et consommables",        classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "621",  label: "Prestations de services et sous-traitance",    classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "622",  label: "Locations et charges locatives",               classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "651",  label: "Charges de personnel",                         classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "681",  label: "Dotations aux amortissements",                 classNum: 6, type: "expense",   normalBalance: "debit" },
  { code: "701",  label: "Recettes fiscales (impôts, taxes)",            classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "706",  label: "Recettes de services publics",                 classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "741",  label: "Dotations et transferts reçus de l'État",      classNum: 7, type: "revenue",   normalBalance: "credit" },
  { code: "755",  label: "Subventions et appuis extérieurs",             classNum: 7, type: "revenue",   normalBalance: "credit" },
];

// ─── Journaux par référentiel ──────────────────────────────────────────────────

const JOURNALS_BY_FRAMEWORK: Record<AccountingFramework, typeof JOURNALS_STANDARD> = {
  syscohada:      JOURNALS_STANDARD,
  syscohada_smt:  JOURNALS_STANDARD,
  sycebnl: [
    { code: "REC", label: "Journal des recettes",          type: "sales",    defaultAccountCode: "521" },
    { code: "DEP", label: "Journal des dépenses",          type: "purchase", defaultAccountCode: "401" },
    { code: "BNQ", label: "Journal de banque",             type: "bank",     defaultAccountCode: "521" },
    { code: "CAI", label: "Journal de caisse",             type: "cash",     defaultAccountCode: "571" },
    { code: "OD",  label: "Opérations diverses",           type: "misc",     defaultAccountCode: null  },
  ],
  pcb: [
    { code: "OPE", label: "Opérations courantes",          type: "misc",     defaultAccountCode: null  },
    { code: "CAI", label: "Caisse",                        type: "cash",     defaultAccountCode: "501" },
    { code: "BNQ", label: "Compte BCEAO",                  type: "bank",     defaultAccountCode: "521" },
    { code: "OD",  label: "Opérations diverses",           type: "misc",     defaultAccountCode: null  },
  ],
  microfinance: [
    { code: "CRE", label: "Journal des crédits",           type: "sales",    defaultAccountCode: "211" },
    { code: "EPN", label: "Journal de l'épargne",          type: "misc",     defaultAccountCode: "311" },
    { code: "BNQ", label: "Journal de banque",             type: "bank",     defaultAccountCode: "521" },
    { code: "CAI", label: "Journal de caisse",             type: "cash",     defaultAccountCode: "571" },
    { code: "OD",  label: "Opérations diverses",           type: "misc",     defaultAccountCode: null  },
  ],
  cima: [
    { code: "PRM", label: "Journal des primes",            type: "sales",    defaultAccountCode: "411" },
    { code: "SIN", label: "Journal des sinistres",         type: "misc",     defaultAccountCode: null  },
    { code: "BNQ", label: "Journal de banque",             type: "bank",     defaultAccountCode: "521" },
    { code: "CAI", label: "Journal de caisse",             type: "cash",     defaultAccountCode: "571" },
    { code: "OD",  label: "Opérations diverses",           type: "misc",     defaultAccountCode: null  },
  ],
  cipres: [
    { code: "COT", label: "Journal des cotisations",       type: "sales",    defaultAccountCode: "411" },
    { code: "PRE", label: "Journal des prestations",       type: "misc",     defaultAccountCode: null  },
    { code: "BNQ", label: "Journal de banque",             type: "bank",     defaultAccountCode: "521" },
    { code: "CAI", label: "Journal de caisse",             type: "cash",     defaultAccountCode: "571" },
    { code: "OD",  label: "Opérations diverses",           type: "misc",     defaultAccountCode: null  },
  ],
  pce: [
    { code: "REC", label: "Journal des recettes publiques",type: "sales",    defaultAccountCode: "521" },
    { code: "DEP", label: "Journal des dépenses publiques",type: "purchase", defaultAccountCode: "401" },
    { code: "TRE", label: "Compte Trésor",                 type: "bank",     defaultAccountCode: "521" },
    { code: "CAI", label: "Journal de caisse",             type: "cash",     defaultAccountCode: "571" },
    { code: "OD",  label: "Opérations diverses",           type: "misc",     defaultAccountCode: null  },
  ],
  autre: JOURNALS_STANDARD,
};

// ─── Accounts by framework ────────────────────────────────────────────────────

const ACCOUNTS_BY_FRAMEWORK: Record<AccountingFramework, Acc[]> = {
  syscohada:      SYSCOHADA_ACCOUNTS,
  syscohada_smt:  SYSCOHADA_SMT_ACCOUNTS,
  sycebnl:        SYCEBNL_ACCOUNTS,
  pcb:            PCB_UMOA_ACCOUNTS,
  microfinance:   SFD_ACCOUNTS,
  cima:           CIMA_ACCOUNTS,
  cipres:         CIPRES_ACCOUNTS,
  pce:            PCE_ACCOUNTS,
  autre:          SYSCOHADA_ACCOUNTS,
};

// Bank/cash accounts by framework
const BANK_CASH_CODES: Record<AccountingFramework, { bank: string; cash: string }> = {
  syscohada:     { bank: "521", cash: "571" },
  syscohada_smt: { bank: "521", cash: "571" },
  sycebnl:       { bank: "521", cash: "571" },
  pcb:           { bank: "521", cash: "501" },
  microfinance:  { bank: "521", cash: "571" },
  cima:          { bank: "521", cash: "571" },
  cipres:        { bank: "521", cash: "571" },
  pce:           { bank: "521", cash: "571" },
  autre:         { bank: "521", cash: "571" },
};

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Seeds le plan comptable, les journaux, l'exercice fiscal et les comptes
 * banque/caisse pour une organisation selon son référentiel comptable.
 * Idempotent — peut être appelé plusieurs fois sans duplication.
 */
export async function seedAccountingFrameworkForOrg(
  organizationId: string,
  framework: AccountingFramework = "syscohada",
): Promise<void> {
  const accounts = ACCOUNTS_BY_FRAMEWORK[framework] ?? SYSCOHADA_ACCOUNTS;
  const journals = JOURNALS_BY_FRAMEWORK[framework] ?? JOURNALS_STANDARD;
  const codes = BANK_CASH_CODES[framework] ?? { bank: "521", cash: "571" };

  await insertAccounts(organizationId, accounts, framework);
  await insertJournals(organizationId, journals);
  await ensureFiscalPeriod(organizationId);
  await ensureBankAccounts(organizationId, codes.bank, codes.cash);

  logger.info({ organizationId, framework }, "Accounting framework seeded (SYSCOHADA base plan)");
}
