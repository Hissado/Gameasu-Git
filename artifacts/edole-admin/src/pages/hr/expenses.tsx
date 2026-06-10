import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { Plus, Receipt, CheckCircle, XCircle, CreditCard, PlusCircle, Trash2, ChevronRight } from "lucide-react";

type Report = { id: string; title: string; description?: string; status: string; totalAmount: number; currency: string; collaboratorId: string; firstName?: string; lastName?: string; poste?: string; submittedAt?: string; approvedAt?: string; paidAt?: string; rejectionReason?: string; createdAt: string };
type Item = { id: string; category: string; description: string; amount: number; expenseDate: string; receiptUrl?: string; notes?: string };
type ReportDetail = Report & { items: Item[] };

const STATUS_LABEL: Record<string, string> = { draft: "Brouillon", submitted: "Soumis", approved: "Approuvé", rejected: "Rejeté", paid: "Payé" };
const STATUS_COLOR: Record<string, string> = { draft: "bg-gray-100 text-gray-700", submitted: "bg-blue-100 text-blue-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700", paid: "bg-purple-100 text-purple-700" };
const CATEGORIES = ["transport", "repas", "hébergement", "fournitures", "communication", "formation", "autre"];

export default function Expenses() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({ title: "", description: "", periodStart: "", periodEnd: "" });
  const [itemForm, setItemForm] = useState({ category: "transport", description: "", amount: "", expenseDate: new Date().toISOString().split("T")[0], notes: "" });

  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: ["expenses"],
    queryFn: () => apiFetch("/api/hr/expenses"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/api/hr/expenses", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setNewOpen(false); toast({ title: "Note de frais créée" }); },
  });

  const addItemMut = useMutation({
    mutationFn: ({ id, item }: { id: string; item: typeof itemForm }) => apiFetch(`/api/hr/expenses/${id}/items`, { method: "POST", body: JSON.stringify({ ...item, amount: Number(item.amount) }) }),
    onSuccess: (_, { id }) => { fetchDetail(id); setAddItemOpen(false); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/expenses/${id}/submit`, { method: "POST" }),
    onSuccess: (_, id) => { fetchDetail(id); qc.invalidateQueries({ queryKey: ["expenses"] }); toast({ title: "Note soumise pour approbation" }); },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/expenses/${id}/approve`, { method: "POST" }),
    onSuccess: (_, id) => { fetchDetail(id); qc.invalidateQueries({ queryKey: ["expenses"] }); toast({ title: "Note approuvée" }); },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiFetch(`/api/hr/expenses/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: (_, { id }) => { fetchDetail(id); qc.invalidateQueries({ queryKey: ["expenses"] }); setRejectOpen(null); toast({ title: "Note rejetée" }); },
  });

  const payMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/expenses/${id}/pay`, { method: "POST" }),
    onSuccess: (_, id) => { fetchDetail(id); qc.invalidateQueries({ queryKey: ["expenses"] }); toast({ title: "Note marquée comme payée" }); },
  });

  const deleteItemMut = useMutation({
    mutationFn: ({ reportId, itemId }: { reportId: string; itemId: string }) => apiFetch(`/api/hr/expenses/${reportId}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: (_, { reportId }) => { fetchDetail(reportId); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  async function fetchDetail(id: string) {
    const data = await apiFetch(`/api/hr/expenses/${id}`);
    setDetail(data as ReportDetail);
  }

  const totals = { total: (reports ?? []).reduce((s, r) => s + r.totalAmount, 0), submitted: (reports ?? []).filter(r => r.status === "submitted").length, approved: (reports ?? []).filter(r => r.status === "approved").length };

  return (
    <HrShell
      title="Notes de frais"
      subtitle="Soumission, validation et remboursement des frais professionnels"
      actions={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouvelle note</Button>}
    >
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase mb-1">Total soumis</div><div className="text-xl font-bold">{formatFCFA(totals.total)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase mb-1">En attente</div><div className="text-xl font-bold">{totals.submitted}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase mb-1">Approuvées</div><div className="text-xl font-bold text-emerald-600">{totals.approved}</div></CardContent></Card>
      </div>

      {isLoading ? <div className="text-sm text-muted-foreground">Chargement…</div> :
        (reports ?? []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Aucune note de frais.</p></div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3 text-left">Collaborateur</th><th className="px-4 py-3 text-left">Titre</th><th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {(reports ?? []).map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => fetchDetail(r.id)}>
                    <td className="px-4 py-3 font-medium">{r.firstName} {r.lastName}<div className="text-xs text-muted-foreground">{r.poste}</div></td>
                    <td className="px-4 py-3">{r.title}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatFCFA(r.totalAmount)}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {r.status === "submitted" && (<>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Approuver" onClick={() => approveMut.mutate(r.id)}><CheckCircle className="w-4 h-4 text-emerald-600" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Rejeter" onClick={() => setRejectOpen(r.id)}><XCircle className="w-4 h-4 text-red-500" /></Button>
                        </>)}
                        {r.status === "approved" && <Button size="icon" variant="ghost" className="h-7 w-7" title="Marquer payé" onClick={() => payMut.mutate(r.id)}><CreditCard className="w-4 h-4 text-purple-600" /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {/* Créer note */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle note de frais</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Titre</Label><Input placeholder="Mission Lomé — juin 2026" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Période début</Label><Input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} /></div>
              <div><Label>Période fin</Label><Input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Annuler</Button>
            <Button disabled={!form.title || createMut.isPending} onClick={() => createMut.mutate(form)}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Détail note */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detail.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[detail.status] ?? ""}`}>{STATUS_LABEL[detail.status] ?? detail.status}</span>
                <span className="text-sm text-muted-foreground">{detail.firstName} {detail.lastName}</span>
              </div>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {detail.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.description}</div>
                    <div className="text-xs text-muted-foreground">{item.category} · {new Date(item.expenseDate).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <div className="font-semibold text-sm">{formatFCFA(item.amount)}</div>
                  {detail.status === "draft" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteItemMut.mutate({ reportId: detail.id, itemId: item.id })}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between py-2 border-t font-semibold">
              <span>Total</span><span>{formatFCFA(detail.totalAmount)}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {detail.status === "draft" && <>
                <Button size="sm" variant="outline" onClick={() => { setAddItemOpen(true); }}><PlusCircle className="w-4 h-4 mr-1" />Ajouter frais</Button>
                <Button size="sm" onClick={() => submitMut.mutate(detail.id)}>Soumettre</Button>
              </>}
              {detail.status === "submitted" && <>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMut.mutate(detail.id)}><CheckCircle className="w-4 h-4 mr-1" />Approuver</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectOpen(detail.id)}><XCircle className="w-4 h-4 mr-1" />Rejeter</Button>
              </>}
              {detail.status === "approved" && <Button size="sm" onClick={() => payMut.mutate(detail.id)}><CreditCard className="w-4 h-4 mr-1" />Marquer payé</Button>}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Ajouter item */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajouter une dépense</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Catégorie</Label><Select value={itemForm.category} onValueChange={v => setItemForm(f => ({ ...f, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Description</Label><Input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Montant (FCFA)</Label><Input type="number" value={itemForm.amount} onChange={e => setItemForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Date</Label><Input type="date" value={itemForm.expenseDate} onChange={e => setItemForm(f => ({ ...f, expenseDate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Annuler</Button>
            <Button disabled={!itemForm.description || !itemForm.amount || addItemMut.isPending} onClick={() => detail && addItemMut.mutate({ id: detail.id, item: itemForm })}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejeter */}
      <Dialog open={!!rejectOpen} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Motif de rejet</DialogTitle></DialogHeader>
          <div className="py-2"><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Expliquez le motif du rejet…" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Annuler</Button>
            <Button variant="destructive" disabled={!rejectReason} onClick={() => rejectOpen && rejectMut.mutate({ id: rejectOpen, reason: rejectReason })}>Rejeter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
