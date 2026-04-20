import { Router } from "express";
import path from "node:path";
import { db } from "@workspace/db";
import {
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  messageAttachmentsTable,
  messageReadsTable,
  messageReactionsTable,
  messageMentionsTable,
  userPresenceTable,
  callSessionsTable,
  notificationsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, inArray, isNull, sql, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { emitToConversation, emitToUser } from "../lib/realtime";
import { translateText, transcribeAudio } from "../lib/translate";
import { UPLOAD_DIR } from "./uploads";

const router = Router();

router.use(requireAuth);

// ─── Helpers ────────────────────────────────────────────────────────────────
async function ensureParticipant(conversationId: string, userId: string) {
  const rows = await db.select().from(conversationParticipantsTable)
    .where(and(
      eq(conversationParticipantsTable.conversationId, conversationId),
      eq(conversationParticipantsTable.userId, userId),
    )).limit(1);
  return rows[0] || null;
}

async function listParticipantsForConv(conversationId: string) {
  return db.select({
    userId: conversationParticipantsTable.userId,
    name: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
    avatarUrl: usersTable.avatarUrl,
    role: usersTable.role,
    phone: usersTable.phone,
    archived: conversationParticipantsTable.archived,
    muted: conversationParticipantsTable.muted,
    pinned: conversationParticipantsTable.pinned,
    isAdmin: conversationParticipantsTable.isAdmin,
    presenceStatus: userPresenceTable.status,
    lastSeenAt: userPresenceTable.lastSeenAt,
  })
    .from(conversationParticipantsTable)
    .leftJoin(usersTable, eq(conversationParticipantsTable.userId, usersTable.id))
    .leftJoin(userPresenceTable, eq(userPresenceTable.userId, conversationParticipantsTable.userId))
    .where(eq(conversationParticipantsTable.conversationId, conversationId));
}

async function enrichMessages(messageIds: string[]) {
  if (messageIds.length === 0) return { reads: new Map(), reactions: new Map(), attachments: new Map() };
  const [reads, reactions, attachments] = await Promise.all([
    db.select().from(messageReadsTable).where(inArray(messageReadsTable.messageId, messageIds)),
    db.select().from(messageReactionsTable).where(inArray(messageReactionsTable.messageId, messageIds)),
    db.select().from(messageAttachmentsTable).where(inArray(messageAttachmentsTable.messageId, messageIds)),
  ]);
  const readsMap = new Map<string, string[]>();
  for (const r of reads) {
    if (!readsMap.has(r.messageId)) readsMap.set(r.messageId, []);
    readsMap.get(r.messageId)!.push(r.userId);
  }
  const reactionsMap = new Map<string, { emoji: string; userId: string }[]>();
  for (const r of reactions) {
    if (!reactionsMap.has(r.messageId)) reactionsMap.set(r.messageId, []);
    reactionsMap.get(r.messageId)!.push({ emoji: r.emoji, userId: r.userId });
  }
  const attachmentsMap = new Map<string, typeof attachments>();
  for (const a of attachments) {
    if (!attachmentsMap.has(a.messageId)) attachmentsMap.set(a.messageId, []);
    attachmentsMap.get(a.messageId)!.push(a);
  }
  return { reads: readsMap, reactions: reactionsMap, attachments: attachmentsMap };
}

function parseMentions(content: string): string[] {
  const matches = content.match(/@([a-z0-9._-]+)/gi) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

async function createNotification(userId: string, title: string, body: string, type: string, entityId?: string) {
  try {
    const [notif] = await db.insert(notificationsTable).values({
      userId, title, body, type, entityType: "message", entityId,
    }).returning();
    emitToUser(userId, "notification:new", notif);
  } catch {/* ignore */}
}

// ─── CONVERSATIONS ──────────────────────────────────────────────────────────
router.get("/conversations", async (req, res) => {
  const userId = req.authUser!.id;
  const { page = "1", limit = "30", projectId, clientId, archived, search } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  const myParts = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  const partByConv = new Map(myParts.map((p) => [p.conversationId, p]));
  const myConvIds = myParts.map((p) => p.conversationId);

  if (myConvIds.length === 0) {
    return res.json({ data: [], total: 0, page: pageNum, limit: limitNum });
  }

  const filters: any[] = [inArray(conversationsTable.id, myConvIds)];
  if (projectId) filters.push(eq(conversationsTable.projectId, projectId));
  if (clientId) filters.push(eq(conversationsTable.clientId, clientId));
  if (search) filters.push(or(
    ilike(conversationsTable.title, `%${search}%`),
    ilike(conversationsTable.lastMessage, `%${search}%`),
  ));

  let convos = await db.select().from(conversationsTable)
    .where(and(...filters))
    .orderBy(desc(conversationsTable.lastMessageAt));

  convos = convos.filter((c) => {
    const p = partByConv.get(c.id);
    if (!p) return false;
    if (archived === "true") return p.archived;
    if (archived === "false" || !archived) return !p.archived;
    return true;
  });

  const total = convos.length;
  // Pinned first
  convos.sort((a, b) => {
    const pa = partByConv.get(a.id)!;
    const pb = partByConv.get(b.id)!;
    if (pa.pinned !== pb.pinned) return pa.pinned ? -1 : 1;
    return (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0);
  });
  const paged = convos.slice(offset, offset + limitNum);

  const data = await Promise.all(paged.map(async (c) => {
    const me = partByConv.get(c.id)!;
    const participants = await listParticipantsForConv(c.id);
    return {
      ...c,
      participants,
      unreadCount: me.unreadCount || 0,
      archived: me.archived, muted: me.muted, pinned: me.pinned, isAdmin: me.isAdmin,
      lastReadAt: me.lastReadAt,
    };
  }));

  return res.json({ data, total, page: pageNum, limit: limitNum });
});

router.post("/conversations", async (req, res) => {
  const userId = req.authUser!.id;
  const { title, type, participantIds = [], projectId, clientId } = req.body || {};
  const allParticipants = Array.from(new Set([userId, ...participantIds]));

  // Pour les directs: réutiliser une conv existante (1-1) si elle existe
  if ((!type || type === "direct") && allParticipants.length === 2) {
    const otherId = allParticipants.find((id) => id !== userId);
    if (otherId) {
      const myConvs = await db.select({ id: conversationParticipantsTable.conversationId })
        .from(conversationParticipantsTable)
        .where(eq(conversationParticipantsTable.userId, userId));
      const otherConvs = await db.select({ id: conversationParticipantsTable.conversationId })
        .from(conversationParticipantsTable)
        .where(eq(conversationParticipantsTable.userId, otherId));
      const shared = myConvs.map((c) => c.id).filter((id) => otherConvs.some((o) => o.id === id));
      for (const cid of shared) {
        const c = (await db.select().from(conversationsTable).where(eq(conversationsTable.id, cid)).limit(1))[0];
        if (c && c.type === "direct") {
          const participants = await listParticipantsForConv(c.id);
          if (participants.length === 2) {
            return res.status(200).json({ ...c, participants, unreadCount: 0 });
          }
        }
      }
    }
  }

  const [convo] = await db.insert(conversationsTable).values({
    title: title || null,
    type: type || "direct",
    projectId: projectId || null,
    clientId: clientId || null,
    createdBy: userId,
  }).returning();

  for (const pid of allParticipants) {
    await db.insert(conversationParticipantsTable).values({
      conversationId: convo.id,
      userId: pid,
      isAdmin: pid === userId,
    }).onConflictDoNothing();
  }
  const participants = await listParticipantsForConv(convo.id);
  for (const p of participants) {
    if (p.userId) emitToUser(p.userId, "conversation:new", { conversationId: convo.id });
  }
  return res.status(201).json({ ...convo, participants, unreadCount: 0 });
});

router.get("/conversations/:id", async (req, res) => {
  const userId = req.authUser!.id;
  const part = await ensureParticipant(req.params.id, userId);
  if (!part) return res.status(403).json({ error: "Vous n'êtes pas membre de cette conversation" });
  const convos = await db.select().from(conversationsTable).where(eq(conversationsTable.id, req.params.id)).limit(1);
  if (!convos[0]) return res.status(404).json({ error: "Conversation introuvable" });
  const participants = await listParticipantsForConv(req.params.id);
  return res.json({
    ...convos[0],
    participants,
    unreadCount: part.unreadCount || 0,
    archived: part.archived, muted: part.muted, pinned: part.pinned, isAdmin: part.isAdmin,
    lastReadAt: part.lastReadAt,
  });
});

router.patch("/conversations/:id", async (req, res) => {
  const userId = req.authUser!.id;
  const part = await ensureParticipant(req.params.id, userId);
  if (!part) return res.status(403).json({ error: "Non autorisé" });
  const { archived, muted, pinned } = req.body || {};
  const updates: any = {};
  if (typeof archived === "boolean") updates.archived = archived;
  if (typeof muted === "boolean") updates.muted = muted;
  if (typeof pinned === "boolean") updates.pinned = pinned;
  if (Object.keys(updates).length > 0) {
    await db.update(conversationParticipantsTable)
      .set(updates)
      .where(and(
        eq(conversationParticipantsTable.conversationId, req.params.id),
        eq(conversationParticipantsTable.userId, userId),
      ));
  }
  return res.json({ success: true });
});

router.put("/conversations/:id/read", async (req, res) => {
  const userId = req.authUser!.id;
  const part = await ensureParticipant(req.params.id, userId);
  if (!part) return res.status(403).json({ error: "Non autorisé" });
  const now = new Date();
  await db.update(conversationParticipantsTable)
    .set({ unreadCount: 0, lastReadAt: now })
    .where(and(
      eq(conversationParticipantsTable.conversationId, req.params.id),
      eq(conversationParticipantsTable.userId, userId),
    ));

  // Mark unread messages as read
  const unreadMessages = await db.select({ id: messagesTable.id })
    .from(messagesTable)
    .leftJoin(messageReadsTable, and(
      eq(messageReadsTable.messageId, messagesTable.id),
      eq(messageReadsTable.userId, userId),
    ))
    .where(and(
      eq(messagesTable.conversationId, req.params.id),
      isNull(messageReadsTable.id),
    ));
  if (unreadMessages.length > 0) {
    for (const m of unreadMessages) {
      await db.insert(messageReadsTable).values({ messageId: m.id, userId, readAt: now }).onConflictDoNothing();
    }
  }
  emitToConversation(req.params.id, "conversation:read", {
    conversationId: req.params.id, userId, readAt: now.toISOString(),
  });
  return res.json({ success: true, lastReadAt: now });
});

router.post("/conversations/:id/participants", async (req, res) => {
  const userId = req.authUser!.id;
  const part = await ensureParticipant(req.params.id, userId);
  if (!part) return res.status(403).json({ error: "Non autorisé" });
  const { participantIds = [] } = req.body || {};
  for (const pid of participantIds) {
    await db.insert(conversationParticipantsTable).values({
      conversationId: req.params.id, userId: pid,
    }).onConflictDoNothing();
    emitToUser(pid, "conversation:new", { conversationId: req.params.id });
  }
  const participants = await listParticipantsForConv(req.params.id);
  return res.json({ participants });
});

// ─── MESSAGES ───────────────────────────────────────────────────────────────
router.get("/conversations/:id/messages", async (req, res) => {
  const userId = req.authUser!.id;
  const part = await ensureParticipant(req.params.id, userId);
  if (!part) return res.status(403).json({ error: "Non autorisé" });

  const { page = "1", limit = "50", search } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  const filters: any[] = [eq(messagesTable.conversationId, req.params.id)];
  if (search) filters.push(ilike(messagesTable.content, `%${search}%`));

  const rows = await db.select({
    msg: messagesTable,
    senderName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
    senderAvatarUrl: usersTable.avatarUrl,
  }).from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(and(...filters))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limitNum).offset(offset);

  const ids = rows.map((r) => r.msg.id);
  const enriched = await enrichMessages(ids);

  const data = rows.reverse().map((r) => ({
    ...r.msg,
    senderName: r.senderName,
    senderAvatarUrl: r.senderAvatarUrl,
    readBy: enriched.reads.get(r.msg.id) || [],
    reactions: enriched.reactions.get(r.msg.id) || [],
    attachments: enriched.attachments.get(r.msg.id) || [],
  }));

  const count = await db.select({ count: sql<number>`count(*)` }).from(messagesTable).where(and(...filters));
  return res.json({ data, total: Number(count[0].count), page: pageNum, limit: limitNum });
});

router.post("/conversations/:id/messages", async (req, res) => {
  const userId = req.authUser!.id;
  const part = await ensureParticipant(req.params.id, userId);
  if (!part) return res.status(403).json({ error: "Non autorisé" });

  const {
    content = "",
    attachmentUrl,
    attachments = [],
    kind = "text",
    metadata,
    replyToMessageId,
  } = req.body || {};

  if (!content && !attachmentUrl && attachments.length === 0 && kind === "text") {
    return res.status(400).json({ error: "Message vide" });
  }

  const [msg] = await db.insert(messagesTable).values({
    conversationId: req.params.id,
    senderId: userId,
    content: content || "",
    attachmentUrl: attachmentUrl || null,
    kind,
    metadata: metadata || null,
    replyToMessageId: replyToMessageId || null,
  }).returning();

  // Attachments multi
  if (Array.isArray(attachments) && attachments.length > 0) {
    await db.insert(messageAttachmentsTable).values(
      attachments.map((a: any) => ({
        messageId: msg.id,
        url: a.url, mime: a.mime || "application/octet-stream",
        sizeBytes: a.sizeBytes ?? null, kind: a.kind || "file",
        thumbnailUrl: a.thumbnailUrl || null,
        durationSeconds: a.durationSeconds ?? null,
        width: a.width ?? null, height: a.height ?? null,
        filename: a.filename || null,
      }))
    );
  }

  // Mentions
  const mentionHandles = parseMentions(content || "");
  let mentionedUsers: { id: string }[] = [];
  if (mentionHandles.length > 0) {
    mentionedUsers = await db.select({ id: usersTable.id }).from(usersTable).where(or(
      ...mentionHandles.map((h) => sql`lower(${usersTable.email}) like ${h + "@%"}`),
    ));
    for (const u of mentionedUsers) {
      await db.insert(messageMentionsTable).values({ messageId: msg.id, mentionedUserId: u.id }).onConflictDoNothing();
    }
  }

  // Conversation lastMessage + unread bump
  const preview = content?.slice(0, 200) || (kind === "voice" ? "🎙️ Message vocal" : kind === "image" ? "📷 Photo" : kind === "location" ? "📍 Localisation" : "📎 Fichier");
  await db.update(conversationsTable)
    .set({ lastMessage: preview, lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, req.params.id));

  await db.update(conversationParticipantsTable)
    .set({ unreadCount: sql`${conversationParticipantsTable.unreadCount} + 1` })
    .where(and(
      eq(conversationParticipantsTable.conversationId, req.params.id),
      sql`${conversationParticipantsTable.userId} != ${userId}`,
    ));

  // Mark sender as read
  await db.insert(messageReadsTable).values({ messageId: msg.id, userId }).onConflictDoNothing();

  // Notifications
  const allParts = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, req.params.id));
  const sender = req.authUser!;
  for (const p of allParts) {
    if (p.userId === userId || p.muted) continue;
    await createNotification(p.userId, `${sender.firstName} ${sender.lastName}`, preview, "message", msg.id);
  }

  // Hydrate response with senderName/avatar/attachments
  const senderRow = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
  const enriched = await enrichMessages([msg.id]);
  const payload = {
    ...msg,
    senderName: senderRow ? `${senderRow.firstName} ${senderRow.lastName}` : null,
    senderAvatarUrl: senderRow?.avatarUrl,
    readBy: enriched.reads.get(msg.id) || [],
    reactions: [],
    attachments: enriched.attachments.get(msg.id) || [],
  };

  emitToConversation(req.params.id, "message:new", payload);
  for (const p of allParts) {
    if (p.userId !== userId) emitToUser(p.userId, "conversation:bump", { conversationId: req.params.id });
  }

  return res.status(201).json(payload);
});

