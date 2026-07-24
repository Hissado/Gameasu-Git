import { Router } from "express";
import { db } from "@workspace/db";
import {
  cloudStorageConnectionsTable,
  cloudSyncedFilesTable,
  cloudSyncQueueTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getCurrentOrganizationId } from "../lib/tenant";
import { audit } from "../lib/audit";
import { logger } from "../lib/logger";
import {
  PROVIDER_CATALOG,
  getProvider,
  getGoogleDriveProvider,
  encryptToken,
  decryptToken,
  signState,
  verifyState,
} from "../lib/cloud-storage/index";

const router = Router();

function isAdmin(req: any) {
  return ["super_admin", "admin"].includes(req.authUser?.role);
}

// ── Providers catalogue (public pour la page de config) ───────────────────────
router.get("/cloud-storage/providers", requireAuth, async (req, res) => {
  res.json(PROVIDER_CATALOG);
});

// ── Connexions de l'organisation ──────────────────────────────────────────────
router.get("/cloud-storage/connections", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const connections = await db
      .select({
        id:            cloudStorageConnectionsTable.id,
        provider:      cloudStorageConnectionsTable.provider,
        displayName:   cloudStorageConnectionsTable.displayName,
        accountEmail:  cloudStorageConnectionsTable.accountEmail,
        accountName:   cloudStorageConnectionsTable.accountName,
        status:        cloudStorageConnectionsTable.status,
        syncEnabled:   cloudStorageConnectionsTable.syncEnabled,
        autoSync:      cloudStorageConnectionsTable.autoSync,
        rootFolderName:cloudStorageConnectionsTable.rootFolderName,
        lastSyncAt:    cloudStorageConnectionsTable.lastSyncAt,
        lastError:     cloudStorageConnectionsTable.lastError,
        connectedAt:   cloudStorageConnectionsTable.connectedAt,
        folderMap:     cloudStorageConnectionsTable.folderMap,
        scopeGranted:  cloudStorageConnectionsTable.scopeGranted,
      })
      .from(cloudStorageConnectionsTable)
      .where(eq(cloudStorageConnectionsTable.organizationId, orgId))
      .orderBy(desc(cloudStorageConnectionsTable.connectedAt));

    res.json(connections);
  } catch (err) {
    logger.error({ err }, "GET /cloud-storage/connections");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── Détail d'une connexion ────────────────────────────────────────────────────
router.get("/cloud-storage/connections/:id", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const [conn] = await db
      .select()
      .from(cloudStorageConnectionsTable)
      .where(and(
        eq(cloudStorageConnectionsTable.id, req.params.id as string),
        eq(cloudStorageConnectionsTable.organizationId, orgId),
      ));
    if (!conn) { res.status(404).json({ error: "Connexion introuvable" }); return; }
    const { accessTokenEnc, refreshTokenEnc, ...safe } = conn;
    res.json(safe);
  } catch (err) {
    logger.error({ err }, "GET /cloud-storage/connections/:id");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── Mise à jour des paramètres d'une connexion ────────────────────────────────
router.put("/cloud-storage/connections/:id", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const [conn] = await db
      .select({ id: cloudStorageConnectionsTable.id })
      .from(cloudStorageConnectionsTable)
      .where(and(
        eq(cloudStorageConnectionsTable.id, req.params.id as string),
        eq(cloudStorageConnectionsTable.organizationId, orgId),
      ));
    if (!conn) { res.status(404).json({ error: "Connexion introuvable" }); return; }

    const { syncEnabled, autoSync, displayName, folderMap } = req.body ?? {};
    await db.update(cloudStorageConnectionsTable).set({
      ...(syncEnabled  !== undefined && { syncEnabled }),
      ...(autoSync     !== undefined && { autoSync }),
      ...(displayName  !== undefined && { displayName }),
      ...(folderMap    !== undefined && { folderMap }),
    }).where(eq(cloudStorageConnectionsTable.id, conn.id));

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT /cloud-storage/connections/:id");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── Test de connexion ─────────────────────────────────────────────────────────
router.post("/cloud-storage/connections/:id/test", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const [conn] = await db
      .select()
      .from(cloudStorageConnectionsTable)
      .where(and(
        eq(cloudStorageConnectionsTable.id, req.params.id as string),
        eq(cloudStorageConnectionsTable.organizationId, orgId),
      ));
    if (!conn) { res.status(404).json({ error: "Connexion introuvable" }); return; }

    const provider = getProvider(conn.provider);
    const at  = decryptToken(conn.accessTokenEnc!);
    const rt  = decryptToken(conn.refreshTokenEnc!);
    const result = await provider.testConnection(at, rt);

    await db.update(cloudStorageConnectionsTable).set({
      status:    result.ok ? "connected" : "error",
      lastError: result.ok ? null : "Test de connexion échoué",
    }).where(eq(cloudStorageConnectionsTable.id, conn.id));

    res.json(result);
  } catch (err: any) {
    logger.warn({ err }, "POST /cloud-storage/connections/:id/test");
    res.status(200).json({ ok: false, error: err?.message ?? "Erreur inconnue" });
  }
});

// ── Déconnecter un fournisseur ────────────────────────────────────────────────
router.delete("/cloud-storage/connections/:id", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const [conn] = await db
      .select()
      .from(cloudStorageConnectionsTable)
      .where(and(
        eq(cloudStorageConnectionsTable.id, req.params.id as string),
        eq(cloudStorageConnectionsTable.organizationId, orgId),
      ));
    if (!conn) { res.status(404).json({ error: "Connexion introuvable" }); return; }

    await db.update(cloudStorageConnectionsTable).set({
      status:          "disconnected",
      accessTokenEnc:  null,
      refreshTokenEnc: null,
      disconnectedAt:  new Date(),
    }).where(eq(cloudStorageConnectionsTable.id, conn.id));

    audit(req, "deactivate", {
      entityType:  "cloud_storage_connection",
      entityId:    conn.id,
      entityName:  `${conn.provider} — ${conn.accountEmail ?? ""}`,
      module:      "administration",
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /cloud-storage/connections/:id");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── Fichiers synchronisés ─────────────────────────────────────────────────────
router.get("/cloud-storage/files", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const files = await db
      .select()
      .from(cloudSyncedFilesTable)
      .where(eq(cloudSyncedFilesTable.organizationId, orgId))
      .orderBy(desc(cloudSyncedFilesTable.updatedAt))
      .limit(100);

    res.json(files);
  } catch (err) {
    logger.error({ err }, "GET /cloud-storage/files");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── Statut de la file de sync ─────────────────────────────────────────────────
router.get("/cloud-storage/queue", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const stats = await db
      .select({ status: cloudSyncQueueTable.status, count: sql<number>`count(*)::int` })
      .from(cloudSyncQueueTable)
      .where(eq(cloudSyncQueueTable.organizationId, orgId))
      .groupBy(cloudSyncQueueTable.status);

    const recent = await db
      .select()
      .from(cloudSyncQueueTable)
      .where(eq(cloudSyncQueueTable.organizationId, orgId))
      .orderBy(desc(cloudSyncQueueTable.createdAt))
      .limit(20);

    res.json({ stats, recent });
  } catch (err) {
    logger.error({ err }, "GET /cloud-storage/queue");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── Sync manuelle d'un fichier ────────────────────────────────────────────────
router.post("/cloud-storage/sync", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const { connectionId, fileName, contentBase64, mimeType, gamesuRef, gamesuModule, parentFolderId } = req.body ?? {};
    if (!connectionId || !fileName || !contentBase64) {
      res.status(400).json({ error: "connectionId, fileName et contentBase64 sont requis" }); return;
    }

    const [conn] = await db
      .select({ id: cloudStorageConnectionsTable.id, provider: cloudStorageConnectionsTable.provider })
      .from(cloudStorageConnectionsTable)
      .where(and(
        eq(cloudStorageConnectionsTable.id, connectionId),
        eq(cloudStorageConnectionsTable.organizationId, orgId),
        eq(cloudStorageConnectionsTable.status, "connected"),
      ));
    if (!conn) { res.status(404).json({ error: "Connexion active introuvable" }); return; }

    const [syncedFile] = await db.insert(cloudSyncedFilesTable).values({
      organizationId: orgId,
      connectionId:   conn.id,
      provider:       conn.provider,
      gamesuRef:      gamesuRef ?? null,
      gamesuModule:   gamesuModule ?? null,
      fileName,
      mimeType:       mimeType ?? "application/octet-stream",
      status:         "pending",
    }).returning();

    await db.insert(cloudSyncQueueTable).values({
      organizationId: orgId,
      connectionId:   conn.id,
      syncedFileId:   syncedFile.id,
      action:         "upload",
      fileData:       { name: fileName, contentBase64, mimeType: mimeType ?? "application/octet-stream", parentFolderId },
      status:         "pending",
    });

    res.status(202).json({ id: syncedFile.id, status: "pending", message: "Synchronisation planifiée" });
  } catch (err) {
    logger.error({ err }, "POST /cloud-storage/sync");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OAuth Google Drive — démarrage du flux
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/cloud-storage/oauth/google/start", requireAuth, async (req, res) => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Accès administrateur requis" }); return; }
  try {
    const orgId = req.authUser?.organizationId ?? await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const provider = getGoogleDriveProvider();
    if (!(provider as any).isConfigured()) {
      res.status(503).json({ error: "GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET non configurés" }); return;
    }

    const state = signState({ orgId, userId: req.authUser?.id, nonce: Date.now() });
    const url   = provider.getAuthUrl(state);

    audit(req, "create", {
      entityType: "cloud_storage",
      entityName: "Google Drive OAuth démarré",
      module:     "administration",
    });

    res.json({ url });
  } catch (err) {
    logger.error({ err }, "GET /cloud-storage/oauth/google/start");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OAuth Google Drive — callback (non protégé par requireAuth, Google redirige ici)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/cloud-storage/oauth/google/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) {
    logger.warn({ oauthError }, "cloud-storage: OAuth refusé par l'utilisateur");
    return res.redirect(`/admin/cloud-storage?error=access_denied`);
  }

  try {
    const { orgId, userId } = verifyState<{ orgId: string; userId: string }>(state);

    const provider = getGoogleDriveProvider();
    const tokens   = await provider.exchangeCode(code);

    const existing = await db
      .select({ id: cloudStorageConnectionsTable.id })
      .from(cloudStorageConnectionsTable)
      .where(and(
        eq(cloudStorageConnectionsTable.organizationId, orgId),
        eq(cloudStorageConnectionsTable.provider, "google_drive"),
      ));

    const connData = {
      organizationId:  orgId,
      provider:        "google_drive",
      displayName:     `Google Drive — ${tokens.accountEmail ?? "Mon Drive"}`,
      accountEmail:    tokens.accountEmail ?? null,
      accountName:     tokens.accountName  ?? null,
      accessTokenEnc:  encryptToken(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      tokenExpiresAt:  tokens.expiresAt,
      scopeGranted:    tokens.scope ?? null,
      status:          "connected" as const,
      connectedById:   userId,
      connectedAt:     new Date(),
      lastError:       null,
    };

    let connId: string;
    if (existing.length) {
      await db.update(cloudStorageConnectionsTable).set(connData).where(eq(cloudStorageConnectionsTable.id, existing[0].id));
      connId = existing[0].id;
    } else {
      const [conn] = await db.insert(cloudStorageConnectionsTable).values(connData).returning({ id: cloudStorageConnectionsTable.id });
      connId = conn.id;
    }

    // Créer la structure de dossiers par défaut
    setImmediate(async () => {
      try {
        const [conn] = await db.select().from(cloudStorageConnectionsTable).where(eq(cloudStorageConnectionsTable.id, connId));
        if (!conn?.accessTokenEnc || !conn.refreshTokenEnc) return;
        const at = decryptToken(conn.accessTokenEnc);
        const rt = decryptToken(conn.refreshTokenEnc);

        const rootId = await provider.createFolder(at, rt, "Gameasu");
        const folderMap: Record<string, string> = { root: rootId };

        const sections = [
          ["Clients", "clients"], ["Fournisseurs", "suppliers"],
          ["Ressources humaines", "hr"], ["Comptabilité", "accounting"],
          ["Projets", "projects"], ["Rapports", "reports"],
          ["Sauvegardes exportées", "backups"],
        ];
        for (const [name, key] of sections) {
          folderMap[key] = await provider.createFolder(at, rt, name, rootId);
        }

        await db.update(cloudStorageConnectionsTable).set({
          rootFolderId:   rootId,
          rootFolderName: "Gameasu",
          folderMap,
        }).where(eq(cloudStorageConnectionsTable.id, connId));
      } catch (e) {
        logger.warn({ err: e, connId }, "cloud-storage: création dossiers échouée");
      }
    });

    res.redirect(`/admin/cloud-storage?connected=google_drive`);
  } catch (err: any) {
    logger.error({ err }, "cloud-storage: callback OAuth erreur");
    res.redirect(`/admin/cloud-storage?error=oauth_failed`);
  }
});

export default router;
