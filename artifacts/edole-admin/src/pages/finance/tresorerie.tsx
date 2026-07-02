import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { Loader2, TrendingUp, AlertTriangle, Banknote, Clock, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type Forecast = {
  horizonDays: number;
  totalExpected: number;
  totalWeighted: number;
  beyondHorizon: number;
  beyondHorizonWeighted: number;
  series: Array<{
    date: string;
    expected: number;
    weighted: number;
    cumulative: number;
    cumulativeWeighted: number;
  }>;
};

type BankAccount = {
  id: string;
  name: string;
  accountNumber: string | null;
  currency: string | null;
  balance?: number;
};

type Overview = {
  totalOutstanding: number;
  totalOverdue: number;
  dso: number;
};

const HORIZON_OPTIONS = [
  { days: 30, label: "30 jours" },
  { days: 60, label: "60 jours" },
  { days: 90, label: "90 jours" },
];

function toNum(v: unknown) {
  return typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
}

export default function TresoreriePage() {
  const [horizon, setHorizon] = useState(30);
  const [alertThreshold, setAlertThreshold] = useState(5_000_000);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("5000000");

  const forecast = useQuery<Forecast>({
    queryKey: ["treso-forecast", horizon],
    queryFn: () => apiFetch(`/api/finance/intelligence/cashflow-forecast?days=${horizon}`),
  });
  const banks = useQuery<{ data: BankAccount[] }>({
    queryKey: ["treso-banks"],
    queryFn: () => apiFetch("/api/accounting/bank-accounts"),
  });
  const overview = useQuery<Overview>({
    queryKey: ["treso-overview"],
    queryFn: () => apiFetch("/api/finance/intelligence/overview"),
  });

  const banksList = banks.data?.data ?? [];
  const currentBalance = useMemo(
    () => banksList.reduce((s, b) => s + toNum(b.balance), 0),
    [banksList]
  );

  const fc = forecast.data;
  const ov = overview.data;

  const avgDailyOutflow = useMemo(() => {
    if (!fc) return 0;
    if (fc.horizonDays <= 0) return 0;
    return fc.totalWeighted / fc.horizonDays;
  }, [fc]);

  const cashRunwayDays = useMemo(() => {
    if (!avgDailyOutflow || avgDailyOutflow <= 0) return null;
    return Math.round(currentBalance / avgDailyOutflow);
  }, [currentBalance, avgDailyOutflow]);

  const chartData = useMemo(() => {
    if (!fc) return [];
    return fc.series.map((pt) => ({
      date: pt.date,
      label: new Date(pt.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      encaissements: pt.expected,
      pondéré: pt.weighted,
      cumulé: pt.cumulative,
      "cumulé pondéré": pt.cumulativeWeighted,
    }));
  }, [fc]);

  const entrees30 = fc?.series.slice(0, 30).reduce((s, p) => s + p.weighted, 0) ?? 0;
  const entrees60 = fc?.series.slice(0, 60).reduce((s, p) => s + p.weighted, 0) ?? 0;
  const entrees90 = fc?.series.slice(0, 90).reduce((s, p) => s + p.weighted, 0) ?? 0;

  const isAboveThreshold = currentBalance >= alertThreshold;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trésorerie prévisionnelle"
        subtitle="Position de trésorerie, prévisions d'encaissements et cash runway."
      />

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className={isAboveThreshold ? "" : "border-red-300 bg-red-50/40"}>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5" /> Position actuelle
            </p>
            {banks.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mt-2" />
            ) : (
              <>
                <p className={`text-lg sm:text-2xl font-bold mt-1 leading-tight break-words ${isAboveThreshold ? "" : "text-red-600"}`}>
                  {formatFCFACompact(currentBalance)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{banksList.length} compte(s)</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Entrées {horizon} j (pondéré)
            </p>
            {forecast.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mt-2" />
            ) : (
              <>
                <p className="text-lg sm:text-2xl font-bold mt-1 leading-tight break-words text-emerald-600">{formatFCFACompact(fc?.totalWeighted ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Théorique : {formatFCFACompact(fc?.totalExpected ?? 0)}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Encours impayé
            </p>
            {overview.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mt-2" />
            ) : (
              <>
                <p className="text-lg sm:text-2xl font-bold mt-1 leading-tight break-words text-orange-600">{formatFCFACompact(ov?.totalOutstanding ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">En retard : {formatFCFACompact(ov?.totalOverdue ?? 0)}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cashRunwayDays !== null && cashRunwayDays < 30 ? "border-red-300 bg-red-50/40" : ""}>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Cash Runway
            </p>
            {forecast.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mt-2" />
            ) : cashRunwayDays === null ? (
              <p className="text-lg sm:text-2xl font-bold mt-1 text-muted-foreground">∞</p>
            ) : (
              <>
                <p className={`text-lg sm:text-2xl font-bold mt-1 leading-tight ${cashRunwayDays < 30 ? "text-red-600" : cashRunwayDays < 60 ? "text-orange-600" : "text-emerald-600"}`}>
                  {cashRunwayDays} j
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Sortie moy. : {formatFCFACompact(avgDailyOutflow)}/j
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart + controls */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Solde prévisionnel — encaissements cumulés</CardTitle>
            <div className="flex items-center gap-2">
              {HORIZON_OPTIONS.map((o) => (
                <Button
                  key={o.days}
                  size="sm"
                  variant={horizon === o.days ? "default" : "outline"}
                  onClick={() => setHorizon(o.days)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
          {/* Seuil d'alerte */}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span className="shrink-0">Seuil d'alerte :</span>
            {editingThreshold ? (
              <>
                <Input
                  className="h-7 w-36 text-xs"
                  type="number"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const v = parseInt(thresholdInput, 10);
                    if (!isNaN(v) && v >= 0) setAlertThreshold(v);
                    setEditingThreshold(false);
                  }}
                >
                  OK
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline" className="font-mono">{formatFCFA(alertThreshold)}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => { setThresholdInput(String(alertThreshold)); setEditingThreshold(true); }}
                >
                  Modifier
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {forecast.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={Math.floor(chartData.length / 6)}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
                <Tooltip
                  formatter={(v: any, name: string) => [formatFCFA(Number(v)), name]}
                  labelFormatter={(l) => `Date : ${l}`}
                />
                <ReferenceLine
                  y={alertThreshold}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  label={{ value: "Seuil", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulé pondéré"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradGreen)"
                  name="Pondéré (réaliste)"
                />
                <Area
                  type="monotone"
                  dataKey="cumulé"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#gradOrange)"
                  name="Théorique (optimiste)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Entrées par période */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[
          { label: "Entrées J+30", val: entrees30 },
          { label: "Entrées J+60", val: entrees60 },
          { label: "Entrées J+90", val: entrees90 },
        ].map((it) => (
          <Card key={it.label}>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">{it.label}</p>
              <p className="text-xl font-bold mt-1 text-emerald-600">{formatFCFACompact(it.val)}</p>
              <p className="text-[10px] text-muted-foreground">Montants pondérés</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comptes bancaires */}
      {banksList.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4" /> Détail par compte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {banksList.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-sm">{b.name}</p>
                    {b.accountNumber && <p className="text-xs text-muted-foreground">{b.accountNumber}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatFCFACompact(toNum(b.balance))}</p>
                    <p className="text-[10px] text-muted-foreground">{b.currency ?? "XOF"}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Au-delà de l'horizon */}
      {fc && fc.beyondHorizon > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          + {formatFCFA(fc.beyondHorizon)} attendu au-delà de {horizon} jours
          (pondéré : {formatFCFA(fc.beyondHorizonWeighted)})
        </p>
      )}
    </div>
  );
}
