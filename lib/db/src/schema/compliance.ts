import { pgTable, text, timestamp, uuid, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { organizationsTable } from "./saas";
import { usersTable } from "./users";

// ─── SCANNER OCR — Factures intelligentes ─────────────────────────────────────
export const invoiceScansTable = pgTable("invoice_scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  uploadedById: uuid("uploaded_by_id").references(() => usersTable.id),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type").notNull().default("application/pdf"),
  fileSizeBytes: integer("file_size_bytes"),
  // pending | processing | done | error
  status: text("status").notNull().default("pending"),
  extractedData: jsonb("extracted_data"),
  rawOcrText: text("raw_ocr_text"),
  aiConfidence: text("ai_confidence"),
  aiModel: text("ai_model"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  linkedEntryId: uuid("linked_entry_id"),
  linkedSupplierInvoiceId: uuid("linked_supplier_invoice_id"),
  errorMessage: text("error_message"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type InvoiceScan = typeof invoiceScansTable.$inferSelect;

// ─── CACHET NUMÉRIQUE ─────────────────────────────────────────────────────────
// (préfixe "doc_" pour éviter conflit avec d'éventuels noms génériques)
export const documentSealsTable = pgTable("document_seals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  documentId: uuid("document_id").notNull(),
  contentHash: text("content_hash").notNull(),
  sealedById: uuid("sealed_by_id").references(() => usersTable.id),
  sealedAt: timestamp("sealed_at", { withTimezone: true }).notNull().defaultNow(),
  sealImageUrl: text("seal_image_url"),
  sealImageBase64: text("seal_image_base64"),
  sealMetadata: jsonb("seal_metadata"),
  isValid: boolean("is_valid").notNull().default(true),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: text("revoked_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DocumentSeal = typeof documentSealsTable.$inferSelect;

// ─── WORKFLOW DE SIGNATURE DOCUMENTAIRE ───────────────────────────────────────
// Nommé "doc_sig_*" pour éviter le conflit avec signatureRequestsTable (benefits.ts)
export const docSigRequestsTable = pgTable("doc_sig_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  documentId: uuid("document_id").notNull(),
  documentLabel: text("document_label").notNull(),
  createdById: uuid("created_by_id").references(() => usersTable.id),
  // pending | partially_signed | completed | rejected | cancelled
  status: text("status").notNull().default("pending"),
  message: text("message"),
  dueDate: text("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type DocSigRequest = typeof docSigRequestsTable.$inferSelect;

export const docSigSignersTable = pgTable("doc_sig_signers", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => docSigRequestsTable.id, { onDelete: "cascade" }),
  signerId: uuid("signer_id").references(() => usersTable.id),
  signerEmail: text("signer_email").notNull(),
  signerName: text("signer_name").notNull(),
  signerRole: text("signer_role"),
  order: integer("order").notNull().default(0),
  // pending | signed | rejected
  status: text("status").notNull().default("pending"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  fingerprint: text("fingerprint"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DocSigSigner = typeof docSigSignersTable.$inferSelect;
