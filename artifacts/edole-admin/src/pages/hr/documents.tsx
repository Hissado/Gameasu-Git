import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, FolderArchive, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Doc = { id: string; collaboratorId: string; type: string; name: string; fileUrl: string; expiresAt?: string; uploadedAt: string };
type Collab = { id: string; firstName: string; lastName: string };

const TYPE_LABEL: Record<string, string> = {
  identity: "Pièce d'identité", diploma: "Diplôme", contract: "Contrat signé", medical: "Visite médicale", certification: "Certification", other: "Autre",
};

export default function HrDocumentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ collaboratorId: "", type: "identity", name: "", fileUrl: "", expiresAt: "" });

  const { data } = useQuery<{ data: Doc[] }>({ queryKey: ["hr-documents"], queryFn: () => apiFetch("/api/hr/documents") });
  const { data: collabs } = useQuery<{ data: Collab[] }>({ queryKey: ["collaborators-list"], queryFn: () => apiFetch("/api/collaborators?limit=200") });

  const collabMap = new Map(collabs?.data.map((c) => [c.id, `${c.firstName} ${c.lastName}`]) ?? []);

  const createMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/documents", { method: "POST", body: JSON.stringify({ ...form, expiresAt: form.expiresAt || null }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-documents"] }); setOpen(false); setForm({ collaboratorId: "", type: "identity", name: "", fileUrl: "", expiresAt: "" }); toast({ title: "Document ajouté" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-documents"] }); toast({ title: "Supprimé" }); },
  });

  // Upload helper
  const uploadFile = async (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    const token = localStorage.getItem("token");
    const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (!res.ok) throw new Error("Upload échoué");
    const { url } = await res.json();
    return url as string;
  };

  const filtered = (data?.data ?? []).filter((d) => !filter || (collabMap.get(d.collaboratorId) || "").toLowerCase().includes(filter.toLowerCase()) || d.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <HrShell
      title="Documents RH"
      subtitle="Pièces administratives et certifications"
      actions={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Ajouter un document</Button>}
    >
      <div className="mb-4">
        <Input placeholder="Rechercher par nom de collaborateur ou document…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-md" />
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Nom du document</th>
                <th className="px-4 py-3">Expire le</th>
                <th className="px-4 py-3">Ajouté le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground"><FolderArchive className="w-8 h-8 mx-auto mb-2 opacity-30" />Aucun document RH.</td></tr>
              )}
              {filtered.map((d) => {
                const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
                return (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{collabMap.get(d.collaboratorId) || "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{TYPE_LABEL[d.type] || d.type}</Badge></td>
                    <td className="px-4 py-3">
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        {d.name} <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {d.expiresAt ? <span className={expired ? "text-destructive font-semibold" : "text-muted-foreground"}>{new Date(d.expiresAt).toLocaleDateString("fr-FR")}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(d.uploadedAt).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer ce document ?")) delMut.mutate(d.id); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un document RH</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Collaborateur</label>
              <Select value={form.collaboratorId} onValueChange={(v) => setForm({ ...form, collaboratorId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {collabs?.data.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Type</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Nom du document</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CIN, CV, Diplôme licence…" /></div>
            <div>
              <label className="text-sm font-medium">Fichier</label>
              <Input type="file" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                try { const url = await uploadFile(f); setForm((s) => ({ ...s, fileUrl: url, name: s.name || f.name })); toast({ title: "Fichier téléversé" }); }
                catch (err: any) { toast({ variant: "destructive", title: "Upload échoué", description: err.message }); }
              }} />
              {form.fileUrl && <p className="text-xs text-muted-foreground mt-1">Stocké : {form.fileUrl}</p>}
            </div>
            <div><label className="text-sm font-medium">Date d'expiration (optionnelle)</label><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.collaboratorId || !form.name || !form.fileUrl || createMut.isPending}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
