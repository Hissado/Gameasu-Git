import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, TrendingUp, Building2, Users, CreditCard, Calendar, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

type RevenueData = {
  totalMrr: number;
  arrFcfa: number;
  arpu: number;
  activeOrgs: number;
  byOrg: { orgId: string; orgName: string; planCode: string; seats: number; mrr: number; status: string }[];
  monthlyRevenue: { month: string; revenue: number; paid_count: number; failed_count: number }[];
  forecast: { period: string; amount: number }[];
};

const PLAN_COLOR: Record<string, string> = {
  STARTER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  GROWTH: "bg-violet-50 text-violet-700 border-violet-200",
  PROFESSIONAL: "bg-purple-50 text-purple-700 border-purple-200",
  ENTERPRISE: "bg-pink-50 text-pink-700 border-pink-200",
};

const PLAN_CHART_COLORS: Record<string, string> = {
  STARTER: "#6366f1", GROWTH: "#8b5cf6", PROFESSIONAL: "#a855f7", ENTERPRISE: "#ec4899",
};

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}

function fmtFCFACompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M FCFA`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k FCFA`;
  return `${n} FCFA`;
}

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

export default function ReportsPage() {
  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ["cockpit-revenue"],
    queryFn: () => apiFetch("/api/super-admin/revenue"),
    refetchInterval: 120_000,
  });

  const monthChart = (data?.monthlyRevenue ?? []).map((m) => ({
    ...m,
    label: fmtMonth(m.month),
    revenue: Number(m.revenue),
  }));

  const lastMonth = monthChart[monthChart.length - 1];
  const prevMonth = monthChart[monthChart.length - 2];
  const revenueGrowth = lastMonth && prevMonth && prevMonth.revenue > 0
    ? Math.round(((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
        <h1 className="text-2xl font-bold tracking-tight">Rapports & Revenus</h1>
        <p className="text-sm text-muted-foreground mt-1">Analyse financière de la plateforme SaaS</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "MRR",
            value: isLoading ? "…" : fmtFCFACompact(data?.totalMrr ?? 0),
            sub: "Revenu mensuel récurrent",
            icon: TrendingUp, color: "text-primary",
            growth: revenueGrowth,
          },
          {
            label: "ARR",
            value: isLoading ? "…" : fmtFCFACompact(data?.arrFcfa ?? 0),
            sub: "Revenu annuel récurrent",
            icon: Calendar, color: "text-indigo-600",
          },
          {
            label: "ARPU",
            value: isLoading ? "…" : fmtFCFA(data?.arpu ?? 0),
            sub: "Par organisation / mois",
            icon: Building2, color: "text-violet-600",
          },
          {
            label: "Organisations actives",
            value: isLoading ? "…" : String(data?.activeOrgs ?? 0),
            sub: "Abonnements en cours",
            icon: Users, color: "text-emerald-600",
          },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{k.label}</p>
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mt-2 text-muted-foreground" />
                    ) : (
                      <>
                        <p className={`text-xl font-bold mt-1 truncate ${k.color}`}>{k.value}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[10px] text-muted-foreground">{k.sub}</p>
                          {k.growth !== null && k.growth !== undefined && (
                            <span className={`text-[10px] font-semibold flex items-center ${k.growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {k.growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {Math.abs(k.growth)}%
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <Icon className={`w-5 h-5 ${k.color} opacity-70 shrink-0 mt-0.5`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Revenus mensuels (12 derniers mois)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : monthChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">Aucune donnée de revenus</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtFCFACompact(v)} width={80} />
                <Tooltip
                  formatter={(val: number) => [fmtFCFA(val), "Revenus"]}
                  labelStyle={{ fontWeight: 600, fontSize: 12 }}
                />
                <Area
                  type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Forecast + MRR by org */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Forecast */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />Prévisions de revenus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (data?.forecast ?? []).map((f) => (
              <div key={f.period} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{f.period}</span>
                <span className="font-semibold text-sm">{fmtFCFACompact(f.amount)}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground border-t pt-2">
              Basé sur le MRR actuel. Projection linéaire sans churn ni expansion.
            </p>
          </CardContent>
        </Card>

        {/* Revenue by plan */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">MRR par plan</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-36"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (() => {
              const planMap: Record<string, number> = {};
              (data?.byOrg ?? []).forEach((o) => {
                planMap[o.planCode] = (planMap[o.planCode] ?? 0) + o.mrr;
              });
              const chartData = Object.entries(planMap).map(([plan, mrr]) => ({
                name: plan, mrr, color: PLAN_CHART_COLORS[plan] ?? "#94a3b8",
              }));
              return chartData.length === 0 ? (
                <div className="flex items-center justify-center h-36 text-sm text-muted-foreground">Aucun abonnement actif</div>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtFCFACompact(v)} width={80} />
                    <Tooltip formatter={(val: number) => [fmtFCFA(val), "MRR"]} />
                    <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by org table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            MRR par organisation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Sièges</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Part</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.byOrg ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun abonnement actif</TableCell></TableRow>
                  ) : (data?.byOrg ?? []).map((org, i) => {
                    const share = data?.totalMrr && data.totalMrr > 0 ? Math.round((org.mrr / data.totalMrr) * 100) : 0;
                    return (
                      <TableRow key={org.orgId}>
                        <TableCell className="text-muted-foreground text-sm w-8">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[180px]"><p className="truncate">{org.orgName}</p></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PLAN_COLOR[org.planCode] ?? ""}>{org.planCode}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{org.seats}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm whitespace-nowrap">{fmtFCFA(org.mrr)}</TableCell>
                        <TableCell className="text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5 hidden sm:block">
                              <div className="bg-primary h-1.5 rounded-full" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-muted-foreground text-xs w-8 text-right">{share}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={org.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                            {org.status === "active" ? "Active" : org.status}
                          </Badge>
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
  );
}
