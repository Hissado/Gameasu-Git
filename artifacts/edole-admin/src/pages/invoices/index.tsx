import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Search, FileText, AlertCircle, Calendar, Wallet, Building, Pencil, XCircle, AlertTriangle, Clock, ShieldAlert, Mail, MinusCircle, Printer, Link2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, StatusTabs } from "@/components/ui/page-header";
import { toast } from "sonner";
import { Link } from "wouter";
import { LineItemsEditor, LineItem, computeTotals } from "@/components/commercial/LineItemsEditor";
import { SendEmailDialog } from "@/components/commercial/SendEmailDialog";
import { CreditNoteDialog } from "@/components/commercial/CreditNoteDialog";

type Client = { id: string; name: string };
type Invoice = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; paidAmount: number | null;
  clientId: string | null; clientName: string | null;
  dueDate: string | null; issuedAt: string | null; notes: string | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:          { label: "Brouillon",    cls: "bg-slate-100 text-slate-600 border-slate-200" },
  pending:        { label: "En attente",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  partially_paid: { label: "Part. payée", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  paid:           { label: "Payée",        cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  overdue:        { label: "En retard",    cls: "bg-red-50 text-red-700 border-red-200 font-bold border-2" },
  cancelled:      { label: "Annulée",      cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

const EDIT_ALLOWED: Record<string, string[]> = {
  draft:   ["clientId", "totalAmount", "dueDate", "notes"],
  pending: ["dueDate", "notes"],
  overdue: ["dueDate", "notes"],
  partially_paid: ["notes"],
};

const CANCEL_RULES: Record<string, { allowed: boolean; needsReason: boolean; warning?: string; blocked?: string }> = {
  draft:          { allowed: true,  needsReason: false },
  pending:        { allowed: true,  needsReason: true },
  overdue:        { allowed: true,  needsReason: true, warning: "Cette facture est en retard de paiement. L'annulation entraînera une contre-passation comptable." },
  partially_paid: { allowed: false, needsReason: false, blocked: "Un paiement partiel a déjà été encaissé. Vous devez d'abord annuler ou rembourser les encaissements associés avant de pouvoir annuler cette facture." },
  paid:           { allowed: false, needsReason: false, blocked: "Cette facture est entièrement payée. Annuler les encaissements reçus via votre comptable avant de modifier ce document." },
  cancelled:      { allowed: false, needsReason: false, blocked: "Cette facture est déjà annulée." },
};

const METHODS: Record<string, string> = {
  cash: "Espèces", bank: "Virement", mobile_money: "Mobile Money", check: "Chèque", other: "Autre",
};

// ─── RecordPaymentDialog ──────────────────────────────────────────────────────

function RecordPaymentDialog({ invoice, onClose, onSuccess }: { invoice: Invoice; onClose: () => void; onSuccess: () => void }) {
  const remaining = (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0);
  const [amount, setAmount] = useState(String(Math.max(0, remaining)));
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id, amount: Number(amount), currency: "XOF", method, reference: reference || undefined, paidAt, notes: notes || undefined }),
      });
      toast.success("Paiement enregistré et comptabilisé");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-[#C8A24B]" /> Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            <strong>{invoice.referenceNumber}</strong> · {invoice.clientName} · Reste dû : <strong className="text-amber-600">{formatFCFA(remaining)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Montant (FCFA) *</Label><Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Mode de paiement</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
            <div className="space-y-1"><Label>Référence</Label><Input placeholder="REF-001" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">{saving ? "Enregistrement…" : "Valider"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NewInvoiceDialog ─────────────────────────────────────────────────────────

function NewInvoiceDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: clientsRes } = useQuery<{ data: Client[] }>({ queryKey: ["clients-list"], queryFn: () => apiFetch("/api/clients?limit=100") });
  const clients = clientsRes?.data ?? [];
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const totals = computeTotals(lines);

  const handleSave = async () => {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    if (lines.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSaving(true);
    try {
      const inv = await apiFetch<{ id: string }>("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientId, totalAmount: totals.totalTTC, currency: "XOF",
          status: "pending", issuedAt: new Date().toISOString().slice(0, 10),
          dueDate: dueDate || undefined, notes: notes || undefined,
        }),
      });
      await apiFetch(`/api/invoices/${inv.id}/lines`, { method: "PUT", body: JSON.stringify({ lines }) });
      toast.success("Facture créée et comptabilisée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-[#C8A24B]" /> Nouvelle facture</DialogTitle>
          <DialogDescription>La facture sera comptabilisée automatiquement. Sélectionnez les produits/services facturés.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date d'échéance</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Lignes facturées</Label>
            <LineItemsEditor lines={lines} onChange={setLines} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes / Objet</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Objet, référence commande, conditions…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !clientId || lines.length === 0} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">
            {saving ? "Création…" : totals.totalTTC > 0 ? `Créer — ${formatFCFA(totals.totalTTC)}` : "Créer la facture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EditInvoiceDialog ────────────────────────────────────────────────────────

function EditInvoiceDialog({ invoice, onClose, onSuccess }: { invoice: Invoice; onClose: () => void; onSuccess: () => void }) {
  const { data: clientsRes } = useQuery<{ data: Client[] }>({ queryKey: ["clients-list"], queryFn: () => apiFetch("/api/clients?limit=100") });
  const clients = clientsRes?.data ?? [];
  const editable = EDIT_ALLOWED[invoice.status] ?? [];
  const canEdit = (f: string) => editable.includes(f);

  const [clientId, setClientId] = useState(invoice.clientId ?? "");
  const [amount, setAmount] = useState(String(invoice.totalAmount ?? ""));
  const [dueDate, setDueDate] = useState(invoice.dueDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/invoices/${invoice.id}/edit`, {
        method: "PATCH",
        body: JSON.stringify({
          clientId: canEdit("clientId") ? clientId || undefined : undefined,
          totalAmount: canEdit("totalAmount") ? Number(amount) : undefined,
          dueDate: canEdit("dueDate") ? dueDate || undefined : undefined,
          notes: canEdit("notes") ? notes || undefined : undefined,
        }),
      });
      toast.success("Facture mise à jour");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-[#C8A24B]" /> Modifier la facture</DialogTitle>
          <DialogDescription>
            <strong>{invoice.referenceNumber}</strong> · {STATUS_MAP[invoice.status]?.label ?? invoice.status}
            {invoice.status !== "draft" && <span className="ml-2 text-amber-600 text-xs">⚠ Seuls les champs autorisés par le statut sont modifiables.</span>}
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
            {canEdit("dueDate") && (
              <div className="space-y-1"><Label>Date d'échéance</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            )}
          </div>
          {canEdit("notes") && (
            <div className="space-y-1"><Label>Notes internes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CancelInvoiceDialog ──────────────────────────────────────────────────────

function CancelInvoiceDialog({ invoice, onClose, onSuccess }: { invoice: Invoice; onClose: () => void; onSuccess: () => void }) {
  const rules = CANCEL_RULES[invoice.status] ?? { allowed: false, needsReason: false };
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCancel = async () => {
    if (rules.needsReason && !reason.trim()) { toast.error("Une justification est requise"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/invoices/${invoice.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      });
      toast.success("Facture annulée — contre-passation comptable enregistrée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur lors de l'annulation"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700"><XCircle className="w-5 h-5" /> Annuler la facture</DialogTitle>
          <DialogDescription>
            <strong>{invoice.referenceNumber}</strong> · {invoice.clientName} · {formatFCFA(invoice.totalAmount ?? 0)}
          </DialogDescription>
        </DialogHeader>
        {rules.blocked ? (
          <div className="py-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Annulation bloquée — Contrôle interne</p>
              <p className="text-sm text-red-600 mt-1">{rules.blocked}</p>
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
              <Textarea rows={3} placeholder="Ex : erreur de saisie, annulation de commande…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Cette action est tracée dans la piste d'audit et génère une contre-passation comptable.
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

export default function InvoicesList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [sendEmailTarget, setSendEmailTarget] = useState<Invoice | null>(null);
  const [creditNoteTarget, setCreditNoteTarget] = useState<Invoice | null>(null);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Invoice[] }>({
    queryKey: ["invoices"],
    queryFn: () => apiFetch("/api/invoices?limit=50"),
  });

  const allInvoices = data?.data ?? [];
  const overdueCount = allInvoices.filter(i => i.status === "overdue").length;
  const totalOutstanding = allInvoices
    .filter(i => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + ((i.totalAmount ?? 0) - (i.paidAmount ?? 0)), 0);

  const invoices = allInvoices.filter(inv => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (!search) return true;
    return inv.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.clientName ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const statusTabCounts: Record<string, number> = {
    all:            allInvoices.length,
    draft:          allInvoices.filter(i => i.status === "draft").length,
    pending:        allInvoices.filter(i => i.status === "pending").length,
    partially_paid: allInvoices.filter(i => i.status === "partially_paid").length,
    overdue:        allInvoices.filter(i => i.status === "overdue").length,
    paid:           allInvoices.filter(i => i.status === "paid").length,
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <PageHeader
        title="Factures"
        icon={FileText}
        subtitle={
          <>
            Facturation client · Encours : <strong className="text-amber-600">{formatFCFA(totalOutstanding)}</strong>
            {overdueCount > 0 && <span className="ml-2 text-red-600 font-semibold">· {overdueCount} en retard</span>}
          </>
        }
        actions={
          <Button onClick={() => setNewOpen(true)} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white font-semibold gap-1.5">
            <Plus className="w-4 h-4" strokeWidth={3} /> Créer une facture
          </Button>
        }
      />

      {/* Onglets de filtrage par statut Xero-style */}
      <StatusTabs
        tabs={[
          { key: "all",            label: "Toutes",       count: statusTabCounts.all },
          { key: "draft",          label: "Brouillons",   count: statusTabCounts.draft },
          { key: "pending",        label: "En attente",   count: statusTabCounts.pending },
          { key: "partially_paid", label: "Part. payées", count: statusTabCounts.partially_paid },
          { key: "overdue",        label: "En retard",    count: statusTabCounts.overdue },
          { key: "paid",           label: "Payées",       count: statusTabCounts.paid },
        ]}
        active={statusFilter}
        onChange={(k) => setStatusFilter(k)}
        className="border-b border-border pb-1"
      />

      {/* Bannière factures en retard */}
      {overdueCount > 0 && (
        <div className="flex items-start md:items-center gap-4 p-4 rounded-xl border-2 border-red-200 bg-red-50 animate-in fade-in">
          <div className="p-2 bg-red-100 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">
              {overdueCount} facture{overdueCount > 1 ? "s" : ""} en retard de paiement
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Encours échu : <strong>{formatFCFA(allInvoices.filter(i => i.status === "overdue").reduce((s, i) => s + ((i.totalAmount ?? 0) - (i.paidAmount ?? 0)), 0))}</strong>
              {" · "}Relancez vos clients pour régulariser les paiements en attente.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {statusFilter !== "overdue" && (
              <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100 text-xs gap-1"
                onClick={() => setStatusFilter("overdue")}>
                <AlertCircle className="w-3.5 h-3.5" /> Filtrer retards
              </Button>
            )}
            {(() => {
              const first = allInvoices.find(i => i.status === "overdue");
              return first ? (
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1"
                  onClick={() => setSendEmailTarget(first)}>
                  <Mail className="w-3.5 h-3.5" /> Relancer
                </Button>
              ) : null;
            })()}
          </div>
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Toutes les factures</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="N° Facture, Client…" className="pl-9 h-9"
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
                  <TableHead>Réf. Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Émise le</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Reste à payer</TableHead>
                  <TableHead className="w-44">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto text-slate-200 mb-3" /><p>Aucune facture trouvée.</p>
                    </TableCell>
                  </TableRow>
                ) : invoices.map(inv => {
                  const isOverdue = inv.status === "overdue";
                  const isCancelled = inv.status === "cancelled";
                  const remaining = (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0);
                  const st = STATUS_MAP[inv.status] ?? { label: inv.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                  const canPay = !["paid", "cancelled"].includes(inv.status);
                  const canEditDoc = !!EDIT_ALLOWED[inv.status];
                  const canCancelDoc = CANCEL_RULES[inv.status]?.allowed === true;
                  const isCancelBlocked = !CANCEL_RULES[inv.status]?.allowed && !isCancelled;

                  return (
                    <TableRow key={inv.id} className={`hover:bg-slate-50/50 ${isOverdue ? "bg-red-50/20" : ""} ${isCancelled ? "opacity-60" : ""}`}>
                      <TableCell className="font-mono text-sm font-bold">
                        {inv.clientId
                          ? <Link href={`/clients/${inv.clientId}`}><span className="hover:text-[#C8A24B] hover:underline cursor-pointer">{inv.referenceNumber}</span></Link>
                          : inv.referenceNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {inv.clientId
                            ? <Link href={`/clients/${inv.clientId}`}><span className="font-medium text-sm hover:text-[#C8A24B] hover:underline cursor-pointer">{inv.clientName || "—"}</span></Link>
                            : <span className="font-medium text-sm">{inv.clientName || "—"}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{inv.issuedAt ? formatDate(inv.issuedAt) : "—"}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 text-sm ${isOverdue ? "text-red-600 font-bold" : "text-slate-600"}`}>
                          {isOverdue ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5 text-slate-400" />}
                          {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${st.cls}`}>{st.label}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatFCFA(inv.totalAmount ?? 0)}</TableCell>
                      <TableCell className="text-right">
                        {inv.status === "paid"
                          ? <span className="text-emerald-600 font-semibold text-xs">Soldé</span>
                          : isCancelled ? <span className="text-slate-400 text-xs">—</span>
                          : <span className={remaining > 0 ? "font-semibold text-amber-600" : ""}>{formatFCFA(remaining)}</span>}
                      </TableCell>
                      <TableCell>
                        {!isCancelled && (
                          <div className="flex items-center gap-1">
                            {canPay && (
                              <Button size="sm" onClick={() => setPayingInvoice(inv)}
                                className="h-7 text-xs gap-0.5 bg-[#C8A24B] hover:bg-[#b8922b] text-white">
                                <Wallet className="w-3 h-3" /> Encaisser
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => setSendEmailTarget(inv)}>
                              <Mail className="w-3 h-3" /> Email
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-slate-500 border-slate-200">
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  className="text-xs gap-2 cursor-pointer"
                                  onClick={() => window.open(`/documents/invoice/${inv.id}/print`, "_blank")}>
                                  <Printer className="w-3.5 h-3.5 text-slate-500" /> Télécharger PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs gap-2 cursor-pointer text-violet-700 focus:text-violet-700"
                                  disabled={generatingLinkId === inv.id}
                                  onClick={async () => {
                                    setGeneratingLinkId(inv.id);
                                    try {
                                      const r = await apiFetch(`/api/invoices/${inv.id}/generate-public-link`, { method: "POST" });
                                      const url = `${window.location.origin}/facture/${r.token}`;
                                      await navigator.clipboard.writeText(url);
                                      toast.success("Lien public copié dans le presse-papiers");
                                    } catch { toast.error("Erreur lors de la génération du lien"); }
                                    finally { setGeneratingLinkId(null); }
                                  }}>
                                  <Link2 className="w-3.5 h-3.5" /> Copier lien public
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs gap-2 cursor-pointer text-amber-700 focus:text-amber-700"
                                  onClick={() => setCreditNoteTarget(inv)}>
                                  <MinusCircle className="w-3.5 h-3.5" /> Créer un avoir
                                </DropdownMenuItem>
                                {canEditDoc && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-xs gap-2 cursor-pointer"
                                      onClick={() => setEditTarget(inv)}>
                                      <Pencil className="w-3.5 h-3.5 text-slate-500" /> Modifier
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(canCancelDoc || isCancelBlocked) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className={`text-xs gap-2 cursor-pointer ${isCancelBlocked ? "opacity-40 pointer-events-none" : "text-red-600 focus:text-red-600"}`}
                                      onClick={() => setCancelTarget(inv)}>
                                      <XCircle className="w-3.5 h-3.5" /> Annuler la facture
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      {newOpen && <NewInvoiceDialog onClose={() => setNewOpen(false)} onSuccess={invalidate} />}
      {payingInvoice && <RecordPaymentDialog invoice={payingInvoice} onClose={() => setPayingInvoice(null)} onSuccess={invalidate} />}
      {editTarget && <EditInvoiceDialog invoice={editTarget} onClose={() => setEditTarget(null)} onSuccess={invalidate} />}
      {cancelTarget && <CancelInvoiceDialog invoice={cancelTarget} onClose={() => setCancelTarget(null)} onSuccess={invalidate} />}
      {sendEmailTarget && (
        <SendEmailDialog
          docType="invoice"
          docId={sendEmailTarget.id}
          referenceNumber={sendEmailTarget.referenceNumber}
          clientName={sendEmailTarget.clientName ?? null}
          clientEmail={null}
          totalAmount={sendEmailTarget.totalAmount ?? null}
          onClose={() => setSendEmailTarget(null)}
        />
      )}
      {creditNoteTarget && (
        <CreditNoteDialog
          invoice={creditNoteTarget}
          onClose={() => setCreditNoteTarget(null)}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
