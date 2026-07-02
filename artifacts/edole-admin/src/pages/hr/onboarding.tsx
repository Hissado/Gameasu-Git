import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserPlus, CheckCircle2, Circle, SkipForward, ClipboardList } from "lucide-react";

type Template = { id: string; name: string; description?: string; targetRole?: string; itemCount: number; isDefault: boolean };
type Process = { id: string; collaboratorId: string; firstName?: string; lastName?: string; poste?: string; avatarUrl?: string; status: string; startDate: string; targetCompletionDate?: string; progress: number; totalItems: number; doneItems: number };
type ProcessDetail = Process & { items: ProcessItem[] };
type ProcessItem = { id: string; title: string; description?: string; assignedTo: string; category: string; dueDate?: string; isRequired: boolean; status: string; sortOrder: number };
type Collab = { id: string; firstName: string; lastName: string };

const STATUS_COLOR: Record<string, string> = { in_progress: "bg-blue-100 text-blue-700", completed: "bg-emerald-100 text-emerald-700", cancelled: "bg-gray-100 text-gray-700" };
const STATUS_LABEL: Record<string, string> = { in_progress: "En cours", completed: "Terminé", cancelled: "Annulé" };
const CAT_COLOR: Record<string, string> = { documents: "bg-blue-50 text-blue-700", équipement: "bg-orange-50 text-orange-700", accès: "bg-purple-50 text-purple-700", formation: "bg-amber-50 text-amber-700", rencontre: "bg-emerald-50 text-emerald-700", autre: "bg-gray-50 text-gray-600" };

