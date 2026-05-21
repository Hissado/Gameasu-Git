/**
 * Phase 14 — Daily Briefing exécutif.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sun, AlertTriangle, CheckSquare, Clock, FileText, Lightbulb, Sparkles, Building2, FolderKanban } from "lucide-react";
import { formatFCFA } from "@/lib/format";

type Briefing = {
  date: string;
  narrative: string;
  provider: "openai" | "heuristic";
  kpis: { clients: number; activeProjects: number; tasksDueToday: number; tasksOverdue: number; invoicesOverdue: number; outstandingFCFA: number; criticalRisks: number };
  tasksToday: Array<{ id: string; title: string; priority: string; dueDate: string | null }>;
  tasksOverdue: Array<{ id: string; title: string; priority: string; dueDate: string | null }>;
  invoicesOverdue: Array<{ id: string; ref: string; outstanding: number; daysLate: number }>;
  risks: Array<{ id: string; severity: string; title: string; category: string }>;
  recommendations: Array<{ id: string; title: string; priority: string | null }>;
  insights: Array<{ id: string; title: string }>;
};

const KPI = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: string }) => (
  <Card><CardContent className="p-4">
    <div className="flex items-center gap-2 mb-1.5"><Icon className={`w-4 h-4 ${accent ?? "text-muted-foreground"}`} /><p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">{label}</p></div>
    <p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p>
  </CardContent></Card>
);

export default function BriefingPage() {
  const q = useQuery<Briefing>({ queryKey: ["briefing-today"], queryFn: () => apiFetch("/api/briefing/today") });

  if (q.isLoading || !q.data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /></div>;
  const b = q.data;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-2"><Sun className="w-3 h-3" />Briefing du jour</p>
        <h1 className="text-3xl font-bold tracking-tight">{new Date(b.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
      </div>

      <Card className="border-orange-200 bg-gradient-to-br from-orange-50/50 to-transparent">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Synthèse exécutive
          <Badge variant="outline" className={`ml-2 text-[9px] uppercase ${b.provider === "openai" ? "bg-blue-50 text-blue-700 border-blue-200" : ""}`}>{b.provider === "openai" ? "IA" : "heuristique"}</Badge>
        </CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{b.narrative}</p></CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <KPI icon={Building2} label="Clients" value={b.kpis.clients} />
        <KPI icon={FolderKanban} label="Projets actifs" value={b.kpis.activeProjects} />
        <KPI icon={CheckSquare} label="Tâches du jour" value={b.kpis.tasksDueToday} accent={b.kpis.tasksDueToday > 0 ? "text-primary" : ""} />
        <KPI icon={Clock} label="Tâches en retard" value={b.kpis.tasksOverdue} accent={b.kpis.tasksOverdue > 0 ? "text-red-600" : ""} />
        <KPI icon={FileText} label="Factures en retard" value={b.kpis.invoicesOverdue} accent={b.kpis.invoicesOverdue > 0 ? "text-amber-600" : ""} />
        <KPI icon={FileText} label="Encours retard" value={formatFCFA(b.kpis.outstandingFCFA)} accent={b.kpis.outstandingFCFA > 0 ? "text-amber-600" : ""} />
        <KPI icon={AlertTriangle} label="Risques critiques" value={b.kpis.criticalRisks} accent={b.kpis.criticalRisks > 0 ? "text-red-600" : ""} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CheckSquare className="w-4 h-4" />Tâches du jour & retard</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {b.tasksToday.length === 0 && b.tasksOverdue.length === 0 && <p className="text-xs italic text-muted-foreground">Rien à signaler.</p>}
            {b.tasksToday.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`}>
                <div className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                  <span className="truncate flex-1">{t.title}</span>
                  <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  <Badge variant="secondary" className="text-[10px]">aujourd'hui</Badge>
                </div>
              </Link>
            ))}
            {b.tasksOverdue.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`}>
                <div className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                  <span className="truncate flex-1">{t.title}</span>
                  <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">retard {t.dueDate}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" />Factures à relancer</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {b.invoicesOverdue.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun encours en retard.</p>}
            {b.invoicesOverdue.map((i) => (
              <Link key={i.id} href={`/invoices/${i.id}`}>
                <div className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                  <span className="font-medium">{i.ref}</span>
                  <span className="text-muted-foreground">{formatFCFA(i.outstanding)}</span>
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">+{i.daysLate} j</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" />Risques ouverts</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {b.risks.length === 0 && <p className="text-xs italic text-muted-foreground">Aucun risque critique.</p>}
            {b.risks.map((r) => (
              <div key={r.id} className="flex items-start gap-2 p-2 text-sm">
                <Badge variant="outline" className={r.severity === "critical" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}>{r.severity}</Badge>
                <span className="flex-1">{r.title}</span>
                <span className="text-[10px] text-muted-foreground">{r.category}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-600" />Pistes d'action</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {b.recommendations.length === 0 && b.insights.length === 0 && <p className="text-xs italic text-muted-foreground">Aucune recommandation active.</p>}
            {b.recommendations.map((r) => (
              <div key={r.id} className="flex items-start gap-2 p-2 text-sm">
                <Badge variant="secondary" className="text-[10px]">{r.priority ?? "medium"}</Badge>
                <span className="flex-1">{r.title}</span>
              </div>
            ))}
            {b.insights.map((i) => (
              <div key={i.id} className="flex items-start gap-2 p-2 text-sm text-muted-foreground italic">
                <span>· {i.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
