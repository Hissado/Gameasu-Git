import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Building2, Users, TrendingUp, CreditCard, AlertTriangle,
  Ticket, CheckCircle2, Activity, XCircle, ArrowUpRight, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area,
} from "recharts";

type Overview = {
  totalOrgs: number; activeOrgs: number; totalUsers: number;
  activeSubscriptions: number; mrrFcfa: number; arrFcfa: number;
  paidLast30Days: number; failedPayments: number; pendingPayments: number;
  openTickets: number; criticalTickets: number;
  byPlan: Record<string, { count: number; seats: number; mrr: number }>;
};

type Health = {
  status: "healthy" | "warning" | "degraded";
  openTickets: number; openIncidents: number; criticalIncidents: number;
  auditLast24h: number; uptime: number; memoryMb: number;
};

type RevenueData = {
  monthlyRevenue: { month: string; revenue: number; paid_count: number; failed_count: number }[];
};

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}
function fmtFCFACompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString("fr-FR", { month: "short" });
}

const STATUS_CFG = {
  healthy:  { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Opérationnel" },
  warning:  { cls: "bg-amber-50 text-amber-700 border-amber-200",       label: "Attention" },
  degraded: { cls: "bg-red-50 text-red-700 border-red-200",             label: "Dégradé" },
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: "#6366f1", GROWTH: "#8b5cf6", PROFESSIONAL: "#a855f7",
  ENTERPRISE: "#ec4899", UNKNOWN: "#94a3b8",
};

export default function DashboardPage() {
  const overview = useQuery<Overview>({
    queryKey: ["cockpit-overview"],
    queryFn: () => apiFetch("/api/super-admin/overview"),
    refetchInterval: 60_000,
  });
  const health = useQuery<Health>({
    queryKey: ["cockpit-health"],
    queryFn: () => apiFetch("/api/super-admin/health"),
    refetchInterval: 30_000,
  });
  const revenue = useQuery<RevenueData>({
    queryKey: ["cockpit-revenue"],
    queryFn: () => apiFetch("/api/super-admin/revenue"),
    refetchInterval: 120_000,
  });

  const ov = overview.data;
  const he = health.data;

  const planChart = ov
    ? Object.entries(ov.byPlan).map(([code, d]) => ({
        name: code, organisations: d.count, mrr: d.mrr,
        color: PLAN_COLORS[code] ?? "#6366f1",
      }))
    : [];

  const monthChart = (revenue.data?.monthlyRevenue ?? []).map((m) => ({
    ...m, label: fmtMonth(m.month), revenue: Number(m.revenue),
  }));

  // Alertes
  const alerts: { label: string; cls: string; icon: typeof AlertTriangle }[] = [];
  if (ov?.failedPayments && ov.failedPayments > 0)
    alerts.push({ label: `${ov.failedPayments} paiement${ov.failedPayments > 1 ? "s" : ""} échoué${ov.failedPayments > 1 ? "s" : ""}`, cls: "bg-red-50 border-red-200 text-red-700", icon: XCircle });
  if (ov?.pendingPayments && ov.pendingPayments > 0)
    alerts.push({ label: `${ov.pendingPayments} paiement${ov.pendingPayments > 1 ? "s" : ""} en attente`, cls: "bg-amber-50 border-amber-200 text-amber-700", icon: Clock });
  if (ov?.criticalTickets && ov.criticalTickets > 0)
    alerts.push({ label: `${ov.criticalTickets} ticket${ov.criticalTickets > 1 ? "s" : ""} critique${ov.criticalTickets > 1 ? "s" : ""} ouvert${ov.criticalTickets > 1 ? "s" : ""}`, cls: "bg-red-50 border-red-200 text-red-700", icon: AlertTriangle });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord plateforme</h1>
        {he && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={STATUS_CFG[he.status].cls}>
              {he.status === "healthy" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
              {STATUS_CFG[he.status].label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Uptime {Math.floor(he.uptime / 3600)}h {Math.floor((he.uptime % 3600) / 60)}m · {he.memoryMb} Mo
            </span>
          </div>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${a.cls}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {a.label}
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Building2,  label: "Organisations",  value: ov ? `${ov.activeOrgs} / ${ov.totalOrgs}` : "…", sub: "actives / total",         color: "text-indigo-600" },
          { icon: Users,      label: "Utilisateurs",   value: ov ? fmtFCFACompact(ov.totalUsers) : "…",        sub: "sur toutes les orgs",      color: "text-violet-600" },
          { icon: CreditCard, label: "MRR",            value: ov ? fmtFCFA(ov.mrrFcfa) : "…",                  sub: `ARR ${ov ? fmtFCFACompact(ov.arrFcfa) : "…"}`, color: "text-primary" },
          { icon: TrendingUp, label: "Encaissé 30j",   value: ov ? fmtFCFA(ov.paidLast30Days) : "…",           sub: "paiements reçus",          color: "text-emerald-600" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{kpi.label}</p>
                    {overview.isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mt-2 text-muted-foreground" />
                    ) : (
                      <>
                        <p className={`text-xl font-bold mt-1 truncate ${kpi.color}`}>{kpi.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{kpi.sub}</p>
                      </>
                    )}
                  </div>
                  <Icon className={`w-5 h-5 ${kpi.color} opacity-70 mt-0.5 shrink-0`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue trend + Ops */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ops */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Opérations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : he && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" />Tickets ouverts</span>
                  <Badge variant="outline" className={he.openTickets > 0 ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>{he.openTickets}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Incidents actifs</span>
                  <Badge variant="outline" className={he.openIncidents > 0 ? "border-red-300 text-red-700" : "border-emerald-300 text-emerald-700"}>{he.openIncidents}</Badge>
                </div>
                {ov && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-red-500" />Paiements échoués</span>
                      <Badge variant="outline" className={ov.failedPayments > 0 ? "border-red-300 text-red-700" : "border-emerald-300 text-emerald-700"}>{ov.failedPayments}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" />Paiements en attente</span>
                      <Badge variant="outline" className={ov.pendingPayments > 0 ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>{ov.pendingPayments}</Badge>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Abonnements actifs</span>
                  <span className="font-medium">{ov?.activeSubscriptions ?? "…"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Revenue trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-primary" />
              Revenus des 12 derniers mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenue.isLoading ? (
              <div className="flex items-center justify-center h-44"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : monthChart.length === 0 ? (
              <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={monthChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="rvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtFCFACompact} width={55} />
                  <Tooltip formatter={(val: number) => [fmtFCFA(val), "Revenus"]} labelStyle={{ fontWeight: 600, fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fill="url(#rvGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Répartition par plan</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.isLoading ? (
            <div className="flex items-center justify-center h-44"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : planChart.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">Aucun abonnement actif</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={planChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    name === "mrr" ? fmtFCFA(val) : val,
                    name === "mrr" ? "MRR" : "Organisations",
                  ]}
                />
                <Bar dataKey="organisations" radius={[4, 4, 0, 0]}>
                  {planChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
