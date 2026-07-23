/**
 * Contrôles de chronologie des dates (audit P2 §F #11).
 * Fonctions pures et testables — renvoient un message d'erreur en français ou
 * `null` si la chronologie est valide. Utilisées par les routes pour bloquer
 * les incohérences (échéance avant émission, paiement avant facture, etc.).
 */

function toTime(d: string | Date | null | undefined): number | null {
  if (d == null || d === "") return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

/** `after` doit être ≥ `before` (mêmes jours autorisés). */
export function checkOrder(
  before: string | Date | null | undefined,
  after: string | Date | null | undefined,
  message: string,
): string | null {
  const b = toTime(before);
  const a = toTime(after);
  if (b == null || a == null) return null; // dates optionnelles : pas de contrôle
  return a + 86_400_000 - 1 < b ? message : null;
}

/** Regroupe plusieurs contrôles et renvoie le premier message d'erreur. */
export function firstError(...checks: (string | null)[]): string | null {
  return checks.find((c) => c != null) ?? null;
}

// ── Raccourcis métier ────────────────────────────────────────────────────────

export const invoiceDatesError = (issuedAt?: string | Date | null, dueDate?: string | Date | null) =>
  checkOrder(issuedAt, dueDate, "L'échéance ne peut pas précéder la date d'émission.");

export const paymentDateError = (invoiceIssuedAt?: string | Date | null, paidAt?: string | Date | null) =>
  checkOrder(invoiceIssuedAt, paidAt, "La date de règlement ne peut pas précéder la date de la facture.");

export const receptionDateError = (orderDate?: string | Date | null, receivedDate?: string | Date | null) =>
  checkOrder(orderDate, receivedDate, "La date de réception ne peut pas précéder la date de commande.");

export const contractDatesError = (startDate?: string | Date | null, endDate?: string | Date | null) =>
  checkOrder(startDate, endDate, "La date de fin de contrat ne peut pas précéder la date de début.");
