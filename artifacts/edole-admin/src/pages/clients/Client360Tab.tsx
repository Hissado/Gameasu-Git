import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { severityLabel, priorityLabel } from "@/lib/intelligence";
import {
  AlertTriangle, Lightbulb, Sparkles, TrendingUp, Activity, Receipt,
  ShoppingCart, FolderKanban, Target, Heart, CheckCircle2, X, Loader2,
} from "lucide-react";

type Factor = { key: string; label: string; weight: number; value: number; reason?: string };
type Score = { id: string; value: number; tier: "critical" | "low" | "medium" | "high" | "excellent"; factors?: Factor[] | null };
type RiskFlag = { id: string; flagType: string; severity: "low" | "medium" | "high" | "critical"; title: string; description?: string | null; detectedAt: string };
type Reco = { id: string; title: string; reason?: string | null; priority: "low" | "medium" | "high" | "urgent"; impact?: string | null; ctaLabel?: string | null; ctaUrl?: string | null; action: string };
type Insight = { id: string; title: string; description?: string | null; category?: string | null; severity?: string | null; isAcknowledged?: boolean };

type Client360 = {
  client: { id: string; name: string };
  score: Score;
  risks: RiskFlag[];
  recommendations: Reco[];
  insights: Insight[];
  summary: { content: string; createdAt: string } | null;
  summaryHeuristic: string;
  financial: {
    totalInvoiced: number; totalPaid: number; totalDue: number; totalOverdue: number;
    overdueCount: number; maxOverdueDays: number;
    invoicesCount: number; paymentsCount: number; pipelineAmount: number;
  };
  operations: {
    projectsCount: number; openTasks: number; overdueTasks: number;
    ordersCount: number; proformasCount: number; opportunitiesCount: number;
  };
  recent: {
    invoices: Array<{ id: string; invoiceNumber?: string; totalAmount: string; paidAmount: string; status: string; dueDate?: string | null }>;
    projects: Array<{ id: string; name: string; status: string }>;
    opportunities: Array<{ id: string; title: string; stage: string; value?: string | null }>;
    activities: Array<{ id: string; type: string; subject?: string | null; description?: string | null; createdAt: string }>;
  };
};

