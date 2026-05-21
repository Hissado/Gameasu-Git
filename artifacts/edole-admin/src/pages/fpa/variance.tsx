import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, AlertTriangle } from "lucide-react";

interface BudgetRow { id: string; name: string; kind: string; versionNumber: number; status: string; fiscalPeriodId: string; }
interface FiscalPeriod { id: string; name: string; }
interface VarianceCell { period: string; budget: number; actual: number; variance: number; variancePct: number; }
interface VarianceRow {
  accountId: string; accountCode: string; accountLabel: string; classNum: number; normalBalance: string;
  cells: VarianceCell[]; totalBudget: number; totalActual: number; totalVariance: number; totalVariancePct: number;
}
interface VarianceReport {
  budget: any; fiscalPeriod: FiscalPeriod;
  months: string[]; rows: VarianceRow[];
  monthlyTotals: Array<{ period: string; budget: number; actual: number; variance: number }>;
  totals: { budget: number; actual: number; variance: number };
}

const MONTH_LABEL: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr", "05": "Mai", "06": "Juin",
  "07": "Juil", "08": "Août", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

export default function VariancePage() {
  const [location] = useLocation();
  const initialBudgetId = new URLSearchParams(location.split("?")[1] || "").get("budgetId") || "";

  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [budgetId, setBudgetId] = useState(initialBudgetId);
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOnlyVariances, setShowOnlyVariances] = useState(false);

  useEffect(() => {
    apiFetch<{ data: FiscalPeriod[] }>("/api/accounting/fiscal-periods").then((r) => {
      setPeriods(r.data);
      if (!initialBudgetId && r.data[0]) setPeriodId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (initialBudgetId && !report) {
      apiFetch<VarianceReport>(`/api/fpa/variance?budgetId=${initialBudgetId}`).then(setReport).catch(() => {});
    }
  }, [initialBudgetId]);

  useEffect(() => {
    if (!periodId) return;
    apiFetch<{ data: BudgetRow[] }>(`/api/fpa/budgets?fiscalPeriodId=${periodId}&kind=budget`)
      .then((r) => setBudgets(r.data));
  }, [periodId]);

  useEffect(() => {
    if (!budgetId) return;
    setLoading(true);
    apiFetch<VarianceReport>(`/api/fpa/variance?budgetId=${budgetId}`)
      .then(setReport).catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [budgetId]);

  const filteredRows = report ? (showOnlyVariances ? report.rows.filter((r) => Math.abs(r.totalVariance) > 0.01) : report.rows) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Analyse de variance</h1>
          <p className="text-muted-foreground mt-1">Réalisé vs budget par compte et par mois.</p>
        </div>
        {report && (
          <a href={`/api/fpa/export/variance/${report.budget.id}.xlsx?token=${encodeURIComponent(localStorage.getItem("auth_token") || "")}`} download>
            <Button><FileSpreadsheet className="w-4 h-4 mr-2" />Exporter Excel</Button>
          </a>
        )}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Période</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Budget à analyser</Label>
            <Select value={budgetId} onValueChange={setBudgetId}>
              <SelectTrigger><SelectValue placeholder="Choisir un budget…" /></SelectTrigger>
              <SelectContent>
                {budgets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} (v{b.versionNumber}) — {b.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {!loading && !report && budgetId && (
        <Card className="p-6 text-center text-muted-foreground">Aucune donnée.</Card>
      )}

      {report && (
        <>
          {/* Totaux globaux */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiBlock label="Budget total" value={formatFCFA(report.totals.budget)} color="text-blue-600" />
            <KpiBlock label="Réalisé total" value={formatFCFA(report.totals.actual)} color="text-emerald-600" />
            <KpiBlock label="Écart total"
              value={formatFCFA(report.totals.variance)}
              color={report.totals.variance > 0 ? "text-amber-700" : "text-emerald-600"}
            />
            <KpiBlock label="% écart"
              value={report.totals.budget !== 0 ? `${((report.totals.variance / Math.abs(report.totals.budget)) * 100).toFixed(1)} %` : "-"}
              color={report.totals.variance > 0 ? "text-amber-700" : "text-emerald-600"}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyVariances}
                onChange={(e) => setShowOnlyVariances(e.target.checked)}
              />
              N'afficher que les comptes avec un écart
            </label>
            <Badge variant="outline">{filteredRows.length} ligne(s)</Badge>
          </div>

          {/* Tableau détail */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-0 w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/40">
                    <th rowSpan={2} className="px-3 py-2 text-left sticky left-0 bg-muted/40 z-20 min-w-[240px] border-b border-r">Compte</th>
                    {report.months.map((m) => (
                      <th key={m} colSpan={3} className="px-2 py-1 text-center border-b border-l text-[11px]">
                        {MONTH_LABEL[m.slice(5)]} {m.slice(0, 4)}
                      </th>
                    ))}
                    <th colSpan={3} className="px-2 py-1 text-center border-b border-l bg-amber-100 sticky right-0 z-20">TOTAL</th>
                  </tr>
                  <tr className="bg-muted/30 text-[10px]">
                    {report.months.map((m) => (
                      <Cells3 key={m} />
                    ))}
                    <th className="px-1 py-1 border-b border-l text-right bg-amber-100 sticky right-[222px] z-20 min-w-[110px]">Bud.</th>
                    <th className="px-1 py-1 border-b text-right bg-amber-100 sticky right-[112px] z-20 min-w-[110px]">Réal.</th>
                    <th className="px-1 py-1 border-b text-right bg-amber-100 sticky right-0 z-20 min-w-[112px]">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.accountId} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5 sticky left-0 bg-card hover:bg-muted/30 border-b border-r">
                        <div className="font-medium">{r.accountCode}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">{r.accountLabel}</div>
                      </td>
                      {r.cells.map((c) => (
                        <CellGroup key={c.period} cell={c} />
                      ))}
                      <td className="px-1 py-1.5 text-right bg-amber-50 border-b border-l sticky right-[222px] font-semibold">{formatFCFA(r.totalBudget)}</td>
                      <td className="px-1 py-1.5 text-right bg-amber-50 border-b font-semibold sticky right-[112px]">{formatFCFA(r.totalActual)}</td>
                      <td className={`px-1 py-1.5 text-right bg-amber-50 border-b font-semibold sticky right-0 ${r.totalVariance > 0 ? "text-amber-700" : r.totalVariance < 0 ? "text-emerald-700" : ""}`}>
                        {formatFCFA(r.totalVariance)}
                        <div className="text-[10px] opacity-70">{r.totalVariancePct.toFixed(0)}%</div>
                      </td>
                    </tr>
                  ))}
                  {/* Totaux par mois */}
                  <tr className="bg-amber-100 font-bold">
                    <td className="px-3 py-2 sticky left-0 bg-amber-100 border-t-2 border-amber-300">TOTAL</td>
                    {report.monthlyTotals.map((m) => (
                      <CellGroup key={m.period} cell={{ ...m, variancePct: m.budget !== 0 ? (m.variance / Math.abs(m.budget)) * 100 : 0 }} />
                    ))}
                    <td className="px-1 py-2 text-right border-t-2 border-amber-300 sticky right-[222px] bg-amber-200">{formatFCFA(report.totals.budget)}</td>
                    <td className="px-1 py-2 text-right border-t-2 border-amber-300 sticky right-[112px] bg-amber-200">{formatFCFA(report.totals.actual)}</td>
                    <td className="px-1 py-2 text-right border-t-2 border-amber-300 sticky right-0 bg-amber-200">{formatFCFA(report.totals.variance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {Math.abs(report.totals.variance) > Math.abs(report.totals.budget) * 0.1 && (
            <Card className="p-4 border-amber-200 bg-amber-50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-900">Écart significatif détecté</p>
                  <p className="text-amber-800">L'écart global dépasse 10 % du budget. Une analyse approfondie est recommandée.</p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Cells3() {
  return (<>
    <th className="px-1 py-1 border-b border-l text-right min-w-[80px]">Bud.</th>
    <th className="px-1 py-1 border-b text-right min-w-[80px]">Réal.</th>
    <th className="px-1 py-1 border-b text-right min-w-[80px]">Écart</th>
  </>);
}
function CellGroup({ cell }: { cell: { period: string; budget: number; actual: number; variance: number; variancePct: number } }) {
  return (<>
    <td className="px-1 py-1.5 text-right border-b border-l text-[11px] text-muted-foreground">{cell.budget ? formatFCFA(cell.budget) : "—"}</td>
    <td className="px-1 py-1.5 text-right border-b text-[11px]">{cell.actual ? formatFCFA(cell.actual) : "—"}</td>
    <td className={`px-1 py-1.5 text-right border-b text-[11px] font-medium ${cell.variance > 0 ? "text-amber-700" : cell.variance < 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
      {cell.variance ? formatFCFA(cell.variance) : "—"}
    </td>
  </>);
}

function KpiBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg sm:text-xl font-bold mt-1 ${color}`}>{value}</p>
    </Card>
  );
}
