import React, { useState, useEffect } from "react";
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
import {
  Plus, Search, AlertTriangle, FileText, Wallet, CheckCircle2, XCircle,
  ChevronRight, AlertCircle, Download, Link2, Trash2, ChevronLeft,
  ThumbsDown, Clock, CircleDot,
} from "lucide-react";
import { StatusBadgePurchases, INV_STATUS_MAP, INV_STATUS_ORDER, PAYMENT_METHODS, VendorSelect, BankAccountSelect, type Supplier } from "./_shared";

// ─── Types ────────────────────────────────────────────────────────────────────

type Invoice = {
  id: string; referenceNumber: string; status: string;
  invoiceDate: string; dueDate: string | null;
  totalAmount: string | number; taxAmount: string | number; paidAmount: string | number;
  currency: string; notes: string | null;
  supplierId: string; supplierName: string | null; supplierCode: string | null;
  purchaseOrderId: string | null; projectId: string | null;
  balance: number; isOverdue: boolean; createdAt: string;
};
type InvoiceLine = {
  id?: string; description: string; quantity: number;
  unitPriceFcfa: number; taxRate: number;
};
type StatusHistoryEntry = { from: string; to: string; at: string; userId: string };
type InvoiceDetail = Invoice & {
  supplierEmail: string | null; supplierPhone: string | null;
  expenseAccountId: string | null;
  purchaseOrderReference: string | null;
  statusHistory: StatusHistoryEntry[];
  payments: PaymentRecord[];
};
type PaymentRecord = {
  id: string; amount: string | number; method: string; status: string;
  reference: string | null; paidAt: string; notes: string | null;
  bankAccountId: string | null; bankAccountName: string | null;
};
type PO = { id: string; reference: string; supplierName: string | null; totalFcfa: string };

const PAGE_SIZE = 25;

// ─── Status timeline (réel + paiements) ──────────────────────────────────────

const STATUS_LABEL_FULL: Record<string, string> = {
  draft: "Brouillon",
  review: "À revoir",
  awaiting_approval: "En attente d'approbation",
  approved: "Approuvée",
  pending: "À payer",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
  rejected: "Refusée",
};

