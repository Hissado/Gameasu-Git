import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { AccountingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFCFA } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Minus, Building2, Banknote, RefreshCw,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Info,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

type CashFlowItem = {
  label: string;
  amount: number;
  type: "result" | "adjustment" | "wc" | "invest" | "finance";
};

type CashFlowSection = {
  total: number;
  items: CashFlowItem[];
};

type CashFlowStatement = {
  period: { from: string; to: string };
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  netCashChange: number;
  openingBalance: number;
  closingBalance: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

type Preset = "year" | "h1" | "h2" | "q1" | "q2" | "q3" | "q4" | "custom";

function computePeriod(preset: Preset, from: string, to: string): { from: string; to: string } {
  const y = new Date().getFullYear();
  switch (preset) {
    case "year": return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "h1": return { from: `${y}-01-01`, to: `${y}-06-30` };
    case "h2": return { from: `${y}-07-01`, to: `${y}-12-31` };
    case "q1": return { from: `${y}-01-01`, to: `${y}-03-31` };
    case "q2": return { from: `${y}-04-01`, to: `${y}-06-30` };
    case "q3": return { from: `${y}-07-01`, to: `${y}-09-30` };
    case "q4": return { from: `${y}-10-01`, to: `${y}-12-31` };
    default: return { from: from || `${y}-01-01`, to: to || `${y}-12-31` };
  }
}

function amountColor(amount: number): string {
  if (amount > 0) return "text-emerald-600";
  if (amount < 0) return "text-red-500";
  return "text-muted-foreground/60";
}

function AmountCell({ amount }: { amount: number }) {
  return (
    <span className={`font-bold tabular-nums text-sm ${amountColor(amount)}`}>
      {amount > 0 ? "+" : ""}{formatFCFA(amount)}
    </span>
  );
}

// ── Section du tableau de flux ────────────────────────────────────────────────

function FlowSection({
  title,
  icon: Icon,
  section,
  accentColor,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  section: CashFlowSection;
  accentColor: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border overflow-hidden bg-card">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/60 transition-colors"
        onClick={() => setOpen(!open)}
        style={{ borderLeft: `4px solid ${accentColor}` }}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
          <span className="font-bold text-foreground text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <AmountCell amount={section.total} />
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground/60" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/60" />}
        </div>
      </button>

      {open && (
        <div className="border-t border">
          {section.items.map((item, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-5 py-2.5 text-sm ${i % 2 === 0 ? "bg-muted/30" : ""} hover:bg-muted/60 transition-colors`}
            >
              <span className="text-muted-foreground flex-1 pr-4">{item.label}</span>
              <AmountCell amount={item.amount} />
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3 bg-muted/60 font-bold text-sm border-t border">
            <span className="text-foreground">Sous-total</span>
            <AmountCell amount={section.total} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function CashFlowStatement() {
  const [preset, setPreset] = useState<Preset>("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const period = useMemo(() => computePeriod(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const { data, isLoading, isError, refetch } = useQuery<CashFlowStatement>({
    queryKey: ["accounting", "cash-flow", period.from, period.to],
    queryFn: () => apiFetch(`/api/accounting/cash-flow-statement?from=${period.from}&to=${period.to}`),
  });

  const chartData = data
    ? [
        { name: "Exploitation", flux: data.operatingActivities.total },
        { name: "Investissement", flux: data.investingActivities.total },
        { name: "Financement", flux: data.financingActivities.total },
        { name: "Variation nette", flux: data.netCashChange },
      ]
    : [];

  const netOk = data ? data.netCashChange >= 0 : null;

  return (
    <AccountingShell
      title="Tableau de flux de trésorerie"
      subtitle="Méthode indirecte — SYSCOHADA révisé"
      actions={
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Exercice en cours</SelectItem>
              <SelectItem value="h1">1er semestre</SelectItem>
              <SelectItem value="h2">2e semestre</SelectItem>
              <SelectItem value="q1">T1</SelectItem>
              <SelectItem value="q2">T2</SelectItem>
              <SelectItem value="q3">T3</SelectItem>
              <SelectItem value="q4">T4</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground shrink-0">Du</Label>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-36 text-sm" />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground shrink-0">au</Label>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-36 text-sm" />
              </div>
            </>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : isError ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200 text-red-600">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Erreur lors du chargement du tableau de flux. Vérifiez que la période est correcte et que des écritures comptables existent.</p>
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* Note informative si pas d'écritures */}
          {Math.abs(data.netCashChange) < 1 && Math.abs(data.openingBalance) < 1 && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200 text-blue-700">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Aucune écriture comptable validée sur la période</p>
                <p className="text-xs mt-0.5 text-blue-600">Le tableau s'alimentera automatiquement dès que des écritures seront passées et validées dans le module Comptabilité.</p>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Trésorerie début</p>
                <p className={`text-xl font-bold mt-1 ${amountColor(data.openingBalance)}`}>
                  {formatFCFA(data.openingBalance)}
                </p>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Flux exploitation</p>
                <p className={`text-xl font-bold mt-1 ${amountColor(data.operatingActivities.total)}`}>
                  {data.operatingActivities.total >= 0 ? "+" : ""}{formatFCFA(data.operatingActivities.total)}
                </p>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Variation nette</p>
                <div className="flex items-center gap-2 mt-1">
                  {netOk === true ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : netOk === false ? <TrendingDown className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4 text-muted-foreground/60" />}
                  <p className={`text-xl font-bold ${amountColor(data.netCashChange)}`}>
                    {data.netCashChange >= 0 ? "+" : ""}{formatFCFA(data.netCashChange)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className={`border-2 ${data.closingBalance >= 0 ? "border-emerald-300 bg-emerald-50/30" : "border-red-300 bg-red-50/30"}`}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Trésorerie fin</p>
                <div className="flex items-center gap-2 mt-1">
                  {data.closingBalance >= 0
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <AlertCircle className="w-4 h-4 text-red-500" />}
                  <p className={`text-xl font-bold ${amountColor(data.closingBalance)}`}>
                    {formatFCFA(data.closingBalance)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graphique en barres */}
          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Répartition par type d'activité</CardTitle>
              <CardDescription className="text-xs">Montants en FCFA — barres vertes = entrées nettes, rouges = sorties nettes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v) => Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(v: number) => [formatFCFA(v), "Flux"]} />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <Bar
                      dataKey="flux"
                      name="Flux net"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      label={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Tableau formel */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">
              Tableau des flux — {new Date(period.from).toLocaleDateString("fr-FR")} au {new Date(period.to).toLocaleDateString("fr-FR")}
            </h2>

            <FlowSection
              title="I. Flux de trésorerie liés à l'exploitation"
              icon={Building2}
              section={data.operatingActivities}
              accentColor="#10b981"
              defaultOpen
            />

            <FlowSection
              title="II. Flux de trésorerie liés aux investissements"
              icon={TrendingUp}
              section={data.investingActivities}
              accentColor="#3b82f6"
              defaultOpen
            />

            <FlowSection
              title="III. Flux de trésorerie liés au financement"
              icon={Banknote}
              section={data.financingActivities}
              accentColor="#8b5cf6"
              defaultOpen
            />

            {/* Ligne de totalisation */}
            <div className="rounded-xl border-2 border bg-slate-900 text-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-bold text-sm">Variation nette de trésorerie (I + II + III)</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Trésorerie d'ouverture : {formatFCFA(data.openingBalance)} → Trésorerie de clôture : {formatFCFA(data.closingBalance)}
                  </p>
                </div>
                <div className={`text-xl font-bold tabular-nums ${data.netCashChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {data.netCashChange >= 0 ? "+" : ""}{formatFCFA(data.netCashChange)}
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border">
                {[
                  { label: "Trésorerie début", value: data.openingBalance },
                  { label: "Variation nette", value: data.netCashChange },
                  { label: "Trésorerie fin", value: data.closingBalance },
                ].map((r) => (
                  <div key={r.label} className="flex flex-col items-center justify-center py-3 border-r border last:border-0">
                    <p className="text-xs text-muted-foreground/60">{r.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${r.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatFCFA(r.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 text-center">
            Tableau établi selon la méthode indirecte, conforme au référentiel SYSCOHADA révisé.
            Calculé à partir des écritures comptables validées (statut « enregistré »).
          </p>
        </div>
      )}
    </AccountingShell>
  );
}
