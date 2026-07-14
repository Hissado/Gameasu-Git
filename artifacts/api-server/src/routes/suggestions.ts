import { Router } from "express";
import { db, productSuggestionsTable, suggestionEventsTable, usersTable, organizationsTable } from "@workspace/db";
import { eq, and, desc, count, ilike, or, sql } from "drizzle-orm";
import { emitToSuperAdmins, emitToOrg } from "../lib/realtime";

const router = Router();

const VALID_STATUSES = [
  "nouvelle", "en_analyse", "acceptee", "planifiee", "en_developpement", "livree", "rejetee",
] as const;

const VALID_CATEGORIES = [
  "fonctionnalite", "ux", "performance", "bug", "rapport", "nouveau_module", "autre",
] as const;

const VALID_PRIORITIES = ["faible", "normale", "haute", "critique"] as const;

function isSuperAdmin(req: any): boolean {
  return req.authUser?.role === "super_admin";
}

// ── POST /api/suggestions — créer une suggestion ────────────────────────────

router.post("/api/suggestions", async (req, res, next) => {
  try {
    const user = req.authUser!;
    const body = req.body as {
      title?: string;
      category?: string;
      description?: string;
      priority?: string;
      module?: string;
      screenshotUrl?: string;
      currentUrl?: string;
    };

    if (!body.title?.trim()) {
      return res.status(400).json({ error: "Le titre est obligatoire" });
    }

    const category = VALID_CATEGORIES.includes(body.category as any) ? body.category! : "autre";
    const priority = VALID_PRIORITIES.includes(body.priority as any) ? body.priority! : "normale";
    const userAgent = req.headers["user-agent"] ?? null;
    const currentUrl = body.currentUrl ?? null;

    // Store metadata as JSON: browser user-agent + current page URL
    const browserInfo = userAgent;
    const deviceInfo = JSON.stringify({
      url: currentUrl,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    const [row] = await db
      .insert(productSuggestionsTable)
      .values({
        organizationId: user.organizationId,
        userId: user.id,
        title: body.title.trim(),
        category,
        description: body.description?.trim() ?? null,
        priority,
        module: body.module ?? null,
        browserInfo,
        screenshotUrl: body.screenshotUrl ?? null,
        deviceInfo,
      })
      .returning();

    // Notify super-admins only (no org data leaked to other tenants)
    emitToSuperAdmins("suggestion:new", {
      id: row.id,
      title: row.title,
      category: row.category,
      priority: row.priority,
      organizationId: row.organizationId,
    });

    return res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/suggestions — liste des suggestions ─────────────────────────────
// myOnly=true → filtre par userId courant (Mes suggestions)
// myOnly=false/absent → toutes les suggestions de l'organisation

router.get("/api/suggestions", async (req, res, next) => {
  try {
    const user = req.authUser!;
    const { status, category, page = "1", limit = "20", search, myOnly } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(productSuggestionsTable.organizationId, user.organizationId)];

    if (myOnly === "true") {
      conditions.push(eq(productSuggestionsTable.userId, user.id));
    }

    if (status && VALID_STATUSES.includes(status as any)) {
      conditions.push(eq(productSuggestionsTable.status, status));
    }
    if (category && VALID_CATEGORIES.includes(category as any)) {
      conditions.push(eq(productSuggestionsTable.category, category));
    }
    if (search?.trim()) {
      conditions.push(
        or(
          ilike(productSuggestionsTable.title, `%${search.trim()}%`),
          ilike(productSuggestionsTable.description, `%${search.trim()}%`),
        )!,
      );
    }

    const where = and(...conditions);

    const [{ total }] = await db
      .select({ total: count() })
      .from(productSuggestionsTable)
      .where(where);

    const rows = await db
      .select({
        id: productSuggestionsTable.id,
        title: productSuggestionsTable.title,
        category: productSuggestionsTable.category,
        description: productSuggestionsTable.description,
        priority: productSuggestionsTable.priority,
        status: productSuggestionsTable.status,
        module: productSuggestionsTable.module,
        screenshotUrl: productSuggestionsTable.screenshotUrl,
        createdAt: productSuggestionsTable.createdAt,
        updatedAt: productSuggestionsTable.updatedAt,
        userId: productSuggestionsTable.userId,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
      })
      .from(productSuggestionsTable)
      .leftJoin(usersTable, eq(productSuggestionsTable.userId, usersTable.id))
      .where(where)
      .orderBy(desc(productSuggestionsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    return res.json({
      data: rows,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /api/suggestions/:id — détail + événements ───────────────────────────

router.get("/api/suggestions/:id", async (req, res, next) => {
  try {
    const user = req.authUser!;
    const { id } = req.params as { id: string };

    const [row] = await db
      .select()
      .from(productSuggestionsTable)
      .where(
        and(
          eq(productSuggestionsTable.id, id),
          eq(productSuggestionsTable.organizationId, user.organizationId),
        ),
      )
      .limit(1);

    if (!row) return res.status(404).json({ error: "Suggestion introuvable" });

    const events = await db
      .select({
        id: suggestionEventsTable.id,
        fromStatus: suggestionEventsTable.fromStatus,
        toStatus: suggestionEventsTable.toStatus,
        comment: suggestionEventsTable.comment,
        authorId: suggestionEventsTable.authorId,
        createdAt: suggestionEventsTable.createdAt,
        authorFirstName: usersTable.firstName,
        authorLastName: usersTable.lastName,
      })
      .from(suggestionEventsTable)
      .leftJoin(usersTable, eq(suggestionEventsTable.authorId, usersTable.id))
      .where(eq(suggestionEventsTable.suggestionId, id))
      .orderBy(desc(suggestionEventsTable.createdAt));

    return res.json({ ...row, events });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/suggestions/:id/status — changer le statut (super-admin) ──────

router.patch("/api/suggestions/:id/status", async (req, res, next) => {
  try {
    const user = req.authUser!;
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Réservé aux super-administrateurs" });
    }

    const { id } = req.params as { id: string };
    const { status, comment } = req.body as { status?: string; comment?: string };

    if (!status || !VALID_STATUSES.includes(status as any)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    const [existing] = await db
      .select({ id: productSuggestionsTable.id, status: productSuggestionsTable.status })
      .from(productSuggestionsTable)
      .where(eq(productSuggestionsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Suggestion introuvable" });

    const [updated] = await db
      .update(productSuggestionsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(productSuggestionsTable.id, id))
      .returning();

    await db.insert(suggestionEventsTable).values({
      suggestionId: id,
      fromStatus: existing.status,
      toStatus: status,
      comment: comment?.trim() ?? null,
      authorId: user.id,
    });

    return res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/super-admin/suggestions ─────────────────────────────────────────

router.get("/api/super-admin/suggestions", async (req, res, next) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Réservé aux super-administrateurs" });
    }

    const {
      status, category, priority, organizationId,
      page = "1", limit = "25", search,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const offset = (pageNum - 1) * limitNum;

    const conditions: ReturnType<typeof eq>[] = [];

    if (status && VALID_STATUSES.includes(status as any)) {
      conditions.push(eq(productSuggestionsTable.status, status));
    }
    if (category && VALID_CATEGORIES.includes(category as any)) {
      conditions.push(eq(productSuggestionsTable.category, category));
    }
    if (priority && VALID_PRIORITIES.includes(priority as any)) {
      conditions.push(eq(productSuggestionsTable.priority, priority));
    }
    if (organizationId) {
      conditions.push(eq(productSuggestionsTable.organizationId, organizationId));
    }
    if (search?.trim()) {
      conditions.push(
        or(
          ilike(productSuggestionsTable.title, `%${search.trim()}%`),
          ilike(productSuggestionsTable.description, `%${search.trim()}%`),
        )! as any,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(productSuggestionsTable)
      .where(where);

    const rows = await db
      .select({
        id: productSuggestionsTable.id,
        organizationId: productSuggestionsTable.organizationId,
        title: productSuggestionsTable.title,
        category: productSuggestionsTable.category,
        description: productSuggestionsTable.description,
        priority: productSuggestionsTable.priority,
        status: productSuggestionsTable.status,
        module: productSuggestionsTable.module,
        screenshotUrl: productSuggestionsTable.screenshotUrl,
        createdAt: productSuggestionsTable.createdAt,
        updatedAt: productSuggestionsTable.updatedAt,
        userId: productSuggestionsTable.userId,
        assignedTo: productSuggestionsTable.assignedTo,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        orgName: organizationsTable.name,
      })
      .from(productSuggestionsTable)
      .leftJoin(usersTable, eq(productSuggestionsTable.userId, usersTable.id))
      .leftJoin(organizationsTable, eq(productSuggestionsTable.organizationId, organizationsTable.id))
      .where(where)
      .orderBy(desc(productSuggestionsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    return res.json({ data: rows, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /api/super-admin/suggestions/:id/status ─────────────────────────────

router.patch("/api/super-admin/suggestions/:id/status", async (req, res, next) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Réservé aux super-administrateurs" });
    }

    const { id } = req.params as { id: string };
    const { status, comment, assignedTo } = req.body as {
      status?: string;
      comment?: string;
      assignedTo?: string | null;
    };

    if (!status || !VALID_STATUSES.includes(status as any)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    const [existing] = await db
      .select({ id: productSuggestionsTable.id, status: productSuggestionsTable.status })
      .from(productSuggestionsTable)
      .where(eq(productSuggestionsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Suggestion introuvable" });

    const updateFields: Partial<typeof productSuggestionsTable.$inferInsert> = {
      status: status as any,
      updatedAt: new Date(),
    };
    if (assignedTo !== undefined) {
      (updateFields as any).assignedTo = assignedTo || null;
    }

    const [updated] = await db
      .update(productSuggestionsTable)
      .set(updateFields)
      .where(eq(productSuggestionsTable.id, id))
      .returning();

    await db.insert(suggestionEventsTable).values({
      suggestionId: id,
      fromStatus: existing.status,
      toStatus: status,
      comment: comment?.trim() ?? null,
      authorId: req.authUser!.id,
    });

    // Notify the suggestion's org + super-admins (scoped, no cross-tenant leakage)
    emitToOrg(updated.organizationId, "suggestion:updated", { id, status });
    emitToSuperAdmins("suggestion:updated", { id, status, organizationId: updated.organizationId });

    return res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ── GET /api/super-admin/suggestions/stats ────────────────────────────────────

router.get("/api/super-admin/suggestions/stats", async (req, res, next) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Réservé aux super-administrateurs" });
    }

    const [byStatus, byCategory, byPriority, totals, byOrg, byMonth] = await Promise.all([
      db.select({ status: productSuggestionsTable.status, count: count() })
        .from(productSuggestionsTable)
        .groupBy(productSuggestionsTable.status),
      db.select({ category: productSuggestionsTable.category, count: count() })
        .from(productSuggestionsTable)
        .groupBy(productSuggestionsTable.category),
      db.select({ priority: productSuggestionsTable.priority, count: count() })
        .from(productSuggestionsTable)
        .groupBy(productSuggestionsTable.priority),
      db.select({ total: count() }).from(productSuggestionsTable),
      db.select({
          orgId: productSuggestionsTable.organizationId,
          orgName: organizationsTable.name,
          count: count(),
        })
        .from(productSuggestionsTable)
        .leftJoin(organizationsTable, eq(productSuggestionsTable.organizationId, organizationsTable.id))
        .groupBy(productSuggestionsTable.organizationId, organizationsTable.name)
        .orderBy(desc(count()))
        .limit(10),
      // Tendances par mois (6 derniers mois)
      db.execute(sql`
        SELECT
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
          count(*)::int AS count
        FROM product_suggestions
        WHERE created_at >= now() - interval '6 months'
        GROUP BY month
        ORDER BY month ASC
      `),
    ]);

    const [{ total }] = totals;
    const pending = byStatus.find((r) => r.status === "nouvelle")?.count ?? 0;

    return res.json({
      total,
      pending,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.count])),
      byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r.count])),
      byOrg: byOrg.map((r) => ({ orgId: r.orgId, orgName: r.orgName ?? r.orgId, count: r.count })),
      byMonth: (byMonth.rows as { month: string; count: number }[]).map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
