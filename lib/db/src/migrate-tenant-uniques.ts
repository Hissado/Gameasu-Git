/**
 * Migration : remplace les unique indexes globaux sur `code` par des composites
 * (organization_id, code) pour permettre à chaque tenant d'utiliser les mêmes
 * codes (DIR, OPS, 411…) en isolation totale.
 *
 * Idempotent : DROP IF EXISTS + CREATE IF NOT EXISTS.
 */
import { db } from "./index";
import { sql } from "drizzle-orm";

const CHANGES: Array<{ table: string; oldIdx: string; newIdx: string; cols: string }> = [
  { table: "departments",      oldIdx: "departments_code_uidx",          newIdx: "departments_org_code_uidx",      cols: "organization_id, code" },
  { table: "positions",        oldIdx: "positions_code_uidx",            newIdx: "positions_org_code_uidx",        cols: "organization_id, code" },
  { table: "chart_of_accounts",oldIdx: "chart_accounts_code_uidx",       newIdx: "chart_accounts_org_code_uidx",   cols: "organization_id, code" },
  { table: "journals",         oldIdx: "journals_code_uidx",             newIdx: "journals_org_code_uidx",         cols: "organization_id, code" },
  { table: "journal_entries",  oldIdx: "journal_entries_number_uidx",    newIdx: "journal_entries_org_number_uidx",cols: "organization_id, entry_number" },
  { table: "suppliers",        oldIdx: "suppliers_code_uidx",            newIdx: "suppliers_org_code_uidx",        cols: "organization_id, code" },
  { table: "fixed_assets",     oldIdx: "fixed_assets_code_uidx",         newIdx: "fixed_assets_org_code_uidx",     cols: "organization_id, code" },
];

async function migrate() {
  console.log("→ Migration indexes uniques tenant-scoped…");
  for (const c of CHANGES) {
    process.stdout.write(`  • ${c.table.padEnd(24)} `);
    await db.execute(sql.raw(`DROP INDEX IF EXISTS "${c.oldIdx}"`));
    await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "${c.newIdx}" ON "${c.table}" (${c.cols})`));
    console.log(`✓ ${c.newIdx}`);
  }
  console.log("✓ Migration uniques composites terminée.");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("✗ Migration échouée:", e);
  process.exit(1);
});
