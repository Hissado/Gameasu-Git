import React, { useState, useEffect, useRef } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { useLocation, useParams } from "wouter";
import {
  CheckCircle, ChevronLeft, ChevronRight, RefreshCw, Upload, AlertTriangle,
  Users, Banknote, TrendingUp, Receipt, Search, Play, ArrowLeft, Info,
  Download, CreditCard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API = "/api";

async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const PAY_METHODS: Record<string, string> = {
  bank_transfer: "Virement bancaire",
  cash: "Espèces",
  mobile_money: "Mobile Money",
  check: "Chèque",
  other: "Autre",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  validated: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const STATUS_LABEL: Record<string, string> = { draft: "Brouillon", validated: "Validé", paid: "Payé" };

type LineItem = {
  collaboratorId: string; firstName: string; lastName: string; department?: string; jobTitle?: string;
  baseSalary: number; transportAllowance: number; housingAllowance: number;
  lineItemId: string | null;
  regularHours: number; overtimeHours: number; leaveHours: number; absenceHours: number;
  bonus: number; commission: number; tip: number; reimbursement: number; deduction: number; payrollCorrection: number;
  notes: string; paymentMethod: string; totalGross: number; attendanceSynced: boolean;
};

function computeGross(l: LineItem) {
  const base = l.baseSalary + l.transportAllowance + l.housingAllowance;
  const variable = l.bonus + l.commission + l.tip + l.reimbursement + l.payrollCorrection;
  const totalGross = base + variable - l.deduction;
  // CNSS + IRPP + IPTS approx for display
  const cnss = Math.round(totalGross * 0.04);
  const ipts = Math.round(totalGross * 0.02);
  const irpp = Math.round((totalGross * 12 * 0.15) / 12); // approx
  const net = Math.round(totalGross - cnss - ipts - irpp);
  return { totalGross, net };
}

// Editable numeric cell
function NumCell({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && ref.current) ref.current.select(); }, [editing]);
  useEffect(() => { if (!editing) setRaw(String(value)); }, [value, editing]);

  if (disabled) {
    return <span className="text-right block text-sm">{value > 0 ? formatFCFA(value) : <span className="text-muted-foreground">—</span>}</span>;
  }
  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        className="w-full text-right bg-primary/5 border border-primary/30 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => { setEditing(false); const n = parseFloat(raw); if (!isNaN(n)) onChange(n); else setRaw(String(value)); }}
        onKeyDown={e => { if (e.key === "Enter") { setEditing(false); const n = parseFloat(raw); if (!isNaN(n)) onChange(n); } if (e.key === "Escape") { setEditing(false); setRaw(String(value)); } }}
      />
    );
  }
  return (
    <span
      className="text-right block text-sm cursor-pointer hover:bg-primary/5 rounded px-1 transition-colors"
      onClick={() => setEditing(true)}
      title="Cliquer pour modifier"
    >
      {value !== 0 ? formatFCFA(value) : <span className="text-muted-foreground text-xs">0 — modifier</span>}
    </span>
  );
}

