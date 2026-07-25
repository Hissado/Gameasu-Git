/**
 * Migration idempotente — Plan comptable propre à chaque organisation (Phase A-2).
 * Enrichit `chart_of_accounts` avec les attributs de personnalisation, de
 * classification (système/modèle/personnalisé/importé) et de traçabilité.
 *
 * Toutes les colonnes sont nullables ou dotées d'un défaut : aucune donnée
 * existante n'est modifiée. Les comptes déjà semés restent `origin='custom'`
 * par défaut jusqu'à un éventuel re-tagging par `seedAccountingFrameworkForOrg`.
 *
 * À exécuter (préproduction d'abord) : `cd lib/db && pnpm exec tsx src/migrate-coa-enrich.ts`
 * Réversible : ALTER TABLE chart_of_accounts DROP COLUMN custom_label, description,
 *   origin, is_system, is_collective, level, currency, default_tax_code,
 *   default_cost_center_id, source_framework, deactivated_at, created_by_id,
 *   updated_by_id, updated_at;
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS custom_label TEXT;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'custom';
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_collective BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS level INTEGER;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS currency TEXT;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS default_tax_code TEXT;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS default_cost_center_id UUID;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS source_framework TEXT;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);
    ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    CREATE INDEX IF NOT EXISTS chart_accounts_origin_idx ON chart_of_accounts (origin);
  `);
  console.log("✔ chart_of_accounts : colonnes de personnalisation/classification prêtes (origin, is_system, custom_label, …)");
}

migrate()
  .then(() => pool.end())
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
