/**
 * Résolution centralisée de l'URL publique utilisée dans les liens des emails
 * (invitations, réinitialisation de mot de passe, etc.).
 *
 * Priorité :
 *   1. PUBLIC_BASE_URL explicite (à définir si un domaine personnalisé est utilisé)
 *   2. Premier domaine public Replit (REPLIT_DOMAINS) — fixé automatiquement en
 *      production, c'est le cas nominal pour un déploiement Replit.
 *   3. Domaine de développement Replit (REPLIT_DEV_DOMAIN)
 *   4. localhost (dernier recours)
 *
 * On n'utilise JAMAIS l'en-tête `Host` de la requête : derrière le proxy mTLS de
 * Replit il peut être incorrect et produire des liens cassés.
 */
export function getPublicBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const host = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "localhost";
  return `https://${host}`.replace(/\/$/, "");
}

/**
 * URL publique du Cockpit super-admin. Identique à l'URL publique sauf si
 * COCKPIT_PUBLIC_BASE_URL est défini (Cockpit hébergé sur un domaine dédié).
 */
export function getCockpitBaseUrl(): string {
  if (process.env.COCKPIT_PUBLIC_BASE_URL) return process.env.COCKPIT_PUBLIC_BASE_URL.replace(/\/$/, "");
  return getPublicBaseUrl();
}
