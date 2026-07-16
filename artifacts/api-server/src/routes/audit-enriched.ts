import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable, securityAlertsTable, usersTable } from "@workspace/db";
import { and, eq, ilike, sql, desc, gte, lte, or, isNull, isNotNull, inArray, count as drizzleCount } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { audit } from "../lib/audit";
import { getCurrentOrganizationId } from "../lib/tenant";
import ExcelJS from "exceljs";

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: any) => typeof v === "string" && UUID_RE.test(v);

function getOrgId(req: any) { return getCurrentOrganizationId(req.authUser?.id); }

function buildAuditWhere(orgId: string, q: Record<string, string>) {
  const conds: any[] = [eq(auditLogsTable.organizationId, orgId)];
  if (q.action)     conds.push(eq(auditLogsTable.action, q.action));
  if (q.category)   conds.push(eq(auditLogsTable.category, q.category));
  if (q.severity)   conds.push(eq(auditLogsTable.severity, q.severity));
  if (q.status)     conds.push(eq(auditLogsTable.status, q.status));
  if (q.module)     conds.push(eq(auditLogsTable.module, q.module));
  if (q.subModule)  conds.push(eq(auditLogsTable.subModule, q.subModule));
  if (q.entityType) conds.push(eq(auditLogsTable.entityType, q.entityType));
  if (q.userId && isUuid(q.userId)) conds.push(eq(auditLogsTable.userId, q.userId));
  if (q.device)     conds.push(ilike(auditLogsTable.device, `%${q.device}%`));
  if (q.browser)    conds.push(ilike(auditLogsTable.browser, `%${q.browser}%`));
  if (q.ip)         conds.push(ilike(auditLogsTable.ipAddress, `%${q.ip}%`));
  if (q.q)          conds.push(or(
    ilike(auditLogsTable.userEmail, `%${q.q}%`),
    ilike(auditLogsTable.entityName, `%${q.q}%`),
  ) as any);
  // Filtres rapides
  if (q.quick === "today") {
    const today = new Date(); today.setHours(0,0,0,0);
    conds.push(gte(auditLogsTable.createdAt, today));
  } else if (q.quick === "7d") {
    conds.push(gte(auditLogsTable.createdAt, new Date(Date.now() - 7*86400000)));
  } else if (q.quick === "30d") {
    conds.push(gte(auditLogsTable.createdAt, new Date(Date.now() - 30*86400000)));
  } else if (q.quick === "sensitive") {
    conds.push(inArray(auditLogsTable.severity, ["high", "critical"]));
  } else if (q.quick === "failures") {
    conds.push(inArray(auditLogsTable.status, ["failure", "denied"]));
  } else if (q.quick === "deletions") {
    conds.push(eq(auditLogsTable.action, "delete"));
  } else if (q.quick === "exports") {
    conds.push(inArray(auditLogsTable.action, ["export", "audit_export", "download"]));
  } else if (q.quick === "logins") {
    conds.push(inArray(auditLogsTable.action, ["login", "logout", "login_failed"]));
  } else if (q.quick === "permissions") {
    conds.push(inArray(auditLogsTable.action, ["role_change", "permission_change"]));
  }
  // Date range
  if (q.from) { const d = new Date(q.from); if (!isNaN(d.getTime())) conds.push(gte(auditLogsTable.createdAt, d)); }
  if (q.to)   { const d = new Date(q.to + "T23:59:59.999Z"); if (!isNaN(d.getTime())) conds.push(lte(auditLogsTable.createdAt, d)); }
  return and(...conds);
}

