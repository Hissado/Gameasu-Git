/**
 * Migration : enrichissement audit_logs v2 + création security_alerts
 * Run: cd lib/db && pnpm exec tsx src/migrate-audit-v2.ts
 */
import pg from "pg";

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Enrichir audit_logs ──────────────────────────────────────────
    const alterAudit = `
      ALTER TABLE audit_logs
        ADD COLUMN IF NOT EXISTS user_role     TEXT,
        ADD COLUMN IF NOT EXISTS category      TEXT NOT NULL DEFAULT 'audit',
        ADD COLUMN IF NOT EXISTS severity      TEXT NOT NULL DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'success',
        ADD COLUMN IF NOT EXISTS module        TEXT,
        ADD COLUMN IF NOT EXISTS sub_module    TEXT,
        ADD COLUMN IF NOT EXISTS page          TEXT,
        ADD COLUMN IF NOT EXISTS entity_name   TEXT,
        ADD COLUMN IF NOT EXISTS changes       JSONB,
        ADD COLUMN IF NOT EXISTS error_message TEXT,
        ADD COLUMN IF NOT EXISTS session_id    TEXT,
        ADD COLUMN IF NOT EXISTS request_id    TEXT,
        ADD COLUMN IF NOT EXISTS browser       TEXT,
        ADD COLUMN IF NOT EXISTS os            TEXT,
        ADD COLUMN IF NOT EXISTS device        TEXT;
    `;
    await client.query(alterAudit);
    console.log("✓ audit_logs colonnes ajoutées");

    // ── Nouveaux index ───────────────────────────────────────────────
    const indexes = [
      `CREATE INDEX IF NOT EXISTS audit_logs_org_idx      ON audit_logs (organization_id)`,
      `CREATE INDEX IF NOT EXISTS audit_logs_category_idx ON audit_logs (category)`,
      `CREATE INDEX IF NOT EXISTS audit_logs_severity_idx ON audit_logs (severity)`,
      `CREATE INDEX IF NOT EXISTS audit_logs_module_idx   ON audit_logs (module)`,
    ];
    for (const idx of indexes) { await client.query(idx); }
    console.log("✓ index audit_logs créés");

    // ── Créer security_alerts ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email       TEXT,
        type             TEXT NOT NULL,
        severity         TEXT NOT NULL DEFAULT 'high',
        message          TEXT NOT NULL,
        detail           JSONB,
        resolved_at      TIMESTAMPTZ,
        resolved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS security_alerts_org_idx      ON security_alerts (organization_id);
      CREATE INDEX IF NOT EXISTS security_alerts_user_idx     ON security_alerts (user_id);
      CREATE INDEX IF NOT EXISTS security_alerts_resolved_idx ON security_alerts (resolved_at);
      CREATE INDEX IF NOT EXISTS security_alerts_created_idx  ON security_alerts (created_at);
    `);
    console.log("✓ security_alerts créée");

    await client.query("COMMIT");
    console.log("✓ Migration audit v2 terminée avec succès");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("✗ Migration échouée:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
