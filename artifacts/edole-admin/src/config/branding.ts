/**
 * Branding centralisé Gaméasù (frontend).
 * Toute mention de nom, slogan ou identité visuelle doit passer par ici
 * pour rester rebrandable en un seul endroit.
 */
import gameasuLogo from "@/assets/gameasu-logo.png";

export const BRANDING = {
  appName: import.meta.env.VITE_APP_NAME ?? "Gameasu",
  appShortName: "Gameasu",
  appTaglineFr: import.meta.env.VITE_APP_TAGLINE_FR ?? "Gérer aujourd'hui. Construire demain.",
  appTaglineEn: import.meta.env.VITE_APP_TAGLINE_EN ?? "Manage today. Build tomorrow.",
  defaultPlanCode: import.meta.env.VITE_DEFAULT_PLAN_CODE ?? "STARTER",
  primaryColor: "#C8A24B",
  secondaryColor: "#0F1A3A",
  logoFull: gameasuLogo,
  logoFullTransparent: gameasuLogo,
  logoMark: gameasuLogo,
  legalName: "Gaméasù Technology",
  marketBaseline: "Conçu pour les organisations du Togo et d'Afrique de l'Ouest francophone",
} as const;

export type Branding = typeof BRANDING;
