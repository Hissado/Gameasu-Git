/**
 * Migration idempotente — Numérotation unifiée des documents (audit P2 §F #15)
 * Crée les tables de séquences et de préfixes configurables. Aucune donnée
 * existante n'est modifiée (les anciens numéros restent valides).
 * `cd lib/db && pnpm exec tsx src/migrate-document-numbering.ts`
 * Réversible : DROP TABLE document_number_sequences, document_number_settings;
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_number_sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS doc_number_seq_uidx
      ON document_number_sequences(organization_id, doc_type, year);

    CREATE TABLE IF NOT EXISTS document_number_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      prefix TEXT NOT NULL,
      padding INTEGER NOT NULL DEFAULT 5,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS doc_number_settings_uidx
      ON document_number_settings(organization_id, doc_type);
  `);

  // Amorçage des compteurs à partir des documents existants, pour que la
  // numérotation reprenne au-dessus des numéros au format séquentiel déjà
  // présents (…-AAAA-NNNNN). Les formats non séquentiels (INV-<base36>) sont
  // ignorés : ils cohabiteront avec les nouveaux numéros sans collision.
  await db.execute(sql`
    INSERT INTO document_number_sequences (organization_id, doc_type, year, last_number)
    SELECT organization_id, 'invoice',
           CAST(substring(reference_number from '^[A-Z]+-(\\d{4})-') AS INTEGER),
           MAX(CAST(substring(reference_number from '^[A-Z]+-\\d{4}-(\\d+)$') AS INTEGER))
    FROM invoices
    WHERE reference_number ~ '^[A-Z]+-\\d{4}-\\d+$'
    GROUP BY organization_id, CAST(substring(reference_number from '^[A-Z]+-(\\d{4})-') AS INTEGER)
    ON CONFLICT (organization_id, doc_type, year)
    DO UPDATE SET last_number = GREATEST(document_number_sequences.last_number, EXCLUDED.last_number);
  `);

  console.log("✔ Numérotation unifiée prête (document_number_sequences, document_number_settings)");
}

migrate()
  .then(() => pool.end())
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
