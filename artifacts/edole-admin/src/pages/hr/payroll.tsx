import React, { useState } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { useLocation } from "wouter";
import {
  Plus, Play, CalendarDays, Users, TrendingUp, Banknote, Receipt,
  Zap, AlertCircle, Download, Upload, CheckCircle, ArrowRight,
  Clock, Building2, FileText, ChevronRight, RefreshCw, Wrench, ClipboardList,
} from "lucide-react";
import { FieldTooltip, FieldHint } from "@/components/ui/field-tooltip";

const API = "/api";

async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const STATUS_LABEL: Record<string, string> = { draft: "Brouillon", validated: "Validé", paid: "Payé", archived: "Archivé" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  validated: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-gray-50 text-gray-600 border-gray-200",
};

type DashboardData = {
  nextRun: { id: string; period: string; status: string; paymentDate?: string; employeeCount?: number; totalGrossSalary: number; totalNetSalary: number } | null;
  activeSchedule: { name: string; frequency: string; cutoffDay1?: number; cutoffDay2?: number } | null;
  kpis: { totalGross: number; totalNet: number; totalCnssEmployer: number; totalIrpp: number; avgEmployeeCount: number; runCount: number; draftCount: number };
  calendarItems: Array<{ period: string; status: string; paymentDate?: string; totalNetSalary: number; employeeCount?: number }>;
  pendingCorrections: number;
  pendingDeclarations: number;
  recentRuns: Array<{ id: string; period: string; status: string; employeeCount?: number; totalGrossSalary: number; totalNetSalary: number; paymentDate?: string }>;
};

const FREQ_LABEL: Record<string, string> = { monthly: "Mensuelle", bimonthly: "Bimensuelle", weekly: "Hebdomadaire", custom: "Personnalisée" };

