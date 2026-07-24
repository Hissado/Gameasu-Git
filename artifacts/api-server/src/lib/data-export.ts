import path from "path";
import fs from "fs";
import { createRequire } from "module";
import type { Archiver } from "archiver";
type ArchiverFactory = (format: "zip" | "tar", opts?: object) => Archiver;
const _req = createRequire(import.meta.url);
const archiverCreate = _req("archiver") as ArchiverFactory;
import { db, pool } from "@workspace/db";
import { dataExportsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const EXPORTS_DIR = path.join("/tmp", "gameasu-exports");

// Tables exportées par domaine. Les colonnes sensibles sont exclues (hash_mdp, tokens...).
const EXPORT_TABLES = [
  // ── CRM & Clients
  { name: "clients",           label: "Clients",             query: `SELECT id,name,type,status,email,phone,address,city,country,siret,sector,website,notes,currency,created_at,updated_at FROM clients WHERE organization_id=$1 AND deleted_at IS NULL` },
  { name: "client_contacts",   label: "Contacts clients",    query: `SELECT cc.* FROM client_contacts cc JOIN clients c ON c.id=cc.client_id WHERE c.organization_id=$1` },
  { name: "opportunities",     label: "Opportunités CRM",    query: `SELECT * FROM opportunities WHERE organization_id=$1` },
  { name: "crm_activities",    label: "Activités CRM",       query: `SELECT * FROM crm_activities WHERE organization_id=$1` },
  // ── Projets & Tâches
  { name: "projects",          label: "Projets",             query: `SELECT * FROM projects WHERE organization_id=$1 AND deleted_at IS NULL` },
  { name: "project_phases",    label: "Phases de projet",    query: `SELECT pp.* FROM project_phases pp JOIN projects p ON p.id=pp.project_id WHERE p.organization_id=$1` },
  { name: "tasks",             label: "Tâches",              query: `SELECT * FROM tasks WHERE organization_id=$1 AND deleted_at IS NULL` },
  // ── RH & Collaborateurs
  { name: "collaborators",     label: "Collaborateurs",      query: `SELECT * FROM collaborators WHERE organization_id=$1 AND deleted_at IS NULL` },
  { name: "departments",       label: "Départements",        query: `SELECT * FROM departments WHERE organization_id=$1` },
  { name: "positions",         label: "Postes",              query: `SELECT * FROM positions WHERE organization_id=$1` },
  { name: "contracts",         label: "Contrats RH",         query: `SELECT * FROM contracts WHERE organization_id=$1` },
  { name: "hr_documents",      label: "Documents RH",        query: `SELECT id,collaborator_id,type,title,issued_at,expires_at,status,created_at FROM hr_documents WHERE organization_id=$1` },
  // ── Équipements & Locations
  { name: "equipment_categories", label: "Catégories équip.", query: `SELECT * FROM equipment_categories WHERE organization_id=$1` },
  { name: "equipment",         label: "Équipements",         query: `SELECT * FROM equipment WHERE organization_id=$1 AND deleted_at IS NULL` },
  { name: "rentals",           label: "Locations",           query: `SELECT * FROM rentals WHERE organization_id=$1 AND deleted_at IS NULL` },
  { name: "rental_items",      label: "Articles location",   query: `SELECT ri.* FROM rental_items ri JOIN rentals r ON r.id=ri.rental_id WHERE r.organization_id=$1` },
  // ── Commandes & Facturation
  { name: "orders",            label: "Commandes",           query: `SELECT * FROM orders WHERE organization_id=$1 AND deleted_at IS NULL` },
  { name: "proformas",         label: "Devis / Proformas",   query: `SELECT * FROM proformas WHERE organization_id=$1 AND deleted_at IS NULL` },
  { name: "invoices",          label: "Factures",            query: `SELECT * FROM invoices WHERE organization_id=$1 AND deleted_at IS NULL` },
  { name: "payments",          label: "Paiements",           query: `SELECT * FROM payments WHERE organization_id=$1 AND deleted_at IS NULL` },
  // ── Comptabilité
  { name: "chart_of_accounts", label: "Plan comptable",      query: `SELECT * FROM chart_of_accounts WHERE organization_id=$1` },
  { name: "fiscal_periods",    label: "Périodes fiscales",   query: `SELECT * FROM fiscal_periods WHERE organization_id=$1` },
  { name: "journals",          label: "Journaux comptables", query: `SELECT * FROM journals WHERE organization_id=$1` },
  { name: "journal_entries",   label: "Écritures comptables",query: `SELECT * FROM journal_entries WHERE organization_id=$1` },
  { name: "journal_entry_lines",label: "Lignes d'écritures", query: `SELECT jel.* FROM journal_entry_lines jel JOIN journal_entries je ON je.id=jel.journal_entry_id WHERE je.organization_id=$1` },
  { name: "suppliers",         label: "Fournisseurs",        query: `SELECT * FROM suppliers WHERE organization_id=$1` },
  { name: "supplier_invoices", label: "Factures fournisseurs",query:`SELECT * FROM supplier_invoices WHERE organization_id=$1` },
  { name: "bank_accounts",     label: "Comptes bancaires",   query: `SELECT id,name,type,bank_name,currency,current_balance,created_at FROM bank_accounts WHERE organization_id=$1` },
  // ── Paie
  { name: "payroll_runs",      label: "Bulletins de paie",   query: `SELECT * FROM payroll_runs WHERE organization_id=$1` },
  { name: "payslips",          label: "Fiches de paie",      query: `SELECT * FROM payslips WHERE organization_id=$1` },
  // ── FP&A & Budgets
  { name: "budgets",           label: "Budgets",             query: `SELECT * FROM budgets WHERE organization_id=$1` },
  { name: "budget_lines",      label: "Lignes de budget",    query: `SELECT bl.* FROM budget_lines bl JOIN budgets b ON b.id=bl.budget_id WHERE b.organization_id=$1` },
  // ── Utilisateurs (sans données sensibles)
  { name: "users",             label: "Utilisateurs",        query: `SELECT id,email,first_name,last_name,role,status,phone,avatar_url,language,timezone,created_at FROM users WHERE organization_id=$1` },
  // ── Journal d'audit
  { name: "audit_logs",        label: "Journal d'audit",     query: `SELECT id,user_email,user_role,action,category,severity,status,module,entity_type,entity_name,error_message,ip_address,browser,os,device,created_at FROM audit_logs WHERE organization_id=$1 ORDER BY created_at DESC` },
];

function rowsToCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

function manifestContent(orgId: string, stats: Record<string, number>, generatedAt: Date): string {
  return JSON.stringify({
    generator: "Gameasu Data Export",
    version: "1.0",
    organization_id: orgId,
    generated_at: generatedAt.toISOString(),
    tables: stats,
    disclaimer: "Cet export contient des données confidentielles. Aucun mot de passe ni token d'authentification n'est inclus.",
    format: "CSV UTF-8 (séparateur virgule, guillemets pour valeurs complexes)",
  }, null, 2);
}

export async function generateOrgExport(exportId: string, orgId: string): Promise<void> {
  if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const zipPath = path.join(EXPORTS_DIR, `${exportId}.zip`);

  await db.update(dataExportsTable).set({ status: "generating" }).where(eq(dataExportsTable.id, exportId));

  try {
    const stats: Record<string, number> = {};
    const csvBuffers: Array<{ name: string; content: string }> = [];

    for (const tbl of EXPORT_TABLES) {
      try {
        const result = await pool.query(tbl.query, [orgId]);
        const arr = (result.rows ?? []) as Record<string, unknown>[];
        stats[tbl.name] = arr.length;
        csvBuffers.push({ name: `${tbl.name}.csv`, content: rowsToCSV(arr) });
      } catch (err) {
        logger.warn({ table: tbl.name, err }, "data-export: table skipped");
        stats[tbl.name] = -1;
      }
    }

    const generatedAt = new Date();
    const manifestJson = manifestContent(orgId, stats, generatedAt);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiverCreate("zip", { zlib: { level: 6 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);

      for (const { name, content } of csvBuffers) {
        archive.append(Buffer.from(content, "utf-8"), { name });
      }
      archive.append(Buffer.from(manifestJson, "utf-8"), { name: "manifest.json" });
      archive.finalize();
    });

    const fileSizeBytes = fs.statSync(zipPath).size;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.update(dataExportsTable).set({
      status: "ready",
      generatedAt,
      expiresAt,
      filePath: zipPath,
      fileSize: fileSizeBytes,
      stats: stats as any,
    }).where(eq(dataExportsTable.id, exportId));

    logger.info({ exportId, orgId, fileSizeBytes }, "data-export: ZIP généré avec succès");
  } catch (err) {
    logger.error({ exportId, err }, "data-export: erreur génération");
    await db.update(dataExportsTable).set({
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    }).where(eq(dataExportsTable.id, exportId));
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }
}

export function cleanupExpiredExports(): void {
  if (!fs.existsSync(EXPORTS_DIR)) return;
  const files = fs.readdirSync(EXPORTS_DIR);
  for (const file of files) {
    const fp = path.join(EXPORTS_DIR, file);
    try {
      const stat = fs.statSync(fp);
      if (Date.now() - stat.mtimeMs > 25 * 60 * 60 * 1000) {
        fs.unlinkSync(fp);
      }
    } catch {}
  }
}
