/**
 * Phase 21 — Org tuner.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Gauge, ArrowRight } from "lucide-react";
import { severityLabel } from "@/lib/intelligence";

const KPI = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1">{label}</p><p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p></CardContent></Card>
);

const sevColor = (s: string) =>
  s === "high" ? "bg-red-50 text-red-700 border-red-200" :
  s === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
  "bg-slate-50 text-slate-700 border-slate-200";

export default function OrgTuner() {
  const q = useQuery<any>({ queryKey: ["org-tuner"], queryFn: () => apiFetch("/api/org-tuner/audit") });
  if (q.isLoading || !q.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  if (q.error) return <Card><CardContent className="p-8 text-center text-muted-foreground">Accès réservé aux administrateurs de l'organisation.</CardContent></Card>;
  const d = q.data;

  return (
    <div className="space-y-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2"><Gauge className="w-3 h-3" />Org tuner</p><h1 className="text-3xl font-bold tracking-tight">Audit de configuration</h1><p className="text-sm text-muted-foreground mt-1">{d.organization.name}{d.organization.industry && ` · ${d.organization.industry}`}{d.organization.country && ` · ${d.organization.country}`}</p></div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <KPI label="Plan actif" value={d.subscription?.planCode ?? "—"} />
        <KPI label="Sièges utilisés" value={`${d.subscription?.used ?? 0} / ${d.subscription?.seats ?? 0}`} accent={d.subscription && d.subscription.used > d.subscription.seats ? "text-red-600" : ""} />
        <KPI label="Modules actifs" value={`${d.enabledModulesCount} / ${d.totalModulesCount}`} />
        <KPI label="Recommandations" value={d.recommendations.length} accent={d.counts.high > 0 ? "text-red-600" : "text-amber-600"} />
        <KPI label="Critique" value={d.counts.high} accent="text-red-600" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Volumétrie 90 j</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {Object.entries(d.usage).map(([k, v]: any) => (
              <div key={k} className="border rounded-md p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                <p className="text-lg font-bold">{v}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recommandations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {d.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucune recommandation. Configuration optimale.</p>
          ) : d.recommendations.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.detail}</p>
              </div>
              <Badge variant="outline" className={`${sevColor(r.severity)} text-[10px] shrink-0`}>{severityLabel(r.severity)}</Badge>
              {r.cta && <Link href={r.cta}><Button size="sm" variant="ghost" className="shrink-0">Action <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
