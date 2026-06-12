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
import { Plus, Save, Info, Percent, Trash2, Send, ShieldCheck, XCircle, Clock, FileText, RefreshCw, AlertTriangle } from "lucide-react";

type Bracket = { id?: string; fromAmount: number; toAmount: number | null; rate: number; sortOrder?: number };
type Exemption = { id: string; collaboratorId?: string; exemptionType: string; fixedAmount?: number; percentage?: number; reason?: string; startDate?: string; endDate?: string; isActive: boolean; firstName?: string; lastName?: string };
type Collab = { id: string; firstName: string; lastName: string };

type TaxDeclaration = {
  id: string;
  type: string;
  period: string;
  status: string;
  totalAmount: number;
  dueDate?: string | null;
  referenceNumber?: string | null;
  submittedAt?: string | null;
  validatedAt?: string | null;
  notes?: string | null;
  createdAt: string;
};

const EXEMPTION_TYPE_LABELS: Record<string, string> = { irpp: "IRPP", cnss: "CNSS", ipts: "IPTS", all: "Toutes taxes" };

const DECL_STATUS_INFO: Record<string, { label: string; icon: React.ElementType; badgeClass: string }> = {
  draft:     { label: "Brouillon",    icon: Clock,       badgeClass: "border-gray-300 text-gray-600 bg-gray-50" },
  generated: { label: "Enregistré",   icon: FileText,    badgeClass: "border-blue-300 text-blue-700 bg-blue-50" },
  submitted: { label: "Soumis",       icon: Send,        badgeClass: "border-amber-300 text-amber-700 bg-amber-50" },
  validated: { label: "Validé OTR",   icon: ShieldCheck, badgeClass: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  rejected:  { label: "Rejeté",       icon: XCircle,     badgeClass: "border-red-300 text-red-700 bg-red-50" },
};

const TYPE_LABELS: Record<string, string> = { cnss: "CNSS", irpp: "IRPP", ipts: "IPTS", tva: "TVA", is: "IS", autre: "Autre" };

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function TaxSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [exemptOpen, setExemptOpen] = useState(false);
  const [exemptForm, setExemptForm] = useState({ collaboratorId: "", exemptionType: "irpp", fixedAmount: "", percentage: "", reason: "", startDate: "", endDate: "" });
  const [editBrackets, setEditBrackets] = useState<Bracket[] | null>(null);
  const [patchDialog, setPatchDialog] = useState<{ decl: TaxDeclaration; targetStatus: "submitted" | "validated" | "rejected" } | null>(null);
  const [patchRef, setPatchRef] = useState("");
  const [patchNotes, setPatchNotes] = useState("");
  const [patchDate, setPatchDate] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  const { data: allDeclarations = [], isLoading: declLoading } = useQuery<TaxDeclaration[]>({
    queryKey: ["all-tax-declarations"],
    queryFn: () => apiFetch("/api/hr/tax-declarations"),
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

  const patchDeclMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFetch(`/api/hr/tax-declarations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-tax-declarations"] });
      setPatchDialog(null);
      toast({ title: "Statut mis à jour" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const toInputDate = (d: string | null | undefined) =>
    d ? new Date(d).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

  const openPatch = (decl: TaxDeclaration, targetStatus: "submitted" | "validated" | "rejected") => {
    setPatchRef(decl.referenceNumber ?? "");
    setPatchNotes(decl.notes ?? "");
    if (targetStatus === "validated") {
      setPatchDate(toInputDate(decl.validatedAt));
    } else {
      setPatchDate(toInputDate(decl.submittedAt));
    }
    setPatchDialog({ decl, targetStatus });
  };

  const filteredDeclarations = allDeclarations.filter(d => {
    if (filterType !== "all" && d.type !== filterType) return false;
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    return true;
  });

  const groupedByPeriod = filteredDeclarations.reduce<Record<string, TaxDeclaration[]>>((acc, d) => {
    if (!acc[d.period]) acc[d.period] = [];
    acc[d.period].push(d);
    return acc;
  }, {});
  const sortedPeriods = Object.keys(groupedByPeriod).sort((a, b) => b.localeCompare(a));

  return (
    <HrShell title="Fiscalité RH" subtitle="Barème IRPP, exonérations et registre fiscal des déclarations">
      <Tabs defaultValue="register">
        <TabsList className="mb-6">
          <TabsTrigger value="register">Registre fiscal</TabsTrigger>
          <TabsTrigger value="brackets">Tranches IRPP</TabsTrigger>
          <TabsTrigger value="exemptions">Exonérations</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════
            REGISTRE FISCAL — historique complet des déclarations
        ══════════════════════════════════════════════════════ */}
        <TabsContent value="register">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Tous types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Tous statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {Object.entries(DECL_STATUS_INFO).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground">{filteredDeclarations.length} déclaration{filteredDeclarations.length !== 1 ? "s" : ""}</span>
            </div>

            {declLoading ? (
              <div className="py-12 text-center text-muted-foreground">Chargement…</div>
            ) : sortedPeriods.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Aucune déclaration enregistrée.</p>
                <p className="text-xs mt-1">Générez-en depuis <strong>Déclarations CNSS/IRPP</strong> → "Enregistrer dans le registre".</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedPeriods.map(period => (
                  <div key={period} className="rounded-xl border overflow-hidden">
                    <div className="bg-muted/40 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-sm font-semibold">{period}</span>
                      <div className="flex gap-1.5">
                        {groupedByPeriod[period].map(d => {
                          const si = DECL_STATUS_INFO[d.status] ?? DECL_STATUS_INFO.draft;
                          return (
                            <Badge key={d.id} variant="outline" className={`text-[10px] ${si.badgeClass}`}>
                              {TYPE_LABELS[d.type] ?? d.type} — {si.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground uppercase border-b bg-background">
                        <tr>
                          <th className="px-4 py-2 text-left">Type</th>
                          <th className="px-4 py-2 text-left">Statut</th>
                          <th className="px-4 py-2 text-right">Montant</th>
                          <th className="px-4 py-2 text-left">Échéance</th>
                          <th className="px-4 py-2 text-left">Référence</th>
                          <th className="px-4 py-2 text-left">Soumis le</th>
                          <th className="px-4 py-2 text-left">Validé le</th>
                          <th className="px-4 py-2 text-left">Notes</th>
                          <th className="px-4 py-2 w-36"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedByPeriod[period].map(d => {
                          const si = DECL_STATUS_INFO[d.status] ?? DECL_STATUS_INFO.draft;
                          const Icon = si.icon;
                          const today = new Date().toISOString().split("T")[0];
                          const isOverdue = d.status === "generated" && d.dueDate != null && d.dueDate < today;
                          const isDueSoon = d.status === "generated" && d.dueDate != null && !isOverdue && d.dueDate <= new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
                          return (
                            <tr key={d.id} className={`border-t hover:bg-muted/20 ${isOverdue ? "bg-red-50/40" : ""}`}>
                              <td className="px-4 py-3 font-semibold">{TYPE_LABELS[d.type] ?? d.type}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className={`text-xs ${si.badgeClass}`}>
                                    <Icon className="w-3 h-3 mr-1" />
                                    {si.label}
                                  </Badge>
                                  {isOverdue && (
                                    <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 bg-red-50 gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5" />En retard
                                    </Badge>
                                  )}
                                  {isDueSoon && (
                                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5" />Échéance proche
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-medium">{formatFCFA(d.totalAmount)}</td>
                              <td className="px-4 py-3 text-xs">
                                {d.dueDate ? (
                                  <span className={isOverdue ? "text-red-600 font-semibold" : isDueSoon ? "text-amber-600 font-semibold" : "text-muted-foreground"}>
                                    {fmtDate(d.dueDate)}
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {d.referenceNumber ?? <span className="text-muted-foreground italic">—</span>}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(d.submittedAt)}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(d.validatedAt)}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">{d.notes ?? "—"}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  {d.status === "generated" && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPatch(d, "submitted")}>
                                      <Send className="w-3 h-3 mr-1" />Soumettre
                                    </Button>
                                  )}
                                  {d.status === "submitted" && (
                                    <>
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPatch(d, "submitted")}>
                                        <RefreshCw className="w-3 h-3 mr-1" />Modifier
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => openPatch(d, "validated")}>
                                        <ShieldCheck className="w-3 h-3 mr-1" />Valider
                                      </Button>
                                    </>
                                  )}
                                  {d.status === "validated" && (
                                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                                      <ShieldCheck className="w-3.5 h-3.5" />Validé OTR
                                    </span>
                                  )}
                                  {d.status === "rejected" && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPatch(d, "submitted")}>
                                      <RefreshCw className="w-3 h-3 mr-1" />Re-soumettre
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            BARÈME IRPP
        ══════════════════════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════════════════════
            EXONÉRATIONS
        ══════════════════════════════════════════════════════ */}
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

      {/* ─── Dialog ajout exonération ─── */}
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

      {/* ─── Dialog soumission / validation ─── */}
      <Dialog open={!!patchDialog} onOpenChange={() => setPatchDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {patchDialog?.targetStatus === "validated"
                ? `Valider la déclaration ${TYPE_LABELS[patchDialog.decl.type] ?? patchDialog.decl.type}`
                : patchDialog?.targetStatus === "rejected"
                  ? `Rejeter la déclaration ${TYPE_LABELS[patchDialog?.decl.type] ?? patchDialog?.decl.type}`
                  : `Soumettre la déclaration ${TYPE_LABELS[patchDialog?.decl.type ?? ""] ?? patchDialog?.decl.type}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Numéro de référence {patchDialog?.targetStatus === "validated" ? "OTR" : "CNSS / OTR"}</Label>
              <Input
                placeholder={patchDialog?.targetStatus === "validated" ? "Ex. OTR-2026-00123" : "Ex. CNSS-2026-00456"}
                value={patchRef}
                onChange={e => setPatchRef(e.target.value)}
              />
            </div>
            <div>
              <Label>
                {patchDialog?.targetStatus === "validated" ? "Date de validation OTR" : "Date de soumission"}
                {" "}<span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={patchDate}
                onChange={e => setPatchDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes / Observations</Label>
              <Input placeholder="Optionnel" value={patchNotes} onChange={e => setPatchNotes(e.target.value)} />
            </div>
            {patchDialog && (
              <div className="rounded-lg bg-muted/40 border px-3 py-2 text-sm text-muted-foreground space-y-1">
                <p>Période : <span className="font-medium text-foreground">{patchDialog.decl.period}</span></p>
                <p>Montant : <span className="font-medium text-foreground">{formatFCFA(patchDialog.decl.totalAmount)}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPatchDialog(null)}>Annuler</Button>
            <Button
              disabled={patchDeclMut.isPending || !patchDialog || !patchDate}
              onClick={() => {
                if (!patchDialog) return;
                const data: Record<string, unknown> = {
                  status: patchDialog.targetStatus,
                  referenceNumber: patchRef || undefined,
                  notes: patchNotes || undefined,
                };
                if (patchDialog.targetStatus === "validated") {
                  data.validatedAt = patchDate;
                  if (patchDialog.decl.submittedAt) data.submittedAt = toInputDate(patchDialog.decl.submittedAt);
                } else if (patchDialog.targetStatus === "submitted") {
                  data.submittedAt = patchDate;
                }
                patchDeclMut.mutate({ id: patchDialog.decl.id, data });
              }}
              className={patchDialog?.targetStatus === "rejected" ? "bg-red-600 hover:bg-red-700" : patchDialog?.targetStatus === "validated" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {patchDeclMut.isPending ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> :
               patchDialog?.targetStatus === "validated" ? <ShieldCheck className="w-4 h-4 mr-1" /> :
               patchDialog?.targetStatus === "rejected" ? <XCircle className="w-4 h-4 mr-1" /> :
               <Send className="w-4 h-4 mr-1" />}
              {patchDialog?.targetStatus === "validated" ? "Marquer validé" :
               patchDialog?.targetStatus === "rejected" ? "Marquer rejeté" :
               "Marquer soumis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
