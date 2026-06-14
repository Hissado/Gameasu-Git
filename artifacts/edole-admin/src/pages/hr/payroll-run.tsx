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
  Users, Banknote, TrendingUp, Receipt, Search, Play, ArrowLeft,
  Download, FileDown, Archive, ChevronDown, X, Mail, MailCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

const API = "/api";

async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

async function downloadFile(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? r.statusText); }
  const blob = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
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
  collaboratorId: string; firstName: string; lastName: string; email?: string | null; department?: string; jobTitle?: string;
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
function NumCell({ value, onChange, disabled, unit = "fcfa" }: { value: number; onChange: (v: number) => void; disabled?: boolean; unit?: "fcfa" | "hours" }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && ref.current) ref.current.select(); }, [editing]);
  useEffect(() => { if (!editing) setRaw(String(value)); }, [value, editing]);

  function fmt(v: number) {
    if (unit === "hours") return v > 0 ? `${v} h` : "—";
    return v > 0 ? formatFCFA(v) : "—";
  }

  if (disabled) {
    return <span className="text-right block text-sm">{fmt(value) !== "—" ? fmt(value) : <span className="text-muted-foreground">—</span>}</span>;
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
      {value !== 0 ? fmt(value) : <span className="text-muted-foreground text-xs">{unit === "hours" ? "0 h" : "0 — modifier"}</span>}
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
  const [isFlushing, setIsFlushing] = useState(false);
  const [search, setSearch] = useState("");
  const [localItems, setLocalItems] = useState<LineItem[]>([]);
  const pendingPatchesRef = useRef<Record<string, Partial<LineItem>>>({});
  const localItemsRef = useRef<LineItem[]>([]);
  // ── Sélection en masse ───────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skippedCollabs, setSkippedCollabs] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<{
    action: "payment_method" | "bonus" | "commission" | "reimbursement" | "deduction" | "correction" | "note" | null;
  }>({ action: null });
  const [bulkVal, setBulkVal] = useState("");

  function toggleRow(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.collaboratorId)));
  }
  function skipSelected() {
    setSkippedCollabs(s => { const n = new Set(s); selected.forEach(id => n.add(id)); return n; });
    setSelected(new Set());
  }
  function unskipSelected() {
    setSkippedCollabs(s => { const n = new Set(s); selected.forEach(id => n.delete(id)); return n; });
    setSelected(new Set());
  }

  function openBulk(action: typeof bulkDialog["action"]) { setBulkVal(""); setBulkDialog({ action }); }
  function applyBulk() {
    const { action } = bulkDialog;
    if (!action) return;
    selected.forEach(id => {
      if (action === "payment_method") {
        updateLine(id, "paymentMethod", bulkVal);
      } else if (action === "bonus") {
        const cur = localItems.find(l => l.collaboratorId === id);
        updateLine(id, "bonus", (cur?.bonus ?? 0) + (parseFloat(bulkVal) || 0));
      } else if (action === "commission") {
        const cur = localItems.find(l => l.collaboratorId === id);
        updateLine(id, "commission", (cur?.commission ?? 0) + (parseFloat(bulkVal) || 0));
      } else if (action === "reimbursement") {
        const cur = localItems.find(l => l.collaboratorId === id);
        updateLine(id, "reimbursement", (cur?.reimbursement ?? 0) + (parseFloat(bulkVal) || 0));
      } else if (action === "deduction") {
        const cur = localItems.find(l => l.collaboratorId === id);
        updateLine(id, "deduction", (cur?.deduction ?? 0) + (parseFloat(bulkVal) || 0));
      } else if (action === "correction") {
        const cur = localItems.find(l => l.collaboratorId === id);
        updateLine(id, "payrollCorrection", (cur?.payrollCorrection ?? 0) + (parseFloat(bulkVal) || 0));
      } else if (action === "note") {
        updateLine(id, "notes", bulkVal);
      }
    });
    setBulkDialog({ action: null });
  }

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

  const { data: runDetail, refetch: refetchRunDetail } = useQuery<{ payslips: { id: string; collaboratorId: string; emailSentAt?: string | null }[] }>({
    queryKey: ["payroll-run-detail", runId],
    queryFn: () => fetchJSON(`${API}/payroll/runs/${runId}`),
    enabled: !!runId,
  });

  const payslipByCollab = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of (runDetail?.payslips ?? [])) m[p.collaboratorId] = p.id;
    return m;
  }, [runDetail?.payslips]);

  const emailSentByPayslip = React.useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const p of (runDetail?.payslips ?? [])) m[p.id] = p.emailSentAt ?? null;
    return m;
  }, [runDetail?.payslips]);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [exportingEmailCsv, setExportingEmailCsv] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [emailLogsPopover, setEmailLogsPopover] = useState<string | null>(null);

  type BulkEmailPhase = "confirm" | "sending" | "done";
  const [emailBulkDialog, setEmailBulkDialog] = useState<{
    open: boolean;
    phase: BulkEmailPhase;
    progress: number;
    result?: { sent: number; failed: number; skipped: number };
  }>({ open: false, phase: "confirm", progress: 0 });
  const emailBulkProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  type EmailLog = { id: string; sentAt: string; sentTo: string; provider: string | null; messageId: string | null; status: string; errorMessage: string | null };
  const { data: emailLogsData, isFetching: emailLogsFetching } = useQuery<{ logs: EmailLog[] }>({
    queryKey: ["payslip-email-logs", emailLogsPopover],
    queryFn: () => fetchJSON(`${API}/payroll/payslips/${emailLogsPopover}/email-logs`),
    enabled: !!emailLogsPopover,
    staleTime: 0,
  });

  useEffect(() => {
    if (data?.lineItems) setLocalItems(data.lineItems);
  }, [data]);

  // Keep ref in sync so flush callback always reads current items (no stale closure)
  useEffect(() => { localItemsRef.current = localItems; }, [localItems]);

  const run = data?.run;

  const { data: attendanceSummary } = useQuery<{
    period: string;
    data: Array<{ collaboratorId: string; collaboratorName: string; effectiveHours: number; workDays: number; lateDays: number }>;
  }>({
    queryKey: ["attendance-payroll-summary", run?.period],
    queryFn: () => fetchJSON(`${API}/attendance/payroll-summary?period=${run?.period}`),
    enabled: !!run?.period,
  });
  const attendanceMap = React.useMemo(() => {
    const m = new Map<string, { effectiveHours: number; workDays: number; lateDays: number }>();
    for (const row of (attendanceSummary?.data ?? [])) m.set(row.collaboratorId, row);
    return m;
  }, [attendanceSummary]);

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

  // Flush ALL pending patches — uses refs to avoid stale-closure issues
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flushAllPendingPatches() {
    const patches = pendingPatchesRef.current;
    if (Object.keys(patches).length === 0) return;
    pendingPatchesRef.current = {};
    for (const [collabId, patch] of Object.entries(patches)) {
      const item = localItemsRef.current.find(l => l.collaboratorId === collabId);
      if (item?.lineItemId && Object.keys(patch).length > 0) {
        patchLineMut.mutate({ lineId: item.lineItemId, patch });
      }
    }
  }

  // Flush all pending edits synchronously before a critical action (step change / submit)
  async function flushAndProceed(action: () => void) {
    if (flushTimeoutRef.current) { clearTimeout(flushTimeoutRef.current); flushTimeoutRef.current = null; }
    const patches = pendingPatchesRef.current;
    if (Object.keys(patches).length === 0) { action(); return; }
    pendingPatchesRef.current = {};
    setIsFlushing(true);
    try {
      await Promise.all(
        Object.entries(patches).map(([collabId, patch]) => {
          const item = localItemsRef.current.find(l => l.collaboratorId === collabId);
          if (!item?.lineItemId || Object.keys(patch).length === 0) return Promise.resolve();
          const numericPatch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(patch)) numericPatch[k] = v;
          return fetchJSON(`${API}/payroll/runs/${runId}/line-items/${item.lineItemId}`, {
            method: "PATCH",
            body: JSON.stringify(numericPatch),
          }).catch((e: Error) => toast({ title: "Erreur de sauvegarde", description: e.message, variant: "destructive" }));
        })
      );
    } finally {
      setIsFlushing(false);
    }
    action();
  }

  function updateLine(collaboratorId: string, field: keyof LineItem, value: number | string) {
    setLocalItems(items => items.map(item =>
      item.collaboratorId === collaboratorId ? { ...item, [field]: value } : item
    ));
    pendingPatchesRef.current = {
      ...pendingPatchesRef.current,
      [collaboratorId]: { ...(pendingPatchesRef.current[collaboratorId] ?? {}), [field]: value },
    };
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = setTimeout(flushAllPendingPatches, 800);
  }

  const filtered = localItems.filter(l =>
    search === "" || `${l.firstName} ${l.lastName}`.toLowerCase().includes(search.toLowerCase()) || (l.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Totaux (collaborateurs non exclus uniquement)
  const totals = localItems.filter(l => !skippedCollabs.has(l.collaboratorId)).reduce((acc, l) => {
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
            <Button size="sm" className="ml-auto" onClick={() => flushAndProceed(() => setStep(2))} disabled={localItems.length === 0 || isFlushing || patchLineMut.isPending}>
              {isFlushing ? "Sauvegarde…" : <>Vérifier & Soumettre <ChevronRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </div>

          {/* ── Barre de sélection flottante ─────────────────────── */}
          {selected.size > 0 && (
            <div className="sticky bottom-4 z-20 flex items-center gap-3 bg-foreground text-background rounded-xl px-4 py-2.5 shadow-xl w-fit mx-auto border border-foreground/20 animate-in slide-in-from-bottom-2 duration-200">
              <Checkbox
                checked
                className="border-background data-[state=checked]:bg-background data-[state=checked]:text-foreground"
                onCheckedChange={() => setSelected(new Set())}
                aria-label="Désélectionner tout"
              />
              <span className="text-sm font-semibold">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1 h-8">
                    Actions <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="w-56">
                  <DropdownMenuItem onClick={() => openBulk("payment_method")}>Mode de paiement</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={skipSelected} className="text-red-600 focus:text-red-600">
                    Exclure de la paie
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={unskipSelected} className="text-emerald-700 focus:text-emerald-700">
                    Inclure dans la paie
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openBulk("bonus")}>Ajouter une prime</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openBulk("commission")}>Ajouter une commission</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openBulk("reimbursement")}>Remboursement ponctuel</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openBulk("deduction")} className="text-red-600 focus:text-red-600">Déduction ponctuelle</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openBulk("correction")}>Correction de paie</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openBulk("note")}>Ajouter une note</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

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
                    <th className="px-3 py-2.5 text-center w-10 sticky left-0 bg-muted/50">
                      <Checkbox
                        checked={filtered.length > 0 && selected.size === filtered.length}
                        onCheckedChange={toggleAll}
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left sticky left-10 bg-muted/50 min-w-[180px]">Collaborateur</th>
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
                    <th className="px-3 py-2.5 text-left min-w-[160px]">Notes</th>
                    <th className="px-3 py-2.5 text-right min-w-[120px] font-semibold">Total brut</th>
                    <th className="px-3 py-2.5 text-right min-w-[120px] text-emerald-700">Net estimé</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, idx) => {
                    const { totalGross, net } = computeGross(l);
                    const isDraft = run?.status === "draft";
                    const isSelected = selected.has(l.collaboratorId);
                    const isSkipped = skippedCollabs.has(l.collaboratorId);
                    return (
                      <tr key={l.collaboratorId} className={`border-t ${isSkipped ? "opacity-40 bg-muted/30" : isSelected ? "bg-primary/[0.08]" : idx % 2 === 0 ? "bg-background" : "bg-muted/10"} hover:bg-primary/5`}>
                        <td className="px-3 py-2 text-center w-10 sticky left-0 bg-inherit">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(l.collaboratorId)}
                            aria-label={`Sélectionner ${l.firstName} ${l.lastName}`}
                          />
                        </td>
                        <td className="px-3 py-2 sticky left-10 bg-inherit border-r">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm">{l.firstName} {l.lastName}</span>
                            {isSkipped && <span className="text-[10px] bg-red-100 text-red-600 border border-red-200 rounded px-1 py-0.5 font-semibold">Exclu</span>}
                          </div>
                          {(l.department || l.jobTitle) && <div className="text-xs text-muted-foreground">{l.jobTitle ?? l.department}</div>}
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {l.attendanceSynced && <span className="text-xs text-blue-600">✓ présence sync</span>}
                            {(() => { const att = attendanceMap.get(l.collaboratorId); return att ? (
                              <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1 py-px">
                                {att.effectiveHours}h · {att.workDays}j{att.lateDays > 0 ? ` · ${att.lateDays} retard${att.lateDays > 1 ? "s" : ""}` : ""}
                              </span>
                            ) : null; })()}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-sm">{formatFCFA(l.baseSalary)}</td>
                        <td className="px-3 py-2"><NumCell unit="hours" value={l.regularHours} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "regularHours", v)} /></td>
                        <td className="px-3 py-2"><NumCell unit="hours" value={l.overtimeHours} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "overtimeHours", v)} /></td>
                        <td className="px-3 py-2"><NumCell unit="hours" value={l.leaveHours} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "leaveHours", v)} /></td>
                        <td className="px-3 py-2"><NumCell unit="hours" value={l.absenceHours} disabled={!isDraft} onChange={v => updateLine(l.collaboratorId, "absenceHours", v)} /></td>
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
                        <td className="px-3 py-2">
                          {isDraft ? (
                            <input
                              type="text"
                              className="w-full text-xs px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                              value={l.notes}
                              placeholder="Remarque…"
                              onChange={e => updateLine(l.collaboratorId, "notes", e.target.value)}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{l.notes || "—"}</span>
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
                    <td className="px-3 py-2.5 w-10 sticky left-0 bg-muted/40" />
                    <td className="px-3 py-2.5 sticky left-10 bg-muted/40 text-sm">TOTAUX ({filtered.length})</td>
                    <td className="px-3 py-2.5" />
                    <td colSpan={4} />
                    <td className="px-3 py-2.5 text-right text-sm">{formatFCFA(totals.bonus)}</td>
                    <td className="px-3 py-2.5 text-right text-sm">{formatFCFA(totals.commission)}</td>
                    <td className="px-3 py-2.5 text-right text-sm">{formatFCFA(totals.reimbursement)}</td>
                    <td className="px-3 py-2.5 text-right text-red-600 text-sm">{formatFCFA(totals.deduction)}</td>
                    <td colSpan={3} />
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
          <div className="flex justify-between items-center flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />Retour modifier
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.keys(payslipByCollab).length > 0 && (run?.status === "validated" || run?.status === "paid") && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sendingEmails}
                    onClick={() => setEmailBulkDialog({ open: true, phase: "confirm", progress: 0 })}
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Envoyer à tous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingZip}
                    onClick={async () => {
                      setDownloadingZip(true);
                      try {
                        await downloadFile(`${API}/payroll/runs/${runId}/pdf-zip`, `bulletins_paie_${run?.period ?? runId}.zip`);
                      } catch (e: any) {
                        toast({ title: "Erreur téléchargement ZIP", description: e.message, variant: "destructive" });
                      } finally { setDownloadingZip(false); }
                    }}
                  >
                    {downloadingZip ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Archive className="w-4 h-4 mr-1" />}
                    Télécharger tout (ZIP)
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={exportingEmailCsv}
                onClick={async () => {
                  setExportingEmailCsv(true);
                  try {
                    const params = new URLSearchParams();
                    if (run?.period) params.set("period", run.period);
                    await downloadFile(`${API}/payroll/payslip-email-logs/export.csv?${params}`, `historique_emails_bulletins_${run?.period ?? runId}.csv`);
                  } catch (e: any) {
                    toast({ title: "Erreur export CSV", description: e.message, variant: "destructive" });
                  } finally { setExportingEmailCsv(false); }
                }}
              >
                {exportingEmailCsv ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
                Exporter emails CSV
              </Button>
              <Button
                size="lg"
                onClick={() => flushAndProceed(() => validateMut.mutate())}
                disabled={validateMut.isPending || isFlushing || run?.status !== "draft" || localItems.length === 0}
                className="gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {isFlushing ? "Sauvegarde en cours…" : validateMut.isPending ? "Soumission…" : "Soumettre la paie"}
              </Button>
            </div>
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
                    <th className="px-4 py-3 text-center w-[110px]">Bulletin</th>
                    <th className="px-4 py-3 text-center w-[130px]">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {localItems.map((l) => {
                    const { totalGross, net } = computeGross(l);
                    const cnss = Math.round(totalGross * 0.04);
                    const irppIpts = Math.round(totalGross * 0.17);
                    const payslipId = payslipByCollab[l.collaboratorId];
                    const isDownloading = downloadingId === l.collaboratorId;
                    const isEmailing = emailingId === payslipId;
                    const emailSentAt = payslipId ? emailSentByPayslip[payslipId] : null;
                    const hasEmail = !!l.email;
                    return (
                      <tr key={l.collaboratorId} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">
                          <div className="flex items-center gap-1.5">
                            {l.firstName} {l.lastName}
                            {!hasEmail && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="text-xs">
                                    Aucun email renseigné
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{l.department}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatFCFA(totalGross)}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{formatFCFA(cnss)}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{formatFCFA(irppIpts)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatFCFA(net)}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{PAY_METHODS[l.paymentMethod] ?? l.paymentMethod}</td>
                        <td className="px-4 py-2.5 text-center">
                          {payslipId ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs gap-1"
                              disabled={isDownloading}
                              onClick={async () => {
                                setDownloadingId(l.collaboratorId);
                                try {
                                  const safeName = `${l.firstName}_${l.lastName}`.replace(/[^a-zA-Z0-9_-]/g, "_");
                                  await downloadFile(
                                    `${API}/payroll/payslips/${payslipId}/pdf`,
                                    `bulletin_${run?.period ?? ""}_${safeName}.pdf`,
                                  );
                                } catch (e: any) {
                                  toast({ title: "Erreur PDF", description: e.message, variant: "destructive" });
                                } finally { setDownloadingId(null); }
                              }}
                            >
                              {isDownloading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                              PDF
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {payslipId ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1">
                                {/* Bouton envoyer */}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex">
                                        <Button
                                          size="sm"
                                          variant={emailSentAt ? "outline" : "ghost"}
                                          className={`h-7 px-2 text-xs gap-1 ${emailSentAt ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50" : ""}`}
                                          disabled={isEmailing || !hasEmail}
                                          onClick={async () => {
                                            setEmailingId(payslipId);
                                            try {
                                              await fetchJSON(`${API}/payroll/payslips/${payslipId}/send-email`, { method: "POST" });
                                              toast({ title: "Email envoyé", description: `Bulletin transmis à ${l.firstName} ${l.lastName}` });
                                              refetchRunDetail();
                                            } catch (e: any) {
                                              toast({ title: "Erreur envoi email", description: e.message, variant: "destructive" });
                                            } finally { setEmailingId(null); }
                                          }}
                                        >
                                          {isEmailing
                                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                                            : emailSentAt
                                              ? <MailCheck className="w-3 h-3" />
                                              : <Mail className="w-3 h-3" />
                                          }
                                          {emailSentAt ? "Renvoi" : "Envoyer"}
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    {!hasEmail && (
                                      <TooltipContent side="left" className="text-xs">
                                        Aucun email renseigné pour ce collaborateur
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                                {/* Bouton historique (affiché seulement si déjà envoyé) */}
                                {emailSentAt && (
                                  <Popover
                                    open={emailLogsPopover === payslipId}
                                    onOpenChange={(open) => setEmailLogsPopover(open ? payslipId : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary">
                                        <Clock className="w-3 h-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent side="left" align="start" className="w-80 p-0">
                                      <div className="px-3 py-2 border-b bg-muted/40">
                                        <p className="text-xs font-semibold text-foreground">Historique des envois</p>
                                        <p className="text-[10px] text-muted-foreground">{l.firstName} {l.lastName}</p>
                                      </div>
                                      <div className="max-h-56 overflow-y-auto">
                                        {emailLogsFetching ? (
                                          <div className="flex items-center justify-center py-6">
                                            <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                                          </div>
                                        ) : !emailLogsData?.logs?.length ? (
                                          <p className="text-xs text-muted-foreground text-center py-6">Aucun envoi enregistré</p>
                                        ) : (
                                          <ul className="divide-y">
                                            {emailLogsData.logs.map((log) => (
                                              <li key={log.id} className="px-3 py-2 flex items-start gap-2">
                                                <span className="mt-0.5 shrink-0">
                                                  {log.status === "delivered"
                                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                    : <XCircle className="w-3.5 h-3.5 text-red-500" />
                                                  }
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-[11px] font-medium truncate">{log.sentTo}</p>
                                                  <p className="text-[10px] text-muted-foreground">
                                                    {new Date(log.sentAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                    {log.provider && log.provider !== "unknown" && <> · {log.provider}</>}
                                                  </p>
                                                  {log.errorMessage && (
                                                    <p className="text-[10px] text-red-500 mt-0.5 truncate" title={log.errorMessage}>{log.errorMessage}</p>
                                                  )}
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              {emailSentAt && (
                                <span className="text-[10px] text-emerald-600">
                                  ✓ {new Date(emailSentAt).toLocaleDateString("fr-FR")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
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
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dialog Envoi en masse par email ─── */}
      <Dialog
        open={emailBulkDialog.open}
        onOpenChange={open => {
          if (!open && emailBulkDialog.phase !== "sending") {
            if (emailBulkProgressRef.current) { clearInterval(emailBulkProgressRef.current); emailBulkProgressRef.current = null; }
            setEmailBulkDialog({ open: false, phase: "confirm", progress: 0 });
          }
        }}
      >
        <DialogContent className="max-w-sm">
          {emailBulkDialog.phase === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Envoyer les bulletins par email
                </DialogTitle>
              </DialogHeader>
              <div className="py-2 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Les bulletins de paie seront envoyés à tous les collaborateurs ayant une adresse email renseignée.
                </p>
                <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bulletins total</span>
                    <span className="font-semibold">{Object.keys(payslipByCollab).length}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Avec email</span>
                    <span className="font-semibold text-emerald-700">{localItems.filter(l => !!l.email).length}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Sans email (ignorés)</span>
                    <span className="font-semibold text-amber-600">{localItems.filter(l => !l.email).length}</span>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEmailBulkDialog({ open: false, phase: "confirm", progress: 0 })}>
                  Annuler
                </Button>
                <Button
                  onClick={async () => {
                    setSendingEmails(true);
                    const total = Math.max(Object.keys(payslipByCollab).length, 1);
                    setEmailBulkDialog(s => ({ ...s, phase: "sending", progress: 0 }));
                    // Animate progress toward 90% while the request is in-flight
                    let prog = 0;
                    const step = 90 / (total * 1.5);
                    emailBulkProgressRef.current = setInterval(() => {
                      prog = Math.min(prog + step, 88);
                      setEmailBulkDialog(s => ({ ...s, progress: prog }));
                    }, 400);
                    try {
                      const r = await fetchJSON(`${API}/payroll/runs/${runId}/send-emails`, { method: "POST" });
                      if (emailBulkProgressRef.current) { clearInterval(emailBulkProgressRef.current); emailBulkProgressRef.current = null; }
                      setEmailBulkDialog({ open: true, phase: "done", progress: 100, result: r });
                      refetchRunDetail();
                    } catch (e: any) {
                      if (emailBulkProgressRef.current) { clearInterval(emailBulkProgressRef.current); emailBulkProgressRef.current = null; }
                      setEmailBulkDialog({ open: false, phase: "confirm", progress: 0 });
                      toast({ title: "Erreur envoi email", description: e.message, variant: "destructive" });
                    } finally {
                      setSendingEmails(false);
                    }
                  }}
                >
                  <Mail className="w-4 h-4 mr-1.5" />
                  Envoyer à tous
                </Button>
              </DialogFooter>
            </>
          )}

          {emailBulkDialog.phase === "sending" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                  Envoi en cours…
                </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Envoi des bulletins à {localItems.filter(l => !!l.email).length} collaborateur{localItems.filter(l => !!l.email).length > 1 ? "s" : ""}…
                </p>
                <div className="space-y-1.5">
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${emailBulkDialog.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{Math.round(emailBulkDialog.progress)}%</p>
                </div>
                <p className="text-xs text-center text-muted-foreground">Ne fermez pas cette fenêtre.</p>
              </div>
            </>
          )}

          {emailBulkDialog.phase === "done" && emailBulkDialog.result && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {emailBulkDialog.result.failed === 0
                    ? <MailCheck className="w-5 h-5 text-emerald-600" />
                    : <AlertTriangle className="w-5 h-5 text-amber-500" />
                  }
                  Envoi terminé
                </DialogTitle>
              </DialogHeader>
              <div className="py-3 space-y-3">
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full transition-all duration-500" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3">
                    <div className="text-2xl font-bold text-emerald-700">{emailBulkDialog.result.sent}</div>
                    <div className="text-xs text-emerald-600 mt-0.5">Envoyé{emailBulkDialog.result.sent > 1 ? "s" : ""}</div>
                  </div>
                  <div className={`border rounded-lg px-3 py-3 ${emailBulkDialog.result.failed > 0 ? "bg-red-50 border-red-200" : "bg-muted/40 border-border"}`}>
                    <div className={`text-2xl font-bold ${emailBulkDialog.result.failed > 0 ? "text-red-700" : "text-muted-foreground"}`}>{emailBulkDialog.result.failed}</div>
                    <div className={`text-xs mt-0.5 ${emailBulkDialog.result.failed > 0 ? "text-red-600" : "text-muted-foreground"}`}>Échec{emailBulkDialog.result.failed > 1 ? "s" : ""}</div>
                  </div>
                  <div className={`border rounded-lg px-3 py-3 ${emailBulkDialog.result.skipped > 0 ? "bg-amber-50 border-amber-200" : "bg-muted/40 border-border"}`}>
                    <div className={`text-2xl font-bold ${emailBulkDialog.result.skipped > 0 ? "text-amber-700" : "text-muted-foreground"}`}>{emailBulkDialog.result.skipped}</div>
                    <div className={`text-xs mt-0.5 ${emailBulkDialog.result.skipped > 0 ? "text-amber-600" : "text-muted-foreground"}`}>Ignoré{emailBulkDialog.result.skipped > 1 ? "s" : ""}</div>
                  </div>
                </div>
                {emailBulkDialog.result.skipped > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                    {emailBulkDialog.result.skipped} collaborateur{emailBulkDialog.result.skipped > 1 ? "s" : ""} ignoré{emailBulkDialog.result.skipped > 1 ? "s" : ""} — aucune adresse email renseignée.
                  </p>
                )}
                {emailBulkDialog.result.failed > 0 && (
                  <p className="text-xs text-red-700 bg-red-50 rounded px-3 py-2">
                    {emailBulkDialog.result.failed} envoi{emailBulkDialog.result.failed > 1 ? "s" : ""} échoué{emailBulkDialog.result.failed > 1 ? "s" : ""}. Vérifiez l'historique individuel pour le détail.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setEmailBulkDialog({ open: false, phase: "confirm", progress: 0 })}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Action en masse ─── */}
      <Dialog open={bulkDialog.action !== null} onOpenChange={open => { if (!open) setBulkDialog({ action: null }); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkDialog.action === "payment_method" && "Mode de paiement"}
              {bulkDialog.action === "bonus" && "Ajouter une prime"}
              {bulkDialog.action === "commission" && "Ajouter une commission"}
              {bulkDialog.action === "reimbursement" && "Remboursement ponctuel"}
              {bulkDialog.action === "deduction" && "Déduction ponctuelle"}
              {bulkDialog.action === "correction" && "Correction de paie"}
              {bulkDialog.action === "note" && "Ajouter une note"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            S'applique aux <span className="font-semibold text-foreground">{selected.size}</span> collaborateur{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}.
            {bulkDialog.action !== "payment_method" && bulkDialog.action !== "note" && " La valeur sera ajoutée au montant existant."}
          </p>
          <div className="space-y-3 py-1">
            {bulkDialog.action === "payment_method" ? (
              <div>
                <Label className="text-sm mb-1.5 block">Mode de paiement</Label>
                <select
                  className="w-full text-sm px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  value={bulkVal}
                  onChange={e => setBulkVal(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            ) : bulkDialog.action === "note" ? (
              <div>
                <Label className="text-sm mb-1.5 block">Note</Label>
                <Input
                  placeholder="Remarque à appliquer…"
                  value={bulkVal}
                  onChange={e => setBulkVal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applyBulk()}
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <Label className="text-sm mb-1.5 block">Montant (FCFA)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={bulkVal}
                  onChange={e => setBulkVal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applyBulk()}
                  autoFocus
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkDialog({ action: null })}>Annuler</Button>
            <Button
              onClick={applyBulk}
              disabled={!bulkVal || (bulkDialog.action !== "note" && bulkDialog.action !== "payment_method" && isNaN(parseFloat(bulkVal)))}
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
