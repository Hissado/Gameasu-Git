import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, conversationParticipantsTable, messagesTable, callSessionsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

// CONVERSATIONS
router.get("/conversations", async (req, res) => {
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const convos = await db.select().from(conversationsTable).limit(limitNum).offset(offset);
  const data = await Promise.all(convos.map(async c => {
    const participants = await db.select({
      userId: conversationParticipantsTable.userId,
      name: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
      avatarUrl: usersTable.avatarUrl,
    }).from(conversationParticipantsTable)
      .leftJoin(usersTable, eq(conversationParticipantsTable.userId, usersTable.id))
      .where(eq(conversationParticipantsTable.conversationId, c.id));

    const unreadRes = await db.select({ total: sql<number>`sum(unread_count)` })
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, c.id));

    return {
      ...c,
      participants: participants.map(p => ({ userId: p.userId, name: p.name, avatarUrl: p.avatarUrl })),
      unreadCount: Number(unreadRes[0].total || 0),
    };
  }));

  const count = await db.select({ count: sql<number>`count(*)` }).from(conversationsTable);
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/conversations", async (req, res) => {
  const { title, type, participantIds, projectId, clientId } = req.body;
  const [convo] = await db.insert(conversationsTable).values({ title, type: type || "direct", projectId, clientId }).returning();

  if (participantIds && participantIds.length > 0) {
    for (const userId of participantIds) {
      await db.insert(conversationParticipantsTable).values({ conversationId: convo.id, userId }).catch(() => {});
    }
  }

  return res.status(201).json({ ...convo, participants: [], unreadCount: 0 });
});

router.get("/conversations/:id", async (req, res) => {
  const convos = await db.select().from(conversationsTable).where(eq(conversationsTable.id, req.params.id)).limit(1);
  if (!convos[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...convos[0], participants: [], unreadCount: 0 });
});

// MESSAGES
router.get("/conversations/:id/messages", async (req, res) => {
  const { page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({
    msg: messagesTable,
    senderName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
    senderAvatarUrl: usersTable.avatarUrl,
  }).from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.conversationId, req.params.id))
    .limit(limitNum).offset(offset);

  const data = rows.map(r => ({ ...r.msg, senderName: r.senderName, senderAvatarUrl: r.senderAvatarUrl, readBy: [] }));
  const count = await db.select({ count: sql<number>`count(*)` }).from(messagesTable).where(eq(messagesTable.conversationId, req.params.id));
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/conversations/:id/messages", async (req, res) => {
  const { content, attachmentUrl } = req.body;

  const users = await db.select().from(usersTable).limit(1);
  const senderId = users[0]?.id;
  if (!senderId) return res.status(400).json({ error: "No users available" });

  const [msg] = await db.insert(messagesTable).values({
    conversationId: req.params.id, senderId, content, attachmentUrl,
  }).returning();

  await db.update(conversationsTable)
    .set({ lastMessage: content, lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, req.params.id));

  return res.status(201).json({
    ...msg,
    senderName: `${users[0].firstName} ${users[0].lastName}`,
    senderAvatarUrl: users[0].avatarUrl,
    readBy: [],
  });
});

// CALLS
router.get("/calls", async (req, res) => {
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select({
    call: callSessionsTable,
    initiatorName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(callSessionsTable)
    .leftJoin(usersTable, eq(callSessionsTable.initiatorId, usersTable.id))
    .limit(limitNum).offset(offset);

  const data = rows.map(r => ({ ...r.call, initiatorName: r.initiatorName, participants: [] }));
  const count = await db.select({ count: sql<number>`count(*)` }).from(callSessionsTable);
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/calls", async (req, res) => {
  const { type, conversationId, projectId, participantIds } = req.body;
  const users = await db.select().from(usersTable).limit(1);
  const initiatorId = users[0]?.id;

  const [call] = await db.insert(callSessionsTable).values({
    type: type || "video", status: "active", initiatorId, conversationId, projectId,
    roomUrl: `https://meet.example.com/${Date.now()}`,
    startedAt: new Date(),
  }).returning();

  return res.status(201).json({ ...call, initiatorName: users[0] ? `${users[0].firstName} ${users[0].lastName}` : null, participants: [] });
});

router.get("/calls/:id", async (req, res) => {
  const rows = await db.select({
    call: callSessionsTable,
    initiatorName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(callSessionsTable)
    .leftJoin(usersTable, eq(callSessionsTable.initiatorId, usersTable.id))
    .where(eq(callSessionsTable.id, req.params.id)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json({ ...rows[0].call, initiatorName: rows[0].initiatorName, participants: [] });
});

router.put("/calls/:id", async (req, res) => {
  const { status, endedAt } = req.body;
  const [call] = await db.update(callSessionsTable)
    .set({ status, endedAt: endedAt ? new Date(endedAt) : undefined })
    .where(eq(callSessionsTable.id, req.params.id)).returning();
  if (!call) return res.status(404).json({ error: "Not found" });
  return res.json({ ...call, participants: [] });
});

// NOTIFICATIONS
router.get("/notifications", async (req, res) => {
  const { unreadOnly, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const data = await db.select().from(notificationsTable).limit(limitNum).offset(offset);
  const count = await db.select({ count: sql<number>`count(*)` }).from(notificationsTable);
  return res.json({
    data: data.map(n => ({ ...n, isRead: n.isRead === "true" })),
    total: Number(count[0].count), page: pageNum, limit: limitNum,
  });
});

router.put("/notifications/:id/read", async (req, res) => {
  const [notif] = await db.update(notificationsTable)
    .set({ isRead: "true" })
    .where(eq(notificationsTable.id, req.params.id)).returning();
  if (!notif) return res.status(404).json({ error: "Not found" });
  return res.json({ ...notif, isRead: true });
});

router.put("/notifications/read-all", async (req, res) => {
  await db.update(notificationsTable).set({ isRead: "true" });
  return res.json({ success: true });
});

export default router;
