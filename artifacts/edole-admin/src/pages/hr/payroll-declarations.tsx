import React, { useState } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Download, FileText, Building2, Percent, Users, ArrowLeft,
  CheckCircle, ChevronRight, RefreshCw, Info,
  Send, Clock, ShieldCheck, XCircle, Calendar,
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

type Run = {
  id: string;
  period: string;
  status: string;
  employeeCount?: number;
  totalGrossSalary: number;
  totalNetSalary: number;
  totalCnssEmployee?: number;
  totalCnssEmployer?: number;
  totalIrpp?: number;
  totalIpts?: number;
};

type TaxDeclaration = {
  id: string;
  type: string;
  period: string;
  status: string;
  totalAmount: number;
  referenceNumber?: string | null;
  submittedAt?: string | null;
  validatedAt?: string | null;
  notes?: string | null;
};

type CnssRow = {
  numero: number; matricule: string; nom: string; departement: string; poste: string;
  salaireBrut: number; partSalariale: number; partPatronale: number; totalCnss: number;
};

type IrppRow = {
  numero: number; matricule: string; nom: string; departement: string; poste: string;
  salaireBrut: number; cnssEmployee: number; revenuImposable: number; irpp: number; ipts: number; netSalary: number;
  detail: Array<{ tranche: string; base: number; taux: number; montant: number }>;
};

type CnssData = {
  run: { id: string; period: string; status: string; employeeCount?: number };
  taux: { salarie: number; patronal: number };
  rows: CnssRow[];
  totaux: { totalBrut: number; totalSal: number; totalPat: number; totalCnss: number };
};

type IrppData = {
  run: { id: string; period: string; status: string; employeeCount?: number };
  bareme: Array<{ de: number; a: number | null; taux: number }>;
  rows: IrppRow[];
  totaux: { totalBrut: number; totalRevImposable: number; totalIrpp: number; totalIpts: number; totalNet: number };
};

const STATUS_LABEL: Record<string, string> = { draft: "Brouillon", validated: "Validé", paid: "Payé", archived: "Archivé" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  validated: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-gray-50 text-gray-600 border-gray-200",
};

const DECL_STATUS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft:     { label: "Non enregistré", icon: Clock,       color: "text-gray-500" },
  generated: { label: "Enregistré",     icon: FileText,    color: "text-blue-600" },
  submitted: { label: "Soumis",         icon: Send,        color: "text-amber-600" },
  validated: { label: "Validé OTR",     icon: ShieldCheck, color: "text-emerald-600" },
  rejected:  { label: "Rejeté",         icon: XCircle,     color: "text-red-600" },
};

function downloadExcel(url: string, filename: string) {
  const token = localStorage.getItem("auth_token");
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR");
}

function toInputDate(d: string | null | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0];
  return new Date(d).toISOString().split("T")[0];
}

type SubmitPayload = {
  status: "submitted" | "validated";
  referenceNumber?: string;
  submittedAt?: string;
  validatedAt?: string;
  notes?: string;
};

type SubmitDialogProps = {
  open: boolean;
  onClose: () => void;
  declaration: TaxDeclaration | null;
  targetStatus: "submitted" | "validated";
  onSave: (id: string, data: SubmitPayload) => void;
  isSaving: boolean;
};

