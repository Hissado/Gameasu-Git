import React, { useState, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, Search, AlertTriangle, ShoppingCart, TrendingDown, TrendingUp,
  CheckCircle2, Truck, Settings, BarChart3, FileText, Trash2, ArrowDownToLine,
  ArrowUpFromLine, RefreshCw, Tag, Archive,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const CATEGORY_COLORS = ["#2563EB", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444"];
const KIND_LABELS: Record<string, string> = { in: "Entrée", out: "Sortie", adjust: "Ajustement" };

type Product = {
  id: string; sku: string; name: string; description?: string | null;
  categoryId?: string | null; unit: string;
  purchasePriceFcfa: string; sellingPriceFcfa: string; taxRatePct: string;
  minStock: string; primarySupplierId?: string | null;
  imageUrl?: string | null; isActive: boolean;
  stockOnHand: number; stockValueFcfa: number; isLowStock: boolean;
};
type Category = { id: string; name: string; description?: string | null };
type Supplier = { id: string; name: string; code: string };
type StockMovement = {
  id: string; productId: string; kind: string; quantity: string;
  unitCostFcfa: string | null; referenceLabel: string | null; reason: string | null;
  occurredAt: string; productName?: string; productSku?: string;
};
type PO = {
  id: string; reference: string; supplierId: string; supplierName?: string;
  status: string; orderDate: string; expectedDate: string | null; receivedDate: string | null;
  totalFcfa: string; notes: string | null;
};
type POLine = {
  id: string; productId: string; productName?: string; productSku?: string; productUnit?: string;
  quantity: string; unitPriceFcfa: string; quantityReceived: string; totalFcfa: string;
  description?: string | null;
};
type POWithLines = PO & { lines: POLine[]; supplier?: Supplier };

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", partial: "Partiel",
  received: "Réceptionné", cancelled: "Annulé",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const TABS = ["overview", "products", "stock", "purchases", "movements", "alerts", "reports"] as const;
type TabKey = typeof TABS[number];

export default function InventoryHub() {
  const [, params] = useRoute("/stock/:tab");
  const [, setLocation] = useLocation();
  const initialTab = (params?.tab && (TABS as readonly string[]).includes(params.tab) ? params.tab : "overview") as TabKey;
  const [tab, setTab] = useState<TabKey>(initialTab);

  const changeTab = (t: string) => {
    setTab(t as TabKey);
    setLocation(t === "overview" ? "/stock" : `/stock/${t}`, { replace: true });
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-orange-500/10 p-2 text-orange-600"><Package className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold">Produits & Stock</h1>
          <p className="text-sm text-muted-foreground">Référentiel articles, achats fournisseurs, mouvements de stock et valorisation.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="grid grid-cols-4 sm:grid-cols-7 w-full mb-4 h-auto">
          <TabsTrigger value="overview" className="flex-col sm:flex-row gap-0 sm:gap-1 py-2 sm:py-1.5 text-xs sm:text-sm"><BarChart3 className="h-4 w-4 sm:mr-1" />Vue</TabsTrigger>
          <TabsTrigger value="products" className="flex-col sm:flex-row gap-0 sm:gap-1 py-2 sm:py-1.5 text-xs sm:text-sm"><Tag className="h-4 w-4 sm:mr-1" />Produits</TabsTrigger>
          <TabsTrigger value="stock" className="flex-col sm:flex-row gap-0 sm:gap-1 py-2 sm:py-1.5 text-xs sm:text-sm"><Archive className="h-4 w-4 sm:mr-1" />Stock</TabsTrigger>
          <TabsTrigger value="purchases" className="flex-col sm:flex-row gap-0 sm:gap-1 py-2 sm:py-1.5 text-xs sm:text-sm"><Truck className="h-4 w-4 sm:mr-1" />Achats</TabsTrigger>
          <TabsTrigger value="movements" className="flex-col sm:flex-row gap-0 sm:gap-1 py-2 sm:py-1.5 text-xs sm:text-sm"><RefreshCw className="h-4 w-4 sm:mr-1" />Mouvements</TabsTrigger>
          <TabsTrigger value="alerts" className="flex-col sm:flex-row gap-0 sm:gap-1 py-2 sm:py-1.5 text-xs sm:text-sm"><AlertTriangle className="h-4 w-4 sm:mr-1" />Alertes</TabsTrigger>
          <TabsTrigger value="reports" className="flex-col sm:flex-row gap-0 sm:gap-1 py-2 sm:py-1.5 text-xs sm:text-sm"><FileText className="h-4 w-4 sm:mr-1" />Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="stock"><StockLevelsTab /></TabsContent>
        <TabsContent value="purchases"><PurchaseOrdersTab /></TabsContent>
        <TabsContent value="movements"><MovementsTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Overview ──────────────────────────────────────────────────────
function OverviewTab() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{
    totalProducts: number; stockValuationFcfa: number;
    lowStockCount: number; outOfStockCount: number;
    openPurchaseOrders: number; purchases30dFcfa: number; sales30dFcfa: number;
  }>({
    queryKey: ["inventory-overview"],
    queryFn: () => apiFetch("/api/inventory/overview"),
  });
  const { data: alerts, isLoading: alertsLoading } = useQuery<Product[]>({
    queryKey: ["stock-alerts"],
    queryFn: () => apiFetch("/api/inventory/stock/alerts"),
  });
  const { data: movements, isLoading: movementsLoading } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements-recent"],
    queryFn: () => apiFetch("/api/inventory/movements?limit=6"),
  });

  if (isLoading || !data) return <div className="text-muted-foreground py-8 text-center">Chargement…</div>;
  const cards = [
    { label: "Produits actifs", value: data.totalProducts, icon: Package, color: "text-blue-600" },
    { label: "Valorisation stock", value: formatFCFA(data.stockValuationFcfa), icon: Archive, color: "text-emerald-600" },
    { label: "Stock faible", value: data.lowStockCount, icon: AlertTriangle, color: "text-amber-600" },
    { label: "Ruptures", value: data.outOfStockCount, icon: TrendingDown, color: "text-rose-600" },
    { label: "Bons en cours", value: data.openPurchaseOrders, icon: ShoppingCart, color: "text-indigo-600" },
    { label: "Achats 30j", value: formatFCFA(data.purchases30dFcfa), icon: ArrowDownToLine, color: "text-cyan-600" },
    { label: "Ventes 30j", value: formatFCFA(data.sales30dFcfa), icon: ArrowUpFromLine, color: "text-violet-600" },
    { label: "Marge 30j", value: formatFCFA(data.sales30dFcfa - data.purchases30dFcfa), icon: TrendingUp, color: "text-orange-600" },
  ];
  const topAlerts = (alerts ?? []).slice(0, 5);
  const recentMoves = (movements ?? []).slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="text-xl font-semibold mt-1">{c.value}</div>
                </div>
                <c.icon className={`h-8 w-8 ${c.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-600" />Top alertes stock</CardTitle>
              {topAlerts.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setLocation("/stock/alertes")}>Voir tout</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {alertsLoading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Chargement…</div>
            ) : topAlerts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                Tous les stocks sont au-dessus du minimum.
              </div>
            ) : (
              <div className="space-y-2">
                {topAlerts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{p.sku}</div>
                    </div>
                    <div className="text-right ml-3">
                      <div className={p.stockOnHand <= 0 ? "text-rose-700 font-medium" : "text-amber-700"}>
                        {p.stockOnHand} {p.unit}
                      </div>
                      <div className="text-xs text-muted-foreground">min : {parseFloat(p.minStock)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="h-4 w-4 text-muted-foreground" />Derniers mouvements</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setLocation("/stock/mouvements")}>Voir tout</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {movementsLoading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Chargement…</div>
            ) : recentMoves.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Aucun mouvement récent.</div>
            ) : (
              <div className="space-y-2">
                {recentMoves.map((m) => {
                  const qty = parseFloat(m.quantity);
                  return (
                    <div key={m.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{m.productName}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(m.occurredAt)} · {KIND_LABELS[m.kind] ?? m.kind}</div>
                      </div>
                      <div className={`text-right font-medium ml-3 ${qty >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {qty >= 0 ? "+" : ""}{qty}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Products tab ──────────────────────────────────────────────────
function ProductsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const productsKey = ["products", { q, categoryId }];
  const { data: products } = useQuery<Product[]>({
    queryKey: productsKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (categoryId !== "all") params.set("categoryId", categoryId);
      return apiFetch(`/api/inventory/products?${params}`);
    },
  });
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["product-categories"],
    queryFn: () => apiFetch("/api/inventory/categories"),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/inventory/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory-overview"] });
      toast({ title: "Produit archivé" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Référentiel produits</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU ou nom…" className="pl-8 w-64" />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nouveau produit
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead className="text-right">Prix achat</TableHead>
              <TableHead className="text-right">Prix vente</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Valeur</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).map((p) => {
              const purchase = parseFloat(p.purchasePriceFcfa);
              const sell = parseFloat(p.sellingPriceFcfa);
              const margin = sell - purchase;
              const marginPct = purchase > 0 ? ((margin / purchase) * 100).toFixed(0) : "—";
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell className="text-right">{formatFCFA(purchase)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(sell)}</TableCell>
                  <TableCell className="text-right">
                    <span className={margin >= 0 ? "text-emerald-700" : "text-rose-700"}>
                      {formatFCFA(margin)} {marginPct !== "—" && `(${marginPct}%)`}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.isLowStock && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                      <span className={p.stockOnHand <= 0 ? "text-rose-700 font-medium" : ""}>
                        {p.stockOnHand} {p.unit}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatFCFA(p.stockValueFcfa)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }}>Modifier</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`Archiver ${p.name} ?`)) del.mutate(p.id);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(products?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Aucun produit. Créez votre premier article.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <ProductDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={editing}
        categories={categories ?? []}
        onSaved={() => {
          setDialogOpen(false);
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["inventory-overview"] });
        }}
      />
    </Card>
  );
}

