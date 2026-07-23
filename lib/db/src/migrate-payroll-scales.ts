/**
 * Migration idempotente — Barèmes de paie versionnés (table unique de règles)
 * Crée `payroll_rate_scales` si absente et insère le barème national Togo
 * par défaut (TG-2026.01) s'il n'existe pas encore.
 * À exécuter : `cd lib/db && pnpm exec tsx src/migrate-payroll-scales.ts`
 * Réversible : `DROP TABLE payroll_rate_scales;` (aucune autre table modifiée).
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_rate_scales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      country TEXT NOT NULL DEFAULT 'TG',
      regime TEXT NOT NULL DEFAULT 'general',
      version TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      cnss_employee_rate NUMERIC(6,4) NOT NULL,
      cnss_employer_rate NUMERIC(6,4) NOT NULL,
      abatement_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
      dependent_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
      smig NUMERIC(14,2) NOT NULL DEFAULT 0,
      ipts_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
      irpp_brackets JSONB,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS payroll_scales_org_regime_idx
      ON payroll_rate_scales(organization_id, regime, effective_from);
    CREATE UNIQUE INDEX IF NOT EXISTS payroll_scales_org_regime_version_uidx
      ON payroll_rate_scales(organization_id, regime, version);
  `);

  // Barème national Togo par défaut — mêmes valeurs que DEFAULT_SCALE_TG
  // (api-server/src/lib/payroll-engine.ts), validées contre le modèle Excel
  // de référence (feuille SALAIRES).
  await db.execute(sql`
    INSERT INTO payroll_rate_scales (
      organization_id, country, regime, version, effective_from,
      cnss_employee_rate, cnss_employer_rate, abatement_rate,
      dependent_deduction, smig, ipts_rate, irpp_brackets, notes
    )
    SELECT
      NULL, 'TG', 'general', 'TG-2026.01', '2026-01-01',
      0.09, 0.225, 0.28,
      10000, 35000, 0,
      '[{"up":75000,"rate":0},{"up":250000,"rate":0.03},{"up":500000,"rate":0.10},{"up":750000,"rate":0.15},{"up":1000000,"rate":0.20},{"up":1250000,"rate":0.25},{"up":1666667,"rate":0.30},{"up":null,"rate":0.35}]'::jsonb,
      'Barème national Togo — CNSS salarié 9 % (dont AMU), patronal 22,5 %, abattement 28 %, IRPP mensuel CGI 8 tranches. Conforme au moteur payroll-engine.ts et au modèle Excel de référence.'
    WHERE NOT EXISTS (
      SELECT 1 FROM payroll_rate_scales
      WHERE organization_id IS NULL AND regime = 'general' AND version = 'TG-2026.01'
    );
  `);

  console.log("✔ payroll_rate_scales prête (barème national TG-2026.01 présent)");
}

migrate()
  .then(() => pool.end())
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
