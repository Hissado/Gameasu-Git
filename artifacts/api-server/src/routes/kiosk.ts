import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  collaboratorsTable,
  kiosksTable,
  attendanceRecordsTable,
  attendanceSessionsTable,
} from "@workspace/db";
import { and, eq, isNull, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { getCurrentOrganizationId } from "../lib/tenant";
import { ObjectStorageService } from "../lib/objectStorage";

// ─────────────────────────────────────────────────────────────────
// Public router — monté avant requireAuth
// ─────────────────────────────────────────────────────────────────
export const kioskPublicRouter: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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
      .where(and(eq(kiosksTable.token, kioskToken), eq(kiosksTable.isActive, true)))
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
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides" });
      return;
    }

    const { kioskToken, collaboratorId, kind, photoDataUrl } = parsed.data;

    const [kiosk] = await db
      .select({
        id: kiosksTable.id,
        organizationId: kiosksTable.organizationId,
        isActive: kiosksTable.isActive,
      })
      .from(kiosksTable)
      .where(and(eq(kiosksTable.token, kioskToken), eq(kiosksTable.isActive, true)))
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
      .values({ organizationId: orgId, ...parsed.data })
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
    await db
      .delete(kiosksTable)
      .where(and(eq(kiosksTable.id, req.params.id!), eq(kiosksTable.organizationId, orgId)));
    res.status(204).end();
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
