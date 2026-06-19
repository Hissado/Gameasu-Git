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
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
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
  Shield,
  Target,
  TrendingUp,
  Users,
  Wallet,
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
// Sub-components
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

type Trend = { value: number; label?: string; direction?: "up" | "down" | "flat" } | null;

function MetricCard({
  label, value, sub, trend, icon: Icon, accent, loading, href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  trend?: Trend;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "dark" | "neutral" | "success" | "warning" | "danger";
  loading?: boolean;
  href?: string;
}) {
  const accentClasses: Record<string, string> = {
    primary: "border-l-primary",
    dark: "border-l-slate-900",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-rose-500",
    neutral: "border-l-slate-300",
  };
  const iconBg: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    dark: "bg-slate-900 text-white",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-700",
    danger: "bg-rose-500/10 text-rose-600",
    neutral: "bg-slate-100 text-slate-600",
  };
  const a = accent || "neutral";
  const trendColor = trend?.direction === "down" ? "text-rose-600" : trend?.direction === "up" ? "text-emerald-600" : "text-slate-500";
  const TrendIcon = trend?.direction === "down" ? ArrowDownRight : trend?.direction === "up" ? ArrowUpRight : ArrowRight;

  const inner = (
    <Card className={cn("border-l-4 shadow-sm hover:shadow-md transition-all group", accentClasses[a])}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 truncate">{label}</div>
          <div className={cn("p-2 rounded-lg shrink-0", iconBg[a])}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-28 mt-3" />
        ) : (
          <div className="font-display text-base sm:text-[clamp(1.1rem,2.1vw,1.55rem)] font-extrabold text-slate-900 tracking-tight mt-2 leading-tight min-w-0 overflow-hidden">
            {value}
          </div>
        )}
        {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        {trend && (
          <div className={cn("inline-flex items-center gap-1 text-[11px] font-semibold mt-2", trendColor)}>
            <TrendIcon className="w-3 h-3" />
            <span>{trend.value > 0 ? `+${trend.value}` : trend.value}{trend.label ? ` ${trend.label}` : "%"}</span>
          </div>
        )}
        {href && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-primary transition-colors">
            <span>Consulter</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
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

  // Encaissements consolidés
  const monthlyRevenue = Number(kpis?.monthlyRevenue || 0);
  const outstanding = Number(kpis?.outstandingInvoices || 0);
  const pipeline = Number(kpis?.pipelineValue || 0);

  const collectionRate = (() => {
    const total = monthlyRevenue + outstanding;
    if (!total) return 0;
    return Math.round((monthlyRevenue / total) * 100);
  })();

  // Échéances tâches (7 prochains jours)
  const upcomingTasks = React.useMemo(() => {
    const now = new Date();
    return [...taskList]
      .filter((t: any) => t.dueDate && t.status !== "done" && !t.deletedAt)
      .map((t: any) => ({ ...t, _due: new Date(t.dueDate), _delta: daysBetween(new Date(t.dueDate), now) }))
      .sort((a, b) => a._due.getTime() - b._due.getTime())
      .slice(0, 6);
  }, [taskList]);

  // Factures en retard
  const overdueInvoices = React.useMemo(() => {
    const now = new Date();
    return [...invoiceList]
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.dueDate && new Date(i.dueDate) < now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [invoiceList]);

  // Top projets actifs
  const activeProjects = React.useMemo(() => {
    return [...projectList]
      .filter((p: any) => p.status === "active")
      .sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0))
      .slice(0, 5);
  }, [projectList]);

  // Données graphiques
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

  const totalProjects = projectList.length;
  const totalTasks = (kpis?.tasksTodo || 0) + (kpis?.tasksInProgress || 0) + (kpis?.tasksCompleted || 0);
  const tt = chartTooltipStyle();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* ─── Bandeau exécutif ─── */}
      <header className="rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white border border-slate-800 shadow-lg overflow-hidden">
        <div className="px-6 py-7 md:px-8 md:py-8 relative">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-primary/90 font-bold">
                Tableau de bord exécutif · {fullDateFr()}
              </div>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-white">
                {getGreeting()}{firstName ? `, ${firstName}` : ""}
              </h1>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Encaissements (cumul)</div>
                <MoneyAmount amount={monthlyRevenue} size="2xl" color="white" className="mt-1" compactMobile />
              </div>
              <div className="hidden md:block w-px h-12 bg-slate-700" />
              <div className="hidden md:block">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Pipeline</div>
                <MoneyAmount amount={pipeline} size="2xl" color="white" className="mt-1 !text-primary [&>span:last-child]:!text-primary/60" compactMobile />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Actions rapides Xero-style ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">Créer :</span>
        {([
          { label: "Facture",  href: "/invoices",  icon: FileText },
          { label: "Client",   href: "/clients",   icon: Building2 },
          { label: "Projet",   href: "/projects",  icon: FolderKanban },
          { label: "Devis",    href: "/proformas", icon: FileSignature },
          { label: "Tâche",    href: "/tasks",     icon: ClipboardList },
        ] as { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]).map((a) => (
          <Button key={a.label} variant="outline" size="sm" className="gap-1.5 h-8 text-[12.5px] border-slate-200 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors" asChild>
            <Link href={a.href}>
              <Plus className="w-3 h-3" />
              {a.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* ─── Pointage rapide ─── */}
      <QuickClockWidget />

      {/* ─── Copilote exécutif Gaméasù ─── */}
      <IntelligenceWidget />

      {/* ─── Bloc 1 : Performance financière ─── */}
      <section>
        <SectionHeader
          eyebrow="Indicateurs stratégiques"
          title="Performance financière"
          icon={Wallet}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounting">Comptabilité <ChevronRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Encaissements"
            value={<MoneyAmount amount={monthlyRevenue} size="xl" color="default" compactMobile />}
            sub="Paiements reçus à date"
            icon={Banknote} accent="dark" loading={loadingKpis}
            href="/payments"
          />
          <MetricCard
            label="Créances ouvertes"
            value={<MoneyAmount amount={outstanding} size="xl" color={outstanding > 0 ? "warning" : "default"} compactMobile />}
            sub="Factures non encaissées"
            icon={Receipt} accent={outstanding > 0 ? "warning" : "neutral"} loading={loadingKpis}
            href="/invoices"
          />
          <MetricCard
            label="Pipeline commercial"
            value={<MoneyAmount amount={pipeline} size="xl" color="default" compactMobile />}
            sub={`${kpis?.openOpportunities || 0} opportunités qualifiées`}
            icon={Target} accent="primary" loading={loadingKpis}
            href="/crm"
          />
          <MetricCard
            label="Taux de recouvrement"
            value={`${collectionRate}%`}
            sub="Encaissé vs facturé"
            icon={TrendingUp}
            accent={collectionRate >= 75 ? "success" : collectionRate >= 50 ? "warning" : "danger"}
            loading={loadingKpis}
          />
        </div>
      </section>

      {/* ─── Bloc 2 : Activité opérationnelle ─── */}
      <section>
        <SectionHeader
          eyebrow="Pilotage"
          title="Activité opérationnelle"
          icon={Activity}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Projets actifs"
            value={kpis?.activeProjects || 0}
            sub={`sur ${totalProjects} projets`}
            icon={FolderKanban} accent="primary" loading={loadingKpis} href="/projects"
          />
          <MetricCard
            label="Clients"
            value={kpis?.totalClients || 0}
            sub="Comptes B2B suivis"
            icon={Building2} accent="neutral" loading={loadingKpis} href="/clients"
          />
          <MetricCard
            label="Engagements"
            value={kpis?.tasksInProgress || 0}
            sub={`${kpis?.tasksTodo || 0} en attente · ${kpis?.tasksCompleted || 0} clôturés`}
            icon={Briefcase} accent="neutral" loading={loadingKpis} href="/services"
          />
          <MetricCard
            label="Locations actives"
            value={kpis?.activeRentals || 0}
            sub={`${kpis?.equipmentAvailable || 0} équipements disponibles`}
            icon={Shield} accent="neutral" loading={loadingKpis} href="/rentals"
          />
        </div>
      </section>

      {/* ─── Bloc 3 : Graphiques ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight">Évolution du chiffre d'affaires</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Facturation vs encaissements consolidés (12 derniers mois)</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" />Encaissé</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />Facturé</span>
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
            <CardTitle className="font-display text-lg font-bold tracking-tight">Répartition des projets</CardTitle>
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

      {/* ─── Bloc 4 : Charge de travail + Pipeline ─── */}
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

        <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-slate-900 to-slate-950 text-white border-slate-800">
          <CardHeader className="pb-3 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold tracking-tight text-white">Synthèse commerciale</CardTitle>
              <p className="text-xs text-slate-400 mt-1">Pipeline et conversion</p>
            </div>
            <Button variant="secondary" size="sm" className="bg-white/10 hover:bg-white/20 text-white border-0" asChild>
              <Link href="/crm">Ouvrir le CRM</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Pipeline qualifié</span>
                <span className="font-display text-base sm:text-2xl font-extrabold text-primary">{formatFCFACompact(pipeline)}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (pipeline / Math.max(monthlyRevenue || 1, pipeline)) * 100)}%` }} />
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
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Taux conversion</div>
                <div className="font-display text-xl font-extrabold mt-1">{collectionRate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── Bloc 5 : Échéances + Alertes ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Échéances */}
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

        {/* Alertes */}
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

      {/* ─── Bloc 6 : Top projets actifs + Activité ─── */}
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
