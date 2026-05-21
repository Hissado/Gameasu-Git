/**
 * Phase 12 — Recherche universelle Gaméasù.
 *  - GET /api/search?q=…&limit=10
 *
 * ACL fine : utilise userAccessibleProjectIds / userAccessibleClientIds pour
 * restreindre les résultats. `null` = accès total (read_all).
 */
import { Router, type IRouter } from "express";
import { db, clientsTable, projectsTable, tasksTable, opportunitiesTable, invoicesTable, collaboratorsTable, documentsTable } from "@workspace/db";
import { and, ilike, isNull, or, inArray, sql } from "drizzle-orm";
import { hasPermission, userAccessibleProjectIds, userAccessibleClientIds } from "../lib/rbac/permissions";

const router: IRouter = Router();

function score(value: string | null | undefined, q: string): number {
  if (!value) return 0;
  const v = value.toLowerCase();
  const qq = q.toLowerCase();
  if (v === qq) return 100;
  if (v.startsWith(qq)) return 85;
  if (new RegExp(`\\b${qq.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(v)) return 70;
  if (v.includes(qq)) return 50;
  return 20;
}

/** false = pas d'accès, sinon undefined (pas de restriction) ou filtre `inArray`. */
function scopeFilter<T>(col: T, ids: string[] | null): any | "deny" | undefined {
  if (ids === null) return undefined; // accès total
  if (ids.length === 0) return "deny";
  return inArray(col as any, ids);
}

router.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query["q"] ?? "").trim();
    const limit = Math.min(20, Math.max(1, Number(req.query["limit"] ?? 8) || 8));
    if (q.length < 2) return res.json({ q, groups: [] });

    const userId = req.authUser!.id;
    const pattern = `%${q}%`;

    const [canClients, canProjects, canTasks, canSales, canInvoices, canHr, canDocs] = await Promise.all([
      hasPermission(userId, "clients.read"),
      hasPermission(userId, "projects.read"),
      hasPermission(userId, "tasks.read"),
      hasPermission(userId, "commercial.read"),
      hasPermission(userId, "accounting.read"),
      hasPermission(userId, "hr.read"),
      hasPermission(userId, "documents.read"),
    ]);

    const [clientIds, projectIds] = await Promise.all([
      userAccessibleClientIds(userId),
      userAccessibleProjectIds(userId),
    ]);

    const groups: Array<{
      key: string;
      label: string;
      icon: string;
      results: Array<{ id: string; title: string; subtitle?: string; url: string; score: number }>;
    }> = [];

    if (canClients) {
      const cf = scopeFilter(clientsTable.id, clientIds);
      if (cf !== "deny") {
        const conds = [isNull(clientsTable.deletedAt), or(ilike(clientsTable.name, pattern), ilike(clientsTable.email, pattern), ilike(clientsTable.industry, pattern))];
        if (cf) conds.push(cf);
        const rows = await db.select({ id: clientsTable.id, name: clientsTable.name, email: clientsTable.email, industry: clientsTable.industry })
          .from(clientsTable).where(and(...conds)).limit(limit);
        const results = rows.map((r) => ({
          id: r.id, title: r.name,
          subtitle: [r.industry, r.email].filter(Boolean).join(" · "),
          url: `/clients/${r.id}`,
          score: Math.max(score(r.name, q), score(r.email, q), score(r.industry, q)),
        })).sort((a, b) => b.score - a.score);
        if (results.length) groups.push({ key: "clients", label: "Clients", icon: "building", results });
      }
    }

    if (canProjects) {
      const cf = scopeFilter(projectsTable.id, projectIds);
      if (cf !== "deny") {
        const conds = [isNull(projectsTable.deletedAt), or(ilike(projectsTable.name, pattern), ilike(projectsTable.description, pattern))];
        if (cf) conds.push(cf);
        const rows = await db.select({ id: projectsTable.id, name: projectsTable.name, description: projectsTable.description, status: projectsTable.status })
          .from(projectsTable).where(and(...conds)).limit(limit);
        const results = rows.map((r) => ({
          id: r.id, title: r.name, subtitle: r.status ?? undefined,
          url: `/projects/${r.id}`,
          score: Math.max(score(r.name, q), score(r.description, q) - 10),
        })).sort((a, b) => b.score - a.score);
        if (results.length) groups.push({ key: "projects", label: "Projets", icon: "folder", results });
      }
    }

    if (canTasks) {
      // Tasks gated via projet accessible.
      const conds = [isNull(tasksTable.deletedAt), or(ilike(tasksTable.title, pattern), ilike(tasksTable.description, pattern))];
      if (projectIds !== null) {
        if (projectIds.length === 0) {
          // pas d'accès → skip
        } else {
          conds.push(inArray(tasksTable.projectId, projectIds));
        }
      }
      if (projectIds === null || projectIds.length > 0) {
        const rows = await db.select({ id: tasksTable.id, title: tasksTable.title, status: tasksTable.status, priority: tasksTable.priority })
          .from(tasksTable).where(and(...conds)).limit(limit);
        const results = rows.map((r) => ({
          id: r.id, title: r.title, subtitle: `${r.status} · ${r.priority}`,
          url: `/tasks/${r.id}`,
          score: score(r.title, q),
        })).sort((a, b) => b.score - a.score);
        if (results.length) groups.push({ key: "tasks", label: "Tâches", icon: "check-square", results });
      }
    }

    if (canSales) {
      // Opportunités gated via client accessible.
      const conds = [isNull(opportunitiesTable.deletedAt), or(ilike(opportunitiesTable.title, pattern), ilike(opportunitiesTable.notes, pattern))];
      if (clientIds !== null) {
        if (clientIds.length === 0) {
          // skip
        } else {
          conds.push(inArray(opportunitiesTable.clientId, clientIds));
        }
      }
      if (clientIds === null || clientIds.length > 0) {
        const rows = await db.select({ id: opportunitiesTable.id, title: opportunitiesTable.title, stage: opportunitiesTable.stage })
          .from(opportunitiesTable).where(and(...conds)).limit(limit);
        const results = rows.map((r) => ({
          id: r.id, title: r.title, subtitle: r.stage,
          url: `/crm`,
          score: score(r.title, q),
        })).sort((a, b) => b.score - a.score);
        if (results.length) groups.push({ key: "opportunities", label: "Opportunités", icon: "trending-up", results });
      }
    }

    if (canInvoices) {
      const conds = [or(ilike(invoicesTable.referenceNumber, pattern), ilike(invoicesTable.notes, pattern))];
      if (clientIds !== null) {
        if (clientIds.length === 0) {
          // skip
        } else {
          conds.push(inArray(invoicesTable.clientId, clientIds));
        }
      }
      if (clientIds === null || clientIds.length > 0) {
        const rows = await db.select({ id: invoicesTable.id, referenceNumber: invoicesTable.referenceNumber, status: invoicesTable.status, totalAmount: invoicesTable.totalAmount })
          .from(invoicesTable).where(and(...conds)).limit(limit);
        const results = rows.map((r) => ({
          id: r.id, title: r.referenceNumber, subtitle: `${r.status} · ${r.totalAmount ?? "0"} FCFA`,
          url: `/invoices/${r.id}`,
          score: score(r.referenceNumber, q),
        })).sort((a, b) => b.score - a.score);
        if (results.length) groups.push({ key: "invoices", label: "Factures", icon: "file-text", results });
      }
    }

    if (canHr) {
      const rows = await db.select({ id: collaboratorsTable.id, firstName: collaboratorsTable.firstName, lastName: collaboratorsTable.lastName, email: collaboratorsTable.email, position: collaboratorsTable.position })
        .from(collaboratorsTable)
        .where(and(isNull(collaboratorsTable.deletedAt), or(ilike(collaboratorsTable.firstName, pattern), ilike(collaboratorsTable.lastName, pattern), ilike(collaboratorsTable.email, pattern), ilike(collaboratorsTable.position, pattern))))
        .limit(limit);
      const results = rows.map((r) => ({
        id: r.id,
        title: `${r.firstName} ${r.lastName}`,
        subtitle: [r.position, r.email].filter(Boolean).join(" · "),
        url: `/collaborators/${r.id}`,
        score: Math.max(score(`${r.firstName} ${r.lastName}`, q), score(r.email, q), score(r.position, q)),
      })).sort((a, b) => b.score - a.score);
      if (results.length) groups.push({ key: "collaborators", label: "Collaborateurs", icon: "users", results });
    }

    if (canDocs) {
      // Documents : si lié à projet via entityType=project/entityId, on filtre.
      // Pour rester simple : si pas projects.read_all on filtre via accessible projects
      // (les autres entityType passent toujours pour ne pas trop restreindre).
      const baseConds = [isNull(documentsTable.deletedAt), or(ilike(documentsTable.name, pattern), ilike(documentsTable.description, pattern), ilike(documentsTable.aiSummary, pattern))];
      const conds = [...baseConds];
      if (projectIds !== null && projectIds.length > 0) {
        conds.push(or(
          sql`${documentsTable.entityType} IS DISTINCT FROM 'project'`,
          inArray(documentsTable.entityId, projectIds),
        )!);
      } else if (projectIds !== null && projectIds.length === 0) {
        conds.push(sql`${documentsTable.entityType} IS DISTINCT FROM 'project'`);
      }
      const rows = await db.select({ id: documentsTable.id, name: documentsTable.name, category: documentsTable.category, aiSummary: documentsTable.aiSummary })
        .from(documentsTable).where(and(...conds)).limit(limit);
      const results = rows.map((r) => ({
        id: r.id, title: r.name, subtitle: r.category ?? undefined,
        url: `/documents/${r.id}`,
        score: Math.max(score(r.name, q), score(r.aiSummary, q) - 10),
      })).sort((a, b) => b.score - a.score);
      if (results.length) groups.push({ key: "documents", label: "Documents", icon: "file", results });
    }

    groups.sort((a, b) => (b.results[0]?.score ?? 0) - (a.results[0]?.score ?? 0));

    return res.json({
      q,
      total: groups.reduce((s, g) => s + g.results.length, 0),
      groups,
    });
  } catch (e) { next(e); }
});

export default router;
