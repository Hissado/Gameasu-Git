import React from "react";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = params?.id || "";
  
  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) }
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading project details...</div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1">Client: {project.clientName || "—"}</p>
        </div>
        <Badge variant="outline" className="capitalize px-3 py-1 text-sm">{project.status.replace("_", " ")}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">{project.progress || 0}%</span>
              </div>
              <Progress value={project.progress || 0} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Manager</div>
                <div className="font-medium">{project.managerName || "Unassigned"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Budget</div>
                <div className="font-medium">${project.budget?.toLocaleString() || "0"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Start Date</div>
                <div className="font-medium">{project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">End Date</div>
                <div className="font-medium">{project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"}</div>
              </div>
            </div>

            {project.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{project.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Phases</CardTitle>
          </CardHeader>
          <CardContent>
            {project.phases && project.phases.length > 0 ? (
              <div className="space-y-4">
                {project.phases.map((phase) => (
                  <div key={phase.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">{phase.name}</div>
                      <Badge variant="secondary" className="mt-1 text-[10px] uppercase">{phase.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">No phases defined</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
