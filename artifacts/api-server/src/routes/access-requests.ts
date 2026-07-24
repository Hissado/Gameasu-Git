/**
 * Routes demandes d'accès (prospects entrants depuis la page login).
 *
 * Public : POST /api/access-requests
 * Cockpit (super_admin) :
 *   GET    /api/cockpit/access-requests
 *   GET    /api/cockpit/access-requests/:id
 *   PATCH  /api/cockpit/access-requests/:id
 */
import { Router } from "express";
import { db, accessRequestsTable } from "@workspace/db";
import { z } from "zod/v4";
import { eq, desc, ilike, or } from "drizzle-orm";
import { sendEmail } from "../lib/email";
import { requireRole } from "../middlewares/auth";

const requireSuperAdmin = requireRole("super_admin");

// ── Schéma de validation ──────────────────────────────────────────────────────
const createAccessRequestSchema = z.object({
  contactName:       z.string().min(2, "Nom requis"),
  contactFunction:   z.string().optional(),
  contactEmail:      z.string().email("Email invalide"),
  contactPhone:      z.string().optional(),
  contactPreference: z.enum(["email", "phone", "whatsapp"]).default("email"),
  orgName:           z.string().min(2, "Nom d'organisation requis"),
  orgSector:         z.string().optional(),
  orgDomain:         z.string().optional(),
  orgSize:           z.string().optional(),
  estimatedUsers:    z.string().optional(),
  country:           z.string().optional(),
  city:              z.string().optional(),
  desiredModules:    z.array(z.string()).default([]),
  mainNeed:          z.string().optional(),
  message:           z.string().optional(),
  consentGiven:      z.boolean().refine((v) => v === true, "Le consentement est obligatoire"),
});

const updateAccessRequestSchema = z.object({
  status:      z.enum(["new", "to_contact", "contacted", "demo_planned", "qualifying", "offer_sent", "converted", "non_qualified", "archived", "rejected"]).optional(),
  notes:       z.string().optional(),
  assignedTo:  z.string().uuid().nullable().optional(),
  contactedAt: z.string().datetime().nullable().optional(),
});

// ── Salutation contextuelle (heure Afrique de l'Ouest = UTC) ─────────────────
function getGreeting(): string {
  const h = new Date().getUTCHours();
  if (h < 12) return "Bonjour";
  return "Bonsoir";
}

