import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";

export const importSessionsTable = pgTable("import_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id),
  module: text("module").notNull(),
  fileName: text("file_name"),
  status: text("status").notNull().default("pending"),
  totalRows: integer("total_rows").default(0),
  validRows: integer("valid_rows").default(0),
  errorRows: integer("error_rows").default(0),
  importedRows: integer("imported_rows").default(0),
  mappingUsed: jsonb("mapping_used"),
  errors: jsonb("errors"),
  summary: jsonb("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  orgIdx: index("import_sessions_org_idx").on(t.organizationId),
  moduleIdx: index("import_sessions_module_idx").on(t.module),
}));

export const importMappingsTable = pgTable("import_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  name: text("name").notNull(),
  mapping: jsonb("mapping").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgModuleIdx: index("import_mappings_org_module_idx").on(t.organizationId, t.module),
}));
