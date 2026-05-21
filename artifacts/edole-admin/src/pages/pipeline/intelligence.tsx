/**
 * Phase 15 — Pipeline IA.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, AlertTriangle, Target, Flame } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

const KPI = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1">{label}</p><p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p></CardContent></Card>
);

const priorityColor = (p: string) =>
  p === "urgent" ? "bg-red-50 text-red-700 border-red-200" :
  p === "high" ? "bg-amber-50 text-amber-700 border-amber-200" :
  p === "medium" ? "bg-blue-50 text-blue-700 border-blue-200" :
  "bg-slate-50 text-slate-700 border-slate-200";

export default function PipelineIntelligence() {
  const ov = useQuery<any>({ queryKey: ["pip-ov"], queryFn: () => apiFetch("/api/pipeline/intelligence/overview") });
  const fc = useQuery<any>({ queryKey: ["pip-fc"], queryFn: () => apiFetch("/api/pipeline/intelligence/forecast") });
  const ar = useQuery<any>({ queryKey: ["pip-ar"], queryFn: () => apiFetch("/api/pipeline/intelligence/at-risk") });
  const na = useQuery<any>({ queryKey: ["pip-na"], queryFn: () => apiFetch("/api/pipeline/intelligence/next-actions") });

  if (ov.isLoading || !ov.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const o = ov.data;

  return (
    <div className="space-y-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2"><TrendingUp className="w-3 h-3" />Pipeline IA</p><h1 className="text-3xl font-bold tracking-tight">Intelligence commerciale</h1></div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <KPI label="Opps ouvertes" value={o.totalOpen} />
        <KPI label="Valeur totale" value={formatFCFA(o.totalValue)} />
        <KPI label="Valeur pondérée" value={formatFCFA(o.weightedValue)} accent="text-primary" />
        <KPI label="Opps chaudes" value={o.hotOpps} accent="text-red-600" />
        <KPI label="Clôture < 30j" value={o.closingSoon} accent="text-amber-600" />
      </div>

      <Tabs defaultValue="forecast">
        <TabsList><TabsTrigger value="forecast">Prévision</TabsTrigger><TabsTrigger value="risk">À risque</TabsTrigger><TabsTrigger value="actions">Actions à venir</TabsTrigger><TabsTrigger value="stages">Par stade</TabsTrigger></TabsList>

        <TabsContent value="forecast" className="space-y-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Forecast 6 mois (FCFA)</CardTitle></CardHeader>
            <CardContent className="h-72">
              {fc.data?.months && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fc.data.months}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" /><YAxis tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "M"} /><Tooltip formatter={(v: any) => formatFCFA(Number(v))} /><Legend />
                    <Bar dataKey="expected" fill="#94a3b8" name="Attendu" />
                    <Bar dataKey="weighted" fill="#F37021" name="Pondéré" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-2">
          {ar.data?.rows?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground italic">Aucune opportunité à risque détectée.</CardContent></Card>}
          {ar.data?.rows?.map((r: any) => (
            <Card key={r.id}><CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1"><p className="text-sm font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.reasons.join(" · ")}</p></div>
              <Badge variant="outline">{r.stage}</Badge>
              <span className="text-sm">{formatFCFA(r.value)}</span>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" />{r.riskScore}</Badge>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="actions" className="space-y-2">
          {na.data?.actions?.map((a: any) => (
            <Card key={a.id}><CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex-1"><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.nextAction}{a.daysSinceLastActivity !== null && ` · ${a.daysSinceLastActivity}j sans activité`}</p></div>
              <Badge variant="outline">{a.stage}</Badge>
              <span className="text-sm">{formatFCFA(a.value)}</span>
              <Badge variant="outline" className={priorityColor(a.priority)}>{a.priority}</Badge>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="stages" className="space-y-2">
          {Object.entries(o.byStage ?? {}).map(([k, v]: any) => (
            <Card key={k}><CardContent className="p-3 flex items-center justify-between"><span className="text-sm font-medium capitalize">{k}</span><span className="text-xs text-muted-foreground">{v.count} opp(s)</span><span className="text-sm">{formatFCFA(v.value)}</span></CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
