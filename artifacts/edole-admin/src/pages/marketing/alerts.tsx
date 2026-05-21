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
import { Plus, Pencil, Trash2, Play, BellRing, Mail, MessageSquare, Phone } from "lucide-react";

type Rule = { id: string; name: string; description?: string; source: string; config: any; channels: string[]; templateId?: string; isActive: boolean; lastRunAt?: string; sentCount: number };
type Log = { id: string; ruleId: string; entityType?: string; entityId?: string; channel: string; status: string; recipient?: string; error?: string; sentAt: string };

const SOURCES = [
  { k: "invoice_due", l: "Échéance de facture" },
  { k: "invoice_overdue", l: "Facture en retard" },
  { k: "rental_due", l: "Échéance de location" },
  { k: "rental_return", l: "Retour de matériel" },
  { k: "service_renewal", l: "Renouvellement de service" },
  { k: "appointment_reminder", l: "Rappel de rendez-vous" },
  { k: "document_missing", l: "Document manquant" },
  { k: "admin_reminder", l: "Rappel administratif" },
  { k: "generic_date", l: "Date spécifique" },
];
const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-3 h-3" />,
  sms: <MessageSquare className="w-3 h-3" />,
  whatsapp: <Phone className="w-3 h-3" />,
};

export default function AlertsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Rule | null>(null);
  const empty = { name: "", description: "", source: "invoice_due", leadTimeDays: "7", channels: ["email"] as string[], isActive: true };
  const [form, setForm] = useState<any>(empty);

  const { data, isLoading } = useQuery<{ data: Rule[] }>({
    queryKey: ["marketing-alert-rules"],
    queryFn: () => apiFetch("/api/marketing/alerts/rules"),
  });
  const { data: logs } = useQuery<{ data: Log[] }>({
    queryKey: ["marketing-alert-logs"],
    queryFn: () => apiFetch("/api/marketing/alerts/logs"),
  });

  const upsert = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, description: form.description, source: form.source,
        config: { leadTimeDays: Number(form.leadTimeDays) || 0 },
        channels: form.channels,
        isActive: form.isActive,
      };
      return edit
        ? apiFetch(`/api/marketing/alerts/rules/${edit.id}`, { method: "PUT", body: payload })
        : apiFetch("/api/marketing/alerts/rules", { method: "POST", body: payload });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-alert-rules"] }); setOpen(false); setEdit(null); setForm(empty); toast({ title: edit ? "Règle modifiée" : "Règle créée" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });
  const run = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/alerts/rules/${id}/run`, { method: "POST" }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["marketing-alert-rules"] }); qc.invalidateQueries({ queryKey: ["marketing-alert-logs"] }); toast({ title: "Balayage effectué", description: `${r.sent} alerte(s) envoyée(s)` }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/alerts/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-alert-rules"] }); toast({ title: "Supprimée" }); },
  });

  const openEdit = (r: Rule) => {
    setEdit(r);
    setForm({
      name: r.name, description: r.description || "", source: r.source,
      leadTimeDays: r.config?.leadTimeDays || "7",
      channels: r.channels || ["email"], isActive: r.isActive,
    });
    setOpen(true);
  };
  const toggleChannel = (c: string) => setForm({ ...form, channels: form.channels.includes(c) ? form.channels.filter((x: string) => x !== c) : [...form.channels, c] });

  return (
    <MarketingShell title="Alertes automatiques" subtitle="Rappels métier : factures, locations, renouvellements, documents"
      actions={<Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nouvelle règle</Button>}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? <div className="text-center py-12 text-muted-foreground">Chargement…</div>
            : (data?.data ?? []).length === 0 ? <div className="text-center py-12 text-muted-foreground">Aucune règle d'alerte configurée.</div>
            : data!.data.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2"><BellRing className="w-4 h-4 text-primary" /> {r.name}</div>
                      {r.description && <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>}
                    </div>
                    <Badge className={r.isActive ? "bg-emerald-100 text-emerald-700 border-0" : "bg-slate-100 text-slate-700 border-0"}>{r.isActive ? "Actif" : "Inactif"}</Badge>
                  </div>
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{SOURCES.find((s) => s.k === r.source)?.l || r.source}</Badge>
                    <Badge variant="secondary">Préavis : {r.config?.leadTimeDays ?? "—"} j</Badge>
                    {(r.channels || []).map((c) => <Badge key={c} variant="outline" className="capitalize gap-1">{CHANNEL_ICONS[c]} {c}</Badge>)}
                  </div>
                  <div className="text-xs text-muted-foreground flex justify-between border-t pt-2">
                    <span>{r.sentCount} alerte(s) envoyée(s)</span>
                    <span>{r.lastRunAt ? `Dernier balayage : ${new Date(r.lastRunAt).toLocaleString("fr-FR")}` : "Jamais exécuté"}</span>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => run.mutate(r.id)}><Play className="w-3 h-3 mr-1" /> Balayer</Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ?")) del.mutate(r.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        <Card className="h-fit">
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground font-bold mb-2">Journal récent</div>
            {(logs?.data ?? []).length === 0 ? <div className="text-xs text-muted-foreground py-4 text-center">Aucun envoi.</div>
              : <ul className="space-y-2 max-h-96 overflow-y-auto text-xs">
                  {logs!.data.slice(0, 30).map((l) => (
                    <li key={l.id} className="border-b pb-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="capitalize gap-1 text-[10px]">{CHANNEL_ICONS[l.channel]} {l.channel}</Badge>
                        <Badge className={`text-[10px] border-0 ${l.status === "sent" ? "bg-emerald-100 text-emerald-700" : l.status === "skipped" ? "bg-slate-100 text-slate-700" : "bg-rose-100 text-rose-700"}`}>{l.status}</Badge>
                      </div>
                      <div className="text-muted-foreground mt-1">{l.entityType || "—"} · {new Date(l.sentAt).toLocaleString("fr-FR")}</div>
                      {l.error && <div className="text-rose-600 italic mt-0.5">{l.error}</div>}
                    </li>
                  ))}
                </ul>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Modifier la règle" : "Nouvelle règle d'alerte"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Relance facture J-3" /></div>
            <div><label className="text-xs font-medium">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Source *</label>
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  {SOURCES.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium">Préavis (jours)</label>
                <Input type="number" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-2 block">Canaux d'envoi</label>
              <div className="flex flex-wrap gap-2">
                {["email", "sms", "whatsapp"].map((c) => (
                  <button key={c} type="button" onClick={() => toggleChannel(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${form.channels.includes(c) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-xs flex items-center gap-2 pt-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active immédiatement</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.name}>{edit ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MarketingShell>
  );
}
