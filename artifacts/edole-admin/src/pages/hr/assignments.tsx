import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Briefcase, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Assignment = { id: string; collaboratorId: string; collaboratorName: string; collaboratorAvatar?: string; projectId: string; projectName: string; role: string; allocationPct: number; startDate?: string; endDate?: string; status: string };
type Collab = { id: string; firstName: string; lastName: string };
type Project = { id: string; name: string };

export default function AssignmentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ collaboratorId: "", projectId: "", role: "", allocationPct: "100", startDate: "", endDate: "", status: "active" });

  const { data } = useQuery<{ data: Assignment[] }>({ queryKey: ["hr-assignments"], queryFn: () => apiFetch("/api/hr/assignments") });
  const { data: collabs } = useQuery<{ data: Collab[] }>({ queryKey: ["collaborators-list"], queryFn: () => apiFetch("/api/collaborators?limit=200") });
  const { data: projects } = useQuery<{ data: Project[] }>({ queryKey: ["projects-list"], queryFn: () => apiFetch("/api/projects?limit=200") });

  const createMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/assignments", {
      method: "POST",
      body: JSON.stringify({ ...form, allocationPct: Number(form.allocationPct), startDate: form.startDate || null, endDate: form.endDate || null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-assignments"] });
      qc.invalidateQueries({ queryKey: ["collaborators-list"] });
      setOpen(false);
      setForm({ collaboratorId: "", projectId: "", role: "", allocationPct: "100", startDate: "", endDate: "", status: "active" });
      toast({ title: "Affectation créée" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/assignments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-assignments"] }); toast({ title: "Supprimée" }); },
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", completed: "bg-slate-200 text-slate-700", cancelled: "bg-red-100 text-red-700" };
    return <Badge className={`${map[s] || "bg-muted"} border-0`}>{s}</Badge>;
  };

  return (
    <HrShell
      title="Affectations sur chantiers"
      subtitle="Affectations RH ↔ Opérations"
      actions={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouvelle affectation</Button>}
    >
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3">Chantier</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3 text-right">Charge</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(!data?.data || data.data.length === 0) && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground"><GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />Aucune affectation. Créez-en une pour relier un collaborateur à un chantier.</td></tr>
              )}
              {data?.data.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7 border border-border">
                        {a.collaboratorAvatar && <AvatarImage src={a.collaboratorAvatar} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{(a.collaboratorName || "??").split(" ").map(s => s[0]).slice(0,2).join("")}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{a.collaboratorName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground/80 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-muted-foreground" />{a.projectName}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{a.role}</Badge></td>
                  <td className="px-4 py-3 text-right font-semibold">{a.allocationPct}%</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {a.startDate ? new Date(a.startDate).toLocaleDateString("fr-FR") : "—"} → {a.endDate ? new Date(a.endDate).toLocaleDateString("fr-FR") : "…"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(a.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer cette affectation ?")) delMut.mutate(a.id); }}>
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
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle affectation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Collaborateur</label>
              <Select value={form.collaboratorId} onValueChange={(v) => setForm({ ...form, collaboratorId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{collabs?.data.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Chantier</label>
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{projects?.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Rôle sur le chantier</label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Chef d'équipe, Maçon, Conducteur…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Charge (%)</label><Input type="number" min="0" max="100" value={form.allocationPct} onChange={(e) => setForm({ ...form, allocationPct: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Statut</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Date de début</label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Date de fin</label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.collaboratorId || !form.projectId || !form.role || createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
