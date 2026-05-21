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
import { Plus, Send, Eye, Mail, MessageSquare, Phone, Sparkles, Copy, Trash2, Calendar, Pencil } from "lucide-react";

type Campaign = { id: string; name: string; channel: string; subject?: string; body: string; segment: any; audienceId?: string; templateId?: string; status: string; scheduledAt?: string; sentAt?: string; recipientsCount: number; sentCount: number; failedCount: number; openCount: number; clickCount: number; createdAt: string };

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-amber-100 text-amber-700",
  running: "bg-blue-100 text-blue-700",
  sent: "bg-emerald-100 text-emerald-700",
  paused: "bg-orange-100 text-orange-700",
  cancelled: "bg-rose-100 text-rose-700",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", scheduled: "Planifiée", running: "En cours",
  sent: "Envoyée", paused: "Suspendue", cancelled: "Annulée",
};
const channelIcon = (c: string) => c === "email" ? <Mail className="w-3 h-3" /> : c === "sms" ? <MessageSquare className="w-3 h-3" /> : c === "whatsapp" ? <Phone className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />;

export default function CampaignsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Campaign | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const empty = { name: "", channel: "email", subject: "", body: "", audienceId: "", templateId: "", scheduledAt: "", audiences: [] as string[], statusFilter: "" };
  const [form, setForm] = useState<any>(empty);
  const [filterStatus, setFilterStatus] = useState("");

  const { data, isLoading } = useQuery<{ data: Campaign[] }>({
    queryKey: ["marketing-campaigns"],
    queryFn: () => apiFetch("/api/marketing/campaigns"),
  });
  const { data: audiences } = useQuery<{ data: { id: string; name: string; contactsCount: number }[] }>({
    queryKey: ["marketing-audiences"],
    queryFn: () => apiFetch("/api/marketing/audiences"),
  });
  const { data: templates } = useQuery<{ data: { id: string; name: string; channel: string; subject?: string; body: string }[] }>({
    queryKey: ["marketing-templates"],
    queryFn: () => apiFetch("/api/marketing/templates"),
  });

  const list = (data?.data ?? []).filter((c) => !filterStatus || c.status === filterStatus);

  const upsert = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: form.name, channel: form.channel, subject: form.subject, body: form.body,
        templateId: form.templateId || undefined,
        scheduledAt: form.scheduledAt || undefined,
      };
      if (form.audienceId) {
        payload.audienceId = form.audienceId;
      } else {
        payload.segment = { audiences: form.audiences, statusFilter: form.statusFilter || undefined };
      }
      return edit
        ? apiFetch(`/api/marketing/campaigns/${edit.id}`, { method: "PUT", body: payload })
        : apiFetch("/api/marketing/campaigns", { method: "POST", body: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      qc.invalidateQueries({ queryKey: ["marketing-overview"] });
      setOpen(false); setEdit(null); setForm(empty);
      toast({ title: edit ? "Campagne modifiée" : "Campagne créée" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const send = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/campaigns/${id}/send`, { method: "POST" }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); qc.invalidateQueries({ queryKey: ["marketing-overview"] }); toast({ title: "Campagne envoyée", description: `${r.sent} message(s) délivré(s) — ${r.failed} échec(s)` }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/campaigns/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); toast({ title: "Campagne dupliquée" }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); toast({ title: "Supprimée" }); },
  });

  const preview = useMutation({
    mutationFn: () => apiFetch("/api/marketing/campaigns/preview", {
      method: "POST",
      body: form.audienceId
        ? { audienceId: form.audienceId }
        : { segment: { audiences: form.audiences, statusFilter: form.statusFilter || undefined } },
    }),
    onSuccess: (r: any) => { setPreviewData(r); setPreviewOpen(true); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const toggleAudience = (a: string) => setForm({ ...form, audiences: form.audiences.includes(a) ? form.audiences.filter((x: string) => x !== a) : [...form.audiences, a] });

  const openNew = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Campaign) => {
    setEdit(c);
    setForm({
      name: c.name, channel: c.channel, subject: c.subject || "", body: c.body,
      audienceId: c.audienceId || "", templateId: c.templateId || "",
      scheduledAt: c.scheduledAt ? c.scheduledAt.slice(0, 16) : "",
      audiences: c.segment?.audiences || [], statusFilter: c.segment?.statusFilter || "",
    });
    setOpen(true);
  };
  const applyTemplate = (id: string) => {
    const t = templates?.data.find((x) => x.id === id);
    if (!t) return;
    setForm({ ...form, templateId: id, channel: t.channel, subject: t.subject || form.subject, body: t.body });
  };

  return (
    <MarketingShell title="Campagnes" subtitle="Email, SMS, WhatsApp · ponctuelles ou planifiées"
      actions={<Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nouvelle campagne</Button>}>
      <div className="flex gap-2 mb-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded h-9 px-3 text-sm">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nom</th>
                <th className="text-left p-3">Canal</th>
                <th className="text-left p-3">Audience</th>
                <th className="text-center p-3">Statut</th>
                <th className="text-left p-3">Planifiée</th>
                <th className="text-right p-3">Envoyés</th>
                <th className="text-right p-3">Ouvertures</th>
                <th className="p-3 w-44"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                : list.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucune campagne.</td></tr>
                : list.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3"><Badge variant="outline" className="capitalize gap-1">{channelIcon(c.channel)} {c.channel}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {c.audienceId
                        ? audiences?.data.find((a) => a.id === c.audienceId)?.name || "Audience"
                        : (c.segment?.audiences || []).join(", ") || "—"}
                    </td>
                    <td className="p-3 text-center"><Badge className={`${STATUS_BADGE[c.status] || "bg-muted"} border-0`}>{STATUS_LABEL[c.status] || c.status}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("fr-FR") : "—"}</td>
                    <td className="p-3 text-right font-mono text-xs">{c.sentCount}/{c.recipientsCount}{c.failedCount > 0 && <span className="text-destructive ml-1">(-{c.failedCount})</span>}</td>
                    <td className="p-3 text-right font-mono text-xs">{c.openCount}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {c.status !== "sent" && <Button size="icon" variant="ghost" title="Modifier" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>}
                        {c.status !== "sent" && <Button size="icon" variant="ghost" title="Envoyer" onClick={() => { if (confirm(`Envoyer "${c.name}" maintenant ?`)) send.mutate(c.id); }}><Send className="w-4 h-4 text-primary" /></Button>}
                        <Button size="icon" variant="ghost" title="Dupliquer" onClick={() => duplicate.mutate(c.id)}><Copy className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" title="Supprimer" onClick={() => { if (confirm("Supprimer ?")) del.mutate(c.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? "Modifier la campagne" : "Nouvelle campagne"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Newsletter de fin d'année" /></div>
              <div><label className="text-xs font-medium">Canal *</label>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="multi">Multicanal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Modèle (optionnel)</label>
                <select value={form.templateId} onChange={(e) => applyTemplate(e.target.value)} className="w-full border rounded h-10 px-3 text-sm">
                  <option value="">— Aucun —</option>
                  {(templates?.data || []).filter((t) => form.channel === "multi" || t.channel === form.channel).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div><label className="text-xs font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> Planification (optionnel)</label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
              </div>
            </div>

            {(form.channel === "email" || form.channel === "multi") && <div><label className="text-xs font-medium">Sujet</label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>}
            <div><label className="text-xs font-medium">Message *</label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} /></div>

            <div className="border-t pt-3">
              <label className="text-xs font-medium mb-2 block">Audience cible</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">Sélectionner une audience sauvegardée</div>
                  <select value={form.audienceId} onChange={(e) => setForm({ ...form, audienceId: e.target.value, audiences: [] })} className="w-full border rounded h-10 px-3 text-sm">
                    <option value="">— Construire en direct —</option>
                    {(audiences?.data || []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.contactsCount} contacts)</option>
                    ))}
                  </select>
                </div>
                {!form.audienceId && (
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Ou cibler en direct</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { k: "clients", l: "Clients" },
                        { k: "prospects", l: "Prospects" },
                        { k: "collaborators", l: "Collaborateurs" },
                        { k: "users", l: "Utilisateurs" },
                      ].map((a) => (
                        <button key={a.k} type="button" onClick={() => toggleAudience(a.k)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${form.audiences.includes(a.k) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                          {a.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending || (!form.audienceId && form.audiences.length === 0)}><Eye className="w-4 h-4 mr-2" /> Aperçu audience</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.name || !form.body || (!form.audienceId && form.audiences.length === 0)}>{edit ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aperçu de l'audience</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-primary">{previewData?.total ?? 0} <span className="text-base font-normal text-muted-foreground">destinataire(s)</span></div>
            <div className="text-sm font-medium">Répartition</div>
            <ul className="text-sm space-y-1">
              {Object.entries(previewData?.breakdown ?? {}).map(([k, v]) => <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{v as number}</span></li>)}
            </ul>
            {previewData?.sample?.length > 0 && (
              <div><div className="text-xs uppercase text-muted-foreground font-bold mt-3 mb-2">Exemples</div>
                <ul className="text-xs space-y-1">{previewData.sample.map((s: any, i: number) => <li key={i}>{s.name} — {s.email || s.phone || "—"}</li>)}</ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MarketingShell>
  );
}
