import { ApiError } from "@/lib/api";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Requête invalide — vérifiez les données saisies.",
  401: "Session expirée — veuillez vous reconnecter.",
  403: "Action non autorisée.",
  404: "Ressource introuvable.",
  409: "Conflit — cette ressource existe déjà.",
  422: "Données invalides — vérifiez le formulaire.",
  429: "Trop de requêtes — veuillez patienter.",
  500: "Erreur serveur — veuillez réessayer dans quelques instants.",
  503: "Service temporairement indisponible.",
};

/**
 * Extrait un message d'erreur lisible en français depuis n'importe quelle erreur.
 * Évite d'afficher des codes HTTP bruts ("HTTP 500") aux utilisateurs.
 */
export function apiErrorMessage(
  error: unknown,
  fallback = "Une erreur est survenue.",
): string {
  if (error instanceof ApiError) {
    const bodyMsg =
      error.body?.error || error.body?.message || error.body?.detail;
    if (bodyMsg && typeof bodyMsg === "string" && !bodyMsg.startsWith("HTTP "))
      return bodyMsg;
    return STATUS_MESSAGES[error.status] ?? fallback;
  }
  if (error instanceof Error) {
    if (error.message && !error.message.startsWith("HTTP "))
      return error.message;
  }
  return fallback;
}