// ── Email prospect (confirmation) ─────────────────────────────────────────────
function buildProspectEmail(data: z.infer<typeof createAccessRequestSchema>): string {
  const modules = data.desiredModules.length > 0 ? data.desiredModules.join(", ") : "Non précisé";
  const greeting = getGreeting();
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#1e3a5f;padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Gameasu ERP</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px;">Votre demande d'accès a bien été reçue</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">${greeting} <strong>${data.contactName}</strong>,</p>
      <p style="margin:0 0 12px;font-size:14px;color:#6B7280;line-height:1.6;">
        Merci pour votre intérêt pour <strong>Gameasu</strong>.
      </p>
      <p style="margin:0 0 12px;font-size:14px;color:#6B7280;line-height:1.6;">
        Votre demande d'accès pour <strong>${data.orgName}</strong> a bien été reçue. Notre équipe va analyser
        vos informations afin de mieux comprendre vos besoins, vos priorités et les spécificités de votre organisation.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#6B7280;line-height:1.6;">
        Nous vous recontacterons très prochainement pour vous accompagner dans les prochaines étapes et vous présenter
        la solution Gameasu la plus adaptée à votre activité.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
        Avec Gameasu, vous êtes sur le point de simplifier votre gestion, centraliser vos opérations et piloter votre
        entreprise avec plus de clarté.
      </p>
      <div style="background:#F9FAFB;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #E5E7EB;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;">Récapitulatif de votre demande</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
          <tr><td style="padding:5px 0;color:#6B7280;width:160px;">Organisation</td><td style="padding:5px 0;font-weight:600;">${data.orgName}</td></tr>
          <tr><td style="padding:5px 0;color:#6B7280;">Secteur</td><td style="padding:5px 0;">${data.orgSector || "Non précisé"}</td></tr>
          <tr><td style="padding:5px 0;color:#6B7280;">Taille</td><td style="padding:5px 0;">${data.orgSize || "Non précisé"}</td></tr>
          <tr><td style="padding:5px 0;color:#6B7280;">Modules souhaités</td><td style="padding:5px 0;">${modules}</td></tr>
          <tr><td style="padding:5px 0;color:#6B7280;">Contact</td><td style="padding:5px 0;">${data.contactEmail}${data.contactPhone ? ` · ${data.contactPhone}` : ""}</td></tr>
        </table>
      </div>
      <p style="margin:0;font-size:14px;color:#6B7280;">À très bientôt,<br><strong style="color:#374151;">L'équipe Gameasu</strong></p>
    </div>
    <div style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;">© Gameasu Technology · Tous droits réservés</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Email équipe Gameasu (notification interne) ───────────────────────────────
function buildTeamEmail(data: z.infer<typeof createAccessRequestSchema>): string {
  const modules = data.desiredModules.length > 0 ? data.desiredModules.join(", ") : "Non précisé";
  const pref = data.contactPreference === "whatsapp" ? "WhatsApp" : data.contactPreference === "phone" ? "Téléphone" : "Email";
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#F37021;padding:20px 32px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">🎯 Nouvelle demande d'accès Gameasu</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${data.orgName}</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 20px;font-size:14px;color:#374151;">
        Une nouvelle organisation vient de soumettre une demande d'accès via la page de connexion.
      </p>
      <div style="background:#F9FAFB;border-radius:8px;padding:20px;margin-bottom:20px;border:1px solid #E5E7EB;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;">Contact</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
          <tr><td style="padding:4px 0;color:#6B7280;width:160px;">Nom</td><td style="padding:4px 0;font-weight:600;">${data.contactName}</td></tr>
          ${data.contactFunction ? `<tr><td style="padding:4px 0;color:#6B7280;">Fonction</td><td style="padding:4px 0;">${data.contactFunction}</td></tr>` : ""}
          <tr><td style="padding:4px 0;color:#6B7280;">Email</td><td style="padding:4px 0;"><a href="mailto:${data.contactEmail}" style="color:#2563EB;">${data.contactEmail}</a></td></tr>
          ${data.contactPhone ? `<tr><td style="padding:4px 0;color:#6B7280;">Téléphone</td><td style="padding:4px 0;">${data.contactPhone}</td></tr>` : ""}
          <tr><td style="padding:4px 0;color:#6B7280;">Préférence</td><td style="padding:4px 0;">${pref}</td></tr>
        </table>
      </div>
      <div style="background:#F9FAFB;border-radius:8px;padding:20px;margin-bottom:20px;border:1px solid #E5E7EB;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;">Organisation</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
          <tr><td style="padding:4px 0;color:#6B7280;width:160px;">Nom</td><td style="padding:4px 0;font-weight:600;">${data.orgName}</td></tr>
          ${data.orgSector ? `<tr><td style="padding:4px 0;color:#6B7280;">Secteur</td><td style="padding:4px 0;">${data.orgSector}</td></tr>` : ""}
          ${data.orgDomain ? `<tr><td style="padding:4px 0;color:#6B7280;">Domaine</td><td style="padding:4px 0;">${data.orgDomain}</td></tr>` : ""}
          ${data.orgSize ? `<tr><td style="padding:4px 0;color:#6B7280;">Taille</td><td style="padding:4px 0;">${data.orgSize}</td></tr>` : ""}
          ${data.estimatedUsers ? `<tr><td style="padding:4px 0;color:#6B7280;">Utilisateurs estimés</td><td style="padding:4px 0;">${data.estimatedUsers}</td></tr>` : ""}
          ${data.country ? `<tr><td style="padding:4px 0;color:#6B7280;">Pays</td><td style="padding:4px 0;">${data.country}</td></tr>` : ""}
          ${data.city ? `<tr><td style="padding:4px 0;color:#6B7280;">Ville</td><td style="padding:4px 0;">${data.city}</td></tr>` : ""}
        </table>
      </div>
      <div style="background:#FFF7ED;border-radius:8px;padding:20px;border:1px solid #FED7AA;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;">Besoin</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
          <tr><td style="padding:4px 0;color:#6B7280;width:160px;">Modules souhaités</td><td style="padding:4px 0;font-weight:600;">${modules}</td></tr>
          ${data.mainNeed ? `<tr><td style="padding:4px 0;color:#6B7280;">Besoin principal</td><td style="padding:4px 0;">${data.mainNeed}</td></tr>` : ""}
          ${data.message ? `<tr><td style="padding:4px 0;color:#6B7280;">Message</td><td style="padding:4px 0;white-space:pre-wrap;">${data.message}</td></tr>` : ""}
        </table>
      </div>
      <div style="margin-top:24px;padding:16px;background:#EFF6FF;border-radius:8px;border-left:4px solid #2563EB;">
        <p style="margin:0;font-size:13px;color:#1E40AF;font-weight:600;">Action recommandée</p>
        <p style="margin:4px 0 0;font-size:12px;color:#3B82F6;">Contacter le prospect dans les plus brefs délais pour qualifier le besoin, proposer une démo et préparer l'accompagnement.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Routeur public ────────────────────────────────────────────────────────────
export const accessRequestPublicRouter = Router();

// Rate limiting simple (mémoire, max 3 soumissions / IP / heure)
const submissionCounts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = submissionCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    submissionCounts.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

accessRequestPublicRouter.post("/access-requests", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Trop de demandes. Veuillez réessayer dans une heure." });
  }

  const parsed = createAccessRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
  }

  const data = parsed.data;

  const [row] = await db.insert(accessRequestsTable).values({
    contactName:       data.contactName,
    contactFunction:   data.contactFunction,
    contactEmail:      data.contactEmail,
    contactPhone:      data.contactPhone,
    contactPreference: data.contactPreference,
    orgName:           data.orgName,
    orgSector:         data.orgSector,
    orgDomain:         data.orgDomain,
    orgSize:           data.orgSize,
    estimatedUsers:    data.estimatedUsers,
    country:           data.country,
    city:              data.city,
    desiredModules:    data.desiredModules,
    mainNeed:          data.mainNeed,
    message:           data.message,
    consentGiven:      data.consentGiven,
    status:            "new",
    source:            "login_page",
  }).returning();

  // Envoyer les deux emails en parallèle (pas de blocage si ça échoue)
  let confirmationSent = false;
  let notificationSent = false;
  try {
    const [prospectResult, teamResult] = await Promise.allSettled([
      sendEmail({
        to: data.contactEmail,
        subject: "Votre demande d'accès à Gameasu a bien été reçue",
        html: buildProspectEmail(data),
        text: `${getGreeting()} ${data.contactName},\n\nMerci pour votre intérêt pour Gameasu.\n\nVotre demande d'accès pour ${data.orgName} a bien été reçue. Notre équipe va analyser vos informations afin de mieux comprendre vos besoins, vos priorités et les spécificités de votre organisation.\n\nNous vous recontacterons très prochainement pour vous accompagner dans les prochaines étapes et vous présenter la solution Gameasu la plus adaptée à votre activité.\n\nAvec Gameasu, vous êtes sur le point de simplifier votre gestion, centraliser vos opérations et piloter votre entreprise avec plus de clarté.\n\nL'équipe Gameasu`,
        category: "access_request_confirmation",
      }),
      sendEmail({
        to: process.env.GAMEASU_NOTIFY_EMAIL ?? "info@gameasu.com",
        subject: `Nouvelle demande d'accès Gameasu — ${data.orgName}`,
        html: buildTeamEmail(data),
        text: `Nouvelle demande d'accès de ${data.contactName} (${data.orgName}) — ${data.contactEmail}`,
        category: "access_request_notification",
      }),
    ]);
    confirmationSent = prospectResult.status === "fulfilled" && prospectResult.value.delivered;
    notificationSent = teamResult.status === "fulfilled" && teamResult.value.delivered;
  } catch {
    // Les emails ne bloquent pas la réponse
  }

  // Mettre à jour les flags d'envoi
  await db.update(accessRequestsTable)
    .set({ confirmationSent, notificationSent })
    .where(eq(accessRequestsTable.id, row.id));

  return res.status(201).json({ id: row.id, message: "Votre demande a bien été envoyée." });
});

