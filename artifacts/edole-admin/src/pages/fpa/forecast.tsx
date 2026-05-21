import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";

interface FiscalPeriod { id: string; name: string; }
interface BudgetRow { id: string; name: string; kind: string; versionNumber: number; status: string; }
interface ProjectionRow {
  accountId: string; accountCode: string; accountLabel: string;
  annualBudget: number; ytdActual: number; remainingBudget: number;
  projectedTotal: number; linearProjection: number;
  projectedVariance: number; projectedVariancePct: number;
}
interface ProjectionReport {
  budget: any; fiscalPeriod: FiscalPeriod; asOfDate: string; currentMonth: string;
  rows: ProjectionRow[];
  totals: { annualBudget: number; ytdActual: number; projectedTotal: number; linearProjection: number };
}

export default function ForecastPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [forecasts, setForecasts] = useState<BudgetRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [forecastId, setForecastId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [forecastReport, setForecastReport] = useState<any | null>(null);
  const [projection, setProjection] = useState<ProjectionReport | null>(null);

  useEffect(() => {
    apiFetch<{ data: FiscalPeriod[] }>("/api/accounting/fiscal-periods").then((r) => {
      setPeriods(r.data); if (r.data[0]) setPeriodId(r.data[0].id);
    });
  }, []);
  useEffect(() => {
    if (!periodId) return;
    apiFetch<{ data: BudgetRow[] }>(`/api/fpa/budgets?fiscalPeriodId=${periodId}&kind=forecast`).then((r) => setForecasts(r.data));
    apiFetch<{ data: BudgetRow[] }>(`/api/fpa/budgets?fiscalPeriodId=${periodId}&kind=budget`).then((r) => setBudgets(r.data));
  }, [periodId]);
  useEffect(() => {
    if (!forecastId) { setForecastReport(null); return; }
    apiFetch(`/api/fpa/actual-vs-forecast?forecastId=${forecastId}`).then(setForecastReport);
  }, [forecastId]);
  useEffect(() => {
    if (!budgetId) { setProjection(null); return; }
    apiFetch<ProjectionReport>(`/api/fpa/year-end-projection?budgetId=${budgetId}`).then(setProjection);
  }, [budgetId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Forecast & projection fin d'année</h1>
        <p className="text-muted-foreground mt-1">Prévisionnel vs réalisé et atterrissage estimé.</p>
      </div>

      <Card className="p-4">
        <Label>Période fiscale</Label>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
          <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {/* Section 1 — Forecast vs réalisé */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="text-lg font-semibold">Forecast vs réalisé</h2>
            <p className="text-sm text-muted-foreground">Comparez vos prévisions à la réalité comptable.</p>
          </div>
          {forecastId && (
            <a href={`/api/fpa/export/forecast/${forecastId}.xlsx?token=${encodeURIComponent(localStorage.getItem("auth_token") || "")}`} download>
              <Button variant="outline" size="sm"><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
            </a>
          )}
        </div>
        <Select value={forecastId} onValueChange={setForecastId}>
          <SelectTrigger className="max-w-xl"><SelectValue placeholder="Choisir un forecast…" /></SelectTrigger>
          <SelectContent>
            {forecasts.length === 0 && <div className="px-2 py-2 text-sm text-muted-foreground">Aucun forecast pour cette période.</div>}
            {forecasts.map((f) => <SelectItem key={f.id} value={f.id}>{f.name} (v{f.versionNumber}) — {f.status}</SelectItem>)}
          </SelectContent>
        </Select>

        {forecastReport && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Mini label="Forecast" value={formatFCFA(forecastReport.totals.budget)} />
              <Mini label="Réalisé" value={formatFCFA(forecastReport.totals.actual)} />
              <Mini label="Écart" value={formatFCFA(forecastReport.totals.variance)}
                color={forecastReport.totals.variance > 0 ? "text-amber-700" : "text-emerald-600"} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Compte</th>
                    <th className="px-3 py-2 text-right">Forecast</th>
                    <th className="px-3 py-2 text-right">Réalisé</th>
                    <th className="px-3 py-2 text-right">Écart</th>
                    <th className="px-3 py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {forecastReport.rows.map((r: any) => (
                    <tr key={r.accountId} className="hover:bg-muted/20">
                      <td className="px-3 py-2"><span className="font-medium">{r.accountCode}</span> <span className="text-muted-foreground">{r.accountLabel}</span></td>
                      <td className="px-3 py-2 text-right">{formatFCFA(r.totalBudget)}</td>
                      <td className="px-3 py-2 text-right">{formatFCFA(r.totalActual)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.totalVariance > 0 ? "text-amber-700" : r.totalVariance < 0 ? "text-emerald-700" : ""}`}>
                        {formatFCFA(r.totalVariance)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">{r.totalVariancePct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Section 2 — Projection fin d'année */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Projection fin d'année</h2>
          <p className="text-sm text-muted-foreground">
            Atterrissage = réalisé YTD + budget des mois restants. Projection linéaire = extrapolation des actuels.
          </p>
        </div>
        <Select value={budgetId} onValueChange={setBudgetId}>
          <SelectTrigger className="max-w-xl"><SelectValue placeholder="Choisir un budget…" /></SelectTrigger>
          <SelectContent>
            {budgets.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} (v{b.versionNumber}) — {b.status}</SelectItem>)}
          </SelectContent>
        </Select>

        {projection && (
          <div className="mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Mini label="Budget annuel" value={formatFCFA(projection.totals.annualBudget)} />
              <Mini label="Réalisé YTD" value={formatFCFA(projection.totals.ytdActual)} />
              <Mini label="Atterrissage" value={formatFCFA(projection.totals.projectedTotal)} color="text-blue-600" />
              <Mini label="Projection linéaire" value={formatFCFA(projection.totals.linearProjection)} color="text-violet-600" />
            </div>
            <p className="text-xs text-muted-foreground mb-2">Date de calcul : {projection.asOfDate} (mois courant : {projection.currentMonth})</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Compte</th>
                    <th className="px-3 py-2 text-right">Budget</th>
                    <th className="px-3 py-2 text-right">YTD</th>
                    <th className="px-3 py-2 text-right">Atterrissage</th>
                    <th className="px-3 py-2 text-right">Linéaire</th>
                    <th className="px-3 py-2 text-right">Δ vs budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {projection.rows.map((r) => (
                    <tr key={r.accountId} className="hover:bg-muted/20">
                      <td className="px-3 py-2"><span className="font-medium">{r.accountCode}</span> <span className="text-muted-foreground">{r.accountLabel}</span></td>
                      <td className="px-3 py-2 text-right">{formatFCFA(r.annualBudget)}</td>
                      <td className="px-3 py-2 text-right">{formatFCFA(r.ytdActual)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatFCFA(r.projectedTotal)}</td>
                      <td className="px-3 py-2 text-right text-violet-700">{formatFCFA(r.linearProjection)}</td>
                      <td className={`px-3 py-2 text-right text-xs ${r.projectedVariance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        <span className="inline-flex items-center gap-1">
                          {r.projectedVariance > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {formatFCFA(r.projectedVariance)} ({r.projectedVariancePct.toFixed(0)}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base font-bold mt-1 ${color || ""}`}>{value}</p>
    </div>
  );
}
