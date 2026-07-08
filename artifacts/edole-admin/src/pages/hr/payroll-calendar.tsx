import React, { useState } from "react";
import { HrShell } from "./_layout";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, CalendarDays, Banknote, Users, Plus } from "lucide-react";

const API = "/api";

async function fetchJSON(url: string) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("Erreur réseau");
  return r.json();
}

type Run = { id: string; period: string; status: string; paymentDate?: string; employeeCount?: number; totalNetSalary: number; totalGrossSalary: number };
type CalendarItem = { period: string; status: string; paymentDate?: string | null; totalNetSalary: number; employeeCount?: number };

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  draft:     { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Brouillon" },
  validated: { dot: "bg-blue-500",  badge: "bg-blue-50 text-blue-700 border-blue-200",   label: "Validé" },
  paid:      { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Payé" },
  archived:  { dot: "bg-gray-400", badge: "bg-gray-50 text-gray-600 border-gray-200", label: "Archivé" },
  scheduled: { dot: "bg-indigo-400", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "Planifié" },
};

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function PayrollCalendar() {
  const [, navigate] = useLocation();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [selected, setSelected] = useState<Run | null>(null);

  const { data: runs = [], isLoading } = useQuery<Run[]>({
    queryKey: ["payroll-runs"],
    queryFn: () => fetchJSON(`${API}/payroll/runs`),
  });

  // Dashboard provides forward-looking projected cycles from active schedule
  const { data: dash } = useQuery<{ calendarItems: CalendarItem[] }>({
    queryKey: ["payroll-dashboard"],
    queryFn: () => fetchJSON(`${API}/payroll/dashboard`),
  });

  const runByPeriod = Object.fromEntries(runs.map(r => [r.period, r]));
  // Projected future cycles (status "scheduled") keyed by period
  const projectedByPeriod = Object.fromEntries(
    (dash?.calendarItems ?? []).filter(c => c.status === "scheduled").map(c => [c.period, c])
  );

  // Statistiques annuelles
  const yearRuns = runs.filter(r => r.period.startsWith(String(viewYear)));
  const yearStats = {
    total: yearRuns.length,
    totalNet: yearRuns.reduce((s, r) => s + r.totalNetSalary, 0),
    totalGross: yearRuns.reduce((s, r) => s + r.totalGrossSalary, 0),
    validated: yearRuns.filter(r => r.status === "validated" || r.status === "paid").length,
  };

  return (
    <HrShell
      title="Calendrier de paie"
      subtitle={`Vue annuelle ${viewYear} — Cycles de paie planifiés et passés`}
      actions={
        <Button size="sm" onClick={() => navigate("/rh/paie")}>
          <Plus className="w-4 h-4 mr-1" />Nouveau cycle
        </Button>
      }
    >
      {/* Nav année */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm" onClick={() => setViewYear(v => v - 1)}>
          <ChevronLeft className="w-4 h-4 mr-1" />{viewYear - 1}
        </Button>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{viewYear}</h2>
          <p className="text-xs text-muted-foreground">{yearStats.total} cycle(s) · {yearStats.validated} validé(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setViewYear(v => v + 1)}>
          {viewYear + 1} <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Stats annuelles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Cycles créés", value: String(yearStats.total), icon: CalendarDays, color: "text-blue-600 bg-blue-50" },
          { label: "Masse brute annuelle", value: formatFCFA(yearStats.totalGross), icon: Banknote, color: "text-orange-600 bg-orange-50" },
          { label: "Masse nette annuelle", value: formatFCFA(yearStats.totalNet), icon: Banknote, color: "text-emerald-600 bg-emerald-50" },
          { label: "Cycles validés", value: String(yearStats.validated), icon: Users, color: "text-purple-600 bg-purple-50" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}><k.icon className="w-4 h-4" /></div>
              <div><p className="text-xs text-muted-foreground">{k.label}</p><p className="font-bold text-sm">{k.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={`grid gap-4 ${selected ? "lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* Grille des 12 mois */}
        <div className={selected ? "lg:col-span-2" : ""}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, m) => {
              const period = `${viewYear}-${String(m + 1).padStart(2, "0")}`;
              const run = runByPeriod[period];
              const projected = !run ? projectedByPeriod[period] : null;
              const isCurrentMonth = viewYear === now.getFullYear() && m === now.getMonth();
              const isPast = new Date(viewYear, m + 1, 1) < now;
              const isFuture = new Date(viewYear, m, 1) > now;
              const style = run
                ? (STATUS_STYLES[run.status] ?? STATUS_STYLES.draft)
                : projected ? STATUS_STYLES.scheduled : null;

              return (
                <div
                  key={period}
                  onClick={() => run && setSelected(selected?.id === run.id ? null : run)}
                  className={`rounded-xl border p-4 transition-all ${
                    run
                      ? `cursor-pointer hover:shadow-md hover:border-primary/40 ${selected?.id === run.id ? "ring-2 ring-primary shadow-md" : ""}`
                      : projected
                      ? "border-indigo-200 bg-indigo-50/30"
                      : isPast ? "opacity-40 bg-muted/30 border-dashed" : isCurrentMonth ? "border-primary/30 bg-primary/5" : "border-dashed"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${isCurrentMonth ? "text-primary" : ""}`}>{MONTHS_FR[m]}</span>
                    {style && <span className={`inline-block w-2.5 h-2.5 rounded-full ${style.dot}`} />}
                  </div>
                  {run ? (
                    <div className="space-y-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${style?.badge}`}>{style?.label}</span>
                      {run.totalNetSalary > 0 && <div className="text-xs font-medium text-emerald-700 mt-1">{formatFCFA(run.totalNetSalary)}</div>}
                      {(run.employeeCount ?? 0) > 0 && <div className="text-xs text-muted-foreground">{run.employeeCount} collabs</div>}
                      {run.paymentDate && <div className="text-xs text-muted-foreground">Paiement : {new Date(run.paymentDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>}
                    </div>
                  ) : projected ? (
                    <div className="space-y-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLES.scheduled.badge}`}>Planifié</span>
                      {(projected.employeeCount ?? 0) > 0 && <div className="text-xs text-muted-foreground">{projected.employeeCount} collabs (estimé)</div>}
                      {projected.paymentDate && <div className="text-xs text-indigo-600">Paiement : {new Date(projected.paymentDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1">{isFuture ? "À planifier" : isCurrentMonth ? "Cycle en cours" : "Aucun cycle"}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Légende */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
            {Object.entries(STATUS_STYLES).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${v.dot}`} />
                {v.label}
              </span>
            ))}
          </div>
        </div>

        {/* Panneau détail */}
        {selected && (
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">Paie {selected.period}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLES[selected.status]?.badge}`}>
                      {STATUS_STYLES[selected.status]?.label}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)}>×</Button>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Masse brute", value: formatFCFA(selected.totalGrossSalary) },
                    { label: "Masse nette", value: formatFCFA(selected.totalNetSalary), highlight: true },
                    { label: "Collaborateurs", value: String(selected.employeeCount ?? 0) },
                    { label: "Date paiement", value: selected.paymentDate ? new Date(selected.paymentDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "—" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className={`text-sm font-medium ${item.highlight ? "text-emerald-700 font-bold" : ""}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-4" onClick={() => navigate(`/rh/paie/run/${selected.id}`)}>
                  Ouvrir le cycle <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Liste tabulaire complémentaire */}
      {runs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Historique complet</h3>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Période</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-right">Collaborateurs</th>
                  <th className="px-4 py-3 text-right">Masse brute</th>
                  <th className="px-4 py-3 text-right">Masse nette</th>
                  <th className="px-4 py-3 text-right">Date paiement</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {runs.map(run => {
                  const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.draft;
                  return (
                    <tr key={run.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-semibold">{run.period}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${style.badge}`}>{style.label}</span></td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{run.employeeCount ?? 0}</td>
                      <td className="px-4 py-2.5 text-right">{formatFCFA(run.totalGrossSalary)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-emerald-700">{formatFCFA(run.totalNetSalary)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{run.paymentDate ? new Date(run.paymentDate).toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="px-4 py-2.5">
                        <Button variant="ghost" size="sm" className="h-7" onClick={() => navigate(`/rh/paie/run/${run.id}`)}>
                          Ouvrir →
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </HrShell>
  );
}
