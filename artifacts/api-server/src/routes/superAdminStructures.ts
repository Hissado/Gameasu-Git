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
import { and, eq, desc, sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { sendEmail, buildInvitationEmail } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";
import { audit } from "../lib/audit";

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
  return getPublicBaseUrl();
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
router.get("/super-admin/plans", sa, async (_req, res, next) => {
  try {
    const plans = await db
      .select({
        id: subscriptionPlansTable.id,
        code: subscriptionPlansTable.code,
        name: subscriptionPlansTable.name,
        monthlyPricePerSeat: subscriptionPlansTable.monthlyPricePerSeat,
        currency: subscriptionPlansTable.currency,
        includedSeats: subscriptionPlansTable.includedSeats,
        sortOrder: subscriptionPlansTable.sortOrder,
      })
      .from(subscriptionPlansTable)
      .orderBy(subscriptionPlansTable.sortOrder);
    res.json(plans);
  } catch (e) { next(e); }
});

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
        inviterName: req.authUser ? `${req.authUser.firstName} ${req.authUser.lastName}` : "L'équipe Gameasu",
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
        subject: "Invitation à rejoindre Gameasu",
        text: [
          `Bonjour ${contactName || ""},`,
          ``,
          `Vous êtes invité(e) à activer votre espace Gameasu.`,
          ``,
          `Cliquez sur ce lien pour configurer votre organisation (essai gratuit ${TRIAL_DAYS} jours) :`,
          onboardUrl,
          ``,
          `Lien valable ${INVITE_TTL_DAYS} jours.`,
          ``,
          `À très bientôt,`,
          `L'équipe Gameasu`,
        ].join("\n"),
        html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f7f7f7;padding:24px;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
  <div style="background:#0b0b0b;color:#fff;padding:24px 28px"><div style="color:#3B82F6;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:6px">GAMÉASÙ</div><h1 style="margin:0;font-size:22px">Activez votre espace</h1></div>
  <div style="padding:24px 28px;line-height:1.6">
    <p>Bonjour ${contactName || ""},</p>
    <p>Vous êtes invité(e) à créer votre organisation sur Gameasu — pilotage d'entreprise nouvelle génération.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${onboardUrl}" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Configurer mon espace</a>
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
        eq(structureInvitationsTable.id, (req.params.id as string)),
        eq(structureInvitationsTable.status, "pending"),
      ))
      .returning();
    if (!updated) return res.status(404).json({ error: "Invitation introuvable ou déjà traitée" });
    // Passer organizationId explicitement : org cible, pas l'org du super-admin opérateur
    await audit(req, "onboarding_link_revoked", {
      entityType: "structureInvitation", entityId: (req.params.id as string),
      organizationId: updated.organizationId ?? undefined,
      payload: { organizationId: updated.organizationId },
    });
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
      .where(eq(structureInvitationsTable.token, (req.params.token as string))).limit(1);
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
      .where(eq(structureInvitationsTable.token, (req.params.token as string))).limit(1);
    if (!inv) return res.status(404).json({ error: "Lien invalide" });
    if (inv.status !== "pending") return res.status(410).json({ error: `Lien ${inv.status}` });
    if (inv.expiresAt < new Date()) {
      await db.update(structureInvitationsTable).set({ status: "expired" })
        .where(eq(structureInvitationsTable.id, inv.id));
      return res.status(410).json({ error: "Lien expiré" });
    }

    // ── Branchement sémantique ────────────────────────────────────────────────
    // A. org déjà provisionnée (lien d'accès cockpit) → activer un admin sans créer de nouvelle org
    if (inv.organizationId) {
      const [org] = await db.select().from(organizationsTable)
        .where(eq(organizationsTable.id, inv.organizationId)).limit(1);
      if (!org) return res.status(410).json({ error: "Organisation introuvable" });

      const { adminEmail, adminFirstName, adminLastName } = req.body || {};
      // Contraindre l'email à inv.contactEmail quand défini — empêche de cibler un compte arbitraire
      const resolvedEmail = inv.contactEmail
        ? inv.contactEmail.toLowerCase().trim()
        : String(adminEmail ?? "").toLowerCase().trim();
      if (!EMAIL_RE.test(resolvedEmail)) return res.status(400).json({ error: "Email administrateur invalide" });
      const email = resolvedEmail;

      const fName = String(adminFirstName ?? inv.contactName?.split(" ")[0] ?? "").trim();
      const lName = String(adminLastName ?? inv.contactName?.split(" ").slice(1).join(" ") ?? "").trim();

      const tempPassword = genTempPassword();
      const acceptToken = genToken();
      const expiresAt = new Date(Date.now() + 7 * 86400000);
      const now = new Date();

      // Créer ou réutiliser le compte admin de cette org
      const [existing] = await db.select({
        id: usersTable.id,
        acceptedAt: usersTable.acceptedAt,
        mustChangePassword: usersTable.mustChangePassword,
        isActive: usersTable.isActive,
      })
        .from(usersTable)
        .where(and(eq(usersTable.email, email), eq(usersTable.organizationId, org.id)))
        .limit(1);

      let userId: string;
      if (existing) {
        // Guard : bloquer tout compte déjà établi — qu'il ait été activé via invitation (acceptedAt)
        // ou créé directement (isActive=true + mustChangePassword=false couvre les comptes seedés).
        const isEstablished = !!existing.acceptedAt || (existing.isActive && !existing.mustChangePassword);
        if (isEstablished) {
          return res.status(400).json({
            error: "Un compte actif existe déjà avec cette adresse email pour cette organisation. Utilisez la réinitialisation de mot de passe.",
            code: "ACCOUNT_ALREADY_ACTIVATED",
          });
        }
        userId = existing.id;
        await db.update(usersTable).set({
          password: tempPassword,
          mustChangePassword: true,
          passwordResetToken: acceptToken,
          passwordResetTokenExpiresAt: expiresAt,
          invitedAt: now,
          isActive: true,
        }).where(eq(usersTable.id, userId));
      } else {
        userId = randomUUID();
        await db.insert(usersTable).values({
          id: userId,
          email,
          firstName: fName || "Admin",
          lastName: lName || org.name,
          role: "admin",
          password: tempPassword,
          mustChangePassword: true,
          passwordResetToken: acceptToken,
          passwordResetTokenExpiresAt: expiresAt,
          organizationId: org.id,
          isActive: true,
          invitedAt: now,
          acceptedAt: null,
        });
        await db.insert(organizationMembersTable).values({
          organizationId: org.id,
          userId,
          role: "admin",
        }).onConflictDoNothing();
      }

      await db.update(structureInvitationsTable).set({
        status: "accepted",
        acceptedAt: now,
      }).where(eq(structureInvitationsTable.id, inv.id));

      // Public route : pas d'authUser, on passe organizationId explicitement
      await audit(
        { ip: req.ip, headers: req.headers },
        "onboarding_link_used",
        { entityType: "organization", entityId: org.id, organizationId: org.id, payload: { invId: inv.id, mode: "existing_org", adminEmail: email } },
      );

      const acceptUrl = `${baseUrl()}/accept-invitation?token=${acceptToken}`;
      return res.status(201).json({
        organization: { id: org.id, name: org.name, slug: org.slug },
        acceptUrl,
        temporaryPassword: tempPassword,
        mode: "existing_org",
      });
    }

    // B. Nouvelle organisation → flux createStructure standard
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

    await audit(
      { ip: req.ip, headers: req.headers },
      "onboarding_link_used",
      { entityType: "organization", entityId: created.organization.id, organizationId: created.organization.id, payload: { invId: inv.id, mode: "new_org", orgName: created.organization.name } },
    );

    return res.status(201).json({
      organization: created.organization,
      plan: { code: created.plan.code, name: created.plan.name },
      trialEndsAt: created.subscription.trialEndsAt,
      acceptUrl: created.acceptUrl,
      temporaryPassword: created.temporaryPassword,
      mode: "new_org",
    });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// ─────────────────────────────────────────────────────────────────
