import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { NexoraLockup } from "@/components/branding/NexoraLockup";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, Briefcase, Wrench, Truck,
  ClipboardCheck, ShoppingCart, FileText, CreditCard, MessageSquare, PhoneCall,
  Settings, Bell, Search, UserCircle, LogOut, BarChart3, Map as MapIcon, QrCode,
  Calculator, BookOpen, Scale, TrendingUp, Landmark, Building2, PiggyBank, Network,
  GraduationCap, FileSignature, FolderArchive, UsersRound, Megaphone, Target,
  FolderOpen, LifeBuoy, Shield, ExternalLink, Lock, Brain, Workflow, Clock, Flame,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
    title: "Espace de travail",
    items: [
      { name: "Tableau de bord", path: "/", icon: LayoutDashboard, moduleKey: "dashboard" },
      { name: "Centre d'intelligence", path: "/intelligence", icon: Brain, moduleKey: "dashboard" },
      { name: "Automatisations", path: "/automations", icon: Workflow, moduleKey: "dashboard" },
      { name: "Clients", path: "/clients", icon: Building2, moduleKey: "clients" },
      { name: "Services", path: "/services", icon: Briefcase, moduleKey: "services" },
      { name: "Projets", path: "/projects", icon: FolderKanban, moduleKey: "projects" },
      { name: "Tâches", path: "/tasks", icon: CheckSquare, moduleKey: "tasks" },
    ],
  },
  {
    title: "Business",
    items: [
      { name: "Ventes & Relation client", path: "/crm", icon: Target, moduleKey: "sales_crm" },
      { name: "Scoring commercial", path: "/sales/scoring", icon: Flame, moduleKey: "sales_crm" },
      { name: "Devis", path: "/proformas", icon: FileText, moduleKey: "sales_crm" },
      { name: "Bons de commande", path: "/orders", icon: ShoppingCart, moduleKey: "sales_crm" },
      { name: "Factures", path: "/invoices", icon: FileText, moduleKey: "sales_crm" },
      { name: "Encaissements", path: "/payments", icon: CreditCard, moduleKey: "sales_crm" },
      { name: "Comptabilité", path: "/accounting", icon: Calculator, moduleKey: "accounting" },
      { name: "Planification financière", path: "/fpa", icon: TrendingUp, moduleKey: "financial_planning" },
      { name: "Opérations", path: "/logistics", icon: Truck, moduleKey: "operations" },
      { name: "Parc & équipements", path: "/equipment", icon: Wrench, moduleKey: "inventory_assets" },
      { name: "Locations", path: "/rentals", icon: Truck, moduleKey: "rentals" },
      { name: "Inspections", path: "/inspections", icon: ClipboardCheck, moduleKey: "rentals" },
      { name: "Documents", path: "/documents", icon: FolderOpen, moduleKey: "documents" },
      { name: "Équipe & RH", path: "/hr", icon: UsersRound, moduleKey: "team_hr" },
      { name: "Présences & Pointage", path: "/attendance", icon: Clock, moduleKey: "team_hr" },
      { name: "Collaborateurs", path: "/collaborators", icon: GraduationCap, moduleKey: "team_hr" },
      { name: "Communications", path: "/messaging", icon: MessageSquare, moduleKey: "communications" },
      { name: "Appels", path: "/calls", icon: PhoneCall, moduleKey: "communications" },
      { name: "Rapports", path: "/reports", icon: BarChart3, moduleKey: "reports" },
      { name: "Carte", path: "/map", icon: MapIcon, moduleKey: "reports" },
      { name: "Marketing", path: "/marketing", icon: Megaphone, moduleKey: "marketing" },
    ],
  },
  {
    title: "Administration",
    items: [
      { name: "Console admin", path: "/admin", icon: Shield, moduleKey: "administration" },
      { name: "Utilisateurs", path: "/admin/users", icon: UserCircle, moduleKey: "administration" },
      { name: "Rôles & droits", path: "/admin/roles", icon: Briefcase, moduleKey: "administration" },
      { name: "Départements", path: "/admin/departments", icon: Network, moduleKey: "administration" },
      { name: "Invitations", path: "/admin/invitations", icon: UsersRound, moduleKey: "administration" },
      { name: "Journal d'audit", path: "/admin/audit", icon: ClipboardCheck, moduleKey: "administration" },
      { name: "Abonnement & facturation", path: "/billing", icon: CreditCard, moduleKey: "billing_subscription" },
      { name: "Paramètres de l'espace de travail", path: "/workspace-settings", icon: Settings, moduleKey: "workspace_settings" },
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
  useEffect(() => { setMobileOpen(false); }, [location]);
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const SidebarContent = (
    <>
      {/* Bandeau logo Nexora */}
      <div className="relative flex items-center justify-between px-5 h-16 shrink-0 bg-sidebar-accent/30 border-b border-sidebar-border/60">
        <Link href="/" onClick={() => setMobileOpen(false)} aria-label={BRANDING.appName} className="inline-flex">
          <NexoraLockup size="md" variant="dark" />
        </Link>
        <button type="button" onClick={() => setMobileOpen(false)} className="lg:hidden p-2 -mr-2 rounded-md text-sidebar-foreground/70 hover:bg-white/[0.06]" aria-label="Fermer le menu">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Carte workspace + plan */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
          <p className="text-[10px] font-semibold text-sidebar-foreground/45 uppercase tracking-wider">Espace de travail</p>
          <p className="text-[13.5px] font-semibold text-white truncate mt-0.5">{org?.name ?? "Chargement…"}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <PlanBadge code={subData?.plan.code} name={subData?.plan.name} compact />
            <Link href="/billing" className="text-[10.5px] text-[#C8A24B] hover:text-[#E0BE6E] font-semibold uppercase tracking-wider transition-colors">
              Gérer
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 pb-5 custom-scrollbar overscroll-contain">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="mb-5 px-4">
            <h3 className="text-[10px] font-semibold text-sidebar-foreground/35 mb-2.5 uppercase tracking-[0.14em] px-2.5">{group.title}</h3>
            <ul className="space-y-0.5">
              {group.items.map((item, j) => {
                const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                const locked = item.moduleKey != null && modules != null && !enabledKeys.has(item.moduleKey);
                const href = locked ? `/upgrade-required?module=${item.moduleKey}` : item.path;
                return (
                  <li key={j}>
                    <Link
                      href={href}
                      className={`group relative flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg transition-all duration-200 text-[13px] font-medium min-h-[38px] ${
                        active
                          ? "bg-white/[0.07] text-white"
                          : locked
                            ? "text-sidebar-foreground/35 hover:text-sidebar-foreground/55 hover:bg-white/[0.02]"
                            : "text-sidebar-foreground/70 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2.5px] rounded-full bg-[#C8A24B] shadow-[0_0_10px_rgba(200,162,75,0.45)]" />
                      )}
                      <item.icon
                        className={`w-[16px] h-[16px] shrink-0 transition-colors ${
                          active ? "text-[#D9B86A]" : locked ? "text-sidebar-foreground/25" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80"
                        }`}
                        strokeWidth={1.75}
                      />
                      <span className="truncate flex-1">{item.name}</span>
                      {locked && <Lock className="w-3 h-3 text-sidebar-foreground/30" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-sidebar-border/60 shrink-0">
        <p className="text-[10px] text-sidebar-foreground/35 text-center">
          {BRANDING.appName} · {BRANDING.appTaglineFr}
        </p>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background font-sans">
      <aside className="hidden lg:flex w-[268px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col h-full shadow-xl z-10 shrink-0 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col h-full">{SidebarContent}</div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[85%] max-w-[320px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-2xl transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        {SidebarContent}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border/70 flex items-center justify-between px-3 sm:px-6 lg:px-8 shrink-0 z-10 gap-2 sticky top-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button type="button" onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-foreground/70 hover:bg-muted" aria-label="Ouvrir le menu">
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/" className="lg:hidden inline-flex">
              <NexoraLockup size="sm" variant="light" showSlogan={false} />
            </Link>

            <div className="hidden md:flex items-center text-muted-foreground bg-muted/40 border border-border/60 rounded-lg px-3.5 py-2 w-80 focus-within:bg-white focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <Search className="w-4 h-4 mr-2.5 text-muted-foreground/70 shrink-0" />
              <input type="text" placeholder="Rechercher clients, projets, factures…" className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground/70" />
              <kbd className="hidden lg:inline-flex ml-2 text-[10px] text-muted-foreground/70 font-mono bg-background border border-border rounded px-1.5 py-0.5">⌘K</kbd>
            </div>
            <button type="button" className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted ml-auto" aria-label="Rechercher">
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="hidden sm:inline-flex items-center gap-2">
              <PlanBadge code={subData?.plan.code} name={subData?.plan.name} compact light />
            </div>

            <Link href="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-card"></span>
            </Link>

            <div className="w-px h-6 bg-border/70 hidden sm:block mx-1"></div>

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
                <DropdownMenuItem className="cursor-pointer py-2.5">
                  <UserCircle className="w-4 h-4 mr-2 text-muted-foreground" />Mon profil
                </DropdownMenuItem>
                <div className="h-px bg-border my-1"></div>
                <DropdownMenuItem className="cursor-pointer py-2.5 text-destructive focus:text-destructive" onClick={() => logout()}>
                  <LogOut className="w-4 h-4 mr-2" />Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8 page-scroll">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </div>
      </main>
    </div>
  );
};
