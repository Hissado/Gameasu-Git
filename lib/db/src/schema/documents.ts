import { pgTable, text, timestamp, uuid, jsonb, integer, index } from "drizzle-orm/pg-core";
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
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byEntity: index("documents_entity_idx").on(t.entityType, t.entityId),
  byCategory: index("documents_category_idx").on(t.category),
}));

export type Document = typeof documentsTable.$inferSelect;
