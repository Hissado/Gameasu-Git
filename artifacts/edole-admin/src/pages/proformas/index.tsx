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
import { Plus, Search, FileText, Receipt, CheckCircle2, Building, Pencil, XCircle, AlertTriangle, Clock, Mail, Printer, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { LineItemsEditor, LineItem, computeTotals } from "@/components/commercial/LineItemsEditor";
import { SendEmailDialog } from "@/components/commercial/SendEmailDialog";
import { PageHeader, StatusTabs } from "@/components/ui/page-header";

type Client = { id: string; name: string };
type Proforma = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; clientId: string | null; clientName: string | null;
  createdAt: string; validUntil: string | null; notes: string | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Brouillon", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  sent:      { label: "Envoyé",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  approved:  { label: "Approuvé", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected:  { label: "Refusé",   cls: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "Annulé",   cls: "bg-slate-50 text-slate-400 border-slate-200 line-through" },
};

const EDIT_ALLOWED: Record<string, string[]> = {
  draft: ["clientId", "totalAmount", "validUntil", "notes"],
  sent:  ["totalAmount", "validUntil", "notes"],
};

const CANCEL_RULES: Record<string, { allowed: boolean; needsReason: boolean; warning?: string }> = {
  draft:     { allowed: true,  needsReason: false },
  sent:      { allowed: true,  needsReason: true },
  approved:  { allowed: true,  needsReason: true, warning: "Ce devis a été approuvé. Vérifiez qu'aucune facture n'a été générée avant d'annuler." },
  rejected:  { allowed: true,  needsReason: false },
  cancelled: { allowed: false, needsReason: false },
};

// ─── NewProformaDialog ────────────────────────────────────────────────────────

function NewProformaDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: clientsRes } = useQuery<{ data: Client[] }>({
    queryKey: ["clients-list"],
    queryFn: () => apiFetch("/api/clients?limit=100"),
  });
  const clients = clientsRes?.data ?? [];
  const [clientId, setClientId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const totals = computeTotals(lines);

  const handleSave = async () => {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    if (lines.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSaving(true);
    try {
      const pro = await apiFetch<{ id: string }>("/api/proformas", {
        method: "POST",
        body: JSON.stringify({
          clientId, totalAmount: totals.totalTTC, currency: "XOF",
          validUntil: validUntil || undefined,
          paymentTerms: paymentTerms || undefined,
          notes: notes || undefined,
        }),
      });
      await apiFetch(`/api/proformas/${pro.id}/lines`, { method: "PUT", body: JSON.stringify({ lines }) });
      toast.success("Devis créé avec succès");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-[#2563EB]" /> Nouveau devis</DialogTitle>
          <DialogDescription>Sélectionnez les produits/services et définissez les conditions commerciales.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valable jusqu'au</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Conditions de paiement</Label>
            <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="ex : 30 jours fin de mois, À la commande…" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Lignes du devis</Label>
            <LineItemsEditor lines={lines} onChange={setLines} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes / Objet</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Objet, conditions particulières…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !clientId || lines.length === 0} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">
            {saving ? "Création…" : totals.totalTTC > 0 ? `Créer le devis — ${formatFCFA(totals.totalTTC)}` : "Créer le devis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EditProformaDialog ───────────────────────────────────────────────────────

function EditProformaDialog({ proforma, onClose, onSuccess }: { proforma: Proforma; onClose: () => void; onSuccess: () => void }) {
  const { data: clientsRes } = useQuery<{ data: Client[] }>({
    queryKey: ["clients-list"],
    queryFn: () => apiFetch("/api/clients?limit=100"),
  });
  const clients = clientsRes?.data ?? [];
  const editable = EDIT_ALLOWED[proforma.status] ?? [];
  const canEdit = (field: string) => editable.includes(field);

  const [clientId, setClientId] = useState(proforma.clientId ?? "");
  const [amount, setAmount] = useState(String(proforma.totalAmount ?? ""));
  const [validUntil, setValidUntil] = useState(proforma.validUntil?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(proforma.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/proformas/${proforma.id}/edit`, {
        method: "PATCH",
        body: JSON.stringify({
          clientId: canEdit("clientId") ? clientId || undefined : undefined,
          totalAmount: canEdit("totalAmount") ? Number(amount) : undefined,
          validUntil: canEdit("validUntil") ? validUntil || undefined : undefined,
          notes: canEdit("notes") ? notes || undefined : undefined,
        }),
      });
      toast.success("Devis mis à jour");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur lors de la modification"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-[#2563EB]" /> Modifier le devis</DialogTitle>
          <DialogDescription>
            <strong>{proforma.referenceNumber}</strong> · Statut : {STATUS_MAP[proforma.status]?.label ?? proforma.status}
            {proforma.status === "sent" && <span className="ml-2 text-amber-600 text-xs">⚠ Certains champs sont verrouillés car le devis a été envoyé.</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {canEdit("clientId") && (
            <div className="space-y-1">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {canEdit("totalAmount") && (
              <div className="space-y-1"><Label>Montant (FCFA)</Label><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            )}
            {canEdit("validUntil") && (
              <div className="space-y-1"><Label>Valable jusqu'au</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
            )}
          </div>
          {canEdit("notes") && (
            <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Fermer</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CancelProformaDialog ─────────────────────────────────────────────────────

function CancelProformaDialog({ proforma, onClose, onSuccess }: { proforma: Proforma; onClose: () => void; onSuccess: () => void }) {
  const rules = CANCEL_RULES[proforma.status] ?? { allowed: false, needsReason: false };
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCancel = async () => {
    if (rules.needsReason && !reason.trim()) { toast.error("Une justification est requise"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/proformas/${proforma.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      });
      toast.success("Devis annulé");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur lors de l'annulation"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700"><XCircle className="w-5 h-5" /> Annuler le devis</DialogTitle>
          <DialogDescription><strong>{proforma.referenceNumber}</strong> · {proforma.clientName}</DialogDescription>
        </DialogHeader>
        {!rules.allowed ? (
          <div className="py-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Annulation impossible</p>
              <p className="text-sm text-red-600 mt-1">Ce devis est déjà annulé.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {rules.warning && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">{rules.warning}</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>{rules.needsReason ? "Motif d'annulation *" : "Motif d'annulation (optionnel)"}</Label>
              <Textarea rows={3} placeholder="Ex : demande du client, conditions non satisfaites…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Cette action est tracée dans la piste d'audit.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Retour</Button>
          {rules.allowed && (
            <Button variant="destructive" onClick={handleCancel} disabled={saving || (rules.needsReason && !reason.trim())}>
              {saving ? "Annulation…" : "Confirmer l'annulation"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProformasList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Proforma | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Proforma | null>(null);
  const [sendEmailTarget, setSendEmailTarget] = useState<Proforma | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingOrderId, setGeneratingOrderId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Proforma[] }>({
    queryKey: ["proformas"],
    queryFn: () => apiFetch("/api/proformas?limit=50"),
  });

  const allProformas = data?.data ?? [];
  const proformas = allProformas.filter(p =>
    (statusFilter === "all" || p.status === statusFilter) &&
    (!search || p.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const generateInvoice = async (id: string) => {
    setGeneratingId(id);
    try {
      await apiFetch(`/api/proformas/${id}/generate-invoice`, { method: "POST" });
      toast.success("Facture générée et comptabilisée");
      qc.invalidateQueries({ queryKey: ["proformas"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("déjà générée")) toast.info("Une facture existe déjà pour ce devis");
      else toast.error(msg || "Erreur lors de la génération");
    } finally { setGeneratingId(null); }
  };

  const generateOrder = async (id: string) => {
    setGeneratingOrderId(id);
    try {
      await apiFetch(`/api/proformas/${id}/generate-order`, { method: "POST" });
      toast.success("Commande confirmée créée depuis le devis");
      qc.invalidateQueries({ queryKey: ["proformas"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la création de la commande");
    } finally { setGeneratingOrderId(null); }
  };

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/proformas/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => { toast.success("Statut mis à jour"); qc.invalidateQueries({ queryKey: ["proformas"] }); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["proformas"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <PageHeader
        title="Devis"
        subtitle={`${allProformas.length} devis · Propositions commerciales`}
        icon={FileText}
        actions={
          <Button onClick={() => setNewOpen(true)} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold gap-1.5">
            <Plus className="w-4 h-4" strokeWidth={3} /> Créer un devis
          </Button>
        }
      />
      <StatusTabs
        tabs={[
          { key: "all",      label: "Tous",       count: allProformas.length },
          { key: "draft",    label: "Brouillons", count: allProformas.filter(p => p.status === "draft").length },
          { key: "sent",     label: "Envoyés",    count: allProformas.filter(p => p.status === "sent").length },
          { key: "approved", label: "Approuvés",  count: allProformas.filter(p => p.status === "approved").length },
          { key: "rejected", label: "Refusés",    count: allProformas.filter(p => p.status === "rejected").length },
        ]}
        active={statusFilter}
        onChange={setStatusFilter}
      />

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
                  <TableHead className="w-60">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proformas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto text-slate-200 mb-3" /><p>Aucun devis trouvé.</p>
                    </TableCell>
                  </TableRow>
                ) : proformas.map(p => {
                  const st = STATUS_MAP[p.status] ?? { label: p.status, cls: "bg-slate-100 text-slate-600" };
                  const isCancelled = p.status === "cancelled";
                  const canEditDoc = !!EDIT_ALLOWED[p.status];
                  const canCancelDoc = CANCEL_RULES[p.status]?.allowed === true;

                  return (
                    <TableRow key={p.id} className={`hover:bg-slate-50/50 ${isCancelled ? "opacity-60" : ""}`}>
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
                        {!isCancelled && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {p.status === "draft" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => changeStatus.mutate({ id: p.id, status: "sent" })}>
                                Envoyer
                              </Button>
                            )}
                            {p.status === "sent" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => changeStatus.mutate({ id: p.id, status: "approved" })}>
                                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Approuver
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => setSendEmailTarget(p)}>
                              <Mail className="w-3 h-3" /> Email
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5 text-slate-600 border-slate-200 hover:bg-slate-50"
                              onClick={() => window.open(`/documents/proforma/${p.id}/print`, "_blank")}>
                              <Printer className="w-3 h-3" /> PDF
                            </Button>
                            {(p.status === "draft" || p.status === "sent") && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5 text-primary border-indigo-200 hover:bg-primary/5"
                                disabled={generatingOrderId === p.id} onClick={() => generateOrder(p.id)}>
                                <ShoppingCart className="w-3 h-3" />{generatingOrderId === p.id ? "…" : "Commande"}
                              </Button>
                            )}
                            {p.status !== "rejected" && p.status !== "cancelled" && (
                              <Button size="sm" className="h-7 text-xs gap-0.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                                disabled={generatingId === p.id} onClick={() => generateInvoice(p.id)}>
                                <Receipt className="w-3 h-3" />{generatingId === p.id ? "…" : "Facture"}
                              </Button>
                            )}
                            {canEditDoc && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-600 hover:bg-slate-100"
                                onClick={() => setEditTarget(p)}>
                                <Pencil className="w-3 h-3 mr-0.5" /> Modifier
                              </Button>
                            )}
                            {canCancelDoc && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setCancelTarget(p)}>
                                <XCircle className="w-3 h-3 mr-0.5" /> Annuler
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {newOpen && <NewProformaDialog onClose={() => setNewOpen(false)} onSuccess={invalidate} />}
      {editTarget && <EditProformaDialog proforma={editTarget} onClose={() => setEditTarget(null)} onSuccess={invalidate} />}
      {cancelTarget && <CancelProformaDialog proforma={cancelTarget} onClose={() => setCancelTarget(null)} onSuccess={invalidate} />}
      {sendEmailTarget && (
        <SendEmailDialog
          docType="proforma"
          docId={sendEmailTarget.id}
          referenceNumber={sendEmailTarget.referenceNumber}
          clientName={sendEmailTarget.clientName ?? null}
          clientEmail={null}
          totalAmount={sendEmailTarget.totalAmount ?? null}
          onClose={() => setSendEmailTarget(null)}
        />
      )}
    </div>
  );
}
