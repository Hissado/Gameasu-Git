/**
 * Routes publiques marketing — aucune authentification requise.
 * Enregistrer AVANT router.use(requireAuth) dans routes/index.ts
 *
 * GET  /marketing/track/open/:token   — pixel de tracking d'ouverture (1×1 GIF)
 * GET  /marketing/track/click/:token  — redirect de tracking de clic
 * GET  /public/forms/:formId          — structure du formulaire pour rendu public
 * POST /public/forms/:formId/submit   — soumission de formulaire public (crée/met à jour un prospect)
 */

import { Router } from "express";
import {
  db,
  campaignRecipientsTable,
  marketingCampaignsTable,
  marketingFormsTable,
  prospectsTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";

const router = Router();

// 1×1 pixel GIF transparent
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// ─── PIXEL OPEN ─────────────────────────────────────────────────
router.get("/marketing/track/open/:token", async (req, res) => {
  res.set({
    "Content-Type": "image/gif",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Content-Length": String(TRACKING_PIXEL.length),
  });
  res.end(TRACKING_PIXEL);

  // Traitement asynchrone après réponse — ne bloque pas l'email client
  setImmediate(async () => {
    try {
      const [recipient] = await db
        .select()
        .from(campaignRecipientsTable)
        .where(eq(campaignRecipientsTable.openToken, (req.params.token as string)))
        .limit(1);

      if (!recipient) return;

      // Enregistrer uniquement la première ouverture
      if (!recipient.openedAt) {
        await db
          .update(campaignRecipientsTable)
          .set({ openedAt: new Date() })
          .where(eq(campaignRecipientsTable.id, recipient.id));

        await db
          .update(marketingCampaignsTable)
          .set({ openCount: sql`${marketingCampaignsTable.openCount} + 1` })
          .where(eq(marketingCampaignsTable.id, recipient.campaignId));
      }
    } catch {
      // Ignorer les erreurs de tracking pour ne pas affecter la livraison
    }
  });
});

// ─── REDIRECT CLICK ─────────────────────────────────────────────
router.get("/marketing/track/click/:token", async (req, res) => {
  const rawUrl = req.query["url"] as string | undefined;
  const targetUrl = rawUrl ? decodeURIComponent(rawUrl) : "/";

  // Valider l'URL (éviter les redirections vers des schemes dangereux)
  const safeUrl = /^https?:\/\//.test(targetUrl) ? targetUrl : "/";
  res.redirect(302, safeUrl);

  setImmediate(async () => {
    try {
      const [recipient] = await db
        .select()
        .from(campaignRecipientsTable)
        .where(eq(campaignRecipientsTable.clickToken, (req.params.token as string)))
        .limit(1);

      if (!recipient) return;

      if (!recipient.clickedAt) {
        await db
          .update(campaignRecipientsTable)
          .set({ clickedAt: new Date() })
          .where(eq(campaignRecipientsTable.id, recipient.id));

        await db
          .update(marketingCampaignsTable)
          .set({ clickCount: sql`${marketingCampaignsTable.clickCount} + 1` })
          .where(eq(marketingCampaignsTable.id, recipient.campaignId));
      }
    } catch {
      // Ignorer
    }
  });
});

// ─── FORMULAIRE PUBLIC — STRUCTURE ──────────────────────────────
router.get("/public/forms/:formId", async (req, res) => {
  try {
    const [form] = await db
      .select({
        id: marketingFormsTable.id,
        name: marketingFormsTable.name,
        description: marketingFormsTable.description,
        fields: marketingFormsTable.fields,
        confirmationMessage: marketingFormsTable.confirmationMessage,
        isActive: marketingFormsTable.isActive,
      })
      .from(marketingFormsTable)
      .where(
        and(
          eq(marketingFormsTable.id, (req.params.formId as string)),
          isNull(marketingFormsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!form || !form.isActive) {
      return res.status(404).json({ error: "Formulaire introuvable ou inactif" });
    }
    return res.json(form);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── FORMULAIRE PUBLIC — SOUMISSION ─────────────────────────────
router.post("/public/forms/:formId/submit", async (req, res) => {
  try {
    const [form] = await db
      .select()
      .from(marketingFormsTable)
      .where(
        and(
          eq(marketingFormsTable.id, (req.params.formId as string)),
          eq(marketingFormsTable.isActive, true),
          isNull(marketingFormsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!form) {
      return res.status(404).json({ error: "Formulaire introuvable ou inactif" });
    }

    const data: Record<string, string> = req.body || {};

    // Validation des champs requis
    const missing = form.fields
      .filter((f) => f.required && !data[f.name])
      .map((f) => f.label);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Champs obligatoires manquants : ${missing.join(", ")}`,
      });
    }

    // Extraire les données standard pour le prospect
    const email = data["email"] || null;
    const phone = data["phone"] || null;
    const fullName = data["nom"] || data["name"] || null;
    const firstName = data["prenom"] || data["firstName"] || (fullName ? fullName.split(" ")[0] : null);
    const lastName = data["nom_famille"] || data["lastName"] || (fullName && fullName.includes(" ") ? fullName.split(" ").slice(1).join(" ") : fullName ? null : null);
    const company = data["entreprise"] || data["company"] || null;
    const notes = Object.entries(data)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");

    if (email || phone) {
      // Chercher un prospect existant par email ou téléphone
      const conds: any[] = [
        eq(prospectsTable.organizationId, form.organizationId),
        isNull(prospectsTable.deletedAt),
      ];
      if (email) conds.push(eq(prospectsTable.email, email));
      else if (phone) conds.push(eq(prospectsTable.phone, phone));

      const [existing] = await db
        .select({ id: prospectsTable.id })
        .from(prospectsTable)
        .where(and(...conds))
        .limit(1);

      if (existing) {
        await db
          .update(prospectsTable)
          .set({
            source: form.sourceTag || "form",
            notes: `[${form.name}] ${notes}`,
            updatedAt: new Date(),
          })
          .where(eq(prospectsTable.id, existing.id));
      } else {
        await db.insert(prospectsTable).values({
          organizationId: form.organizationId,
          firstName: firstName || null,
          lastName: lastName || null,
          email,
          phone,
          company,
          source: form.sourceTag || "form",
          status: "new",
          tags: [],
          notes: `[${form.name}] ${notes}`,
        });
      }

      // Incrémenter le compteur de soumissions
      await db
        .update(marketingFormsTable)
        .set({ submissionsCount: sql`${marketingFormsTable.submissionsCount} + 1` })
        .where(eq(marketingFormsTable.id, form.id));
    }

    return res.json({
      success: true,
      message:
        form.confirmationMessage ||
        "Votre demande a bien été enregistrée. Nous vous recontacterons prochainement.",
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