const TIER_COLORS: Record<Score["tier"], { bg: string; text: string; label: string }> = {
  excellent: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", label: "Excellent" },
  high:      { bg: "bg-green-500/10",   text: "text-green-700 dark:text-green-400",   label: "Bon" },
  medium:    { bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-400",   label: "Moyen" },
  low:       { bg: "bg-orange-500/10",  text: "text-orange-700 dark:text-orange-500", label: "Faible" },
  critical:  { bg: "bg-red-500/10",     text: "text-red-700 dark:text-red-400",       label: "Critique" },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-red-500/40 bg-red-500/5",
  high:     "border-orange-500/40 bg-orange-500/5",
  medium:   "border-amber-500/40 bg-amber-500/5",
  low:      "border-muted bg-muted/30",
};

export default function Client360Tab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, error: loadError } = useQuery<Client360>({
    queryKey: ["client-360", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/360`),
  });

  const applyReco = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/intelligence/recommendations/${id}/apply`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-360", clientId] }),
  });
  const dismissReco = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/intelligence/recommendations/${id}/dismiss`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-360", clientId] }),
  });
  const resolveRisk = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/intelligence/risks/${id}/resolve`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-360", clientId] }),
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>;
  }
  if (isError || !data) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground space-y-1">
        <AlertTriangle className="w-7 h-7 mx-auto text-amber-500" />
        <p className="text-sm font-medium">Impossible de charger la vue 360°.</p>
        <p className="text-xs">{(loadError as Error | undefined)?.message ?? "Vérifiez vos droits ou réessayez."}</p>
      </CardContent></Card>
    );
  }


  const tier = TIER_COLORS[data.score.tier];

  return (
    <div className="space-y-4">
      {/* Bandeau résumé + score */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Synthèse</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm leading-relaxed">{data.summary?.content ?? data.summaryHeuristic}</p>
            {data.summary && (
              <p className="text-xs text-muted-foreground">Résumé IA généré le {new Date(data.summary.createdAt).toLocaleDateString("fr-FR")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Heart className="w-4 h-4 text-primary" />Score santé</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{data.score.value}</span>
              <span className="text-sm text-muted-foreground">/100</span>
              <Badge className={`${tier.bg} ${tier.text} border-0 ml-auto`}>{tier.label}</Badge>
            </div>
            <Progress value={data.score.value} className="mt-3 h-2" />
            <ul className="mt-3 space-y-1.5 text-xs">
              {(data.score.factors ?? []).map((f) => (
                <li key={f.key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{f.label} <span className="opacity-60">({f.weight}%)</span></span>
                  <span className="font-medium">{f.value}/100</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* KPI financiers + opérations */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Receipt} label="CA facturé" value={formatFCFA(data.financial.totalInvoiced)} />
        <Kpi icon={TrendingUp} label="Encours total" value={formatFCFA(data.financial.totalDue)}
          accent={data.financial.totalDue > 0 ? "text-amber-600 dark:text-amber-400" : undefined} />
        <Kpi icon={AlertTriangle} label="En retard" value={formatFCFA(data.financial.totalOverdue)}
          hint={data.financial.overdueCount > 0 ? `${data.financial.overdueCount} facture(s) · max ${data.financial.maxOverdueDays} j` : "À jour"}
          accent={data.financial.totalOverdue > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"} />
        <Kpi icon={Target} label="Opportunités" value={formatFCFA(data.financial.pipelineAmount)}
          hint={`${data.operations.opportunitiesCount} opportunité(s)`} />
        <Kpi icon={FolderKanban} label="Projets" value={data.operations.projectsCount} />
        <Kpi icon={Activity} label="Tâches ouvertes" value={data.operations.openTasks}
          hint={data.operations.overdueTasks > 0 ? `${data.operations.overdueTasks} en retard` : "À jour"}
          accent={data.operations.overdueTasks > 0 ? "text-red-600 dark:text-red-400" : undefined} />
        <Kpi icon={ShoppingCart} label="Commandes" value={data.operations.ordersCount}
          hint={`${data.operations.proformasCount} proforma(s)`} />
        <Kpi icon={Receipt} label="Paiements reçus" value={data.financial.paymentsCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risques */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Risques actifs <span className="text-muted-foreground text-sm font-normal">({data.risks.length})</span></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.risks.length === 0 && <p className="text-sm text-muted-foreground italic">Aucun risque ouvert.</p>}
            {data.risks.map((r) => (
              <div key={r.id} className={`rounded-md border p-3 ${SEVERITY_COLORS[r.severity] ?? SEVERITY_COLORS.low}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium"><Badge variant="outline" className="text-[10px]">{severityLabel(r.severity)}</Badge>{r.title}</div>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => resolveRisk.mutate(r.id)} disabled={resolveRisk.isPending}>
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recommandations */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" />Actions recommandées <span className="text-muted-foreground text-sm font-normal">({data.recommendations.length})</span></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.recommendations.length === 0 && <p className="text-sm text-muted-foreground italic">Aucune recommandation en attente.</p>}
            {data.recommendations.map((r) => (
              <div key={r.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Badge variant="outline" className="text-[10px]">{priorityLabel(r.priority)}</Badge>
                      {r.title}
                    </div>
                    {r.reason && <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>}
                    {r.impact && <p className="text-xs text-primary mt-1">{r.impact}</p>}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {r.ctaUrl && r.ctaLabel && (
                    <Link href={r.ctaUrl}><Button size="sm" variant="default">{r.ctaLabel}</Button></Link>
                  )}
                  <Button size="sm" variant="outline" onClick={() => applyReco.mutate(r.id)} disabled={applyReco.isPending}>Marquer fait</Button>
                  <Button size="sm" variant="ghost" onClick={() => dismissReco.mutate(r.id)} disabled={dismissReco.isPending}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dernières factures */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Dernières factures</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.recent.invoices.length === 0 && <p className="text-sm text-muted-foreground italic">Aucune facture.</p>}
            {data.recent.invoices.map((inv) => {
              const t = parseFloat(inv.totalAmount || "0");
              const p = parseFloat(inv.paidAmount || "0");
              const remaining = Math.max(0, t - p);
              const overdue = remaining > 0 && inv.dueDate && new Date(inv.dueDate) < new Date();
              return (
                <Link key={inv.id} href={`/factures`}>
                  <div className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                    <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium flex-1 truncate">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</span>
                    <span className="text-muted-foreground text-xs">{formatFCFA(t)}</span>
                    {remaining > 0 && (
                      <Badge variant="outline" className={`text-[10px] ${overdue ? "border-red-500/50 text-red-700 dark:text-red-400" : ""}`}>
                        {overdue ? "Retard" : "Encours"}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Activités récentes */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Activités récentes</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.recent.activities.length === 0 && <p className="text-sm text-muted-foreground italic">Aucune activité enregistrée.</p>}
            {data.recent.activities.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-sm py-1.5">
                <Activity className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    <span className="truncate">{a.subject ?? a.description ?? "—"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: number | string; hint?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" />{label}</div>
        <div className={`text-lg font-bold mt-1 ${accent ?? ""}`}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}
