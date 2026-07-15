import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, CreditCard, Calendar, Landmark, Smartphone, FileText, Wallet, Building, CheckCircle2, AlertCircle, ArrowRight, Sparkles, ArrowDownRight, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatFCFA } from "@/lib/format";
import { MoneyAmount } from "@/components/ui/money-amount";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useModuleTour, WelcomeModal, OnboardingTour } from "@/components/ui/onboarding-tour";

const PAYMENTS_TOUR = [
  { target: "pay-header",  title: "Journal des encaissements", description: "Enregistrez chaque paiement reçu et liez-le automatiquement à la facture correspondante." },
  { target: "pay-search",  title: "Recherche et filtres", description: "Filtrez par mode de paiement ou cherchez par numéro de facture et référence de transaction." },
  { target: "pay-table",   title: "Historique des paiements", description: "Consultez tous les encaissements avec leur moyen de paiement, référence et facture associée." },
];

type Invoice = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; paidAmount: number | null;
  clientName: string | null; clientId: string | null;
};

type Payment = {
  id: string; invoiceId: string; amount: number | null;
  method: string | null; reference: string | null;
  payerPhone: string | null; transactionStatus: string | null;
  paidAt: string | null; createdAt: string;
  invoiceRef: string | null; clientName: string | null;
};

const METHODS: Record<string, string> = {
  cash: "Espèces",
  bank: "Virement bancaire",
  bank_transfer: "Virement bancaire",
  card: "Carte bancaire",
  mobile_money: "Mobile Money",
  mixx: "Mixx",
  flooz: "Flooz",
  check: "Chèque",
  other: "Autre",
};

const MOBILE_MONEY_METHODS = ["mobile_money", "mixx", "flooz"];

const TX_STATUSES: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  failed: "Échoué",
  cancelled: "Annulé",
};