// ── Routeur cockpit (super_admin uniquement) ──────────────────────────────────
export const accessRequestCockpitRouter = Router();

accessRequestCockpitRouter.get("/cockpit/access-requests", requireSuperAdmin, async (req, res) => {
  const { status, search } = req.query as Record<string, string>;

  let query = db.select().from(accessRequestsTable).$dynamic();
  if (status && status !== "all") {
    query = query.where(eq(accessRequestsTable.status, status));
  } else if (search) {
    query = query.where(
      or(
        ilike(accessRequestsTable.contactName, `%${search}%`),
        ilike(accessRequestsTable.orgName, `%${search}%`),
        ilike(accessRequestsTable.contactEmail, `%${search}%`),
      )
    );
  }

  const rows = await query.orderBy(desc(accessRequestsTable.createdAt));
  return res.json(rows);
});

// ── Stats globales pour le badge et les KPIs ──────────────────────────────────
accessRequestCockpitRouter.get("/cockpit/access-requests/stats", requireSuperAdmin, async (req, res) => {
  const rows = await db.select({
    status: accessRequestsTable.status,
    desiredModules: accessRequestsTable.desiredModules,
    orgSector: accessRequestsTable.orgSector,
  }).from(accessRequestsTable);

  const byStatus: Record<string, number> = {};
  const moduleCount: Record<string, number> = {};
  const sectorCount: Record<string, number> = {};

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    for (const m of (r.desiredModules ?? [])) {
      moduleCount[m] = (moduleCount[m] ?? 0) + 1;
    }
    if (r.orgSector) sectorCount[r.orgSector] = (sectorCount[r.orgSector] ?? 0) + 1;
  }

  const total = rows.length;
  const converted = byStatus["converted"] ?? 0;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  const topModules = Object.entries(moduleCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const topSectors = Object.entries(sectorCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return res.json({ byStatus, total, converted, conversionRate, topModules, topSectors });
});

accessRequestCockpitRouter.get("/cockpit/access-requests/:id", requireSuperAdmin, async (req, res) => {
  const [row] = await db.select().from(accessRequestsTable)
    .where(eq(accessRequestsTable.id, req.params.id as string));
  if (!row) return res.status(404).json({ error: "Demande introuvable" });
  return res.json(row);
});

accessRequestCockpitRouter.patch("/cockpit/access-requests/:id", requireSuperAdmin, async (req, res) => {
  const parsed = updateAccessRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "contacted" && !parsed.data.contactedAt) {
    updates.contactedAt = new Date();
  }

  const [row] = await db.update(accessRequestsTable)
    .set(updates as Partial<typeof accessRequestsTable.$inferInsert>)
    .where(eq(accessRequestsTable.id, req.params.id as string))
    .returning();
  if (!row) return res.status(404).json({ error: "Demande introuvable" });
  return res.json(row);
});
