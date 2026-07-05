import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBillingSummary, useBillingEvents, useBillingUsage, useCurrentSubscription } from "@/lib/saas";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatDate } from "@/lib/format";
import { StripeCardForm, StripeSetupForm, isStripeConfiguredOnFront } from "@/components/StripeCardForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check, CheckCircle2, Crown, Calendar, Users, Receipt, ArrowUpRight, RefreshCw,
  CreditCard, Smartphone, Wallet, AlertCircle, Clock, XCircle, Download,
  Settings, Shield, Zap, Phone, FileText, ToggleLeft, ToggleRight, ExternalLink,
  Repeat, Trash2, PenLine, Star, Bell, Info, Mail, Package,
  MessageSquare, MailOpen, HeadphonesIcon, HardDrive, ChevronRight, BarChart3,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { BRANDING } from "@/config/branding";
import { toast as sonnerToast } from "sonner";

// ─── Moteur de tarification (côté frontend) ────────────────────────
// Importé depuis la config centralisée — prix TTC, TVA 18 % incluse
import {
  PLAN_CATALOG, PERIODICITY_OPTIONS, calcPlanPricing, getPlan,
  type Periodicity,
} from "@/lib/pricing-config";

const ALL_MODULES: [string, string][] = [
  ["dashboard",          "Tableau de bord & KPI"],
  ["sales_crm",          "Ventes & CRM"],
  ["clients",            "Gestion clients"],
  ["projects",           "Projets & portefeuille"],
  ["tasks",              "Tâches & Kanban"],
  ["accounting",         "Comptabilité & journaux"],
  ["financial_planning", "FP&A & budgets"],
  ["team_hr",            "Équipe & RH"],
  ["operations",         "Opérations & livraisons"],
  ["inventory_assets",   "Parc & équipements"],
  ["rentals",            "Locations & inspections"],
  ["communications",     "Messagerie & appels"],
  ["reports",            "Rapports & analyses"],
  ["documents",          "Gestion documentaire"],
  ["administration",     "Administration & audit"],
];

// ─── Types ────────────────────────────────────────────────────────

type PaymentTransaction = {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  billingEventId: string | null;
  amount: number;
  currency: string;
  method: string;
  payerPhone: string | null;
  status: string;
  reference: string | null;
  gatewayRef: string | null;
  receiptNumber: string | null;
  purpose: string;
  notes: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

type GatewayConfig = {
  id: string;
  gateway: string;
  displayName: string;
  isEnabled: boolean;
  isSandbox: boolean;
  publicKey: string | null;
  webhookUrl: string | null;
  txFeePercent: string | null;
  txFeeFixed: number | null;
  minAmount: number | null;
  maxAmount: number | null;
};

type StripeStatus = {
  stripeConfigured: boolean;
  autopayEnabled: boolean;
  savedCard: {
    brand: string | null;
    last4: string;
    expMonth: number | null;
    expYear: number | null;
    label: string;
  } | null;
  nextAutopayAt: string | null;
  currentPeriodEnd: string | null;
};

// ─── Constants ────────────────────────────────────────────────────

const MOBILE_MONEY_METHODS = ["mixx", "flooz", "mobile_money"];

const PAYMENT_METHODS = [
  {
    value: "card",
    label: "Carte bancaire",
    icon: CreditCard,
    color: "text-blue-600",
    desc: isStripeConfiguredOnFront
      ? "Visa, Mastercard — paiement sécurisé Stripe"
      : "Visa, Mastercard — saisie manuelle de référence",
  },
  { value: "mixx", label: "Mixx", icon: Smartphone, color: "text-emerald-600", desc: "Mobile Money (Mixx)" },
  { value: "flooz", label: "Flooz", icon: Smartphone, color: "text-orange-500", desc: "Mobile Money (Flooz)" },
];

const PURPOSE_LABELS: Record<string, string> = {
  renewal: "Renouvellement",
  setup_fee: "Frais d'installation",
  upgrade: "Changement de formule",
  addon: "Module additionnel",
  seats: "Licences supplémentaires",
};

const TX_STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: "En attente",  cls: "bg-amber-50 text-amber-700 border-amber-200",      icon: Clock },
  confirmed: { label: "Confirmé",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  failed:    { label: "Échoué",      cls: "bg-red-50 text-red-700 border-red-200",             icon: XCircle },
  cancelled: { label: "Annulé",      cls: "bg-slate-100 text-slate-600 border-slate-200",      icon: XCircle },
  expired:   { label: "Expiré",      cls: "bg-slate-100 text-slate-500 border-slate-200",      icon: Clock },
  refunded:  { label: "Remboursé",   cls: "bg-purple-50 text-purple-700 border-purple-200",    icon: RefreshCw },
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Tableau de bord", clients: "Clients", services: "Services",
  projects: "Projets", tasks: "Tâches", sales_crm: "Ventes & CRM",
  accounting: "Comptabilité", financial_planning: "Planification financière",
  operations: "Opérations", inventory_assets: "Parc & équipements",
  rentals: "Locations", documents: "Documents", team_hr: "Équipe & RH",
  communications: "Communications", reports: "Rapports",
  client_portal: "Portail client", marketing: "Marketing",
  administration: "Administration", billing_subscription: "Abonnement & facturation",
  workspace_settings: "Paramètres de l'espace de travail",
};

// ─── PaymentModal ─────────────────────────────────────────────────
// Gère 3 cas :
//   • card + Stripe configuré  → PaymentIntent → StripeCardForm
//   • card + Stripe non configuré → saisie manuelle de référence TPE
//   • mixx / flooz → numéro de téléphone + référence