function getMethodBadge(method: string | null, txStatus?: string | null) {
  const m = method ?? "other";
  const isMobile = MOBILE_MONEY_METHODS.includes(m);
  const icons: Record<string, React.ReactNode> = {
    bank: <Landmark className="w-4 h-4 text-slate-400" />,
    bank_transfer: <Landmark className="w-4 h-4 text-slate-400" />,
    cash: <CreditCard className="w-4 h-4 text-slate-400" />,
    card: <CreditCard className="w-4 h-4 text-blue-400" />,
    mobile_money: <Smartphone className="w-4 h-4 text-amber-400" />,
    mixx: <Smartphone className="w-4 h-4 text-emerald-500" />,
    flooz: <Smartphone className="w-4 h-4 text-orange-400" />,
    check: <FileText className="w-4 h-4 text-slate-400" />,
  };
  const label = METHODS[m] ?? "Autre";
  const colorClass = m === "card" ? "text-blue-700" : isMobile ? "text-amber-700" : "text-slate-600";
  const statusBadge = isMobile && txStatus && txStatus !== "confirmed" ? (
    <Badge variant="outline" className={`text-[9px] h-4 px-1 ml-1 ${
      txStatus === "pending" ? "border-amber-300 text-amber-600" :
      txStatus === "failed" ? "border-red-300 text-red-600" :
      txStatus === "cancelled" ? "border-slate-300 text-slate-500" : ""
    }`}>{TX_STATUSES[txStatus] ?? txStatus}</Badge>
  ) : null;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${colorClass}`}>
      {icons[m] ?? <CreditCard className="w-4 h-4 text-slate-400" />}
      {label}
      {statusBadge}
    </span>
  );
}

// ─── Types suggest-match ──────────────────────────────────────────────────────

type SuggestMatch = {
  invoiceId: string;
  reference: string;
  clientName: string | null;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  status: string;
  dueDate: string | null;
  confidence: "exact" | "partial" | "low";
};

const CONFIDENCE_CFG: Record<string, { label: string; cls: string }> = {
  exact:   { label: "Correspondance exacte", cls: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  partial: { label: "Correspondance partielle", cls: "bg-amber-50 border-amber-300 text-amber-700" },
  low:     { label: "Faible correspondance", cls: "bg-slate-50 border-slate-200 text-slate-500" },
};

// ─── RecordPaymentDialog ──────────────────────────────────────────────────────

function RecordPaymentDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: invoicesData, isLoading: loadingInvoices } = useQuery<{ data: Invoice[] }>({
    queryKey: ["invoices-unpaid"],
    queryFn: () => apiFetch("/api/invoices?limit=100"),
  });

  const unpaidInvoices = (invoicesData?.data ?? []).filter(
    (inv) => inv.status !== "paid" && inv.status !== "cancelled"
  );

  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [payerPhone, setPayerPhone] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("confirmed");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  const amtNum = Number(amount) || 0;

  const { data: suggestData, isFetching: loadingSuggest } = useQuery<{ suggestions: SuggestMatch[] }>({
    queryKey: ["suggest-match", amtNum],
    queryFn: () => apiFetch(`/api/invoices/suggest-match?amount=${amtNum}`),
    enabled: showSuggest && amtNum > 0,
    staleTime: 30_000,
  });

  const suggestions = suggestData?.suggestions ?? [];
  const topSuggestions = suggestions.slice(0, 5);

  useEffect(() => {
    if (amtNum > 0 && !invoiceId) setShowSuggest(true);
  }, [amtNum, invoiceId]);

  const selectedInvoice = unpaidInvoices.find((i) => i.id === invoiceId);
  const remaining = selectedInvoice
    ? Math.max(0, (selectedInvoice.totalAmount ?? 0) - (selectedInvoice.paidAmount ?? 0))
    : 0;

  const handleInvoiceChange = (id: string) => {
    setInvoiceId(id);
    setShowSuggest(false);
    const inv = unpaidInvoices.find((i) => i.id === id);
    if (inv) {
      setAmount(String(Math.max(0, (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0))));
    }
  };

  const handleApplySuggestion = (s: SuggestMatch) => {
    setInvoiceId(s.invoiceId);
    setAmount(String(s.remaining));
    setShowSuggest(false);
  };

  const handleSave = async () => {
    if (!invoiceId) { toast.error("Sélectionnez une facture"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId,
          amount: Number(amount),
          currency: "XOF",
          method,
          reference: reference || undefined,
          paidAt,
          notes: notes || undefined,
          payerPhone: payerPhone || undefined,
          transactionStatus,
        }),
      });
      toast.success("Paiement enregistré et comptabilisé automatiquement");
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#2563EB]" /> Saisir un encaissement
          </DialogTitle>
          <DialogDescription>
            Le paiement est comptabilisé automatiquement (débit 521/571 · crédit 411).
          </DialogDescription>
        </DialogHeader>

        {loadingInvoices ? (
          <div className="py-6 space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : unpaidInvoices.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-20" />
            Aucune facture impayée à ce jour.
          </div>
        ) : (
          <div className="space-y-4 py-2">

            {/* ── Montant en premier pour déclencher suggest-match ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Montant reçu (FCFA) *</Label>
                <Input
                  type="number" min="1"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); if (invoiceId) setShowSuggest(false); }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Mode de paiement</Label>
                <Select value={method} onValueChange={(v) => { setMethod(v); setPayerPhone(""); setTransactionStatus("confirmed"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Virement bancaire</SelectItem>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="card">Carte bancaire</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="mixx">Mixx</SelectItem>
                    <SelectItem value="flooz">Flooz</SelectItem>
                    <SelectItem value="check">Chèque</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Champs spécifiques Mobile Money (Mixx / Flooz) ── */}
            {MOBILE_MONEY_METHODS.includes(method) && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-amber-600" />N° de téléphone payeur</Label>
                  <Input
                    placeholder="ex: +228 90 00 00 00"
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Statut de la transaction</Label>
                  <Select value={transactionStatus} onValueChange={setTransactionStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TX_STATUSES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="col-span-2 text-[11px] text-amber-700">
                  La référence de transaction sera saisie ci-dessous. Le statut peut être mis à jour après confirmation de l'opérateur.
                </p>
              </div>
            )}

            {/* ── Champs spécifiques Carte bancaire ── */}
            {method === "card" && (
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                <p className="text-[11px] text-blue-700">
                  Saisissez la référence de transaction fournie par le terminal de paiement (TPE) ci-dessous. L'intégration avec une passerelle de paiement pourra être configurée ultérieurement.
                </p>
              </div>
            )}

            {/* ── Suggestions de lettrage ── */}
            {amtNum > 0 && !invoiceId && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                    <Sparkles className="w-3.5 h-3.5" /> Suggestions de lettrage
                  </p>
                  {loadingSuggest && <span className="text-[10px] text-muted-foreground animate-pulse">Recherche…</span>}
                </div>
                {topSuggestions.length === 0 && !loadingSuggest && (
                  <p className="text-xs text-muted-foreground">Aucune facture ne correspond à ce montant.</p>
                )}
                {topSuggestions.map((s) => {
                  const cfg = CONFIDENCE_CFG[s.confidence];
                  return (
                    <div
                      key={s.invoiceId}
                      className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 cursor-pointer hover:shadow-sm transition-shadow ${cfg.cls}`}
                      onClick={() => handleApplySuggestion(s)}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-semibold truncate">{s.reference}</p>
                        <p className="text-[10px] truncate">{s.clientName ?? "—"} · reste {formatFCFA(s.remaining)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className={`text-[9px] h-4 px-1 ${cfg.cls}`}>{cfg.label}</Badge>
                        <ArrowDownRight className="w-3.5 h-3.5 opacity-60" />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground">Cliquez sur une suggestion pour la sélectionner automatiquement.</p>
              </div>
            )}

            {/* ── Sélection facture ── */}
            <div className="space-y-1">
              <Label>Facture à encaisser *</Label>
              <Select value={invoiceId} onValueChange={handleInvoiceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une facture…" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.referenceNumber}
                      {inv.clientName ? ` — ${inv.clientName}` : ""}
                      {" · "}reste {formatFCFA(Math.max(0, (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0)))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedInvoice && (() => {
                const diff = amtNum - remaining;
                const isExact = amtNum > 0 && Math.abs(diff) < 1;
                const isOver = amtNum > 0 && diff > 1;
                const isPartial = amtNum > 0 && diff < -1;
                const otherInvoices = unpaidInvoices.filter(
                  (i) => i.id !== invoiceId && i.clientId === selectedInvoice.clientId
                );
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Solde restant : <strong className="text-amber-600">{formatFCFA(remaining)}</strong>
                    </p>
                    {amtNum > 0 && (
                      <div className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 border ${
                        isExact ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                        isOver ? "bg-orange-50 border-orange-200 text-orange-700" :
                        "bg-amber-50 border-amber-200 text-amber-700"
                      }`}>
                        {isExact ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {isExact && "Correspondance exacte — facture soldée"}
                        {isPartial && `Paiement partiel — il restera ${formatFCFA(Math.abs(diff))} à payer`}
                        {isOver && `Trop-perçu de ${formatFCFA(diff)} — à justifier`}
                      </div>
                    )}
                    {otherInvoices.length > 0 && (
                      <div className="border rounded p-2 bg-muted/30 space-y-1">
                        <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">
                          Autres factures en attente — {selectedInvoice.clientName ?? "même client"}
                        </p>
                        {otherInvoices.slice(0, 3).map((oi) => (
                          <div key={oi.id} className="flex items-center justify-between text-xs">
                            <span className="font-mono text-primary">{oi.referenceNumber}</span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <ArrowRight className="w-3 h-3" />
                              {formatFCFA(Math.max(0, (oi.totalAmount ?? 0) - (oi.paidAmount ?? 0)))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date d'encaissement</Label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Référence / N° virement</Label>
                <Input placeholder="REF-2026-001" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          {unpaidInvoices.length > 0 && (
            <Button
              onClick={handleSave}
              disabled={saving || !invoiceId}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {saving ? "Enregistrement…" : "Valider le paiement"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentsList() {
  const qc = useQueryClient();
  const perms = usePermissions();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery<{ data: Payment[] }>({
    queryKey: ["payments"],
    queryFn: () => apiFetch("/api/payments?limit=50"),
  });

  const payments = (data?.data ?? []).filter((p) =>
    !search ||
    (p.reference ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.invoiceRef ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalEncaisse = payments.reduce((s, p) => s + (p.amount ?? 0), 0);

  const { showWelcome, tourActive, startTour, dismissWelcome, closeTour } = useModuleTour("paiements", !isLoading && payments.length === 0);

  return (
    <div data-tour="pay-header" className="space-y-5 animate-in fade-in duration-500">
      <ReadOnlyBanner />
      {showWelcome && (
        <WelcomeModal
          title="Journal des Encaissements"
          subtitle="Enregistrez vos paiements reçus et liez-les aux factures pour une trésorerie toujours à jour."
          icon={CreditCard}
          steps={PAYMENTS_TOUR}
          onStart={startTour}
          onDismiss={dismissWelcome}
        />
      )}
      {tourActive && <OnboardingTour steps={PAYMENTS_TOUR} onClose={closeTour} />}
      <PageHeader
        title="Encaissements"
        subtitle={`Journal des paiements · ${formatFCFA(totalEncaisse)} encaissé`}
        icon={CreditCard}
        actions={!perms.isReadOnly ? (
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white font-semibold shadow-sm gap-1.5"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Saisir un encaissement
          </Button>
        ) : undefined}
      />

      <Card className="shadow-sm border-border">
        <CardHeader data-tour="pay-search" className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Journal des paiements</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="N° Facture, Référence…"
                  className="pl-9 bg-slate-50 focus-visible:ring-primary h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="w-4 h-4 mr-2" /> Filtres
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table data-tour="pay-table">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Date</TableHead>
                  <TableHead className="font-semibold text-slate-600">Client</TableHead>
                  <TableHead className="font-semibold text-slate-600">N° Facture</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Moyen de paiement</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600">Réf. transaction</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Montant encaissé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState
                        icon={CreditCard}
                        title="Aucun encaissement enregistré"
                        description="Saisissez vos premiers encaissements et suivez le recouvrement de vos créances."
                        actionLabel="Saisir un encaissement"
                        onAction={() => setDialogOpen(true)}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {formatDate(payment.paidAt || payment.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{payment.clientName ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.invoiceRef ? (
                          <span className="bg-blue-50 text-blue-700 font-mono text-xs px-2 py-0.5 rounded border border-blue-200">
                            {payment.invoiceRef}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {getMethodBadge(payment.method, payment.transactionStatus)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-slate-500">
                        {payment.reference || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyAmount amount={payment.amount} size="lg" color="success" showSign />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <RecordPaymentDialog
          onClose={() => setDialogOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["payments"] });
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["invoices-unpaid"] });
          }}
        />
      )}
    </div>
  );
}