export default function Onboarding() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [processOpen, setProcessOpen] = useState(false);
  const [detailProcess, setDetailProcess] = useState<ProcessDetail | null>(null);
  const [processForm, setProcessForm] = useState({ collaboratorId: "", templateId: "", startDate: new Date().toISOString().split("T")[0], targetCompletionDate: "" });

  const { data: processes } = useQuery<Process[]>({ queryKey: ["onboarding-processes"], queryFn: () => apiFetch("/api/hr/onboarding/processes") });
  const { data: templates } = useQuery<Template[]>({ queryKey: ["onboarding-templates"], queryFn: () => apiFetch("/api/hr/onboarding/templates") });
  const { data: collabs } = useQuery<Collab[]>({ queryKey: ["collabs-list"], queryFn: () => apiFetch("/api/hr/collaborators") });

  const createProcessMut = useMutation({
    mutationFn: (d: typeof processForm) => apiFetch("/api/hr/onboarding/processes", { method: "POST", body: JSON.stringify({ ...d, templateId: d.templateId || undefined }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["onboarding-processes"] }); setProcessOpen(false); toast({ title: "Processus créé" }); },
  });

  const completeItemMut = useMutation({
    mutationFn: ({ processId, itemId }: { processId: string; itemId: string }) => apiFetch(`/api/hr/onboarding/processes/${processId}/items/${itemId}/complete`, { method: "POST" }),
    onSuccess: (_, { processId }) => { qc.invalidateQueries({ queryKey: ["onboarding-processes"] }); fetchProcessDetail(processId); },
  });

  const skipItemMut = useMutation({
    mutationFn: ({ processId, itemId }: { processId: string; itemId: string }) => apiFetch(`/api/hr/onboarding/processes/${processId}/items/${itemId}/skip`, { method: "POST" }),
    onSuccess: (_, { processId }) => fetchProcessDetail(processId),
  });

  async function fetchProcessDetail(id: string) {
    const data = await apiFetch(`/api/hr/onboarding/processes/${id}`);
    setDetailProcess(data as ProcessDetail);
  }

  const inProgress = (processes ?? []).filter(p => p.status === "in_progress");
  const completed = (processes ?? []).filter(p => p.status === "completed");

  return (
    <HrShell
      title="Intégration digitale"
      subtitle="Checklists d'intégration et suivi de l'avancement par collaborateur"
      actions={<Button size="sm" onClick={() => setProcessOpen(true)}><Plus className="w-4 h-4 mr-1" />Démarrer une intégration</Button>}
    >
      <Tabs defaultValue="processes">
        <TabsList className="mb-6">
          <TabsTrigger value="processes">Processus en cours ({inProgress.length})</TabsTrigger>
          <TabsTrigger value="completed">Terminés ({completed.length})</TabsTrigger>
          <TabsTrigger value="templates">Modèles ({(templates ?? []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="processes">
          {inProgress.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Aucune intégration en cours.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inProgress.map(p => (
                <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => fetchProcessDetail(p.id)}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-10 h-10 border border-border">
                        {p.avatarUrl && <AvatarImage src={p.avatarUrl} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{((p.firstName?.[0] ?? "") + (p.lastName?.[0] ?? "")).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-sm">{p.firstName} {p.lastName}</div>
                        <div className="text-xs text-muted-foreground">{p.poste ?? "—"}</div>
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{p.doneItems}/{p.totalItems} étapes</span>
                        <span>{p.progress}%</span>
                      </div>
                      <Progress value={p.progress} className="h-2" />
                    </div>
                    <div className="text-xs text-muted-foreground">Début : {new Date(p.startDate).toLocaleDateString("fr-FR")}</div>
                    {p.targetCompletionDate && <div className="text-xs text-muted-foreground">Objectif : {new Date(p.targetCompletionDate).toLocaleDateString("fr-FR")}</div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completed.length === 0 ? <div className="text-sm text-muted-foreground py-6">Aucune intégration terminée.</div> : (
            <div className="space-y-2">
              {completed.map(p => (
                <div key={p.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer" onClick={() => fetchProcessDetail(p.id)}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="flex-1"><div className="font-medium text-sm">{p.firstName} {p.lastName}</div><div className="text-xs text-muted-foreground">{p.poste}</div></div>
                  <div className="text-xs text-muted-foreground">Complété le {p.startDate ? new Date(p.startDate).toLocaleDateString("fr-FR") : "—"}</div>
                  <Badge variant="secondary">100%</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          {(templates ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Aucun modèle de checklist créé.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(templates ?? []).map(t => (
                <Card key={t.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-sm">{t.name}</div>
                      {t.isDefault && <Badge variant="secondary" className="text-xs">Défaut</Badge>}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mb-2">{t.description}</p>}
                    {t.targetRole && <div className="text-xs text-muted-foreground mb-2">Rôle cible : {t.targetRole}</div>}
                    <div className="text-sm font-medium">{t.itemCount} étape{t.itemCount > 1 ? "s" : ""}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog nouveau processus */}
      <Dialog open={processOpen} onOpenChange={setProcessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Démarrer une intégration</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Collaborateur</Label>
              <Select value={processForm.collaboratorId} onValueChange={v => setProcessForm(f => ({ ...f, collaboratorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>{(collabs ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modèle de checklist (optionnel)</Label>
              <Select value={processForm.templateId} onValueChange={v => setProcessForm(f => ({ ...f, templateId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sans modèle" /></SelectTrigger>
                <SelectContent>{(templates ?? []).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date de début</Label><Input type="date" value={processForm.startDate} onChange={e => setProcessForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div><Label>Objectif de fin</Label><Input type="date" value={processForm.targetCompletionDate} onChange={e => setProcessForm(f => ({ ...f, targetCompletionDate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessOpen(false)}>Annuler</Button>
            <Button disabled={!processForm.collaboratorId || createProcessMut.isPending} onClick={() => createProcessMut.mutate(processForm)}>Démarrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog détail processus */}
      {detailProcess && (
        <Dialog open={!!detailProcess} onOpenChange={() => setDetailProcess(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Intégration — {detailProcess.firstName} {detailProcess.lastName}</DialogTitle>
            </DialogHeader>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1"><span>{detailProcess.doneItems}/{detailProcess.totalItems} étapes</span><span>{detailProcess.progress}%</span></div>
              <Progress value={detailProcess.progress} className="h-2" />
            </div>
            <div className="space-y-2">
              {detailProcess.items.map(item => (
                <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border ${item.status === "completed" ? "bg-emerald-50 border-emerald-200" : item.status === "skipped" ? "opacity-50" : ""}`}>
                  <button className="mt-0.5 shrink-0" onClick={() => item.status === "pending" && completeItemMut.mutate({ processId: detailProcess.id, itemId: item.id })}>
                    {item.status === "completed" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.title}</div>
                    {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_COLOR[item.category] ?? "bg-gray-50 text-gray-600"}`}>{item.category}</span>
                      <span className="text-xs text-muted-foreground">→ {item.assignedTo}</span>
                      {item.dueDate && <span className="text-xs text-muted-foreground">· {new Date(item.dueDate).toLocaleDateString("fr-FR")}</span>}
                      {!item.isRequired && <Badge variant="secondary" className="text-xs">Optionnel</Badge>}
                    </div>
                  </div>
                  {item.status === "pending" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="Ignorer" onClick={() => skipItemMut.mutate({ processId: detailProcess.id, itemId: item.id })}>
                      <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </HrShell>
  );
}
