import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Monitor, Moon, Sun as SunIcon } from "lucide-react";
import { GaméasùLockup } from "@/components/branding/GameasuLockup";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/theme";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Briefcase, Wrench, Truck,
  ClipboardCheck, ShoppingCart, FileText, CreditCard, MessageSquare, PhoneCall,
  Settings, Bell, Search, UserCircle, LogOut, BarChart3,
  Calculator, TrendingUp, Building2,
  GraduationCap, FileSignature, FolderOpen, UsersRound, Megaphone, Target,
  LifeBuoy, Shield, Lock, Brain, Workflow, Clock, Sparkles, Sun, Package,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BRANDING } from "@/config/branding";
import { PlanBadge } from "@/components/PlanBadge";
import { useCurrentOrganization, useCurrentSubscription, useOrganizationModules } from "@/lib/saas";

type NavItem = {
  name: string; path: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  moduleKey?: string;
};
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Pilotage",
    items: [
      { name: "Tableau de bord", path: "/", icon: LayoutDashboard, moduleKey: "dashboard" },
      { name: "Briefing du jour", path: "/briefing", icon: Sun, moduleKey: "dashboard" },
      { name: "Cockpit IA", path: "/intelligence", icon: Brain, moduleKey: "dashboard" },
      { name: "Approbations", path: "/approvals", icon: CheckSquare, moduleKey: "dashboard" },
      { name: "Assistant Gaméasù", path: "/assistant", icon: Sparkles, moduleKey: "dashboard" },
    ],
  },
  {
    title: "Commercial",
    items: [
      { name: "Clients", path: "/clients", icon: Building2, moduleKey: "clients" },
      { name: "Pipeline & opportunités", path: "/crm", icon: Target, moduleKey: "sales_crm" },
      { name: "Devis", path: "/proformas", icon: FileSignature, moduleKey: "sales_crm" },
      { name: "Commandes", path: "/orders", icon: ShoppingCart, moduleKey: "sales_crm" },
      { name: "Factures", path: "/invoices", icon: FileText, moduleKey: "sales_crm" },
      { name: "Encaissements", path: "/payments", icon: CreditCard, moduleKey: "sales_crm" },
      { name: "Marketing", path: "/marketing", icon: Megaphone, moduleKey: "marketing" },
    ],
  },
  {
    title: "Projets & Opérations",
    items: [
      { name: "Projets", path: "/projects", icon: FolderKanban, moduleKey: "projects" },
      { name: "Tâches", path: "/tasks", icon: CheckSquare, moduleKey: "tasks" },
      { name: "Services", path: "/services", icon: Briefcase, moduleKey: "services" },
      { name: "Opérations & Logistique", path: "/operations", icon: Truck, moduleKey: "operations" },
      { name: "Parc & équipements", path: "/equipment", icon: Wrench, moduleKey: "inventory_assets" },
      { name: "Produits & Stock", path: "/inventory", icon: Package, moduleKey: "inventory_products" },
      { name: "Locations & inspections", path: "/rentals", icon: ClipboardCheck, moduleKey: "rentals" },
      { name: "Documents", path: "/documents", icon: FolderOpen, moduleKey: "documents" },
    ],
  },
  {
    title: "Finance",
    items: [
      { name: "Comptabilité", path: "/accounting", icon: Calculator, moduleKey: "accounting" },
      { name: "Planification financière", path: "/fpa", icon: TrendingUp, moduleKey: "financial_planning" },
      { name: "Rapports & analytique", path: "/reports", icon: BarChart3, moduleKey: "reports" },
    ],
  },
  {
    title: "Équipe & Communication",
    items: [
      { name: "Équipe & RH", path: "/hr", icon: UsersRound, moduleKey: "team_hr" },
      { name: "Collaborateurs", path: "/collaborators", icon: GraduationCap, moduleKey: "team_hr" },
      { name: "Présences & pointage", path: "/attendance", icon: Clock, moduleKey: "team_hr" },
      { name: "Messagerie", path: "/messaging", icon: MessageSquare, moduleKey: "communications" },
      { name: "Appels", path: "/calls", icon: PhoneCall, moduleKey: "communications" },
    ],
  },
  {
    title: "Administration",
    items: [
      { name: "Console admin", path: "/admin", icon: Shield, moduleKey: "administration" },
      { name: "Automatisations", path: "/automations", icon: Workflow, moduleKey: "administration" },
      { name: "Abonnement & facturation", path: "/billing", icon: CreditCard, moduleKey: "billing_subscription" },
      { name: "Paramètres de l'espace", path: "/workspace-settings", icon: Settings, moduleKey: "workspace_settings" },
      { name: "Support", path: "/tickets", icon: LifeBuoy },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  manager: "Responsable",
  commercial: "Commercial",
  collaborator: "Collaborateur",
  comptable: "Comptable",
  client: "Client",
};

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const Icon = mode === "dark" ? Moon : mode === "light" ? SunIcon : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Apparence"
        >
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 font-sans">
        <DropdownMenuLabel className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Apparence</DropdownMenuLabel>
        {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
          <DropdownMenuItem
            key={m}
            onClick={() => setMode(m)}
            className={`cursor-pointer py-2 text-[13px] ${mode === m ? "text-primary font-medium" : ""}`}
          >
            {m === "light" && <><SunIcon className="w-4 h-4 mr-2" />Clair</>}
            {m === "dark" && <><Moon className="w-4 h-4 mr-2" />Sombre</>}
            {m === "system" && <><Monitor className="w-4 h-4 mr-2" />Système</>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { data: org } = useCurrentOrganization();
  const { data: subData } = useCurrentSubscription();
  const { data: modules } = useOrganizationModules();

  const enabledKeys = useMemo(() => {
    const set = new Set<string>();
    (modules ?? []).forEach((m) => { if (m.enabled) set.add(m.moduleKey); });
    return set;
  }, [modules]);

  const initials = ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "GA";
  const fullName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Utilisateur";
  const roleLabel = user?.role ? (ROLE_LABEL[user.role] || user.role) : "Connecté";

  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [location]);
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const SidebarContent = (
    <>
      {/* Bandeau marque — sobre, sur fond sombre, logo inversé pour un rendu watermark premium */}
      <div className="relative flex items-center justify-between gap-2 px-4 h-16 shrink-0 border-b border-sidebar-border/70 bg-gradient-to-b from-white/[0.025] to-transparent">
        <Link href="/" onClick={() => setMobileOpen(false)} aria-label={BRANDING.appName} className="inline-flex items-center gap-2.5 min-w-0">
          <GaméasùLockup size="sm" variant="dark" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 -mr-2 rounded-md text-white/70 hover:bg-white/[0.06] transition-colors"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Carte workspace */}
      <div className="px-3.5 pt-3.5 pb-1">
        <div className="rounded-md bg-white/[0.04] border border-white/[0.07] px-3 py-2.5 hover:border-white/[0.12] transition-colors">
          <p className="text-[9.5px] font-semibold text-white/45 uppercase tracking-[0.14em] mb-1">Espace de travail</p>
          <p className="text-[13px] font-medium text-white truncate leading-tight">{org?.name ?? "Chargement…"}</p>
          {subData?.plan?.name && (
            <p className="text-[10.5px] text-white/55 mt-1 font-mono uppercase tracking-wider">{subData.plan.name}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-3 pb-5 sidebar-scrollbar overscroll-contain">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="mb-5 px-3.5">
            <h3 className="text-[9.5px] font-semibold text-white/35 mb-2 uppercase tracking-[0.16em] px-2.5">
              {group.title}
            </h3>
            <ul className="space-y-px">
              {group.items.map((item, j) => {
                const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                const locked = item.moduleKey != null && modules != null && !enabledKeys.has(item.moduleKey);
                const href = locked ? `/upgrade-required?module=${item.moduleKey}` : item.path;
                return (
                  <li key={j}>
                    <Link
                      href={href}
                      className={`group relative flex items-center gap-2.5 pl-3 pr-2.5 py-[7px] rounded-md transition-all duration-150 text-[12.5px] font-medium ${
                        active
                          ? "bg-white/[0.08] text-white"
                          : locked
                            ? "text-white/30 hover:text-white/50 hover:bg-white/[0.025]"
                            : "text-white/65 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.55)]" />
                      )}
                      <item.icon
                        className={`w-[15px] h-[15px] shrink-0 transition-colors ${
                          active
                            ? "text-primary"
                            : locked
                              ? "text-white/25"
                              : "text-white/45 group-hover:text-white/80"
                        }`}
                        strokeWidth={1.75}
                      />
                      <span className="truncate flex-1">{item.name}</span>
                      {locked && <Lock className="w-3 h-3 text-white/30" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border/70 shrink-0 bg-black/20">
        <p className="text-[9.5px] text-white/35 text-center font-mono uppercase tracking-[0.14em]">
          {BRANDING.appName} · v1.0
        </p>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background font-sans">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-[252px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col h-full shadow-elev-xl z-10 shrink-0 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.015] via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col h-full">{SidebarContent}</div>
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/55 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[85%] max-w-[300px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-elev-xl transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        {SidebarContent}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        {/* Topbar — institutionnel, hairline, glass subtil */}
        <header className="h-14 bg-card/85 backdrop-blur-md border-b border-border flex items-center justify-between px-3 sm:px-5 lg:px-7 shrink-0 z-10 gap-2 sticky top-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md text-foreground/70 hover:bg-muted transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/" className="lg:hidden inline-flex">
              <span className="text-[15px] font-display font-bold tracking-tight text-foreground">{BRANDING.appShortName}</span>
            </Link>

            {/* Recherche globale */}
            <div className="hidden md:flex items-center text-muted-foreground bg-muted/50 border border-border rounded-md px-3 h-9 w-[340px] focus-within:bg-card focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
              <Search className="w-[15px] h-[15px] mr-2.5 text-muted-foreground/70 shrink-0" strokeWidth={2} />
              <input
                type="text"
                placeholder="Rechercher clients, projets, factures…"
                className="bg-transparent border-none outline-none text-[13px] w-full text-foreground placeholder:text-muted-foreground/65"
              />
              <kbd className="hidden lg:inline-flex ml-2 text-[10px] text-muted-foreground/70 font-mono bg-card border border-border rounded px-1.5 py-0.5 tabular-nums">⌘K</kbd>
            </div>
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted ml-auto"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            <div className="hidden sm:inline-flex items-center gap-2 mr-1">
              <PlanBadge code={subData?.plan.code} name={subData?.plan.name} compact light />
            </div>

            <ThemeToggle />

            <Link
              href="/notifications"
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-card" />
            </Link>

            <div className="w-px h-6 bg-border hidden sm:block mx-1.5" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 sm:gap-2.5 outline-none transition-colors rounded-md px-1.5 py-1 hover:bg-muted">
                  <div className="text-right hidden lg:block">
                    <p className="text-[12.5px] font-semibold leading-none text-foreground">{fullName}</p>
                    <p className="text-[10.5px] text-muted-foreground mt-1 uppercase tracking-wider font-medium">{roleLabel}</p>
                  </div>
                  <Avatar className="w-8 h-8 ring-1 ring-border">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-secondary text-primary font-semibold text-[12px]">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 font-sans">
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <p className="text-[13px] font-semibold leading-none text-foreground">{fullName}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{roleLabel}</p>
                </div>
                <DropdownMenuItem asChild className="cursor-pointer py-2 text-[13px]">
                  <Link href="/workspace-settings"><Settings className="w-4 h-4 mr-2 text-muted-foreground" />Paramètres de l'espace</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer py-2 text-[13px]">
                  <Link href="/billing"><CreditCard className="w-4 h-4 mr-2 text-muted-foreground" />Abonnement & facturation</Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-2 text-[13px]">
                  <UserCircle className="w-4 h-4 mr-2 text-muted-foreground" />Mon profil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer py-2 text-[13px] text-destructive focus:text-destructive"
                  onClick={() => logout()}
                >
                  <LogOut className="w-4 h-4 mr-2" />Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 page-scroll">
          <div className="max-w-[1440px] mx-auto w-full">{children}</div>
        </div>
      </main>
    </div>
  );
};
