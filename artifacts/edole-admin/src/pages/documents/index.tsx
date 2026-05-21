import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FolderOpen, Upload, Trash2, ExternalLink, Search, Filter, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ENTITY_TYPES = [
  { v: "", l: "Tous types" },
  { v: "client", l: "Clients" },
  { v: "supplier", l: "Fournisseurs" },
  { v: "project", l: "Projets" },
  { v: "service", l: "Services" },
  { v: "rental", l: "Locations" },
  { v: "invoice", l: "Factures" },
  { v: "order", l: "Commandes" },
  { v: "collaborator", l: "Collaborateurs" },
  { v: "equipment", l: "Équipements" },
];

const CATEGORIES = ["other", "contract", "invoice", "quote", "photo", "report", "certificate", "id"];

type Doc = { id: string; name: string; fileUrl: string; mimeType?: string; size?: number; category: string; entityType?: string; entityId?: string; description?: string; tags: string[]; createdAt: string };

export default function DocumentsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const empty = { name: "", fileUrl: "", category: "other", entityType: "", entityId: "", description: "", tags: "" };
  const [form, setForm] = useState<any>(empty);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery<{ data: Doc[] }>({
    queryKey: ["documents", search, entityType, category],
    queryFn: () => apiFetch(`/api/documents?search=${encodeURIComponent(search)}&entityType=${entityType}&category=${category}&limit=200`),
  });

  const { data: stats } = useQuery<{ total: number; byEntity: any[]; byCategory: any[] }>({
    queryKey: ["documents-stats"],
    queryFn: () => apiFetch("/api/documents/stats"),
  });

  const create = useMutation({
    mutationFn: () => apiFetch("/api/documents", {
      method: "POST",
      body: { ...form, tags: typeof form.tags === "string" ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : form.tags, entityId: form.entityId || undefined, entityType: form.entityType || undefined },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); qc.invalidateQueries({ queryKey: ["documents-stats"] }); setOpen(false); setForm(empty); toast({ title: "Document ajouté" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); qc.invalidateQueries({ queryKey: ["documents-stats"] }); toast({ title: "Supprimé" }); },
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("token");
      const r = await fetch("/api/upload", { method: "POST", body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setForm({ ...form, fileUrl: j.url, name: form.name || file.name });
      toast({ title: "Fichier téléversé" });
    } catch (e: any) { toast({ variant: "destructive", title: "Erreur upload", description: e.message }); }
    finally { setUploading(false); }
  };

  const formatSize = (b?: number) => !b ? "—" : b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><FolderOpen className="w-7 h-7 text-primary" /> Documents</h1>
          <p className="text-muted-foreground mt-1">Gestion documentaire centralisée</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Upload className="w-4 h-4 mr-2" /> Ajouter un document</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground font-bold">Total documents</div><div className="text-3xl font-bold mt-1 text-primary">{stats?.total ?? 0}</div></CardContent></Card>
        <Card className="md:col-span-3"><CardContent className="p-5">
          <div className="text-xs uppercase text-muted-foreground font-bold mb-3">Par entité</div>
          <div className="flex flex-wrap gap-2">{(stats?.byEntity ?? []).map((e) => <Badge key={e.entityType} variant="outline" className="text-xs">{ENTITY_TYPES.find((t) => t.v === e.entityType)?.l || e.entityType} : {e.count}</Badge>)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-64"><Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="border rounded h-10 px-3 text-sm">
              {ENTITY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded h-10 px-3 text-sm">
              <option value="">Toutes catégories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Nom</th><th className="text-left p-3">Catégorie</th><th className="text-left p-3">Rattaché à</th><th className="text-left p-3">Tags</th><th className="text-right p-3">Taille</th><th className="text-right p-3">Date</th><th className="p-3 w-24"></th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                : (data?.data ?? []).length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun document.</td></tr>
                : data!.data.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-muted/20">
                    <td className="p-3"><a href={d.fileUrl} target="_blank" className="font-medium hover:text-primary flex items-center gap-1"><FileText className="w-4 h-4 text-muted-foreground" /> {d.name} <ExternalLink className="w-3 h-3" /></a>{d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}</td>
                    <td className="p-3"><Badge variant="outline" className="capitalize">{d.category}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{d.entityType ? `${ENTITY_TYPES.find((t) => t.v === d.entityType)?.l || d.entityType}${d.entityId ? ` · ${d.entityId.slice(0, 8)}` : ""}` : "—"}</td>
                    <td className="p-3 text-xs">{(d.tags || []).map((t) => <Badge key={t} variant="outline" className="mr-1 text-[10px]">{t}</Badge>)}</td>
                    <td className="p-3 text-right text-xs font-mono">{formatSize(d.size)}</td>
                    <td className="p-3 text-right text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3 text-right"><Button size="icon" variant="ghost" onClick={() => { if (confirm(`Supprimer "${d.name}" ?`)) del.mutate(d.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium">Fichier *</label>
              <Input type="file" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} disabled={uploading} />
              {form.fileUrl && <div className="text-xs text-emerald-700 mt-1">✓ Téléversé : {form.fileUrl}</div>}
            </div>
            <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Catégorie</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium">Type d'entité</label>
                <select value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  {ENTITY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l || "—"}</option>)}
                </select>
              </div>
            </div>
            {form.entityType && <div><label className="text-xs font-medium">ID de l'entité (UUID)</label><Input value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })} placeholder="Optionnel" /></div>}
            <div><label className="text-xs font-medium">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><label className="text-xs font-medium">Tags (virgules)</label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.fileUrl || !form.name}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
