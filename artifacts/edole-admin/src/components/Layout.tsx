import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Briefcase,
  Wrench,
  Truck,
  ClipboardCheck,
  ShoppingCart,
  FileText,
  CreditCard,
  MessageSquare,
  PhoneCall,
  Settings,
  Bell,
  Search,
  UserCircle,
  LogOut,
  HardHat,
  BarChart3,
  Map as MapIcon,
  QrCode,
  Calculator,
  BookOpen,
  Scale,
  TrendingUp,
  Landmark,
  Building2,
  PiggyBank,
  Network,
  GraduationCap,
  FileSignature,
  FolderArchive,
  UsersRound,
  Megaphone,
  Target,
  FolderOpen,
  LifeBuoy,
  Bell as BellIcon
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoFull from "@/assets/edole-logo-transparent.png";

const NAV_GROUPS = [
  {
    title: "Espace de travail",
    items: [
      { name: "Tableau de bord", path: "/", icon: LayoutDashboard },
      { name: "Messagerie", path: "/messaging", icon: MessageSquare },
      { name: "Appels", path: "/calls", icon: PhoneCall },
      { name: "Clients", path: "/clients", icon: Building2 },
      { name: "Services", path: "/services", icon: Briefcase },
      { name: "Projets", path: "/projects", icon: FolderKanban },
      { name: "Tâches", path: "/tasks", icon: CheckSquare },
      { name: "Documents", path: "/documents", icon: FolderOpen },
    ]
  },
  {
    title: "Pilotage",
    items: [
      { name: "Rapports", path: "/reports", icon: BarChart3 },
      { name: "Carte", path: "/map", icon: MapIcon },
      { name: "Alertes", path: "/alerts", icon: BellIcon },
      { name: "Support", path: "/tickets", icon: LifeBuoy },
    ]
  },
  {
    title: "Matériel",
    items: [
      { name: "Inventaire", path: "/equipment", icon: Wrench },
      { name: "Étiquettes QR", path: "/equipment/qr", icon: QrCode },
      { name: "Locations", path: "/rentals", icon: Truck },
      { name: "Inspections", path: "/inspections", icon: ClipboardCheck },
      { name: "Logistique", path: "/logistics", icon: Truck },
    ]
  },
  {
    title: "Commercial",
    items: [
      { name: "Catalogue services", path: "/commercial/services", icon: Briefcase },
      { name: "Pipeline CRM", path: "/crm", icon: Briefcase },
      { name: "Bons de commande", path: "/orders", icon: ShoppingCart },
      { name: "Devis", path: "/proformas", icon: FileText },
      { name: "Factures", path: "/invoices", icon: FileText },
      { name: "Encaissements", path: "/payments", icon: CreditCard },
    ]
  },
  {
    title: "Marketing",
    items: [
      { name: "Campagnes", path: "/marketing", icon: Megaphone },
      { name: "Prospects", path: "/marketing/prospects", icon: Target },
    ]
  },
  {
    title: "Ressources Humaines",
    items: [
      { name: "Tableau RH", path: "/hr", icon: UsersRound },
      { name: "Collaborateurs", path: "/collaborators", icon: HardHat },
      { name: "Départements", path: "/hr/departments", icon: Network },
      { name: "Postes", path: "/hr/positions", icon: GraduationCap },
      { name: "Affectations", path: "/hr/assignments", icon: Briefcase },
      { name: "Contrats", path: "/hr/contracts", icon: FileSignature },
      { name: "Documents RH", path: "/hr/documents", icon: FolderArchive },
      { name: "Utilisateurs", path: "/users", icon: UserCircle },
    ]
  },
  {
    title: "Comptabilité",
    items: [
      { name: "Tableau financier", path: "/accounting", icon: Calculator },
      { name: "Plan comptable", path: "/accounting/chart-of-accounts", icon: BookOpen },
      { name: "Écritures", path: "/accounting/entries", icon: FileText },
      { name: "Grand livre", path: "/accounting/ledger", icon: BookOpen },
      { name: "Balance", path: "/accounting/balance", icon: Scale },
      { name: "Résultat", path: "/accounting/income-statement", icon: TrendingUp },
      { name: "Bilan", path: "/accounting/balance-sheet", icon: Scale },
      { name: "Comptes clients", path: "/accounting/customers", icon: Users },
      { name: "Fournisseurs", path: "/accounting/suppliers", icon: Building2 },
      { name: "Banques & caisses", path: "/accounting/banks", icon: Landmark },
      { name: "Immobilisations", path: "/accounting/fixed-assets", icon: PiggyBank },
    ]
  },
  {
    title: "Pilotage financier",
    items: [
      { name: "Tableau de bord", path: "/fpa", icon: Target },
      { name: "Budget", path: "/fpa/budgets", icon: BookOpen },
      { name: "Analyse de variance", path: "/fpa/variance", icon: TrendingUp },
      { name: "Forecast & projection", path: "/fpa/forecast", icon: BarChart3 },
      { name: "Reporting & exports", path: "/fpa/reports", icon: FileText },
    ]
  },
  {
    title: "Administration",
    items: [
      { name: "Console admin", path: "/admin", icon: Settings },
      { name: "Utilisateurs", path: "/admin/users", icon: UserCircle },
      { name: "Invitations", path: "/admin/invitations", icon: UsersRound },
      { name: "Rôles & droits", path: "/admin/roles", icon: Briefcase },
      { name: "Départements", path: "/admin/departments", icon: Network },
      { name: "Journal d'audit", path: "/admin/audit", icon: ClipboardCheck },
    ]
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  manager: "Responsable",
  commercial: "Commercial",
  technicien: "Technicien",
  comptable: "Comptable",
  client: "Client",
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const initials = ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "ED";
  const fullName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Utilisateur";
  const roleLabel = user?.role ? (ROLE_LABEL[user.role] || user.role) : "Connecté";

  const [mobileOpen, setMobileOpen] = useState(false);
  // Ferme le drawer à chaque navigation
  useEffect(() => { setMobileOpen(false); }, [location]);
  // Empêche le scroll du body quand le drawer est ouvert
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const SidebarContent = (
    <>
      {/* Zone logo : fond ivoire chaleureux premium, harmonieux avec l'orange EDOLE */}
      <div
        className="relative flex items-center justify-between px-6 py-5 shrink-0 border-b border-black/[0.04]"
        style={{
          background: "linear-gradient(180deg, #f7f1e6 0%, #f2ebde 100%)",
          boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.02), 0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          aria-label="Tableau de bord"
          className="inline-flex items-center rounded-md transition-opacity hover:opacity-90"
        >
          <img
            src={logoFull}
            alt="édolé"
            className="h-14 w-auto object-contain select-none cursor-pointer"
            draggable={false}
          />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 -mr-2 rounded-md text-foreground/70 hover:bg-black/[0.05] active:bg-black/[0.08]"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-5 custom-scrollbar overscroll-contain">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="mb-6 px-4">
            <h3 className="text-[10px] font-semibold text-sidebar-foreground/35 mb-2.5 uppercase tracking-[0.14em] px-2.5">
              {group.title}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map((item, j) => {
                const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <li key={j}>
                    <Link
                      href={item.path}
                      className={`group relative flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg transition-all duration-200 text-[13.5px] font-medium min-h-[40px] ${
                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-sidebar-foreground/70 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                      )}
                      <item.icon
                        className={`w-[17px] h-[17px] shrink-0 transition-colors ${
                          active ? "text-orange-400" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80"
                        }`}
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-sidebar-border/60 shrink-0">
        <Link
          href="/settings"
          className="group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-[13.5px] font-medium text-sidebar-foreground/70 hover:bg-white/[0.04] hover:text-white min-h-[40px]"
        >
          <Settings className="w-[17px] h-[17px] text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80" strokeWidth={1.75} />
          Configuration
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background font-sans">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-[260px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col h-full shadow-xl z-10 shrink-0 relative">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col h-full">{SidebarContent}</div>
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[82%] max-w-[320px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-2xl transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        {SidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border/70 flex items-center justify-between px-3 sm:px-6 lg:px-8 shrink-0 z-10 gap-2 sticky top-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Hamburger mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-foreground/70 hover:bg-muted active:bg-muted/80 shrink-0"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            {/* Logo mobile (au lieu de la sidebar) */}
            <Link href="/" className="lg:hidden inline-flex">
              <img src={logoFull} alt="édolé" className="h-9 w-auto object-contain shrink-0" draggable={false} />
            </Link>

            {/* Recherche : icône seule en mobile, complète en desktop */}
            <div className="hidden md:flex items-center text-muted-foreground bg-muted/40 border border-border/60 rounded-lg px-3.5 py-2 w-80 focus-within:bg-white focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <Search className="w-4 h-4 mr-2.5 text-muted-foreground/70 shrink-0" />
              <input
                type="text"
                placeholder="Rechercher clients, chantiers, factures…"
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground/70"
              />
              <kbd className="hidden lg:inline-flex ml-2 text-[10px] text-muted-foreground/70 font-mono bg-background border border-border rounded px-1.5 py-0.5">⌘K</kbd>
            </div>
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted active:bg-muted/80 ml-auto"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link href="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted active:bg-muted/80">
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-card"></span>
            </Link>

            <div className="w-px h-6 bg-border/70 hidden sm:block mx-1"></div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 sm:gap-2.5 outline-none transition-all rounded-lg px-1.5 py-1 hover:bg-muted active:bg-muted/80">
                  <div className="text-right hidden lg:block">
                    <p className="text-[13px] font-semibold leading-none text-foreground">{fullName}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{roleLabel}</p>
                  </div>
                  <Avatar className="w-9 h-9 ring-2 ring-border">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-gradient-to-br from-primary to-orange-600 text-white font-semibold text-sm">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 font-sans">
                <div className="px-3 py-2 lg:hidden border-b border-border mb-1">
                  <p className="text-sm font-medium leading-none text-foreground">{fullName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{roleLabel}</p>
                </div>
                <DropdownMenuItem className="cursor-pointer py-2.5">
                  <UserCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                  Mon profil
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-2.5">
                  <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
                  Préférences
                </DropdownMenuItem>
                <div className="h-px bg-border my-1"></div>
                <DropdownMenuItem className="cursor-pointer py-2.5 text-destructive focus:text-destructive" onClick={() => logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8 page-scroll">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

