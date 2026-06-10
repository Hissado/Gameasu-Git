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
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { Plus, Save, Info, Percent, Trash2 } from "lucide-react";

type Bracket = { id?: string; fromAmount: number; toAmount: number | null; rate: number; sortOrder?: number };
type Exemption = { id: string; collaboratorId?: string; exemptionType: string; fixedAmount?: number; percentage?: number; reason?: string; startDate?: string; endDate?: string; isActive: boolean; firstName?: string; lastName?: string };
type Collab = { id: string; firstName: string; lastName: string };

const EXEMPTION_TYPE_LABELS: Record<string, string> = { irpp: "IRPP", cnss: "CNSS", ipts: "IPTS", all: "Toutes taxes" };

export default function TaxSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [exemptOpen, setExemptOpen] = useState(false);
  const [exemptForm, setExemptForm] = useState({ collaboratorId: "", exemptionType: "irpp", fixedAmount: "", percentage: "", reason: "", startDate: "", endDate: "" });
  const [editBrackets, setEditBrackets] = useState<Bracket[] | null>(null);

  const { data: bracketsData } = useQuery<{ brackets: Bracket[]; isDefault: boolean }>({
    queryKey: ["irpp-brackets"],
    queryFn: () => apiFetch("/api/payroll/irpp-brackets"),
    select: d => ({ ...d, brackets: d.brackets.map((b, i) => ({ ...b, sortOrder: i })) }),
  });
  const brackets = editBrackets ?? (bracketsData?.brackets ?? []);

  const { data: exemptions } = useQuery<Exemption[]>({
    queryKey: ["tax-exemptions"],
    queryFn: () => apiFetch("/api/payroll/tax-exemptions"),
  });
  const { data: collabs } = useQuery<Collab[]>({
    queryKey: ["collabs-list"],
    queryFn: () => apiFetch("/api/hr/collaborators"),
  });

  const saveBracketsMut = useMutation({
    mutationFn: () => apiFetch("/api/payroll/irpp-brackets", { method: "POST", body: JSON.stringify({ brackets }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["irpp-brackets"] }); setEditBrackets(null); toast({ title: "Barème IRPP enregistré" }); },
  });

  const addExemptMut = useMutation({
    mutationFn: (d: typeof exemptForm) => apiFetch("/api/payroll/tax-exemptions", {
      method: "POST",
      body: JSON.stringify({ ...d, fixedAmount: d.fixedAmount ? Number(d.fixedAmount) : undefined, percentage: d.percentage ? Number(d.percentage) : undefined, collaboratorId: d.collaboratorId || undefined }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-exemptions"] }); setExemptOpen(false); toast({ title: "Exonération ajoutée" }); },
  });

  const deleteExemptMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/payroll/tax-exemptions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-exemptions"] }),
  });

  return (
    <HrShell title="Fiscalité RH" subtitle="Barème IRPP paramétrable et exonérations fiscales">
      <Tabs defaultValue="brackets">
        <TabsList className="mb-6">
          <TabsTrigger value="brackets">Tranches IRPP</TabsTrigger>
          <TabsTrigger value="exemptions">Exonérations</TabsTrigger>
        </TabsList>

        <TabsContent value="brackets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Barème progressif IRPP annuel (XOF)</CardTitle>
                {bracketsData?.isDefault && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Info className="w-3 h-3" />Barème par défaut Togo — modifiez pour personnaliser</p>}
              </div>
              <div className="flex gap-2">
                {editBrackets && <Button size="sm" onClick={() => saveBracketsMut.mutate()}><Save className="w-4 h-4 mr-1" />Enregistrer</Button>}
                {!editBrackets && <Button size="sm" variant="outline" onClick={() => setEditBrackets(brackets.map(b => ({ ...b })))}>Modifier</Button>}
              </div>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 text-left">De (FCFA/an)</th>
                    <th className="py-2 text-left">À (FCFA/an)</th>
                    <th className="py-2 text-left">Taux %</th>
                    {editBrackets && <th className="py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {brackets.map((b, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{editBrackets ? <Input type="number" value={b.fromAmount} className="h-7 w-32" onChange={e => { const nb = [...editBrackets]; nb[i] = { ...nb[i], fromAmount: Number(e.target.value) }; setEditBrackets(nb); }} /> : formatFCFA(b.fromAmount)}</td>
                      <td className="py-2">{editBrackets ? <Input type="number" value={b.toAmount ?? ""} placeholder="∞" className="h-7 w-32" onChange={e => { const nb = [...editBrackets]; nb[i] = { ...nb[i], toAmount: e.target.value ? Number(e.target.value) : null }; setEditBrackets(nb); }} /> : (b.toAmount ? formatFCFA(b.toAmount) : "∞")}</td>
                      <td className="py-2">{editBrackets ? <Input type="number" step="0.01" value={b.rate * 100} className="h-7 w-20" onChange={e => { const nb = [...editBrackets]; nb[i] = { ...nb[i], rate: Number(e.target.value) / 100 }; setEditBrackets(nb); }} /> : `${(b.rate * 100).toFixed(0)} %`}</td>
                      {editBrackets && <td className="py-2"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditBrackets(editBrackets.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3 text-red-500" /></Button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {editBrackets && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setEditBrackets([...editBrackets, { fromAmount: 0, toAmount: null, rate: 0 }])}>
                  <Plus className="w-4 h-4 mr-1" />Ajouter une tranche
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exemptions">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setExemptOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouvelle exonération</Button>
          </div>
          {(exemptions ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Percent className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Aucune exonération configurée.</p></div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-3 text-left">Bénéficiaire</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Montant / %</th><th className="px-4 py-3 text-left">Motif</th><th className="px-4 py-3 text-left">Période</th><th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody>
                  {(exemptions ?? []).map(e => (
                    <tr key={e.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{e.firstName && e.lastName ? `${e.firstName} ${e.lastName}` : <span className="text-muted-foreground italic">Organisation entière</span>}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{EXEMPTION_TYPE_LABELS[e.exemptionType] ?? e.exemptionType}</Badge></td>
                      <td className="px-4 py-3">{e.fixedAmount != null ? formatFCFA(e.fixedAmount) : e.percentage != null ? `${(e.percentage * 100).toFixed(1)} %` : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{e.reason ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.startDate ? new Date(e.startDate).toLocaleDateString("fr-FR") : "—"} → {e.endDate ? new Date(e.endDate).toLocaleDateString("fr-FR") : "En cours"}</td>
                      <td className="px-4 py-3"><Badge variant={e.isActive ? "default" : "secondary"}>{e.isActive ? "Active" : "Inactive"}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteExemptMut.mutate(e.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={exemptOpen} onOpenChange={setExemptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle exonération fiscale</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Collaborateur (laisser vide = toute l'organisation)</Label>
              <Select value={exemptForm.collaboratorId} onValueChange={v => setExemptForm(f => ({ ...f, collaboratorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Optionnel — tous les collaborateurs" /></SelectTrigger>
                <SelectContent>{(collabs ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type de taxe</Label>
              <Select value={exemptForm.exemptionType} onValueChange={v => setExemptForm(f => ({ ...f, exemptionType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(EXEMPTION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Montant fixe (FCFA)</Label><Input type="number" value={exemptForm.fixedAmount} onChange={e => setExemptForm(f => ({ ...f, fixedAmount: e.target.value, percentage: "" }))} /></div>
              <div><Label>OU Pourcentage (%)</Label><Input type="number" step="0.1" max="100" value={exemptForm.percentage} onChange={e => setExemptForm(f => ({ ...f, percentage: e.target.value, fixedAmount: "" }))} /></div>
            </div>
            <div><Label>Motif</Label><Input value={exemptForm.reason} onChange={e => setExemptForm(f => ({ ...f, reason: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date début</Label><Input type="date" value={exemptForm.startDate} onChange={e => setExemptForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div><Label>Date fin</Label><Input type="date" value={exemptForm.endDate} onChange={e => setExemptForm(f => ({ ...f, endDate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExemptOpen(false)}>Annuler</Button>
            <Button disabled={addExemptMut.isPending} onClick={() => addExemptMut.mutate(exemptForm)}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
