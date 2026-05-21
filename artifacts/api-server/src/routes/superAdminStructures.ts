/**
 * Super-admin — onboarding d'une nouvelle structure cliente.
 *
 * Deux modes :
 *  A. Mode complet : `POST /api/super-admin/structures`
 *     → crée l'organisation, l'abonnement (essai 14 j), l'admin, et envoie une invitation.
 *  B. Mode lien : `POST /api/super-admin/structures/invite-link`
 *     → génère un token, l'invité finalise lui-même son org + plan via `/onboard-structure`.
 *
 * Endpoints publics associés :
 *  - GET  /api/structure-onboarding/:token  (valide le token, renvoie le contexte)
 *  - POST /api/structure-onboarding/:token  (finalise : org + admin + plan + trial 14 j)
 */
import { Router, type IRouter, type RequestHandler } from "express";
import {
  db,
  organizationsTable,
  organizationMembersTable,
  organizationSubscriptionsTable,
  organizationModulesTable,
  subscriptionPlansTable,
  structureInvitationsTable,
  usersTable,
  billingEventsTable,
} from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { sendEmail, buildInvitationEmail } from "../lib/email";

const router: IRouter = Router();

const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") {
    res.status(403).json({ error: "Accès réservé aux super-administrateurs" });
    return;
  }
  next();
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRIAL_DAYS = 14;
const INVITE_TTL_DAYS = 14;

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || `org-${Date.now()}`;
}

async function uniqueSlug(base: string): Promise<string> {
  // Pre-check qui réduit les collisions; en cas de race concurrente, l'INSERT
  // est protégé par retry dans createStructure (catch unique-violation 23505).
  let slug = base; let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [existing] = await db.select({ id: organizationsTable.id })
      .from(organizationsTable).where(eq(organizationsTable.slug, slug)).limit(1);
    if (!existing) return slug;
    slug = `${base}-${i++}`;
    if (i > 50) return `${base}-${Date.now()}`;
  }
}

