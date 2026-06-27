import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, ArrowLeft, Building2, Users, CreditCard, Ticket, Activity,
  Power, PowerOff, CheckCircle2, XCircle, Clock, AlertTriangle, Mail,
  Calendar, TrendingUp, Shield, Package, Key, Copy, RefreshCw, Send, Trash2,
  Sparkles, RotateCcw,
} from "lucide-react";
import OrgUsersTab from "./OrgUsersTab";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type PricingLine = { label: string; qty: number; unitPrice: number; total: number };
type PriceResult = {
  activeUsers: number;
  ht: number | null;
  tva: number | null;
  ttc: number | null;
  isCustom: boolean;
  mrr: number;
  breakdown: PricingLine[];
};

type OrgDetail = {
  org: {
    id: string; name: string; slug: string; industry: string | null;
    country: string | null; isActive: boolean; isDefault: boolean;
    createdAt: string; contactEmail: string | null; primaryColor: string | null;
    currency: string;
  };
  subscription: {
    id: string; planCode: string; planName: string; seats: number; unitPrice: number;
    cycle: string; status: string; currentPeriodStart: string; currentPeriodEnd: string;
    setupFee: number | null;
  } | null;
  mrr: number;
  pricing: PriceResult;
  metrics: {
    memberCount: number; activeUsers: number; moduleCount: number; ticketCount: number;
    openTickets: number; totalRevenue: number; failedPayments: number;
  };
};

type BillingRow = {
  id: string; kind: string; label: string; amount: number;
  amountHt: number; amountTva: number; amountTtc: number;
  currency: string; status: string; reference: string | null;
  occurredAt: string; metadata: Record<string, unknown> | null;
};

type BillingList = {
  rows: BillingRow[];
  summary: { totalPaid: number; totalFailed: number; totalPending: number };
};

type UserRow = {
  userId: string; role: string; isPrimary: boolean; joinedAt: string;
  firstName: string | null; lastName: string | null; email: string | null;
  userRole: string | null; isActive: boolean | null;
};

type TicketRow = {
  id: string; subject: string; category: string; priority: string;
  status: string; createdAt: string;
};