// Structure invitations liées à une organisation (cockpit)
// ─────────────────────────────────────────────────────────────────

/** GET /api/super-admin/organizations/:id/structure-invitations */
router.get("/super-admin/organizations/:id/structure-invitations", sa, async (req, res, next) => {
  try {
    const rows = await db.select({
      id: structureInvitationsTable.id,
      contactEmail: structureInvitationsTable.contactEmail,
      contactName: structureInvitationsTable.contactName,
      status: structureInvitationsTable.status,
      suggestedPlanCode: structureInvitationsTable.suggestedPlanCode,
      expiresAt: structureInvitationsTable.expiresAt,
      acceptedAt: structureInvitationsTable.acceptedAt,
      createdAt: structureInvitationsTable.createdAt,
      token: structureInvitationsTable.token,
      notes: structureInvitationsTable.notes,
    }).from(structureInvitationsTable)
      .where(eq(structureInvitationsTable.organizationId, (req.params.id as string)))
      .orderBy(desc(structureInvitationsTable.createdAt));
    // Compute onboardUrl server-side so cockpit never reconstructs the URL itself
    const base = baseUrl();
    const invitations = rows.map((r) => ({
      ...r,
      onboardUrl: `${base}/onboard-structure?token=${r.token}`,
    }));
    res.json({ invitations });
  } catch (e) { next(e); }
});

