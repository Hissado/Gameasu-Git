/**
 * Migration idempotente — Demandes RH (Pointage §10).
 * Crée `hr_requests` : workflow générique Demande → Étude → Pièces justificatives
 * pour permissions, déplacements, missions, déclarations de maladie et d'accident.
 *
 * À exécuter (préproduction d'abord) : `cd lib/db && pnpm exec tsx src/migrate-hr-requests.ts`
 * Réversible : DROP TABLE hr_requests;
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hr_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      start_date DATE,
      end_date DATE,
      status TEXT NOT NULL DEFAULT 'submitted',
      requester_id UUID REFERENCES users(id),
      collaborator_id UUID REFERENCES collaborators(id),
      reviewer_id UUID REFERENCES users(id),
      review_notes TEXT,
      decided_at TIMESTAMPTZ,
      rejection_reason TEXT,
      attachments JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS hr_requests_org_type_idx ON hr_requests (organization_id, type);
    CREATE INDEX IF NOT EXISTS hr_requests_status_idx ON hr_requests (status);
  `);
  console.log("✔ hr_requests : table des demandes RH (permissions, missions, déplacements, maladie, accident) prête");
}

migrate()
  .then(() => pool.end())
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