router.patch("/messages/:id", async (req, res) => {
  const userId = req.authUser!.id;
  const { content } = req.body || {};
  const existing = (await db.select().from(messagesTable).where(eq(messagesTable.id, req.params.id)).limit(1))[0];
  if (!existing) return res.status(404).json({ error: "Introuvable" });
  if (existing.senderId !== userId) return res.status(403).json({ error: "Non autorisé" });
  const [updated] = await db.update(messagesTable)
    .set({ content: content ?? existing.content, editedAt: new Date(), translations: null })
    .where(eq(messagesTable.id, req.params.id)).returning();
  emitToConversation(updated.conversationId, "message:updated", updated);
  return res.json(updated);
});

router.delete("/messages/:id", async (req, res) => {
  const userId = req.authUser!.id;
  const existing = (await db.select().from(messagesTable).where(eq(messagesTable.id, req.params.id)).limit(1))[0];
  if (!existing) return res.status(404).json({ error: "Introuvable" });
  if (existing.senderId !== userId) return res.status(403).json({ error: "Non autorisé" });
  const [updated] = await db.update(messagesTable)
    .set({ deletedAt: new Date(), content: "", attachmentUrl: null })
    .where(eq(messagesTable.id, req.params.id)).returning();
  emitToConversation(updated.conversationId, "message:deleted", { id: updated.id, conversationId: updated.conversationId });
  return res.json({ success: true });
});

