import React, { useState, useEffect } from "react";
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
import { Plus, Search, Wallet, AlertTriangle, Clock, Landmark, Smartphone, CreditCard, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadgePayment, PAY_STATUS_MAP, PAYMENT_METHODS, BankAccountSelect, type Supplier } from "./_shared";

// ─── Types ────────────────────────────────────────────────────────────────────

type Invoice = {
  id: string; referenceNumber: string; status: string;
  invoiceDate: string; dueDate: string | null;
  totalAmount: string | number; paidAmount: string | number;
  balance: number; isOverdue: boolean; supplierName: string | null;
};
type SupplierPayment = {
  id: string; amount: string | number; method: string; status: string;
  reference: string | null; paidAt: string; notes: string | null;
  bankAccountId: string | null; bankAccountName: string | null;
  supplierInvoiceId: string; invoiceRef: string | null;
  supplierId: string | null; supplierName: string | null;
};

const PAGE_SIZE = 25;

// ─── Method icon ──────────────────────────────────────────────────────────────

function MethodIcon({ method }: { method: string }) {
  if (method === "virement") return <Landmark className="w-4 h-4 text-slate-400" />;
  if (method === "carte") return <CreditCard className="w-4 h-4 text-blue-400" />;
  if (["mixx", "flooz"].includes(method)) return <Smartphone className="w-4 h-4 text-amber-400" />;
  return <Wallet className="w-4 h-4 text-slate-400" />;
}

// ─── Per-supplier invoice selector ────────────────────────────────────────────

