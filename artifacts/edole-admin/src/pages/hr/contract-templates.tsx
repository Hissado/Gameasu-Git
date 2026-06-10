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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Pencil, Trash2, Star, Info } from "lucide-react";

type Template = { id: string; name: string; contractType: string; description?: string; templateBody: string; isDefault: boolean; isActive: boolean; version: number; createdAt: string };

const CONTRACT_TYPES = ["CDI", "CDD", "Stage", "Consultant", "Freelance", "Autre"];

const DEFAULT_TEMPLATE = `Entre les soussignés :

La société [Nom de l'entreprise], représentée par [Nom du responsable], ci-après dénommée "l'Employeur",

Et :

M./Mme {{nom_complet}}, né(e) le [Date de naissance], de nationalité [Nationalité], ci-après dénommé(e) "le/la Salarié(e)",

Il est convenu ce qui suit :

ARTICLE 1 — NATURE DU CONTRAT
Le/la Salarié(e) est engagé(e) en qualité de {{poste}} dans le cadre d'un contrat {{type_contrat}}.

ARTICLE 2 — DATE DE PRISE DE POSTE
Le présent contrat prend effet le {{date_debut}} pour une durée {{date_fin}}.

ARTICLE 3 — RÉMUNÉRATION
La rémunération mensuelle brute est fixée à {{salaire_mensuel}}, payable le dernier jour ouvrable de chaque mois.

ARTICLE 4 — LIEU DE TRAVAIL
Le lieu de travail est fixé au siège de l'entreprise.

ARTICLE 5 — DURÉE DU TRAVAIL
La durée de travail est de 40 heures par semaine, conformément à la législation togolaise.

Fait en deux exemplaires originaux, le {{date_signature}}.

`;

export default function ContractTemplates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", contractType: "CDI", description: "", templateBody: DEFAULT_TEMPLATE, isDefault: false });

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["contract-templates"],
    queryFn: () => apiFetch("/api/hr/contract-templates"),
  });

  const saveMut = useMutation({
    mutationFn: (d: typeof form) => selected
      ? apiFetch(`/api/hr/contract-templates/${selected.id}`, { method: "PUT", body: JSON.stringify(d) })
      : apiFetch("/api/hr/contract-templates", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract-templates"] }); setOpen(false); setSelected(null); toast({ title: selected ? "Template mis à jour" : "Template créé" }); },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/contract-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-templates"] }),
  });

  function openCreate() { setSelected(null); setForm({ name: "", contractType: "CDI", description: "", templateBody: DEFAULT_TEMPLATE, isDefault: false }); setOpen(true); }
  function openEdit(t: Template) { setSelected(t); setForm({ name: t.name, contractType: t.contractType, description: t.description ?? "", templateBody: t.templateBody, isDefault: t.isDefault }); setOpen(true); }

  const VARS = ["{{nom_complet}}", "{{nom}}", "{{prenom}}", "{{poste}}", "{{date_debut}}", "{{date_fin}}", "{{salaire_mensuel}}", "{{type_contrat}}", "{{date_signature}}"];

  return (
    <HrShell
      title="Templates de contrats"
      subtitle="Modèles réutilisables pour la génération automatique de PDF"
      actions={<Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nouveau template</Button>}
    >
      {isLoading ? <div className="text-sm text-muted-foreground">Chargement…</div> :
        (templates ?? []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="mb-3">Aucun template configuré.</p>
            <Button size="sm" onClick={openCreate}>Créer le premier template</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(templates ?? []).map(t => (
              <Card key={t.id} className={`relative ${!t.isActive ? "opacity-60" : ""}`}>
                {t.isDefault && <div className="absolute top-3 right-3"><Star className="w-4 h-4 text-amber-500 fill-amber-400" /></div>}
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <Badge variant="outline" className="text-xs mt-0.5">{t.contractType}</Badge>
                    </div>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{t.description}</p>}
                  <div className="text-xs text-muted-foreground mb-3">Version {t.version} · Créé le {new Date(t.createdAt).toLocaleDateString("fr-FR")}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(t)}><Pencil className="w-3 h-3 mr-1" />Éditer</Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm("Supprimer ce template ?")) deleteMut.mutate(t.id); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected ? "Modifier le template" : "Nouveau template de contrat"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom du template</Label><Input placeholder="Contrat CDI standard…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <Label>Type de contrat</Label>
                <Select value={form.contractType} onValueChange={v => setForm(f => ({ ...f, contractType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Input placeholder="Description optionnelle…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Corps du contrat</Label>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Info className="w-3 h-3" />Variables disponibles :</div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {VARS.map(v => <code key={v} className="text-xs bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/10" onClick={() => setForm(f => ({ ...f, templateBody: f.templateBody + v }))}>{v}</code>)}
              </div>
              <Textarea rows={14} value={form.templateBody} onChange={e => setForm(f => ({ ...f, templateBody: e.target.value }))} className="font-mono text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} />
              <Label htmlFor="isDefault" className="cursor-pointer">Template par défaut pour ce type de contrat</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={!form.name || !form.contractType || saveMut.isPending} onClick={() => saveMut.mutate(form)}>
              {selected ? "Enregistrer" : "Créer le template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