/** POST /api/super-admin/organizations/:id/structure-invitations/generate
 *  Génère un nouveau lien d'onboarding attaché à cette organisation (pour renvoyer l'accès). */
router.post("/super-admin/organizations/:id/structure-invitations/generate", sa, async (req, res, next) => {
  try {
    const [org] = await db.select({ id: organizationsTable.id, name: organizationsTable.name })
      .from(organizationsTable).where(eq(organizationsTable.id, (req.params.id as string))).limit(1);
    if (!org) return res.status(404).json({ error: "Organisation introuvable" });

    const { contactEmail, contactName, notes, sendEmailInvite = false } = req.body || {};
    const token = genToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000);

    const [inv] = await db.insert(structureInvitationsTable).values({
      token,
      contactEmail: contactEmail ? String(contactEmail).toLowerCase() : null,
      contactName: contactName ? String(contactName) : null,
      notes: notes ? String(notes) : null,
      status: "pending",
      invitedById: req.authUser?.id ?? null,
      organizationId: (req.params.id as string),
      expiresAt,
    }).returning();

    // Structure invitation tokens sont validés par /api/structure-onboarding/:token
    // et destinés à la page /onboard-structure (auto-onboarding).
    const onboardUrl = `${baseUrl()}/onboard-structure?token=${token}`;

    let delivery: unknown = null;
    if (sendEmailInvite && contactEmail) {
      delivery = await sendEmail({
        to: String(contactEmail),
        subject: `Lien d'accès Gameasu — ${org.name}`,
        text: `Bonjour ${contactName || ""},\n\nVoici votre lien d'accès à la plateforme Gameasu :\n${onboardUrl}\n\nLien valable ${INVITE_TTL_DAYS} jours.\n\nL'équipe Gameasu`,
        html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f7f7f7;padding:24px;color:#111"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee"><div style="background:#0b0b0b;color:#fff;padding:24px 28px"><div style="color:#3B82F6;font-weight:700;letter-spacing:2px;font-size:11px;margin-bottom:6px">GAMÉASÙ</div><h1 style="margin:0;font-size:22px">Accès à votre espace</h1></div><div style="padding:24px 28px;line-height:1.6"><p>Bonjour ${contactName || ""},</p><p>Voici votre lien d'accès à la plateforme Gameasu pour l'organisation <strong>${org.name}</strong>.</p><p style="text-align:center;margin:24px 0"><a href="${onboardUrl}" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Accéder à la plateforme</a></p><p style="font-size:13px;color:#555">Lien valable ${INVITE_TTL_DAYS} jours.</p></div></div></body></html>`,
      }).catch((e: unknown) => ({ error: (e as Error)?.message }));
    }

    // Passer organizationId explicitement : pour un super-admin l'org du token ≠ org cible
    await audit(req, "onboarding_link_generated", {
      entityType: "organization", entityId: (req.params.id as string),
      organizationId: (req.params.id as string),
      payload: { invId: inv.id, sendEmailInvite, contactEmail: contactEmail ?? null },
    });

    return res.status(201).json({ invitation: inv, onboardUrl, expiresAt, delivery });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// Admin invitations d'une organisation spécifique (cockpit)
// ─────────────────────────────────────────────────────────────────

/** GET /api/super-admin/organizations/:id/admin-invitations */
router.get("/super-admin/organizations/:id/admin-invitations", sa, async (req, res, next) => {
  try {
    const rows = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      mustChangePassword: usersTable.mustChangePassword,
      invitedAt: usersTable.invitedAt,
      acceptedAt: usersTable.acceptedAt,
      expiresAt: usersTable.passwordResetTokenExpiresAt,
      hasToken: sql<boolean>`(${usersTable.passwordResetToken} IS NOT NULL)`,
    }).from(usersTable)
      .where(eq(usersTable.organizationId, (req.params.id as string)))
      .orderBy(desc(usersTable.createdAt));
    res.json({ users: rows });
  } catch (e) { next(e); }
});