type AdminInvRow = {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; mustChangePassword: boolean;
  invitedAt: string | null; acceptedAt: string | null;
  expiresAt: string | null; hasToken: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TVA_RATE = 0.18;

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const BILLING_STATUS: Record<string, { cls: string; label: string }> = {
  paid:      { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Confirmé" },
  pending:   { cls: "bg-amber-50 text-amber-700 border-amber-200",    label: "En attente" },
  failed:    { cls: "bg-red-50 text-red-700 border-red-200",          label: "Échoué" },
  refunded:  { cls: "bg-purple-50 text-purple-700 border-purple-200", label: "Remboursé" },
  cancelled: { cls: "bg-gray-50 text-gray-500 border-gray-200",       label: "Annulé" },
  expired:   { cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Expiré" },
  overdue:   { cls: "bg-red-50 text-red-700 border-red-200",          label: "En retard" },
};

const PRIORITY_CFG: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-blue-100 text-blue-700",
};

const TICKET_STATUS_CFG: Record<string, string> = {
  open:        "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved:    "bg-emerald-100 text-emerald-700",
  closed:      "bg-gray-100 text-gray-600",
};

const PLAN_COLOR: Record<string, string> = {
  STARTER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  GROWTH: "bg-violet-50 text-violet-700 border-violet-200",
  PROFESSIONAL: "bg-purple-50 text-purple-700 border-purple-200",
  ENTERPRISE: "bg-pink-50 text-pink-700 border-pink-200",
};

type Tab = "overview" | "subscription" | "billing" | "addons" | "users" | "tickets" | "actions" | "access";

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TenantDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [confirming, setConfirming] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [revokingLink, setRevokingLink] = useState<string | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState("");
  const [savingCustomPrice, setSavingCustomPrice] = useState(false);

  const detail = useQuery<OrgDetail>({
    queryKey: ["cockpit-org", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}`),
  });
  const billing = useQuery<BillingList>({
    queryKey: ["cockpit-org-billing", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/billing`),
    enabled: tab === "billing",
  });
  const tickets = useQuery<{ rows: TicketRow[] }>({
    queryKey: ["cockpit-org-tickets", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/tickets`),
    enabled: tab === "tickets",
  });
  const adminInvs = useQuery<{ users: AdminInvRow[] }>({
    queryKey: ["cockpit-org-admin-invs", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/admin-invitations`),
    enabled: tab === "access",
  });

  type AddonPricingRow = {
    id: string; slug: string; name: string; category: string;
    billingType: string; unit: string | null;
    catalogPriceHT: number; customPriceHT: number | null; effectivePriceHT: number;
  };
  const addonPricing = useQuery<{ data: AddonPricingRow[] }>({
    queryKey: ["cockpit-org-addon-pricing", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/addon-pricing`),
    enabled: tab === "addons",
  });

  // Local draft prices while editing
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  type StructInvRow = {
    id: string; contactEmail: string | null; contactName: string | null;
    status: string; suggestedPlanCode: string | null; expiresAt: string;
    acceptedAt: string | null; createdAt: string; token: string; notes: string | null;
    onboardUrl: string;
  };
  const structInvs = useQuery<{ invitations: StructInvRow[] }>({
    queryKey: ["cockpit-org-struct-invs", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/structure-invitations`),
    enabled: tab === "access",
  });

  const attSettings = useQuery<{ sector: string; sectorLabel: string; sectorIcon: string; settings: Record<string, unknown> | null }>({
    queryKey: ["cockpit-org-att-settings", id],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${id}/attendance-settings`),
    enabled: tab === "overview",
  });

  const handleSetCustomPrice = async () => {
    const v = parseFloat(customPriceInput.replace(/\s/g, "").replace(",", "."));
    if (!v || v <= 0) { toast.error("Entrez un montant positif en FCFA"); return; }
    setSavingCustomPrice(true);
    try {
      await apiFetch(`/api/super-admin/organizations/${id}/custom-price`, {
        method: "PATCH", body: JSON.stringify({ monthlyHt: v }),
      });
      toast.success("Prix négocié enregistré");
      qc.invalidateQueries({ queryKey: ["cockpit-org", id] });
      qc.invalidateQueries({ queryKey: ["cockpit-orgs"] });
      qc.invalidateQueries({ queryKey: ["cockpit-overview"] });
      setCustomPriceInput("");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setSavingCustomPrice(false);
    }
  };

  const d = detail.data;
  const org = d?.org;
  const sub = d?.subscription;
  const m = d?.metrics;
  const pricing = d?.pricing;

  const handleGenerateLink = async (withEmail = false) => {
    setGeneratingLink(true);
    try {
      const body: Record<string, unknown> = {};
      if (withEmail && org?.contactEmail) {
        body.sendEmailInvite = true;
        body.contactEmail = org.contactEmail;
        body.contactName = org.name;
      }
      const r = await apiFetch<{ onboardUrl: string; expiresAt: string }>(
        `/api/super-admin/organizations/${id}/structure-invitations/generate`,
        { method: "POST", body: JSON.stringify(body) },
      );
      const msg = withEmail && org?.contactEmail
        ? "Lien d'accès généré et envoyé par email — copié dans le presse-papier"
        : "Lien d'accès généré — copié dans le presse-papier";
      toast.success(msg);
      navigator.clipboard.writeText(r.onboardUrl).catch(() => {});
      structInvs.refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleRevokeLink = async (invId: string) => {
    setRevokingLink(invId);
    try {
      await apiFetch(
        `/api/super-admin/structure-invitations/${invId}/revoke`,
        { method: "POST", body: JSON.stringify({}) },
      );
      toast.success("Lien révoqué");
      structInvs.refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setRevokingLink(null);
    }
  };

  const handleRegenerate = async (userId: string, sendEmailInvite = true) => {
    setRegenerating(userId);
    try {
      const r = await apiFetch<{ acceptUrl: string; expiresAt: string }>(
        `/api/super-admin/organizations/${id}/admin-invitations/regenerate`,
        { method: "POST", body: JSON.stringify({ userId, sendEmailInvite }) },
      );
      toast.success("Lien d'invitation régénéré");
      navigator.clipboard.writeText(r.acceptUrl).catch(() => {});
      adminInvs.refetch();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setRegenerating(null);
    }
  };

  const handleToggle = async () => {
    if (!org) return;
    setToggling(true);
    try {
      const action = org.isActive ? "suspend" : "reactivate";
      await apiFetch(`/api/super-admin/organizations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      toast.success(action === "suspend" ? "Organisation suspendue" : "Organisation réactivée");
      qc.invalidateQueries({ queryKey: ["cockpit-org", id] });
      qc.invalidateQueries({ queryKey: ["cockpit-orgs"] });
      setConfirming(false);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setToggling(false);
    }
  };

  const handleSaveAddonPrices = async () => {
    setSavingPrices(true);
    try {
      const rows = addonPricing.data?.data ?? [];
      const prices = rows.map((r) => {
        const raw = draftPrices[r.id];
        const parsed = raw !== undefined ? (raw === "" ? null : parseInt(raw, 10)) : undefined;
        return {
          addonId:      r.id,
          customPriceHT: parsed !== undefined ? (isNaN(parsed as number) ? null : parsed) : r.customPriceHT,
        };
      });
      await apiFetch(`/api/super-admin/organizations/${id}/addon-pricing`, {
        method: "PUT",
        body: JSON.stringify({ prices }),
      });
      toast.success("Tarification add-ons enregistrée");
      setDraftPrices({});
      qc.invalidateQueries({ queryKey: ["cockpit-org-addon-pricing", id] });
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setSavingPrices(false);
    }
  };

  const handleDelete = async () => {
    if (!org || deleteInput !== org.name) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/super-admin/organizations/${id}`, {
        method: "DELETE", body: JSON.stringify({ confirm: deleteInput }),
      });
      toast.success(`Organisation "${org.name}" supprimée définitivement`);
      qc.invalidateQueries({ queryKey: ["cockpit-orgs"] });
      qc.invalidateQueries({ queryKey: ["cockpit-overview"] });
      navigate("/tenants");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur lors de la suppression");
      setDeleting(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: "overview",     label: "Vue d'ensemble",    icon: Activity },
    { id: "subscription", label: "Abonnement",        icon: CreditCard },
    { id: "billing",      label: "Paiements",         icon: TrendingUp },
    { id: "addons",       label: "Add-ons",           icon: Sparkles },
    { id: "users",        label: "Utilisateurs",      icon: Users },
    { id: "tickets",      label: "Tickets",           icon: Ticket },
    { id: "access",       label: "Accès & Invitations", icon: Key },
    { id: "actions",      label: "Actions",           icon: Shield },
  ];

  if (detail.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Organisation introuvable
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/tenants")} className="mt-0.5">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />Retour
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">{org.name}</h1>
            <Badge variant="outline" className={org.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
              {org.isActive ? <><CheckCircle2 className="w-3 h-3 mr-1" />Active</> : <><XCircle className="w-3 h-3 mr-1" />Suspendue</>}
            </Badge>
            {sub?.planCode && <Badge variant="outline" className={PLAN_COLOR[sub.planCode] ?? ""}>{sub.planCode}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{org.slug} · {org.industry ?? "—"} · {org.country ?? "—"}</p>
        </div>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground truncate">Util. actifs</p>
            <p className="text-lg font-bold mt-0.5 text-primary">
              {pricing?.activeUsers ?? 0}
              {pricing?.isCustom && <span className="ml-1 text-[10px] text-purple-600 normal-case font-semibold">&gt;50</span>}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground truncate">Prix HT/mois</p>
            <p className="text-lg font-bold mt-0.5 text-indigo-600 truncate">
              {pricing?.isCustom && pricing.ht == null ? <span className="text-xs font-normal italic text-muted-foreground">À définir</span> : fmtFCFA(pricing?.ht ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground truncate">TVA 18%</p>
            <p className="text-lg font-bold mt-0.5 text-muted-foreground truncate">
              {pricing?.tva != null ? fmtFCFA(pricing.tva) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground truncate">Prix TTC/mois</p>
            <p className="text-lg font-bold mt-0.5 text-emerald-600 truncate">
              {pricing?.isCustom && pricing.ttc == null ? <span className="text-xs font-normal italic text-muted-foreground">À définir</span> : fmtFCFA(pricing?.ttc ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground truncate">Tickets ouverts</p>
            <p className={`text-lg font-bold mt-0.5 truncate ${m && m.openTickets > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{m?.openTickets ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground truncate">Paiements échoués</p>
            <p className={`text-lg font-bold mt-0.5 truncate ${m && m.failedPayments > 0 ? "text-red-600" : "text-muted-foreground"}`}>{m?.failedPayments ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: "Nom", value: org.name },
                { label: "Slug", value: <span className="font-mono text-xs">{org.slug}</span> },
                { label: "Secteur activité", value: org.industry ?? "—" },
                {
                  label: "Secteur pointage",
                  value: attSettings.data
                    ? <Badge variant="outline" className="font-mono text-xs gap-1">{attSettings.data.sectorIcon} {attSettings.data.sectorLabel}</Badge>
                    : <span className="text-muted-foreground">—</span>,
                },
                { label: "Pays", value: org.country ?? "—" },
                { label: "Email contact", value: org.contactEmail ?? "—" },
                { label: "Devise", value: org.currency },
                { label: "Créée le", value: fmtDate(org.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="font-medium text-right break-all">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" />Tarification active</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: "Utilisateurs actifs", value: <span className="font-bold">{pricing?.activeUsers ?? 0}</span> },
                { label: "Prix HT/mois", value: pricing?.isCustom && pricing.ht == null ? <span className="italic text-muted-foreground text-xs">À définir (personnalisée)</span> : <span className="font-bold text-indigo-600">{fmtFCFA(pricing?.ht ?? 0)}</span> },
                { label: "TVA 18%", value: <span className="text-muted-foreground">{pricing?.tva != null ? fmtFCFA(pricing.tva) : "—"}</span> },
                { label: "Prix TTC/mois", value: pricing?.isCustom && pricing.ttc == null ? <span className="italic text-muted-foreground text-xs">—</span> : <span className="font-bold text-emerald-600">{fmtFCFA(pricing?.ttc ?? 0)}</span> },
                ...(sub ? [
                  { label: "Statut abonnement", value: <Badge variant="outline" className={BILLING_STATUS[sub.status]?.cls ?? ""}>{BILLING_STATUS[sub.status]?.label ?? sub.status}</Badge> },
                  { label: "Fin période", value: fmtDate(sub.currentPeriodEnd) },
                ] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "subscription" && (
        <div className="space-y-4">
          {/* Résumé tarifaire */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" />Tarification mensuelle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* KPIs prix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Prix HT/mois",
                    value: pricing?.isCustom && pricing.ht == null ? "À définir" : fmtFCFA(pricing?.ht ?? 0),
                    sub: "hors taxes",
                    cls: "text-indigo-600",
                  },
                  {
                    label: "TVA 18%",
                    value: pricing?.tva != null ? fmtFCFA(pricing.tva) : "—",
                    sub: "taxe sur la valeur ajoutée",
                    cls: "text-muted-foreground",
                  },
                  {
                    label: "Prix TTC/mois",
                    value: pricing?.isCustom && pricing.ttc == null ? "À définir" : fmtFCFA(pricing?.ttc ?? 0),
                    sub: "toutes taxes comprises",
                    cls: "text-emerald-600",
                  },
                  {
                    label: "ARR (projeté)",
                    value: pricing?.ht != null ? fmtFCFA(pricing.ht * 12) : "—",
                    sub: "revenu annuel récurrent",
                    cls: "text-primary",
                  },
                ].map((k) => (
                  <div key={k.label} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className={`text-xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
                    <p className="text-[10px] text-muted-foreground">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* Décomposition par palier */}
              {pricing && !pricing.isCustom && pricing.breakdown.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Décomposition par palier — {pricing.activeUsers} utilisateur{pricing.activeUsers > 1 ? "s" : ""} actif{pricing.activeUsers > 1 ? "s" : ""}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Palier</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">Prix unitaire</TableHead>
                        <TableHead className="text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricing.breakdown.map((line) => (
                        <TableRow key={line.label}>
                          <TableCell className="text-sm">{line.label}</TableCell>
                          <TableCell className="text-right text-sm">{line.qty}</TableCell>
                          <TableCell className="text-right text-sm font-mono">{fmtFCFA(line.unitPrice)}</TableCell>
                          <TableCell className="text-right text-sm font-mono font-semibold">{fmtFCFA(line.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/20 font-semibold">
                        <TableCell colSpan={3} className="text-sm">Total HT / mois</TableCell>
                        <TableCell className="text-right text-sm font-mono font-bold text-indigo-600">{fmtFCFA(pricing.ht ?? 0)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={3} className="text-sm text-muted-foreground">TVA 18%</TableCell>
                        <TableCell className="text-right text-sm font-mono text-muted-foreground">{fmtFCFA(pricing.tva ?? 0)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-emerald-50/50 font-bold">
                        <TableCell colSpan={3} className="text-sm">Total TTC / mois</TableCell>
                        <TableCell className="text-right text-sm font-mono font-bold text-emerald-600">{fmtFCFA(pricing.ttc ?? 0)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Tarification personnalisée > 50 utilisateurs */}
              {pricing?.isCustom && (
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/40 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-purple-800">
                        Tarification personnalisée — {pricing.activeUsers} utilisateurs actifs
                      </p>
                      <p className="text-xs text-purple-600 mt-0.5">
                        Ce client dépasse 50 utilisateurs. Définissez un prix mensuel HT négocié ci-dessous.
                      </p>
                    </div>
                  </div>
                  {pricing.ht != null && (
                    <div className="text-sm space-y-1 border-t border-purple-200 pt-3">
                      <div className="flex justify-between"><span className="text-muted-foreground">Prix négocié HT</span><span className="font-bold text-indigo-600">{fmtFCFA(pricing.ht)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">TVA 18%</span><span>{pricing.tva != null ? fmtFCFA(pricing.tva) : "—"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Prix TTC</span><span className="font-bold text-emerald-600">{pricing.ttc != null ? fmtFCFA(pricing.ttc) : "—"}</span></div>
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {pricing.ht != null ? "Modifier le prix mensuel HT (FCFA)" : "Définir le prix mensuel HT (FCFA)"}
                      </label>
                      <Input
                        type="number"
                        placeholder="ex : 150000"
                        value={customPriceInput}
                        onChange={(e) => setCustomPriceInput(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Button
                      className="h-9 shrink-0"
                      disabled={savingCustomPrice || !customPriceInput}
                      onClick={handleSetCustomPrice}
                    >
                      {savingCustomPrice && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              )}

              {/* Infos contrat */}
              {sub && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><Badge variant="outline" className={PLAN_COLOR[sub.planCode] ?? ""}>{sub.planName}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cycle</span><span>{sub.cycle === "annual" ? "Annuel" : "Mensuel"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Statut</span><Badge variant="outline" className={BILLING_STATUS[sub.status]?.cls ?? ""}>{BILLING_STATUS[sub.status]?.label ?? sub.status}</Badge></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Début période</span><span>{fmtDate(sub.currentPeriodStart)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fin période</span><span>{fmtDate(sub.currentPeriodEnd)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Frais setup</span><span>{fmtFCFA(sub.setupFee ?? 0)}</span></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "billing" && (
        <div className="space-y-4">
          {billing.isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total encaissé", value: fmtFCFA(billing.data?.summary.totalPaid ?? 0), cls: "text-emerald-600" },
                  { label: "En attente", value: fmtFCFA(billing.data?.summary.totalPending ?? 0), cls: "text-amber-600" },
                  { label: "Paiements échoués", value: String(billing.data?.summary.totalFailed ?? 0), cls: "text-red-600" },
                ].map((k) => (
                  <Card key={k.label}><CardContent className="p-3">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">{k.label}</p>
                    <p className={`text-xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
                  </CardContent></Card>
                ))}
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Historique des paiements</CardTitle>
                  <CardDescription>TVA 18% incluse dans les montants TTC</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Libellé</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Montant HT</TableHead>
                          <TableHead className="text-right">TVA 18%</TableHead>
                          <TableHead className="text-right">TTC</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Référence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(billing.data?.rows ?? []).length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucun événement de facturation</TableCell></TableRow>
                        ) : (billing.data?.rows ?? []).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.occurredAt)}</TableCell>
                            <TableCell className="text-sm max-w-[180px]"><p className="truncate">{row.label}</p></TableCell>
                            <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.kind}</span></TableCell>
                            <TableCell className="text-right font-mono text-sm whitespace-nowrap">{fmtFCFA(row.amountHt)}</TableCell>
                            <TableCell className="text-right font-mono text-sm whitespace-nowrap text-muted-foreground">{fmtFCFA(row.amountTva)}</TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold whitespace-nowrap">{fmtFCFA(row.amountTtc)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${BILLING_STATUS[row.status]?.cls ?? ""}`}>
                                {BILLING_STATUS[row.status]?.label ?? row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground max-w-[100px]">
                              <p className="truncate">{row.reference ?? "—"}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Onglet Add-ons ── */}
      {tab === "addons" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">Tarification add-ons négociée</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Laissez un champ vide pour utiliser le prix catalogue. Le changement est immédiatement actif pour cette organisation.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {Object.keys(draftPrices).length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setDraftPrices({})}>
                  Annuler
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSaveAddonPrices}
                disabled={savingPrices || Object.keys(draftPrices).length === 0}
              >
                {savingPrices ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Enregistrement…</> : "Enregistrer"}
              </Button>
            </div>
          </div>

          {addonPricing.isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Add-on</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead className="text-right">Prix catalogue HT</TableHead>
                    <TableHead className="text-right w-44">Prix négocié HT</TableHead>
                    <TableHead className="text-right">Prix effectif</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(addonPricing.data?.data ?? []).filter((r) => r.billingType === "credits").map((row) => {
                    const draft    = draftPrices[row.id];
                    const isDirty  = draft !== undefined;
                    const draftVal = isDirty ? (draft === "" ? null : parseInt(draft, 10)) : undefined;
                    const effective = isDirty
                      ? (draftVal != null && !isNaN(draftVal) ? draftVal : row.catalogPriceHT)
                      : row.effectivePriceHT;
                    const hasCustom = isDirty ? (draft !== "") : (row.customPriceHT != null);

                    return (
                      <TableRow key={row.id} className={isDirty ? "bg-amber-50/40" : undefined}>
                        <TableCell className="font-medium text-sm">{row.name}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.category}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.unit ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.catalogPriceHT.toLocaleString("fr-FR")} FCFA
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            placeholder={String(row.catalogPriceHT)}
                            value={isDirty ? draft : (row.customPriceHT != null ? String(row.customPriceHT) : "")}
                            onChange={(e) => setDraftPrices((p) => ({ ...p, [row.id]: e.target.value }))}
                            className="h-7 text-right text-sm w-36 ml-auto font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          <span className={hasCustom ? "text-primary" : "text-muted-foreground"}>
                            {effective.toLocaleString("fr-FR")} FCFA
                          </span>
                          {hasCustom && (
                            <span className="ml-1 text-[10px] text-primary font-normal">(négocié)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(isDirty ? draft !== "" : row.customPriceHT != null) && (
                            <button
                              title="Réinitialiser au prix catalogue"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setDraftPrices((p) => ({ ...p, [row.id]: "" }))}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(addonPricing.data?.data ?? []).filter((r) => r.billingType === "credits").length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                        Aucun add-on à tarification variable disponible
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="px-4 py-3 border-t bg-muted/20 rounded-b-lg">
                <p className="text-[11px] text-muted-foreground">
                  La TVA de 18 % est calculée automatiquement sur le prix effectif. Laisser vide = prix catalogue.
                  Les add-ons <strong>Sur devis</strong> (Support, Formation, Intégration) ne sont pas configurables ici — le devis est géré manuellement.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "users" && (
        <OrgUsersTab orgId={id} orgName={org.name} />
      )}

      {tab === "tickets" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tickets de support</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tickets.isLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sujet</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Créé le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tickets.data?.rows ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun ticket</TableCell></TableRow>
                    ) : (tickets.data?.rows ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm font-medium max-w-[240px]"><p className="truncate">{t.subject}</p></TableCell>
                        <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded">{t.category}</span></TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${PRIORITY_CFG[t.priority] ?? ""}`}>{t.priority}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${TICKET_STATUS_CFG[t.status] ?? ""}`}>{t.status}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(t.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "access" && (
        <div className="space-y-6">
          {/* ── Section 1 : Liens d'onboarding (structureInvitations) ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Send className="w-4 h-4 text-primary" />
                    Liens d'onboarding tenant
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Liens de création/accès envoyés pour cette organisation — cycle de vie complet.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {org?.contactEmail && (
                    <Button
                      size="sm" variant="default"
                      onClick={() => handleGenerateLink(true)}
                      disabled={generatingLink}
                      title={`Générer et envoyer par email à ${org.contactEmail}`}
                    >
                      {generatingLink
                        ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        : <Mail className="w-3 h-3 mr-1" />}
                      Envoyer par email
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleGenerateLink(false)}
                    disabled={generatingLink}
                  >
                    {generatingLink
                      ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      : <Key className="w-3 h-3 mr-1" />}
                    Générer un lien
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {structInvs.isLoading ? (
                <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (structInvs.data?.invitations ?? []).length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Aucun lien d'onboarding pour cette organisation.<br />
                  <span className="text-xs">Cliquez sur « Générer un lien » pour créer un lien d'accès.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Créé le</TableHead>
                        <TableHead>Expire le</TableHead>
                        <TableHead>Activé le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(structInvs.data?.invitations ?? []).map((inv) => {
                        const isExpiredDate = inv.status === "pending" && new Date(inv.expiresAt) < new Date();
                        const displayStatus = isExpiredDate ? "expired" : inv.status;
                        return (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{inv.contactName ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{inv.contactEmail ?? "—"}</div>
                            </TableCell>
                            <TableCell>
                              {displayStatus === "accepted" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Utilisé</Badge>}
                              {displayStatus === "pending" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">En attente</Badge>}
                              {displayStatus === "expired" && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Expiré</Badge>}
                              {displayStatus === "revoked" && <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">Révoqué</Badge>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(inv.createdAt)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(inv.expiresAt)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{inv.acceptedAt ? fmtDate(inv.acceptedAt) : "—"}</TableCell>
                            <TableCell className="text-right">
                              {inv.status === "pending" && !isExpiredDate && (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm" variant="ghost"
                                    className="text-xs h-7 px-2"
                                    title="Copier le lien"
                                    onClick={() => {
                                      // onboardUrl est calculé côté serveur (baseUrl()/onboard-structure?token=...)
                                      navigator.clipboard.writeText(inv.onboardUrl).catch(() => {});
                                      toast.success("Lien copié");
                                    }}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm" variant="outline"
                                    className="text-xs h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                                    disabled={revokingLink === inv.id}
                                    onClick={() => handleRevokeLink(inv.id)}
                                  >
                                    {revokingLink === inv.id
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : "Révoquer"}
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 2 : Comptes utilisateurs & invitations d'accès ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Key className="w-4 h-4" />
                Comptes utilisateurs &amp; invitations d'accès
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Statut d'activation des comptes — régénérez ou renvoyez les liens d'activation.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {adminInvs.isLoading ? (
                <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Statut compte</TableHead>
                        <TableHead>Invité le</TableHead>
                        <TableHead>Activé le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(adminInvs.data?.users ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun utilisateur</TableCell>
                        </TableRow>
                      ) : (adminInvs.data?.users ?? []).map((u) => {
                        const isPending = !u.acceptedAt && u.hasToken;
                        const isExpired = !u.acceptedAt && u.expiresAt && new Date(u.expiresAt) < new Date();
                        const isActive = !!u.acceptedAt;
                        return (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-primary">{u.firstName[0]?.toUpperCase()}</span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
                                  <div className="text-xs text-muted-foreground">{u.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{u.role}</span>
                            </TableCell>
                            <TableCell>
                              {!u.isActive ? (
                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">Révoqué</Badge>
                              ) : isActive ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Activé</Badge>
                              ) : isExpired ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Expiré</Badge>
                              ) : isPending ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">En attente</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-400 border-gray-200 text-xs">Aucun lien</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {u.invitedAt ? fmtDate(u.invitedAt) : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {u.acceptedAt ? fmtDate(u.acceptedAt) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {!u.acceptedAt && u.isActive && (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm" variant="outline"
                                    disabled={regenerating === u.id}
                                    onClick={() => handleRegenerate(u.id, true)}
                                    className="text-xs h-7 px-2"
                                  >
                                    {regenerating === u.id
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <><RefreshCw className="w-3 h-3 mr-1" />Régénérer</>}
                                  </Button>
                                  <Button
                                    size="sm" variant="ghost"
                                    disabled={regenerating === u.id}
                                    onClick={() => handleRegenerate(u.id, false)}
                                    className="text-xs h-7 px-2"
                                    title="Copier le lien sans envoyer d'email"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "actions" && (
        <div className="space-y-4 max-w-xl">
          <Card className={org.isActive ? "border-red-200" : "border-emerald-200"}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {org.isActive ? <PowerOff className="w-4 h-4 text-red-500" /> : <Power className="w-4 h-4 text-emerald-500" />}
                {org.isActive ? "Suspendre l'organisation" : "Réactiver l'organisation"}
              </CardTitle>
              <CardDescription>
                {org.isActive
                  ? "Suspendre cette organisation bloquera l'accès à tous ses membres et mettra en pause son abonnement."
                  : "Réactiver cette organisation rétablira l'accès à tous ses membres."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {org.isDefault ? (
                <p className="text-sm text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  L'organisation par défaut ne peut pas être suspendue.
                </p>
              ) : (
                <Button
                  variant={org.isActive ? "destructive" : "default"}
                  onClick={() => setConfirming(true)}
                  className="gap-1.5"
                >
                  {org.isActive ? <><PowerOff className="w-4 h-4" />Suspendre</> : <><Power className="w-4 h-4" />Réactiver</>}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-red-300 bg-red-50/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                <Trash2 className="w-4 h-4" />
                Supprimer l'organisation
              </CardTitle>
              <CardDescription>
                Suppression définitive et irréversible de l'organisation et de toutes ses données (membres, abonnements, modules, tickets, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {org.isDefault ? (
                <p className="text-sm text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  L'organisation par défaut ne peut pas être supprimée.
                </p>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => { setDeleteInput(""); setDeleteConfirming(true); }}
                  className="gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer définitivement
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Informations techniques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">ID Organisation</span><span className="font-mono text-xs break-all">{org.id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Org par défaut</span><span>{org.isDefault ? "Oui" : "Non"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Créée le</span><span>{fmtDate(org.createdAt)}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Suspend/reactivate dialog */}
      <Dialog open={confirming} onOpenChange={(o) => { if (!o) setConfirming(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{org.isActive ? "Suspendre" : "Réactiver"} l'organisation</DialogTitle>
            <DialogDescription>
              {org.isActive
                ? `Suspendre "${org.name}" bloquera l'accès à tous ses membres.`
                : `Réactiver "${org.name}" rétablira l'accès à tous ses membres.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>Annuler</Button>
            <Button variant={org.isActive ? "destructive" : "default"} onClick={handleToggle} disabled={toggling}>
              {toggling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {org.isActive ? "Suspendre" : "Réactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteConfirming} onOpenChange={(o) => { if (!o) { setDeleteConfirming(false); setDeleteInput(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-4 h-4" />
              Supprimer l'organisation
            </DialogTitle>
            <DialogDescription>
              Cette action est <strong>irréversible</strong>. Toutes les données de <strong>{org.name}</strong> seront supprimées définitivement (membres, abonnement, modules, tickets, historique de facturation…).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Tapez <span className="font-mono font-semibold text-foreground">{org.name}</span> pour confirmer :
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={org.name}
              className="border-red-200 focus-visible:ring-red-400"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteConfirming(false); setDeleteInput(""); }}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteInput !== org.name}
              className="gap-1.5"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
