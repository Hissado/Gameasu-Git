import { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { dataExportsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getCurrentOrganizationId } from "../lib/tenant";
import { audit } from "../lib/audit";
import { generateOrgExport, cleanupExpiredExports } from "../lib/data-export";
import { logger } from "../lib/logger";
import { randomUUID } from "crypto";

const router = Router();
router.use(requireAuth);

function getOrgId(req: any) { return getCurrentOrganizationId(req.authUser?.id); }
function isAdmin(req: any) { return ["super_admin", "admin"].includes(req.authUser?.role); }

// ══════════════════════════════════════════════════════════════
// GET /api/data/exports — liste des exports de l'organisation
// ══════════════════════════════════════════════════════════════
router.get("/data/exports", async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès réservé aux administrateurs" }); return; }
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    cleanupExpiredExports();

    const exports = await db.select({
      id: dataExportsTable.id,
      status: dataExportsTable.status,
      requestedAt: dataExportsTable.requestedAt,
      generatedAt: dataExportsTable.generatedAt,
      expiresAt: dataExportsTable.expiresAt,
      downloadedAt: dataExportsTable.downloadedAt,
      fileSize: dataExportsTable.fileSize,
      downloadCount: dataExportsTable.downloadCount,
      triggeredBy: dataExportsTable.triggeredBy,
      reason: dataExportsTable.reason,
      requestedByEmail: dataExportsTable.requestedByEmail,
      errorMessage: dataExportsTable.errorMessage,
      stats: dataExportsTable.stats,
    })
      .from(dataExportsTable)
      .where(eq(dataExportsTable.organizationId, orgId))
      .orderBy(desc(dataExportsTable.requestedAt))
      .limit(50);

    // Marquer comme expiré si dépassé
    const now = new Date();
    const updated = exports.map(e => ({
      ...e,
      status: e.status === "ready" && e.expiresAt && e.expiresAt < now ? "expired" : e.status,
    }));

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "GET /data/exports");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/data/exports — lancer un nouvel export
// ══════════════════════════════════════════════════════════════
router.post("/data/exports", async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès réservé aux administrateurs" }); return; }
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const { reason } = req.body ?? {};
    const downloadToken = randomUUID();

    const [exp] = await db.insert(dataExportsTable).values({
      organizationId: orgId,
      requestedById: req.authUser?.id ?? null,
      requestedByEmail: req.authUser?.email ?? null,
      status: "pending",
      triggeredBy: "manual",
      reason: reason ?? null,
      downloadToken,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    }).returning();

    audit(req, "export", {
      category: "audit",
      severity: "high",
      entityType: "data_export",
      entityId: exp.id,
      entityName: "Export complet de l'organisation",
      module: "administration",
    });

    // Lancer la génération en arrière-plan (non bloquant)
    setImmediate(() => {
      generateOrgExport(exp.id, orgId).catch(e =>
        logger.error({ exportId: exp.id, err: e }, "generateOrgExport failed")
      );
    });

    res.status(202).json({ id: exp.id, status: "pending", message: "Génération de l'export en cours…" });
  } catch (err) {
    logger.error({ err }, "POST /data/exports");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/data/exports/:id — statut détaillé
// ══════════════════════════════════════════════════════════════
router.get("/data/exports/:id", async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès réservé aux administrateurs" }); return; }
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const [exp] = await db.select()
      .from(dataExportsTable)
      .where(and(eq(dataExportsTable.id, req.params.id as string), eq(dataExportsTable.organizationId, orgId)));

    if (!exp) { res.status(404).json({ error: "Export introuvable" }); return; }

    const now = new Date();
    const isExpired = exp.status === "ready" && exp.expiresAt && exp.expiresAt < now;

    res.json({
      ...exp,
      status: isExpired ? "expired" : exp.status,
    });
  } catch (err) {
    logger.error({ err }, "GET /data/exports/:id");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/data/exports/:id/download — télécharger le ZIP
// ══════════════════════════════════════════════════════════════
router.get("/data/exports/:id/download", async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès réservé aux administrateurs" }); return; }
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const token = req.query.token as string;
    if (!token) { res.status(400).json({ error: "Token de téléchargement requis" }); return; }

    const [exp] = await db.select()
      .from(dataExportsTable)
      .where(and(eq(dataExportsTable.id, req.params.id as string), eq(dataExportsTable.organizationId, orgId)));

    if (!exp) { res.status(404).json({ error: "Export introuvable" }); return; }
    if (exp.downloadToken !== token) { res.status(403).json({ error: "Token invalide" }); return; }
    if (exp.status !== "ready") { res.status(400).json({ error: `L'export est en statut « ${exp.status} »` }); return; }

    const now = new Date();
    if (exp.expiresAt && exp.expiresAt < now) {
      await db.update(dataExportsTable).set({ status: "expired" }).where(eq(dataExportsTable.id, exp.id));
      res.status(410).json({ error: "Ce lien de téléchargement a expiré" }); return;
    }

    if (!exp.filePath || !fs.existsSync(exp.filePath)) {
      res.status(404).json({ error: "Fichier introuvable sur le serveur" }); return;
    }

    await db.update(dataExportsTable).set({
      downloadCount: (exp.downloadCount ?? 0) + 1,
      downloadedAt: now,
      status: "downloaded",
    }).where(eq(dataExportsTable.id, exp.id));

    audit(req, "download", {
      category: "audit",
      severity: "high",
      entityType: "data_export",
      entityId: exp.id,
      entityName: "Export complet de l'organisation",
      module: "administration",
    });

    const orgName = orgId.slice(0, 8);
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="gameasu-export-${orgName}-${dateStr}.zip"`);
    res.setHeader("Content-Length", exp.fileSize ?? 0);
    fs.createReadStream(exp.filePath).pipe(res);
  } catch (err) {
    logger.error({ err }, "GET /data/exports/:id/download");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ══════════════════════════════════════════════════════════════
// DELETE /api/data/exports/:id — supprimer un export
// ══════════════════════════════════════════════════════════════
router.delete("/data/exports/:id", async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès réservé aux administrateurs" }); return; }
  try {
    const orgId = await getOrgId(req);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const [exp] = await db.select()
      .from(dataExportsTable)
      .where(and(eq(dataExportsTable.id, req.params.id as string), eq(dataExportsTable.organizationId, orgId)));

    if (!exp) { res.status(404).json({ error: "Export introuvable" }); return; }

    if (exp.filePath && fs.existsSync(exp.filePath)) {
      fs.unlinkSync(exp.filePath);
    }
    await db.delete(dataExportsTable).where(eq(dataExportsTable.id, exp.id));

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /data/exports/:id");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
