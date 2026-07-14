import { useEffect, useState, useMemo } from "react";
import { useModuleTour, WelcomeModal, OnboardingTour } from "@/components/ui/onboarding-tour";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, FolderKanban,
  FileSpreadsheet, Plus, Activity, Target, ArrowRight, Wallet,
  CalendarRange, Sparkles, ChevronRight, PieChart as PieIcon, LineChart as LineIcon,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  Line, Area, AreaChart,
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
interface ByProjectResponse {
  fiscalPeriod: FiscalPeriod;
  rows: Array<{
    projectId: string; projectName: string; projectStatus: string;
    annualBudget: number; revenues: number; expenses: number; margin: number;
    budgetConsumptionPct: number; hasBudget: boolean;
  }>;
  totals: { annualBudget: number; revenues: number; expenses: number; margin: number };
}
interface YearEndResponse {
  totals: { annualBudget: number; ytdActual: number; projectedTotal: number; linearProjection: number };
  asOfDate: string; currentMonth: string;
}

const MONTH_LABELS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planned: "Planifié", in_progress: "En cours", on_hold: "En pause",
  completed: "Terminé", cancelled: "Annulé",
};

function fmtMonth(period: string) {
  const m = parseInt(period.slice(5, 7), 10);
  return MONTH_LABELS[m - 1] || period;
}

function fmtCompact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} Md`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)} k`;
  return String(v);
}

const FPA_TOUR = [
  { target: "fpa-hero", title: "Pilotage financier exécutif", description: "Vision consolidée : budget annuel, réalisé cumulé, projection d'atterrissage et marge brute de vos projets." },
  { target: "fpa-execution", title: "Exécution budgétaire", description: "La barre montre le taux de consommation du budget et la projection de dépassement ou d'économie à fin d'exercice." },
  { target: "fpa-chart", title: "Évolution mensuelle", description: "Comparez Budget vs Réalisé mois par mois et suivez les courbes cumulées pour anticiper les écarts en fin d'année." },
  { target: "fpa-nav", title: "Modules FP&A", description: "Explorez les budgets versionnés, l'analyse de variance SYSCOHADA, les prévisions et les exports Excel professionnels." },
];