function SupplierInvoiceSection({
  supplierId, supplierName, selectedIds, onToggle,
}: { supplierId: string; supplierName: string; selectedIds: Set<string>; onToggle: (id: string, balance: number) => void }) {
  const { data: invRes } = useQuery<{ data: Invoice[] }>({
    queryKey: ["purchases-invoices-by-supplier", supplierId],
    queryFn: () => apiFetch(`/api/purchases/invoices?supplierId=${supplierId}&limit=100`),
  });
  const unpaid = (invRes?.data ?? [])
    .filter(i => !["paid", "cancelled", "rejected"].includes(i.status) && i.balance > 0)
    .sort((a, b) => (a.dueDate ?? a.invoiceDate).localeCompare(b.dueDate ?? b.invoiceDate));

  if (!invRes) return <p className="text-xs text-muted-foreground px-3 py-1">Chargement…</p>;
  if (unpaid.length === 0) return <p className="text-xs text-muted-foreground italic px-3 py-1">Aucune facture impayée.</p>;
  return (
    <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
      {unpaid.map(inv => (
        <div key={inv.id} className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-slate-50 ${selectedIds.has(inv.id) ? "bg-orange-50" : ""}`}
          onClick={() => onToggle(inv.id, inv.balance)}>
          <Checkbox checked={selectedIds.has(inv.id)} onCheckedChange={() => onToggle(inv.id, inv.balance)} />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs font-medium">{inv.referenceNumber}</p>
            {inv.dueDate && <p className={`text-xs ${inv.isOverdue ? "text-red-600" : "text-muted-foreground"}`}>Éch. {formatDate(inv.dueDate)}{inv.isOverdue ? " ⚠️" : ""}</p>}
          </div>
          <p className="font-semibold text-xs text-amber-700 shrink-0">{formatFCFA(inv.balance)}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Multi-supplier payment dialog ─────────────────────────────────────────────

function NewPaymentDialog({ onClose, onSuccess, allSuppliers }: { onClose: () => void; onSuccess: () => void; allSuppliers: Supplier[] }) {
  const qc = useQueryClient();

  // Step 1: choose suppliers (multi). Step 2: choose invoices + amounts.
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  // Map supplierId → Set<invoiceId>
  const [selectedInvoices, setSelectedInvoices] = useState<Map<string, Set<string>>>(new Map());
  // Map supplierId → amount string
  const [amounts, setAmounts] = useState<Map<string, string>>(new Map());

  const [method, setMethod] = useState("virement");
  const [bankAccountId, setBankAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState("confirme");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");

  const filteredSuppliers = allSuppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const toggleSupplier = (id: string) => {
    const next = new Set(selectedSupplierIds);
    if (next.has(id)) { next.delete(id); selectedInvoices.delete(id); amounts.delete(id); }
    else next.add(id);
    setSelectedSupplierIds(next);
  };

  const toggleInvoice = (supplierId: string, invoiceId: string, balance: number) => {
    const newMap = new Map(selectedInvoices);
    const set = new Set(newMap.get(supplierId) ?? []);
    if (set.has(invoiceId)) set.delete(invoiceId); else set.add(invoiceId);
    newMap.set(supplierId, set);
    setSelectedInvoices(newMap);
    // Auto-sum amount for this supplier
    // We compute sum outside via the query cache — just flag for user to confirm
    const newAmt = new Map(amounts);
    if (set.size === 0) newAmt.delete(supplierId);
    setAmounts(newAmt);
  };

  const setSupplierAmount = (supplierId: string, val: string) => {
    const next = new Map(amounts);
    next.set(supplierId, val);
    setAmounts(next);
  };

  const totalInvoicesSelected = Array.from(selectedInvoices.values()).reduce((s, set) => s + set.size, 0);

  const handleSave = async () => {
    const suppliersToPay = Array.from(selectedSupplierIds).filter(sid => (selectedInvoices.get(sid)?.size ?? 0) > 0);
    if (suppliersToPay.length === 0) { toast.error("Sélectionnez au moins une facture"); return; }
    const invalidAmt = suppliersToPay.find(sid => !amounts.get(sid) || Number(amounts.get(sid)) <= 0);
    if (invalidAmt) { toast.error("Renseignez le montant pour chaque fournisseur sélectionné"); return; }

    setSaving(true);
    try {
      let paymentsCreated = 0;
      for (const sid of suppliersToPay) {
        const invoiceIds = Array.from(selectedInvoices.get(sid)!);
        const amt = Number(amounts.get(sid));
        if (invoiceIds.length === 1) {
          await apiFetch("/api/purchases/payments", {
            method: "POST",
            body: JSON.stringify({
              supplierInvoiceId: invoiceIds[0], amount: amt, paymentMethod: method,
              bankAccountId: bankAccountId || undefined, reference: reference || undefined,
              paidAt, paymentStatus, notes: notes || undefined,
            }),
          });
        } else {
          await apiFetch("/api/purchases/payments/multi", {
            method: "POST",
            body: JSON.stringify({
              supplierId: sid, invoiceIds, totalAmount: amt,
              paymentMethod: method, bankAccountId: bankAccountId || undefined,
              reference: reference || undefined, paidAt, paymentStatus,
              notes: notes || undefined,
            }),
          });
        }
        paymentsCreated++;
        qc.invalidateQueries({ queryKey: ["purchases-invoices-by-supplier", sid] });
      }
      qc.invalidateQueries({ queryKey: ["purchases-invoices-upcoming"] });
      toast.success(paymentsCreated > 1 ? `${paymentsCreated} paiements enregistrés` : "Paiement enregistré");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  const selectedSuppliersInfo = allSuppliers.filter(s => selectedSupplierIds.has(s.id));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-[#2563EB]" /> Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Cochez un ou plusieurs fournisseurs à régler."
              : "Sélectionnez les factures et saisissez les montants par fournisseur."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 1 && (
            <>
              <div className="space-y-1">
                <Label>Rechercher un fournisseur</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-8 text-sm" placeholder="Nom du fournisseur…" value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} />
                </div>
              </div>
              <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                {filteredSuppliers.length === 0 && <p className="p-3 text-sm text-muted-foreground italic">Aucun fournisseur trouvé.</p>}
                {filteredSuppliers.map(s => (
                  <div key={s.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 ${selectedSupplierIds.has(s.id) ? "bg-orange-50" : ""}`}
                    onClick={() => toggleSupplier(s.id)}>
                    <Checkbox checked={selectedSupplierIds.has(s.id)} onCheckedChange={() => toggleSupplier(s.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{s.name}</p>
                      {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {selectedSupplierIds.size > 0 && (
                <p className="text-xs text-muted-foreground text-right">{selectedSupplierIds.size} fournisseur{selectedSupplierIds.size > 1 ? "s" : ""} sélectionné{selectedSupplierIds.size > 1 ? "s" : ""}</p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {/* Per-supplier invoice selection + amount */}
              {selectedSuppliersInfo.map(s => (
                <div key={s.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-sm">{s.name}</Label>
                    <span className="text-xs text-muted-foreground">Factures impayées</span>
                  </div>
                  <SupplierInvoiceSection
                    supplierId={s.id}
                    supplierName={s.name}
                    selectedIds={selectedInvoices.get(s.id) ?? new Set()}
                    onToggle={(id, balance) => toggleInvoice(s.id, id, balance)}
                  />
                  {(selectedInvoices.get(s.id)?.size ?? 0) > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Montant à payer à {s.name} (FCFA) *</Label>
                      <Input type="number" min="1" placeholder="Paiement partiel possible"
                        value={amounts.get(s.id) ?? ""}
                        onChange={e => setSupplierAmount(s.id, e.target.value)} />
                      {selectedInvoices.get(s.id)!.size > 1 && (
                        <p className="text-xs text-muted-foreground">Répartition automatique sur les factures les plus anciennes.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Shared payment options */}
              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Mode de paiement</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Date de paiement</Label><Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} /></div>
                <div className="space-y-1 col-span-2"><Label>Compte bancaire source</Label><BankAccountSelect value={bankAccountId} onValueChange={setBankAccountId} /></div>
                <div className="space-y-1"><Label>Référence</Label><Input placeholder="VIR-2026-001" value={reference} onChange={e => setReference(e.target.value)} /></div>
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
              <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          {step === 1 ? (
            <Button
              onClick={() => setStep(2)}
              disabled={selectedSupplierIds.size === 0}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Continuer ({selectedSupplierIds.size} fournisseur{selectedSupplierIds.size > 1 ? "s" : ""})
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>Retour</Button>
              <Button onClick={handleSave} disabled={saving || totalInvoicesSelected === 0} className="bg-primary hover:bg-primary/90 text-white">
                {saving ? "Enregistrement…" : `Valider ${selectedSuppliersInfo.length > 1 ? selectedSuppliersInfo.length + " paiements" : "le paiement"}`}
              </Button>
            </>
          )}
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
  const [page, setPage] = useState(0);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => { setPage(0); }, [filterSupplier, filterStatus, filterMethod]);

  const { data: suppliersRes } = useQuery<{ data: Supplier[] }>({
    queryKey: ["purchases-suppliers-list"],
    queryFn: () => apiFetch("/api/purchases/suppliers?limit=200"),
    staleTime: 60_000,
  });
  const suppliers = suppliersRes?.data ?? [];

  const qParams: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) };
  if (filterSupplier !== "all") qParams.supplierId = filterSupplier;
  if (filterStatus !== "all") qParams.status = filterStatus;
  if (filterMethod !== "all") qParams.method = filterMethod;

  const { data: res, isLoading } = useQuery<{ data: SupplierPayment[]; total: number }>({
    queryKey: ["purchases-payments", filterSupplier, filterStatus, filterMethod, page],
    queryFn: () => apiFetch("/api/purchases/payments?" + new URLSearchParams(qParams).toString()),
  });
  const payments = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtered = searchQ ? payments.filter(p =>
    (p.invoiceRef ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.supplierName ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.reference ?? "").toLowerCase().includes(searchQ.toLowerCase())
  ) : payments;

  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-payments"] });

  // "À payer cette semaine" — overdue first, then by dueDate
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const { data: upcomingRes } = useQuery<{ data: Invoice[] }>({
    queryKey: ["purchases-invoices-upcoming"],
    queryFn: () => apiFetch("/api/purchases/invoices?limit=100"),
    select: (data: any): { data: Invoice[] } => ({
      data: ((data as any).data ?? [] as Invoice[])
        .filter((i: Invoice) => !["paid", "cancelled", "rejected"].includes(i.status) && i.balance > 0 && i.dueDate && i.dueDate <= weekEnd)
        .sort((a: Invoice, b: Invoice) => {
          if (a.isOverdue && !b.isOverdue) return -1;
          if (!a.isOverdue && b.isOverdue) return 1;
          return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
        }),
    }),
  });
  const upcoming = upcomingRes?.data ?? [];
  const upcomingTotal = upcoming.reduce((s, i) => s + i.balance, 0);

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
        subtitle={`${total} paiement${total !== 1 ? "s" : ""}`}
        actions={<Button onClick={() => setNewOpen(true)} className="bg-primary hover:bg-primary/90 text-white gap-2"><Plus className="w-4 h-4" />Nouveau paiement</Button>}
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
              {upcoming.map(inv => (
                <div key={inv.id} className="flex items-center justify-between bg-white rounded p-3 text-sm border border-amber-100">
                  <div className="flex items-center gap-3">
                    {inv.isOverdue && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                    <div>
                      <span className="font-medium">{inv.referenceNumber}</span>
                      {inv.supplierName && <span className="text-muted-foreground ml-2">· {inv.supplierName}</span>}
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
        {(filterSupplier !== "all" || filterStatus !== "all" || filterMethod !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterSupplier("all"); setFilterStatus("all"); setFilterMethod("all"); }}>Effacer</Button>
        )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} / {totalPages} ({total} résultats)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="gap-1"><ChevronLeft className="w-4 h-4" />Précédent</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="gap-1">Suivant<ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {newOpen && <NewPaymentDialog onClose={() => setNewOpen(false)} onSuccess={refresh} allSuppliers={suppliers} />}
    </div>
  );
}
