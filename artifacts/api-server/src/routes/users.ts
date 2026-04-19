import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/users", async (req, res) => {
  const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let query = db.select().from(usersTable);
  if (search) {
    query = query.where(ilike(usersTable.firstName, `%${search}%`)) as typeof query;
  }
  const data = await query.limit(limitNum).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const total = Number(countResult[0].count);

  return res.json({
    data: data.map(u => ({ ...u, password: undefined })),
    total,
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/users", requireAdmin, async (req, res) => {
  const { email, password, firstName, lastName, role, phone, isClient } = req.body;
  const [user] = await db.insert(usersTable).values({
    email, password, firstName, lastName,
    role: role || "collaborator",
    phone,
    isClient: isClient || false,
  }).returning();
  return res.status(201).json({ ...user, password: undefined });
});

router.get("/users/:id", async (req, res) => {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
  if (!users[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...users[0], password: undefined });
});

router.put("/users/:id", requireAdmin, async (req, res) => {
  const { firstName, lastName, role, phone, isActive } = req.body;
  const [user] = await db.update(usersTable)
    .set({ firstName, lastName, role, phone, isActive })
    .where(eq(usersTable.id, req.params.id))
    .returning();
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json({ ...user, password: undefined });
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
