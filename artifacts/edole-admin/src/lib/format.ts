export function formatFCFA(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "0 FCFA";
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(amount) + " FCFA";
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
