import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FolderKanban, Network, BarChart3, Activity } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell,
} from "recharts";

interface FiscalPeriod { id: string; name: string; }
interface ProjectRow {
  projectId: string; projectName: string; projectStatus: string;
  annualBudget: number; revenues: number; expenses: number; margin: number;
  budgetConsumptionPct: number; hasBudget: boolean;
}
interface DepartmentRow {
  departmentId: string; departmentName: string;
  annualBudget: number; actuals: number; variance: number; consumptionPct: number;
  projectIds: string[];
}
interface BudgetRow { id: string; name: string; versionNumber: number; status: string; }

function token() { return encodeURIComponent(localStorage.getItem("auth_token") || ""); }

export default function ReportsPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [byProject, setByProject] = useState<{ rows: ProjectRow[]; totals: any } | null>(null);
  const [byDept, setByDept] = useState<{ rows: DepartmentRow[]; totals: any } | null>(null);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [forecasts, setForecasts] = useState<BudgetRow[]>([]);

  useEffect(() => {
    apiFetch<{ data: FiscalPeriod[] }>("/api/accounting/fiscal-periods").then((r) => {
      setPeriods(r.data); if (r.data[0]) setPeriodId(r.data[0].id);
    });
  }, []);
  useEffect(() => {
    if (!periodId) return;
    apiFetch<any>(`/api/fpa/by-project?fiscalPeriodId=${periodId}`).then(setByProject);
    apiFetch<any>(`/api/fpa/by-department?fiscalPeriodId=${periodId}`).then(setByDept);
    apiFetch<{ data: BudgetRow[] }>(`/api/fpa/budgets?fiscalPeriodId=${periodId}&kind=budget`).then((r) => setBudgets(r.data));
    apiFetch<{ data: BudgetRow[] }>(`/api/fpa/budgets?fiscalPeriodId=${periodId}&kind=forecast`).then((r) => setForecasts(r.data));
  }, [periodId]);

  const projectChart = useMemo(() => byProject?.rows.slice(0, 8).map((r) => ({
    name: r.projectName.slice(0, 14), Budget: r.annualBudget, Réalisé: r.expenses,
  })) || [], [byProject]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Reporting & exports</h1>
        <p className="text-muted-foreground mt-1">Synthèses financières et exports Excel professionnels.</p>
      </div>

      <Card className="p-4">
        <Label>Période fiscale</Label>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
          <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {/* Synthèse par projet */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Synthèse par projet</h2>
          </div>
          {periodId && (
            <a href={`/api/fpa/export/by-project/${periodId}.xlsx?token=${token()}`} download>
              <Button variant="outline" size="sm"><FileSpreadsheet className="w-4 h-4 mr-2" />Export Excel</Button>
            </a>
          )}
        </div>
        {byProject && byProject.rows.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité.</p>}
        {byProject && byProject.rows.length > 0 && (
          <>
            <div className="grid lg:grid-cols-2 gap-4 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <Mini label="Budget total" value={formatFCFA(byProject.totals.annualBudget)} />
                <Mini label="Charges totales" value={formatFCFA(byProject.totals.expenses)} color="text-amber-600" />
                <Mini label="Produits" value={formatFCFA(byProject.totals.revenues)} color="text-emerald-600" />
                <Mini label="Marge" value={formatFCFA(byProject.totals.margin)}
                  color={byProject.totals.margin >= 0 ? "text-emerald-600" : "text-red-600"} />
              </div>
              <div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={projectChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatFCFA(v)} />
                    <Legend />
                    <Bar dataKey="Budget" fill="#3b82f6" />
                    <Bar dataKey="Réalisé" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Projet</th>
                    <th className="px-3 py-2 text-right">Budget</th>
                    <th className="px-3 py-2 text-right">Produits</th>
                    <th className="px-3 py-2 text-right">Charges</th>
                    <th className="px-3 py-2 text-right">Marge</th>
                    <th className="px-3 py-2 text-right">Conso. budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byProject.rows.map((r) => (
                    <tr key={r.projectId} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{r.projectName}</td>
                      <td className="px-3 py-2 text-right">{r.hasBudget ? formatFCFA(r.annualBudget) : <span className="text-muted-foreground text-xs">non budgété</span>}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{formatFCFA(r.revenues)}</td>
                      <td className="px-3 py-2 text-right text-amber-700">{formatFCFA(r.expenses)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${r.margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatFCFA(r.margin)}</td>
                      <td className="px-3 py-2 text-right">
                        {r.hasBudget ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded overflow-hidden">
                              <div className={`h-full ${r.budgetConsumptionPct > 100 ? "bg-red-500" : r.budgetConsumptionPct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(100, r.budgetConsumptionPct)}%` }} />
                            </div>
                            <span className="text-xs">{r.budgetConsumptionPct.toFixed(0)}%</span>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Synthèse par département */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Network className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Synthèse par département</h2>
        </div>
        {byDept && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Département</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Réalisé</th>
                  <th className="px-3 py-2 text-right">Écart</th>
                  <th className="px-3 py-2 text-right">Conso.</th>
                  <th className="px-3 py-2 text-center">Projets liés</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byDept.rows.map((r) => (
                  <tr key={r.departmentId} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{r.departmentName}</td>
                    <td className="px-3 py-2 text-right">{formatFCFA(r.annualBudget)}</td>
                    <td className="px-3 py-2 text-right">{formatFCFA(r.actuals)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.variance > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatFCFA(r.variance)}</td>
                    <td className="px-3 py-2 text-right text-xs">{r.consumptionPct.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">{r.projectIds.length || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Exports rapides */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Exports Excel par budget</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><BarChart3 className="w-4 h-4" /> Budgets</h3>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {budgets.length === 0 && <p className="text-sm text-muted-foreground">Aucun budget.</p>}
              {budgets.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/30">
                  <span className="text-sm truncate">{b.name} <Badge variant="outline" className="ml-1 text-[10px]">v{b.versionNumber}</Badge></span>
                  <div className="flex gap-1 shrink-0">
                    <a href={`/api/fpa/export/budget/${b.id}.xlsx?token=${token()}`} download title="Budget">
                      <Button size="sm" variant="ghost"><FileSpreadsheet className="w-4 h-4" /></Button>
                    </a>
                    <a href={`/api/fpa/export/variance/${b.id}.xlsx?token=${token()}`} download title="Variance">
                      <Button size="sm" variant="ghost"><Activity className="w-4 h-4" /></Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Activity className="w-4 h-4" /> Forecasts</h3>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {forecasts.length === 0 && <p className="text-sm text-muted-foreground">Aucun forecast.</p>}
              {forecasts.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/30">
                  <span className="text-sm truncate">{b.name} <Badge variant="outline" className="ml-1 text-[10px]">v{b.versionNumber}</Badge></span>
                  <a href={`/api/fpa/export/forecast/${b.id}.xlsx?token=${token()}`} download>
                    <Button size="sm" variant="ghost"><FileSpreadsheet className="w-4 h-4" /></Button>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
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
