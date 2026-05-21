/**
 * Phase 16 — Documents IA.
 *  - GET /api/documents/intelligence/overview     : KPI synthèse (total, classés, signés, expirés).
 *  - GET /api/documents/intelligence/by-category  : répartition par catégorie (IA vs manuelle).
 *  - GET /api/documents/intelligence/pending-signature : documents en attente de signature.
 *  - GET /api/documents/intelligence/unclassified : docs non analysés par l'IA.
 *
 * Heuristique pure. Permission `documents.read`.
 */
import { Router, type IRouter, type Request } from "express";
import { db, documentsTable } from "@workspace/db";
import { and, eq, isNull, sql, desc, isNotNull, ne, or, inArray } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions";
import { userAccessibleProjectIds } from "../lib/rbac/permissions";

const router: IRouter = Router();

// ACL parité avec /api/documents : les documents rattachés à un projet sont
// filtrés sur les projets accessibles ; les autres restent visibles selon
// la permission `documents.read`.
async function buildDocAcl(req: Request) {
  if (!req.authUser) return undefined;
  const accessible = await userAccessibleProjectIds(req.authUser.id);
  if (accessible === null) return undefined; // bypass admin
  if (accessible.length === 0) return ne(documentsTable.entityType, "project");
  return or(
    ne(documentsTable.entityType, "project"),
    and(eq(documentsTable.entityType, "project"), inArray(documentsTable.entityId, accessible)),
  );
}

router.get("/documents/intelligence/overview", requirePermission("documents.read"), async (req, res, next) => {
  try {
    const acl = await buildDocAcl(req);
    const baseCond = acl ? and(isNull(documentsTable.deletedAt), acl) : isNull(documentsTable.deletedAt);
    const [total] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(baseCond);
    const [analyzed] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(and(baseCond, isNotNull(documentsTable.aiAnalyzedAt)));
    const [signed] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(and(baseCond, eq(documentsTable.signatureStatus, "signed")));
    const [pendingSign] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(and(baseCond, eq(documentsTable.signatureStatus, "pending")));
    const [refusedSign] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(and(baseCond, eq(documentsTable.signatureStatus, "refused")));
    const [unclassified] = await db.select({ c: sql<number>`count(*)::int` }).from(documentsTable).where(and(baseCond, isNull(documentsTable.aiAnalyzedAt)));
    const totalC = total?.c ?? 0;
    return res.json({
      total: totalC,
      analyzed: analyzed?.c ?? 0,
      signed: signed?.c ?? 0,
      pendingSignature: pendingSign?.c ?? 0,
      refusedSignature: refusedSign?.c ?? 0,
      unclassified: unclassified?.c ?? 0,
      classificationRate: totalC > 0 ? Math.round(((analyzed?.c ?? 0) / totalC) * 1000) / 10 : 0,
    });
  } catch (e) { next(e); }
});

router.get("/documents/intelligence/by-category", requirePermission("documents.read"), async (req, res, next) => {
  try {
    const acl = await buildDocAcl(req);
    const where = acl ? and(isNull(documentsTable.deletedAt), acl) : isNull(documentsTable.deletedAt);
    const rows = await db.select({
      category: documentsTable.category,
      aiCategory: documentsTable.aiCategory,
      count: sql<number>`count(*)::int`,
    }).from(documentsTable).where(where).groupBy(documentsTable.category, documentsTable.aiCategory);
    const byCategory = new Map<string, { manual: number; ai: number; total: number; aiBreakdown: Record<string, number> }>();
    for (const r of rows) {
      const k = r.category;
      const acc = byCategory.get(k) ?? { manual: 0, ai: 0, total: 0, aiBreakdown: {} };
      acc.total += r.count;
      if (r.aiCategory) {
        acc.ai += r.count;
        acc.aiBreakdown[r.aiCategory] = (acc.aiBreakdown[r.aiCategory] ?? 0) + r.count;
      } else {
        acc.manual += r.count;
      }
      byCategory.set(k, acc);
    }
    const categories = Array.from(byCategory.entries()).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total);
    return res.json({ categories });
  } catch (e) { next(e); }
});

router.get("/documents/intelligence/pending-signature", requirePermission("documents.read"), async (req, res, next) => {
  try {
    const acl = await buildDocAcl(req);
    const conds: any[] = [isNull(documentsTable.deletedAt), eq(documentsTable.signatureStatus, "pending")];
    if (acl) conds.push(acl);
    const rows = await db.select({
      id: documentsTable.id, name: documentsTable.name, category: documentsTable.category,
      aiCategory: documentsTable.aiCategory, createdAt: documentsTable.createdAt, signers: documentsTable.signers,
    }).from(documentsTable).where(and(...conds)).orderBy(desc(documentsTable.createdAt)).limit(50);
    const now = Date.now();
    const enriched = rows.map((r) => {
      const ageDays = Math.floor((now - new Date(r.createdAt).getTime()) / 86400000);
      const pendingSigners = (r.signers ?? []).filter((s: any) => !s.signedAt).length;
      const tier: "urgent" | "high" | "medium" | "low" = ageDays > 14 ? "urgent" : ageDays > 7 ? "high" : ageDays > 3 ? "medium" : "low";
      return { ...r, ageDays, pendingSigners, tier };
    });
    return res.json({ count: enriched.length, rows: enriched });
  } catch (e) { next(e); }
});

router.get("/documents/intelligence/unclassified", requirePermission("documents.read"), async (req, res, next) => {
  try {
    const acl = await buildDocAcl(req);
    const conds: any[] = [isNull(documentsTable.deletedAt), isNull(documentsTable.aiAnalyzedAt)];
    if (acl) conds.push(acl);
    const rows = await db.select({
      id: documentsTable.id, name: documentsTable.name, category: documentsTable.category,
      mimeType: documentsTable.mimeType, size: documentsTable.size, createdAt: documentsTable.createdAt,
    }).from(documentsTable).where(and(...conds)).orderBy(desc(documentsTable.createdAt)).limit(50);
    return res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

export default router;
