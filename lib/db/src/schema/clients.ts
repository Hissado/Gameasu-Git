import { pgTable, text, timestamp, uuid, index, boolean, numeric, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./saas";

// ── Types JSONB ──────────────────────────────────────────────────

export type AddressJson = {
  rue?: string;
  commune?: string;
  ville?: string;
  region?: string;
  pays?: string;
  codePostal?: string;
  sameAsMain?: boolean;
};

// ── CLIENTS ──────────────────────────────────────────────────────

export const clientsTable = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),

  // ── Identité ──
  type: text("type").default("entreprise"),              // entreprise | particulier | administration | ong | association
  name: text("name").notNull(),                          // Raison sociale / Nom
  commercialName: text("commercial_name"),               // Nom commercial / enseigne

  // ── Contact principal ──
  contactTitle: text("contact_title"),                   // M. | Mme | Dr. | Pr.
  contactName: text("contact_name"),                     // Nom complet du contact principal
  contactFunction: text("contact_function"),             // Poste / Fonction
  contactPhotoUrl: text("contact_photo_url"),

  // ── Coordonnées ──
  phone: text("phone"),
  phone2: text("phone2"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  email2: text("email2"),
  website: text("website"),
  logoUrl: text("logo_url"),

  // ── Adresse principale ──
  country: text("country").default("TG"),
  region: text("region"),
  city: text("city"),
  commune: text("commune"),
  quartier: text("quartier"),
  rue: text("rue"),
  postalCode: text("postal_code"),
  gpsLat: text("gps_lat"),
  gpsLng: text("gps_lng"),
  address: text("address"),                              // Adresse libre / legacy

  // ── Adresses spécifiques ──
  billingAddress: jsonb("billing_address").$type<AddressJson>(),
  shippingAddress: jsonb("shipping_address").$type<AddressJson>(),

  // ── Informations administratives ──
  ifu: text("ifu"),                                      // Numéro fiscal / identifiant fiscal
  rccm: text("rccm"),                                    // Registre de commerce
  vatNumber: text("vat_number"),                         // Numéro TVA
  statisticNumber: text("statistic_number"),             // Numéro statistique
  industry: text("industry"),                            // Secteur d'activité
  companySize: text("company_size"),                     // tpe | pme | eti | ge
  foundedDate: text("founded_date"),                     // Date de création
  employeeCount: integer("employee_count"),
  preferredCurrency: text("preferred_currency").default("XOF"),
  preferredLanguage: text("preferred_language").default("fr"),

  // ── Informations commerciales ──
  assignedUserId: uuid("assigned_user_id"),              // Commercial responsable
  source: text("source"),                                // Bouche-à-oreille | Salon | LinkedIn | etc.
  category: text("category"),                            // Grand compte | PME | Start-up | etc.
  segment: text("segment"),                              // Strategic | Standard | Premium | etc.
  acquisitionChannel: text("acquisition_channel"),       // Inbound | Outbound | Partenaire | etc.
  priority: text("priority").default("normale"),         // haute | normale | basse
  potential: text("potential"),                          // faible | moyen | fort
  firstContactDate: text("first_contact_date"),
  conversionDate: text("conversion_date"),

  // ── Statut ──
  status: text("status").notNull().default("prospect"),  // prospect | lead | client | active | inactive | vip

  // ── Paramètres financiers ──
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
  paymentTermsDays: integer("payment_terms_days").default(30),
  paymentConditions: text("payment_conditions"),         // À vue | 30 jours net | 60 jours | etc.
  preferredPaymentMode: text("preferred_payment_mode"), // virement | cheque | especes | mobile_money
  vatExempt: boolean("vat_exempt").default(false),
  discountRate: numeric("discount_rate", { precision: 5, scale: 2 }),
  specialConditions: text("special_conditions"),

  // ── Extensibilité ──
  customFields: jsonb("custom_fields").$type<Record<string, string>>(),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  clientsDeletedAtIdx: index("clients_deleted_at_idx").on(t.deletedAt),
  clientsStatusIdx: index("clients_status_idx").on(t.status),
}));

// ── CONTACTS CLIENT ───────────────────────────────────────────────

export const clientContactsTable = pgTable("client_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title"),                                  // M. | Mme | Dr.
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  function: text("function"),                            // Poste / Fonction
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  role: text("role"),                                    // DG | DAF | Comptable | Acheteur | etc.
  isPrimary: text("is_primary").default("false"),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  clientContactsClientIdx: index("client_contacts_client_idx").on(t.clientId),
}));

// ── EMAILS ────────────────────────────────────────────────────────

export const clientEmailLogsTable = pgTable("client_email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clientsTable.id),
  direction: text("direction").notNull().default("outbound"),
  subject: text("subject").notNull(),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  preview: text("preview"),
  body: text("body"),
  hasAttachments: boolean("has_attachments").default(false),
  status: text("status").default("sent"),
  resendMessageId: text("resend_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  clientEmailLogsClientIdx: index("client_email_logs_client_idx").on(t.clientId),
  clientEmailLogsSentAtIdx: index("client_email_logs_sent_at_idx").on(t.sentAt),
}));

export type ClientEmailLog = typeof clientEmailLogsTable.$inferSelect;

// ── NOTES CLIENT ──────────────────────────────────────────────────

export const clientNotesTable = pgTable("client_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  authorId: uuid("author_id"),
  content: text("content").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  clientNotesClientIdx: index("client_notes_client_idx").on(t.clientId),
}));

export type ClientNote = typeof clientNotesTable.$inferSelect;

// ── Zod schemas ───────────────────────────────────────────────────

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

export const insertClientContactSchema = createInsertSchema(clientContactsTable).omit({ id: true, createdAt: true });
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;
export type ClientContact = typeof clientContactsTable.$inferSelect;
