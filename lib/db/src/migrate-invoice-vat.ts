/**
 * Migration idempotente — TVA sur factures clients (audit P0.1)
 * Ajoute les colonnes HT / taux / montant TVA à `invoices`.
 * Colonnes nullables : aucune donnée existante n'est modifiée ; les factures
 * antérieures gardent totalAmount seul (TVA inconnue → écriture sans 4431).
 * À exécuter : `cd lib/db && pnpm exec tsx src/migrate-invoice-vat.ts`
 * Réversible : ALTER TABLE invoices DROP COLUMN subtotal_amount, tax_rate, tax_amount;
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(15,2);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2);
  `);
  console.log("✔ invoices : colonnes TVA prêtes (subtotal_amount, tax_rate, tax_amount)");
}

migrate()
  .then(() => pool.end())
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
