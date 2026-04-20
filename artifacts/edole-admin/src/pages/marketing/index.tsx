import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Send, Eye, Mail, MessageCircle, Users, Megaphone, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type Campaign = { id: string; name: string; channel: string; subject?: string; body: string; segment: any; status: string; sentAt?: string; recipientsCount: number; sentCount: number; failedCount: number; createdAt: string };

export default function MarketingDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const empty = { name: "", channel: "email", subject: "", body: "", audiences: [] as string[], statusFilter: "" };
  const [form, setForm] = useState<any>(empty);

  const { data: dash } = useQuery<{ totalCampaigns: number; totalMessagesSent: number; totalProspects: number; prospectsByStatus: any[] }>({
    queryKey: ["marketing-dashboard"],
    queryFn: () => apiFetch("/api/marketing/dashboard"),
  });

  const { data: campaigns } = useQuery<{ data: Campaign[] }>({
    queryKey: ["marketing-campaigns"],
    queryFn: () => apiFetch("/api/marketing/campaigns"),
  });

  const create = useMutation({
    mutationFn: () => apiFetch("/api/marketing/campaigns", {
      method: "POST",
      body: {
        name: form.name, channel: form.channel, subject: form.subject, body: form.body,
        segment: { audiences: form.audiences, statusFilter: form.statusFilter || undefined },
      }
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); setOpen(false); setForm(empty); toast({ title: "Campagne créée" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const send = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/campaigns/${id}/send`, { method: "POST" }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); qc.invalidateQueries({ queryKey: ["marketing-dashboard"] }); toast({ title: "Campagne envoyée", description: `${r.sent} message(s) délivré(s) (mode simulation)` }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const preview = useMutation({
    mutationFn: () => apiFetch("/api/marketing/campaigns/preview", {
      method: "POST",
      body: { segment: { audiences: form.audiences, statusFilter: form.statusFilter || undefined } },
    }),
    onSuccess: (r: any) => { setPreviewData(r); setPreviewOpen(true); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const toggleAudience = (a: string) => setForm({ ...form, audiences: form.audiences.includes(a) ? form.audiences.filter((x: string) => x !== a) : [...form.audiences, a] });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Megaphone className="w-7 h-7 text-primary" /> Marketing</h1>
          <p className="text-muted-foreground mt-1">Campagnes email & SMS, segmentation multi-audiences (clients, prospects, collaborateurs).</p>
        </div>
        <div className="flex gap-2">
          <Link href="/marketing/prospects"><Button variant="outline"><Target className="w-4 h-4 mr-2" /> Prospects</Button></Link>
          <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nouvelle campagne</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground font-bold">Campagnes</div><div className="text-3xl font-bold mt-1">{dash?.totalCampaigns ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground font-bold">Messages envoyés</div><div className="text-3xl font-bold mt-1 text-primary">{dash?.totalMessagesSent ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground font-bold">Prospects</div><div className="text-3xl font-bold mt-1">{dash?.totalProspects ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground font-bold">Convertis</div><div className="text-3xl font-bold mt-1 text-emerald-600">{dash?.prospectsByStatus?.find((s) => s.status === "converted")?.count ?? 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="border-b"><CardTitle className="text-base">Campagnes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Nom</th><th className="text-left p-3">Canal</th><th className="text-left p-3">Audience</th><th className="text-center p-3">Statut</th><th className="text-right p-3">Envoyés</th><th className="p-3 w-32"></th></tr>
            </thead>
            <tbody>
              {(campaigns?.data ?? []).length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune campagne.</td></tr>
                : campaigns!.data.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3"><Badge variant="outline" className="capitalize">{c.channel === "email" ? <Mail className="w-3 h-3 mr-1 inline" /> : <MessageCircle className="w-3 h-3 mr-1 inline" />} {c.channel}</Badge></td>
                    <td className="p-3 text-xs">{(c.segment?.audiences || []).join(", ") || "—"}</td>
                    <td className="p-3 text-center">{c.status === "sent" ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Envoyée</Badge> : c.status === "draft" ? <Badge variant="outline">Brouillon</Badge> : <Badge>{c.status}</Badge>}</td>
                    <td className="p-3 text-right font-mono text-xs">{c.sentCount}/{c.recipientsCount}{c.failedCount > 0 && <span className="text-destructive ml-1">(-{c.failedCount})</span>}</td>
                    <td className="p-3 text-right">
                      {c.status !== "sent" && <Button size="sm" variant="outline" onClick={() => { if (confirm(`Envoyer la campagne "${c.name}" maintenant ?`)) send.mutate(c.id); }}><Send className="w-3 h-3 mr-1" /> Envoyer</Button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouvelle campagne</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Promo printemps 2026" /></div>
              <div><label className="text-xs font-medium">Canal</label>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  <option value="email">Email</option><option value="sms">SMS</option>
                </select>
              </div>
            </div>
            {form.channel === "email" && <div><label className="text-xs font-medium">Sujet</label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>}
            <div><label className="text-xs font-medium">Message *</label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} /></div>

            <div className="border-t pt-3">
              <label className="text-xs font-medium mb-2 block">Audiences cibles</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: "clients", l: "Clients" },
                  { k: "prospects", l: "Prospects" },
                  { k: "collaborators", l: "Collaborateurs" },
                  { k: "users", l: "Utilisateurs internes" },
                ].map((a) => (
                  <button key={a.k} type="button" onClick={() => toggleAudience(a.k)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${form.audiences.includes(a.k) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                    {a.l}
                  </button>
                ))}
              </div>
              {form.audiences.includes("prospects") && (
                <div className="mt-3"><label className="text-xs font-medium">Filtrer prospects par statut</label>
                  <select value={form.statusFilter} onChange={(e) => setForm({ ...form, statusFilter: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                    <option value="">Tous</option>
                    <option value="new">Nouveaux</option><option value="contacted">Contactés</option>
                    <option value="qualified">Qualifiés</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => preview.mutate()} disabled={form.audiences.length === 0 || preview.isPending}><Eye className="w-4 h-4 mr-2" /> Aperçu audience</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.body || form.audiences.length === 0}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aperçu de l'audience</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-primary">{previewData?.total ?? 0} <span className="text-base font-normal text-muted-foreground">destinataire(s)</span></div>
            <div className="text-sm">Répartition :</div>
            <ul className="text-sm space-y-1">{Object.entries(previewData?.breakdown ?? {}).map(([k, v]) => <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{v as number}</span></li>)}</ul>
            {previewData?.sample?.length > 0 && (
              <div><div className="text-xs uppercase text-muted-foreground font-bold mt-3 mb-2">Exemples</div>
                <ul className="text-xs space-y-1">{previewData.sample.map((s: any, i: number) => <li key={i}>{s.name} — {s.email || s.phone || "—"}</li>)}</ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
