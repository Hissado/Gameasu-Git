import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ThumbsUp, AlertTriangle, Clock, ArrowRight } from "lucide-react";
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

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  review:            { label: "À revoir",            cls: "bg-blue-50 text-blue-700 border-blue-200" },
  awaiting_approval: { label: "En att. approbation", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── Reject dialog ────────────────────────────────────────────────────────────

function RejectDialog({ invoice, onClose, onSuccess }: {
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
        body: JSON.stringify({ status: "rejected" }),
      });
      toast.success("Facture refusée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Refuser la facture</DialogTitle>
          <DialogDescription>{invoice.referenceNumber} · {invoice.supplierName ?? "—"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="text-sm font-medium">Motif du refus</label>
          <Textarea
            placeholder="Expliquez la raison du refus…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button variant="destructive" onClick={handleReject} disabled={saving}>
            {saving ? "En cours…" : "Refuser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatsApprobations() {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<PendingInvoice | null>(null);

  const { data, isLoading, refetch } = useQuery<{ data: PendingInvoice[]; total: number }>({
    queryKey: ["purchases-approvals-pending"],
    queryFn: () => apiFetch("/api/purchases/approvals/pending"),
    refetchInterval: 30000,
  });

  const invoices = data?.data ?? [];
  const reviewList = invoices.filter(i => i.status === "review");
  const pendingList = invoices.filter(i => i.status === "awaiting_approval");

  const approve = async (inv: PendingInvoice, toStatus: "awaiting_approval" | "approved" | "pending") => {
    try {
      await apiFetch(`/api/purchases/invoices/${inv.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: toStatus }),
      });
      toast.success(toStatus === "awaiting_approval" ? "Transmise pour approbation" : "Facture approuvée");
      refetch();
      qc.invalidateQueries({ queryKey: ["purchases-overview"] });
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const totalAmount = invoices.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Approbations"
        subtitle={`${invoices.length} facture${invoices.length !== 1 ? "s" : ""} en attente de traitement`}
      />

      {/* Summary bar */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-blue-50 rounded-lg p-2"><Clock className="w-4 h-4 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">À revoir</p>
                <p className="text-xl font-bold">{reviewList.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-yellow-50 rounded-lg p-2"><ThumbsUp className="w-4 h-4 text-yellow-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">En attente d'approbation</p>
                <p className="text-xl font-bold">{pendingList.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-orange-50 rounded-lg p-2"><AlertTriangle className="w-4 h-4 text-[#F37021]" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Montant total</p>
                <p className="text-xl font-bold">{formatFCFA(totalAmount)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* À revoir */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            À revoir ({reviewList.length})
          </h2>
          <Link href="/achats/factures" className="text-xs text-[#F37021] flex items-center gap-1 hover:underline">
            Voir toutes les factures <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date facture</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && [1, 2].map(i => (
                  <TableRow key={i}>{[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))}
                {!isLoading && reviewList.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Aucune facture à revoir.</TableCell></TableRow>
                )}
                {reviewList.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium text-sm">{inv.supplierName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.referenceNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell className="text-sm">
                      {inv.dueDate ? (
                        <span className={inv.isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {inv.isOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {formatDate(inv.dueDate)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatFCFA(inv.totalAmount)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                          onClick={() => approve(inv, "awaiting_approval")}>
                          <ThumbsUp className="w-3 h-3" /> Transmettre
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50"
                          onClick={() => setRejecting(inv)} title="Refuser">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Awaiting approval */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          En attente d'approbation finale ({pendingList.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date facture</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoading && pendingList.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Aucune facture en attente d'approbation finale.</TableCell></TableRow>
                )}
                {pendingList.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium text-sm">{inv.supplierName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.referenceNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell className="text-sm">
                      {inv.dueDate ? (
                        <span className={inv.isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {inv.isOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {formatDate(inv.dueDate)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatFCFA(inv.totalAmount)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => approve(inv, "pending")}>
                          <CheckCircle2 className="w-3 h-3" /> Approuver
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50"
                          onClick={() => setRejecting(inv)} title="Refuser">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {rejecting && (
        <RejectDialog
          invoice={rejecting}
          onClose={() => setRejecting(null)}
          onSuccess={() => { refetch(); qc.invalidateQueries({ queryKey: ["purchases-overview"] }); }}
        />
      )}
    </div>
  );
}