function genToken(): string { return randomBytes(32).toString("hex"); }
function genTempPassword(): string { return randomBytes(6).toString("base64").replace(/[+/=]/g, "").slice(0, 10); }
function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "localhost"}`).replace(/\/$/, "");
}

/**
 * Crée org + abonnement (trial 14 j) + modules + admin invité.
 * Logique partagée par le mode complet et l'acceptation publique.
 */
async function createStructure(opts: {
  orgName: string;
  planCode: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  country?: string;
  industry?: string;
  invitedById?: string | null;
}): Promise<{
  organization: typeof organizationsTable.$inferSelect;
  plan: typeof subscriptionPlansTable.$inferSelect;
  subscription: typeof organizationSubscriptionsTable.$inferSelect;
  userId: string;
  acceptToken: string;
  acceptUrl: string;
  temporaryPassword: string;
  expiresAt: Date;
}> {
  const email = opts.adminEmail.toLowerCase().trim();
  if (!EMAIL_RE.test(email)) throw Object.assign(new Error("Email administrateur invalide"), { status: 400 });
  if (!opts.adminFirstName.trim() || !opts.adminLastName.trim()) {
    throw Object.assign(new Error("Prénom et nom requis"), { status: 400 });
  }
  if (!opts.orgName.trim()) throw Object.assign(new Error("Nom de l'organisation requis"), { status: 400 });

  // 1) Plan
  const [plan] = await db.select().from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.code, opts.planCode.toUpperCase())).limit(1);
  if (!plan) throw Object.assign(new Error("Plan introuvable"), { status: 404 });

  // 2) Email libre
  const [existingUser] = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existingUser) throw Object.assign(new Error("Un compte existe déjà avec cet email"), { status: 409 });

  // 3) Slug (avec retry sur unique-violation lors de l'INSERT)
  const baseSlug = slugify(opts.orgName);
  let slug = await uniqueSlug(baseSlug);

  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 86400000);
  const tempPassword = genTempPassword();
  const acceptToken = genToken();
  const expiresAt = new Date(now.getTime() + 7 * 86400000);
  const userId = randomUUID();

  const runTransaction = async (slugCandidate: string) => db.transaction(async (tx) => {
    // a) Organisation
    const [org] = await tx.insert(organizationsTable).values({
      slug: slugCandidate, name: opts.orgName.trim(),
      country: opts.country ?? "TG",
      industry: opts.industry ?? null,
      isActive: true, isDefault: false,
    }).returning();

    // b) Abonnement en essai 14 j
    const cycle = "monthly";
    const unitPrice = plan.monthlyPricePerSeat;
    const [sub] = await tx.insert(organizationSubscriptionsTable).values({
      organizationId: org.id,
      planId: plan.id,
      status: "trial",
      billingCycle: cycle,
      seats: plan.includedSeats,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialEndsAt: trialEnd,
      unitPrice,
      setupFee: plan.setupFee ?? 0,
      currency: plan.currency,
      isCurrent: true,
      notes: `Essai gratuit ${TRIAL_DAYS} jours`,
    }).returning();

    // c) Modules du plan
    const modules = (plan.includedModules ?? []) as string[];
    if (modules.length > 0) {
      await tx.insert(organizationModulesTable).values(
        modules.map((k) => ({ organizationId: org.id, moduleKey: k, enabled: true, source: "plan" as const })),
      );
    }

    // d) Utilisateur admin (invité) — rattaché directement à l'org (multi-tenant)
    await tx.insert(usersTable).values({
      id: userId,
      organizationId: org.id,
      email,
      password: tempPassword,
      firstName: opts.adminFirstName.trim(),
      lastName: opts.adminLastName.trim(),
      role: "admin",
      isActive: true,
      mustChangePassword: true,
      passwordResetToken: acceptToken,
      passwordResetTokenExpiresAt: expiresAt,
      invitedById: opts.invitedById ?? null,
      invitedAt: now,
    });

    // e) Membership owner
    await tx.insert(organizationMembersTable).values({
      organizationId: org.id, userId, role: "owner", isPrimary: true,
    });

    // f) Billing event d'ouverture
    await tx.insert(billingEventsTable).values({
      organizationId: org.id, subscriptionId: sub.id,
      kind: "trial_started", label: `Démarrage essai ${TRIAL_DAYS} jours — ${plan.name}`,
      amount: 0, status: "paid", currency: plan.currency,
      reference: `NX-TRIAL-${Date.now()}`,
    });

    return { org, sub };
  });

  let result: Awaited<ReturnType<typeof runTransaction>>;
  try {
    result = await runTransaction(slug);
  } catch (e: any) {
    // 23505 = unique_violation Postgres (collision sur le slug en cas de race)
    if (e?.code === "23505" && String(e?.detail ?? "").includes("slug")) {
      slug = `${baseSlug}-${Date.now()}`;
      result = await runTransaction(slug);
    } else { throw e; }
  }

  const acceptUrl = `${baseUrl()}/accept-invitation?token=${acceptToken}`;

  return {
    organization: result.org,
    plan,
    subscription: result.sub,
    userId,
    acceptToken,
    acceptUrl,
    temporaryPassword: tempPassword,
    expiresAt,
  };
}

// ─────────────────────────────────────────────────────────────────
// Mode A : super-admin crée tout + envoie email d'invitation
// ─────────────────────────────────────────────────────────────────
router.post("/super-admin/structures", sa, async (req, res, next) => {
  try {
    const {
      orgName, planCode, adminEmail, adminFirstName, adminLastName,
      country, industry, sendEmailInvite = true,
    } = req.body || {};

    const created = await createStructure({
      orgName: String(orgName ?? ""),
      planCode: String(planCode ?? ""),
      adminEmail: String(adminEmail ?? ""),
      adminFirstName: String(adminFirstName ?? ""),
      adminLastName: String(adminLastName ?? ""),
      country: country ? String(country) : undefined,
      industry: industry ? String(industry) : undefined,
      invitedById: req.authUser?.id ?? null,
    });

    let delivery: any = null;
    if (sendEmailInvite) {
      const tpl = buildInvitationEmail({
        recipientName: `${req.body.adminFirstName} ${req.body.adminLastName}`,
        inviterName: req.authUser ? `${req.authUser.firstName} ${req.authUser.lastName}` : "L'équipe Gaméasù",
        orgName: created.organization.name,
        acceptUrl: created.acceptUrl,
        temporaryPassword: created.temporaryPassword,
      });
      delivery = await sendEmail({ ...tpl, to: req.body.adminEmail }).catch((e) => ({ error: e?.message }));
    }

    return res.status(201).json({
      organization: created.organization,
      subscription: created.subscription,
      plan: { code: created.plan.code, name: created.plan.name },
      admin: {
        userId: created.userId,
        email: req.body.adminEmail,
        firstName: req.body.adminFirstName,
        lastName: req.body.adminLastName,
      },
      acceptUrl: created.acceptUrl,
      temporaryPassword: created.temporaryPassword,
      expiresAt: created.expiresAt,
      trialEndsAt: created.subscription.trialEndsAt,
      delivery,
    });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// ─────────────────────────────────────────────────────────────────
// Mode B : super-admin envoie juste un lien d'auto-onboarding
// ─────────────────────────────────────────────────────────────────
router.post("/super-admin/structures/invite-link", sa, async (req, res, next) => {
  try {
    const {
      contactEmail, contactName, suggestedPlanCode, suggestedOrgName, notes,
      sendEmailInvite = true,
    } = req.body || {};

    if (contactEmail && !EMAIL_RE.test(String(contactEmail))) {
      return res.status(400).json({ error: "Email de contact invalide" });
    }
    if (suggestedPlanCode) {
      const [plan] = await db.select({ id: subscriptionPlansTable.id })
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.code, String(suggestedPlanCode).toUpperCase())).limit(1);
      if (!plan) return res.status(404).json({ error: "Plan suggéré introuvable" });
    }

    const token = genToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000);
    const [inv] = await db.insert(structureInvitationsTable).values({
      token,
      contactEmail: contactEmail ? String(contactEmail).toLowerCase() : null,
      contactName: contactName ? String(contactName) : null,
      suggestedPlanCode: suggestedPlanCode ? String(suggestedPlanCode).toUpperCase() : null,
      suggestedOrgName: suggestedOrgName ? String(suggestedOrgName) : null,
      notes: notes ? String(notes) : null,
      invitedById: req.authUser?.id ?? null,
      expiresAt,
    }).returning();

    const onboardUrl = `${baseUrl()}/onboard-structure?token=${token}`;

    let delivery: any = null;
    if (sendEmailInvite && contactEmail) {
      delivery = await sendEmail({
        to: String(contactEmail),
        subject: "Invitation à rejoindre Gaméasù",
        text: [
          `Bonjour ${contactName || ""},`,
          ``,
          `Vous êtes invité(e) à activer votre espace Gaméasù.`,
          ``,
          `Cliquez sur ce lien pour configurer votre organisation (essai gratuit ${TRIAL_DAYS} jours) :`,
          onboardUrl,
          ``,
          `Lien valable ${INVITE_TTL_DAYS} jours.`,
          ``,
          `À très bientôt,`,
          `L'équipe Gaméasù`,
        ].join("\n"),
        html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f7f7f7;padding:24px;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
  <div style="background:#0b0b0b;color:#fff;padding:24px 28px"><div style="color:#FF6B00;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:6px">GAMÉASÙ</div><h1 style="margin:0;font-size:22px">Activez votre espace</h1></div>
  <div style="padding:24px 28px;line-height:1.6">
    <p>Bonjour ${contactName || ""},</p>
    <p>Vous êtes invité(e) à créer votre organisation sur Gaméasù — pilotage d'entreprise nouvelle génération.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${onboardUrl}" style="background:#FF6B00;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Configurer mon espace</a>
    </p>
    <p style="font-size:13px;color:#555">Essai gratuit ${TRIAL_DAYS} jours, sans engagement. Lien valable ${INVITE_TTL_DAYS} jours.</p>
  </div>
