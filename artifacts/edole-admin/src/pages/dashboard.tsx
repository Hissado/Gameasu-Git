import React from "react";
import { Link } from "wouter";
import {
  useGetDashboardKpis,
  useGetDashboardCharts,
  useGetRecentActivity,
  useListProjects,
  useListTasks,
  useListInvoices,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  FileSignature,
  FolderKanban,
  LineChart as LineChartIcon,
  Plus,
  Receipt,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { MoneyAmount } from "@/components/ui/money-amount";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { IntelligenceWidget } from "@/components/IntelligenceWidget";
import { QuickClockWidget } from "@/components/QuickClockWidget";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function fullDateFr(d = new Date()) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function shortDateFr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "Planification",
  active: "En cours",
  on_hold: "En attente",
  completed: "Terminés",
  cancelled: "Annulés",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Normale",
  high: "Élevée",
  urgent: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#94a3b8",
  medium: "#60a5fa",
  high: "#f59e0b",
  urgent: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  planning: "#94a3b8",
  active: "#f97316",
  on_hold: "#facc15",
  completed: "#22c55e",
  cancelled: "#94a3b8",
};

// ───────────────────────────────────────────────────────────────────────────
// Section header
// ───────────────────────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow, title, action, icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold">{eyebrow}</div>
        )}
        <div className="flex items-center gap-2 mt-1">
          {Icon && <Icon className="w-5 h-5 text-slate-700" />}
          <h2 className="font-display text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

