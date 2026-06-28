import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ThumbsUp, AlertTriangle, Clock, FileText, ShoppingCart, Receipt } from "lucide-react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingInvoice = {
  id: string; referenceNumber: string; status: string;
  invoiceDate: string; dueDate: string | null;
  totalAmount: number; paidAmount: number; balance: number;
  isOverdue: boolean; notes: string | null;
  supplierId: string; supplierName: string | null;
  createdAt: string;
};

type PendingPO = {
  id: string; reference: string; status: string;
  orderDate: string; expectedDate: string | null;
  totalFcfa: number; notes: string | null;
  supplierId: string; supplierName: string | null;
  createdAt: string;
};

type PendingExpense = {
  id: string; title: string; status: string;
  totalAmount: number; collaboratorId: string;
  collaboratorName: string;
  submittedAt: string | null; createdAt: string;
};

type ApprovalQueue = {
  invoices: PendingInvoice[];
  purchaseOrders: PendingPO[];
  expenseReports: PendingExpense[];
  total: number;
};

// ─── Status badges ─────────────────────────────────────────────────────────────

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  review:            { label: "À revoir",            cls: "bg-blue-50 text-blue-700 border-blue-200" },
  awaiting_approval: { label: "En att. approbation", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

function InvBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  const s = INV_STATUS[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>
      {isOverdue && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200"><AlertTriangle className="h-3 w-3 mr-1 inline" />Échu</Badge>}
    </div>
  );
}

// ─── Reject dialog (factures) ─────────────────────────────────────────────────

function RejectInvoiceDialog({ invoice, onClose, onSuccess }: {
  invoice: PendingInvoice; onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) { toast.error("Veuillez indiquer un motif de refus"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/purchases/invoices/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected", rejectionReason: reason.trim() }),
      });
      toast.success("Facture refusée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser la facture</DialogTitle>
          <DialogDescription>{invoice.referenceNumber} — {invoice.supplierName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Motif de refus <span className="text-red-500">*</span></Label>
          <Textarea placeholder="Indiquez le motif…" value={reason} onChange={e => setReason(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="destructive" onClick={handleReject} disabled={saving || !reason.trim()}>
            <XCircle className="h-4 w-4 mr-1" />{saving ? "…" : "Confirmer le refus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reject dialog (notes de frais) ──────────────────────────────────────────

function RejectExpenseDialog({ expense, onClose, onSuccess }: {
  expense: PendingExpense; onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) { toast.error("Veuillez indiquer un motif"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/purchases/expenses/${expense.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected", rejectionReason: reason.trim() }),
      });
      toast.success("Note de frais refusée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser la note de frais</DialogTitle>
          <DialogDescription>{expense.title} — {expense.collaboratorName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Motif de refus <span className="text-red-500">*</span></Label>
          <Textarea placeholder="Indiquez le motif…" value={reason} onChange={e => setReason(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="destructive" onClick={handleReject} disabled={saving || !reason.trim()}>
            <XCircle className="h-4 w-4 mr-1" />{saving ? "…" : "Confirmer le refus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice row actions ───────────────────────────────────────────────────────

function InvoiceActions({ invoice, onRefresh }: { invoice: PendingInvoice; onRefresh: () => void }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const doAction = async (status: string, label: string) => {
    setSaving(status);
    try {
      await apiFetch(`/api/purchases/invoices/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(`Facture ${label}`);
      onRefresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(null); }
  };

  return (
    <div className="flex items-center gap-1">
      {invoice.status === "review" && (
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!saving}
          onClick={() => doAction("awaiting_approval", "transmise")}>
          <ThumbsUp className="h-3 w-3 mr-1" />{saving === "awaiting_approval" ? "…" : "Transmettre"}
        </Button>
      )}
      {invoice.status === "awaiting_approval" && (
        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!!saving}
          onClick={() => doAction("approved", "approuvée")}>
          <CheckCircle2 className="h-3 w-3 mr-1" />{saving === "approved" ? "…" : "Approuver"}
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" disabled={!!saving}
        onClick={() => setRejectOpen(true)}>
        <XCircle className="h-3 w-3 mr-1" />Refuser
      </Button>
      {rejectOpen && <RejectInvoiceDialog invoice={invoice} onClose={() => setRejectOpen(false)} onSuccess={onRefresh} />}
    </div>
  );
}

// ─── Expense row actions ──────────────────────────────────────────────────────

function ExpenseActions({ expense, onRefresh }: { expense: PendingExpense; onRefresh: () => void }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const doAction = async (status: "approved" | "paid") => {
    setSaving(status);
    try {
      await apiFetch(`/api/purchases/expenses/${expense.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(status === "approved" ? "Note de frais approuvée" : "Note de frais payée");
      onRefresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(null); }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!!saving}
        onClick={() => doAction("approved")}>
        <CheckCircle2 className="h-3 w-3 mr-1" />{saving === "approved" ? "…" : "Approuver"}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" disabled={!!saving}
        onClick={() => setRejectOpen(true)}>
        <XCircle className="h-3 w-3 mr-1" />Refuser
      </Button>
      {rejectOpen && <RejectExpenseDialog expense={expense} onClose={() => setRejectOpen(false)} onSuccess={onRefresh} />}
    </div>
  );
}

// ─── Reject dialog (bons de commande) ────────────────────────────────────────

function RejectPoDialog({ po, onClose, onSuccess }: {
  po: PendingPO; onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) { toast.error("Veuillez indiquer un motif de refus"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/purchases/purchase-orders/${po.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", notes: reason.trim() }),
      });
      toast.success("Bon de commande annulé");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler le bon de commande</DialogTitle>
          <DialogDescription>{po.reference} — {po.supplierName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Motif d'annulation <span className="text-red-500">*</span></Label>
          <Textarea placeholder="Indiquez le motif…" value={reason} onChange={e => setReason(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="destructive" onClick={handleReject} disabled={saving || !reason.trim()}>
            <XCircle className="h-4 w-4 mr-1" />{saving ? "…" : "Confirmer l'annulation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PO confirm/reject actions ────────────────────────────────────────────────

function PoActions({ po, onRefresh }: { po: PendingPO; onRefresh: () => void }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const doConfirm = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/purchases/purchase-orders/${po.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed" }),
      });
      toast.success("BC confirmé");
      onRefresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving}
        onClick={doConfirm}>
        <CheckCircle2 className="h-3 w-3 mr-1" />{saving ? "…" : "Confirmer"}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" disabled={saving}
        onClick={() => setRejectOpen(true)}>
        <XCircle className="h-3 w-3 mr-1" />Annuler
      </Button>
      <Link href="/achats/bons-de-commande">
        <Button size="sm" variant="ghost" className="h-7 text-xs">Voir liste</Button>
      </Link>
      {rejectOpen && <RejectPoDialog po={po} onClose={() => setRejectOpen(false)} onSuccess={onRefresh} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprobationsPage() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<ApprovalQueue>({
    queryKey: ["purchases-approvals"],
    queryFn: () => apiFetch("/api/purchases/approvals/pending"),
    refetchInterval: 30_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-approvals"] });

  const thresholdQ = useQuery<{ approvalThreshold: number }>({
    queryKey: ["purchases-threshold"],
    queryFn: () => apiFetch("/api/purchases/settings/threshold"),
  });

  const [urgentOnly, setUrgentOnly] = useState(false);
  const amountThreshold = thresholdQ.data?.approvalThreshold ?? 500_000;

  const allInvoices = data?.invoices ?? [];
  const allPos = data?.purchaseOrders ?? [];
  const allExpenses = data?.expenseReports ?? [];
  const total = (data?.total ?? 0);

  const invoices = urgentOnly ? allInvoices.filter(i => i.totalAmount >= amountThreshold) : allInvoices;
  const pos = urgentOnly ? allPos.filter(p => p.totalFcfa >= amountThreshold) : allPos;
  const expenses = urgentOnly ? allExpenses.filter(e => e.totalAmount >= amountThreshold) : allExpenses;

  const reviewInv = invoices.filter(i => i.status === "review");
  const awaitingInv = invoices.filter(i => i.status === "awaiting_approval");

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <PageHeader
        title="File d'approbations"
        subtitle={`${total} élément${total !== 1 ? "s" : ""} en attente de décision`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={urgentOnly ? "default" : "outline"}
              size="sm"
              className={urgentOnly ? "bg-red-600 hover:bg-red-700 text-white" : ""}
              onClick={() => setUrgentOnly(v => !v)}
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              {urgentOnly ? `Urgences ≥ ${formatFCFA(amountThreshold)}` : "Filtrer urgences"}
            </Button>
            <Button variant="outline" size="sm" onClick={refresh}>
              <Clock className="h-4 w-4 mr-1" />Actualiser
            </Button>
          </div>
        }
      />

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: FileText, label: "Factures fournisseurs", count: invoices.length, color: "text-blue-600" },
          { icon: ShoppingCart, label: "Bons de commande", count: pos.length, color: "text-orange-600" },
          { icon: Receipt, label: "Notes de frais", count: expenses.length, color: "text-purple-600" },
        ].map(({ icon: Icon, label, count, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color}`} />
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
      {error && <p className="text-red-600 text-sm">Erreur de chargement</p>}

      {!isLoading && (
        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />Factures {invoices.length > 0 && <Badge variant="secondary" className="text-xs">{invoices.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="pos" className="flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4" />Bons de commande {pos.length > 0 && <Badge variant="secondary" className="text-xs">{pos.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-1.5">
              <Receipt className="h-4 w-4" />Notes de frais {expenses.length > 0 && <Badge variant="secondary" className="text-xs">{expenses.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ─ Factures ─ */}
          <TabsContent value="invoices" className="space-y-4 mt-4">
            {/* À revoir */}
            {reviewInv.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">À revoir</Badge>
                    {reviewInv.length} facture{reviewInv.length !== 1 ? "s" : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50">
                      <TableHead>Référence</TableHead><TableHead>Fournisseur</TableHead>
                      <TableHead>Date</TableHead><TableHead>Échéance</TableHead>
                      <TableHead className="text-right">Montant</TableHead><TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {reviewInv.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">{inv.referenceNumber}</TableCell>
                          <TableCell className="font-medium text-sm">{inv.supplierName ?? "—"}</TableCell>
                          <TableCell className="text-xs text-slate-500">{formatDate(inv.invoiceDate)}</TableCell>
                          <TableCell className="text-xs">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatFCFA(inv.totalAmount)}</TableCell>
                          <TableCell><InvBadge status={inv.status} isOverdue={inv.isOverdue} /></TableCell>
                          <TableCell><InvoiceActions invoice={inv} onRefresh={refresh} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Awaiting approval */}
            {awaitingInv.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">En att. approbation</Badge>
                    {awaitingInv.length} facture{awaitingInv.length !== 1 ? "s" : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50">
                      <TableHead>Référence</TableHead><TableHead>Fournisseur</TableHead>
                      <TableHead>Date</TableHead><TableHead>Échéance</TableHead>
                      <TableHead className="text-right">Montant</TableHead><TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {awaitingInv.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">{inv.referenceNumber}</TableCell>
                          <TableCell className="font-medium text-sm">{inv.supplierName ?? "—"}</TableCell>
                          <TableCell className="text-xs text-slate-500">{formatDate(inv.invoiceDate)}</TableCell>
                          <TableCell className="text-xs">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatFCFA(inv.totalAmount)}</TableCell>
                          <TableCell><InvBadge status={inv.status} isOverdue={inv.isOverdue} /></TableCell>
                          <TableCell><InvoiceActions invoice={inv} onRefresh={refresh} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {invoices.length === 0 && (
              <Card><CardContent className="py-12 text-center text-slate-500">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                <p>Aucune facture en attente d'approbation</p>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* ─ Bons de commande ─ */}
          <TabsContent value="pos" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {pos.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                    <p>Aucun BC en attente de confirmation</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50">
                      <TableHead>Référence</TableHead><TableHead>Fournisseur</TableHead>
                      <TableHead>Date</TableHead><TableHead>Livraison prévue</TableHead>
                      <TableHead className="text-right">Total</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {pos.map(po => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-xs">{po.reference}</TableCell>
                          <TableCell className="font-medium text-sm">{po.supplierName ?? "—"}</TableCell>
                          <TableCell className="text-xs text-slate-500">{formatDate(po.orderDate)}</TableCell>
                          <TableCell className="text-xs">{po.expectedDate ? formatDate(po.expectedDate) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatFCFA(po.totalFcfa)}</TableCell>
                          <TableCell><PoActions po={po} onRefresh={refresh} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─ Notes de frais ─ */}
          <TabsContent value="expenses" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {expenses.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                    <p>Aucune note de frais en attente d'approbation</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50">
                      <TableHead>Titre</TableHead><TableHead>Collaborateur</TableHead>
                      <TableHead>Soumis le</TableHead>
                      <TableHead className="text-right">Montant</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {expenses.map(exp => (
                        <TableRow key={exp.id}>
                          <TableCell className="font-medium text-sm">{exp.title}</TableCell>
                          <TableCell className="text-sm">{exp.collaboratorName}</TableCell>
                          <TableCell className="text-xs text-slate-500">{exp.submittedAt ? formatDate(exp.submittedAt) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatFCFA(exp.totalAmount)}</TableCell>
                          <TableCell><ExpenseActions expense={exp} onRefresh={refresh} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
