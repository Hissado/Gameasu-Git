/**
 * Branding centralisé Gameasu (frontend).
 * Toute mention de nom, slogan ou identité visuelle doit passer par ici
 * pour rester rebrandable en un seul endroit.
 */
import gameasuLogo from "@/assets/gameasu-logo.png";

export const BRANDING = {
  appName:       import.meta.env.VITE_APP_NAME    ?? "Gameasu",
  appShortName:  "Gameasu",
  brandName:     "Gameasu",
  companyName:   "Gameasu",
  legalName:     "Gameasu Technology",
  appTaglineFr:  import.meta.env.VITE_APP_TAGLINE_FR ?? "Gérer aujourd'hui. Construire demain.",
  appTaglineEn:  import.meta.env.VITE_APP_TAGLINE_EN ?? "Manage today. Build tomorrow.",

  // URLs
  mainDomain:    "gameasu.com",
  appUrl:        import.meta.env.VITE_APP_URL     ?? "https://app.gameasu.com",
  cockpitUrl:    import.meta.env.VITE_COCKPIT_URL ?? "https://cockpit.gameasu.com",

  // Contacts
  supportEmail:  "support@gameasu.com",
  noreplyEmail:  "noreply@gameasu.com",
  infoEmail:     "info@gameasu.com",
  salesEmail:    "sales@gameasu.com",

  // Billing
  defaultPlanCode: import.meta.env.VITE_DEFAULT_PLAN_CODE ?? "STARTER",

  // Design tokens
  primaryColor:  "#2563EB",   // Or sobre Gameasu
  secondaryColor:"#0F1A3A",   // Navy profond Gameasu
  accentColor:   "#2563EB",

  // Assets
  logoFull:             gameasuLogo,
  logoFullTransparent:  gameasuLogo,
  logoMark:             gameasuLogo,

  marketBaseline: "Conçu pour les organisations du Togo et d'Afrique de l'Ouest francophone",
} as const;

export type Branding = typeof BRANDING;
