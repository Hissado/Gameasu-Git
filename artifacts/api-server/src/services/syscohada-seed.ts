import { db } from "@workspace/db";
import {
  chartOfAccountsTable,
  journalsTable,
  fiscalPeriodsTable,
  bankAccountsTable,
  organizationsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Plan comptable SYSCOHADA — comptes essentiels (MVP).
 * On distingue les "noeuds" (isPostable: false) des comptes imputables.
 * Cette liste couvre les besoins courants d'une PME multi-secteurs en zone OHADA.
 */
type Acc = {
  code: string;
  label: string;
  classNum: number;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | "off_balance";
  normalBalance: "debit" | "credit";
  isPostable?: boolean;
};

const ACCOUNTS: Acc[] = [
  // CLASSE 1 — RESSOURCES DURABLES
  { code: "10",     label: "Capital",                                      classNum: 1, type: "equity",      normalBalance: "credit", isPostable: false },
  { code: "101",    label: "Capital social",                               classNum: 1, type: "equity",      normalBalance: "credit" },
  { code: "11",     label: "Réserves",                                     classNum: 1, type: "equity",      normalBalance: "credit" },
  { code: "12",     label: "Report à nouveau",                             classNum: 1, type: "equity",      normalBalance: "credit" },
  { code: "13",     label: "Résultat net de l'exercice",                   classNum: 1, type: "equity",      normalBalance: "credit" },
  { code: "16",     label: "Emprunts et dettes assimilées",                classNum: 1, type: "liability",   normalBalance: "credit" },

  // CLASSE 2 — IMMOBILISATIONS
  { code: "21",     label: "Immobilisations incorporelles",                classNum: 2, type: "asset",       normalBalance: "debit",  isPostable: false },
  { code: "211",    label: "Frais de recherche et de développement",       classNum: 2, type: "asset",       normalBalance: "debit" },
  { code: "24",     label: "Matériel",                                     classNum: 2, type: "asset",       normalBalance: "debit",  isPostable: false },
  { code: "241",    label: "Matériel et outillage industriel",             classNum: 2, type: "asset",       normalBalance: "debit" },
  { code: "244",    label: "Matériel et mobilier de bureau",               classNum: 2, type: "asset",       normalBalance: "debit" },
  { code: "245",    label: "Matériel de transport",                        classNum: 2, type: "asset",       normalBalance: "debit" },
  { code: "28",     label: "Amortissements",                               classNum: 2, type: "asset",       normalBalance: "credit", isPostable: false },
  { code: "2841",   label: "Amortissement matériel et outillage",          classNum: 2, type: "asset",       normalBalance: "credit" },
  { code: "2844",   label: "Amortissement matériel et mobilier bureau",    classNum: 2, type: "asset",       normalBalance: "credit" },
  { code: "2845",   label: "Amortissement matériel de transport",          classNum: 2, type: "asset",       normalBalance: "credit" },

  // CLASSE 3 — STOCKS
  { code: "31",     label: "Marchandises",                                 classNum: 3, type: "asset",       normalBalance: "debit" },
  { code: "32",     label: "Matières premières et fournitures",            classNum: 3, type: "asset",       normalBalance: "debit" },

  // CLASSE 4 — TIERS
  { code: "401",    label: "Fournisseurs",                                 classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "411",    label: "Clients",                                      classNum: 4, type: "asset",       normalBalance: "debit" },
  { code: "4191",   label: "Clients - Avances et acomptes reçus",          classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "421",    label: "Personnel - Rémunérations dues",               classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "431",    label: "Sécurité sociale (CNPS)",                      classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "441",    label: "État - Impôts sur les bénéfices",              classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "4471",   label: "État - IRPP retenu à la source",               classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "4472",   label: "État - IPTS retenu à la source",               classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "4431",   label: "État - TVA facturée (collectée)",              classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "4452",   label: "État - TVA récupérable sur achats",            classNum: 4, type: "asset",       normalBalance: "debit" },
  { code: "4455",   label: "État - TVA due",                               classNum: 4, type: "liability",   normalBalance: "credit" },
  { code: "475",    label: "Cautions versées et reçues",                   classNum: 4, type: "liability",   normalBalance: "credit" },

  // CLASSE 5 — TRÉSORERIE
  { code: "521",    label: "Banques",                                      classNum: 5, type: "asset",       normalBalance: "debit" },
  { code: "531",    label: "Chèques postaux",                              classNum: 5, type: "asset",       normalBalance: "debit" },
  { code: "571",    label: "Caisse",                                       classNum: 5, type: "asset",       normalBalance: "debit" },

  // CLASSE 6 — CHARGES D'EXPLOITATION
  { code: "601",    label: "Achats de marchandises",                       classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "604",    label: "Achats stockés de matières et fournitures",    classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "605",    label: "Autres achats (eau, électricité, fournitures)",classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "608",    label: "Achats d'emballages",                          classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "611",    label: "Transports sur achats",                        classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "614",    label: "Transports du personnel",                      classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "622",    label: "Locations et charges locatives",               classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "624",    label: "Entretien, réparations et maintenance",        classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "625",    label: "Primes d'assurance",                           classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "627",    label: "Publicité, publications, relations publiques", classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "628",    label: "Frais de télécommunications",                  classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "631",    label: "Frais bancaires",                              classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "641",    label: "Impôts et taxes directs",                      classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "661",    label: "Rémunérations directes versées au personnel",  classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "664",    label: "Charges sociales",                             classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "671",    label: "Intérêts des emprunts",                        classNum: 6, type: "expense",     normalBalance: "debit" },
  { code: "681",    label: "Dotations aux amortissements d'exploitation",  classNum: 6, type: "expense",     normalBalance: "debit" },

  // CLASSE 7 — PRODUITS D'EXPLOITATION
  { code: "701",    label: "Ventes de marchandises",                       classNum: 7, type: "revenue",     normalBalance: "credit" },
  { code: "706",    label: "Services vendus (prestations de services)",    classNum: 7, type: "revenue",     normalBalance: "credit" },
  { code: "707",    label: "Produits accessoires",                         classNum: 7, type: "revenue",     normalBalance: "credit" },
  { code: "7071",   label: "Locations de matériel",                        classNum: 7, type: "revenue",     normalBalance: "credit" },
  { code: "758",    label: "Produits divers de gestion courante",          classNum: 7, type: "revenue",     normalBalance: "credit" },
  { code: "771",    label: "Intérêts de prêts",                            classNum: 7, type: "revenue",     normalBalance: "credit" },
];

const JOURNALS = [
  { code: "VTE", label: "Journal des ventes",       type: "sales",    defaultAccountCode: "411"  },
  { code: "ACH", label: "Journal des achats",       type: "purchase", defaultAccountCode: "401"  },
  { code: "BNQ", label: "Journal de banque",        type: "bank",     defaultAccountCode: "521"  },
  { code: "CAI", label: "Journal de caisse",        type: "cash",     defaultAccountCode: "571"  },
  { code: "OD",  label: "Opérations diverses",      type: "misc",     defaultAccountCode: null   },
];

export async function seedSyscohadaForOrg(organizationId: string): Promise<void> {
  // 1. Plan comptable (idempotent par (orgId, code))
  const existing = await db.select({ code: chartOfAccountsTable.code })
    .from(chartOfAccountsTable)
    .where(eq(chartOfAccountsTable.organizationId, organizationId));
  const existingCodes = new Set(existing.map((r) => r.code));
  const toInsert = ACCOUNTS.filter((a) => !existingCodes.has(a.code));
  if (toInsert.length > 0) {
    await db.insert(chartOfAccountsTable).values(
      toInsert.map((a) => ({
        organizationId,
        code: a.code,
        label: a.label,
        classNum: a.classNum,
        type: a.type,
        normalBalance: a.normalBalance,
        isPostable: a.isPostable ?? true,
      })),
    );
  }

  // 2. Journaux
  const allAccounts = await db.select().from(chartOfAccountsTable)
    .where(eq(chartOfAccountsTable.organizationId, organizationId));
  const accByCode = new Map(allAccounts.map((a) => [a.code, a.id]));
  const existingJournals = await db.select({ code: journalsTable.code }).from(journalsTable)
    .where(eq(journalsTable.organizationId, organizationId));
  const existingJournalCodes = new Set(existingJournals.map((r) => r.code));

  for (const j of JOURNALS) {
    if (existingJournalCodes.has(j.code)) continue;
    await db.insert(journalsTable).values({
      organizationId,
      code: j.code,
      label: j.label,
      type: j.type,
      defaultAccountId: j.defaultAccountCode ? accByCode.get(j.defaultAccountCode) ?? null : null,
    });
  }

  // 3. Exercice fiscal en cours
  const periods = await db.select().from(fiscalPeriodsTable)
    .where(eq(fiscalPeriodsTable.organizationId, organizationId));
  if (periods.length === 0) {
    const year = new Date().getFullYear();
    await db.insert(fiscalPeriodsTable).values({
      organizationId,
      name: `Exercice ${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      status: "open",
    });
  }

  // 4. Compte bancaire/caisse par défaut si aucun n'existe
  const banks = await db.select().from(bankAccountsTable)
    .where(eq(bankAccountsTable.organizationId, organizationId));
  if (banks.length === 0) {
    const banque521 = accByCode.get("521");
    const caisse571 = accByCode.get("571");
    if (banque521) {
      await db.insert(bankAccountsTable).values({
        organizationId,
        name: "Banque principale",
        type: "bank",
        accountId: banque521,
        currency: "XOF",
        openingBalance: "0",
      });
    }
    if (caisse571) {
      await db.insert(bankAccountsTable).values({
        organizationId,
        name: "Caisse principale",
        type: "cash",
        accountId: caisse571,
        currency: "XOF",
        openingBalance: "0",
      });
    }
  }
}

export async function seedSyscohada(): Promise<void> {
  const orgs = await db.select({ id: organizationsTable.id }).from(organizationsTable);
  for (const o of orgs) {
    await seedSyscohadaForOrg(o.id);
  }
  logger.info({ orgs: orgs.length }, "SYSCOHADA: seed terminé");
}

/**
 * Retourne l'exercice fiscal couvrant la date donnée (ou aujourd'hui par défaut).
 * Utiliser la date de l'écriture est essentiel : une opération antidatée doit
 * être rattachée à l'exercice de sa date, pas de la saisie.
 */
export async function getCurrentFiscalPeriod(organizationId: string, forDate?: string) {
  const target = forDate ?? new Date().toISOString().slice(0, 10);
  const periods = await db
    .select()
    .from(fiscalPeriodsTable)
    .where(and(
      eq(fiscalPeriodsTable.organizationId, organizationId),
      sql`${fiscalPeriodsTable.startDate} <= ${target} AND ${fiscalPeriodsTable.endDate} >= ${target}`,
    ));
  return periods[0] ?? null;
}
