import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/lib/permissions";
import {
  Search, Star, FileText, Mail, Phone, Linkedin, Briefcase,
  CalendarClock, UserCheck, UserX, FolderOpen,
} from "lucide-react";

// Étapes du pipeline (alignées sur le backend recruitment.ts).
const STAGES: { key: string; label: string; color: string }[] = [
  { key: "new",         label: "Nouveau",       color: "bg-muted text-foreground border" },
  { key: "cv_review",   label: "Étude du CV",   color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "phone_screen",label: "Préqualif. tél.", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { key: "interview",   label: "Entretien",     color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "assessment",  label: "Évaluation",    color: "bg-violet-50 text-violet-700 border-violet-200" },
  { key: "offer",       label: "Offre",         color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "hired",       label: "Recruté",       color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "rejected",    label: "Rejeté",        color: "bg-rose-50 text-rose-700 border-rose-200" },
];
const stageMeta = (k?: string) => STAGES.find((s) => s.key === k) ?? STAGES[0];

type Candidacy = {
  id: string; jobOfferId: string; candidateName: string; candidateEmail?: string | null;
  candidatePhone?: string | null; status: string; source?: string | null; rating?: number | null;
  interviewDate?: string | null; createdAt: string; jobTitle?: string | null; jobDepartment?: string | null;
};
type CandidacyDetail = Candidacy & {
  resumeUrl?: string | null; coverLetter?: string | null; linkedinUrl?: string | null;
  interviewNotes?: string | null; notes?: string | null; offerDate?: string | null;
  offeredSalary?: string | null; rejectionReason?: string | null;
};
type Job = { id: string; title: string };

function Stars({ value, onSet, readOnly }: { value?: number | null; onSet?: (n: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={readOnly} onClick={() => onSet?.(n)}
          className={readOnly ? "cursor-default" : "cursor-pointer"}>
          <Star className={`w-4 h-4 ${(value ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}

export default function RecruitmentApplications() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const perms = usePermissions();
  const canWrite = !perms.isReadOnly;

  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState("");
  const [stage, setStage] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["recruitment-jobs"],
    queryFn: () => apiFetch("/api/recruitment/jobs"),
  });

  const { data: list, isLoading } = useQuery<Candidacy[]>({
    queryKey: ["candidacies", jobId, stage],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (jobId) qs.set("jobId", jobId);
      if (stage) qs.set("status", stage);
      return apiFetch(`/api/recruitment/candidacies?${qs}`);
    },
  });

  const { data: detail } = useQuery<CandidacyDetail>({
    queryKey: ["candidacy", openId],
    queryFn: () => apiFetch(`/api/recruitment/candidacies/${openId}`),
    enabled: !!openId,
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/recruitment/candidacies/${openId}`, { method: "PATCH", body: body as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidacy", openId] });
      qc.invalidateQueries({ queryKey: ["candidacies"] });
      toast({ title: "Dossier mis à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? e?.message, variant: "destructive" }),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list ?? []).filter((c) => !q || c.candidateName.toLowerCase().includes(q) || (c.jobTitle ?? "").toLowerCase().includes(q));
  }, [list, search]);

  return (
    <HrShell title="Dossier de candidature" subtitle="Candidatures, fiche candidat, entretiens, appréciations et décision.">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher un candidat ou un poste…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="border border-border rounded-md px-3 text-sm h-10">
          <option value="">Tous les postes</option>
          {(jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="border border-border rounded-md px-3 text-sm h-10">
          <option value="">Toutes les étapes</option>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Aucune candidature ne correspond à ces critères.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2">Candidat</th>
                  <th className="text-left px-4 py-2">Poste</th>
                  <th className="text-left px-4 py-2 w-36">Étape</th>
                  <th className="text-left px-4 py-2 w-28">Appréciation</th>
                  <th className="text-left px-4 py-2 w-32">Entretien</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const m = stageMeta(c.status);
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => setOpenId(c.id)}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{c.candidateName}</div>
                        <div className="text-xs text-muted-foreground">{c.candidateEmail || c.candidatePhone || "—"}</div>
                      </td>
                      <td className="px-4 py-2">{c.jobTitle ?? "—"}{c.jobDepartment && <span className="text-xs text-muted-foreground"> · {c.jobDepartment}</span>}</td>
                      <td className="px-4 py-2"><Badge className={`text-xs border ${m.color}`}>{m.label}</Badge></td>
                      <td className="px-4 py-2"><Stars value={c.rating} readOnly /></td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{c.interviewDate ? new Date(c.interviewDate).toLocaleDateString("fr-FR") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Fiche candidat (détail) */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.candidateName}
                  <Badge className={`text-xs border ${stageMeta(detail.status).color}`}>{stageMeta(detail.status).label}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 text-sm">
                {/* Identité & poste */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-muted-foreground" /><span>{detail.jobTitle ?? "—"}{detail.jobDepartment ? ` · ${detail.jobDepartment}` : ""}</span></div>
                  <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span>{detail.candidateEmail || "—"}</span></div>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span>{detail.candidatePhone || "—"}</span></div>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">Source : {detail.source || "—"}</div>
                </div>

                {/* Documents */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pièces jointes</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.resumeUrl
                      ? <a href={detail.resumeUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><FileText className="w-4 h-4 mr-1" /> CV</Button></a>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">CV non fourni</Badge>}
                    {detail.coverLetter
                      ? <a href={detail.coverLetter} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><FileText className="w-4 h-4 mr-1" /> Lettre de motivation</Button></a>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Lettre non fournie</Badge>}
                    {detail.linkedinUrl && <a href={detail.linkedinUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><Linkedin className="w-4 h-4 mr-1" /> LinkedIn</Button></a>}
                  </div>
                </div>

                {/* Étape du pipeline */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Étape</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((s) => (
                      <button key={s.key} type="button" disabled={!canWrite || patch.isPending}
                        onClick={() => patch.mutate({ status: s.key })}
                        className={`text-xs px-2 py-1 rounded border ${detail.status === s.key ? s.color : "bg-background text-muted-foreground hover:bg-muted"} ${!canWrite ? "opacity-60 cursor-not-allowed" : ""}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Appréciation */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Appréciation</p>
                  <Stars value={detail.rating} readOnly={!canWrite} onSet={(n) => patch.mutate({ rating: n })} />
                </div>

                {/* Entretien */}
                <div className="grid grid-cols-2 gap-3 items-start">
                  <div>
                    <Label className="text-xs flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Date d'entretien</Label>
                    <Input type="date" disabled={!canWrite}
                      defaultValue={detail.interviewDate ? new Date(detail.interviewDate).toISOString().slice(0, 10) : ""}
                      onBlur={(e) => e.target.value && patch.mutate({ interviewDate: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Notes d'entretien</Label>
                    <Textarea defaultValue={detail.interviewNotes ?? ""} disabled={!canWrite}
                      onBlur={(e) => patch.mutate({ interviewNotes: e.target.value })} className="mt-1 min-h-[38px]" />
                  </div>
                </div>

                {/* Décision */}
                <div className="border-t pt-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Décision</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" disabled={!canWrite || patch.isPending} onClick={() => patch.mutate({ status: "hired" })}>
                      <UserCheck className="w-4 h-4 mr-1" /> Recruter
                    </Button>
                    <Button size="sm" variant="outline" disabled={!canWrite || patch.isPending} onClick={() => {
                      const reason = window.prompt("Motif du rejet :", detail.rejectionReason ?? "");
                      if (reason !== null) patch.mutate({ status: "rejected", rejectionReason: reason });
                    }}>
                      <UserX className="w-4 h-4 mr-1" /> Rejeter
                    </Button>
                    {detail.status === "rejected" && detail.rejectionReason && (
                      <span className="text-xs text-rose-600">Motif : {detail.rejectionReason}</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
