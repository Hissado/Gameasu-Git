/**
 * Phase 7 — Vue Focus : backlog priorisé par l'IA.
 * Liste classée par score (priorité × urgence × âge × statut).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Flame, ExternalLink, Calendar, User } from "lucide-react";
import { Link } from "wouter";
import { priorityLabel } from "@/lib/intelligence";

type ScoredTask = {
  id: string; title: string; status: string; priority: string | null;
  dueDate: string | null; daysUntilDue: number | null;
  projectId: string | null; projectName: string | null;
  assigneeId: string | null; assigneeName: string | null;
  score: number; tier: string;
  factors: { key: string; label: string; value: number; weight: number }[];
};

const TIER: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  critical: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Critique", dot: "bg-red-500" },
  excellent: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: "Urgent", dot: "bg-orange-500" },
  high: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Important", dot: "bg-amber-500" },
  medium: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Standard", dot: "bg-blue-500" },
  low: { bg: "bg-muted/50 border-border", text: "text-muted-foreground", label: "Faible", dot: "bg-muted-foreground" },
};
const STATUS_LABEL: Record<string, string> = { todo: "À faire", in_progress: "En cours", blocked: "Bloquée", on_hold: "En pause" };

export default function TasksFocusPage() {
  const [mineOnly, setMineOnly] = useState(false);
  const { data, isLoading, isError, error } = useQuery<{ data: ScoredTask[] }>({
    queryKey: ["tasks-priority", mineOnly],
    queryFn: () => apiFetch(`/api/tasks/priority${mineOnly ? "?mine=1" : ""}`),
  });

  const tasks = data?.data ?? [];
  const critical = tasks.filter((t) => t.tier === "critical" || t.tier === "excellent").length;
  const overdue = tasks.filter((t) => t.daysUntilDue !== null && t.daysUntilDue < 0).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Focus IA</p>
          <h1 className="text-3xl font-bold tracking-tight">Priorités du moment</h1>
          <p className="text-muted-foreground mt-1">Backlog classé par score combiné priorité × urgence × âge × statut.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={mineOnly ? "default" : "outline"} onClick={() => setMineOnly((v) => !v)}>
            <User className="w-4 h-4 mr-1.5" />{mineOnly ? "Mes tâches" : "Toutes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">À traiter</p><p className="text-2xl font-bold">{tasks.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Critiques / urgentes</p><p className="text-2xl font-bold text-red-700">{critical}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">En retard</p><p className="text-2xl font-bold text-orange-700">{overdue}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" />Classement par score</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>}
          {isError && <p className="text-sm text-red-600 py-8 text-center">Erreur : {(error as Error | undefined)?.message ?? "réessayez."}</p>}
          {!isLoading && !isError && tasks.length === 0 && <p className="text-sm text-muted-foreground italic py-8 text-center">Aucune tâche à prioriser. Bravo !</p>}
          <div className="divide-y">
            {tasks.map((t, idx) => {
              const tier = TIER[t.tier] ?? TIER.medium;
              return (
                <div key={t.id} className="p-4 flex items-start gap-4 hover:bg-muted/30">
                  <div className="text-2xl font-bold text-muted-foreground w-8 shrink-0">#{idx + 1}</div>
                  <div className={`w-16 shrink-0 rounded p-2 text-center border ${tier.bg}`}>
                    <div className={`text-2xl font-bold ${tier.text}`}>{t.score}</div>
                    <div className="text-[9px] uppercase tracking-wide font-semibold">{tier.label}</div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{t.title}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {t.projectName && <Link href={`/projets/${t.projectId}`} className="hover:text-primary inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />{t.projectName}</Link>}
                          {t.assigneeName && <span><User className="w-3 h-3 inline mr-0.5" />{t.assigneeName}</span>}
                          {t.dueDate && (
                            <span className={t.daysUntilDue !== null && t.daysUntilDue < 0 ? "text-red-700 font-medium" : ""}>
                              <Calendar className="w-3 h-3 inline mr-0.5" />
                              {new Date(t.dueDate).toLocaleDateString("fr-FR")}
                              {t.daysUntilDue !== null && (t.daysUntilDue < 0 ? ` (${-t.daysUntilDue}j de retard)` : t.daysUntilDue === 0 ? " (aujourd'hui)" : ` (${t.daysUntilDue}j)`)}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[t.status] ?? t.status}</Badge>
                          {t.priority && <Badge variant="outline" className="text-[10px]">{priorityLabel(t.priority)}</Badge>}
                        </div>
                      </div>
                      <Link href={`/tasks/${t.id}`}><Button size="sm" variant="ghost">Ouvrir</Button></Link>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {t.factors.map((f) => (
                        <div key={f.key} className="text-[10px]">
                          <div className="flex justify-between"><span className="text-muted-foreground">{f.label}</span><span className="font-mono">{f.value}</span></div>
                          <Progress value={f.value} className="h-1 mt-0.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
