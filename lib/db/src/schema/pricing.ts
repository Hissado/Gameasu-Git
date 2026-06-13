import { pgTable, text, timestamp, uuid, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";
import { organizationsTable } from "./saas";

export const pricingScenariosTable = pgTable("pricing_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  productName: text("product_name"),
  clientId: uuid("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  opportunityId: uuid("opportunity_id"),
  proformaId: uuid("proforma_id"),
  orderId: uuid("order_id"),
  invoiceId: uuid("invoice_id"),
  shareToken: uuid("share_token").notNull().defaultRandom(),
  shareEnabled: boolean("share_enabled").notNull().default(false),
  scenarioData: jsonb("scenario_data").notNull().$type<Record<string, unknown>>(),
  resultData: jsonb("result_data").$type<Record<string, unknown>>(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("pricing_scenarios_org_idx").on(t.organizationId),
  index("pricing_scenarios_client_idx").on(t.clientId),
  index("pricing_scenarios_share_token_idx").on(t.shareToken),
]);

export type PricingScenario = typeof pricingScenariosTable.$inferSelect;
export type NewPricingScenario = typeof pricingScenariosTable.$inferInsert;
