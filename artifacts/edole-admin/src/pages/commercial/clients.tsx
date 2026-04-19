import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Building2, Mail, Phone, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Client = { id: string; name: string; email?: string; phone?: string; industry?: string; website?: string; address?: string; status: string };

export default function ClientsCommercial() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<any>({ name: "", email: "", phone: "", industry: "", website: "", address: "", status: "active" });

  const { data, isLoading } = useQuery<{ data: Client[] }>({
    queryKey: ["clients-commercial", search],
    queryFn: () => apiFetch(`/api/clients?search=${encodeURIComponent(search)}&limit=200`),
  });

  const upsert = useMutation({
    mutationFn: () => edit
      ? apiFetch(`/api/clients/${edit.id}`, { method: "PUT", body: form })
      : apiFetch("/api/clients", { method: "POST", body: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-commercial"] });
      setOpen(false); setEdit(null); setForm({ name: "", email: "", phone: "", industry: "", website: "", address: "", status: "active" });
      toast({ title: edit ? "Client modifié" : "Client créé" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients-commercial"] }); toast({ title: "Supprimé" }); },
  });

  const openEdit = (c: Client) => {
    setEdit(c);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", industry: c.industry || "", website: c.website || "", address: c.address || "", status: c.status });
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Building2 className="w-7 h-7 text-primary" /> Clients</h1>
          <p className="text-muted-foreground mt-1">Référentiel client unifié — partagé avec factures, paiements, projets, locations et documents.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button onClick={() => { setEdit(null); setForm({ name: "", email: "", phone: "", industry: "", website: "", address: "", status: "active" }); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau client
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Nom</th><th className="text-left p-3">Secteur</th><th className="text-left p-3">Contact</th><th className="text-center p-3">Statut</th><th className="p-3 w-24"></th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                : (data?.data ?? []).length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucun client trouvé.</td></tr>
                : data!.data.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="p-3 font-medium">{c.name}{c.website && <a href={c.website} target="_blank" className="ml-2 text-muted-foreground hover:text-primary"><Globe className="inline w-3 h-3" /></a>}</td>
                    <td className="p-3 text-muted-foreground">{c.industry || "—"}</td>
                    <td className="p-3 text-xs space-y-1">
                      {c.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</div>}
                      {c.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</div>}
                    </td>
                    <td className="p-3 text-center"><Badge variant="outline" className="capitalize">{c.status}</Badge></td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Supprimer "${c.name}" ?`)) del.mutate(c.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Modifier le client" : "Nouveau client"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="text-xs font-medium">Téléphone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Secteur</label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="BTP, Industrie…" /></div>
              <div><label className="text-xs font-medium">Site web</label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
            </div>
            <div><label className="text-xs font-medium">Adresse</label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Statut</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                <option value="prospect">Prospect</option><option value="active">Actif</option><option value="inactive">Inactif</option>
              </select>
            </div>
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
