import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBillingSummary, useBillingEvents, useBillingUsage, useSubscriptionPlans, useChangePlan, useChangeBillingCycle, useCurrentSubscription } from "@/lib/saas";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatDate } from "@/lib/format";
import { PlanBadge } from "@/components/PlanBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check, CheckCircle2, Crown, Calendar, Users, Receipt, ArrowUpRight, RefreshCw,
  CreditCard, Smartphone, Wallet, AlertCircle, Clock, XCircle, Download,
  Settings, Shield, Zap, Phone, FileText, ToggleLeft, ToggleRight, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BRANDING } from "@/config/branding";
import { toast as sonnerToast } from "sonner";

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

// ─── Constants ────────────────────────────────────────────────────

const MOBILE_MONEY_METHODS = ["mixx", "flooz", "mobile_money"];

const PAYMENT_METHODS = [
  { value: "card", label: "Carte bancaire", icon: CreditCard, color: "text-blue-600", desc: "Visa, Mastercard — saisie manuelle de référence" },
  { value: "mixx", label: "Mixx", icon: Smartphone, color: "text-emerald-600", desc: "Mobile Money Togo (Mixx)" },
  { value: "flooz", label: "Flooz", icon: Smartphone, color: "text-orange-500", desc: "Mobile Money Togo (Flooz)" },
];

const PURPOSE_LABELS: Record<string, string> = {
  renewal: "Renouvellement",
  setup_fee: "Frais d'installation",
  upgrade: "Changement de formule",
  addon: "Module additionnel",
  seats: "Licences supplémentaires",
};

const TX_STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: "En attente",  cls: "bg-amber-50 text-amber-700 border-amber-200",   icon: Clock },
  confirmed: { label: "Confirmé",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  failed:    { label: "Échoué",      cls: "bg-red-50 text-red-700 border-red-200",          icon: XCircle },
  cancelled: { label: "Annulé",      cls: "bg-slate-100 text-slate-600 border-slate-200",   icon: XCircle },
  expired:   { label: "Expiré",      cls: "bg-slate-100 text-slate-500 border-slate-200",   icon: Clock },
  refunded:  { label: "Remboursé",   cls: "bg-purple-50 text-purple-700 border-purple-200", icon: RefreshCw },
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

function PaymentModal({
  open, onClose, currentPlan, currentSub, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  currentPlan: { name: string; code: string } | undefined;
  currentSub: { seats: number; unitPrice: number; billingCycle: string } | undefined;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState("card");
  const [payerPhone, setPayerPhone] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const seats = currentSub?.seats ?? 1;
  const unitPrice = currentSub?.unitPrice ?? 0;
  const total = unitPrice * seats;
  const cycle = currentSub?.billingCycle === "annual" ? "an" : "mois";

  const isMobileMoney = MOBILE_MONEY_METHODS.includes(method);

  const handleSubmit = async () => {
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
      onClose();
    } catch (e: any) {
      sonnerToast.error(e?.message ?? "Erreur lors de l'initiation du paiement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-600" /> Payer votre abonnement
          </DialogTitle>
          <DialogDescription>
            {currentPlan?.name} · {seats} licence{seats > 1 ? "s" : ""} · {cycle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Récapitulatif montant */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">Montant à payer</p>
            <p className="text-3xl font-bold text-amber-900">{formatFCFA(total)}</p>
            <p className="text-xs text-amber-700 mt-1">
              {formatFCFA(unitPrice)} × {seats} siège{seats > 1 ? "s" : ""} / {cycle}
            </p>
          </div>

          {/* Choix du mode de paiement */}
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
                  </button>
                );
              })}
            </div>
          </div>

          {/* Champs spécifiques Mobile Money */}
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
                Effectuez le paiement depuis votre application mobile puis renseignez la référence de transaction ci-dessous.
              </p>
            </div>
          )}

          {/* Référence de transaction */}
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
            <Textarea rows={2} placeholder="Remarques, informations complémentaires…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Note sécurité */}
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3">
            <Shield className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-600">
              La transaction sera créée en statut <strong>En attente</strong>. Votre administrateur la confirmera après réception du paiement. L'abonnement est renouvelé automatiquement à la confirmation.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || total <= 0}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? "Initiation…" : `Initier le paiement — ${formatFCFA(total)}`}
          </Button>
        </DialogFooter>
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
                ["Émis par", data.issuedBy || "Gaméasù"],
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

// ─── TransactionStatusBadge ───────────────────────────────────────

