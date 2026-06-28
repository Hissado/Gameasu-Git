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
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  FileSignature,
  FileText,
  FolderKanban,
  Plus,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatFCFA, formatFCFACompact } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { IntelligenceWidget } from "@/components/IntelligenceWidget";
import { QuickClockWidget } from "@/components/QuickClockWidget";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function fullDateFr(d = new Date()) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function shortDateFr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "default" | "green" | "amber" | "red" | "blue";
  loading?: boolean;
  href?: string;
};

function KpiCard({ label, value, sub, icon: Icon, accent = "default", loading, href }: KpiCardProps) {
  const accentColors = {
    default: "text-primary bg-primary/8",
    green:   "text-emerald-600 bg-emerald-50",
    amber:   "text-amber-600 bg-amber-50",
    red:     "text-rose-600 bg-rose-50",
    blue:    "text-blue-600 bg-blue-50",
  };

  const inner = (
    <Card className={cn(
      "shadow-sm border-slate-200 transition-all",
      href && "hover:border-primary/40 hover:shadow-md cursor-pointer",
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-24 mt-2" />
            ) : (
              <p className="text-2xl font-bold text-slate-900 mt-1 leading-none tabular-nums">{value}</p>
            )}
            {sub && !loading && (
              <p className="text-xs text-muted-foreground mt-1.5 truncate">{sub}</p>
            )}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", accentColors[accent])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.firstName || "";

  const { data: kpis, isLoading: loadingKpis } = useGetDashboardKpis();
  const { data: charts, isLoading: loadingCharts } = useGetDashboardCharts();
  const { data: activity } = useGetRecentActivity({ limit: 8 });
  const { data: projects } = useListProjects();
  const { data: tasks } = useListTasks();
  const { data: invoices } = useListInvoices();

  const projectList: any[] = (projects as any)?.data || (projects as any) || [];
  const taskList: any[]    = (tasks as any)?.data    || (tasks as any)    || [];
  const invoiceList: any[] = (invoices as any)?.data || (invoices as any) || [];

  const monthlyRevenue = Number(kpis?.monthlyRevenue || 0);
  const outstanding    = Number(kpis?.outstandingInvoices || 0);
  const pipeline       = Number(kpis?.pipelineValue || 0);

  const collectionRate = (() => {
    const total = monthlyRevenue + outstanding;
    return total > 0 ? Math.round((monthlyRevenue / total) * 100) : 0;
  })();

  const now = new Date();

  const overdueTasks = React.useMemo(() =>
    taskList
      .filter((t: any) => t.dueDate && t.status !== "done" && !t.deletedAt && new Date(t.dueDate) < now)
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4),
    [taskList],
  );

  const upcomingTasks = React.useMemo(() =>
    taskList
      .filter((t: any) => t.dueDate && t.status !== "done" && !t.deletedAt && new Date(t.dueDate) >= now)
      .map((t: any) => ({ ...t, _due: new Date(t.dueDate), _delta: daysBetween(new Date(t.dueDate), now) }))
      .sort((a: any, b: any) => a._due.getTime() - b._due.getTime())
      .slice(0, 5),
    [taskList],
  );

  const overdueInvoices = React.useMemo(() =>
    invoiceList
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.dueDate && new Date(i.dueDate) < now)
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4),
    [invoiceList],
  );

  const activeProjects = React.useMemo(() =>
    projectList
      .filter((p: any) => p.status === "active")
      .sort((a: any, b: any) => Number(b.budget || 0) - Number(a.budget || 0))
      .slice(0, 5),
    [projectList],
  );

  const revenueData = (charts as any)?.revenueByMonth || [];

  const totalAlerts = overdueInvoices.length + overdueTasks.length + (outstanding > 0 ? 1 : 0);

  const tt = {
    contentStyle: { backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
    labelStyle: { color: "#475569", fontWeight: 600, marginBottom: 4 },
  } as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-400 pb-12">

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <header className="rounded-2xl overflow-hidden border border-slate-800 shadow-lg"
        style={{ background: "linear-gradient(135deg, #0d1424 0%, #111827 50%, #0f172a 100%)" }}>
        <div className="px-6 py-7 md:px-8 md:py-8 relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-2/3 h-full"
              style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(243,112,33,0.07) 0%, transparent 60%)" }} />
          </div>
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold mb-2"
                style={{ color: "rgba(243,112,33,0.85)" }}>
                Tableau de bord · {fullDateFr()}
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white leading-none">
                {getGreeting()}{firstName ? `, ${firstName}` : ""}
              </h1>
            </div>
            {/* Raccourcis rapides */}
            <div className="flex flex-wrap gap-2">
              {([
                { label: "Facture",       href: "/invoices",        icon: FileText },
                { label: "Devis",         href: "/proformas",       icon: FileSignature },
                { label: "Client",        href: "/clients",         icon: Building2 },
                { label: "Paiement",      href: "/payments",        icon: Wallet },
                { label: "Collaborateur", href: "/collaborators",   icon: Users },
              ] as { label: string; href: string; icon: React.ComponentType<{className?: string}> }[]).map((a) => (
                <Button key={a.label} size="sm" variant="secondary" asChild
                  className="bg-white/10 hover:bg-white/20 text-white border-0 text-xs h-8 gap-1.5">
                  <Link href={a.href}>
                    <Plus className="w-3 h-3" />
                    {a.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Pointage du jour ────────────────────────────────────────────── */}
      <QuickClockWidget />

      {/* ── Section 1 : KPI ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Vue d'ensemble" sub="Indicateurs clés de votre organisation" />
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <KpiCard
            label="Encaissements du mois"
            value={loadingKpis ? "—" : formatFCFACompact(monthlyRevenue)}
            sub="Paiements reçus"
            icon={TrendingUp}
            accent={monthlyRevenue > 0 ? "green" : "default"}
            loading={loadingKpis}
            href="/payments"
          />
          <KpiCard
            label="Créances ouvertes"
            value={loadingKpis ? "—" : formatFCFACompact(outstanding)}
            sub="À encaisser"
            icon={Receipt}
            accent={outstanding > 0 ? "amber" : "green"}
            loading={loadingKpis}
            href="/invoices"
          />
          <KpiCard
            label="Pipeline CRM"
            value={loadingKpis ? "—" : formatFCFACompact(pipeline)}
            sub="Opportunités qualifiées"
            icon={Briefcase}
            accent="blue"
            loading={loadingKpis}
            href="/crm"
          />
          <KpiCard
            label="Taux de recouvrement"
            value={loadingKpis ? "—" : `${collectionRate}%`}
            sub="Encaissé / Facturé"
            icon={CheckCircle2}
            accent={collectionRate >= 75 ? "green" : collectionRate >= 40 ? "amber" : "red"}
            loading={loadingKpis}
          />
          <KpiCard
            label="Projets actifs"
            value={loadingKpis ? "—" : kpis?.activeProjects ?? 0}
            sub={`sur ${kpis?.totalProjects ?? 0} au total`}
            icon={FolderKanban}
            accent="default"
            loading={loadingKpis}
            href="/projects"
          />
          <KpiCard
            label="Collaborateurs"
            value={loadingKpis ? "—" : kpis?.totalCollaborators ?? 0}
            sub="Effectif actif"
            icon={Users}
            accent="default"
            loading={loadingKpis}
            href="/collaborators"
          />
          <KpiCard
            label="Factures en attente"
            value={loadingKpis ? "—" : overdueInvoices.length}
            sub={overdueInvoices.length > 0 ? "Relances nécessaires" : "Aucune en retard"}
            icon={FileText}
            accent={overdueInvoices.length > 0 ? "red" : "green"}
            loading={loadingKpis}
            href="/invoices"
          />
          <KpiCard
            label="Alertes actives"
            value={loadingKpis ? "—" : totalAlerts}
            sub={totalAlerts > 0 ? "Actions requises" : "Tout est à jour"}
            icon={AlertTriangle}
            accent={totalAlerts > 3 ? "red" : totalAlerts > 0 ? "amber" : "green"}
            loading={loadingKpis}
          />
        </div>
      </section>

      {/* ── Copilote intelligence ────────────────────────────────────────── */}
      <IntelligenceWidget />

      {/* ── Section 2 : Actions prioritaires ────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertes financières */}
        <div>
          <SectionHeader
            title="Alertes prioritaires"
            sub="Actions financières urgentes"
            action={
              <Button variant="ghost" size="sm" className="text-xs" asChild>
                <Link href="/invoices">Voir tout <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
              </Button>
            }
          />
          <div className="mt-3 space-y-2">
            {outstanding > 0 && (
              <Link href="/invoices"
                className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Créances à encaisser</p>
                  <p className="text-xs text-slate-600">{formatFCFA(outstanding)} en attente</p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
              </Link>
            )}
            {overdueInvoices.length === 0 && outstanding === 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-800 font-medium">Aucune alerte financière — tout est à jour.</p>
              </div>
            )}
            {overdueInvoices.map((inv: any) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    Facture {inv.invoiceNumber || inv.number || `#${(inv.id || "").slice(0, 6)}`}
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    {formatFCFA(Number(inv.totalAmount || 0))} · {inv.clientName || "Client"} · échue le {shortDateFr(inv.dueDate)}
                  </p>
                </div>
                <Badge variant="destructive" className="text-[10px] shrink-0">Retard</Badge>
              </Link>
            ))}
          </div>
        </div>

        {/* Tâches en retard */}
        <div>
          <SectionHeader
            title="Tâches en retard"
            sub="À traiter en priorité"
            action={
              <Button variant="ghost" size="sm" className="text-xs" asChild>
                <Link href="/tasks">Voir tout <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
              </Button>
            }
          />
          <div className="mt-3 space-y-2">
            {overdueTasks.length === 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-800 font-medium">Aucune tâche en retard.</p>
              </div>
            )}
            {overdueTasks.map((t: any) => {
              const delta = daysBetween(now, new Date(t.dueDate));
              return (
                <Link key={t.id} href={`/tasks/${t.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                    <p className="text-xs text-slate-600">{t.assigneeName || "Non assigné"} · échue {shortDateFr(t.dueDate)}</p>
                  </div>
                  <span className="text-xs font-bold text-rose-600 shrink-0">+{delta}j</span>
                </Link>
              );
            })}
            {upcomingTasks.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">À venir</p>
                {upcomingTasks.slice(0, 3).map((t: any) => (
                  <Link key={t.id} href={`/tasks/${t.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                      <p className="text-xs text-slate-500">{shortDateFr(t._due)}</p>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">Dans {t._delta}j</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Section 3 : Graphique + Synthèse CRM ──────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique revenus */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-bold">Encaissements vs Facturation</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">12 derniers mois — en FCFA</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />Encaissé
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />Facturé
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[260px] pt-0">
            {loadingCharts ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : revenueData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Aucune donnée disponible.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v / 1000}k`} />
                  <RTooltip {...tt} formatter={(v: number, name) => [formatFCFA(v), name === "revenue" ? "Encaissé" : "Facturé"]} />
                  <Area type="monotone" dataKey="invoiced" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Synthèse CRM */}
        <Card className="shadow-sm border-slate-200"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white">Pipeline CRM</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Activité commerciale</p>
              </div>
              <Button variant="secondary" size="sm" asChild
                className="bg-white/10 hover:bg-white/20 text-white border-0 text-xs h-7">
                <Link href="/crm">CRM</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-white space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Pipeline qualifié</p>
              <p className="text-2xl font-extrabold text-primary mt-1">{formatFCFACompact(pipeline)}</p>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min(100, pipeline > 0 && monthlyRevenue > 0 ? (pipeline / Math.max(monthlyRevenue, pipeline)) * 100 : pipeline > 0 ? 100 : 0)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Opportunités</p>
                <p className="text-xl font-extrabold mt-1">{kpis?.openOpportunities || 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Clients</p>
                <p className="text-xl font-extrabold mt-1">{kpis?.totalClients || 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Recouvrement</p>
                <p className="text-xl font-extrabold mt-1">{collectionRate}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Locations actives</p>
                <p className="text-xl font-extrabold mt-1">{kpis?.activeRentals || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Section 4 : Projets + Activité récente ──────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projets actifs */}
        <div className="lg:col-span-2">
          <SectionHeader
            title="Projets actifs"
            sub="Projets en cours par valeur"
            action={
              <Button variant="ghost" size="sm" className="text-xs" asChild>
                <Link href="/projects">Tous les projets <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
              </Button>
            }
          />
          <div className="mt-3 space-y-2">
            {activeProjects.length === 0 ? (
              <Card className="shadow-sm border-slate-200">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Aucun projet actif.
                </CardContent>
              </Card>
            ) : activeProjects.map((p: any) => {
              const progress = Number(p.progress || 0);
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all group">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </p>
                      <p className="text-sm font-bold text-slate-700 shrink-0 tabular-nums">
                        {formatFCFACompact(Number(p.budget || 0))}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-xs font-semibold text-slate-600 w-9 text-right">{progress}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.clientName || "Client interne"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Activité récente */}
        <div>
          <SectionHeader title="Activité récente" sub="Derniers événements" />
          <div className="mt-3 space-y-1">
            {!activity || (activity as any[]).length === 0 ? (
              <Card className="shadow-sm border-slate-200">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Aucune activité récente.
                </CardContent>
              </Card>
            ) : (activity as any[]).slice(0, 8).map((a: any, i: number) => (
              <div key={a.id ?? i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 leading-snug">{a.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {a.userName || "Système"} · {shortDateFr(a.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Raccourcis bas de page ───────────────────────────────────────── */}
      <section>
        <SectionHeader title="Raccourcis" sub="Actions fréquentes" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
          {([
            { label: "Créer une facture",       href: "/invoices",      icon: FileText,      color: "text-primary" },
            { label: "Ajouter un client",        href: "/clients",       icon: Building2,     color: "text-blue-600" },
            { label: "Créer un devis",           href: "/proformas",     icon: FileSignature, color: "text-violet-600" },
            { label: "Enregistrer un paiement",  href: "/payments",      icon: CreditCard,    color: "text-emerald-600" },
            { label: "Voir les relances",        href: "/recouvrement",  icon: Zap,           color: "text-amber-600" },
            { label: "Rapport achats",           href: "/achats/rapports", icon: Briefcase,   color: "text-rose-600" },
          ] as { label: string; href: string; icon: React.ComponentType<{className?: string}>; color: string }[]).map((a) => (
            <Link key={a.label} href={a.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all text-center group">
              <a.icon className={cn("w-6 h-6 transition-colors", a.color)} />
              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
