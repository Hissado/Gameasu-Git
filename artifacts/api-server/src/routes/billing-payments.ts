import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  paymentTransactionsTable,
  paymentGatewayConfigsTable,
  billingEventsTable,
  organizationSubscriptionsTable,
  organizationsTable,
} from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { calcPricing } from "../lib/pricing";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  card: "Carte bancaire",
  mixx: "Mixx",
  flooz: "Flooz",
  mobile_money: "Mobile Money",
};

const PURPOSE_LABELS: Record<string, string> = {
  renewal: "Renouvellement d'abonnement",
  setup_fee: "Frais d'installation",
  upgrade: "Changement de formule",
  addon: "Module additionnel",
  seats: "Licences supplémentaires",
};

function generateRef(prefix: string, seq: number, year: number) {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

// ── GET /billing/payment-transactions ────────────────────────────
router.get("/billing/payment-transactions", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  const rows = await db
    .select()
    .from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.organizationId, orgId))
    .orderBy(desc(paymentTransactionsTable.createdAt))
    .limit(50);

  res.json({ data: rows });
});

// ── POST /billing/pay ─────────────────────────────────────────────
// Initie une transaction de paiement pour l'abonnement courant.
// Crée un billing_event pending + une payment_transaction pending.
router.post("/billing/pay", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

  const { method, payerPhone, reference, notes, purpose = "renewal" } = req.body;

  if (!method || !["card", "mixx", "flooz", "mobile_money"].includes(method)) {
    res.status(400).json({ error: "Mode de paiement non supporté" }); return;
  }

  const [sub] = await db
    .select({ sub: organizationSubscriptionsTable })
    .from(organizationSubscriptionsTable)
    .where(and(
      eq(organizationSubscriptionsTable.organizationId, orgId),
      eq(organizationSubscriptionsTable.isCurrent, true),
    ))
    .limit(1);

  if (!sub) { res.status(404).json({ error: "Aucun abonnement actif trouvé" }); return; }

  const pricing = calcPricing(sub.sub.seats);
  if (pricing.isEnterprise) {
    res.status(400).json({ error: "Plus de 50 utilisateurs — contactez-nous pour un devis sur-mesure." });
    return;
  }
  const amount = pricing.ttc;
  if (amount <= 0) { res.status(400).json({ error: "Montant invalide — vérifiez votre abonnement" }); return; }

  const year = new Date().getFullYear();
  const countRes = await db
    .select({ c: sql<number>`count(*)` })
    .from(paymentTransactionsTable)
    .where(and(
      eq(paymentTransactionsTable.organizationId, orgId),
      sql`EXTRACT(year FROM created_at) = ${year}`,
    ));
  const seq = Number(countRes[0]?.c ?? 0) + 1;
  const txRef = generateRef("PAY", seq, year);

  // Billing event (pending)
  const [event] = await db.insert(billingEventsTable).values({
    organizationId: orgId,
    subscriptionId: sub.sub.id,
    kind: "payment",
    label: `${PURPOSE_LABELS[purpose] ?? purpose} — ${sub.sub.seats} utilisateur${sub.sub.seats > 1 ? "s" : ""} (${METHOD_LABELS[method] ?? method})`,
    amount,
    currency: "XOF",
    status: "pending",
    reference: txRef,
  }).returning();

  // Payment transaction
  const [tx] = await db.insert(paymentTransactionsTable).values({
    organizationId: orgId,
    subscriptionId: sub.sub.id,
    billingEventId: event.id,
    amount,
    currency: "XOF",
    method,
    payerPhone: payerPhone || null,
    reference: txRef,
    gatewayRef: reference || null,
    purpose,
    notes: notes || null,
    status: "pending",
  }).returning();

  logger.info({ txId: tx.id, orgId, method, amount, ref: txRef }, "Payment transaction initiated");
  res.status(201).json({ ...tx, billingEvent: event });
});

