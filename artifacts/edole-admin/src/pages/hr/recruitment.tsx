import React, { useState } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Briefcase, Users, UserCheck, Clock } from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

const PIPELINE_STAGES = [
  { key: "new", label: "Nouveau", color: "bg-slate-100 border-slate-300 text-slate-700" },
  { key: "screening", label: "Présélection", color: "bg-blue-50 border-blue-300 text-blue-700" },
  { key: "interview", label: "Entretien", color: "bg-primary/5 border-orange-300 text-primary" },
  { key: "offer", label: "Offre", color: "bg-purple-50 border-purple-300 text-purple-700" },
  { key: "hired", label: "Recruté", color: "bg-green-50 border-green-300 text-green-700" },
  { key: "rejected", label: "Rejeté", color: "bg-red-50 border-red-300 text-red-700" },
];

const NEXT_STAGE: Record<string, string> = {
  new: "screening", screening: "interview", interview: "offer", offer: "hired",
};

export default function RecruitmentPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"pipeline" | "jobs">("pipeline");
  const [jobOpen, setJobOpen] = useState(false);
  const [candidacyOpen, setCandidacyOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [jobForm, setJobForm] = useState({ title: "", department: "", location: "", type: "CDI", experienceLevel: "", notes: "" });
  const [candForm, setCandForm] = useState({ jobOfferId: "", candidateName: "", candidateEmail: "", candidatePhone: "", source: "spontanée", notes: "" });

  const { data: pipeline = {} } = useQuery<Record<string, any[]>>({
    queryKey: ["recruitment-pipeline"],
    queryFn: () => fetchJSON(`${API}/recruitment/pipeline`),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["recruitment-stats"],
    queryFn: () => fetchJSON(`${API}/recruitment/stats`),
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["recruitment-jobs"],
    queryFn: () => fetchJSON(`${API}/recruitment/jobs`),
  });

  const createJob = useMutation({
    mutationFn: (d: typeof jobForm) => fetchJSON(`${API}/recruitment/jobs`, { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recruitment-jobs"] }); qc.invalidateQueries({ queryKey: ["recruitment-stats"] }); setJobOpen(false); toast({ title: "Offre créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const createCandidacy = useMutation({
    mutationFn: (d: typeof candForm) => fetchJSON(`${API}/recruitment/candidacies`, { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recruitment-pipeline"] }); setCandidacyOpen(false); toast({ title: "Candidature ajoutée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const advanceMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchJSON(`${API}/recruitment/candidacies/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-pipeline"] }),
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <HrShell title="Recrutement" subtitle="Vivier de candidatures et offres d'emploi">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Briefcase, label: "Offres ouvertes", value: stats?.openJobs ?? 0, color: "text-blue-600 bg-blue-50" },
            { icon: Users, label: "Candidatures", value: stats?.totalCandidacies ?? 0, color: "text-primary bg-primary/5" },
            { icon: Clock, label: "En entretien", value: stats?.inInterview ?? 0, color: "text-purple-600 bg-purple-50" },
            { icon: UserCheck, label: "Recrutés", value: stats?.hired ?? 0, color: "text-green-600 bg-green-50" },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.color}`}><k.icon className="w-5 h-5" /></div>
                  <div><p className="text-xs text-muted-foreground">{k.label}</p><p className="text-xl font-bold">{k.value}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs + actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant={view === "pipeline" ? "default" : "outline"} size="sm" onClick={() => setView("pipeline")}>Vue kanban</Button>
            <Button variant={view === "jobs" ? "default" : "outline"} size="sm" onClick={() => setView("jobs")}>Offres</Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCandidacyOpen(true)}><Plus className="w-3 h-3 mr-1" />Candidature</Button>
            <Button size="sm" onClick={() => setJobOpen(true)}><Plus className="w-3 h-3 mr-1" />Offre d'emploi</Button>
          </div>
        </div>

        {/* Pipeline kanban */}
        {view === "pipeline" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {PIPELINE_STAGES.map((stage) => {
              const cards: any[] = pipeline[stage.key] ?? [];
              return (
                <div key={stage.key} className="space-y-2">
                  <div className={`flex items-center justify-between px-2 py-1.5 rounded border text-xs font-medium ${stage.color}`}>
                    <span>{stage.label}</span>
                    <span className="font-bold">{cards.length}</span>
                  </div>
                  <div className="space-y-2">
                    {cards.map((c: any) => (
                      <Card key={c.id} className="shadow-sm">
                        <CardContent className="p-2.5 space-y-1">
                          <p className="text-sm font-medium leading-tight">{c.candidateName}</p>
                          {c.jobTitle && <p className="text-xs text-muted-foreground truncate">{c.jobTitle}</p>}
                          {c.jobDepartment && <p className="text-xs text-muted-foreground">{c.jobDepartment}</p>}
                          {c.source && <Badge variant="outline" className="text-xs">{c.source}</Badge>}
                          {NEXT_STAGE[stage.key] && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full h-6 text-xs mt-1"
                              disabled={advanceMut.isPending}
                              onClick={() => advanceMut.mutate({ id: c.id, status: NEXT_STAGE[stage.key] })}
                            >
                              → {PIPELINE_STAGES.find((s) => s.key === NEXT_STAGE[stage.key])?.label}
                            </Button>
                          )}
                          {stage.key === "interview" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full h-6 text-xs text-red-600"
                              disabled={advanceMut.isPending}
                              onClick={() => advanceMut.mutate({ id: c.id, status: "rejected" })}
                            >
                              Rejeter
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Offres list */}
        {view === "jobs" && (
          <div className="grid gap-3">
            {jobs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Aucune offre créée</div>
            ) : jobs.map((j: any) => (
              <Card key={j.id}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{j.title}</h3>
                        <Badge variant={j.status === "open" ? "default" : "secondary"}>{j.status === "open" ? "Ouverte" : j.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {j.department && `${j.department} · `}{j.location && `${j.location} · `}{j.type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{j.candidacyCount ?? 0}</p>
                      <p className="text-xs text-muted-foreground">candidature(s)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog offre */}
      <Dialog open={jobOpen} onOpenChange={setJobOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle offre d'emploi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Intitulé du poste *</Label><Input value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Département</Label><Input value={jobForm.department} onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })} /></div>
              <div><Label>Lieu</Label><Input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type de contrat</Label>
                <Select value={jobForm.type} onValueChange={(v) => setJobForm({ ...jobForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["CDI", "CDD", "Stage", "Freelance", "Alternance"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Niveau d'expérience</Label><Input value={jobForm.experienceLevel} onChange={(e) => setJobForm({ ...jobForm, experienceLevel: e.target.value })} placeholder="Junior / Senior…" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobOpen(false)}>Annuler</Button>
            <Button onClick={() => createJob.mutate(jobForm)} disabled={createJob.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog candidature */}
      <Dialog open={candidacyOpen} onOpenChange={setCandidacyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle candidature</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Offre concernée *</Label>
              <Select value={candForm.jobOfferId} onValueChange={(v) => setCandForm({ ...candForm, jobOfferId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une offre" /></SelectTrigger>
                <SelectContent>
                  {jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nom du candidat *</Label><Input value={candForm.candidateName} onChange={(e) => setCandForm({ ...candForm, candidateName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={candForm.candidateEmail} onChange={(e) => setCandForm({ ...candForm, candidateEmail: e.target.value })} /></div>
              <div><Label>Téléphone</Label><Input value={candForm.candidatePhone} onChange={(e) => setCandForm({ ...candForm, candidatePhone: e.target.value })} /></div>
            </div>
            <div>
              <Label>Source</Label>
              <Select value={candForm.source} onValueChange={(v) => setCandForm({ ...candForm, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["spontanée", "LinkedIn", "Indeed", "Recommandation", "Cabinet", "Site web", "Autre"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={candForm.notes} onChange={(e) => setCandForm({ ...candForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCandidacyOpen(false)}>Annuler</Button>
            <Button onClick={() => createCandidacy.mutate(candForm)} disabled={createCandidacy.isPending}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
