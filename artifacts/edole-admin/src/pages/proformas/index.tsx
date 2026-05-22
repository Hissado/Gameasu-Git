import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatFCFA } from "@/lib/format";
import { Plus, Search, FileText, Receipt, CheckCircle2, Building } from "lucide-react";
import { toast } from "sonner";

type Client = { id: string; name: string };
type Proforma = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; clientId: string | null; clientName: string | null;
  createdAt: string; validUntil: string | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Brouillon", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  sent:     { label: "Envoyé",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  approved: { label: "Approuvé", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected: { label: "Refusé",   cls: "bg-red-50 text-red-700 border-red-200" },
};

// ─── NewProformaDialog ────────────────────────────────────────────────────────

function NewProformaDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: clientsRes } = useQuery<{ data: Client[] }>({
    queryKey: ["clients-list"],
    queryFn: () => apiFetch("/api/clients?limit=100"),
  });
  const clients = clientsRes?.data ?? [];

  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Montant requis"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/proformas", {
        method: "POST",
        body: JSON.stringify({
          clientId, totalAmount: Number(amount), currency: "XOF",
          validUntil: validUntil || undefined, notes: notes || undefined,
        }),
      });
      toast.success("Devis créé");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-[#C8A24B]" /> Nouveau devis</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Montant (FCFA) *</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valable jusqu'au</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes / Objet</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">
            {saving ? "Création…" : "Créer le devis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProformasList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Proforma[] }>({
    queryKey: ["proformas"],
    queryFn: () => apiFetch("/api/proformas?limit=50"),
  });

  const proformas = (data?.data ?? []).filter(p =>
    !search || p.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const approveAndGenerateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/proformas/${id}`, { method: "PUT", body: JSON.stringify({ status: "approved" }) });
      return apiFetch(`/api/proformas/${id}/generate-invoice`, { method: "POST" });
    },
    onSuccess: () => {
      toast.success("Devis approuvé et facture générée");
      qc.invalidateQueries({ queryKey: ["proformas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const generateInvoice = async (id: string) => {
    setGeneratingId(id);
    try {
      await apiFetch(`/api/proformas/${id}/generate-invoice`, { method: "POST" });
      toast.success("Facture générée et comptabilisée");
      qc.invalidateQueries({ queryKey: ["proformas"] });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("déjà générée")) {
        toast.info("Une facture existe déjà pour ce devis");
      } else {
        toast.error(msg || "Erreur lors de la génération");
      }
    } finally {
      setGeneratingId(null);
    }
  };

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/proformas/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["proformas"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Devis (Proformas)</h1>
          <p className="text-sm text-muted-foreground mt-1">Propositions commerciales — workflow devis → facture</p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white font-semibold gap-1.5">
          <Plus className="w-4 h-4" strokeWidth={3} /> Créer un devis
        </Button>
      </div>

      {/* Workflow hint */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="font-medium text-slate-600">Workflow :</span>
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">Brouillon</span>
          <span>→</span>
          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold">Envoyé</span>
          <span>→</span>
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold">Approuvé</span>
          <span>→</span>
          <Receipt className="w-3.5 h-3.5 text-[#C8A24B]" />
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-semibold">Facture générée</span>
        </span>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Liste des devis</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="N° devis, Client…" className="pl-9 h-9"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead>Réf. Devis</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-48">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proformas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                      <p>Aucun devis trouvé.</p>
                    </TableCell>
                  </TableRow>
                ) : proformas.map(p => {
                  const st = STATUS_MAP[p.status] ?? { label: p.status, cls: "bg-slate-100 text-slate-600" };
                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-bold">{p.referenceNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-sm">{p.clientName || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                      <TableCell className="text-sm">{p.validUntil ? formatDate(p.validUntil) : "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${st.cls}`}>{st.label}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatFCFA(p.totalAmount ?? 0)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {p.status === "draft" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5"
                              onClick={() => changeStatus.mutate({ id: p.id, status: "sent" })}>
                              Envoyer
                            </Button>
                          )}
                          {p.status === "sent" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => changeStatus.mutate({ id: p.id, status: "approved" })}>
                              <CheckCircle2 className="w-3 h-3" /> Approuver
                            </Button>
                          )}
                          {p.status !== "rejected" && (
                            <Button size="sm" className="h-7 text-xs gap-0.5 bg-[#C8A24B] hover:bg-[#b8922b] text-white"
                              disabled={generatingId === p.id}
                              onClick={() => generateInvoice(p.id)}>
                              <Receipt className="w-3 h-3" />
                              {generatingId === p.id ? "…" : "Facture"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {newOpen && <NewProformaDialog onClose={() => setNewOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["proformas"] })} />}
    </div>
  );
}