function ProductDialog({ open, onClose, product, categories, onSaved }: {
  open: boolean; onClose: () => void; product: Product | null;
  categories: Category[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const { data: suppliersRes } = useQuery<{ data: Supplier[] }>({
    queryKey: ["suppliers"], queryFn: () => apiFetch("/api/accounting/suppliers"),
    enabled: open,
  });
  const suppliers = suppliersRes?.data ?? [];
  const [form, setForm] = useState({
    sku: "", name: "", description: "", categoryId: "",
    unit: "pcs", purchasePriceFcfa: "0", sellingPriceFcfa: "0",
    taxRatePct: "18", minStock: "0", primarySupplierId: "",
    barcode: "", imageUrl: "", isActive: true,
  });
  React.useEffect(() => {
    if (product) {
      setForm({
        sku: product.sku, name: product.name, description: product.description ?? "",
        categoryId: product.categoryId ?? "", unit: product.unit,
        purchasePriceFcfa: product.purchasePriceFcfa, sellingPriceFcfa: product.sellingPriceFcfa,
        taxRatePct: product.taxRatePct, minStock: product.minStock,
        primarySupplierId: product.primarySupplierId ?? "",
        barcode: "", imageUrl: product.imageUrl ?? "", isActive: product.isActive,
      });
    } else if (open) {
      setForm({
        sku: "", name: "", description: "", categoryId: "",
        unit: "pcs", purchasePriceFcfa: "0", sellingPriceFcfa: "0",
        taxRatePct: "18", minStock: "0", primarySupplierId: "",
        barcode: "", imageUrl: "", isActive: true,
      });
    }
  }, [product, open]);

  const save = useMutation({
    mutationFn: () => {
      const payload: any = {
        sku: form.sku.trim(), name: form.name.trim(),
        description: form.description || null,
        categoryId: form.categoryId || null,
        unit: form.unit,
        purchasePriceFcfa: form.purchasePriceFcfa,
        sellingPriceFcfa: form.sellingPriceFcfa,
        taxRatePct: form.taxRatePct,
        minStock: form.minStock,
        primarySupplierId: form.primarySupplierId || null,
        imageUrl: form.imageUrl || null,
        isActive: form.isActive,
      };
      return product
        ? apiFetch(`/api/inventory/products/${product.id}`, { method: "PATCH", body: payload })
        : apiFetch(`/api/inventory/products`, { method: "POST", body: payload });
    },
    onSuccess: () => { toast({ title: product ? "Produit mis à jour" : "Produit créé" }); onSaved(); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SKU *</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          <div><Label>Nom *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <Label>Catégorie</Label>
            <Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucune —</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fournisseur principal</Label>
            <Select value={form.primarySupplierId || "none"} onValueChange={(v) => setForm({ ...form, primarySupplierId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun —</SelectItem>
                {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Unité</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, kg, sac…" /></div>
          <div><Label>Stock minimum</Label><Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></div>
          <div><Label>Prix d'achat (FCFA)</Label><Input type="number" value={form.purchasePriceFcfa} onChange={(e) => setForm({ ...form, purchasePriceFcfa: e.target.value })} /></div>
          <div><Label>Prix de vente (FCFA)</Label><Input type="number" value={form.sellingPriceFcfa} onChange={(e) => setForm({ ...form, sellingPriceFcfa: e.target.value })} /></div>
          <div><Label>TVA (%)</Label><Input type="number" value={form.taxRatePct} onChange={(e) => setForm({ ...form, taxRatePct: e.target.value })} /></div>
          <div><Label>Image (URL)</Label><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!form.sku || !form.name || save.isPending} onClick={() => save.mutate()}>
            {product ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stock levels ──────────────────────────────────────────────────
function StockLevelsTab() {
  const { data } = useQuery<Array<Product & { categoryName?: string | null }>>({
    queryKey: ["stock-levels"],
    queryFn: () => apiFetch("/api/inventory/stock/levels"),
  });
  const totalValue = (data ?? []).reduce((s, p) => s + (p.stockValueFcfa || 0), 0);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Niveaux de stock</CardTitle>
          <Badge variant="secondary">Valeur totale : {formatFCFA(totalValue)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Minimum</TableHead>
              <TableHead className="text-right">PMA</TableHead>
              <TableHead className="text-right">Valeur</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.categoryName ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">{p.stockOnHand} {p.unit}</TableCell>
                <TableCell className="text-right text-muted-foreground">{parseFloat(p.minStock)}</TableCell>
                <TableCell className="text-right">{formatFCFA(parseFloat(p.purchasePriceFcfa))}</TableCell>
                <TableCell className="text-right">{formatFCFA(p.stockValueFcfa)}</TableCell>
                <TableCell>
                  {p.stockOnHand <= 0
                    ? <Badge className="bg-rose-100 text-rose-700">Rupture</Badge>
                    : p.isLowStock
                    ? <Badge className="bg-amber-100 text-amber-700">Faible</Badge>
                    : <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Purchase orders ───────────────────────────────────────────────
function PurchaseOrdersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: pos } = useQuery<PO[]>({
    queryKey: ["purchase-orders"],
    queryFn: () => apiFetch("/api/inventory/purchase-orders"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bons de commande fournisseurs</CardTitle>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Nouveau bon</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pos ?? []).map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-mono text-xs">{po.reference}</TableCell>
                <TableCell>{po.supplierName ?? "—"}</TableCell>
                <TableCell>{formatDate(po.orderDate)}</TableCell>
                <TableCell>{po.expectedDate ? formatDate(po.expectedDate) : "—"}</TableCell>
                <TableCell className="text-right">{formatFCFA(parseFloat(po.totalFcfa))}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[po.status]}>{STATUS_LABELS[po.status]}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => setDetailId(po.id)}>Détail</Button></TableCell>
              </TableRow>
            ))}
            {(pos?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun bon de commande.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {createOpen && <CreatePoDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => {
        setCreateOpen(false);
        qc.invalidateQueries({ queryKey: ["purchase-orders"] });
        qc.invalidateQueries({ queryKey: ["inventory-overview"] });
      }} />}
      {detailId && <PoDetailDialog id={detailId} onClose={() => setDetailId(null)} />}
    </Card>
  );
}

type PoInitialLine = { productId: string; quantity: number; unitPriceFcfa: number };

function CreatePoDialog({ open, onClose, onSaved, initialLines, initialSupplierId }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  initialLines?: PoInitialLine[]; initialSupplierId?: string;
}) {
  const { toast } = useToast();
  const { data: suppliersRes2 } = useQuery<{ data: Supplier[] }>({ queryKey: ["suppliers"], queryFn: () => apiFetch("/api/accounting/suppliers"), enabled: open });
  const suppliers = suppliersRes2?.data ?? [];
  const { data: productsRes } = useQuery<{ data: Product[] }>({ queryKey: ["products-all"], queryFn: () => apiFetch("/api/inventory/products"), enabled: open });
  const products = productsRes?.data ?? [];
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PoInitialLine[]>([{ productId: "", quantity: 1, unitPriceFcfa: 0 }]);

  React.useEffect(() => {
    if (open) {
      setSupplierId(initialSupplierId ?? "");
      setLines(initialLines && initialLines.length > 0 ? initialLines : [{ productId: "", quantity: 1, unitPriceFcfa: 0 }]);
      setExpectedDate("");
      setNotes("");
    }
  }, [open, initialSupplierId, initialLines]);

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPriceFcfa, 0);

  const create = useMutation({
    mutationFn: () => apiFetch("/api/inventory/purchase-orders", {
      method: "POST",
      body: {
        supplierId, expectedDate: expectedDate || undefined, notes: notes || undefined,
        lines: lines.filter((l) => l.productId && l.quantity > 0),
      },
    }),
    onSuccess: () => { toast({ title: "Bon de commande créé" }); onSaved(); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Nouveau bon de commande</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fournisseur *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date prévue</Label><Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></div>
          </div>
          <div>
            <Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Produit</TableHead><TableHead className="w-24">Qté</TableHead><TableHead className="w-32">PU FCFA</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.productId} onValueChange={(v) => {
                        const p = (products ?? []).find((x) => x.id === v);
                        const next = [...lines];
                        next[i] = { productId: v, quantity: l.quantity || 1, unitPriceFcfa: p ? parseFloat(p.purchasePriceFcfa) : l.unitPriceFcfa };
                        setLines(next);
                      }}>
                        <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                        <SelectContent>
                          {(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" value={l.quantity} onChange={(e) => { const next = [...lines]; next[i].quantity = parseFloat(e.target.value) || 0; setLines(next); }} /></TableCell>
                    <TableCell><Input type="number" value={l.unitPriceFcfa} onChange={(e) => { const next = [...lines]; next[i].unitPriceFcfa = parseFloat(e.target.value) || 0; setLines(next); }} /></TableCell>
                    <TableCell className="text-right">{formatFCFA(l.quantity * l.unitPriceFcfa)}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-2 border-t flex justify-between items-center">
              <Button size="sm" variant="ghost" onClick={() => setLines([...lines, { productId: "", quantity: 1, unitPriceFcfa: 0 }])}>
                <Plus className="h-4 w-4 mr-1" />Ajouter une ligne
              </Button>
              <div className="font-semibold">Total : {formatFCFA(total)}</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!supplierId || lines.filter((l) => l.productId).length === 0 || create.isPending} onClick={() => create.mutate()}>
            Créer le bon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: po } = useQuery<POWithLines>({
    queryKey: ["purchase-order", id],
    queryFn: () => apiFetch(`/api/inventory/purchase-orders/${id}`),
  });
  const [receipts, setReceipts] = useState<Record<string, number>>({});

  const receive = useMutation({
    mutationFn: () => apiFetch(`/api/inventory/purchase-orders/${id}/receive`, {
      method: "POST",
      body: {
        receipts: Object.entries(receipts).filter(([, q]) => q > 0).map(([lineId, quantity]) => ({ lineId, quantity })),
      },
    }),
    onSuccess: (r: any) => {
      toast({ title: `Réception enregistrée — statut: ${r.status}` });
      qc.invalidateQueries({ queryKey: ["purchase-order", id] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-movements-recent"] });
      qc.invalidateQueries({ queryKey: ["stock-alerts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory-overview"] });
      setReceipts({});
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiFetch(`/api/inventory/purchase-orders/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-order", id] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  if (!po) return null;
  const canReceive = po.status !== "received" && po.status !== "cancelled";

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{po.reference} — {po.supplierName ?? po.supplier?.name}</DialogTitle>
          <DialogDescription>
            <Badge className={STATUS_COLORS[po.status]}>{STATUS_LABELS[po.status]}</Badge>
            <span className="ml-3 text-muted-foreground">Commandé le {formatDate(po.orderDate)}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {po.status === "draft" && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("sent")}>Marquer envoyé</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("cancelled")}>Annuler</Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Cmd.</TableHead>
                <TableHead className="text-right">Reçu</TableHead>
                <TableHead className="text-right">PU</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {canReceive && <TableHead className="w-24">Recevoir</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((l) => {
                const qty = parseFloat(l.quantity);
                const recv = parseFloat(l.quantityReceived);
                const remaining = qty - recv;
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.productName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{l.productSku}</div>
                    </TableCell>
                    <TableCell className="text-right">{qty} {l.productUnit}</TableCell>
                    <TableCell className="text-right">{recv}</TableCell>
                    <TableCell className="text-right">{formatFCFA(parseFloat(l.unitPriceFcfa))}</TableCell>
                    <TableCell className="text-right">{formatFCFA(parseFloat(l.totalFcfa))}</TableCell>
                    {canReceive && (
                      <TableCell>
                        <Input type="number" max={remaining} min={0}
                          value={receipts[l.id] ?? ""}
                          placeholder={String(remaining)}
                          onChange={(e) => setReceipts({ ...receipts, [l.id]: parseFloat(e.target.value) || 0 })} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">{po.notes}</span>
            <span className="font-semibold">Total : {formatFCFA(parseFloat(po.totalFcfa))}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          {canReceive && (
            <Button disabled={Object.values(receipts).every((q) => !q) || receive.isPending} onClick={() => receive.mutate()}>
              <ArrowDownToLine className="h-4 w-4 mr-1" />Réceptionner
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Movements ─────────────────────────────────────────────────────
function MovementsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");
  const { data: movements } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements"],
    queryFn: () => apiFetch("/api/inventory/movements?limit=200"),
  });
  const { data: products } = useQuery<Product[]>({ queryKey: ["products-all"], queryFn: () => apiFetch("/api/inventory/products") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productId: "", quantity: 0, reason: "", unitCostFcfa: 0 });

  const filtered = useMemo(() => (movements ?? []).filter((m) =>
    (filterProduct === "all" || m.productId === filterProduct) &&
    (filterKind === "all" || m.kind === filterKind)
  ), [movements, filterProduct, filterKind]);

  const adjust = useMutation({
    mutationFn: () => apiFetch("/api/inventory/movements/adjust", {
      method: "POST",
      body: { productId: form.productId, quantity: form.quantity, reason: form.reason, unitCostFcfa: form.unitCostFcfa || undefined },
    }),
    onSuccess: () => {
      toast({ title: "Ajustement enregistré" });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-movements-recent"] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock-alerts"] });
      qc.invalidateQueries({ queryKey: ["inventory-overview"] });
      setOpen(false); setForm({ productId: "", quantity: 0, reason: "", unitCostFcfa: 0 });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Mouvements de stock</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="in">Entrées</SelectItem>
                <SelectItem value="out">Sorties</SelectItem>
                <SelectItem value="adjust">Ajustements</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                {(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Ajustement manuel</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Produit</TableHead>
              <TableHead>Type</TableHead><TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-right">Coût unitaire</TableHead>
              <TableHead>Référence</TableHead><TableHead>Motif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => {
              const qty = parseFloat(m.quantity);
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{formatDate(m.occurredAt)}</TableCell>
                  <TableCell><span className="font-medium">{m.productName}</span> <span className="text-xs text-muted-foreground font-mono">{m.productSku}</span></TableCell>
                  <TableCell>
                    <Badge variant={m.kind === "in" ? "default" : m.kind === "out" ? "destructive" : "secondary"}>
                      {KIND_LABELS[m.kind] ?? m.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${qty >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {qty >= 0 ? "+" : ""}{qty}
                  </TableCell>
                  <TableCell className="text-right">{m.unitCostFcfa ? formatFCFA(parseFloat(m.unitCostFcfa)) : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{m.referenceLabel ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.reason ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {(movements?.length ?? 0) === 0 ? "Aucun mouvement." : "Aucun mouvement ne correspond aux filtres."}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajustement de stock</DialogTitle>
            <DialogDescription>Quantité positive = entrée, négative = sortie.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Produit</Label>
              <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantité (signée)</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Coût unitaire FCFA (optionnel)</Label><Input type="number" value={form.unitCostFcfa} onChange={(e) => setForm({ ...form, unitCostFcfa: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Motif *</Label><Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Inventaire physique, casse, retour…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={!form.productId || form.quantity === 0 || !form.reason || adjust.isPending} onClick={() => adjust.mutate()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Alerts ────────────────────────────────────────────────────────
function AlertsTab() {
  const qc = useQueryClient();
  const { data } = useQuery<Product[]>({
    queryKey: ["stock-alerts"],
    queryFn: () => apiFetch("/api/inventory/stock/alerts"),
  });
  const [poDialog, setPoDialog] = useState<{ open: boolean; initialLines: PoInitialLine[]; supplierId?: string }>({
    open: false, initialLines: [],
  });

  const openOrder = (p: Product) => {
    const minStock = parseFloat(p.minStock);
    const toOrder = Math.max(1, minStock * 2 - p.stockOnHand);
    setPoDialog({
      open: true,
      initialLines: [{ productId: p.id, quantity: toOrder, unitPriceFcfa: parseFloat(p.purchasePriceFcfa) }],
      supplierId: p.primarySupplierId ?? undefined,
    });
  };
  const openOrderAll = () => {
    const lines = (data ?? []).map((p) => {
      const minStock = parseFloat(p.minStock);
      const toOrder = Math.max(1, minStock * 2 - p.stockOnHand);
      return { productId: p.id, quantity: toOrder, unitPriceFcfa: parseFloat(p.purchasePriceFcfa) };
    });
    setPoDialog({ open: true, initialLines: lines });
  };

  const totalEstimate = (data ?? []).reduce((s, p) => {
    const minStock = parseFloat(p.minStock);
    const toOrder = Math.max(0, minStock * 2 - p.stockOnHand);
    return s + toOrder * parseFloat(p.purchasePriceFcfa);
  }, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Alertes de stock faible</CardTitle>
          {(data?.length ?? 0) > 0 && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Coût total estimé : {formatFCFA(totalEstimate)}</Badge>
              <Button size="sm" onClick={openOrderAll}><ShoppingCart className="h-4 w-4 mr-1" />Commander tout</Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Stock actuel</TableHead>
              <TableHead className="text-right">Stock minimum</TableHead>
              <TableHead className="text-right">À réapprovisionner</TableHead>
              <TableHead className="text-right">Coût estimé</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((p) => {
              const minStock = parseFloat(p.minStock);
              const toOrder = Math.max(0, minStock * 2 - p.stockOnHand);
              return (
                <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.name}</div><div className="text-xs font-mono text-muted-foreground">{p.sku}</div></TableCell>
                  <TableCell className="text-right">
                    <span className={p.stockOnHand <= 0 ? "text-rose-700 font-medium" : "text-amber-700"}>{p.stockOnHand} {p.unit}</span>
                  </TableCell>
                  <TableCell className="text-right">{minStock} {p.unit}</TableCell>
                  <TableCell className="text-right font-medium">{toOrder} {p.unit}</TableCell>
                  <TableCell className="text-right">{formatFCFA(toOrder * parseFloat(p.purchasePriceFcfa))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openOrder(p)}>
                      <ShoppingCart className="h-3 w-3 mr-1" />Commander
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {(data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  Aucune alerte — tous les stocks sont au-dessus du minimum.
                </div>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {poDialog.open && (
        <CreatePoDialog
          open={poDialog.open}
          onClose={() => setPoDialog({ open: false, initialLines: [] })}
          initialLines={poDialog.initialLines}
          initialSupplierId={poDialog.supplierId}
          onSaved={() => {
            setPoDialog({ open: false, initialLines: [] });
            qc.invalidateQueries({ queryKey: ["purchase-orders"] });
            qc.invalidateQueries({ queryKey: ["inventory-overview"] });
            qc.invalidateQueries({ queryKey: ["stock-alerts"] });
          }}
        />
      )}
    </Card>
  );
}

// ─── Reports ───────────────────────────────────────────────────────
function ReportsTab() {
  const { data: valuation } = useQuery<Array<{ categoryName: string; productCount: number; totalQty: number; valueFcfa: number }>>({
    queryKey: ["report-valuation"],
    queryFn: () => apiFetch("/api/inventory/reports/valuation"),
  });
  const { data: topSellers } = useQuery<Array<{ productId: string; productName: string; productSku: string; quantitySold: number; revenueFcfa: number }>>({
    queryKey: ["report-top-sellers"],
    queryFn: () => apiFetch("/api/inventory/reports/top-sellers"),
  });
  const { data: pvs } = useQuery<Array<{ month: string; purchasesFcfa: number; salesFcfa: number }>>({
    queryKey: ["report-purchases-vs-sales"],
    queryFn: () => apiFetch("/api/inventory/reports/purchases-vs-sales"),
  });

  const totalValuation = (valuation ?? []).reduce((s, r) => s + r.valueFcfa, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Valorisation par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6 items-center">
            <div className="h-64">
              {(valuation ?? []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={valuation ?? []} dataKey="valueFcfa" nameKey="categoryName"
                         innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {(valuation ?? []).map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                    </Pie>
                    <RTooltip formatter={(v: number) => formatFCFA(v)} />
                    <Legend verticalAlign="bottom" iconType="circle"
                      formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Catégorie</TableHead><TableHead className="text-right">Produits</TableHead><TableHead className="text-right">Valeur</TableHead><TableHead className="text-right">%</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(valuation ?? []).map((v, i) => (
                  <TableRow key={v.categoryName}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                        {v.categoryName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{v.productCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatFCFA(v.valueFcfa)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {totalValuation > 0 ? ((v.valueFcfa / totalValuation) * 100).toFixed(1) : "0"}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>Total</TableCell><TableCell></TableCell>
                  <TableCell className="text-right">{formatFCFA(totalValuation)}</TableCell><TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Achats vs ventes — flux mensuels</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            {(pvs ?? []).length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée sur la période.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pvs ?? []} margin={{ left: 10, right: 20, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toLocaleString("fr-FR")}k`} />
                  <RTooltip formatter={(v: number) => formatFCFA(v)} />
                  <Legend iconType="circle" formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                  <Bar dataKey="purchasesFcfa" name="Achats" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="salesFcfa" name="Ventes" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-orange-600" />Top ventes (90 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="text-right">Qté vendue</TableHead><TableHead className="text-right">Coût sorties</TableHead></TableRow></TableHeader>
            <TableBody>
              {(topSellers ?? []).map((p) => (
                <TableRow key={p.productId}>
                  <TableCell><div className="font-medium">{p.productName}</div><div className="text-xs font-mono text-muted-foreground">{p.productSku}</div></TableCell>
                  <TableCell className="text-right">{p.quantitySold}</TableCell>
                  <TableCell className="text-right">{formatFCFA(p.revenueFcfa)}</TableCell>
                </TableRow>
              ))}
              {(topSellers?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Aucune vente sur la période.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
