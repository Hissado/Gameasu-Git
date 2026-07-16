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
import { Plus, Workflow, Play, Power, Pencil, Trash2, ArrowRight, Zap, Mail, MessageSquare, Phone, Clock, Tag, Users, UserCheck, RefreshCw, Bell } from "lucide-react";

type Automation = {
  id: string; name: string; description?: string; trigger: string;
  triggerConfig: any; audienceId?: string; steps: any[];
  isActive: boolean; runsCount: number; lastRunAt?: string;
};

const TRIGGERS = [
  { k: "new_prospect", l: "Nouveau prospect" },
  { k: "new_client", l: "Nouveau client" },
  { k: "invoice_issued", l: "Facture émise" },
  { k: "invoice_overdue", l: "Facture échue" },
  { k: "payment_received", l: "Paiement reçu" },
  { k: "quote_unconfirmed", l: "Devis non validé" },
  { k: "rental_due_soon", l: "Location proche de l'échéance" },
  { k: "rental_return_due", l: "Retour matériel à venir" },
  { k: "project_created", l: "Projet créé" },
  { k: "recurring_service_due", l: "Service récurrent à renouveler" },
  { k: "client_inactive", l: "Client inactif depuis X jours" },
  { k: "special_date", l: "Date spéciale / anniversaire" },
  { k: "document_missing", l: "Document manquant" },
];
const STEP_KINDS = [
  { k: "send_email", l: "Envoyer un email" },
  { k: "send_sms", l: "Envoyer un SMS" },
  { k: "send_whatsapp", l: "Envoyer un WhatsApp" },
  { k: "create_task", l: "Créer une tâche" },
  { k: "notify_user", l: "Notifier un utilisateur" },
  { k: "assign_commercial", l: "Assigner un commercial" },
  { k: "change_status", l: "Changer un statut" },
  { k: "add_tag", l: "Ajouter un tag" },
  { k: "add_to_audience", l: "Ajouter à une audience" },
  { k: "wait", l: "Attendre N heures" },
];

const STEP_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  send_email:       { bg: "bg-blue-100",    text: "text-blue-700",   icon: <Mail className="w-3 h-3" /> },
  send_sms:         { bg: "bg-green-100",   text: "text-green-700",  icon: <MessageSquare className="w-3 h-3" /> },
  send_whatsapp:    { bg: "bg-emerald-100", text: "text-emerald-700",icon: <Phone className="w-3 h-3" /> },
  create_task:      { bg: "bg-violet-100",  text: "text-violet-700", icon: <Workflow className="w-3 h-3" /> },
  notify_user:      { bg: "bg-amber-100",   text: "text-amber-700",  icon: <Bell className="w-3 h-3" /> },
  assign_commercial:{ bg: "bg-cyan-100",    text: "text-cyan-700",   icon: <UserCheck className="w-3 h-3" /> },
  change_status:    { bg: "bg-muted",   text: "text-foreground",  icon: <RefreshCw className="w-3 h-3" /> },
  add_tag:          { bg: "bg-pink-100",    text: "text-pink-700",   icon: <Tag className="w-3 h-3" /> },
  add_to_audience:  { bg: "bg-indigo-100",  text: "text-indigo-700", icon: <Users className="w-3 h-3" /> },
  wait:             { bg: "bg-orange-100",  text: "text-orange-700", icon: <Clock className="w-3 h-3" /> },
};

