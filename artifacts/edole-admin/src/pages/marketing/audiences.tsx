import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MarketingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Pencil, Trash2, Users, Eye, Loader2 } from "lucide-react";

type Audience = {
  id: string; name: string; description?: string; type: string;
  filters: any; contactsCount: number; lastComputedAt?: string;
};

const SOURCE_OPTS = [
  { k: "clients", l: "Clients" },
  { k: "prospects", l: "Prospects" },
  { k: "collaborators", l: "Collaborateurs" },
  { k: "users", l: "Utilisateurs internes" },
];

export default function AudiencesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Audience | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const empty = {
    name: "", description: "", type: "dynamic",
    sources: [] as string[], status: "", tags: "",
    requireEmail: false, requirePhone: false, requireWhatsapp: false,
    inactiveSinceDays: "",
  };
  const [form, setForm] = useState<any>(empty);

  const { data, isLoading } = useQuery<{ data: Audience[] }>({
    queryKey: ["marketing-audiences"],
    queryFn: () => apiFetch("/api/marketing/audiences"),
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["marketing-audience", detailId],
    queryFn: () => apiFetch(`/api/marketing/audiences/${detailId}`),
    enabled: !!detailId,
  });

  // Preview dynamique : reconstruit les params depuis le formulaire
  const previewParams = useMemo(() => {
    if (!open || form.type !== "dynamic") return null;
    const p = new URLSearchParams();
    if (form.sources.length) p.set("sources", form.sources.join(","));
    if (form.status) p.set("status", form.status);
    const tagsArr: string[] = form.tags
      ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];
    if (tagsArr.length) p.set("tags", tagsArr.join(","));
    if (form.requireEmail) p.set("requireEmail", "true");
    if (form.requirePhone) p.set("requirePhone", "true");
    return p.toString();
  }, [open, form.type, form.sources, form.status, form.tags, form.requireEmail, form.requirePhone]);

  const { data: livePreview, isFetching: previewLoading } = useQuery<{ total: number; breakdown: Record<string, number> }>({
    queryKey: ["audience-live-preview", previewParams],
    queryFn: () => apiFetch(`/api/marketing/contacts?${previewParams}&limit=1`),
    enabled: open && form.type === "dynamic" && previewParams !== null,
    staleTime: 800,
  });

  const upsert = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, description: form.description, type: form.type,
        filters: {
          sources: form.sources.length ? form.sources : undefined,
          status: form.status || undefined,
          tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : undefined,
          requireEmail: form.requireEmail,
          requirePhone: form.requirePhone,
          requireWhatsapp: form.requireWhatsapp,
          inactiveSinceDays: form.inactiveSinceDays ? Number(form.inactiveSinceDays) : undefined,
        },
      };
      return edit
        ? apiFetch(`/api/marketing/audiences/${edit.id}`, { method: "PUT", body: payload })
        : apiFetch("/api/marketing/audiences", { method: "POST", body: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-audiences"] });
      setOpen(false); setEdit(null); setForm(empty);
      toast({ title: edit ? "Audience modifiée" : "Audience créée" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const recompute = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/audiences/${id}/recompute`, { method: "POST" }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["marketing-audiences"] }); toast({ title: "Audience recalculée", description: `${r.count} contact(s)` }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/audiences/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-audiences"] }); toast({ title: "Supprimée" }); },
  });

  const openEdit = (a: Audience) => {
    setEdit(a);
    const f = a.filters || {};
    setForm({
      name: a.name, description: a.description || "", type: a.type,
      sources: f.sources || [], status: f.status || "",
      tags: (f.tags || []).join(", "),
      requireEmail: !!f.requireEmail, requirePhone: !!f.requirePhone, requireWhatsapp: !!f.requireWhatsapp,
      inactiveSinceDays: f.inactiveSinceDays || "",
    });
    setOpen(true);
  };

  const toggleSource = (k: string) => setForm({ ...form, sources: form.sources.includes(k) ? form.sources.filter((x: string) => x !== k) : [...form.sources, k] });

  return (
    <MarketingShell title="Audiences" subtitle="Segments dynamiques et listes statiques"
      actions={<Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nouvelle audience</Button>}>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nom</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Sources</th>
                <th className="text-right p-3">Contacts</th>
                <th className="text-left p-3">Mise à jour</th>
                <th className="p-3 w-40"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                : (data?.data ?? []).length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune audience.</td></tr>
                : data!.data.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium">{a.name}</div>
                      {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                    </td>
                    <td className="p-3"><Badge variant="outline">{a.type === "dynamic" ? "Dynamique" : "Statique"}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{(a.filters?.sources || []).join(", ") || "Toutes"}</td>
                    <td className="p-3 text-right font-mono font-semibold flex items-center justify-end gap-1"><Users className="w-3 h-3" /> {a.contactsCount}</td>
                    <td className="p-3 text-xs text-muted-foreground">{a.lastComputedAt ? new Date(a.lastComputedAt).toLocaleString("fr-FR") : "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Aperçu" onClick={() => setDetailId(a.id)}><Eye className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" title="Recalculer" onClick={() => recompute.mutate(a.id)}><RefreshCw className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" title="Modifier" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" title="Supprimer" onClick={() => { if (confirm("Supprimer ?")) del.mutate(a.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Modifier l'audience" : "Nouvelle audience"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Clients VIP Secteur BTP" /></div>
              <div><label className="text-xs font-medium">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  <option value="dynamic">Dynamique (filtres rejoués à l'envoi)</option>
                  <option value="static">Statique (liste figée)</option>
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>

            <div className="border-t pt-3">
              <label className="text-xs font-medium mb-2 block">Sources de contacts</label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTS.map((s) => (
                  <button key={s.k} type="button" onClick={() => toggleSource(s.k)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${form.sources.includes(s.k) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                    {s.l}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5">Vide = toutes les sources.</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Filtrer par statut</label>
                <Input value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} placeholder="active, new, qualified…" />
              </div>
              <div><label className="text-xs font-medium">Tags (virgules)</label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, salon-2026" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t pt-3">
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={form.requireEmail} onChange={(e) => setForm({ ...form, requireEmail: e.target.checked })} /> Email requis</label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={form.requirePhone} onChange={(e) => setForm({ ...form, requirePhone: e.target.checked })} /> Téléphone requis</label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={form.requireWhatsapp} onChange={(e) => setForm({ ...form, requireWhatsapp: e.target.checked })} /> WhatsApp requis</label>
            </div>

            <div><label className="text-xs font-medium">Inactif depuis (jours)</label>
              <Input type="number" value={form.inactiveSinceDays} onChange={(e) => setForm({ ...form, inactiveSinceDays: e.target.value })} placeholder="90" />
            </div>

            {/* Preview en temps réel */}
            {form.type === "dynamic" && (
              <div className={`border rounded-lg p-3 flex items-center justify-between transition-colors ${previewLoading ? "bg-muted/30" : (livePreview ? "bg-primary/5 border-primary/20" : "bg-muted/20")}`}>
                <div className="flex items-center gap-2">
                  {previewLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : <Users className="w-4 h-4 text-primary" />
                  }
                  <span className="text-sm font-medium">
                    {previewLoading ? "Calcul en cours…" : livePreview
                      ? <><span className="text-primary font-bold">{livePreview.total.toLocaleString("fr-FR")} contact{livePreview.total > 1 ? "s" : ""}</span> correspondent à ces critères</>
                      : "Aperçu en temps réel"
                    }
                  </span>
                </div>
                {livePreview && !previewLoading && livePreview.breakdown && (
                  <div className="flex gap-2">
                    {Object.entries(livePreview.breakdown).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[10px] capitalize">{k} : {v as number}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.name}>{edit ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{detail?.name || "Audience"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-primary">{detail?.count ?? 0} <span className="text-base font-normal text-muted-foreground">contact(s)</span></div>
            {detail?.sample?.length > 0 && (
              <div>
                <div className="text-xs uppercase font-bold text-muted-foreground mb-2">Échantillon</div>
                <ul className="text-xs space-y-1 max-h-80 overflow-y-auto">
                  {detail.sample.map((c: any) => (
                    <li key={`${c.type}:${c.id}`} className="flex justify-between border-b pb-1">
                      <span>{c.name} <Badge variant="outline" className="ml-1 text-[9px]">{{ client: "Client", prospect: "Prospect", collaborator: "Collaborateur", user: "Utilisateur" }[c.type as string] ?? c.type}</Badge></span>
                      <span className="text-muted-foreground">{c.email || c.phone || "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MarketingShell>
  );
}
