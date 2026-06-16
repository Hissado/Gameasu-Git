import { Router } from "express";
import {
  db, alertsTable, rentalsTable, invoicesTable, contractsTable, equipmentTable,
  organizationsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, lte, gte, ne } from "drizzle-orm";
import { requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

async function upsertAlert(orgId: string, a: {
  kind: string; entityType: string; entityId: string; title: string;
  message: string; severity: string; dueAt?: Date | null;
}) {
  // dedupKey inclut l'org pour éviter les collisions cross-tenant
  const dedupKey = `${orgId}:${a.kind}:${a.entityId}`;
  try {
    await db.insert(alertsTable).values({
      organizationId: orgId,
      kind: a.kind, entityType: a.entityType, entityId: a.entityId,
      title: a.title, message: a.message, severity: a.severity,
      dueAt: a.dueAt ?? null, dedupKey,
    });
    return true;
  } catch {
    return false; // déjà inséré (unique constraint)
  }
}

export async function runAlertsScan(orgId: string) {
  const now = new Date();
  const in3days = new Date(now.getTime() + 3 * DAY_MS);
  const in30days = new Date(now.getTime() + 30 * DAY_MS);
  let created = 0;

  // 1. Locations dont le retour est prévu < 3 jours
  try {
    const rentals = await db.select().from(rentalsTable)
      .where(and(
        eq(rentalsTable.organizationId, orgId),
        eq(rentalsTable.status, "active"),
        lte(rentalsTable.endDate as any, in3days),
        gte(rentalsTable.endDate as any, now),
      ));
    for (const r of rentals) {
      const ok = await upsertAlert(orgId, {
        kind: "rental_return_soon",
        entityType: "rental", entityId: r.id,
        title: `Retour de location proche`,
        message: `Location #${(r as any).rentalNumber || r.id.slice(0, 8)} arrive à échéance le ${new Date(r.endDate as any).toLocaleDateString("fr-FR")}.`,
        severity: "warning",
        dueAt: r.endDate as any,
      });
      if (ok) created++;
    }
  } catch (e) { console.warn("[alerts] rentals scan failed", e); }

  // 2. Factures impayées dépassant l'échéance
  try {
    const invs = await db.select().from(invoicesTable)
      .where(and(
        eq(invoicesTable.organizationId, orgId),
        ne(invoicesTable.status, "paid"),
        ne(invoicesTable.status, "cancelled"),
        lte(invoicesTable.dueDate as any, now),
      ));
    for (const i of invs) {
      const ok = await upsertAlert(orgId, {
        kind: "invoice_overdue",
        entityType: "invoice", entityId: i.id,
        title: `Facture impayée`,
        message: `Facture ${(i as any).invoiceNumber || i.id.slice(0, 8)} en retard depuis le ${new Date(i.dueDate as any).toLocaleDateString("fr-FR")}.`,
        severity: "critical",
        dueAt: i.dueDate as any,
      });
      if (ok) created++;
    }
  } catch (e) { console.warn("[alerts] invoices scan failed", e); }

  // 3. Contrats expirant dans les 30 jours
  try {
    const ctrs = await db.select().from(contractsTable)
      .where(and(
        eq(contractsTable.organizationId, orgId),
        eq(contractsTable.status, "active"),
        lte(contractsTable.endDate as any, in30days),
        gte(contractsTable.endDate as any, now),
      ));
    for (const c of ctrs) {
      const ok = await upsertAlert(orgId, {
        kind: "contract_expiring",
        entityType: "contract", entityId: c.id,
        title: `Contrat à renouveler`,
        message: `Contrat ${c.id.slice(0, 8)} expire le ${new Date(c.endDate as any).toLocaleDateString("fr-FR")}.`,
        severity: "warning",
        dueAt: c.endDate as any,
      });
      if (ok) created++;
    }
  } catch (e) { console.warn("[alerts] contracts scan failed", e); }

  // 4. Équipement en maintenance prolongée (statut = maintenance)
  try {
    const eqs = await db.select().from(equipmentTable)
      .where(and(
        eq(equipmentTable.organizationId, orgId),
        isNull(equipmentTable.deletedAt),
        eq(equipmentTable.status, "maintenance"),
      ));
    for (const e of eqs) {
      const ok = await upsertAlert(orgId, {
        kind: "equipment_maintenance",
        entityType: "equipment", entityId: e.id,
        title: `Équipement en maintenance`,
        message: `${e.name} (${(e as any).code || e.id.slice(0, 6)}) est immobilisé.`,
        severity: "info",
      });
      if (ok) created++;
    }
  } catch (e) { console.warn("[alerts] equipment scan failed", e); }

  return { created };
}

/**
 * Lance le scan d'alertes pour toutes les organisations actives.
 * Chaque org est scannée de façon isolée (try/catch par tenant) afin qu'une
 * erreur sur une organisation n'interrompe pas les autres.
 */
export async function runAlertsScanForAllOrganizations() {
  let totalCreated = 0;
  let orgsScanned = 0;
  const orgs = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.isActive, true));
  for (const org of orgs) {
    try {
      const { created } = await runAlertsScan(org.id);
      totalCreated += created;
      orgsScanned++;
    } catch (e) {
      console.warn(`[alerts] scan failed for org ${org.id}`, e);
    }
  }
  return { totalCreated, orgsScanned };
}

