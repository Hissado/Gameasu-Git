import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CreditCard, Loader2, Search, X, TrendingUp, Users,
  CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw,
} from "lucide-react";

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
  active:   { label: "Actif",      cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  trial:    { label: "Essai",      cls: "bg-blue-100 text-blue-700 border-blue-200",           icon: Clock },
  past_due: { label: "En retard",  cls: "bg-amber-100 text-amber-700 border-amber-200",        icon: AlertTriangle },
  canceled: { label: "Annulé",     cls: "bg-red-100 text-red-700 border-red-200",              icon: XCircle },
};

const PLAN_COLORS: Record<string, string> = {
  // Plans actuels
  starter:    "bg-gray-100 text-gray-700",
  business:   "bg-blue-100 text-blue-700",
  premium:    "bg-purple-100 text-purple-700",
  enterprise: "bg-amber-100 text-amber-700",
  // Alias anciens codes (rétrocompatibilité)
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

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cockpit-subscriptions"],
    queryFn: () => apiFetch<{ count: number; totalMrr: number; rows: Sub[] }>("/api/super-admin/subscriptions"),
    refetchInterval: 60_000,
  });

  const rows = (data?.rows ?? []).filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.orgName ?? "").toLowerCase().includes(q) || (r.planName ?? "").toLowerCase().includes(q);
  });

  const active = (data?.rows ?? []).filter(r => r.status === "active" && r.isCurrent);
  const trials = (data?.rows ?? []).filter(r => r.status === "trial" && r.isCurrent);
  const pastDue = (data?.rows ?? []).filter(r => r.status === "past_due" && r.isCurrent);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Abonnements</h1>
          <p className="page-subtitle">Tous les abonnements des organisations sur la plateforme Gameasu</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
        <div className="flex gap-1.5">
          {[
            { v: "all", label: "Tous" },
            { v: "active", label: "Actifs" },
            { v: "trial", label: "Essai" },
            { v: "past_due", label: "En retard" },
            { v: "canceled", label: "Annulés" },
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
                          {sub.billingCycle === "annual" ? "Annuel" : "Mensuel"}
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
                          <Link href={`/tenants/${sub.orgId}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7 px-2">Voir</Button>
                          </Link>
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
    </div>
  );
}