function FlowDiagram({ trigger, steps }: { trigger: string; steps: any[] }) {
  const triggerLabel = TRIGGERS.find((t) => t.k === trigger)?.l || trigger;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-thin scrollbar-thumb-muted">
      {/* Trigger node */}
      <div className="flex-shrink-0 flex items-center gap-1.5 bg-violet-100 text-violet-800 rounded-lg px-3 py-1.5 text-xs font-semibold border border-violet-200">
        <Zap className="w-3 h-3 flex-shrink-0" />
        <span className="whitespace-nowrap">{triggerLabel}</span>
      </div>

      {steps.length === 0 ? (
        <>
          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <div className="flex-shrink-0 border border-dashed rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
            Aucune étape
          </div>
        </>
      ) : (
        steps.map((s: any, i: number) => {
          const style = STEP_STYLE[s.kind] || { bg: "bg-muted", text: "text-muted-foreground", icon: <Workflow className="w-3 h-3" /> };
          const label = STEP_KINDS.find((x) => x.k === s.kind)?.l || s.kind;
          const detail = s.kind === "wait" && s.delayHours ? ` (${s.delayHours}h)` : s.kind === "add_tag" && s.tag ? ` "${s.tag}"` : "";
          return (
            <React.Fragment key={i}>
              <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <div className={`flex-shrink-0 flex items-center gap-1.5 ${style.bg} ${style.text} rounded-lg px-3 py-1.5 text-xs font-medium border border-current/20`}>
                <span className="w-4 h-4 rounded-full bg-card/60 text-[9px] flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                <span className="flex items-center gap-1">{style.icon}<span className="whitespace-nowrap">{label}{detail}</span></span>
              </div>
            </React.Fragment>
          );
        })
      )}
    </div>
  );
}

