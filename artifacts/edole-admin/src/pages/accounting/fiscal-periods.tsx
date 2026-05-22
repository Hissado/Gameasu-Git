import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { AccountingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Lock, LockOpen, CalendarDays, FileText, AlertTriangle } from "lucide-react";
import { formatFCFA } from "@/lib/format";

type Period = {
  id: string; name: string; startDate: string; endDate: string;
  status: string; closedAt?: string; closedById?: string;
  entryCount?: number; totalVolume?: number;
};

export default function FiscalPeriodsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [openCreate, setOpenCreate] = useState(false);
  const [confirmClose, setConfirmClose] = useState<Period | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<Period | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });

  const { data, isLoading } = useQuery<{ data: Period[] }>({
    queryKey: ["fiscal-periods"],
    queryFn: () => apiFetch("/api/accounting/fiscal-periods"),
  });

  const createMut = useMutation({
    mutationFn: () => apiFetch("/api/accounting/fiscal-periods", { method: "POST", body: JSON.stringify(form) }),
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

  const periods = data?.data ?? [];

  return (
    <AccountingShell
      title="Exercices comptables"
      subtitle="Ouverture et clôture des périodes fiscales — référentiel SYSCOHADA"
      actions={
        <Button onClick={() => setOpenCreate(true)} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="w-4 h-4 mr-2" /> Nouvel exercice
        </Button>
      }
    >
      {isLoading ? (
        <div className="text-muted-foreground">Chargement…</div>
      ) : periods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold">Aucun exercice comptable</p>
            <p className="text-sm mt-1">Créez votre premier exercice pour commencer la saisie comptable.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {periods.map((p) => (
            <Card key={p.id} className={p.status === "closed" ? "opacity-80" : ""}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded-lg ${p.status === "open" ? "bg-emerald-100" : "bg-slate-100"}`}>
                      {p.status === "open"
                        ? <LockOpen className="w-4 h-4 text-emerald-700" />
                        : <Lock className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {p.name}
                        <Badge variant={p.status === "open" ? "default" : "secondary"}>
                          {p.status === "open" ? "Ouvert" : "Clôturé"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        Du <strong>{p.startDate}</strong> au <strong>{p.endDate}</strong>
                        {p.closedAt && <> — Clôturé le {new Date(p.closedAt).toLocaleDateString("fr-FR")}</>}
                      </div>
                      {p.entryCount !== undefined && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <FileText className="w-3 h-3 inline mr-1" />
                          {p.entryCount} écriture(s) validée(s)
                          {p.totalVolume ? <> · Volume : {formatFCFA(p.totalVolume)}</> : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {p.status === "open" ? (
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Création */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel exercice comptable</DialogTitle>
            <DialogDescription>Définissez la période et le nom de l'exercice fiscal.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-semibold mb-1 block">Nom de l'exercice *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Exercice 2026" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Date de début *</label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Date de fin *</label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Annuler</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.name || !form.startDate || !form.endDate || createMut.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation clôture */}
      <Dialog open={!!confirmClose} onOpenChange={() => setConfirmClose(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Clôturer l'exercice
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de clôturer <strong>{confirmClose?.name}</strong>.<br />
              Après clôture, aucune écriture ne pourra être créée ou modifiée sur cet exercice.<br />
              Cette action peut être annulée par un administrateur (réouverture).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(null)}>Annuler</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => confirmClose && closeMut.mutate(confirmClose.id)}
              disabled={closeMut.isPending}
            >
              <Lock className="w-4 h-4 mr-1" /> Confirmer la clôture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation réouverture */}
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
              <LockOpen className="w-4 h-4 mr-1" /> Réouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}
