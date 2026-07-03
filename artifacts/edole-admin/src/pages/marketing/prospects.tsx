import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, UserPlus, ArrowRight, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Prospect = { id: string; firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; source?: string; status: string; tags: string[]; notes?: string; convertedToClientId?: string };

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  qualified: "bg-violet-100 text-violet-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost: "bg-slate-200 text-slate-600",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  converted: "Converti",
  lost: "Perdu",
};
const SOURCE_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  website: "Site web",
  cold_call: "Appel sortant",
  conference: "Conférence",
  referral: "Recommandation",
  email: "E-mail",
  social_media: "Réseaux sociaux",
  organic: "Organique",
  paid_ad: "Publicité",
  partner: "Partenaire",
  event: "Événement",
  interne: "Interne",
};

export default function ProspectsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Prospect | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const empty = { firstName: "", lastName: "", email: "", phone: "", company: "", source: "", status: "new", notes: "", tags: "" };
  const [form, setForm] = useState<any>(empty);

  const { data, isLoading } = useQuery<{ data: Prospect[] }>({
    queryKey: ["prospects", search, filterStatus],
    queryFn: () => apiFetch(`/api/prospects?search=${encodeURIComponent(search)}&status=${filterStatus}`),
  });

  const upsert = useMutation({
    mutationFn: () => {
      const payload = { ...form, tags: typeof form.tags === "string" ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : form.tags };
      return edit
        ? apiFetch(`/api/prospects/${edit.id}`, { method: "PUT", body: payload })
        : apiFetch("/api/prospects", { method: "POST", body: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      setOpen(false); setEdit(null); setForm(empty);
      toast({ title: edit ? "Prospect modifié" : "Prospect créé" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/prospects/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prospects"] }); toast({ title: "Supprimé" }); },
  });

  const convert = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/prospects/${id}/convert`, { method: "POST" }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["prospects"] }); toast({ title: "Converti en client", description: r.client?.name }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const openEdit = (p: Prospect) => {
    setEdit(p);
    setForm({ firstName: p.firstName || "", lastName: p.lastName || "", email: p.email || "", phone: p.phone || "", company: p.company || "", source: p.source || "", status: p.status, notes: p.notes || "", tags: (p.tags || []).join(", ") });
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Target className="w-7 h-7 text-primary" /> Prospects</h1>
          <p className="text-muted-foreground mt-1">Pipeline de prospection externe</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded h-10 px-3 text-sm">
            <option value="">Tous statuts</option>
            <option value="new">Nouveau</option><option value="contacted">Contacté</option>
            <option value="qualified">Qualifié</option><option value="converted">Converti</option><option value="lost">Perdu</option>
          </select>
          <Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nouveau prospect</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Contact</th><th className="text-left p-3">Société</th><th className="text-left p-3">Source</th><th className="text-center p-3">Statut</th><th className="text-left p-3">Tags</th><th className="p-3 w-32"></th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                : (data?.data ?? []).length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun prospect.</td></tr>
                : data!.data.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium">{p.firstName} {p.lastName}</div>
                      <div className="text-xs text-muted-foreground">{p.email || p.phone || "—"}</div>
                    </td>
                    <td className="p-3">{p.company || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{p.source ? (SOURCE_LABEL[p.source] ?? p.source) : "—"}</td>
                    <td className="p-3 text-center"><Badge className={`${STATUS_COLOR[p.status] || "bg-muted"} border-0`}>{STATUS_LABEL[p.status] ?? p.status}</Badge></td>
                    <td className="p-3 text-xs">{(p.tags || []).map((t) => <Badge key={t} variant="outline" className="mr-1 text-[10px]">{t}</Badge>)}</td>
                    <td className="p-3 text-right">
                      {p.status !== "converted" && p.status !== "lost" && (
                        <Button size="icon" variant="ghost" title="Convertir en client" onClick={() => { if (confirm("Convertir ce prospect en client ?")) convert.mutate(p.id); }}>
                          <UserPlus className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ?")) del.mutate(p.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Modifier le prospect" : "Nouveau prospect"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Prénom</label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><label className="text-xs font-medium">Nom</label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="text-xs font-medium">Téléphone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><label className="text-xs font-medium">Société</label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Source</label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Web, Salon, Cold call…" /></div>
              <div><label className="text-xs font-medium">Statut</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  <option value="new">Nouveau</option><option value="contacted">Contacté</option>
                  <option value="qualified">Qualifié</option><option value="converted">Converti</option><option value="lost">Perdu</option>
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium">Tags (séparés par virgules)</label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, salon-2026" /></div>
            <div><label className="text-xs font-medium">Notes</label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
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
