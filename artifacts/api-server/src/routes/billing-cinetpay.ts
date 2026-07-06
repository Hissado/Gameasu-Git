/**
 * Paiements automatiques CinetPay — carte + Mobile Money (Mixx / Flooz)
 *
 * Routes authentifiées (tenant admin) :
 *   POST  /billing/cinetpay/initiate         Créer une session de paiement CinetPay
 *   GET   /billing/cinetpay/transaction/:ref  Consulter le statut d'une transaction
 *
 * Routes publiques (webhook — exporté séparément) :
 *   POST  /webhooks/cinetpay                 Recevoir la notification CinetPay
 */

import { Router, type IRouter } from "express";
import {
  db,
  paymentTransactionsTable,
  billingEventsTable,
  organizationSubscriptionsTable,
  organizationsTable,
  subscriptionPlansTable,
} from "@workspace/db";
import { and, eq, sql, inArray, desc } from "drizzle-orm";
import { type RequestHandler } from "express";
import { requireAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { calcPlanPricing, getPlan, type Periodicity } from "../lib/pricing";
import { sendEmail } from "../lib/email";
import { getPublicBaseUrl } from "../lib/url";
import {
  isCinetPayConfigured,
  initCinetPayPayment,
  checkCinetPayPayment,
  verifyCinetPaySignature,
  methodToChannels,
  mapCinetPayStatus,
  type CinetPayMethod,
} from "../lib/cinetpay";

// ── Routers ───────────────────────────────────────────────────────

const router: IRouter = Router();          // routes authentifiées
export const cinetpayPublicRouter: IRouter = Router();  // webhook public

// ── Middleware super-admin ─────────────────────────────────────────
const sa: RequestHandler = (req, res, next) => {
  if (!req.authUser) { res.status(401).json({ error: "Authentification requise" }); return; }
  if (req.authUser.role !== "super_admin") { res.status(403).json({ error: "Accès réservé aux super-administrateurs" }); return; }
  next();
};

// ── Helpers ───────────────────────────────────────────────────────

function generateRef(prefix: string, seq: number, year: number) {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(n) + " FCFA"; }

const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

const METHOD_LABELS: Record<string, string> = {
  card: "Carte bancaire (CinetPay)",
  mixx: "Mixx Mobile Money",
  flooz: "Flooz Mobile Money",
  mobile_money: "Mobile Money",
};

// ── Logique d'activation d'abonnement (réutilisée webhook + test) ──
//
// Server-authoritative : le plan/seats/périodicité réellement activés sont ceux
// enregistrés dans la transaction au moment de l'initiation (jamais ceux du body client).

async function confirmAndActivate(opts: {
  txId: string;
  gatewayRef: string;
  verifiedById?: string;
}): Promise<{ receiptNumber: string; periodEnd: Date | null }> {
  const { txId, gatewayRef, verifiedById } = opts;

  // 1. Charger la transaction + org
  const [found] = await db.select({
    tx: paymentTransactionsTable,
    orgName: organizationsTable.name,
    orgContactEmail: organizationsTable.contactEmail,
  }).from(paymentTransactionsTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, paymentTransactionsTable.organizationId))
    .where(eq(paymentTransactionsTable.id, txId))
    .limit(1);

  if (!found) throw new Error(`Transaction ${txId} introuvable`);

  // 2. Résoudre le plan à partir du planCode stocké dans la transaction (server-authoritative)
  const txPlanCode = found.tx.planCode;
  const txSeats    = found.tx.seats ?? 1;
  const txPeriod   = found.tx.periodicity ?? "monthly";

  let resolvedPlanId: string | null = null;
  let resolvedUnitPrice: number | null = null;
  if (txPlanCode) {
    const [planRow] = await db.select({
      id: subscriptionPlansTable.id,
      monthlyPricePerSeat: subscriptionPlansTable.monthlyPricePerSeat,
      annualPricePerSeat: subscriptionPlansTable.annualPricePerSeat,
    }).from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.code, txPlanCode))
      .limit(1);
    if (planRow) {
      resolvedPlanId = planRow.id;
      // Prix unitaire selon la périodicité enregistrée dans la transaction (server-authoritative)
      resolvedUnitPrice = txPeriod === "annual"
        ? (planRow.annualPricePerSeat ?? planRow.monthlyPricePerSeat ?? null)
        : (planRow.monthlyPricePerSeat ?? null);
    }
  }

  const now = new Date();
  const year = now.getFullYear();

  // 3. Numéro de reçu séquentiel (annuel par org)
  const [cnt] = await db.select({ c: sql<number>`count(*)::int` })
    .from(paymentTransactionsTable)
    .where(and(
      eq(paymentTransactionsTable.organizationId, found.tx.organizationId),
      eq(paymentTransactionsTable.status, "confirmed"),
      sql`EXTRACT(year FROM created_at) = ${year}`,
    ));

  const receiptNumber = generateRef("REC", (cnt?.c ?? 0) + 1, year);

  // 4. Confirmer la transaction
  await db.update(paymentTransactionsTable).set({
    status: "confirmed",
    confirmedAt: now,
    verifiedAt: now,
    verifiedById: verifiedById ?? null,
    gatewayRef,
    receiptNumber,
    metadata: { auto: true, source: "cinetpay", gatewayRef },
  }).where(eq(paymentTransactionsTable.id, txId));

  // 5. Mettre à jour l'événement de facturation
  if (found.tx.billingEventId) {
    await db.update(billingEventsTable)
      .set({ status: "paid", reference: receiptNumber })
      .where(eq(billingEventsTable.id, found.tx.billingEventId));
  }

  // 6. Activer / renouveler l'abonnement avec les paramètres exacts de la transaction
  let periodEnd: Date | null = null;
  if (found.tx.subscriptionId) {
    const [sub] = await db.select()
      .from(organizationSubscriptionsTable)
      .where(eq(organizationSubscriptionsTable.id, found.tx.subscriptionId))
      .limit(1);

    if (sub) {
      const months = MONTHS[txPeriod] ?? 1;
      const periodStart = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now
        ? new Date(sub.currentPeriodEnd)
        : now;
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + months);

      // Mettre à jour plan/seats/cycle si la transaction correspond à un changement d'offre
      await db.update(organizationSubscriptionsTable).set({
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        billingCycle: txPeriod,
        seats: txSeats,
        ...(resolvedPlanId ? { planId: resolvedPlanId } : {}),
        ...(resolvedUnitPrice !== null ? { unitPrice: resolvedUnitPrice } : {}),
      }).where(eq(organizationSubscriptionsTable.id, sub.id));
    }
  }

  // 7. E-mail de confirmation
  if (found.orgContactEmail) {
    await sendEmail({
      to: found.orgContactEmail,
      subject: `[Gaméasù] Paiement confirmé — ${receiptNumber}`,
      html: emailPaymentConfirmed({
        orgName: found.orgName,
        receiptNumber,
        amount: found.tx.amount,
        method: METHOD_LABELS[found.tx.method] ?? found.tx.method,
        periodEnd,
      }),
      text: `Votre paiement ${receiptNumber} a été confirmé automatiquement. Votre abonnement Gaméasù est actif.`,
    });
  }

  return { receiptNumber, periodEnd };
}

