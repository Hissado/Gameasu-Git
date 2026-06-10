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
import { Plus, Trash2, FolderArchive, ExternalLink, Upload, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Doc = { id: string; collaboratorId: string; type: string; name: string; fileUrl: string; expiresAt?: string; uploadedAt: string };
type Collab = { id: string; firstName: string; lastName: string };

const TYPE_LABEL: Record<string, string> = {
  identity: "Pièce d'identité",
  diploma: "Diplôme",
  contract: "Contrat signé",
  medical: "Visite médicale",
  certification: "Certification",
  payslip: "Bulletin de paie",
  other: "Autre",
};

const TYPE_COLOR: Record<string, string> = {
  identity: "bg-blue-50 text-blue-700 border-blue-200",
  diploma: "bg-violet-50 text-violet-700 border-violet-200",
  contract: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medical: "bg-rose-50 text-rose-700 border-rose-200",
  certification: "bg-amber-50 text-amber-700 border-amber-200",
  payslip: "bg-orange-50 text-orange-700 border-orange-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

async function uploadToStorage(file: File): Promise<string> {
  const { uploadURL, objectPath } = await apiFetch<{ uploadURL: string; objectPath: string }>(
    "/api/storage/uploads/request-url",
    {
      method: "POST",
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
    }
  );
  await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  return `/api/storage${objectPath}`;
}

export default function HrDocumentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ collaboratorId: "", type: "identity", name: "", fileUrl: "", expiresAt: "" });

  const { data } = useQuery<{ data: Doc[] }>({ queryKey: ["hr-documents"], queryFn: () => apiFetch("/api/hr/documents") });
  const { data: collabs } = useQuery<{ data: Collab[] }>({ queryKey: ["collaborators-list"], queryFn: () => apiFetch("/api/collaborators?limit=200") });

  const collabMap = new Map(collabs?.data.map((c) => [c.id, `${c.firstName} ${c.lastName}`]) ?? []);

  const createMut = useMutation({
    mutationFn: () => apiFetch("/api/hr/documents", { method: "POST", body: JSON.stringify({ ...form, expiresAt: form.expiresAt || null }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-documents"] });
      setOpen(false);
      setForm({ collaboratorId: "", type: "identity", name: "", fileUrl: "", expiresAt: "" });
      toast({ title: "Document ajouté au coffre-fort" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-documents"] }); toast({ title: "Document supprimé" }); },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadToStorage(f);
      setForm(s => ({ ...s, fileUrl: url, name: s.name || f.name }));
      toast({ title: "Fichier téléversé", description: f.name });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Échec de l'upload", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const all = data?.data ?? [];
  const filtered = all.filter((d) => {
    const matchSearch = !filter || (collabMap.get(d.collaboratorId) || "").toLowerCase().includes(filter.toLowerCase()) || d.name.toLowerCase().includes(filter.toLowerCase());
    const matchType = typeFilter === "all" || d.type === typeFilter;
    return matchSearch && matchType;
  });

  const expiringCount = all.filter(d => d.expiresAt && new Date(d.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length;

  return (
    <HrShell
      title="Coffre-fort Documents RH"
      subtitle="Pièces administratives, contrats et certifications"
      actions={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Ajouter un document</Button>}
    >
      {expiringCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{expiringCount} document{expiringCount > 1 ? "s" : ""}</strong> expire{expiringCount > 1 ? "nt" : ""} dans les 30 prochains jours</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <Input placeholder="Rechercher par collaborateur ou document…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {Object.entries(TYPE_LABEL).map(([type, label]) => {
          const count = all.filter(d => d.type === type).length;
          if (count === 0) return null;
          return (
            <button key={type} onClick={() => setTypeFilter(t => t === type ? "all" : type)} className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${typeFilter === type ? TYPE_COLOR[type] : "bg-white border-slate-200"}`}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-900">{count}</p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Expire le</th>
                <th className="px-4 py-3">Ajouté le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FolderArchive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Aucun document RH</p>
                </td></tr>
              )}
              {filtered.map((d) => {
                const expired = d.expiresAt && new Date(d.expiresAt) < new Date();
                const expiringSoon = d.expiresAt && !expired && new Date(d.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                return (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{collabMap.get(d.collaboratorId) || "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className={`text-xs ${TYPE_COLOR[d.type] || ""}`}>{TYPE_LABEL[d.type] || d.type}</Badge></td>
                    <td className="px-4 py-3">
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        {d.name} <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {d.expiresAt
                        ? <span className={expired ? "text-destructive font-semibold" : expiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                            {new Date(d.expiresAt).toLocaleDateString("fr-FR")}
                            {expired && " ⚠️"}{expiringSoon && " ⏰"}
                          </span>
                        : <span className="text-muted-foreground">—</span>}
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

      <Dialog open={open} onOpenChange={(v) => { if (!uploading) { setOpen(v); if (!v) setForm({ collaboratorId: "", type: "identity", name: "", fileUrl: "", expiresAt: "" }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un document au coffre-fort</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Collaborateur</label>
              <Select value={form.collaboratorId} onValueChange={(v) => setForm({ ...form, collaboratorId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir un collaborateur…" /></SelectTrigger>
                <SelectContent>{collabs?.data.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Type de document</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Nom du document</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CIN, CV, Contrat CDI, Diplôme licence…" />
            </div>
            <div>
              <label className="text-sm font-medium">Fichier</label>
              <div className="mt-1">
                <label className={`flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading ? "border-primary/40 bg-primary/5" : "border-slate-300 hover:border-primary/50 hover:bg-slate-50"}`}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm text-slate-600">
                    {uploading ? "Envoi en cours…" : form.fileUrl ? "Fichier joint ✓ (cliquez pour changer)" : "Cliquez pour sélectionner un fichier"}
                  </span>
                  <input type="file" className="hidden" disabled={uploading} onChange={handleFileChange} />
                </label>
                {form.fileUrl && !uploading && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">✓ Fichier téléversé dans le coffre-fort</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Date d'expiration (optionnelle)</label>
              <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>Annuler</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.collaboratorId || !form.name || !form.fileUrl || createMut.isPending || uploading}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
