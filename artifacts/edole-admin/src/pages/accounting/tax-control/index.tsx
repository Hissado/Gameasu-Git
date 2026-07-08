import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useLocation } from "wouter";
import { AccountingShell } from "../_layout";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Plus, Search, Filter, FileText, CheckCircle, AlertTriangle,
  XCircle, Clock, RefreshCw, Download, ChevronRight, Calendar,
  ArrowUpRight, Building2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────
type Declaration = {
  id: string;
  type: string;
  typeLabel: string;
  period: string;
  periodLabel: string;
  status: string;
  conformityScore: number | null;
  declaredRevenue: number | null;
  declaredVatCollected: number | null;
  declaredNetVat: number | null;
  declaredAmount: number | null;
  dueDate: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  responsibleName: string | null;
  anomalies: Record<string, number>;
};

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  brouillon:       { label: "Brouillon",            color: "#6B7280", bg: "#F3F4F6", icon: <Clock className="w-3 h-3" /> },
  en_verification: { label: "En vérification",      color: "#2563EB", bg: "#EFF6FF", icon: <RefreshCw className="w-3 h-3" /> },
  corrections:     { label: "Corrections requises", color: "#D97706", bg: "#FFF7ED", icon: <AlertTriangle className="w-3 h-3" /> },
  conforme:        { label: "Conforme",              color: "#059669", bg: "#ECFDF5", icon: <CheckCircle className="w-3 h-3" /> },
  pret:            { label: "Prêt à soumettre",      color: "#7C3AED", bg: "#F5F3FF", icon: <Shield className="w-3 h-3" /> },
  soumis:          { label: "Soumis",                color: "#0E1A39", bg: "#E0E7FF", icon: <ArrowUpRight className="w-3 h-3" /> },
  archive:         { label: "Archivé",               color: "#9CA3AF", bg: "#F9FAFB", icon: <FileText className="w-3 h-3" /> },
};

const TYPE_OPTIONS = [
  { value: "tva", label: "TVA" },
  { value: "is", label: "Impôt sur sociétés" },
  { value: "retenues_source", label: "Retenues à la source" },
  { value: "taxes_salaires", label: "Taxes sur salaires" },
  { value: "acompte", label: "Acompte fiscal" },
  { value: "recapitulatif", label: "État récapitulatif" },
  { value: "autre", label: "Autre" },
];

const STATUTS_FILTRE = [
  { value: "all", label: "Tous" },
  { value: "brouillon", label: "Brouillon" },
  { value: "en_verification", label: "En vérification" },
  { value: "corrections", label: "Corrections requises" },
  { value: "conforme", label: "Conforme" },
  { value: "pret", label: "Prêt à soumettre" },
  { value: "soumis", label: "Soumis" },
];

// ─── Composants ───────────────────────────────────────────────────────────────
function StatutBadge({ statut }: { statut: string }) {
  const cfg = STATUT_CONFIG[statut] ?? STATUT_CONFIG.brouillon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-sm">—</span>;
  const color = score >= 90 ? "#059669" : score >= 70 ? "#D97706" : "#DC2626";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{score}%</span>
    </div>
  );
}