// ── POST /billing/cinetpay/initiate ───────────────────────────────

router.post("/billing/cinetpay/initiate", requireAdmin, async (req, res, next) => {
  try {
    if (!isCinetPayConfigured()) {
      res.status(503).json({ error: "CinetPay non configuré sur cette instance. Contactez le support Gaméasù." });
      return;
    }

    const orgId = req.authUser!.organizationId;
    if (!orgId) { res.status(400).json({ error: "Organisation introuvable" }); return; }

    const {
      method = "card",
      planCode,
      seats,
      periodicity = "monthly",
      purpose = "renewal",
      payerPhone,
    } = req.body as Record<string, string>;

    const allowedMethods: CinetPayMethod[] = ["card", "mixx", "flooz", "mobile_money"];
    if (!allowedMethods.includes(method as CinetPayMethod)) {
      res.status(400).json({ error: "Méthode invalide pour CinetPay. Utilisez : card, mixx, flooz" });
      return;
    }

    // Récupérer l'abonnement + plan courant (join pour avoir le code du plan)
    const [sub] = await db.select({
      id: organizationSubscriptionsTable.id,
      planId: organizationSubscriptionsTable.planId,
      planCode: subscriptionPlansTable.code,
      seats: organizationSubscriptionsTable.seats,
      billingCycle: organizationSubscriptionsTable.billingCycle,
      unitPrice: organizationSubscriptionsTable.unitPrice,
      currentPeriodEnd: organizationSubscriptionsTable.currentPeriodEnd,
    }).from(organizationSubscriptionsTable)
      .leftJoin(subscriptionPlansTable, eq(subscriptionPlansTable.id, organizationSubscriptionsTable.planId))
      .where(and(
        eq(organizationSubscriptionsTable.organizationId, orgId),
        eq(organizationSubscriptionsTable.isCurrent, true),
      ))
      .limit(1);

    const [org] = await db.select({
      name: organizationsTable.name,
      contactEmail: organizationsTable.contactEmail,
    }).from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);

    // Calcul du montant (planCode du body en priorité, sinon plan courant de l'abonnement)
    const resolvedPlanCode = planCode ?? sub?.planCode ?? "STARTER";
    const resolvedSeats = Math.max(1, parseInt(seats as string, 10) || sub?.seats || 1);
    const resolvedPeriodicity = (periodicity ?? sub?.billingCycle ?? "monthly") as Periodicity;

    const pricing = calcPlanPricing({ planCode: resolvedPlanCode, seats: resolvedSeats, periodicity: resolvedPeriodicity });
    if (!pricing) {
      res.status(400).json({ error: "Plan ou tarification invalide" });
      return;
    }

    const amount = pricing.totalTTC;
    const now = new Date();
    const year = now.getFullYear();

    // Générer la référence
    const [cntRow] = await db.select({ c: sql<number>`count(*)::int` })
      .from(paymentTransactionsTable)
      .where(and(
        eq(paymentTransactionsTable.organizationId, orgId),
        sql`EXTRACT(year FROM created_at) = ${year}`,
      ));

    const txRef = generateRef("PAY", (cntRow?.c ?? 0) + 1, year);
    const planName = getPlan(resolvedPlanCode)?.name ?? resolvedPlanCode;

    // Créer l'événement de facturation
    const [event] = await db.insert(billingEventsTable).values({
      organizationId: orgId,
      subscriptionId: sub?.id ?? null,
      kind: "payment",
      label: `CinetPay — ${planName} ${resolvedSeats} util. (${METHOD_LABELS[method] ?? method})`,
      amount,
      currency: "XOF",
      status: "pending",
      reference: txRef,
    }).returning();

    // Créer la transaction de paiement
    const [tx] = await db.insert(paymentTransactionsTable).values({
      organizationId: orgId,
      subscriptionId: sub?.id ?? null,
      billingEventId: event.id,
      amount,
      currency: "XOF",
      method,
      payerPhone: payerPhone || null,
      reference: txRef,
      purpose,
      status: "pending",
      planCode: resolvedPlanCode,
      seats: resolvedSeats,
      periodicity: resolvedPeriodicity,
      metadata: { gateway: "cinetpay", initiated: now.toISOString() },
    }).returning();

    // Construire les URLs
    const baseUrl = getPublicBaseUrl();
    const notifyUrl = `${baseUrl}/api/webhooks/cinetpay`;
    const returnUrl = `${baseUrl}/billing/paiement-retour?ref=${txRef}`;

    // Appel CinetPay
    const cinetpayResult = await initCinetPayPayment({
      transactionId: txRef,
      amount,
      currency: "XOF",
      description: `Abonnement Gaméasù — ${planName} × ${resolvedSeats} util.`,
      notifyUrl,
      returnUrl,
      channels: methodToChannels(method as CinetPayMethod),
      lang: "fr",
      customerEmail: req.authUser!.email,
      customerName: req.authUser!.name ?? org?.name ?? undefined,
    });

    if (cinetpayResult.code !== "201" && cinetpayResult.code !== "200") {
      // Marquer la transaction comme échouée
      await db.update(paymentTransactionsTable).set({
        status: "failed",
        failedAt: now,
        metadata: { gateway: "cinetpay", error: cinetpayResult.message, code: cinetpayResult.code },
      }).where(eq(paymentTransactionsTable.id, tx.id));

      await db.update(billingEventsTable).set({ status: "failed" }).where(eq(billingEventsTable.id, event.id));

      logger.warn({ txId: tx.id, code: cinetpayResult.code, msg: cinetpayResult.message }, "CinetPay init failed");
      res.status(502).json({ error: `CinetPay : ${cinetpayResult.message ?? "Erreur de passerelle"}` });
      return;
    }

    // Stocker le payment_token CinetPay dans gatewayRef
    const paymentToken = cinetpayResult.data?.payment_token ?? null;
    await db.update(paymentTransactionsTable).set({
      gatewayRef: paymentToken,
    }).where(eq(paymentTransactionsTable.id, tx.id));

    logger.info({ txId: tx.id, txRef, amount, method, orgId }, "CinetPay paiement initié");

    res.status(201).json({
      txRef,
      txId: tx.id,
      amount,
      paymentUrl: cinetpayResult.data?.payment_url,
      paymentToken,
    });
  } catch (e) { next(e); }
});

