/**
 * Intégration Stripe — paiement carte PCI-compliant + autopay.
 *
 * Flux paiement immédiat (PaymentIntent) :
 *   1. POST /billing/stripe/payment-intent  → clientSecret
 *   2. Frontend confirme via Stripe.js (données carte = iframe Stripe, jamais dans nos serveurs)
 *   3. Webhook payment_intent.succeeded → active l'abonnement
 *
 * Flux autopay (SetupIntent) :
 *   1. POST /billing/stripe/setup-intent  → clientSecret
 *   2. Frontend confirme → Stripe sauvegarde la carte
 *   3. Webhook setup_intent.succeeded → on stocke pm_xxx + infos affichage
 *   4. À chaque renouvellement : POST /billing/stripe/charge-autopay
 *
 * Variables d'env requises :
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *   (frontend : VITE_STRIPE_PUBLISHABLE_KEY)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  organizationsTable,
  organizationSubscriptionsTable,
  subscriptionPlansTable,
  paymentTransactionsTable,
  billingEventsTable,
} from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getStripeClient, requireStripe, STRIPE_CONFIGURED, STRIPE_CURRENCY, verifyStripeWebhook } from "../lib/stripe";
import { sendEmail } from "../lib/email";
import type Stripe from "stripe";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "American Express",
  discover: "Discover", unionpay: "UnionPay", jcb: "JCB", unknown: "Carte",
};

function cardLabel(brand: string, last4: string): string {
  return `${CARD_BRAND_LABELS[brand] ?? brand} •••• ${last4}`;
}

function generateRef(prefix: string, seq: number, year: number) {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

/** Crée ou récupère le Stripe Customer lié à une organisation. */
async function getOrCreateStripeCustomer(orgId: string): Promise<string> {
  const stripe = requireStripe();
  const [org] = await db.select({
    id: organizationsTable.id,
    name: organizationsTable.name,
    contactEmail: organizationsTable.contactEmail,
    stripeCustomerId: organizationsTable.stripeCustomerId,
  }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);

  if (!org) throw new Error("Organisation introuvable");
  if (org.stripeCustomerId) return org.stripeCustomerId;

  // Créer le customer sur Stripe
  const customer = await stripe.customers.create({
    name: org.name,
    email: org.contactEmail ?? undefined,
    metadata: { organizationId: orgId },
  });

  await db.update(organizationsTable).set({ stripeCustomerId: customer.id })
    .where(eq(organizationsTable.id, orgId));

  logger.info({ orgId, customerId: customer.id }, "Stripe customer créé");
  return customer.id;
}

/** Calcule le montant de l'abonnement courant (en XOF). */
async function getCurrentAmount(orgId: string): Promise<{ amount: number; sub: typeof organizationSubscriptionsTable.$inferSelect; plan: typeof subscriptionPlansTable.$inferSelect }> {
  const [row] = await db
    .select({ sub: organizationSubscriptionsTable, plan: subscriptionPlansTable })
    .from(organizationSubscriptionsTable)
    .innerJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ))
    .limit(1);

  if (!row) throw new Error("Aucun abonnement actif");
  const pricePerSeat = row.sub.billingCycle === "annual"
    ? row.plan.annualPricePerSeat
    : row.plan.monthlyPricePerSeat;
  const amount = (row.sub.unitPrice > 0 ? row.sub.unitPrice : pricePerSeat) * row.sub.seats;
  return { amount, sub: row.sub, plan: row.plan };
}

/** Renouvelle l'abonnement après paiement confirmé. */
async function renewSubscription(sub: typeof organizationSubscriptionsTable.$inferSelect): Promise<void> {
  const now = new Date();
  const periodStart = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now
    ? new Date(sub.currentPeriodEnd) : now;
  const periodEnd = new Date(periodStart);
  if (sub.billingCycle === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Calcule la prochaine date d'autopay (1 jour avant l'échéance)
  const nextAutopay = new Date(periodEnd);
  nextAutopay.setDate(nextAutopay.getDate() - 1);

  await db.update(organizationSubscriptionsTable).set({
    status: "active",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    nextAutopayAt: sub.autopayEnabled ? nextAutopay : undefined,
  }).where(eq(organizationSubscriptionsTable.id, sub.id));
}

