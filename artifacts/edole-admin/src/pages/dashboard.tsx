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
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Building2,
  CreditCard,
  FileSignature,
  FileText,
  FolderKanban,
  Plus,
  Receipt,
  Settings2,
  Zap,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { IntelligenceWidget } from "@/components/IntelligenceWidget";
import { QuickClockWidget } from "@/components/QuickClockWidget";
import { DashboardCustomizeSheet } from "@/components/DashboardCustomizeSheet";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useModuleTour, WelcomeModal, OnboardingTour, TOUR_PATHS } from "@/components/ui/onboarding-tour";
import { ModuleIntroCard } from "@/components/ui/module-intro-card";
import { LayoutDashboard } from "lucide-react";

import { KpisSection } from "@/components/dashboard/KpisSection";
import { QuickLinksSection } from "@/components/dashboard/QuickLinksSection";
import { AlertsSection } from "@/components/dashboard/AlertsSection";
import { UpcomingTasksSection } from "@/components/dashboard/UpcomingTasksSection";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { ProjectsSection } from "@/components/dashboard/ProjectsSection";
import { ActivitySection } from "@/components/dashboard/ActivitySection";

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

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

// ─── Tour config ──────────────────────────────────────────────────────────────

const DASHBOARD_TOUR = [
  { target: "dash-header",  title: "Tableau de bord",        description: "Salutation personnalisée, date du jour et raccourcis vers les actions fréquentes." },
  { target: "dash-kpis",   title: "Indicateurs clés",        description: "Vue synthétique : encaissements, créances, pipeline CRM, projets actifs et alertes." },
  { target: "dash-alerts", title: "Alertes & tâches",        description: "Les actions urgentes remontent ici — factures en retard, tâches échues. Cliquez pour y accéder." },
];

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

  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  const { widgets, saveWidgets, resetWidgets, isSaving } = useDashboardConfig();

  const projectList: any[] = (projects as any)?.data || (projects as any) || [];
  const taskList: any[]    = (tasks as any)?.data    || (tasks as any)    || [];
  const invoiceList: any[] = (invoices as any)?.data || (invoices as any) || [];
  const activityList: any[] = (activity as any) || [];

  const {
    showWelcome, tourActive, startTour, startTourWithPath, dismissWelcome, closeTour,
    selectedPathKey, handleTourStepChange, tourInitialStep, tourPathLabel,
  } = useModuleTour("dashboard", !loadingKpis && projectList.length === 0);
  const activeSteps = selectedPathKey
    ? (TOUR_PATHS["dashboard"]?.find((p) => p.key === selectedPathKey)?.steps ?? DASHBOARD_TOUR)
    : DASHBOARD_TOUR;

  const monthlyRevenue = Number(kpis?.monthlyRevenue || 0);
  const outstanding    = Number(kpis?.outstandingInvoices || 0);
  const pipeline       = Number(kpis?.pipelineValue || 0);

  const collectionRate = (() => {
    const total = monthlyRevenue + outstanding;
    return total > 0 ? Math.round((monthlyRevenue / total) * 100) : 0;
  })();

  const now = new Date();

  const overdueInvoices = React.useMemo(() =>
    invoiceList
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.dueDate && new Date(i.dueDate) < now)
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4),
    [invoiceList],
  );

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

  const activeProjects = React.useMemo(() =>
    projectList
      .filter((p: any) => p.status === "active")
      .sort((a: any, b: any) => Number(b.budget || 0) - Number(a.budget || 0))
      .slice(0, 5),
    [projectList],
  );

  const revenueData = (charts as any)?.revenueByMonth || [];
  const totalAlerts = overdueInvoices.length + overdueTasks.length + (outstanding > 0 ? 1 : 0);

  // ── Rendu des widgets par ID ──────────────────────────────────────────────
  const renderWidget = (id: string) => {
    switch (id) {
      case "kpis":
        return (
          <KpisSection
            key="kpis"
            kpis={kpis}
            loading={loadingKpis}
            overdueInvoicesCount={overdueInvoices.length}
            totalAlerts={totalAlerts}
            monthlyRevenue={monthlyRevenue}
            outstanding={outstanding}
            pipeline={pipeline}
            collectionRate={collectionRate}
          />
        );

      case "quick-links":
        return <QuickLinksSection key="quick-links" />;

      case "clock":
        return <QuickClockWidget key="clock" />;

      case "intelligence":
        return <IntelligenceWidget key="intelligence" />;

      case "alerts":
        return (
          <AlertsSection
            key="alerts"
            overdueInvoices={overdueInvoices}
            outstanding={outstanding}
          />
        );

      case "upcoming-tasks":
        return (
          <UpcomingTasksSection
            key="upcoming-tasks"
            overdueTasks={overdueTasks}
            upcomingTasks={upcomingTasks}
            now={now}
          />
        );

      case "chart":
        return (
          <ChartSection
            key="chart"
            revenueData={revenueData}
            loading={loadingCharts}
            kpis={kpis}
            monthlyRevenue={monthlyRevenue}
            pipeline={pipeline}
            collectionRate={collectionRate}
          />
        );

      case "projects":
        return <ProjectsSection key="projects" activeProjects={activeProjects} />;

      case "activity":
        return <ActivitySection key="activity" activity={activityList} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-400 pb-12">
      {showWelcome && (
        <WelcomeModal
          title="Tableau de bord"
          subtitle="Découvrez comment piloter votre activité au quotidien."
          icon={LayoutDashboard}
          steps={DASHBOARD_TOUR}
          onStart={startTour}
          onDismiss={dismissWelcome}
          paths={TOUR_PATHS["dashboard"]}
          onStartPath={startTourWithPath}
        />
      )}
      {tourActive && (
        <OnboardingTour
          steps={activeSteps}
          onClose={closeTour}
          pathLabel={tourPathLabel}
          initialStep={tourInitialStep}
          onStepChange={handleTourStepChange}
        />
      )}
      <ModuleIntroCard moduleKey="dashboard" />

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <header
        data-tour="dash-header"
        className="rounded-2xl overflow-hidden border border-slate-800 shadow-lg"
        style={{ background: "linear-gradient(135deg, #0d1424 0%, #111827 50%, #0f172a 100%)" }}
      >
        <div className="px-6 py-7 md:px-8 md:py-8 relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-2/3 h-full"
              style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(243,112,33,0.07) 0%, transparent 60%)" }} />
          </div>
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold mb-2" style={{ color: "rgba(243,112,33,0.85)" }}>
                Tableau de bord · {fullDateFr()}
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white leading-none">
                {getGreeting()}{firstName ? `, ${firstName}` : ""}
              </h1>
              {!loadingKpis && (
                <p className={cn("text-sm mt-2 leading-relaxed", totalAlerts > 0 ? "text-amber-300/90" : "text-white/45")}>
                  {totalAlerts > 0
                    ? `${totalAlerts} action${totalAlerts > 1 ? "s" : ""} en attente — ${[
                        overdueInvoices.length > 0 && `${overdueInvoices.length} facture${overdueInvoices.length > 1 ? "s" : ""} en retard`,
                        overdueTasks.length > 0 && `${overdueTasks.length} tâche${overdueTasks.length > 1 ? "s" : ""} échue${overdueTasks.length > 1 ? "s" : ""}`,
                      ].filter(Boolean).join(", ")}.`
                    : "Aucune alerte — tout est à jour."}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 self-start">
              {([
                { label: "Facture",  href: "/factures",  icon: FileText },
                { label: "Devis",    href: "/devis",     icon: FileSignature },
                { label: "Client",   href: "/clients",   icon: Building2 },
                { label: "Paiement", href: "/paiements", icon: Wallet },
                { label: "Projet",   href: "/projets",   icon: FolderKanban },
              ] as { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]).map((a) => (
                <Button key={a.label} size="sm" variant="secondary" asChild
                  className="bg-white/10 hover:bg-white/20 text-white border-0 text-xs h-8 gap-1.5">
                  <Link href={a.href}><Plus className="w-3 h-3" />{a.label}</Link>
                </Button>
              ))}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCustomizeOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-0 text-xs h-8 gap-1.5"
              >
                <Settings2 className="w-3 h-3" />
                Personnaliser
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Widgets dynamiques (ordre + visibilité selon préférences) ────── */}
      {widgets
        .filter((w) => w.enabled)
        .map((w) => renderWidget(w.id))}

      {/* ── Raccourcis bas de page ───────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Raccourcis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Actions fréquentes</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {([
            { label: "Créer une facture",       href: "/factures",        icon: FileText,      color: "text-primary" },
            { label: "Ajouter un client",        href: "/clients",         icon: Building2,     color: "text-blue-600" },
            { label: "Créer un devis",           href: "/devis",           icon: FileSignature, color: "text-violet-600" },
            { label: "Enregistrer un paiement",  href: "/paiements",       icon: CreditCard,    color: "text-emerald-600" },
            { label: "Voir les relances",        href: "/recouvrement",    icon: Zap,           color: "text-amber-600" },
            { label: "Rapport achats",           href: "/achats/rapports", icon: Briefcase,     color: "text-rose-600" },
          ] as { label: string; href: string; icon: React.ComponentType<{ className?: string }>; color: string }[]).map((a) => (
            <Link key={a.label} href={a.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all text-center group">
              <a.icon className={cn("w-6 h-6 transition-colors", a.color)} />
              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Sheet de personnalisation ────────────────────────────────────── */}
      <DashboardCustomizeSheet
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        widgets={widgets}
        onSave={saveWidgets}
        onReset={resetWidgets}
        isSaving={isSaving}
      />
    </div>
  );
}
