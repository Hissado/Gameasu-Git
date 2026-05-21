import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Flame, TrendingUp, Target, Calendar } from "lucide-react";

type Factor = { key: string; label: string; weight: number; value: number };
type ScoredOpp = {
  id: string; title: string; clientId: string | null; clientName: string | null;
  stage: string; amount: number; probability: number; closeDate: string | null;
  score: number;
  tier: "critical" | "low" | "medium" | "high" | "excellent";
  factors: Factor[];
};

const TIER_COLORS: Record<ScoredOpp["tier"], { bg: string; text: string; label: string }> = {
  excellent: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", label: "Très chaud" },
  high:      { bg: "bg-green-500/10",   text: "text-green-700 dark:text-green-400",   label: "Chaud" },
  medium:    { bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-400",   label: "Tiède" },
  low:       { bg: "bg-orange-500/10",  text: "text-orange-700 dark:text-orange-500", label: "Froid" },
  critical:  { bg: "bg-red-500/10",     text: "text-red-700 dark:text-red-400",       label: "Risque" },
};

const STAGE_LABEL: Record<string, string> = {
  lead: "Prospect", qualified: "Qualifié", proposal: "Proposition",
  negotiation: "Négociation", contract: "Contrat",
};

export default function SalesScoringPage() {
  const { data, isLoading, isError, error } = useQuery<{ data: ScoredOpp[] }>({
    queryKey: ["sales-scoring"],
    queryFn: () => apiFetch("/api/sales/opportunities-scoring"),
  });

  const opps = data?.data ?? [];
  const totalPipeline = opps.reduce((s, o) => s + o.amount, 0);
  const hotPipeline = opps.filter((o) => o.tier === "excellent" || o.tier === "high").reduce((s, o) => s + o.amount, 0);
  const expectedRevenue = opps.reduce((s, o) => s + (o.amount * o.probability) / 100, 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Flame className="w-7 h-7 text-primary" /> Scoring commercial
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Priorisation intelligente des opportunités selon stade, montant, urgence et probabilité.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi icon={Target} label="Opportunités actives" value={opps.length} />
        <Kpi icon={TrendingUp} label="Pipeline total" value={formatFCFA(totalPipeline)} />
        <Kpi icon={Flame} label="Pipeline « chaud »" value={formatFCFA(hotPipeline)} accent="text-emerald-600 dark:text-emerald-400" />
        <Kpi icon={Calendar} label="Revenu pondéré attendu" value={formatFCFA(expectedRevenue)} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Opportunités classées par priorité</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>}
          {isError && <p className="text-sm text-red-600 py-8 text-center">Erreur de chargement : {(error as Error | undefined)?.message ?? "réessayez."}</p>}
          {!isLoading && !isError && opps.length === 0 && <p className="text-sm text-muted-foreground italic py-8 text-center">Aucune opportunité ouverte.</p>}
          <div className="divide-y">
            {opps.map((o) => {
              const tier = TIER_COLORS[o.tier];
              return (
                <div key={o.id} className="p-3 hover:bg-muted/30">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-primary/10 shrink-0">
                      <span className="text-2xl font-bold text-primary">{o.score}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/crm`} className="font-semibold hover:underline truncate">{o.title}</Link>
                        <Badge className={`${tier.bg} ${tier.text} border-0`}>{tier.label}</Badge>
                        <Badge variant="outline" className="text-xs">{STAGE_LABEL[o.stage] ?? o.stage}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                        {o.clientName && o.clientId && (
                          <Link href={`/clients/${o.clientId}`} className="hover:text-foreground">🏢 {o.clientName}</Link>
                        )}
                        <span>💰 {formatFCFA(o.amount)}</span>
                        <span>📊 Probabilité {o.probability}%</span>
                        {o.closeDate && <span>📅 Clôture {new Date(o.closeDate).toLocaleDateString("fr-FR")}</span>}
                      </div>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                        {o.factors.map((f) => (
                          <div key={f.key}>
                            <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">{f.label}</span><span className="font-medium">{f.value}</span></div>
                            <Progress value={f.value} className="h-1 mt-0.5" />
                          </div>
                        ))}
                      </div>
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

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: string }) {
  return (
    <Card><CardContent className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className={`text-xl font-bold mt-1 ${accent ?? ""}`}>{value}</div>
    </CardContent></Card>
  );
}