function SubmitDialog({ open, onClose, declaration, targetStatus, onSave, isSaving }: SubmitDialogProps) {
  const isValidate = targetStatus === "validated";
  const isAlreadySubmitted = declaration?.status === "submitted" && targetStatus === "submitted";

  const [ref, setRef] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [notes, setNotes] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setRef(declaration?.referenceNumber ?? "");
    setNotes(declaration?.notes ?? "");
    if (isValidate) {
      setDateValue(toInputDate(declaration?.validatedAt));
    } else if (isAlreadySubmitted) {
      setDateValue(toInputDate(declaration?.submittedAt));
    } else {
      setDateValue(new Date().toISOString().split("T")[0]);
    }
  }, [open, declaration, isValidate, isAlreadySubmitted]);

  const typeLabel = declaration?.type === "cnss" ? "CNSS" : declaration?.type === "irpp" ? "IRPP" : "IPTS";
  const dateLabel = isValidate ? "Date de validation OTR" : "Date de soumission";
  const datePlaceholder = isValidate ? "Date de validation par l'OTR" : "Date de dépôt de la déclaration";

  const handleSave = () => {
    if (!declaration) return;
    const payload: SubmitPayload = {
      status: targetStatus,
      referenceNumber: ref || undefined,
      notes: notes || undefined,
    };
    if (isValidate) {
      payload.validatedAt = dateValue;
      if (isAlreadySubmitted || declaration.status === "submitted") {
        payload.submittedAt = toInputDate(declaration.submittedAt);
      }
    } else {
      payload.submittedAt = dateValue;
    }
    onSave(declaration.id, payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isValidate
              ? `Valider la déclaration ${typeLabel}`
              : isAlreadySubmitted
                ? `Modifier la soumission ${typeLabel}`
                : `Soumettre la déclaration ${typeLabel}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>{dateLabel} <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={dateValue}
              onChange={e => setDateValue(e.target.value)}
              placeholder={datePlaceholder}
            />
          </div>
          <div>
            <Label>Numéro de référence {isValidate ? "OTR" : "CNSS / OTR"}</Label>
            <Input
              placeholder={isValidate ? "Ex. OTR-2026-00123" : "Ex. CNSS-2026-00456"}
              value={ref}
              onChange={e => setRef(e.target.value)}
            />
          </div>
          <div>
            <Label>Notes / Observations</Label>
            <Input placeholder="Optionnel" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {declaration && (
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-sm text-muted-foreground space-y-1">
              <p>Période : <span className="font-medium text-foreground">{declaration.period}</span></p>
              <p>Montant : <span className="font-medium text-foreground">{formatFCFA(declaration.totalAmount)}</span></p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={isSaving || !declaration || !dateValue} onClick={handleSave}>
            {isSaving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : isValidate ? <ShieldCheck className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            {isValidate ? "Marquer validé" : isAlreadySubmitted ? "Mettre à jour" : "Marquer soumis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclStatusRow({ decl, typeLabel, onSubmit, onValidate }: {
  decl: TaxDeclaration | undefined;
  typeLabel: string;
  onSubmit: () => void;
  onValidate: () => void;
}) {
  const status = decl?.status ?? "pending_generate";
  const info = DECL_STATUS[status] ?? DECL_STATUS.draft;
  const Icon = info.icon;

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        <span className="text-sm font-semibold w-12 shrink-0">{typeLabel}</span>
        {decl ? (
          <div className={`flex items-center gap-1.5 text-xs font-medium ${info.color}`}>
            <Icon className="w-3.5 h-3.5" />
            {info.label}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <Clock className="w-3.5 h-3.5" />Non enregistré
          </div>
        )}
        {decl?.submittedAt && (
          <span className="text-xs text-muted-foreground">
            Soumis le {fmtDate(decl.submittedAt)}
            {decl.referenceNumber && <> — <span className="font-mono font-semibold text-foreground">{decl.referenceNumber}</span></>}
          </span>
        )}
        {decl?.validatedAt && (
          <span className="text-xs text-emerald-700 font-medium">Validé le {fmtDate(decl.validatedAt)}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(!decl || decl.status === "generated" || decl.status === "submitted") && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSubmit}>
            <Send className="w-3 h-3 mr-1" />
            {!decl ? "Générer & Soumettre" : decl.status === "submitted" ? "Modifier réf." : "Soumettre"}
          </Button>
        )}
        {decl?.status === "submitted" && (
          <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={onValidate}>
            <ShieldCheck className="w-3 h-3 mr-1" />Valider OTR
          </Button>
        )}
        {decl?.status === "validated" && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />Validé OTR
          </span>
        )}
        {decl?.status === "rejected" && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSubmit}>
            <RefreshCw className="w-3 h-3 mr-1" />Re-soumettre
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PayrollDeclarations() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"cnss" | "irpp">("cnss");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [submitDialog, setSubmitDialog] = useState<{
    decl: TaxDeclaration;
    targetStatus: "submitted" | "validated";
  } | null>(null);

  const { data: runs = [], isLoading: runsLoading } = useQuery<Run[]>({
    queryKey: ["payroll-runs"],
    queryFn: () => fetchJSON(`${API}/payroll/runs`),
  });

  const validatedRuns = runs.filter(r => r.status === "validated" || r.status === "paid");
  const selectedRun = validatedRuns.find(r => r.id === selectedRunId) ?? validatedRuns[0] ?? null;
  const runId = selectedRun?.id ?? null;
  const period = selectedRun?.period ?? null;

  const { data: cnssData, isLoading: cnssLoading } = useQuery<CnssData>({
    queryKey: ["declaration-cnss", runId],
    queryFn: () => fetchJSON(`${API}/payroll/runs/${runId}/declarations/cnss`),
    enabled: !!runId && activeTab === "cnss",
  });

  const { data: irppData, isLoading: irppLoading } = useQuery<IrppData>({
    queryKey: ["declaration-irpp", runId],
    queryFn: () => fetchJSON(`${API}/payroll/runs/${runId}/declarations/irpp`),
    enabled: !!runId && activeTab === "irpp",
  });

  const { data: taxDecls = [], refetch: refetchDecls } = useQuery<TaxDeclaration[]>({
    queryKey: ["tax-declarations", period],
    queryFn: () => fetchJSON(`${API}/hr/tax-declarations?period=${period}`),
    enabled: !!period,
  });

  const cnssDecl = taxDecls.find(d => d.type === "cnss");
  const irppDecl = taxDecls.find(d => d.type === "irpp");
  const iptsDecl = taxDecls.find(d => d.type === "ipts");

  const generateDeclMut = useMutation({
    mutationFn: (runIdToGen: string) =>
      fetchJSON(`${API}/hr/tax-declarations/generate/${runIdToGen}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-declarations", period] });
      qc.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      toast({ title: "Déclarations enregistrées", description: "CNSS, IRPP et IPTS ont été générées dans le registre fiscal." });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateDeclMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubmitPayload }) =>
      fetchJSON(`${API}/hr/tax-declarations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-declarations", period] });
      qc.invalidateQueries({ queryKey: ["all-tax-declarations"] });
      setSubmitDialog(null);
      toast({ title: "Statut mis à jour" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const generateThenOpenDialog = async (type: "cnss" | "irpp" | "ipts", targetStatus: "submitted" | "validated") => {
    if (!runId) return;
    try {
      const result: TaxDeclaration[] = await fetchJSON(`${API}/hr/tax-declarations/generate/${runId}`, { method: "POST" });
      await qc.invalidateQueries({ queryKey: ["tax-declarations", period] });
      const fresh = await refetchDecls();
      const decl = (fresh.data ?? []).find((d: TaxDeclaration) => d.type === type);
      if (decl) setSubmitDialog({ decl, targetStatus });
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e instanceof Error ? e.message : "Erreur lors de la génération"), variant: "destructive" });
    }
  };

  const handleOpenSubmit = async (type: "cnss" | "irpp" | "ipts", existingDecl: TaxDeclaration | undefined, targetStatus: "submitted" | "validated") => {
    if (existingDecl) {
      setSubmitDialog({ decl: existingDecl, targetStatus });
    } else {
      await generateThenOpenDialog(type, targetStatus);
    }
  };

  if (runsLoading) {
    return (
      <HrShell title="Déclarations fiscales" subtitle="États mensuels CNSS et IRPP">
        <div className="py-20 text-center text-muted-foreground">Chargement…</div>
      </HrShell>
    );
  }

  if (validatedRuns.length === 0) {
    return (
      <HrShell title="Déclarations fiscales" subtitle="États mensuels CNSS et IRPP">
        <div className="flex flex-col items-center py-16 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <FileText className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Aucun cycle validé</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Les déclarations CNSS et IRPP sont disponibles uniquement pour les cycles de paie validés ou payés.
          </p>
          <Button variant="outline" onClick={() => navigate("/hr/payroll")}>
            <ArrowLeft className="w-4 h-4 mr-1" />Retour à la paie
          </Button>
        </div>
      </HrShell>
    );
  }

  const activeRun = selectedRun ?? validatedRuns[0];

  const overallDeclStatus = (() => {
    const decls = [cnssDecl, irppDecl, iptsDecl].filter(Boolean) as TaxDeclaration[];
    if (decls.length === 0) return null;
    if (decls.every(d => d.status === "validated")) return "validated";
    if (decls.some(d => d.status === "submitted")) return "submitted";
    if (decls.some(d => d.status === "generated")) return "generated";
    return null;
  })();

  return (
    <HrShell title="Déclarations fiscales" subtitle="États mensuels CNSS et IRPP — génération automatique depuis les bulletins validés">
      <div className="space-y-6">

        {/* ─── Sélecteur de cycle ─── */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Cycle :</span>
            <div className="flex flex-wrap gap-2">
              {validatedRuns.slice(0, 8).map(r => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedRunId(r.id); setExpandedRow(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    activeRun.id === r.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {r.period}
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateDeclMut.mutate(activeRun.id)}
            disabled={generateDeclMut.isPending}
          >
            {generateDeclMut.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1 text-emerald-600" />}
            Enregistrer dans le registre
          </Button>
        </div>

        {/* ─── KPIs du cycle sélectionné ─── */}
        {activeRun && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Collaborateurs", value: String(activeRun.employeeCount ?? "—"), icon: Users, color: "text-blue-600 bg-blue-50" },
              { label: "Masse brute", value: formatFCFA(activeRun.totalGrossSalary), icon: Building2, color: "text-orange-600 bg-orange-50" },
              { label: "CNSS total (sal. + pat.)", value: formatFCFA((activeRun.totalCnssEmployee ?? 0) + (activeRun.totalCnssEmployer ?? 0)), icon: Building2, color: "text-purple-600 bg-purple-50" },
              { label: "IRPP total", value: formatFCFA(activeRun.totalIrpp ?? 0), icon: Percent, color: "text-red-600 bg-red-50" },
            ].map(k => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.color}`}>
                      <k.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                      <p className="text-base font-bold truncate">{k.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ─── Suivi de soumission ─── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Suivi de conformité fiscale — {activeRun.period}</h3>
              </div>
              {overallDeclStatus && (
                <Badge
                  variant="outline"
                  className={
                    overallDeclStatus === "validated" ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                    overallDeclStatus === "submitted" ? "border-amber-300 text-amber-700 bg-amber-50" :
                    "border-blue-300 text-blue-700 bg-blue-50"
                  }
                >
                  {overallDeclStatus === "validated" ? "✓ Toutes déclarations validées" :
                   overallDeclStatus === "submitted" ? "En attente de validation" :
                   "Enregistrées — à soumettre"}
                </Badge>
              )}
            </div>
            <div className="divide-y">
              <DeclStatusRow
                decl={cnssDecl}
                typeLabel="CNSS"
                onSubmit={() => handleOpenSubmit("cnss", cnssDecl, "submitted")}
                onValidate={() => cnssDecl && setSubmitDialog({ decl: cnssDecl, targetStatus: "validated" })}
              />
              <DeclStatusRow
                decl={irppDecl}
                typeLabel="IRPP"
                onSubmit={() => handleOpenSubmit("irpp", irppDecl, "submitted")}
                onValidate={() => irppDecl && setSubmitDialog({ decl: irppDecl, targetStatus: "validated" })}
              />
              <DeclStatusRow
                decl={iptsDecl}
                typeLabel="IPTS"
                onSubmit={() => handleOpenSubmit("ipts", iptsDecl, "submitted")}
                onValidate={() => iptsDecl && setSubmitDialog({ decl: iptsDecl, targetStatus: "validated" })}
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── Onglets CNSS / IRPP ─── */}
        <div className="border-b border-border">
          <nav className="flex gap-1 -mb-px">
            {(["cnss", "irpp"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setExpandedRow(null); }}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {tab === "cnss" ? "CNSS — Cotisations sociales" : "IRPP — Impôt sur le revenu"}
              </button>
            ))}
          </nav>
        </div>

        {/* ─── CNSS ─── */}
        {activeTab === "cnss" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold">Déclaration CNSS</h2>
                <Badge variant="outline" className="font-mono text-xs">Salarié 4% | Patronal 16,4%</Badge>
                {cnssDecl && (
                  <Badge
                    variant="outline"
                    className={
                      cnssDecl.status === "validated" ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                      cnssDecl.status === "submitted" ? "border-amber-300 text-amber-700 bg-amber-50" :
                      "border-blue-300 text-blue-700 bg-blue-50"
                    }
                  >
                    {DECL_STATUS[cnssDecl.status]?.label ?? cnssDecl.status}
                    {cnssDecl.submittedAt && ` — ${fmtDate(cnssDecl.submittedAt)}`}
                    {cnssDecl.referenceNumber && ` — ${cnssDecl.referenceNumber}`}
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadExcel(
                  `${API}/payroll/runs/${activeRun.id}/declarations/cnss?format=excel`,
                  `CNSS_${activeRun.period}.xlsx`
                )}
              >
                <Download className="w-4 h-4 mr-1" />Exporter Excel
              </Button>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-3 text-sm text-blue-800">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Ces cotisations sont à verser à la <strong>CNSS Togo</strong> avant le <strong>15 du mois suivant</strong> la période de paie.</span>
            </div>

            {cnssLoading ? (
              <div className="py-10 text-center text-muted-foreground">Calcul en cours…</div>
            ) : cnssData ? (
              <>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-3 py-3 text-left">N°</th>
                        <th className="px-3 py-3 text-left">Matricule</th>
                        <th className="px-3 py-3 text-left">Nom & Prénom</th>
                        <th className="px-3 py-3 text-left">Département</th>
                        <th className="px-3 py-3 text-right">Salaire Brut</th>
                        <th className="px-3 py-3 text-right">Part Salariale (4%)</th>
                        <th className="px-3 py-3 text-right">Part Patronale (16,4%)</th>
                        <th className="px-3 py-3 text-right font-semibold text-foreground">Total CNSS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cnssData.rows.map(r => (
                        <tr key={r.numero} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2.5 text-muted-foreground">{r.numero}</td>
                          <td className="px-3 py-2.5 font-mono text-xs">{r.matricule}</td>
                          <td className="px-3 py-2.5 font-medium">{r.nom}</td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.departement}</td>
                          <td className="px-3 py-2.5 text-right">{formatFCFA(r.salaireBrut)}</td>
                          <td className="px-3 py-2.5 text-right text-amber-700">{formatFCFA(r.partSalariale)}</td>
                          <td className="px-3 py-2.5 text-right text-purple-700">{formatFCFA(r.partPatronale)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{formatFCFA(r.totalCnss)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-orange-50/60">
                        <td colSpan={4} className="px-3 py-3 font-bold text-sm">
                          TOTAL — {cnssData.rows.length} employé{cnssData.rows.length > 1 ? "s" : ""}
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{formatFCFA(cnssData.totaux.totalBrut)}</td>
                        <td className="px-3 py-3 text-right font-bold text-amber-700">{formatFCFA(cnssData.totaux.totalSal)}</td>
                        <td className="px-3 py-3 text-right font-bold text-purple-700">{formatFCFA(cnssData.totaux.totalPat)}</td>
                        <td className="px-3 py-3 text-right font-bold text-primary text-base">{formatFCFA(cnssData.totaux.totalCnss)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  {[
                    { label: "Cotisations salariales (4%)", value: cnssData.totaux.totalSal, color: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Cotisations patronales (16,4%)", value: cnssData.totaux.totalPat, color: "text-purple-700 bg-purple-50 border-purple-200" },
                    { label: "Total à verser CNSS", value: cnssData.totaux.totalCnss, color: "text-primary bg-primary/5 border-primary/20" },
                  ].map(s => (
                    <Card key={s.label} className={`border ${s.color}`}>
                      <CardContent className="p-4">
                        <p className="text-xs font-medium mb-1">{s.label}</p>
                        <p className="text-lg font-bold">{formatFCFA(s.value)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ─── IRPP ─── */}
        {activeTab === "irpp" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold">État IRPP mensuel</h2>
                <Badge variant="outline" className="font-mono text-xs">Barème progressif SYSCOHADA</Badge>
                {irppDecl && (
                  <Badge
                    variant="outline"
                    className={
                      irppDecl.status === "validated" ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                      irppDecl.status === "submitted" ? "border-amber-300 text-amber-700 bg-amber-50" :
                      "border-blue-300 text-blue-700 bg-blue-50"
                    }
                  >
                    {DECL_STATUS[irppDecl.status]?.label ?? irppDecl.status}
                    {irppDecl.submittedAt && ` — ${fmtDate(irppDecl.submittedAt)}`}
                    {irppDecl.referenceNumber && ` — ${irppDecl.referenceNumber}`}
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadExcel(
                  `${API}/payroll/runs/${activeRun.id}/declarations/irpp?format=excel`,
                  `IRPP_${activeRun.period}.xlsx`
                )}
              >
                <Download className="w-4 h-4 mr-1" />Exporter Excel
              </Button>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3 text-sm text-amber-800">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>L'IRPP est calculé sur le revenu imposable annualisé (brut – CNSS salarié × 12) puis ramené au mois. À verser à l'<strong>OTR Togo</strong> avant le <strong>15 du mois suivant</strong>.</span>
            </div>

            <details className="rounded-lg border bg-muted/20">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium flex items-center gap-2">
                <Percent className="w-4 h-4 text-muted-foreground" />
                Barème progressif IRPP (Togo)
                <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
              </summary>
              <div className="px-4 pb-4">
                <table className="w-full text-xs mt-2">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      <th className="pb-1 text-left">Tranche (XOF/an)</th>
                      <th className="pb-1 text-right">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { de: 0, a: 900_000, taux: "0 %" },
                      { de: 900_001, a: 1_500_000, taux: "7 %" },
                      { de: 1_500_001, a: 2_500_000, taux: "11 %" },
                      { de: 2_500_001, a: 4_000_000, taux: "15 %" },
                      { de: 4_000_001, a: 6_000_000, taux: "20 %" },
                      { de: 6_000_001, a: 10_000_000, taux: "25 %" },
                      { de: 10_000_001, a: null, taux: "35 %" },
                    ].map(t => (
                      <tr key={t.de} className="border-b last:border-0">
                        <td className="py-1.5 text-muted-foreground">
                          {t.de.toLocaleString("fr-FR")} – {t.a ? t.a.toLocaleString("fr-FR") : "∞"}
                        </td>
                        <td className="py-1.5 text-right font-mono font-semibold">{t.taux}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {irppLoading ? (
              <div className="py-10 text-center text-muted-foreground">Calcul en cours…</div>
            ) : irppData ? (
              <>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-3 py-3 text-left">N°</th>
                        <th className="px-3 py-3 text-left">Matricule</th>
                        <th className="px-3 py-3 text-left">Nom & Prénom</th>
                        <th className="px-3 py-3 text-right">Brut</th>
                        <th className="px-3 py-3 text-right">CNSS sal.</th>
                        <th className="px-3 py-3 text-right">Rev. Imposable</th>
                        <th className="px-3 py-3 text-right text-foreground font-semibold">IRPP</th>
                        <th className="px-3 py-3 text-right">IPTS (2%)</th>
                        <th className="px-3 py-3 text-right">Net</th>
                        <th className="px-3 py-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {irppData.rows.map(r => (
                        <React.Fragment key={r.numero}>
                          <tr
                            className="border-t hover:bg-muted/20 cursor-pointer"
                            onClick={() => setExpandedRow(expandedRow === r.numero ? null : r.numero)}
                          >
                            <td className="px-3 py-2.5 text-muted-foreground">{r.numero}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{r.matricule}</td>
                            <td className="px-3 py-2.5 font-medium">{r.nom}</td>
                            <td className="px-3 py-2.5 text-right">{formatFCFA(r.salaireBrut)}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">{formatFCFA(r.cnssEmployee)}</td>
                            <td className="px-3 py-2.5 text-right">{formatFCFA(r.revenuImposable)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-red-700">{formatFCFA(r.irpp)}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">{formatFCFA(r.ipts)}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-emerald-700">{formatFCFA(r.netSalary)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedRow === r.numero ? "rotate-90" : ""}`} />
                            </td>
                          </tr>
                          {expandedRow === r.numero && r.detail.length > 0 && (
                            <tr className="bg-muted/10">
                              <td colSpan={10} className="px-6 py-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Détail par tranche IRPP (base annuelle × 1/12)</p>
                                <table className="w-full max-w-lg text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground">
                                      <th className="text-left pb-1">Tranche (XOF/an)</th>
                                      <th className="text-right pb-1">Base/mois</th>
                                      <th className="text-right pb-1">Taux</th>
                                      <th className="text-right pb-1">Montant/mois</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.detail.map((d, di) => (
                                      <tr key={di} className="border-t border-muted">
                                        <td className="py-1 text-muted-foreground">{d.tranche}</td>
                                        <td className="py-1 text-right">{formatFCFA(d.base)}</td>
                                        <td className="py-1 text-right font-mono">{(d.taux * 100).toFixed(0)}%</td>
                                        <td className="py-1 text-right font-semibold">{formatFCFA(d.montant)}</td>
                                      </tr>
                                    ))}
                                    <tr className="border-t border-muted font-bold">
                                      <td className="pt-1" colSpan={3}>Total IRPP mensuel</td>
                                      <td className="pt-1 text-right text-red-700">{formatFCFA(r.irpp)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-orange-50/60">
                        <td colSpan={3} className="px-3 py-3 font-bold text-sm">
                          TOTAL — {irppData.rows.length} employé{irppData.rows.length > 1 ? "s" : ""}
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{formatFCFA(irppData.totaux.totalBrut)}</td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3 text-right font-bold">{formatFCFA(irppData.totaux.totalRevImposable)}</td>
                        <td className="px-3 py-3 text-right font-bold text-red-700 text-base">{formatFCFA(irppData.totaux.totalIrpp)}</td>
                        <td className="px-3 py-3 text-right font-bold">{formatFCFA(irppData.totaux.totalIpts)}</td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-700">{formatFCFA(irppData.totaux.totalNet)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  {[
                    { label: "Total IRPP à verser OTR", value: irppData.totaux.totalIrpp, color: "text-red-700 bg-red-50 border-red-200" },
                    { label: "Total IPTS (2%)", value: irppData.totaux.totalIpts, color: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Total retenues fiscales", value: irppData.totaux.totalIrpp + irppData.totaux.totalIpts, color: "text-primary bg-primary/5 border-primary/20" },
                  ].map(s => (
                    <Card key={s.label} className={`border ${s.color}`}>
                      <CardContent className="p-4">
                        <p className="text-xs font-medium mb-1">{s.label}</p>
                        <p className="text-lg font-bold">{formatFCFA(s.value)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      <SubmitDialog
        open={!!submitDialog}
        onClose={() => setSubmitDialog(null)}
        declaration={submitDialog?.decl ?? null}
        targetStatus={submitDialog?.targetStatus ?? "submitted"}
        onSave={(id, data) => updateDeclMut.mutate({ id, data })}
        isSaving={updateDeclMut.isPending}
      />
    </HrShell>
  );
}
