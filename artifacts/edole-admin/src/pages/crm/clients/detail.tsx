import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetClient, getGetClientQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Building, Mail, Phone, Globe, MapPin, Briefcase,
  ShoppingCart, Banknote, User, Plus, FileText, Receipt,
  Wallet, ClipboardList, TrendingUp, CheckCircle2, AlertCircle,
  Calendar, ChevronRight, UserCheck, Star, CreditCard, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceItem = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; paidAmount: number | null;
  dueDate: string | null; issuedAt: string | null;
};

type ProformaItem = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; createdAt: string; validUntil: string | null;
};

type OrderItem = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; createdAt: string;
};

type PaymentItem = {
  id: string; amount: number | null; method: string | null;
  paidAt: string | null; reference: string | null; invoiceRef: string | null;
};

type CommercialData = {
  kpis: {
    totalProformas: number; totalOrders: number; totalInvoices: number;
    totalInvoiced: number; totalPaid: number; outstandingBalance: number;
  };
  proformas: ProformaItem[];
  orders: OrderItem[];
  invoices: InvoiceItem[];
  payments: PaymentItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  draft:         { label: "Brouillon",      cls: "bg-slate-100 text-slate-600 border-slate-200" },
  pending:       { label: "En attente",     cls: "bg-blue-50 text-blue-700 border-blue-200" },
  partially_paid:{ label: "Partiellement payée", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  paid:          { label: "Payée",          cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  overdue:       { label: "En retard",      cls: "bg-red-50 text-red-700 border-red-200 font-bold" },
  cancelled:     { label: "Annulée",        cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

const PRO_STATUS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Brouillon", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  sent:     { label: "Envoyé",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  approved: { label: "Approuvé", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected: { label: "Refusé",   cls: "bg-red-50 text-red-700 border-red-200" },
};

const ORD_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Brouillon",   cls: "bg-slate-100 text-slate-600 border-slate-200" },
  confirmed: { label: "Confirmée",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  delivered: { label: "Livrée",      cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Annulée",     cls: "bg-red-50 text-red-700 border-red-200" },
};

const METHODS: Record<string, string> = {
  cash: "Espèces", bank: "Virement", mobile_money: "Mobile Money",
  check: "Chèque", other: "Autre",
};

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const s = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>{s.label}</span>;
}

// ─── RecordPaymentDialog ─────────────────────────────────────────────────────

function RecordPaymentDialog({ invoices, preselectedInvoiceId, onClose, onSuccess }: {
  invoices: InvoiceItem[];
  preselectedInvoiceId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const unpaid = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled");
  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId ?? unpaid[0]?.id ?? "");
  const [amount, setAmount] = useState(() => {
    const inv = invoices.find(i => i.id === (preselectedInvoiceId ?? unpaid[0]?.id));
    if (!inv) return "";
    return String(Math.max(0, (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0)));
  });
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedInvoice = invoices.find(i => i.id === invoiceId);
  const remaining = selectedInvoice ? (selectedInvoice.totalAmount ?? 0) - (selectedInvoice.paidAmount ?? 0) : 0;

  const handleInvoiceChange = (id: string) => {
    setInvoiceId(id);
    const inv = invoices.find(i => i.id === id);
    if (inv) setAmount(String(Math.max(0, (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0))));
  };

  const handleSave = async () => {
    if (!invoiceId) { toast.error("Sélectionnez une facture"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId, amount: Number(amount), currency: "XOF", method, reference: reference || undefined, paidAt, notes: notes || undefined }),
      });
      toast.success("Paiement enregistré et comptabilisé");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#C8A24B]" /> Enregistrer un encaissement</DialogTitle>
          <DialogDescription>Le paiement sera comptabilisé automatiquement (débit 521/571, crédit 411).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Facture *</Label>
            <Select value={invoiceId} onValueChange={handleInvoiceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une facture" />
              </SelectTrigger>
              <SelectContent>
                {unpaid.map(inv => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.referenceNumber} — reste {formatFCFA((inv.totalAmount ?? 0) - (inv.paidAmount ?? 0))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedInvoice && (
              <p className="text-xs text-muted-foreground">Solde restant : <strong className="text-amber-600">{formatFCFA(remaining)}</strong></p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Montant (FCFA) *</Label>
              <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Mode de paiement</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date d'encaissement</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Référence / N° virement</Label>
              <Input placeholder="REF-001" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !invoiceId} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">
            {saving ? "Enregistrement…" : "Valider le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NewDocumentDialog ────────────────────────────────────────────────────────

type DocMode = "proforma" | "order" | "invoice";

const DOC_CONFIG: Record<DocMode, { title: string; icon: any; endpoint: string; successMsg: string }> = {
  proforma: { title: "Nouveau devis / proforma", icon: FileText, endpoint: "/api/proformas", successMsg: "Devis créé" },
  order:    { title: "Nouvelle commande",         icon: ShoppingCart, endpoint: "/api/orders",   successMsg: "Commande créée" },
  invoice:  { title: "Nouvelle facture",          icon: Receipt,      endpoint: "/api/invoices",  successMsg: "Facture créée et comptabilisée" },
};

function NewDocumentDialog({ mode, clientId, clientName, onClose, onSuccess }: {
  mode: DocMode; clientId: string; clientName: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const config = DOC_CONFIG[mode];
  const Icon = config.icon;
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Montant requis"); return; }
    setSaving(true);
    try {
      const body: Record<string, any> = { clientId, totalAmount: Number(amount), currency: "XOF", notes: notes || undefined };
      if (mode === "invoice") {
        body.status = "pending";
        body.issuedAt = new Date().toISOString().slice(0, 10);
        if (dueDate) body.dueDate = dueDate;
      }
      if (mode === "proforma" && validUntil) body.validUntil = validUntil;
      await apiFetch(config.endpoint, { method: "POST", body: JSON.stringify(body) });
      toast.success(config.successMsg);
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
          <DialogTitle className="flex items-center gap-2"><Icon className="w-5 h-5 text-[#C8A24B]" /> {config.title}</DialogTitle>
          <DialogDescription>Client : <strong>{clientName}</strong></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Montant (FCFA) *</Label>
            <Input type="number" min="0" placeholder="1 500 000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {mode === "invoice" && (
            <div className="space-y-1">
              <Label>Date d'échéance</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
          {mode === "proforma" && (
            <div className="space-y-1">
              <Label>Valable jusqu'au</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label>Notes / Objet</Label>
            <Textarea rows={2} placeholder="Objet, prestations…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = "apercu" | "devis" | "commandes" | "factures" | "paiements" | "contacts";

export default function ClientDetail() {
  const [, params] = useRoute("/crm/clients/:id");
  const id = params?.id || "";
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("apercu");
  const [quickDialog, setQuickDialog] = useState<DocMode | "payment" | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);

  const { data: client, isLoading } = useGetClient(id, {
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id) },
  });

  const { data: commercial, isLoading: loadingCommercial, refetch: refetchCommercial } = useQuery<CommercialData>({
    queryKey: ["client-commercial", id],
    queryFn: () => apiFetch(`/api/clients/${id}/commercial`),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["client-commercial", id] });
    qc.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
  };

  const convertMutation = useMutation({
    mutationFn: () => apiFetch(`/api/clients/${id}`, { method: "PUT", body: JSON.stringify({ status: "active" }) }),
    onSuccess: () => {
      toast.success("Client activé avec succès");
      qc.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
    },
    onError: () => toast.error("Erreur lors de la conversion"),
  });

  const generateInvoiceFromProforma = async (proformaId: string) => {
    setGeneratingInvoice(proformaId);
    try {
      await apiFetch(`/api/proformas/${proformaId}/generate-invoice`, { method: "POST" });
      toast.success("Facture générée et comptabilisée");
      invalidate();
      setTab("factures");
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("déjà générée")) {
        toast.info("Une facture existe déjà pour ce devis");
        setTab("factures");
      } else {
        toast.error(msg || "Erreur lors de la génération");
      }
    } finally {
      setGeneratingInvoice(null);
    }
  };

  const generateInvoiceFromOrder = async (orderId: string) => {
    setGeneratingInvoice(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}/generate-invoice`, { method: "POST" });
      toast.success("Facture générée et comptabilisée");
      invalidate();
      setTab("factures");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la génération");
    } finally {
      setGeneratingInvoice(null);
    }
  };

  const kpis = commercial?.kpis;
  const proformas = commercial?.proformas ?? [];
  const orders = commercial?.orders ?? [];
  const invoices = commercial?.invoices ?? [];
  const payments = commercial?.payments ?? [];
  const contacts = (client as any)?.contacts ?? [];

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "apercu",    label: "Aperçu" },
    { key: "devis",     label: "Devis",     count: proformas.length },
    { key: "commandes", label: "Commandes", count: orders.length },
    { key: "factures",  label: "Factures",  count: invoices.length },
    { key: "paiements", label: "Paiements", count: payments.length },
    { key: "contacts",  label: "Contacts",  count: contacts.length },
  ];

  const unpaidInvoices = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled");

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Client introuvable</h2>
        <Link href="/crm/clients">
          <Button className="mt-4" variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'annuaire</Button>
        </Link>
      </div>
    );
  }

  const isProspect = client.status === "prospect";

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/crm/clients">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0">
              <ArrowLeft className="w-4 h-4" />
              Clients CRM
            </Button>
          </Link>
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg shrink-0">
            {client.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">{client.name}</h1>
              {client.status === "active" && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Client actif</span>}
              {client.status === "prospect" && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Prospect</span>}
              {client.status === "inactive" && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Inactif</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{client.industry || "Secteur non spécifié"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isProspect && (
              <Button size="sm" onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <UserCheck className="w-4 h-4" />
                {convertMutation.isPending ? "…" : "Convertir en client"}
              </Button>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap pl-14">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1">Actions rapides :</span>
          <Button size="sm" variant="outline" onClick={() => setQuickDialog("proforma")} className="gap-1.5 h-8">
            <FileText className="w-3.5 h-3.5" /> Nouveau devis
          </Button>
          <Button size="sm" variant="outline" onClick={() => setQuickDialog("order")} className="gap-1.5 h-8">
            <ShoppingCart className="w-3.5 h-3.5" /> Nouvelle commande
          </Button>
          <Button size="sm" variant="outline" onClick={() => setQuickDialog("invoice")} className="gap-1.5 h-8">
            <Receipt className="w-3.5 h-3.5" /> Nouvelle facture
          </Button>
          <Button size="sm"
            onClick={() => { setPaymentInvoiceId(null); setQuickDialog("payment"); }}
            disabled={unpaidInvoices.length === 0}
            className="gap-1.5 h-8 bg-[#C8A24B] hover:bg-[#b8922b] text-white">
            <Wallet className="w-3.5 h-3.5" /> Enregistrer paiement
          </Button>
          {unpaidInvoices.length === 0 && invoices.length > 0 && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tout soldé
            </span>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Devis", value: kpis?.totalProformas ?? "—", icon: FileText, color: "text-blue-600" },
          { label: "Commandes", value: kpis?.totalOrders ?? "—", icon: ShoppingCart, color: "text-indigo-600" },
          { label: "Facturé", value: kpis ? formatFCFA(kpis.totalInvoiced) : "—", icon: Receipt, color: "text-slate-700" },
          { label: "Encaissé", value: kpis ? formatFCFA(kpis.totalPaid) : "—", icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Solde ouvert", value: kpis ? formatFCFA(kpis.outstandingBalance) : "—", icon: AlertCircle, color: kpis && kpis.outstandingBalance > 0 ? "text-amber-600" : "text-emerald-600" },
          { label: "Paiements", value: kpis?.totalInvoices ?? "—", icon: Banknote, color: "text-slate-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
              </div>
              <div className={`text-base font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div>
        <div className="flex gap-1 border-b">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors flex items-center gap-1.5
                ${tab === t.key
                  ? "bg-white border border-b-white border-slate-200 text-[#C8A24B] -mb-px"
                  : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-[#C8A24B]/10 text-[#C8A24B]" : "bg-slate-100 text-slate-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4">

          {/* ─ Aperçu ─ */}
          {tab === "apercu" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card className="md:col-span-1">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Coordonnées</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { icon: Mail, label: "Email", value: client.email },
                    { icon: Phone, label: "Téléphone", value: client.phone },
                    { icon: Globe, label: "Site web", value: client.website },
                    { icon: MapPin, label: "Adresse", value: client.address },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-sm font-medium mt-0.5">{(value as string) || "—"}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="md:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Dernières activités commerciales</CardTitle></CardHeader>
                  <CardContent>
                    {loadingCommercial ? (
                      <div className="space-y-3">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {[
                          ...invoices.slice(0, 3).map(i => ({ type: "facture", icon: Receipt, color: "text-blue-600 bg-blue-50", label: i.referenceNumber, sub: `${INV_STATUS[i.status]?.label ?? i.status} · ${formatFCFA(i.totalAmount ?? 0)}`, date: i.issuedAt || "", action: () => setTab("factures") })),
                          ...proformas.slice(0, 2).map(p => ({ type: "devis", icon: FileText, color: "text-indigo-600 bg-indigo-50", label: p.referenceNumber, sub: `${PRO_STATUS[p.status]?.label ?? p.status} · ${formatFCFA(p.totalAmount ?? 0)}`, date: p.createdAt, action: () => setTab("devis") })),
                          ...payments.slice(0, 2).map(p => ({ type: "paiement", icon: Wallet, color: "text-emerald-600 bg-emerald-50", label: `Paiement — ${p.invoiceRef ?? ""}`, sub: `${METHODS[p.method ?? ""] ?? p.method ?? "—"} · ${formatFCFA(p.amount ?? 0)}`, date: p.paidAt || "", action: () => setTab("paiements") })),
                        ].sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 6).map((item, i) => {
                          const Icon = item.icon;
                          return (
                            <button key={i} onClick={item.action}
                              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors text-left">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{item.label}</p>
                                <p className="text-xs text-muted-foreground">{item.sub}</p>
                              </div>
                              <div className="text-xs text-muted-foreground shrink-0">{item.date ? formatDate(item.date) : ""}</div>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            </button>
                          );
                        })}
                        {proformas.length === 0 && invoices.length === 0 && payments.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            <Star className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            Aucune activité commerciale pour l'instant.
                            <div className="mt-2">Commencez par créer un devis ou une facture.</div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ─ Devis ─ */}
          {tab === "devis" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{proformas.length} devis</p>
                <Button size="sm" onClick={() => setQuickDialog("proforma")} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white gap-1.5">
                  <Plus className="w-4 h-4" /> Nouveau devis
                </Button>
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Validité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="w-36">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proformas.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun devis</TableCell></TableRow>
                    ) : proformas.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs font-bold">{p.referenceNumber}</TableCell>
                        <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                        <TableCell className="text-sm">{p.validUntil ? formatDate(p.validUntil) : "—"}</TableCell>
                        <TableCell><StatusBadge status={p.status} map={PRO_STATUS} /></TableCell>
                        <TableCell className="text-right font-semibold">{formatFCFA(p.totalAmount ?? 0)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            disabled={generatingInvoice === p.id}
                            onClick={() => generateInvoiceFromProforma(p.id)}>
                            <Receipt className="w-3 h-3" />
                            {generatingInvoice === p.id ? "…" : "Générer facture"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ─ Commandes ─ */}
          {tab === "commandes" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{orders.length} commande{orders.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={() => setQuickDialog("order")} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white gap-1.5">
                  <Plus className="w-4 h-4" /> Nouvelle commande
                </Button>
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="w-36">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune commande</TableCell></TableRow>
                    ) : orders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs font-bold">{o.referenceNumber}</TableCell>
                        <TableCell className="text-sm">{formatDate(o.createdAt)}</TableCell>
                        <TableCell><StatusBadge status={o.status} map={ORD_STATUS} /></TableCell>
                        <TableCell className="text-right font-semibold">{formatFCFA(o.totalAmount ?? 0)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            disabled={generatingInvoice === o.id}
                            onClick={() => generateInvoiceFromOrder(o.id)}>
                            <Receipt className="w-3 h-3" />
                            {generatingInvoice === o.id ? "…" : "Générer facture"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ─ Factures ─ */}
          {tab === "factures" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{invoices.length} facture{invoices.length !== 1 ? "s" : ""}</p>
                <Button size="sm" onClick={() => setQuickDialog("invoice")} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white gap-1.5">
                  <Plus className="w-4 h-4" /> Nouvelle facture
                </Button>
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Émise le</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Reste à payer</TableHead>
                      <TableHead className="w-36">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune facture</TableCell></TableRow>
                    ) : invoices.map(inv => {
                      const remaining = (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0);
                      const canPay = inv.status !== "paid" && inv.status !== "cancelled";
                      return (
                        <TableRow key={inv.id} className={inv.status === "overdue" ? "bg-red-50/30" : ""}>
                          <TableCell className="font-mono text-xs font-bold">{inv.referenceNumber}</TableCell>
                          <TableCell className="text-sm">{inv.issuedAt ? formatDate(inv.issuedAt) : "—"}</TableCell>
                          <TableCell className={`text-sm ${inv.status === "overdue" ? "text-red-600 font-semibold" : ""}`}>
                            {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                          </TableCell>
                          <TableCell><StatusBadge status={inv.status} map={INV_STATUS} /></TableCell>
                          <TableCell className="text-right font-semibold">{formatFCFA(inv.totalAmount ?? 0)}</TableCell>
                          <TableCell className="text-right">
                            {inv.status === "paid"
                              ? <span className="text-emerald-600 font-semibold text-xs">Soldé</span>
                              : <span className={remaining > 0 ? "text-amber-600 font-semibold" : ""}>{formatFCFA(remaining)}</span>}
                          </TableCell>
                          <TableCell>
                            {canPay && (
                              <Button size="sm" className="h-7 text-xs gap-1 bg-[#C8A24B] hover:bg-[#b8922b] text-white"
                                onClick={() => { setPaymentInvoiceId(inv.id); setQuickDialog("payment"); }}>
                                <Wallet className="w-3 h-3" /> Encaisser
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ─ Paiements ─ */}
          {tab === "paiements" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{payments.length} paiement{payments.length !== 1 ? "s" : ""} — {formatFCFA(kpis?.totalPaid ?? 0)} encaissé</p>
                <Button size="sm"
                  onClick={() => { setPaymentInvoiceId(null); setQuickDialog("payment"); }}
                  disabled={unpaidInvoices.length === 0}
                  className="bg-[#C8A24B] hover:bg-[#b8922b] text-white gap-1.5">
                  <Plus className="w-4 h-4" /> Enregistrer paiement
                </Button>
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun paiement</TableCell></TableRow>
                    ) : payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.paidAt ? formatDate(p.paidAt) : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{p.invoiceRef ?? "—"}</TableCell>
                        <TableCell className="text-sm">{METHODS[p.method ?? ""] ?? p.method ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">{formatFCFA(p.amount ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ─ Contacts ─ */}
          {tab === "contacts" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</p>
              </div>
              {contacts.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    <User className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    Aucun contact renseigné.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {contacts.map((c: any) => (
                    <Card key={c.id} className="hover:border-slate-300 transition-colors">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {c.firstName?.[0]}{c.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {c.firstName} {c.lastName}
                            {c.isPrimary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Principal</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.role || "—"}</div>
                        </div>
                        <div className="text-sm text-right space-y-1 text-muted-foreground">
                          {c.email && <div className="flex items-center gap-1 text-xs"><Mail className="w-3 h-3" /> {c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" /> {c.phone}</div>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Dialogs ── */}
      {quickDialog === "payment" && (
        <RecordPaymentDialog
          invoices={invoices}
          preselectedInvoiceId={paymentInvoiceId}
          onClose={() => { setQuickDialog(null); setPaymentInvoiceId(null); }}
          onSuccess={() => { invalidate(); setTab("paiements"); }}
        />
      )}
      {(quickDialog === "proforma" || quickDialog === "order" || quickDialog === "invoice") && (
        <NewDocumentDialog
          mode={quickDialog}
          clientId={id}
          clientName={client.name}
          onClose={() => setQuickDialog(null)}
          onSuccess={() => {
            invalidate();
            if (quickDialog === "proforma") setTab("devis");
            if (quickDialog === "order") setTab("commandes");
            if (quickDialog === "invoice") setTab("factures");
          }}
        />
      )}
    </div>
  );
}
