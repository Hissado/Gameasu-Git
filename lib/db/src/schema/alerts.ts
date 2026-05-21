import { pgTable, text, timestamp, uuid, boolean, index, unique } from "drizzle-orm/pg-core";
import { organizationsTable } from "./saas";

export const alertsTable = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  title: text("title").notNull(),
  message: text("message"),
  severity: text("severity").notNull().default("info"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  dedupKey: text("dedup_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byKind: index("alerts_kind_idx").on(t.kind),
  uniqDedup: unique("alerts_dedup_unique").on(t.dedupKey),
}));

export type Alert = typeof alertsTable.$inferSelect;
