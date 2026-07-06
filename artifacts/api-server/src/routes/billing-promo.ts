/**
 * Codes promo & codes partenaires
 *
 * Routes publiques / authentifiées :
 *   POST  /billing/validate-promo-code         Valider un code (retourne remise, pas application)
 *
 * Routes super-admin :
 *   GET   /super-admin/promo-codes             Liste de tous les codes
 *   POST  /super-admin/promo-codes             Créer un code
 *   PATCH /super-admin/promo-codes/:id         Modifier un code
 *   DELETE /super-admin/promo-codes/:id        Supprimer un code
 *   GET   /super-admin/promo-codes/stats       Statistiques globales
 */

import { Router, type IRouter, type RequestHandler } from "express";
import { db, promoCodesTable, promoCodeUsesTable, partnerProgramsTable, organizationsTable } from "@workspace/db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Middleware super-admin ─────────────────────────────────────────
const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") { res.status(403).json({ error: "Accès réservé aux super-administrateurs" }); return; }
  next();
};

// ── Helper : valider un code et calculer la remise ────────────────

export async function resolvePromoCode(code: string, amountTTC: number): Promise<{
  valid: boolean;
  error?: string;
  promoCode?: typeof promoCodesTable.$inferSelect;
  discountAmount: number;
  finalAmount: number;
}> {
  const upper = code.trim().toUpperCase();
  const [promo] = await db
    .select()
    .from(promoCodesTable)
    .where(eq(promoCodesTable.code, upper))
    .limit(1);

  if (!promo) return { valid: false, error: "Code invalide ou expiré.", discountAmount: 0, finalAmount: amountTTC };
  if (!promo.isActive) return { valid: false, error: "Ce code n'est plus actif.", discountAmount: 0, finalAmount: amountTTC };
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { valid: false, error: "Ce code est expiré.", discountAmount: 0, finalAmount: amountTTC };
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { valid: false, error: "Ce code a atteint son nombre maximal d'utilisations.", discountAmount: 0, finalAmount: amountTTC };
  }

  let discountAmount = 0;
  if (promo.discountType === "percent") {
    discountAmount = Math.round(amountTTC * promo.discountValue / 100);
  } else {
    discountAmount = Math.min(promo.discountValue, amountTTC);
  }
  const finalAmount = Math.max(0, amountTTC - discountAmount);

  return { valid: true, promoCode: promo, discountAmount, finalAmount };
}

// ── POST /billing/validate-promo-code ─────────────────────────────

router.post("/billing/validate-promo-code", async (req, res) => {
  const { code, amountTTC } = req.body as { code?: string; amountTTC?: number };
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Paramètre code requis" });
    return;
  }
  const amount = typeof amountTTC === "number" && amountTTC > 0 ? amountTTC : 0;
  try {
    const result = await resolvePromoCode(code, amount);
    if (!result.valid) {
      res.status(200).json({ valid: false, error: result.error });
      return;
    }
    res.json({
      valid: true,
      code: result.promoCode!.code,
      label: result.promoCode!.label,
      type: result.promoCode!.type,
      discountType: result.promoCode!.discountType,
      discountValue: result.promoCode!.discountValue,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
    });
  } catch (e) {
    logger.error(e, "validate-promo-code error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── GET /super-admin/promo-codes/stats ────────────────────────────

router.get("/super-admin/promo-codes/stats", sa, async (req, res) => {
  try {
    // Séparer en deux requêtes pour éviter l'inflation des compteurs via join
    const [codeRow] = await db
      .select({ totalCodes: count(promoCodesTable.id) })
      .from(promoCodesTable);

    const [useRow] = await db
      .select({
        totalUses:    sql<number>`coalesce(count(*),0)`.mapWith(Number),
        totalDiscount: sql<number>`coalesce(sum(${promoCodeUsesTable.discountApplied}),0)`.mapWith(Number),
      })
      .from(promoCodeUsesTable);

    res.json({
      totalCodes:    codeRow?.totalCodes    ?? 0,
      totalUses:     useRow?.totalUses      ?? 0,
      totalDiscount: useRow?.totalDiscount  ?? 0,
    });
  } catch (e) {
    logger.error(e, "promo-codes/stats error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── GET /super-admin/promo-codes ──────────────────────────────────

router.get("/super-admin/promo-codes", sa, async (req, res) => {
  try {
    const codes = await db
      .select()
      .from(promoCodesTable)
      .orderBy(desc(promoCodesTable.createdAt));
    res.json(codes);
  } catch (e) {
    logger.error(e, "promo-codes list error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── POST /super-admin/promo-codes ─────────────────────────────────

router.post("/super-admin/promo-codes", sa, async (req, res) => {
  const { code, label, type, discountType, discountValue, maxUses, expiresAt, isActive, partnerId } = req.body as Record<string, unknown>;
  if (!code || !label || !discountType || discountValue == null) {
    res.status(400).json({ error: "Champs requis : code, label, discountType, discountValue" });
    return;
  }
  const upper = String(code).trim().toUpperCase();
  try {
    const [created] = await db.insert(promoCodesTable).values({
      code: upper,
      label: String(label),
      type: String(type ?? "promo"),
      discountType: String(discountType),
      discountValue: Number(discountValue),
      maxUses: maxUses != null ? Number(maxUses) : null,
      expiresAt: expiresAt ? new Date(String(expiresAt)) : null,
      isActive: isActive !== false,
      partnerId: partnerId ? String(partnerId) : null,
      createdById: req.authUser!.id,
    }).returning();
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "Ce code existe déjà" });
      return;
    }
    logger.error(e, "promo-codes create error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── PATCH /super-admin/promo-codes/:id ───────────────────────────

router.patch("/super-admin/promo-codes/:id", sa, async (req, res) => {
  const id = req.params.id as string;
  const { label, type, discountType, discountValue, maxUses, expiresAt, isActive, partnerId } = req.body as Record<string, unknown>;
  try {
    const updates: Partial<typeof promoCodesTable.$inferSelect> = {};
    if (label     != null) updates.label         = String(label);
    if (type      != null) updates.type           = String(type);
    if (discountType != null) updates.discountType = String(discountType);
    if (discountValue != null) updates.discountValue = Number(discountValue);
    if ("maxUses"  in req.body) updates.maxUses   = maxUses != null ? Number(maxUses) : null;
    if ("expiresAt" in req.body) updates.expiresAt = expiresAt ? new Date(String(expiresAt)) : null;
    if (isActive  != null) updates.isActive       = Boolean(isActive);
    if ("partnerId" in req.body) updates.partnerId = partnerId ? String(partnerId) : null;

    const [updated] = await db
      .update(promoCodesTable)
      .set(updates)
      .where(eq(promoCodesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Code introuvable" }); return; }
    res.json(updated);
  } catch (e) {
    logger.error(e, "promo-codes update error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ── DELETE /super-admin/promo-codes/:id ──────────────────────────

router.delete("/super-admin/promo-codes/:id", sa, async (req, res) => {
  const id = req.params.id as string;
  try {
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    logger.error(e, "promo-codes delete error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