router.get("/alerts", async (req, res) => {
  const { acknowledged, severity, kind, limit = "100" } = req.query as Record<string, string>;
  const conds: any[] = [eq(alertsTable.organizationId, req.authUser!.organizationId)];
  if (acknowledged === "true") conds.push(eq(alertsTable.acknowledged, true));
  else if (acknowledged === "false") conds.push(eq(alertsTable.acknowledged, false));
  if (severity) conds.push(eq(alertsTable.severity, severity));
  if (kind) conds.push(eq(alertsTable.kind, kind));
  const data = await db.select().from(alertsTable)
    .where(and(...conds))
    .orderBy(desc(alertsTable.createdAt))
    .limit(Number(limit));
  return res.json({ data });
});

router.get("/alerts/summary", async (req, res) => {
  const orgFilter = and(eq(alertsTable.organizationId, req.authUser!.organizationId), eq(alertsTable.acknowledged, false));
  const [{ total }] = await db.select({ total: sql<number>`count(*)` })
    .from(alertsTable).where(orgFilter);
  const bySeverity = await db.select({ severity: alertsTable.severity, count: sql<number>`count(*)` })
    .from(alertsTable).where(orgFilter).groupBy(alertsTable.severity);
  const byKind = await db.select({ kind: alertsTable.kind, count: sql<number>`count(*)` })
    .from(alertsTable).where(orgFilter).groupBy(alertsTable.kind);
  return res.json({
    openCount: Number(total),
    bySeverity: bySeverity.map((r) => ({ severity: r.severity, count: Number(r.count) })),
    byKind: byKind.map((r) => ({ kind: r.kind, count: Number(r.count) })),
  });
});

router.post("/alerts/run", requireManagerOrAbove, async (req, res) => {
  const r = await runAlertsScan(req.authUser!.organizationId);
  return res.json(r);
});

router.post("/alerts/:id/ack", async (req, res) => {
  const [a] = await db.update(alertsTable)
    .set({ acknowledged: true, acknowledgedAt: new Date() })
    .where(and(eq(alertsTable.organizationId, req.authUser!.organizationId), eq(alertsTable.id, req.params.id))).returning();
  if (!a) return res.status(404).json({ error: "Not found" });
  return res.json(a);
});

router.delete("/alerts/:id", async (req, res) => {
  await db.delete(alertsTable).where(and(eq(alertsTable.organizationId, req.authUser!.organizationId), eq(alertsTable.id, req.params.id)));
  return res.status(204).send();
});

export default router;
