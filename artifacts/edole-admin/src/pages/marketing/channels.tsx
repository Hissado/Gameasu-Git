import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MarketingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mail, MessageSquare, Phone, Cable, CheckCircle2, AlertTriangle, Circle } from "lucide-react";

type Channel = {
  id: string; channel: string; provider: string; displayName?: string;
  config: any; isActive: boolean; status: string;
  lastCheckAt?: string; lastErrorAt?: string; lastError?: string; volume30d: number;
};

const PROVIDERS: Record<string, { label: string; fields: string[] }[]> = {
  email: [
    { label: "SendGrid", fields: ["apiKey", "fromEmail", "fromName"] },
    { label: "Resend", fields: ["apiKey", "fromEmail"] },
    { label: "SMTP", fields: ["host", "port", "user", "password", "fromEmail"] },
    { label: "Preview (in-app)", fields: [] },
  ],
  sms: [
    { label: "Twilio", fields: ["accountSid", "authToken", "fromNumber"] },
    { label: "Vonage", fields: ["apiKey", "apiSecret", "fromNumber"] },
    { label: "Preview (in-app)", fields: [] },
  ],
  whatsapp: [
    { label: "WhatsApp Business API", fields: ["phoneNumberId", "accessToken", "businessAccountId"] },
    { label: "Twilio WhatsApp", fields: ["accountSid", "authToken", "fromNumber"] },
    { label: "Preview (in-app)", fields: [] },
  ],
};

const STATUS_BADGE = (s: string) => {
  if (s === "ok") return <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1"><CheckCircle2 className="w-3 h-3" /> Opérationnel</Badge>;
  if (s === "error") return <Badge className="bg-rose-100 text-rose-700 border-0 gap-1"><AlertTriangle className="w-3 h-3" /> En erreur</Badge>;
  return <Badge className="bg-slate-100 text-slate-700 border-0 gap-1"><Circle className="w-3 h-3" /> Non configuré</Badge>;
};

const channelIcon = (c: string) => c === "email" ? <Mail className="w-5 h-5" /> : c === "sms" ? <MessageSquare className="w-5 h-5" /> : c === "whatsapp" ? <Phone className="w-5 h-5" /> : <Cable className="w-5 h-5" />;

export default function ChannelsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Channel | null>(null);
  const empty = { channel: "email", provider: "SendGrid", displayName: "", config: {} as Record<string, string>, isActive: false };
  const [form, setForm] = useState<any>(empty);

  const { data, isLoading } = useQuery<{ data: Channel[] }>({
    queryKey: ["marketing-channels"],
    queryFn: () => apiFetch("/api/marketing/channels"),
  });

  const upsert = useMutation({
    mutationFn: () => {
      const payload = { ...form, status: form.isActive ? "ok" : "not_configured" };
      return edit
        ? apiFetch(`/api/marketing/channels/${edit.id}`, { method: "PUT", body: payload })
        : apiFetch("/api/marketing/channels", { method: "POST", body: payload });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-channels"] }); setOpen(false); setEdit(null); setForm(empty); toast({ title: edit ? "Canal mis à jour" : "Canal ajouté" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const providers = PROVIDERS[form.channel] || [];
  const currentProvider = providers.find((p) => p.label === form.provider);

  const openEdit = (c: Channel) => {
    setEdit(c);
    setForm({ channel: c.channel, provider: c.provider, displayName: c.displayName || "", config: c.config || {}, isActive: c.isActive });
    setOpen(true);
  };

  return (
    <MarketingShell title="Canaux d'envoi" subtitle="Email, SMS, WhatsApp — fournisseurs et statut"
      actions={<Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Ajouter un canal</Button>}>
      {isLoading ? <div className="text-center py-12 text-muted-foreground">Chargement…</div>
        : (data?.data ?? []).length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Cable className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <div>Aucun canal configuré.</div>
            <div className="text-xs mt-1">Les envois fonctionnent par défaut en mode simulation (logs console).</div>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data!.data.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">{channelIcon(c.channel)}</div>
                      <div>
                        <div className="font-semibold capitalize">{c.channel}</div>
                        <div className="text-xs text-muted-foreground">{c.displayName || c.provider}</div>
                      </div>
                    </div>
                    {STATUS_BADGE(c.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Fournisseur</div><div className="font-medium">{c.provider}</div></div>
                    <div><div className="text-muted-foreground">Volume 30j</div><div className="font-medium">{c.volume30d}</div></div>
                  </div>
                  {c.lastError && <div className="text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded p-2">{c.lastError}</div>}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? "Actif" : "Inactif"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Configurer</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Modifier le canal" : "Nouveau canal"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Canal</label>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value, provider: PROVIDERS[e.target.value][0].label, config: {} })} className="w-full border rounded h-10 px-3 text-sm" disabled={!!edit}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div><label className="text-xs font-medium">Fournisseur</label>
                <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value, config: {} })} className="w-full border rounded h-10 px-3 text-sm" disabled={!!edit}>
                  {providers.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium">Nom d'affichage</label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Ex : Newsletter SendGrid" /></div>

            {currentProvider && currentProvider.fields.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <div className="text-xs font-medium">Identifiants {form.provider}</div>
                {currentProvider.fields.map((f) => (
                  <div key={f}>
                    <label className="text-[11px] text-muted-foreground capitalize">{f}</label>
                    <Input
                      type={f.toLowerCase().includes("password") || f.toLowerCase().includes("secret") || f.toLowerCase().includes("token") || f.toLowerCase().includes("key") ? "password" : "text"}
                      value={form.config[f] || ""}
                      onChange={(e) => setForm({ ...form, config: { ...form.config, [f]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            )}

            {currentProvider && currentProvider.fields.length === 0 && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-3">
                Mode <strong>Preview</strong> — les envois sont simulés et tracés dans la console serveur. Idéal pour la démo.
              </div>
            )}

            <label className="text-xs flex items-center gap-2 pt-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Activer ce canal</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>{edit ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MarketingShell>
  );
}