// Reactions
router.post("/messages/:id/reactions", async (req, res) => {
  const userId = req.authUser!.id;
  const { emoji } = req.body || {};
  if (!emoji) return res.status(400).json({ error: "Emoji requis" });
  const msg = (await db.select().from(messagesTable).where(eq(messagesTable.id, req.params.id)).limit(1))[0];
  if (!msg) return res.status(404).json({ error: "Introuvable" });
  const part = await ensureParticipant(msg.conversationId, userId);
  if (!part) return res.status(403).json({ error: "Non autorisé" });
  await db.insert(messageReactionsTable).values({ messageId: msg.id, userId, emoji }).onConflictDoNothing();
  emitToConversation(msg.conversationId, "reaction:added", { messageId: msg.id, userId, emoji });
  return res.status(201).json({ success: true });
});

router.delete("/messages/:id/reactions/:emoji", async (req, res) => {
  const userId = req.authUser!.id;
  const msg = (await db.select().from(messagesTable).where(eq(messagesTable.id, req.params.id)).limit(1))[0];
  if (!msg) return res.status(404).json({ error: "Introuvable" });
  await db.delete(messageReactionsTable).where(and(
    eq(messageReactionsTable.messageId, msg.id),
    eq(messageReactionsTable.userId, userId),
    eq(messageReactionsTable.emoji, req.params.emoji),
  ));
  emitToConversation(msg.conversationId, "reaction:removed", {
    messageId: msg.id, userId, emoji: req.params.emoji,
  });
  return res.json({ success: true });
});

