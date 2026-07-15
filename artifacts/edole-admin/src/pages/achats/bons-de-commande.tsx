import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search, ChevronRight, Package, ArrowRight, Trash2, CheckCircle2, XCircle, FileText, ChevronLeft, PackagePlus } from "lucide-react";
import { StatusBadgePO, StatusBadgePurchases, PO_STATUS_MAP, VendorSelect, type Supplier } from "./_shared";

// ─── Types ────────────────────────────────────────────────────────────────────

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
type LinkedInvoice = {
  id: string; referenceNumber: string; status: string;
  invoiceDate: string; dueDate: string | null;
  totalAmount: string | number; paidAmount: string | number;
};

const PAGE_SIZE = 25;

// ─── Quick Create Product dialog ──────────────────────────────────────────────

function QuickCreateProductDialog({
  onClose,
  onCreated,
  defaultSupplierId,
}: {
  onClose: () => void;
  onCreated: (product: Product) => void;
  defaultSupplierId?: string;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [price, setPrice] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Le nom du produit est requis"); return; }
    setSaving(true);
    try {
      const product = await apiFetch<Product>("/api/purchases/products", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          unit,
          purchasePriceFcfa: price,
          supplierId: defaultSupplierId ?? null,
        }),
      });
      toast.success(`Produit "${product.name}" créé (SKU : ${product.sku})`);
      onCreated(product);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la création du produit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-primary" />
            Créer un produit
          </DialogTitle>
          <DialogDescription>Ajout rapide au catalogue. Vous pourrez compléter les détails depuis le module Inventaire.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Nom du produit *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Ciment Portland 50 kg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Unité</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pcs", "kg", "t", "m", "m²", "m³", "l", "sac", "carton", "palette", "lot"].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prix achat HT (FCFA)</Label>
              <Input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white">
            {saving ? "Création…" : "Créer le produit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New PO dialog ────────────────────────────────────────────────────────────

function NewPoDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: productsRes } = useQuery<{ data: Product[] }>({
    queryKey: ["purchases-products"],
    queryFn: () => apiFetch("/api/purchases/products"),
  });
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const products = [...(productsRes?.data ?? []), ...localProducts.filter(lp => !(productsRes?.data ?? []).some(p => p.id === lp.id))];

  const [supplierId, setSupplierId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PoLine[]>([{ productId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 18 }]);
  const [saving, setSaving] = useState(false);
  const [quickCreateIdx, setQuickCreateIdx] = useState<number | null>(null);

  const addLine = () => setLines(l => [...l, { productId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 18 }]);
  const removeLine = (idx: number) => setLines(l => l.filter((_, i) => i !== idx));
  const updateLine = (idx: number, patch: Partial<PoLine>) => setLines(l => l.map((li, i) => i === idx ? { ...li, ...patch } : li));
  const selectProduct = (idx: number, pid: string) => {
    const p = products.find(p => p.id === pid);
    if (p) updateLine(idx, { productId: pid, description: p.name, unitPrice: Number(p.purchasePriceFcfa) || 0 });
  };
  const totalTtc = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 + l.taxRate / 100), 0);

  const handleProductCreated = (product: Product, lineIdx: number) => {
    setLocalProducts(prev => [...prev, product]);
    qc.invalidateQueries({ queryKey: ["purchases-products"] });
    updateLine(lineIdx, { productId: product.id, description: product.name, unitPrice: Number(product.purchasePriceFcfa) || 0 });
  };

  const handleSave = async () => {
    if (!supplierId) { toast.error("Sélectionnez un fournisseur"); return; }
    if (lines.some(l => !l.description)) { toast.error("Remplissez toutes les descriptions"); return; }
    setSaving(true);
    try {
      // Normalise productId: ne jamais envoyer "" (pas un UUID valide)
      const normalizedLines = lines.map(l => ({ ...l, productId: l.productId || null }));
      const po = await apiFetch<{ id: string }>("/api/purchases/purchase-orders", {
        method: "POST",
        body: JSON.stringify({ supplierId, deliveryDate: deliveryDate || undefined, notes: notes || undefined, lines: normalizedLines }),
      });
      toast.success("Bon de commande créé");
      onSuccess(po.id); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-[#2563EB]" /> Nouveau bon de commande</DialogTitle>
            <DialogDescription>Créez un BC pour commander auprès d'un fournisseur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fournisseur *</Label>
                <VendorSelect value={supplierId} onValueChange={setSupplierId} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label>Date livraison prévue</Label>
                  <FieldTooltip content="Date contractuelle à laquelle vous attendez la livraison. Tout écart entre cette date et la réception effective génère une alerte de retard." />
                </div>
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

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
                      <th className="text-right p-2 font-medium text-muted-foreground w-16">Qté</th>
                      <th className="text-right p-2 font-medium text-muted-foreground w-24">P.U. HT</th>
                      <th className="text-right p-2 font-medium text-muted-foreground w-14">
                        <span className="inline-flex items-center gap-0.5">TVA%<FieldTooltip content="Taux de TVA applicable à cette ligne (%). Le taux standard au Togo est de 18%. Certaines opérations sont exonérées ou à taux réduit." /></span>
                      </th>
                      <th className="text-right p-2 font-medium text-muted-foreground w-24">Total TTC</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-1.5 w-44">
                          <div className="flex items-center gap-1">
                            <Select value={l.productId || "_none"} onValueChange={(v) => v === "_none" ? updateLine(idx, { productId: "" }) : selectProduct(idx, v)}>
                              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Produit…" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">— Manuel —</SelectItem>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button" size="icon" variant="ghost"
                              className="h-7 w-7 shrink-0 text-primary hover:bg-primary/10"
                              title="Créer un produit"
                              onClick={() => setQuickCreateIdx(idx)}
                            >
                              <PackagePlus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-1.5"><Input className="h-7 text-xs" value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} placeholder="Description" /></td>
                        <td className="p-1.5"><Input className="h-7 text-xs text-right w-14" type="number" min="0.01" step="0.01" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })} /></td>
                        <td className="p-1.5"><Input className="h-7 text-xs text-right" type="number" min="0" value={l.unitPrice} onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })} /></td>
                        <td className="p-1.5"><Input className="h-7 text-xs text-right w-14" type="number" min="0" max="100" value={l.taxRate} onChange={(e) => updateLine(idx, { taxRate: Number(e.target.value) })} /></td>
                        <td className="p-1.5 text-right text-xs font-medium">{formatFCFA(l.quantity * l.unitPrice * (1 + l.taxRate / 100))}</td>
                        <td className="p-1.5"><Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => removeLine(idx)} disabled={lines.length === 1}><Trash2 className="w-3 h-3" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t">
                    <tr><td colSpan={5} className="p-2 text-right font-semibold text-sm">Total TTC</td><td className="p-2 text-right font-bold text-sm">{formatFCFA(totalTtc)}</td><td /></tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Astuce : cliquez sur <PackagePlus className="inline w-3 h-3 mx-0.5" /> pour créer un produit directement depuis cette ligne.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white">{saving ? "Création…" : "Créer le BC"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {quickCreateIdx !== null && (
        <QuickCreateProductDialog
          defaultSupplierId={supplierId || undefined}
          onClose={() => setQuickCreateIdx(null)}
          onCreated={(product) => handleProductCreated(product, quickCreateIdx)}
        />
      )}
    </>
  );
}

