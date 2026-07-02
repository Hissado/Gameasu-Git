/**
 * Pointage & Paie BTP — États de salaires (tableau récapitulatif + ajustements)
 */
import React, { useState } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Calculator, Users, Banknote, TrendingUp, Receipt,
  RefreshCw, ChevronDown, ChevronUp, Edit2, CheckCircle,
  FileSpreadsheet, AlertCircle,
} from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

type Period = { id: string; label: string; startDate: string; endDate: string; status: string };
type ReportRow = {
  report: {
    id: string; collaboratorId: string; payPeriodId: string;
    daysPresent: number; daysHoliday: number; daysSick: number; daysAbsent: number; daysLeave: number;
    daysTotalValorized: number;
    hoursNormal: string; hoursHs20: string; hoursHs40: string; hoursHsSunday: string;
    baseSalary: string; sursalaire: string; hourlyRate: string;
    baseSalaryProrated: string;
    amountHs20: string; amountHs40: string; amountHsSunday: string; amountHs100: string;
    grossSalary: string;
    cnssEmployee: string; irppBase: string; irppAmount: string;
    totalDeductions: string; netSalary: string;
    cnssEmployer: string; leaveProvision: string; totalEmployerCost: string;
    primeResponsabilite: string; primeSalissure: string; indemTransport: string;
    advanceSalary: string; netFinal: string;
    dependentsCount: number; status: string;
    weeklyBreakdown?: any[];
  };
  firstName: string; lastName: string; employeeNumber?: string;
};

function n(s: string | number | undefined) { return parseFloat(String(s ?? 0)) || 0; }

