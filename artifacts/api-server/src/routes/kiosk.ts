import { Router, type IRouter, type Request, type Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import {
  collaboratorsTable,
  kiosksTable,
  kioskTokensTable,
  attendanceRecordsTable,
  attendanceSessionsTable,
} from "@workspace/db";
import { and, eq, isNull, desc, gte, lte, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { getCurrentOrganizationId } from "../lib/tenant";
import { ObjectStorageService } from "../lib/objectStorage";
import { audit } from "../lib/audit";
import { requirePermission } from "../middlewares/permissions";

// ── Helpers pour les tokens hachés ───────────────────────────────
function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex"); // 64 chars hex
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const IS_NEW_TOKEN = /^[0-9a-f]{64}$/i;
const IS_LEGACY_UUID = /^[0-9a-f-]{36}$/i;

// ─────────────────────────────────────────────────────────────────
// Public router — monté avant requireAuth
// ─────────────────────────────────────────────────────────────────
export const kioskPublicRouter: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// GET /api/kiosk/validate/:token — Valider un token kiosk au démarrage (public)
// Accepte : token haché (hex 64 chars, kiosk_tokens) OU UUID legacy (kiosks.token)
kioskPublicRouter.get("/kiosk/validate/:token", async (req: Request, res: Response, next) => {
  try {
    const { token } = req.params;
    if (!token) { res.status(400).json({ error: "Token manquant" }); return; }

    const isNew = IS_NEW_TOKEN.test(token);
    const isLegacy = IS_LEGACY_UUID.test(token);
    if (!isNew && !isLegacy) {
      res.status(400).json({ error: "Format de token invalide" });
      return;
    }

    let kioskId: string;
    let kioskName: string;
    let kioskLocation: string | null;
    let kioskOrgId: string;
    let kioskSettings: Record<string, unknown>;

    if (isNew) {
      // Nouveau format : lookup par hash dans kiosk_tokens
      const tokenHash = hashToken(token);
      const [tokenRow] = await db
        .select({ id: kioskTokensTable.id, kioskId: kioskTokensTable.kioskId })
        .from(kioskTokensTable)
        .where(and(
          eq(kioskTokensTable.tokenHash, tokenHash),
          eq(kioskTokensTable.isActive, true),
          isNull(kioskTokensTable.revokedAt),
        ))
        .limit(1);
      if (!tokenRow) { res.status(403).json({ error: "Token invalide ou révoqué" }); return; }

      // Mettre à jour les compteurs d'utilisation (non bloquant)
      db.update(kioskTokensTable)
        .set({ lastUsedAt: new Date(), usageCount: sql`${kioskTokensTable.usageCount} + 1` })
        .where(eq(kioskTokensTable.id, tokenRow.id))
        .catch(() => {});

      const [kiosk] = await db
        .select({
          id: kiosksTable.id, name: kiosksTable.name, location: kiosksTable.location,
          organizationId: kiosksTable.organizationId, isActive: kiosksTable.isActive, settings: kiosksTable.settings,
        })
        .from(kiosksTable)
        .where(and(eq(kiosksTable.id, tokenRow.kioskId), eq(kiosksTable.isActive, true)))
        .limit(1);
      if (!kiosk) { res.status(403).json({ error: "Kiosk désactivé" }); return; }
      kioskId = kiosk.id; kioskName = kiosk.name; kioskLocation = kiosk.location;
      kioskOrgId = kiosk.organizationId; kioskSettings = (kiosk.settings as Record<string, unknown>) ?? {};
    } else {
      // Ancien format UUID : lookup direct dans kiosks.token
      const [kiosk] = await db
        .select({
          id: kiosksTable.id, name: kiosksTable.name, location: kiosksTable.location,
          organizationId: kiosksTable.organizationId, isActive: kiosksTable.isActive, settings: kiosksTable.settings,
        })
        .from(kiosksTable)
        .where(and(eq(kiosksTable.token, token), eq(kiosksTable.isActive, true), isNull(kiosksTable.revokedAt)))
        .limit(1);
      if (!kiosk) { res.status(403).json({ error: "Token invalide ou kiosk désactivé" }); return; }
      db.update(kiosksTable)
        .set({ lastSeenAt: new Date(), usageCount: sql`${kiosksTable.usageCount} + 1` })
        .where(eq(kiosksTable.id, kiosk.id))
        .catch(() => {});
      kioskId = kiosk.id; kioskName = kiosk.name; kioskLocation = kiosk.location;
      kioskOrgId = kiosk.organizationId; kioskSettings = (kiosk.settings as Record<string, unknown>) ?? {};
    }

    audit(req, "kiosk_token_access", {
      entityType: "kiosk", entityId: kioskId, organizationId: kioskOrgId,
      payload: { kioskName },
    }).catch(() => {});

    res.json({ id: kioskId, name: kioskName, location: kioskLocation, organizationId: kioskOrgId, settings: kioskSettings });
  } catch (err) { next(err); }
});

// POST /api/kiosk/identify — Identifier un collaborateur par code + token kiosk
kioskPublicRouter.post("/kiosk/identify", async (req: Request, res: Response, next) => {
  try {
    const schema = z.object({
      code: z.string().length(4).regex(/^\d{4}$/),
      kioskToken: z.string().min(36), // UUID legacy ou hex64 new
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Code ou token invalide" });
      return;
    }

    const { code, kioskToken } = parsed.data;

    let kiosk: { id: string; name: string; location: string | null; organizationId: string; isActive: boolean } | undefined;
    if (IS_NEW_TOKEN.test(kioskToken)) {
      const [tokenRow] = await db
        .select({ kioskId: kioskTokensTable.kioskId })
        .from(kioskTokensTable)
        .where(and(eq(kioskTokensTable.tokenHash, hashToken(kioskToken)), eq(kioskTokensTable.isActive, true), isNull(kioskTokensTable.revokedAt)))
        .limit(1);
      if (tokenRow) {
        const [k] = await db
          .select({ id: kiosksTable.id, name: kiosksTable.name, location: kiosksTable.location, organizationId: kiosksTable.organizationId, isActive: kiosksTable.isActive })
          .from(kiosksTable)
          .where(and(eq(kiosksTable.id, tokenRow.kioskId), eq(kiosksTable.isActive, true)))
          .limit(1);
        kiosk = k;
      }
    } else {
      // Ancien format UUID : lookup direct dans kiosks.token
      const [k] = await db
        .select({ id: kiosksTable.id, name: kiosksTable.name, location: kiosksTable.location, organizationId: kiosksTable.organizationId, isActive: kiosksTable.isActive })
        .from(kiosksTable)
        .where(and(eq(kiosksTable.token, kioskToken), eq(kiosksTable.isActive, true), isNull(kiosksTable.revokedAt)))
        .limit(1);
      kiosk = k;
    }

    if (!kiosk) {
      res.status(403).json({ error: "Kiosk non trouvé ou inactif" });
      return;
    }

    await db.update(kiosksTable).set({ lastSeenAt: new Date() }).where(eq(kiosksTable.id, kiosk.id));

    const collabs = await db
      .select({
        id: collaboratorsTable.id,
        firstName: collaboratorsTable.firstName,
        lastName: collaboratorsTable.lastName,
        position: collaboratorsTable.position,
        avatarUrl: collaboratorsTable.avatarUrl,
        employmentStatus: collaboratorsTable.employmentStatus,
      })
      .from(collaboratorsTable)
      .where(
        and(
          eq(collaboratorsTable.organizationId, kiosk.organizationId),
          eq(collaboratorsTable.kioskCode, code),
          isNull(collaboratorsTable.deletedAt),
          eq(collaboratorsTable.employmentStatus, "active"),
        ),
      )
      .limit(1);

    const collab = collabs[0];

    if (!collab) {
      res.status(404).json({ error: "Code non reconnu" });
      return;
    }

    res.json({
      collaborator: {
        id: collab.id,
        firstName: collab.firstName,
        lastName: collab.lastName,
        position: collab.position,
        avatarUrl: collab.avatarUrl,
      },
      kiosk: {
        id: kiosk.id,
        name: kiosk.name,
        location: kiosk.location,
        organizationId: kiosk.organizationId,
        settings: {},
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/kiosk/punch — Enregistrer un pointage depuis le kiosk
kioskPublicRouter.post("/kiosk/punch", async (req: Request, res: Response, next) => {
  try {
    const schema = z.object({
      kioskToken: z.string().min(36), // UUID legacy ou hex64 new
      collaboratorId: z.string().uuid(),
      kind: z.enum(["clock_in", "clock_out", "break_start", "break_end"]),
      photoDataUrl: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      accuracyMeters: z.number().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides" });
      return;
    }

    const { kioskToken, collaboratorId, kind, photoDataUrl, latitude, longitude, accuracyMeters } = parsed.data;

    let kiosk: { id: string; organizationId: string; isActive: boolean } | undefined;
    if (IS_NEW_TOKEN.test(kioskToken)) {
      const [tokenRow] = await db
        .select({ kioskId: kioskTokensTable.kioskId })
        .from(kioskTokensTable)
        .where(and(eq(kioskTokensTable.tokenHash, hashToken(kioskToken)), eq(kioskTokensTable.isActive, true), isNull(kioskTokensTable.revokedAt)))
        .limit(1);
      if (tokenRow) {
        const [k] = await db
          .select({ id: kiosksTable.id, organizationId: kiosksTable.organizationId, isActive: kiosksTable.isActive })
          .from(kiosksTable)
          .where(and(eq(kiosksTable.id, tokenRow.kioskId), eq(kiosksTable.isActive, true)))
          .limit(1);
        kiosk = k;
      }
    } else {
      // Ancien format UUID : lookup direct dans kiosks.token
      const [k] = await db
        .select({ id: kiosksTable.id, organizationId: kiosksTable.organizationId, isActive: kiosksTable.isActive })
        .from(kiosksTable)
        .where(and(eq(kiosksTable.token, kioskToken), eq(kiosksTable.isActive, true), isNull(kiosksTable.revokedAt)))
        .limit(1);
      kiosk = k;
    }

    if (!kiosk) {
      res.status(403).json({ error: "Kiosk non autorisé" });
      return;
    }

    const [collab] = await db
      .select({ id: collaboratorsTable.id, organizationId: collaboratorsTable.organizationId })
      .from(collaboratorsTable)
      .where(
        and(
          eq(collaboratorsTable.id, collaboratorId),
          eq(collaboratorsTable.organizationId, kiosk.organizationId),
          isNull(collaboratorsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!collab) {
      res.status(404).json({ error: "Collaborateur non trouvé" });
      return;
    }

    // Upload photo si fournie
    let photoUrl: string | null = null;
    if (photoDataUrl && photoDataUrl.startsWith("data:image/")) {
      try {
        const contentType = photoDataUrl.split(";")[0]!.replace("data:", "");
        const base64Data = photoDataUrl.split(",")[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, "base64");
          const uploadUrlStr = await objectStorageService.getObjectEntityUploadURL();
          photoUrl = objectStorageService.normalizeObjectEntityPath(uploadUrlStr);
          await fetch(uploadUrlStr, {
            method: "PUT",
            headers: { "Content-Type": contentType, "Content-Length": String(buffer.length) },
            body: buffer,
          });
        }
      } catch (e) {
        req.log.warn({ err: e }, "Photo upload failed, pointage sans photo");
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    // Session du jour
    let sessionId: string | null = null;
    const [existingSession] = await db
      .select({ id: attendanceSessionsTable.id })
      .from(attendanceSessionsTable)
      .where(
        and(
          eq(attendanceSessionsTable.collaboratorId, collaboratorId),
          eq(attendanceSessionsTable.workDate, today),
        ),
      )
      .limit(1);

    if (existingSession) {
      sessionId = existingSession.id;
    } else if (kind === "clock_in") {
      const [newSession] = await db
        .insert(attendanceSessionsTable)
        .values({
          organizationId: kiosk.organizationId,
          collaboratorId,
          workDate: today,
          status: "open",
        })
        .returning({ id: attendanceSessionsTable.id });
      sessionId = newSession?.id ?? null;
    }

    const [record] = await db
      .insert(attendanceRecordsTable)
      .values({
        organizationId: kiosk.organizationId,
        collaboratorId,
        sessionId,
        kind,
        source: "kiosk",
        kioskId: kiosk.id,
        photoUrl,
        latitude: latitude != null ? String(latitude) : null,
        longitude: longitude != null ? String(longitude) : null,
        accuracyMeters: accuracyMeters != null ? Math.round(accuracyMeters) : null,
        occurredAt: new Date(),
        status: "validated",
      })
      .returning({
        id: attendanceRecordsTable.id,
        kind: attendanceRecordsTable.kind,
        occurredAt: attendanceRecordsTable.occurredAt,
      });

    res.json({
      success: true,
      recordId: record?.id,
      kind,
      occurredAt: record?.occurredAt,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// Admin router — monté après requireAuth
// ─────────────────────────────────────────────────────────────────
const kioskAdminRouter: IRouter = Router();

kioskAdminRouter.get("/kiosks", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const kiosks = await db
      .select({
        id: kiosksTable.id,
        organizationId: kiosksTable.organizationId,
        name: kiosksTable.name,
        location: kiosksTable.location,
        description: kiosksTable.description,
        departmentId: kiosksTable.departmentId,
        isActive: kiosksTable.isActive,
        token: kiosksTable.token,
        usageCount: kiosksTable.usageCount,
        revokedAt: kiosksTable.revokedAt,
        lastSeenAt: kiosksTable.lastSeenAt,
        createdAt: kiosksTable.createdAt,
        updatedAt: kiosksTable.updatedAt,
      })
      .from(kiosksTable)
      .where(eq(kiosksTable.organizationId, orgId))
      .orderBy(desc(kiosksTable.createdAt));
    res.json(kiosks);
  } catch (err) { next(err); }
});

kioskAdminRouter.post("/kiosks", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const schema = z.object({
      name: z.string().min(1),
      location: z.string().optional(),
      description: z.string().optional(),
      departmentId: z.string().uuid().nullable().optional(),
      settings: z.record(z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
    const [kiosk] = await db
      .insert(kiosksTable)
      .values({ organizationId: orgId, generatedByUserId: req.authUser!.id, ...parsed.data })
      .returning({
        id: kiosksTable.id,
        organizationId: kiosksTable.organizationId,
        name: kiosksTable.name,
        location: kiosksTable.location,
        description: kiosksTable.description,
        departmentId: kiosksTable.departmentId,
        isActive: kiosksTable.isActive,
        token: kiosksTable.token,
        usageCount: kiosksTable.usageCount,
        lastSeenAt: kiosksTable.lastSeenAt,
        createdAt: kiosksTable.createdAt,
        updatedAt: kiosksTable.updatedAt,
      });
    audit(req, "kiosk_create", {
      entityType: "kiosk",
      entityId: kiosk?.id,
      organizationId: orgId,
      payload: { name: parsed.data.name, location: parsed.data.location },
    }).catch(() => {});
    res.status(201).json(kiosk);
  } catch (err) { next(err); }
});

kioskAdminRouter.patch("/kiosks/:id", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const schema = z.object({
      name: z.string().min(1).optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      departmentId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
      settings: z.record(z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
    // Réactivation : effacer revokedAt et revokedByUserId pour restaurer l'accès complet
    const updateData = parsed.data.isActive === true
      ? { ...parsed.data, revokedAt: null, revokedByUserId: null }
      : parsed.data;
    const [kiosk] = await db
      .update(kiosksTable)
      .set(updateData)
      .where(and(eq(kiosksTable.id, req.params.id!), eq(kiosksTable.organizationId, orgId)))
      .returning({
        id: kiosksTable.id,
        organizationId: kiosksTable.organizationId,
        name: kiosksTable.name,
        location: kiosksTable.location,
        description: kiosksTable.description,
        departmentId: kiosksTable.departmentId,
        isActive: kiosksTable.isActive,
        token: kiosksTable.token,
        revokedAt: kiosksTable.revokedAt,
        lastSeenAt: kiosksTable.lastSeenAt,
        createdAt: kiosksTable.createdAt,
        updatedAt: kiosksTable.updatedAt,
      });
    if (!kiosk) { res.status(404).json({ error: "Kiosk non trouvé" }); return; }
    res.json(kiosk);
  } catch (err) { next(err); }
});

kioskAdminRouter.delete("/kiosks/:id", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const [deleted] = await db
      .delete(kiosksTable)
      .where(and(eq(kiosksTable.id, req.params.id!), eq(kiosksTable.organizationId, orgId)))
      .returning({ id: kiosksTable.id, name: kiosksTable.name });
    if (deleted) {
      audit(req, "kiosk_delete", {
        entityType: "kiosk",
        entityId: deleted.id,
        organizationId: orgId,
        payload: { name: deleted.name },
      }).catch(() => {});
    }
    res.status(204).end();
  } catch (err) { next(err); }
});

// POST /api/kiosks/:id/regenerate — Régénérer le token d'accès d'un kiosk
kioskAdminRouter.post("/kiosks/:id/regenerate", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const [kiosk] = await db
      .update(kiosksTable)
      .set({
        token: sql`gen_random_uuid()`,
        usageCount: 0,
        generatedByUserId: req.authUser!.id,
        revokedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(kiosksTable.id, req.params.id!), eq(kiosksTable.organizationId, orgId)))
      .returning({
        id: kiosksTable.id,
        organizationId: kiosksTable.organizationId,
        name: kiosksTable.name,
        location: kiosksTable.location,
        description: kiosksTable.description,
        isActive: kiosksTable.isActive,
        token: kiosksTable.token,
        usageCount: kiosksTable.usageCount,
        lastSeenAt: kiosksTable.lastSeenAt,
        createdAt: kiosksTable.createdAt,
        updatedAt: kiosksTable.updatedAt,
      });

    if (!kiosk) { res.status(404).json({ error: "Kiosk non trouvé" }); return; }

    audit(req, "kiosk_token_generate", {
      entityType: "kiosk",
      entityId: kiosk.id,
      organizationId: orgId,
      payload: { name: kiosk.name },
    }).catch(() => {});

    res.json(kiosk);
  } catch (err) { next(err); }
});

// POST /api/kiosks/:id/revoke — Révoquer explicitement le token (conserve la borne, invalide l'accès)
kioskAdminRouter.post("/kiosks/:id/revoke", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }

    const [kiosk] = await db
      .update(kiosksTable)
      .set({ isActive: false, revokedAt: new Date(), revokedByUserId: req.authUser!.id })
      .where(and(eq(kiosksTable.id, req.params.id!), eq(kiosksTable.organizationId, orgId)))
      .returning({
        id: kiosksTable.id,
        name: kiosksTable.name,
        isActive: kiosksTable.isActive,
        revokedAt: kiosksTable.revokedAt,
        revokedByUserId: kiosksTable.revokedByUserId,
      });

    if (!kiosk) { res.status(404).json({ error: "Kiosk non trouvé" }); return; }

    audit(req, "kiosk_token_revoke", {
      entityType: "kiosk",
      entityId: kiosk.id,
      organizationId: orgId,
      payload: { name: kiosk.name },
    }).catch(() => {});

    res.json(kiosk);
  } catch (err) { next(err); }
});

// ── T003 : Activité & statistiques kiosks ────────────────────────
kioskAdminRouter.get("/kiosks/activity", requirePermission("attendance.view"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const date = String(req.query["date"] ?? new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: "Format date invalide (YYYY-MM-DD)" }); return; }

    const kiosks = await db.select({
      id: kiosksTable.id, name: kiosksTable.name, location: kiosksTable.location,
      isActive: kiosksTable.isActive, lastSeenAt: kiosksTable.lastSeenAt,
    }).from(kiosksTable).where(eq(kiosksTable.organizationId, orgId));

    const startOfDay = new Date(date + "T00:00:00.000Z");
    const endOfDay = new Date(date + "T23:59:59.999Z");

    const records = await db.select({
      kioskId: attendanceRecordsTable.kioskId,
      collaboratorId: attendanceRecordsTable.collaboratorId,
      occurredAt: attendanceRecordsTable.occurredAt,
      kind: attendanceRecordsTable.kind,
    })
      .from(attendanceRecordsTable)
      .where(and(
        eq(attendanceRecordsTable.organizationId, orgId),
        eq(attendanceRecordsTable.source, "kiosk"),
        gte(attendanceRecordsTable.occurredAt, startOfDay),
        lte(attendanceRecordsTable.occurredAt, endOfDay),
      ));

    const statsMap = new Map<string, { punchCount: number; uniqueEmployees: Set<string>; lastPunchAt: Date | null }>();
    for (const r of records) {
      if (!r.kioskId) continue;
      const s = statsMap.get(r.kioskId) ?? { punchCount: 0, uniqueEmployees: new Set(), lastPunchAt: null };
      s.punchCount++;
      s.uniqueEmployees.add(r.collaboratorId);
      if (!s.lastPunchAt || (r.occurredAt && r.occurredAt > s.lastPunchAt)) s.lastPunchAt = r.occurredAt;
      statsMap.set(r.kioskId, s);
    }

    const totalPunches = records.length;
    const uniqueEmployees = new Set(records.filter(r => r.kioskId).map(r => r.collaboratorId)).size;

    const kioskStats = kiosks.map(k => ({
      ...k,
      punchCount: statsMap.get(k.id)?.punchCount ?? 0,
      uniqueEmployees: statsMap.get(k.id)?.uniqueEmployees.size ?? 0,
      lastPunchAt: statsMap.get(k.id)?.lastPunchAt ?? null,
    }));

    res.json({ date, summary: { totalPunches, uniqueEmployees, activeKiosks: kiosks.filter(k => k.isActive).length }, kiosks: kioskStats });
  } catch (err) { next(err); }
});

// PATCH /api/collaborators/:id/kiosk-code — Assigner un code kiosk
kioskAdminRouter.patch("/collaborators/:id/kiosk-code", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const schema = z.object({ kioskCode: z.string().length(4).regex(/^\d{4}$/).nullable() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Code invalide (4 chiffres requis)" }); return; }
    const [updated] = await db
      .update(collaboratorsTable)
      .set({ kioskCode: parsed.data.kioskCode })
      .where(and(eq(collaboratorsTable.id, req.params.id!), eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)))
      .returning({ id: collaboratorsTable.id, kioskCode: collaboratorsTable.kioskCode });
    if (!updated) { res.status(404).json({ error: "Collaborateur non trouvé" }); return; }
    res.json(updated);
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// KIOSK TOKENS — Gestion des liens d'accès hachés (kiosk_tokens)
// ══════════════════════════════════════════════════════════════════

// POST /api/kiosk/tokens — Créer un token haché pour un kiosk
kioskAdminRouter.post("/kiosk/tokens", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const schema = z.object({
      kioskId: z.string().uuid(),
      label: z.string().min(1).max(100),
      departmentId: z.string().uuid().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
    const [kiosk] = await db.select({ id: kiosksTable.id, name: kiosksTable.name })
      .from(kiosksTable)
      .where(and(eq(kiosksTable.id, parsed.data.kioskId), eq(kiosksTable.organizationId, orgId)))
      .limit(1);
    if (!kiosk) { res.status(404).json({ error: "Kiosk non trouvé" }); return; }
    const { raw, hash } = generateToken();
    const [tokenRow] = await db.insert(kioskTokensTable).values({
      organizationId: orgId,
      kioskId: kiosk.id,
      rawToken: raw,
      tokenHash: hash,
      label: parsed.data.label,
      departmentId: parsed.data.departmentId ?? null,
      isActive: true,
      generatedByUserId: req.authUser!.id,
    }).returning({
      id: kioskTokensTable.id,
      kioskId: kioskTokensTable.kioskId,
      rawToken: kioskTokensTable.rawToken,
      label: kioskTokensTable.label,
      departmentId: kioskTokensTable.departmentId,
      isActive: kioskTokensTable.isActive,
      usageCount: kioskTokensTable.usageCount,
      lastUsedAt: kioskTokensTable.lastUsedAt,
      revokedAt: kioskTokensTable.revokedAt,
      createdAt: kioskTokensTable.createdAt,
    });
    audit(req, "kiosk_token_generate", {
      entityType: "kiosk", entityId: kiosk.id, organizationId: orgId,
      payload: { kioskName: kiosk.name, tokenLabel: parsed.data.label },
    }).catch(() => {});
    res.status(201).json(tokenRow);
  } catch (err) { next(err); }
});

// GET /api/kiosk/tokens — Lister les tokens d'accès de l'organisation
kioskAdminRouter.get("/kiosk/tokens", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const kioskId = typeof req.query["kioskId"] === "string" ? req.query["kioskId"] : undefined;
    const conds: ReturnType<typeof eq>[] = [eq(kioskTokensTable.organizationId, orgId)];
    if (kioskId) conds.push(eq(kioskTokensTable.kioskId, kioskId));
    const tokens = await db.select({
      id: kioskTokensTable.id,
      kioskId: kioskTokensTable.kioskId,
      rawToken: kioskTokensTable.rawToken,
      label: kioskTokensTable.label,
      departmentId: kioskTokensTable.departmentId,
      isActive: kioskTokensTable.isActive,
      usageCount: kioskTokensTable.usageCount,
      lastUsedAt: kioskTokensTable.lastUsedAt,
      revokedAt: kioskTokensTable.revokedAt,
      createdAt: kioskTokensTable.createdAt,
    }).from(kioskTokensTable).where(and(...conds)).orderBy(desc(kioskTokensTable.createdAt));
    res.json(tokens);
  } catch (err) { next(err); }
});

// PATCH /api/kiosk/tokens/:id — Modifier label / département / isActive
kioskAdminRouter.patch("/kiosk/tokens/:id", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const schema = z.object({
      label: z.string().min(1).max(100).optional(),
      departmentId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
    const updateData = parsed.data.isActive === true
      ? { ...parsed.data, revokedAt: null, revokedByUserId: null }
      : parsed.data;
    const [tokenRow] = await db.update(kioskTokensTable)
      .set(updateData)
      .where(and(eq(kioskTokensTable.id, req.params.id!), eq(kioskTokensTable.organizationId, orgId)))
      .returning({
        id: kioskTokensTable.id, kioskId: kioskTokensTable.kioskId,
        label: kioskTokensTable.label, departmentId: kioskTokensTable.departmentId,
        isActive: kioskTokensTable.isActive, usageCount: kioskTokensTable.usageCount,
        revokedAt: kioskTokensTable.revokedAt,
      });
    if (!tokenRow) { res.status(404).json({ error: "Token non trouvé" }); return; }
    res.json(tokenRow);
  } catch (err) { next(err); }
});

// DELETE /api/kiosk/tokens/:id — Supprimer un token
kioskAdminRouter.delete("/kiosk/tokens/:id", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const [deleted] = await db.delete(kioskTokensTable)
      .where(and(eq(kioskTokensTable.id, req.params.id!), eq(kioskTokensTable.organizationId, orgId)))
      .returning({ id: kioskTokensTable.id, label: kioskTokensTable.label });
    if (!deleted) { res.status(404).json({ error: "Token non trouvé" }); return; }
    audit(req, "kiosk_token_revoke", {
      entityType: "kiosk", organizationId: orgId, payload: { tokenLabel: deleted.label },
    }).catch(() => {});
    res.status(204).end();
  } catch (err) { next(err); }
});

// POST /api/kiosk/tokens/:id/regenerate — Régénérer le hash (invalide l'ancien token)
kioskAdminRouter.post("/kiosk/tokens/:id/regenerate", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const [existing] = await db.select({ id: kioskTokensTable.id, kioskId: kioskTokensTable.kioskId, label: kioskTokensTable.label })
      .from(kioskTokensTable)
      .where(and(eq(kioskTokensTable.id, req.params.id!), eq(kioskTokensTable.organizationId, orgId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Token non trouvé" }); return; }
    const { raw, hash } = generateToken();
    const [tokenRow] = await db.update(kioskTokensTable)
      .set({ rawToken: raw, tokenHash: hash, isActive: true, revokedAt: null, revokedByUserId: null, usageCount: 0, generatedByUserId: req.authUser!.id })
      .where(eq(kioskTokensTable.id, existing.id))
      .returning({
        id: kioskTokensTable.id, kioskId: kioskTokensTable.kioskId,
        rawToken: kioskTokensTable.rawToken, label: kioskTokensTable.label,
        departmentId: kioskTokensTable.departmentId, isActive: kioskTokensTable.isActive,
        usageCount: kioskTokensTable.usageCount, revokedAt: kioskTokensTable.revokedAt, createdAt: kioskTokensTable.createdAt,
      });
    audit(req, "kiosk_token_generate", {
      entityType: "kiosk", entityId: existing.kioskId, organizationId: orgId,
      payload: { tokenLabel: existing.label },
    }).catch(() => {});
    res.json(tokenRow);
  } catch (err) { next(err); }
});

// POST /api/kiosk/tokens/:id/revoke — Révoquer explicitement un token
kioskAdminRouter.post("/kiosk/tokens/:id/revoke", requirePermission("attendance.manage_settings"), async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const [tokenRow] = await db.update(kioskTokensTable)
      .set({ isActive: false, revokedAt: new Date(), revokedByUserId: req.authUser!.id })
      .where(and(eq(kioskTokensTable.id, req.params.id!), eq(kioskTokensTable.organizationId, orgId)))
      .returning({
        id: kioskTokensTable.id, label: kioskTokensTable.label, kioskId: kioskTokensTable.kioskId,
        isActive: kioskTokensTable.isActive, revokedAt: kioskTokensTable.revokedAt,
      });
    if (!tokenRow) { res.status(404).json({ error: "Token non trouvé" }); return; }
    audit(req, "kiosk_token_revoke", {
      entityType: "kiosk", entityId: tokenRow.kioskId, organizationId: orgId,
      payload: { tokenLabel: tokenRow.label },
    }).catch(() => {});
    res.json(tokenRow);
  } catch (err) { next(err); }
});

export default kioskAdminRouter;
