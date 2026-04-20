import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Network, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Dept = { id: string; code: string; name: string; description?: string; color?: string; collaboratorsCount: number };

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "", color: "#FF3C00" });

  const { data } = useQuery<{ data: Dept[] }>({ queryKey: ["hr-departments"], queryFn: () => apiFetch("/api/hr/departments") });

  const createMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/departments", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-departments"] });
      qc.invalidateQueries({ queryKey: ["hr-dashboard"] });
      setOpen(false);
      setForm({ code: "", name: "", description: "", color: "#FF3C00" });
      toast({ title: "Département créé" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-departments"] }); toast({ title: "Supprimé" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const autoAssignMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/auto-assign-departments", { method: "POST" }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["hr-departments"] });
      qc.invalidateQueries({ queryKey: ["hr-dashboard"] });
      qc.invalidateQueries({ queryKey: ["collaborators-list"] });
      toast({ title: "Auto-affectation terminée", description: `${r.updated} collaborateur(s) sur ${r.total} rattaché(s) à un pôle.` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  return (
    <HrShell
      title="Départements / Pôles"
      subtitle="Structure organisationnelle"
      actions={
        <>
          <Button variant="outline" onClick={() => { if (confirm("Affecter automatiquement tous les collaborateurs sans pôle au département le plus pertinent (basé sur leur fonction) ?")) autoAssignMut.mutate(); }} disabled={autoAssignMut.isPending}>
            <Wand2 className="w-4 h-4 mr-2" /> Auto-affecter les collaborateurs
          </Button>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouveau département</Button>
        </>
      }
    >
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Département</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Effectif</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(!data?.data || data.data.length === 0) && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Aucun département. Créez-en un pour structurer votre organisation.</td></tr>
              )}
              {data?.data.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color || "#94a3b8" }} />
                    {d.name}
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline" className="font-mono text-xs">{d.code}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{d.description || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{d.collaboratorsCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Supprimer ${d.name} ?`)) delMut.mutate(d.id); }}>
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
          <DialogHeader><DialogTitle>Nouveau département</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Code</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="OPS, RH, COM…" /></div>
            <div><label className="text-sm font-medium">Nom</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Opérations" /></div>
            <div><label className="text-sm font-medium">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center gap-3"><label className="text-sm font-medium">Couleur</label><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-16 rounded border" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.code || !form.name || createMut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
