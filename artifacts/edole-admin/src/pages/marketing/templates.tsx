import React, { useState } from "react";
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
import { Plus, Pencil, Trash2, Mail, MessageSquare, Phone, Eye } from "lucide-react";

type Template = { id: string; name: string; channel: string; category: string; subject?: string; body: string; variables: string[]; description?: string };

const CATEGORIES = ["relance", "campagne", "rappel", "fidelisation", "onboarding", "support", "institutionnel", "transactionnel"];
const CHANNELS = [
  { k: "email", l: "Email", icon: <Mail className="w-3 h-3" /> },
  { k: "sms", l: "SMS", icon: <MessageSquare className="w-3 h-3" /> },
  { k: "whatsapp", l: "WhatsApp", icon: <Phone className="w-3 h-3" /> },
];

export default function TemplatesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Template | null>(null);
  const [previewItem, setPreview] = useState<Template | null>(null);
  const [filterChannel, setFilterChannel] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const empty = { name: "", channel: "email", category: "campagne", subject: "", body: "", variables: "", description: "" };
  const [form, setForm] = useState<any>(empty);

  const { data, isLoading } = useQuery<{ data: Template[] }>({
    queryKey: ["marketing-templates", filterChannel, filterCategory],
    queryFn: () => apiFetch(`/api/marketing/templates?channel=${filterChannel}&category=${filterCategory}`),
  });

  const upsert = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        variables: form.variables ? form.variables.split(",").map((v: string) => v.trim()).filter(Boolean) : [],
      };
      return edit
        ? apiFetch(`/api/marketing/templates/${edit.id}`, { method: "PUT", body: payload })
        : apiFetch("/api/marketing/templates", { method: "POST", body: payload });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-templates"] }); setOpen(false); setEdit(null); setForm(empty); toast({ title: edit ? "Modèle mis à jour" : "Modèle créé" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-templates"] }); toast({ title: "Supprimé" }); },
  });

  const openEdit = (t: Template) => {
    setEdit(t);
    setForm({ name: t.name, channel: t.channel, category: t.category, subject: t.subject || "", body: t.body, variables: (t.variables || []).join(", "), description: t.description || "" });
    setOpen(true);
  };

  return (
    <MarketingShell title="Templates & contenus" subtitle="Bibliothèque de modèles email, SMS et WhatsApp"
      actions={<Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nouveau modèle</Button>}>
      <div className="flex gap-2 mb-3">
        <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="border rounded h-9 px-3 text-sm">
          <option value="">Tous canaux</option>
          {CHANNELS.map((c) => <option key={c.k} value={c.k}>{c.l}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border rounded h-9 px-3 text-sm">
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? <div className="col-span-full text-center py-12 text-muted-foreground">Chargement…</div>
          : (data?.data ?? []).length === 0 ? <div className="col-span-full text-center py-12 text-muted-foreground">Aucun modèle.</div>
          : data!.data.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold leading-tight">{t.name}</div>
                  <Badge variant="outline" className="capitalize gap-1">{CHANNELS.find((c) => c.k === t.channel)?.icon} {t.channel}</Badge>
                </div>
                <Badge className="bg-primary/10 text-primary border-0 capitalize">{t.category}</Badge>
                {t.subject && <div className="text-xs text-muted-foreground line-clamp-1">Sujet : {t.subject}</div>}
                <div className="text-xs text-muted-foreground line-clamp-3">{t.body}</div>
                {(t.variables || []).length > 0 && <div className="flex flex-wrap gap-1">{t.variables.map((v) => <code key={v} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{`{{${v}}}`}</code>)}</div>}
                <div className="flex justify-end gap-1 pt-1 border-t">
                  <Button size="icon" variant="ghost" onClick={() => setPreview(t)}><Eye className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ?")) del.mutate(t.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="text-xs font-medium">Catégorie</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded h-10 px-3 text-sm capitalize">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium">Canal *</label>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                {CHANNELS.map((c) => <option key={c.k} value={c.k}>{c.l}</option>)}
              </select>
            </div>
            {form.channel === "email" && <div><label className="text-xs font-medium">Sujet</label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>}
            <div><label className="text-xs font-medium">Corps *</label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} placeholder="Vous pouvez utiliser des variables {{prenom}}, {{entreprise}}, {{montant}}…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Variables (virgules)</label><Input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} placeholder="prenom, entreprise, montant" /></div>
              <div><label className="text-xs font-medium">Description</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.name || !form.body}>{edit ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewItem} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{previewItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {previewItem?.subject && <div><span className="text-xs uppercase text-muted-foreground font-bold">Sujet</span><div>{previewItem.subject}</div></div>}
            <div><span className="text-xs uppercase text-muted-foreground font-bold">Corps</span><div className="border rounded p-3 whitespace-pre-wrap bg-muted/30">{previewItem?.body}</div></div>
          </div>
        </DialogContent>
      </Dialog>
    </MarketingShell>
  );
}
