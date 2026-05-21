/**
 * Branding centralisé Gaméasù (backend).
 * Toute mention de nom de produit, slogan, couleur ou contact côté serveur
 * (emails, notifications, headers) doit passer par ce fichier.
 */
export const BRANDING = {
  appName: process.env.APP_NAME ?? "Gaméasù",
  appShortName: "Gaméasù",
  appTaglineFr: process.env.APP_TAGLINE_FR ?? "Gérer aujourd'hui. Construire demain.",
  appTaglineEn: process.env.APP_TAGLINE_EN ?? "Manage today. Build tomorrow.",
  appUrl: process.env.APP_URL ?? "",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@gameasu.africa",
  salesEmail: process.env.SALES_EMAIL ?? "sales@gameasu.africa",
  defaultCurrency: process.env.BILLING_CURRENCY ?? "XOF",
  defaultPlanCode: process.env.DEFAULT_PLAN_CODE ?? "STARTER",
  defaultBillingCycle: (process.env.DEFAULT_BILLING_CYCLE as "monthly" | "annual") ?? "monthly",
  defaultSetupFee: Number(process.env.DEFAULT_SETUP_FEE ?? 0),
  primaryColor: "#C8A24B",
  secondaryColor: "#0F1A3A",
} as const;

export type Branding = typeof BRANDING;
