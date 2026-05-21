import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertTriangle, Lightbulb, ShieldAlert, CheckCircle2, X, Pin, BookOpen, RefreshCw, Brain } from "lucide-react";
import {
  useIntelligenceOverview,
  useInsights,
  useRecommendations,
  useRiskFlags,
  useSummaries,
  useGenerateSummary,
  useUpdateInsight,
  useApplyRecommendation,
  useDismissRecommendation,
  useResolveRiskFlag,
  severityColor,
  priorityColor,
  severityLabel,
  priorityLabel,
  insightKindLabel,
  insightScopeLabel,
  categoryLabel,
} from "@/lib/intelligence";

function timeAgoFr(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export default function IntelligenceCenter() {
  const { data: overview, isLoading: loadingOv } = useIntelligenceOverview();
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Brain className="w-7 h-7 text-primary" /> Centre d'intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Insights, recommandations, risques détectés et résumés exécutifs générés par Gaméasù.
          </p>
        </div>
        <Badge variant="outline" className={overview?.aiAvailable ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}>
          <Sparkles className="w-3.5 h-3.5 mr-1" /> IA {overview?.aiAvailable ? "activée" : "en mode heuristique"}
        </Badge>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Lightbulb} label="Insights ouverts" value={overview?.counts.insightsOpen} tone="sky" loading={loadingOv} />
        <KpiCard icon={Sparkles} label="Recommandations" value={overview?.counts.recommendationsOpen} tone="amber" loading={loadingOv} />
        <KpiCard icon={AlertTriangle} label="Risques ouverts" value={overview?.counts.risksOpen} tone="orange" loading={loadingOv} />
        <KpiCard icon={ShieldAlert} label="Risques critiques" value={overview?.counts.risksCritical} tone="red" loading={loadingOv} />
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Recommandations</TabsTrigger>
          <TabsTrigger value="risks">Risques</TabsTrigger>
          <TabsTrigger value="summaries">Résumés exécutifs</TabsTrigger>
        </TabsList>

        <TabsContent value="insights"><InsightsTab /></TabsContent>
        <TabsContent value="recommendations"><RecommendationsTab /></TabsContent>
        <TabsContent value="risks"><RisksTab /></TabsContent>
        <TabsContent value="summaries"><SummariesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, loading }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: number; tone: "sky" | "amber" | "orange" | "red"; loading?: boolean }) {
  const tones: Record<string, string> = {
    sky: "from-sky-500/10 to-transparent text-sky-600 border-sky-200/50",
    amber: "from-amber-500/10 to-transparent text-amber-600 border-amber-200/50",
    orange: "from-orange-500/10 to-transparent text-orange-600 border-orange-200/50",
    red: "from-red-500/10 to-transparent text-red-600 border-red-200/50",
  };
  return (
    <Card className={`bg-gradient-to-br ${tones[tone]} border`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
            {loading ? <Skeleton className="h-9 w-16 mt-2" /> : <p className="text-3xl font-bold mt-1">{value ?? 0}</p>}
          </div>
          <Icon className="w-6 h-6 opacity-70" />
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsTab() {
  const { data, isLoading } = useInsights();
  const update = useUpdateInsight();
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data?.length) return <EmptyState icon={Lightbulb} title="Aucun insight" body="Les signaux faibles et anomalies détectés apparaîtront ici." />;
  return (
    <div className="grid gap-3">
      {data.map((it) => (
        <Card key={it.id} className={!it.isRead ? "border-l-4 border-l-primary" : ""}>
          <CardContent className="p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold">{it.title}</h3>
                <Badge variant="outline" className={severityColor(it.severity)}>{severityLabel(it.severity || "info")}</Badge>
                <Badge variant="outline" className="text-xs">{insightKindLabel(it.kind)}</Badge>
                <Badge variant="outline" className="text-xs">{insightScopeLabel(it.scope)}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">{timeAgoFr(it.createdAt)}</span>
              </div>
              {it.body && <p className="text-sm text-muted-foreground">{it.body}</p>}
              {it.actionUrl && it.actionLabel && (
                <a href={it.actionUrl} className="inline-block mt-2 text-sm text-primary hover:underline">{it.actionLabel} →</a>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {!it.isRead && (
                <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: it.id, patch: { isRead: true } })}><CheckCircle2 className="w-4 h-4" /></Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: it.id, patch: { isPinned: !it.isPinned } })}><Pin className={`w-4 h-4 ${it.isPinned ? "fill-current" : ""}`} /></Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: it.id, patch: { isDismissed: true } })}><X className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecommendationsTab() {
  const { data, isLoading } = useRecommendations();
  const apply = useApplyRecommendation();
  const dismiss = useDismissRecommendation();
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data?.length) return <EmptyState icon={Sparkles} title="Aucune recommandation active" body="Les prochaines meilleures actions suggérées par Gaméasù apparaîtront ici." />;
  return (
    <div className="grid gap-3">
      {data.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold">{r.title}</h3>
                <Badge variant="outline" className={priorityColor(r.priority)}>{priorityLabel(r.priority)}</Badge>
                <Badge variant="outline" className="text-xs">{r.entityType}</Badge>
                {r.impact && <Badge variant="outline" className="text-xs">impact : {r.impact}</Badge>}
                <span className="text-xs text-muted-foreground ml-auto">{timeAgoFr(r.createdAt)}</span>
              </div>
              {r.reason && <p className="text-sm text-muted-foreground">{r.reason}</p>}
              {r.ctaUrl && r.ctaLabel && (
                <a href={r.ctaUrl} className="inline-block mt-2 text-sm text-primary hover:underline">{r.ctaLabel} →</a>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => apply.mutate(r.id)}><CheckCircle2 className="w-4 h-4 mr-1" /> Appliquer</Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(r.id)}><X className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RisksTab() {
  const { data, isLoading } = useRiskFlags();
  const resolve = useResolveRiskFlag();
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data?.length) return <EmptyState icon={ShieldAlert} title="Aucun risque ouvert" body="Excellente nouvelle — aucun risque actif détecté pour le moment." />;
  return (
    <div className="grid gap-3">
      {data.map((r) => (
        <Card key={r.id} className={r.severity === "critical" ? "border-l-4 border-l-red-500" : r.severity === "high" ? "border-l-4 border-l-orange-500" : ""}>
          <CardContent className="p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold">{r.title}</h3>
                <Badge variant="outline" className={severityColor(r.severity)}>{severityLabel(r.severity)}</Badge>
                <Badge variant="outline" className="text-xs">{categoryLabel(r.category)}</Badge>
                <Badge variant="outline" className="text-xs">{r.entityType}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">{timeAgoFr(r.detectedAt)}</span>
              </div>
              {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: r.id })}><CheckCircle2 className="w-4 h-4 mr-1" /> Résoudre</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SummariesTab() {
  const { data, isLoading } = useSummaries({ scope: "workspace" });
  const gen = useGenerateSummary();
  const [context, setContext] = useState("");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" /> Générer un résumé exécutif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full min-h-[120px] p-3 rounded-md border border-input bg-background text-sm"
            placeholder="Collez ici le contexte à résumer (KPI, chiffres, état projet, échanges récents…)"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              disabled={!context.trim() || gen.isPending}
              onClick={() => gen.mutate({ scope: "workspace", period: "adhoc", context }, { onSuccess: () => setContext("") })}
            >
              {gen.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Générer
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <Skeleton className="h-40 w-full" /> :
        !data?.length ? <EmptyState icon={BookOpen} title="Aucun résumé" body="Générez votre premier résumé exécutif ci-dessus." /> :
        <div className="grid gap-3">
          {data.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span>{s.title || "Résumé exécutif"}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{s.period}</Badge>
                    <Badge variant="outline" className={s.generatedBy === "ai" ? "text-emerald-600 border-emerald-500/30 text-xs" : "text-xs"}>{s.generatedBy === "ai" ? "IA" : "heuristique"}</Badge>
                    <span className="text-xs text-muted-foreground">{timeAgoFr(s.createdAt)}</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.content}</p>
                {s.nextActions && s.nextActions.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Prochaines actions</p>
                    <ul className="space-y-1">
                      {s.nextActions.map((a, i) => (
                        <li key={i} className="text-sm flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      }
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{body}</p>
      </CardContent>
    </Card>
  );
}