function TxBadge({ status }: { status: string }) {
  const cfg = TX_STATUS_CFG[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
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
                    placeholder="https://…/api/webhooks/payment/…"
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
                🔒 Les clés secrètes (STRIPE_SECRET_KEY, etc.) doivent être configurées via les variables d'environnement — jamais ici.
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
  const { data: plans } = useSubscriptionPlans();
  const { data: current } = useCurrentSubscription();
  const changePlan = useChangePlan();
  const changeCycle = useChangeBillingCycle();

  const { data: txData, refetch: refetchTx } = useQuery<{ data: PaymentTransaction[] }>({
    queryKey: ["payment-transactions"],
    queryFn: () => apiFetch("/api/billing/payment-transactions"),
  });

  const [showPayModal, setShowPayModal] = useState(false);
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null);

  const currentPlanCode = current?.plan.code;
  const cycle = current?.subscription.billingCycle ?? "monthly";

  const transactions = txData?.data ?? [];
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

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

  const total = (current?.subscription.unitPrice ?? 0) * (current?.subscription.seats ?? 1);

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
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="overview">Formule</TabsTrigger>
          <TabsTrigger value="payments" className="relative">
            Paiements
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="gateways">Passerelles</TabsTrigger>
        </TabsList>

        {/* ── Onglet Formule ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Plan actuel */}
            <Card className="lg:col-span-2 border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-white">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/80">Formule active</p>
                  <div className="flex items-center gap-3 mt-1">
                    <CardTitle className="text-2xl">{current?.plan.name ?? "—"}</CardTitle>
                    <PlanBadge code={current?.plan.code} name={current?.plan.name} light />
                  </div>
                  <p className="text-muted-foreground text-sm mt-2">{current?.plan.description}</p>
                </div>
                <Crown className="w-8 h-8 text-amber-500/80 shrink-0" />
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <Stat icon={Users} label="Licences" value={`${usage?.seatsUsed ?? 0} / ${current?.subscription.seats ?? 0}`} />
                <Stat icon={Calendar} label="Cycle" value={cycle === "annual" ? "Annuel" : "Mensuel"} />
                <Stat icon={Receipt} label="Prix / siège" value={formatFCFA(current?.subscription.unitPrice ?? 0)} />
                <Stat icon={CheckCircle2} label="Prochaine échéance" value={current?.subscription.currentPeriodEnd
                  ? new Date(current.subscription.currentPeriodEnd).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setShowPayModal(true)}
                  disabled={total <= 0}
                >
                  <Wallet className="w-4 h-4 mr-2" /> Payer maintenant — {formatFCFA(total)}
                </Button>
                <Button
                  variant="outline" className="w-full justify-between"
                  onClick={() => changeCycle.mutate(cycle === "annual" ? "monthly" : "annual", {
                    onSuccess: () => toast({ title: "Cycle mis à jour" }),
                  })}
                  disabled={changeCycle.isPending}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    {cycle === "annual" ? "Repasser en mensuel" : "Passer en annuel"}
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <a href={`mailto:sales@${BRANDING.appName.toLowerCase()}.africa`}>
                    Contacter le commercial <ArrowUpRight className="w-4 h-4" />
                  </a>
                </Button>
                <p className="text-[11px] text-muted-foreground pt-1">
                  Le paiement est confirmé manuellement. L'abonnement se renouvelle automatiquement à la confirmation.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Modules inclus */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modules inclus dans votre formule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(current?.plan.includedModules ?? []).map((m) => (
                  <div key={m} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    {MODULE_LABELS[m] ?? m}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comparatif plans */}
          <section>
            <div className="mb-3">
              <h2 className="text-xl font-bold">Évoluer ou changer de formule</h2>
              <p className="text-sm text-muted-foreground">Tarifs en FCFA — facturé {cycle === "annual" ? "annuellement" : "mensuellement"} par utilisateur.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {(plans ?? []).map((p) => {
                const price = cycle === "annual" ? p.annualPricePerSeat : p.monthlyPricePerSeat;
                const isCurrent = p.code === currentPlanCode;
                return (
                  <Card key={p.id} className={`relative ${p.isFeatured ? "border-amber-400 shadow-lg" : ""}`}>
                    {p.isFeatured && (
                      <span className="absolute -top-2 right-4 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full px-2.5 py-0.5">
                        Le plus choisi
                      </span>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        <PlanBadge code={p.code} compact />
                      </div>
                      <p className="text-xs text-muted-foreground">{p.tagline}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-3xl font-bold">{formatFCFA(price)}</p>
                        <p className="text-[11px] text-muted-foreground">/ siège / {cycle === "annual" ? "an" : "mois"}</p>
                        {p.setupFee > 0 && (
                          <p className="text-[11px] text-amber-700 mt-1">+ Installation : {formatFCFA(p.setupFee)}</p>
                        )}
                      </div>
                      <ul className="space-y-1.5 text-sm">
                        {(p.features ?? []).map((f) => (
                          <li key={f.id} className="flex gap-2">
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{f.label}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent || changePlan.isPending}
                        onClick={() => changePlan.mutate(p.code, {
                          onSuccess: () => toast({ title: "Formule mise à jour", description: `Vous êtes sur ${p.name}.` }),
                          onError: (e) => toast({ variant: "destructive", title: "Échec", description: e.message }),
                        })}
                      >
                        {isCurrent ? "Formule actuelle" : "Choisir cette formule"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </TabsContent>

        {/* ── Onglet Paiements ── */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Transactions de paiement</h2>
              <p className="text-sm text-muted-foreground">Carte bancaire, Mixx, Flooz — confirmez manuellement après réception.</p>
            </div>
            <Button onClick={() => setShowPayModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Wallet className="w-4 h-4 mr-2" /> Payer maintenant
            </Button>
          </div>

          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">Aucune transaction de paiement pour le moment.</p>
                <Button className="mt-4" onClick={() => setShowPayModal(true)}>
                  Initier un paiement
                </Button>
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
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tx.method === "card" ? "text-blue-700" : isMobile ? "text-amber-700" : "text-slate-600"}`}>
                                <MethodIcon className={`w-3.5 h-3.5 ${tx.method === "card" ? "text-blue-500" : tx.method === "mixx" ? "text-emerald-500" : "text-orange-500"}`} />
                                {tx.method === "card" ? "Carte" : tx.method === "mixx" ? "Mixx" : tx.method === "flooz" ? "Flooz" : "Mobile Money"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{formatFCFA(tx.amount)}</td>
                            <td className="px-4 py-3"><TxBadge status={tx.status} /></td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                {tx.status === "pending" && (
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

          {/* Légende modes de paiement */}
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
          currentPlan={current?.plan}
          currentSub={current?.subscription}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["payment-transactions"] });
            qc.invalidateQueries({ queryKey: ["billing-events"] });
          }}
        />
      )}
      {receiptTxId && (
        <ReceiptModal txId={receiptTxId} onClose={() => setReceiptTxId(null)} />
      )}
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
