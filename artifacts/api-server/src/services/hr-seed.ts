import { db } from "@workspace/db";
import { departmentsTable, positionsTable, organizationsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Seed des départements et postes par défaut pour une organisation donnée.
 * Tenant-scoped : un même code (DIR, OPS…) peut exister dans plusieurs orgs.
 * Idempotent : check d'existence avant insertion.
 */
const DEFAULT_DEPARTMENTS = [
  { code: "DIR", name: "Pilotage", description: "Direction générale et pilotage stratégique", color: "#0F172A" },
  { code: "OPS", name: "Opérations", description: "Pilotage opérationnel et exécution terrain", color: "#FF3C00" },
  { code: "MAT", name: "Matériel", description: "Parc matériel, locations et logistique", color: "#0EA5E9" },
  { code: "COM", name: "Commercial", description: "Commercial, devis, factures et relation client", color: "#F59E0B" },
  { code: "RH",  name: "Ressources Humaines", description: "Gestion du personnel et administration RH", color: "#10B981" },
  { code: "CPT", name: "Comptabilité", description: "Comptabilité SYSCOHADA et trésorerie", color: "#8B5CF6" },
  { code: "MKT", name: "Communication", description: "Communication, marketing et messagerie", color: "#EC4899" },
];

const DEFAULT_POSITIONS = [
  { code: "DG",        title: "Directeur·rice général·e",     deptCode: "DIR", level: 5 },
  { code: "DAF",       title: "Directeur·rice administratif et financier", deptCode: "DIR", level: 5 },
  { code: "CHEF-CHA",  title: "Chef de projet",               deptCode: "OPS", level: 3 },
  { code: "COND-TVX",  title: "Conducteur de travaux",        deptCode: "OPS", level: 4 },
  { code: "OUVRIER",   title: "Intervenant terrain qualifié", deptCode: "OPS", level: 1 },
  { code: "RESP-MAT",  title: "Responsable parc matériel",    deptCode: "MAT", level: 4 },
  { code: "MECANO",    title: "Mécanicien",                   deptCode: "MAT", level: 2 },
  { code: "COMMERCIAL",title: "Commercial·e",                 deptCode: "COM", level: 2 },
  { code: "RRH",       title: "Responsable RH",               deptCode: "RH",  level: 4 },
  { code: "COMPTABLE", title: "Comptable",                    deptCode: "CPT", level: 2 },
  { code: "COMM",      title: "Chargé·e de communication",    deptCode: "MKT", level: 2 },
];

export async function seedHrForOrg(organizationId: string): Promise<void> {
  // 1) Départements (idempotent par (orgId, code))
  for (const d of DEFAULT_DEPARTMENTS) {
    await db.execute(sql`
      INSERT INTO ${departmentsTable} (organization_id, code, name, description, color)
      VALUES (${organizationId}, ${d.code}, ${d.name}, ${d.description}, ${d.color})
      ON CONFLICT (organization_id, code) DO NOTHING
    `);
  }

  const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.organizationId, organizationId));
  const byCode = new Map(depts.map((d) => [d.code, d.id]));

  // 2) Postes (idempotent par (orgId, code))
  for (const p of DEFAULT_POSITIONS) {
    const deptId = byCode.get(p.deptCode);
    if (!deptId) continue;
    await db.execute(sql`
      INSERT INTO ${positionsTable} (organization_id, code, title, department_id, level)
      VALUES (${organizationId}, ${p.code}, ${p.title}, ${deptId}, ${p.level})
      ON CONFLICT (organization_id, code) DO NOTHING
    `);
  }
}

/**
 * Seed HR pour toutes les organisations existantes (utilisé au boot).
 */
export async function seedHr(): Promise<void> {
  const orgs = await db.select({ id: organizationsTable.id, slug: organizationsTable.slug }).from(organizationsTable);
  for (const o of orgs) {
    await seedHrForOrg(o.id);
  }
  logger.info({ orgs: orgs.length, departments: DEFAULT_DEPARTMENTS.length, positions: DEFAULT_POSITIONS.length }, "HR: seed terminé");
}