// Translation
router.post("/messages/:id/translate", async (req, res) => {
  const userId = req.authUser!.id;
  const { targetLang = "fr" } = req.body || {};
  const msg = (await db.select().from(messagesTable).where(eq(messagesTable.id, req.params.id)).limit(1))[0];
  if (!msg) return res.status(404).json({ error: "Introuvable" });
  const part = await ensureParticipant(msg.conversationId, userId);
  if (!part) return res.status(403).json({ error: "Non autorisé" });

  const cached = (msg.translations || {})[targetLang];
  if (cached) return res.json({ targetLang, text: cached, cached: true });

  if (!msg.content) return res.status(400).json({ error: "Aucun texte à traduire" });
  const translated = await translateText(msg.content, targetLang);
  if (!translated) {
    return res.status(503).json({
      error: "Service de traduction indisponible",
      detail: "Ajoutez la connexion OpenAI (intégration Replit) pour activer l'auto-traduction.",
    });
  }
  const newTranslations = { ...(msg.translations || {}), [targetLang]: translated };
  await db.update(messagesTable).set({ translations: newTranslations }).where(eq(messagesTable.id, msg.id));
  return res.json({ targetLang, text: translated, cached: false });
});

// Voice transcription
router.post("/messages/:id/transcribe", async (req, res) => {
  const userId = req.authUser!.id;
  const msg = (await db.select().from(messagesTable).where(eq(messagesTable.id, req.params.id)).limit(1))[0];
  if (!msg) return res.status(404).json({ error: "Introuvable" });
  const part = await ensureParticipant(msg.conversationId, userId);
  if (!part) return res.status(403).json({ error: "Non autorisé" });
  if (msg.kind !== "voice" || !msg.attachmentUrl) {
    return res.status(400).json({ error: "Message non vocal" });
  }
  // Anti path-traversal: l'URL doit pointer strictement vers /uploads/ et le chemin
  // résolu doit rester contenu dans UPLOAD_DIR.
  if (!msg.attachmentUrl.startsWith("/uploads/") || msg.attachmentUrl.includes("..")) {
    return res.status(400).json({ error: "URL d'audio invalide" });
  }
  const filename = msg.attachmentUrl.slice("/uploads/".length);
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ error: "Nom de fichier invalide" });
  }
  const filePath = path.resolve(UPLOAD_DIR, filename);
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    return res.status(400).json({ error: "Chemin hors du répertoire autorisé" });
  }
  const text = await transcribeAudio(filePath);
  if (!text) {
    return res.status(503).json({
      error: "Service de transcription indisponible",
      detail: "Ajoutez la connexion OpenAI (intégration Replit) pour activer la transcription vocale.",
    });
  }
  const meta = { ...((msg.metadata as any) || {}), transcript: text };
  await db.update(messagesTable).set({ metadata: meta }).where(eq(messagesTable.id, msg.id));
  emitToConversation(msg.conversationId, "message:transcribed", { id: msg.id, transcript: text });
  return res.json({ transcript: text });
});