function StatusTimeline({ inv }: { inv: InvoiceDetail }) {
  type Event = { label: string; date: string; icon: React.ReactNode; cls: string };

  // Combine persisted status history + payments
  const events: Event[] = [
    { label: "Facture créée", date: inv.createdAt, icon: <CircleDot className="w-3.5 h-3.5" />, cls: "text-blue-600" },
  ];

  // Real persisted status transitions
  (inv.statusHistory ?? []).forEach(h => {
    events.push({
      label: `Statut : ${STATUS_LABEL_FULL[h.from] ?? h.from} → ${STATUS_LABEL_FULL[h.to] ?? h.to}`,
      date: h.at,
      icon: h.to === "paid" ? <CheckCircle2 className="w-3.5 h-3.5" />
        : ["cancelled", "rejected"].includes(h.to) ? <XCircle className="w-3.5 h-3.5" />
        : <CircleDot className="w-3.5 h-3.5" />,
      cls: h.to === "paid" ? "text-emerald-700"
        : ["cancelled", "rejected"].includes(h.to) ? "text-red-600"
        : h.to === "approved" ? "text-teal-600"
        : "text-blue-500",
    });
  });

  // Payment events
  inv.payments.forEach(p => {
    events.push({
      label: `Paiement ${p.status === "confirme" ? "confirmé" : p.status === "programme" ? "programmé" : "en attente"} — ${formatFCFA(Number(p.amount))}`,
      date: p.paidAt,
      icon: <Wallet className="w-3.5 h-3.5" />,
      cls: p.status === "confirme" ? "text-emerald-600" : "text-amber-600",
    });
  });

  events.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className={`mt-0.5 shrink-0 ${e.cls}`}>{e.icon}</div>
          <div className="flex-1 flex justify-between">
            <span className="text-sm">{e.label}</span>
            <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Quick payment dialog ─────────────────────────────────────────────────────

function QuickPayDialog({ invoice, onClose, onSuccess }: { invoice: InvoiceDetail; onClose: () => void; onSuccess: () => void }) {
  const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const [amount, setAmount] = useState(String(Math.max(0, remaining)));
  const [method, setMethod] = useState("virement");
  const [bankAccountId, setBankAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState("confirme");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/purchases/payments", {
        method: "POST",
        body: JSON.stringify({
          supplierInvoiceId: invoice.id, amount: Number(amount), paymentMethod: method,
          bankAccountId: bankAccountId || undefined, reference: reference || undefined,
          paidAt, paymentStatus, notes: notes || undefined,
        }),
      });
      toast.success(paymentStatus === "confirme" ? "Paiement enregistré" : "Paiement programmé");
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
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Montant (FCFA) *</Label><Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Mode</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
            <div className="space-y-1"><Label>Référence</Label><Input placeholder="REF-001" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Compte bancaire source</Label><BankAccountSelect value={bankAccountId} onValueChange={setBankAccountId} /></div>
          <div className="space-y-1">
            <Label>Statut du paiement</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirme">Confirmé (débite le solde)</SelectItem>
                <SelectItem value="programme">Programmé (futur)</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
              </SelectContent>
            </Select>
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

// ─── Line editor (shared between new + edit) ──────────────────────────────────

function InvoiceLineEditor({ lines, onChange }: { lines: InvoiceLine[]; onChange: (l: InvoiceLine[]) => void }) {
  const addLine = () => onChange([...lines, { description: "", quantity: 1, unitPriceFcfa: 0, taxRate: 18 }]);
  const removeLine = (i: number) => onChange(lines.filter((_, j) => j !== i));
  const update = (i: number, patch: Partial<InvoiceLine>) => onChange(lines.map((l, j) => j === i ? { ...l, ...patch } : l));
  const totalHt = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa, 0);
  const totalTtc = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (1 + l.taxRate / 100), 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Lignes de facture</Label>
        <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="w-3 h-3 mr-1" />Ajouter une ligne</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
              <th className="text-right p-2 font-medium text-muted-foreground w-16">Qté</th>
              <th className="text-right p-2 font-medium text-muted-foreground w-28">P.U. HT</th>
              <th className="text-right p-2 font-medium text-muted-foreground w-16">TVA%</th>
              <th className="text-right p-2 font-medium text-muted-foreground w-28">Total TTC</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={6} className="p-3 text-center text-muted-foreground text-xs italic">Aucune ligne — cliquez sur "Ajouter une ligne"</td></tr>
            )}
            {lines.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="p-1.5"><Input className="h-7 text-xs" value={l.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Description du service/produit" /></td>
                <td className="p-1.5"><Input className="h-7 text-xs text-right w-16" type="number" min="0.01" step="0.01" value={l.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} /></td>
                <td className="p-1.5"><Input className="h-7 text-xs text-right w-28" type="number" min="0" value={l.unitPriceFcfa} onChange={(e) => update(i, { unitPriceFcfa: Number(e.target.value) })} /></td>
                <td className="p-1.5"><Input className="h-7 text-xs text-right w-16" type="number" min="0" max="100" value={l.taxRate} onChange={(e) => update(i, { taxRate: Number(e.target.value) })} /></td>
                <td className="p-1.5 text-right text-xs font-medium">{formatFCFA(l.quantity * l.unitPriceFcfa * (1 + l.taxRate / 100))}</td>
                <td className="p-1.5"><Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => removeLine(i)}><Trash2 className="w-3 h-3" /></Button></td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-slate-50 border-t">
              <tr>
                <td colSpan={4} className="p-2 text-right text-xs font-medium text-muted-foreground">Total HT</td>
                <td className="p-2 text-right text-xs font-semibold">{formatFCFA(totalHt)}</td><td />
              </tr>
              <tr>
                <td colSpan={4} className="p-2 text-right text-xs font-medium text-muted-foreground">Total TTC</td>
                <td className="p-2 text-right text-xs font-bold">{formatFCFA(totalTtc)}</td><td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── New invoice dialog ───────────────────────────────────────────────────────

type Project = { id: string; name: string; code: string | null };

function NewInvoiceDialog({ prefill, onClose, onSuccess }: {
  prefill?: Partial<{ supplierId: string; referenceNumber: string; totalAmount: string; purchaseOrderId: string; lines: InvoiceLine[] }>;
  onClose: () => void; onSuccess: () => void;
}) {
  const [supplierId, setSupplierId] = useState(prefill?.supplierId ?? "");
  const [referenceNumber, setReferenceNumber] = useState(prefill?.referenceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>(prefill?.lines ?? []);
  const [notes, setNotes] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState(prefill?.purchaseOrderId ?? "");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [useLines, setUseLines] = useState((prefill?.lines?.length ?? 0) > 0 || !prefill?.totalAmount);
  // Manual totals fallback (when not using line editor)
  const [manualTotal, setManualTotal] = useState(prefill?.totalAmount ?? "");
  const [manualTax, setManualTax] = useState("0");

  const { data: projectsRes } = useQuery<{ data: Project[] }>({
    queryKey: ["projects-list-light"],
    queryFn: () => apiFetch("/api/projects?limit=100"),
    staleTime: 60_000,
  });

  const { data: posRes } = useQuery<{ data: PO[] }>({
    queryKey: ["purchases-pos-by-supplier", supplierId],
    queryFn: () => apiFetch(`/api/purchases/purchase-orders?supplierId=${supplierId}&limit=50`),
    enabled: !!supplierId,
  });
  const availablePos = posRes?.data ?? [];

  const totalHt = useLines ? lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa, 0) : Number(manualTotal) || 0;
  const totalTax = useLines ? lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (l.taxRate / 100), 0) : Number(manualTax) || 0;

  const handleSave = async () => {
    if (!supplierId) { toast.error("Sélectionnez un fournisseur"); return; }
    if (!referenceNumber) { toast.error("Le numéro de facture est requis"); return; }
    if (useLines && lines.some(l => !l.description)) { toast.error("Remplissez toutes les descriptions"); return; }
    if (!useLines && (!manualTotal || Number(manualTotal) <= 0)) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      const invoice = await apiFetch<{ id: string }>("/api/purchases/invoices", {
        method: "POST",
        body: JSON.stringify({
          supplierId, referenceNumber, invoiceDate, dueDate: dueDate || undefined,
          totalAmount: totalHt || 1, taxAmount: totalTax,
          notes: notes || undefined, purchaseOrderId: purchaseOrderId || undefined,
          projectId: projectId || undefined,
        }),
      });
      // Save lines if any
      if (useLines && lines.length > 0) {
        await apiFetch(`/api/purchases/invoices/${invoice.id}/lines`, {
          method: "POST", body: JSON.stringify({ lines }),
        });
      }
      toast.success("Facture créée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-[#F37021]" /> Nouvelle facture fournisseur</DialogTitle>
          <DialogDescription>Enregistrez une facture reçue d'un fournisseur.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Fournisseur *</Label>
            <VendorSelect value={supplierId} onValueChange={(v) => { setSupplierId(v); setPurchaseOrderId(""); }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>N° de facture *</Label><Input placeholder="FACT-2026-001" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} /></div>
            <div className="space-y-1"><Label>Date facture</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
            <div className="space-y-1 col-span-2"><Label>Date d'échéance</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>

          {supplierId && availablePos.length > 0 && (
            <div className="space-y-1">
              <Label>Bon de commande lié</Label>
              <Select value={purchaseOrderId || "_none"} onValueChange={(v) => setPurchaseOrderId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Aucun BC lié" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Aucun BC lié —</SelectItem>
                  {availablePos.map(p => <SelectItem key={p.id} value={p.id}>{p.reference} — {formatFCFA(Number(p.totalFcfa))}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Toggle between line editor and manual totals */}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={useLines ? "default" : "outline"} onClick={() => setUseLines(true)} className={useLines ? "bg-[#F37021] text-white" : ""}>Saisie par lignes</Button>
            <Button type="button" size="sm" variant={!useLines ? "default" : "outline"} onClick={() => setUseLines(false)} className={!useLines ? "bg-[#F37021] text-white" : ""}>Saisie par totaux</Button>
          </div>

          {useLines ? (
            <InvoiceLineEditor lines={lines} onChange={setLines} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Montant HT (FCFA) *</Label><Input type="number" min="0" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} /></div>
              <div className="space-y-1"><Label>TVA (FCFA)</Label><Input type="number" min="0" value={manualTax} onChange={(e) => setManualTax(e.target.value)} /></div>
            </div>
          )}

          {(totalHt > 0 || !useLines) && (
            <div className="bg-slate-50 rounded p-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total HT : <strong>{formatFCFA(totalHt)}</strong> · TVA : <strong>{formatFCFA(totalTax)}</strong></span>
              <span className="font-bold text-sm">TTC : {formatFCFA(totalHt + totalTax)}</span>
            </div>
          )}

          {/* Projet lié */}
          {projectsRes?.data && projectsRes.data.length > 0 && (
            <div className="space-y-1">
              <Label>Projet lié</Label>
              <Select value={projectId || "_none"} onValueChange={(v) => setProjectId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="— Aucun projet —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Aucun projet —</SelectItem>
                  {(projectsRes?.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

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

  const { data: linesRes } = useQuery<{ data: Array<{ id: string; description: string; quantity: string; unitPriceFcfa: string; taxRate: string; totalHt: string; totalTtc: string }> }>({
    queryKey: ["purchase-invoice-lines", invoiceId],
    queryFn: () => apiFetch(`/api/purchases/invoices/${invoiceId}/lines`),
    enabled: !!invoiceId,
  });
  const lines = linesRes?.data ?? [];

  const refresh = () => { qc.invalidateQueries({ queryKey: ["purchase-invoice-detail", invoiceId] }); qc.invalidateQueries({ queryKey: ["purchase-invoice-lines", invoiceId] }); onRefresh(); };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/purchases/invoices/${invoiceId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success("Statut mis à jour");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setUpdating(false); }
  };

  const canPay = inv && !["paid", "cancelled", "rejected"].includes(inv.status) && Number(inv.balance) > 0;
  const canApprove = inv && ["review", "awaiting_approval"].includes(inv.status);
  const canReject = inv && ["review", "awaiting_approval", "pending", "approved"].includes(inv.status);
  const canCancel = inv && !["paid", "cancelled", "rejected"].includes(inv.status);

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
          <div className="space-y-5 py-4">
            {/* Status + actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadgePurchases status={inv.status} />
              {inv.isOverdue && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs gap-1"><AlertTriangle className="w-3 h-3" /> En retard</Badge>}
              <div className="flex-1" />
              <div className="flex gap-2 flex-wrap">
                {inv.status === "review" && <Button size="sm" variant="outline" onClick={() => updateStatus("awaiting_approval")} disabled={updating} className="text-xs">Soumettre appro.</Button>}
                {canApprove && <Button size="sm" onClick={() => updateStatus("approved")} disabled={updating} className="bg-teal-600 hover:bg-teal-700 text-white gap-1 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Approuver</Button>}
                {inv.status === "approved" && <Button size="sm" variant="outline" onClick={() => updateStatus("pending")} disabled={updating} className="text-xs">Marquer À payer</Button>}
                {canPay && <Button size="sm" onClick={() => setPayOpen(true)} className="bg-[#F37021] hover:bg-[#d96318] text-white gap-1 text-xs"><Wallet className="w-3.5 h-3.5" />Payer</Button>}
                {canReject && <Button size="sm" variant="outline" onClick={() => updateStatus("rejected")} disabled={updating} className="text-red-600 border-red-200 hover:bg-red-50 gap-1 text-xs"><ThumbsDown className="w-3.5 h-3.5" />Refuser</Button>}
                {canCancel && <Button size="sm" variant="outline" onClick={() => updateStatus("cancelled")} disabled={updating} className="text-slate-600 border-slate-200 hover:bg-slate-50 gap-1 text-xs"><XCircle className="w-3.5 h-3.5" />Annuler</Button>}
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-4">
              <div><p className="text-xs text-muted-foreground">Fournisseur</p><p className="font-medium text-sm">{inv.supplierName ?? "—"}</p><p className="text-xs text-muted-foreground">{inv.supplierEmail ?? ""}</p></div>
              <div><p className="text-xs text-muted-foreground">Date facture</p><p className="font-medium text-sm">{formatDate(inv.invoiceDate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Échéance</p><p className={`font-medium text-sm ${inv.isOverdue ? "text-red-600" : ""}`}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Montant HT</p><p className="font-medium text-sm">{formatFCFA(Number(inv.totalAmount))}</p></div>
              <div><p className="text-xs text-muted-foreground">TVA</p><p className="font-medium text-sm">{formatFCFA(Number(inv.taxAmount))}</p></div>
              <div><p className="text-xs text-muted-foreground">Montant TTC</p><p className="font-semibold text-sm">{formatFCFA(Number(inv.totalAmount) + Number(inv.taxAmount))}</p></div>
              <div><p className="text-xs text-muted-foreground">Montant payé</p><p className="font-medium text-sm text-emerald-700">{formatFCFA(Number(inv.paidAmount))}</p></div>
              <div><p className="text-xs text-muted-foreground">Solde restant</p><p className={`font-semibold text-sm ${Number(inv.balance) > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatFCFA(Number(inv.balance))}</p></div>
              {inv.purchaseOrderId && <div className="col-span-2"><p className="text-xs text-muted-foreground">BC lié</p><p className="text-xs font-mono text-blue-600 flex items-center gap-1"><Link2 className="w-3 h-3" />{inv.purchaseOrderReference ?? inv.purchaseOrderId}</p></div>}
            </div>

            {inv.notes && <p className="text-sm text-muted-foreground italic bg-slate-50 rounded p-3">{inv.notes}</p>}

            {/* Invoice lines */}
            {lines.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Lignes ({lines.length})</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr>
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Description</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">Qté</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">P.U.</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">TVA%</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">Total TTC</th>
                    </tr></thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={l.id ?? i} className="border-t">
                          <td className="p-2">{l.description}</td>
                          <td className="p-2 text-right">{Number(l.quantity)}</td>
                          <td className="p-2 text-right">{formatFCFA(Number(l.unitPriceFcfa))}</td>
                          <td className="p-2 text-right">{Number(l.taxRate)}%</td>
                          <td className="p-2 text-right font-medium">{formatFCFA(Number(l.totalTtc))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment history */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Paiements ({inv.payments.length})</h3>
              {inv.payments.length === 0 && <p className="text-sm text-muted-foreground italic">Aucun paiement enregistré.</p>}
              <div className="space-y-2">
                {inv.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded p-3 text-sm">
                    <div>
                      <span className="font-medium">{formatFCFA(Number(p.amount))}</span>
                      <span className="text-muted-foreground ml-2">· {PAYMENT_METHODS[p.method] ?? p.method}</span>
                      {p.bankAccountName && <span className="text-muted-foreground ml-2">· {p.bankAccountName}</span>}
                      {p.reference && <span className="text-muted-foreground ml-2">· {p.reference}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "confirme" ? "bg-emerald-100 text-emerald-700" : p.status === "programme" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {p.status === "confirme" ? "Confirmé" : p.status === "programme" ? "Programmé" : p.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status history / timeline */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Clock className="w-4 h-4 text-muted-foreground" /> Historique</h3>
              <StatusTimeline inv={inv} />
            </div>
          </div>
        )}
        {payOpen && inv && <QuickPayDialog invoice={inv} onClose={() => setPayOpen(false)} onSuccess={refresh} />}
      </SheetContent>
    </Sheet>
  );
}

// ─── Excel export ─────────────────────────────────────────────────────────────

async function exportToExcel(params: Record<string, string>) {
  try {
    const qs = new URLSearchParams({ ...params, limit: "500", offset: "0" });
    const res = await apiFetch<{ data: Invoice[] }>(`/api/purchases/invoices?${qs}`);
    const rows = res.data ?? [];
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Factures fournisseurs");
    ws.columns = [
      { header: "Fournisseur", key: "supplierName", width: 25 },
      { header: "N° Facture", key: "referenceNumber", width: 20 },
      { header: "Date facture", key: "invoiceDate", width: 14 },
      { header: "Échéance", key: "dueDate", width: 14 },
      { header: "Retard", key: "isOverdue", width: 10 },
      { header: "Montant HT (FCFA)", key: "totalAmount", width: 18 },
      { header: "TVA (FCFA)", key: "taxAmount", width: 14 },
      { header: "Montant TTC (FCFA)", key: "totalTtc", width: 18 },
      { header: "Payé (FCFA)", key: "paidAmount", width: 14 },
      { header: "Solde (FCFA)", key: "balance", width: 14 },
      { header: "Statut", key: "status", width: 18 },
    ];
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF37021" } };
    rows.forEach(r => {
      const ht = Number(r.totalAmount);
      const tva = Number(r.taxAmount);
      ws.addRow({
        supplierName: r.supplierName ?? "", referenceNumber: r.referenceNumber,
        invoiceDate: r.invoiceDate, dueDate: r.dueDate ?? "",
        isOverdue: r.isOverdue ? "Oui" : "Non",
        totalAmount: ht, taxAmount: tva, totalTtc: ht + tva,
        paidAmount: Number(r.paidAmount), balance: r.balance,
        status: INV_STATUS_MAP[r.status]?.label ?? r.status,
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `factures-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} factures exportées`);
  } catch { toast.error("Erreur lors de l'export"); }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatsFactures() {
  const searchStr = useSearch();
  const urlParams = new URLSearchParams(searchStr);
  const fromBcId = urlParams.get("from_bc");

  const qc = useQueryClient();
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [page, setPage] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [bcPrefill, setBcPrefill] = useState<Partial<{ supplierId: string; totalAmount: string; purchaseOrderId: string; lines: InvoiceLine[] }> | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: projectsListRes } = useQuery<{ data: Project[] }>({
    queryKey: ["projects-list-light"],
    queryFn: () => apiFetch("/api/projects?limit=100"),
    staleTime: 60_000,
  });
  const projectsList = projectsListRes?.data ?? [];

  useEffect(() => {
    if (!fromBcId) return;
    apiFetch<any>(`/api/purchases/purchase-orders/${fromBcId}`)
      .then(po => {
        // Convert PO lines to invoice lines
        const prefillLines: InvoiceLine[] = (po.lines ?? []).map((l: any) => ({
          description: l.productName ?? l.description,
          quantity: Number(l.quantity),
          unitPriceFcfa: Number(l.unitPriceFcfa),
          taxRate: 18,
        }));
        setBcPrefill({ supplierId: po.supplierId, purchaseOrderId: po.id, lines: prefillLines });
        setNewOpen(true);
      })
      .catch(() => setNewOpen(true));
  }, [fromBcId]);

  // Reset to page 0 whenever filters change
  useEffect(() => { setPage(0); }, [filterStatus, filterSupplier, searchQ, dateFrom, dateTo, minAmount, maxAmount, filterOverdue, dueDateFrom, dueDateTo, filterProject]);

  const qParams: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) };
  if (filterStatus !== "all") qParams.status = filterStatus;
  else if (filterOverdue) qParams.status = "overdue";
  if (filterSupplier !== "all") qParams.supplierId = filterSupplier;
  if (filterProject !== "all") qParams.projectId = filterProject;
  if (searchQ) qParams.search = searchQ;
  if (dateFrom) qParams.dateFrom = dateFrom;
  if (dateTo) qParams.dateTo = dateTo;
  if (dueDateFrom) qParams.dueAfter = dueDateFrom;
  if (dueDateTo) qParams.dueBefore = dueDateTo;
  if (minAmount) qParams.minAmount = minAmount;
  if (maxAmount) qParams.maxAmount = maxAmount;

  const { data: res, isLoading } = useQuery<{ data: Invoice[]; total: number }>({
    queryKey: ["purchases-invoices", filterStatus, filterSupplier, searchQ, dateFrom, dateTo, minAmount, maxAmount, filterOverdue, dueDateFrom, dueDateTo, filterProject, page],
    queryFn: () => apiFetch("/api/purchases/invoices?" + new URLSearchParams(qParams).toString()),
  });
  const invoices = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const { data: suppliersRes } = useQuery<{ data: Supplier[] }>({
    queryKey: ["purchases-suppliers-list"],
    queryFn: () => apiFetch("/api/purchases/suppliers?limit=200"),
    staleTime: 60_000,
  });
  const suppliers = suppliersRes?.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-invoices"] });
  const overdue = invoices.filter(i => i.isOverdue).length;
  const totalUnpaid = invoices.filter(i => !["paid", "cancelled", "rejected"].includes(i.status)).reduce((s, i) => s + Number(i.balance), 0);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Factures fournisseurs"
        subtitle={`${total} facture${total !== 1 ? "s" : ""}${overdue ? ` · ${overdue} en retard` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToExcel(qParams)} className="gap-2"><Download className="w-4 h-4" />Exporter</Button>
            <Button onClick={() => { setBcPrefill(undefined); setNewOpen(true); }} className="bg-[#F37021] hover:bg-[#d96318] text-white gap-2"><Plus className="w-4 h-4" />Nouvelle facture</Button>
          </div>
        }
      />

      {totalUnpaid > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-800"><strong>{formatFCFA(totalUnpaid)}</strong> restant à payer sur {invoices.filter(i => !["paid","cancelled","rejected"].includes(i.status)).length} facture(s)</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" className="pl-9" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {INV_STATUS_ORDER.map(k => <SelectItem key={k} value={k}>{INV_STATUS_MAP[k]?.label ?? k}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tous fournisseurs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous fournisseurs</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input type="date" className="w-36 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Date facture du" />
          <span className="text-muted-foreground text-xs px-1">→</span>
          <Input type="date" className="w-36 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Date facture au" />
        </div>
        {/* Projet filter */}
        {projectsList.length > 0 && (
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tous projets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous projets</SelectItem>
              {projectsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {/* Date échéance filter */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs shrink-0">Éch.</span>
          <Input type="date" className="w-32 text-xs" value={dueDateFrom} onChange={(e) => setDueDateFrom(e.target.value)} title="Échéance du" />
          <span className="text-muted-foreground text-xs px-0.5">→</span>
          <Input type="date" className="w-32 text-xs" value={dueDateTo} onChange={(e) => setDueDateTo(e.target.value)} title="Échéance au" />
        </div>
        <div className="flex items-center gap-1">
          <Input type="number" min="0" className="w-28 text-xs" placeholder="Min FCFA" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} title="Montant minimum" />
          <span className="text-muted-foreground text-xs px-1">–</span>
          <Input type="number" min="0" className="w-28 text-xs" placeholder="Max FCFA" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} title="Montant maximum" />
        </div>
        <Button
          size="sm"
          variant={filterOverdue ? "default" : "outline"}
          onClick={() => setFilterOverdue(o => !o)}
          className={filterOverdue ? "bg-red-600 hover:bg-red-700 text-white gap-1" : "gap-1 text-red-600 border-red-200"}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> En retard
        </Button>
        {(filterStatus !== "all" || filterSupplier !== "all" || searchQ || dateFrom || dateTo || minAmount || maxAmount || filterOverdue || dueDateFrom || dueDateTo || filterProject !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterSupplier("all"); setSearchQ(""); setDateFrom(""); setDateTo(""); setMinAmount(""); setMaxAmount(""); setFilterOverdue(false); setDueDateFrom(""); setDueDateTo(""); setFilterProject("all"); }}>Effacer</Button>
        )}
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
                <TableHead>Retard</TableHead>
                <TableHead className="text-right">Montant HT</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3,4].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6,7,8,9,10].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && invoices.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Aucune facture trouvée.</TableCell></TableRow>
              )}
              {invoices.map(inv => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedId(inv.id)}>
                  <TableCell className="font-mono text-sm font-medium">{inv.referenceNumber}</TableCell>
                  <TableCell className="text-sm">{inv.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inv.invoiceDate)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</TableCell>
                  <TableCell>
                    {inv.isOverdue
                      ? <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 gap-1"><AlertTriangle className="w-3 h-3" />En retard</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatFCFA(Number(inv.totalAmount))}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatFCFA(Number(inv.paidAmount))}</TableCell>
                  <TableCell className={`text-right font-medium ${Number(inv.balance) > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatFCFA(Number(inv.balance))}</TableCell>
                  <TableCell><StatusBadgePurchases status={inv.status} /></TableCell>
                  <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
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

      {newOpen && <NewInvoiceDialog prefill={bcPrefill} onClose={() => { setNewOpen(false); setBcPrefill(undefined); }} onSuccess={refresh} />}
      {selectedId && <InvoiceDetailSheet invoiceId={selectedId} onClose={() => setSelectedId(null)} onRefresh={refresh} />}
    </div>
  );
}
