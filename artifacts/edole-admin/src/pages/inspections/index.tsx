import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListInspections, useCreateInspection, useListRentals, useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ClipboardCheck, Plus, AlertTriangle, CheckCircle2, GitCompare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";

// ── Create Inspection Dialog ───────────────────────────────────────────────────

const EMPTY = { rentalId: "", type: "departure", notes: "", hasDispute: false, disputeNotes: "", retentionAmount: "" };

function CreateInspectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: rentalsData } = useListRentals();
  const { data: usersData } = useListUsers();
  const [form, setForm] = useState(EMPTY);

  React.useEffect(() => { if (open) setForm(EMPTY); }, [open]);

  const createMut = useCreateInspection({ mutation: {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listInspections"] });
      toast.success("Inspection créée");
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erreur lors de la création"),
  }});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.rentalId) { toast.error("Sélectionnez un contrat de location"); return; }
    const payload: any = {
      rentalId: form.rentalId,
      type: form.type,
      ...(form.notes && { notes: form.notes }),
      hasDispute: form.hasDispute,
      ...(form.hasDispute && form.disputeNotes && { disputeNotes: form.disputeNotes }),
      ...(form.hasDispute && form.retentionAmount && { retentionAmount: parseFloat(form.retentionAmount) }),
    };
    createMut.mutate({ data: payload });
  }

  const rentals = (rentalsData as any)?.data || [];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle inspection technique</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Contrat de location *</Label>
            <Select value={form.rentalId || "_none"} onValueChange={v => setForm(f => ({ ...f, rentalId: v === "_none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un contrat…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Choisir —</SelectItem>
                {rentals.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.referenceNumber} — {r.clientName || "Client inconnu"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Type d'inspection *</Label>
            <div className="flex gap-2">
              {[
                { v: "departure", label: "État des lieux Départ", cls: form.type === "departure" ? "bg-blue-600 text-white border-blue-600" : "border text-muted-foreground" },
                { v: "return",    label: "État des lieux Retour", cls: form.type === "return"    ? "bg-purple-600 text-white border-purple-600" : "border text-muted-foreground" },
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
          <div className="space-y-1.5">
            <Label>Observations générales</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="État général, remarques, photos jointes…"
            />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-md border border-amber-200 bg-amber-50">
            <input
              id="hasDispute"
              type="checkbox"
              checked={form.hasDispute}
              onChange={e => setForm(f => ({ ...f, hasDispute: e.target.checked }))}
              className="w-4 h-4 accent-amber-600"
            />
            <label htmlFor="hasDispute" className="text-sm font-semibold text-amber-800 cursor-pointer">
              Signaler un litige ou dommage
            </label>
          </div>
          {form.hasDispute && (
            <div className="space-y-3 pl-2 border-l-2 border-amber-300">
              <div className="space-y-1.5">
                <Label>Description du litige</Label>
                <Textarea
                  value={form.disputeNotes}
                  onChange={e => setForm(f => ({ ...f, disputeNotes: e.target.value }))}
                  rows={2}
                  placeholder="Décrire les dommages constatés…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Retenue caution (FCFA)</Label>
                <Input
                  type="number"
                  value={form.retentionAmount}
                  onChange={e => setForm(f => ({ ...f, retentionAmount: e.target.value }))}
                  placeholder="Montant retenu"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={!form.rentalId || createMut.isPending}>
              {createMut.isPending ? "Création…" : "Créer l'inspection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function InspectionsList() {
  const { data, isLoading } = useListInspections();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const inspections = useMemo(() => {
    const all = data?.data || [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((i: any) =>
      i.rentalId?.toLowerCase().includes(q) ||
      i.conductedByName?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Inspections Techniques</h1>
          <p className="text-sm text-muted-foreground mt-1">États des lieux · Départ et retour</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouvelle Inspection
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg">Historique des contrôles</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Contrat, inspecteur…"
                className="pl-9 bg-muted/50 focus-visible:ring-primary h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/80">
                <TableRow>
                  <TableHead className="font-semibold text-muted-foreground">Contrat Lié</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">Type</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-muted-foreground">Inspecteur</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-muted-foreground">Date</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-muted-foreground text-center">Litige</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-muted-foreground text-right">Retenue</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={ClipboardCheck}
                        title={search ? "Aucune inspection ne correspond à la recherche" : "Aucune inspection réalisée"}
                        description={!search ? "Effectuez des états des lieux avant départ et retour pour sécuriser vos locations." : undefined}
                        actionLabel={!search ? "Créer une inspection" : undefined}
                        onAction={!search ? () => setShowCreate(true) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  inspections.map((inspection: any) => (
                    <TableRow key={inspection.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono font-bold text-muted-foreground text-sm">
                        {(inspection.rentalReference || inspection.rentalId?.substring(0, 8) || "—").toUpperCase()}
                      </TableCell>
                      <TableCell>
                        {inspection.type === "departure" ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Départ</Badge>
                        ) : inspection.type === "return" ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Retour</Badge>
                        ) : (
                          <Badge variant="outline">{inspection.type || inspection.kind || "—"}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-medium text-foreground">{inspection.conductedByName || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{formatDate(inspection.inspectionDate || inspection.createdAt)}</TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        {inspection.hasDispute ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center justify-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="w-3 h-3" /> Litige
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center justify-center gap-1 w-fit mx-auto">
                            <CheckCircle2 className="w-3 h-3" /> RAS
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right font-semibold text-foreground">
                        {inspection.retentionAmount ? formatFCFA(inspection.retentionAmount) : <span className="text-muted-foreground/60 italic text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/inspections/comparer/${inspection.rentalId}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs">
                            <GitCompare className="w-3 h-3 mr-1.5" /> Comparer
                          </Button>
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

      <CreateInspectionDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