// ─── PRESENCE ───────────────────────────────────────────────────────────────
router.get("/presence", async (req, res) => {
  const { userIds } = req.query as Record<string, string>;
  if (!userIds) return res.json({ data: [] });
  const ids = userIds.split(",").filter(Boolean);
  if (ids.length === 0) return res.json({ data: [] });
  const rows = await db.select().from(userPresenceTable).where(inArray(userPresenceTable.userId, ids));
  return res.json({ data: rows });
});

// ─── SEARCH GLOBAL ──────────────────────────────────────────────────────────
router.get("/messages/search", async (req, res) => {
  const userId = req.authUser!.id;
  const { q = "", limit = "30" } = req.query as Record<string, string>;
  if (!q.trim()) return res.json({ data: [] });
  const myParts = await db.select({ id: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable).where(eq(conversationParticipantsTable.userId, userId));
  if (myParts.length === 0) return res.json({ data: [] });
  const convIds = myParts.map((p) => p.id);
  const rows = await db.select({
    msg: messagesTable,
    convTitle: conversationsTable.title,
    senderName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(messagesTable)
    .leftJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(and(
      inArray(messagesTable.conversationId, convIds),
      ilike(messagesTable.content, `%${q}%`),
    ))
    .orderBy(desc(messagesTable.createdAt))
    .limit(Math.min(100, parseInt(limit)));
  return res.json({
    data: rows.map((r) => ({
      ...r.msg, conversationTitle: r.convTitle, senderName: r.senderName,
    })),
  });
});

// ─── CALLS (placeholder, à brancher LiveKit/Daily plus tard) ────────────────
router.get("/calls", async (req, res) => {
  const userId = req.authUser!.id;
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  const myConvs = await db.select({ id: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable).where(eq(conversationParticipantsTable.userId, userId));
  const ids = myConvs.map((c) => c.id);
  const filter = ids.length > 0 ? inArray(callSessionsTable.conversationId, ids) : sql`false`;

  const rows = await db.select({
    call: callSessionsTable,
    initiatorName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(callSessionsTable)
    .leftJoin(usersTable, eq(callSessionsTable.initiatorId, usersTable.id))
    .where(filter)
    .orderBy(desc(callSessionsTable.createdAt))
    .limit(limitNum).offset(offset);

  const data = rows.map((r) => ({ ...r.call, initiatorName: r.initiatorName, participants: [] }));
  return res.json({ data, total: data.length, page: pageNum, limit: limitNum });
});

router.post("/calls", async (req, res) => {
  const userId = req.authUser!.id;
  const { type, conversationId, projectId } = req.body || {};
  if (conversationId) {
    const part = await ensureParticipant(conversationId, userId);
    if (!part) return res.status(403).json({ error: "Non autorisé" });
  }
  const [call] = await db.insert(callSessionsTable).values({
    type: type || "video", status: "active", initiatorId: userId,
    conversationId: conversationId || null, projectId: projectId || null,
    roomUrl: `https://meet.edole.africa/room/${Date.now()}`,
    startedAt: new Date(),
  }).returning();
  if (conversationId) {
    emitToConversation(conversationId, "call:started", call);
  }
  const me = req.authUser!;
  return res.status(201).json({
    ...call, initiatorName: `${me.firstName} ${me.lastName}`, participants: [],
  });
});

async function userCanAccessCall(call: typeof callSessionsTable.$inferSelect, userId: string): Promise<boolean> {
  if (call.initiatorId === userId) return true;
  if (call.conversationId) {
    const part = await ensureParticipant(call.conversationId, userId);
    if (part) return true;
  }
  return false;
}

router.get("/calls/:id", async (req, res) => {
  const userId = req.authUser!.id;
  const rows = await db.select({
    call: callSessionsTable,
    initiatorName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
  }).from(callSessionsTable)
    .leftJoin(usersTable, eq(callSessionsTable.initiatorId, usersTable.id))
    .where(eq(callSessionsTable.id, req.params.id)).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Introuvable" });
  if (!(await userCanAccessCall(rows[0].call, userId))) {
    return res.status(403).json({ error: "Non autorisé" });
  }
  return res.json({ ...rows[0].call, initiatorName: rows[0].initiatorName, participants: [] });
});

router.put("/calls/:id", async (req, res) => {
  const userId = req.authUser!.id;
  const { status, endedAt } = req.body || {};
  const ended = endedAt ? new Date(endedAt) : (status === "ended" ? new Date() : undefined);
  const existing = (await db.select().from(callSessionsTable).where(eq(callSessionsTable.id, req.params.id)).limit(1))[0];
  if (!existing) return res.status(404).json({ error: "Introuvable" });
  if (!(await userCanAccessCall(existing, userId))) {
    return res.status(403).json({ error: "Non autorisé" });
  }
  const duration = ended && existing.startedAt
    ? Math.max(0, Math.floor((ended.getTime() - existing.startedAt.getTime()) / 1000))
    : undefined;
  const [call] = await db.update(callSessionsTable)
    .set({ status, endedAt: ended, durationSeconds: duration })
    .where(eq(callSessionsTable.id, req.params.id)).returning();
  if (call.conversationId) emitToConversation(call.conversationId, "call:ended", call);
  return res.json({ ...call, participants: [] });
});

// ─── NOTIFICATIONS ──────────────────────────────────────────────────────────
router.get("/notifications", async (req, res) => {
  const userId = req.authUser!.id;
  const { unreadOnly, page = "1", limit = "30" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  const filters: any[] = [eq(notificationsTable.userId, userId)];
  if (unreadOnly === "true") filters.push(eq(notificationsTable.isRead, "false"));

  const data = await db.select().from(notificationsTable)
    .where(and(...filters))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limitNum).offset(offset);
  const count = await db.select({ count: sql<number>`count(*)` }).from(notificationsTable).where(and(...filters));
  return res.json({
    data: data.map((n) => ({ ...n, isRead: n.isRead === "true" })),
    total: Number(count[0].count), page: pageNum, limit: limitNum,
  });
});

router.put("/notifications/:id/read", async (req, res) => {
  const userId = req.authUser!.id;
  const [notif] = await db.update(notificationsTable)
    .set({ isRead: "true" })
    .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, userId))).returning();
  if (!notif) return res.status(404).json({ error: "Introuvable" });
  return res.json({ ...notif, isRead: true });
});

router.put("/notifications/read-all", async (req, res) => {
  const userId = req.authUser!.id;
  await db.update(notificationsTable).set({ isRead: "true" })
    .where(eq(notificationsTable.userId, userId));
  return res.json({ success: true });
});

export default router;