// ── POST /billing/payment-transactions/:id/confirm ────────────────
// Confirmation manuelle (ou via webhook dans le futur).
// Met à jour la transaction, le billing_event, renouvelle l'abonnement.
router.post("/billing/payment-transactions/:id/confirm", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [tx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(and(
      eq(paymentTransactionsTable.id, (req.params.id as string)),
      eq(paymentTransactionsTable.organizationId, orgId),
    ))
    .limit(1);

  if (!tx) { res.status(404).json({ error: "Transaction introuvable" }); return; }
  if (tx.status === "confirmed") { res.status(400).json({ error: "Transaction déjà confirmée" }); return; }
  if (tx.status === "cancelled") { res.status(400).json({ error: "Transaction annulée, impossible de confirmer" }); return; }

  const { gatewayRef } = req.body;

  // Numéro de reçu unique
  const year = new Date().getFullYear();
  const confirmedCount = await db
    .select({ c: sql<number>`count(*)` })
    .from(paymentTransactionsTable)
    .where(and(
      eq(paymentTransactionsTable.organizationId, orgId),
      eq(paymentTransactionsTable.status, "confirmed"),
      sql`EXTRACT(year FROM created_at) = ${year}`,
    ));
  const receiptSeq = Number(confirmedCount[0]?.c ?? 0) + 1;
  const receiptNumber = generateRef("REC", receiptSeq, year);

  // Update transaction
  const [updated] = await db.update(paymentTransactionsTable).set({
    status: "confirmed",
    confirmedAt: new Date(),
    gatewayRef: gatewayRef || tx.gatewayRef,
    receiptNumber,
  }).where(eq(paymentTransactionsTable.id, tx.id)).returning();

  // Update billing event → paid
  if (tx.billingEventId) {
    await db.update(billingEventsTable).set({
      status: "paid",
      reference: receiptNumber,
    }).where(eq(billingEventsTable.id, tx.billingEventId));
  }

  // Renouvellement de l'abonnement
  if (tx.subscriptionId) {
    const [sub] = await db
      .select()
      .from(organizationSubscriptionsTable)
      .where(eq(organizationSubscriptionsTable.id, tx.subscriptionId))
      .limit(1);

    if (sub) {
      const now = new Date();
      const periodStart = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now
        ? new Date(sub.currentPeriodEnd)
        : now;
      const periodEnd = new Date(periodStart);
      if (sub.billingCycle === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      await db.update(organizationSubscriptionsTable).set({
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      }).where(eq(organizationSubscriptionsTable.id, sub.id));
    }
  }

  logger.info({ txId: tx.id, receiptNumber }, "Payment transaction confirmed — subscription renewed");
  res.json({ ...updated });
});

// ── POST /billing/payment-transactions/:id/cancel ─────────────────
router.post("/billing/payment-transactions/:id/cancel", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [tx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(and(
      eq(paymentTransactionsTable.id, (req.params.id as string)),
      eq(paymentTransactionsTable.organizationId, orgId),
    ))
    .limit(1);

  if (!tx) { res.status(404).json({ error: "Transaction introuvable" }); return; }
  if (tx.status === "confirmed") { res.status(400).json({ error: "Transaction confirmée — impossible d'annuler" }); return; }

  const [updated] = await db.update(paymentTransactionsTable).set({
    status: "cancelled",
    cancelledAt: new Date(),
  }).where(eq(paymentTransactionsTable.id, tx.id)).returning();

  if (tx.billingEventId) {
    await db.update(billingEventsTable).set({ status: "failed" })
      .where(eq(billingEventsTable.id, tx.billingEventId));
  }

  res.json({ ...updated });
});

// ── GET /billing/payment-transactions/:id/receipt ─────────────────
router.get("/billing/payment-transactions/:id/receipt", requireAdmin, async (req, res) => {
  const orgId = req.authUser!.organizationId;
  const [tx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(and(
      eq(paymentTransactionsTable.id, (req.params.id as string)),
      eq(paymentTransactionsTable.organizationId, orgId),
    ))
    .limit(1);

  if (!tx) { res.status(404).json({ error: "Transaction introuvable" }); return; }
  if (tx.status !== "confirmed") { res.status(400).json({ error: "Reçu disponible uniquement pour les paiements confirmés" }); return; }

  const [org] = await db
    .select({ name: organizationsTable.name, taxId: organizationsTable.taxId, slug: organizationsTable.slug })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);

  res.json({
    receiptNumber: tx.receiptNumber,
    date: tx.confirmedAt,
    amount: tx.amount,
    currency: tx.currency,
    method: METHOD_LABELS[tx.method] ?? tx.method,
    reference: tx.reference,
    gatewayRef: tx.gatewayRef,
    payerPhone: tx.payerPhone,
    purpose: PURPOSE_LABELS[tx.purpose] ?? tx.purpose,
    notes: tx.notes,
    organization: org ?? { name: "—", taxId: null },
    issuedBy: "Gameasu — Plateforme SaaS",
  });
});

// ── POST /webhooks/payment/:gateway ───────────────────────────────
// Endpoint webhook prêt pour l'intégration de passerelles réelles.
// À sécuriser avec vérification de signature selon la passerelle.
router.post("/webhooks/payment/:gateway", async (req, res) => {
  const { gateway } = req.params as Record<string, string>;
  logger.info({ gateway, headers: req.headers["x-gateway-signature"], body: req.body }, "Webhook payment reçu");

  // TODO (intégration réelle) :
  // 1. Vérifier la signature X-Gateway-Signature selon la passerelle
  // 2. Trouver la transaction via gatewayRef ou référence
  // 3. Mettre à jour le statut (confirmed/failed)
  // 4. Appeler le endpoint confirm si confirmé

  res.json({ received: true, gateway });
});

// ── GET /admin/payment-gateway ────────────────────────────────────
router.get("/admin/payment-gateway", requireAdmin, async (_req, res) => {
  const configs = await db.select().from(paymentGatewayConfigsTable)
    .orderBy(paymentGatewayConfigsTable.gateway);

  // Seed les gateways par défaut si vide
  if (configs.length === 0) {
    const defaults = [
      { gateway: "card_manual", displayName: "Carte bancaire (saisie manuelle)", isEnabled: true, isSandbox: false },
      { gateway: "mixx", displayName: "Mixx (Mobile Money Togo)", isEnabled: true, isSandbox: false },
      { gateway: "flooz", displayName: "Flooz (Mobile Money Togo)", isEnabled: true, isSandbox: false },
      { gateway: "stripe", displayName: "Stripe (carte bancaire en ligne)", isEnabled: false, isSandbox: true },
      { gateway: "cinetpay", displayName: "CinetPay (Afrique de l'Ouest)", isEnabled: false, isSandbox: true },
      { gateway: "paydunya", displayName: "PayDunya (Sénégal / Togo)", isEnabled: false, isSandbox: true },
      { gateway: "flutterwave", displayName: "Flutterwave (Pan-Afrique)", isEnabled: false, isSandbox: true },
    ];
    const inserted = await db.insert(paymentGatewayConfigsTable).values(defaults).returning();
    res.json({ data: inserted }); return;
  }

  // Ne jamais exposer de clés secrètes (stockées en var d'env uniquement)
  res.json({ data: configs });
});

// ── PUT /admin/payment-gateway/:gateway ───────────────────────────
router.put("/admin/payment-gateway/:gateway", requireAdmin, async (req, res) => {
  const { gateway } = req.params as Record<string, string>;
  const { isEnabled, isSandbox, publicKey, webhookUrl, txFeePercent, txFeeFixed, minAmount, maxAmount } = req.body;

  const [existing] = await db
    .select()
    .from(paymentGatewayConfigsTable)
    .where(eq(paymentGatewayConfigsTable.gateway, gateway))
    .limit(1);

  if (!existing) { res.status(404).json({ error: "Passerelle introuvable" }); return; }

  const [updated] = await db.update(paymentGatewayConfigsTable).set({
    isEnabled: isEnabled ?? existing.isEnabled,
    isSandbox: isSandbox ?? existing.isSandbox,
    publicKey: publicKey !== undefined ? publicKey : existing.publicKey,
    webhookUrl: webhookUrl !== undefined ? webhookUrl : existing.webhookUrl,
    txFeePercent: txFeePercent !== undefined ? String(txFeePercent) : existing.txFeePercent,
    txFeeFixed: txFeeFixed !== undefined ? txFeeFixed : existing.txFeeFixed,
    minAmount: minAmount !== undefined ? minAmount : existing.minAmount,
    maxAmount: maxAmount !== undefined ? maxAmount : existing.maxAmount,
  }).where(eq(paymentGatewayConfigsTable.gateway, gateway)).returning();

  logger.info({ gateway, isEnabled: updated.isEnabled }, "Gateway config updated");
  res.json(updated);
});

export default router;
