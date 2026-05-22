import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  Line, AreaChart, Area, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Info, CheckCircle2,
  Landmark, ArrowDownCircle, ArrowUpCircle, Clock, Flame, Shield,
  CalendarRange, ArrowRight, ChevronDown, ChevronUp, BarChart3, FileSpreadsheet,
  Target, Droplets, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FiscalPeriod { id: string; name: string; startDate: string; endDate: string; status: string; }
interface Kpis {
  currentBalance: number; openingBalance: number; burnRate: number;
  runwayMonths: number | null; zeroCashDate: string | null;
  totalAR: number; totalAP: number; netPosition: number;
  avgMonthlyInflows: number; avgMonthlyOutflows: number;
}
interface MonthlyRow { period: string; inflows: number; outflows: number; net: number; balance: number; }
interface ProjRow { period: string; base: number; optimiste: number; pessimiste: number; arIn: number; apOut: number; }
interface InvoiceRow { id: string; reference: string; clientName?: string; supplierName?: string; amount: number; dueDate?: string; overdue: boolean; }
interface Alert { type: string; severity: "critical" | "warning" | "info"; title: string; detail: string; period?: string; }
interface CashflowData {
  fiscalPeriod: FiscalPeriod;
  kpis: Kpis;
  monthly: MonthlyRow[];
  projection: ProjRow[];
  ar: InvoiceRow[];
  ap: InvoiceRow[];
  alerts: Alert[];
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Aoû", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};
const fmtPeriod = (p: string) => `${MONTH_LABELS[p.slice(5, 7)] ?? p.slice(5, 7)} ${p.slice(2, 4)}`;

function fmtRunway(months: number | null): string {
  if (months === null) return "∞";
  if (months >= 24) return `${Math.floor(months / 12)} ans`;
  if (months >= 12) return `${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? "s" : ""} ${Math.round(months % 12)} m`;
  return `${Math.round(months)} mois`;
}

const toFCFA = (v: number) => formatFCFACompact(v);

// ─── Composants de KPI ───────────────────────────────────────────────────────
function KpiCard({ label, value, hint, icon: Icon, iconBg, valueColor, subValue, subLabel, border }: {
  label: string; value: string; hint?: string; icon: any; iconBg: string; valueColor?: string;
  subValue?: string; subLabel?: string; border?: string;
}) {
  return (
    <Card className={cn("p-4 flex flex-col gap-2 border", border ?? "border-border/60")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={cn("text-xl font-bold leading-tight font-display", valueColor ?? "text-foreground")}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {subValue && (
        <div className="mt-auto pt-2 border-t border-border/40 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{subLabel}</span>
          <span className="text-xs font-semibold">{subValue}</span>
        </div>
      )}
    </Card>
  );
}

// ─── Alert card ──────────────────────────────────────────────────────────────
function AlertCard({ alert }: { alert: Alert }) {
  const config = {
    critical: { icon: AlertTriangle, bg: "bg-red-50", border: "border-red-200", text: "text-red-700", iconColor: "text-red-500" },
    warning:  { icon: AlertCircle,   bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", iconColor: "text-amber-500" },
    info:     { icon: Info,           bg: "bg-blue-50",  border: "border-blue-100",  text: "text-blue-700",  iconColor: "text-blue-400" },
  }[alert.severity];
  const { icon: Icon, bg, border, text, iconColor } = config;
  return (
    <div className={cn("flex gap-3 p-3 rounded-xl border", bg, border)}>
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", iconColor)} />
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", text)}>{alert.title}</p>
        <p className={cn("text-xs mt-0.5", text, "opacity-80")}>{alert.detail}</p>
      </div>
    </div>
  );
}

// ─── Custom chart tooltip ────────────────────────────────────────────────────
function CfTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border/60 rounded-xl shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">{fmtPeriod(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <span className="text-muted-foreground text-xs">{entry.name}</span>
          <span className="font-medium tabular-nums" style={{ color: entry.color }}>{toFCFA(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function CashflowPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [data, setData] = useState<CashflowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllAR, setShowAllAR] = useState(false);
  const [showAllAP, setShowAllAP] = useState(false);
  const [activeScenario, setActiveScenario] = useState<"all" | "base" | "optimiste" | "pessimiste">("all");

  useEffect(() => {
    apiFetch<{ data: FiscalPeriod[] }>("/api/accounting/fiscal-periods").then((r) => {
      setPeriods(r.data);
      const open = r.data.find((p) => p.status === "open") ?? r.data[0];
      if (open) setPeriodId(open.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!periodId) return;
    let cancelled = false;
    setLoading(true); setData(null);
    apiFetch<CashflowData>(`/api/fpa/cashflow?fiscalPeriodId=${periodId}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodId]);

  const kpis = data?.kpis;
  const monthly  = data?.monthly ?? [];
  const proj     = data?.projection ?? [];
  const alerts   = data?.alerts ?? [];
  const ar       = data?.ar ?? [];
  const ap       = data?.ap ?? [];

  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const hasCritical    = criticalAlerts.length > 0;

  const arDisplay = showAllAR ? ar : ar.slice(0, 5);
  const apDisplay = showAllAP ? ap : ap.slice(0, 5);

  const projChart = useMemo(() => {
    if (activeScenario === "all") return proj;
    return proj.map((p) => ({ ...p, base: activeScenario === "base" ? p.base : 0, optimiste: activeScenario === "optimiste" ? p.optimiste : 0, pessimiste: activeScenario === "pessimiste" ? p.pessimiste : 0 }));
  }, [proj, activeScenario]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="rounded-xl border bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-cyan-300/90 text-xs font-medium uppercase tracking-wider">
              <Droplets className="w-3.5 h-3.5" />
              Planification financière
            </div>
            <h1 className="text-2xl font-bold mt-1">Gestion de trésorerie</h1>
            <p className="text-slate-300 mt-1 text-sm">Pilotage cash flow · indicateurs de liquidité · projections</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <CalendarRange className="w-4 h-4 text-cyan-300" />
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="w-44 bg-transparent border-0 text-white hover:bg-white/5 h-7 px-2">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.status === "closed" ? " · clôturée" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link href="/fpa">
              <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20 border-0">
                <BarChart3 className="w-4 h-4 mr-1.5" />Dashboard
              </Button>
            </Link>
            <Link href="/fpa/budgets">
              <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20 border-0">
                <Target className="w-4 h-4 mr-1.5" />Budgets
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI strip */}
        {kpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {[
              { label: "Solde disponible", value: toFCFA(kpis.currentBalance), hint: `Ouverture : ${toFCFA(kpis.openingBalance)}`, accent: "bg-cyan-500/20 text-cyan-200", icon: Landmark },
              { label: "Cash Runway", value: fmtRunway(kpis.runwayMonths), hint: kpis.runwayMonths === null ? "Burn rate positif ✓" : `Zero cash : ${kpis.zeroCashDate ?? "—"}`, accent: kpis.runwayMonths === null || (kpis.runwayMonths ?? 0) > 12 ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200", icon: Shield },
              { label: "Burn Rate moyen/mois", value: toFCFA(kpis.burnRate), hint: `Entrées moy. : ${toFCFA(kpis.avgMonthlyInflows)}`, accent: kpis.burnRate >= 0 ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200", icon: Flame },
              { label: "Position nette (AR−AP)", value: toFCFA(kpis.netPosition), hint: `AR : ${toFCFA(kpis.totalAR)} · AP : ${toFCFA(kpis.totalAP)}`, accent: kpis.netPosition >= 0 ? "bg-violet-500/20 text-violet-200" : "bg-rose-500/20 text-rose-200", icon: Wallet },
            ].map((k) => (
              <div key={k.label} className="bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-[11px] text-slate-300 uppercase tracking-wide font-medium truncate">{k.label}</p>
                    <p className="text-base sm:text-xl font-bold mt-1 break-words leading-tight">{k.value}</p>
                    {k.hint && <p className="text-[10px] text-slate-400 mt-1 truncate">{k.hint}</p>}
                  </div>
                  <div className={cn("p-1.5 sm:p-2 rounded-md shrink-0", k.accent)}>
                    <k.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="text-center py-12 text-muted-foreground text-sm">Calcul des flux de trésorerie…</div>}

      {data && !loading && (
        <>
          {/* ── Alertes critiques ── */}
          {hasCritical && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p className="font-semibold text-red-700">Alerte trésorerie critique</p>
                {criticalAlerts.map((a, i) => <p key={i} className="text-sm text-red-600">{a.detail}</p>)}
              </div>
            </div>
          )}

          {/* ── KPI détail (6 cartes) ── */}
          {kpis && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Trésorerie disponible" value={toFCFA(kpis.currentBalance)} hint="Solde en banque" icon={Landmark} iconBg="bg-cyan-100 text-cyan-700" valueColor={kpis.currentBalance >= 0 ? "text-foreground" : "text-red-500"} />
              <KpiCard label="Entrées moy./mois" value={toFCFA(kpis.avgMonthlyInflows)} hint="Sur l'exercice" icon={ArrowDownCircle} iconBg="bg-emerald-100 text-emerald-700" valueColor="text-emerald-700" />
              <KpiCard label="Sorties moy./mois" value={toFCFA(kpis.avgMonthlyOutflows)} hint="Sur l'exercice" icon={ArrowUpCircle} iconBg="bg-red-100 text-red-600" valueColor="text-red-600" />
              <KpiCard label="Burn Rate" value={toFCFA(kpis.burnRate)} hint="Net mensuel moy." icon={Flame} iconBg={kpis.burnRate >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} valueColor={kpis.burnRate >= 0 ? "text-emerald-700" : "text-amber-700"} />
              <KpiCard label="Cash Runway" value={fmtRunway(kpis.runwayMonths)} hint={kpis.runwayMonths === null ? "Trésorerie stable" : "Avant tension"} icon={Clock} iconBg={(kpis.runwayMonths ?? 999) > 12 ? "bg-emerald-100 text-emerald-700" : (kpis.runwayMonths ?? 999) > 3 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"} valueColor={(kpis.runwayMonths ?? 999) > 12 ? "text-foreground" : (kpis.runwayMonths ?? 999) > 3 ? "text-amber-700" : "text-red-600"} />
              <KpiCard label="Zero Cash Date" value={kpis.zeroCashDate ?? "N/A"} hint={kpis.zeroCashDate ? "Date estimée de rupture" : "Burn rate positif"} icon={AlertCircle} iconBg={!kpis.zeroCashDate ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"} valueColor={!kpis.zeroCashDate ? "text-emerald-700" : "text-red-600"} border={kpis.zeroCashDate && !hasCritical ? "border-amber-300" : undefined} />
            </div>
          )}

          {/* ── Chart 1 : Flux mensuels réels ── */}
          {monthly.length > 0 && (
            <Card className="p-5 sm:p-6">
              <div className="mb-4">
                <h3 className="font-semibold text-base">Flux de trésorerie mensuels — {data.fiscalPeriod.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Entrées (débit classe 5) · Sorties (crédit classe 5) · Solde cumulatif</p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={fmtPeriod} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 11 }} width={50} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 11 }} width={50} />
                  <Tooltip content={<CfTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine yAxisId="left" y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Bar yAxisId="left" dataKey="inflows"  name="Entrées"  fill="#10b981" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="left" dataKey="outflows" name="Sorties"  fill="#f43f5e" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="balance" name="Solde cumulatif" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3, fill: "#0ea5e9" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ── Chart 2 : Projection 12 mois ── */}
          {proj.length > 0 && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-base">Projection de trésorerie — 12 mois</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Basé sur le burn rate actuel + encaissements/décaissements attendus (AR/AP)</p>
                </div>
                <div className="flex gap-1">
                  {(["all", "base", "optimiste", "pessimiste"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveScenario(s)}
                      className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors", activeScenario === s ? "bg-slate-900 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                    >{s === "all" ? "Tous" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={projChart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOpt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={fmtPeriod} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 11 }} width={50} />
                  <Tooltip content={<CfTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  {(activeScenario === "all" || activeScenario === "pessimiste") && <Area type="monotone" dataKey="pessimiste" name="Pessimiste" stroke="#f43f5e" fill="url(#gradPes)" strokeWidth={1.5} strokeDasharray="4 3" />}
                  {(activeScenario === "all" || activeScenario === "base")       && <Area type="monotone" dataKey="base"       name="Base"       stroke="#0ea5e9" fill="url(#gradBase)" strokeWidth={2.5} />}
                  {(activeScenario === "all" || activeScenario === "optimiste")  && <Area type="monotone" dataKey="optimiste"  name="Optimiste"  stroke="#10b981" fill="url(#gradOpt)"  strokeWidth={1.5} strokeDasharray="4 3" />}
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: "Scénario base", value: proj[proj.length - 1]?.base ?? 0, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
                  { label: "Optimiste (+20 %)", value: proj[proj.length - 1]?.optimiste ?? 0, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
                  { label: "Pessimiste (−20 %)", value: proj[proj.length - 1]?.pessimiste ?? 0, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
                ].map((s) => (
                  <div key={s.label} className={cn("rounded-lg p-3 border", s.bg, s.border)}>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                    <p className={cn("text-base font-bold mt-1", s.color)}>{toFCFA(s.value)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Dans 12 mois</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── AR / AP ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Créances clients (AR) */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
                    Encaissements attendus (AR)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{ar.length} facture(s) · Total : {toFCFA(kpis?.totalAR ?? 0)}</p>
                </div>
                {ar.filter((i) => i.overdue).length > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">
                    {ar.filter((i) => i.overdue).length} en retard
                  </Badge>
                )}
              </div>
              {ar.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-400 mb-1.5" />
                  <p className="text-sm text-muted-foreground">Aucune créance en attente</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {arDisplay.map((inv) => (
                      <div key={inv.id} className={cn("flex items-center gap-3 p-2.5 rounded-lg border text-sm", inv.overdue ? "border-amber-200 bg-amber-50/40" : "border-border/50 bg-card")}>
                        {inv.overdue
                          ? <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          : <Clock className="w-4 h-4 text-emerald-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{inv.clientName}</p>
                          <p className="text-[11px] text-muted-foreground">{inv.reference}{inv.dueDate ? ` · échéance ${inv.dueDate}` : ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-emerald-600 tabular-nums">{toFCFA(inv.amount)}</p>
                          {inv.overdue && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">En retard</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {ar.length > 5 && (
                    <button onClick={() => setShowAllAR((v) => !v)} className="mt-2 w-full py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors">
                      {showAllAR ? <><ChevronUp className="w-3.5 h-3.5" />Réduire</> : <><ChevronDown className="w-3.5 h-3.5" />Voir {ar.length - 5} de plus</>}
                    </button>
                  )}
                </>
              )}
            </Card>

            {/* Dettes fournisseurs (AP) */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-red-400" />
                    Décaissements prévus (AP)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{ap.length} facture(s) · Total : {toFCFA(kpis?.totalAP ?? 0)}</p>
                </div>
                {ap.filter((i) => i.overdue).length > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">
                    {ap.filter((i) => i.overdue).length} en retard
                  </Badge>
                )}
              </div>
              {ap.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-400 mb-1.5" />
                  <p className="text-sm text-muted-foreground">Aucune dette fournisseur en attente</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {apDisplay.map((inv) => (
                      <div key={inv.id} className={cn("flex items-center gap-3 p-2.5 rounded-lg border text-sm", inv.overdue ? "border-red-200 bg-red-50/40" : "border-border/50 bg-card")}>
                        {inv.overdue
                          ? <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          : <Clock className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{inv.supplierName}</p>
                          <p className="text-[11px] text-muted-foreground">{inv.reference}{inv.dueDate ? ` · échéance ${inv.dueDate}` : ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-red-500 tabular-nums">{toFCFA(inv.amount)}</p>
                          {inv.overdue && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">En retard</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {ap.length > 5 && (
                    <button onClick={() => setShowAllAP((v) => !v)} className="mt-2 w-full py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors">
                      {showAllAP ? <><ChevronUp className="w-3.5 h-3.5" />Réduire</> : <><ChevronDown className="w-3.5 h-3.5" />Voir {ap.length - 5} de plus</>}
                    </button>
                  )}
                </>
              )}
            </Card>
          </div>

          {/* ── Alertes ── */}
          {alerts.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Alertes trésorerie ({alerts.length})
              </h3>
              <div className="space-y-2">
                {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
              </div>
            </Card>
          )}

          {/* ── Résumé indicateurs de liquidité ── */}
          {kpis && (
            <Card className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Indicateurs de liquidité
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Couverture des sorties",
                    value: kpis.avgMonthlyOutflows > 0 ? `${Math.round(kpis.currentBalance / kpis.avgMonthlyOutflows)} mois` : "∞",
                    hint: "Trésorerie disponible / sorties moyennes",
                    icon: Shield,
                    color: (kpis.currentBalance / (kpis.avgMonthlyOutflows || 1)) > 3 ? "text-emerald-600" : "text-amber-700",
                  },
                  {
                    label: "Ratio AR/AP",
                    value: kpis.totalAP > 0 ? `${(kpis.totalAR / kpis.totalAP).toFixed(2)}×` : "∞",
                    hint: "Créances / dettes (> 1 = favorable)",
                    icon: ArrowRight,
                    color: kpis.totalAP === 0 || kpis.totalAR >= kpis.totalAP ? "text-emerald-600" : "text-rose-600",
                  },
                  {
                    label: "Capacité de couverture AP",
                    value: kpis.totalAP > 0 ? `${Math.round((kpis.currentBalance / kpis.totalAP) * 100)} %` : "100 %",
                    hint: "Solde disponible / dettes fournisseurs",
                    icon: Wallet,
                    color: kpis.totalAP === 0 || kpis.currentBalance >= kpis.totalAP ? "text-emerald-600" : "text-rose-600",
                  },
                  {
                    label: "Trésorerie nette disponible",
                    value: toFCFA(kpis.currentBalance + kpis.totalAR - kpis.totalAP),
                    hint: "Solde + AR attendus − AP à régler",
                    icon: TrendingUp,
                    color: kpis.netPosition >= 0 ? "text-emerald-600" : "text-rose-600",
                  },
                ].map((k) => (
                  <div key={k.label} className="p-3 rounded-xl border border-border/60 bg-card/60">
                    <div className="flex items-center gap-2 mb-2">
                      <k.icon className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
                    </div>
                    <p className={cn("text-lg font-bold", k.color)}>{k.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{k.hint}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <Droplets className="w-10 h-10 mx-auto mb-3 opacity-30" />
          Sélectionnez une période fiscale pour afficher l'analyse de trésorerie.
        </div>
      )}
    </div>
  );
}
