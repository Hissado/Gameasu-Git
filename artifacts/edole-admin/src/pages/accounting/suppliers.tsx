import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Receipt, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Supplier = { id: string; code: string; name: string; email?: string; phone?: string; isActive: boolean };
type Account = { id: string; code: string; label: string; classNum: number };
type SInv = { id: string; referenceNumber: string; supplierId: string; supplierName?: string; status: string; invoiceDate: string; dueDate?: string; totalAmount: number; paidAmount: number; currency?: string };

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openSupplier, setOpenSupplier] = useState(false);
  const [openInv, setOpenInv] = useState(false);
  const [openPayment, setOpenPayment] = useState<string | null>(null);

  const { data: suppliers } = useQuery<{ data: Supplier[] }>({ queryKey: ["suppliers"], queryFn: () => apiFetch("/api/accounting/suppliers") });
  const { data: invoices } = useQuery<{ data: SInv[] }>({ queryKey: ["supplier-invoices"], queryFn: () => apiFetch("/api/accounting/supplier-invoices") });
  const { data: aging } = useQuery<{ buckets: Record<string, any[]>; totals: Record<string, number>; total: number }>({ queryKey: ["aging-suppliers"], queryFn: () => apiFetch("/api/accounting/aging/suppliers") });
  const { data: accounts } = useQuery<{ data: Account[] }>({ queryKey: ["chart-of-accounts-list"], queryFn: () => apiFetch("/api/accounting/chart-of-accounts") });
  const { data: banks } = useQuery<{ data: any[] }>({ queryKey: ["bank-accounts"], queryFn: () => apiFetch("/api/accounting/bank-accounts") });

  const expenseAccounts = accounts?.data.filter((a) => a.classNum === 6) ?? [];

  const [supplierForm, setSupplierForm] = useState({ name: "", email: "", phone: "", address: "", taxId: "", paymentTerms: "" });
  const [invForm, setInvForm] = useState({ supplierId: "", invoiceDate: new Date().toISOString().slice(0, 10), dueDate: "", totalAmount: "", expenseAccountId: "", notes: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "transfer", bankAccountId: "", reference: "" });

  const createSupplier = useMutation({
    mutationFn: () => apiFetch("/api/accounting/suppliers", { method: "POST", body: JSON.stringify(supplierForm) }),
    onSuccess: () => { toast({ title: "Fournisseur créé" }); setOpenSupplier(false); setSupplierForm({ name: "", email: "", phone: "", address: "", taxId: "", paymentTerms: "" }); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
  });

  const createInv = useMutation({
    mutationFn: () => apiFetch("/api/accounting/supplier-invoices", { method: "POST", body: JSON.stringify({ ...invForm, totalAmount: Number(invForm.totalAmount) }) }),
    onSuccess: () => { toast({ title: "Facture fournisseur enregistrée — écriture comptable générée" }); setOpenInv(false); setInvForm({ supplierId: "", invoiceDate: new Date().toISOString().slice(0, 10), dueDate: "", totalAmount: "", expenseAccountId: "", notes: "" }); qc.invalidateQueries({ queryKey: ["supplier-invoices"] }); qc.invalidateQueries({ queryKey: ["aging-suppliers"] }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const createPayment = useMutation({
    mutationFn: () => apiFetch("/api/accounting/supplier-payments", { method: "POST", body: JSON.stringify({
      supplierInvoiceId: openPayment,
      amount: Number(paymentForm.amount),
      method: paymentForm.method,
      bankAccountId: paymentForm.bankAccountId || undefined,
      reference: paymentForm.reference,
    })}),
    onSuccess: () => { toast({ title: "Règlement enregistré — écriture comptable générée" }); setOpenPayment(null); setPaymentForm({ amount: "", method: "transfer", bankAccountId: "", reference: "" }); qc.invalidateQueries({ queryKey: ["supplier-invoices"] }); qc.invalidateQueries({ queryKey: ["aging-suppliers"] }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <AccountingShell
      title="Fournisseurs"
      subtitle="Tiers fournisseurs, factures d'achat et règlements"
      actions={<>
        <Button variant="outline" onClick={() => setOpenSupplier(true)}><Building2 className="w-4 h-4 mr-2" />Nouveau fournisseur</Button>
        <Button onClick={() => setOpenInv(true)} className="bg-amber-600 hover:bg-amber-700"><Receipt className="w-4 h-4 mr-2" />Saisir facture</Button>
      </>}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Total dettes</div><div className="text-xl font-bold mt-1">{formatFCFA(aging?.total ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Fournisseurs actifs</div><div className="text-xl font-bold mt-1">{suppliers?.data.filter((s) => s.isActive).length ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Factures ouvertes</div><div className="text-xl font-bold mt-1">{invoices?.data.filter((i) => i.status !== "paid").length ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Échéances + 30j</div><div className="text-xl font-bold mt-1 text-red-600">{formatFCFA((aging?.totals?.d31_60 ?? 0) + (aging?.totals?.d61_90 ?? 0) + (aging?.totals?.d90_plus ?? 0))}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b font-bold bg-slate-50">Liste des fournisseurs</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Nom</th>
                  <th className="text-left p-3">Contact</th>
                  <th className="text-left p-3">État</th>
                </tr>
              </thead>
              <tbody>
                {suppliers?.data.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground italic">Aucun fournisseur</td></tr>}
                {suppliers?.data.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-slate-50">
                    <td className="p-3 font-mono">{s.code}</td>
                    <td className="p-3 font-semibold">{s.name}</td>
                    <td className="p-3 text-xs">{s.email ?? s.phone ?? "—"}</td>
                    <td className="p-3"><Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Actif" : "Inactif"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b font-bold bg-slate-50">Factures fournisseurs</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Référence</th>
                  <th className="text-left p-3">Fournisseur</th>
                  <th className="text-right p-3">Montant</th>
                  <th className="text-left p-3">État</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {invoices?.data.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground italic">Aucune facture</td></tr>}
                {invoices?.data.map((inv) => (
                  <tr key={inv.id} className="border-t hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{inv.referenceNumber}</td>
                    <td className="p-3">{inv.supplierName}</td>
                    <td className="p-3 text-right font-mono">
                      {formatFCFA(inv.totalAmount)}
                      {inv.paidAmount > 0 && <div className="text-xs text-emerald-600">Réglé : {formatFCFA(inv.paidAmount)}</div>}
                    </td>
                    <td className="p-3"><Badge variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"}>{inv.status}</Badge></td>
                    <td className="p-3 text-right">
                      {inv.status !== "paid" && (
                        <Button size="sm" variant="outline" onClick={() => { setOpenPayment(inv.id); setPaymentForm({ ...paymentForm, amount: String(inv.totalAmount - inv.paidAmount) }); }}>Régler</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Nouveau fournisseur */}
      <Dialog open={openSupplier} onOpenChange={setOpenSupplier}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau fournisseur</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Nom*</label><Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Email</label><Input value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Téléphone</label><Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></div>
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Adresse</label><Input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">N° contribuable</label><Input value={supplierForm.taxId} onChange={(e) => setSupplierForm({ ...supplierForm, taxId: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Conditions de paiement</label><Input value={supplierForm.paymentTerms} onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })} placeholder="ex: 30 jours net" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSupplier(false)}>Annuler</Button>
            <Button onClick={() => createSupplier.mutate()} disabled={!supplierForm.name || createSupplier.isPending} className="bg-amber-600 hover:bg-amber-700">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nouvelle facture fournisseur */}
      <Dialog open={openInv} onOpenChange={setOpenInv}>
        <DialogContent>
          <DialogHeader><DialogTitle>Saisir une facture fournisseur</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold mb-1 block">Fournisseur*</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={invForm.supplierId} onChange={(e) => setInvForm({ ...invForm, supplierId: e.target.value })}>
                <option value="">—</option>
                {suppliers?.data.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-semibold mb-1 block">Date facture</label><Input type="date" value={invForm.invoiceDate} onChange={(e) => setInvForm({ ...invForm, invoiceDate: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Échéance</label><Input type="date" value={invForm.dueDate} onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })} /></div>
            <div><label className="text-xs font-semibold mb-1 block">Montant TTC (FCFA)*</label><Input type="number" value={invForm.totalAmount} onChange={(e) => setInvForm({ ...invForm, totalAmount: e.target.value })} /></div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Compte de charge</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={invForm.expenseAccountId} onChange={(e) => setInvForm({ ...invForm, expenseAccountId: e.target.value })}>
                <option value="">605 par défaut</option>
                {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Notes</label><Input value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Une écriture sera générée automatiquement dans le journal ACH (charge / fournisseur).</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenInv(false)}>Annuler</Button>
            <Button onClick={() => createInv.mutate()} disabled={!invForm.supplierId || !invForm.totalAmount || createInv.isPending} className="bg-amber-600 hover:bg-amber-700">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paiement fournisseur */}
      <Dialog open={!!openPayment} onOpenChange={() => setOpenPayment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Régler la facture fournisseur</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold mb-1 block">Montant*</label><Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Mode</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                <option value="transfer">Virement</option>
                <option value="check">Chèque</option>
                <option value="cash">Espèces</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold mb-1 block">Compte trésorerie</label>
              <select className="border rounded h-9 px-2 text-sm w-full" value={paymentForm.bankAccountId} onChange={(e) => setPaymentForm({ ...paymentForm, bankAccountId: e.target.value })}>
                <option value="">— Choisir —</option>
                {banks?.data.map((b: any) => <option key={b.id} value={b.id}>{b.name} ({b.accountCode})</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="text-xs font-semibold mb-1 block">Référence</label><Input value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPayment(null)}>Annuler</Button>
            <Button onClick={() => createPayment.mutate()} disabled={!paymentForm.amount || createPayment.isPending} className="bg-amber-600 hover:bg-amber-700">Régler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}
