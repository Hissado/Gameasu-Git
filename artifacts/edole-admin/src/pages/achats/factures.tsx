import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search, AlertTriangle, FileText, Wallet, CheckCircle2, XCircle, ChevronRight, Clock, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = { id: string; name: string; code: string };
type Invoice = {
  id: string; referenceNumber: string; status: string;
  invoiceDate: string; dueDate: string | null;
  totalAmount: string | number; taxAmount: string | number; paidAmount: string | number;
  currency: string; notes: string | null;
  supplierId: string; supplierName: string | null; supplierCode: string | null;
  balance: number; isOverdue: boolean;
  createdAt: string;
};
type InvoiceDetail = Invoice & {
  supplierEmail: string | null; supplierPhone: string | null;
  expenseAccountId: string | null; projectId: string | null;
  payments: Payment[];
};
type Payment = {
  id: string; amount: string | number; method: string;
  reference: string | null; paidAt: string; notes: string | null;
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Brouillon",             cls: "bg-slate-100 text-slate-600 border-slate-200" },
  review:             { label: "À revoir",              cls: "bg-blue-50 text-blue-700 border-blue-200" },
  awaiting_approval:  { label: "En attente appro.",     cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  approved:           { label: "Approuvée",             cls: "bg-teal-50 text-teal-700 border-teal-200" },
  pending:            { label: "À payer",               cls: "bg-orange-50 text-orange-700 border-orange-200" },
  partially_paid:     { label: "Part. payée",           cls: "bg-amber-50 text-amber-700 border-amber-200" },
  paid:               { label: "Payée",                 cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  overdue:            { label: "En retard",             cls: "bg-red-50 text-red-700 border-red-200 font-bold" },
  cancelled:          { label: "Annulée",               cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── Payment methods ──────────────────────────────────────────────────────────

const METHODS: Record<string, string> = {
  virement: "Virement bancaire", especes: "Espèces", cheque: "Chèque",
  carte: "Carte bancaire", mixx: "Mixx", flooz: "Flooz", autre: "Autre",
};

// ─── Quick payment dialog ─────────────────────────────────────────────────────

function QuickPayDialog({ invoice, onClose, onSuccess }: { invoice: InvoiceDetail; onClose: () => void; onSuccess: () => void }) {
  const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const [amount, setAmount] = useState(String(Math.max(0, remaining)));
  const [method, setMethod] = useState("virement");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/purchases/payments", {
        method: "POST",
        body: JSON.stringify({ supplierInvoiceId: invoice.id, amount: Number(amount), paymentMethod: method, reference: reference || undefined, paidAt, notes: notes || undefined }),
      });
      toast.success("Paiement enregistré");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-[#F37021]" /> Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            <strong>{invoice.referenceNumber}</strong> · {invoice.supplierName} · Reste dû : <strong className="text-amber-600">{formatFCFA(remaining)}</strong>
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
          <Button onClick={handleSave} disabled={saving} className="bg-[#F37021] hover:bg-[#d96318] text-white">{saving ? "Enregistrement…" : "Valider"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New invoice dialog ───────────────────────────────────────────────────────

function NewInvoiceDialog({ suppliers, prefill, onClose, onSuccess }: { suppliers: Supplier[]; prefill?: { supplierId?: string; referenceNumber?: string; totalAmount?: string }; onClose: () => void; onSuccess: () => void }) {
  const [supplierId, setSupplierId] = useState(prefill?.supplierId ?? "");
  const [referenceNumber, setReferenceNumber] = useState(prefill?.referenceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [totalAmount, setTotalAmount] = useState(prefill?.totalAmount ?? "");
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!supplierId) { toast.error("Sélectionnez un fournisseur"); return; }
    if (!referenceNumber) { toast.error("Le numéro de facture est requis"); return; }
    if (!totalAmount || Number(totalAmount) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/purchases/invoices", {
        method: "POST",
        body: JSON.stringify({ supplierId, referenceNumber, invoiceDate, dueDate: dueDate || undefined, totalAmount: Number(totalAmount), taxAmount: Number(taxAmount) || 0, notes: notes || undefined }),
      });
      toast.success("Facture créée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-[#F37021]" /> Nouvelle facture fournisseur</DialogTitle>
          <DialogDescription>Enregistrez une facture reçue d'un fournisseur.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Fournisseur *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>N° de facture *</Label><Input placeholder="FACT-2026-001" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} /></div>
            <div className="space-y-1"><Label>Date de facture</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Montant HT (FCFA) *</Label><Input type="number" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label>TVA (FCFA)</Label><Input type="number" min="0" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} /></div>
            <div className="space-y-1 col-span-2"><Label>Date d'échéance</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#F37021] hover:bg-[#d96318] text-white">{saving ? "Création…" : "Créer la facture"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice detail sheet ─────────────────────────────────────────────────────

function InvoiceDetailSheet({ invoiceId, onClose, onRefresh }: { invoiceId: string; onClose: () => void; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const { data: inv, isLoading } = useQuery<InvoiceDetail>({
    queryKey: ["purchase-invoice-detail", invoiceId],
    queryFn: () => apiFetch(`/api/purchases/invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["purchase-invoice-detail", invoiceId] }); onRefresh(); };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/purchases/invoices/${invoiceId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success("Statut mis à jour");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setUpdating(false); }
  };

  const canPay = inv && !["paid", "cancelled"].includes(inv.status) && Number(inv.balance) > 0;
  const canApprove = inv?.status === "review" || inv?.status === "awaiting_approval";
  const canCancel = inv && !["paid", "cancelled"].includes(inv.status);

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#F37021]" />
            {isLoading ? "Chargement…" : inv?.referenceNumber}
          </SheetTitle>
        </SheetHeader>

        {isLoading && <div className="space-y-3 py-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded" />)}</div>}
        {inv && (
          <div className="space-y-6 py-4">
            {/* Status + actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={inv.status} />
              {inv.isOverdue && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs gap-1"><AlertTriangle className="w-3 h-3" /> En retard</Badge>}
              <div className="flex-1" />
              {canApprove && <Button size="sm" onClick={() => updateStatus("approved")} disabled={updating} className="bg-teal-600 hover:bg-teal-700 text-white gap-1"><CheckCircle2 className="w-4 h-4" /> Approuver</Button>}
              {inv.status === "approved" && <Button size="sm" onClick={() => updateStatus("pending")} disabled={updating} variant="outline">Marquer À payer</Button>}
              {canPay && <Button size="sm" onClick={() => setPayOpen(true)} className="bg-[#F37021] hover:bg-[#d96318] text-white gap-1"><Wallet className="w-4 h-4" /> Payer</Button>}
              {canCancel && <Button size="sm" variant="outline" onClick={() => updateStatus("cancelled")} disabled={updating} className="text-red-600 border-red-200 hover:bg-red-50 gap-1"><XCircle className="w-4 h-4" /> Annuler</Button>}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-4">
              <div><p className="text-xs text-muted-foreground">Fournisseur</p><p className="font-medium text-sm">{inv.supplierName ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Date facture</p><p className="font-medium text-sm">{formatDate(inv.invoiceDate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Échéance</p><p className={`font-medium text-sm ${inv.isOverdue ? "text-red-600" : ""}`}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Montant TTC</p><p className="font-semibold text-sm">{formatFCFA(Number(inv.totalAmount))}</p></div>
              <div><p className="text-xs text-muted-foreground">Montant payé</p><p className="font-medium text-sm text-emerald-700">{formatFCFA(Number(inv.paidAmount))}</p></div>
              <div><p className="text-xs text-muted-foreground">Solde restant</p><p className={`font-semibold text-sm ${Number(inv.balance) > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatFCFA(Number(inv.balance))}</p></div>
            </div>

            {inv.notes && <p className="text-sm text-muted-foreground italic bg-slate-50 rounded p-3">{inv.notes}</p>}

            {/* Payments history */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Paiements ({inv.payments.length})</h3>
              {inv.payments.length === 0 && <p className="text-sm text-muted-foreground italic">Aucun paiement enregistré.</p>}
              <div className="space-y-2">
                {inv.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded p-3 text-sm">
                    <div>
                      <span className="font-medium">{formatFCFA(Number(p.amount))}</span>
                      <span className="text-muted-foreground ml-2">· {METHODS[p.method] ?? p.method}</span>
                      {p.reference && <span className="text-muted-foreground ml-2">· {p.reference}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {payOpen && inv && (
          <QuickPayDialog invoice={inv} onClose={() => setPayOpen(false)} onSuccess={refresh} />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatsFactures() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const fromBcId = params.get("from_bc");

  const qc = useQueryClient();
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [newOpen, setNewOpen] = useState(!!fromBcId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: suppliersRes } = useQuery<{ data: Supplier[] }>({
    queryKey: ["purchases-suppliers-list"],
    queryFn: () => apiFetch("/api/purchases/suppliers?limit=200"),
  });
  const suppliers = suppliersRes?.data ?? [];

  const params2: Record<string, string> = { limit: "100" };
  if (filterStatus !== "all") params2.status = filterStatus;
  if (filterSupplier !== "all") params2.supplierId = filterSupplier;
  if (searchQ) params2.search = searchQ;

  const { data: res, isLoading } = useQuery<{ data: Invoice[]; total: number }>({
    queryKey: ["purchases-invoices", filterStatus, filterSupplier, searchQ],
    queryFn: () => apiFetch("/api/purchases/invoices?" + new URLSearchParams(params2).toString()),
  });
  const invoices = res?.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-invoices"] });

  const overdue = invoices.filter(i => i.isOverdue).length;
  const totalUnpaid = invoices.filter(i => !["paid", "cancelled"].includes(i.status)).reduce((s, i) => s + Number(i.balance), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Factures fournisseurs"
        subtitle={`${res?.total ?? 0} facture${(res?.total ?? 0) !== 1 ? "s" : ""}${overdue ? ` · ${overdue} en retard` : ""}`}
        actions={<Button onClick={() => setNewOpen(true)} className="bg-[#F37021] hover:bg-[#d96318] text-white gap-2"><Plus className="w-4 h-4" />Nouvelle facture</Button>}
      />

      {/* KPI strip */}
      {totalUnpaid > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-800"><strong>{formatFCFA(totalUnpaid)}</strong> restants à payer sur {invoices.filter(i => !["paid","cancelled"].includes(i.status)).length} facture(s)</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" className="pl-9" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tous les fournisseurs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les fournisseurs</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3,4].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6,7,8].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && invoices.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Aucune facture trouvée.</TableCell></TableRow>
              )}
              {invoices.map(inv => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedId(inv.id)}>
                  <TableCell className="font-mono text-sm font-medium">{inv.referenceNumber}</TableCell>
                  <TableCell className="text-sm">{inv.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inv.invoiceDate)}</TableCell>
                  <TableCell className="text-sm">
                    {inv.dueDate ? (
                      <span className={inv.isOverdue ? "text-red-600 font-medium flex items-center gap-1" : "text-muted-foreground"}>
                        {inv.isOverdue && <AlertTriangle className="w-3 h-3" />}
                        {formatDate(inv.dueDate)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatFCFA(Number(inv.totalAmount))}</TableCell>
                  <TableCell className={`text-right font-medium ${Number(inv.balance) > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatFCFA(Number(inv.balance))}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {newOpen && (
        <NewInvoiceDialog
          suppliers={suppliers}
          prefill={fromBcId ? undefined : undefined}
          onClose={() => setNewOpen(false)}
          onSuccess={refresh}
        />
      )}

      {selectedId && (
        <InvoiceDetailSheet invoiceId={selectedId} onClose={() => setSelectedId(null)} onRefresh={refresh} />
      )}
    </div>
  );
}
