/**
 * Migration idempotente — Réconciliation RBAC (audit P1, §D)
 *
 * Contexte : deux modèles contradictoires ont coexisté :
 *   - ancien : permissions(label, category) + role_permissions(permission_id UUID, granted_by_id)
 *   - canonique (schéma Drizzle actuel, imposé par push-force) :
 *       permissions(name, module) + role_permissions(permission_code TEXT, organization_id)
 * Ce décalage faisait échouer silencieusement le seed RBAC (violation NOT NULL)
 * → catalogue de permissions vide, matrice de droits inconsultable.
 *
 * Ce script amène N'IMPORTE QUEL état historique vers le modèle canonique,
 * sans perte : renommages si possible, sinon backfill puis nettoyage.
 * À exécuter AVANT le déploiement du code aligné (préproduction d'abord).
 * `cd lib/db && pnpm exec tsx src/migrate-rbac-align.ts`
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`
    DO $$
    BEGIN
      -- ── permissions.label → name ─────────────────────────────────────────
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='label') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='name') THEN
          ALTER TABLE permissions RENAME COLUMN label TO name;
        ELSE
          UPDATE permissions SET name = COALESCE(NULLIF(name, ''), label) WHERE label IS NOT NULL;
          ALTER TABLE permissions DROP COLUMN label;
        END IF;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='name') THEN
        ALTER TABLE permissions ADD COLUMN name TEXT;
      END IF;
      UPDATE permissions SET name = code WHERE name IS NULL OR name = '';
      ALTER TABLE permissions ALTER COLUMN name SET NOT NULL;

      -- ── permissions.category → module ────────────────────────────────────
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='category') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='module') THEN
          ALTER TABLE permissions RENAME COLUMN category TO module;
        ELSE
          UPDATE permissions SET module = COALESCE(module, category);
          ALTER TABLE permissions DROP COLUMN category;
        END IF;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='module') THEN
        ALTER TABLE permissions ADD COLUMN module TEXT;
      END IF;

      -- ── role_permissions.permission_code (backfill depuis permission_id) ─
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='role_permissions' AND column_name='permission_code') THEN
        ALTER TABLE role_permissions ADD COLUMN permission_code TEXT;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='role_permissions' AND column_name='permission_id') THEN
        UPDATE role_permissions rp SET permission_code = p.code
          FROM permissions p
          WHERE rp.permission_id = p.id AND rp.permission_code IS NULL;
        -- Liens orphelins (permission supprimée) : aucun code résoluble → purge.
        DELETE FROM role_permissions WHERE permission_code IS NULL;
        ALTER TABLE role_permissions DROP COLUMN permission_id;
      END IF;
      DELETE FROM role_permissions WHERE permission_code IS NULL;
      ALTER TABLE role_permissions ALTER COLUMN permission_code SET NOT NULL;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='role_permissions' AND column_name='organization_id') THEN
        ALTER TABLE role_permissions ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='role_permissions' AND column_name='granted_by_id') THEN
        ALTER TABLE role_permissions DROP COLUMN granted_by_id;
      END IF;
    END $$;

    -- ── user_permission_overrides : réconciliation nom + colonnes ──────────
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_permission_overrides')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_perm_overrides') THEN
        ALTER TABLE user_perm_overrides RENAME TO user_permission_overrides;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_permission_overrides') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permission_overrides' AND column_name='type') THEN
          ALTER TABLE user_permission_overrides ADD COLUMN type TEXT NOT NULL DEFAULT 'grant';
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permission_overrides' AND column_name='granted') THEN
            UPDATE user_permission_overrides SET type = CASE WHEN granted THEN 'grant' ELSE 'deny' END;
          END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permission_overrides' AND column_name='granted') THEN
          ALTER TABLE user_permission_overrides DROP COLUMN granted;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permission_overrides' AND column_name='reason') THEN
          ALTER TABLE user_permission_overrides ADD COLUMN reason TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permission_overrides' AND column_name='expires_at') THEN
          ALTER TABLE user_permission_overrides ADD COLUMN expires_at TIMESTAMPTZ;
        END IF;
      END IF;
    END $$;

    -- Dédoublonnage avant contrainte d'unicité (garde la ligne la plus ancienne)
    DELETE FROM role_permissions a USING role_permissions b
      WHERE a.role_id = b.role_id AND a.permission_code = b.permission_code
        AND a.ctid > b.ctid;
    CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_uidx
      ON role_permissions(role_id, permission_code);
  `);
  console.log("✔ RBAC réconcilié : permissions(name, module) + role_permissions(permission_code)");
}

migrate()
  .then(() => pool.end())
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