export default function PayrollRun() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState("");
  const [localItems, setLocalItems] = useState<LineItem[]>([]);
  const [pendingPatches, setPendingPatches] = useState<Record<string, Partial<LineItem>>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<null | {
    preview: Array<{ collaboratorId: string; name: string; matched: boolean; fields: Record<string, number | string>; error?: string }>;
    unmatched: string[];
    matched: number;
    total: number;
  }>(null);
  const [importStep, setImportStep] = useState<"input" | "preview">("input");
  const [importLoading, setImportLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ run: any; lineItems: LineItem[] }>({
    queryKey: ["payroll-run-items", runId],
    queryFn: () => fetchJSON(`${API}/payroll/runs/${runId}/line-items`),
    enabled: !!runId,
  });

  useEffect(() => {
    if (data?.lineItems) setLocalItems(data.lineItems);
  }, [data]);

  const run = data?.run;

  const syncMut = useMutation({
    mutationFn: () => fetchJSON(`${API}/payroll/runs/${runId}/sync-attendance`, { method: "POST" }),
    onSuccess: (r) => { toast({ title: r.message ?? "Présence synchronisée" }); refetch(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const generateMut = useMutation({
    mutationFn: () => fetchJSON(`${API}/payroll/runs/${runId}/generate`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Bulletins générés" }); refetch(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const validateMut = useMutation({
    mutationFn: () => fetchJSON(`${API}/payroll/runs/${runId}/submit`, { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      toast({ title: "Paie soumise !", description: `${r.employeeCount ?? localItems.length} bulletins générés et validés` });
      navigate("/hr/payroll");
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const patchLineMut = useMutation({
    mutationFn: async ({ lineId, patch }: { lineId: string; patch: Partial<LineItem> }) => {
      const numericPatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) numericPatch[k] = v;
      return fetchJSON(`${API}/payroll/runs/${runId}/line-items/${lineId}`, { method: "PATCH", body: JSON.stringify(numericPatch) });
    },
    onError: (e: Error) => toast({ title: "Erreur de sauvegarde", description: e.message, variant: "destructive" }),
  });

  // Flush pending patches with debounce
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateLine(collaboratorId: string, field: keyof LineItem, value: number | string) {
    setLocalItems(items => items.map(item =>
      item.collaboratorId === collaboratorId ? { ...item, [field]: value } : item
    ));
    setPendingPatches(p => ({
      ...p,
      [collaboratorId]: { ...(p[collaboratorId] ?? {}), [field]: value },
    }));
    // Debounce save
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = setTimeout(() => {
      setPendingPatches(current => {
        const item = localItems.find(l => l.collaboratorId === collaboratorId);
        if (!item?.lineItemId) return current;
        const patch = current[collaboratorId];
        if (patch) patchLineMut.mutate({ lineId: item.lineItemId, patch });
        const next = { ...current };
        delete next[collaboratorId];
        return next;
      });
    }, 800);
  }

  const filtered = localItems.filter(l =>
    search === "" || `${l.firstName} ${l.lastName}`.toLowerCase().includes(search.toLowerCase()) || (l.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Totaux
  const totals = localItems.reduce((acc, l) => {
    const { totalGross, net } = computeGross(l);
    return {
      gross: acc.gross + totalGross,
      net: acc.net + net,
      bonus: acc.bonus + l.bonus,
      commission: acc.commission + l.commission,
      deduction: acc.deduction + l.deduction,
      reimbursement: acc.reimbursement + l.reimbursement,
    };
  }, { gross: 0, net: 0, bonus: 0, commission: 0, deduction: 0, reimbursement: 0 });

  const cnssTotal = Math.round(totals.gross * 0.04);
  const iptsTotal = Math.round(totals.gross * 0.02);
  const irppTotal = Math.round(totals.gross * 0.15);
  const chargePatronale = Math.round(totals.gross * 0.164);

  // Anomalies simples
  const anomalies = localItems.filter(l => l.baseSalary === 0 && l.totalGross === 0).map(l => `${l.firstName} ${l.lastName} : salaire de base non renseigné`);

  async function handleImportPreview() {
    if (!csvText.trim()) return;
    setImportLoading(true);
    try {
      const result = await fetchJSON(`${API}/payroll/runs/${runId}/import-csv`, {
        method: "POST",
        body: JSON.stringify({ csv: csvText, apply: false }),
      });
      setImportPreview(result);
      setImportStep("preview");
    } catch (e: any) {
      toast({ title: "Erreur de validation", description: e.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  }

  async function handleImportApply() {
    if (!csvText.trim()) return;
    setImportLoading(true);
    try {
      const result = await fetchJSON(`${API}/payroll/runs/${runId}/import-csv`, {
        method: "POST",
        body: JSON.stringify({ csv: csvText, apply: true }),
      });
      toast({ title: `${result.applied} ligne(s) importée(s)`, description: result.unmatched?.length ? `${result.unmatched.length} ligne(s) non reconnue(s)` : undefined });
      setImportOpen(false);
      setImportStep("input");
      setCsvText("");
      setImportPreview(null);
      refetch();
    } catch (e: any) {
      toast({ title: "Erreur d'import", description: e.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  }

  if (!runId || isLoading) {
    return <HrShell title="Cycle de paie" subtitle="Chargement…"><div className="py-20 text-center text-muted-foreground">Chargement…</div></HrShell>;
  }

  return (
    <HrShell
      title={`Cycle de paie ${run?.period ?? "…"}`}
      subtitle={`Étape ${step} sur 2 — ${step === 1 ? "Préparation de la paie" : "Vérification et soumission"}`}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate("/hr/payroll")}>
          <ArrowLeft className="w-4 h-4 mr-1" />Retour
        </Button>
      }
    >
      {/* ─── Barre de progression ─── */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${step === 1 ? "bg-primary text-primary-foreground" : "bg-emerald-50 text-emerald-700"}`}>
          {step > 1 ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">1</span>}
          Préparation
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">2</span>
          Vérification & Soumission
        </div>
        <div className="ml-auto flex items-center gap-2">
          {run && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLOR[run.status] ?? ""}`}>
              {STATUS_LABEL[run.status] ?? run.status}
            </span>
          )}
          {run?.paymentDate && (
            <span className="text-xs text-muted-foreground">Paiement : {new Date(run.paymentDate).toLocaleDateString("fr-FR")}</span>
          )}
        </div>
      </div>

      {/* ════════════ ÉTAPE 1 ════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Collaborateurs", value: String(localItems.length), icon: Users, color: "text-blue-600 bg-blue-50" },
              { label: "Total brut estimé", value: formatFCFA(totals.gross), icon: TrendingUp, color: "text-orange-600 bg-orange-50" },
              { label: "Total net estimé", value: formatFCFA(totals.net), icon: Banknote, color: "text-emerald-600 bg-emerald-50" },
              { label: "Charge patronale est.", value: formatFCFA(chargePatronale), icon: Receipt, color: "text-purple-600 bg-purple-50" },
            ].map(k => (
              <Card key={k.label}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}><k.icon className="w-4 h-4" /></div>
                  <div><p className="text-xs text-muted-foreground">{k.label}</p><p className="font-bold text-sm">{k.value}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 h-9" placeholder="Rechercher un collaborateur…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending || run?.status !== "draft"}>
              <RefreshCw className={`w-4 h-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} />Sync présence
            </Button>
            <Button size="sm" variant="outline" onClick={() => generateMut.mutate()} disabled={generateMut.isPending || run?.status !== "draft"}>
              <Play className="w-4 h-4 mr-1" />Générer bulletins
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} disabled={run?.status !== "draft"}>
              <Upload className="w-4 h-4 mr-1" />Importer CSV
            </Button>
            <Button size="sm" className="ml-auto" onClick={() => setStep(2)} disabled={localItems.length === 0}>
              Vérifier & Soumettre <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Tableau principal */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground rounded-lg border border-dashed">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun collaborateur. Cliquez sur "Générer bulletins" pour initialiser.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-x-auto shadow-sm">
              <table className="w-full text-sm border-collapse min-w-[1400px]">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left sticky left-0 bg-muted/50 min-w-[180px]">Collaborateur</th>
                    <th className="px-3 py-2.5 text-right min-w-[120px]">Salaire base</th>
                    <th className="px-3 py-2.5 text-right min-w-[90px]">H. rég.</th>
                    <th className="px-3 py-2.5 text-right min-w-[90px]">H. sup.</th>
                    <th className="px-3 py-2.5 text-right min-w-[90px]">Congés (h)</th>
                    <th className="px-3 py-2.5 text-right min-w-[90px]">Absences (h)</th>
                    <th className="px-3 py-2.5 text-right min-w-[110px]">Bonus</th>
                    <th className="px-3 py-2.5 text-right min-w-[110px]">Commission</th>
                    <th className="px-3 py-2.5 text-right min-w-[110px]">Remboursement</th>
                    <th className="px-3 py-2.5 text-right min-w-[110px]">Déduction</th>
                    <th className="px-3 py-2.5 text-right min-w-[100px]">Correction</th>
                    <th className="px-3 py-2.5 text-left min-w-[140px]">Mode paiement</th>
                    <th className="px-3 py-2.5 text-right min-w-[120px] font-semibold">Total brut</th>
                    <th className="px-3 py-2.5 text-right min-w-[120px] text-emerald-700">Net estimé</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, idx) => {
                    const { totalGross, net } = computeGross(l);
                    const isDraft = run?.status === "draft";
                    return (
                      <tr key={l.collaboratorId} className={`border-t ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"} hover:bg-primary/5`}>
                        <td className="px-3 py-2 sticky left-0 bg-inherit border-r">
                          <div className="font-medium text-sm">{l.firstName} {l.lastName}</div>
                          {(l.department || l.jobTitle) && <div className="text-xs text-muted-foreground">{l.jobTitle ?? l.department}</div>}
                          {l.attendanceSynced && <span className="text-xs text-blue-600">✓ présence sync</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-sm">{formatFCFA(l.baseSalary)}</td>
                        <td className="px-3 py-2"><NumCell value={l.regularHours} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "regularHours", v)} /></td>
                        <td className="px-3 py-2"><NumCell value={l.overtimeHours} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "overtimeHours", v)} /></td>
                        <td className="px-3 py-2"><NumCell value={l.leaveHours} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "leaveHours", v)} /></td>
                        <td className="px-3 py-2"><NumCell value={l.absenceHours} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "absenceHours", v)} /></td>
                        <td className="px-3 py-2"><NumCell value={l.bonus} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "bonus", v)} /></td>
                        <td className="px-3 py-2"><NumCell value={l.commission} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "commission", v)} /></td>
                        <td className="px-3 py-2"><NumCell value={l.reimbursement} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "reimbursement", v)} /></td>
                        <td className="px-3 py-2 text-red-600"><NumCell value={l.deduction} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "deduction", v)} /></td>
                        <td className="px-3 py-2 text-amber-600"><NumCell value={l.payrollCorrection} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "payrollCorrection", v)} /></td>
                        <td className="px-3 py-2">
                          {isDraft ? (
                            <select
                              className="w-full text-xs px-1 py-1 rounded border border-input bg-background"
                              value={l.paymentMethod}
                              onChange={e => updateLine(l.collaboratorId, "paymentMethod", e.target.value)}
                            >
                              {Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs">{PAY_METHODS[l.paymentMethod] ?? l.paymentMethod}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{formatFCFA(totalGross)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatFCFA(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totaux */}
                <tfoot className="border-t-2 bg-muted/40 font-semibold">
                  <tr>
                    <td className="px-3 py-2.5 sticky left-0 bg-muted/40 text-sm">TOTAUX ({filtered.length})</td>
                    <td className="px-3 py-2.5" />
                    <td colSpan={4} />
                    <td className="px-3 py-2.5 text-right text-sm">{formatFCFA(totals.bonus)}</td>
                    <td className="px-3 py-2.5 text-right text-sm">{formatFCFA(totals.commission)}</td>
                    <td className="px-3 py-2.5 text-right text-sm">{formatFCFA(totals.reimbursement)}</td>
                    <td className="px-3 py-2.5 text-right text-red-600 text-sm">{formatFCFA(totals.deduction)}</td>
                    <td colSpan={2} />
                    <td className="px-3 py-2.5 text-right text-primary">{formatFCFA(totals.gross)}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">{formatFCFA(totals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════ ÉTAPE 2 ════════════ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />Retour modifier
            </Button>
            <Button
              size="lg"
              onClick={() => validateMut.mutate()}
              disabled={validateMut.isPending || run?.status !== "draft" || localItems.length === 0}
              className="gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {validateMut.isPending ? "Soumission…" : "Soumettre la paie"}
            </Button>
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2 text-amber-800 font-medium">
                <AlertTriangle className="w-4 h-4" />
                {anomalies.length} anomalie(s) détectée(s)
              </div>
              <ul className="space-y-1">
                {anomalies.map((a, i) => <li key={i} className="text-sm text-amber-700">• {a}</li>)}
              </ul>
            </div>
          )}

          {/* Résumé global */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Résumé de la paie — {run?.period}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "Collaborateurs", value: localItems.length, fmt: false },
                { label: "Total salaire brut", value: totals.gross, fmt: true, color: "text-blue-700" },
                { label: "CNSS salarié (4%)", value: cnssTotal, fmt: true, color: "text-red-600" },
                { label: "IRPP (moy. ~15%)", value: irppTotal, fmt: true, color: "text-red-600" },
                { label: "IPTS (2%)", value: iptsTotal, fmt: true, color: "text-red-600" },
                { label: "Total net à payer", value: totals.net, fmt: true, color: "text-emerald-700 font-bold text-lg" },
                { label: "Charge patronale CNSS (16,4%)", value: chargePatronale, fmt: true, color: "text-orange-700" },
                { label: "Bonus / Primes", value: totals.bonus, fmt: true, color: "text-blue-600" },
                { label: "Remboursements", value: totals.reimbursement, fmt: true, color: "text-blue-600" },
              ].map(k => (
                <div key={k.label} className="p-4 rounded-xl border bg-background">
                  <div className="text-xs text-muted-foreground mb-1">{k.label}</div>
                  <div className={`text-xl font-bold ${k.color ?? ""}`}>
                    {k.fmt ? formatFCFA(k.value as number) : k.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tableau récap */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Détail par collaborateur</h3>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Collaborateur</th>
                    <th className="px-4 py-3 text-right">Salaire brut</th>
                    <th className="px-4 py-3 text-right">CNSS</th>
                    <th className="px-4 py-3 text-right">IRPP+IPTS</th>
                    <th className="px-4 py-3 text-right">Net estimé</th>
                    <th className="px-4 py-3 text-left">Mode paiement</th>
                  </tr>
                </thead>
                <tbody>
                  {localItems.map((l) => {
                    const { totalGross, net } = computeGross(l);
                    const cnss = Math.round(totalGross * 0.04);
                    const irppIpts = Math.round(totalGross * 0.17);
                    return (
                      <tr key={l.collaboratorId} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{l.firstName} {l.lastName}<div className="text-xs text-muted-foreground">{l.department}</div></td>
                        <td className="px-4 py-2.5 text-right">{formatFCFA(totalGross)}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{formatFCFA(cnss)}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{formatFCFA(irppIpts)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatFCFA(net)}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{PAY_METHODS[l.paymentMethod] ?? l.paymentMethod}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 bg-muted/40 font-semibold">
                  <tr>
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right text-primary">{formatFCFA(totals.gross)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatFCFA(cnssTotal)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatFCFA(irppTotal + iptsTotal)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 text-base">{formatFCFA(totals.net)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Import CSV — preview + apply ─── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Importer des données de paie (CSV)</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={importStep === "input" ? "text-primary font-semibold" : ""}>1. Coller le CSV</span>
                <span>›</span>
                <span className={importStep === "preview" ? "text-primary font-semibold" : ""}>2. Valider</span>
                <span>›</span>
                <span>3. Appliquer</span>
              </div>
            </div>

            {importStep === "input" && (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Colonnes reconnues (séparateur <code className="bg-muted px-1 rounded">;</code> ou <code className="bg-muted px-1 rounded">,</code>) :{" "}
                  <code className="bg-muted px-1 rounded text-xs">id · nom · bonus · prime · commission · remboursement · deduction · h_regulieres · h_sup</code>
                </p>
                <textarea
                  className="flex-1 min-h-48 font-mono text-xs border border-input rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={"id;nom;bonus;commission;h_regulieres;h_sup\nabc-123;Kofi Asante;50000;25000;160;8"}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                />
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => { setImportOpen(false); setCsvText(""); }}>Annuler</Button>
                  <Button onClick={handleImportPreview} disabled={!csvText.trim() || importLoading}>
                    {importLoading ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                    Valider le CSV
                  </Button>
                </div>
              </>
            )}

            {importStep === "preview" && importPreview && (
              <>
                <div className="flex gap-4 mb-3 text-sm">
                  <span className="text-emerald-700 font-semibold">{importPreview.matched} ligne(s) reconnue(s)</span>
                  {importPreview.unmatched.length > 0 && (
                    <span className="text-amber-700 font-semibold">{importPreview.unmatched.length} non reconnue(s)</span>
                  )}
                  <span className="text-muted-foreground">sur {importPreview.total} au total</span>
                </div>

                <div className="flex-1 overflow-y-auto rounded-lg border text-sm">
                  <table className="w-full">
                    <thead className="bg-muted/40 text-xs text-muted-foreground uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Collaborateur</th>
                        <th className="px-3 py-2 text-left">Champs importés</th>
                        <th className="px-3 py-2 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.preview.map((row, i) => (
                        <tr key={i} className={`border-t ${row.matched ? "" : "bg-amber-50"}`}>
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {row.matched && Object.keys(row.fields).length > 0
                              ? Object.entries(row.fields).map(([k, v]) => `${k}: ${v}`).join(" · ")
                              : row.error ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.matched
                              ? <span className="text-xs text-emerald-700 font-semibold">✓ OK</span>
                              : <span className="text-xs text-amber-700">Non trouvé</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importPreview.unmatched.length > 0 && (
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                    {importPreview.unmatched.map((u, i) => <div key={i}>{u}</div>)}
                  </div>
                )}

                <div className="flex justify-between gap-2 mt-4">
                  <Button variant="outline" onClick={() => setImportStep("input")}>
                    ← Modifier le CSV
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setImportOpen(false); setImportStep("input"); setCsvText(""); setImportPreview(null); }}>Annuler</Button>
                    <Button onClick={handleImportApply} disabled={importPreview.matched === 0 || importLoading}>
                      {importLoading ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                      Appliquer ({importPreview.matched} ligne{importPreview.matched > 1 ? "s" : ""})
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </HrShell>
  );
}
