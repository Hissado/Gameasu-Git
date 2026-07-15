import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListRentals, useCreateRental, useListClients, useListEquipment } from "@workspace/api-client-react";
import { usePermissions } from "@/lib/permissions";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Truck, ArrowRight, FileText, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useModuleTour, WelcomeModal, OnboardingTour, TOUR_PATHS } from "@/components/ui/onboarding-tour";
import { ModuleIntroCard } from "@/components/ui/module-intro-card";

import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA, formatDate } from "@/lib/format";
import { toast } from "sonner";

const RENTALS_TOUR = [
  { target: "rental-header", title: "Gestion des Locations", description: "Gérez vos contrats de location d'équipements, de la réservation à la restitution avec inspection intégrée." },
  { target: "rental-search", title: "Recherche rapide", description: "Retrouvez un contrat par référence ou par nom de client en quelques caractères." },
  { target: "rental-table",  title: "Contrats de location", description: "Accédez au dossier complet de chaque contrat : équipements loués, inspections pré/post et suivi logistique." },
];

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":    return <Badge className="bg-green-100 text-green-800 border-green-200">En cours</Badge>;
    case "pending":   return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">En attente</Badge>;
    case "confirmed": return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Confirmé</Badge>;
    case "returned":  return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">Retourné</Badge>;
    case "cancelled": return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Annulé</Badge>;
    default:          return <Badge variant="outline">Inconnu</Badge>;
  }
}

// ── Create Rental Dialog ───────────────────────────────────────────────────────

type RentalItem = { equipmentId: string; equipmentName: string; quantity: number };

const EMPTY_FORM = { clientId: "", status: "pending", startDate: "", endDate: "", notes: "" };

function CreateRentalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: clientsData } = useListClients();
  const { data: equipmentData } = useListEquipment();
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<RentalItem[]>([]);
  const [addEqId, setAddEqId] = useState("");

  React.useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setItems([]); setAddEqId(""); }
  }, [open]);

  const createMut = useCreateRental({ mutation: {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listRentals"] });
      toast.success("Location créée avec succès");
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erreur lors de la création"),
  }});

  const clients   = (clientsData as any)?.data || [];
  const equipment = (equipmentData as any)?.data || [];

  // Equipment not already added
  const availableEq = equipment.filter((e: any) => !items.find(i => i.equipmentId === e.id));

  function addItem() {
    const eq = equipment.find((e: any) => e.id === addEqId);
    if (!eq) return;
    setItems(prev => [...prev, { equipmentId: eq.id, equipmentName: eq.name, quantity: 1 }]);
    setAddEqId("");
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateQty(idx: number, qty: number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty) } : item));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) { toast.error("Sélectionnez un client"); return; }
    const payload: any = {
      clientId: form.clientId,
      status: form.status,
      ...(form.startDate && { startDate: form.startDate }),
      ...(form.endDate && { endDate: form.endDate }),
      ...(form.notes && { notes: form.notes }),
      items: items.map(i => ({ equipmentId: i.equipmentId, quantity: i.quantity })),
    };
    createMut.mutate({ data: payload });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle location</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Client *</Label>
              <Select value={form.clientId || "_none"} onValueChange={v => setForm(f => ({ ...f, clientId: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Choisir —</SelectItem>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date de début</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Statut initial</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente de confirmation</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="active">Actif (en cours)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Equipment items */}
          <div className="space-y-2">
            <Label>Équipements loués</Label>
            {items.length > 0 && (
              <div className="border border-border rounded-md divide-y divide-border/60 mb-2">
                {items.map((item, idx) => (
                  <div key={item.equipmentId} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 text-sm font-medium text-slate-700 truncate">{item.equipmentName}</span>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Qté</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateQty(idx, parseInt(e.target.value) || 1)}
                        className="w-16 h-7 text-center text-sm"
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeItem(idx)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {availableEq.length > 0 && (
              <div className="flex gap-2">
                <Select value={addEqId || "_none"} onValueChange={v => setAddEqId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Ajouter un équipement…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Choisir —</SelectItem>
                    {availableEq.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.code ? `[${e.code}] ` : ""}{e.name} — {e.status === "available" ? "✓ Disponible" : e.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addItem} disabled={!addEqId} className="shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
            {items.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun équipement ajouté — vous pouvez en ajouter après la création.</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Conditions particulières, instructions livraison…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={!form.clientId || createMut.isPending}>
              {createMut.isPending ? "Création…" : "Créer la location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RentalsList() {
  const perms = usePermissions();
  const { data, isLoading } = useListRentals();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const rentals = useMemo(() => {
    const all = data?.data || [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((r: any) =>
      r.referenceNumber?.toLowerCase().includes(q) ||
      r.clientName?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const { showWelcome, tourActive, startTour, startTourWithPath, dismissWelcome, closeTour, selectedPathKey, handleTourStepChange, tourInitialStep, tourPathLabel } = useModuleTour("locations", !isLoading && rentals.length === 0);
  const activeSteps = TOUR_PATHS["locations"]?.find(p => p.key === selectedPathKey)?.steps ?? RENTALS_TOUR;

  return (
    <div data-tour="rental-header" className="space-y-6 animate-in fade-in duration-500">
      <ReadOnlyBanner />
      {showWelcome && (
        <WelcomeModal
          title="Gestion des Locations"
          subtitle="Gérez vos contrats de location d'équipements de la réservation à la restitution."
          icon={Truck}
          steps={activeSteps}
          paths={TOUR_PATHS["locations"]}
          onStartPath={startTourWithPath}
          onStart={startTour}
          onDismiss={dismissWelcome}
        />
      )}
      {tourActive && (
        <OnboardingTour
          steps={activeSteps}
          onClose={closeTour}
          pathLabel={tourPathLabel}
          initialStep={tourInitialStep}
          onStepChange={handleTourStepChange}
        />
      )}
      <ModuleIntroCard moduleKey="logistique" tourKey="locations" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Locations</h1>
          <p className="text-sm text-muted-foreground mt-1">Contrats de location d'équipements</p>
        </div>
        {!perms.isReadOnly && (
          <Button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
            <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
            Nouvelle Location
          </Button>
        )}
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader data-tour="rental-search" className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Tous les contrats</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Réf. contrat, client…"
                className="pl-9 bg-slate-50 focus-visible:ring-primary h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : (
            <Table data-tour="rental-table">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Référence</TableHead>
                  <TableHead className="font-semibold text-slate-600">Client</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Période</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600 text-center">Équipements</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Coût Total</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={Truck}
                        title={search ? "Aucun contrat ne correspond à la recherche" : "Aucun contrat de location"}
                        description={!search ? "Créez votre premier contrat de location et gérez les équipements affectés." : undefined}
                        actionLabel={!search ? "Créer une location" : undefined}
                        onAction={!search ? () => setShowCreate(true) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rentals.map((rental: any) => (
                    <TableRow key={rental.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-bold text-primary">
                        <Link href={`/locations/${rental.id}`} className="hover:underline flex items-center gap-1.5">
                          <FileText className="w-4 h-4" /> {rental.referenceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-bold text-slate-700">{rental.clientName || "—"}</TableCell>
                      <TableCell><StatusBadge status={rental.status} /></TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-100 w-fit px-2 py-1 rounded">
                          <span>{formatDate(rental.startDate)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(rental.endDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        <Badge variant="secondary" className="font-bold">
                          {rental.items?.length || 0} engin{rental.items?.length !== 1 ? "s" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-800">
                        {rental.totalCost ? formatFCFA(rental.totalCost) : <span className="text-slate-400 italic text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/locations/${rental.id}`}>
                          <Button variant="ghost" size="sm" className="font-semibold">Ouvrir</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateRentalDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