// ── GET /billing/cinetpay/transaction/:ref ────────────────────────
// Permet au frontend de sonder le statut de la transaction (polling).

router.get("/billing/cinetpay/transaction/:ref", requireAdmin, async (req, res, next) => {
  try {
    const orgId = req.authUser!.organizationId;
    const ref = req.params["ref"] as string;
    if (!orgId || !ref) { res.status(400).json({ error: "Paramètre manquant" }); return; }

    const [tx] = await db.select()
      .from(paymentTransactionsTable)
      .where(and(
        eq(paymentTransactionsTable.organizationId, orgId),
        eq(paymentTransactionsTable.reference, ref),
      ))
      .limit(1);

    if (!tx) { res.status(404).json({ error: "Transaction introuvable" }); return; }

    res.json({ data: tx });
  } catch (e) { next(e); }
});

// ── POST /webhooks/cinetpay (PUBLIC) ──────────────────────────────
// CinetPay envoie ce POST après chaque événement de paiement.
// express.raw() est appliqué sur /api/webhooks/cinetpay dans app.ts AVANT express.json(),
// donc req.body est un Buffer ici. On parse le JSON manuellement pour conserver le raw body
// intact pour la vérification HMAC-SHA256.

cinetpayPublicRouter.post("/webhooks/cinetpay", async (req, res) => {
  // Répondre 200 immédiatement (CinetPay requiert une réponse dans les 10 s)
  res.status(200).send("OK");

  try {
    // 1. Extraire le raw body (Buffer) — express.raw() le fournit directement.
    //    CinetPay peut envoyer application/json OU application/x-www-form-urlencoded
    //    (champs cpm_*), on supporte les deux formats.
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const rawStr = rawBody.toString("utf8");
    let body: Record<string, string>;

    const ct = (req.headers["content-type"] ?? "").toLowerCase();
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("text/plain")) {
      // Parsing URL-encoded (champs cpm_*)
      const params = new URLSearchParams(rawStr);
      body = Object.fromEntries(params.entries()) as Record<string, string>;
    } else {
      // Parsing JSON (format default)
      try {
        body = JSON.parse(rawStr);
      } catch {
        // Tentative URL-encoded si JSON échoue (Content-Type absent ou incorrect)
        try {
          const params = new URLSearchParams(rawStr);
          body = Object.fromEntries(params.entries()) as Record<string, string>;
          if (Object.keys(body).length === 0) throw new Error("empty");
        } catch {
          logger.warn({ rawStr: rawStr.slice(0, 200) }, "Webhook CinetPay : body illisible (ni JSON ni form-urlencoded) — ignoré");
          return;
        }
      }
    }

    const transactionId = body["cpm_trans_id"] ?? body["transaction_id"];
    if (!transactionId) {
      logger.warn({ body }, "Webhook CinetPay : cpm_trans_id manquant");
      return;
    }

    // 2. Vérification de signature HMAC-SHA256 sur le raw body
    const signature = (req.headers["x-cinetpay-signature"] as string | undefined) ?? body["cpm_secret_key_hash"] ?? "";
    const sigResult = verifyCinetPaySignature(rawBody, signature);

    if (sigResult.checked && !sigResult.valid) {
      // Clé secrète configurée ET signature invalide → rejet strict (fail-closed)
      logger.warn({ transactionId }, "Webhook CinetPay : signature HMAC invalide — rejet");
      return;
    }
    if (!sigResult.checked) {
      // Pas de clé secrète : on continue mais on journalise le manque de vérification
      logger.warn({ transactionId }, "Webhook CinetPay : CINETPAY_SECRET_KEY absent — signature non vérifiée, poursuite via /check");
    }

    // 3. Trouver la transaction en base (tenant isolation via reference unique)
    const [tx] = await db.select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.reference, transactionId))
      .limit(1);

    if (!tx) {
      logger.warn({ transactionId }, "Webhook CinetPay : transaction non trouvée en base");
      return;
    }

    // 4. Ignorer si déjà finalisée (idempotence)
    if (tx.status === "confirmed" || tx.status === "failed" || tx.status === "cancelled") {
      logger.info({ transactionId, status: tx.status }, "Webhook CinetPay : transaction déjà finalisée, ignoré");
      return;
    }

    // 5. Double validation authoritative via l'API CinetPay /check
    const checkResult = await checkCinetPayPayment(transactionId);

    if (checkResult.code !== "00" && checkResult.code !== "0") {
      logger.warn({ transactionId, checkCode: checkResult.code, msg: checkResult.message }, "Webhook CinetPay : échec de vérification /check");
      return;
    }

    // 6. Vérifications de cohérence avant activation (montant, devise, offre)
    const reportedAmount   = checkResult.data?.amount   ?? parseInt(body["cpm_amount"] ?? "0", 10);
    const reportedCurrency = checkResult.data?.currency ?? body["cpm_currency"]   ?? "";
    const paymentStatus    = mapCinetPayStatus(checkResult.data?.status ?? body["cpm_trans_stat"] ?? "PENDING");
    const gatewayRef       = checkResult.data?.payment_method
      ? `${checkResult.data.payment_method}:${transactionId}`
      : transactionId;

    if (paymentStatus === "confirmed") {
      // 6a. Devise : doit être XOF
      if (reportedCurrency && reportedCurrency.toUpperCase() !== "XOF") {
        logger.error(
          { transactionId, currency: reportedCurrency },
          "Webhook CinetPay : devise inattendue (attendu XOF) — paiement NON activé",
        );
        await db.update(paymentTransactionsTable).set({
          status: "failed",
          failedAt: new Date(),
          metadata: { gateway: "cinetpay", error: "currency_mismatch", expected: "XOF", received: reportedCurrency },
        }).where(eq(paymentTransactionsTable.id, tx.id));
        return;
      }

      // 6b. Montant : tolérance de 1 FCFA (arrondi)
      if (Number.isFinite(reportedAmount) && reportedAmount > 0 && Math.abs(reportedAmount - tx.amount) > 1) {
        logger.error(
          { transactionId, expected: tx.amount, received: reportedAmount },
          "Webhook CinetPay : montant incohérent — paiement NON activé",
        );
        await db.update(paymentTransactionsTable).set({
          status: "failed",
          failedAt: new Date(),
          metadata: { gateway: "cinetpay", error: "amount_mismatch", expected: tx.amount, received: reportedAmount },
        }).where(eq(paymentTransactionsTable.id, tx.id));
        return;
      }

      // 6c. Offre (planCode + seats) : la transaction stocke ce qui a été calculé côté serveur.
      //     Si CinetPay rapporte des metadata différentes, journaliser (pas de rejet car CinetPay
      //     ne transmet pas l'offre dans /check ; les champs tx sont la source de vérité).
      if (tx.planCode) {
        const planInfo = getPlan(tx.planCode);
        if (!planInfo) {
          logger.error({ transactionId, planCode: tx.planCode }, "Webhook CinetPay : plan introuvable en catalogue — paiement NON activé");
          await db.update(paymentTransactionsTable).set({
            status: "failed",
            failedAt: new Date(),
            metadata: { gateway: "cinetpay", error: "plan_not_found", planCode: tx.planCode },
          }).where(eq(paymentTransactionsTable.id, tx.id));
          return;
        }
      }

      // 7. Tout est cohérent → activer
      const { receiptNumber } = await confirmAndActivate({ txId: tx.id, gatewayRef });
      logger.info({ transactionId, receiptNumber }, "Webhook CinetPay : paiement confirmé et abonnement activé");

    } else if (paymentStatus === "failed") {
      await db.update(paymentTransactionsTable).set({
        status: "failed",
        failedAt: new Date(),
        metadata: { gateway: "cinetpay", status: checkResult.data?.status, raw: body["cpm_trans_stat"] },
      }).where(eq(paymentTransactionsTable.id, tx.id));

      if (tx.billingEventId) {
        await db.update(billingEventsTable).set({ status: "failed" }).where(eq(billingEventsTable.id, tx.billingEventId));
      }

      logger.info({ transactionId }, "Webhook CinetPay : paiement échoué/refusé");
    } else {
      logger.info({ transactionId, status: paymentStatus }, "Webhook CinetPay : statut en attente");
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "Webhook CinetPay : erreur de traitement");
  }
});

