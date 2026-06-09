import React from "react";
import { useGetProject, useListTasks, getGetProjectQueryKey, getListTasksQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatFCFA, formatDate } from "@/lib/format";
import {
  ArrowLeft, ExternalLink, FileText, Sparkles, GanttChartSquare,
  CheckCircle2, AlertTriangle, Clock, CircleDot,
} from "lucide-react";
import ProjectIntelligenceTab from "./ProjectIntelligenceTab";
import GanttView from "./GanttView";

// ── RAG ───────────────────────────────────────────────────────────────────────

type RAGStatus = "on_track" | "at_risk" | "off_track" | "completed" | "pending" | "unknown";

function computeRAG(project: any): RAGStatus {
  if (project.status === "completed") return "completed";
  if (project.status === "cancelled") return "off_track";
  if (project.status === "planning" || !project.startDate) return "pending";
  const today = new Date();
  const start = new Date(project.startDate);
  const end = project.endDate ? new Date(project.endDate) : null;
  const progress = project.progress || 0;
  if (end && today > end && progress < 100) return "off_track";
  if (end) {
    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = today.getTime() - start.getTime();
    if (totalMs > 0) {
      const expectedProgress = Math.min(100, (elapsedMs / totalMs) * 100);
      const gap = expectedProgress - progress;
      if (gap > 20) return "off_track";
      if (gap > 8) return "at_risk";
    }
  }
  return "on_track";
}

