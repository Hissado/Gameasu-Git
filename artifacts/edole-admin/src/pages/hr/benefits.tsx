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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { Plus, Shield, PenLine, FileSignature, Calculator, Trash2, CheckCircle, XCircle, UserPlus } from "lucide-react";

type Plan = { id: string; name: string; type: string; provider?: string; description?: string; employeeContribution: number; employerContribution: number; contributionMode: string; isActive: boolean; enrolledCount: number };
type Enrollment = { id: string; collaboratorId: string; benefitPlanId: string; enrollmentDate: string; status: string; firstName?: string; lastName?: string; planName?: string; planType?: string };
type SigRequest = { id: string; documentLabel: string; documentType: string; signatoryName: string; signatoryEmail: string; status: string; createdAt: string; expiresAt: string; signedAt?: string };
type TaxDecl = { id: string; type: string; period: string; status: string; totalAmount: number; dueDate?: string; referenceNumber?: string; submittedAt?: string };

const PLAN_TYPES: Record<string, string> = { assurance_sante: "Assurance santé", assurance_vie: "Assurance vie", retraite: "Retraite", tickets_repas: "Tickets repas", transport: "Transport", autre: "Autre" };
const SIG_STATUS_COLOR: Record<string, string> = { pending: "bg-amber-100 text-amber-700", signed: "bg-emerald-100 text-emerald-700", declined: "bg-red-100 text-red-700", expired: "bg-gray-100 text-gray-600", cancelled: "bg-gray-100 text-gray-600" };
const SIG_STATUS_LABEL: Record<string, string> = { pending: "En attente", signed: "Signé", declined: "Refusé", expired: "Expiré", cancelled: "Annulé" };
const DECL_STATUS_LABEL: Record<string, string> = { draft: "Brouillon", generated: "Généré", submitted: "Soumis", validated: "Validé", rejected: "Rejeté" };
const DECL_TYPES: Record<string, string> = { irpp: "IRPP", cnss: "CNSS", ipts: "IPTS", tva: "TVA", is: "IS", autre: "Autre" };
type Collab = { id: string; firstName: string; lastName: string };

