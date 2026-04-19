import React from "react";
import { useGetTask, getGetTaskQueryKey } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  todo: { label: "À faire", cls: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "En cours", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  in_review: { label: "En revue", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  done: { label: "Terminée", cls: "bg-green-50 text-green-700 border-green-200" },
  blocked: { label: "Bloquée", cls: "bg-red-50 text-red-700 border-red-200" },
};

const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  low: { label: "Faible", cls: "bg-muted text-muted-foreground" },
  medium: { label: "Moyenne", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  high: { label: "Haute", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  critical: { label: "Critique", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function TaskDetail() {
  const [, params] = useRoute("/tasks/:id");
  const id = params?.id || "";

  const { data: task, isLoading } = useGetTask(id, {
    query: { enabled: !!id, queryKey: getGetTaskQueryKey(id) },
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Chargement de la tâche…</div>;
  }

  if (!task) {
    return <div className="p-8 text-center text-muted-foreground">Tâche introuvable</div>;
  }

  const status = STATUS_LABEL[task.status] || { label: task.status, cls: "" };
  const priority = PRIORITY_LABEL[task.priority] || { label: task.priority, cls: "" };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Tâche</p>
          <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
          <p className="text-muted-foreground mt-1">Chantier : <span className="font-medium text-foreground">{task.projectName || "—"}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`px-3 py-1.5 text-sm ${priority.cls}`}>Priorité : {priority.label}</Badge>
          <Badge variant="outline" className={`px-3 py-1.5 text-sm font-semibold ${status.cls}`}>{status.label}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {task.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-border">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Affectée à</div>
                <div className="font-medium">{task.assigneeName || "Non assignée"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Échéance</div>
                <div className="font-medium">{formatDate(task.dueDate)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Créée le</div>
                <div className="font-medium">{formatDate(task.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Dernière mise à jour</div>
                <div className="font-medium">{formatDate(task.updatedAt)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Échanges</CardTitle>
          </CardHeader>
          <CardContent>
            {task.comments && task.comments.length > 0 ? (
              <div className="space-y-3">
                {task.comments.map((comment: any) => (
                  <div key={comment.id} className="bg-muted/60 p-3 rounded-md text-sm border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{comment.userName || "Utilisateur"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-foreground/80 leading-relaxed">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">Aucun commentaire pour le moment</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
