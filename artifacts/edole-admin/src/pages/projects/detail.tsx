import React from "react";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatFCFA, formatDate } from "@/lib/format";
import { ExternalLink, FileText, Sparkles } from "lucide-react";
import ProjectIntelligenceTab from "./ProjectIntelligenceTab";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  planning: { label: "En planification", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "En cours", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  on_hold: { label: "En pause", cls: "bg-muted text-muted-foreground border-border" },
  completed: { label: "Terminé", cls: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Annulé", cls: "bg-red-50 text-red-700 border-red-200" },
};

const PHASE_LABEL: Record<string, string> = {
  pending: "À démarrer",
  in_progress: "En cours",
  completed: "Terminée",
  on_hold: "En pause",
};

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = params?.id || "";

  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) },
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Chargement de la fiche projet…</div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-muted-foreground">Projet introuvable</div>;
  }

  const status = STATUS_LABEL[project.status] || { label: project.status, cls: "" };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Projet</p>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1">Client : <span className="font-medium text-foreground">{project.clientName || "—"}</span></p>
        </div>
        <Badge variant="outline" className={`px-3 py-1.5 text-sm font-semibold ${status.cls}`}>{status.label}</Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" />Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="intelligence">
          <ProjectIntelligenceTab projectId={id} />
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Vue d'ensemble</CardTitle>
          </CardHeader>
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
          <CardHeader>
            <CardTitle>Phases du projet</CardTitle>
          </CardHeader>
          <CardContent>
            {project.phases && project.phases.length > 0 ? (
              <div className="space-y-3">
                {project.phases.map((phase: any) => (
                  <div key={phase.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">{phase.name}</div>
                      <Badge variant="secondary" className="mt-1.5 text-[10px] uppercase tracking-wider">
                        {PHASE_LABEL[phase.status] || phase.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">Aucune phase définie</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Documents du projet</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          {(project as any).documentLinks && (project as any).documentLinks.length > 0 ? (
            <ul className="space-y-2">
              {(project as any).documentLinks.map((doc: any, i: number) => (
                <li key={i} className="flex items-center justify-between border border-border rounded-md p-3 hover:bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 text-primary rounded flex items-center justify-center"><FileText className="w-4 h-4" /></div>
                    <div>
                      <div className="font-medium text-sm">{doc.label || "Document"}</div>
                      <div className="text-xs text-muted-foreground">{doc.url}</div>
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
