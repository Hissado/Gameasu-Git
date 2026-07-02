import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Plus, Search, MoreHorizontal, Edit, Trash2, Eye,
  Phone, Mail, MapPin, FileText, CreditCard, X, Loader2, TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  paymentTerms?: string | null;
  isActive: boolean;
  type?: string | null;
  country?: string | null;
  city?: string | null;
  rccm?: string | null;
  mobileMoney?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  notes?: string | null;
  status?: string | null;
  outstandingBalance: number;
  createdAt: string;
}

interface SupplierDetail extends Supplier {
  invoices: any[];
  payments: any[];
  totalInvoiced: number;
  totalPaid: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SUPPLIER_TYPES = [
  { value: "fournisseur", label: "Fournisseur" },
  { value: "sous-traitant", label: "Sous-traitant" },
  { value: "prestataire", label: "Prestataire" },
];

const SUPPLIER_STATUSES = [
  { value: "actif", label: "Actif" },
  { value: "inactif", label: "Inactif" },
  { value: "a_verifier", label: "À vérifier" },
  { value: "suspendu", label: "Suspendu" },
];

const PAYMENT_TERMS = [
  { value: "immediate", label: "Paiement immédiat" },
  { value: "15j", label: "15 jours" },
  { value: "30j", label: "30 jours" },
  { value: "45j", label: "45 jours" },
  { value: "60j", label: "60 jours" },
  { value: "90j", label: "90 jours" },
];

const COUNTRIES = [
  "Togo", "Côte d'Ivoire", "Ghana", "Bénin", "Sénégal", "Cameroun",
  "Mali", "Burkina Faso", "Niger", "Nigeria", "Gabon", "Congo", "France",
  "Chine", "Autre",
];

function StatusBadge({ isActive, status }: { isActive: boolean; status?: string | null }) {
  const s = status || (isActive ? "actif" : "inactif");
  switch (s) {
    case "actif":       return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">Actif</Badge>;
    case "inactif":     return <Badge variant="outline" className="bg-slate-50 text-slate-500 text-xs">Inactif</Badge>;
    case "a_verifier":  return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">À vérifier</Badge>;
    case "suspendu":    return <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">Suspendu</Badge>;
    default:            return <Badge variant="outline" className="text-xs">{s}</Badge>;
  }
}

function InvoiceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid":              return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">Payée</Badge>;
    case "partially_paid":    return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Part. payée</Badge>;
    case "pending":           return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">En attente</Badge>;
    case "overdue":           return <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">En retard</Badge>;
    case "cancelled":         return <Badge variant="outline" className="text-slate-500 text-xs">Annulée</Badge>;
    case "review":            return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">À revoir</Badge>;
    case "approved":          return <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs">Approuvée</Badge>;
    default:                  return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

// ── Form ───────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "", type: "fournisseur", email: "", phone: "", address: "",
  country: "", city: "", taxId: "", rccm: "", paymentTerms: "30j",
  mobileMoney: "", bankName: "", bankAccountNumber: "", notes: "", status: "actif",
};

