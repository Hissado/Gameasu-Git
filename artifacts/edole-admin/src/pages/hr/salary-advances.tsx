/**
 * Page Avances sur Salaire
 * Route : /rh/avances-salaire
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Plus, Search, Filter, Eye, CheckCircle, XCircle,
  Banknote, Clock, AlertCircle, ChevronDown, ChevronRight,
  FileText, RefreshCw, Send, DollarSign, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Advance {
  id: string;
  collaboratorId: string;
  collaboratorName?: string;
  employeeNumber?: string;
  requestedAmount: number;
  approvedAmount?: number;
  remainingAmount?: number;
  repaidAmount?: number;
  targetPeriod: string;
  repaymentMode: string;
  repaymentMonths?: number;
  reason?: string;
  status: string;
  createdAt: string;
  approvedAt?: string;
  disbursedAt?: string;
}

interface Repayment {
  id: string;
  period: string;
  scheduledAmount: number;
  deductedAmount?: number;
  status: string;
}

interface Policy {
  maxPercentOfSalary: number;
  maxAbsoluteAmount: number;
  maxActiveAdvances: number;
  maxRepaymentMonths: number;
  minTenureMonths: number;
  approvalWorkflow: string;
}

interface Collaborator {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string;
  baseSalary?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; color: string }> = {
  draft:            { label: "Brouillon",       variant: "secondary", color: "text-slate-400" },
  pending_approval: { label: "En attente",      variant: "default",   color: "text-amber-400" },
  approved:         { label: "Approuvée",       variant: "default",   color: "text-emerald-400" },
  rejected:         { label: "Rejetée",         variant: "destructive", color: "text-red-400" },
  disbursed:        { label: "Décaissée",       variant: "default",   color: "text-blue-400" },
  closed:           { label: "Soldée",          variant: "outline",   color: "text-slate-500" },
  cancelled:        { label: "Annulée",         variant: "destructive", color: "text-slate-500" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const, color: "" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const CURRENT_YEAR_MONTH = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// ─── Composant principal ──────────────────────────────────────────────────────
export default function SalaryAdvancesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const isManager = ["super_admin", "admin", "manager", "rh", "financier"].includes(user?.role ?? "");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  // Form state
  const [form, setForm] = useState({
    collaboratorId: "",
    requestedAmount: "",
    targetPeriod: CURRENT_YEAR_MONTH(),
    repaymentMode: "single",
    repaymentMonths: "1",
    reason: "",
  });
  const [approveForm, setApproveForm] = useState({ approvedAmount: "", notes: "" });
  const [rejectForm, setRejectForm] = useState({ rejectionNote: "" });

  // ── Queries ────────────────────────────────────────────────────────────────
  const advancesKey = isManager ? "/api/hr/salary-advances" : "/api/hr/salary-advances/my";
  const { data: advances = [], isLoading } = useQuery<Advance[]>({
    queryKey: [advancesKey, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiFetch(`${advancesKey}?${params}`);
    },
  });

  const { data: policy } = useQuery<Policy>({
    queryKey: ["/api/hr/salary-advance-policy"],
    queryFn: () => apiFetch("/api/hr/salary-advance-policy"),
  });

  const { data: collabs = [] } = useQuery<Collaborator[]>({
    queryKey: ["/api/collaborators"],
    queryFn: () => apiFetch("/api/collaborators").then((r: any) => r.data ?? r),
    enabled: isManager,
  });

  const { data: repayments = [] } = useQuery<Repayment[]>({
    queryKey: ["/api/hr/salary-advances", selectedAdvance?.id, "repayments"],
    queryFn: () => apiFetch(`/api/hr/salary-advances/${selectedAdvance!.id}/repayments`),
    enabled: !!selectedAdvance,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [advancesKey] });
    qc.invalidateQueries({ queryKey: ["/api/hr/salary-advances/my"] });
    qc.invalidateQueries({ queryKey: ["/api/hr/salary-advances"] });
  };

  const createMut = useMutation({
    mutationFn: (data: unknown) => apiFetch("/api/hr/salary-advances", { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Demande créée" });
      setShowCreate(false);
      setForm({ collaboratorId: "", requestedAmount: "", targetPeriod: CURRENT_YEAR_MONTH(), repaymentMode: "single", repaymentMonths: "1", reason: "" });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/salary-advances/${id}/submit`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Demande soumise pour approbation" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      apiFetch(`/api/hr/salary-advances/${id}/approve`, { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Avance approuvée" });
      setShowApprove(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      apiFetch(`/api/hr/salary-advances/${id}/reject`, { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Avance rejetée" });
      setShowReject(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const disburseMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/salary-advances/${id}/disburse`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Avance marquée comme décaissée" }); invalidate(); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── Filtres ────────────────────────────────────────────────────────────────
  const filtered = advances.filter((a) => {
    const q = search.toLowerCase();
    return !q || (a.collaboratorName ?? "").toLowerCase().includes(q) || (a.employeeNumber ?? "").toLowerCase().includes(q);
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpi = {
    pending:  advances.filter((a) => a.status === "pending_approval").length,
    disbursed: advances.filter((a) => a.status === "disbursed").length,
    totalDisbursed: advances.filter((a) => ["disbursed", "closed"].includes(a.status))
      .reduce((s, a) => s + (a.approvedAmount ?? a.requestedAmount), 0),
    totalRemaining: advances.filter((a) => a.status === "disbursed")
      .reduce((s, a) => s + (a.remainingAmount ?? 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Avances sur salaire</h1>
          <p className="text-sm text-white/50 mt-0.5">Gérez les demandes, approbations et remboursements</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Button variant="outline" size="sm" onClick={() => setShowPolicy(true)}>
              <FileText className="w-4 h-4 mr-1.5" /> Politique
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Nouvelle demande
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-white/[0.03] border-white/[0.07]">
          <CardContent className="p-4">
            <p className="text-xs text-white/50">En attente</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{kpi.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.07]">
          <CardContent className="p-4">
            <p className="text-xs text-white/50">Décaissées actives</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{kpi.disbursed}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.07]">
          <CardContent className="p-4">
            <p className="text-xs text-white/50">Total décaissé</p>
            <p className="text-xl font-bold text-white mt-1">{formatFCFA(kpi.totalDisbursed)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.07]">
          <CardContent className="p-4">
            <p className="text-xs text-white/50">Encours remboursement</p>
            <p className="text-xl font-bold text-orange-400 mt-1">{formatFCFA(kpi.totalRemaining)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Rechercher un collaborateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.04] border-white/[0.08] text-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-white/[0.04] border-white/[0.08] text-white">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tableau */}
      <div className="rounded-lg border border-white/[0.07] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] border-b border-white/[0.07]">
            <tr>
              {isManager && <th className="text-left px-4 py-3 text-white/50 font-medium">Collaborateur</th>}
              <th className="text-left px-4 py-3 text-white/50 font-medium">Période</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Montant demandé</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Montant approuvé</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Remboursement</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Statut</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-white/30">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-white/30">Aucune avance trouvée</td></tr>
            ) : filtered.map((adv) => (
              <tr key={adv.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                {isManager && (
                  <td className="px-4 py-3 text-white/80">
                    <div className="font-medium">{adv.collaboratorName || "—"}</div>
                    {adv.employeeNumber && <div className="text-xs text-white/40">{adv.employeeNumber}</div>}
                  </td>
                )}
                <td className="px-4 py-3 text-white/60">{adv.targetPeriod}</td>
                <td className="px-4 py-3 text-white font-medium">{formatFCFA(adv.requestedAmount)}</td>
                <td className="px-4 py-3 text-white/70">{adv.approvedAmount ? formatFCFA(adv.approvedAmount) : "—"}</td>
                <td className="px-4 py-3 text-white/60">
                  {adv.repaymentMode === "single" ? "Prélèvement unique" : `${adv.repaymentMonths} mois`}
                </td>
                <td className="px-4 py-3"><StatusBadge status={adv.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white"
                      onClick={() => { setSelectedAdvance(adv); setShowDetail(true); }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {adv.status === "draft" && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-amber-400/70 hover:text-amber-400"
                        onClick={() => submitMut.mutate(adv.id)}
                        title="Soumettre"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isManager && adv.status === "pending_approval" && (
                      <>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-emerald-400/70 hover:text-emerald-400"
                          onClick={() => { setSelectedAdvance(adv); setApproveForm({ approvedAmount: String(adv.requestedAmount), notes: "" }); setShowApprove(true); }}
                          title="Approuver"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-red-400/70 hover:text-red-400"
                          onClick={() => { setSelectedAdvance(adv); setRejectForm({ rejectionNote: "" }); setShowReject(true); }}
                          title="Rejeter"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    {isManager && adv.status === "approved" && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-blue-400/70 hover:text-blue-400"
                        onClick={() => disburseMut.mutate(adv.id)}
                        title="Marquer décaissé"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Dialogue : Créer ─────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle demande d'avance sur salaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isManager && (
              <div className="space-y-1.5">
                <Label>Collaborateur</Label>
                <Select value={form.collaboratorId} onValueChange={(v) => setForm((f) => ({ ...f, collaboratorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {collabs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Montant demandé (FCFA)</Label>
                <Input
                  type="number" min={0}
                  value={form.requestedAmount}
                  onChange={(e) => setForm((f) => ({ ...f, requestedAmount: e.target.value }))}
                  placeholder="ex : 150 000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Période cible</Label>
                <Input
                  value={form.targetPeriod}
                  onChange={(e) => setForm((f) => ({ ...f, targetPeriod: e.target.value }))}
                  placeholder="YYYY-MM"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mode de remboursement</Label>
                <Select value={form.repaymentMode} onValueChange={(v) => setForm((f) => ({ ...f, repaymentMode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Prélèvement unique</SelectItem>
                    <SelectItem value="multi">Mensualités multiples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.repaymentMode === "multi" && (
                <div className="space-y-1.5">
                  <Label>Nombre de mensualités</Label>
                  <Input
                    type="number" min={2} max={policy?.maxRepaymentMonths ?? 6}
                    value={form.repaymentMonths}
                    onChange={(e) => setForm((f) => ({ ...f, repaymentMonths: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Raison de la demande…"
                rows={3}
              />
            </div>
            {policy && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/70 space-y-1">
                <p className="font-medium text-amber-200/90">Politique en vigueur</p>
                <p>Plafond : {policy.maxPercentOfSalary}% du salaire mensuel{policy.maxAbsoluteAmount > 0 ? ` ou ${formatFCFA(policy.maxAbsoluteAmount)} max` : ""}</p>
                <p>Remboursement max : {policy.maxRepaymentMonths} mois · Ancienneté min : {policy.minTenureMonths} mois</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button
              disabled={createMut.isPending || !form.requestedAmount || (!isManager && !form.targetPeriod)}
              onClick={() => createMut.mutate({
                collaboratorId: isManager ? form.collaboratorId : undefined,
                requestedAmount: Number(form.requestedAmount),
                targetPeriod: form.targetPeriod,
                repaymentMode: form.repaymentMode,
                repaymentMonths: form.repaymentMode === "multi" ? Number(form.repaymentMonths) : 1,
                reason: form.reason || undefined,
              })}
            >
              {createMut.isPending ? "Enregistrement…" : "Créer la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Détail ────────────────────────────────────────────── */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détail de l'avance</DialogTitle>
          </DialogHeader>
          {selectedAdvance && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-white/50">Collaborateur</span><p className="font-medium text-white mt-0.5">{selectedAdvance.collaboratorName || "—"}</p></div>
                <div><span className="text-white/50">Statut</span><div className="mt-0.5"><StatusBadge status={selectedAdvance.status} /></div></div>
                <div><span className="text-white/50">Montant demandé</span><p className="font-medium text-white mt-0.5">{formatFCFA(selectedAdvance.requestedAmount)}</p></div>
                <div><span className="text-white/50">Montant approuvé</span><p className="font-medium text-white mt-0.5">{selectedAdvance.approvedAmount ? formatFCFA(selectedAdvance.approvedAmount) : "—"}</p></div>
                <div><span className="text-white/50">Reste à rembourser</span><p className="font-medium text-orange-400 mt-0.5">{formatFCFA(selectedAdvance.remainingAmount ?? 0)}</p></div>
                <div><span className="text-white/50">Période cible</span><p className="font-medium text-white mt-0.5">{selectedAdvance.targetPeriod}</p></div>
                {selectedAdvance.reason && (
                  <div className="col-span-2"><span className="text-white/50">Motif</span><p className="text-white/80 mt-0.5">{selectedAdvance.reason}</p></div>
                )}
              </div>
              <Separator className="border-white/[0.07]" />
              <div>
                <p className="text-sm font-medium text-white mb-2">Échéancier de remboursement</p>
                {repayments.length === 0 ? (
                  <p className="text-sm text-white/30">Aucun échéancier généré (avance non encore approuvée).</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 border-b border-white/[0.07]">
                        <th className="text-left py-1.5">Période</th>
                        <th className="text-right py-1.5">Prévu</th>
                        <th className="text-right py-1.5">Prélevé</th>
                        <th className="text-left py-1.5 pl-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repayments.map((r) => (
                        <tr key={r.id} className="border-b border-white/[0.04]">
                          <td className="py-1.5 text-white/70">{r.period}</td>
                          <td className="py-1.5 text-right text-white">{formatFCFA(r.scheduledAmount)}</td>
                          <td className="py-1.5 text-right text-white/60">{r.deductedAmount ? formatFCFA(r.deductedAmount) : "—"}</td>
                          <td className="py-1.5 pl-3">
                            <Badge variant={r.status === "deducted" ? "default" : "secondary"} className="text-xs">
                              {r.status === "pending" ? "À venir" : r.status === "deducted" ? "Prélevé" : r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Approuver ─────────────────────────────────────────── */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approuver l'avance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Montant approuvé (FCFA)</Label>
              <Input
                type="number"
                value={approveForm.approvedAmount}
                onChange={(e) => setApproveForm((f) => ({ ...f, approvedAmount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (facultatif)</Label>
              <Textarea
                value={approveForm.notes}
                onChange={(e) => setApproveForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprove(false)}>Annuler</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={approveMut.isPending}
              onClick={() => selectedAdvance && approveMut.mutate({
                id: selectedAdvance.id,
                data: { approvedAmount: Number(approveForm.approvedAmount), notes: approveForm.notes || undefined },
              })}
            >
              {approveMut.isPending ? "…" : "Approuver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Rejeter ───────────────────────────────────────────── */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rejeter la demande</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Motif de refus</Label>
              <Textarea
                value={rejectForm.rejectionNote}
                onChange={(e) => setRejectForm({ rejectionNote: e.target.value })}
                rows={3}
                placeholder="Expliquez la raison du refus…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={rejectMut.isPending}
              onClick={() => selectedAdvance && rejectMut.mutate({
                id: selectedAdvance.id,
                data: { rejectionNote: rejectForm.rejectionNote || undefined },
              })}
            >
              {rejectMut.isPending ? "…" : "Confirmer le rejet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Politique ─────────────────────────────────────────── */}
      <Dialog open={showPolicy} onOpenChange={setShowPolicy}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Politique des avances</DialogTitle>
          </DialogHeader>
          {policy && (
            <div className="space-y-2 py-2 text-sm">
              <div className="flex justify-between"><span className="text-white/50">Plafond (% salaire)</span><span className="font-medium text-white">{policy.maxPercentOfSalary}%</span></div>
              <div className="flex justify-between"><span className="text-white/50">Plafond absolu</span><span className="font-medium text-white">{policy.maxAbsoluteAmount > 0 ? formatFCFA(policy.maxAbsoluteAmount) : "Aucun"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Avances actives max</span><span className="font-medium text-white">{policy.maxActiveAdvances}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Mensualités max</span><span className="font-medium text-white">{policy.maxRepaymentMonths}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Ancienneté min</span><span className="font-medium text-white">{policy.minTenureMonths} mois</span></div>
              <div className="flex justify-between"><span className="text-white/50">Workflow d'approbation</span><span className="font-medium text-white">{policy.approvalWorkflow}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicy(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
