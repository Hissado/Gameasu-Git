/**
 * Client Stripe singleton — graceful no-op si STRIPE_SECRET_KEY absent.
 * Les clés secrètes ne sont jamais exposées côté client.
 *
 * Variables d'environnement requises :
 *   STRIPE_SECRET_KEY       — clé secrète Stripe (sk_test_xxx / sk_live_xxx)
 *   STRIPE_WEBHOOK_SECRET   — secret du webhook Stripe (whsec_xxx)
 *
 * Côté frontend (Vite) :
 *   VITE_STRIPE_PUBLISHABLE_KEY — clé publique (pk_test_xxx / pk_live_xxx)
 */

import Stripe from "stripe";

let _client: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_client) {
    _client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    });
  }
  return _client;
}

export function requireStripe(): Stripe {
  const s = getStripeClient();
  if (!s) {
    throw Object.assign(new Error("Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans les variables d'environnement"), { statusCode: 503 });
  }
  return s;
}

export const STRIPE_CONFIGURED = !!process.env.STRIPE_SECRET_KEY;

/** XOF est une devise à zéro décimale sur Stripe (pas de x100). */
export const STRIPE_CURRENCY = "xof";

/** Vérifie la signature d'un webhook Stripe. */
export function verifyStripeWebhook(payload: string | Buffer, sig: string, secret: string): Stripe.Event {
  const stripe = requireStripe();
  return stripe.webhooks.constructEvent(payload, sig, secret);
}
