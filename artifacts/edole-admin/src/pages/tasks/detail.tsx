import React from "react";
import { useGetTask, getGetTaskQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { History, ListTree, MessageSquare } from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  todo: { label: "À faire", cls: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "En cours", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  review: { label: "En revue", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  done: { label: "Terminée", cls: "bg-green-50 text-green-700 border-green-200" },
  blocked: { label: "Bloquée", cls: "bg-red-50 text-red-700 border-red-200" },
};

const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  low: { label: "Faible", cls: "bg-muted text-muted-foreground" },
  medium: { label: "Moyenne", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  high: { label: "Haute", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  urgent: { label: "Urgente", cls: "bg-red-50 text-red-700 border-red-200" },
};

const ACTION_LABEL: Record<string, string> = {
  created: "Création",
  updated: "Mise à jour",
  deleted: "Suppression",
  commented: "Commentaire",
};

const FIELD_LABEL: Record<string, string> = {
  status: "Statut",
  priority: "Priorité",
  assigneeId: "Affectation",
  title: "Intitulé",
  description: "Description",
  dueDate: "Échéance",
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
  const subtasks = (task as any).subtasks || [];
  const history = (task as any).history || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Tâche</p>
          <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
          <p className="text-muted-foreground mt-1">Projet : <span className="font-medium text-foreground">{task.projectName || "—"}</span></p>
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
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">Achevée le</div>
                <div className="font-medium">{task.completedAt ? formatDate(task.completedAt) : "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Échanges</CardTitle>
          </CardHeader>
          <CardContent>
            {task.comments && task.comments.length > 0 ? (
              <div className="space-y-3">
                {task.comments.map((comment: any) => (
                  <div key={comment.id} className="bg-muted/60 p-3 rounded-md text-sm border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{comment.userName || "Utilisateur"}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListTree className="w-4 h-4" /> Sous-tâches</CardTitle>
          </CardHeader>
          <CardContent>
            {subtasks.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">Aucune sous-tâche</div>
            ) : (
              <ul className="space-y-2">
                {subtasks.map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between border border-border rounded-md p-3 hover:bg-slate-50/50">
                    <Link href={`/tasks/${s.id}`} className="font-medium text-sm hover:text-primary flex-1">
                      {s.title}
                    </Link>
                    <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[s.status]?.label || s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="w-4 h-4" /> Historique des modifications</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">Aucune modification enregistrée</div>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {history.map((h: any) => (
                  <li key={h.id} className="ml-4">
                    <div className="absolute -left-1.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                    <div className="text-xs text-muted-foreground">{formatDate(h.createdAt)} — {h.userName || "Système"}</div>
                    <div className="text-sm font-medium">
                      {ACTION_LABEL[h.action] || h.action}
                      {h.field && <span className="text-muted-foreground"> · {FIELD_LABEL[h.field] || h.field}</span>}
                    </div>
                    {(h.oldValue || h.newValue) && (
                      <div className="text-xs mt-1 text-slate-600">
                        {h.oldValue && <span className="line-through text-red-500/70 mr-2">{h.oldValue}</span>}
                        {h.newValue && <span className="text-green-600 font-medium">{h.newValue}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