</div></body></html>`,
      }).catch((e) => ({ error: e?.message }));
    }

    return res.status(201).json({
      invitation: inv,
      onboardUrl,
      expiresAt,
      delivery,
    });
  } catch (e) { next(e); }
});

// Liste des invitations
router.get("/super-admin/structure-invitations", sa, async (_req, res, next) => {
  try {
    const rows = await db.select().from(structureInvitationsTable)
      .orderBy(desc(structureInvitationsTable.createdAt));
    res.json({ count: rows.length, rows });
  } catch (e) { next(e); }
});

router.post("/super-admin/structure-invitations/:id/revoke", sa, async (req, res, next) => {
  try {
    const [updated] = await db.update(structureInvitationsTable)
      .set({ status: "revoked" })
      .where(and(
        eq(structureInvitationsTable.id, req.params.id),
        eq(structureInvitationsTable.status, "pending"),
      ))
      .returning();
    if (!updated) return res.status(404).json({ error: "Invitation introuvable ou déjà traitée" });
    res.json(updated);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// Public : validation + acceptation du lien d'auto-onboarding
// (montée hors du préfixe d'auth ; voir routes/index.ts)
// ─────────────────────────────────────────────────────────────────
export const publicOnboardingRouter: IRouter = Router();

publicOnboardingRouter.get("/structure-onboarding/:token", async (req, res, next) => {
  try {
    const [inv] = await db.select().from(structureInvitationsTable)
      .where(eq(structureInvitationsTable.token, req.params.token)).limit(1);
    if (!inv) return res.status(404).json({ error: "Lien invalide" });
    if (inv.status !== "pending") return res.status(410).json({ error: `Lien ${inv.status}` });
    if (inv.expiresAt < new Date()) {
      await db.update(structureInvitationsTable).set({ status: "expired" })
        .where(eq(structureInvitationsTable.id, inv.id));
      return res.status(410).json({ error: "Lien expiré" });
    }
    // Plans publics pour aider l'invité à choisir
    const plans = await db.select().from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isPublic, true))
      .orderBy(subscriptionPlansTable.sortOrder);
    return res.json({
      invitation: {
        contactEmail: inv.contactEmail,
        contactName: inv.contactName,
        suggestedPlanCode: inv.suggestedPlanCode,
        suggestedOrgName: inv.suggestedOrgName,
        expiresAt: inv.expiresAt,
      },
      plans,
      trialDays: TRIAL_DAYS,
    });
  } catch (e) { next(e); }
});

publicOnboardingRouter.post("/structure-onboarding/:token", async (req, res, next) => {
  try {
    const [inv] = await db.select().from(structureInvitationsTable)
      .where(eq(structureInvitationsTable.token, req.params.token)).limit(1);
    if (!inv) return res.status(404).json({ error: "Lien invalide" });
    if (inv.status !== "pending") return res.status(410).json({ error: `Lien ${inv.status}` });
    if (inv.expiresAt < new Date()) {
      await db.update(structureInvitationsTable).set({ status: "expired" })
        .where(eq(structureInvitationsTable.id, inv.id));
      return res.status(410).json({ error: "Lien expiré" });
    }

    const { orgName, planCode, adminEmail, adminFirstName, adminLastName, country, industry } = req.body || {};

    const created = await createStructure({
      orgName: String(orgName ?? inv.suggestedOrgName ?? ""),
      planCode: String(planCode ?? inv.suggestedPlanCode ?? ""),
      adminEmail: String(adminEmail ?? inv.contactEmail ?? ""),
      adminFirstName: String(adminFirstName ?? ""),
      adminLastName: String(adminLastName ?? ""),
      country: country ? String(country) : undefined,
      industry: industry ? String(industry) : undefined,
      invitedById: inv.invitedById,
    });

    await db.update(structureInvitationsTable).set({
      status: "accepted",
      acceptedAt: new Date(),
      organizationId: created.organization.id,
    }).where(eq(structureInvitationsTable.id, inv.id));

    return res.status(201).json({
      organization: created.organization,
      plan: { code: created.plan.code, name: created.plan.name },
      trialEndsAt: created.subscription.trialEndsAt,
      acceptUrl: created.acceptUrl,
      temporaryPassword: created.temporaryPassword,
    });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