function SalaryCard({ label, value, sub, color = "gray" }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    orange: "border-orange-200 bg-orange-50",
    green: "border-emerald-200 bg-emerald-50",
    red: "border-red-200 bg-red-50",
    blue: "border-blue-200 bg-blue-50",
    gray: "border-gray-200 bg-gray-50",
  };
  return (
    <Card className={`border ${colors[color]}`}>
      <CardContent className="pt-4 pb-3">
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="text-xl font-bold text-gray-800">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function WeeklyBreakdownRow({ week }: { week: any }) {
  if (!week) return null;
  return (
    <tr className="text-xs border-t border-gray-100">
      <td className="px-3 py-1 text-gray-500">Sem. {week.week} ({week.weekStart}→{week.weekEnd})</td>
      <td className="px-2 py-1 text-center">{week.totalWeek}h</td>
      <td className="px-2 py-1 text-center text-gray-600">{week.hoursNormal}h</td>
      <td className="px-2 py-1 text-center text-orange-600">{week.hoursHs20}h</td>
      <td className="px-2 py-1 text-center text-red-500">{week.hoursHs40}h</td>
      <td className="px-2 py-1 text-center text-amber-600">{week.hoursHsSunday}h</td>
    </tr>
  );
}

function ReportDetailPanel({ row, onClose, onSave }: {
  row: ReportRow;
  onClose: () => void;
  onSave: (patch: any) => void;
}) {
  const { report } = row;
  const [patch, setPatch] = useState({
    primeResponsabilite: n(report.primeResponsabilite),
    primeSalissure: n(report.primeSalissure),
    indemTransport: n(report.indemTransport),
    advanceSalary: n(report.advanceSalary),
    dependentsCount: report.dependentsCount ?? 0,
    sursalaire: n(report.sursalaire),
  });
  const [showWeeks, setShowWeeks] = useState(false);

  return (
    <div className="space-y-4">
      {/* Nom */}
      <div className="font-semibold text-gray-800 text-base">
        {row.lastName} {row.firstName}
        {row.employeeNumber && <span className="text-gray-400 text-sm ml-2">#{row.employeeNumber}</span>}
      </div>

      {/* Présence */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Présents", value: report.daysPresent, color: "text-emerald-600" },
          { label: "Fériés", value: report.daysHoliday, color: "text-amber-600" },
          { label: "Malades", value: report.daysSick, color: "text-blue-600" },
          { label: "Absents", value: report.daysAbsent, color: "text-red-500" },
          { label: "Congés", value: report.daysLeave, color: "text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="text-center border rounded-lg p-2 bg-gray-50">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heures */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        {[
          { label: "H.Norm.", value: `${n(report.hoursNormal)}h`, color: "bg-gray-50" },
          { label: "HS 20%", value: `${n(report.hoursHs20)}h`, color: "bg-orange-50" },
          { label: "HS 40%", value: `${n(report.hoursHs40)}h`, color: "bg-red-50" },
          { label: "HS Dim/Fér.", value: `${n(report.hoursHsSunday)}h`, color: "bg-amber-50" },
        ].map((s) => (
          <div key={s.label} className={`text-center border rounded-lg p-2 ${s.color}`}>
            <div className="text-sm font-bold text-gray-700">{s.value}</div>
            <div className="text-[10px] text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Détail semaines */}
      {report.weeklyBreakdown && report.weeklyBreakdown.length > 0 && (
        <div>
          <button
            onClick={() => setShowWeeks(!showWeeks)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            {showWeeks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Détail par semaine
          </button>
          {showWeeks && (
            <table className="w-full mt-2 border rounded">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-1 text-left">Semaine</th>
                  <th className="px-2 py-1">Total</th>
                  <th className="px-2 py-1">Norm.</th>
                  <th className="px-2 py-1">HS20%</th>
                  <th className="px-2 py-1">HS40%</th>
                  <th className="px-2 py-1">HSDim</th>
                </tr>
              </thead>
              <tbody>
                {report.weeklyBreakdown.map((w, i) => <WeeklyBreakdownRow key={i} week={w} />)}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Calcul salaire */}
      <div className="space-y-1 text-xs border-t pt-3">
        <div className="flex justify-between">
          <span className="text-gray-500">Taux horaire</span>
          <span className="font-mono">{formatFCFA(n(report.hourlyRate))}/h</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Sal. base proraté ({report.daysTotalValorized}j)</span>
          <span className="font-mono">{formatFCFA(n(report.baseSalaryProrated))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Montant HS 20%</span>
          <span className="font-mono text-orange-600">{formatFCFA(n(report.amountHs20))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Montant HS 40%</span>
          <span className="font-mono text-red-500">{formatFCFA(n(report.amountHs40))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Montant HS Dim/Fér.</span>
          <span className="font-mono text-amber-600">{formatFCFA(n(report.amountHsSunday))}</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>Salaire BRUT</span>
          <span>{formatFCFA(n(report.grossSalary))}</span>
        </div>
        <div className="flex justify-between text-red-500">
          <span>CNSS (9%)</span>
          <span>- {formatFCFA(n(report.cnssEmployee))}</span>
        </div>
        <div className="flex justify-between text-red-500">
          <span>IRPP</span>
          <span>- {formatFCFA(n(report.irppAmount))}</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold text-emerald-700">
          <span>Salaire NET</span>
          <span>{formatFCFA(n(report.netSalary))}</span>
        </div>
      </div>

      {/* Ajustements manuels */}
      <div className="border-t pt-3">
        <div className="text-xs font-semibold text-gray-600 mb-2">Ajustements / Primes</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "primeResponsabilite", label: "Prime resp." },
            { key: "primeSalissure", label: "Prime salissure" },
            { key: "indemTransport", label: "Indem. transport" },
            { key: "advanceSalary", label: "Avances à déduire" },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label className="text-[10px]">{label}</Label>
              <Input
                type="number" min={0} step={100}
                value={(patch as any)[key]}
                onChange={(e) => setPatch((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                className="h-7 text-xs"
              />
            </div>
          ))}
          <div>
            <Label className="text-[10px]">Personnes à charge</Label>
            <Input
              type="number" min={0} max={6}
              value={patch.dependentsCount}
              onChange={(e) => setPatch((p) => ({ ...p, dependentsCount: parseInt(e.target.value) || 0 }))}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px]">Sursalaire</Label>
            <Input
              type="number" min={0} step={500}
              value={patch.sursalaire}
              onChange={(e) => setPatch((p) => ({ ...p, sursalaire: parseFloat(e.target.value) || 0 }))}
              className="h-7 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Fermer</Button>
        <Button onClick={() => { onSave(patch); onClose(); }} className="flex-1">
          <CheckCircle className="w-4 h-4 mr-1" />Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function BtpPaie() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<ReportRow | null>(null);

  const { data: periods = [], isLoading: periodsLoading } = useQuery<Period[]>({
    queryKey: ["btp-periods"],
    queryFn: () => fetchJSON(`${API}/btp/periods`),
  });
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  const { data: reports = [], isLoading: reportsLoading } = useQuery<ReportRow[]>({
    queryKey: ["btp-reports", selectedPeriodId],
    queryFn: () => fetchJSON(`${API}/btp/periods/${selectedPeriodId}/reports`),
    enabled: !!selectedPeriodId,
  });

  const calculateMut = useMutation({
    mutationFn: () => fetchJSON(`${API}/btp/periods/${selectedPeriodId}/calculate`, { method: "POST" }),
    onSuccess: (r) => {
      toast({ title: `Paie calculée pour ${r.calculated} agents` });
      qc.invalidateQueries({ queryKey: ["btp-reports", selectedPeriodId] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur de calcul", description: e.message }),
  });

  const patchMut = useMutation({
    mutationFn: ({ collaboratorId, patch }: { collaboratorId: string; patch: any }) =>
      fetchJSON(`${API}/btp/periods/${selectedPeriodId}/reports/${collaboratorId}`, {
        method: "PATCH", body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      toast({ title: "Rapport mis à jour" });
      qc.invalidateQueries({ queryKey: ["btp-reports", selectedPeriodId] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const comptabiliserMut = useMutation({
    mutationFn: () => fetchJSON(`${API}/btp/periods/${selectedPeriodId}/post-accounting`, { method: "POST" }),
    onSuccess: (d: any) => toast({ title: `Écriture comptable créée`, description: `N° ${d.entryNumber}` }),
    onError: (e: Error) => toast({ variant: "destructive", title: "Comptabilisation impossible", description: e.message }),
  });

  // KPIs agrégés
  const kpis = reports.reduce(
    (acc, r) => ({
      totalBrut: acc.totalBrut + n(r.report.grossSalary),
      totalNet: acc.totalNet + n(r.report.netSalary),
      totalNetFinal: acc.totalNetFinal + n(r.report.netFinal),
      totalCnssEmpl: acc.totalCnssEmpl + n(r.report.cnssEmployer),
      totalIrpp: acc.totalIrpp + n(r.report.irppAmount),
      count: acc.count + 1,
    }),
    { totalBrut: 0, totalNet: 0, totalNetFinal: 0, totalCnssEmpl: 0, totalIrpp: 0, count: 0 },
  );

  const PERIOD_STATUS_COLOR: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    open: "bg-blue-50 text-blue-700 border-blue-200",
    locked: "bg-gray-100 text-gray-600 border-gray-300",
  };

  return (
    <HrShell
      title="États de salaires"
      subtitle="Récapitulatif mensuel — CNSS / IRPP / Net à payer"
      actions={
        selectedPeriodId ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => calculateMut.mutate()} disabled={calculateMut.isPending}>
              <Calculator className="w-4 h-4 mr-1" />
              {calculateMut.isPending ? "Calcul…" : "Recalculer"}
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => window.open(`${API}/btp/periods/${selectedPeriodId}/export/salaires.xlsx?token=${localStorage.getItem("auth_token")}`, "_blank")}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1" />Export Excel
            </Button>
            <Button
              size="sm" variant="outline"
              className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              onClick={() => { if (confirm("Générer les écritures comptables SYSCOHADA pour cette période ?")) comptabiliserMut.mutate(); }}
              disabled={comptabiliserMut.isPending}
            >
              <Receipt className="w-4 h-4 mr-1" />
              {comptabiliserMut.isPending ? "En cours…" : "Comptabiliser"}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex gap-4 h-full min-h-0">
        {/* Sélecteur période */}
        <div className="w-52 shrink-0 flex flex-col gap-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Périodes</div>
          {periodsLoading ? (
            <div className="text-sm text-gray-400">Chargement…</div>
          ) : (
            periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriodId(p.id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  p.id === selectedPeriodId
                    ? "border-orange-400 bg-orange-50 shadow-sm"
                    : "border-gray-200 hover:border-orange-200 hover:bg-orange-50/50"
                }`}
              >
                <div className="font-semibold text-gray-800">{p.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{p.startDate} → {p.endDate}</div>
                <Badge className={`text-[10px] mt-1 ${PERIOD_STATUS_COLOR[p.status] ?? ""}`}>
                  {p.status}
                </Badge>
              </button>
            ))
          )}
        </div>

        {/* Zone centrale */}
        <div className="flex-1 min-w-0 overflow-auto space-y-4">
          {!selectedPeriodId ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Banknote className="w-12 h-12 opacity-30" />
              <div className="text-sm">Sélectionnez une période pour afficher les états de salaires</div>
            </div>
          ) : reportsLoading ? (
            <div className="flex items-center gap-2 text-gray-400 pt-10">
              <RefreshCw className="w-4 h-4 animate-spin" />Chargement…
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <AlertCircle className="w-10 h-10 opacity-30" />
              <div className="text-sm">Aucun rapport calculé pour cette période.</div>
              <div className="text-xs">Saisissez le pointage puis cliquez sur « Recalculer ».</div>
              <Button size="sm" onClick={() => calculateMut.mutate()} disabled={calculateMut.isPending}>
                <Calculator className="w-4 h-4 mr-1" />Calculer la paie
              </Button>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-5 gap-3">
                <SalaryCard label="Agents" value={String(kpis.count)} color="gray" />
                <SalaryCard label="Masse salariale brute" value={formatFCFA(kpis.totalBrut)} color="orange" />
                <SalaryCard label="Total net à payer" value={formatFCFA(kpis.totalNetFinal)} color="green" />
                <SalaryCard label="CNSS employeur" value={formatFCFA(kpis.totalCnssEmpl)} color="blue" />
                <SalaryCard label="IRPP total" value={formatFCFA(kpis.totalIrpp)} color="red" />
              </div>

              {/* Tableau */}
              <div className="rounded-lg border border-gray-200 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">Agent</TableHead>
                      <TableHead className="text-xs text-center">Jours Val.</TableHead>
                      <TableHead className="text-xs text-center">H.Norm</TableHead>
                      <TableHead className="text-xs text-center">HS20%</TableHead>
                      <TableHead className="text-xs text-center">HS40%</TableHead>
                      <TableHead className="text-xs text-right">Brut</TableHead>
                      <TableHead className="text-xs text-right">CNSS (9%)</TableHead>
                      <TableHead className="text-xs text-right">IRPP</TableHead>
                      <TableHead className="text-xs text-right">Net</TableHead>
                      <TableHead className="text-xs text-right font-bold text-orange-700">Net Final</TableHead>
                      <TableHead className="text-xs text-center">Statut</TableHead>
                      <TableHead className="text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map(({ report: r, firstName, lastName, employeeNumber }, idx) => (
                      <TableRow key={r.collaboratorId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <TableCell className="text-xs font-medium">
                          <div>{lastName} {firstName}</div>
                          {employeeNumber && <div className="text-[10px] text-gray-400">{employeeNumber}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-center">{r.daysTotalValorized}</TableCell>
                        <TableCell className="text-xs text-center">{parseFloat(r.hoursNormal).toFixed(1)}h</TableCell>
                        <TableCell className="text-xs text-center text-orange-600">{parseFloat(r.hoursHs20).toFixed(1)}h</TableCell>
                        <TableCell className="text-xs text-center text-red-500">{parseFloat(r.hoursHs40).toFixed(1)}h</TableCell>
                        <TableCell className="text-xs text-right">{formatFCFA(n(r.grossSalary))}</TableCell>
                        <TableCell className="text-xs text-right text-red-500">- {formatFCFA(n(r.cnssEmployee))}</TableCell>
                        <TableCell className="text-xs text-right text-red-500">- {formatFCFA(n(r.irppAmount))}</TableCell>
                        <TableCell className="text-xs text-right">{formatFCFA(n(r.netSalary))}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-emerald-700">
                          {formatFCFA(n(r.netFinal))}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Badge className={r.status === "validated"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"}>
                            {r.status === "validated" ? "Validé" : "Brouillon"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => setEditRow({ report: r, firstName, lastName, employeeNumber })}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Ligne totaux */}
              <div className="flex justify-end gap-6 text-sm font-semibold border-t pt-3">
                <span>Total brut : <span className="text-orange-600">{formatFCFA(kpis.totalBrut)}</span></span>
                <span>Total net final : <span className="text-emerald-700">{formatFCFA(kpis.totalNetFinal)}</span></span>
                <span>CNSS employeur : <span className="text-blue-600">{formatFCFA(kpis.totalCnssEmpl)}</span></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Panneau édition */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail bulletin de paie</DialogTitle>
          </DialogHeader>
          {editRow && (
            <ReportDetailPanel
              row={editRow}
              onClose={() => setEditRow(null)}
              onSave={(patch) => patchMut.mutate({ collaboratorId: editRow.report.collaboratorId, patch })}
            />
          )}
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
