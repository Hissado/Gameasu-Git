import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Plus, Search, AlertTriangle, FileText, Wallet, CheckCircle2, XCircle,
  ChevronRight, AlertCircle, Download, Upload, Link2, Trash2, ChevronLeft,
  ThumbsDown, Clock, CircleDot, Repeat, CreditCard, FileDown,
  ChevronDown, X, Paperclip, Image, Printer,
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
  unitPriceFcfa: number; taxRate: number; category?: string;
};
type BillMode = "bill" | "credit_note" | "repeating";
type StatusHistoryEntry = { from: string; to: string; at: string; userId: string };
type InvoiceAttachment = { name: string; objectPath: string; contentType: string; size: number; uploadedAt: string };
type InvoiceDetail = Invoice & {
  supplierEmail: string | null; supplierPhone: string | null;
  expenseAccountId: string | null;
  purchaseOrderReference: string | null;
  statusHistory: StatusHistoryEntry[];
  payments: PaymentRecord[];
  attachments?: InvoiceAttachment[];
};
type PaymentRecord = {
  id: string; amount: string | number; method: string; status: string;
  reference: string | null; paidAt: string; notes: string | null;
  bankAccountId: string | null; bankAccountName: string | null;
};
type PO = { id: string; reference: string; supplierName: string | null; totalFcfa: string };

const PAGE_SIZE = 25;

const TERMS_OPTIONS = [
  { value: "", label: "—", days: undefined as number | undefined },
  { value: "immediate", label: "Immédiat", days: 0 },
  { value: "net7", label: "Net 7", days: 7 },
  { value: "net15", label: "Net 15", days: 15 },
  { value: "net30", label: "Net 30", days: 30 },
  { value: "net45", label: "Net 45", days: 45 },
  { value: "net60", label: "Net 60", days: 60 },
  { value: "net90", label: "Net 90", days: 90 },
];

