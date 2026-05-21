/**
 * Phase 11 — Notifications IA (digest intelligent).
 *  - GET  /api/notifications/digest?window=day|week
 *  - POST /api/notifications/digest/mark-read  { ids?: string[]; type?: string }
 *
 * Regroupe les notifications non lues de l'utilisateur courant par type/entité,
 * priorise par fréquence + ancienneté, et propose une vue agrégée (pas un mur
 * d'alertes plat).
 */
import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { and, eq, gte, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

const TYPE_LABELS: Record<string, string> = {
  info: "Informations",
  alert: "Alertes",
  warning: "Avertissements",
  success: "Confirmations",
  task: "Tâches",
  invoice: "Factures",
  payment: "Paiements",
  message: "Messages",
  mention: "Mentions",
  intelligence: "Intelligence IA",
  reminder: "Rappels",
};

const SEVERITY_BY_TYPE: Record<string, number> = {
  alert: 3, warning: 2, mention: 2, payment: 2, invoice: 2,
  task: 1, message: 1, reminder: 1, intelligence: 1,
  info: 0, success: 0,
};

router.get("/notifications/digest", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const window = req.query["window"] === "week" ? "week" : "day";
    const sinceMs = Date.now() - (window === "week" ? 7 : 1) * 86_400_000;
    const since = new Date(sinceMs);

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, userId),
        gte(notificationsTable.createdAt, since),
      ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(500);

    const total = rows.length;
    const unread = rows.filter((n) => n.isRead !== "true");
    const unreadCount = unread.length;

    // Regroupement par type + entityType pour éviter la surcharge.
    const groupMap = new Map<string, {
      type: string;
      entityType: string | null;
      label: string;
      count: number;
      unread: number;
      latestAt: Date;
      severity: number;
      samples: typeof rows;
    }>();

    for (const n of rows) {
      const key = `${n.type}::${n.entityType ?? ""}`;
      const isUnread = n.isRead !== "true";
      let g = groupMap.get(key);
      if (!g) {
        g = {
          type: n.type,
          entityType: n.entityType,
          label: TYPE_LABELS[n.type] ?? n.type,
          count: 0,
          unread: 0,
          latestAt: n.createdAt,
          severity: SEVERITY_BY_TYPE[n.type] ?? 0,
          samples: [],
        };
        groupMap.set(key, g);
      }
      g.count++;
      if (isUnread) g.unread++;
      if (n.createdAt > g.latestAt) g.latestAt = n.createdAt;
      if (g.samples.length < 5 && isUnread) g.samples.push(n);
    }

    const now = Date.now();
    const groups = Array.from(groupMap.values()).map((g) => {
      const ageH = Math.max(0.5, (now - g.latestAt.getTime()) / 3_600_000);
      // Score priorité 0..100 : 50% sévérité + 30% volume non-lu + 20% fraîcheur
      const sevScore = Math.min(50, g.severity * 16);
      const volScore = Math.min(30, Math.log2(g.unread + 1) * 10);
      const freshScore = Math.min(20, 20 / Math.max(1, ageH / 6));
      const priority = Math.round(sevScore + volScore + freshScore);
      return { ...g, priority };
    }).sort((a, b) => b.priority - a.priority || b.unread - a.unread);

    // Top-3 highlights : éléments individuels marquants (alerte/mention/payment urgent).
    const highlights = unread
      .filter((n) => (SEVERITY_BY_TYPE[n.type] ?? 0) >= 2)
      .slice(0, 3);

    return res.json({
      window,
      total,
      unread: unreadCount,
      groups: groups.map((g) => ({
        key: `${g.type}::${g.entityType ?? ""}`,
        type: g.type,
        entityType: g.entityType,
        label: g.label,
        count: g.count,
        unread: g.unread,
        latestAt: g.latestAt,
        priority: g.priority,
        samples: g.samples.map((s) => ({
          id: s.id, title: s.title, body: s.body,
          entityType: s.entityType, entityId: s.entityId,
          createdAt: s.createdAt,
        })),
      })),
      highlights: highlights.map((h) => ({
        id: h.id, title: h.title, body: h.body, type: h.type,
        entityType: h.entityType, entityId: h.entityId, createdAt: h.createdAt,
      })),
    });
  } catch (e) { next(e); }
});

const markBodySchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  type: z.string().optional(),
  entityType: z.string().optional(),
});

router.post("/notifications/digest/mark-read", async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const parsed = markBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });
    const { ids, type, entityType } = parsed.data;

    if (!ids?.length && !type) return res.status(400).json({ error: "ids_or_type_required" });

    const conds = [eq(notificationsTable.userId, userId)];
    if (ids?.length) conds.push(inArray(notificationsTable.id, ids));
    if (type) conds.push(eq(notificationsTable.type, type));
    if (entityType) conds.push(eq(notificationsTable.entityType, entityType));

    const result = await db
      .update(notificationsTable)
      .set({ isRead: "true" })
      .where(and(...conds))
      .returning({ id: notificationsTable.id });

    return res.json({ updated: result.length });
  } catch (e) { next(e); }
});

export default router;
