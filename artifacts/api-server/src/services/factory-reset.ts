import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { seedSaas } from "@workspace/db/seed-saas";
import { logger } from "../lib/logger";
import { seedRbac } from "../lib/rbac/seed";
import { ensureCockpitAdmin } from "./ensure-admin";
import { seedHr } from "./hr-seed";
import { seedSyscohada } from "./syscohada-seed";

/**
 * Tables de configuration / catalogue GLOBAL à PRÉSERVER lors d'une
 * réinitialisation usine. Ce ne sont jamais des données tenant :
 *  - subscription_plans / subscription_plan_features : catalogue des offres (Starter…Enterprise)
 *  - module_catalog : catalogue des modules activables
 *  - permissions / roles / role_permissions : socle RBAC système
 *
 * ⚠️ `role_permissions` possède une FK vers `users` : un `TRUNCATE users … CASCADE`
 * la vide malgré sa présence ici. Ce n'est pas un problème car l'étape de
 * re-seed ci-dessous ré-exécute `seedRbac()` (idempotent) qui la reconstruit
 * immédiatement. Les autres tables conservées n'ont pas de FK vers une table
 * purgée et survivent donc au TRUNCATE. Une vérification finale garantit que
 * tout le socle de référence est présent avant de renvoyer un succès.
 */
const KEEP_TABLES = new Set<string>([
  "subscription_plans",
  "subscription_plan_features",
  "module_catalog",
  "permissions",
  "roles",
  "role_permissions",
]);

/** Tables de référence qui DOIVENT être non vides après une réinitialisation réussie. */
const REQUIRED_NON_EMPTY = [
  "permissions",
  "roles",
  "role_permissions",
  "subscription_plans",
  "module_catalog",
] as const;

const COCKPIT_ADMIN_EMAIL = "cockpit@gameasu.com";

export interface FactoryResetReport {
  truncated: string[];
  kept: string[];
  recreated: {
    platformOrg: boolean;
    cockpitAdminEmail: string;
  };
  verified: boolean;
}

async function countRows(table: string): Promise<number> {
  const ident = `"${table.replace(/"/g, '""')}"`;
  const res = await db.execute<{ n: string }>(sql.raw(`SELECT count(*)::int AS n FROM ${ident}`));
  return Number((res.rows as Array<{ n: number | string }>)[0]?.n ?? 0);
}

/**
 * Réinitialisation usine : supprime TOUTES les données applicatives
 * (comptes, organisations, abonnements, facturation, CRM, RH, finance,
 * stock, kiosk, messagerie, logs métier…) tout en conservant le schéma,
 * les migrations et le catalogue de configuration global.
 *
 * Après la purge, on reconstruit une base propre identique à une première
 * installation — sans dépendre d'un redémarrage du serveur :
 *  - socle RBAC (permissions/roles/role_permissions) + catalogue (plans/modules) ré-semés ;
 *  - organisation interne de la plateforme + super-admin Cockpit
 *    (sans mot de passe : à définir via le lien sécurisé « Mot de passe oublié ») ;
 *  - structures par défaut (départements/postes + plan comptable SYSCOHADA)
 *    pour l'organisation plateforme.
 *
 * Échoue (throw) si le socle de référence ou le super-admin n'est pas
 * correctement reconstruit (fail-closed) afin de ne jamais laisser une base
 * dans un état inutilisable / sans accès.
 *
 * ⚠️ Opération IRRÉVERSIBLE. Réservée au super-admin via endpoint protégé.
 */
export async function factoryReset(): Promise<FactoryResetReport> {
  // 1. Lister toutes les tables applicatives du schéma public (source : catalogue PG, pas d'entrée utilisateur).
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const allTables = (result.rows as Array<{ tablename: string }>).map((r) => r.tablename);

  const targets = allTables.filter(
    (t) => !KEEP_TABLES.has(t) && !t.startsWith("__drizzle") && t !== "drizzle_migrations",
  );
  const kept = allTables.filter((t) => KEEP_TABLES.has(t));

  if (targets.length === 0) {
    logger.warn("factoryReset: aucune table à purger");
    return {
      truncated: [],
      kept,
      recreated: { platformOrg: false, cockpitAdminEmail: "" },
      verified: false,
    };
  }

  // 2. Purge atomique. RESTART IDENTITY remet les séquences à zéro ; CASCADE
  //    couvre toutes les dépendances FK (toutes incluses dans `targets`).
  //    Les identifiants proviennent du catalogue PostgreSQL et sont quotés.
  const identList = targets.map((t) => `"${t.replace(/"/g, '""')}"`).join(", ");
  logger.warn({ tables: targets.length }, "factoryReset: TRUNCATE de toutes les données applicatives");
  await db.execute(sql.raw(`TRUNCATE TABLE ${identList} RESTART IDENTITY CASCADE`));

  // 3. Re-bootstrap d'une base « première installation » — sans redémarrage.
  //    seedRbac/seedSaas sont idempotents et reconstruisent le socle de référence
  //    (dont role_permissions que le CASCADE a pu vider via sa FK vers users).
  await seedRbac();
  await seedSaas({ includeDemoData: false });
  await ensureCockpitAdmin();
  try {
    await seedHr();
  } catch (e) {
    logger.error({ err: e }, "factoryReset: seedHr a échoué");
  }
  try {
    await seedSyscohada();
  } catch (e) {
    logger.error({ err: e }, "factoryReset: seedSyscohada a échoué");
  }

  // 4. Vérification fail-closed : socle de référence + super-admin présents.
  for (const table of REQUIRED_NON_EMPTY) {
    const n = await countRows(table);
    if (n === 0) {
      throw new Error(
        `factoryReset: la table de référence « ${table} » est vide après reconstruction — réinitialisation interrompue`,
      );
    }
  }

  const adminRes = await db.execute<{ n: string }>(
    sql`SELECT count(*)::int AS n FROM users WHERE email = ${COCKPIT_ADMIN_EMAIL} AND role = 'super_admin'`,
  );
  const adminCount = Number((adminRes.rows as Array<{ n: number | string }>)[0]?.n ?? 0);
  if (adminCount === 0) {
    throw new Error(
      "factoryReset: le super-admin Cockpit n'a pas pu être recréé — réinitialisation interrompue",
    );
  }

  logger.warn(
    { truncated: targets.length, kept: kept.length },
    "factoryReset: terminé et vérifié — base propre prête pour la production",
  );

  return {
    truncated: targets.sort(),
    kept: kept.sort(),
    recreated: { platformOrg: true, cockpitAdminEmail: COCKPIT_ADMIN_EMAIL },
    verified: true,
  };
}
