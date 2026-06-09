import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, CheckSquare, Briefcase, Wrench, Truck,
  ClipboardCheck, ShoppingCart, FileText, CreditCard, MessageSquare, PhoneCall,
  Settings, Bell, Search, UserCircle, LogOut, BarChart3,
  Calculator, TrendingUp, Landmark, Building2, Network,
  GraduationCap, FileSignature, FolderArchive, UsersRound, Megaphone, Target,
  FolderOpen, LifeBuoy, Shield, Lock, Brain, Workflow, Clock, Sparkles, Sun, Crown, Package, Tag, MinusCircle,
  Gauge, FolderKanban, Users2, LayoutGrid, Activity,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BRANDING } from "@/config/branding";
import { PlanBadge } from "@/components/PlanBadge";
import { useCurrentOrganization, useCurrentSubscription, useOrganizationModules } from "@/lib/saas";
import { KoffiChat } from "@/components/KoffiChat";
import { GlobalSearch, useGlobalSearch } from "@/components/GlobalSearch";

type NavItem = {
  name: string; path: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  moduleKey?: string;
};
type NavGroup = {
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Pilotage",
    icon: Gauge,
    items: [
      { name: "Tableau de bord",    path: "/",            icon: LayoutDashboard, moduleKey: "dashboard" },
      { name: "Briefing du jour",   path: "/briefing",    icon: Sun,             moduleKey: "dashboard" },
      { name: "Cockpit IA",         path: "/intelligence",icon: Brain,           moduleKey: "dashboard" },
      { name: "Approbations",       path: "/approvals",   icon: CheckSquare,     moduleKey: "dashboard" },
    ],
  },
  {
    title: "Commercial",
    icon: TrendingUp,
    items: [
      { name: "Pipeline & opportunités", path: "/crm",          icon: Target,        moduleKey: "sales_crm" },
      { name: "Clients",                 path: "/clients",       icon: Building2,     moduleKey: "clients" },
      { name: "Calculateur tarifaire",   path: "/pricing",       icon: Tag,           moduleKey: "sales_crm" },
      { name: "Devis",                   path: "/proformas",     icon: FileSignature, moduleKey: "sales_crm" },
      { name: "Commandes",               path: "/orders",        icon: ShoppingCart,  moduleKey: "sales_crm" },
      { name: "Factures",                path: "/invoices",      icon: FileText,      moduleKey: "sales_crm" },
      { name: "Encaissements",           path: "/payments",      icon: CreditCard,    moduleKey: "sales_crm" },
      { name: "Avoirs",                  path: "/credit-notes",  icon: MinusCircle,   moduleKey: "sales_crm" },
      { name: "Marketing",               path: "/marketing",     icon: Megaphone,     moduleKey: "marketing" },
    ],
  },
  {
    title: "Projets & Opérations",
    icon: FolderKanban,
    items: [
      { name: "Projets",                path: "/projects",   icon: FolderKanban, moduleKey: "projects" },
      { name: "Portefeuille",            path: "/portfolio",  icon: LayoutGrid,     moduleKey: "projects" },
      { name: "Charge d'équipe",         path: "/workload",   icon: Activity,       moduleKey: "projects" },
      { name: "Tâches",                  path: "/tasks",      icon: CheckSquare,    moduleKey: "tasks" },
      { name: "Missions & services",     path: "/services",   icon: Briefcase,      moduleKey: "services" },
      { name: "Opérations & logistique", path: "/operations", icon: Truck,          moduleKey: "operations" },
      { name: "Parc & équipements",      path: "/equipment",  icon: Wrench,         moduleKey: "inventory_assets" },
      { name: "Produits & stock",        path: "/inventory",  icon: Package,        moduleKey: "inventory_products" },
      { name: "Locations & inspections", path: "/rentals",    icon: ClipboardCheck, moduleKey: "rentals" },
      { name: "Documents",               path: "/documents",  icon: FolderOpen,     moduleKey: "documents" },
    ],
  },
  {
    title: "Finance",
    icon: Landmark,
    items: [
      { name: "Comptabilité",           path: "/accounting", icon: Calculator,  moduleKey: "accounting" },
      { name: "Planification financière",path: "/fpa",       icon: TrendingUp,  moduleKey: "financial_planning" },
      { name: "Rapports & analytique",  path: "/reports",    icon: BarChart3,   moduleKey: "reports" },
    ],
  },
  {
    title: "Équipe & Communication",
    icon: Users2,
    items: [
      { name: "Équipe & RH",        path: "/hr",            icon: UsersRound,    moduleKey: "team_hr" },
      { name: "Collaborateurs",     path: "/collaborators", icon: GraduationCap, moduleKey: "team_hr" },
      { name: "Présences & pointage",path: "/attendance",   icon: Clock,         moduleKey: "team_hr" },
      { name: "Messagerie",         path: "/messaging",     icon: MessageSquare, moduleKey: "communications" },
      { name: "Appels",             path: "/calls",         icon: PhoneCall,     moduleKey: "communications" },
    ],
  },
  {
    title: "Administration",
    icon: Shield,
    items: [
      { name: "Console admin",           path: "/admin",               icon: Shield,    moduleKey: "administration" },
      { name: "Automatisations",         path: "/automations",          icon: Workflow,  moduleKey: "administration" },
      { name: "Abonnement & facturation",path: "/billing",              icon: CreditCard,moduleKey: "billing_subscription" },
      { name: "Paramètres de l'espace",  path: "/workspace-settings",   icon: Settings,  moduleKey: "workspace_settings" },
      { name: "Support",                 path: "/tickets",              icon: LifeBuoy },
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

function isGroupActive(group: NavGroup, location: string) {
  return group.items.some(
    (item) => location === item.path || (item.path !== "/" && location.startsWith(item.path))
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

  const initials = ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "NX";
  const fullName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Utilisateur";
  const roleLabel = user?.role ? (ROLE_LABEL[user.role] || user.role) : "Connecté";

  const [mobileOpen, setMobileOpen] = useState(false);
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();

  // Collapsible groups — open the active one by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    NAV_GROUPS.forEach((g) => {
      if (isGroupActive(g, location)) initial.add(g.title);
    });
    return initial;
  });

  // Auto-expand the group containing the active page on navigation
  useEffect(() => {
    setMobileOpen(false);
    const activeGroup = NAV_GROUPS.find((g) => isGroupActive(g, location));
    if (activeGroup) {
      setOpenGroups((prev) => {
        if (prev.has(activeGroup.title)) return prev;
        const next = new Set(prev);
        next.add(activeGroup.title);
        return next;
      });
    }
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const SidebarContent = (
    <>
      {/* ── Logo area ─────────────────────────────────────────────── */}
      <div className="shrink-0 h-16 flex items-center px-5 border-b border-white/[0.07] relative">
        <Link href="/" aria-label={BRANDING.appName} className="flex items-center min-w-0 flex-1 group/logo" onClick={() => setMobileOpen(false)}>
          <img
            src={BRANDING.logoFull}
            alt={BRANDING.appName}
            draggable={false}
            className="h-8 w-auto object-contain select-none max-w-[160px] group-hover/logo:opacity-90 transition-opacity duration-200"
            style={{ filter: "brightness(0) invert(1)", opacity: 0.95 }}
          />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden ml-auto p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
          aria-label="Fermer le menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Workspace card ────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1 shrink-0">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] border border-white/[0.07] px-3 py-2.5 hover:bg-white/[0.07] transition-colors cursor-default">
          <div className="w-7 h-7 rounded-md bg-[#C8A24B]/20 border border-[#C8A24B]/30 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-black text-[#C8A24B]">{(org?.name || "?")[0].toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-white/90 truncate leading-none">{org?.name ?? "…"}</p>
            <p className="text-[9.5px] text-white/35 mt-0.5 uppercase tracking-wider">Espace de travail</p>
          </div>
          {subData && <PlanBadge code={subData.plan.code} name={subData.plan.name} compact light />}
        </div>
      </div>

      {/* ── Navigation groups ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pt-2 pb-4 custom-scrollbar overscroll-contain">
        <nav className="px-2 space-y-0.5">
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups.has(group.title);
            const hasActive = isGroupActive(group, location);
            const GroupIcon = group.icon;

            return (
              <div key={group.title}>
                {/* Group header — clickable toggle */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                    transition-all duration-150 text-left select-none
                    ${hasActive && !isOpen
                      ? "bg-white/[0.05] text-white/90"
                      : isOpen
                        ? "bg-white/[0.04] text-white/80"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                    }
                  `}
                >
                  <GroupIcon
                    className={`w-[15px] h-[15px] shrink-0 transition-colors duration-150 ${
                      hasActive ? "text-[#C8A24B]" : isOpen ? "text-white/50" : "text-white/25"
                    }`}
                    strokeWidth={hasActive ? 2 : 1.75}
                  />
                  <span className={`flex-1 text-[11.5px] font-bold uppercase tracking-[0.08em] transition-colors duration-150`}>
                    {group.title}
                  </span>
                  {/* Active dot when group collapsed and has active item */}
                  {hasActive && !isOpen && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8A24B] shadow-[0_0_6px_rgba(200,162,75,0.6)]" />
                  )}
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isOpen ? "rotate-90 text-white/40" : "text-white/20"
                    }`}
                    strokeWidth={2}
                  />
                </button>

                {/* Collapsible items — smooth CSS grid animation */}
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <ul className="pt-0.5 pb-1 pl-2 space-y-0.5">
                      {group.items.map((item) => {
                        const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                        const locked = item.moduleKey != null && modules != null && !enabledKeys.has(item.moduleKey);
                        const href = locked ? `/upgrade-required?module=${item.moduleKey}` : item.path;

                        return (
                          <li key={item.path}>
                            <Link
                              href={href}
                              className={`
                                group/item relative flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg
                                text-[12.5px] font-medium transition-all duration-150
                                ${active
                                  ? "bg-white/[0.08] text-white"
                                  : locked
                                    ? "text-white/25 hover:text-white/40 hover:bg-white/[0.02]"
                                    : "text-white/55 hover:text-white/85 hover:bg-white/[0.05]"
                                }
                              `}
                            >
                              {/* Active left accent bar */}
                              {active && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-[#C8A24B] shadow-[0_0_8px_rgba(200,162,75,0.5)]" />
                              )}
                              <item.icon
                                className={`w-[14px] h-[14px] shrink-0 transition-colors duration-150 ${
                                  active
                                    ? "text-[#D9B86A]"
                                    : locked
                                      ? "text-white/20"
                                      : "text-white/35 group-hover/item:text-white/60"
                                }`}
                                strokeWidth={active ? 2 : 1.75}
                              />
                              <span className="truncate flex-1">{item.name}</span>
                              {locked && <Lock className="w-3 h-3 text-white/20 shrink-0" strokeWidth={2} />}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Super admin section */}
          {user?.role === "super_admin" && (() => {
            const isActive = location.startsWith("/super-admin");
            return (
              <div className="pt-1 mt-1 border-t border-white/[0.06]">
                <Link
                  href="/super-admin"
                  className={`
                    group/item relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                    text-[11.5px] font-bold uppercase tracking-[0.08em] transition-all duration-150
                    ${isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                    }
                  `}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-[#C8A24B] shadow-[0_0_8px_rgba(200,162,75,0.5)]" />
                  )}
                  <Crown
                    className={`w-[15px] h-[15px] shrink-0 ${isActive ? "text-[#C8A24B]" : "text-white/25"}`}
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  <span className="flex-1">Cockpit plateforme</span>
                </Link>
              </div>
            );
          })()}
        </nav>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
        <p className="text-[9.5px] text-white/20 text-center tracking-wide">
          {BRANDING.appName} · v2026
        </p>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background font-sans">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[260px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col h-full shadow-xl z-10 shrink-0 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.015] via-transparent to-black/[0.08] pointer-events-none" />
        <div className="relative flex flex-col h-full">{SidebarContent}</div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[82%] max-w-[300px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-2xl transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        {SidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-card/95 backdrop-blur-md border-b border-border/60 flex items-center justify-between px-3 sm:px-6 lg:px-8 shrink-0 z-10 gap-2 sticky top-0 shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-foreground/70 hover:bg-muted"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            {/* Mobile logo */}
            <span className="lg:hidden inline-flex items-center">
              <img
                src={BRANDING.logoMark}
                alt={BRANDING.appName}
                className="h-7 w-auto object-contain"
                style={{ maxWidth: "130px" }}
                draggable={false}
              />
            </span>

            {/* Global search trigger — desktop */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2.5 text-muted-foreground bg-muted/40 hover:bg-muted/70 border border-border/60 rounded-lg px-3.5 py-2 w-80 transition-all group"
            >
              <Search className="w-4 h-4 text-muted-foreground/70 shrink-0" />
              <span className="text-sm text-muted-foreground/70 flex-1 text-left">Rechercher clients, projets, factures…</span>
              <kbd className="hidden lg:inline-flex text-[10px] text-muted-foreground/70 font-mono bg-background border border-border rounded px-1.5 py-0.5 shrink-0">⌘K</kbd>
            </button>

            {/* Global search trigger — mobile */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted ml-auto"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="hidden sm:inline-flex items-center gap-2">
              <PlanBadge code={subData?.plan.code} name={subData?.plan.name} compact light />
            </div>

            <Link href="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-card" />
            </Link>

            <div className="w-px h-6 bg-border/70 hidden sm:block mx-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 sm:gap-2.5 outline-none transition-all rounded-lg px-1.5 py-1 hover:bg-muted">
                  <div className="text-right hidden lg:block">
                    <p className="text-[13px] font-semibold leading-none text-foreground">{fullName}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{roleLabel}</p>
                  </div>
                  <Avatar className="w-9 h-9 ring-2 ring-border">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-[#0F1A3A] text-[#C8A24B] font-semibold text-sm">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 font-sans">
                <div className="px-3 py-2 lg:hidden border-b border-border mb-1">
                  <p className="text-sm font-medium leading-none text-foreground">{fullName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{roleLabel}</p>
                </div>
                <DropdownMenuItem asChild className="cursor-pointer py-2.5">
                  <Link href="/workspace-settings"><Settings className="w-4 h-4 mr-2 text-muted-foreground" />Paramètres de l'espace</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer py-2.5">
                  <Link href="/billing"><CreditCard className="w-4 h-4 mr-2 text-muted-foreground" />Abonnement & facturation</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer py-2.5">
                  <Link href="/mon-espace"><BarChart3 className="w-4 h-4 mr-2 text-muted-foreground" />Mon espace</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer py-2.5">
                  <Link href="/profile"><UserCircle className="w-4 h-4 mr-2 text-muted-foreground" />Mon profil</Link>
                </DropdownMenuItem>
                <div className="h-px bg-border my-1" />
                <DropdownMenuItem className="cursor-pointer py-2.5 text-destructive focus:text-destructive" onClick={() => logout()}>
                  <LogOut className="w-4 h-4 mr-2" />Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 page-scroll bg-background">
          <div className="max-w-[1440px] mx-auto w-full">{children}</div>
        </div>
      </main>

      {/* ── Koffi — assistant flottant universel ─────────────────────────────── */}
      <KoffiChat />

      {/* ── Recherche globale ─────────────────────────────────────────────────── */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