// ─── PO detail sheet ──────────────────────────────────────────────────────────

function PoDetailSheet({ poId, onClose, onRefresh }: { poId: string; onClose: () => void; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [updating, setUpdating] = useState(false);
  const [receptionQty, setReceptionQty] = useState<Record<string, string>>({});

  const { data: po, isLoading } = useQuery<PODetail>({
    queryKey: ["purchase-po-detail", poId],
    enabled: !!poId,
    queryFn: () => apiFetch(`/api/purchases/purchase-orders/${poId}`),
  });

  const { data: linkedInvRes } = useQuery<{ data: LinkedInvoice[] }>({
    queryKey: ["purchase-po-invoices", poId],
    enabled: !!poId,
    queryFn: () => apiFetch(`/api/purchases/purchase-orders/${poId}/invoices`),
  });
  const linkedInvoices = linkedInvRes?.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["purchase-po-detail", poId] });
    qc.invalidateQueries({ queryKey: ["purchase-po-invoices", poId] });
    onRefresh();
  };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/purchases/purchase-orders/${poId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success("Statut mis à jour");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setUpdating(false); }
  };

  const updateLineReception = async (lineId: string, qty: number) => {
    try {
      await apiFetch(`/api/purchases/purchase-orders/${poId}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ quantityReceived: qty }) });
      toast.success("Réception mise à jour");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const canReceive = po && ["confirmed", "partially_received", "sent"].includes(po.status);
  const createInvoice = () => { navigate("/achats/factures?from_bc=" + poId); onClose(); };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#2563EB]" />
            {isLoading ? "Chargement…" : po?.reference}
          </SheetTitle>
        </SheetHeader>

        {isLoading && <div className="space-y-3 py-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded" />)}</div>}
        {po && (
          <div className="space-y-5 py-4">
            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadgePO status={po.status} />
              <div className="flex-1" />
              <div className="flex gap-2 flex-wrap">
                {po.status === "draft" && <Button size="sm" onClick={() => updateStatus("sent")} disabled={updating} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs"><ArrowRight className="w-3.5 h-3.5" />Envoyer</Button>}
                {po.status === "sent" && <Button size="sm" onClick={() => updateStatus("confirmed")} disabled={updating} className="bg-teal-600 hover:bg-teal-700 text-white gap-1 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Confirmer</Button>}
                {["confirmed", "partially_received"].includes(po.status) && <Button size="sm" onClick={() => updateStatus("received")} disabled={updating} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Marquer Reçu</Button>}
                {["confirmed", "received", "partially_received"].includes(po.status) && (
                  <Button size="sm" variant="outline" onClick={createInvoice} className="gap-1 text-xs"><FileText className="w-3.5 h-3.5" />Créer facture</Button>
                )}
                {!["received", "cancelled", "facture"].includes(po.status) && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus("cancelled")} disabled={updating} className="text-red-600 border-red-200 hover:bg-red-50 gap-1 text-xs"><XCircle className="w-3.5 h-3.5" />Annuler</Button>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-4">
              <div><p className="text-xs text-muted-foreground">Fournisseur</p><p className="font-medium text-sm">{po.supplierName ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Livraison prévue</p><p className="font-medium text-sm">{po.expectedDate ? formatDate(String(po.expectedDate)) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-sm">{formatFCFA(Number(po.totalFcfa))}</p></div>
              <div><p className="text-xs text-muted-foreground">Créé le</p><p className="font-medium text-sm">{formatDate(po.createdAt)}</p></div>
            </div>

            {po.notes && <p className="text-sm text-muted-foreground italic bg-slate-50 rounded p-3">{po.notes}</p>}

            {/* Lines + reception */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Lignes ({po.lines.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">Produit / Description</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Qté</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Reçue</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">P.U.</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
                      {canReceive && <th className="w-32 p-2 font-medium text-muted-foreground">Réception</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {po.lines.map(l => {
                      const qtyRec = Number(l.quantityReceived ?? 0);
                      const qtyOrd = Number(l.quantity);
                      return (
                        <tr key={l.id} className="border-t">
                          <td className="p-2">
                            <p className="font-medium">{l.productName ?? l.description}</p>
                            {l.productSku && <p className="text-xs text-muted-foreground">{l.productSku}</p>}
                          </td>
                          <td className="p-2 text-right">{l.quantity}</td>
                          <td className="p-2 text-right">
                            <span className={qtyRec < qtyOrd ? "text-amber-600 font-medium" : "text-emerald-700 font-medium"}>
                              {qtyRec} / {qtyOrd}
                            </span>
                          </td>
                          <td className="p-2 text-right">{formatFCFA(Number(l.unitPriceFcfa))}</td>
                          <td className="p-2 text-right font-medium">{formatFCFA(Number(l.totalFcfa))}</td>
                          {canReceive && (
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  className="h-7 text-xs w-16 text-right"
                                  type="number" min="0" max={qtyOrd}
                                  value={receptionQty[l.id] ?? String(qtyRec)}
                                  onChange={(e) => setReceptionQty(prev => ({ ...prev, [l.id]: e.target.value }))}
                                />
                                <Button size="icon" className="h-7 w-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => updateLineReception(l.id, Number(receptionQty[l.id] ?? qtyRec))}>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t">
                    <tr>
                      <td colSpan={4} className="p-2 text-right font-semibold">Total</td>
                      <td className="p-2 text-right font-bold">{formatFCFA(Number(po.totalFcfa))}</td>
                      {canReceive && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Linked invoices */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Factures liées ({linkedInvoices.length})</h3>
              {linkedInvoices.length === 0 && <p className="text-sm text-muted-foreground italic">Aucune facture liée à ce BC.</p>}
              <div className="space-y-2">
                {linkedInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between bg-slate-50 rounded p-3 text-sm">
                    <div>
                      <span className="font-mono font-medium">{inv.referenceNumber}</span>
                      <span className="text-muted-foreground ml-2">· {formatFCFA(Number(inv.totalAmount))}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadgePurchases status={inv.status} />
                      <span className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)}</span>
                    </div>
                  </div>
                ))}
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
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { setPage(0); }, [filterStatus, filterSupplier, searchQ, dateFrom, dateTo]);

  const { data: suppliersRes } = useQuery<{ data: Supplier[] }>({
    queryKey: ["purchases-suppliers-list"],
    queryFn: () => apiFetch("/api/purchases/suppliers?limit=200"),
    staleTime: 60_000,
  });
  const suppliers = suppliersRes?.data ?? [];

  const qParams: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) };
  if (filterStatus !== "all") qParams.status = filterStatus;
  if (filterSupplier !== "all") qParams.supplierId = filterSupplier;
  if (searchQ) qParams.search = searchQ;
  if (dateFrom) qParams.dateFrom = dateFrom;
  if (dateTo) qParams.dateTo = dateTo;

  const { data: res, isLoading } = useQuery<{ data: PO[]; total: number }>({
    queryKey: ["purchases-pos", filterStatus, filterSupplier, searchQ, dateFrom, dateTo, page],
    queryFn: () => apiFetch("/api/purchases/purchase-orders?" + new URLSearchParams(qParams).toString()),
  });
  const pos = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const refresh = () => qc.invalidateQueries({ queryKey: ["purchases-pos"] });

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Bons de commande"
        subtitle={`${total} BC`}
        actions={<Button onClick={() => setNewOpen(true)} className="bg-primary hover:bg-primary/90 text-white gap-2"><Plus className="w-4 h-4" />Nouveau BC</Button>}
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Référence…" className="pl-9" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tous statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(PO_STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
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
          <Input type="date" className="w-36 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Date commande du" />
          <span className="text-muted-foreground text-xs px-1">→</span>
          <Input type="date" className="w-36 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Date commande au" />
        </div>
        {(filterStatus !== "all" || filterSupplier !== "all" || searchQ || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterSupplier("all"); setSearchQ(""); setDateFrom(""); setDateTo(""); }}>Effacer</Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date commande</TableHead>
                <TableHead>Livraison prévue</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3].map(i => (
                <TableRow key={i}>{[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))}
              {!isLoading && pos.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Aucun bon de commande trouvé.</TableCell></TableRow>
              )}
              {pos.map(po => (
                <TableRow key={po.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedId(po.id)}>
                  <TableCell className="font-mono text-sm font-medium">{po.reference}</TableCell>
                  <TableCell className="text-sm">{po.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{po.orderDate ? formatDate(String(po.orderDate)) : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{po.expectedDate ? formatDate(String(po.expectedDate)) : "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatFCFA(Number(po.totalFcfa))}</TableCell>
                  <TableCell><StatusBadgePO status={po.status} /></TableCell>
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

      {newOpen && <NewPoDialog onClose={() => setNewOpen(false)} onSuccess={(id) => { refresh(); setSelectedId(id); }} />}
      {selectedId && <PoDetailSheet poId={selectedId} onClose={() => setSelectedId(null)} onRefresh={refresh} />}
    </div>
  );
}
