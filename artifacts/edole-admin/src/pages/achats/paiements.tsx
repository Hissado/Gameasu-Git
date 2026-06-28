import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search, Wallet, AlertTriangle, Clock, Landmark, Smartphone, CreditCard, FileText } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = { id: string; name: string; code: string };
type Invoice = {
  id: string; referenceNumber: string; status: string;
  invoiceDate: string; dueDate: string | null;
  totalAmount: string | number; paidAmount: string | number;
  balance: number; isOverdue: boolean;
  supplierName: string | null;
};
type SupplierPayment = {
  id: string; amount: string | number; method: string;
  reference: string | null; paidAt: string; notes: string | null;
  supplierInvoiceId: string; invoiceRef: string | null;
  supplierId: string | null; supplierName: string | null;
};

// ─── Method badge ─────────────────────────────────────────────────────────────

const METHODS: Record<string, string> = {
  virement: "Virement", especes: "Espèces", cheque: "Chèque",
  carte: "Carte", mixx: "Mixx", flooz: "Flooz", autre: "Autre",
};

function MethodIcon({ method }: { method: string }) {
  if (method === "virement") return <Landmark className="w-4 h-4 text-slate-400" />;
  if (method === "carte") return <CreditCard className="w-4 h-4 text-blue-400" />;
  if (["mixx", "flooz"].includes(method)) return <Smartphone className="w-4 h-4 text-amber-400" />;
  return <Wallet className="w-4 h-4 text-slate-400" />;
}

// ─── Invoice status badge ─────────────────────────────────────────────────────

