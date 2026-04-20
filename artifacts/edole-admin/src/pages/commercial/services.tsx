import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";

type Service = { id: string; code: string; name: string; category?: string; unit: string; unitPrice: string; description?: string; isActive: boolean };

export default function ServicesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Service | null>(null);
  const [form, setForm] = useState<any>({ code: "", name: "", category: "", unit: "forfait", unitPrice: 0, description: "", isActive: true });

  const { data, isLoading } = useQuery<{ data: Service[] }>({
    queryKey: ["services"],
    queryFn: () => apiFetch("/api/services"),
  });

  const upsert = useMutation({
    mutationFn: () => edit
      ? apiFetch(`/api/services/${edit.id}`, { method: "PUT", body: form })
      : apiFetch("/api/services", { method: "POST", body: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      setOpen(false); setEdit(null);
      setForm({ code: "", name: "", category: "", unit: "forfait", unitPrice: 0, description: "", isActive: true });
      toast({ title: edit ? "Service modifié" : "Service créé" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/services/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); toast({ title: "Supprimé" }); },
  });

  const openEdit = (s: Service) => {
    setEdit(s);
    setForm({ code: s.code, name: s.name, category: s.category || "", unit: s.unit, unitPrice: Number(s.unitPrice), description: s.description || "", isActive: s.isActive });
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Briefcase className="w-7 h-7 text-primary" /> Catalogue de services</h1>
          <p className="text-muted-foreground mt-1">Catalogue des prestations facturables</p>
        </div>
        <Button onClick={() => { setEdit(null); setForm({ code: "", name: "", category: "", unit: "forfait", unitPrice: 0, description: "", isActive: true }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nouveau service
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Code</th><th className="text-left p-3">Nom</th><th className="text-left p-3">Catégorie</th><th className="text-left p-3">Unité</th><th className="text-right p-3">Prix unitaire</th><th className="p-3">Statut</th><th className="p-3 w-24"></th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                : (data?.data ?? []).length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun service. Cliquez sur « Nouveau service » pour commencer.</td></tr>
                : data!.data.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-muted-foreground">{s.category || "—"}</td>
                    <td className="p-3"><Badge variant="outline">{s.unit}</Badge></td>
                    <td className="p-3 text-right font-semibold">{formatFCFA(Number(s.unitPrice))}</td>
                    <td className="p-3 text-center">{s.isActive ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}</td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Supprimer "${s.name}" ?`)) del.mutate(s.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Modifier le service" : "Nouveau service"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Code *</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SVC-001" /></div>
              <div><label className="text-xs font-medium">Catégorie</label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Construction, Location…" /></div>
            </div>
            <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Unité</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  <option value="forfait">Forfait</option><option value="jour">Jour</option><option value="heure">Heure</option><option value="m²">m²</option><option value="m³">m³</option><option value="ml">ml</option><option value="unité">Unité</option>
                </select>
              </div>
              <div><label className="text-xs font-medium">Prix unitaire (FCFA)</label><Input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></div>
            </div>
            <div><label className="text-xs font-medium">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Service actif</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>{edit ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
