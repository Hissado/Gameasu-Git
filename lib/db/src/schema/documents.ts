import { pgTable, text, timestamp, uuid, jsonb, integer, index, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const documentsTable = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type"),
  size: integer("size"),
  category: text("category").notNull().default("other"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>().default([]),
  uploadedBy: uuid("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
  // Phase 8 — Documents IA : classification, résumé, signature.
  aiCategory: text("ai_category"),
  aiConfidence: numeric("ai_confidence", { precision: 4, scale: 3 }),
  aiSummary: text("ai_summary"),
  aiTags: jsonb("ai_tags").$type<string[]>().default([]),
  aiAnalyzedAt: timestamp("ai_analyzed_at", { withTimezone: true }),
  aiProvider: text("ai_provider"), // "openai" | "heuristic"
  signatureStatus: text("signature_status").default("none"), // none | pending | signed | refused
  signers: jsonb("signers").$type<Array<{ name: string; email?: string; role?: string; signedAt?: string }>>().default([]),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byEntity: index("documents_entity_idx").on(t.entityType, t.entityId),
  byCategory: index("documents_category_idx").on(t.category),
  bySignatureStatus: index("documents_signature_status_idx").on(t.signatureStatus),
}));

export type Document = typeof documentsTable.$inferSelect;