/** POST /api/super-admin/organizations/:id/admin-invitations/regenerate */
router.post("/super-admin/organizations/:id/admin-invitations/regenerate", sa, async (req, res, next) => {
  try {
    const { userId, sendEmailInvite = true } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId requis" });

    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, (req.params.id as string))))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    // Guard : interdire la réinitialisation de comptes déjà activés via ce flux invitation
    if (user.acceptedAt) return res.status(400).json({ error: "Ce compte est déjà activé — utilisez la réinitialisation de mot de passe." });

    const tempPassword = genTempPassword();
    const token = genToken();
    const expiresAt = new Date(Date.now() + 7 * 86400000);

    await db.update(usersTable).set({
      password: tempPassword,
      mustChangePassword: true,
      passwordResetToken: token,
      passwordResetTokenExpiresAt: expiresAt,
      invitedAt: new Date(),
    }).where(eq(usersTable.id, user.id));

    const acceptUrl = `${baseUrl()}/accept-invitation?token=${token}`;

    let delivery: unknown = null;
    if (sendEmailInvite) {
      const [org] = await db.select({ name: organizationsTable.name })
        .from(organizationsTable).where(eq(organizationsTable.id, (req.params.id as string))).limit(1);
      const tpl = buildInvitationEmail({
        recipientName: `${user.firstName} ${user.lastName}`,
        inviterName: req.authUser ? `${req.authUser.firstName} ${req.authUser.lastName}` : "L'équipe Gameasu",
        orgName: org?.name,
        acceptUrl,
        temporaryPassword: tempPassword,
      });
      delivery = await sendEmail({ ...tpl, to: user.email }).catch((e) => ({ error: (e as Error)?.message }));
    }

    await audit(req, "invitation_resend", {
      entityType: "user", entityId: user.id,
      organizationId: (req.params.id as string),
      payload: { email: user.email, sendEmailInvite, delivery },
    });
    await audit(req, "invitation_sent", {
      entityType: "user", entityId: user.id,
      organizationId: (req.params.id as string),
      payload: { email: user.email, delivery },
    });

    return res.json({ acceptUrl, expiresAt, delivery });
  } catch (e) { next(e); }
});

export default router;
