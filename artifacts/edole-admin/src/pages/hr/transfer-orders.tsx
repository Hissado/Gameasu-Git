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
import { Plus, Banknote, CheckCircle, XCircle, Send } from "lucide-react";

type TransferOrder = {
  id: string; reference: string; status: string; totalAmount: number; currency: string;
  transferLines: Array<{ collaboratorId: string; name: string; iban?: string; amount: number }>;
  notes?: string; createdAt: string; submittedAt?: string; completedAt?: string; bankReference?: string;
};
type PayrollRun = { id: string; period: string; status: string };

const STATUS_LABEL: Record<string, string> = { pending: "En attente", processing: "En traitement", submitted: "Soumis", completed: "Exécuté", failed: "Échec", cancelled: "Annulé" };
const STATUS_COLOR: Record<string, string> = { pending: "bg-amber-100 text-amber-700", processing: "bg-blue-100 text-blue-700", submitted: "bg-indigo-100 text-indigo-700", completed: "bg-emerald-100 text-emerald-700", failed: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-600" };

export default function TransferOrders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({ reference: "", totalAmount: "", notes: "" });

  const { data: orders, isLoading } = useQuery<TransferOrder[]>({
    queryKey: ["transfer-orders"],
    queryFn: () => apiFetch("/api/payroll/transfer-orders"),
  });
  const { data: runs } = useQuery<PayrollRun[]>({
    queryKey: ["payroll-runs"],
    queryFn: () => apiFetch("/api/payroll/runs"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/api/payroll/transfer-orders", {
      method: "POST",
      body: JSON.stringify({ ...d, totalAmount: Number(d.totalAmount || 0) }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transfer-orders"] }); setOpen(false); toast({ title: "Ordre créé" }); },
  });

  const generateMut = useMutation({
    mutationFn: (runId: string) => apiFetch(`/api/payroll/runs/${runId}/generate-transfer`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transfer-orders"] }); toast({ title: "Ordre de virement généré depuis le run" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/payroll/transfer-orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transfer-orders"] }); },
  });

  const detail = (orders ?? []).find(o => o.id === detailId) ?? null;
  const validatedRuns = (runs ?? []).filter(r => r.status === "validated");

  const totals = {
    pending: (orders ?? []).filter(o => o.status === "pending").reduce((s, o) => s + o.totalAmount, 0),
    completed: (orders ?? []).filter(o => o.status === "completed").reduce((s, o) => s + o.totalAmount, 0),
  };

  return (
    <HrShell
      title="Ordres de virement"
      subtitle="Génération et suivi des virements bancaires de salaires"
      actions={
        <div className="flex gap-2">
          {validatedRuns.length > 0 && (
            <Select onValueChange={v => generateMut.mutate(v)}>
              <SelectTrigger className="h-9 text-sm w-52">
                <SelectValue placeholder="Générer depuis run validé…" />
              </SelectTrigger>
              <SelectContent>
                {validatedRuns.map(r => (
                  <SelectItem key={r.id} value={r.id}>Run {r.period}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouvel ordre</Button>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase mb-1">En attente</div><div className="text-xl font-bold">{formatFCFA(totals.pending)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase mb-1">Exécutés</div><div className="text-xl font-bold text-emerald-600">{formatFCFA(totals.completed)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase mb-1">Nombre total</div><div className="text-xl font-bold">{(orders ?? []).length}</div></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : (orders ?? []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Aucun ordre de virement.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Référence</th>
                <th className="px-4 py-3 text-right">Montant total</th>
                <th className="px-4 py-3 text-left">Lignes</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map(o => (
                <tr key={o.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setDetailId(o.id)}>
                  <td className="px-4 py-3 font-mono text-sm font-medium">{o.reference}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatFCFA(o.totalAmount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(o.transferLines ?? []).length} bénéficiaire{(o.transferLines ?? []).length > 1 ? "s" : ""}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[o.status] ?? ""}`}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {o.status === "pending" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Soumettre à la banque" onClick={() => updateMut.mutate({ id: o.id, status: "submitted" })}>
                          <Send className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                      {o.status === "submitted" && (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Marquer exécuté" onClick={() => updateMut.mutate({ id: o.id, status: "completed" })}>
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Marquer échoué" onClick={() => updateMut.mutate({ id: o.id, status: "failed" })}>
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

      {/* Dialog créer ordre manuel */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvel ordre de virement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Référence</Label>
              <Input placeholder="VIR-2026-06-001" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div>
              <Label>Montant total (FCFA)</Label>
              <Input type="number" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={!form.reference || createMut.isPending} onClick={() => createMut.mutate(form)}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog détail ordre */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={() => setDetailId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ordre {detail.reference}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[detail.status] ?? ""}`}>{STATUS_LABEL[detail.status] ?? detail.status}</span>
                <span className="text-sm text-muted-foreground">Total : {formatFCFA(detail.totalAmount)}</span>
              </div>
            </DialogHeader>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">Bénéficiaire</th><th className="px-3 py-2 text-left">IBAN/Compte</th><th className="px-3 py-2 text-right">Montant</th></tr>
                </thead>
                <tbody>
                  {(detail.transferLines ?? []).map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">{l.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.iban || "—"}</td>
                      <td className="px-3 py-2 text-right">{formatFCFA(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/30">
                  <tr><td className="px-3 py-2 font-semibold" colSpan={2}>Total</td><td className="px-3 py-2 text-right font-bold">{formatFCFA(detail.totalAmount)}</td></tr>
                </tfoot>
              </table>
            </div>
            {detail.notes && <div className="text-xs text-muted-foreground mt-2">{detail.notes}</div>}
          </DialogContent>
        </Dialog>
      )}
    </HrShell>
  );
}