const RAG_CONFIG: Record<RAGStatus, { label: string; icon: React.ReactNode; cls: string; description: string }> = {
  on_track:  { label: "En bonne voie", icon: <CheckCircle2 className="w-4 h-4" />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200", description: "L'avancement est conforme aux prévisions." },
  at_risk:   { label: "À risque",      icon: <AlertTriangle className="w-4 h-4" />, cls: "bg-amber-50 text-amber-700 border-amber-200",   description: "L'avancement accuse un léger retard sur le calendrier." },
  off_track: { label: "En retard",     icon: <AlertTriangle className="w-4 h-4" />, cls: "bg-red-50 text-red-700 border-red-200",          description: "Le projet est significativement en retard ou la date limite est dépassée." },
  completed: { label: "Terminé",       icon: <CheckCircle2 className="w-4 h-4" />, cls: "bg-slate-100 text-slate-600 border-slate-200",   description: "Ce projet est marqué comme terminé." },
  pending:   { label: "En attente",    icon: <Clock className="w-4 h-4" />,         cls: "bg-blue-50 text-blue-700 border-blue-200",       description: "Ce projet n'a pas encore démarré ou manque de dates." },
  unknown:   { label: "Inconnu",       icon: <CircleDot className="w-4 h-4" />,     cls: "bg-slate-50 text-slate-500 border-slate-200",    description: "Statut indéterminé." },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  planning:    { label: "En planification", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "En cours",         cls: "bg-amber-50 text-amber-700 border-amber-200" },
  on_hold:     { label: "En pause",         cls: "bg-muted text-muted-foreground border-border" },
  completed:   { label: "Terminé",          cls: "bg-green-50 text-green-700 border-green-200" },
  cancelled:   { label: "Annulé",           cls: "bg-red-50 text-red-700 border-red-200" },
  active:      { label: "En cours",         cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const PHASE_LABEL: Record<string, string> = {
  pending: "À démarrer", in_progress: "En cours", completed: "Terminée", on_hold: "En pause",
};

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = params?.id || "";

  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) },
  });

  const { data: tasksData } = useListTasks(undefined, {
    query: { enabled: !!id, queryKey: getListTasksQueryKey() },
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Chargement de la fiche projet…</div>;
  }
  if (!project) {
    return <div className="p-8 text-center text-muted-foreground">Projet introuvable</div>;
  }

  const status = STATUS_LABEL[project.status] || { label: project.status, cls: "" };
  const rag = computeRAG(project);
  const ragCfg = RAG_CONFIG[rag];
  const projectTasks = (tasksData?.data || []).filter((t: any) => t.projectId === id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-6 flex-wrap">
        <div>
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Retour aux projets
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1">
            Client : <span className="font-medium text-foreground">{project.clientName || "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`px-3 py-1.5 text-sm font-semibold flex items-center gap-1.5 ${ragCfg.cls}`}>
                {ragCfg.icon}
                {ragCfg.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {ragCfg.description}
            </TooltipContent>
          </Tooltip>
          <Badge variant="outline" className={`px-3 py-1.5 text-sm font-semibold ${status.cls}`}>
            {status.label}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-10">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <GanttChartSquare className="w-3.5 h-3.5" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Intelligence
          </TabsTrigger>
        </TabsList>

        {/* ── Timeline Tab ───────────────────────────────────────────────── */}
        <TabsContent value="timeline">
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <GanttChartSquare className="w-5 h-5 text-primary" />
                  Timeline du projet
                </CardTitle>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {project.startDate && (
                    <span>Début : <span className="font-medium text-foreground">{formatDate(project.startDate)}</span></span>
                  )}
                  {project.endDate && (
                    <span>Fin prévue : <span className="font-medium text-foreground">{formatDate(project.endDate)}</span></span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <GanttView project={project} tasks={projectTasks} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Intelligence Tab ────────────────────────────────────────────── */}
        <TabsContent value="intelligence">
          <ProjectIntelligenceTab projectId={id} />
        </TabsContent>

        {/* ── Overview Tab ────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">

          {/* RAG detail banner */}
          {(rag === "at_risk" || rag === "off_track") && (
            <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${ragCfg.cls}`}>
              {ragCfg.icon}
              <div>
                <span className="font-semibold text-sm">{ragCfg.label}</span>
                <span className="text-sm ml-2">{ragCfg.description}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="col-span-1 md:col-span-2">
              <CardHeader><CardTitle>Vue d'ensemble</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span className="font-semibold">Avancement global</span>
                    <span className="text-muted-foreground font-medium">{project.progress || 0}%</span>
                  </div>
                  <Progress value={project.progress || 0} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Responsable</div>
                    <div className="font-medium">{project.managerName || "Non assigné"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Budget alloué</div>
                    <div className="font-semibold text-primary">{formatFCFA(Number(project.budget) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Date de démarrage</div>
                    <div className="font-medium">{formatDate(project.startDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Date de livraison</div>
                    <div className="font-medium">{formatDate(project.endDate)}</div>
                  </div>
                </div>
                {project.description && (
                  <div className="pt-4 border-t border-border">
                    <h3 className="font-semibold mb-2">Description du projet</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader><CardTitle>Phases du projet</CardTitle></CardHeader>
              <CardContent>
                {project.phases && project.phases.length > 0 ? (
                  <div className="space-y-3">
                    {project.phases.map((phase: any, i: number) => {
                      const phaseStatus = phase.status;
                      const phaseCls =
                        phaseStatus === "completed" ? "bg-emerald-500" :
                        phaseStatus === "in_progress" ? "bg-primary" :
                        phaseStatus === "on_hold" ? "bg-amber-400" :
                        "bg-slate-300";
                      return (
                        <div key={phase.id} className="flex items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-500 shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{phase.name}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`inline-block w-2 h-2 rounded-full ${phaseCls}`} />
                              <span className="text-[11px] text-muted-foreground">
                                {PHASE_LABEL[phase.status] || phase.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-6">Aucune phase définie</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tasks summary */}
          {projectTasks.length > 0 && (
            <Card className="shadow-sm border-border">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Tâches du projet ({projectTasks.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "todo", label: "À faire", cls: "text-slate-600 bg-slate-50" },
                    { key: "in_progress", label: "En cours", cls: "text-primary bg-primary/5" },
                    { key: "review", label: "En revue", cls: "text-blue-700 bg-blue-50" },
                    { key: "done", label: "Terminées", cls: "text-emerald-700 bg-emerald-50" },
                  ].map(col => {
                    const count = projectTasks.filter((t: any) => t.status === col.key).length;
                    return (
                      <div key={col.key} className={`rounded-lg p-3 text-center ${col.cls}`}>
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs font-medium mt-0.5">{col.label}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Documents du projet
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {(project as any).documentLinks && (project as any).documentLinks.length > 0 ? (
                <ul className="space-y-2">
                  {(project as any).documentLinks.map((doc: any, i: number) => (
                    <li key={i} className="flex items-center justify-between border border-border rounded-md p-3 hover:bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 text-primary rounded flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{doc.label || "Document"}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.url}</div>
                        </div>
                      </div>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs font-semibold flex items-center gap-1">
                        Ouvrir <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Aucun document lié — collez ici des liens Drive, Dropbox ou OneDrive depuis l'édition du projet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
