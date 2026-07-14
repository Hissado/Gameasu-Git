/**
 * Migration idempotente — Module Réclamations RH
 * Crée les 3 tables si elles n'existent pas encore.
 * À exécuter : `cd lib/db && pnpm exec tsx src/migrate-hr-claims.ts`
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`
    -- Table principale des réclamations
    CREATE TABLE IF NOT EXISTS hr_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      collaborator_id UUID NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
      reference TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'brouillon',
      priority TEXT NOT NULL DEFAULT 'normale',
      assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
      target_date DATE,
      resolved_at TIMESTAMPTZ,
      resolution_note TEXT,
      is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS hr_claims_org_idx ON hr_claims(organization_id);
    CREATE INDEX IF NOT EXISTS hr_claims_collab_idx ON hr_claims(collaborator_id);
    CREATE INDEX IF NOT EXISTS hr_claims_status_idx ON hr_claims(status);
    CREATE UNIQUE INDEX IF NOT EXISTS hr_claims_ref_org_uidx ON hr_claims(organization_id, reference);

    -- Chronologie des événements (changements de statut + commentaires)
    CREATE TABLE IF NOT EXISTS hr_claim_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      claim_id UUID NOT NULL REFERENCES hr_claims(id) ON DELETE CASCADE,
      author_id UUID REFERENCES users(id) ON DELETE SET NULL,
      kind TEXT NOT NULL DEFAULT 'comment',
      from_status TEXT,
      to_status TEXT,
      content TEXT,
      is_internal BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS hr_claim_events_claim_idx ON hr_claim_events(claim_id);
    CREATE INDEX IF NOT EXISTS hr_claim_events_org_idx ON hr_claim_events(organization_id);

    -- Pièces jointes
    CREATE TABLE IF NOT EXISTS hr_claim_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      claim_id UUID NOT NULL REFERENCES hr_claims(id) ON DELETE CASCADE,
      uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS hr_claim_attachments_claim_idx ON hr_claim_attachments(claim_id);
    CREATE INDEX IF NOT EXISTS hr_claim_attachments_org_idx ON hr_claim_attachments(organization_id);
  `);

  console.log("✓ hr_claims, hr_claim_events, hr_claim_attachments — tables créées ou déjà présentes.");
  await pool.end();
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
