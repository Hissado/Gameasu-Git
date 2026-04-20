import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, real, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const conversationsTable = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  type: text("type").notNull().default("direct"),
  projectId: uuid("project_id"),
  clientId: uuid("client_id"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => usersTable.id),
  source: text("source").notNull().default("internal"),
  externalThreadId: text("external_thread_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const conversationParticipantsTable = pgTable("conversation_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversationsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  unreadCount: integer("unread_count").default(0),
  archived: boolean("archived").notNull().default(false),
  muted: boolean("muted").notNull().default(false),
  pinned: boolean("pinned").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqUserConv: uniqueIndex("conv_part_uniq").on(t.conversationId, t.userId),
}));

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversationsTable.id),
  senderId: uuid("sender_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  kind: text("kind").notNull().default("text"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  replyToMessageId: uuid("reply_to_message_id"),
  translations: jsonb("translations").$type<Record<string, string>>(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byConv: index("messages_by_conv").on(t.conversationId, t.createdAt),
}));

export const messageAttachmentsTable = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes"),
  kind: text("kind").notNull().default("file"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: real("duration_seconds"),
  width: integer("width"),
  height: integer("height"),
  filename: text("filename"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageReadsTable = pgTable("message_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqRead: uniqueIndex("msg_read_uniq").on(t.messageId, t.userId),
}));

export const messageReactionsTable = pgTable("message_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqReact: uniqueIndex("msg_reaction_uniq").on(t.messageId, t.userId, t.emoji),
}));

export const messageMentionsTable = pgTable("message_mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  mentionedUserId: uuid("mentioned_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userPresenceTable = pgTable("user_presence", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id),
  status: text("status").notNull().default("offline"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  authKey: text("auth_key").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whatsappChannelsTable = pgTable("whatsapp_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneNumberId: text("phone_number_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  webhookVerifyToken: text("webhook_verify_token"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const callSessionsTable = pgTable("call_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull().default("video"),
  status: text("status").notNull().default("scheduled"),
  initiatorId: uuid("initiator_id").references(() => usersTable.id),
  conversationId: uuid("conversation_id").references(() => conversationsTable.id),
  projectId: uuid("project_id"),
  roomUrl: text("room_url"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const notificationsTable = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("info"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  isRead: text("is_read").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

export const insertCallSessionSchema = createInsertSchema(callSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCallSession = z.infer<typeof insertCallSessionSchema>;
export type CallSession = typeof callSessionsTable.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

export type MessageAttachment = typeof messageAttachmentsTable.$inferSelect;
export type MessageRead = typeof messageReadsTable.$inferSelect;
export type MessageReaction = typeof messageReactionsTable.$inferSelect;
export type UserPresence = typeof userPresenceTable.$inferSelect;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type WhatsappChannel = typeof whatsappChannelsTable.$inferSelect;
