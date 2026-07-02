import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, FileSignature, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Contract = { id: string; collaboratorId: string; collaboratorName: string; type: string; status: string; startDate: string; endDate?: string; monthlySalary?: number; jobTitle?: string };
type Collab = { id: string; firstName: string; lastName: string };

export default function ContractsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ collaboratorId: "", type: "CDI", status: "active", startDate: "", endDate: "", monthlySalary: "", jobTitle: "", workLocation: "" });

  const { data } = useQuery<{ data: Contract[] }>({ queryKey: ["hr-contracts"], queryFn: () => apiFetch("/api/hr/contracts") });
  const { data: collabs } = useQuery<{ data: Collab[] }>({ queryKey: ["collaborators-list"], queryFn: () => apiFetch("/api/collaborators?limit=200") });

  const createMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/contracts", {
      method: "POST",
      body: JSON.stringify({ ...form, monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null, endDate: form.endDate || null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-contracts"] });
      qc.invalidateQueries({ queryKey: ["hr-dashboard"] });
      setOpen(false);
      setForm({ collaboratorId: "", type: "CDI", status: "active", startDate: "", endDate: "", monthlySalary: "", jobTitle: "", workLocation: "" });
      toast({ title: "Contrat créé" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-contracts"] }); toast({ title: "Supprimé" }); },
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", terminated: "bg-slate-200 text-slate-700", suspended: "bg-amber-100 text-amber-700", expired: "bg-red-100 text-red-700", draft: "bg-blue-100 text-blue-700" };
    return <Badge className={`${map[s] || "bg-muted"} border-0`}>{s}</Badge>;
  };

  return (
    <HrShell
      title="Contrats"
      subtitle="Contrats de travail · CDI, CDD, missions, stages"
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/hr/contracts/export.xlsx?token=${localStorage.getItem("auth_token")}`, "_blank")}>
            <Download className="w-4 h-4 mr-1" />Export Excel
          </Button>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouveau contrat</Button>
        </div>
      }
    >
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Poste</th>
                <th className="px-4 py-3">Début</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3 text-right">Salaire mensuel</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(!data?.data || data.data.length === 0) && (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground"><FileSignature className="w-8 h-8 mx-auto mb-2 opacity-30" />Aucun contrat enregistré.</td></tr>
              )}
              {data?.data.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{c.collaboratorName || "—"}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{c.type}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{c.jobTitle || "—"}</td>
                  <td className="px-4 py-3">{new Date(c.startDate).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.endDate ? new Date(c.endDate).toLocaleDateString("fr-FR") : "Indéterminée"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{c.monthlySalary ? formatFCFA(c.monthlySalary) : "—"}</td>
                  <td className="px-4 py-3">{statusBadge(c.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer ce contrat ?")) delMut.mutate(c.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Collaborateur</label>
              <Select value={form.collaboratorId} onValueChange={(v) => setForm({ ...form, collaboratorId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {collabs?.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Type</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CDI">CDI</SelectItem>
                    <SelectItem value="CDD">CDD</SelectItem>
                    <SelectItem value="stage">Stage</SelectItem>
                    <SelectItem value="prestation">Prestation</SelectItem>
                    <SelectItem value="mission">Mission</SelectItem>
                    <SelectItem value="apprentissage">Apprentissage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-sm font-medium">Statut</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="suspended">Suspendu</SelectItem>
                    <SelectItem value="terminated">Terminé</SelectItem>
                    <SelectItem value="expired">Expiré</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="text-sm font-medium">Intitulé du poste</label><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Date de début</label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Date de fin</label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Salaire mensuel (XOF)</label><Input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Lieu de travail</label><Input value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.collaboratorId || !form.type || !form.startDate || createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
