/**
 * Migration idempotente — Mappage comptable des modules (§7).
 * Crée la table `account_mappings` (role → code du plan comptable, par
 * organisation). Aucune donnée existante n'est modifiée ; en l'absence de
 * lignes, le moteur d'écritures retombe sur les codes par défaut du référentiel
 * (comportement inchangé).
 *
 * À exécuter (préproduction d'abord) : `cd lib/db && pnpm exec tsx src/migrate-account-mappings.ts`
 * Réversible : DROP TABLE account_mappings;
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS account_mappings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      account_code TEXT NOT NULL,
      updated_by_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS account_mappings_org_role_uidx ON account_mappings (organization_id, role);
  `);
  console.log("✔ account_mappings : table de mappage comptable prête");
}

migrate()
  .then(() => pool.end())
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
