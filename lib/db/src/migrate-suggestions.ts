import { pool } from "./index";

async function migrateSuggestions() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'autre',
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'normale',
        status TEXT NOT NULL DEFAULT 'nouvelle',
        module TEXT,
        browser_info TEXT,
        device_info TEXT,
        screenshot_url TEXT,
        assigned_to TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS product_suggestions_org_idx ON product_suggestions(organization_id);
      CREATE INDEX IF NOT EXISTS product_suggestions_status_idx ON product_suggestions(status);
      CREATE INDEX IF NOT EXISTS product_suggestions_category_idx ON product_suggestions(category);

      CREATE TABLE IF NOT EXISTS suggestion_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        suggestion_id UUID NOT NULL REFERENCES product_suggestions(id) ON DELETE CASCADE,
        from_status TEXT,
        to_status TEXT,
        comment TEXT,
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS suggestion_events_suggestion_idx ON suggestion_events(suggestion_id);
    `);
    console.log("[migrate-suggestions] Tables product_suggestions + suggestion_events créées (idempotent)");
  } finally {
    client.release();
  }
}

migrateSuggestions().catch(console.error).finally(() => pool.end());