export default function AutomationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Automation | null>(null);
  const empty = { name: "", description: "", trigger: "new_prospect", inactiveSinceDays: "", steps: [] as any[] };
  const [form, setForm] = useState<any>(empty);

  const { data, isLoading } = useQuery<{ data: Automation[] }>({
    queryKey: ["marketing-automations"],
    queryFn: () => apiFetch("/api/marketing/automations"),
  });

  const upsert = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, description: form.description, trigger: form.trigger,
        triggerConfig: form.trigger === "client_inactive" ? { days: Number(form.inactiveSinceDays) || 90 } : {},
        steps: form.steps,
        isActive: edit?.isActive ?? false,
      };
      return edit
        ? apiFetch(`/api/marketing/automations/${edit.id}`, { method: "PUT", body: payload })
        : apiFetch("/api/marketing/automations", { method: "POST", body: payload });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-automations"] }); setOpen(false); setEdit(null); setForm(empty); toast({ title: edit ? "Workflow modifié" : "Workflow créé" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });
  const toggle = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/automations/${id}/toggle`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-automations"] }),
  });
  const run = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/automations/${id}/run`, { method: "POST" }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["marketing-automations"] }); toast({ title: "Exécution lancée", description: `${r.stepsExecuted} étape(s) (simulation)` }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/automations/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-automations"] }); toast({ title: "Supprimé" }); },
  });

  const openEdit = (a: Automation) => {
    setEdit(a);
    setForm({
      name: a.name, description: a.description || "", trigger: a.trigger,
      inactiveSinceDays: a.triggerConfig?.days || "",
      steps: a.steps || [],
    });
    setOpen(true);
  };

  const addStep = () => setForm({ ...form, steps: [...form.steps, { kind: "send_email", body: "" }] });
  const updateStep = (i: number, patch: any) => setForm({ ...form, steps: form.steps.map((s: any, idx: number) => idx === i ? { ...s, ...patch } : s) });
  const removeStep = (i: number) => setForm({ ...form, steps: form.steps.filter((_: any, idx: number) => idx !== i) });

  return (
    <MarketingShell title="Automatisations" subtitle="Workflows marketing déclenchés par les événements métier"
      actions={<Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Nouveau workflow</Button>}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? <div className="col-span-full text-center py-12 text-muted-foreground">Chargement…</div>
          : (data?.data ?? []).length === 0 ? <div className="col-span-full text-center py-12 text-muted-foreground">Aucun workflow.</div>
          : data!.data.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-primary" /> {a.name}
                    </div>
                    {a.description && <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>}
                  </div>
                  <Badge className={a.isActive ? "bg-emerald-100 text-emerald-700 border-0" : "bg-muted text-foreground border-0"}>
                    {a.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </div>

                {/* Diagramme de flux visuel */}
                <FlowDiagram trigger={a.trigger} steps={a.steps || []} />

                <div className="text-xs text-muted-foreground flex justify-between border-t pt-2">
                  <span>Exécutions : <span className="font-semibold text-foreground">{a.runsCount}</span></span>
                  <span>{a.lastRunAt ? `Dernière : ${new Date(a.lastRunAt).toLocaleString("fr-FR")}` : "Jamais exécuté"}</span>
                </div>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => run.mutate(a.id)}><Play className="w-3 h-3 mr-1" /> Tester</Button>
                  <Button size="icon" variant="ghost" title={a.isActive ? "Désactiver" : "Activer"} onClick={() => toggle.mutate(a.id)}><Power className={`w-4 h-4 ${a.isActive ? "text-emerald-600" : ""}`} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ?")) del.mutate(a.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? "Modifier le workflow" : "Nouveau workflow"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Relance facture J+7" /></div>
              <div><label className="text-xs font-medium">Déclencheur *</label>
                <select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="w-full border rounded h-10 px-3 text-sm">
                  {TRIGGERS.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>

            {form.trigger === "client_inactive" && (
              <div><label className="text-xs font-medium">Inactivité depuis (jours)</label>
                <Input type="number" value={form.inactiveSinceDays} onChange={(e) => setForm({ ...form, inactiveSinceDays: e.target.value })} placeholder="90" />
              </div>
            )}

            {/* Aperçu du flux en cours de création */}
            {form.name && (
              <div className="bg-muted/30 rounded-lg p-3 border">
                <div className="text-[11px] uppercase font-bold text-muted-foreground mb-2">Aperçu du flux</div>
                <FlowDiagram trigger={form.trigger} steps={form.steps} />
              </div>
            )}

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium">Étapes</label>
                <Button size="sm" variant="outline" onClick={addStep}><Plus className="w-3 h-3 mr-1" /> Ajouter une étape</Button>
              </div>
              {form.steps.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded">Aucune étape pour le moment.</div>
              ) : (
                <div className="space-y-2">
                  {form.steps.map((s: any, i: number) => {
                    const style = STEP_STYLE[s.kind] || { bg: "bg-muted", text: "text-muted-foreground", icon: null };
                    return (
                      <div key={i} className={`border rounded-lg p-3 space-y-2 ${style.bg}/40`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full ${style.bg} ${style.text} text-xs flex items-center justify-center font-bold border`}>{i + 1}</span>
                          <select value={s.kind} onChange={(e) => updateStep(i, { kind: e.target.value })} className="flex-1 border rounded h-9 px-2 text-xs bg-background">
                            {STEP_KINDS.map((k) => <option key={k.k} value={k.k}>{k.l}</option>)}
                          </select>
                          <Button size="icon" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </div>
                        {["send_email", "send_sms", "send_whatsapp"].includes(s.kind) && (
                          <>
                            {s.kind === "send_email" && <Input placeholder="Sujet" value={s.subject || ""} onChange={(e) => updateStep(i, { subject: e.target.value })} className="text-xs h-8" />}
                            <Textarea placeholder="Contenu du message" value={s.body || ""} onChange={(e) => updateStep(i, { body: e.target.value })} rows={2} className="text-xs" />
                          </>
                        )}
                        {s.kind === "wait" && <Input type="number" placeholder="Heures" value={s.delayHours || ""} onChange={(e) => updateStep(i, { delayHours: Number(e.target.value) })} className="text-xs h-8" />}
                        {s.kind === "add_tag" && <Input placeholder="Tag" value={s.tag || ""} onChange={(e) => updateStep(i, { tag: e.target.value })} className="text-xs h-8" />}
                        {s.kind === "change_status" && <Input placeholder="Nouveau statut" value={s.status || ""} onChange={(e) => updateStep(i, { status: e.target.value })} className="text-xs h-8" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
