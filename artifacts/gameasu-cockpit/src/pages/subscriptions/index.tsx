import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CreditCard, Loader2, Search, X, TrendingUp, Users,
  CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw,
  Zap, CalendarClock, MessageSquare,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Sub = {
  id: string; orgId: string; orgName: string | null; orgSlug: string | null;
  planName: string | null; planCode: string | null;
  status: string; billingCycle: string;
  seats: number; unitPrice: number; currency: string;
  isCurrent: boolean;
  currentPeriodStart: string | null; currentPeriodEnd: string | null;
  trialEndsAt: string | null; autopayEnabled: boolean; createdAt: string;
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  active:          { label: "Actif",             cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  trial:           { label: "Essai",             cls: "bg-blue-100 text-blue-700 border-blue-200",           icon: Clock },
  past_due:        { label: "En retard",         cls: "bg-amber-100 text-amber-700 border-amber-200",        icon: AlertTriangle },
  canceled:        { label: "Annulé",            cls: "bg-red-100 text-red-700 border-red-200",              icon: XCircle },
  pending_payment: { label: "Paiement en cours", cls: "bg-orange-100 text-orange-700 border-orange-200",     icon: Clock },
};

const PERIOD_LABELS: Record<string, string> = {
  monthly: "Mensuel", quarterly: "Trimestriel",
  semiannual: "Semestriel", annual: "Annuel",
};

const PLAN_COLORS: Record<string, string> = {
  starter:      "bg-gray-100 text-gray-700",
  business:     "bg-blue-100 text-blue-700",
  premium:      "bg-purple-100 text-purple-700",
  enterprise:   "bg-amber-100 text-amber-700",
  growth:       "bg-blue-100 text-blue-700",
  professional: "bg-purple-100 text-purple-700",
};

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateNotes, setActivateNotes] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cockpit-subscriptions"],
    queryFn: () => apiFetch<{ count: number; totalMrr: number; rows: Sub[] }>("/api/super-admin/subscriptions"),
    refetchInterval: 60_000,
  });

  const activateMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiFetch(`/api/super-admin/subscriptions/${id}/activate-manually`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      toast({ title: "Compte activé !", description: "L'abonnement est maintenant actif et les modules sont disponibles." });
      qc.invalidateQueries({ queryKey: ["cockpit-subscriptions"] });
      setActivatingId(null);
      setActivateNotes("");
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e?.message ?? "Activation impossible." }),
  });

  const rows = (data?.rows ?? []).filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.orgName ?? "").toLowerCase().includes(q) || (r.planName ?? "").toLowerCase().includes(q);
  });

  const active         = (data?.rows ?? []).filter(r => r.status === "active" && r.isCurrent);
  const trials         = (data?.rows ?? []).filter(r => r.status === "trial" && r.isCurrent);
  const pastDue        = (data?.rows ?? []).filter(r => r.status === "past_due" && r.isCurrent);
  const pendingPayment = (data?.rows ?? []).filter(r => r.status === "pending_payment" && r.isCurrent);

  const subToActivate = pendingPayment.find(s => s.id === activatingId);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Abonnements</h1>
          <p className="page-subtitle">Tous les abonnements des organisations sur la plateforme Gaméasù</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* ── Section Prospects en attente de paiement ─────────────────────── */}
      {pendingPayment.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
              {pendingPayment.length}
            </span>
            <h2 className="text-[15px] font-semibold text-foreground">Prospects en attente de paiement</h2>
            <span className="text-[11px] text-muted-foreground">— Ces comptes ont créé leur espace mais n'ont pas encore payé.</span>
          </div>
          <div className="grid gap-3">
            {pendingPayment.map(sub => {
              const totalTTC = sub.unitPrice * sub.seats;
              const planKey = (sub.planCode ?? "").toLowerCase();
              return (
                <Card key={sub.id} className="border-orange-200 bg-orange-50/40">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Info organisation */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-[14px] text-foreground truncate">
                            {sub.orgName ?? sub.orgSlug ?? sub.orgId}
                          </span>
                          <Badge className={`text-xs shrink-0 ${PLAN_COLORS[planKey] ?? "bg-gray-100 text-gray-700"}`}>
                            {sub.planName ?? sub.planCode ?? "—"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-[12px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {sub.seats} siège{sub.seats > 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {PERIOD_LABELS[sub.billingCycle] ?? sub.billingCycle}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Inscrit {fmtRelative(sub.createdAt)}
                          </span>
                        </div>
                      </div>
                      {/* Montant attendu */}
                      <div className="text-right shrink-0">
                        <p className="text-[18px] font-extrabold text-orange-700 tabular-nums">{fmtFCFA(totalTTC)}</p>
                        <p className="text-[11px] text-muted-foreground">TTC attendu</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/tenants/${sub.orgId}`}>
                          <Button variant="outline" size="sm" className="text-xs h-8">
                            Voir le compte
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className="text-xs h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => setActivatingId(sub.id)}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Activer
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="stat-value text-xl">{fmtFCFA(data?.totalMrr ?? 0)}</p>
                <p className="stat-label">MRR actuel</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="stat-value text-2xl">{active.length}</p>
                <p className="stat-label">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="stat-value text-2xl">{trials.length}</p>
                <p className="stat-label">En essai</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="stat-value text-2xl">{pastDue.length}</p>
                <p className="stat-label">En retard</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="stat-value text-2xl">{pendingPayment.length}</p>
                <p className="stat-label">En attente paiement</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher organisation ou plan…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { v: "all", label: "Tous" },
            { v: "active", label: "Actifs" },
            { v: "trial", label: "Essai" },
            { v: "past_due", label: "En retard" },
            { v: "canceled", label: "Annulés" },
            { v: "pending_payment", label: "En attente paiement" },
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setStatusFilter(f.v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === f.v
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/70 text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="premium-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun abonnement trouvé</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Organisation</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Facturation</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Montant / mois</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Fin de période</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(sub => {
                    const statusCfg = STATUS_CFG[sub.status] ?? STATUS_CFG.canceled;
                    const StatusIcon = statusCfg.icon;
                    const mrr = sub.billingCycle === "annual"
                      ? Math.round(sub.unitPrice * sub.seats / 12)
                      : sub.unitPrice * sub.seats;
                    const planKey = (sub.planCode ?? "").toLowerCase();

                    return (
                      <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{sub.orgName ?? sub.orgSlug ?? sub.orgId}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" /> {sub.seats} siège{sub.seats !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge className={`text-xs ${PLAN_COLORS[planKey] ?? "bg-gray-100 text-gray-700"}`}>
                            {sub.planName ?? sub.planCode ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.cls}`}>
                            <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs capitalize">
                          {PERIOD_LABELS[sub.billingCycle] ?? sub.billingCycle}
                          {sub.autopayEnabled && (
                            <span className="ml-1 text-emerald-600 font-medium">· Autopay</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-right font-semibold tabular-nums">
                          {fmtFCFA(mrr)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                          {sub.trialEndsAt ? (
                            <span className="text-blue-600 font-medium">Essai jusqu'au {fmtDate(sub.trialEndsAt)}</span>
                          ) : fmtDate(sub.currentPeriodEnd)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {sub.status === "pending_payment" && (
                              <Button
                                variant="ghost" size="sm"
                                className="text-xs h-7 px-2 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => setActivatingId(sub.id)}
                              >
                                <Zap className="w-3 h-3 mr-1" /> Activer
                              </Button>
                            )}
                            <Link href={`/tenants/${sub.orgId}`}>
                              <Button variant="ghost" size="sm" className="text-xs h-7 px-2">Voir</Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog activation manuelle ────────────────────────────────────── */}
      <Dialog open={!!activatingId} onOpenChange={(o) => { if (!o) { setActivatingId(null); setActivateNotes(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              Activer manuellement
            </DialogTitle>
          </DialogHeader>
          {subToActivate && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Organisation : </span><strong>{subToActivate.orgName}</strong></p>
                <p><span className="text-muted-foreground">Plan : </span><strong>{subToActivate.planName ?? subToActivate.planCode}</strong> · {subToActivate.seats} siège{subToActivate.seats > 1 ? "s" : ""}</p>
                <p><span className="text-muted-foreground">Montant attendu : </span><strong className="text-emerald-700">{fmtFCFA(subToActivate.unitPrice * subToActivate.seats)}</strong></p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  Note interne (optionnel)
                </label>
                <Textarea
                  placeholder="Ex. : Virement reçu le 06/07/2026, référence VIR-2025-001…"
                  value={activateNotes}
                  onChange={e => setActivateNotes(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Cette action active immédiatement l'abonnement et déverrouille les modules du plan. Elle est irréversible depuis cette interface.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActivatingId(null); setActivateNotes(""); }}>
              Annuler
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              disabled={activateMutation.isPending}
              onClick={() => activatingId && activateMutation.mutate({ id: activatingId, notes: activateNotes })}
            >
              {activateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Activation…</> : <><Zap className="w-4 h-4" />Confirmer l'activation</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
