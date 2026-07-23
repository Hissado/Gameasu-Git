import { pgTable, text, integer, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizationsTable } from "./saas";

/**
 * Numérotation unifiée des documents (audit P2 §F #15).
 *
 * Un format unique et configurable par organisation :
 *   {PRÉFIXE}-{AAAA}-{NNNNN}   ex. FAC-2026-00001
 *
 * - `document_number_sequences` : compteur atomique par (org, type, année).
 *   L'allocation se fait par INSERT … ON CONFLICT DO UPDATE … RETURNING,
 *   garantissant l'unicité et la continuité même sous forte concurrence,
 *   sans dépendre d'un COUNT (robuste aux suppressions de lignes).
 * - `document_number_settings` : surcharge optionnelle du préfixe / largeur
 *   de padding par organisation et par type (sinon valeurs par défaut du code).
 */

export const documentNumberSequencesTable = pgTable("document_number_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),        // invoice | order | proforma | credit_note | supplier_invoice | purchase_order | payment | journal_entry
  year: integer("year").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uidx: uniqueIndex("doc_number_seq_uidx").on(t.organizationId, t.docType, t.year),
}));

export const documentNumberSettingsTable = pgTable("document_number_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),
  prefix: text("prefix").notNull(),
  padding: integer("padding").notNull().default(5),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uidx: uniqueIndex("doc_number_settings_uidx").on(t.organizationId, t.docType),
}));

export type DocumentNumberSetting = typeof documentNumberSettingsTable.$inferSelect;
