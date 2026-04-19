import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, clientContactsTable } from "@workspace/db";
import { eq, ilike, sql, isNull } from "drizzle-orm";

const router = Router();

router.get("/clients", async (req, res) => {
  const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let query = db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  if (search) {
    query = query.where(ilike(clientsTable.name, `%${search}%`)) as typeof query;
  }
  const data = await query.limit(limitNum).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(clientsTable).where(isNull(clientsTable.deletedAt));
  return res.json({ data, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
});

router.post("/clients", async (req, res) => {
  const { name, email, phone, industry, address, website, status } = req.body;
  const [client] = await db.insert(clientsTable).values({ name, email, phone, industry, address, website, status: status || "prospect" }).returning();
  return res.status(201).json(client);
});

router.get("/clients/:id", async (req, res) => {
  const clients = await db.select().from(clientsTable).where(eq(clientsTable.id, req.params.id)).limit(1);
  if (!clients[0]) return res.status(404).json({ error: "Not found" });
  const contacts = await db.select().from(clientContactsTable).where(eq(clientContactsTable.clientId, req.params.id));
  return res.json({ ...clients[0], contacts, projectsCount: 0, ordersCount: 0, totalRevenue: 0 });
});

router.put("/clients/:id", async (req, res) => {
  const { name, email, phone, industry, address, website, status } = req.body;
  const [client] = await db.update(clientsTable).set({ name, email, phone, industry, address, website, status }).where(eq(clientsTable.id, req.params.id)).returning();
  if (!client) return res.status(404).json({ error: "Not found" });
  return res.json(client);
});

router.delete("/clients/:id", async (req, res) => {
  await db.update(clientsTable).set({ deletedAt: new Date() }).where(eq(clientsTable.id, req.params.id));
  return res.status(204).send();
});

router.get("/clients/:id/contacts", async (req, res) => {
  const contacts = await db.select().from(clientContactsTable).where(eq(clientContactsTable.clientId, req.params.id));
  return res.json(contacts);
});

router.post("/clients/:id/contacts", async (req, res) => {
  const { firstName, lastName, email, phone, role, isPrimary } = req.body;
  const [contact] = await db.insert(clientContactsTable).values({
    clientId: req.params.id, firstName, lastName, email, phone, role,
    isPrimary: isPrimary ? "true" : "false",
  }).returning();
  return res.status(201).json({ ...contact, isPrimary: contact.isPrimary === "true" });
});

export default router;
