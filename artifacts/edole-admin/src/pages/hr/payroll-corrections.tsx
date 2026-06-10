import React, { useState } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { Plus, CheckCircle, XCircle, AlertCircle, Wrench, RefreshCw, Clock } from "lucide-react";

const API = "/api";

async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

type Correction = {
  id: string;
  collaboratorId: string;
  firstName: string;
  lastName: string;
  amount: number;
  reason: string;
  description?: string;
  status: string;
  sourceRunId?: string;
  targetRunId?: string;
  sourcePeriod?: string;
  targetPeriod?: string;
  createdAt: string;
  approvedAt?: string;
  appliedAt?: string;
};

const STATUS_LABEL: Record<string, string> = { pending: "En attente", approved: "Approuvée", applied: "Appliquée", rejected: "Rejetée" };
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  applied: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default function PayrollCorrections() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ collaboratorId: "", sourceRunId: "", amount: "", reason: "", description: "" });

  const { data: corrections = [], isLoading, refetch } = useQuery<Correction[]>({
    queryKey: ["payroll-corrections", filter],
    queryFn: () => fetchJSON(`${API}/payroll/corrections${filter !== "all" ? `?status=${filter}` : ""}`),
  });

  const { data: collabs = [] } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ["collabs-list"],
    queryFn: () => fetchJSON(`${API}/hr/collaborators`),
  });

  const { data: runs = [] } = useQuery<{ id: string; period: string; status: string }[]>({
    queryKey: ["payroll-runs-list"],
    queryFn: () => fetchJSON(`${API}/payroll/runs`),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => fetchJSON(`${API}/payroll/corrections`, {
      method: "POST",
      body: JSON.stringify({ ...d, amount: Number(d.amount), sourceRunId: d.sourceRunId || undefined }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-corrections"] });
      qc.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      setCreateOpen(false);
      setForm({ collaboratorId: "", sourceRunId: "", amount: "", reason: "", description: "" });
      toast({ title: "Correction créée", description: "En attente d'approbation" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJSON(`${API}/payroll/corrections/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["payroll-corrections"] });
      qc.invalidateQueries({ queryKey: ["payroll-dashboard"] });
      const label = vars.status === "approved" ? "approuvée" : vars.status === "applied" ? "appliquée" : "rejetée";
      toast({ title: `Correction ${label}` });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const TABS = [
    { key: "all", label: "Toutes", count: corrections.length },
    { key: "pending", label: "En attente", count: corrections.filter(c => c.status === "pending").length },
    { key: "approved", label: "Approuvées", count: corrections.filter(c => c.status === "approved").length },
    { key: "applied", label: "Appliquées", count: corrections.filter(c => c.status === "applied").length },
    { key: "rejected", label: "Rejetées", count: corrections.filter(c => c.status === "rejected").length },
  ];

  const displayed = filter === "all" ? corrections : corrections.filter(c => c.status === filter);

  const pendingCount = corrections.filter(c => c.status === "pending").length;

  return (
    <HrShell
      title="Corrections de paie"
      subtitle="Ajustements et régularisations sur les cycles de paie"
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />Nouvelle correction
        </Button>
      }
    >
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{pendingCount} correction(s) en attente d'approbation</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border mb-4">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${filter === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${filter === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Chargement…</div>
      ) : displayed.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-dashed">
          <Wrench className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Aucune correction {filter !== "all" ? STATUS_LABEL[filter]?.toLowerCase() : ""}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Collaborateur</th>
                <th className="px-4 py-3 text-left">Motif</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-left">Cycle source</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{c.firstName} {c.lastName}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.reason}</div>
                    {c.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.description}</div>}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${c.amount >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {c.amount >= 0 ? "+" : ""}{formatFCFA(c.amount)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.sourcePeriod ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLOR[c.status] ?? ""}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <div>{new Date(c.createdAt).toLocaleDateString("fr-FR")}</div>
                    {c.approvedAt && <div className="text-blue-600">Approuvée {new Date(c.approvedAt).toLocaleDateString("fr-FR")}</div>}
                    {c.appliedAt && <div className="text-emerald-600">Appliquée {new Date(c.appliedAt).toLocaleDateString("fr-FR")}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "pending" && (
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                          onClick={() => updateMut.mutate({ id: c.id, status: "approved" })}
                          disabled={updateMut.isPending}
                          title="Approuver"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => updateMut.mutate({ id: c.id, status: "rejected" })}
                          disabled={updateMut.isPending}
                          title="Rejeter"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {c.status === "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => updateMut.mutate({ id: c.id, status: "applied" })}
                        disabled={updateMut.isPending}
                      >
                        <Clock className="w-4 h-4 mr-1" />Appliquer
                      </Button>
                    )}
                    {(c.status === "applied" || c.status === "rejected") && (
                      <span className="text-xs text-muted-foreground">Finalisée</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle correction de paie</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Collaborateur *</Label>
              <Select value={form.collaboratorId} onValueChange={v => setForm({ ...form, collaboratorId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un collaborateur" /></SelectTrigger>
                <SelectContent>
                  {collabs.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cycle source (optionnel)</Label>
              <Select value={form.sourceRunId} onValueChange={v => setForm({ ...form, sourceRunId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner le cycle corrigé" /></SelectTrigger>
                <SelectContent>
                  {runs.filter(r => r.status === "validated" || r.status === "paid").map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.period}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant (FCFA) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="Ex: 50000 (positif = complément, négatif = retenue)"
              />
            </div>
            <div>
              <Label>Motif *</Label>
              <Input
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                placeholder="Ex: Heures supplémentaires non comptabilisées"
              />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Détails supplémentaires…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMut.mutate(form)}
              disabled={createMut.isPending || !form.collaboratorId || !form.amount || !form.reason}
            >
              {createMut.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Créer la correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
