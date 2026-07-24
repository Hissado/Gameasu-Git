/**
 * Mappage comptable des modules (§7/§12) — plan comptable propre à chaque org.
 *
 * Chaque opération automatique (vente, achat, paie, trésorerie…) référence un
 * *rôle* fonctionnel plutôt qu'un code en dur. Le rôle est résolu vers un code
 * du plan comptable **de l'organisation active** via la table `account_mappings`,
 * avec repli sur le code par défaut du référentiel si aucune personnalisation
 * n'existe. Ainsi, changer le mappage d'un tenant n'affecte que ce tenant, et
 * les codes par défaut reproduisent exactement le comportement historique.
 */
import { db, accountMappingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type MappingModule = "sales" | "purchase" | "payroll" | "treasury";

export type MappingRole = {
  role: string;
  label: string;
  module: MappingModule;
  defaultCode: string;
};

// Catalogue des rôles de mappage. Les `defaultCode` sont EXACTEMENT les codes
// historiquement câblés dans `postings.ts` → comportement inchangé par défaut.
export const MAPPING_ROLES: MappingRole[] = [
  // ── Ventes ──
  { role: "sales_client",         label: "Compte client",                 module: "sales",    defaultCode: "411" },
  { role: "sales_revenue",        label: "Compte de produits (ventes)",   module: "sales",    defaultCode: "706" },
  { role: "sales_vat_collected",  label: "TVA collectée",                 module: "sales",    defaultCode: "4431" },
  // ── Achats ──
  { role: "purchase_supplier",       label: "Compte fournisseur",             module: "purchase", defaultCode: "401" },
  { role: "purchase_expense_default",label: "Compte de charges par défaut",   module: "purchase", defaultCode: "605" },
  { role: "purchase_vat_deductible", label: "TVA déductible",                 module: "purchase", defaultCode: "4452" },
  // ── Paie ──
  { role: "payroll_gross",            label: "Salaires bruts",                module: "payroll",  defaultCode: "661" },
  { role: "payroll_employer_charges", label: "Charges patronales",            module: "payroll",  defaultCode: "664" },
  { role: "payroll_net",              label: "Net à payer au personnel",      module: "payroll",  defaultCode: "421" },
  { role: "payroll_social",           label: "Organismes sociaux (CNSS)",     module: "payroll",  defaultCode: "431" },
  { role: "payroll_income_tax_irpp",  label: "IRPP retenu à la source",       module: "payroll",  defaultCode: "4471" },
  { role: "payroll_income_tax_ipts",  label: "IPTS retenu à la source",       module: "payroll",  defaultCode: "4472" },
  { role: "expense_report",           label: "Frais professionnels (notes de frais)", module: "payroll", defaultCode: "618" },
  // ── Trésorerie ──
  { role: "treasury_bank", label: "Compte de banque", module: "treasury", defaultCode: "521" },
  { role: "treasury_cash", label: "Compte de caisse", module: "treasury", defaultCode: "571" },
];

const DEFAULTS: Record<string, string> = Object.fromEntries(
  MAPPING_ROLES.map((r) => [r.role, r.defaultCode]),
);

export type CodeMap = Record<string, string>;

/**
 * Renvoie la table `role → code` pour une organisation : chaque rôle du
 * catalogue, avec le code personnalisé s'il existe, sinon le code par défaut.
 * `exec` permet de partager la transaction courante (lecture cohérente).
 */
export async function getAccountCodeMap(organizationId: string, exec: typeof db = db): Promise<CodeMap> {
  const rows = await exec.select({ role: accountMappingsTable.role, code: accountMappingsTable.accountCode })
    .from(accountMappingsTable)
    .where(eq(accountMappingsTable.organizationId, organizationId));
  const overrides: CodeMap = {};
  for (const r of rows) overrides[r.role] = r.code;
  return { ...DEFAULTS, ...overrides };
}

/** Code par défaut d'un rôle (référentiel), sans lecture DB. */
export function defaultCodeFor(role: string): string | undefined {
  return DEFAULTS[role];
}
