import { pgTable, text, timestamp, uuid, numeric, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { organizationsTable } from "./saas";

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  referenceNumber: text("reference_number").notNull(),
  clientId: uuid("client_id").references(() => clientsTable.id),
  status: text("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }),
  currency: text("currency").default("XOF"),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const proformasTable = pgTable("proformas", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  referenceNumber: text("reference_number").notNull(),
  orderId: uuid("order_id").references(() => ordersTable.id),
  clientId: uuid("client_id").references(() => clientsTable.id),
  status: text("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }),
  currency: text("currency").default("XOF"),
  validUntil: text("valid_until"),
  notes: text("notes"),
  caution: numeric("caution", { precision: 15, scale: 2 }),
  paymentTerms: text("payment_terms"),
  durationDays: integer("duration_days"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const invoicesTable = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  referenceNumber: text("reference_number").notNull(),
  proformaId: uuid("proforma_id").references(() => proformasTable.id),
  clientId: uuid("client_id").references(() => clientsTable.id),
  status: text("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default("0"),
  currency: text("currency").default("XOF"),
  dueDate: text("due_date"),
  issuedAt: text("issued_at"),
  notes: text("notes"),
  publicToken: text("public_token").unique(),
  dunningStatus: text("dunning_status").default("none"),
  lastDunnedAt: text("last_dunned_at"),
  promisedPaymentDate: text("promised_payment_date"),
  promisedPaymentAmount: numeric("promised_payment_amount", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").default("XOF"),
  method: text("method").notNull(),
  reference: text("reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── CREDIT NOTES / AVOIRS ────────────────────────────────────────────────────
export const creditNotesTable = pgTable("credit_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  referenceNumber: text("reference_number").notNull(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id),
  clientId: uuid("client_id").references(() => clientsTable.id),
  reason: text("reason").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  appliedAmount: numeric("applied_amount", { precision: 15, scale: 2 }).default("0"),
  currency: text("currency").default("XOF"),
  // draft | issued | applied | cancelled
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  orgIdx: index("cn_org_idx").on(t.organizationId),
  invoiceIdx: index("cn_invoice_idx").on(t.invoiceId),
}));

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const insertProformaSchema = createInsertSchema(proformasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProforma = z.infer<typeof insertProformaSchema>;
export type Proforma = typeof proformasTable.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;

export const insertCreditNoteSchema = createInsertSchema(creditNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCreditNote = z.infer<typeof insertCreditNoteSchema>;
export type CreditNote = typeof creditNotesTable.$inferSelect;
