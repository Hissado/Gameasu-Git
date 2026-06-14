import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Users, TrendingUp, CreditCard, AlertTriangle, Ticket, CheckCircle2, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Overview = {
  totalOrgs: number; activeOrgs: number; totalUsers: number;
  activeSubscriptions: number; mrrFcfa: number; arrFcfa: number;
  paidLast30Days: number;
  byPlan: Record<string, { count: number; seats: number; mrr: number }>;
};

type Health = {
  status: "healthy" | "warning" | "degraded";
  openTickets: number; openIncidents: number; criticalIncidents: number;
  auditLast24h: number; uptime: number; memoryMb: number;
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}

const STATUS_CFG = {
  healthy:  { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Opérationnel" },
  warning:  { cls: "bg-amber-50 text-amber-700 border-amber-200",    label: "Attention" },
  degraded: { cls: "bg-red-50 text-red-700 border-red-200",          label: "Dégradé" },
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

  const ov = overview.data;
  const he = health.data;

  const planChart = ov
    ? Object.entries(ov.byPlan).map(([code, d]) => ({
        name: code,
        organisations: d.count,
        mrr: d.mrr,
        color: PLAN_COLORS[code] ?? "#6366f1",
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord plateforme</h1>
        {he && (
          <div className="mt-2">
            <Badge variant="outline" className={STATUS_CFG[he.status].cls}>
              {he.status === "healthy" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
              {STATUS_CFG[he.status].label}
            </Badge>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Building2, label: "Organisations", value: ov ? `${ov.activeOrgs} / ${ov.totalOrgs}` : "…", sub: "actives / total", color: "text-indigo-600" },
          { icon: Users, label: "Utilisateurs", value: ov ? fmt(ov.totalUsers) : "…", sub: "sur toutes les orgs", color: "text-violet-600" },
          { icon: CreditCard, label: "MRR", value: ov ? fmtFCFA(ov.mrrFcfa) : "…", sub: `ARR ${ov ? fmtFCFA(ov.arrFcfa) : "…"}`, color: "text-emerald-600" },
          { icon: TrendingUp, label: "Encaissé 30j", value: ov ? fmtFCFA(ov.paidLast30Days) : "…", sub: "paiements reçus", color: "text-amber-600" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{kpi.label}</p>
                    {overview.isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mt-2 text-muted-foreground" />
                    ) : (
                      <>
                        <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>
                      </>
                    )}
                  </div>
                  <Icon className={`w-5 h-5 ${kpi.color} opacity-70 mt-0.5`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ops + Plan chart */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ops KPIs */}
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
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Actions audit (24h)</span>
                  <span className="font-medium">{he.auditLast24h}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Uptime API</span>
                  <span className="font-mono text-xs">{Math.floor(he.uptime / 3600)}h {Math.floor((he.uptime % 3600) / 60)}m</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mémoire serveur</span>
                  <span className="font-mono text-xs">{he.memoryMb} Mo</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Plan distribution chart */}
        <Card className="lg:col-span-2">
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
    </div>
  );
}
