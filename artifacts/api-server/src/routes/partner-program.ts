/**
 * Programme partenaire Gameasu
 *
 * Routes publiques / authentifiées :
 *   POST  /partner-program/apply               Soumettre une demande partenaire
 *
 * Routes super-admin :
 *   GET   /super-admin/partner-programs        Liste des demandes
 *   GET   /super-admin/partner-programs/:id    Détail d'un partenaire
 *   POST  /super-admin/partner-programs/:id/approve  Approuver + générer code unique
 *   POST  /super-admin/partner-programs/:id/reject   Rejeter
 *   PATCH /super-admin/partner-programs/:id    Modifier notes / statut
 *   GET   /super-admin/partner-programs/:id/referrals  Clients générés via le code
 */

import { Router, type IRouter, type RequestHandler } from "express";
import {
  db,
  partnerProgramsTable,
  promoCodesTable,
  promoCodeUsesTable,
  organizationsTable,
  paymentTransactionsTable,
} from "@workspace/db";
import { eq, desc, sql, count, and, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();
export const partnerPublicRouter: IRouter = Router();

// ── Middleware super-admin ─────────────────────────────────────────
const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") { res.status(403).json({ error: "Accès réservé aux super-administrateurs" }); return; }
  next();
};

// ── Génération de code partenaire unique ──────────────────────────

function generatePartnerCode(orgName: string): string {
  const prefix = orgName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(3, "X");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `PART-${prefix}-${suffix}`;
}

// ── POST /partner-program/apply (public) ──────────────────────────