export default function FpaDashboardPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const { showWelcome, tourActive, startTour, dismissWelcome, closeTour } = useModuleTour("fpa");
  const [periodId, setPeriodId] = useState<string>("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [byProject, setByProject] = useState<ByProjectResponse | null>(null);
  const [yearEnd, setYearEnd] = useState<YearEndResponse | null>(null);
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
    let cancelled = false;
    setLoading(true);
    setYearEnd(null);
    Promise.all([
      apiFetch<SummaryResponse>(`/api/fpa/summary?fiscalPeriodId=${periodId}`).catch(() => null),
      apiFetch<ByProjectResponse>(`/api/fpa/by-project?fiscalPeriodId=${periodId}`).catch(() => null),
    ])
      .then(async ([s, p]) => {
        if (cancelled) return;
        setSummary(s);
        setByProject(p);
        if (s?.companyBudget?.id) {
          const ye = await apiFetch<YearEndResponse>(
            `/api/fpa/year-end-projection?budgetId=${s.companyBudget.id}`,
          ).catch(() => null);
          if (!cancelled) setYearEnd(ye);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodId]);

  const period = summary?.fiscalPeriod;
  const totals = summary?.totals;
  const cumulative = useMemo(() => {
    if (!summary) return [];
    let bSum = 0, aSum = 0;
    return summary.monthly.map((m) => {
      bSum += m.budget; aSum += m.actual;
      return { period: fmtMonth(m.period), budget: m.budget, actual: m.actual, cumulBudget: bSum, cumulActual: aSum };
    });
  }, [summary]);

  const projectionAvailable = !!yearEnd;
  const projectedYearEnd = yearEnd?.totals.projectedTotal ?? null;
  const ytdActual = yearEnd?.totals.ytdActual ?? totals?.actual ?? 0;
  const annualBudget = totals?.budget ?? 0;
  const projectedVariance = projectedYearEnd !== null ? projectedYearEnd - annualBudget : null;
  const ytdPct = annualBudget > 0 ? (ytdActual / annualBudget) * 100 : 0;

  const topProjects = useMemo(
    () => (byProject?.rows ?? []).slice(0, 5),
    [byProject],
  );

  const totalRevenues = byProject?.totals.revenues ?? 0;
  const totalExpenses = byProject?.totals.expenses ?? 0;
  const grossMargin = totalRevenues - totalExpenses;
  const marginPct = totalRevenues > 0 ? (grossMargin / totalRevenues) * 100 : 0;

  return (
    <div className="space-y-6">
      {showWelcome && (
        <WelcomeModal
          title="Pilotage Financier (FP&A)"
          subtitle="Explorez le tableau de bord exécutif : budget, réalisé et projections."
          icon={BarChart3}
          steps={FPA_TOUR}
          onStart={startTour}
          onDismiss={dismissWelcome}
        />
      )}
      {tourActive && <OnboardingTour steps={FPA_TOUR} onClose={closeTour} />}
      {/* ─── Hero header ────────────────────────────────────────────── */}
      <div data-tour="fpa-hero" className="rounded-xl border bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 sm:p-7 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-amber-300/90 text-xs font-medium uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Pilotage financier
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">Tableau de bord exécutif</h1>
            <p className="text-slate-300 mt-1.5 text-sm">
              Vision consolidée du budget, du réalisé et des projections — {period?.name ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <CalendarRange className="w-4 h-4 text-amber-300" />
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="w-44 bg-transparent border-0 text-white hover:bg-white/5 h-7 px-2">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.status === "closed" && "· clôturée"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link href="/fpa/cashflow">
              <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20 border-0">
                <Wallet className="w-4 h-4 mr-1.5" />Trésorerie
              </Button>
            </Link>
            <Link href="/fpa/budgets">
              <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20 border-0">
                <BarChart3 className="w-4 h-4 mr-1.5" />Budgets
              </Button>
            </Link>
            <Link href="/fpa/forecast">
              <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20 border-0">
                <Target className="w-4 h-4 mr-1.5" />Prévisions
              </Button>
            </Link>
            <Link href="/fpa/reports">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />Exports
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI strip dans le hero */}
        {!loading && totals && summary?.companyBudget && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <HeroKpi
              label="Budget annuel"
              value={formatFCFACompact(annualBudget)}
              hint={summary.companyBudget?.name?.replace("[DÉMO] ", "") ?? "Budget actif"}
              icon={Target}
              accent="bg-blue-500/20 text-blue-200"
            />
            <HeroKpi
              label="Réalisé cumulé"
              value={formatFCFACompact(ytdActual)}
              hint={`${ytdPct.toFixed(1)} % du budget consommé`}
              icon={Activity}
              accent="bg-emerald-500/20 text-emerald-200"
            />
            {projectionAvailable && projectedVariance !== null ? (
              <HeroKpi
                label={projectedVariance >= 0 ? "Dépassement projeté" : "Économie projetée"}
                value={formatFCFACompact(Math.abs(projectedVariance))}
                hint={`Projection : ${fmtCompact(projectedYearEnd ?? 0)} FCFA`}
                icon={projectedVariance >= 0 ? TrendingUp : TrendingDown}
                accent={projectedVariance > 0 ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"}
              />
            ) : (
              <HeroKpi
                label="Projection fin d'exercice"
                value="N/D"
                hint="Données indisponibles"
                icon={TrendingUp}
                accent="bg-slate-500/20 text-slate-300"
              />
            )}
            <HeroKpi
              label="Marge brute"
              value={formatFCFACompact(grossMargin)}
              hint={`${marginPct.toFixed(1)} % du CA · ${byProject?.rows.length ?? 0} projets`}
              icon={Wallet}
              accent={grossMargin >= 0 ? "bg-violet-500/20 text-violet-200" : "bg-rose-500/20 text-rose-200"}
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Chargement des indicateurs…
        </div>
      )}

      {!loading && summary && !summary.companyBudget && (
        <Card className="p-6 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900">Aucun budget entreprise actif</h3>
              <p className="text-sm text-amber-800 mt-1">
                Créez un budget annuel d'entreprise pour activer le pilotage et les analyses.
              </p>
              <Link href="/fpa/budgets">
                <Button size="sm" className="mt-3"><Plus className="w-4 h-4 mr-2" />Créer un budget</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {!loading && summary?.companyBudget && (
        <>
          {/* ─── Bandeau d'exécution budgétaire ──────────────────────── */}
          <Card data-tour="fpa-execution" className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-base">Exécution budgétaire</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trajectoire du réalisé par rapport au budget annuel
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">
                  Cumul : <span className="font-semibold ml-1">{ytdPct.toFixed(1)} %</span>
                </Badge>
                {projectionAvailable && projectedVariance !== null ? (
                  <Badge
                    variant="outline"
                    className={`text-xs ${projectedVariance > 0 ? "border-amber-300 text-amber-700 bg-amber-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}`}
                  >
                    Fin d'année : {projectedVariance > 0 ? "+" : ""}{fmtCompact(projectedVariance)} FCFA
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Projection N/D</Badge>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                  style={{ width: `${Math.min(100, ytdPct)}%` }}
                />
                {projectionAvailable && projectedVariance !== null && projectedVariance > 0 && annualBudget > 0 && (
                  <div
                    className="absolute top-0 h-full bg-gradient-to-r from-amber-300 to-amber-500"
                    style={{
                      left: `${Math.min(100, ytdPct)}%`,
                      width: `${Math.min(100 - ytdPct, (((projectedYearEnd ?? 0) - ytdActual) / annualBudget) * 100)}%`,
                      opacity: 0.7,
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>0</span>
                <span className="font-medium">Cumul {fmtCompact(ytdActual)}</span>
                <span>Budget {fmtCompact(annualBudget)} FCFA</span>
              </div>
            </div>
          </Card>

          {/* ─── Évolution mensuelle ─────────────────────────────────── */}
          <div data-tour="fpa-chart" className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 sm:p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <LineIcon className="w-4 h-4 text-amber-500" />
                    Évolution mensuelle
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Budget vs Réalisé · cumul annuel</p>
                </div>
                <Badge variant="outline" className="text-xs">{summary.monthly.length} mois</Badge>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={cumulative}>
                  <defs>
                    <linearGradient id="cumulBudget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cumulActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtCompact(v as number)} />
                  <Tooltip
                    formatter={(v: number) => formatFCFA(v)}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="budget" fill="#bfdbfe" name="Budget mensuel" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="actual" fill="#86efac" name="Réalisé mensuel" radius={[4, 4, 0, 0]} barSize={14} />
                  <Line type="monotone" dataKey="cumulBudget" stroke="#2563eb" strokeWidth={2} name="Cumul budget" dot={false} />
                  <Line type="monotone" dataKey="cumulActual" stroke="#059669" strokeWidth={2.5} name="Cumul réalisé" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            {/* Décomposition CA / Charges / Marge */}
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-amber-500" />
                    Performance
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Produits & charges cumulés</p>
                </div>
              </div>
              <div className="space-y-4">
                <PerfRow
                  label="Produits"
                  value={totalRevenues}
                  total={Math.max(totalRevenues, totalExpenses, 1)}
                  color="bg-emerald-500"
                  textColor="text-emerald-700"
                />
                <PerfRow
                  label="Charges"
                  value={totalExpenses}
                  total={Math.max(totalRevenues, totalExpenses, 1)}
                  color="bg-rose-500"
                  textColor="text-rose-700"
                />
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Marge brute</span>
                    <span className={`text-base font-bold ${grossMargin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatFCFA(grossMargin)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={Math.max(0, Math.min(100, marginPct))} className="h-1.5" />
                    <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">
                      {marginPct.toFixed(1)} %
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* ─── Top variances + Top projets ─────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Écarts les plus marqués</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Comptes avec la plus forte variance</p>
                </div>
                <Link href="/fpa/variance">
                  <Button variant="ghost" size="sm" className="h-8">
                    Détails<ChevronRight className="w-4 h-4 ml-0.5" />
                  </Button>
                </Link>
              </div>
              {summary.topVariances.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Aucun écart à afficher.</p>
              ) : (
                <div className="space-y-3">
                  {summary.topVariances.slice(0, 6).map((v) => {
                    const maxAbs = Math.max(...summary.topVariances.map((x) => Math.abs(x.variance)), 1);
                    const widthPct = (Math.abs(v.variance) / maxAbs) * 100;
                    const positive = v.variance > 0;
                    return (
                      <div key={v.accountCode} className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground shrink-0">{v.accountCode}</span>
                            <span className="text-sm truncate">{v.accountLabel}</span>
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${positive ? "text-amber-700" : "text-emerald-600"}`}>
                            {positive ? "+" : ""}{fmtCompact(v.variance)}
                          </span>
                        </div>
                        <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`absolute top-0 left-0 h-full ${positive ? "bg-amber-400" : "bg-emerald-400"}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-amber-500" />
                    Performance par projet
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Top 5 par volume d'activité</p>
                </div>
              </div>
              {topProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Aucun projet avec activité.</p>
              ) : (
                <div className="space-y-3">
                  {topProjects.map((p) => {
                    const margin = p.margin;
                    const profitable = margin >= 0;
                    return (
                      <Link key={p.projectId} href={`/projets/${p.projectId}`}>
                        <div className="p-3 rounded-lg border hover:border-amber-300 hover:bg-amber-50/30 cursor-pointer transition group">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate group-hover:text-amber-700">
                                {p.projectName}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>CA : <span className="text-foreground font-medium">{fmtCompact(p.revenues)}</span></span>
                                <span>Charges : <span className="text-foreground font-medium">{fmtCompact(p.expenses)}</span></span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-sm font-bold ${profitable ? "text-emerald-600" : "text-rose-600"}`}>
                                {profitable ? "+" : ""}{fmtCompact(margin)}
                              </div>
                              <Badge variant="outline" className="text-[10px] mt-0.5">
                                {PROJECT_STATUS_LABELS[p.projectStatus] ?? p.projectStatus.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ─── Projection fin d'année ─────────────────────────────── */}
          {yearEnd && (
            <Card className="p-5 sm:p-6 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-500" />
                    Projection fin d'exercice
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Au {new Date(yearEnd.asOfDate).toLocaleDateString("fr-FR")} · réalisé YTD + budget restant
                  </p>
                </div>
                {projectedVariance !== null && (
                  <Badge
                    variant="outline"
                    className={projectedVariance > 0 ? "border-amber-300 text-amber-700 bg-amber-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}
                  >
                    {projectedVariance > 0 ? "Dépassement attendu" : "Sous-consommation projetée"}
                  </Badge>
                )}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={cumulative}>
                  <defs>
                    <linearGradient id="projArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatFCFA(v)} contentStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="cumulBudget" stroke="#94a3b8" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" name="Trajectoire budget" />
                  <Area type="monotone" dataKey="cumulActual" stroke="#f97316" fill="url(#projArea)" strokeWidth={2.5} name="Réalisé cumulé" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <ProjStat label="Budget annuel" value={formatFCFA(yearEnd.totals.annualBudget)} />
                <ProjStat label="Réalisé YTD" value={formatFCFA(yearEnd.totals.ytdActual)} />
                <ProjStat label="Projection prudente" value={formatFCFA(yearEnd.totals.projectedTotal)} highlight />
                <ProjStat label="Projection linéaire" value={formatFCFA(yearEnd.totals.linearProjection)} />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function HeroKpi({ label, value, hint, icon: Icon, accent }: { label: string; value: string; hint?: string; icon: any; accent: string }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-lg p-3 sm:p-4 border border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] text-slate-300 uppercase tracking-wide font-medium truncate">{label}</p>
          <p className="text-base sm:text-xl font-bold mt-1 break-words leading-tight">{value}</p>
          {hint && <p className="text-[10px] text-slate-400 mt-1 truncate">{hint}</p>}
        </div>
        <div className={`p-1.5 sm:p-2 rounded-md ${accent} shrink-0`}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
    </div>
  );
}

function PerfRow({ label, value, total, color, textColor }: { label: string; value: number; total: number; color: string; textColor: string }) {
  const pct = (value / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${textColor}`}>{formatFCFA(value)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`absolute top-0 left-0 h-full ${color} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function ProjStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-amber-50 border border-amber-200" : "bg-white border"}`}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-base font-bold mt-1 truncate ${highlight ? "text-amber-700" : ""}`}>{value}</p>
    </div>
  );
}
