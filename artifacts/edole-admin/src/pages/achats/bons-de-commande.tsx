import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Plus, Search, ChevronRight, Package, ArrowRight, Trash2, CheckCircle2, XCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = { id: string; name: string; code: string };
type Product = { id: string; name: string; sku: string; purchasePriceFcfa: string | number; unit: string | null };
type PoLine = { productId: string; description: string; quantity: number; unitPrice: number; taxRate: number };
type PO = {
  id: string; reference: string; status: string;
  orderDate: string | null; expectedDate: string | null;
  totalFcfa: string | number; notes: string | null;
  supplierId: string; supplierName: string | null; supplierCode: string | null;
  createdAt: string;
};
type PODetail = PO & {
  supplierPhone: string | null; receivedDate: string | null;
  lines: PoLineDetail[];
};
type PoLineDetail = {
  id: string; productId: string; productName: string | null; productSku: string | null;
  description: string; quantity: string; unitPriceFcfa: string; quantityReceived: string | null; totalFcfa: string;
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const PO_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Brouillon",           cls: "bg-slate-100 text-slate-600 border-slate-200" },
  sent:               { label: "Envoyé",              cls: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed:          { label: "Confirmé",            cls: "bg-teal-50 text-teal-700 border-teal-200" },
  partially_received: { label: "Part. reçu",          cls: "bg-amber-50 text-amber-700 border-amber-200" },
  received:           { label: "Reçu",                cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled:          { label: "Annulé",              cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

function StatusBadge({ status }: { status: string }) {
  const s = PO_STATUS_MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>;
}

// ─── New PO dialog ────────────────────────────────────────────────────────────

function NewPoDialog({ suppliers, onClose, onSuccess }: { suppliers: Supplier[]; onClose: () => void; onSuccess: (id: string) => void }) {
  const { data: productsRes } = useQuery<{ data: Product[] }>({
    queryKey: ["purchases-products"],
    queryFn: () => apiFetch("/api/purchases/products"),
  });
  const products = productsRes?.data ?? [];

  const [supplierId, setSupplierId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PoLine[]>([{ productId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines(l => [...l, { productId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
  const removeLine = (idx: number) => setLines(l => l.filter((_, i) => i !== idx));
  const updateLine = (idx: number, patch: Partial<PoLine>) => setLines(l => l.map((li, i) => i === idx ? { ...li, ...patch } : li));
  const selectProduct = (idx: number, pid: string) => {
    const p = products.find(p => p.id === pid);
    if (p) updateLine(idx, { productId: pid, description: p.name, unitPrice: Number(p.purchasePriceFcfa) || 0 });
  };

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const handleSave = async () => {
    if (!supplierId) { toast.error("Sélectionnez un fournisseur"); return; }
    if (lines.some(l => !l.productId || !l.description)) { toast.error("Remplissez toutes les lignes"); return; }
    setSaving(true);
    try {
      const po = await apiFetch<{ id: string }>("/api/purchases/purchase-orders", {
        method: "POST",
        body: JSON.stringify({ supplierId, deliveryDate: deliveryDate || undefined, notes: notes || undefined, lines }),
      });
      toast.success("Bon de commande créé");
      onSuccess(po.id); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-[#F37021]" /> Nouveau bon de commande</DialogTitle>
          <DialogDescription>Créez un BC pour commander auprès d'un fournisseur.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fournisseur *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Date de livraison prévue</Label><Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Lignes de commande *</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="w-3 h-3 mr-1" />Ajouter</Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2 font-medium text-muted-foreground">Produit</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right p-2 font-medium text-muted-foreground w-20">Qté</th>
                    <th className="text-right p-2 font-medium text-muted-foreground w-28">Prix unit.</th>
                    <th className="text-right p-2 font-medium text-muted-foreground w-28">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">
                        <Select value={l.productId} onValueChange={(v) => selectProduct(idx, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produit…" /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-2"><Input className="h-8 text-xs" value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} /></td>
                      <td className="p-2"><Input className="h-8 text-xs text-right" type="number" min="1" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })} /></td>
                      <td className="p-2"><Input className="h-8 text-xs text-right" type="number" min="0" value={l.unitPrice} onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })} /></td>
                      <td className="p-2 text-right font-medium">{formatFCFA(l.quantity * l.unitPrice)}</td>
                      <td className="p-2"><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => removeLine(idx)} disabled={lines.length === 1}><Trash2 className="w-3 h-3" /></Button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t">
                  <tr><td colSpan={4} className="p-2 text-right font-semibold text-sm">Total</td><td className="p-2 text-right font-bold text-sm">{formatFCFA(total)}</td><td /></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#F37021] hover:bg-[#d96318] text-white">{saving ? "Création…" : "Créer le BC"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PO detail sheet ──────────────────────────────────────────────────────────

function PoDetailSheet({ poId, onClose, onRefresh }: { poId: string; onClose: () => void; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [updating, setUpdating] = useState(false);

  const { data: po, isLoading } = useQuery<PODetail>({
    queryKey: ["purchase-po-detail", poId],
    enabled: !!poId,
    queryFn: () => apiFetch(`/api/purchases/purchase-orders/${poId}`),
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["purchase-po-detail", poId] }); onRefresh(); };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/purchases/purchase-orders/${poId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success("Statut mis à jour");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setUpdating(false); }
  };

  const createInvoice = () => {
    navigate("/achats/factures?from_bc=" + poId);
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#F37021]" />
            {isLoading ? "Chargement…" : po?.reference}
          </SheetTitle>
        </SheetHeader>

        {isLoading && <div className="space-y-3 py-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded" />)}</div>}
        {po && (
          <div className="space-y-6 py-4">
            {/* Status + actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={po.status} />
              <div className="flex-1" />
              {po.status === "draft" && (
                <Button size="sm" onClick={() => updateStatus("sent")} disabled={updating} className="bg-blue-600 hover:bg-blue-700 text-white gap-1"><ArrowRight className="w-4 h-4" /> Marquer Envoyé</Button>
              )}
              {po.status === "sent" && (
                <Button size="sm" onClick={() => updateStatus("confirmed")} disabled={updating} className="bg-teal-600 hover:bg-teal-700 text-white gap-1"><CheckCircle2 className="w-4 h-4" /> Confirmer</Button>
              )}
              {["confirmed", "partially_received"].includes(po.status) && (
                <Button size="sm" onClick={() => updateStatus("received")} disabled={updating} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"><CheckCircle2 className="w-4 h-4" /> Marquer Reçu</Button>
              )}
              {["confirmed", "received", "partially_received"].includes(po.status) && (
                <Button size="sm" variant="outline" onClick={createInvoice} className="gap-1"><ArrowRight className="w-4 h-4" /> Créer facture</Button>
              )}
              {!["received", "cancelled"].includes(po.status) && (
                <Button size="sm" variant="outline" onClick={() => updateStatus("cancelled")} disabled={updating} className="text-red-600 border-red-200 hover:bg-red-50 gap-1"><XCircle className="w-4 h-4" /> Annuler</Button>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-4">
              <div><p className="text-xs text-muted-foreground">Fournisseur</p><p className="font-medium text-sm">{po.supplierName ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Livraison prévue</p><p className="font-medium text-sm">{po.expectedDate ? formatDate(String(po.expectedDate)) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-sm">{formatFCFA(Number(po.totalFcfa))}</p></div>
              <div><p className="text-xs text-muted-foreground">Créé le</p><p className="font-medium text-sm">{formatDate(po.createdAt)}</p></div>
            </div>

            {po.notes && <p className="text-sm text-muted-foreground italic bg-slate-50 rounded p-3">{po.notes}</p>}

            {/* Lines */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Lignes de commande ({po.lines.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">Produit / Description</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Qté cmd</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Qté reçue</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">P.U.</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.lines.map(l => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">
                          <p className="font-medium">{l.productName ?? l.description}</p>
                          {l.productSku && <p className="text-xs text-muted-foreground">{l.productSku}</p>}
                        </td>
                        <td className="p-2 text-right">{l.quantity}</td>
                        <td className="p-2 text-right">
                          <span className={Number(l.quantityReceived) < Number(l.quantity) ? "text-amber-600" : "text-emerald-700"}>
                            {l.quantityReceived ?? "0"}
                          </span>
                        </td>
                        <td className="p-2 text-right">{formatFCFA(Number(l.unitPriceFcfa))}</td>
                        <td className="p-2 text-right font-medium">{formatFCFA(Number(l.totalFcfa))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t">
                    <tr><td colSpan={4} className="p-2 text-right font-semibold">Total</td><td className="p-2 text-right font-bold">{formatFCFA(Number(po.totalFcfa))}</td></tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatsBonsCommande() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: suppliersRes } = useQuery<{ data: Supplier[] }>({
    queryKey: ["purchases-suppliers-list"],
    queryFn: () => apiFetch("/api/purchases/suppliers?limit=200"),
  });
  const suppliers = suppliersRes?.data ?? [];

  const qParams: Record<string, string> = { limit: "100" };
  if (filterStatus !== "all") qParams.status = filterStatus;
  if (filterSupplier !== "all") qParams.supplierId = filterSupplier;
  if (searchQ) qParams.search = searchQ;

  const { data: res, isLoading } = useQuery<{ data: PO[]; total: number }>({
    queryKey: ["purchases-pos", filterStatus, filterSupplier, searchQ],
    queryFn: () => apiFetch("/api/purchases/purchase-orders?" + new URLSearchParams(qParams).toString()),
  });
  const pos = res?.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-pos"] });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Bons de commande"
        subtitle={`${res?.total ?? 0} BC`}
        actions={<Button onClick={() => setNewOpen(true)} className="bg-[#F37021] hover:bg-[#d96318] text-white gap-2"><Plus className="w-4 h-4" />Nouveau BC</Button>}
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher par référence…" className="pl-9" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(PO_STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tous les fournisseurs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les fournisseurs</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Livraison prévue</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && pos.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Aucun bon de commande trouvé.</TableCell></TableRow>
              )}
              {pos.map(po => (
                <TableRow key={po.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedId(po.id)}>
                  <TableCell className="font-mono text-sm font-medium">{po.reference}</TableCell>
                  <TableCell className="text-sm">{po.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{po.expectedDate ? formatDate(String(po.expectedDate)) : "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatFCFA(Number(po.totalFcfa))}</TableCell>
                  <TableCell><StatusBadge status={po.status} /></TableCell>
                  <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {newOpen && (
        <NewPoDialog
          suppliers={suppliers}
          onClose={() => setNewOpen(false)}
          onSuccess={(id) => { refresh(); setSelectedId(id); }}
        />
      )}

      {selectedId && (
        <PoDetailSheet poId={selectedId} onClose={() => setSelectedId(null)} onRefresh={refresh} />
      )}
    </div>
  );
}