function SupplierForm({
  open, onClose, supplier,
}: {
  open: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!supplier;
  const [form, setForm] = useState(EMPTY_FORM);
  const [tab, setTab] = useState("general");

  React.useEffect(() => {
    if (open) {
      setTab("general");
      setForm(supplier ? {
        name: supplier.name || "",
        type: supplier.type || "fournisseur",
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        country: supplier.country || "",
        city: supplier.city || "",
        taxId: supplier.taxId || "",
        rccm: supplier.rccm || "",
        paymentTerms: supplier.paymentTerms || "30j",
        mobileMoney: supplier.mobileMoney || "",
        bankName: supplier.bankName || "",
        bankAccountNumber: supplier.bankAccountNumber || "",
        notes: supplier.notes || "",
        status: supplier.status || (supplier.isActive ? "actif" : "inactif"),
      } : EMPTY_FORM);
    }
  }, [open, supplier]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (isEdit) {
        return apiFetch(`/api/purchases/suppliers/${supplier!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, isActive: data.status === "actif" }),
        });
      }
      return apiFetch("/api/purchases/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases-suppliers"] });
      toast.success(isEdit ? "Fournisseur mis à jour" : "Fournisseur créé");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-600" />
            {isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">Général</TabsTrigger>
            <TabsTrigger value="coordonnees" className="flex-1">Coordonnées</TabsTrigger>
            <TabsTrigger value="paiement" className="flex-1">Paiement</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nom du fournisseur" className="mt-1" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => set("type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>IFU / NIF</Label>
                <Input value={form.taxId} onChange={e => set("taxId", e.target.value)} placeholder="Numéro contribuable" className="mt-1" />
              </div>
              <div>
                <Label>RCCM</Label>
                <Input value={form.rccm} onChange={e => set("rccm", e.target.value)} placeholder="Registre commerce" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Notes internes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="mt-1" placeholder="Commentaires, conditions particulières…" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="coordonnees" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Pays</Label>
                <Select value={form.country} onValueChange={v => set("country", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ville</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Adresse</Label>
                <Textarea value={form.address} onChange={e => set("address", e.target.value)} rows={2} className="mt-1" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="paiement" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Conditions de paiement</Label>
                <Select value={form.paymentTerms} onValueChange={v => set("paymentTerms", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mobile Money</Label>
                <Input value={form.mobileMoney} onChange={e => set("mobileMoney", e.target.value)} placeholder="Flooz / Mixx…" className="mt-1" />
              </div>
              <div>
                <Label>Banque</Label>
                <Input value={form.bankName} onChange={e => set("bankName", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Numéro de compte</Label>
                <Input value={form.bankAccountNumber} onChange={e => set("bankAccountNumber", e.target.value)} className="mt-1" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name.trim()}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEdit ? "Enregistrer" : "Créer le fournisseur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Sheet ───────────────────────────────────────────────────────────────

function SupplierDetail({ supplierId, onClose, onEdit }: {
  supplierId: string;
  onClose: () => void;
  onEdit: (s: Supplier) => void;
}) {
  const { data, isLoading } = useQuery<SupplierDetail>({
    queryKey: ["purchases-supplier-detail", supplierId],
    queryFn: () => apiFetch(`/api/purchases/suppliers/${supplierId}`),
    enabled: !!supplierId,
  });

  return (
    <Sheet open={!!supplierId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              {isLoading ? "Chargement…" : data?.name}
            </SheetTitle>
            <div className="flex gap-2">
              {data && (
                <Button size="sm" variant="outline" onClick={() => onEdit(data)} className="gap-1.5">
                  <Edit className="w-3.5 h-3.5" /> Modifier
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 pt-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : data ? (
          <div className="pt-6 space-y-6">
            {/* KPI */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-xs text-muted-foreground mb-1">Facturé total</p>
                <p className="text-sm font-bold text-orange-700">{formatFCFA(data.totalInvoiced)}</p>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-xs text-muted-foreground mb-1">Total payé</p>
                <p className="text-sm font-bold text-emerald-700">{formatFCFA(data.totalPaid)}</p>
              </div>
              <div className="text-center p-3 bg-rose-50 rounded-lg border border-rose-100">
                <p className="text-xs text-muted-foreground mb-1">Solde dû</p>
                <p className="text-sm font-bold text-rose-700">{formatFCFA(data.outstandingBalance)}</p>
              </div>
            </div>

            {/* Info card */}
            <Card className="border-border/60">
              <CardContent className="pt-4 space-y-2.5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Code</span>
                    <p className="font-mono text-xs mt-0.5">{data.code}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Type</span>
                    <p className="text-xs mt-0.5 capitalize">{data.type || "—"}</p>
                  </div>
                  {data.email && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs">{data.email}</span>
                    </div>
                  )}
                  {data.phone && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs">{data.phone}</span>
                    </div>
                  )}
                  {(data.city || data.country) && (
                    <div className="col-span-2 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs">{[data.city, data.country].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  {data.taxId && (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">IFU / NIF</span>
                      <p className="text-xs mt-0.5 font-mono">{data.taxId}</p>
                    </div>
                  )}
                  {data.paymentTerms && (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Conditions paiement</span>
                      <p className="text-xs mt-0.5">{PAYMENT_TERMS.find(t => t.value === data.paymentTerms)?.label ?? data.paymentTerms}</p>
                    </div>
                  )}
                  {data.bankName && (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Banque</span>
                      <p className="text-xs mt-0.5">{data.bankName}</p>
                    </div>
                  )}
                  {data.mobileMoney && (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Mobile money</span>
                      <p className="text-xs mt-0.5">{data.mobileMoney}</p>
                    </div>
                  )}
                </div>
                {data.notes && (
                  <div className="pt-2 border-t border-border/40">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Notes</span>
                    <p className="text-xs mt-0.5 text-muted-foreground">{data.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Factures */}
            {data.invoices.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Dernières factures
                </p>
                <div className="space-y-1.5">
                  {data.invoices.slice(0, 5).map((inv: any) => (
                    <div key={inv.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/40 bg-muted/20 text-xs">
                      <span className="font-mono font-medium flex-1 truncate">{inv.referenceNumber}</span>
                      <span className="text-muted-foreground">{inv.invoiceDate}</span>
                      <InvoiceStatusBadge status={inv.status} />
                      <span className="font-semibold text-right min-w-[80px]">{formatFCFA(Number(inv.totalAmount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Paiements */}
            {data.payments.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Derniers paiements
                </p>
                <div className="space-y-1.5">
                  {data.payments.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/40 bg-muted/20 text-xs">
                      <span className="flex-1 capitalize">{p.method}</span>
                      {p.reference && <span className="text-muted-foreground font-mono">{p.reference}</span>}
                      <span className="text-muted-foreground">{new Date(p.paidAt).toLocaleDateString("fr-FR")}</span>
                      <span className="font-semibold text-emerald-700">{formatFCFA(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FournisseursPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const debouncedSearch = search;

  const { data, isLoading } = useQuery<{ data: Supplier[]; total: number }>({
    queryKey: ["purchases-suppliers", debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter === "active" ? "active" : "inactive");
      return apiFetch(`/api/purchases/suppliers?${params}`);
    },
  });

  const suppliers = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/purchases/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases-suppliers"] });
      toast.success("Fournisseur archivé");
      setDeleteId(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const stats = useMemo(() => ({
    total: data?.total ?? 0,
    active: suppliers.filter(s => s.isActive && (!s.status || s.status === "actif")).length,
    withBalance: suppliers.filter(s => s.outstandingBalance > 0).length,
    totalOutstanding: suppliers.reduce((s, f) => s + f.outstandingBalance, 0),
  }), [suppliers, data]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border/40 bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-orange-600" />
              Fournisseurs
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gérez vos fournisseurs, sous-traitants et prestataires
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            Nouveau fournisseur
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total fournisseurs</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Actifs</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Avec solde dû</p>
              <p className="text-2xl font-bold text-orange-600">{stats.withBalance}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total dû</p>
              <p className="text-lg font-bold text-rose-600">{formatFCFA(stats.totalOutstanding)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 border-b border-border/40 flex items-center gap-3 bg-muted/20">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-8 text-sm"
            placeholder="Rechercher un fournisseur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }} className="h-8 text-xs text-muted-foreground">
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {search || statusFilter !== "all" ? "Aucun fournisseur ne correspond aux filtres" : "Aucun fournisseur enregistré"}
            </p>
            {!search && statusFilter === "all" && (
              <Button onClick={() => setCreateOpen(true)} size="sm" variant="outline" className="mt-4 gap-2">
                <Plus className="w-3.5 h-3.5" /> Créer le premier fournisseur
              </Button>
            )}
          </div>
        ) : (
          <Card className="border-border/60 shadow-none overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Code</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Nom</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Contact</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Cond. paiement</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">Solde dû</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Statut</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map(s => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setDetailId(s.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.code}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{s.name}</p>
                      {s.city && <p className="text-xs text-muted-foreground">{s.city}</p>}
                    </TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">{s.type || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {s.email && <p className="text-xs text-muted-foreground truncate max-w-[150px]">{s.email}</p>}
                        {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                        {!s.email && !s.phone && <span className="text-xs text-muted-foreground/50">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {PAYMENT_TERMS.find(t => t.value === s.paymentTerms)?.label ?? (s.paymentTerms || "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.outstandingBalance > 0 ? (
                        <span className="text-sm font-semibold text-rose-600">{formatFCFA(s.outstandingBalance)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge isActive={s.isActive} status={s.status} /></TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailId(s.id)} className="gap-2">
                            <Eye className="w-3.5 h-3.5" /> Voir le détail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditSupplier(s); }} className="gap-2">
                            <Edit className="w-3.5 h-3.5" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteId(s.id)} className="gap-2 text-rose-600">
                            <Trash2 className="w-3.5 h-3.5" /> Archiver
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Create / Edit */}
      <SupplierForm
        open={createOpen || !!editSupplier}
        onClose={() => { setCreateOpen(false); setEditSupplier(null); }}
        supplier={editSupplier}
      />

      {/* Detail */}
      {detailId && (
        <SupplierDetail
          supplierId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(s) => { setDetailId(null); setEditSupplier(s); }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archiver ce fournisseur ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le fournisseur sera archivé et ne sera plus visible dans les listes. Les factures et paiements existants sont conservés.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Archiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