function chartTooltipStyle() {
  return {
    contentStyle: {
      backgroundColor: "white",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      fontSize: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    },
    labelStyle: { color: "#475569", fontWeight: 600, marginBottom: 4 },
  } as const;
}

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.firstName || "";

  const { data: kpis, isLoading: loadingKpis } = useGetDashboardKpis();
  const { data: charts, isLoading: loadingCharts } = useGetDashboardCharts();
  const { data: activity } = useGetRecentActivity({ limit: 6 });
  const { data: projects } = useListProjects();
  const { data: tasks } = useListTasks();
  const { data: invoices } = useListInvoices();

  const projectList = (projects as any)?.data || (projects as any) || [];
  const taskList = (tasks as any)?.data || (tasks as any) || [];
  const invoiceList = (invoices as any)?.data || (invoices as any) || [];

  const monthlyRevenue = Number(kpis?.monthlyRevenue || 0);
  const outstanding = Number(kpis?.outstandingInvoices || 0);
  const pipeline = Number(kpis?.pipelineValue || 0);

  const collectionRate = (() => {
    const total = monthlyRevenue + outstanding;
    if (!total) return 0;
    return Math.round((monthlyRevenue / total) * 100);
  })();

  const upcomingTasks = React.useMemo(() => {
    const now = new Date();
    return [...taskList]
      .filter((t: any) => t.dueDate && t.status !== "done" && !t.deletedAt)
      .map((t: any) => ({ ...t, _due: new Date(t.dueDate), _delta: daysBetween(new Date(t.dueDate), now) }))
      .sort((a, b) => a._due.getTime() - b._due.getTime())
      .slice(0, 6);
  }, [taskList]);

  const overdueInvoices = React.useMemo(() => {
    const now = new Date();
    return [...invoiceList]
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.dueDate && new Date(i.dueDate) < now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [invoiceList]);

  const activeProjects = React.useMemo(() => {
    return [...projectList]
      .filter((p: any) => p.status === "active")
      .sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0))
      .slice(0, 5);
  }, [projectList]);

  const revenueData = (charts as any)?.revenueByMonth || [];
  const projectsByStatus = ((charts as any)?.projectsByStatus || []).map((s: any) => ({
    ...s,
    label: PROJECT_STATUS_LABELS[s.status] || s.status,
    color: STATUS_COLORS[s.status] || "#94a3b8",
  }));
  const tasksByPriority = ((charts as any)?.tasksByPriority || []).map((p: any) => ({
    ...p,
    label: PRIORITY_LABELS[p.priority] || p.priority,
    color: PRIORITY_COLORS[p.priority] || "#94a3b8",
  }));

  const tt = chartTooltipStyle();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">

      {/* ─── Bandeau exécutif ─── */}
      <header className="rounded-2xl overflow-hidden border border-slate-800 shadow-xl"
        style={{ background: "linear-gradient(135deg, #0d1424 0%, #111827 50%, #0f172a 100%)" }}
      >
        <div className="px-7 py-8 md:px-10 md:py-9 relative">
          {/* Accent glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-2/3 h-full"
              style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(243,112,33,0.07) 0%, transparent 60%)" }} />
            <div className="absolute bottom-0 left-0 w-1/2 h-1/2"
              style={{ background: "radial-gradient(ellipse at 20% 100%, rgba(99,102,241,0.05) 0%, transparent 60%)" }} />
          </div>

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left — greeting */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] font-bold"
                style={{ color: "rgba(243,112,33,0.85)" }}>
                Tableau de bord exécutif · {fullDateFr()}
              </div>
              <h1 className="mt-3 text-[2rem] md:text-[2.5rem] font-black tracking-tight text-white leading-none">
                {getGreeting()}{firstName ? `, ${firstName}` : ""}
              </h1>
            </div>

          </div>
        </div>
      </header>


      {/* ─── Actions rapides ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">Créer :</span>
        {([
          { label: "Facture",  href: "/invoices",  icon: FileText },
          { label: "Client",   href: "/clients",   icon: Building2 },
          { label: "Projet",   href: "/projects",  icon: FolderKanban },
          { label: "Devis",    href: "/proformas", icon: FileSignature },
          { label: "Tâche",    href: "/tasks",     icon: ClipboardList },
        ] as { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]).map((a) => (
          <Button key={a.label} variant="outline" size="sm"
            className="gap-1.5 h-8 text-[12.5px] border-slate-200 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
            asChild>
            <Link href={a.href}>
              <Plus className="w-3 h-3" />
              {a.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* ─── Pointage rapide ─── */}
      <QuickClockWidget />

      {/* ─── Copilote exécutif ─── */}
      <IntelligenceWidget />

      {/* ─── Graphiques ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight">
                Évolution du chiffre d'affaires
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Facturation vs encaissements consolidés (12 derniers mois)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />Encaissé
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />Facturé
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] pt-2">
            {loadingCharts ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v / 1000}k`}
                  />
                  <RTooltip {...tt} formatter={(v: number, name) => [formatFCFA(v), name === "revenue" ? "Encaissé" : "Facturé"]} />
                  <Area type="monotone" dataKey="invoiced" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-bold tracking-tight">
              Répartition des projets
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Statut du portefeuille</p>
          </CardHeader>
          <CardContent className="h-[300px] pt-2">
            {loadingCharts ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectsByStatus.filter((d: any) => d.count > 0)}
                    dataKey="count" nameKey="label"
                    innerRadius={55} outerRadius={90} paddingAngle={2}
                  >
                    {projectsByStatus.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <RTooltip {...tt} formatter={(v: number, name) => [v, name as string]} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"
                    formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Charge + Synthèse commerciale ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-bold tracking-tight">Charge par priorité</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Tâches et engagements actifs</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loadingCharts ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByPriority} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="label" type="category" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <RTooltip {...tt} formatter={(v: number) => [v, "Tâches"]} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {tasksByPriority.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Synthèse commerciale */}
        <Card className="shadow-sm border-slate-200"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight text-white">
                Synthèse commerciale
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">Pipeline et conversion</p>
            </div>
            <Button variant="secondary" size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-0" asChild>
              <Link href="/crm">Ouvrir le CRM</Link>
            </Button>
          </CardHeader>
          <CardContent className="text-white space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Pipeline qualifié
                </span>
                <span className="font-display text-base sm:text-2xl font-extrabold text-primary">
                  {formatFCFACompact(pipeline)}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (pipeline / Math.max(monthlyRevenue || 1, pipeline)) * 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/10">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Opportunités</div>
                <div className="font-display text-xl font-extrabold mt-1">{kpis?.openOpportunities || 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Clients actifs</div>
                <div className="font-display text-xl font-extrabold mt-1">{kpis?.totalClients || 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Taux recouvrement</div>
                <div className="font-display text-xl font-extrabold mt-1">{collectionRate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── Échéances + Alertes ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-primary" /> Échéances à venir
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">Tâches et livrables des 7 prochains jours</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">Tout voir <ChevronRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {upcomingTasks.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Aucune échéance critique à court terme.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingTasks.map((t: any) => {
                  const overdue = t._delta < 0;
                  const today = t._delta === 0;
                  const soon = t._delta > 0 && t._delta <= 3;
                  return (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center gap-4 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className={cn(
                        "w-1 h-10 rounded-full shrink-0",
                        overdue ? "bg-rose-500" : today ? "bg-amber-500" : soon ? "bg-primary" : "bg-slate-300",
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{t.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {PRIORITY_LABELS[t.priority] || t.priority || "Normale"}
                          {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn(
                          "text-xs font-bold",
                          overdue ? "text-rose-600" : today ? "text-amber-700" : "text-slate-700",
                        )}>
                          {shortDateFr(t._due)}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                          {overdue ? `Retard ${Math.abs(t._delta)}j` : today ? "Aujourd'hui" : `Dans ${t._delta}j`}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-700" /> Alertes prioritaires
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">Points d'attention immédiate</p>
            </div>
            {overdueInvoices.length > 0 && (
              <Badge variant="destructive" className="font-bold">{overdueInvoices.length}</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {outstanding > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <Receipt className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900">Créances ouvertes</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {formatFCFA(outstanding)} en attente d'encaissement
                  </div>
                </div>
              </div>
            )}
            {overdueInvoices.slice(0, 3).map((inv: any) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    Facture {inv.invoiceNumber || inv.number || `#${(inv.id || "").slice(0, 6)}`}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {formatFCFA(Number(inv.totalAmount || 0))} · {inv.clientName || "Client"} · échue {shortDateFr(inv.dueDate)}
                  </div>
                </div>
              </Link>
            ))}
            {outstanding === 0 && overdueInvoices.length === 0 && (
              <div className="py-6 text-center text-sm text-slate-500">
                Aucune alerte en cours.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Projets stratégiques + Activité ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" /> Projets stratégiques
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">Projets actifs à plus forte valeur</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">Tous les projets <ChevronRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {activeProjects.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">Aucun projet actif.</div>
            ) : (
              <div className="space-y-3">
                {activeProjects.map((p: any) => {
                  const progress = Number(p.progress || 0);
                  const budget = Number(p.budget || 0);
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="block p-4 rounded-lg border border-slate-200 hover:border-primary/40 hover:bg-slate-50/60 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {p.clientName || "Client interne"} · {p.location || "—"}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-sm font-extrabold text-slate-900">
                            {formatFCFA(budget)}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">budget</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs font-semibold text-slate-700 w-10 text-right">{progress}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-slate-700" /> Activité récente
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Derniers événements consolidés</p>
          </CardHeader>
          <CardContent className="pt-2">
            {!activity || (activity as any[]).length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">Aucune activité récente.</div>
            ) : (
              <div className="space-y-3">
                {(activity as any[]).slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-800 truncate">{a.description}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {a.userName || "Système"} · {shortDateFr(a.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
