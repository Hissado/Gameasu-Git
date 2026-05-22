import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  TrendingUp, Receipt, Building2, Users, Percent, AlertCircle,
  Plus, Pencil, Trash2, Calendar, CheckCircle2, Clock, AlertTriangle,
  ShieldCheck, Landmark, Briefcase, Banknote,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tax = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  rate: string | null;
  appliesTo: string[] | null;
  collectAccountCode: string | null;
  deductAccountCode: string | null;
  declarationPeriod: string;
  nextDueDate: string | null;
  isActive: boolean;
  notes: string | null;
};

type FiscalSummary = {
  period: { from: string | null; to: string | null };
  tva: { collectee: number; deductible: number; due: number };
  irpp: number; aib: number; ipts: number; cnss: number;
  resultatFiscal: number; revenus: number; charges: number;
};

type TvaLine = {
  entryNumber: string; entryDate: string; description: string;
  accountCode: string; accountLabel: string; debit: number; credit: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TAX_TYPES: Record<string, { label: string; color: string; icon: any }> = {
  vat:          { label: "TVA",           color: "bg-blue-100 text-blue-700",   icon: Receipt },
  income_tax:   { label: "Impôt bénéfice", color: "bg-amber-100 text-amber-700", icon: Landmark },
  withholding:  { label: "Retenue à la source", color: "bg-purple-100 text-purple-700", icon: Banknote },
  social:       { label: "Cotisation sociale", color: "bg-emerald-100 text-emerald-700", icon: ShieldCheck },
  other:        { label: "Autre",          color: "bg-slate-100 text-slate-700",  icon: Briefcase },
};

const PERIODS: Record<string, string> = {
  monthly: "Mensuelle", quarterly: "Trimestrielle", annual: "Annuelle", none: "Aucune",
};

const APPLIES_TO_LABELS: Record<string, string> = {
  sales: "Ventes", purchases: "Achats", payroll: "Paie", other: "Autre",
};

function computeNextDeadline(period: string, existingDate: string | null): Date | null {
  if (existingDate) return new Date(existingDate);
  const now = new Date();
  if (period === "monthly") {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    return next;
  }
  if (period === "quarterly") {
    const q = Math.floor(now.getMonth() / 3);
    const nextQStart = new Date(now.getFullYear(), (q + 1) * 3, 1);
    return new Date(nextQStart.getFullYear(), nextQStart.getMonth(), 15);
  }
  if (period === "annual") {
    const next = new Date(now.getFullYear(), 3, 30); // 30 avril
    if (next < now) next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  return null;
}

function deadlineStatus(d: Date | null): "ok" | "soon" | "overdue" {
  if (!d) return "ok";
  const today = new Date();
  const diff = (d.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return "overdue";
  if (diff <= 7) return "soon";
  return "ok";
}

const fmtDate = (s: string) => new Intl.DateTimeFormat("fr-TG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(s));

function TaxKPI({ label, value, sub, icon: Icon, accent = "default" }: {
  label: string; value: string; sub?: string;
  icon: any; accent?: "success" | "danger" | "warning" | "default";
}) {
  const colors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
    danger: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    default: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[accent]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

// ─── TaxFormDialog ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  code: "", name: "", description: "", type: "vat",
  rate: "", appliesTo: [] as string[],
  collectAccountCode: "", deductAccountCode: "",
  declarationPeriod: "monthly", nextDueDate: "", isActive: true, notes: "",
};

type TaxForm = typeof EMPTY_FORM;

function TaxFormDialog({ open, onClose, initial, onSave }: {
  open: boolean;
  onClose: () => void;
  initial?: Tax | null;
  onSave: (data: TaxForm) => Promise<void>;
}) {
  const [form, setForm] = useState<TaxForm>(() => initial ? {
    code: initial.code,
    name: initial.name,
    description: initial.description ?? "",
    type: initial.type,
    rate: initial.rate ?? "",
    appliesTo: initial.appliesTo ?? [],
    collectAccountCode: initial.collectAccountCode ?? "",
    deductAccountCode: initial.deductAccountCode ?? "",
    declarationPeriod: initial.declarationPeriod,
    nextDueDate: initial.nextDueDate ?? "",
    isActive: initial.isActive,
    notes: initial.notes ?? "",
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(initial ? {
      code: initial.code, name: initial.name, description: initial.description ?? "",
      type: initial.type, rate: initial.rate ?? "", appliesTo: initial.appliesTo ?? [],
      collectAccountCode: initial.collectAccountCode ?? "",
      deductAccountCode: initial.deductAccountCode ?? "",
      declarationPeriod: initial.declarationPeriod, nextDueDate: initial.nextDueDate ?? "",
      isActive: initial.isActive, notes: initial.notes ?? "",
    } : { ...EMPTY_FORM });
  }, [initial, open]);

  const set = (k: keyof TaxForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleAppliesTo = (v: string) => {
    set("appliesTo", form.appliesTo.includes(v)
      ? form.appliesTo.filter((x) => x !== v)
      : [...form.appliesTo, v]);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Le code et le libellé sont requis");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifier la taxe" : "Nouvelle taxe"}</DialogTitle>
          <DialogDescription>Paramétrez le code, le taux et les comptes SYSCOHADA associés.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1">
            <Label>Code *</Label>
            <Input placeholder="TVA_18" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1">
            <Label>Libellé *</Label>
            <Input placeholder="TVA 18%" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Description</Label>
            <Input placeholder="Description courte" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vat">TVA</SelectItem>
                <SelectItem value="income_tax">Impôt sur bénéfice</SelectItem>
                <SelectItem value="withholding">Retenue à la source</SelectItem>
                <SelectItem value="social">Cotisation sociale</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Taux (%)</Label>
            <Input type="number" min="0" max="100" step="0.01" placeholder="18.00"
              value={form.rate} onChange={(e) => set("rate", e.target.value)} />
            <p className="text-xs text-muted-foreground">Laisser vide si variable</p>
          </div>

          <div className="space-y-1">
            <Label>Compte collecté (SYSCOHADA)</Label>
            <Input placeholder="443100" value={form.collectAccountCode}
              onChange={(e) => set("collectAccountCode", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Compte déductible (SYSCOHADA)</Label>
            <Input placeholder="445600" value={form.deductAccountCode}
              onChange={(e) => set("deductAccountCode", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Périodicité déclaration</Label>
            <Select value={form.declarationPeriod} onValueChange={(v) => set("declarationPeriod", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensuelle</SelectItem>
                <SelectItem value="quarterly">Trimestrielle</SelectItem>
                <SelectItem value="annual">Annuelle</SelectItem>
                <SelectItem value="none">Aucune</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Prochaine échéance</Label>
            <Input type="date" value={form.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} />
            <p className="text-xs text-muted-foreground">Calculée auto si vide</p>
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Applicable à</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(APPLIES_TO_LABELS).map(([k, v]) => (
                <button key={k} type="button"
                  onClick={() => toggleAppliesTo(k)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors
                    ${form.appliesTo.includes(k)
                      ? "bg-[#C8A24B] border-[#C8A24B] text-white"
                      : "border-slate-200 text-slate-600 hover:border-[#C8A24B]"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2 space-y-1">
            <Label>Notes internes</Label>
            <Textarea rows={2} placeholder="Observations, références légales…"
              value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="col-span-2 flex items-center gap-3">
            <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            <span className="text-sm font-medium">{form.isActive ? "Taxe active" : "Taxe inactive"}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}
            className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">
            {saving ? "Enregistrement…" : initial ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TaxesPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(lastDay);
  const [tab, setTab] = useState<"referentiel" | "summary" | "schedule" | "tva-detail">("referentiel");
  const [formOpen, setFormOpen] = useState(false);
  const [editTax, setEditTax] = useState<Tax | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const qc = useQueryClient();
  const params = new URLSearchParams({ from, to });

  const { data: taxesRes, isLoading: loadingTaxes } = useQuery<{ data: Tax[] }>({
    queryKey: ["taxes"],
    queryFn: () => apiFetch("/api/accounting/taxes"),
  });
  const taxes = taxesRes?.data ?? [];

  const { data: summary, isLoading: loadingSummary } = useQuery<FiscalSummary>({
    queryKey: ["fiscal-summary", from, to],
    queryFn: () => apiFetch(`/api/accounting/fiscal/summary?${params}`),
    enabled: tab === "summary",
  });

  const { data: tvaDetail, isLoading: loadingTva } = useQuery<{ data: TvaLine[] }>({
    queryKey: ["tva-detail", from, to],
    queryFn: () => apiFetch(`/api/accounting/fiscal/tva-detail?${params}`),
    enabled: tab === "tva-detail",
  });

  const createMutation = useMutation({
    mutationFn: (data: TaxForm) => apiFetch("/api/accounting/taxes", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["taxes"] }); toast.success("Taxe créée"); },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaxForm }) =>
      apiFetch(`/api/accounting/taxes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["taxes"] }); toast.success("Taxe mise à jour"); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/taxes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["taxes"] }); toast.success("Taxe supprimée"); setDeletingId(null); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const toggleActive = (tax: Tax) => updateMutation.mutate({
    id: tax.id,
    data: {
      code: tax.code, name: tax.name, description: tax.description ?? "",
      type: tax.type, rate: tax.rate ?? "", appliesTo: tax.appliesTo ?? [],
      collectAccountCode: tax.collectAccountCode ?? "", deductAccountCode: tax.deductAccountCode ?? "",
      declarationPeriod: tax.declarationPeriod, nextDueDate: tax.nextDueDate ?? "",
      isActive: !tax.isActive, notes: tax.notes ?? "",
    },
  });

  // IS rate from taxes table
  const isTax = taxes.find((t) => t.type === "income_tax" && t.isActive);
  const isRate = isTax ? parseFloat(isTax.rate ?? "28") : 28;
  const isAmount = summary ? (summary.resultatFiscal > 0 ? summary.resultatFiscal * (isRate / 100) : 0) : null;

  const tvaLines = tvaDetail?.data ?? [];

  // Schedule — computed deadlines
  const activeTaxes = taxes.filter((t) => t.isActive && t.declarationPeriod !== "none");
  const scheduleItems = activeTaxes
    .map((t) => {
      const deadline = computeNextDeadline(t.declarationPeriod, t.nextDueDate);
      const status = deadlineStatus(deadline);
      return { tax: t, deadline, status };
    })
    .filter((x) => x.deadline !== null)
    .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());

  const tabs = [
    { key: "referentiel",  label: "Référentiel fiscal" },
    { key: "summary",      label: "Synthèse fiscale" },
    { key: "schedule",     label: "Échéancier" },
    { key: "tva-detail",   label: "Détail TVA" },
  ] as const;

  return (
    <AccountingShell
      title="Taxes & états fiscaux"
      subtitle="Référentiel paramétrable · Synthèse temps réel · Échéancier déclaratif — TOGO / UEMOA"
    >
      <div className="space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b pb-0">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors
                ${tab === t.key
                  ? "bg-white border border-b-white border-slate-200 text-[#C8A24B] -mb-px"
                  : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Référentiel ── */}
        {tab === "referentiel" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base">Référentiel des taxes</h3>
                <p className="text-sm text-muted-foreground">{taxes.length} taxe{taxes.length > 1 ? "s" : ""} configurée{taxes.length > 1 ? "s" : ""}</p>
              </div>
              <Button onClick={() => { setEditTax(null); setFormOpen(true); }}
                className="bg-[#C8A24B] hover:bg-[#b8922b] text-white gap-2">
                <Plus className="w-4 h-4" /> Nouvelle taxe
              </Button>
            </div>

            {loadingTaxes ? (
              <div className="text-center py-12 text-muted-foreground">Chargement…</div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Taux</TableHead>
                      <TableHead>Comptes SYSCOHADA</TableHead>
                      <TableHead>Applicable à</TableHead>
                      <TableHead>Déclaration</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxes.map((tax) => {
                      const typeInfo = TAX_TYPES[tax.type] ?? TAX_TYPES.other;
                      const TypeIcon = typeInfo.icon;
                      return (
                        <TableRow key={tax.id} className={!tax.isActive ? "opacity-50" : ""}>
                          <TableCell>
                            <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded">{tax.code}</span>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{tax.name}</div>
                            {tax.description && <div className="text-xs text-muted-foreground line-clamp-1">{tax.description}</div>}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                              <TypeIcon className="w-3 h-3" />
                              {typeInfo.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold">
                            {tax.rate ? `${parseFloat(tax.rate).toFixed(2)} %` : <span className="text-muted-foreground text-xs">Variable</span>}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              {tax.collectAccountCode && <div className="text-slate-700">↑ {tax.collectAccountCode}</div>}
                              {tax.deductAccountCode && <div className="text-emerald-700">↓ {tax.deductAccountCode}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(tax.appliesTo ?? []).map((a) => (
                                <span key={a} className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                                  {APPLIES_TO_LABELS[a] ?? a}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{PERIODS[tax.declarationPeriod] ?? tax.declarationPeriod}</span>
                          </TableCell>
                          <TableCell>
                            <button onClick={() => toggleActive(tax)}
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors
                                ${tax.isActive
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                              {tax.isActive ? "Active" : "Inactive"}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => { setEditTax(tax); setFormOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeletingId(tax.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        )}

        {/* ── Synthèse fiscale ── */}
        {tab === "summary" && (
          <div className="space-y-4">
            {/* Filtres */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Du</label>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Au</label>
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
                  </div>
                  <Button variant="outline" onClick={() => {
                    const m = today.getMonth(); const y = today.getFullYear();
                    setFrom(new Date(y, m, 1).toISOString().slice(0, 10));
                    setTo(new Date(y, m + 1, 0).toISOString().slice(0, 10));
                  }}>Mois en cours</Button>
                  <Button variant="outline" onClick={() => {
                    const y = today.getFullYear();
                    setFrom(`${y}-01-01`); setTo(`${y}-12-31`);
                  }}>Année en cours</Button>
                </div>
              </CardContent>
            </Card>

            {loadingSummary ? (
              <div className="text-center py-12 text-muted-foreground">Chargement…</div>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <TaxKPI label="TVA collectée" value={formatFCFA(summary.tva.collectee)} sub="Compte 443x" icon={TrendingUp} accent="default" />
                  <TaxKPI label="TVA déductible" value={formatFCFA(summary.tva.deductible)} sub="Compte 445x" icon={Receipt} accent="default" />
                  <TaxKPI label="TVA nette due" value={formatFCFA(summary.tva.due)} sub={summary.tva.due > 0 ? "À décaisser" : "Crédit de TVA"} icon={Percent}
                    accent={summary.tva.due > 0 ? "warning" : "success"} />
                  <TaxKPI label="IRPP retenu" value={formatFCFA(summary.irpp)} sub="Compte 4473x" icon={Users} accent="default" />
                  <TaxKPI label="IPTS" value={formatFCFA(summary.ipts)} sub="Compte 4471x" icon={Building2} accent="default" />
                  <TaxKPI label="AIB" value={formatFCFA(summary.aib)} sub="Compte 4472x" icon={Receipt} accent="default" />
                  <TaxKPI label="CNSS" value={formatFCFA(summary.cnss)} sub="Compte 431x" icon={Users} accent="default" />
                </div>

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <TaxKPI label="Revenus (Cl. 7)" value={formatFCFA(summary.revenus)} icon={TrendingUp} accent="success" />
                  <TaxKPI label="Charges (Cl. 6)" value={formatFCFA(summary.charges)} icon={Receipt} accent="default" />
                  <TaxKPI label="Résultat fiscal" value={formatFCFA(summary.resultatFiscal)} icon={Building2}
                    accent={summary.resultatFiscal >= 0 ? "success" : "danger"} />
                  <TaxKPI
                    label={`IS estimé (${isRate.toFixed(0)}%${isTax ? ` — ${isTax.code}` : " — défaut"})`}
                    value={isAmount !== null ? formatFCFA(isAmount) : "—"}
                    sub={summary.resultatFiscal <= 0 ? "Résultat négatif" : "Projection sur résultat courant"}
                    icon={Percent}
                    accent={isAmount && isAmount > 0 ? "warning" : "default"}
                  />
                </div>

                {isTax && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Taux IS lu depuis le référentiel fiscal ({isTax.name} — {isTax.code}) — modifiable dans l'onglet <strong>Référentiel fiscal</strong>.
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── Échéancier ── */}
        {tab === "schedule" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base">Échéancier des obligations déclaratives</h3>
              <p className="text-sm text-muted-foreground">Prochaines échéances calculées d'après le référentiel fiscal</p>
            </div>

            {scheduleItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Aucune taxe active avec périodicité déclarative.</p>
                  <p className="text-sm">Configurez vos taxes dans l'onglet <strong>Référentiel fiscal</strong>.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {scheduleItems.map(({ tax, deadline, status }) => {
                  const typeInfo = TAX_TYPES[tax.type] ?? TAX_TYPES.other;
                  const TypeIcon = typeInfo.icon;
                  const diff = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86400000) : null;
                  const statusStyles = {
                    ok:      "border-l-4 border-emerald-400 bg-emerald-50",
                    soon:    "border-l-4 border-amber-400 bg-amber-50",
                    overdue: "border-l-4 border-red-400 bg-red-50",
                  };
                  const statusIcons = {
                    ok:      <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
                    soon:    <Clock className="w-4 h-4 text-amber-500" />,
                    overdue: <AlertTriangle className="w-4 h-4 text-red-500" />,
                  };
                  return (
                    <div key={tax.id} className={`rounded-lg p-4 flex items-center gap-4 ${statusStyles[status]}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeInfo.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{tax.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{tax.code}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{PERIODS[tax.declarationPeriod]} · {tax.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {statusIcons[status]}
                          <span className="font-semibold text-sm">
                            {deadline ? fmtDate(deadline.toISOString().slice(0, 10)) : "—"}
                          </span>
                        </div>
                        <div className={`text-xs font-medium mt-0.5
                          ${status === "overdue" ? "text-red-600" : status === "soon" ? "text-amber-600" : "text-emerald-600"}`}>
                          {diff === null ? "" : diff < 0 ? `${Math.abs(diff)}j de retard` : diff === 0 ? "Aujourd'hui" : `Dans ${diff}j`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#C8A24B] mt-0.5 shrink-0" />
                  <div className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Délais légaux Togo / UEMOA :</strong>{" "}
                    TVA — 15 du mois suivant · IRPP/IPTS — 15 du mois suivant · AIB — 15 du trimestre suivant · CNSS — 15 du mois suivant · IS — 30 avril N+1.
                    Pour personnaliser une échéance, éditez la taxe dans l'onglet <strong>Référentiel fiscal</strong>.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Détail TVA ── */}
        {tab === "tva-detail" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Du</label>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Au</label>
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
                  </div>
                  <Button variant="outline" onClick={() => {
                    const m = today.getMonth(); const y = today.getFullYear();
                    setFrom(new Date(y, m, 1).toISOString().slice(0, 10));
                    setTo(new Date(y, m + 1, 0).toISOString().slice(0, 10));
                  }}>Mois en cours</Button>
                  <Button variant="outline" onClick={() => {
                    const y = today.getFullYear();
                    setFrom(`${y}-01-01`); setTo(`${y}-12-31`);
                  }}>Année en cours</Button>
                </div>
              </CardContent>
            </Card>

            {loadingTva ? (
              <div className="text-center py-12 text-muted-foreground">Chargement…</div>
            ) : (
              <>
                {[
                  { title: "TVA collectée", lines: tvaLines.filter((l) => l.accountCode.startsWith("443")), accent: "bg-amber-50 border-amber-200" },
                  { title: "TVA déductible", lines: tvaLines.filter((l) => l.accountCode.startsWith("445")), accent: "bg-emerald-50 border-emerald-200" },
                ].map(({ title, lines, accent }) => (
                  <Card key={title} className={`border ${accent}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                      <CardDescription className="text-xs">
                        {lines.length} ligne{lines.length > 1 ? "s" : ""} ·{" "}
                        Crédit : {formatFCFA(lines.reduce((s, l) => s + l.credit, 0))} /
                        Débit : {formatFCFA(lines.reduce((s, l) => s + l.debit, 0))}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Écriture</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Compte</TableHead>
                            <TableHead>Libellé</TableHead>
                            <TableHead className="text-right">Débit</TableHead>
                            <TableHead className="text-right">Crédit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                                Aucune écriture TVA sur la période
                              </TableCell>
                            </TableRow>
                          ) : lines.map((l, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{l.entryNumber}</TableCell>
                              <TableCell className="text-xs">{fmtDate(l.entryDate)}</TableCell>
                              <TableCell className="font-mono text-xs">{l.accountCode}</TableCell>
                              <TableCell className="text-xs max-w-xs truncate">{l.description ?? l.accountLabel}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{l.debit > 0 ? formatFCFA(l.debit) : "—"}</TableCell>
                              <TableCell className="text-right text-xs font-mono">{l.credit > 0 ? formatFCFA(l.credit) : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Form dialog */}
      <TaxFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTax(null); }}
        initial={editTax}
        onSave={async (data) => {
          if (editTax) {
            await updateMutation.mutateAsync({ id: editTax.id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la taxe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La taxe sera définitivement supprimée du référentiel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccountingShell>
  );
}
