/** Formatage FCFA complet : "325 200 000 FCFA" */
export function formatFCFA(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "0 FCFA";
  return (
    new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(amount) + "\u00A0FCFA"
  );
}

/** Formatage FCFA compact : "325,2\u202FM FCFA" — pour espaces restreints */
export function formatFCFACompact(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "0 FCFA";
  const abs = Math.abs(amount ?? 0);
  const sign = (amount ?? 0) < 0 ? "−" : "";
  if (abs >= 1_000_000_000) {
    return sign + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(abs / 1_000_000_000) + "\u202FMd\u00A0FCFA";
  }
  if (abs >= 1_000_000) {
    return sign + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(abs / 1_000_000) + "\u202FM\u00A0FCFA";
  }
  if (abs >= 1_000) {
    return sign + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(abs / 1_000) + "\u202Fk\u00A0FCFA";
  }
  return sign + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(abs) + "\u00A0FCFA";
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
