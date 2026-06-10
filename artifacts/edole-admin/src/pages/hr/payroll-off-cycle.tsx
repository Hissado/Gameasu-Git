import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { Plus, CheckCircle, CreditCard, Trash2, Zap } from "lucide-react";

type Collab = { id: string; firstName: string; lastName: string; poste?: string };
type OffCycle = {
  id: string; type: string; label: string; amount: number; netAmount: number; irpp: number; cnssEmployee: number;
  currency: string; period: string; status: string; reason?: string; collaboratorId: string;
  firstName?: string; lastName?: string; poste?: string; createdAt: string; approvedAt?: string; paidAt?: string;
};

const TYPE_LABELS: Record<string, string> = { prime: "Prime", acompte: "Acompte", regularisation: "Régularisation", indemnite: "Indemnité", autre: "Autre" };
const STATUS_COLOR: Record<string, string> = { draft: "bg-gray-100 text-gray-700", approved: "bg-blue-100 text-blue-700", paid: "bg-emerald-100 text-emerald-700", cancelled: "bg-red-100 text-red-700" };
const STATUS_LABEL: Record<string, string> = { draft: "Brouillon", approved: "Approuvé", paid: "Payé", cancelled: "Annulé" };

const now = new Date();
const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

export default function PayrollOffCycle() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(currentPeriod);
  const [form, setForm] = useState({ collaboratorId: "", type: "prime", label: "", amount: "", reason: "", notes: "", period: currentPeriod });

  const { data, isLoading } = useQuery<{ items: OffCycle[]; totals: Record<string, number> }>({
    queryKey: ["off-cycle", period],
    queryFn: () => apiFetch(`/api/payroll/off-cycle?period=${period}`),
  });
  const { data: collabs } = useQuery<Collab[]>({
    queryKey: ["collabs-list"],
    queryFn: () => apiFetch("/api/hr/collaborators"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/api/payroll/off-cycle", { method: "POST", body: JSON.stringify({ ...d, amount: Number(d.amount) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["off-cycle"] }); setOpen(false); toast({ title: "Paiement hors-cycle créé" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/payroll/off-cycle/${id}/approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["off-cycle"] }); toast({ title: "Approuvé" }); },
  });
  const payMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/payroll/off-cycle/${id}/pay`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["off-cycle"] }); toast({ title: "Marqué comme payé" }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/payroll/off-cycle/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["off-cycle"] }); },
  });

  const totals = data?.totals ?? {};
  const items = data?.items ?? [];

  return (
    <HrShell
      title="Paie hors-cycle"
      subtitle="Primes, acomptes, indemnités et régularisations ponctuelles"
      actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouveau paiement</Button>}
    >
      {/* KPI totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {["prime", "acompte", "regularisation", "indemnite"].map(t => (
          <Card key={t}>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground mb-1">{TYPE_LABELS[t]}</div>
              <div className="text-xl font-bold">{formatFCFA(totals[t] ?? 0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtre période */}
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-sm">Période</Label>
        <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="w-40" />
        <span className="text-sm text-muted-foreground ml-auto">Total brut : <strong>{formatFCFA(totals._total ?? 0)}</strong></span>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Aucun paiement hors-cycle pour cette période.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Collaborateur</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Libellé</th>
                <th className="px-4 py-3 text-right">Brut</th>
                <th className="px-4 py-3 text-right">Net estimé</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{item.firstName} {item.lastName}<div className="text-xs text-muted-foreground">{item.poste}</div></td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{TYPE_LABELS[item.type] ?? item.type}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{item.label}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatFCFA(item.amount)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatFCFA(item.netAmount)}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[item.status] ?? ""}`}>{STATUS_LABEL[item.status] ?? item.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {item.status === "draft" && (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Approuver" onClick={() => approveMut.mutate(item.id)}><CheckCircle className="w-4 h-4 text-blue-600" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Supprimer" onClick={() => deleteMut.mutate(item.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </>
                      )}
                      {item.status === "approved" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Marquer payé" onClick={() => payMut.mutate(item.id)}><CreditCard className="w-4 h-4 text-emerald-600" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau paiement hors-cycle</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Collaborateur</Label>
              <Select value={form.collaboratorId} onValueChange={v => setForm(f => ({ ...f, collaboratorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>{(collabs ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Période</Label>
                <Input type="month" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Libellé</Label>
              <Input placeholder="Prime de performance Q2…" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <Label>Montant brut (FCFA)</Label>
              <Input type="number" placeholder="150000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Motif (optionnel)</Label>
              <Textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={!form.collaboratorId || !form.label || !form.amount || createMut.isPending} onClick={() => createMut.mutate(form)}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
