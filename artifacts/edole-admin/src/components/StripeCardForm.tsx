/**
 * Formulaire de paiement par carte PCI-compliant via Stripe Elements.
 *
 * Stripe gère la collecte des données de carte dans des iframes sécurisés.
 * Aucune donnée de carte ne transite par nos serveurs.
 *
 * Props :
 *   clientSecret — retourné par POST /api/billing/stripe/payment-intent
 *   amount       — montant en FCFA (pour affichage uniquement)
 *   saveCard     — si true, la carte sera sauvegardée pour l'autopay
 *   onSuccess    — callback appelé après confirmation du paiement
 *   onError      — callback si le paiement échoue
 */

import { useState, useEffect } from "react";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatFCFA } from "@/lib/format";

// ── Stripe instance (singleton, chargée paresseusement) ───────────

let stripePromise: ReturnType<typeof loadStripe> | null = null;

function getStripe() {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  if (!key) return null;
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}

// ── Styles partagés pour les Elements Stripe ─────────────────────

const ELEMENT_STYLE = {
  base: {
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#0f172a",
    "::placeholder": { color: "#94a3b8" },
  },
  invalid: { color: "#ef4444" },
};

const ELEMENT_CLASS = "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2";

// ── Formulaire interne (a besoin du contexte Elements) ───────────

type InnerFormProps = {
  clientSecret: string;
  amount: number;
  saveCard: boolean;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
};

function InnerCardForm({ clientSecret, amount, saveCard, onSuccess, onError }: InnerFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [cardErrors, setCardErrors] = useState<{ number?: string; expiry?: string; cvc?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMsg(null);

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) { setLoading(false); return; }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardNumber,
        billing_details: { name: cardholderName || undefined },
      },
      setup_future_usage: saveCard ? "off_session" : undefined,
    });

    setLoading(false);

    if (error) {
      const msg = error.message ?? "Paiement refusé — vérifiez vos informations de carte.";
      setErrorMsg(msg);
      onError(msg);
    } else if (paymentIntent?.status === "succeeded") {
      setSucceeded(true);
      onSuccess(paymentIntent.id);
    } else {
      setErrorMsg("Statut de paiement inattendu. Veuillez réessayer.");
      onError("Statut inattendu : " + (paymentIntent?.status ?? "inconnu"));
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="font-semibold text-lg">Paiement réussi !</p>
        <p className="text-sm text-muted-foreground">
          Votre abonnement sera activé dans quelques instants.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Numéro de carte */}
      <div className="space-y-1.5">
        <Label className="text-sm">Numéro de carte</Label>
        <div className={ELEMENT_CLASS}>
          <CardNumberElement
            options={{ style: ELEMENT_STYLE, showIcon: true }}
            onChange={(e) => setCardErrors((p) => ({ ...p, number: e.error?.message }))}
          />
        </div>
        {cardErrors.number && <p className="text-xs text-red-500">{cardErrors.number}</p>}
      </div>

      {/* Expiration + CVC */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Date d'expiration</Label>
          <div className={ELEMENT_CLASS}>
            <CardExpiryElement
              options={{ style: ELEMENT_STYLE }}
              onChange={(e) => setCardErrors((p) => ({ ...p, expiry: e.error?.message }))}
            />
          </div>
          {cardErrors.expiry && <p className="text-xs text-red-500">{cardErrors.expiry}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">CVV / CVC</Label>
          <div className={ELEMENT_CLASS}>
            <CardCvcElement
              options={{ style: ELEMENT_STYLE }}
              onChange={(e) => setCardErrors((p) => ({ ...p, cvc: e.error?.message }))}
            />
          </div>
          {cardErrors.cvc && <p className="text-xs text-red-500">{cardErrors.cvc}</p>}
        </div>
      </div>

      {/* Titulaire */}
      <div className="space-y-1.5">
        <Label className="text-sm">Nom du titulaire <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
        <Input
          placeholder="Prénom NOM"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          autoComplete="cc-name"
        />
      </div>

      {/* Erreur globale */}
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Sécurité */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Lock className="w-3.5 h-3.5" />
        <span>Paiement sécurisé par <strong>Stripe</strong> — vos données de carte ne transitent jamais par nos serveurs.</span>
      </div>

      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5"
      >
        {loading ? "Traitement en cours…" : `Payer ${formatFCFA(amount)}`}
      </Button>
    </form>
  );
}

