import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { AccountingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Lock, LockOpen, CalendarDays, FileText,
  AlertTriangle, Trash2, ChevronRight, Loader2,
} from "lucide-react";
import { formatFCFACompact } from "@/lib/format";

type Period = {
  id: string; name: string; startDate: string; endDate: string;
  status: string; closedAt?: string | null; closedById?: string | null;
  entryCount: number; budgetCount: number; monthCount: number;
  isDeletable: boolean; totalVolume?: number;
};

const STATUS_CFG: Record<string, { label: string; variant: "default" | "secondary" | "outline"; cls: string }> = {
  open:   { label: "Ouvert",   variant: "default",   cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  closed: { label: "Clôturé", variant: "secondary", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function FiscalPeriodsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [openCreate, setOpenCreate] = useState(false);
  const [confirmClose, setConfirmClose] = useState<Period | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<Period | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Period | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });

  const { data, isLoading } = useQuery<{ data: Period[] }>({
    queryKey: ["fiscal-periods"],
    queryFn: () => apiFetch("/api/accounting/fiscal-periods"),
  });

  const createMut = useMutation({
    mutationFn: () => apiFetch("/api/accounting/fiscal-periods", {
      method: "POST", body: JSON.stringify(form),
    }),
    onSuccess: () => {
      toast({ title: "Exercice créé" });
      setOpenCreate(false);
      setForm({ name: "", startDate: "", endDate: "" });
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/fiscal-periods/${id}/close`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Exercice clôturé", description: "Aucune nouvelle écriture ne pourra être créée sur cet exercice." });
      setConfirmClose(null);
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const reopenMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/fiscal-periods/${id}/reopen`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Exercice réouvert" });
      setConfirmReopen(null);
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/fiscal-periods/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Exercice supprimé" });
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
    },
    onError: (e: any) => toast({ title: "Impossible de supprimer", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const createNextMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/fiscal-periods/${id}/create-next`, { method: "POST" }),
    onSuccess: (p: any) => {
      toast({ title: `${p.name} créé`, description: "Le nouvel exercice est ouvert et prêt pour les saisies." });
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const periods = data?.data ?? [];

  // Déterminer si on peut créer l'exercice suivant (aucun exercice ouvert futur)
  const latestPeriod = periods[0]; // trié desc par startDate
  const canCreateNext = latestPeriod?.status === "closed";

  // Pré-remplir le formulaire avec l'année suivante
  const openCreateDialog = () => {
    const nextYear = latestPeriod
      ? parseInt(latestPeriod.endDate.slice(0, 4)) + 1
      : new Date().getFullYear();
    setForm({
      name: `Exercice ${nextYear}`,
      startDate: `${nextYear}-01-01`,
      endDate: `${nextYear}-12-31`,
    });
    setOpenCreate(true);
  };

  return (
    <AccountingShell
      title="Exercices comptables"
      subtitle="Gestion des exercices fiscaux — référentiel SYSCOHADA"
      actions={
        <Button onClick={openCreateDialog} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="w-4 h-4 mr-2" /> Nouvel exercice
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : periods.length === 0 ? (
        <Card className="border-dashed">
          <div className="p-10 text-center text-muted-foreground">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold">Aucun exercice comptable</p>
            <p className="text-sm mt-1">Créez votre premier exercice pour commencer la saisie comptable.</p>
            <Button className="mt-4 bg-amber-600 hover:bg-amber-700" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" /> Créer l'exercice
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Bouton rapide "Créer l'exercice suivant" quand le dernier est clôturé */}
          {canCreateNext && latestPeriod && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <ChevronRight className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>{latestPeriod.name}</strong> est clôturé.
                    Vous pouvez créer l'exercice {parseInt(latestPeriod.endDate.slice(0, 4)) + 1}.
                  </span>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 whitespace-nowrap flex-shrink-0"
                  disabled={createNextMut.isPending}
                  onClick={() => createNextMut.mutate(latestPeriod.id)}
                >
                  {createNextMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                  Créer l'exercice {parseInt(latestPeriod.endDate.slice(0, 4)) + 1}
                </Button>
              </CardContent>
            </Card>
          )}

          {periods.map((p) => {
            const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.open;
            const isCurrent = p.status === "open";
            const hasData = !p.isDeletable;
            return (
              <Card key={p.id} className={!isCurrent ? "opacity-75" : ""}>
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${isCurrent ? "bg-emerald-100" : "bg-slate-100"}`}>
                        {isCurrent
                          ? <LockOpen className="w-4 h-4 text-emerald-700" />
                          : <Lock className="w-4 h-4 text-slate-500" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold flex items-center gap-2 flex-wrap">
                          {p.name}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          Du <strong>{p.startDate}</strong> au <strong>{p.endDate}</strong>
                          {p.closedAt && (
                            <> — Clôturé le {new Date(p.closedAt).toLocaleDateString("fr-FR")}</>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          {hasData ? (
                            <>
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {p.entryCount} écriture(s)
                              </span>
                              {p.budgetCount > 0 && (
                                <span>{p.budgetCount} budget(s)</span>
                              )}
                              {p.totalVolume ? (
                                <span>Volume : {formatFCFACompact(p.totalVolume)}</span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Aucune donnée</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Clôturer / Réouvrir */}
                      {isCurrent ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => setConfirmClose(p)}
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" /> Clôturer
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmReopen(p)}
                        >
                          <LockOpen className="w-3.5 h-3.5 mr-1.5" /> Réouvrir
                        </Button>
                      )}
                      {/* Supprimer — uniquement si pas de données */}
                      {p.isDeletable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Supprimer cet exercice (aucune donnée)"
                          onClick={() => setConfirmDelete(p)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Dialogue : Créer un exercice ── */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel exercice comptable</DialogTitle>
            <DialogDescription>
              Définissez la période et le nom de l'exercice fiscal.
              Le système vérifiera qu'aucun exercice existant ne chevauche ces dates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-semibold mb-1 block">Nom de l'exercice *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Exercice 2027"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Date de début *</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Date de fin *</label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Annuler</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.name || !form.startDate || !form.endDate || createMut.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Confirmer clôture ── */}
      <Dialog open={!!confirmClose} onOpenChange={() => setConfirmClose(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Clôturer l'exercice
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de clôturer <strong>{confirmClose?.name}</strong>.<br />
              Après clôture, aucune écriture ne pourra être créée ou modifiée sur cet exercice.<br />
              Cette action est réversible (réouverture par un administrateur).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(null)}>Annuler</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => confirmClose && closeMut.mutate(confirmClose.id)}
              disabled={closeMut.isPending}
            >
              {closeMut.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              <Lock className="w-4 h-4 mr-1" /> Confirmer la clôture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Confirmer réouverture ── */}
      <Dialog open={!!confirmReopen} onOpenChange={() => setConfirmReopen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600" /> Réouvrir l'exercice
            </DialogTitle>
            <DialogDescription>
              Réouvrir <strong>{confirmReopen?.name}</strong> permettra à nouveau les saisies sur cette période.<br />
              Cette action est réservée aux administrateurs et doit être effectuée avec précaution.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReopen(null)}>Annuler</Button>
            <Button
              onClick={() => confirmReopen && reopenMut.mutate(confirmReopen.id)}
              disabled={reopenMut.isPending}
            >
              {reopenMut.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              <LockOpen className="w-4 h-4 mr-1" /> Réouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Confirmer suppression ── */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Supprimer l'exercice
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de supprimer <strong>{confirmDelete?.name}</strong>.<br />
              Cet exercice ne contient aucune donnée comptable. La suppression est définitive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}
