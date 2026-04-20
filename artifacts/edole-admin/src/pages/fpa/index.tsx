import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, FolderKanban,
  Network, FileSpreadsheet, Plus, Activity, Target, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";

interface FiscalPeriod { id: string; name: string; startDate: string; endDate: string; status: string; }
interface SummaryResponse {
  fiscalPeriod: FiscalPeriod;
  companyBudget: any;
  totals: { budget: number; actual: number; variance: number; executionPct: number };
  monthly: Array<{ period: string; budget: number; actual: number }>;
  topVariances: Array<{ accountCode: string; accountLabel: string; variance: number; variancePct: number }>;
  scopeCounts: Array<{ scope: string; kind: string; count: number }>;
}

const SCOPE_LABELS: Record<string, string> = {
  company: "Entreprise",
  project: "Projet",
  department: "Département",
  service: "Service",
  activity: "Activité",
};

export default function FpaDashboardPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ data: FiscalPeriod[] }>("/api/accounting/fiscal-periods").then((r) => {
      setPeriods(r.data);
      const open = r.data.find((p) => p.status === "open") || r.data[0];
      if (open) setPeriodId(open.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!periodId) return;
    setLoading(true);
    apiFetch<SummaryResponse>(`/api/fpa/summary?fiscalPeriodId=${periodId}`)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [periodId]);

  const totalBudgets = useMemo(
    () => summary?.scopeCounts.reduce((s, sc) => s + sc.count, 0) || 0,
    [summary],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Pilotage financier (FP&A)</h1>
          <p className="text-muted-foreground mt-1">Budget, prévisions et analyse de performance.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Sélectionner une période" /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} {p.status === "closed" && "(clôturée)"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/fpa/budgets">
            <Button variant="outline"><BarChart3 className="w-4 h-4 mr-2" />Budgets</Button>
          </Link>
          <Link href="/fpa/variance">
            <Button variant="outline"><Activity className="w-4 h-4 mr-2" />Variance</Button>
          </Link>
          <Link href="/fpa/forecast">
            <Button variant="outline"><Target className="w-4 h-4 mr-2" />Forecast</Button>
          </Link>
          <Link href="/fpa/reports">
            <Button><FileSpreadsheet className="w-4 h-4 mr-2" />Exports</Button>
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {!loading && summary && !summary.companyBudget && (
        <Card className="p-6 border-orange-200 bg-orange-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-orange-900">Aucun budget entreprise actif</h3>
              <p className="text-sm text-orange-800 mt-1">
                Créez un budget annuel d'entreprise pour activer le pilotage et les analyses.
              </p>
              <Link href="/fpa/budgets">
                <Button size="sm" className="mt-3"><Plus className="w-4 h-4 mr-2" />Créer un budget</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {!loading && summary && summary.companyBudget && (
        <>
          {/* KPIs */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Budget annuel" value={formatFCFA(summary.totals.budget)} icon={Target} accent="text-blue-600 bg-blue-50" />
            <KpiCard label="Réalisé" value={formatFCFA(summary.totals.actual)} icon={Activity} accent="text-emerald-600 bg-emerald-50" />
            <KpiCard
              label="Écart"
              value={formatFCFA(summary.totals.variance)}
              icon={summary.totals.variance >= 0 ? TrendingUp : TrendingDown}
              accent={summary.totals.variance > 0 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50"}
            />
            <KpiCard
              label="Exécution"
              value={`${summary.totals.executionPct.toFixed(1)} %`}
              icon={BarChart3}
              accent="text-violet-600 bg-violet-50"
            />
          </div>

          {/* Évolution mensuelle */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Évolution mensuelle — Budget vs Réalisé</h3>
              <Badge variant="outline">{summary.monthly.length} mois</Badge>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summary.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatFCFA(v)} />
                <Legend />
                <Line type="monotone" dataKey="budget" stroke="#3b82f6" name="Budget" strokeWidth={2} />
                <Line type="monotone" dataKey="actual" stroke="#10b981" name="Réalisé" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top écarts */}
            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold mb-4">Top écarts par compte</h3>
              {summary.topVariances.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun écart à afficher.</p>
              ) : (
                <div className="space-y-2">
                  {summary.topVariances.map((v) => (
                    <div key={v.accountCode} className="flex items-center justify-between p-2 rounded hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.accountCode} — {v.accountLabel}</p>
                        <p className="text-xs text-muted-foreground">{v.variancePct.toFixed(1)} % d'écart</p>
                      </div>
                      <span className={`text-sm font-semibold ${v.variance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        {v.variance > 0 ? "+" : ""}{formatFCFA(v.variance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Décompte budgets */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Budgets en place ({totalBudgets})</h3>
                <Link href="/fpa/budgets">
                  <Button variant="ghost" size="sm">Voir tous <ArrowRight className="w-4 h-4 ml-1" /></Button>
                </Link>
              </div>
              <div className="space-y-2">
                {summary.scopeCounts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      {sc.scope === "project" && <FolderKanban className="w-4 h-4 text-muted-foreground" />}
                      {sc.scope === "department" && <Network className="w-4 h-4 text-muted-foreground" />}
                      {sc.scope === "company" && <BarChart3 className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-medium">{SCOPE_LABELS[sc.scope] || sc.scope}</span>
                      <Badge variant="secondary" className="text-xs">{sc.kind === "forecast" ? "Forecast" : "Budget"}</Badge>
                    </div>
                    <span className="font-semibold text-sm">{sc.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg sm:text-xl font-bold mt-1 truncate">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${accent} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}
