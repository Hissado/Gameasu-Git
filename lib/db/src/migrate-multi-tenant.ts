/**
 * Migration multi-tenant Gaméasù.
 *
 * Pour chaque table historique listée, on :
 *   1. ajoute `organization_id uuid` (nullable, idempotent via IF NOT EXISTS)
 *   2. backfill toutes les lignes vers l'organisation démo (slug `gameasu-demo`)
 *   3. passe la colonne en NOT NULL
 *   4. crée la contrainte FK vers `organizations(id) ON DELETE CASCADE` (si absente)
 *   5. crée un index `<table>_org_idx` (si absent)
 *
 * Le script est strictement idempotent : il peut être ré-exécuté sans risque.
 */
import { sql } from "drizzle-orm";
import { db, pool } from "./index";

const TABLES = [
  // users (1)
  "users",
  // clients (2)
  "clients", "client_contacts",
  // crm (2)
  "opportunities", "crm_activities",
  // projects (2)
  "projects", "project_phases",
  // tasks (3)
  "tasks", "task_comments", "task_history",
  // collaborators (1)
  "collaborators",
  // hr (5)
  "departments", "positions", "contracts", "hr_documents", "collaborator_assignments",
  // equipment (3)
  "equipment_categories", "equipment", "equipment_movements",
  // rentals (4)
  "rentals", "rental_items", "inspections", "logistics_operations",
  // orders (4)
  "orders", "proformas", "invoices", "payments",
  // accounting (10)
  "chart_of_accounts", "fiscal_periods", "journals", "journal_entries", "journal_entry_lines",
  "suppliers", "supplier_invoices", "bank_accounts", "bank_transactions", "fixed_assets",
  // services (1)
  "services",
  // documents (1)
  "documents",
  // marketing (10)
  "prospects", "marketing_audiences", "marketing_templates", "marketing_campaigns",
  "campaign_recipients", "marketing_automations", "marketing_automation_logs",
  "marketing_alert_rules", "marketing_alert_logs", "marketing_consent",
  // alerts / tickets / reports (3)
  "alerts", "tickets", "daily_stock_reports",
  // fpa (2)
  "budgets", "budget_lines",
  // messaging (10 — user_presence reste global)
  "conversations", "conversation_participants", "messages", "message_attachments",
  "message_reads", "message_reactions", "message_mentions", "push_subscriptions",
  "whatsapp_channels", "call_sessions", "notifications",
  // engagements (3)
  "client_services", "service_sections", "user_client_access",
  // audit logs (rbac)
  "audit_logs",
];

async function migrate() {
  console.log("→ Migration multi-tenant démarrée…");

  // L'org démo peut être seedée sous différents slugs selon l'historique (`gameasu-demo`, `nexora-demo`).
  // On prend la première organisation existante triée par `createdAt`.
  const result = await db.execute(sql`SELECT id, slug FROM organizations ORDER BY created_at ASC LIMIT 1`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (result as any).rows?.[0] ?? (result as unknown as Array<{ id: string; slug: string }>)[0];
  const demoOrgId: string | undefined = row?.id;
  if (!demoOrgId) {
    throw new Error(
      "Aucune organisation trouvée. Exécutez d'abord seedSaas (boot de l'API)."
    );
  }
  console.log(`  • Org cible: ${row.slug} (${demoOrgId})`);
  console.log(`  • Demo org id: ${demoOrgId}`);

  for (const t of TABLES) {
    process.stdout.write(`  • ${t.padEnd(36)} `);
    try {
      // 1. Ajoute la colonne si absente
      await db.execute(sql.raw(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "organization_id" uuid`));
      // 2. Backfill — toutes les lignes NULL → demo org
      const updRes = await db.execute(sql.raw(`UPDATE "${t}" SET "organization_id" = '${demoOrgId}' WHERE "organization_id" IS NULL`));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (updRes as any).rowCount ?? 0;
      // 3. NOT NULL
      await db.execute(sql.raw(`ALTER TABLE "${t}" ALTER COLUMN "organization_id" SET NOT NULL`));
      // 4. FK (si absente)
      const fkName = `${t}_organization_id_fkey`;
      await db.execute(sql.raw(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fkName}') THEN
            ALTER TABLE "${t}" ADD CONSTRAINT "${fkName}" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
          END IF;
        END $$;
      `));
      // 5. Index
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${t}_org_idx" ON "${t}"("organization_id")`));
      console.log(`✓ (${rows} lignes backfillées)`);
    } catch (e) {
      console.log(`✗ ${(e as Error).message}`);
      throw e;
    }
  }

  console.log("\n✓ Migration multi-tenant terminée avec succès.");
  await pool.end();
}

migrate().catch((e) => {
  console.error("✗ Migration échouée:", e);
  process.exit(1);
});
