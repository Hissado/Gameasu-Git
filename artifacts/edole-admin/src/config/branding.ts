/**
 * Branding centralisé Nexora (frontend).
 * Toute mention de nom, slogan ou identité visuelle doit passer par ici
 * pour rester rebrandable en un seul endroit.
 */
export const BRANDING = {
  appName: import.meta.env.VITE_APP_NAME ?? "Nexora",
  appShortName: "Nexora",
  appTaglineFr: import.meta.env.VITE_APP_TAGLINE_FR ?? "Le pilotage d'entreprise nouvelle génération",
  appTaglineEn: import.meta.env.VITE_APP_TAGLINE_EN ?? "The operating system for modern organizations",
  defaultPlanCode: import.meta.env.VITE_DEFAULT_PLAN_CODE ?? "STARTER",
  primaryColor: "#FF6B00",
  secondaryColor: "#0F172A",
  logoFull: "/branding/nexora-logo.svg",
  logoMark: "/branding/nexora-mark.svg",
  legalName: "Nexora SAS",
  marketBaseline: "Conçu pour les organisations du Togo et d'Afrique de l'Ouest francophone",
} as const;

export type Branding = typeof BRANDING;
