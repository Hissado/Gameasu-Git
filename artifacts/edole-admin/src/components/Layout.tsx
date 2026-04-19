import React from "react";
import { Link, useLocation } from "wouter";
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
  Bell as BellIcon
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoFull from "@/assets/edole-logo.png";

const NAV_GROUPS = [
  {
    title: "Pilotage",
    items: [
      { name: "Tableau de bord", path: "/", icon: LayoutDashboard },
      { name: "Rapports", path: "/reports", icon: BarChart3 },
      { name: "Carte", path: "/map", icon: MapIcon },
      { name: "Alertes", path: "/alerts", icon: BellIcon },
      { name: "Documents", path: "/documents", icon: FolderOpen },
    ]
  },
  {
    title: "Communication",
    items: [
      { name: "Messagerie", path: "/messaging", icon: MessageSquare },
      { name: "Appels", path: "/calls", icon: PhoneCall },
    ]
  },
  {
    title: "Opérations",
    items: [
      { name: "Chantiers", path: "/projects", icon: FolderKanban },
      { name: "Tâches", path: "/tasks", icon: CheckSquare },
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
      { name: "Clients", path: "/commercial/clients", icon: Building2 },
      { name: "Services", path: "/commercial/services", icon: Briefcase },
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

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full shadow-xl z-10">
        <div className="bg-white border-b border-sidebar-border flex items-center justify-center px-5 py-4 shrink-0">
          <img src={logoFull} alt="édolé — Le numérique au service du BTP" className="h-14 w-auto object-contain select-none" draggable={false} />
        </div>

        <div className="flex-1 overflow-y-auto py-6 custom-scrollbar">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className="mb-6 px-4">
              <h3 className="text-[10px] font-bold text-sidebar-foreground/40 mb-2 uppercase tracking-widest px-3">
                {group.title}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item, j) => {
                  const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  return (
                    <li key={j}>
                      <Link
                        href={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-all duration-200 text-sm font-medium ${
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className={`w-4 h-4 ${active ? "text-white" : "text-sidebar-foreground/50"}`} strokeWidth={active ? 2.5 : 2} />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-sm transition-colors text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Settings className="w-4 h-4 text-sidebar-foreground/50" />
            Configuration
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Topbar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-8 shrink-0 shadow-sm z-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center text-muted-foreground bg-muted/50 border border-border/50 rounded px-3 py-2 w-72 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
            <Search className="w-4 h-4 mr-2 text-muted-foreground/70" />
            <input 
              type="text" 
              placeholder="Rechercher (Chantier, Matériel, Client, Collaborateur)..." 
              className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
            />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-card"></span>
            </Link>

            <div className="w-px h-6 bg-border"></div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 outline-none hover:opacity-80 transition-opacity">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium leading-none text-foreground">{fullName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{roleLabel}</p>
                  </div>
                  <Avatar className="w-9 h-9 border border-border">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-sans">
                <DropdownMenuItem className="cursor-pointer py-2">
                  <UserCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                  Mon profil
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-2">
                  <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
                  Préférences
                </DropdownMenuItem>
                <div className="h-px bg-border my-1"></div>
                <DropdownMenuItem className="cursor-pointer py-2 text-destructive focus:text-destructive" onClick={() => logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

