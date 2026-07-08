/**
 * Phase 9 — Finance IA : cockpit cash-flow, anomalies, scoring relance.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { Loader2, TrendingUp, AlertTriangle, Flame, Receipt, Clock } from "lucide-react";
import { Link } from "wouter";
import { severityLabel } from "@/lib/intelligence";

type Overview = {
  openCount: number; overdueCount: number;
  totalOutstanding: number; totalOverdue: number;
  dso: number; ca90: number;
  buckets: { current: number; b1_30: number; b31_60: number; b61_90: number; b90plus: number };
  topOverdue: Array<{ id: string; ref: string; clientName: string | null; outstanding: number; daysOverdue: number }>;
};
type Forecast = {
  horizonDays: number; totalExpected: number; totalWeighted: number;
  beyondHorizon: number; beyondHorizonWeighted: number;
  series: Array<{ date: string; expected: number; weighted: number; cumulative: number; cumulativeWeighted: number }>;
};
type Anomalies = {
  stats: { medianAmount: number; stddev: number; upperThreshold: number };
  count: number;
  anomalies: Array<{
    invoiceId: string; reference: string; clientName: string | null;
    type: string; severity: "low" | "medium" | "high"; message: string; amount: number;
  }>;
};
type Collections = {
  count: number; totalOutstanding: number;
  ranked: Array<{
    invoiceId: string; reference: string; clientId: string | null; clientName: string | null;
    outstanding: number; daysOverdue: number; dueDate: string | null;
    score: number; tier: "critical" | "high" | "medium" | "low";
    factors: { overdue: number; amount: number; age: number; history: number };
    clientHistory: { meanDelayDays: number; samples: number } | null;
  }>;
};

const SEV: Record<string, string> = {
  low: "bg-blue-50 text-blue-700 border-blue-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
};
const TIER: Record<string, { cls: string; label: string }> = {
  critical: { cls: "bg-red-50 text-red-700 border-red-200", label: "Critique" },
  high: { cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Élevé" },
  medium: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Moyen" },
  low: { cls: "bg-blue-50 text-blue-700 border-blue-200", label: "Faible" },
};
const TYPE_LABEL: Record<string, string> = {
  amount_outlier: "Montant atypique",
  long_overdue: "Retard chronique",
  no_due_date: "Échéance manquante",
  partial_stuck: "Paiement partiel bloqué",
};

export default function FinanceIntelligencePage() {
  const [horizon, setHorizon] = useState(30);

  const overview = useQuery<Overview>({ queryKey: ["fin-int-overview"], queryFn: () => apiFetch("/api/finance/intelligence/overview") });
  const forecast = useQuery<Forecast>({ queryKey: ["fin-int-forecast", horizon], queryFn: () => apiFetch(`/api/finance/intelligence/cashflow-forecast?days=${horizon}`) });
  const anomalies = useQuery<Anomalies>({ queryKey: ["fin-int-anomalies"], queryFn: () => apiFetch("/api/finance/intelligence/anomalies") });
  const collections = useQuery<Collections>({ queryKey: ["fin-int-collections"], queryFn: () => apiFetch("/api/finance/intelligence/collections") });

  if (overview.isLoading || !overview.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const ov = overview.data;

  const aging = [
    { name: "À échoir", value: ov.buckets.current, color: "#10b981" },
    { name: "1-30 j", value: ov.buckets.b1_30, color: "#f59e0b" },
    { name: "31-60 j", value: ov.buckets.b31_60, color: "#f97316" },
    { name: "61-90 j", value: ov.buckets.b61_90, color: "#ef4444" },
    { name: ">90 j", value: ov.buckets.b90plus, color: "#7f1d1d" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Finance IA</p>
        <h1 className="text-3xl font-bold tracking-tight">Pilotage financier intelligent</h1>
        <p className="text-muted-foreground mt-1">Prévision de trésorerie, anomalies factures, priorisation du recouvrement.</p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold truncate">Encours</p><p className="text-base sm:text-2xl font-bold leading-tight break-words">{formatFCFACompact(ov.totalOutstanding)}</p><p className="text-[10px] text-muted-foreground mt-1">{ov.openCount} facture(s) ouverte(s)</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold truncate">En retard</p><p className="text-base sm:text-2xl font-bold text-red-600 leading-tight break-words">{formatFCFACompact(ov.totalOverdue)}</p><p className="text-[10px] text-muted-foreground mt-1">{ov.overdueCount} facture(s)</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold truncate">DSO (90 j)</p><p className="text-base sm:text-2xl font-bold leading-tight">{ov.dso} <span className="text-sm text-muted-foreground">jours</span></p><p className="text-[10px] text-muted-foreground mt-1">CA 90 j : {formatFCFACompact(ov.ca90)}</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold truncate">Prévu sur {horizon} j</p><p className="text-base sm:text-2xl font-bold text-primary leading-tight break-words">{forecast.data ? formatFCFACompact(forecast.data.totalExpected) : "…"}</p><p className="text-[10px] text-muted-foreground mt-1">Pondéré : {forecast.data ? formatFCFACompact(forecast.data.totalWeighted) : "…"}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="forecast" className="w-full">
        <TabsList>
          <TabsTrigger value="forecast"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />Prévision trésorerie</TabsTrigger>
          <TabsTrigger value="aging"><Clock className="w-3.5 h-3.5 mr-1.5" />Aging</TabsTrigger>
          <TabsTrigger value="anomalies"><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Anomalies ({anomalies.data?.count ?? 0})</TabsTrigger>
          <TabsTrigger value="collections"><Flame className="w-3.5 h-3.5 mr-1.5" />Relances ({collections.data?.count ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="forecast" className="space-y-3">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Horizon :</span>
            {[30, 60, 90].map((d) => (
              <Button key={d} size="sm" variant={horizon === d ? "default" : "outline"} onClick={() => setHorizon(d)}>{d} jours</Button>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Encaissements attendus (cumulé)</CardTitle></CardHeader>
            <CardContent>
              {forecast.isLoading || !forecast.data ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-8" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={forecast.data.series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: any) => formatFCFA(Number(v))} />
                    <Line type="monotone" dataKey="cumulative" stroke="#2563EB" strokeWidth={2} name="Théorique" dot={false} />
                    <Line type="monotone" dataKey="cumulativeWeighted" stroke="#10b981" strokeWidth={2} name="Pondéré" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {forecast.data && forecast.data.beyondHorizon > 0 && (
                <p className="text-xs text-muted-foreground mt-2">+ {formatFCFA(forecast.data.beyondHorizon)} attendu au-delà de l'horizon (pondéré {formatFCFA(forecast.data.beyondHorizonWeighted)}).</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aging" className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Répartition par âge des créances</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={aging}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => formatFCFA(Number(v))} />
                  <Bar dataKey="value">
                    {aging.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Top 5 retards</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ov.topOverdue.length === 0 && <p className="text-xs italic text-muted-foreground">Aucune facture en retard.</p>}
              {ov.topOverdue.map((i) => (
                <Link key={i.id} href="/factures">
                  <div className="flex items-center justify-between border rounded p-2 hover:bg-muted/40 cursor-pointer">
                    <div>
                      <p className="font-medium text-sm">{i.ref}</p>
                      <p className="text-xs text-muted-foreground">{i.clientName ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{formatFCFA(i.outstanding)}</p>
                      <Badge variant="outline" className="text-[10px]">{i.daysOverdue} j de retard</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" />Anomalies détectées</CardTitle>
              {anomalies.data && (
                <p className="text-[11px] text-muted-foreground">Seuil outlier montant : &gt; {formatFCFA(anomalies.data.stats.upperThreshold)} (médiane {formatFCFA(anomalies.data.stats.medianAmount)} + 3σ)</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {anomalies.isLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" />}
              {anomalies.data?.anomalies.length === 0 && <p className="text-xs italic text-muted-foreground">Aucune anomalie détectée.</p>}
              {anomalies.data?.anomalies.map((a, i) => (
                <Link key={`${a.invoiceId}-${a.type}-${i}`} href="/factures">
                  <div className="border rounded p-2.5 hover:bg-muted/40 cursor-pointer space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={SEV[a.severity]}>{severityLabel(a.severity)}</Badge>
                        <Badge variant="outline">{TYPE_LABEL[a.type] ?? a.type}</Badge>
                        <span className="text-sm font-medium">{a.reference}</span>
                        <span className="text-xs text-muted-foreground">{a.clientName ?? "—"}</span>
                      </div>
                      <span className="text-sm font-bold">{formatFCFA(a.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.message}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Flame className="w-4 h-4 text-orange-600" />Relances prioritaires</CardTitle>
              {collections.data && (
                <p className="text-[11px] text-muted-foreground">{collections.data.count} facture(s) à relancer · encours total {formatFCFA(collections.data.totalOutstanding)}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {collections.isLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto my-4" />}
              {collections.data?.ranked.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun impayé à relancer.</p>}
              {collections.data?.ranked.slice(0, 10).map((r, i) => {
                const t = TIER[r.tier];
                return (
                  <Link key={r.invoiceId} href="/factures">
                    <div className="border rounded p-3 hover:bg-muted/40 cursor-pointer">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                          <Badge variant="outline" className={t.cls}>{t.label}</Badge>
                          <span className="font-medium text-sm">{r.reference}</span>
                          <span className="text-xs text-muted-foreground">{r.clientName ?? "—"}</span>
                          {r.daysOverdue > 0 && <Badge variant="outline" className="text-[10px]">{r.daysOverdue} j retard</Badge>}
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatFCFA(r.outstanding)}</p>
                          <p className="text-xs text-primary font-bold">Score {r.score}/100</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        {(["overdue", "amount", "age", "history"] as const).map((k) => (
                          <div key={k}>
                            <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{r.factors[k]}</span></div>
                            <div className="h-1 bg-muted rounded mt-0.5"><div className="h-full bg-primary rounded" style={{ width: `${(r.factors[k] / { overdue: 40, amount: 35, age: 15, history: 10 }[k]) * 100}%` }} /></div>
                          </div>
                        ))}
                      </div>
                      {r.clientHistory && (
                        <p className="text-[10px] text-muted-foreground mt-1.5"><Receipt className="w-2.5 h-2.5 inline mr-1" />Délai moyen client : {r.clientHistory.meanDelayDays} j (sur {r.clientHistory.samples} paiements)</p>
                      )}
                    </div>
                  </Link>
                );
              })}
              {(collections.data?.count ?? 0) > 10 && (
                <div className="pt-2 border-t">
                  <Link href="/recouvrement">
                    <Button variant="outline" size="sm" className="w-full gap-2 text-primary border-primary/30 hover:bg-primary/5">
                      <Flame className="w-3.5 h-3.5" />
                      Voir le tableau de recouvrement complet ({collections.data!.count} factures)
                    </Button>
                  </Link>
                </div>
              )}
              {collections.data?.ranked && collections.data.ranked.length > 0 && collections.data.count <= 10 && (
                <div className="pt-2 border-t">
                  <Link href="/recouvrement">
                    <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-primary">
                      Ouvrir le module Recouvrement →
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
