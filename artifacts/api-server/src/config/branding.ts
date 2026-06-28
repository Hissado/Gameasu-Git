/**
 * Branding centralisé Gameasu (backend).
 * Toute mention de nom de produit, slogan, couleur ou contact côté serveur
 * (emails, notifications, headers) doit passer par ce fichier.
 */
export const BRANDING = {
  appName:            process.env.APP_NAME          ?? "Gameasu",
  appShortName:       "Gameasu",
  brandName:          "Gameasu",
  companyName:        "Gameasu",
  legalName:          "Gameasu Technology",
  appTaglineFr:       process.env.APP_TAGLINE_FR    ?? "Gérer aujourd'hui. Construire demain.",
  appTaglineEn:       process.env.APP_TAGLINE_EN    ?? "Manage today. Build tomorrow.",

  // URLs
  mainDomain:         process.env.MAIN_DOMAIN       ?? "gameasu.com",
  appUrl:             process.env.APP_URL            ?? "https://app.gameasu.com",
  cockpitUrl:         process.env.COCKPIT_URL        ?? "https://cockpit.gameasu.com",

  // Contacts
  supportEmail:       process.env.SUPPORT_EMAIL     ?? "support@gameasu.com",
  noreplyEmail:       process.env.NOREPLY_EMAIL      ?? "noreply@gameasu.com",
  infoEmail:          process.env.INFO_EMAIL         ?? "info@gameasu.com",
  salesEmail:         process.env.SALES_EMAIL        ?? "sales@gameasu.com",

  // Billing
  defaultCurrency:    process.env.BILLING_CURRENCY  ?? "XOF",
  defaultPlanCode:    process.env.DEFAULT_PLAN_CODE  ?? "STARTER",
  defaultBillingCycle:(process.env.DEFAULT_BILLING_CYCLE as "monthly" | "annual") ?? "monthly",
  defaultSetupFee:    Number(process.env.DEFAULT_SETUP_FEE ?? 0),

  // Design tokens (pour emails, PDFs, Excel)
  primaryColor:  "#C8A24B",   // Or sobre Gameasu
  secondaryColor:"#0F1A3A",   // Navy profond Gameasu
  accentColor:   "#C8A24B",
} as const;

export type Branding = typeof BRANDING;
