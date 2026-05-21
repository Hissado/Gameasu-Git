/**
 * Phase 7 — Onglet « Intelligence » sur la fiche projet.
 * Score santé + facteurs, schedule vs réel, stats tâches, risques/recos/insights, résumé IA.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatFCFA } from "@/lib/format";
import { severityLabel } from "@/lib/intelligence";
import {
  Loader2, AlertTriangle, AlertCircle, Lightbulb, Target,
  Sparkles, Clock, TrendingUp, CheckCircle2, Hourglass,
} from "lucide-react";

type Factor = { key: string; label: string; weight: number; value: number; reason?: string };
type Score = { id: string; value: number; tier: string; factors: Factor[]; computedBy: string };
type Risk = { id: string; severity: string; category: string; title: string; description?: string; isResolved: boolean };
type Reco = { id: string; title: string; description?: string; impactCategory: string; impactScore?: number; ctaLabel?: string; ctaUrl?: string };
type Insight = { id: string; title: string; body?: string; severity?: string };

type Response360 = {
  project: { id: string; name: string; status: string; progress: number | null };
  score: Score;
  risks: Risk[]; recommendations: Reco[]; insights: Insight[];
  summary: { content: string; createdAt: string; provider: string } | null;
  summaryHeuristic: string;
  schedule: { status: "on_track" | "at_risk" | "delayed" | "unknown"; actualProgress: number; expectedProgress: number; startDate?: string | null; endDate?: string | null };
  taskStats: { total: number; active: number; done: number; inProgress: number; todo: number; blocked: number; overdue: number; dueSoon: number; completionRate: number; velocityPerWeek: number; recentlyDone: number };
  budget: { allocated: number };
};

const TIER: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  excellent: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", label: "Excellent" },
  high:      { dot: "bg-green-500",   text: "text-green-700",   bg: "bg-green-50 border-green-200",     label: "Bon" },
  medium:    { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     label: "À surveiller" },
  low:       { dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   label: "Faible" },
  critical:  { dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50 border-red-200",         label: "Critique" },
};
const SEVERITY: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
};
const SCHEDULE_BADGE: Record<string, { cls: string; label: string }> = {
  on_track: { cls: "bg-green-50 text-green-700 border-green-200", label: "Dans les temps" },
  at_risk: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "À surveiller" },
  delayed: { cls: "bg-red-50 text-red-700 border-red-200", label: "En retard" },
  unknown: { cls: "bg-muted text-muted-foreground border-border", label: "Dates manquantes" },
};

export default function ProjectIntelligenceTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<Response360>({
    queryKey: ["project-intelligence", projectId],
    queryFn: () => apiFetch(`/api/projects/${projectId}/intelligence`),
    enabled: !!projectId,
  });

  const resolveRisk = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/intelligence/risks/${id}/resolve`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-intelligence", projectId] }),
  });
  const applyReco = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/intelligence/recommendations/${id}/apply`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-intelligence", projectId] }),
  });
  const dismissReco = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/intelligence/recommendations/${id}/dismiss`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-intelligence", projectId] }),
  });

  if (isLoading) return <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>;
  if (isError || !data) return (
    <Card><CardContent className="py-10 text-center text-muted-foreground space-y-1">
      <AlertTriangle className="w-7 h-7 mx-auto text-amber-500" />
      <p className="text-sm font-medium">Impossible de charger l'intelligence projet.</p>
      <p className="text-xs">{(error as Error | undefined)?.message ?? "Réessayez."}</p>
    </CardContent></Card>
  );

  const tier = TIER[data.score.tier] ?? TIER.medium;
  const sched = SCHEDULE_BADGE[data.schedule.status];
  const gap = data.schedule.actualProgress - data.schedule.expectedProgress;

  return (
    <div className="space-y-4">
      {/* Synthèse + score */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Synthèse intelligente</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm leading-relaxed">{data.summary?.content ?? data.summaryHeuristic}</p>
            <p className="text-[11px] text-muted-foreground">{data.summary ? `IA · ${data.summary.provider} · ${new Date(data.summary.createdAt).toLocaleString("fr-FR")}` : "Synthèse heuristique"}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline" className={sched.cls}><Clock className="w-3 h-3 mr-1" />{sched.label}</Badge>
              {data.schedule.expectedProgress > 0 && (
                <Badge variant="outline" className="bg-muted/50">
                  Réel {data.schedule.actualProgress}% / attendu {data.schedule.expectedProgress}% ({gap >= 0 ? "+" : ""}{gap} pts)
                </Badge>
              )}
              <Badge variant="outline" className="bg-muted/50">Vélocité {data.taskStats.velocityPerWeek}/sem</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${tier.bg}`}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Score santé projet</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2"><span className={`text-4xl font-bold ${tier.text}`}>{data.score.value}</span><span className="text-sm text-muted-foreground">/100</span></div>
            <Badge variant="outline" className={`${tier.bg} ${tier.text} mt-1`}><span className={`w-1.5 h-1.5 rounded-full ${tier.dot} mr-1.5`} />{tier.label}</Badge>
            <div className="mt-3 space-y-2">
              {data.score.factors.map((f) => (
                <div key={f.key} className="text-xs">
                  <div className="flex justify-between"><span className="font-medium">{f.label}</span><span className="text-muted-foreground">{f.value}/100 · ×{f.weight}%</span></div>
                  <Progress value={f.value} className="h-1 mt-0.5" />
                  {f.reason && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{f.reason}</p>}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Calculé · {data.score.computedBy}</p>
          </CardContent>
        </Card>
      </div>

      {/* KPI tâches */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Tâches actives", value: data.taskStats.active, icon: Target, cls: "" },
          { label: "Terminées", value: `${data.taskStats.done} (${data.taskStats.completionRate}%)`, icon: CheckCircle2, cls: "text-green-700" },
          { label: "En retard", value: data.taskStats.overdue, icon: AlertCircle, cls: data.taskStats.overdue > 0 ? "text-red-700" : "" },
          { label: "Échéance proche", value: data.taskStats.dueSoon, icon: Hourglass, cls: data.taskStats.dueSoon > 0 ? "text-amber-700" : "" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <k.icon className={`w-5 h-5 ${k.cls || "text-muted-foreground"}`} />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">{k.label}</p>
                <p className={`text-xl font-bold ${k.cls}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risques + recommandations */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-600" />Risques ouverts ({data.risks.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.risks.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun risque détecté.</p>}
            {data.risks.map((r) => (
              <div key={r.id} className="border rounded p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <Badge variant="outline" className={SEVERITY[r.severity] ?? ""}>{severityLabel(r.severity)}</Badge>
                    <p className="text-sm font-medium">{r.title}</p>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                  <Button size="sm" variant="ghost" disabled={resolveRisk.isPending} onClick={() => resolveRisk.mutate(r.id)}>Résoudre</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-primary" />Recommandations ({data.recommendations.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.recommendations.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune recommandation active.</p>}
            {data.recommendations.map((r) => (
              <div key={r.id} className="border rounded p-3 space-y-1">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    <Badge variant="outline" className="mt-1 text-[10px]">{r.impactCategory}{r.impactScore ? ` · impact ${r.impactScore}` : ""}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" disabled={applyReco.isPending} onClick={() => applyReco.mutate(r.id)}>Appliquer</Button>
                    <Button size="sm" variant="ghost" disabled={dismissReco.isPending} onClick={() => dismissReco.mutate(r.id)}>Ignorer</Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Insights + budget */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Insights ({data.insights.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.insights.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun insight actif sur ce projet.</p>}
            {data.insights.map((i) => (
              <div key={i.id} className="text-sm border-l-2 border-primary pl-3">
                <p className="font-medium">{i.title}</p>
                {i.body && <p className="text-xs text-muted-foreground">{i.body}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Budget</CardTitle></CardHeader>
          <CardContent>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Alloué</p>
            <p className="text-xl font-bold text-primary">{formatFCFA(data.budget.allocated)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
