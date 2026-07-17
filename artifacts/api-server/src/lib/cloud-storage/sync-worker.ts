import { db } from "@workspace/db";
import { cloudSyncQueueTable, cloudStorageConnectionsTable, cloudSyncedFilesTable } from "@workspace/db/schema";
import { eq, and, lte, lt } from "drizzle-orm";
import { getProvider } from "./index";
import { decryptToken } from "./encryption";
import { logger } from "../logger";

const BATCH_SIZE = 10;
const INTERVAL_MS = 2 * 60 * 1000;

export async function processQueue(): Promise<void> {
  const now = new Date();
  const jobs = await db
    .select()
    .from(cloudSyncQueueTable)
    .where(
      and(
        eq(cloudSyncQueueTable.status, "pending"),
        lte(cloudSyncQueueTable.scheduledAt, now),
        lt(cloudSyncQueueTable.attempts, cloudSyncQueueTable.maxAttempts),
      ),
    )
    .limit(BATCH_SIZE)
    .orderBy(cloudSyncQueueTable.scheduledAt);

  if (!jobs.length) return;
  logger.info({ count: jobs.length }, "cloud-sync: traitement de la file");

  for (const job of jobs) {
    await db.update(cloudSyncQueueTable).set({ status: "processing" }).where(eq(cloudSyncQueueTable.id, job.id));

    try {
      const [conn] = await db
        .select()
        .from(cloudStorageConnectionsTable)
        .where(eq(cloudStorageConnectionsTable.id, job.connectionId));

      if (!conn || conn.status !== "connected") {
        throw new Error(`Connexion indisponible : ${conn?.status ?? "introuvable"}`);
      }

      const accessToken  = decryptToken(conn.accessTokenEnc!);
      const refreshToken = decryptToken(conn.refreshTokenEnc!);
      const provider     = getProvider(conn.provider);

      const fileData = job.fileData as { name: string; contentBase64: string; mimeType: string; parentFolderId?: string } | null;
      if (!fileData) throw new Error("fileData manquant dans la queue");

      if (job.action === "upload") {
        const content = Buffer.from(fileData.contentBase64, "base64");
        const result  = await provider.uploadFile(
          accessToken, refreshToken,
          { name: fileData.name, content, mimeType: fileData.mimeType },
          fileData.parentFolderId,
        );

        if (job.syncedFileId) {
          await db.update(cloudSyncedFilesTable).set({
            cloudFileId:  result.cloudFileId,
            cloudPath:    result.cloudPath,
            cloudViewUrl: result.cloudViewUrl,
            cloudEditUrl: result.cloudEditUrl,
            fileSize:     result.fileSize,
            status:       "synced",
            syncedAt:     new Date(),
            syncAttempts: (job.attempts + 1),
            errorMessage: null,
          }).where(eq(cloudSyncedFilesTable.id, job.syncedFileId));
        }
      }

      await db.update(cloudSyncQueueTable).set({
        status:      "done",
        processedAt: new Date(),
        attempts:    job.attempts + 1,
      }).where(eq(cloudSyncQueueTable.id, job.id));

      await db.update(cloudStorageConnectionsTable).set({ lastSyncAt: new Date() }).where(eq(cloudStorageConnectionsTable.id, job.connectionId));

      logger.info({ jobId: job.id, action: job.action }, "cloud-sync: job réussi");

    } catch (err: any) {
      const nextAttempts = job.attempts + 1;
      const failed       = nextAttempts >= (job.maxAttempts ?? 3);
      const retryAt      = new Date(Date.now() + nextAttempts * 5 * 60_000);

      await db.update(cloudSyncQueueTable).set({
        status:       failed ? "failed" : "pending",
        attempts:     nextAttempts,
        scheduledAt:  failed ? job.scheduledAt : retryAt,
        errorMessage: err?.message ?? String(err),
      }).where(eq(cloudSyncQueueTable.id, job.id));

      if (job.syncedFileId) {
        await db.update(cloudSyncedFilesTable).set({
          status:       failed ? "failed" : "pending",
          errorMessage: err?.message ?? String(err),
          syncAttempts: nextAttempts,
        }).where(eq(cloudSyncedFilesTable.id, job.syncedFileId));
      }

      logger.warn({ jobId: job.id, err: err?.message, attempt: nextAttempts, failed }, "cloud-sync: job échoué");
    }
  }
}

let workerHandle: ReturnType<typeof setInterval> | null = null;

export function startSyncWorker(): void {
  if (workerHandle) return;
  workerHandle = setInterval(() => {
    processQueue().catch(e => logger.error({ err: e }, "cloud-sync: erreur worker"));
  }, INTERVAL_MS);
  logger.info("cloud-sync: worker démarré (toutes les 2 min)");
}

export function stopSyncWorker(): void {
  if (workerHandle) { clearInterval(workerHandle); workerHandle = null; }
}
