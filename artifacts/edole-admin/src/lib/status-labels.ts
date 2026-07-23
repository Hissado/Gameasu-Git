/**
 * Libellés français des statuts (audit P3 §I — harmonisation du vocabulaire).
 * Source unique pour traduire les valeurs de statut techniques (stockées en
 * base en anglais) vers un affichage français homogène. Les valeurs inconnues
 * retombent sur une capitalisation simple plutôt que d'exposer le code brut.
 */

const STATUS_LABELS: Record<string, string> = {
  // Cycle de vie générique
  draft: "Brouillon",
  pending: "En attente",
  active: "Actif",
  inactive: "Inactif",
  archived: "Archivé",
  open: "Ouvert",
  closed: "Clôturé",
  completed: "Terminé",
  in_progress: "En cours",
  on_hold: "En pause",
  cancelled: "Annulé",
  canceled: "Annulé",
  expired: "Expiré",
  suspended: "Suspendu",
  // Validation / approbation
  submitted: "Soumis",
  review: "En revue",
  awaiting_approval: "En attente d'approbation",
  approved: "Approuvé",
  rejected: "Rejeté",
  validated: "Validé",
  reviewed: "Revu",
  resolved: "Résolu",
  // Facturation / règlement
  sent: "Envoyé",
  confirmed: "Confirmé",
  paid: "Payé",
  partially_paid: "Partiellement payé",
  overdue: "En retard",
  // Achat / réception
  partial: "Partiel",
  received: "Reçu",
  partially_received: "Partiellement reçu",
  // Comptabilité
  posted: "Comptabilisé",
  reversed: "Extourné",
  reconciled: "Rapproché",
  unreconciled: "Non rapproché",
  skipped: "Ignoré",
};

/** Traduit un code de statut en libellé français (repli : capitalisation). */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const key = String(status).toLowerCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  // Repli : remplace les underscores et capitalise le premier caractère.
  const pretty = key.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}
