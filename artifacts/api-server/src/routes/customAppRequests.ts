import { Router, type IRouter } from "express";
import { db, customAppRequestsTable } from "@workspace/db";
import { eq, desc, ilike, or, and, SQL } from "drizzle-orm";
import { z } from "zod/v4";
import type { RequestHandler } from "express";

// ── Public router (no auth required) ─────────────────────────────────────────
export const customAppPublicRouter: IRouter = Router();

const submitSchema = z.object({
  orgName: z.string().min(1),
  contactPerson: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  description: z.string().optional(),
  expectedUsers: z.string().optional(),
  preferredTimeline: z.string().optional(),
  budgetRange: z.string().optional(),
});

customAppPublicRouter.post("/public/custom-app-requests", async (req, res, next) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides", details: parsed.error.issues });
      return;
    }
    const [row] = await db.insert(customAppRequestsTable).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── Super-admin router (cockpit) ──────────────────────────────────────────────
const router: IRouter = Router();

const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") { res.status(403).json({ error: "Réservé aux super-admins" }); return; }
  next();
};

router.get("/super-admin/custom-app-requests", sa, async (req, res, next) => {
  try {
    const { status, q } = req.query as Record<string, string>;

    const conds: SQL[] = [];
    if (status && status !== "all") {
      conds.push(eq(customAppRequestsTable.status, status));
    }
    if (q?.trim()) {
      conds.push(
        or(
          ilike(customAppRequestsTable.orgName, `%${q.trim()}%`),
          ilike(customAppRequestsTable.contactPerson, `%${q.trim()}%`),
          ilike(customAppRequestsTable.email, `%${q.trim()}%`),
        )!
      );
    }

    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

    const rows = await db
      .select()
      .from(customAppRequestsTable)
      .where(where)
      .orderBy(desc(customAppRequestsTable.createdAt));

    res.json({ data: rows, total: rows.length });
  } catch (err) { next(err); }
});

router.patch("/super-admin/custom-app-requests/:id", sa, async (req, res, next) => {
  try {
    const allowed = ["status", "assignedTo", "internalNotes"] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in req.body) patch[k] = req.body[k] ?? null;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Aucun champ à modifier" });
      return;
    }
    const [updated] = await db
      .update(customAppRequestsTable)
      .set(patch as typeof customAppRequestsTable.$inferInsert)
      .where(eq(customAppRequestsTable.id, String((req.params.id as string))))
      .returning();
    if (!updated) { res.status(404).json({ error: "Demande introuvable" }); return; }
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
