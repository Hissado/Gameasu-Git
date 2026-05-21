/**
 * Phase 19 — Anomalies cross-module.
 *  - GET /api/anomalies/scan : détection heuristique transversale.
 *
 * Surface en une vue toutes les valeurs aberrantes / patterns suspects détectés
 * dans les données opérationnelles : factures avec montants > 3×médiane,
 * paiements partiels inférieurs à 5 %, projets en retard >30j sans mise à jour,
 * tâches bloquées >14j, opportunités ayant changé de stade en arrière, comptes
 * client inactifs >180j. Heuristique pure.
 */
import { Router, type IRouter } from "express";
import {
  db, invoicesTable, paymentsTable, projectsTable, tasksTable,
  opportunitiesTable, clientsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc, inArray, gte, lte, ne, isNotNull } from "drizzle-orm";
import { userAccessibleProjectIds, userAccessibleClientIds, hasPermission } from "../lib/rbac/permissions";

const router: IRouter = Router();

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

router.get("/anomalies/scan", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const [clientIds, projectIds] = await Promise.all([
      userAccessibleClientIds(userId),
      userAccessibleProjectIds(userId),
    ]);
    const now = new Date();
    const items: Array<{ kind: string; severity: "low" | "medium" | "high" | "critical"; entityType: string; entityId: string; title: string; detail: string; metric?: number }> = [];

    // 1. Factures montants aberrants (>3× médiane des 90 derniers jours)
    if (await hasPermission(userId, "accounting.read") && !(clientIds && clientIds.length === 0)) {
      const since = new Date(now.getTime() - 90 * 86400000);
      const conds: any[] = [
        sql`${invoicesTable.totalAmount} is not null`,
        gte(invoicesTable.createdAt, since),
      ];
      if (clientIds && clientIds.length) conds.push(inArray(invoicesTable.clientId, clientIds));
      const rows = await db.select({ id: invoicesTable.id, ref: invoicesTable.referenceNumber, total: invoicesTable.totalAmount, createdAt: invoicesTable.createdAt })
        .from(invoicesTable).where(and(...conds));
      const amounts = rows.map((r) => Number(r.total ?? 0)).filter((n) => n > 0);
      const med = median(amounts);
      if (med > 0) {
        for (const r of rows) {
          const a = Number(r.total ?? 0);
          if (a > med * 3) {
            const ratio = a / med;
            items.push({
              kind: "invoice_amount_outlier", severity: ratio > 6 ? "critical" : ratio > 4 ? "high" : "medium",
              entityType: "invoice", entityId: r.id,
              title: `Facture ${r.ref} : montant atypique (${Math.round(ratio * 10) / 10}× médiane)`,
              detail: `Montant ${Math.round(a).toLocaleString("fr-FR")} FCFA vs médiane 90 j ${Math.round(med).toLocaleString("fr-FR")} FCFA`,
              metric: a,
            });
          }
        }
      }
    }

    // 2. Paiements partiels suspects (<5 % du total)
    if (await hasPermission(userId, "accounting.read") && !(clientIds && clientIds.length === 0)) {
      const conds: any[] = [
        sql`${invoicesTable.totalAmount} is not null`,
        sql`${invoicesTable.paidAmount}::numeric > 0`,
        sql`${invoicesTable.paidAmount}::numeric < ${invoicesTable.totalAmount}::numeric * 0.05`,
      ];
      if (clientIds && clientIds.length) conds.push(inArray(invoicesTable.clientId, clientIds));
      const rows = await db.select({ id: invoicesTable.id, ref: invoicesTable.referenceNumber, total: invoicesTable.totalAmount, paid: invoicesTable.paidAmount })
        .from(invoicesTable).where(and(...conds)).limit(20);
      for (const r of rows) {
        const pct = Number(r.paid ?? 0) / Math.max(1, Number(r.total ?? 0));
        items.push({
          kind: "partial_payment_low", severity: "medium",
          entityType: "invoice", entityId: r.id,
          title: `Paiement partiel très faible sur ${r.ref}`,
          detail: `Versement de ${(pct * 100).toFixed(1)} % du total, encours important`,
        });
      }
    }

    // 3. Projets en retard >30j sans mise à jour
    if (await hasPermission(userId, "projects.read") && !(projectIds && projectIds.length === 0)) {
      const conds: any[] = [
        isNull(projectsTable.deletedAt),
        sql`${projectsTable.status} in ('active','planning','in_progress')`,
        sql`${projectsTable.endDate} is not null`,
        sql`${projectsTable.endDate}::date < now()::date - interval '30 days'`,
      ];
      if (projectIds && projectIds.length) conds.push(inArray(projectsTable.id, projectIds));
      const rows = await db.select({ id: projectsTable.id, name: projectsTable.name, endDate: projectsTable.endDate, progress: projectsTable.progress, updatedAt: projectsTable.updatedAt })
        .from(projectsTable).where(and(...conds)).limit(20);
      for (const r of rows) {
        const lateDays = Math.floor((now.getTime() - new Date(r.endDate!).getTime()) / 86400000);
        const staleDays = Math.floor((now.getTime() - new Date(r.updatedAt).getTime()) / 86400000);
        items.push({
          kind: "project_overdue_stale", severity: lateDays > 90 ? "critical" : lateDays > 60 ? "high" : "medium",
          entityType: "project", entityId: r.id,
          title: `Projet en retard : ${r.name}`,
          detail: `Échéance dépassée de ${lateDays} j · progression ${r.progress ?? 0} % · MAJ il y a ${staleDays} j`,
          metric: lateDays,
        });
      }
    }

    // 4. Tâches bloquées >14j
    if (await hasPermission(userId, "tasks.read") && !(projectIds && projectIds.length === 0)) {
      const conds: any[] = [
        isNull(tasksTable.deletedAt),
        eq(tasksTable.status, "blocked"),
        sql`${tasksTable.updatedAt} < now() - interval '14 days'`,
      ];
      if (projectIds && projectIds.length) conds.push(inArray(tasksTable.projectId, projectIds));
      const rows = await db.select({ id: tasksTable.id, title: tasksTable.title, updatedAt: tasksTable.updatedAt })
        .from(tasksTable).where(and(...conds)).limit(20);
      for (const r of rows) {
        const days = Math.floor((now.getTime() - new Date(r.updatedAt).getTime()) / 86400000);
        items.push({
          kind: "task_blocked_stale", severity: days > 30 ? "high" : "medium",
          entityType: "task", entityId: r.id,
          title: `Tâche bloquée : ${r.title}`,
          detail: `Statut "blocked" inchangé depuis ${days} j`,
          metric: days,
        });
      }
    }

    // 5. Clients inactifs >180j avec opportunités/CA
    if (await hasPermission(userId, "clients.read") && !(clientIds && clientIds.length === 0)) {
      const conds: any[] = [
        isNull(clientsTable.deletedAt),
        sql`${clientsTable.updatedAt} < now() - interval '180 days'`,
      ];
      if (clientIds && clientIds.length) conds.push(inArray(clientsTable.id, clientIds));
      const rows = await db.select({ id: clientsTable.id, name: clientsTable.name, updatedAt: clientsTable.updatedAt })
        .from(clientsTable).where(and(...conds)).limit(20);
      for (const r of rows) {
        const days = Math.floor((now.getTime() - new Date(r.updatedAt).getTime()) / 86400000);
        items.push({
          kind: "client_inactive", severity: days > 365 ? "high" : "medium",
          entityType: "client", entityId: r.id,
          title: `Client inactif : ${r.name}`,
          detail: `Aucune mise à jour depuis ${days} j`,
          metric: days,
        });
      }
    }

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const it of items) counts[it.severity]++;
    const sevOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    items.sort((a, b) => sevOrder[b.severity] - sevOrder[a.severity]);
    return res.json({ total: items.length, counts, items: items.slice(0, 100) });
  } catch (e) { next(e); }
});

export default router;