// ── GET /super-admin/cinetpay-transactions ────────────────────────
// Liste les transactions CinetPay (carte + Mobile Money) pour le Cockpit.
// Accessible uniquement aux super-admins.

router.get("/super-admin/cinetpay-transactions", sa, async (req, res, next) => {
  try {
    const { status, orgId } = req.query as Record<string, string>;
    const CINETPAY_METHODS = ["card", "mixx", "flooz", "mobile_money"];

    const conditions = [inArray(paymentTransactionsTable.method, CINETPAY_METHODS) as unknown as ReturnType<typeof eq>];
    if (status) conditions.push(eq(paymentTransactionsTable.status, status));
    if (orgId) conditions.push(eq(paymentTransactionsTable.organizationId, orgId));

    const rows = await db.select({
      tx: paymentTransactionsTable,
      orgName: organizationsTable.name,
      orgSlug: organizationsTable.slug,
      orgContactEmail: organizationsTable.contactEmail,
    }).from(paymentTransactionsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, paymentTransactionsTable.organizationId))
      .where(and(...conditions))
      .orderBy(desc(paymentTransactionsTable.createdAt))
      .limit(300);

    const data = rows.map((r) => ({
      ...r.tx,
      orgName: r.orgName,
      orgSlug: r.orgSlug,
      orgContactEmail: r.orgContactEmail,
      isAutoConfirmed: (r.tx.metadata as Record<string, unknown> | null)?.["auto"] === true,
      gateway: "cinetpay",
    }));
    res.json({ data, count: data.length });
  } catch (e) { next(e); }
});

