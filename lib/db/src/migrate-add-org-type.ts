/**
 * Migration complète : configuration comptable par type d'organisation.
 * Idempotente — peut être relancée plusieurs fois sans effet de bord.
 * À exécuter : `cd lib/db && pnpm exec tsx src/migrate-add-org-type.ts`
 *
 * Couvre :
 *   1. organizations.org_type + organizations.accounting_framework
 *   2. chart_of_accounts.applicable_frameworks (jsonb)
 *   3. Table accounting_frameworks (catalogue des référentiels)
 *   4. Valeurs par défaut corrigées (pme / syscohada)
 *   5. Migration des anciens codes anglais → nouveaux codes français minuscules
 *   6. Seed du catalogue (9 référentiels)
 */
import { pool } from "./index";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. org_type + accounting_framework sur organizations
    await client.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS org_type text DEFAULT 'pme',
        ADD COLUMN IF NOT EXISTS accounting_framework text DEFAULT 'syscohada'
    `);
    await client.query(`ALTER TABLE organizations ALTER COLUMN org_type SET DEFAULT 'pme'`);
    await client.query(`ALTER TABLE organizations ALTER COLUMN accounting_framework SET DEFAULT 'syscohada'`);

    // 2. applicable_frameworks sur chart_of_accounts
    await client.query(`
      ALTER TABLE chart_of_accounts
        ADD COLUMN IF NOT EXISTS applicable_frameworks jsonb DEFAULT '["syscohada"]'::jsonb
    `);

    // 3. Catalogue accounting_frameworks
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounting_frameworks (
        code                  text PRIMARY KEY,
        label                 text NOT NULL,
        description           text,
        applicable_org_types  jsonb NOT NULL DEFAULT '[]'::jsonb,
        is_active             boolean NOT NULL DEFAULT true
      )
    `);

    // 4. Migration valeurs anglaises → françaises minuscules
    await client.query(`
      UPDATE organizations SET
        org_type = CASE org_type
          WHEN 'enterprise'        THEN 'pme'
          WHEN 'association'       THEN 'ong'
          WHEN 'bank'              THEN 'banque'
          WHEN 'insurance'         THEN 'assurance'
          WHEN 'social_protection' THEN 'prevoyance'
          WHEN 'government'        THEN 'administration'
          ELSE COALESCE(org_type, 'pme')
        END,
        accounting_framework = CASE accounting_framework
          WHEN 'SYSCOHADA'     THEN 'syscohada'
          WHEN 'SYSCOHADA_SMT' THEN 'syscohada_smt'
          WHEN 'SYCEBNL'       THEN 'sycebnl'
          WHEN 'PCB_UMOA'      THEN 'pcb'
          WHEN 'SFD'           THEN 'microfinance'
          WHEN 'CIMA'          THEN 'cima'
          WHEN 'CIPRES'        THEN 'cipres'
          WHEN 'PCE'           THEN 'pce'
          ELSE COALESCE(accounting_framework, 'syscohada')
        END
    `);

    // 5. Types explicites pour les tenants démo
    await client.query(`UPDATE organizations SET org_type='cabinet'  WHERE slug='hissado-consulting'`);
    await client.query(`UPDATE organizations SET org_type='pme'      WHERE slug='edole-africa'`);

    // 6. Seed du catalogue (9 référentiels — idempotent via ON CONFLICT)
    const frameworks = [
      { code: "syscohada",    label: "SYSCOHADA — Système Comptable OHADA",         desc: "Référentiel comptable commun à la zone OHADA (17 pays). Adapté aux entreprises, PME, SA, SARL et GIE.", types: ["pme","cooperative","cabinet","autre"] },
      { code: "syscohada_smt",label: "SYSCOHADA SMT — Système Minimal de Trésorerie", desc: "Version simplifiée du SYSCOHADA pour les très petites entreprises et micro-entreprises.", types: ["tpe"] },
      { code: "sycebnl",      label: "SYCEBNL — Entités à But Non Lucratif",        desc: "Système Comptable des Entités à But Non Lucratif. Adapté aux associations, ONG et fondations.", types: ["ong"] },
      { code: "pcb",          label: "PCB UMOA — Plan Comptable Bancaire",           desc: "Plan Comptable Bancaire de l'UMOA. Obligatoire pour les banques et établissements financiers.", types: ["banque"] },
      { code: "microfinance", label: "SFD — Système Financier Décentralisé",        desc: "Référentiel comptable des Systèmes Financiers Décentralisés (microfinance, coopératives d'épargne-crédit).", types: ["microfinance"] },
      { code: "cima",         label: "CIMA — Assurances",                           desc: "Plan comptable des assurances selon le code CIMA.", types: ["assurance"] },
      { code: "cipres",       label: "CIPRES — Prévoyance Sociale",                 desc: "Référentiel CIPRES pour les organismes de protection sociale.", types: ["prevoyance"] },
      { code: "pce",          label: "PCE — Plan Comptable de l'État",              desc: "Plan Comptable de l'État, adapté aux collectivités publiques et administrations.", types: ["administration"] },
      { code: "autre",        label: "Autre référentiel",                           desc: "Référentiel comptable personnalisé ou non répertorié.", types: ["autre"] },
    ];

    for (const f of frameworks) {
      await client.query(
        `INSERT INTO accounting_frameworks (code, label, description, applicable_org_types)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (code) DO UPDATE SET
           label                = EXCLUDED.label,
           description          = EXCLUDED.description,
           applicable_org_types = EXCLUDED.applicable_org_types`,
        [f.code, f.label, f.desc, JSON.stringify(f.types)],
      );
    }

    await client.query("COMMIT");
    console.log("✅ Migration org-type-accounting-framework complète");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Migration échouée :", e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
