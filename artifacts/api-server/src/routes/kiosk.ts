import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  collaboratorsTable,
  kiosksTable,
  attendanceRecordsTable,
  attendanceSessionsTable,
} from "@workspace/db";
import { and, eq, isNull, desc, gte, lte, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { getCurrentOrganizationId } from "../lib/tenant";
import { ObjectStorageService } from "../lib/objectStorage";
import { audit } from "../lib/audit";

// ─────────────────────────────────────────────────────────────────
// Public router — monté avant requireAuth
// ─────────────────────────────────────────────────────────────────
export const kioskPublicRouter: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// GET /api/kiosk/validate/:token — Valider un token kiosk au démarrage (public)
kioskPublicRouter.get("/kiosk/validate/:token", async (req: Request, res: Response, next) => {
  try {
    const { token } = req.params;
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      res.status(400).json({ error: "Format de token invalide" });
      return;
    }

    const [kiosk] = await db
      .select({
        id: kiosksTable.id,
        name: kiosksTable.name,
        location: kiosksTable.location,
        organizationId: kiosksTable.organizationId,
        isActive: kiosksTable.isActive,
        revokedAt: kiosksTable.revokedAt,
        settings: kiosksTable.settings,
      })
      .from(kiosksTable)
      .where(and(eq(kiosksTable.token, token), eq(kiosksTable.isActive, true), isNull(kiosksTable.revokedAt)))
      .limit(1);

    if (!kiosk) {
      res.status(403).json({ error: "Token invalide ou kiosk désactivé" });
      return;
    }

    // Incrémenter le compteur d'utilisation et mettre à jour lastSeenAt
    await db
      .update(kiosksTable)
      .set({
        lastSeenAt: new Date(),
        usageCount: sql`${kiosksTable.usageCount} + 1`,
      })
      .where(eq(kiosksTable.id, kiosk.id));

    // Journal d'audit non bloquant
    audit(req, "kiosk_token_access", {
      entityType: "kiosk",
      entityId: kiosk.id,
      organizationId: kiosk.organizationId,
      payload: { kioskName: kiosk.name },
    }).catch(() => {});

    res.json({
      id: kiosk.id,
      name: kiosk.name,
      location: kiosk.location,
      organizationId: kiosk.organizationId,
      settings: kiosk.settings ?? {},
    });
  } catch (err) { next(err); }
});

// POST /api/kiosk/identify — Identifier un collaborateur par code + token kiosk
kioskPublicRouter.post("/kiosk/identify", async (req: Request, res: Response, next) => {
  try {
    const schema = z.object({
      code: z.string().length(4).regex(/^\d{4}$/),
      kioskToken: z.string().uuid(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Code ou token invalide" });
      return;
    }

    const { code, kioskToken } = parsed.data;

    const kiosks = await db
      .select({
        id: kiosksTable.id,
        name: kiosksTable.name,
        location: kiosksTable.location,
        organizationId: kiosksTable.organizationId,
        isActive: kiosksTable.isActive,
      })
      .from(kiosksTable)
      .where(and(eq(kiosksTable.token, kioskToken), eq(kiosksTable.isActive, true), isNull(kiosksTable.revokedAt)))
      .limit(1);

    const kiosk = kiosks[0];

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
      kioskToken: z.string().uuid(),
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

    const [kiosk] = await db
      .select({
        id: kiosksTable.id,
        organizationId: kiosksTable.organizationId,
        isActive: kiosksTable.isActive,
      })
      .from(kiosksTable)
      .where(and(eq(kiosksTable.token, kioskToken), eq(kiosksTable.isActive, true), isNull(kiosksTable.revokedAt)))
      .limit(1);

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

kioskAdminRouter.get("/kiosks", async (req: Request, res: Response, next) => {
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

kioskAdminRouter.post("/kiosks", async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const schema = z.object({
      name: z.string().min(1),
      location: z.string().optional(),
      description: z.string().optional(),
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

kioskAdminRouter.patch("/kiosks/:id", async (req: Request, res: Response, next) => {
  try {
    const orgId = await getCurrentOrganizationId(req.authUser!.id);
    if (!orgId) { res.status(403).json({ error: "Organisation introuvable" }); return; }
    const schema = z.object({
      name: z.string().min(1).optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      settings: z.record(z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
    const [kiosk] = await db
      .update(kiosksTable)
      .set(parsed.data)
      .where(and(eq(kiosksTable.id, req.params.id!), eq(kiosksTable.organizationId, orgId)))
      .returning({
        id: kiosksTable.id,
        organizationId: kiosksTable.organizationId,
        name: kiosksTable.name,
        location: kiosksTable.location,
        description: kiosksTable.description,
        isActive: kiosksTable.isActive,
        token: kiosksTable.token,
        lastSeenAt: kiosksTable.lastSeenAt,
        createdAt: kiosksTable.createdAt,
        updatedAt: kiosksTable.updatedAt,
      });
    if (!kiosk) { res.status(404).json({ error: "Kiosk non trouvé" }); return; }
    res.json(kiosk);
  } catch (err) { next(err); }
});

kioskAdminRouter.delete("/kiosks/:id", async (req: Request, res: Response, next) => {
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
kioskAdminRouter.post("/kiosks/:id/regenerate", async (req: Request, res: Response, next) => {
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
kioskAdminRouter.post("/kiosks/:id/revoke", async (req: Request, res: Response, next) => {
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
kioskAdminRouter.get("/kiosks/activity", async (req: Request, res: Response, next) => {
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
kioskAdminRouter.patch("/collaborators/:id/kiosk-code", async (req: Request, res: Response, next) => {
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

export default kioskAdminRouter;
