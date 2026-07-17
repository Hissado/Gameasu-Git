import { pgTable, text, uuid, timestamp, jsonb, integer, boolean, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";

export const cloudStorageConnectionsTable = pgTable("cloud_storage_connections", {
  id:              uuid("id").primaryKey().defaultRandom(),
  organizationId:  uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  provider:        text("provider").notNull(),
  displayName:     text("display_name"),
  accountEmail:    text("account_email"),
  accountName:     text("account_name"),
  accessTokenEnc:  text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt:  timestamp("token_expires_at", { withTimezone: true }),
  scopeGranted:    text("scope_granted"),
  rootFolderId:    text("root_folder_id"),
  rootFolderName:  text("root_folder_name"),
  folderMap:       jsonb("folder_map"),
  status:          text("status").notNull().default("disconnected"),
  syncEnabled:     boolean("sync_enabled").notNull().default(true),
  autoSync:        boolean("auto_sync").notNull().default(true),
  lastSyncAt:      timestamp("last_sync_at", { withTimezone: true }),
  lastError:       text("last_error"),
  connectedById:   uuid("connected_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  connectedAt:     timestamp("connected_at", { withTimezone: true }),
  disconnectedAt:  timestamp("disconnected_at", { withTimezone: true }),
  metadata:        jsonb("metadata"),
}, (t) => ({
  orgIdx:    index("csc_org_idx").on(t.organizationId),
  statusIdx: index("csc_status_idx").on(t.status),
}));

export const cloudSyncedFilesTable = pgTable("cloud_synced_files", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  connectionId:   uuid("connection_id").notNull().references(() => cloudStorageConnectionsTable.id, { onDelete: "cascade" }),
  provider:       text("provider").notNull(),
  gamesuRef:      text("gamesu_ref"),
  gamesuModule:   text("gamesu_module"),
  fileName:       text("file_name").notNull(),
  mimeType:       text("mime_type"),
  cloudFileId:    text("cloud_file_id"),
  cloudPath:      text("cloud_path"),
  cloudViewUrl:   text("cloud_view_url"),
  cloudEditUrl:   text("cloud_edit_url"),
  fileSize:       integer("file_size"),
  checksum:       text("checksum"),
  version:        integer("version").notNull().default(1),
  status:         text("status").notNull().default("pending"),
  syncedAt:       timestamp("synced_at", { withTimezone: true }),
  errorMessage:   text("error_message"),
  syncAttempts:   integer("sync_attempts").notNull().default(0),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx:    index("csf_org_idx").on(t.organizationId),
  statusIdx: index("csf_status_idx").on(t.status),
  refIdx:    index("csf_ref_idx").on(t.gamesuRef),
}));

export const cloudSyncQueueTable = pgTable("cloud_sync_queue", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  connectionId:   uuid("connection_id").notNull().references(() => cloudStorageConnectionsTable.id, { onDelete: "cascade" }),
  syncedFileId:   uuid("synced_file_id").references(() => cloudSyncedFilesTable.id, { onDelete: "cascade" }),
  action:         text("action").notNull().default("upload"),
  fileData:       jsonb("file_data"),
  status:         text("status").notNull().default("pending"),
  attempts:       integer("attempts").notNull().default(0),
  maxAttempts:    integer("max_attempts").notNull().default(3),
  scheduledAt:    timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt:    timestamp("processed_at", { withTimezone: true }),
  errorMessage:   text("error_message"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx:    index("csq_org_idx").on(t.organizationId),
  statusIdx: index("csq_status_idx").on(t.status),
  schedIdx:  index("csq_sched_idx").on(t.scheduledAt),
}));

export type CloudStorageConnection = typeof cloudStorageConnectionsTable.$inferSelect;
export type CloudSyncedFile        = typeof cloudSyncedFilesTable.$inferSelect;
export type CloudSyncQueue         = typeof cloudSyncQueueTable.$inferSelect;
