import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment,
  useGetEquipmentAvailability, useListEquipmentCategories,
} from "@workspace/api-client-react";
import { usePermissions } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Wrench, Settings, Truck, AlertTriangle, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { FieldTooltip, FieldHint } from "@/components/ui/field-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA } from "@/lib/format";
import { Link } from "wouter";
import { toast } from "sonner";
import { PageHeader, StatusTabs } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ── Status helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "available":   return <Badge className="bg-green-100 text-green-800 border-green-200">Disponible</Badge>;
    case "rented":      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">En location</Badge>;
    case "maintenance": return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">En maintenance</Badge>;
    case "retired":     return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Hors service</Badge>;
    default:            return <Badge variant="outline">Inconnu</Badge>;
  }
}

// ── Equipment Form Dialog ──────────────────────────────────────────────────────

const EMPTY = { name: "", code: "", categoryId: "", status: "available", quantity: "1", dailyRate: "", location: "", description: "" };

function EquipmentFormDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item?: any }) {
  const isEdit = !!item;
  const qc = useQueryClient();
  const { data: catsData } = useListEquipmentCategories();
  const [form, setForm] = useState(EMPTY);

  React.useEffect(() => {
    if (open) setForm(isEdit ? {
      name: item.name || "",
      code: item.code || "",
      categoryId: item.categoryId || "",
      status: item.status || "available",
      quantity: String(item.quantity ?? 1),
      dailyRate: item.dailyRate != null ? String(item.dailyRate) : "",
      location: item.location || "",
      description: item.description || "",
    } : EMPTY);
  }, [open, item, isEdit]);

  const createMut = useCreateEquipment({ mutation: {
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listEquipment"] }); qc.invalidateQueries({ queryKey: ["getEquipmentAvailability"] }); toast.success("Équipement ajouté"); onClose(); },
    onError: () => toast.error("Erreur lors de la création"),
  }});
  const updateMut = useUpdateEquipment({ mutation: {
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listEquipment"] }); toast.success("Équipement mis à jour"); onClose(); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  }});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      name: form.name.trim(),
      status: form.status,
      quantity: parseInt(form.quantity) || 1,
      ...(form.code && { code: form.code }),
      ...(form.categoryId && { categoryId: form.categoryId }),
      ...(form.dailyRate && { dailyRate: parseFloat(form.dailyRate) }),
      ...(form.location && { location: form.location }),
      ...(form.description && { description: form.description }),
    };
    if (isEdit) updateMut.mutate({ id: item.id, data: payload });
    else createMut.mutate({ data: payload });
  }

  const cats = (catsData as any)?.data || [];
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'équipement" : "Ajouter un équipement"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Désignation *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex. Grue à flèche 60T" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Code / Référence</Label>
                <FieldTooltip content="Identifiant interne unique de l'équipement (ex. GRU-001). Utilisé pour le suivi, les états des lieux et la génération du QR Code de pointage." />
              </div>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="Ex. GRU-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Statut *</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="rented">En location</SelectItem>
                  <SelectItem value="maintenance">En maintenance</SelectItem>
                  <SelectItem value="retired">Hors service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.categoryId || "_none"} onValueChange={v => setForm(f => ({ ...f, categoryId: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Aucune —</SelectItem>
                  {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantité *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Taux journalier (FCFA)</Label>
                <FieldTooltip content="Tarif de location à la journée en FCFA. Sert de base au calcul automatique du montant des contrats de location de cet équipement." />
              </div>
              <Input type="number" value={form.dailyRate} onChange={e => setForm(f => ({ ...f, dailyRate: e.target.value }))} placeholder="Ex. 150000" />
              <FieldHint>Montant facturé par jour de location, hors taxes.</FieldHint>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Emplacement / Site</Label>
                <FieldTooltip content="Localisation physique actuelle de l'équipement (dépôt, chantier, client). Mis à jour à chaque mouvement logistique." />
              </div>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Ex. Dépôt Lomé" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Spécifications techniques, état général…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={!form.name.trim() || isPending}>
              {isPending ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Ajouter l'équipement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEquipmentDialog({ item, onClose }: { item: any; onClose: () => void }) {
  const qc = useQueryClient();
  const deleteMut = useDeleteEquipment({ mutation: {
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listEquipment"] }); qc.invalidateQueries({ queryKey: ["getEquipmentAvailability"] }); toast.success("Équipement supprimé"); onClose(); },
    onError: () => toast.error("Erreur lors de la suppression"),
  }});
  return (
    <Dialog open={!!item} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">Supprimer l'équipement ?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          L'équipement <span className="font-semibold text-foreground">"{item?.name}"</span> sera définitivement retiré de l'inventaire.
        </p>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate({ id: item.id })}>
            {deleteMut.isPending ? "Suppression…" : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EquipmentList() {
  const { data: availability, isLoading: isLoadingAvail } = useGetEquipmentAvailability();
  const { data: equipment, isLoading } = useListEquipment();
  const perms = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  const allItems = equipment?.data || [];
  const items = useMemo(() => {
    let result = allItems;
    if (statusFilter !== "all") result = result.filter((e: any) => e.status === statusFilter);
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter((e: any) =>
      e.name?.toLowerCase().includes(q) ||
      e.code?.toLowerCase().includes(q) ||
      e.categoryName?.toLowerCase().includes(q)
    );
  }, [allItems, search, statusFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Inventaire Matériel"
        subtitle={`${allItems.length} équipements · Flotte et machines`}
        icon={Wrench}
        actions={!perms.isReadOnly ? (
          <Button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
            <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
            Ajouter du Matériel
          </Button>
        ) : undefined}
      />
      <StatusTabs
        tabs={[
          { key: "all",         label: "Tous",           count: allItems.length },
          { key: "available",   label: "Disponibles",    count: availability?.available ?? 0 },
          { key: "rented",      label: "En location",    count: availability?.rented ?? 0 },
          { key: "maintenance", label: "En maintenance", count: availability?.maintenance ?? 0 },
          { key: "retired",     label: "Hors service",   count: allItems.filter((e: any) => e.status === "retired").length },
        ]}
        active={statusFilter}
        onChange={setStatusFilter}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Parc Total",     value: availability?.totalItems || 0, color: "border-l-slate-400",  icon: <Wrench className="w-5 h-5 text-slate-400" />,    cls: "text-slate-800" },
          { label: "Disponibles",    value: availability?.available || 0,  color: "border-l-green-500",  icon: null,                                               cls: "text-green-600" },
          { label: "Sur Projets",    value: availability?.rented || 0,     color: "border-l-blue-500",   icon: <Truck className="w-5 h-5 text-blue-400" />,      cls: "text-blue-600" },
          { label: "En Maintenance", value: availability?.maintenance || 0, color: "border-l-yellow-500", icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />, cls: "text-yellow-600" },
        ].map(kpi => (
          <Card key={kpi.label} className={`shadow-sm border-l-4 ${kpi.color}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAvail ? <Skeleton className="h-8 w-16" /> : (
                <div className="flex items-center justify-between">
                  <div className={`text-2xl font-bold ${kpi.cls}`}>{kpi.value}</div>
                  {kpi.icon}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Liste des Équipements</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Référence, nom, catégorie…"
                  className="pl-9 bg-slate-50 focus-visible:ring-primary h-9"
                />
              </div>
              <Link href="/equipements/categories">
                <Button variant="outline" size="sm" className="h-9">
                  <Settings className="w-4 h-4 mr-2" />
                  Catégories
                </Button>
              </Link>
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
                  <TableHead className="font-semibold text-slate-600 w-24">Réf.</TableHead>
                  <TableHead className="font-semibold text-slate-600">Désignation</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Catégorie</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-center">Qté</TableHead>
                  <TableHead className="hidden sm:table-cell text-right font-semibold text-slate-600">Taux Journalier</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={Wrench}
                        title={search ? "Aucun équipement ne correspond à la recherche" : "Inventaire vide"}
                        description={!search ? "Ajoutez vos machines, véhicules et outils pour gérer leur disponibilité et facturation." : undefined}
                        actionLabel={!search ? "Ajouter un équipement" : undefined}
                        onAction={!search ? () => setShowCreate(true) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs font-bold text-slate-500 bg-slate-100/50">{item.code || "—"}</TableCell>
                      <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm font-medium text-slate-600">{item.categoryName || "—"}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-center font-bold">
                        <span className={item.availableQuantity === 0 ? "text-red-500" : "text-green-600"}>{item.availableQuantity}</span>
                        <span className="text-slate-400 font-normal mx-1">/</span>
                        {item.quantity}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right font-bold text-slate-700">
                        {item.dailyRate ? formatFCFA(item.dailyRate) : <span className="text-slate-400 italic text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <Link href="/equipements">
                              <DropdownMenuItem className="cursor-pointer"><Eye className="mr-2 h-4 w-4" /> Détail</DropdownMenuItem>
                            </Link>
                            {!perms.isReadOnly && (
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setEditItem(item)}>
                                <Edit className="mr-2 h-4 w-4" /> Modifier
                              </DropdownMenuItem>
                            )}
                            {!perms.isReadOnly && (
                              <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => setDeleteItem(item)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EquipmentFormDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <EquipmentFormDialog open={!!editItem} onClose={() => setEditItem(null)} item={editItem} />
      {deleteItem && <DeleteEquipmentDialog item={deleteItem} onClose={() => setDeleteItem(null)} />}
    </div>
  );
}