// ─── Email templates ──────────────────────────────────────────────

function emailPaymentConfirmed({ orgName, receiptNumber, amount, method, periodEnd }: {
  orgName: string; receiptNumber: string; amount: number; method: string; periodEnd: Date | null;
}) {
  const periodStr = periodEnd ? new Date(periodEnd).toLocaleDateString("fr-FR") : "—";
  return `<!DOCTYPE html><html lang="fr"><body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#F37021;padding:20px 24px"><h1 style="color:#fff;margin:0;font-size:20px">Gaméasù</h1><p style="color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px">Paiement confirmé — Merci !</p></div>
  <div style="padding:24px">
    <p style="color:#374151">Bonjour,</p>
    <p style="color:#374151">Votre paiement pour <strong>${orgName}</strong> a été traité avec succès via <strong>${method}</strong>.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="color:#6b7280;padding:4px 0">Numéro de reçu</td><td style="font-weight:700;text-align:right;color:#111">${receiptNumber}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0">Montant TTC</td><td style="font-weight:600;text-align:right">${fmt(amount)}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0">Moyen de paiement</td><td style="font-weight:600;text-align:right">${method}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0">Abonnement valide jusqu'au</td><td style="font-weight:600;text-align:right">${periodStr}</td></tr>
      </table>
    </div>
    <p style="color:#374151">Votre abonnement Gaméasù est désormais actif et renouvelé. L'accès à toutes vos fonctionnalités est maintenu sans interruption.</p>
    <p style="color:#6b7280;font-size:12px">En cas de question, contactez notre support à <a href="mailto:support@gameasu.com" style="color:#F37021">support@gameasu.com</a>.</p>
  </div>
  <div style="background:#fafafa;padding:14px 24px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">
    © ${new Date().getFullYear()} Gaméasù — Paiement sécurisé via CinetPay
  </div>
</div></body></html>`;
}

export default router;
