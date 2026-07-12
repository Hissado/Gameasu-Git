/**
 * Migration : ajout de org_type et accounting_framework sur organizations.
 * À exécuter une seule fois : `pnpm --filter @workspace/db exec tsx src/migrate-add-org-type.ts`
 * Idempotent (IF NOT EXISTS).
 */
import { db } from "./index";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`
    ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS org_type text DEFAULT 'pme',
    ADD COLUMN IF NOT EXISTS accounting_framework text DEFAULT 'syscohada'
  `);
  console.log("Migration OK: org_type + accounting_framework ajoutés");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
