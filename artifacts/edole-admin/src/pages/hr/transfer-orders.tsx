import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import {
  Plus, Banknote, CheckCircle, XCircle, Send, FileSpreadsheet,
  FileText, History, User, ChevronLeft, ChevronRight, Download, Filter,
} from "lucide-react";

type TransferLine = {
  collaboratorId: string;
  name: string;
  iban?: string;
  bankName?: string;
  bankCode?: string;
  amount: number;
};

type TransferOrder = {
  id: string;
  reference: string;
  status: string;
  totalAmount: number;
  currency: string;
  payrollRunId?: string;
  transferLines: TransferLine[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  bankReference?: string;
  updatedById?: string;
  updatedByName?: string | null;
};

type PayrollRun = { id: string; period: string; status: string };

type AuditEntry = {
  id: string;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
};

type GlobalAuditEntry = AuditEntry & {
  bankTransferOrderId: string;
  authorName: string;
  reference: string | null;
  totalAmount: number;
};

type GlobalAuditPage = {
  items: GlobalAuditEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type AuditAuthor = { userId: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  processing: "En traitement",
  submitted: "Soumis",
  completed: "Exécuté",
  failed: "Échec",
  cancelled: "Annulé",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  submitted: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

function downloadFile(url: string) {
  const token = localStorage.getItem("auth_token");
  const sep = url.includes("?") ? "&" : "?";
  const authenticatedUrl = token ? `${url}${sep}token=${encodeURIComponent(token)}` : url;
  const a = document.createElement("a");
  a.href = authenticatedUrl;
  a.click();
}

function buildExportUrl(base: string, filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function AuditLogPanel({ orderId }: { orderId: string }) {
  const { data: entries, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["transfer-audit", orderId],
    queryFn: () => apiFetch(`/api/payroll/transfer-orders/${orderId}/audit-log`),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-4">Chargement…</div>;
  if (!entries || entries.length === 0)
    return <div className="text-sm text-muted-foreground py-4 italic">Aucune action enregistrée.</div>;

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const actor = e.firstName ? `${e.firstName} ${e.lastName}` : "Système";
        return (
          <div key={e.id} className="flex gap-3 items-start text-sm">
            <div className="mt-0.5 w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <User className="w-3 h-3 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{actor}</span>
                {e.oldStatus && e.newStatus && (
                  <span className="text-xs text-muted-foreground">
                    a fait passer le statut de{" "}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[e.oldStatus] ?? ""}`}>
                      {STATUS_LABEL[e.oldStatus] ?? e.oldStatus}
                    </span>{" "}
                    à{" "}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[e.newStatus] ?? ""}`}>
                      {STATUS_LABEL[e.newStatus] ?? e.newStatus}
                    </span>
                  </span>
                )}
              </div>
              {e.metadata && Boolean((e.metadata as Record<string, unknown>).bankReference) && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Réf. banque : <span className="font-mono">{String((e.metadata as Record<string, unknown>).bankReference)}</span>
                </div>
              )}
              {e.metadata && Boolean((e.metadata as Record<string, unknown>).errorMessage) && (
                <div className="text-xs text-red-600 mt-0.5">
                  {String((e.metadata as Record<string, unknown>).errorMessage)}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(e.createdAt).toLocaleString("fr-FR")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GlobalAuditLog() {
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", status: "", userId: "" });
  const [applied, setApplied] = useState({ dateFrom: "", dateTo: "", status: "", userId: "" });
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const { data: authors } = useQuery<AuditAuthor[]>({
    queryKey: ["transfer-audit-authors"],
    queryFn: () => apiFetch("/api/payroll/transfer-audit-log/authors"),
  });

  const queryParams = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (applied.dateFrom) queryParams.set("dateFrom", applied.dateFrom);
  if (applied.dateTo) queryParams.set("dateTo", applied.dateTo);
  if (applied.status) queryParams.set("status", applied.status);
  if (applied.userId) queryParams.set("userId", applied.userId);

  const { data, isLoading } = useQuery<GlobalAuditPage>({
    queryKey: ["transfer-audit-global", applied, page],
    queryFn: () => apiFetch(`/api/payroll/transfer-audit-log?${queryParams.toString()}`),
  });

  function applyFilters() {
    setPage(1);
    setApplied({ ...filters });
  }

  function resetFilters() {
    const empty = { dateFrom: "", dateTo: "", status: "", userId: "" };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  }

  const exportFilters: Record<string, string> = {};
  if (applied.dateFrom) exportFilters.dateFrom = applied.dateFrom;
  if (applied.dateTo) exportFilters.dateTo = applied.dateTo;
  if (applied.status) exportFilters.status = applied.status;
  if (applied.userId) exportFilters.userId = applied.userId;

  const hasFilters = Object.values(applied).some(Boolean);

  return (
    <div className="space-y-4">
      {/* Barre de filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Du</Label>
              <Input
                type="date"
                className="h-8 text-sm w-40"
                value={filters.dateFrom}
                onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Au</Label>
              <Input
                type="date"
                className="h-8 text-sm w-40"
                value={filters.dateTo}
                onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Statut</Label>
              <Select value={filters.status || "_all"} onValueChange={(v) => setFilters(f => ({ ...f, status: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm w-44">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Tous les statuts</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Auteur</Label>
              <Select value={filters.userId || "_all"} onValueChange={(v) => setFilters(f => ({ ...f, userId: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm w-48">
                  <SelectValue placeholder="Tous les auteurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Tous les auteurs</SelectItem>
                  {(authors ?? []).map((a) => (
                    <SelectItem key={a.userId} value={a.userId}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto items-end">
              {hasFilters && (
                <Button size="sm" variant="ghost" onClick={resetFilters} className="h-8 text-xs">
                  Réinitialiser
                </Button>
              )}
              <Button size="sm" onClick={applyFilters} className="h-8 gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Filtrer
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => downloadFile(buildExportUrl("/api/payroll/transfer-audit-log/export.csv", exportFilters))}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => downloadFile(buildExportUrl("/api/payroll/transfer-audit-log/export.xlsx", exportFilters))}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résumé et pagination */}
      {data && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            {data.total === 0 ? "Aucun événement" : `${data.total} événement${data.total > 1 ? "s" : ""}${hasFilters ? " (filtré)" : ""}`}
          </span>
          {data.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span>Page {data.page} / {data.totalPages}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={page >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tableau */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun événement trouvé{hasFilters ? " pour ces filtres" : ""}.</p>
          {hasFilters && (
            <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Auteur</th>
                <th className="px-4 py-3 text-left">Référence ordre</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-left">Transition de statut</th>
                <th className="px-4 py-3 text-left">Détails</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => {
                const meta = (e.metadata ?? {}) as Record<string, unknown>;
                return (
                  <tr key={e.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium">{e.authorName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {e.reference ?? <span className="italic text-muted-foreground/60 font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {e.totalAmount ? formatFCFA(e.totalAmount) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {e.oldStatus && e.newStatus ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[e.oldStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABEL[e.oldStatus] ?? e.oldStatus}
                          </span>
                          <span className="text-muted-foreground text-xs">→</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[e.newStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABEL[e.newStatus] ?? e.newStatus}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{e.action}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px]">
                      {Boolean(meta.bankReference) && (
                        <div className="text-muted-foreground">
                          Réf. banque : <span className="font-mono">{String(meta.bankReference)}</span>
                        </div>
                      )}
                      {Boolean(meta.errorMessage) && (
                        <div className="text-red-600 truncate" title={String(meta.errorMessage)}>
                          {String(meta.errorMessage)}
                        </div>
                      )}
                      {!meta.bankReference && !meta.errorMessage && (
                        <span className="text-muted-foreground/50 italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination bas */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="h-8 gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">Page {data.page} / {data.totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= data.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="h-8 gap-1"
          >
            Suivant
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

type StatusDialog = {
  orderId: string;
  status: "submitted" | "completed" | "failed";
  bankReference: string;
  errorMessage: string;
} | null;

function StatusChangeDialog({
  dialog,
  onClose,
  onConfirm,
  isPending,
}: {
  dialog: NonNullable<StatusDialog>;
  onClose: () => void;
  onConfirm: (bankReference: string, errorMessage: string) => void;
  isPending: boolean;
}) {
  const [bankReference, setBankReference] = useState(dialog.bankReference);
  const [errorMessage, setErrorMessage] = useState(dialog.errorMessage);

  const isFailed = dialog.status === "failed";
  const title =
    dialog.status === "submitted"
      ? "Soumettre à la banque"
      : dialog.status === "completed"
      ? "Marquer comme exécuté"
      : "Marquer comme échoué";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isFailed && (
            <div>
              <Label className="mb-1.5 block">
                Référence banque{" "}
                <span className="text-muted-foreground font-normal text-xs">(optionnel)</span>
              </Label>
              <Input
                placeholder="ex. BCEAO-2026-00123"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Référence retournée par la banque pour cet ordre de virement.
              </p>
            </div>
          )}
          {isFailed && (
            <div>
              <Label className="mb-1.5 block">
                Motif d'échec{" "}
                <span className="text-muted-foreground font-normal text-xs">(optionnel)</span>
              </Label>
              <Textarea
                rows={3}
                placeholder="ex. Compte bénéficiaire inexistant, fonds insuffisants…"
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            variant={isFailed ? "destructive" : "default"}
            disabled={isPending}
            onClick={() => onConfirm(bankReference, errorMessage)}
          >
            {isPending ? "En cours…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TransferOrders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"orders" | "audit">("orders");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [form, setForm] = useState({ reference: "", totalAmount: "", notes: "" });
  const [statusDialog, setStatusDialog] = useState<StatusDialog>(null);

  const { data: orders, isLoading } = useQuery<TransferOrder[]>({
    queryKey: ["transfer-orders"],
    queryFn: () => apiFetch("/api/payroll/transfer-orders"),
  });

  const { data: runs } = useQuery<PayrollRun[]>({
    queryKey: ["payroll-runs"],
    queryFn: () => apiFetch("/api/payroll/runs"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) =>
      apiFetch("/api/payroll/transfer-orders", {
        method: "POST",
        body: JSON.stringify({ ...d, totalAmount: Number(d.totalAmount || 0) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-orders"] });
      setOpen(false);
      toast({ title: "Ordre créé" });
    },
  });

  const generateMut = useMutation({
    mutationFn: (runId: string) =>
      apiFetch(`/api/payroll/runs/${runId}/bank-transfer-order`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-orders"] });
      toast({ title: "Ordre de virement BCEAO/UEMOA généré depuis le cycle de paie" });
    },
    onError: (err: Error) =>
      toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, bankReference, errorMessage }: { id: string; status: string; bankReference?: string; errorMessage?: string }) =>
      apiFetch(`/api/payroll/transfer-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(bankReference ? { bankReference } : {}),
          ...(errorMessage ? { errorMessage } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-orders"] });
      if (detailId) qc.invalidateQueries({ queryKey: ["transfer-audit", detailId] });
      qc.invalidateQueries({ queryKey: ["transfer-audit-global"] });
      setStatusDialog(null);
      toast({ title: "Statut mis à jour" });
    },
    onError: (err: Error) =>
      toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  function openStatusDialog(orderId: string, status: "submitted" | "completed" | "failed") {
    setStatusDialog({ orderId, status, bankReference: "", errorMessage: "" });
  }

  function confirmStatusChange(bankReference: string, errorMessage: string) {
    if (!statusDialog) return;
    updateMut.mutate({ id: statusDialog.orderId, status: statusDialog.status, bankReference, errorMessage });
  }

  const detail = (orders ?? []).find((o) => o.id === detailId) ?? null;
  const validatedRuns = (runs ?? []).filter((r) => r.status === "validated");
  const runPeriodMap = Object.fromEntries((runs ?? []).map((r) => [r.id, r.period]));

  const totals = {
    pending: (orders ?? []).filter((o) => o.status === "pending").reduce((s, o) => s + o.totalAmount, 0),
    completed: (orders ?? []).filter((o) => o.status === "completed").reduce((s, o) => s + o.totalAmount, 0),
  };

  return (
    <HrShell
      title="Ordres de virement"
      subtitle="Génération et suivi des virements bancaires de salaires — format BCEAO/UEMOA"
      actions={
        activeTab === "orders" ? (
          <div className="flex gap-2">
            {validatedRuns.length > 0 && (
              <Select onValueChange={(v) => generateMut.mutate(v)} disabled={generateMut.isPending}>
                <SelectTrigger className="h-9 text-sm w-56">
                  <SelectValue placeholder="Générer depuis cycle validé…" />
                </SelectTrigger>
                <SelectContent>
                  {validatedRuns.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      Cycle {r.period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Nouvel ordre
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Utilisez les boutons CSV/Excel pour exporter</span>
          </div>
        )
      }
    >
      {/* Onglets principaux */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === "orders"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("orders")}
        >
          <Banknote className="w-4 h-4" />
          Ordres de virement
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === "audit"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("audit")}
        >
          <History className="w-4 h-4" />
          Journal d'audit global
        </button>
      </div>

      {activeTab === "audit" ? (
        <GlobalAuditLog />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase mb-1">En attente</div>
                <div className="text-xl font-bold">{formatFCFA(totals.pending)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase mb-1">Exécutés</div>
                <div className="text-xl font-bold text-emerald-600">{formatFCFA(totals.completed)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase mb-1">Nombre total</div>
                <div className="text-xl font-bold">{(orders ?? []).length}</div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : (orders ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Aucun ordre de virement.</p>
              {validatedRuns.length > 0 && (
                <p className="text-sm mt-2">
                  Utilisez le sélecteur ci-dessus pour générer un ordre depuis un cycle validé.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Référence</th>
                    <th className="px-4 py-3 text-left">Cycle de paie</th>
                    <th className="px-4 py-3 text-right">Montant total</th>
                    <th className="px-4 py-3 text-left">Lignes</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left">Créé le</th>
                    <th className="px-4 py-3 text-left">Dernière modification</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders ?? []).map((o) => (
                    <tr
                      key={o.id}
                      className="border-t hover:bg-muted/30 cursor-pointer"
                      onClick={() => { setDetailId(o.id); setShowAudit(false); }}
                    >
                      <td className="px-4 py-3 font-mono text-sm font-medium">{o.reference}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {o.payrollRunId && runPeriodMap[o.payrollRunId] ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200 font-medium">
                            {runPeriodMap[o.payrollRunId]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatFCFA(o.totalAmount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(o.transferLines ?? []).length} bénéficiaire
                        {(o.transferLines ?? []).length > 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[o.status] ?? ""}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {o.updatedAt && o.updatedById ? (
                          <div>
                            <div className="font-medium text-foreground/80">{o.updatedByName ?? "—"}</div>
                            <div className="text-muted-foreground">
                              {new Date(o.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                            </div>
                          </div>
                        ) : (
                          <span className="italic opacity-50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Exporter CSV (ECOBANK/UTB/BIA)"
                            onClick={() => downloadFile(`/api/payroll/transfer-orders/${o.id}/export.csv`)}
                          >
                            <FileText className="w-4 h-4 text-emerald-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Exporter Excel (BCEAO/UEMOA)"
                            onClick={() => downloadFile(`/api/payroll/transfer-orders/${o.id}/export.xlsx`)}
                          >
                            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                          </Button>
                          {o.status === "pending" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Soumettre à la banque"
                              onClick={() => openStatusDialog(o.id, "submitted")}
                            >
                              <Send className="w-4 h-4 text-blue-600" />
                            </Button>
                          )}
                          {o.status === "submitted" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Marquer exécuté"
                                onClick={() => openStatusDialog(o.id, "completed")}
                              >
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Marquer échoué"
                                onClick={() => openStatusDialog(o.id, "failed")}
                              >
                                <XCircle className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Dialog créer ordre manuel */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel ordre de virement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Référence</Label>
              <Input
                placeholder="VIR-2026-06-001"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>
            <div>
              <Label>Montant total (FCFA)</Label>
              <Input
                type="number"
                value={form.totalAmount}
                onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!form.reference || createMut.isPending}
              onClick={() => createMut.mutate(form)}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation changement de statut */}
      {statusDialog && (
        <StatusChangeDialog
          dialog={statusDialog}
          onClose={() => setStatusDialog(null)}
          onConfirm={confirmStatusChange}
          isPending={updateMut.isPending}
        />
      )}

      {/* Dialog détail ordre */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={() => setDetailId(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ordre {detail.reference}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[detail.status] ?? ""}`}>
                  {STATUS_LABEL[detail.status] ?? detail.status}
                </span>
                <span className="text-sm text-muted-foreground">
                  Total : {formatFCFA(detail.totalAmount)}
                </span>
                {detail.payrollRunId && runPeriodMap[detail.payrollRunId] && (
                  <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200">
                    Cycle {runPeriodMap[detail.payrollRunId]}
                  </span>
                )}
                {detail.updatedAt && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Modifié le {new Date(detail.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
              </div>
            </DialogHeader>

            {/* Onglets Détail / Journal */}
            <div className="flex gap-1 mb-4 border-b">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${!showAudit ? "border-orange-500 text-orange-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                onClick={() => setShowAudit(false)}
              >
                Bénéficiaires
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${showAudit ? "border-orange-500 text-orange-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                onClick={() => setShowAudit(true)}
              >
                <History className="w-3.5 h-3.5" />
                Journal d'audit
              </button>
            </div>

            {!showAudit ? (
              <>
                <div className="flex gap-2 mb-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFile(`/api/payroll/transfer-orders/${detail.id}/export.csv`)}
                  >
                    <FileText className="w-4 h-4 mr-2 text-emerald-600" />
                    Exporter CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFile(`/api/payroll/transfer-orders/${detail.id}/export.xlsx`)}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-blue-600" />
                    Exporter Excel
                  </Button>
                  <div className="flex-1" />
                  <Badge variant="outline" className="text-xs">
                    {(detail.transferLines ?? []).length} bénéficiaire
                    {(detail.transferLines ?? []).length > 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Bénéficiaire</th>
                        <th className="px-3 py-2 text-left">IBAN / N° compte</th>
                        <th className="px-3 py-2 text-left">Banque</th>
                        <th className="px-3 py-2 text-right">Montant net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.transferLines ?? []).map((l, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-medium">{l.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {l.iban || <span className="italic text-muted-foreground/60">Non renseigné</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {l.bankName || "—"}
                            {l.bankCode ? ` (${l.bankCode})` : ""}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {formatFCFA(l.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/30">
                      <tr>
                        <td className="px-3 py-2 font-semibold" colSpan={3}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold">
                          {formatFCFA(detail.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {detail.notes && (
                  <div className="text-xs text-muted-foreground mt-3 p-3 bg-muted/30 rounded-md">
                    {detail.notes}
                  </div>
                )}
                {detail.bankReference && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Réf. banque : <span className="font-mono">{detail.bankReference}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="py-2">
                <p className="text-xs text-muted-foreground mb-4">
                  Toutes les modifications de statut sont enregistrées ici avec l'auteur et l'horodatage.
                </p>
                <AuditLogPanel orderId={detail.id} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </HrShell>
  );
}