// ── Setup Intent form (pour sauvegarder une carte sans débit) ─────

type SetupFormProps = {
  clientSecret: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
};

function InnerSetupForm({ clientSecret, onSuccess, onError }: SetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setErrorMsg(null);

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) { setLoading(false); return; }

    const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardNumber,
        billing_details: { name: cardholderName || undefined },
      },
    });

    setLoading(false);
    if (error) {
      const msg = error.message ?? "Impossible de sauvegarder la carte.";
      setErrorMsg(msg);
      onError(msg);
    } else if (setupIntent?.status === "succeeded") {
      setSucceeded(true);
      onSuccess();
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="font-semibold text-lg">Carte sauvegardée !</p>
        <p className="text-sm text-muted-foreground">
          L'autopay est maintenant actif. Votre abonnement sera renouvelé automatiquement.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Numéro de carte</Label>
        <div className={ELEMENT_CLASS}>
          <CardNumberElement options={{ style: ELEMENT_STYLE, showIcon: true }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Expiration</Label>
          <div className={ELEMENT_CLASS}>
            <CardExpiryElement options={{ style: ELEMENT_STYLE }} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">CVV</Label>
          <div className={ELEMENT_CLASS}>
            <CardCvcElement options={{ style: ELEMENT_STYLE }} />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Nom du titulaire</Label>
        <Input placeholder="Prénom NOM" value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} />
      </div>
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Lock className="w-3.5 h-3.5" />
        <span>Carte sauvegardée de façon sécurisée par Stripe — aucune donnée sensible n'est stockée sur nos serveurs.</span>
      </div>
      <Button type="submit" disabled={!stripe || loading} className="w-full bg-primary hover:bg-primary/90 text-white">
        {loading ? "Sauvegarde…" : "Sauvegarder la carte"}
      </Button>
    </form>
  );
}

// ── Exports publics ───────────────────────────────────────────────

/**
 * Formulaire de paiement par carte enveloppé dans Elements.
 * Affiche un message si Stripe n'est pas configuré.
 */
export function StripeCardForm(props: Omit<InnerFormProps, never>) {
  const stripe = getStripe();

  if (!stripe) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center rounded-lg border border-amber-200 bg-amber-50/40 p-6">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="font-semibold text-sm">Passerelle Stripe non configurée</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Ajoutez <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> et{" "}
          <code className="bg-muted px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> dans les variables
          d'environnement pour activer le paiement par carte sécurisé.
        </p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret: props.clientSecret,
    appearance: { theme: "stripe", variables: { colorPrimary: "#d97706", colorBackground: "#ffffff", fontFamily: "system-ui, sans-serif" } },
  };

  return (
    <Elements stripe={stripe} options={options}>
      <InnerCardForm {...props} />
    </Elements>
  );
}

/**
 * Formulaire de sauvegarde de carte (SetupIntent) pour l'autopay.
 */
export function StripeSetupForm(props: SetupFormProps) {
  const stripe = getStripe();

  if (!stripe) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center rounded-lg border border-amber-200 bg-amber-50/40 p-5">
        <AlertCircle className="w-6 h-6 text-amber-500" />
        <p className="text-sm font-medium">Stripe non configuré</p>
        <p className="text-xs text-muted-foreground">
          Ajoutez <code className="bg-muted px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> pour activer l'autopay.
        </p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret: props.clientSecret,
    appearance: { theme: "stripe", variables: { colorPrimary: "#d97706" } },
  };

  return (
    <Elements stripe={stripe} options={options}>
      <InnerSetupForm {...props} />
    </Elements>
  );
}

/** Retourne true si VITE_STRIPE_PUBLISHABLE_KEY est définie. */
export const isStripeConfiguredOnFront = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
