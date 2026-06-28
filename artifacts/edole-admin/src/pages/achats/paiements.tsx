import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search, Wallet, AlertTriangle, Clock, Landmark, Smartphone, CreditCard, CheckCircle2 } from "lucide-react";
import { StatusBadgePayment, PAY_STATUS_MAP, PAYMENT_METHODS, VendorSelect, BankAccountSelect, type Supplier } from "./_shared";

// ─── Types ────────────────────────────────────────────────────────────────────

type Invoice = {
  id: string; referenceNumber: string; status: string;
  invoiceDate: string; dueDate: string | null;
  totalAmount: string | number; paidAmount: string | number;
  balance: number; isOverdue: boolean;
  supplierName: string | null;
};
type SupplierPayment = {
  id: string; amount: string | number; method: string; status: string;
  reference: string | null; paidAt: string; notes: string | null;
  bankAccountId: string | null; bankAccountName: string | null;
  supplierInvoiceId: string; invoiceRef: string | null;
  supplierId: string | null; supplierName: string | null;
};

// ─── Method icon ──────────────────────────────────────────────────────────────

function MethodIcon({ method }: { method: string }) {
  if (method === "virement") return <Landmark className="w-4 h-4 text-slate-400" />;
  if (method === "carte") return <CreditCard className="w-4 h-4 text-blue-400" />;
  if (["mixx", "flooz"].includes(method)) return <Smartphone className="w-4 h-4 text-amber-400" />;
  return <Wallet className="w-4 h-4 text-slate-400" />;
}

// ─── Multi-invoice payment dialog ─────────────────────────────────────────────

function NewPaymentDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [totalAmount, setTotalAmount] = useState("");
  const [method, setMethod] = useState("virement");
  const [bankAccountId, setBankAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState("confirme");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: invRes } = useQuery<{ data: Invoice[] }>({
    queryKey: ["purchases-invoices-by-supplier", supplierId],
    queryFn: () => apiFetch(`/api/purchases/invoices?supplierId=${supplierId}&limit=100`),
    enabled: !!supplierId,
  });
  const unpaidInvoices = (invRes?.data ?? [])
    .filter(i => !["paid", "cancelled"].includes(i.status) && i.balance > 0)
    .sort((a, b) => (a.dueDate ?? a.invoiceDate).localeCompare(b.dueDate ?? b.invoiceDate));

  const handleSupplierChange = (v: string) => { setSupplierId(v); setSelectedIds(new Set()); setTotalAmount(""); };

  const toggleInvoice = (id: string, balance: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); }
    setSelectedIds(newSet);
    // Auto-sum selected balances
    const sum = unpaidInvoices.filter(i => newSet.has(i.id)).reduce((s, i) => s + i.balance, 0);
    setTotalAmount(String(sum));
  };

  const selectAll = () => {
    if (selectedIds.size === unpaidInvoices.length) {
      setSelectedIds(new Set()); setTotalAmount("");
    } else {
      const all = new Set(unpaidInvoices.map(i => i.id));
      setSelectedIds(all);
      setTotalAmount(String(unpaidInvoices.reduce((s, i) => s + i.balance, 0)));
    }
  };

  const handleSave = async () => {
    if (!supplierId) { toast.error("Sélectionnez un fournisseur"); return; }
    if (selectedIds.size === 0) { toast.error("Sélectionnez au moins une facture"); return; }
    if (!totalAmount || Number(totalAmount) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      if (selectedIds.size === 1) {
        const [invoiceId] = selectedIds;
        await apiFetch("/api/purchases/payments", {
          method: "POST",
          body: JSON.stringify({
            supplierInvoiceId: invoiceId, amount: Number(totalAmount), paymentMethod: method,
            bankAccountId: bankAccountId || undefined, reference: reference || undefined,
            paidAt, paymentStatus, notes: notes || undefined,
          }),
        });
      } else {
        await apiFetch("/api/purchases/payments/multi", {
          method: "POST",
          body: JSON.stringify({
            supplierId, invoiceIds: Array.from(selectedIds), totalAmount: Number(totalAmount),
            paymentMethod: method, bankAccountId: bankAccountId || undefined,
            reference: reference || undefined, paidAt, paymentStatus,
            notes: notes || undefined,
          }),
        });
      }
      qc.invalidateQueries({ queryKey: ["purchases-invoices-by-supplier", supplierId] });
      toast.success(selectedIds.size > 1 ? `Paiement réparti sur ${selectedIds.size} factures` : "Paiement enregistré");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  const selectedTotal = unpaidInvoices.filter(i => selectedIds.has(i.id)).reduce((s, i) => s + i.balance, 0);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-[#F37021]" /> Enregistrer un paiement</DialogTitle>
          <DialogDescription>Sélectionnez le fournisseur et les factures à régler.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Fournisseur *</Label>
            <VendorSelect value={supplierId} onValueChange={handleSupplierChange} />
          </div>

          {supplierId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Factures à régler ({unpaidInvoices.length})</Label>
                {unpaidInvoices.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={selectAll} className="text-xs">{selectedIds.size === unpaidInvoices.length ? "Tout désélectionner" : "Tout sélectionner"}</Button>}
              </div>
              {unpaidInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucune facture impayée.</p>
              ) : (
                <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                  {unpaidInvoices.map(inv => (
                    <div key={inv.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 ${selectedIds.has(inv.id) ? "bg-orange-50" : ""}`} onClick={() => toggleInvoice(inv.id, inv.balance)}>
                      <Checkbox checked={selectedIds.has(inv.id)} onCheckedChange={() => toggleInvoice(inv.id, inv.balance)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-medium">{inv.referenceNumber}</p>
                        {inv.dueDate && <p className={`text-xs ${inv.isOverdue ? "text-red-600" : "text-muted-foreground"}`}>Échéance : {formatDate(inv.dueDate)}{inv.isOverdue ? " ⚠️" : ""}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-amber-700">{formatFCFA(inv.balance)}</p>
                        <p className="text-xs text-muted-foreground">Total : {formatFCFA(Number(inv.totalAmount))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedIds.size > 0 && (
                <div className="text-sm text-right text-muted-foreground">
                  {selectedIds.size} facture{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""} · Total dû : <strong className="text-amber-700">{formatFCFA(selectedTotal)}</strong>
                  {selectedIds.size > 1 && <p className="text-xs">Répartition automatique sur les plus anciennes en premier</p>}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Montant total à payer (FCFA) *</Label>
              <Input type="number" min="1" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="Paiement partiel possible" />
            </div>
            <div className="space-y-1">
              <Label>Mode de paiement</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Compte bancaire source</Label>
              <BankAccountSelect value={bankAccountId} onValueChange={setBankAccountId} />
            </div>
            <div className="space-y-1">
              <Label>Référence de paiement</Label>
              <Input placeholder="VIR-2026-001" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirme">Confirmé (débite solde)</SelectItem>
                  <SelectItem value="programme">Programmé (futur)</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || selectedIds.size === 0} className="bg-[#F37021] hover:bg-[#d96318] text-white">{saving ? "Enregistrement…" : "Valider le paiement"}</Button>
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
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [newOpen, setNewOpen] = useState(false);

  const { data: suppliersRes } = useQuery<{ data: Supplier[] }>({
    queryKey: ["purchases-suppliers-list"],
    queryFn: () => apiFetch("/api/purchases/suppliers?limit=200"),
    staleTime: 60_000,
  });
  const suppliers = suppliersRes?.data ?? [];

  const qParams: Record<string, string> = { limit: "100" };
  if (filterSupplier !== "all") qParams.supplierId = filterSupplier;
  if (filterStatus !== "all") qParams.status = filterStatus;
  if (filterMethod !== "all") qParams.method = filterMethod;

  const { data: res, isLoading } = useQuery<{ data: SupplierPayment[]; total: number }>({
    queryKey: ["purchases-payments", filterSupplier, filterStatus, filterMethod],
    queryFn: () => apiFetch("/api/purchases/payments?" + new URLSearchParams(qParams).toString()),
  });
  const payments = res?.data ?? [];

  const filtered = searchQ ? payments.filter(p =>
    (p.invoiceRef ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.supplierName ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.reference ?? "").toLowerCase().includes(searchQ.toLowerCase())
  ) : payments;

  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-payments"] });

  // "À payer cette semaine" — sorted by urgency: overdue first, then by dueDate ASC
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const { data: upcomingRes } = useQuery<{ data: Invoice[] }>({
    queryKey: ["purchases-invoices-upcoming"],
    queryFn: () => apiFetch("/api/purchases/invoices?limit=100"),
    select: (data: any): { data: Invoice[] } => ({
      data: ((data as any).data ?? [] as Invoice[])
        .filter((i: Invoice) => !["paid", "cancelled"].includes(i.status) && i.balance > 0 && i.dueDate && i.dueDate <= weekEnd)
        .sort((a: Invoice, b: Invoice) => {
          // Overdue first, then by dueDate ASC
          if (a.isOverdue && !b.isOverdue) return -1;
          if (!a.isOverdue && b.isOverdue) return 1;
          return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
        }),
    }),
  });
  const upcoming = upcomingRes?.data ?? [];
  const upcomingTotal = upcoming.reduce((s, i) => s + i.balance, 0);

  // Confirm a scheduled payment
  const confirmPayment = async (id: string) => {
    try {
      await apiFetch(`/api/purchases/payments/${id}/confirm`, { method: "PATCH" });
      toast.success("Paiement confirmé");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  return (
    <div className="p-6 space-y-5">
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
              <Clock className="w-4 h-4" /> À payer cette semaine — {upcoming.length} facture{upcoming.length > 1 ? "s" : ""} · {formatFCFA(upcomingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {upcoming.map((inv) => (
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
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" className="pl-9" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous fournisseurs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous fournisseurs</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tous statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(PAY_STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tous modes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous modes</SelectItem>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                <TableHead>Compte</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6,7,8,9].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Aucun paiement enregistré.</TableCell></TableRow>
              )}
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.supplierName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.invoiceRef ?? "—"}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      <MethodIcon method={p.method} />
                      {PAYMENT_METHODS[p.method] ?? p.method}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.bankAccountName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatFCFA(Number(p.amount))}</TableCell>
                  <TableCell><StatusBadgePayment status={p.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(p.paidAt)}</TableCell>
                  <TableCell>
                    {["programme", "en_attente"].includes(p.status) && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => confirmPayment(p.id)} title="Confirmer le paiement">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {newOpen && (
        <NewPaymentDialog onClose={() => setNewOpen(false)} onSuccess={refresh} />
      )}
    </div>
  );
}