partnerPublicRouter.post("/partner-program/apply", async (req, res) => {
  const {
    contactName, contactEmail, contactPhone, orgName, website,
    country, sector, estimatedClients, motivation, type, orgId,
  } = req.body as Record<string, unknown>;

  if (!contactName || !contactEmail || !orgName) {
    res.status(400).json({ error: "Champs requis : contactName, contactEmail, orgName" });
    return;
  }

  try {
    const [existing] = await db
      .select({ id: partnerProgramsTable.id, status: partnerProgramsTable.status })
      .from(partnerProgramsTable)
      .where(eq(partnerProgramsTable.contactEmail, String(contactEmail).trim().toLowerCase()))
      .limit(1);

    if (existing && !["rejected", "suspended"].includes(existing.status)) {
      res.status(409).json({
        error: "Une demande partenaire existe déjà pour cet email.",
        status: existing.status,
      });
      return;
    }

    const [created] = await db.insert(partnerProgramsTable).values({
      contactName:      String(contactName).trim(),
      contactEmail:     String(contactEmail).trim().toLowerCase(),
      contactPhone:     contactPhone  ? String(contactPhone)  : null,
      orgName:          String(orgName).trim(),
      orgId:            orgId         ? String(orgId)         : null,
      website:          website       ? String(website)       : null,
      country:          country       ? String(country)       : null,
      sector:           sector        ? String(sector)        : null,
      estimatedClients: estimatedClients != null ? Number(estimatedClients) : null,
      motivation:       motivation    ? String(motivation)    : null,
      type:             type          ? String(type)          : "commercial",
      status:           "pending",
    }).returning();

    // Email de confirmation au demandeur
    await sendEmail({
      to: created.contactEmail,
      subject: "Votre demande partenaire Gameasu est bien reçue",
      html: `<p>Bonjour ${created.contactName},</p>
<p>Nous avons bien reçu votre demande de partenariat pour <strong>${created.orgName}</strong>. Notre équipe va l'examiner et vous contacter sous 2-3 jours ouvrés.</p>
<p>Cordialement,<br>L'équipe Gameasu</p>`,
      text: `Bonjour ${created.contactName},\n\nVotre demande de partenariat pour ${created.orgName} est bien reçue. Nous vous contacterons sous 2-3 jours ouvrés.\n\nL'équipe Gameasu`,
      category: "partner_application",
    }).catch((e) => logger.warn(e, "partner apply confirmation email failed"));

    res.status(201).json({ ok: true, id: created.id, status: created.status });
  } catch (e) {
    logger.error(e, "partner-program apply error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── GET /super-admin/partner-programs ─────────────────────────────

router.get("/super-admin/partner-programs", sa, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const rows = await db
      .select()
      .from(partnerProgramsTable)
      .where(status ? eq(partnerProgramsTable.status, status) : undefined)
      .orderBy(desc(partnerProgramsTable.createdAt));
    res.json(rows);
  } catch (e) {
    logger.error(e, "partner-programs list error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── GET /super-admin/partner-programs/:id ─────────────────────────

router.get("/super-admin/partner-programs/:id", sa, async (req, res) => {
  const id = req.params.id as string;
  try {
    const [partner] = await db
      .select()
      .from(partnerProgramsTable)
      .where(eq(partnerProgramsTable.id, id))
      .limit(1);
    if (!partner) { res.status(404).json({ error: "Partenaire introuvable" }); return; }

    // Codes associés
    const codes = await db
      .select()
      .from(promoCodesTable)
      .where(eq(promoCodesTable.partnerId, id))
      .orderBy(desc(promoCodesTable.createdAt));

    res.json({ ...partner, codes });
  } catch (e) {
    logger.error(e, "partner-program get error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── POST /super-admin/partner-programs/:id/approve ────────────────

router.post("/super-admin/partner-programs/:id/approve", sa, async (req, res) => {
  const id = req.params.id as string;
  try {
    const [partner] = await db
      .select()
      .from(partnerProgramsTable)
      .where(eq(partnerProgramsTable.id, id))
      .limit(1);
    if (!partner) { res.status(404).json({ error: "Partenaire introuvable" }); return; }
    if (partner.status === "approved") { res.status(409).json({ error: "Déjà approuvé" }); return; }

    // Générer un code unique
    const code = partner.code ?? generatePartnerCode(partner.orgName);

    // Upsert code promo partenaire (percent 0 par défaut — configurable)
    const discountPercent = typeof req.body.discountPercent === "number" ? req.body.discountPercent : 0;

    let promoCode: typeof promoCodesTable.$inferSelect;
    const [existingCode] = await db
      .select()
      .from(promoCodesTable)
      .where(eq(promoCodesTable.partnerId, id))
      .limit(1);

    if (existingCode) {
      const [updated] = await db
        .update(promoCodesTable)
        .set({ isActive: true, discountValue: discountPercent })
        .where(eq(promoCodesTable.id, existingCode.id))
        .returning();
      promoCode = updated;
    } else {
      const [created] = await db.insert(promoCodesTable).values({
        code,
        label:         `Code partenaire — ${partner.orgName}`,
        type:          "partner",
        discountType:  "percent",
        discountValue: discountPercent,
        isActive:      true,
        partnerId:     id,
        createdById:   req.authUser!.id,
      }).returning();
      promoCode = created;
    }

    // Mise à jour du partenaire
    const [updated] = await db
      .update(partnerProgramsTable)
      .set({
        status:       "approved",
        code:         promoCode.code,
        approvedAt:   new Date(),
        approvedById: req.authUser!.id,
      })
      .where(eq(partnerProgramsTable.id, id))
      .returning();

    // Email d'approbation avec le code
    await sendEmail({
      to: partner.contactEmail,
      subject: "🎉 Votre partenariat Gameasu est approuvé !",
      html: `<p>Bonjour ${partner.contactName},</p>
<p>Nous avons le plaisir de vous confirmer que votre partenariat avec Gameasu est <strong>officiellement approuvé</strong>.</p>
<p>Votre code partenaire unique est : <strong style="font-size:1.4em;letter-spacing:2px">${promoCode.code}</strong></p>
${discountPercent > 0 ? `<p>Ce code offre une réduction de <strong>${discountPercent}%</strong> sur les abonnements Gameasu à vos clients.</p>` : ""}
<p>Partagez-le avec vos clients lors de leur souscription sur la plateforme Gameasu.</p>
<p>Merci de votre confiance,<br>L'équipe Gameasu</p>`,
      text: `Bonjour ${partner.contactName},\n\nVotre partenariat Gameasu est approuvé !\n\nVotre code partenaire : ${promoCode.code}${discountPercent > 0 ? `\nRéduction : ${discountPercent}%` : ""}\n\nL'équipe Gameasu`,
      category: "partner_approved",
    }).catch((e) => logger.warn(e, "partner approval email failed"));

    res.json({ ok: true, partner: updated, promoCode });
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "Un code partenaire identique existe déjà — modifiez le nom de l'organisation." });
      return;
    }
    logger.error(e, "partner approve error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── POST /super-admin/partner-programs/:id/reject ─────────────────

router.post("/super-admin/partner-programs/:id/reject", sa, async (req, res) => {
  const id = req.params.id as string;
  const { reason } = req.body as { reason?: string };
  try {
    const [partner] = await db
      .select()
      .from(partnerProgramsTable)
      .where(eq(partnerProgramsTable.id, id))
      .limit(1);
    if (!partner) { res.status(404).json({ error: "Partenaire introuvable" }); return; }

    const [updated] = await db
      .update(partnerProgramsTable)
      .set({
        status:          "rejected",
        rejectedAt:      new Date(),
        rejectedById:    req.authUser!.id,
        rejectionReason: reason ?? null,
      })
      .where(eq(partnerProgramsTable.id, id))
      .returning();

    await sendEmail({
      to: partner.contactEmail,
      subject: "Suite à votre demande de partenariat Gameasu",
      html: `<p>Bonjour ${partner.contactName},</p>
<p>Après examen de votre demande de partenariat, nous ne sommes pas en mesure de la valider à ce stade.</p>
${reason ? `<p>Motif : ${reason}</p>` : ""}
<p>N'hésitez pas à nous recontacter si votre situation évolue.</p>
<p>Cordialement,<br>L'équipe Gameasu</p>`,
      text: `Bonjour ${partner.contactName},\n\nNous ne pouvons pas valider votre demande à ce stade.${reason ? `\nMotif : ${reason}` : ""}\n\nL'équipe Gameasu`,
      category: "partner_rejected",
    }).catch((e) => logger.warn(e, "partner rejection email failed"));

    res.json({ ok: true, partner: updated });
  } catch (e) {
    logger.error(e, "partner reject error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── PATCH /super-admin/partner-programs/:id ───────────────────────

router.patch("/super-admin/partner-programs/:id", sa, async (req, res) => {
  const id = req.params.id as string;
  const { notes, status } = req.body as { notes?: string; status?: string };
  try {
    const updates: Partial<typeof partnerProgramsTable.$inferSelect> = {};
    if (notes  != null) updates.notes  = notes;
    if (status != null) updates.status = status;
    const [updated] = await db
      .update(partnerProgramsTable)
      .set(updates)
      .where(eq(partnerProgramsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Partenaire introuvable" }); return; }
    res.json(updated);
  } catch (e) {
    logger.error(e, "partner patch error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── GET /super-admin/partner-programs/:id/referrals ───────────────

router.get("/super-admin/partner-programs/:id/referrals", sa, async (req, res) => {
  const id = req.params.id as string;
  try {
    const [partner] = await db
      .select({ code: partnerProgramsTable.code })
      .from(partnerProgramsTable)
      .where(eq(partnerProgramsTable.id, id))
      .limit(1);
    if (!partner) { res.status(404).json({ error: "Partenaire introuvable" }); return; }

    // Codes du partenaire
    const codes = await db
      .select({ id: promoCodesTable.id })
      .from(promoCodesTable)
      .where(eq(promoCodesTable.partnerId, id));

    if (!codes.length) { res.json({ referrals: [], totalDiscount: 0 }); return; }

    const codeIds = codes.map((c) => c.id);
    const uses = await db
      .select({
        id:             promoCodeUsesTable.id,
        organizationId: promoCodeUsesTable.organizationId,
        discountApplied:promoCodeUsesTable.discountApplied,
        usedAt:         promoCodeUsesTable.usedAt,
        orgName:        organizationsTable.name,
      })
      .from(promoCodeUsesTable)
      .leftJoin(organizationsTable, eq(promoCodeUsesTable.organizationId, organizationsTable.id))
      .where(inArray(promoCodeUsesTable.promoCodeId, codeIds))
      .orderBy(desc(promoCodeUsesTable.usedAt));

    const totalDiscount = uses.reduce((sum, u) => sum + (u.discountApplied ?? 0), 0);
    res.json({ referrals: uses, totalDiscount });
  } catch (e) {
    logger.error(e, "partner referrals error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