function AlertSummary({ anomalies }: { anomalies: Record<string, number> }) {
  const total = Object.values(anomalies).reduce((s, v) => s + v, 0);
  if (!total) return <span className="text-xs text-muted-foreground">Aucune alerte</span>;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {anomalies.bloquant > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{anomalies.bloquant} bloquant</span>}
      {anomalies.eleve > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">{anomalies.eleve} élevé</span>}
      {anomalies.moyen > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">{anomalies.moyen} moyen</span>}
      {anomalies.faible > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{anomalies.faible} faible</span>}
    </div>
  );
}

// ─── Dialogue création ────────────────────────────────────────────────────────
function NewDeclarationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: "tva", period: "", periodLabel: "",
    dueDate: "", declaredRevenue: "", declaredVatCollected: "", declaredVatDeductible: "", declaredNetVat: "",
  });

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch("/api/tax-declarations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-declarations"] }); onClose(); },
  });

  const typeOption = TYPE_OPTIONS.find(t => t.value === form.type);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      ...form,
      typeLabel: typeOption?.label ?? form.type,
      declaredRevenue: form.declaredRevenue ? Number(form.declaredRevenue) : null,
      declaredVatCollected: form.declaredVatCollected ? Number(form.declaredVatCollected) : null,
      declaredVatDeductible: form.declaredVatDeductible ? Number(form.declaredVatDeductible) : null,
      declaredNetVat: form.declaredNetVat ? Number(form.declaredNetVat) : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle déclaration fiscale</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Type de déclaration</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Période (ex : 2025-06)</Label>
              <Input className="mt-1" placeholder="2025-06" value={form.period}
                onChange={e => setForm(f => ({ ...f, period: e.target.value }))} required />
            </div>
            <div>
              <Label>Libellé période</Label>
              <Input className="mt-1" placeholder="Juin 2025" value={form.periodLabel}
                onChange={e => setForm(f => ({ ...f, periodLabel: e.target.value }))} required />
            </div>
            <div>
              <Label>Échéance légale</Label>
              <Input type="date" className="mt-1" value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Montants déclarés (FCFA)</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "declaredRevenue", label: "CA HT déclaré" },
                { key: "declaredVatCollected", label: "TVA collectée" },
                { key: "declaredVatDeductible", label: "TVA déductible" },
                { key: "declaredNetVat", label: "TVA nette à payer" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" className="mt-1 h-8 text-sm"
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder="0" />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-primary text-white">
              {mutation.isPending ? "Création…" : "Créer la déclaration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function TaxControlPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery<{ data: Declaration[] }>({
    queryKey: ["tax-declarations", statusFilter],
    queryFn: () => apiFetch(`/api/tax-declarations?status=${statusFilter}`),
  });

  const declarations = data?.data ?? [];

  const filtered = declarations.filter(d =>
    d.typeLabel.toLowerCase().includes(search.toLowerCase()) ||
    d.periodLabel.toLowerCase().includes(search.toLowerCase()) ||
    d.period.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const total = declarations.length;
  const enCours = declarations.filter(d => d.status === "en_verification").length;
  const conformes = declarations.filter(d => d.conformityScore !== null && d.conformityScore >= 90).length;
  const bloquants = declarations.filter(d => (d.anomalies?.bloquant ?? 0) > 0).length;

  return (
    <AccountingShell
      title="Contrôle fiscal préalable"
      subtitle="Vérification des déclarations avant soumission à l'administration fiscale"
      actions={
        <Button onClick={() => setShowNew(true)} size="sm" className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white border-0">
          <Plus className="w-4 h-4" />Nouvelle déclaration
        </Button>
      }
    >
      <div className="space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Déclarations", value: total, icon: FileText, color: "text-primary", bg: "bg-primary/5" },
            { label: "En vérification", value: enCours, icon: RefreshCw, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Conformes (≥90%)", value: conformes, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
            { label: "Alertes bloquantes", value: bloquants, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
          ].map((kpi, i) => (
            <div key={i} className="bg-card rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className={`text-2xl font-extrabold ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…" className="pl-9 h-8 text-sm" />
          </div>
          <div className="flex items-center gap-1 bg-muted/50 border rounded-lg p-1">
            {STATUTS_FILTRE.map(s => (
              <button key={s.value} onClick={() => setStatusFilter(s.value)}
                className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${statusFilter === s.value ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-card rounded-xl border overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Aucune déclaration.</p>
              <Button size="sm" variant="outline" onClick={() => setShowNew(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />Créer la première déclaration
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["Déclaration", "Période", "Statut", "Score", "Alertes", "Montant net", "Échéance", ""].map((h, i) => (
                    <th key={i} className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(d => (
                  <tr key={d.id} onClick={() => setLocation(`/comptabilite/controle-fiscal/${d.id}`)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{d.typeLabel}</div>
                          {d.responsibleName && <div className="text-xs text-muted-foreground">{d.responsibleName}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground/40" />
                        <span className="text-sm text-foreground">{d.periodLabel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatutBadge statut={d.status} /></td>
                    <td className="px-4 py-3"><ScorePill score={d.conformityScore} /></td>
                    <td className="px-4 py-3"><AlertSummary anomalies={d.anomalies ?? {}} /></td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold">
                        {d.declaredNetVat != null ? formatFCFA(d.declaredNetVat) : d.declaredAmount != null ? formatFCFA(d.declaredAmount) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.dueDate ? (
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${d.status === "corrections" ? "bg-orange-400" : d.status === "soumis" ? "bg-green-400" : "bg-muted-foreground/30"}`} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(d.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground ml-auto transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>
              Administration fiscale configurée depuis les{" "}
              <button
                type="button"
                onClick={() => setLocation("/comptabilite/taxes?tab=administration")}
                className="font-semibold text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
              >
                Paramètres fiscaux
              </button>
            </span>
          </div>
          {filtered.length > 0 && <span>{filtered.length} déclaration{filtered.length > 1 ? "s" : ""}</span>}
        </div>
      </div>

      <NewDeclarationDialog open={showNew} onClose={() => setShowNew(false)} />
    </AccountingShell>
  );
}
