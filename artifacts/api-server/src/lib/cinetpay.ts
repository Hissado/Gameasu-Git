/**
 * Client CinetPay — paiements automatiques carte + Mobile Money
 * (Mixx / Yas TOGOCEL, Flooz Moov Africa)
 *
 * Env vars :
 *   CINETPAY_API_KEY     – clé API CinetPay
 *   CINETPAY_SITE_ID     – identifiant du site marchand
 *   CINETPAY_SECRET_KEY  – clé secrète pour vérification webhook (optionnel, recommandé)
 *   CINETPAY_SANDBOX     – "true" pour utiliser l'environnement de test
 *
 * La clé secrète n'est jamais exposée au client ni stockée en base.
 * La vérification du paiement se fait via l'API CinetPay /check (double validation).
 */

import { createHmac } from "crypto";

const CINETPAY_BASE = "https://api-checkout.cinetpay.com/v2";

export type CinetPayMethod = "card" | "mixx" | "flooz" | "mobile_money";

export type CinetPayInitParams = {
  transactionId: string;
  amount: number;
  currency: string;
  description: string;
  notifyUrl: string;
  returnUrl: string;
  channels: "ALL" | "CREDIT_CARD" | "MOBILE_MONEY";
  lang?: string;
  customerName?: string;
  customerSurname?: string;
  customerEmail?: string;
  customerPhone?: string;
};

export type CinetPayInitResult = {
  code: string;
  message: string;
  data?: {
    payment_token: string;
    payment_url: string;
  };
};

export type CinetPayCheckResult = {
  code: string;
  message: string;
  data?: {
    transaction_id: string;
    is_accepted: boolean;
    status: string;          // "ACCEPTED" | "REFUSED" | "PENDING"
    amount: number;
    currency: string;
    payment_method: string;
    payment_date: string;
    phone_number?: string;
    metadata?: string;
  };
};

// ── Helpers ────────────────────────────────────────────────────────

export function isCinetPayConfigured(): boolean {
  return !!(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);
}

export function methodToChannels(method: CinetPayMethod): "CREDIT_CARD" | "MOBILE_MONEY" | "ALL" {
  if (method === "card") return "CREDIT_CARD";
  if (method === "mixx" || method === "flooz" || method === "mobile_money") return "MOBILE_MONEY";
  return "ALL";
}

// ── Init Payment ───────────────────────────────────────────────────
// Crée une session de paiement CinetPay et retourne l'URL de paiement.

export async function initCinetPayPayment(params: CinetPayInitParams): Promise<CinetPayInitResult> {
  const apikey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;

  if (!apikey || !siteId) {
    throw new Error("CinetPay non configuré : CINETPAY_API_KEY et CINETPAY_SITE_ID requis");
  }

  const body = {
    apikey,
    site_id: siteId,
    transaction_id: params.transactionId,
    amount: params.amount,
    currency: params.currency,
    description: params.description,
    notify_url: params.notifyUrl,
    return_url: params.returnUrl,
    channels: params.channels,
    lang: params.lang ?? "fr",
    ...(params.customerName ? { customer_name: params.customerName } : {}),
    ...(params.customerSurname ? { customer_surname: params.customerSurname } : {}),
    ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
    ...(params.customerPhone ? { customer_phone_number: params.customerPhone } : {}),
    metadata: "gameasu-billing",
  };

  const resp = await fetch(`${CINETPAY_BASE}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await resp.json().catch(() => ({ code: "NETWORK_ERROR", message: "Réponse CinetPay illisible" }))) as CinetPayInitResult;
  return json;
}

// ── Check Payment ──────────────────────────────────────────────────
// Vérifie le statut d'un paiement auprès de CinetPay.
// À appeler depuis le webhook pour double validation.

export async function checkCinetPayPayment(transactionId: string): Promise<CinetPayCheckResult> {
  const apikey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;

  if (!apikey || !siteId) {
    throw new Error("CinetPay non configuré");
  }

  const body = { apikey, site_id: siteId, transaction_id: transactionId };

  const resp = await fetch(`${CINETPAY_BASE}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await resp.json().catch(() => ({ code: "NETWORK_ERROR", message: "Réponse CinetPay illisible" }))) as CinetPayCheckResult;
  return json;
}

// ── Webhook Signature Verification ────────────────────────────────
// CinetPay envoie une signature HMAC-SHA256 dans le header x-cinetpay-signature
// ou dans le champ `cpm_secret_key_hash`.
// Si CINETPAY_SECRET_KEY n'est pas défini, on accepte mais on vérifie via /check.

export function verifyCinetPaySignature(payload: string | Record<string, unknown>, signature: string): boolean {
  const secretKey = process.env.CINETPAY_SECRET_KEY;
  if (!secretKey) {
    // Sans clé secrète → on ne peut pas vérifier la signature HMAC ;
    // la double validation via /check reste obligatoire.
    return true;
  }
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const expected = createHmac("sha256", secretKey).update(body).digest("hex");
  return expected === signature;
}

// ── Status Mapping ─────────────────────────────────────────────────

export function mapCinetPayStatus(cinetpayStatus: string): "confirmed" | "failed" | "pending" {
  const upper = cinetpayStatus.toUpperCase();
  if (upper === "ACCEPTED" || upper === "00") return "confirmed";
  if (upper === "REFUSED" || upper === "FAILED" || upper === "CANCELLED") return "failed";
  return "pending";
}