export default function Benefits() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [planOpen, setPlanOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [declOpen, setDeclOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ name: "", type: "assurance_sante", provider: "", description: "", employeeContribution: "", employerContribution: "", contributionMode: "fixed" });
  const [enrollForm, setEnrollForm] = useState({ collaboratorId: "", benefitPlanId: "", enrollmentDate: new Date().toISOString().split("T")[0] });
  const [sigForm, setSigForm] = useState({ documentType: "contrat", documentLabel: "", signatoryName: "", signatoryEmail: "", expiresInDays: "7" });
  const [declForm, setDeclForm] = useState({ type: "irpp", period: "", totalAmount: "", dueDate: "" });

  const { data: plans } = useQuery<Plan[]>({ queryKey: ["benefit-plans"], queryFn: () => apiFetch("/api/hr/benefits/plans") });
  const { data: enrollments } = useQuery<Enrollment[]>({ queryKey: ["benefit-enrollments"], queryFn: () => apiFetch("/api/hr/benefits/enrollments") });
  const { data: sigRequests } = useQuery<SigRequest[]>({ queryKey: ["sig-requests"], queryFn: () => apiFetch("/api/hr/signature-requests") });
  const { data: taxDecls } = useQuery<TaxDecl[]>({ queryKey: ["tax-decls"], queryFn: () => apiFetch("/api/hr/tax-declarations") });
  const { data: collabs } = useQuery<Collab[]>({ queryKey: ["collabs-list"], queryFn: () => apiFetch("/api/hr/collaborators") });

  const createPlanMut = useMutation({
    mutationFn: (d: typeof planForm) => apiFetch("/api/hr/benefits/plans", { method: "POST", body: JSON.stringify({ ...d, employeeContribution: Number(d.employeeContribution || 0), employerContribution: Number(d.employerContribution || 0) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["benefit-plans"] }); setPlanOpen(false); toast({ title: "Plan créé" }); },
  });
  const deletePlanMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/benefits/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["benefit-plans"] }),
  });
  const createEnrollMut = useMutation({
    mutationFn: (d: typeof enrollForm) => apiFetch("/api/hr/benefits/enrollments", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["benefit-enrollments"] }); setEnrollOpen(false); toast({ title: "Inscription ajoutée" }); },
  });
  const createSigMut = useMutation({
    mutationFn: (d: typeof sigForm) => apiFetch("/api/hr/signature-requests", { method: "POST", body: JSON.stringify({ ...d, expiresInDays: Number(d.expiresInDays) }) }),
    onSuccess: (data: { signLink?: string }) => { qc.invalidateQueries({ queryKey: ["sig-requests"] }); setSigOpen(false); toast({ title: `Demande créée${data?.signLink ? ` — lien : ${data.signLink}` : ""}` }); },
  });
  const cancelSigMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/signature-requests/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sig-requests"] }),
  });
  const createDeclMut = useMutation({
    mutationFn: (d: typeof declForm) => apiFetch("/api/hr/tax-declarations", { method: "POST", body: JSON.stringify({ ...d, totalAmount: Number(d.totalAmount || 0) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-decls"] }); setDeclOpen(false); toast({ title: "Déclaration créée" }); },
  });
  const updateDeclMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/hr/tax-declarations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-decls"] }),
  });

  return (
    <HrShell title="Avantages & Conformité" subtitle="Avantages sociaux, signatures électroniques et déclarations fiscales">
      <Tabs defaultValue="benefits">
        <TabsList className="mb-6">
          <TabsTrigger value="benefits">Avantages sociaux</TabsTrigger>
          <TabsTrigger value="signatures">Signatures électroniques</TabsTrigger>
          <TabsTrigger value="declarations">Déclarations fiscales</TabsTrigger>
        </TabsList>

        {/* ─── AVANTAGES ─── */}
        <TabsContent value="benefits">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Plans disponibles</h3>
              <Button size="sm" onClick={() => setPlanOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouveau plan</Button>
            </div>
            {(plans ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Shield className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Aucun plan d'avantages configuré.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(plans ?? []).map(p => (
                  <Card key={p.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-sm">{p.name}</div>
                          <Badge variant="outline" className="text-xs mt-0.5">{PLAN_TYPES[p.type] ?? p.type}</Badge>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 -mt-1 -mr-1" onClick={() => deletePlanMut.mutate(p.id)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                      </div>
                      {p.provider && <div className="text-xs text-muted-foreground mb-2">Prestataire : {p.provider}</div>}
                      <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                        <div className="bg-muted/50 rounded p-2"><div className="text-muted-foreground">Salarié</div><div className="font-semibold">{p.contributionMode === "fixed" ? formatFCFA(p.employeeContribution) : `${p.employeeContribution}%`}</div></div>
                        <div className="bg-muted/50 rounded p-2"><div className="text-muted-foreground">Employeur</div><div className="font-semibold">{p.contributionMode === "fixed" ? formatFCFA(p.employerContribution) : `${p.employerContribution}%`}</div></div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">{p.enrolledCount} inscrit{p.enrolledCount > 1 ? "s" : ""}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Inscriptions collaborateurs</h3>
              <Button size="sm" variant="outline" onClick={() => setEnrollOpen(true)}><UserPlus className="w-4 h-4 mr-1" />Inscrire</Button>
            </div>
            {(enrollments ?? []).length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-left">Collaborateur</th><th className="px-4 py-2 text-left">Plan</th><th className="px-4 py-2 text-left">Inscription</th><th className="px-4 py-2 text-left">Statut</th></tr></thead>
                  <tbody>{(enrollments ?? []).map(e => <tr key={e.id} className="border-t"><td className="px-4 py-2.5 font-medium">{e.firstName} {e.lastName}</td><td className="px-4 py-2.5">{e.planName}<div className="text-xs text-muted-foreground">{e.planType}</div></td><td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(e.enrollmentDate).toLocaleDateString("fr-FR")}</td><td className="px-4 py-2.5"><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── SIGNATURES ─── */}
        <TabsContent value="signatures">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setSigOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouvelle demande</Button>
          </div>
          {(sigRequests ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><FileSignature className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Aucune demande de signature.</p></div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left">Document</th><th className="px-4 py-3 text-left">Signataire</th><th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3 text-left">Expire</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody>
                  {(sigRequests ?? []).map(s => (
                    <tr key={s.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3"><div className="font-medium">{s.documentLabel}</div><div className="text-xs text-muted-foreground">{s.documentType}</div></td>
                      <td className="px-4 py-3"><div>{s.signatoryName}</div><div className="text-xs text-muted-foreground">{s.signatoryEmail}</div></td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SIG_STATUS_COLOR[s.status] ?? ""}`}>{SIG_STATUS_LABEL[s.status] ?? s.status}</span></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.expiresAt).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right">{s.status === "pending" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelSigMut.mutate(s.id)}><XCircle className="w-4 h-4 text-red-500" /></Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ─── DÉCLARATIONS FISCALES ─── */}
        <TabsContent value="declarations">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setDeclOpen(true)}><Plus className="w-4 h-4 mr-1" />Nouvelle déclaration</Button>
          </div>
          {(taxDecls ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Aucune déclaration fiscale.</p></div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Période</th><th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3 text-left">Échéance</th><th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody>
                  {(taxDecls ?? []).map(d => (
                    <tr key={d.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium"><Badge variant="outline">{DECL_TYPES[d.type] ?? d.type}</Badge></td>
                      <td className="px-4 py-3 font-mono text-sm">{d.period}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatFCFA(d.totalAmount)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.dueDate ? new Date(d.dueDate).toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="px-4 py-3"><Badge variant={d.status === "validated" ? "default" : "secondary"} className="text-xs">{DECL_STATUS_LABEL[d.status] ?? d.status}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {d.status === "generated" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateDeclMut.mutate({ id: d.id, status: "submitted" })}>Soumettre</Button>}
                        {d.status === "submitted" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateDeclMut.mutate({ id: d.id, status: "validated" })}>Valider</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─ Dialogs ─ */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau plan d'avantages</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Nom</Label><Input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Type</Label><Select value={planForm.type} onValueChange={v => setPlanForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PLAN_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Prestataire</Label><Input value={planForm.provider} onChange={e => setPlanForm(f => ({ ...f, provider: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cotisation salarié</Label><Input type="number" value={planForm.employeeContribution} onChange={e => setPlanForm(f => ({ ...f, employeeContribution: e.target.value }))} /></div>
              <div><Label>Cotisation employeur</Label><Input type="number" value={planForm.employerContribution} onChange={e => setPlanForm(f => ({ ...f, employerContribution: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPlanOpen(false)}>Annuler</Button><Button disabled={!planForm.name || createPlanMut.isPending} onClick={() => createPlanMut.mutate(planForm)}>Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Inscrire un collaborateur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Collaborateur</Label><Select value={enrollForm.collaboratorId} onValueChange={v => setEnrollForm(f => ({ ...f, collaboratorId: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger><SelectContent>{(collabs ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Plan</Label><Select value={enrollForm.benefitPlanId} onValueChange={v => setEnrollForm(f => ({ ...f, benefitPlanId: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger><SelectContent>{(plans ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Date d'inscription</Label><Input type="date" value={enrollForm.enrollmentDate} onChange={e => setEnrollForm(f => ({ ...f, enrollmentDate: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEnrollOpen(false)}>Annuler</Button><Button disabled={!enrollForm.collaboratorId || !enrollForm.benefitPlanId || createEnrollMut.isPending} onClick={() => createEnrollMut.mutate(enrollForm)}>Inscrire</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sigOpen} onOpenChange={setSigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle demande de signature</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Type de document</Label><Select value={sigForm.documentType} onValueChange={v => setSigForm(f => ({ ...f, documentType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["contrat", "offre", "attestation", "avenant", "autre"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Libellé du document</Label><Input placeholder="Contrat CDI — Kofi Asante" value={sigForm.documentLabel} onChange={e => setSigForm(f => ({ ...f, documentLabel: e.target.value }))} /></div>
            <div><Label>Nom du signataire</Label><Input value={sigForm.signatoryName} onChange={e => setSigForm(f => ({ ...f, signatoryName: e.target.value }))} /></div>
            <div><Label>Email du signataire</Label><Input type="email" value={sigForm.signatoryEmail} onChange={e => setSigForm(f => ({ ...f, signatoryEmail: e.target.value }))} /></div>
            <div><Label>Expiration (jours)</Label><Input type="number" value={sigForm.expiresInDays} onChange={e => setSigForm(f => ({ ...f, expiresInDays: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSigOpen(false)}>Annuler</Button><Button disabled={!sigForm.documentLabel || !sigForm.signatoryEmail || createSigMut.isPending} onClick={() => createSigMut.mutate(sigForm)}>Envoyer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={declOpen} onOpenChange={setDeclOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nouvelle déclaration fiscale</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Type</Label><Select value={declForm.type} onValueChange={v => setDeclForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DECL_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Période (ex: 2026-06)</Label><Input value={declForm.period} onChange={e => setDeclForm(f => ({ ...f, period: e.target.value }))} /></div>
            <div><Label>Montant total (FCFA)</Label><Input type="number" value={declForm.totalAmount} onChange={e => setDeclForm(f => ({ ...f, totalAmount: e.target.value }))} /></div>
            <div><Label>Date d'échéance</Label><Input type="date" value={declForm.dueDate} onChange={e => setDeclForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDeclOpen(false)}>Annuler</Button><Button disabled={!declForm.period || createDeclMut.isPending} onClick={() => createDeclMut.mutate(declForm)}>Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
