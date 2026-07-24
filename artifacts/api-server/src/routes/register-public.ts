/**
 * POST /api/public/register
 * Inscription libre SaaS — crée org + user + abonnement en pending_payment.
 * Route publique (avant requireAuth).
 *
 * Si l'email existe déjà : retourne 409 sans émettre de token.
 * La création d'une org supplémentaire pour un compte existant doit
 * passer par le parcours authentifié normal (POST /api/organizations),
 * qui garantit 2FA et toutes les vérifications de sécurité.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  organizationsTable,
  organizationMembersTable,
  organizationSubscriptionsTable,
  subscriptionPlansTable,
  billingEventsTable,
  paymentTransactionsTable,
  authSessionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { calcPlanPricing, getPlan } from "../lib/pricing";
import { sendEmail, buildRegistrationEmail } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";
import { logger } from "../lib/logger";
import { getFrameworkForOrgType, seedAccountingFrameworkForOrg, type AccountingFramework, ORG_TYPE_LABELS, FRAMEWORK_LABELS, FRAMEWORK_DESCRIPTIONS } from "../services/accounting-framework";

const router = Router();

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;

const VALID_ORG_TYPES = ["pme", "tpe", "cooperative", "ong", "banque", "microfinance", "assurance", "prevoyance", "administration", "cabinet", "autre"] as const;

const RegisterSchema = z.object({
  orgName:     z.string().min(2).max(100),
  email:       z.email(),
  password:    z.string().min(8).max(100),
  firstName:   z.string().min(1).max(50),
  lastName:    z.string().min(1).max(50),
  phone:       z.string().optional(),
  city:        z.string().optional(),
  planCode:    z.string().default("STARTER"),
  seats:       z.coerce.number().int().min(1).max(500).default(1),
  periodicity: z.enum(["monthly", "quarterly", "semiannual", "annual"]).default("monthly"),
  country:     z.string().optional(),
  industry:    z.string().optional(),
  orgType:     z.enum(VALID_ORG_TYPES).default("pme"),
});

const MONTHS_MAP: Record<string, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "org";
}

// ── POST /api/public/register ──────────────────────────────────────────────
router.post("/public/register", async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides", details: parsed.error.issues });
      return;
    }
    const data = parsed.data;

    // 1. Vérifier que l'email n'est pas déjà utilisé
    //    Si oui → 409 sans émettre de token.
    //    La création d'une org supplémentaire pour un compte existant passe
    //    obligatoirement par le parcours authentifié (POST /api/organizations)
    //    afin que 2FA et toutes les vérifications de sécurité s'appliquent.
    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, data.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      res.status(409).json({
        error: "Cet email est déjà associé à un compte Gameasu. Connectez-vous à votre espace existant.",
        code: "EMAIL_EXISTS",
      });
      return;
    }

    // 2. Valider le plan (pas Enterprise pour self-service)
    const plan = getPlan(data.planCode);
    if (!plan || plan.isEnterprise) {
      res.status(400).json({ error: "Ce plan n'est pas disponible à l'inscription libre. Contactez-nous pour le plan Personnalisé." });
      return;
    }

    // 3. Calculer le tarif (server-authoritative)
    const pricing = calcPlanPricing({ planCode: plan.code, seats: data.seats, periodicity: data.periodicity });
    if (!pricing) {
      res.status(400).json({ error: "Impossible de calculer le tarif pour ce plan." });
      return;
    }

    // 4. Trouver le plan en base (pour l'ID FK)
    const [planRow] = await db
      .select({ id: subscriptionPlansTable.id })
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.code, plan.code))
      .limit(1);
    if (!planRow) {
      res.status(500).json({ error: "Plan introuvable en base. Contactez le support Gameasu." });
      return;
    }

    // 5. Slug unique pour l'organisation
    const orgId  = randomUUID();
    const userId = randomUUID();
    const slug   = await uniqueSlug(slugify(data.orgName));

    // 6. Tout créer atomiquement en transaction DB
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const months = MONTHS_MAP[data.periodicity] ?? 1;
    const periodStart = new Date();
    const periodEnd   = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + months);
    const unitPrice = Math.round(plan.monthlyPriceTTC * (1 - pricing.discount));

    let txId = "";
    let subId = "";

    const resolvedOrgType = data.orgType ?? "pme";
    const resolvedFramework = getFrameworkForOrgType(resolvedOrgType) as AccountingFramework;

    await db.transaction(async (dbTx) => {
      await dbTx.insert(organizationsTable).values({
        id: orgId, slug, name: data.orgName,
        country: data.country ?? "TG",
        industry: data.industry ?? null,
        orgType: resolvedOrgType,
        accountingFramework: resolvedFramework,
        currency: "XOF",
        // L'org reste inactive jusqu'à confirmation du paiement
        isActive: false,
        contactEmail: data.email.toLowerCase(),
        contactPhone: data.phone ?? null,
      });

      await dbTx.insert(usersTable).values({
        id: userId,
        organizationId: orgId,
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        password: hashedPassword,
        role: "admin",
        isActive: true,
        mustChangePassword: false,
      });

      await dbTx.insert(organizationMembersTable).values({
        organizationId: orgId, userId,
        role: "owner", isPrimary: true,
      });

      const [subRow] = await dbTx
        .insert(organizationSubscriptionsTable)
        .values({
          organizationId: orgId,
          planId: planRow.id,
          status: "pending_payment",
          billingCycle: data.periodicity,
          seats: data.seats,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          unitPrice,
          isCurrent: true,
        })
        .returning({ id: organizationSubscriptionsTable.id });
      subId = subRow.id;

      const [evRow] = await dbTx
        .insert(billingEventsTable)
        .values({
          organizationId: orgId,
          subscriptionId: subId,
          kind: "setup",
          label: `Souscription ${plan.name} — ${data.seats} siège${data.seats > 1 ? "s" : ""} × ${months} mois`,
          amount: pricing.totalTTC,
          currency: "XOF",
          status: "pending",
        })
        .returning({ id: billingEventsTable.id });

      const [payRow] = await dbTx
        .insert(paymentTransactionsTable)
        .values({
          organizationId: orgId,
          subscriptionId: subId,
          billingEventId: evRow.id,
          amount: pricing.totalTTC,
          currency: "XOF",
          method: "pending",
          status: "pending",
          purpose: "setup_fee",
          planCode: plan.code,
          seats: data.seats,
          periodicity: data.periodicity,
        })
        .returning({ id: paymentTransactionsTable.id });
      txId = payRow.id;
    });

    // 7. Session
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(authSessionsTable).values({
      token, userId, expiresAt,
      activeOrgId: orgId,
      userAgent: (req.headers["user-agent"] as string) ?? null,
      ipAddress: req.ip ?? null,
    });

    // 7b. Seed plan comptable (best-effort, non bloquant)
    seedAccountingFrameworkForOrg(orgId, resolvedFramework).catch((e) => {
      logger.warn({ err: e, orgId, framework: resolvedFramework }, "[register] accounting framework seed failed");
    });

    // 8. Email de bienvenue (non-bloquant)
    try {
      const baseUrl = getPublicBaseUrl();
      const email = buildRegistrationEmail({
        firstName: data.firstName,
        orgName: data.orgName,
        planName: plan.name,
        seats: data.seats,
        totalTTC: pricing.totalTTC,
        billingUrl: `${baseUrl}/abonnement`,
      });
      await sendEmail({ ...email, to: data.email });
    } catch (emailErr) {
      logger.warn({ err: emailErr }, "[register] email de bienvenue non envoyé");
    }

    res.status(201).json({
      token,
      userId,
      orgId,
      pendingTxId: txId,
      subscriptionStatus: "pending_payment",
    });
  } catch (err) {
    next(err);
  }
});

// ── Génère un slug unique ──────────────────────────────────────────────────
async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 1; i < 100; i++) {
    const [taken] = await db
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, slug))
      .limit(1);
    if (!taken) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

// ── GET /api/public/accounting-frameworks ─────────────────────────────────
// Catalogue des référentiels comptables disponibles (sans authentification).

// Catalogue framework-centric : 9 référentiels, chacun liste ses org-types applicables.
const FRAMEWORK_CATALOG = (() => {
  // Déduire applicableOrgTypes depuis la mapping orgType → framework
  const byFw: Record<string, string[]> = {};
  for (const orgType of VALID_ORG_TYPES) {
    const fw = getFrameworkForOrgType(orgType);
    (byFw[fw] ??= []).push(orgType);
  }
  // Ordre stable : maintenir l'ordre de définition des codes connus
  const ORDER = ["syscohada", "syscohada_smt", "sycebnl", "pcb", "microfinance", "cima", "cipres", "pce", "autre"];
  return ORDER.map(code => ({
    code,
    label:            FRAMEWORK_LABELS[code as keyof typeof FRAMEWORK_LABELS] ?? code,
    description:      FRAMEWORK_DESCRIPTIONS[code as keyof typeof FRAMEWORK_DESCRIPTIONS] ?? "",
    applicableOrgTypes: byFw[code] ?? [],
  }));
})();

// Chemin canonique (sans préfixe /public/) — accessible sans auth
router.get("/accounting-frameworks", (_req, res) => {
  res.json(FRAMEWORK_CATALOG);
});

// Alias avec préfixe /public/ — conservé pour compatibilité
router.get("/public/accounting-frameworks", (_req, res) => {
  res.json(FRAMEWORK_CATALOG);
});

// ── GET /api/public/check-email ───────────────────────────────────────────
router.get("/public/check-email", async (req, res, next) => {
  try {
    const email = String(req.query["email"] ?? "").toLowerCase().trim();
    if (!email) { res.json({ available: false }); return; }
    const [row] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    res.json({ available: !row });
  } catch (err) {
    next(err);
  }
});

export default router;
