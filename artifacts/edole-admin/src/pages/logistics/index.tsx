import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListLogisticsOperations, useCreateLogisticsOperation, useUpdateLogisticsOperation, useListRentals, useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Truck, Calendar, MapPin, MoreHorizontal, Edit, CheckCircle2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Status / Type helpers ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "scheduled":  return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Planifié</Badge>;
    case "in_transit": return <Badge className="bg-blue-600 text-white hover:bg-blue-700">En transit</Badge>;
    case "completed":  return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Terminé</Badge>;
    case "cancelled":  return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Annulé</Badge>;
    default:           return <Badge variant="outline">{status || "—"}</Badge>;
  }
}

function TypeLabel({ type }: { type: string }) {
  if (type === "delivery") return <span className="font-bold text-sm text-primary flex items-center gap-1.5"><Truck className="w-4 h-4" /> Livraison</span>;
  if (type === "pickup")   return <span className="font-bold text-sm text-indigo-600 flex items-center gap-1.5"><Truck className="w-4 h-4 scale-x-[-1]" /> Enlèvement</span>;
  return <span className="font-bold text-sm text-slate-600">{type || "—"}</span>;
}

// ── Create Logistics Dialog ────────────────────────────────────────────────────

const EMPTY = { type: "delivery", status: "scheduled", rentalId: "", responsibleId: "", address: "", scheduledAt: "", notes: "" };

function CreateLogisticsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: rentalsData } = useListRentals();
  const { data: usersData } = useListUsers();
  const [form, setForm] = useState(EMPTY);

  React.useEffect(() => { if (open) setForm(EMPTY); }, [open]);

  const createMut = useCreateLogisticsOperation({ mutation: {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listLogisticsOperations"] });
      toast.success("Transport planifié");
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erreur lors de la création"),
  }});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      type: form.type,
      status: form.status,
      ...(form.rentalId && { rentalId: form.rentalId }),
      ...(form.responsibleId && { responsibleId: form.responsibleId }),
      ...(form.address && { address: form.address }),
      ...(form.scheduledAt && { scheduledAt: new Date(form.scheduledAt).toISOString() }),
      ...(form.notes && { notes: form.notes }),
    };
    createMut.mutate({ data: payload });
  }

  const rentals = (rentalsData as any)?.data || [];
  const users   = (usersData as any)?.data || [];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Planifier un transport</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Type d'opération *</Label>
            <div className="flex gap-2">
              {[
                { v: "delivery", label: "Livraison", cls: form.type === "delivery" ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-600" },
                { v: "pickup",   label: "Enlèvement", cls: form.type === "pickup"  ? "bg-primary text-white border-indigo-600" : "border-slate-200 text-slate-600" },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: opt.v }))}
                  className={`flex-1 border rounded-md px-3 py-2 text-sm font-semibold transition-colors ${opt.cls}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contrat de location</Label>
              <Select value={form.rentalId || "_none"} onValueChange={v => setForm(f => ({ ...f, rentalId: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Optionnel…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Aucun —</SelectItem>
                  {rentals.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.referenceNumber || r.id.substring(0,8)} — {r.clientName || "?"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsable / Chauffeur</Label>
              <Select value={form.responsibleId || "_none"} onValueChange={v => setForm(f => ({ ...f, responsibleId: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Non assigné —</SelectItem>
                  {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date et heure prévues</Label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Planifié</SelectItem>
                  <SelectItem value="in_transit">En transit</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Adresse / Destination</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Ex. Chantier Zone Industrielle, Lomé" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Instructions spéciales, contacts…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Planification…" : "Planifier le transport"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Update Status Dialog ───────────────────────────────────────────────────────

function UpdateStatusDialog({ op, onClose }: { op: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(op?.status || "scheduled");

  const updateMut = useUpdateLogisticsOperation({ mutation: {
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listLogisticsOperations"] }); toast.success("Statut mis à jour"); onClose(); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  }});

  return (
    <Dialog open={!!op} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Mettre à jour le statut</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 my-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Planifié</SelectItem>
              <SelectItem value="in_transit">En transit</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={updateMut.isPending} onClick={() => updateMut.mutate({ id: op.id, data: { type: op.type, status } })}>
            {updateMut.isPending ? "Mise à jour…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LogisticsList() {
  const { data, isLoading } = useListLogisticsOperations();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [updateOp, setUpdateOp] = useState<any>(null);

  const ops = useMemo(() => {
    const all = data?.data || [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((o: any) =>
      o.address?.toLowerCase().includes(q) ||
      o.responsibleName?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Opérations Logistiques</h1>
          <p className="text-sm text-muted-foreground mt-1">Livraisons et enlèvements d'équipements</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Planifier un transport
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Feuille de Route</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Adresse, responsable…"
                className="pl-9 bg-slate-50 focus-visible:ring-primary h-9"
              />
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
                  <TableHead className="font-semibold text-slate-600">Type</TableHead>
                  <TableHead className="font-semibold text-slate-600">Statut</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600">Responsable</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-slate-600">Destination</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-600 text-right">Date Prévue</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ops.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Truck className="w-12 h-12 text-slate-300 mb-4 mx-auto" />
                      <p className="text-lg font-medium text-slate-600">{search ? "Aucun résultat" : "Aucune opération planifiée."}</p>
                      {!search && <Button variant="outline" className="mt-4 border-primary text-primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Planifier un transport</Button>}
                    </TableCell>
                  </TableRow>
                ) : (
                  ops.map((op: any) => (
                    <TableRow key={op.id} className="hover:bg-slate-50/50">
                      <TableCell><TypeLabel type={op.type} /></TableCell>
                      <TableCell><StatusBadge status={op.status} /></TableCell>
                      <TableCell className="hidden sm:table-cell font-medium text-slate-800">{op.responsibleName || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[250px]">
                        <div className="flex items-start gap-1.5 text-sm">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="truncate text-slate-700">{op.address || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right">
                        <div className="flex items-center justify-end gap-1.5 text-sm font-medium text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {op.scheduledAt ? formatDate(op.scheduledAt) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setUpdateOp(op)}>
                              <Edit className="mr-2 h-4 w-4" /> Changer le statut
                            </DropdownMenuItem>
                            {op.status !== "completed" && (
                              <DropdownMenuItem className="cursor-pointer text-green-700 focus:text-green-700" onClick={() => setUpdateOp({ ...op, _quickComplete: true })}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Marquer terminé
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

      <CreateLogisticsDialog open={showCreate} onClose={() => setShowCreate(false)} />
      {updateOp && <UpdateStatusDialog op={updateOp} onClose={() => setUpdateOp(null)} />}
    </div>
  );
}
