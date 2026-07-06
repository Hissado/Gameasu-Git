import { pgTable, text, boolean, integer, timestamp, uuid, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { organizationsTable } from "./saas";

export const aiVoiceGenderEnum = pgEnum("ai_voice_gender", ["female", "male", "neutral"]);
export const aiVoiceStyleEnum = pgEnum("ai_voice_style", ["professional", "warm", "dynamic", "institutional"]);
export const aiKbTypeEnum = pgEnum("ai_kb_type", ["faq", "document", "info", "procedure", "policy"]);
export const aiConvChannelEnum = pgEnum("ai_conv_channel", ["chat", "phone", "whatsapp", "email"]);
export const aiConvStatusEnum = pgEnum("ai_conv_status", ["active", "completed", "transferred", "abandoned"]);
export const aiMsgRoleEnum = pgEnum("ai_msg_role", ["user", "assistant", "system"]);

export const aiAssistantsTable = pgTable("ai_assistants", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Assistant"),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(false),
  language: text("language").notNull().default("fr"),
  secondaryLanguages: text("secondary_languages").array().notNull().default(sql`'{}'::text[]`),
  voiceGender: aiVoiceGenderEnum("voice_gender").notNull().default("female"),
  voiceStyle: aiVoiceStyleEnum("voice_style").notNull().default("professional"),
  formalityLevel: text("formality_level").notNull().default("formal"),
  greetingMessage: text("greeting_message"),
  offHoursMessage: text("off_hours_message"),
  availableHours: jsonb("available_hours"),
  allowAppointmentBooking: boolean("allow_appointment_booking").notNull().default(true),
  allowTicketCreation: boolean("allow_ticket_creation").notNull().default(true),
  allowLeadCreation: boolean("allow_lead_creation").notNull().default(true),
  maxResponseLength: integer("max_response_length").notNull().default(500),
  systemPromptExtra: text("system_prompt_extra"),
  transferKeywords: text("transfer_keywords").array().notNull().default(sql`'{}'::text[]`),
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiKnowledgeBaseTable = pgTable("ai_knowledge_base", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id").references(() => aiAssistantsTable.id, { onDelete: "cascade" }),
  type: aiKbTypeEnum("type").notNull().default("faq"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiConversationsTable = pgTable("ai_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id").references(() => aiAssistantsTable.id),
  channel: aiConvChannelEnum("channel").notNull().default("chat"),
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  summary: text("summary"),
  status: aiConvStatusEnum("status").notNull().default("active"),
  assignedToId: uuid("assigned_to_id").references(() => usersTable.id),
  actionTaken: text("action_taken"),
  actionRefId: uuid("action_ref_id"),
  durationSeconds: integer("duration_seconds"),
  satisfactionRating: integer("satisfaction_rating"),
  messageCount: integer("message_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiMessagesTable = pgTable("ai_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => aiConversationsTable.id, { onDelete: "cascade" }),
  role: aiMsgRoleEnum("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