// ══════════════════════════════════════════════════════════════════
// GET /api/admin/audit — liste paginée enrichie
// ══════════════════════════════════════════════════════════════════
router.get("/admin/audit", requirePermission("audit.read"), async (req, res) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const q = req.query as Record<string, string>;
    const lim = Math.min(Math.max(parseInt(q.limit || "25"), 1), 100);
    const page = Math.max(1, parseInt(q.page || "1"));
    const offset = (page - 1) * lim;
    const where = buildAuditWhere(orgId, q);
    const [rows, countRows] = await Promise.all([
      db.select().from(auditLogsTable).where(where as any)
        .orderBy(desc(auditLogsTable.createdAt)).limit(lim).offset(offset),
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(auditLogsTable).where(where as any),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return res.json({ data: rows, total, page, limit: lim, pages: Math.ceil(total / lim) });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/admin/audit/dashboard — KPIs + séries temporelles
// ══════════════════════════════════════════════════════════════════
router.get("/admin/audit/dashboard", requirePermission("audit.read"), async (req, res) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const days = parseInt((req.query.days as string) || "30");
    const since = new Date(Date.now() - days * 86400000);
    const orgCond = eq(auditLogsTable.organizationId, orgId);
    const sinceCond = gte(auditLogsTable.createdAt, since);

    const [total, logins, failures, sensitive, deletions, exports_, permissions, alerts] = await Promise.all([
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(auditLogsTable)
        .where(and(orgCond, sinceCond)),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(auditLogsTable)
        .where(and(orgCond, sinceCond, eq(auditLogsTable.action, "login"), eq(auditLogsTable.status, "success"))),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(auditLogsTable)
        .where(and(orgCond, sinceCond, inArray(auditLogsTable.status, ["failure", "denied"]))),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(auditLogsTable)
        .where(and(orgCond, sinceCond, inArray(auditLogsTable.severity, ["high", "critical"]))),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(auditLogsTable)
        .where(and(orgCond, sinceCond, eq(auditLogsTable.action, "delete"))),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(auditLogsTable)
        .where(and(orgCond, sinceCond, inArray(auditLogsTable.action, ["export", "audit_export", "download"]))),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(auditLogsTable)
        .where(and(orgCond, sinceCond, inArray(auditLogsTable.action, ["role_change", "permission_change"]))),
      db.select({ n: sql<number>`cast(count(*) as int)` }).from(securityAlertsTable)
        .where(and(eq(securityAlertsTable.organizationId, orgId), gte(securityAlertsTable.createdAt, since), isNull(securityAlertsTable.resolvedAt))),
    ]);

    // Séries par jour (30 derniers jours)
    const dailySeries = await db.select({
      day: sql<string>`to_char(${auditLogsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      total: sql<number>`cast(count(*) as int)`,
      failures: sql<number>`cast(sum(case when ${auditLogsTable.status} in ('failure','denied') then 1 else 0 end) as int)`,
    }).from(auditLogsTable)
      .where(and(orgCond, sinceCond))
      .groupBy(sql`to_char(${auditLogsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
      .orderBy(sql`1`);

    // Top modules
    const byModule = await db.select({
      module: auditLogsTable.module,
      n: sql<number>`cast(count(*) as int)`,
    }).from(auditLogsTable)
      .where(and(orgCond, sinceCond, isNotNull(auditLogsTable.module)))
      .groupBy(auditLogsTable.module)
      .orderBy(sql`2 desc`)
      .limit(8);

    // Par sévérité
    const bySeverity = await db.select({
      severity: auditLogsTable.severity,
      n: sql<number>`cast(count(*) as int)`,
    }).from(auditLogsTable)
      .where(and(orgCond, sinceCond))
      .groupBy(auditLogsTable.severity);

    // Utilisateurs les plus actifs
    const topUsers = await db.select({
      userEmail: auditLogsTable.userEmail,
      userId: auditLogsTable.userId,
      n: sql<number>`cast(count(*) as int)`,
    }).from(auditLogsTable)
      .where(and(orgCond, sinceCond, isNotNull(auditLogsTable.userEmail)))
      .groupBy(auditLogsTable.userEmail, auditLogsTable.userId)
      .orderBy(sql`3 desc`)
      .limit(5);

    return res.json({
      kpis: {
        total: Number(total[0]?.n ?? 0),
        logins: Number(logins[0]?.n ?? 0),
        failures: Number(failures[0]?.n ?? 0),
        sensitive: Number(sensitive[0]?.n ?? 0),
        deletions: Number(deletions[0]?.n ?? 0),
        exports: Number(exports_[0]?.n ?? 0),
        permissionChanges: Number(permissions[0]?.n ?? 0),
        openAlerts: Number(alerts[0]?.n ?? 0),
      },
      dailySeries,
      byModule,
      bySeverity,
      topUsers,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/admin/audit/user/:userId/timeline
// ══════════════════════════════════════════════════════════════════
router.get("/admin/audit/user/:userId/timeline", requirePermission("audit.read"), async (req, res) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const { userId } = req.params as { userId: string };
    if (!isUuid(userId)) { res.status(400).json({ error: "userId invalide" }); return; }
    const days = parseInt((req.query.days as string) || "7");
    const since = new Date(Date.now() - days * 86400000);
    const rows = await db.select().from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.organizationId, orgId),
        eq(auditLogsTable.userId, userId),
        gte(auditLogsTable.createdAt, since),
      ))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(200);
    return res.json({ data: rows, userId, days });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/admin/audit/entity/:type/:entityId — historique d'un élément
// ══════════════════════════════════════════════════════════════════
router.get("/admin/audit/entity/:type/:entityId", requirePermission("audit.read"), async (req, res) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const { type, entityId } = req.params as { type: string; entityId: string };
    if (!isUuid(entityId)) { res.status(400).json({ error: "entityId invalide" }); return; }
    const rows = await db.select().from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.organizationId, orgId),
        eq(auditLogsTable.entityType, type),
        eq(auditLogsTable.entityId, entityId as any),
      ))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(100);
    return res.json({ data: rows, entityType: type, entityId });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/admin/audit/:id — détail complet d'un événement
// ══════════════════════════════════════════════════════════════════
router.get("/admin/audit/:id", requirePermission("audit.read"), async (req, res) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const { id } = req.params as { id: string };
    if (!isUuid(id)) { res.status(400).json({ error: "id invalide" }); return; }
    const [row] = await db.select().from(auditLogsTable)
      .where(and(eq(auditLogsTable.id, id as any), eq(auditLogsTable.organizationId, orgId)));
    if (!row) { res.status(404).json({ error: "Événement introuvable" }); return; }
    // Journaliser la consultation d'un événement sensible
    if (row.severity === "high" || row.severity === "critical") {
      audit(req as any, "audit_view", { entityType: "audit_log", entityId: id, severity: "low", category: "audit" }).catch(() => {});
    }
    return res.json(row);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/admin/audit/export — export CSV/Excel (journalisé)
// ══════════════════════════════════════════════════════════════════
router.post("/admin/audit/export", requirePermission("audit.read"), async (req, res) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const { format = "csv", filters = {} } = req.body as { format?: "csv" | "xlsx"; filters?: Record<string, string> };

    const where = buildAuditWhere(orgId, filters);
    const rows = await db.select().from(auditLogsTable)
      .where(where as any).orderBy(desc(auditLogsTable.createdAt)).limit(5000);

    // Journaliser l'export
    audit(req as any, "audit_export", {
      module: "administration", entityType: "audit_logs",
      severity: "high", payload: { format, filters, count: rows.length },
    }).catch(() => {});

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Journal d'audit");
      ws.columns = [
        { header: "Date/Heure", key: "createdAt", width: 22 },
        { header: "Utilisateur", key: "userEmail", width: 30 },
        { header: "Rôle", key: "userRole", width: 15 },
        { header: "Action", key: "action", width: 25 },
        { header: "Sévérité", key: "severity", width: 12 },
        { header: "Statut", key: "status", width: 10 },
        { header: "Catégorie", key: "category", width: 12 },
        { header: "Module", key: "module", width: 18 },
        { header: "Sous-module", key: "subModule", width: 18 },
        { header: "Entité", key: "entityType", width: 15 },
        { header: "Nom entité", key: "entityName", width: 25 },
        { header: "IP", key: "ipAddress", width: 15 },
        { header: "Appareil", key: "device", width: 12 },
        { header: "Navigateur", key: "browser", width: 12 },
        { header: "OS", key: "os", width: 10 },
      ];
      // Header orange
      ws.getRow(1).eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      });
      for (const r of rows) {
        ws.addRow({
          createdAt: new Date(r.createdAt).toLocaleString("fr-FR"),
          userEmail: r.userEmail ?? "",
          userRole: r.userRole ?? "",
          action: r.action,
          severity: r.severity,
          status: r.status,
          category: r.category,
          module: r.module ?? "",
          subModule: r.subModule ?? "",
          entityType: r.entityType ?? "",
          entityName: r.entityName ?? "",
          ipAddress: r.ipAddress ?? "",
          device: r.device ?? "",
          browser: r.browser ?? "",
          os: r.os ?? "",
        });
      }
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="audit-${Date.now()}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    // CSV
    const header = "Date/Heure,Utilisateur,Rôle,Action,Sévérité,Statut,Module,Entité,IP,Appareil\n";
    const body = rows.map(r => [
      new Date(r.createdAt).toLocaleString("fr-FR"),
      r.userEmail ?? "",
      r.userRole ?? "",
      r.action,
      r.severity,
      r.status,
      r.module ?? "",
      r.entityType ?? "",
      r.ipAddress ?? "",
      r.device ?? "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit-${Date.now()}.csv"`);
    return res.send("\uFEFF" + header + body);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/admin/security-alerts
// ══════════════════════════════════════════════════════════════════
router.get("/admin/security-alerts", requirePermission("audit.read"), async (req, res) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const unresolved = (req.query.unresolved as string) === "true";
    const conds: any[] = [eq(securityAlertsTable.organizationId, orgId)];
    if (unresolved) conds.push(isNull(securityAlertsTable.resolvedAt));
    const rows = await db.select().from(securityAlertsTable)
      .where(and(...conds))
      .orderBy(desc(securityAlertsTable.createdAt))
      .limit(100);
    return res.json({ data: rows, total: rows.length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/admin/security-alerts/:id/resolve
// ══════════════════════════════════════════════════════════════════
router.patch("/admin/security-alerts/:id/resolve", requirePermission("audit.read"), async (req, res) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const { id } = req.params as { id: string };
    if (!isUuid(id)) { res.status(400).json({ error: "id invalide" }); return; }
    await db.update(securityAlertsTable).set({
      resolvedAt: new Date(),
      resolvedBy: ((req as any).authUser?.id ?? null) as any,
    }).where(and(eq(securityAlertsTable.id, id as any), eq(securityAlertsTable.organizationId, orgId)));
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