const INV_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  review: { label: "À revoir", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  approved: { label: "Approuvée", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  pending: { label: "À payer", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  partially_paid: { label: "Part. payée", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  paid: { label: "Payée", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  overdue: { label: "En retard", cls: "bg-red-50 text-red-700 border-red-200 font-bold" },
  cancelled: { label: "Annulée", cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

function InvBadge({ status }: { status: string }) {
  const s = INV_STATUS_MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── New payment dialog ───────────────────────────────────────────────────────

function NewPaymentDialog({ suppliers, onClose, onSuccess }: { suppliers: Supplier[]; onClose: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("virement");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: invRes } = useQuery<{ data: Invoice[] }>({
    queryKey: ["purchases-invoices-by-supplier", supplierId],
    queryFn: () => apiFetch(`/api/purchases/invoices?supplierId=${supplierId}&limit=50`),
    enabled: !!supplierId,
  });
  const unpaidInvoices = (invRes?.data ?? []).filter(i => !["paid", "cancelled"].includes(i.status));

  const selectedInv = unpaidInvoices.find(i => i.id === selectedInvoiceId);

  const handleSupplierChange = (v: string) => { setSupplierId(v); setSelectedInvoiceId(""); setAmount(""); };
  const handleInvoiceChange = (v: string) => {
    setSelectedInvoiceId(v);
    const inv = unpaidInvoices.find(i => i.id === v);
    if (inv) setAmount(String(inv.balance));
  };

  const handleSave = async () => {
    if (!selectedInvoiceId) { toast.error("Sélectionnez une facture"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/purchases/payments", {
        method: "POST",
        body: JSON.stringify({ supplierInvoiceId: selectedInvoiceId, amount: Number(amount), paymentMethod: method, reference: reference || undefined, paidAt, notes: notes || undefined }),
      });
      qc.invalidateQueries({ queryKey: ["purchases-invoices-by-supplier", supplierId] });
      toast.success("Paiement enregistré");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-[#F37021]" /> Enregistrer un paiement</DialogTitle>
          <DialogDescription>Sélectionnez le fournisseur et la facture à payer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Fournisseur *</Label>
            <Select value={supplierId} onValueChange={handleSupplierChange}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur…" /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {supplierId && (
            <div className="space-y-1">
              <Label>Facture à régler *</Label>
              {unpaidInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">Aucune facture impayée pour ce fournisseur.</p>
              ) : (
                <Select value={selectedInvoiceId} onValueChange={handleInvoiceChange}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une facture…" /></SelectTrigger>
                  <SelectContent>
                    {unpaidInvoices.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.referenceNumber} — {formatFCFA(inv.balance)} restant{inv.isOverdue ? " ⚠️" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {selectedInv && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
              <p className="font-medium">{selectedInv.referenceNumber}</p>
              <p className="text-muted-foreground">Total : {formatFCFA(Number(selectedInv.totalAmount))} · Déjà payé : {formatFCFA(Number(selectedInv.paidAmount))}</p>
              <p className="text-amber-700 font-medium">Reste dû : {formatFCFA(selectedInv.balance)}</p>
              {selectedInv.dueDate && <p className={`text-xs ${selectedInv.isOverdue ? "text-red-600" : "text-muted-foreground"}`}>Échéance : {formatDate(selectedInv.dueDate)}</p>}
            </div>
          )}

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
          <Button onClick={handleSave} disabled={saving || !selectedInvoiceId} className="bg-[#F37021] hover:bg-[#d96318] text-white">{saving ? "Enregistrement…" : "Valider le paiement"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatsPaiements() {
  const qc = useQueryClient();
  const [searchQ, setSearchQ] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [newOpen, setNewOpen] = useState(false);

  const { data: suppliersRes } = useQuery<{ data: Supplier[] }>({
    queryKey: ["purchases-suppliers-list"],
    queryFn: () => apiFetch("/api/purchases/suppliers?limit=200"),
  });
  const suppliers = suppliersRes?.data ?? [];

  const qParams: Record<string, string> = { limit: "100" };
  if (filterSupplier !== "all") qParams.supplierId = filterSupplier;

  const { data: res, isLoading } = useQuery<{ data: SupplierPayment[]; total: number }>({
    queryKey: ["purchases-payments", filterSupplier],
    queryFn: () => apiFetch("/api/purchases/payments?" + new URLSearchParams(qParams).toString()),
  });
  const payments = res?.data ?? [];

  const filtered = searchQ ? payments.filter(p =>
    (p.invoiceRef ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.supplierName ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.reference ?? "").toLowerCase().includes(searchQ.toLowerCase())
  ) : payments;

  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-payments"] });

  // "À payer cette semaine" — invoices due in next 7 days
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const { data: upcomingRes } = useQuery<{ data: Invoice[] }>({
    queryKey: ["purchases-invoices-upcoming"],
    queryFn: () => apiFetch("/api/purchases/invoices?limit=50"),
    select: (data: any) => ({
      data: (data.data ?? []).filter((i: Invoice) =>
        !["paid", "cancelled"].includes(i.status) && i.dueDate && i.dueDate >= today && i.dueDate <= weekEnd
      ),
    }),
  });
  const upcoming = upcomingRes?.data ?? [];
  const upcomingTotal = upcoming.reduce((s: number, i: Invoice) => s + i.balance, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Paiements fournisseurs"
        subtitle={`${res?.total ?? 0} paiement${(res?.total ?? 0) !== 1 ? "s" : ""}`}
        actions={<Button onClick={() => setNewOpen(true)} className="bg-[#F37021] hover:bg-[#d96318] text-white gap-2"><Plus className="w-4 h-4" />Nouveau paiement</Button>}
      />

      {/* À payer cette semaine */}
      {upcoming.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <Clock className="w-4 h-4" /> À payer cette semaine ({upcoming.length} facture{upcoming.length > 1 ? "s" : ""} · {formatFCFA(upcomingTotal)})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {upcoming.map((inv: Invoice) => (
                <div key={inv.id} className="flex items-center justify-between bg-white rounded p-3 text-sm border border-amber-100">
                  <div className="flex items-center gap-3">
                    {inv.isOverdue && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                    <div>
                      <span className="font-medium">{inv.referenceNumber}</span>
                      <span className="text-muted-foreground ml-2">· {inv.supplierName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-800">{formatFCFA(inv.balance)}</p>
                    <p className="text-xs text-muted-foreground">Échéance : {inv.dueDate ? formatDate(inv.dueDate) : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher facture, fournisseur, référence…" className="pl-9" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>
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
                <TableHead>Fournisseur</TableHead>
                <TableHead>Facture</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Aucun paiement enregistré.</TableCell></TableRow>
              )}
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.supplierName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.invoiceRef ?? "—"}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      <MethodIcon method={p.method} />
                      {METHODS[p.method] ?? p.method}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatFCFA(Number(p.amount))}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(p.paidAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {newOpen && (
        <NewPaymentDialog suppliers={suppliers} onClose={() => setNewOpen(false)} onSuccess={refresh} />
      )}
    </div>
  );
}