export default function PayrollDashboard() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [newForm, setNewForm] = useState({ period: "", notes: "", paymentDate: "" });
  const [corrForm, setCorrForm] = useState({ collaboratorId: "", sourceRunId: "", amount: "", reason: "" });

  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: dash, isLoading } = useQuery<DashboardData>({
    queryKey: ["payroll-dashboard"],
    queryFn: () => fetchJSON(`${API}/payroll/dashboard`),
  });

  const { data: collabs = [] } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ["collabs-list"],
    queryFn: () => fetchJSON(`${API}/hr/collaborators`),
  });

  const createRun = useMutation({
    mutationFn: (d: typeof newForm) => fetchJSON(`${API}/payroll/runs`, { method: "POST", body: JSON.stringify(d) }),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      setNewOpen(false);
      toast({ title: "Cycle créé", description: `Période ${run.period}` });
      navigate(`/rh/paie/run/${run.id}`);
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const seedDemoMut = useMutation({
    mutationFn: () => fetchJSON(`${API}/payroll/seed-demo`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-dashboard"] }); toast({ title: "Données démo créées" }); },
  });

  const createCorrectionMut = useMutation({
    mutationFn: (d: typeof corrForm) => fetchJSON(`${API}/payroll/corrections`, { method: "POST", body: JSON.stringify({ ...d, amount: Number(d.amount), sourceRunId: d.sourceRunId || undefined }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll-dashboard"] }); setCorrectionOpen(false); toast({ title: "Correction créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const kpis = dash?.kpis;
  const nextRun = dash?.nextRun;
  const recentRuns = dash?.recentRuns ?? [];

  const quickActions = [
    { label: "Lancer une paie", icon: Play, color: "bg-primary text-primary-foreground", desc: "Démarrer un nouveau cycle de paie", action: () => { setNewForm({ period: defaultPeriod, notes: "", paymentDate: "" }); setNewOpen(true); } },
    { label: "Déclarations CNSS/IRPP", icon: ClipboardList, color: "bg-red-50 text-red-700 border border-red-200", desc: "États fiscaux mensuels", action: () => navigate("/rh/paie/declarations") },
    { label: "Paie hors-cycle", icon: Zap, color: "bg-orange-50 text-orange-700 border border-orange-200", desc: "Prime, acompte, régularisation", action: () => navigate("/rh/paie/hors-cycle") },
    { label: "Corriger une paie", icon: Wrench, color: "bg-amber-50 text-amber-700 border border-amber-200", desc: "Ajuster une erreur de paie", action: () => setCorrectionOpen(true) },
    { label: "Calendrier de paie", icon: CalendarDays, color: "bg-blue-50 text-blue-700 border border-blue-200", desc: "Vue mensuelle des cycles", action: () => navigate("/rh/paie/calendrier") },
    { label: "Ordres de virement", icon: Banknote, color: "bg-emerald-50 text-emerald-700 border border-emerald-200", desc: "Gérer les virements bancaires", action: () => navigate("/rh/virements") },
  ];

  return (
    <HrShell title="Paie" subtitle="Préparez et validez les cycles de paie, bulletins et cotisations">
      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Chargement…</div>
      ) : (
        <div className="space-y-6">

          {/* ─── BLOC "À VENIR" ─── */}
          {nextRun ? (
            <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLOR[nextRun.status]}`}>
                        {STATUS_LABEL[nextRun.status]}
                      </span>
                      {dash?.activeSchedule && (
                        <span className="text-xs text-muted-foreground">{FREQ_LABEL[dash.activeSchedule.frequency]}</span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold">Paie {nextRun.period}</h2>
                    <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                      {nextRun.paymentDate && (
                        <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Paiement : {new Date(nextRun.paymentDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
                      )}
                      {(nextRun.employeeCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{nextRun.employeeCount} collaborateur{(nextRun.employeeCount ?? 0) > 1 ? "s" : ""}</span>
                      )}
                      {nextRun.totalNetSalary > 0 && (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium"><Banknote className="w-3.5 h-3.5" />{formatFCFA(nextRun.totalNetSalary)} net</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/rh/paie/run/${nextRun.id}`)}>
                    Modifier <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button size="sm" onClick={() => navigate(`/rh/paie/run/${nextRun.id}`)}>
                    <Play className="w-4 h-4 mr-1" />Lancer la paie
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Banknote className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Aucun cycle de paie en cours</h3>
              <p className="text-sm text-muted-foreground mb-4">Créez votre premier cycle de paie pour cette période</p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => { setNewForm({ period: defaultPeriod, notes: "", paymentDate: "" }); setNewOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1" />Nouveau cycle de paie
                </Button>
                <Button variant="outline" onClick={() => seedDemoMut.mutate()} disabled={seedDemoMut.isPending}>
                  <RefreshCw className="w-4 h-4 mr-1" />Données démo
                </Button>
              </div>
            </div>
          )}

          {/* ─── ALERTES ─── */}
          {(dash?.pendingDeclarations ?? 0) > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span><strong>{dash!.pendingDeclarations} cycle{dash!.pendingDeclarations > 1 ? "s" : ""} validé{dash!.pendingDeclarations > 1 ? "s" : ""}</strong> sans déclarations CNSS/IRPP générées — à soumettre à la CNSS et à l'OTR.</span>
              <Button variant="link" size="sm" className="ml-auto text-red-800 h-auto p-0 whitespace-nowrap" onClick={() => navigate("/rh/paie/declarations")}>Générer →</Button>
            </div>
          )}
          {(dash?.pendingCorrections ?? 0) > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{dash!.pendingCorrections} correction(s) de paie en attente d'approbation</span>
              <Button variant="link" size="sm" className="ml-auto text-amber-800 h-auto p-0" onClick={() => navigate("/rh/paie/corrections")}>Voir →</Button>
            </div>
          )}

          {/* ─── KPIs (12 derniers mois) ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Masse brute (cumulée)", value: formatFCFA(kpis?.totalGross ?? 0), icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
              { label: "Masse nette (cumulée)", value: formatFCFA(kpis?.totalNet ?? 0), icon: Banknote, color: "text-emerald-600 bg-emerald-50" },
              { label: "Charge patronale CNSS", value: formatFCFA(kpis?.totalCnssEmployer ?? 0), icon: Building2, color: "text-orange-600 bg-orange-50" },
              { label: "Moy. collaborateurs/cycle", value: String(kpis?.avgEmployeeCount ?? 0), icon: Users, color: "text-purple-600 bg-purple-50" },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.color}`}>
                      <k.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                      <p className="text-lg font-bold truncate">{k.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ─── OPTIONS RAPIDES ─── */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Actions rapides</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.action}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all hover:scale-105 hover:shadow-md ${a.color}`}
                >
                  <a.icon className="w-6 h-6" />
                  <span className="text-xs font-semibold leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── MINI-CALENDRIER DES CYCLES ─── */}
          {(dash?.calendarItems?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Calendrier de paie — 6 prochains cycles</h2>
                <Button size="sm" variant="ghost" onClick={() => navigate("/rh/paie/calendrier")}>
                  <CalendarDays className="w-4 h-4 mr-1" />Vue complète
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {dash!.calendarItems.slice(0, 6).map((item) => {
                  const [year, mon] = item.period.split("-");
                  const monthName = new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
                  const isProjected = item.status === "projected";
                  return (
                    <div
                      key={item.period}
                      className={`rounded-xl border p-3 text-center transition-all ${
                        isProjected
                          ? "border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground"
                          : STATUS_COLOR[item.status] ?? "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide mb-1">{monthName} {year}</div>
                      {!isProjected && item.totalNetSalary > 0 && (
                        <div className="text-xs font-bold truncate">{formatFCFA(item.totalNetSalary)}</div>
                      )}
                      {!isProjected && item.paymentDate && (
                        <div className="text-[10px] mt-1 opacity-70">
                          Paie le {new Date(item.paymentDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </div>
                      )}
                      {isProjected && (
                        <div className="text-[10px] mt-1 flex items-center justify-center gap-0.5 opacity-60">
                          <Clock className="w-2.5 h-2.5" />Prévisionnel
                        </div>
                      )}
                      <div className="mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${isProjected ? "border-muted-foreground/20 text-muted-foreground bg-transparent" : STATUS_COLOR[item.status] ?? ""}`}>
                          {isProjected ? "À venir" : STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── CYCLES RÉCENTS ─── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Cycles récents</h2>
              <Button size="sm" variant="ghost" onClick={() => { setNewForm({ period: defaultPeriod, notes: "", paymentDate: "" }); setNewOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" />Nouveau cycle
              </Button>
            </div>
            {recentRuns.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground rounded-lg border border-dashed">Aucun cycle de paie créé</div>
            ) : (
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
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.map((run) => (
                      <tr key={run.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/rh/paie/run/${run.id}`)}>
                        <td className="px-4 py-3 font-semibold">{run.period}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLOR[run.status] ?? ""}`}>
                            {STATUS_LABEL[run.status] ?? run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{run.employeeCount ?? 0}</td>
                        <td className="px-4 py-3 text-right">{formatFCFA(run.totalGrossSalary)}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatFCFA(run.totalNetSalary)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-xs">{run.paymentDate ? new Date(run.paymentDate).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => navigate(`/rh/paie/run/${run.id}`)}>
                            Ouvrir <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Dialog nouveau cycle ─── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau cycle de paie</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Période (YYYY-MM)</Label>
                <FieldTooltip content="Mois de paie au format AAAA-MM (ex. 2026-06). Détermine la période de calcul des cotisations, l'IRPP et les droits à congés." />
              </div>
              <Input value={newForm.period} onChange={(e) => setNewForm({ ...newForm, period: e.target.value })} placeholder="2026-06" />
              <FieldHint>Format : AAAA-MM — ex. 2026-06 pour juin 2026.</FieldHint>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Date de paiement prévue</Label>
                <FieldTooltip content="Date à laquelle les salaires seront virés. Utilisée pour générer les ordres de virement et les rapports de trésorerie." />
              </div>
              <Input type="date" value={newForm.paymentDate} onChange={(e) => setNewForm({ ...newForm, paymentDate: e.target.value })} />
            </div>
            <div>
              <Label>Notes internes</Label>
              <Input value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} placeholder="Cycle mensuel juin 2026…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Annuler</Button>
            <Button onClick={() => createRun.mutate(newForm)} disabled={!newForm.period || createRun.isPending}>
              <Play className="w-4 h-4 mr-1" />Créer et préparer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog correction ─── */}
      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Corriger une erreur de paie</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Identifiez l'erreur, saisissez le montant correctif (positif si sous-payé, négatif si trop payé) et documentez le motif.</p>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Collaborateur</Label>
                <FieldTooltip content="Collaborateur concerné par l'erreur de paie. La correction sera rattachée à son bulletin et tracée dans l'historique des cycles." />
              </div>
              <select
                className="w-full mt-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={corrForm.collaboratorId}
                onChange={e => setCorrForm(f => ({ ...f, collaboratorId: e.target.value }))}
              >
                <option value="">Sélectionner…</option>
                {collabs.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Cycle source (optionnel)</Label>
                <FieldTooltip content="Cycle de paie (mois) à l'origine de l'erreur. Permet de lier la correction à un bulletin précis pour l'audit. Laissez vide si la correction est indépendante d'un cycle antérieur." />
              </div>
              <select
                className="w-full mt-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={corrForm.sourceRunId}
                onChange={e => setCorrForm(f => ({ ...f, sourceRunId: e.target.value }))}
              >
                <option value="">Aucun cycle spécifique</option>
                {(dash?.recentRuns ?? []).filter(r => r.status !== "draft").map(r => (
                  <option key={r.id} value={r.id}>{r.period} — {STATUS_LABEL[r.status]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Montant (FCFA, + si sous-payé / – si trop payé)</Label>
                <FieldTooltip content="Montant correctif en FCFA. Saisissez un nombre positif si le collaborateur a été sous-payé (régularisation en sa faveur), négatif s'il a été trop payé (remboursement)." />
              </div>
              <Input type="number" placeholder="Ex: 25000 ou -15000" value={corrForm.amount} onChange={e => setCorrForm(f => ({ ...f, amount: e.target.value }))} />
              <FieldHint>Positif = complément de salaire · Négatif = trop-perçu à récupérer.</FieldHint>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label>Motif *</Label>
                <FieldTooltip content="Justificatif de la correction. Doit être suffisamment précis pour l'audit de paie (ex. heures supplémentaires non comptabilisées, prime omise, erreur de taux)." />
              </div>
              <Input placeholder="Heures sup. non comptabilisées en juin…" value={corrForm.reason} onChange={e => setCorrForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>Annuler</Button>
            <Button
              disabled={!corrForm.collaboratorId || !corrForm.amount || !corrForm.reason || createCorrectionMut.isPending}
              onClick={() => createCorrectionMut.mutate(corrForm)}
            >
              <FileText className="w-4 h-4 mr-1" />Créer la correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
