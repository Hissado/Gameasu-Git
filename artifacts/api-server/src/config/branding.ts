/**
 * Branding centralisé Nexora (backend).
 * Toute mention de nom de produit, slogan, couleur ou contact côté serveur
 * (emails, notifications, headers) doit passer par ce fichier.
 */
export const BRANDING = {
  appName: process.env.APP_NAME ?? "Nexora",
  appShortName: "Nexora",
  appTaglineFr: process.env.APP_TAGLINE_FR ?? "Le pilotage d'entreprise nouvelle génération",
  appTaglineEn: process.env.APP_TAGLINE_EN ?? "The operating system for modern organizations",
  appUrl: process.env.APP_URL ?? "",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@nexora.africa",
  salesEmail: process.env.SALES_EMAIL ?? "sales@nexora.africa",
  defaultCurrency: process.env.BILLING_CURRENCY ?? "XOF",
  defaultPlanCode: process.env.DEFAULT_PLAN_CODE ?? "STARTER",
  defaultBillingCycle: (process.env.DEFAULT_BILLING_CYCLE as "monthly" | "annual") ?? "monthly",
  defaultSetupFee: Number(process.env.DEFAULT_SETUP_FEE ?? 0),
  primaryColor: "#FF6B00",
  secondaryColor: "#0F172A",
} as const;

export type Branding = typeof BRANDING;
