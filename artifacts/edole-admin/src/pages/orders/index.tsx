import React, { useState } from "react";
import { usePermissions } from "@/lib/permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatFCFA } from "@/lib/format";
import { Plus, Search, Filter, ShoppingCart, Calendar, Building, Receipt, Pencil, XCircle, AlertTriangle, Clock, ShieldAlert, Mail, Printer, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { LineItemsEditor, LineItem, computeTotals } from "@/components/commercial/LineItemsEditor";
import { SendEmailDialog } from "@/components/commercial/SendEmailDialog";
import { PageHeader, StatusTabs } from "@/components/ui/page-header";

type Client = { id: string; name: string };
type Order = {
  id: string; referenceNumber: string; status: string;
  totalAmount: number | null; clientId: string | null; clientName: string | null;
  createdAt: string; notes: string | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Brouillon",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  confirmed: { label: "Confirmée", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  delivered: { label: "Livrée",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Annulée",   cls: "bg-red-50 text-red-400 border-red-200" },
};

const EDIT_ALLOWED: Record<string, string[]> = {
  draft:     ["clientId", "totalAmount", "notes"],
  confirmed: ["notes"],
};

const CANCEL_RULES: Record<string, { allowed: boolean; needsReason: boolean; warning?: string; blocked?: string }> = {
  draft:     { allowed: true,  needsReason: false },
  confirmed: { allowed: true,  needsReason: true, warning: "Cette commande a déjà été confirmée. L'annulation sera tracée dans la piste d'audit et notifiée." },
  delivered: { allowed: false, needsReason: false, blocked: "Une commande livrée ne peut pas être annulée. Créez un avoir ou contactez votre responsable pour toute régularisation." },
  cancelled: { allowed: false, needsReason: false, blocked: "Cette commande est déjà annulée." },
};

// ─── NewOrderDialog ───────────────────────────────────────────────────────────

type CreditRisk = {
  encours: number; overdueAmount: number; overdueCount: number;
  creditLimit: number | null; utilisationPct: number | null;
  riskScore: "low" | "medium" | "high" | "critical";
};

function NewOrderDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: clientsData } = useQuery<{ data: Client[] }>({ queryKey: ["clients-list"], queryFn: () => apiFetch("/api/clients?limit=100") });
  const clients = clientsData?.data ?? [];
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const totals = computeTotals(lines);

  const { data: creditRisk } = useQuery<CreditRisk>({
    queryKey: ["credit-risk", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/credit-risk`),
    enabled: !!clientId,
    staleTime: 30_000,
  });

  const orderTotal = totals.totalTTC;
  const projectedEncours = creditRisk ? creditRisk.encours + orderTotal : null;
  const overLimit = creditRisk?.creditLimit && projectedEncours !== null && projectedEncours > creditRisk.creditLimit;
  const utilisationAfter = creditRisk?.creditLimit && creditRisk.creditLimit > 0 && projectedEncours !== null
    ? Math.round((projectedEncours / creditRisk.creditLimit) * 100)
    : null;

  const handleSave = async () => {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    if (lines.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSaving(true);
    try {
      const order = await apiFetch<{ id: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ clientId, totalAmount: totals.totalTTC, currency: "XOF", status, notes: notes || undefined }),
      });
      await apiFetch(`/api/orders/${order.id}/lines`, { method: "PUT", body: JSON.stringify({ lines }) });
      toast.success("Commande créée avec succès");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-[#2563EB]" /> Créer une commande</DialogTitle>
          <DialogDescription>Bon de commande client — vous pourrez générer la facture depuis ce tableau.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
                <SelectContent>
                  {clients.length === 0
                    ? <div className="px-3 py-2 text-sm text-muted-foreground">Aucun client</div>
                    : clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut initial</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="confirmed">Confirmée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Alerte limite de crédit ── */}
          {creditRisk && creditRisk.creditLimit && (
            <div className={`rounded-lg border p-3 text-sm flex items-start gap-3 ${
              overLimit
                ? "border-red-300 bg-red-50 text-red-800"
                : utilisationAfter !== null && utilisationAfter >= 80
                ? "border-orange-300 bg-orange-50 text-orange-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}>
              <CreditCard className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="space-y-0.5 flex-1 min-w-0">
                <p className="font-semibold text-xs">
                  {overLimit ? "⚠️ Limite de crédit dépassée" : "Encours client"}
                </p>
                <p className="text-[11px]">
                  Encours actuel : <strong>{formatFCFA(creditRisk.encours)}</strong>
                  {orderTotal > 0 && <> · Cette commande : <strong>{formatFCFA(orderTotal)}</strong> → Total projeté : <strong>{formatFCFA(projectedEncours ?? 0)}</strong></>}
                </p>
                <p className="text-[11px]">
                  Limite autorisée : <strong>{formatFCFA(creditRisk.creditLimit)}</strong>
                  {utilisationAfter !== null && <> · Utilisation : <strong>{utilisationAfter}%</strong></>}
                  {creditRisk.overdueCount > 0 && <span className="ml-2 text-red-700 font-bold"> · {creditRisk.overdueCount} facture(s) échue(s)</span>}
                </p>
                {overLimit && (
                  <p className="text-[11px] font-semibold mt-1">
                    Cette commande dépasse la limite de crédit de {formatFCFA((projectedEncours ?? 0) - creditRisk.creditLimit)}. Vous pouvez quand même l'enregistrer.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Lignes de la commande</Label>
            <LineItemsEditor lines={lines} onChange={setLines} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes / Objet</Label>
            <Textarea rows={2} placeholder="Objet de la commande, conditions particulières…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !clientId || lines.length === 0} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">
            {saving ? "Création…" : totals.totalTTC > 0 ? `Créer la commande — ${formatFCFA(totals.totalTTC)}` : "Créer la commande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EditOrderDialog ──────────────────────────────────────────────────────────

function EditOrderDialog({ order, onClose, onSuccess }: { order: Order; onClose: () => void; onSuccess: () => void }) {
  const { data: clientsData } = useQuery<{ data: Client[] }>({ queryKey: ["clients-list"], queryFn: () => apiFetch("/api/clients?limit=100") });
  const clients = clientsData?.data ?? [];
  const editable = EDIT_ALLOWED[order.status] ?? [];
  const canEdit = (f: string) => editable.includes(f);

  const [clientId, setClientId] = useState(order.clientId ?? "");
  const [amount, setAmount] = useState(String(order.totalAmount ?? ""));
  const [notes, setNotes] = useState(order.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/orders/${order.id}/edit`, {
        method: "PATCH",
        body: JSON.stringify({
          clientId: canEdit("clientId") ? clientId || undefined : undefined,
          totalAmount: canEdit("totalAmount") ? Number(amount) : undefined,
          notes: canEdit("notes") ? notes || undefined : undefined,
        }),
      });
      toast.success("Commande mise à jour");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-[#2563EB]" /> Modifier la commande</DialogTitle>
          <DialogDescription>
            <strong>{order.referenceNumber}</strong> · {STATUS_MAP[order.status]?.label}
            {order.status === "confirmed" && <span className="ml-2 text-amber-600 text-xs">⚠ Commande confirmée — seules les notes sont modifiables.</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {canEdit("clientId") && (
            <div className="space-y-1">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {canEdit("totalAmount") && (
            <div className="space-y-1"><Label>Montant (FCFA)</Label><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          )}
          {canEdit("notes") && (
            <div className="space-y-1"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CancelOrderDialog ────────────────────────────────────────────────────────

function CancelOrderDialog({ order, onClose, onSuccess }: { order: Order; onClose: () => void; onSuccess: () => void }) {
  const rules = CANCEL_RULES[order.status] ?? { allowed: false, needsReason: false };
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCancel = async () => {
    if (rules.needsReason && !reason.trim()) { toast.error("Une justification est requise"); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/orders/${order.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason || undefined }) });
      toast.success("Commande annulée");
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur lors de l'annulation"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700"><XCircle className="w-5 h-5" /> Annuler la commande</DialogTitle>
          <DialogDescription><strong>{order.referenceNumber}</strong> · {order.clientName}</DialogDescription>
        </DialogHeader>
        {rules.blocked ? (
          <div className="py-2 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Annulation bloquée — Contrôle interne</p>
              <p className="text-sm text-red-600 mt-1">{rules.blocked}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {rules.warning && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">{rules.warning}</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>{rules.needsReason ? "Motif d'annulation *" : "Motif d'annulation (optionnel)"}</Label>
              <Textarea rows={3} placeholder="Ex : demande du client, conditions non remplies…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Cette action est tracée dans la piste d'audit.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Retour</Button>
          {rules.allowed && (
            <Button variant="destructive" onClick={handleCancel} disabled={saving || (rules.needsReason && !reason.trim())}>
              {saving ? "Annulation…" : "Confirmer l'annulation"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersList() {
  const qc = useQueryClient();
  const perms = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [sendEmailTarget, setSendEmailTarget] = useState<Order | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Order[] }>({
    queryKey: ["orders"],
    queryFn: () => apiFetch("/api/orders?limit=50"),
  });

  const allOrders = data?.data ?? [];
  const orders = allOrders.filter(o =>
    (statusFilter === "all" || o.status === statusFilter) &&
    (!search || o.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (o.clientName ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const generateInvoice = async (orderId: string) => {
    setGeneratingId(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}/generate-invoice`, { method: "POST" });
      toast.success("Facture générée et comptabilisée");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("déjà générée")) toast.info("Une facture a déjà été générée pour cette commande");
      else toast.error(msg || "Erreur lors de la génération");
    } finally { setGeneratingId(null); }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <PageHeader
        title="Bons de commande"
        subtitle={`${allOrders.length} commande${allOrders.length !== 1 ? "s" : ""} au total`}
        icon={ShoppingCart}
        actions={!perms.isReadOnly ? (
          <Button onClick={() => setNewOpen(true)} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold gap-1.5">
            <Plus className="w-4 h-4" strokeWidth={3} /> Créer une commande
          </Button>
        ) : undefined}
      />
      <StatusTabs
        tabs={[
          { key: "all",       label: "Toutes",      count: allOrders.length },
          { key: "draft",     label: "Brouillons",  count: allOrders.filter(o => o.status === "draft").length },
          { key: "confirmed", label: "Confirmées",  count: allOrders.filter(o => o.status === "confirmed").length },
          { key: "delivered", label: "Livrées",     count: allOrders.filter(o => o.status === "delivered").length },
          { key: "cancelled", label: "Annulées",    count: allOrders.filter(o => o.status === "cancelled").length },
        ]}
        active={statusFilter}
        onChange={setStatusFilter}
      />

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Historique des commandes</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="N° Commande, Client…" className="pl-9 bg-slate-50 h-9"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" className="h-9"><Filter className="w-4 h-4 mr-2" /> Filtres</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">N° Commande</TableHead>
                  <TableHead className="font-semibold text-slate-600">Client</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Date de création</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Total</TableHead>
                  <TableHead className="w-56 font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <ShoppingCart className="w-12 h-12 text-slate-300 mb-4 mx-auto" />
                      <p className="text-lg font-medium text-slate-600">Aucune commande trouvée.</p>
                      <p className="text-sm mt-1">Cliquez sur « Créer une commande » pour commencer.</p>
                    </TableCell>
                  </TableRow>
                ) : orders.map(order => {
                  const st = STATUS_MAP[order.status] ?? { label: order.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                  const isCancelled = order.status === "cancelled";
                  const canEditDoc = !perms.isReadOnly && !!EDIT_ALLOWED[order.status];
                  const canCancelDoc = !perms.isReadOnly && CANCEL_RULES[order.status]?.allowed === true;
                  const isCancelBlocked = !CANCEL_RULES[order.status]?.allowed && !isCancelled;

                  return (
                    <TableRow key={order.id} className={`hover:bg-slate-50/50 ${isCancelled ? "opacity-60" : ""}`}>
                      <TableCell className="font-mono text-sm font-bold text-primary">{order.referenceNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-sm text-slate-800">{order.clientName || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />{formatDate(order.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${st.cls}`}>{st.label}</span>
                      </TableCell>
                      <TableCell className="text-right"><span className="font-semibold">{formatFCFA(order.totalAmount ?? 0)}</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {!isCancelled && !perms.isReadOnly && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5"
                              disabled={generatingId === order.id} onClick={() => generateInvoice(order.id)}>
                              <Receipt className="w-3 h-3" />{generatingId === order.id ? "…" : "Facturer"}
                            </Button>
                          )}
                          {!isCancelled && !perms.isReadOnly && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => setSendEmailTarget(order)}>
                              <Mail className="w-3 h-3" /> Email
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-0.5 text-slate-600 border-slate-200 hover:bg-slate-50"
                            onClick={() => window.open(`/documents/order/${order.id}/print`, "_blank")}>
                            <Printer className="w-3 h-3" /> PDF
                          </Button>
                          {canEditDoc && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-600 hover:bg-slate-100"
                              onClick={() => setEditTarget(order)}>
                              <Pencil className="w-3 h-3 mr-0.5" /> Modifier
                            </Button>
                          )}
                          {(canCancelDoc || isCancelBlocked) && !isCancelled && (
                            <Button size="sm" variant="ghost"
                              className={`h-7 text-xs ${isCancelBlocked ? "text-slate-400" : "text-red-600 hover:bg-red-50 hover:text-red-700"}`}
                              onClick={() => setCancelTarget(order)}>
                              <XCircle className="w-3 h-3 mr-0.5" /> Annuler
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {newOpen && <NewOrderDialog onClose={() => setNewOpen(false)} onSuccess={invalidate} />}
      {editTarget && <EditOrderDialog order={editTarget} onClose={() => setEditTarget(null)} onSuccess={invalidate} />}
      {cancelTarget && <CancelOrderDialog order={cancelTarget} onClose={() => setCancelTarget(null)} onSuccess={invalidate} />}
      {sendEmailTarget && (
        <SendEmailDialog
          docType="order"
          docId={sendEmailTarget.id}
          referenceNumber={sendEmailTarget.referenceNumber}
          clientName={sendEmailTarget.clientName ?? null}
          clientEmail={null}
          totalAmount={sendEmailTarget.totalAmount ?? null}
          onClose={() => setSendEmailTarget(null)}
        />
      )}
    </div>
  );
}