function PaymentModal({
  open, onClose, userCount, amountHT, tva, ttc, isEnterprise, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  userCount: number;
  amountHT: number | null;
  tva: number | null;
  ttc: number | null;
  isEnterprise: boolean;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState("card");
  const [payerPhone, setPayerPhone] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveCard, setSaveCard] = useState(false);

  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeTxRef, setStripeTxRef] = useState<string | null>(null);
  const [stripeSucceeded, setStripeSucceeded] = useState(false);

  // Le montant facturé = TTC (TVA incluse)
  const total = ttc ?? 0;

  const isMobileMoney = MOBILE_MONEY_METHODS.includes(method);
  const useStripeFlow = method === "card" && isStripeConfiguredOnFront;

  const resetStripe = () => {
    setStripeClientSecret(null);
    setStripeTxRef(null);
    setStripeSucceeded(false);
  };

  const handleClose = () => { resetStripe(); setSaving(false); onClose(); };

  // Flux Stripe : demande un PaymentIntent au backend
  const handleInitStripe = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/billing/stripe/payment-intent", {
        method: "POST",
        body: JSON.stringify({ saveCard, purpose: "renewal" }),
      }) as { clientSecret: string; txRef: string; amount: number };
      setStripeClientSecret(res.clientSecret);
      setStripeTxRef(res.txRef);
    } catch (e: any) {
      sonnerToast.error(e?.message ?? "Impossible d'initialiser le paiement Stripe");
    } finally {
      setSaving(false);
    }
  };

  // Flux manuel (mobile money + carte TPE)
  const handleSubmitManual = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/billing/pay", {
        method: "POST",
        body: JSON.stringify({
          method,
          payerPhone: payerPhone || undefined,
          reference: reference || undefined,
          notes: notes || undefined,
          purpose: "renewal",
        }),
      });
      sonnerToast.success("Transaction initiée", {
        description: "En attente de confirmation. Effectuez le paiement et notifiez votre équipe.",
      });
      onSuccess();
      handleClose();
    } catch (e: any) {
      sonnerToast.error(e?.message ?? "Erreur lors de l'initiation du paiement");
    } finally {
      setSaving(false);
    }
  };

  const handleStripeSuccess = (paymentIntentId: string) => {
    setStripeSucceeded(true);
    sonnerToast.success("Paiement en cours de validation", {
      description: "La confirmation arrivera sous quelques instants via webhook. Votre accès sera renouvelé automatiquement.",
    });
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-600" /> Payer votre abonnement
          </DialogTitle>
          <DialogDescription>
            Gameasu · Accès complet · {userCount} utilisateur{userCount > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Récapitulatif HT / TVA / TTC */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">Récapitulatif</p>
            <div className="flex justify-between text-sm text-amber-900">
              <span>Sous-total HT ({userCount} utilisateur{userCount > 1 ? "s" : ""})</span>
              <span className="font-semibold">{amountHT !== null ? formatFCFA(amountHT) : "—"}</span>
            </div>
            <div className="flex justify-between text-sm text-amber-800">
              <span>TVA 18 %</span>
              <span>{tva !== null ? formatFCFA(tva) : "—"}</span>
            </div>
            <div className="border-t border-amber-200 pt-2 flex justify-between">
              <span className="font-bold text-amber-900">Total TTC</span>
              <span className="text-2xl font-bold text-amber-900">{ttc !== null ? formatFCFA(ttc) : "—"}</span>
            </div>
          </div>

          {/* Formulaire Stripe Elements (étape 2) */}
          {stripeClientSecret && !stripeSucceeded && (
            <div className="space-y-4">
              <Button
                variant="ghost" size="sm"
                onClick={resetStripe}
                className="text-muted-foreground -ml-1 h-7"
              >
                ← Choisir un autre mode
              </Button>
              <StripeCardForm
                clientSecret={stripeClientSecret}
                amount={total}
                saveCard={saveCard}
                onSuccess={handleStripeSuccess}
                onError={(msg) => sonnerToast.error("Paiement refusé", { description: msg })}
              />
            </div>
          )}

          {/* Succès Stripe */}
          {stripeSucceeded && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="font-semibold text-lg">Paiement soumis !</p>
              <p className="text-sm text-muted-foreground">Confirmation automatique par webhook Stripe en cours.</p>
              <Button onClick={handleClose}>Fermer</Button>
            </div>
          )}

          {/* Sélection de méthode (étape 1) */}
          {!stripeClientSecret && !stripeSucceeded && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Mode de paiement</Label>
                <div className="grid gap-2">
                  {PAYMENT_METHODS.map((pm) => {
                    const Icon = pm.icon;
                    const selected = method === pm.value;
                    return (
                      <button
                        key={pm.value}
                        type="button"
                        onClick={() => { setMethod(pm.value); setPayerPhone(""); }}
                        className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-all ${
                          selected
                            ? "border-amber-400 bg-amber-50 shadow-sm"
                            : "border-border hover:border-amber-200 hover:bg-muted/30"
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${pm.color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">{pm.label}</p>
                          <p className="text-xs text-muted-foreground">{pm.desc}</p>
                        </div>
                        {selected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                        {pm.value === "card" && isStripeConfiguredOnFront && (
                          <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option sauvegarder la carte (flux Stripe uniquement) */}
              {useStripeFlow && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50/40">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Sauvegarder la carte pour l'autopay</p>
                      <p className="text-xs text-muted-foreground">Renouvellement automatique au prochain cycle</p>
                    </div>
                  </div>
                  <Switch checked={saveCard} onCheckedChange={setSaveCard} />
                </div>
              )}

              {/* Champs Mobile Money */}
              {isMobileMoney && (
                <div className="space-y-3 p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5 text-sm">
                      <Phone className="w-3.5 h-3.5 text-amber-600" /> N° de téléphone payeur
                    </Label>
                    <Input
                      placeholder="+228 90 00 00 00"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Effectuez le paiement depuis votre application mobile puis renseignez la référence de transaction.
                  </p>
                </div>
              )}

              {/* Référence (Mobile Money ou TPE carte manuelle) */}
              {(!useStripeFlow) && (
                <>
                  <div className="space-y-1">
                    <Label className="text-sm">
                      {method === "card" ? "Référence terminal (TPE)" : "Référence de transaction"}&nbsp;
                      <span className="text-muted-foreground font-normal">(optionnel)</span>
                    </Label>
                    <Input
                      placeholder={method === "card" ? "ex: AUTH-2026-XXXX" : "ex: TX-MIXX-XXXX"}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Notes <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
                    <Textarea rows={2} placeholder="Remarques…" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <Shield className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-600">
                      La transaction sera créée en statut <strong>En attente</strong>. Votre administrateur la confirmera après réception du paiement.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer — seulement si on n'est pas en formulaire Stripe */}
        {!stripeClientSecret && !stripeSucceeded && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={saving}>Annuler</Button>
            {useStripeFlow ? (
              <Button
                onClick={handleInitStripe}
                disabled={saving || total <= 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving ? "Préparation…" : `Payer par carte — ${formatFCFA(total)} TTC`}
              </Button>
            ) : (
              <Button
                onClick={handleSubmitManual}
                disabled={saving || total <= 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving ? "Initiation…" : `Initier le paiement — ${formatFCFA(total)} TTC`}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── SaveCardModal ────────────────────────────────────────────────
// Flux SetupIntent : sauvegarde une carte sans débit immédiat.

function SaveCardModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const initSetup = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/billing/stripe/setup-intent", {
        method: "POST",
        body: JSON.stringify({}),
      }) as { clientSecret: string };
      setClientSecret(res.clientSecret);
    } catch (e: any) {
      sonnerToast.error(e?.message ?? "Impossible d'initialiser la sauvegarde de carte");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setClientSecret(null); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            {clientSecret ? "Enregistrer une carte" : "Activer le paiement automatique"}
          </DialogTitle>
          <DialogDescription>
            Votre carte sera sauvegardée de façon sécurisée par Stripe pour les renouvellements automatiques.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {!clientSecret ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                {[
                  "Renouvellement automatique mensuel ou annuel",
                  "Notification par email avant chaque prélèvement",
                  "Désactivation possible à tout moment",
                  "Aucune donnée de carte stockée sur nos serveurs",
                ].map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={initSetup}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? "Initialisation…" : "Continuer vers la saisie de carte"}
              </Button>
            </div>
          ) : (
            <StripeSetupForm
              clientSecret={clientSecret}
              onSuccess={() => { sonnerToast.success("Carte enregistrée — autopay activé !"); onSuccess(); handleClose(); }}
              onError={(msg) => sonnerToast.error("Erreur", { description: msg })}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ReceiptModal ─────────────────────────────────────────────────

type ReceiptData = {
  receiptNumber: string | null;
  date: string | null;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  gatewayRef: string | null;
  payerPhone: string | null;
  purpose: string;
  notes: string | null;
  organization: { name: string; taxId?: string | null } | null;
  issuedBy: string;
};

function ReceiptModal({ txId, onClose }: { txId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<ReceiptData>({
    queryKey: ["receipt", txId],
    queryFn: () => apiFetch(`/api/billing/payment-transactions/${txId}/receipt`),
  });

  const METHOD_ICONS: Record<string, React.ReactNode> = {
    card: <CreditCard className="w-4 h-4 text-blue-500" />,
    mixx: <Smartphone className="w-4 h-4 text-emerald-500" />,
    flooz: <Smartphone className="w-4 h-4 text-orange-500" />,
    mobile_money: <Smartphone className="w-4 h-4 text-amber-500" />,
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600" /> Reçu de paiement
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Chargement…</div>
        ) : data ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-lg font-bold">{formatFCFA(data.amount)}</p>
              <p className="text-xs text-emerald-700 mt-1">Paiement confirmé</p>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["N° de reçu", data.receiptNumber],
                ["Date", data.date ? new Date(data.date).toLocaleString("fr-FR") : "—"],
                ["Objet", data.purpose],
                ["Mode", data.method],
                ["Référence", data.reference || "—"],
                ["Réf. passerelle", data.gatewayRef || "—"],
                ["Téléphone", data.payerPhone || "—"],
                ["Organisation", data.organization?.name || "—"],
                ["Émis par", data.issuedBy || "Gameasu"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right max-w-[200px]">{value}</span>
                </div>
              ))}
            </div>
            {data.notes && (
              <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
                <strong>Notes :</strong> {data.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-red-500 text-sm">Reçu indisponible</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── TxBadge ─────────────────────────────────────────────────────

function TxBadge({ status }: { status: string }) {
  const cfg = TX_STATUS_CFG[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

// ─── AutopayPanel ─────────────────────────────────────────────────
// Onglet complet : gestion de la carte sauvegardée + autopay toggle

function AutopayPanel({
  stripeStatus,
  onRefresh,
}: {
  stripeStatus: StripeStatus | undefined;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showSaveCard, setShowSaveCard] = useState(false);

  const enableMutation = useMutation({
    mutationFn: () => apiFetch("/api/billing/stripe/autopay/enable", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stripe-status"] }); onRefresh(); toast({ title: "Autopay activé" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const disableMutation = useMutation({
    mutationFn: () => apiFetch("/api/billing/stripe/autopay/disable", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stripe-status"] }); onRefresh(); toast({ title: "Autopay désactivé" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const removeCardMutation = useMutation({
    mutationFn: () => apiFetch("/api/billing/stripe/saved-card", { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stripe-status"] }); onRefresh(); toast({ title: "Carte supprimée — autopay désactivé" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const stripeConfigured = stripeStatus?.stripeConfigured ?? false;
  const autopayEnabled = stripeStatus?.autopayEnabled ?? false;
  const savedCard = stripeStatus?.savedCard ?? null;
  const nextAutopay = stripeStatus?.nextAutopayAt;
  const periodEnd = stripeStatus?.currentPeriodEnd;

  if (!stripeConfigured) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <AlertCircle className="w-10 h-10 mx-auto text-amber-400" />
          <div>
            <p className="font-semibold">Stripe non configuré</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Pour activer le paiement automatique par carte, l'administrateur doit configurer{" "}
              <code className="bg-muted px-1 rounded text-xs">STRIPE_SECRET_KEY</code> et{" "}
              <code className="bg-muted px-1 rounded text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code> dans les variables d'environnement.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            URL webhook Stripe :&nbsp;
            <code className="bg-muted px-1.5 py-0.5 rounded">…/api/webhooks/stripe</code>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statut autopay */}
      <Card className={autopayEnabled ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/20"}>
        <CardContent className="py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${autopayEnabled ? "bg-emerald-100" : "bg-slate-100"}`}>
                <Repeat className={`w-5 h-5 ${autopayEnabled ? "text-emerald-600" : "text-slate-400"}`} />
              </div>
              <div>
                <p className="font-semibold text-sm">Paiement automatique (autopay)</p>
                <p className="text-xs text-muted-foreground">
                  {autopayEnabled
                    ? nextAutopay
                      ? `Prochain prélèvement : ${new Date(nextAutopay).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                      : "Actif — prochain prélèvement à l'échéance"
                    : savedCard
                    ? "Carte enregistrée, autopay désactivé"
                    : "Aucune carte enregistrée"}
                </p>
              </div>
            </div>
            {savedCard && (
              <Switch
                checked={autopayEnabled}
                onCheckedChange={(v) => {
                  if (v) enableMutation.mutate();
                  else disableMutation.mutate();
                }}
                disabled={enableMutation.isPending || disableMutation.isPending}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Carte sauvegardée */}
      {savedCard ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500" /> Carte enregistrée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg border border-blue-200 bg-blue-50/40">
              <div className="w-12 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{savedCard.label}</p>
                {savedCard.expMonth && savedCard.expYear && (
                  <p className="text-xs text-muted-foreground">
                    Expire {String(savedCard.expMonth).padStart(2, "0")}/{savedCard.expYear}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">Vérifiée</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowSaveCard(true)}
              >
                <PenLine className="w-3.5 h-3.5 mr-1.5" /> Mettre à jour la carte
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => removeCardMutation.mutate()}
                disabled={removeCardMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <div>
              <p className="font-medium text-sm">Aucune carte enregistrée</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajoutez une carte pour activer le renouvellement automatique.
              </p>
            </div>
            <Button
              onClick={() => setShowSaveCard(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <CreditCard className="w-4 h-4 mr-2" /> Ajouter une carte
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Informations sur l'échéance */}
      {periodEnd && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="text-sm">
                <span className="text-muted-foreground">Prochain renouvellement : </span>
                <span className="font-semibold">
                  {new Date(periodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications autopay */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" /> Notifications de renouvellement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { event: "J-3 avant l'échéance", desc: "Email de rappel de renouvellement", active: autopayEnabled },
              { event: "Prélèvement réussi", desc: "Email de confirmation avec reçu", active: true },
              { event: "Prélèvement échoué", desc: "Email d'alerte + notification in-app", active: true },
            ].map(({ event, desc, active }) => (
              <div key={event} className="flex items-center gap-3 py-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-emerald-400" : "bg-slate-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs">{event}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
                <span className={`text-[10px] font-semibold uppercase ${active ? "text-emerald-600" : "text-slate-400"}`}>
                  {active ? "actif" : "—"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showSaveCard && (
        <SaveCardModal
          open={showSaveCard}
          onClose={() => setShowSaveCard(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["stripe-status"] });
            onRefresh();
            setShowSaveCard(false);
          }}
        />
      )}
    </div>
  );
}

// ─── GatewayConfigPanel ───────────────────────────────────────────

function GatewayConfigPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ data: GatewayConfig[] }>({
    queryKey: ["payment-gateways"],
    queryFn: () => apiFetch("/api/admin/payment-gateway"),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<GatewayConfig>>({});

  const toggleMutation = useMutation({
    mutationFn: ({ gateway, isEnabled }: { gateway: string; isEnabled: boolean }) =>
      apiFetch(`/api/admin/payment-gateway/${gateway}`, {
        method: "PUT",
        body: JSON.stringify({ isEnabled }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-gateways"] }); },
  });

  const saveMutation = useMutation({
    mutationFn: (gw: string) =>
      apiFetch(`/api/admin/payment-gateway/${gw}`, {
        method: "PUT",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-gateways"] });
      setEditing(null);
      toast({ title: "Configuration sauvegardée" });
    },
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>;

  const gateways = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border border-blue-200 bg-blue-50 p-3">
        <Shield className="w-4 h-4 text-blue-500 shrink-0" />
        <span>Les clés API secrètes ne doivent <strong>jamais</strong> être saisies ici — configurez-les via des variables d'environnement sécurisées.</span>
      </div>
      {gateways.map((gw) => (
        <Card key={gw.gateway} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-2 h-2 rounded-full shrink-0 ${gw.isEnabled ? "bg-emerald-500" : "bg-slate-300"}`} />
              <div className="min-w-0">
                <p className="font-semibold text-sm">{gw.displayName}</p>
                <p className="text-xs text-muted-foreground font-mono">{gw.gateway}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {gw.isSandbox && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Sandbox</Badge>
              )}
              <Button
                size="sm" variant="ghost"
                onClick={() => toggleMutation.mutate({ gateway: gw.gateway, isEnabled: !gw.isEnabled })}
                disabled={toggleMutation.isPending}
                className={gw.isEnabled ? "text-emerald-600" : "text-slate-400"}
              >
                {gw.isEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setEditing(gw.gateway);
                setForm({
                  publicKey: gw.publicKey ?? "",
                  webhookUrl: gw.webhookUrl ?? "",
                  txFeePercent: gw.txFeePercent ?? "0",
                  txFeeFixed: gw.txFeeFixed ?? 0,
                  isSandbox: gw.isSandbox,
                });
              }}>
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {editing === gw.gateway && (
            <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Clé publique (safe)</Label>
                  <Input
                    placeholder="pk_live_xxx"
                    value={form.publicKey ?? ""}
                    onChange={(e) => setForm({ ...form, publicKey: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL Webhook</Label>
                  <Input
                    placeholder="https://…/api/webhooks/stripe"
                    value={form.webhookUrl ?? ""}
                    onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frais % (ex: 1.5)</Label>
                  <Input
                    type="number" step="0.1" min="0" max="20"
                    value={form.txFeePercent ?? "0"}
                    onChange={(e) => setForm({ ...form, txFeePercent: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frais fixes (FCFA)</Label>
                  <Input
                    type="number" min="0"
                    value={form.txFeeFixed ?? 0}
                    onChange={(e) => setForm({ ...form, txFeeFixed: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`sandbox-${gw.gateway}`}
                  checked={!!form.isSandbox}
                  onChange={(e) => setForm({ ...form, isSandbox: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor={`sandbox-${gw.gateway}`} className="text-xs cursor-pointer">Mode sandbox (test)</Label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                🔒 Les clés secrètes (STRIPE_SECRET_KEY, etc.) doivent être configurées via les variables d'environnement.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveMutation.mutate(gw.gateway)} disabled={saveMutation.isPending}>
                  Sauvegarder
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Main BillingPage ─────────────────────────────────────────────

export default function BillingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: summary } = useBillingSummary();
  const { data: events } = useBillingEvents();
  const { data: usage } = useBillingUsage();
  const { data: current } = useCurrentSubscription();

  const { data: txData, refetch: refetchTx } = useQuery<{ data: PaymentTransaction[] }>({
    queryKey: ["payment-transactions"],
    queryFn: () => apiFetch("/api/billing/payment-transactions"),
  });

  const { data: stripeStatus, refetch: refetchStripe } = useQuery<StripeStatus>({
    queryKey: ["stripe-status"],
    queryFn: () => apiFetch("/api/billing/stripe/status"),
    staleTime: 30_000,
  });

  const [showPayModal, setShowPayModal] = useState(false);
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null);
  const [periodicity, setPeriodicity] = useState<Periodicity>("monthly");

  const transactions = txData?.data ?? [];
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  // Tarification plan-based : prix TTC par utilisateur selon le plan actif
  const userCount = (usage as any)?.seatsUsed ?? (usage as any)?.userCount ?? 0;
  const planCode  = (current as any)?.plan?.code ?? "STARTER";
  const pricing = useMemo(
    () => calcPlanPricing({ planCode, seats: Math.max(1, userCount), periodicity }),
    [planCode, userCount, periodicity],
  );
  const { amountHT, tva, ttc, isEnterprise } = pricing;

  const confirmMutation = useMutation({
    mutationFn: (txId: string) =>
      apiFetch(`/api/billing/payment-transactions/${txId}/confirm`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
      qc.invalidateQueries({ queryKey: ["billing-events"] });
      qc.invalidateQueries({ queryKey: ["subscriptions", "current"] });
      toast({ title: "✅ Paiement confirmé", description: "L'abonnement a été renouvelé automatiquement." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Échec", description: e.message }),
  });

  const cancelMutation = useMutation({
    mutationFn: (txId: string) =>
      apiFetch(`/api/billing/payment-transactions/${txId}/cancel`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
      qc.invalidateQueries({ queryKey: ["billing-events"] });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Échec", description: e.message }),
  });

  const autopayEnabled = stripeStatus?.autopayEnabled ?? false;
  const savedCard = stripeStatus?.savedCard;
  const nextInvoiceAt = current?.subscription.currentPeriodEnd ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{BRANDING.appName}</p>
        <h1 className="text-3xl font-bold tracking-tight">Abonnement & facturation</h1>
        <p className="text-muted-foreground mt-1">
          Gérez votre formule, vos paiements et consultez l'historique de votre espace de travail.
        </p>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto pb-1">
        <TabsList className="grid w-full grid-cols-6 max-w-2xl min-w-[420px]">
          <TabsTrigger value="overview">Formule</TabsTrigger>
          <TabsTrigger value="addons" className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Add-ons
          </TabsTrigger>
          <TabsTrigger value="payments" className="relative">
            Paiements
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="autopay" className="relative">
            Autopay
            {autopayEnabled && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="gateways">Passerelles</TabsTrigger>
        </TabsList>
        </div>

        {/* ── Onglet Formule ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Abonnement actif — tarification plan-based */}
            <Card className="lg:col-span-2 border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-white">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/80 mb-1">Abonnement actif</p>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl">
                      {getPlan(planCode)?.name ?? BRANDING.appName}
                    </CardTitle>
                    {!isEnterprise && (
                      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        {formatFCFA(getPlan(planCode)?.monthlyPriceTTC ?? 0)} TTC / util / mois
                      </Badge>
                    )}
                    {isEnterprise && (
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold">
                        Sur devis
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {userCount} utilisateur{userCount !== 1 ? "s" : ""} · TVA 18 % incluse
                  </p>
                </div>
                <Package className="w-8 h-8 text-amber-500/80 shrink-0" />
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sélecteur de périodicité */}
                {!isEnterprise && (
                  <div className="flex flex-wrap gap-1.5">
                    {PERIODICITY_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPeriodicity(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          periodicity === p.value
                            ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
                        }`}
                      >
                        {p.label}
                        {p.discount > 0 && (
                          <span className={`ml-1 ${periodicity === p.value ? "text-amber-200" : "text-emerald-600"}`}>
                            −{Math.round(p.discount * 100)} %
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {isEnterprise ? (
                  /* Tarification personnalisée */
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Crown className="w-5 h-5" />
                      <span className="font-semibold">Offre personnalisée</span>
                    </div>
                    <p className="text-sm text-amber-700">
                      Contactez notre équipe commerciale pour obtenir un devis sur-mesure adapté à votre organisation.
                    </p>
                    <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <a href={`mailto:sales@gameasutech.africa?subject=Devis%20Gam%C3%A9as%C3%B9%20%2B%20${userCount}%20utilisateurs`}>
                        <Mail className="w-4 h-4 mr-2" /> Demander un devis
                      </a>
                    </Button>
                  </div>
                ) : (
                  /* Grille HT / TVA / TTC */
                  <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {userCount} utilisateur{userCount !== 1 ? "s" : ""} × {formatFCFA(pricing.priceTTCPerSeat ?? 0)} TTC / util
                        {(pricing.discount ?? 0) > 0 && (
                          <span className="ml-1.5 text-xs text-emerald-600 font-semibold">
                            (−{Math.round((pricing.discount ?? 0) * 100)} %)
                          </span>
                        )}
                      </span>
                      <span className="font-semibold tabular-nums">{ttc !== null ? formatFCFA(ttc) : "—"} TTC</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Dont TVA 18 %</span>
                      <span className="tabular-nums text-sm">{tva !== null ? formatFCFA(tva) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 text-muted-foreground">
                      <span className="text-sm">Montant HT</span>
                      <span className="tabular-nums text-sm">{amountHT !== null ? formatFCFA(amountHT) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-amber-50/60 rounded-b-lg">
                      <span className="font-bold text-amber-900">
                        Total TTC / {PERIODICITY_OPTIONS.find(p => p.value === periodicity)?.label.toLowerCase() ?? "mois"}
                      </span>
                      <span className="text-2xl font-bold text-amber-800 tabular-nums">{ttc !== null ? formatFCFA(ttc) : "—"}</span>
                    </div>
                  </div>
                )}

                {/* Prochaine échéance */}
                {nextInvoiceAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Prochaine échéance : <strong>{new Date(nextInvoiceAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</strong></span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isEnterprise ? (
                  <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    <a href={`mailto:sales@gameasutech.africa?subject=Devis%20Gam%C3%A9as%C3%B9%20%2B${userCount}%20utilisateurs`}>
                      <Mail className="w-4 h-4 mr-2" /> Demander un devis
                    </a>
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => setShowPayModal(true)}
                    disabled={!ttc || ttc <= 0}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {ttc ? `Payer — ${formatFCFA(ttc)} TTC` : "Calculer le tarif…"}
                  </Button>
                )}

                {savedCard ? (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                    autopayEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    <Repeat className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {autopayEnabled
                        ? `Autopay actif · ${savedCard.label}`
                        : `Carte enregistrée · autopay désactivé`}
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="outline" className="w-full justify-between"
                    onClick={() => {
                      const tab = document.querySelector('[value="autopay"]') as HTMLButtonElement;
                      tab?.click();
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Repeat className="w-4 h-4" /> Activer l'autopay
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                )}

                <Button asChild variant="outline" className="w-full justify-between">
                  <a href={`mailto:sales@gameasutech.africa`}>
                    Contacter le commercial <ArrowUpRight className="w-4 h-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Comparaison des formules Gameasu */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" /> Formules Gameasu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {PLAN_CATALOG.map((plan) => {
                  const isCurrent = plan.code === planCode.toUpperCase();
                  return (
                    <div
                      key={plan.code}
                      className={`relative rounded-xl border p-4 flex flex-col gap-3 transition-all ${
                        isCurrent
                          ? "border-amber-400 bg-amber-50/60 shadow-sm ring-1 ring-amber-400/40"
                          : plan.isFeatured
                          ? "border-blue-200 bg-blue-50/30"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {/* Badge */}
                      {plan.badge && (
                        <span className={`absolute -top-2 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          plan.code === "BUSINESS" ? "bg-blue-600 text-white" : "bg-amber-600 text-white"
                        }`}>
                          {plan.badge}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                          Actuel
                        </span>
                      )}

                      {/* Nom et modules */}
                      <div>
                        <p className="font-bold text-slate-900">{plan.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {plan.moduleCount ? `${plan.moduleCount} modules` : "Tous les modules"}
                        </p>
                      </div>

                      {/* Prix */}
                      <div>
                        {plan.isEnterprise ? (
                          <p className="text-lg font-bold text-slate-700 italic">Sur devis</p>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-slate-900 tabular-nums">
                              {formatFCFA(plan.monthlyPriceTTC)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">TTC / util / mois</p>
                          </>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="space-y-1 flex-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      {!isCurrent && (
                        <Button
                          asChild
                          size="sm"
                          variant={plan.isEnterprise ? "outline" : "default"}
                          className={`w-full text-xs mt-1 ${!plan.isEnterprise ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}`}
                        >
                          <a href="mailto:sales@gameasutech.africa">
                            {plan.isEnterprise ? "Demander un devis" : `Passer en ${plan.name}`}
                          </a>
                        </Button>
                      )}
                      {isCurrent && (
                        <p className="text-[11px] text-center text-amber-700 font-semibold">✓ Formule active</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Prix <strong>TTC, TVA 18 % incluse</strong> par utilisateur et par mois.
                Remises disponibles : Trimestriel −10 %, Semestriel −15 %, Annuel −20 %.
                Calculez votre tarif personnalisé sur{" "}
                <a href="https://gameasu.com/tarifs" target="_blank" rel="noreferrer" className="text-primary underline">
                  gameasu.com/tarifs
                </a>.
              </p>
            </CardContent>
          </Card>

          {/* Modules inclus — accès total */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" /> Tous les modules inclus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ALL_MODULES.map(([, label]) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-foreground/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onglet Add-ons ── */}
        <TabsContent value="addons" className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Add-ons & services complémentaires</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Étendez les capacités de votre espace Gameasu avec des modules optionnels activables à la demande.
            </p>
          </div>
          <AddonsPanel />
        </TabsContent>

        {/* ── Onglet Paiements ── */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Transactions de paiement</h2>
              <p className="text-sm text-muted-foreground">
                {isStripeConfiguredOnFront
                  ? "Carte bancaire (Stripe), Mixx, Flooz — confirmation automatique par webhook."
                  : "Carte bancaire, Mixx, Flooz — confirmez manuellement après réception."}
              </p>
            </div>
            {isEnterprise ? (
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <a href={`mailto:sales@gameasutech.africa?subject=Devis%20Gam%C3%A9as%C3%B9%20%2B${userCount}%20utilisateurs`}>
                  <Mail className="w-4 h-4 mr-2" /> Demander un devis
                </a>
              </Button>
            ) : (
              <Button onClick={() => setShowPayModal(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Wallet className="w-4 h-4 mr-2" /> Payer maintenant
              </Button>
            )}
          </div>

          {/* Statut Stripe */}
          {isStripeConfiguredOnFront && savedCard && (
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              autopayEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-blue-200 bg-blue-50 text-blue-800"
            }`}>
              {autopayEnabled
                ? <Repeat className="w-4 h-4 text-emerald-600 shrink-0" />
                : <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />}
              <span>
                {autopayEnabled
                  ? `Autopay actif — ${savedCard.label} — Renouvellement automatique à l'échéance.`
                  : `Carte enregistrée : ${savedCard.label} — Autopay désactivé.`}
              </span>
            </div>
          )}

          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">Aucune transaction de paiement pour le moment.</p>
                {isEnterprise ? (
                  <Button asChild className="mt-4">
                    <a href={`mailto:sales@gameasutech.africa?subject=Devis%20Gam%C3%A9as%C3%B9%20%2B${userCount}%20utilisateurs`}>
                      <Mail className="w-4 h-4 mr-2" /> Demander un devis
                    </a>
                  </Button>
                ) : (
                  <Button className="mt-4" onClick={() => setShowPayModal(true)}>Initier un paiement</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-2.5">Date</th>
                        <th className="text-left px-4 py-2.5">Référence</th>
                        <th className="text-left px-4 py-2.5">Mode</th>
                        <th className="text-right px-4 py-2.5">Montant</th>
                        <th className="text-left px-4 py-2.5">Statut</th>
                        <th className="text-right px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {transactions.map((tx) => {
                        const isMobile = MOBILE_MONEY_METHODS.includes(tx.method);
                        const MethodIcon = tx.method === "card" ? CreditCard : Smartphone;
                        const isStripeCard = tx.method === "card" && tx.gatewayRef?.startsWith("pi_");
                        return (
                          <tr key={tx.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                              {formatDate(tx.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-mono text-xs font-semibold">{tx.reference ?? "—"}</p>
                              {tx.payerPhone && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {tx.payerPhone}
                                </p>
                              )}
                              {isStripeCard && (
                                <p className="text-[10px] text-blue-500 font-mono">{tx.gatewayRef?.slice(0, 18)}…</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tx.method === "card" ? "text-blue-700" : isMobile ? "text-amber-700" : "text-slate-600"}`}>
                                <MethodIcon className={`w-3.5 h-3.5 ${tx.method === "card" ? "text-blue-500" : tx.method === "mixx" ? "text-emerald-500" : "text-orange-500"}`} />
                                {tx.method === "card" ? (isStripeCard ? "Stripe" : "Carte") : tx.method === "mixx" ? "Mixx" : tx.method === "flooz" ? "Flooz" : "Mobile Money"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{formatFCFA(tx.amount)}</td>
                            <td className="px-4 py-3"><TxBadge status={tx.status} /></td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                {/* Paiements non-Stripe : confirmation manuelle */}
                                {tx.status === "pending" && !isStripeCard && (
                                  <>
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                      onClick={() => confirmMutation.mutate(tx.id)}
                                      disabled={confirmMutation.isPending}
                                    >
                                      <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmer
                                    </Button>
                                    <Button
                                      size="sm" variant="ghost"
                                      className="h-7 text-xs text-slate-500"
                                      onClick={() => cancelMutation.mutate(tx.id)}
                                      disabled={cancelMutation.isPending}
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                                {/* Paiements Stripe : confirmation automatique par webhook */}
                                {tx.status === "pending" && isStripeCard && (
                                  <span className="text-[10px] text-blue-500 italic">Webhook en attente…</span>
                                )}
                                {tx.status === "confirmed" && (
                                  <Button
                                    size="sm" variant="ghost"
                                    className="h-7 text-xs text-amber-700"
                                    onClick={() => setReceiptTxId(tx.id)}
                                  >
                                    <Receipt className="w-3 h-3 mr-1" /> Reçu
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Légende */}
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Modes de paiement acceptés</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PAYMENT_METHODS.map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <div key={pm.value} className="flex items-start gap-2">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${pm.color}`} />
                      <div>
                        <p className="text-sm font-medium">{pm.label}</p>
                        <p className="text-xs text-muted-foreground">{pm.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onglet Autopay ── */}
        <TabsContent value="autopay" className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Paiement automatique</h2>
            <p className="text-sm text-muted-foreground">
              Sauvegardez une carte bancaire pour un renouvellement automatique sécurisé via Stripe.
            </p>
          </div>
          <AutopayPanel
            stripeStatus={stripeStatus}
            onRefresh={() => { refetchStripe(); refetchTx(); }}
          />
        </TabsContent>

        {/* ── Onglet Historique ── */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique de facturation</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Description</th>
                      <th className="text-left px-4 py-2.5">Référence</th>
                      <th className="text-right px-4 py-2.5">Montant</th>
                      <th className="text-left px-4 py-2.5">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(events ?? []).map((e) => (
                      <tr key={e.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(e.occurredAt).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-4 py-2.5">{e.label}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{e.reference ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{formatFCFA(e.amount)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                            e.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                            e.status === "pending" ? "bg-amber-100 text-amber-700" :
                            e.status === "failed" ? "bg-red-100 text-red-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {e.status === "paid" ? "Payé" : e.status === "pending" ? "En attente" : e.status === "failed" ? "Échoué" : e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(events ?? []).length === 0 && (
                      <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Aucun évènement</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onglet Passerelles ── */}
        <TabsContent value="gateways" className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Configuration des passerelles de paiement</h2>
            <p className="text-sm text-muted-foreground">Activez les modes de paiement et configurez les paramètres de chaque passerelle.</p>
          </div>
          <GatewayConfigPanel />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showPayModal && (
        <PaymentModal
          open={showPayModal}
          onClose={() => setShowPayModal(false)}
          userCount={userCount}
          amountHT={amountHT}
          tva={tva}
          ttc={ttc}
          isEnterprise={isEnterprise}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["payment-transactions"] });
            qc.invalidateQueries({ queryKey: ["billing-events"] });
            qc.invalidateQueries({ queryKey: ["stripe-status"] });
          }}
        />
      )}
      {receiptTxId && (
        <ReceiptModal txId={receiptTxId} onClose={() => setReceiptTxId(null)} />
      )}
    </div>
  );
}

// ─── Add-ons Panel ───────────────────────────────────────────────

type AddonItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  billingType: string; // "credits" | "quote" | "monthly" | "annual" | "onetime"
  priceHT: number;     // pour "credits" : prix par unité ; sinon prix fixe
  tva: number;
  unit: string | null;
  includedUnits: number | null;
  isActive: boolean;
  subscription: {
    id: string;
    status: string;
    activatedAt: string | null;
    nextRenewalAt: string | null;
    usageUsed: number;
    creditsPurchased: number;
    creditsBalance: number;
  } | null;
};

const ADDON_CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  sms:     { label: "SMS",     icon: MessageSquare,  color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  email:   { label: "Email",   icon: MailOpen,        color: "text-blue-600",   bg: "bg-blue-50 border-blue-200"   },
  support: { label: "Support", icon: HeadphonesIcon,  color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  general: { label: "Général", icon: Sparkles,        color: "text-slate-600",  bg: "bg-slate-50 border-slate-200" },
};

// ── Carte : achat de crédits (SMS / email) ───────────────────────

function CreditsCard({
  addon,
  onBuy,
  loading,
}: {
  addon: AddonItem;
  onBuy: (id: string, qty: number) => void;
  loading: boolean;
}) {
  const meta = ADDON_CATEGORY_META[addon.category] ?? ADDON_CATEGORY_META.general;
  const Icon = meta.icon;
  const [qty, setQty] = useState(500);

  const priceHTTotal  = addon.priceHT * qty;
  const tvaTotal      = Math.round(priceHTTotal * 0.18);
  const priceTTCTotal = priceHTTotal + tvaTotal;
  const balance       = addon.subscription?.creditsBalance ?? 0;

  return (
    <Card className={cn(
      "transition-all duration-150 flex flex-col",
      addon.isActive ? "border-primary/30 shadow-sm" : "border-slate-200",
    )}>
      <CardContent className="p-5 space-y-4 flex-1">
        {/* En-tête */}
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg border shrink-0", meta.bg)}>
            <Icon className={cn("w-4 h-4", meta.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-900">{addon.name}</span>
              <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-1.5 py-0 h-4">
                À l'unité
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{addon.description}</p>
          </div>
        </div>

        {/* Solde de crédits */}
        {addon.isActive && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Solde disponible
            </span>
            <span className="text-sm font-bold text-emerald-800">
              {balance.toLocaleString("fr-FR")} {addon.unit}
            </span>
          </div>
        )}

        {/* Prix unitaire */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Prix unitaire HT</span>
          <span className="text-sm font-semibold text-slate-900">
            {formatFCFA(addon.priceHT)} <span className="font-normal text-muted-foreground text-xs">/ {addon.unit}</span>
          </span>
        </div>

        {/* Sélecteur de quantité */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">
            Quantité à acheter ({addon.unit})
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={() => setQty(Math.max(100, qty - 500))}
              disabled={loading}
            >−</Button>
            <Input
              type="number"
              min={100}
              step={100}
              value={qty}
              onChange={(e) => setQty(Math.max(100, parseInt(e.target.value) || 100))}
              className="h-8 text-center text-sm font-semibold"
              disabled={loading}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={() => setQty(qty + 500)}
              disabled={loading}
            >+</Button>
          </div>
        </div>

        {/* Récapitulatif */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 divide-y divide-slate-100 text-sm">
          <div className="flex justify-between px-3 py-2 text-muted-foreground">
            <span>{qty.toLocaleString("fr-FR")} × {formatFCFA(addon.priceHT)} HT</span>
            <span className="font-medium">{formatFCFA(priceHTTotal)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-muted-foreground">
            <span>TVA 18 %</span>
            <span>{formatFCFA(tvaTotal)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 font-semibold text-slate-900 bg-white rounded-b-lg">
            <span>Total TTC</span>
            <span className="text-primary">{formatFCFA(priceTTCTotal)}</span>
          </div>
        </div>
      </CardContent>

      <div className="px-5 pb-5">
        <Button
          size="sm"
          className="w-full text-xs font-semibold bg-primary hover:bg-primary/90 text-white"
          disabled={loading}
          onClick={() => onBuy(addon.id, qty)}
        >
          {loading ? "En cours…" : `Acheter ${qty.toLocaleString("fr-FR")} ${addon.unit}`}
        </Button>
      </div>
    </Card>
  );
}

// ── Carte : prix sur devis ───────────────────────────────────────

function QuoteCard({
  addon,
  onRequestQuote,
  loading,
}: {
  addon: AddonItem;
  onRequestQuote: (id: string) => void;
  loading: boolean;
}) {
  const meta = ADDON_CATEGORY_META[addon.category] ?? ADDON_CATEGORY_META.general;
  const Icon = meta.icon;
  const isPending = addon.subscription?.status === "pending_quote";

  return (
    <Card className={cn(
      "transition-all duration-150 flex flex-col",
      isPending ? "border-amber-300 shadow-sm" : "border-slate-200",
    )}>
      <CardContent className="p-5 space-y-4 flex-1">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg border shrink-0", meta.bg)}>
            <Icon className={cn("w-4 h-4", meta.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-900">{addon.name}</span>
              {isPending ? (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0 h-4">
                  Devis en attente
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] px-1.5 py-0 h-4">
                  Sur devis
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{addon.description}</p>
          </div>
        </div>

        {/* Indicateur sur devis */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-slate-700">Prix sur devis</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adapté à la taille de votre organisation et à la complexité du projet
          </p>
        </div>

        {isPending && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Votre demande de devis a bien été reçue. Notre équipe vous contactera dans les 24 h ouvrées.
            </p>
          </div>
        )}
      </CardContent>

      <div className="px-5 pb-5">
        <Button
          size="sm"
          variant={isPending ? "outline" : "default"}
          className={cn(
            "w-full text-xs font-semibold",
            isPending
              ? "border-amber-300 text-amber-700 hover:bg-amber-50"
              : "bg-primary hover:bg-primary/90 text-white",
          )}
          disabled={loading || isPending}
          onClick={() => onRequestQuote(addon.id)}
        >
          {isPending ? "Devis demandé ✓" : loading ? "En cours…" : "Demander un devis"}
        </Button>
      </div>
    </Card>
  );
}

// ── Panneau principal ────────────────────────────────────────────

function AddonsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: AddonItem[] }>({
    queryKey: ["billing-addons"],
    queryFn: () => apiFetch("/api/billing/addons"),
  });

  const [actionId, setActionId] = useState<string | null>(null);

  const addons = data?.data ?? [];
  const creditsAddons = addons.filter((a) => a.billingType === "credits");
  const quoteAddons   = addons.filter((a) => a.billingType === "quote");
  const hasCredits    = creditsAddons.some((a) => a.isActive);

  const handleBuyCredits = async (id: string, qty: number) => {
    setActionId(id);
    try {
      const res = await apiFetch<{ quantity: number; unit: string; priceTTCTotal: number }>(
        `/api/billing/addons/${id}/buy-credits`,
        { method: "POST", body: JSON.stringify({ quantity: qty }) },
      );
      await qc.invalidateQueries({ queryKey: ["billing-addons"] });
      sonnerToast.success(
        `${res.quantity.toLocaleString("fr-FR")} ${res.unit} ajoutés — ${formatFCFA(res.priceTTCTotal)} TTC`,
      );
    } catch (e: any) {
      sonnerToast.error(e?.message ?? "Erreur lors de l'achat");
    } finally {
      setActionId(null);
    }
  };

  const handleRequestQuote = async (id: string) => {
    setActionId(id);
    try {
      await apiFetch(`/api/billing/addons/${id}/request-quote`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await qc.invalidateQueries({ queryKey: ["billing-addons"] });
      sonnerToast.success("Demande de devis envoyée — nous vous répondrons sous 24 h ouvrées.");
    } catch (e: any) {
      sonnerToast.error(e?.message ?? "Erreur lors de la demande");
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-36 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Résumé crédits actifs */}
      {hasCredits && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Solde de crédits
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-3">
              {creditsAddons.filter((a) => a.isActive).map((a) => {
                const meta = ADDON_CATEGORY_META[a.category] ?? ADDON_CATEGORY_META.general;
                const Icon = meta.icon;
                return (
                  <div key={a.id} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium", meta.bg, meta.color)}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{a.name}</span>
                    <span className="font-bold">
                      {(a.subscription?.creditsBalance ?? 0).toLocaleString("fr-FR")} {a.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crédits SMS & Email */}
      {creditsAddons.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md border bg-violet-50 border-violet-200">
              <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wider">Crédits de communication</h3>
            <Badge variant="outline" className="text-[10px] text-muted-foreground ml-1">À l'unité · sans expiration</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {creditsAddons.map((addon) => (
              <CreditsCard
                key={addon.id}
                addon={addon}
                onBuy={handleBuyCredits}
                loading={actionId === addon.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Services sur devis */}
      {quoteAddons.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md border bg-amber-50 border-amber-200">
              <HeadphonesIcon className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wider">Services & accompagnement</h3>
            <Badge variant="outline" className="text-[10px] text-muted-foreground ml-1">Sur devis · selon votre organisation</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {quoteAddons.map((addon) => (
              <QuoteCard
                key={addon.id}
                addon={addon}
                onRequestQuote={handleRequestQuote}
                loading={actionId === addon.id}
              />
            ))}
          </div>
        </div>
      )}

      {addons.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Aucun add-on disponible pour le moment.</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Tous les prix sont affichés <strong>hors taxes (HT)</strong>. La TVA de 18 % s'applique au moment du paiement.
        Les crédits de communication n'ont <strong>pas de date d'expiration</strong> tant que votre abonnement est actif.
      </p>
    </div>
  );
}

// ─── Stat helper ─────────────────────────────────────────────────

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
