import { Router } from "express";
import { db, ticketsTable, usersTable } from "@workspace/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin, requireManagerOrAbove } from "../middlewares/auth";

const router = Router();

const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TICKET_CATEGORIES = ["bug", "request", "incident", "question", "other"] as const;

router.get("/tickets", async (req, res) => {
  const { search = "", status = "", priority = "", assigneeId = "", mine = "" } = req.query as Record<string, string>;
  const conds: any[] = [];
  if (search) conds.push(or(ilike(ticketsTable.subject, `%${search}%`), ilike(ticketsTable.description, `%${search}%`)));
  if (status) conds.push(eq(ticketsTable.status, status));
  if (priority) conds.push(eq(ticketsTable.priority, priority));
  if (assigneeId) conds.push(eq(ticketsTable.assigneeId, assigneeId));
  if (mine === "true" && req.authUser) conds.push(eq(ticketsTable.createdById, req.authUser.id));

  const rows = await db
    .select({
      ticket: ticketsTable,
      createdBy: { id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email },
    })
    .from(ticketsTable)
    .leftJoin(usersTable, eq(usersTable.id, ticketsTable.createdById))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(ticketsTable.createdAt))
    .limit(200);

  const data = rows.map((r) => ({ ...r.ticket, createdBy: r.createdBy }));
  return res.json({ data });
});

router.get("/tickets/stats", async (_req, res) => {
  const rows = await db
    .select({ status: ticketsTable.status, count: sql<number>`count(*)::int` })
    .from(ticketsTable)
    .groupBy(ticketsTable.status);
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));
  const total = rows.reduce((s, r) => s + r.count, 0);
  return res.json({ total, byStatus });
});

router.get("/tickets/:id", async (req, res) => {
  const [t] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, req.params.id)).limit(1);
  if (!t) return res.status(404).json({ error: "Ticket introuvable" });
  return res.json(t);
});

router.post("/tickets", async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;
    if (!subject || subject.trim().length < 3) return res.status(400).json({ error: "Sujet requis (≥ 3 caractères)" });
    const cat = TICKET_CATEGORIES.includes(category) ? category : "other";
    const prio = TICKET_PRIORITIES.includes(priority) ? priority : "medium";
    const [t] = await db
      .insert(ticketsTable)
      .values({
        subject: subject.trim(),
        description: description?.trim() || null,
        category: cat,
        priority: prio,
        status: "open",
        createdById: req.authUser?.id,
      })
      .returning();
    return res.status(201).json(t);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// Tout utilisateur authentifié peut mettre à jour le sujet/description de SES tickets ouverts.
// Seuls manager+/admin peuvent changer status, priority, category, assignee.
router.put("/tickets/:id", async (req, res) => {
  try {
    const { subject, description, category, priority, status, assigneeId } = req.body;
    const [existing] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, req.params.id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Ticket introuvable" });

    const role = req.authUser?.role;
    const isManagerOrAbove = role === "manager" || role === "admin" || role === "super_admin";
    const isOwner = existing.createdById === req.authUser?.id;

    const wantsManagerFields =
      category !== undefined || priority !== undefined || status !== undefined || assigneeId !== undefined;

    if (wantsManagerFields && !isManagerOrAbove) {
      return res.status(403).json({ error: "Cette action requiert un rôle manager ou supérieur" });
    }
    if (!wantsManagerFields && !isManagerOrAbove && !isOwner) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres tickets" });
    }

    const patch: any = {};
    if (subject !== undefined) {
      const s = String(subject).trim();
      if (s.length < 3) return res.status(400).json({ error: "Sujet invalide (≥ 3 caractères)" });
      patch.subject = s;
    }
    if (description !== undefined) patch.description = description ? String(description).trim() : null;
    if (category !== undefined) {
      if (!TICKET_CATEGORIES.includes(category)) return res.status(400).json({ error: "Catégorie invalide" });
      patch.category = category;
    }
    if (priority !== undefined) {
      if (!TICKET_PRIORITIES.includes(priority)) return res.status(400).json({ error: "Priorité invalide" });
      patch.priority = priority;
    }
    if (status !== undefined) {
      if (!TICKET_STATUSES.includes(status)) return res.status(400).json({ error: "Statut invalide" });
      patch.status = status;
      patch.resolvedAt = (status === "resolved" || status === "closed") ? new Date() : null;
    }
    if (assigneeId !== undefined) patch.assigneeId = assigneeId || null;
    if (Object.keys(patch).length === 0) return res.json(existing);

    const [t] = await db.update(ticketsTable).set(patch).where(eq(ticketsTable.id, req.params.id)).returning();
    return res.json(t);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.delete("/tickets/:id", requireAdmin, async (req, res) => {
  await db.delete(ticketsTable).where(eq(ticketsTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