/** Envoie l'email de confirmation de paiement au tenant. */
async function sendPaymentConfirmationEmail(orgId: string, amount: number, receiptNumber: string, planName: string): Promise<void> {
  try {
    const [org] = await db.select({
      name: organizationsTable.name,
      contactEmail: organizationsTable.contactEmail,
    }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);

    if (!org?.contactEmail) return;

    const amountFmt = new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
    await sendEmail({
      to: org.contactEmail,
      subject: `✅ Paiement confirmé — ${receiptNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#d97706;">Gaméasù — Paiement confirmé</h2>
          <p>Bonjour,</p>
          <p>Votre paiement de <strong>${amountFmt}</strong> pour la formule <strong>${planName}</strong> a été confirmé avec succès.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">N° de reçu</td><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">${receiptNumber}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Organisation</td><td style="padding:8px;border:1px solid #e5e7eb;">${org.name}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;">Montant</td><td style="padding:8px;border:1px solid #e5e7eb;">${amountFmt}</td></tr>
          </table>
          <p>Votre accès à la plateforme a été renouvelé automatiquement.</p>
          <p style="color:#6b7280;font-size:12px;">Gaméasù — Plateforme SaaS</p>
        </div>`,
      text: `Paiement confirmé — ${receiptNumber}\n\nMontant : ${amountFmt}\nOrganisation : ${org.name}\n\nVotre accès a été renouvelé.`,
      category: "payment_confirmation",
    });
  } catch (e) {
    logger.warn({ err: e, orgId }, "Email confirmation paiement non envoyé — non bloquant");
  }
}