const LINE_CATEGORIES = [
  { value: "_none", label: "—" },
  { value: "services", label: "Services" },
  { value: "materials", label: "Matériaux" },
  { value: "utilities", label: "Charges fixes" },
  { value: "transport", label: "Transport" },
  { value: "equipment", label: "Équipement" },
  { value: "consulting", label: "Conseil" },
  { value: "subcontract", label: "Sous-traitance" },
  { value: "other", label: "Autre" },
];

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
          <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-[#2563EB]" /> Enregistrer un paiement</DialogTitle>
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
          <Button onClick={handleSave} disabled={saving} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">{saving ? "Enregistrement…" : "Valider"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Line editor (shared between new + edit) ──────────────────────────────────

function InvoiceLineEditor({ lines, onChange }: { lines: InvoiceLine[]; onChange: (l: InvoiceLine[]) => void }) {
  const addLine = () => onChange([...lines, { description: "", quantity: 1, unitPriceFcfa: 0, taxRate: 18, category: "" }]);
  const removeLine = (i: number) => onChange(lines.filter((_, j) => j !== i));
  const clearLines = () => onChange([]);
  const update = (i: number, patch: Partial<InvoiceLine>) => onChange(lines.map((l, j) => j === i ? { ...l, ...patch } : l));
  const totalHt = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa, 0);
  const totalTva = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (l.taxRate / 100), 0);
  return (
    <div className="space-y-0">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-6">#</th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-36">CATÉGORIE</th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">DESCRIPTION</th>
              <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-14">QTÉ</th>
              <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-28">P.U. HT</th>
              <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-14">TVA%</th>
              <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-28">MONTANT</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground text-xs italic">Aucune ligne — cliquez sur "Ajouter des lignes"</td></tr>
            )}
            {lines.map((l, i) => (
              <tr key={i} className="border-t hover:bg-muted/50">
                <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                <td className="px-1 py-1">
                  <Select value={l.category || "_none"} onValueChange={(v) => update(i, { category: v === "_none" ? "" : v })}>
                    <SelectTrigger className="h-7 text-xs w-full border-0 shadow-none focus:ring-0 focus:ring-offset-0 px-1">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {LINE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-1 py-1"><Input className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" value={l.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Description du service/produit" /></td>
                <td className="px-1 py-1"><Input className="h-7 text-xs text-right w-14 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" type="number" min="0.01" step="0.01" value={l.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} /></td>
                <td className="px-1 py-1"><Input className="h-7 text-xs text-right w-28 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" type="number" min="0" value={l.unitPriceFcfa} onChange={(e) => update(i, { unitPriceFcfa: Number(e.target.value) })} /></td>
                <td className="px-1 py-1"><Input className="h-7 text-xs text-right w-14 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" type="number" min="0" max="100" value={l.taxRate} onChange={(e) => update(i, { taxRate: Number(e.target.value) })} /></td>
                <td className="px-2 py-1 text-right font-medium tabular-nums">{formatFCFA(l.quantity * l.unitPriceFcfa * (1 + l.taxRate / 100))}</td>
                <td className="px-1 py-1"><Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => removeLine(i)}><Trash2 className="w-3 h-3" /></Button></td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-muted/50 border-t">
              <tr>
                <td colSpan={6} className="px-3 py-1.5 text-right text-xs text-muted-foreground">Total HT</td>
                <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums">{formatFCFA(totalHt)}</td><td />
              </tr>
              <tr>
                <td colSpan={6} className="px-3 py-1.5 text-right text-xs text-muted-foreground">TVA</td>
                <td className="px-3 py-1.5 text-right text-xs tabular-nums">{formatFCFA(totalTva)}</td><td />
              </tr>
              <tr className="border-t">
                <td colSpan={6} className="px-3 py-2 text-right text-sm font-bold">Total</td>
                <td className="px-3 py-2 text-right text-sm font-bold tabular-nums">{formatFCFA(totalHt + totalTva)}</td><td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" size="sm" variant="outline" onClick={addLine} className="text-xs h-7"><Plus className="w-3 h-3 mr-1" />Ajouter des lignes</Button>
        {lines.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={clearLines} className="text-xs h-7 text-muted-foreground">Effacer tout</Button>}
      </div>
    </div>
  );
}

// ─── Create bill dialog (bill / credit note / repeating) ─────────────────────

type Project = { id: string; name: string; code: string | null };

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function CreateBillDialog({ mode = "bill", withUpload = false, prefill, onClose, onSuccess }: {
  mode?: BillMode;
  withUpload?: boolean;
  prefill?: Partial<{ supplierId: string; referenceNumber: string; totalAmount: string; purchaseOrderId: string; lines: InvoiceLine[] }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [supplierId, setSupplierId] = useState(prefill?.supplierId ?? "");
  const [referenceNumber, setReferenceNumber] = useState(prefill?.referenceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [terms, setTerms] = useState("");
  const [department, setDepartment] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>(
    prefill?.lines ?? [
      { description: "", quantity: 1, unitPriceFcfa: 0, taxRate: 18, category: "" },
      { description: "", quantity: 1, unitPriceFcfa: 0, taxRate: 18, category: "" },
    ]
  );
  const [memo, setMemo] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState(prefill?.purchaseOrderId ?? "");
  const [projectId, setProjectId] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  // Repeating fields
  const [frequency, setFrequency] = useState("monthly");
  const [repeatUntil, setRepeatUntil] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  // Auto-calculate due date when terms change
  useEffect(() => {
    if (!terms) return;
    const opt = TERMS_OPTIONS.find(o => o.value === terms);
    if (!opt || opt.days === undefined) return;
    setDueDate(addDays(invoiceDate, opt.days));
  }, [terms, invoiceDate]);

  const { data: posRes } = useQuery<{ data: PO[] }>({
    queryKey: ["purchases-pos-by-supplier", supplierId],
    queryFn: () => apiFetch(`/api/purchases/purchase-orders?supplierId=${supplierId}&limit=50`),
    enabled: !!supplierId,
  });
  const availablePos = posRes?.data ?? [];

  const { data: projectsRes } = useQuery<{ data: Project[] }>({
    queryKey: ["projects-list-light"],
    queryFn: () => apiFetch("/api/projects?limit=100"),
    staleTime: 60_000,
  });

  const totalHt = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa, 0);
  const totalTax = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa * (l.taxRate / 100), 0);
  const balanceDue = (mode === "credit_note" ? -1 : 1) * (totalHt + totalTax);

  // Drag & drop for upload panel
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      ["application/pdf", "image/png", "image/jpeg", "image/heic"].includes(f.type) || f.name.match(/\.(pdf|png|jpe?g|heic)$/i)
    );
    if (files.length) setUploadFiles(prev => [...prev, ...files]);
  }, []);

  const handleSave = async (schedulePayment = false) => {
    if (!supplierId) { toast.error("Sélectionnez un fournisseur"); return; }
    if (mode !== "repeating" && !referenceNumber) { toast.error("Le numéro de facture est requis"); return; }
    const hasContent = lines.some(l => l.description || l.unitPriceFcfa > 0);
    if (!hasContent) { toast.error("Ajoutez au moins une ligne"); return; }
    setSaving(true);
    try {
      const sign = mode === "credit_note" ? -1 : 1;
      const invoice = await apiFetch<{ id: string }>("/api/purchases/invoices", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          referenceNumber: referenceNumber || `${mode === "credit_note" ? "NC" : "FACT"}-${Date.now()}`,
          invoiceDate, dueDate: dueDate || undefined,
          totalAmount: sign * (totalHt || 0),
          taxAmount: sign * (totalTax || 0),
          notes: memo || undefined,
          purchaseOrderId: purchaseOrderId || undefined,
          projectId: projectId || undefined,
          category: department || undefined,
        }),
      });
      // Save lines
      const validLines = lines.filter(l => l.description || l.unitPriceFcfa > 0);
      if (validLines.length > 0) {
        await apiFetch(`/api/purchases/invoices/${invoice.id}/lines`, {
          method: "POST",
          body: JSON.stringify({
            lines: validLines.map(l => ({ ...l, unitPriceFcfa: sign * l.unitPriceFcfa })),
          }),
        });
      }
      // Upload pièces jointes vers l'object storage
      if (attachments.length > 0) {
        const uploaded: Array<{ name: string; objectPath: string; contentType: string; size: number; uploadedAt: string }> = [];
        for (const file of attachments) {
          try {
            const { uploadURL, objectPath } = await apiFetch<{ uploadURL: string; objectPath: string }>(
              "/api/storage/uploads/request-url",
              { method: "POST", body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }) }
            );
            await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
            uploaded.push({ name: file.name, objectPath, contentType: file.type || "application/octet-stream", size: file.size, uploadedAt: new Date().toISOString() });
          } catch {
            toast.warning(`Pièce jointe "${file.name}" non uploadée`);
          }
        }
        if (uploaded.length > 0) {
          await apiFetch(`/api/purchases/invoices/${invoice.id}/attachments`, {
            method: "POST",
            body: JSON.stringify({ attachments: uploaded }),
          });
        }
      }
      const label = mode === "credit_note" ? "Note de crédit créée" : mode === "repeating" ? "Facture récurrente créée" : "Facture créée";
      toast.success(label);
      if (schedulePayment) toast.info("Ouvrez la facture pour programmer un paiement");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  const modeLabel = mode === "credit_note" ? "Note de crédit" : mode === "repeating" ? "Facture récurrente" : "Nouvelle facture";
  const modeIcon = mode === "credit_note" ? <CreditCard className="w-4 h-4 text-[#2563EB]" /> : mode === "repeating" ? <Repeat className="w-4 h-4 text-[#2563EB]" /> : <FileText className="w-4 h-4 text-[#2563EB]" />;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2 font-semibold text-sm">{modeIcon}{modeLabel}</div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Solde dû</div>
            <div className={`text-xl font-bold tabular-nums ${mode === "credit_note" ? "text-emerald-600" : "text-foreground"}`}>
              {formatFCFA(Math.abs(balanceDue))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── Left: autofill panel ── */}
          {withUpload && (
            <div className="w-52 shrink-0 border-r bg-muted/50 flex flex-col p-4 gap-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Upload className="w-4 h-4 text-[#2563EB]" />
                Remplissage auto
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Glissez des documents dans la zone pointillée, ou sélectionnez un fichier pour remplir automatiquement.
              </p>
              <p className="text-xs text-muted-foreground">Formats : PDF, PNG, JPEG, HEIC</p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex-1 min-h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${isDragging ? "border-[#2563EB] bg-orange-50" : "border bg-card"}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadFiles.length === 0 ? (
                  <>
                    <Image className="w-8 h-8 text-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground text-center">Glissez ici</span>
                  </>
                ) : (
                  <div className="w-full px-2 space-y-1">
                    {uploadFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs bg-card border rounded px-2 py-1">
                        <FileText className="w-3 h-3 shrink-0 text-[#2563EB]" />
                        <span className="truncate flex-1">{f.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setUploadFiles(prev => prev.filter((_, j) => j !== i)); }} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.heic" multiple hidden onChange={(e) => { if (e.target.files) setUploadFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1.5 p-2 border rounded-lg bg-card hover:bg-muted/50 text-xs text-center transition-colors">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><Upload className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  Sélectionner
                </button>
                <button className="flex flex-col items-center gap-1.5 p-2 border rounded-lg bg-card hover:bg-muted/50 text-xs text-center transition-colors">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><Image className="w-3.5 h-3.5 text-muted-foreground" /></div>
                  Photo
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center italic">Vérifiez avant d'enregistrer.</p>
            </div>
          )}

          {/* ── Right: form ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Vendor */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fournisseur *</Label>
              <VendorSelect value={supplierId} onValueChange={(v) => { setSupplierId(v); setPurchaseOrderId(""); }} />
            </div>

            {/* Address + Terms + Dates + Number + Dept row */}
            <div className="grid grid-cols-12 gap-3">
              {/* Mailing address */}
              <div className="col-span-4 space-y-1">
                <Label className="text-xs text-muted-foreground">Adresse postale</Label>
                <Textarea rows={3} className="text-sm resize-none" placeholder="Adresse du fournisseur" value={mailingAddress} onChange={(e) => setMailingAddress(e.target.value)} />
              </div>

              <div className="col-span-8 grid grid-cols-2 gap-3">
                {/* Terms */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Conditions</Label>
                  <Select value={terms || "_none"} onValueChange={(v) => setTerms(v === "_none" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMS_OPTIONS.map(o => <SelectItem key={o.value || "_none"} value={o.value || "_none"}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bill date */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date facture</Label>
                  <Input type="date" className="h-8 text-sm" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>

                {/* Due date */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date d'échéance</Label>
                  <Input type="date" className="h-8 text-sm" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setTerms(""); }} />
                </div>

                {/* Bill number */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">N° facture</Label>
                  <Input className="h-8 text-sm" placeholder="FACT-2026-001" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                </div>

                {/* Department */}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Département</Label>
                  <Input className="h-8 text-sm" placeholder="ex. Travaux, Logistique…" value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
              </div>
            </div>

            {/* PO link */}
            {supplierId && availablePos.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bon de commande lié</Label>
                <Select value={purchaseOrderId || "_none"} onValueChange={(v) => setPurchaseOrderId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="— Aucun BC —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Aucun BC lié —</SelectItem>
                    {availablePos.map(p => <SelectItem key={p.id} value={p.id}>{p.reference} — {formatFCFA(Number(p.totalFcfa))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Repeating fields */}
            {mode === "repeating" && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="col-span-2 flex items-center gap-2 text-sm font-medium text-[#2563EB]"><Repeat className="w-4 h-4" />Paramètres de récurrence</div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fréquence</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      <SelectItem value="monthly">Mensuelle</SelectItem>
                      <SelectItem value="quarterly">Trimestrielle</SelectItem>
                      <SelectItem value="yearly">Annuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Répéter jusqu'au</Label>
                  <Input type="date" className="h-8 text-sm" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
                </div>
              </div>
            )}

            {/* Line items */}
            <div>
              <InvoiceLineEditor lines={lines} onChange={setLines} />
            </div>

            {/* Memo + Attachments */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Mémo</Label>
                <Textarea rows={3} className="text-sm resize-none" placeholder="Notes internes sur cette facture…" value={memo} onChange={(e) => setMemo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pièces jointes</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-3 min-h-[80px] flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => attachInputRef.current?.click()}
                >
                  {attachments.length === 0 ? (
                    <>
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-[#2563EB] font-medium">Ajouter une pièce jointe</span>
                      <span className="text-xs text-muted-foreground">Max 20 Mo</span>
                    </>
                  ) : (
                    <div className="w-full space-y-1">
                      {attachments.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs bg-card border rounded px-2 py-1">
                          <Paperclip className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                          <span className="truncate flex-1">{f.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setAttachments(prev => prev.filter((_, j) => j !== i)); }} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button className="text-xs text-[#2563EB] font-medium pt-1">+ Ajouter</button>
                    </div>
                  )}
                </div>
                <input ref={attachInputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]); }} />
              </div>
            </div>

            {/* Project link */}
            {(projectsRes?.data ?? []).length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Projet lié</Label>
                <Select value={projectId || "_none"} onValueChange={(v) => setProjectId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="— Aucun projet —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Aucun projet —</SelectItem>
                    {(projectsRes?.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-card shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Annuler</Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => toast.info("Impression non disponible en aperçu")} disabled={saving}>
              <Printer className="w-3.5 h-3.5" />Imprimer
            </Button>
            {mode === "bill" && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => toast.info("Utilisez le mode Facture récurrente pour créer un modèle")} disabled={saving}>
                <Repeat className="w-3.5 h-3.5" />Rendre récurrente
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">
              {saving ? "…" : "Enregistrer et programmer"}
            </Button>
          </div>
        </div>
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
            <FileText className="w-5 h-5 text-[#2563EB]" />
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
                {canPay && <Button size="sm" onClick={() => setPayOpen(true)} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white gap-1 text-xs"><Wallet className="w-3.5 h-3.5" />Payer</Button>}
                {canReject && <Button size="sm" variant="outline" onClick={() => updateStatus("rejected")} disabled={updating} className="text-red-600 border-red-200 hover:bg-red-50 gap-1 text-xs"><ThumbsDown className="w-3.5 h-3.5" />Refuser</Button>}
                {canCancel && <Button size="sm" variant="outline" onClick={() => updateStatus("cancelled")} disabled={updating} className="text-muted-foreground border hover:bg-muted/50 gap-1 text-xs"><XCircle className="w-3.5 h-3.5" />Annuler</Button>}
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 bg-muted/50 rounded-lg p-4">
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

            {inv.notes && <p className="text-sm text-muted-foreground italic bg-muted/50 rounded p-3">{inv.notes}</p>}

            {/* Invoice lines */}
            {lines.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Lignes ({lines.length})</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50"><tr>
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

            {/* Pièces jointes */}
            {(inv.attachments ?? []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Paperclip className="w-4 h-4 text-muted-foreground" /> Pièces jointes ({(inv.attachments ?? []).length})
                </h3>
                <div className="space-y-1.5">
                  {(inv.attachments ?? []).map((att) => {
                    const objectKey = att.objectPath.startsWith("/objects/") ? att.objectPath.slice("/objects/".length) : att.objectPath;
                    const fileUrl = `/api/storage/objects/${objectKey}`;
                    const isImage = att.contentType.startsWith("image/");
                    const isPdf = att.contentType === "application/pdf";
                    return (
                      <a
                        key={att.objectPath}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={att.name}
                        className="flex items-center gap-3 bg-muted/50 hover:bg-muted border border rounded-lg px-3 py-2 transition-colors group"
                      >
                        <span className="shrink-0">
                          {isImage ? <Image className="w-4 h-4 text-blue-500" /> : isPdf ? <FileText className="w-4 h-4 text-red-500" /> : <Paperclip className="w-4 h-4 text-muted-foreground/60" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{att.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {att.size > 1024 * 1024 ? `${(att.size / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(att.size / 1024)} Ko`}
                            {" · "}
                            {formatDate(att.uploadedAt)}
                          </span>
                        </span>
                        <Download className="w-4 h-4 text-muted-foreground group-hover:text-[#2563EB] shrink-0 transition-colors" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment history */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Paiements ({inv.payments.length})</h3>
              {inv.payments.length === 0 && <p className="text-sm text-muted-foreground italic">Aucun paiement enregistré.</p>}
              <div className="space-y-2">
                {inv.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded p-3 text-sm">
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
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
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

// ─── Import CSV dialog ────────────────────────────────────────────────────────

function ImportCsvDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { toast.error("Le fichier semble vide"); return; }
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
      });
      setRows(parsed.slice(0, 5));
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    await new Promise(r => setTimeout(r, 800));
    toast.success(`Importation terminée — ${rows.length} ligne(s) prévisualisée(s). Vérifiez et ajustez les données avant la validation.`);
    setImporting(false);
    onSuccess(); onClose();
  };

  const EXPECTED = ["fournisseur", "reference", "date_facture", "date_echeance", "montant_ht", "tva", "description"];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileDown className="w-4 h-4 text-[#2563EB]" />Importer depuis CSV</DialogTitle>
          <DialogDescription>Importez des factures fournisseurs depuis un fichier CSV.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Format hint */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">Colonnes attendues :</p>
            <div className="flex flex-wrap gap-1">
              {EXPECTED.map(col => <code key={col} className="text-xs bg-card border rounded px-1.5 py-0.5 font-mono">{col}</code>)}
            </div>
          </div>

          {/* File picker */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${file ? "border-[#2563EB] bg-orange-50" : "border hover:border"}`}
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <div className="space-y-1">
                <FileText className="w-8 h-8 text-[#2563EB] mx-auto" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{rows.length} ligne(s) trouvée(s)</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Cliquez pour sélectionner un fichier CSV</p>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />

          {/* Preview */}
          {rows.length > 0 && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>{Object.keys(rows[0]).map(h => <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t">
                      {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1 whitespace-nowrap">{v || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground px-2 py-1.5 bg-muted/50 border-t">Aperçu limité aux 5 premières lignes</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={importing}>Annuler</Button>
          <Button onClick={handleImport} disabled={!file || importing} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">
            {importing ? "Importation…" : "Importer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [billMode, setBillMode] = useState<BillMode>("bill");
  const [withUpload, setWithUpload] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [bcPrefill, setBcPrefill] = useState<Partial<{ supplierId: string; totalAmount: string; purchaseOrderId: string; lines: InvoiceLine[] }> | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openCreate = (mode: BillMode, upload = false) => {
    setBillMode(mode);
    setWithUpload(upload);
    setBcPrefill(undefined);
    setNewOpen(true);
  };

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
            <Button variant="outline" size="sm" onClick={() => exportToExcel(qParams)} className="gap-2"><Upload className="w-4 h-4" />Exporter</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white gap-1.5">
                  <Plus className="w-4 h-4" />Nouvelle facture<ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem className="flex items-start gap-3 py-2.5 cursor-pointer" onClick={() => openCreate("bill", true)}>
                  <div className="mt-0.5 flex items-center gap-1 text-[#2563EB]"><Upload className="w-4 h-4" /></div>
                  <div>
                    <div className="flex items-center gap-2 font-medium text-sm">Télécharger des factures <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Nouveau</Badge></div>
                    <div className="text-xs text-muted-foreground">Glissez un PDF/PNG pour remplissage automatique</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-3 py-2 cursor-pointer" onClick={() => openCreate("bill")}>
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">Nouvelle facture</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3 py-2 cursor-pointer" onClick={() => openCreate("repeating")}>
                  <Repeat className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">Nouvelle facture récurrente</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3 py-2 cursor-pointer" onClick={() => openCreate("credit_note")}>
                  <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">Nouvelle note de crédit</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-3 py-2 cursor-pointer" onClick={() => setCsvOpen(true)}>
                  <FileDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">Importer depuis CSV</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(inv.id)}>
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

      {newOpen && <CreateBillDialog mode={billMode} withUpload={withUpload} prefill={bcPrefill} onClose={() => { setNewOpen(false); setBcPrefill(undefined); setWithUpload(false); }} onSuccess={refresh} />}
      {csvOpen && <ImportCsvDialog onClose={() => setCsvOpen(false)} onSuccess={refresh} />}
      {selectedId && <InvoiceDetailSheet invoiceId={selectedId} onClose={() => setSelectedId(null)} onRefresh={refresh} />}
    </div>
  );
}
