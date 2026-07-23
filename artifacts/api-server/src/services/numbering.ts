import { db } from "@workspace/db";
import { documentNumberSequencesTable, documentNumberSettingsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * Numérotation unifiée des documents (audit P2 §F #15).
 * Format : {PRÉFIXE}-{AAAA}-{NNNNN}, préfixe et padding configurables par
 * organisation (table document_number_settings), sinon valeurs par défaut.
 * L'allocation du numéro est ATOMIQUE (INSERT … ON CONFLICT DO UPDATE …
 * RETURNING) : jamais de doublon, jamais de trou dû à une collision.
 */

export type DocType =
  | "invoice"
  | "order"
  | "proforma"
  | "credit_note"
  | "supplier_invoice"
  | "purchase_order"
  | "payment"
  | "journal_entry";

/** Préfixes par défaut (français, homogènes). */
export const DEFAULT_PREFIXES: Record<DocType, string> = {
  invoice: "FAC",
  order: "CMD",
  proforma: "DEV",
  credit_note: "AV",
  supplier_invoice: "FF",
  purchase_order: "BC",
  payment: "PAY",
  journal_entry: "ECR",
};

const DEFAULT_PADDING = 5;

/**
 * Alloue le prochain numéro pour un type de document et une organisation.
 * Accepte un `tx` pour rester atomique avec l'insertion du document.
 */
export async function nextDocumentNumber(
  organizationId: string,
  docType: DocType,
  opts: { date?: Date; tx?: any } = {},
): Promise<string> {
  const exec = opts.tx ?? db;
  const year = (opts.date ?? new Date()).getFullYear();

  // Préfixe / padding : surcharge éventuelle du tenant, sinon défaut.
  const [setting] = await exec
    .select()
    .from(documentNumberSettingsTable)
    .where(and(
      eq(documentNumberSettingsTable.organizationId, organizationId),
      eq(documentNumberSettingsTable.docType, docType),
    ))
    .limit(1);
  const prefix = setting?.prefix ?? DEFAULT_PREFIXES[docType];
  const padding = setting?.padding ?? DEFAULT_PADDING;

  // Incrément atomique du compteur (org, type, année).
  const [row] = await exec
    .insert(documentNumberSequencesTable)
    .values({ organizationId, docType, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [
        documentNumberSequencesTable.organizationId,
        documentNumberSequencesTable.docType,
        documentNumberSequencesTable.year,
      ],
      set: { lastNumber: sql`${documentNumberSequencesTable.lastNumber} + 1` },
    })
    .returning({ lastNumber: documentNumberSequencesTable.lastNumber });

  return `${prefix}-${year}-${String(row.lastNumber).padStart(padding, "0")}`;
}

/** Préfixes effectifs (défauts + surcharges) — pour l'écran de configuration. */
export async function getNumberingSettings(organizationId: string) {
  const overrides = await db
    .select()
    .from(documentNumberSettingsTable)
    .where(eq(documentNumberSettingsTable.organizationId, organizationId));
  const byType = new Map(overrides.map((o) => [o.docType, o]));
  return (Object.keys(DEFAULT_PREFIXES) as DocType[]).map((docType) => ({
    docType,
    prefix: byType.get(docType)?.prefix ?? DEFAULT_PREFIXES[docType],
    padding: byType.get(docType)?.padding ?? DEFAULT_PADDING,
    isCustom: byType.has(docType),
  }));
}

/** Définit/retire une surcharge de préfixe pour un type de document. */
export async function setNumberingPrefix(
  organizationId: string,
  docType: DocType,
  prefix: string,
  padding = DEFAULT_PADDING,
) {
  await db
    .insert(documentNumberSettingsTable)
    .values({ organizationId, docType, prefix, padding })
    .onConflictDoUpdate({
      target: [documentNumberSettingsTable.organizationId, documentNumberSettingsTable.docType],
      set: { prefix, padding },
    });
}
