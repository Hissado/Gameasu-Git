import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Workflow, Plus, Play, Trash2, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import {
  useAutomationRules,
  useAutomationCatalog,
  useAutomationLogs,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  useRunAutomationRule,
  type AutomationRule,
} from "@/lib/intelligence";

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Workflow className="w-7 h-7 text-primary" /> Automatisations
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Règles transversales déclenchées par les événements métier : facturation, relances, renouvellements, alertes, notifications, tâches…
          </p>
        </div>
      </header>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Règles</TabsTrigger>
          <TabsTrigger value="logs">Journal d'exécution</TabsTrigger>
        </TabsList>
        <TabsContent value="rules"><RulesTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function RulesTab() {
  const { data: rules, isLoading } = useAutomationRules();
  const update = useUpdateAutomationRule();
  const remove = useDeleteAutomationRule();
  const run = useRunAutomationRule();
  const [open, setOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouvelle règle</Button>
      </div>

      {!rules?.length ? (
        <Card><CardContent className="py-12 text-center">
          <Workflow className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium">Aucune règle d'automatisation</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre première règle pour automatiser un événement métier.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{r.name}</h3>
                      <Badge variant="outline" className="text-xs"><Zap className="w-3 h-3 mr-1" />{r.triggerType}</Badge>
                      <Badge variant="outline" className="text-xs">{r.actions.length} action(s)</Badge>
                      {r.isActive ? <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}
                    </div>
                    {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      Dernière exécution : {fmt(r.lastRunAt)} · {r.runCount} exécution(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.isActive} onCheckedChange={(v) => update.mutate({ id: r.id, patch: { isActive: v } })} />
                    <Button size="sm" variant="outline" onClick={() => run.mutate({ id: r.id })}><Play className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Supprimer cette règle ?")) remove.mutate(r.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RuleDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function RuleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: catalog } = useAutomationCatalog();
  const create = useCreateAutomationRule();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [triggerType, setTriggerType] = useState("invoice.overdue");
  const [actions, setActions] = useState<{ kind: string; params: Record<string, unknown> }[]>([
    { kind: "create_insight", params: { title: "Facture échue impayée", body: "Une facture est arrivée à échéance sans paiement.", severity: "warning" } },
  ]);

  function submit() {
    if (!name.trim() || !actions.length) return;
    create.mutate(
      { name, description: desc, triggerType, actions, isActive: true } as Parameters<typeof create.mutate>[0],
      {
        onSuccess: () => {
          setName(""); setDesc(""); setActions([{ kind: "create_insight", params: {} }]);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nouvelle règle d'automatisation</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Relance facture impayée à J+3" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div>
            <Label>Déclencheur</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {catalog?.triggers.map((t) => (
                  <SelectItem key={t.type} value={t.type}>{t.label} <span className="text-xs text-muted-foreground ml-2">{t.category}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Actions</Label>
            <div className="space-y-2 mt-2">
              {actions.map((a, i) => (
                <Card key={i}><CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Select value={a.kind} onValueChange={(k) => {
                      const next = [...actions]; next[i] = { ...next[i]!, kind: k }; setActions(next);
                    }}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {catalog?.actions.map((ac) => <SelectItem key={ac.kind} value={ac.kind}>{ac.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => setActions(actions.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <Input placeholder="Titre (utilisé pour insight/recommandation/tâche/e-mail)" value={(a.params["title"] as string) || ""} onChange={(e) => {
                    const next = [...actions]; next[i] = { ...next[i]!, params: { ...next[i]!.params, title: e.target.value } }; setActions(next);
                  }} />
                  <textarea className="w-full min-h-[60px] p-2 text-sm rounded-md border border-input bg-background" placeholder="Corps / message (variables : {{clientName}}, {{amount}}, etc.)" value={(a.params["body"] as string) || (a.params["message"] as string) || ""} onChange={(e) => {
                    const next = [...actions]; next[i] = { ...next[i]!, params: { ...next[i]!.params, body: e.target.value, message: e.target.value } }; setActions(next);
                  }} />
                </CardContent></Card>
              ))}
              <Button size="sm" variant="outline" onClick={() => setActions([...actions, { kind: "create_insight", params: {} }])}><Plus className="w-4 h-4 mr-1" /> Ajouter une action</Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>Créer la règle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogsTab() {
  const { data, isLoading } = useAutomationLogs();
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data?.length) return <Card><CardContent className="py-12 text-center text-muted-foreground"><Clock className="w-10 h-10 opacity-40 mx-auto mb-3" />Aucune exécution pour le moment.</CardContent></Card>;
  return (
    <div className="grid gap-2">
      {data.map((l) => (
        <Card key={l.id}>
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            {l.status === "ok" ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : l.status === "partial" ? <Clock className="w-4 h-4 text-amber-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{l.ruleName || "Règle supprimée"}</p>
              <p className="text-xs text-muted-foreground">{l.triggerType} · {l.triggeredBy} · {(l.actionsExecuted || []).length} action(s) · {l.durationMs}ms</p>
            </div>
            <span className="text-xs text-muted-foreground">{fmt(l.executedAt)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