/** Envoie l'email d'échec de paiement. */
async function sendPaymentFailedEmail(orgId: string, planName: string): Promise<void> {
  try {
    const [org] = await db.select({
      name: organizationsTable.name,
      contactEmail: organizationsTable.contactEmail,
    }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    if (!org?.contactEmail) return;

    await sendEmail({
      to: org.contactEmail,
      subject: "⚠️ Échec du paiement — action requise",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#dc2626;">Gaméasù — Paiement échoué</h2>
        <p>Bonjour,</p>
        <p>Le prélèvement automatique pour la formule <strong>${planName}</strong> de l'organisation <strong>${org.name}</strong> a échoué.</p>
        <p>Veuillez vous connecter à la plateforme pour mettre à jour votre moyen de paiement et régulariser votre situation.</p>
        <p>Sans action de votre part, votre accès pourra être suspendu.</p>
        <p style="color:#6b7280;font-size:12px;">Gaméasù — Plateforme SaaS</p>
      </div>`,
      text: `Gaméasù — Paiement échoué\n\nLe prélèvement pour ${planName} (${org.name}) a échoué. Connectez-vous pour régulariser.`,
      category: "payment_failed",
    });
  } catch (e) {
    logger.warn({ err: e, orgId }, "Email paiement échoué non envoyé — non bloquant");
  }
}

// ── GET /billing/stripe/status ────────────────────────────────────
// Indique si Stripe est configuré et renvoie les infos de la carte sauvegardée.
router.get("/billing/stripe/status", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  const [sub] = await db
    .select({
      autopayEnabled: organizationSubscriptionsTable.autopayEnabled,
      cardBrand: organizationSubscriptionsTable.cardBrand,
      cardLast4: organizationSubscriptionsTable.cardLast4,
      cardExpMonth: organizationSubscriptionsTable.cardExpMonth,
      cardExpYear: organizationSubscriptionsTable.cardExpYear,
      nextAutopayAt: organizationSubscriptionsTable.nextAutopayAt,
      currentPeriodEnd: organizationSubscriptionsTable.currentPeriodEnd,
    })
    .from(organizationSubscriptionsTable)
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ))
    .limit(1);

  res.json({
    stripeConfigured: STRIPE_CONFIGURED,
    autopayEnabled: sub?.autopayEnabled ?? false,
    savedCard: sub?.cardLast4 ? {
      brand: sub.cardBrand,
      last4: sub.cardLast4,
      expMonth: sub.cardExpMonth,
      expYear: sub.cardExpYear,
      label: cardLabel(sub.cardBrand ?? "unknown", sub.cardLast4),
    } : null,
    nextAutopayAt: sub?.nextAutopayAt ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  });
});

// ── POST /billing/stripe/payment-intent ───────────────────────────
// Crée un PaymentIntent Stripe pour le paiement immédiat par carte.
// Renvoie le clientSecret au frontend — la carte ne transite jamais par nos serveurs.
router.post("/billing/stripe/payment-intent", requireAdmin, async (req, res) => {
  if (!STRIPE_CONFIGURED) {
    res.status(503).json({
      error: "Stripe non configuré",
      message: "Ajoutez STRIPE_SECRET_KEY dans les variables d'environnement pour activer le paiement par carte.",
    });
    return;
  }

  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  try {
    const stripe = requireStripe();
    const { amount, sub, plan } = await getCurrentAmount(orgId);
    if (amount <= 0) { res.status(400).json({ error: "Montant invalide" }); return; }

    const customerId = await getOrCreateStripeCustomer(orgId);
    const { saveCard = false, purpose = "renewal" } = req.body;

    const intent = await stripe.paymentIntents.create({
      amount,                           // XOF = devise à zéro décimale, montant direct
      currency: STRIPE_CURRENCY,
      customer: customerId,
      setup_future_usage: saveCard ? "off_session" : undefined,
      metadata: {
        organizationId: orgId,
        subscriptionId: sub.id,
        planName: plan.name,
        purpose,
        billingCycle: sub.billingCycle,
        seats: String(sub.seats),
      },
      description: `Gaméasù — ${plan.name} (${sub.billingCycle === "annual" ? "annuel" : "mensuel"}) — ${sub.seats} siège(s)`,
      receipt_email: req.authUser!.email ?? undefined,
    });

    // Crée la payment_transaction en base (statut pending)
    const year = new Date().getFullYear();
    const [countRow] = await db.select({ c: db.$count(paymentTransactionsTable) })
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.organizationId, orgId));
    const seq = Number(countRow?.c ?? 0) + 1;
    const txRef = generateRef("PAY", seq, year);

    const [event] = await db.insert(billingEventsTable).values({
      organizationId: orgId,
      subscriptionId: sub.id,
      kind: "payment",
      label: `Paiement carte — ${plan.name}`,
      amount,
      currency: "XOF",
      status: "pending",
      reference: txRef,
    }).returning();

    await db.insert(paymentTransactionsTable).values({
      organizationId: orgId,
      subscriptionId: sub.id,
      billingEventId: event.id,
      amount,
      currency: "XOF",
      method: "card",
      reference: txRef,
      gatewayRef: intent.id,
      purpose,
      status: "pending",
    });

    logger.info({ orgId, intentId: intent.id, amount }, "Stripe PaymentIntent créé");
    res.json({ clientSecret: intent.client_secret, txRef, amount, currency: STRIPE_CURRENCY });
  } catch (e: any) {
    logger.error({ err: e, orgId }, "Erreur création PaymentIntent");
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
});

// ── POST /billing/stripe/setup-intent ────────────────────────────
// Crée un SetupIntent pour sauvegarder une carte sans débit immédiat (autopay).
router.post("/billing/stripe/setup-intent", requireAdmin, async (req, res) => {
  if (!STRIPE_CONFIGURED) {
    res.status(503).json({ error: "Stripe non configuré", message: "Ajoutez STRIPE_SECRET_KEY pour activer l'autopay." });
    return;
  }

  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  try {
    const stripe = requireStripe();
    const customerId = await getOrCreateStripeCustomer(orgId);

    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { organizationId: orgId },
    });

    logger.info({ orgId, intentId: intent.id }, "Stripe SetupIntent créé");
    res.json({ clientSecret: intent.client_secret });
  } catch (e: any) {
    logger.error({ err: e, orgId }, "Erreur SetupIntent");
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
});

// ── DELETE /billing/stripe/saved-card ────────────────────────────
// Supprime la carte sauvegardée et désactive l'autopay.
router.delete("/billing/stripe/saved-card", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  try {
    const [sub] = await db
      .select({
        id: organizationSubscriptionsTable.id,
        stripePaymentMethodId: organizationSubscriptionsTable.stripePaymentMethodId,
      })
      .from(organizationSubscriptionsTable)
      .where(and(
        eq(organizationSubscriptionsTable.organizationId, orgId),
        eq(organizationSubscriptionsTable.isCurrent, true),
      ))
      .limit(1);

    if (!sub) { res.status(404).json({ error: "Abonnement introuvable" }); return; }

    // Détacher le PaymentMethod de Stripe si configuré
    if (STRIPE_CONFIGURED && sub.stripePaymentMethodId) {
      try {
        await requireStripe().paymentMethods.detach(sub.stripePaymentMethodId);
      } catch (e) {
        logger.warn({ err: e }, "Impossible de détacher le PaymentMethod Stripe — continuer quand même");
      }
    }

    await db.update(organizationSubscriptionsTable).set({
      autopayEnabled: false,
      stripePaymentMethodId: null,
      cardBrand: null,
      cardLast4: null,
      cardExpMonth: null,
      cardExpYear: null,
      nextAutopayAt: null,
    }).where(eq(organizationSubscriptionsTable.id, sub.id));

    res.json({ success: true });
  } catch (e: any) {
    logger.error({ err: e, orgId }, "Erreur suppression carte");
    res.status(500).json({ error: e.message });
  }
});

// ── POST /billing/stripe/autopay/disable ─────────────────────────
router.post("/billing/stripe/autopay/disable", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  await db.update(organizationSubscriptionsTable).set({
    autopayEnabled: false,
    nextAutopayAt: null,
  }).where(and(
    eq(organizationSubscriptionsTable.organizationId, orgId),
    eq(organizationSubscriptionsTable.isCurrent, true),
  ));

  res.json({ autopayEnabled: false });
});

// ── POST /billing/stripe/autopay/enable ──────────────────────────
// Active l'autopay si une carte est déjà sauvegardée.
router.post("/billing/stripe/autopay/enable", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  const [sub] = await db
    .select({
      id: organizationSubscriptionsTable.id,
      stripePaymentMethodId: organizationSubscriptionsTable.stripePaymentMethodId,
      currentPeriodEnd: organizationSubscriptionsTable.currentPeriodEnd,
    })
    .from(organizationSubscriptionsTable)
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ))
    .limit(1);

  if (!sub?.stripePaymentMethodId) {
    res.status(400).json({ error: "Aucune carte sauvegardée — ajoutez d'abord une carte de paiement automatique." });
    return;
  }

  const nextAutopay = new Date(sub.currentPeriodEnd ?? new Date());
  nextAutopay.setDate(nextAutopay.getDate() - 1); // J-1 avant l'échéance

  await db.update(organizationSubscriptionsTable).set({
    autopayEnabled: true,
    nextAutopayAt: nextAutopay,
  }).where(eq(organizationSubscriptionsTable.id, sub.id));

  res.json({ autopayEnabled: true, nextAutopayAt: nextAutopay });
});

// ── POST /billing/stripe/charge-autopay ──────────────────────────
// Prélève la carte sauvegardée pour le renouvellement automatique.
// Appelé par un job planifié ou manuellement en test.
router.post("/billing/stripe/charge-autopay", requireAdmin, async (req, res) => {
  if (!STRIPE_CONFIGURED) {
    res.status(503).json({ error: "Stripe non configuré" });
    return;
  }

  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  try {
    const stripe = requireStripe();
    const { amount, sub, plan } = await getCurrentAmount(orgId);
    if (!sub.autopayEnabled || !sub.stripePaymentMethodId) {
      res.status(400).json({ error: "Autopay non activé ou aucune carte enregistrée" }); return;
    }

    const customerId = await getOrCreateStripeCustomer(orgId);

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: STRIPE_CURRENCY,
      customer: customerId,
      payment_method: sub.stripePaymentMethodId,
      confirm: true,
      off_session: true,
      metadata: {
        organizationId: orgId,
        subscriptionId: sub.id,
        purpose: "renewal_autopay",
      },
    });

    const year = new Date().getFullYear();
    const txRef = `AUTOPAY-${year}-${Date.now()}`;

    logger.info({ orgId, intentId: intent.id, amount }, "Autopay Stripe déclenché");

    if (intent.status === "succeeded") {
      res.json({ success: true, intentId: intent.id });
    } else {
      res.json({ success: false, status: intent.status, intentId: intent.id });
    }
  } catch (e: any) {
    logger.error({ err: e, orgId }, "Erreur charge autopay");
    if (e.code === "authentication_required" || e.code === "card_declined") {
      await sendPaymentFailedEmail(orgId, "votre formule");
    }
    res.status(e.statusCode ?? 500).json({ error: e.message, code: e.code });
  }
});

// ── POST /webhooks/stripe ─────────────────────────────────────────
// Réception des événements Stripe avec vérification de signature.
// IMPORTANT : cette route doit recevoir le body raw (Buffer), pas du JSON parsé.
router.post("/webhooks/stripe", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    logger.warn("Webhook Stripe reçu sans signature ou secret non configuré");
    res.status(400).json({ error: "Signature manquante ou webhook secret non configuré" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(req.body as Buffer, sig, webhookSecret);
  } catch (e: any) {
    logger.warn({ err: e }, "Signature webhook Stripe invalide");
    res.status(400).json({ error: `Signature invalide : ${e.message}` });
    return;
  }

  logger.info({ eventType: event.type, eventId: event.id }, "Webhook Stripe reçu");

  try {
    switch (event.type) {

      // ── Paiement réussi ───────────────────────────────────────
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orgId = intent.metadata?.organizationId;
        if (!orgId) break;

        // Trouver la transaction par gatewayRef (PaymentIntent ID)
        const [tx] = await db.select().from(paymentTransactionsTable)
          .where(eq(paymentTransactionsTable.gatewayRef, intent.id)).limit(1);

        if (tx && tx.status !== "confirmed") {
          // Générer le numéro de reçu
          const year = new Date().getFullYear();
          const [countRow] = await db.select({ c: db.$count(paymentTransactionsTable) })
            .from(paymentTransactionsTable)
            .where(and(
              eq(paymentTransactionsTable.organizationId, orgId),
              eq(paymentTransactionsTable.status, "confirmed"),
            ));
          const receiptSeq = Number(countRow?.c ?? 0) + 1;
          const receiptNumber = generateRef("REC", receiptSeq, year);

          // Mettre à jour la transaction
          await db.update(paymentTransactionsTable).set({
            status: "confirmed",
            confirmedAt: new Date(),
            receiptNumber,
          }).where(eq(paymentTransactionsTable.id, tx.id));

          // Mettre à jour le billing event
          if (tx.billingEventId) {
            await db.update(billingEventsTable).set({ status: "paid", reference: receiptNumber })
              .where(eq(billingEventsTable.id, tx.billingEventId));
          }

          // Renouveler l'abonnement
          if (tx.subscriptionId) {
            const [sub] = await db.select().from(organizationSubscriptionsTable)
              .where(eq(organizationSubscriptionsTable.id, tx.subscriptionId)).limit(1);
            if (sub) await renewSubscription(sub);
          }

          // Email de confirmation
          const planName = intent.metadata?.planName ?? "votre formule";
          await sendPaymentConfirmationEmail(orgId, intent.amount, receiptNumber, planName);

          // Si la carte doit être sauvegardée pour l'autopay
          if (intent.payment_method && intent.setup_future_usage === "off_session") {
            const pmId = typeof intent.payment_method === "string"
              ? intent.payment_method
              : intent.payment_method.id;
            await handleSaveCard(orgId, pmId, intent.metadata?.subscriptionId);
          }

          logger.info({ txId: tx.id, receiptNumber, orgId }, "Paiement Stripe confirmé via webhook");
        }
        break;
      }

      // ── Paiement échoué ────────────────────────────────────────
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orgId = intent.metadata?.organizationId;
        if (!orgId) break;

        const [tx] = await db.select().from(paymentTransactionsTable)
          .where(eq(paymentTransactionsTable.gatewayRef, intent.id)).limit(1);

        if (tx && tx.status === "pending") {
          await db.update(paymentTransactionsTable).set({
            status: "failed",
            failedAt: new Date(),
          }).where(eq(paymentTransactionsTable.id, tx.id));

          if (tx.billingEventId) {
            await db.update(billingEventsTable).set({ status: "failed" })
              .where(eq(billingEventsTable.id, tx.billingEventId));
          }

          await db.update(organizationSubscriptionsTable).set({ status: "past_due" })
            .where(and(
              eq(organizationSubscriptionsTable.organizationId, orgId),
              eq(organizationSubscriptionsTable.isCurrent, true),
            ));

          const planName = intent.metadata?.planName ?? "votre formule";
          await sendPaymentFailedEmail(orgId, planName);
        }
        break;
      }

      // ── Carte sauvegardée pour autopay (SetupIntent) ──────────
      case "setup_intent.succeeded": {
        const intent = event.data.object as Stripe.SetupIntent;
        const orgId = intent.metadata?.organizationId;
        if (!orgId || !intent.payment_method) break;

        const pmId = typeof intent.payment_method === "string"
          ? intent.payment_method
          : intent.payment_method.id;

        await handleSaveCard(orgId, pmId);
        break;
      }

      default:
        logger.debug({ eventType: event.type }, "Événement Stripe non géré (ignoré)");
    }

    res.json({ received: true, eventType: event.type });
  } catch (e: any) {
    logger.error({ err: e, eventType: event.type }, "Erreur traitement webhook Stripe");
    res.status(500).json({ error: e.message });
  }
});

/** Sauvegarde un PaymentMethod Stripe sur l'abonnement courant. */
async function handleSaveCard(orgId: string, pmId: string, subscriptionId?: string): Promise<void> {
  if (!STRIPE_CONFIGURED) return;
  try {
    const stripe = requireStripe();
    const pm = await stripe.paymentMethods.retrieve(pmId);
    const card = pm.card;
    if (!card) return;

    const nextAutopay = new Date();
    nextAutopay.setMonth(nextAutopay.getMonth() + 1);
    nextAutopay.setDate(nextAutopay.getDate() - 1);

    await db.update(organizationSubscriptionsTable).set({
      stripePaymentMethodId: pmId,
      cardBrand: card.brand,
      cardLast4: card.last4,
      cardExpMonth: card.exp_month,
      cardExpYear: card.exp_year,
      autopayEnabled: true,
      nextAutopayAt: nextAutopay,
    }).where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ));

    logger.info({ orgId, pmId, brand: card.brand, last4: card.last4 }, "Carte Stripe sauvegardée pour autopay");
  } catch (e) {
    logger.warn({ err: e, orgId, pmId }, "Impossible de récupérer les infos de la carte Stripe");
  }
}

export default router;
