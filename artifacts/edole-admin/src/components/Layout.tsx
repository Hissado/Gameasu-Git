import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useActiveFirm, useExpertClients, getActiveFirmId, setActiveFirmId, getContextOrgId, setContextOrgId, useSwitchClientContext } from "@/lib/expert-api";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronRight, Database, CalendarCheck, ChevronDown, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, CheckSquare, Briefcase, Wrench, Truck,
  ClipboardCheck, ShoppingCart, FileText, CreditCard, MessageSquare, PhoneCall,
  Settings, Bell, Search, UserCircle, LogOut, BarChart3,
  Calculator, TrendingUp, Landmark, Building2, Network,
  GraduationCap, FileSignature, FolderArchive, UsersRound, Megaphone, Target,
  FolderOpen, LifeBuoy, Shield, Lock, Brain, Workflow, Clock, Sparkles, Sun, Package, Tag, MinusCircle,
  Gauge, FolderKanban, Users2, LayoutGrid, Activity, MonitorSmartphone, HelpCircle, Plus,
  Banknote, Flame, ArrowLeftRight, CheckCircle2, Bot, Lightbulb, BookOpen,
  ShieldCheck, ScanLine,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BRANDING } from "@/config/branding";
import { SubscriptionWidget } from "@/components/SubscriptionWidget";
import { AboutDialog } from "@/components/AboutDialog";
import { useCurrentOrganization, useOrganizationModules } from "@/lib/saas";
import { usePermissions } from "@/lib/permissions";
import { KoffiChat } from "@/components/KoffiChat";
import { GlobalSearch, useGlobalSearch } from "@/components/GlobalSearch";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { SuggestionDialog } from "@/components/SuggestionDialog";
import { TOUR_MODULE_MAP, RELAUNCH_EVENT, GuidesPanel } from "@/components/ui/onboarding-tour";

type NavItem = {
  name: string; path: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  moduleKey?: string;
  permissionKey?: string;
  secondary?: boolean;
  description?: string;
  roles?: string[];
};
type NavGroup = {
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  items: NavItem[];
  isNew?: boolean;
  moduleKey?: string;
  description?: string;
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Accueil",
    icon: Gauge,
    description: "Retrouvez une vue d'ensemble de votre activité, vos indicateurs clés et les actions prioritaires.",
    items: [
      { name: "Tableau de bord",   path: "/",                    icon: LayoutDashboard, moduleKey: "dashboard",       description: "Visualisez vos principaux indicateurs et suivez la performance de votre organisation." },
      { name: "Briefing du jour",  path: "/briefing",            icon: Sun,             moduleKey: "dashboard",       description: "Consultez votre récapitulatif quotidien personnalisé : approbations en attente, événements et actions prioritaires." },
      { name: "Messagerie",        path: "/messaging",           icon: MessageSquare,   moduleKey: "communications",  permissionKey: "messaging.use",            description: "Échangez en temps réel avec vos équipes : DM, groupes, pièces jointes et présence instantanée." },
      { name: "Appels",            path: "/appels",              icon: PhoneCall,       moduleKey: "communications",  permissionKey: "messaging.use",            description: "Consultez le journal de vos appels WebRTC : historique, durée, participants et enregistrements." },
      { name: "Intelligence IA",   path: "/intelligence",        icon: Brain,           moduleKey: "dashboard",       permissionKey: "ai.view_insights", secondary: true, description: "Exploitez vos données métier grâce à l'analyse prédictive et aux recommandations intelligentes automatiques." },
      { name: "Assistant IA",      path: "/assistant-ia",        icon: Bot,             moduleKey: "ai_assistant",    permissionKey: "ai.view_insights",         description: "Posez vos questions métier à votre assistant IA : rédigez, analysez et obtenez des réponses en français." },
      { name: "Approbations",      path: "/approbations",        icon: CheckSquare,     moduleKey: "dashboard",       secondary: true,                           description: "Traitez les demandes en attente de votre approbation ou signature en un seul espace." },
      { name: "Mon espace",        path: "/mon-espace",          icon: UserCircle,      moduleKey: "dashboard",                                                  description: "Votre espace personnel : bulletins de paie, congés, présences, avances et documents RH." },
      { name: "Documents cabinet", path: "/documents-cabinet",   icon: FileText,                                                                                description: "Déposez vos fichiers directement depuis l'ERP pour répondre aux demandes de votre cabinet comptable." },
    ],
  },
  {
    title: "Ventes",
    icon: TrendingUp,
    description: "Gérez vos prospects, clients, devis, factures, commandes et encaissements.",
    items: [
      { name: "Marketing",     path: "/marketing",    icon: Megaphone,     moduleKey: "marketing",  permissionKey: "marketing.read",  description: "Gérez vos campagnes, audiences, prospects et performances marketing depuis un seul espace." },
      { name: "Pipeline CRM",  path: "/crm",          icon: Target,        moduleKey: "sales_crm",  permissionKey: "commercial.read", description: "Suivez vos prospects, opportunités commerciales, relances et relations clients." },
      { name: "Clients",       path: "/clients",      icon: Building2,     moduleKey: "clients",    permissionKey: "clients.read",    description: "Gérez les informations, contacts, documents et historiques de vos clients." },
      { name: "Tarification",  path: "/tarification", icon: Tag,           moduleKey: "sales_crm",  permissionKey: "commercial.read", description: "Définissez vos grilles de prix, remises par segment client et conditions commerciales." },
      { name: "Devis",         path: "/devis",        icon: FileSignature, moduleKey: "sales_crm",  permissionKey: "commercial.read", description: "Créez, envoyez et suivez vos propositions commerciales." },
      { name: "Commandes",     path: "/commandes",    icon: ShoppingCart,  moduleKey: "sales_crm",  permissionKey: "commercial.read", description: "Créez et suivez vos bons de commande clients : statut, livraisons, facturation et historique complet." },
      { name: "Factures",      path: "/factures",     icon: FileText,      moduleKey: "sales_crm",  permissionKey: "commercial.read", description: "Émettez des factures professionnelles et suivez leur statut jusqu'au règlement." },
      { name: "Encaissements", path: "/paiements",    icon: CreditCard,    moduleKey: "sales_crm",  permissionKey: "commercial.read", description: "Enregistrez les paiements reçus et affectez-les aux factures correspondantes." },
      { name: "Avoirs",        path: "/avoirs",       icon: MinusCircle,   moduleKey: "sales_crm",  permissionKey: "commercial.read", secondary: true, description: "Émettez des avoirs et notes de crédit pour corriger vos facturations ou rembourser vos clients." },
    ],
  },
  {
    title: "Projets",
    icon: FolderKanban,
    description: "Planifiez vos projets, répartissez les tâches et suivez les budgets, délais et résultats.",
    items: [
      { name: "Projets",       path: "/projets",      icon: FolderKanban, moduleKey: "projects",  permissionKey: "projects.read",  description: "Créez et pilotez les objectifs, budgets, responsables et échéances de vos projets." },
      { name: "Tâches",        path: "/tasks",        icon: CheckSquare,  moduleKey: "tasks",     permissionKey: "tasks.read",     description: "Créez, assignez et suivez les actions nécessaires à la réalisation des projets." },
      { name: "Portefeuille",  path: "/portefeuille", icon: LayoutGrid,   moduleKey: "projects",  permissionKey: "projects.read",  secondary: true, description: "Analysez l'avancement, les coûts, les délais et la performance de tous vos projets." },
      { name: "Charge équipe", path: "/charge",       icon: Activity,     moduleKey: "projects",  permissionKey: "projects.read",  secondary: true, description: "Visualisez et équilibrez la charge de travail par collaborateur et par projet : surcharges et disponibilités." },
      { name: "Documents",     path: "/documents",    icon: FolderOpen,   moduleKey: "documents", permissionKey: "documents.read", secondary: true, description: "Centralisez, classez et partagez les documents liés à votre organisation." },
    ],
  },
  {
    title: "Logistique",
    icon: Truck,
    description: "Organisez les stocks, équipements, mouvements, livraisons et opérations logistiques.",
    items: [
      { name: "Services",    path: "/services",    icon: Briefcase,      moduleKey: "services",           permissionKey: "services.read",   description: "Gérez votre catalogue de prestations et services : description, tarification et disponibilité par période." },
      { name: "Opérations",  path: "/operations",  icon: Truck,          moduleKey: "operations",         permissionKey: "operations.view", description: "Planifiez et suivez vos opérations terrain : livraisons, collectes et affectation des équipes logistiques." },
      { name: "Stock",       path: "/stock",       icon: Package,        moduleKey: "inventory_products", permissionKey: "inventory.read",  description: "Suivez les produits, quantités disponibles, entrées, sorties et alertes de stock." },
      { name: "Équipements", path: "/equipements", icon: Wrench,         moduleKey: "inventory_assets",   permissionKey: "equipment.read",  description: "Gérez votre inventaire d'actifs et équipements : état, maintenance planifiée et disponibilité calendaire." },
      { name: "Locations",   path: "/locations",   icon: ClipboardCheck, moduleKey: "rentals",            permissionKey: "equipment.read",  description: "Créez et suivez vos contrats de location d'équipements : planning, états des lieux et facturation." },
    ],
  },
  {
    title: "Achats",
    icon: ShoppingCart,
    moduleKey: "purchases",
    description: "Gérez vos fournisseurs, demandes d'achat, commandes, dépenses, factures et paiements.",
    items: [
      { name: "Vue d'ensemble",        path: "/achats",                  icon: LayoutDashboard, moduleKey: "purchases", permissionKey: "purchases.read",    description: "Consultez vos indicateurs achats : dépenses du mois, fournisseurs actifs et commandes en cours." },
      { name: "Fournisseurs",          path: "/achats/fournisseurs",     icon: Building2,       moduleKey: "purchases", permissionKey: "purchases.read",    description: "Gérez les informations, contacts, conditions et documents de vos fournisseurs." },
      { name: "Factures fournisseurs", path: "/achats/factures",         icon: FileText,        moduleKey: "purchases", permissionKey: "purchases.read",    description: "Enregistrez et contrôlez les factures reçues avant leur paiement. Importez via OCR." },
      { name: "Import OCR",            path: "/conformite/scanner",      icon: ScanLine,        moduleKey: "purchases", permissionKey: "purchases.read",    secondary: true, description: "Importez une facture fournisseur (PDF ou photo) et extrayez automatiquement les données par IA." },
      { name: "Bons de commande",      path: "/achats/bons-de-commande", icon: ClipboardCheck,  moduleKey: "purchases", permissionKey: "purchases.read",    description: "Créez, approuvez et suivez les commandes adressées aux fournisseurs." },
      { name: "Paiements",             path: "/achats/paiements",        icon: CreditCard,      moduleKey: "purchases", permissionKey: "purchases.pay",     description: "Planifiez et suivez les règlements effectués aux fournisseurs." },
      { name: "Dépenses",              path: "/achats/depenses",         icon: Banknote,        moduleKey: "purchases", permissionKey: "purchases.read",    secondary: true, description: "Enregistrez, classez et justifiez les dépenses de l'organisation." },
      { name: "Approbations",          path: "/achats/approbations",     icon: CheckSquare,     moduleKey: "purchases", permissionKey: "purchases.approve", secondary: true, description: "Validez ou rejetez les demandes d'achat soumises à votre approbation." },
      { name: "Rapports",              path: "/achats/rapports",         icon: BarChart3,       moduleKey: "purchases", permissionKey: "purchases.read",    secondary: true, description: "Analysez vos performances et générez des rapports professionnels en PDF ou Excel." },
    ],
  },
  {
    title: "Finance",
    icon: Landmark,
    description: "Suivez votre trésorerie, vos budgets, votre comptabilité, vos prévisions et vos obligations fiscales.",
    items: [
      { name: "Intelligence",         path: "/finance/intelligence",         icon: Brain,         moduleKey: "accounting",         permissionKey: "accounting.read",   description: "Détectez les anomalies financières, analysez les tendances et exploitez les recommandations automatiques." },
      { name: "Comptabilité",         path: "/comptabilite",                 icon: Calculator,    moduleKey: "accounting",         permissionKey: "accounting.read",   description: "Gérez vos écritures, journaux, comptes, états financiers et contrôles comptables." },
      { name: "Immobilisations",      path: "/comptabilite/immobilisations", icon: Landmark,      moduleKey: "accounting",         permissionKey: "accounting.read",   description: "Gérez vos actifs immobilisés : acquisitions, calcul des amortissements et enregistrement des cessions." },
      { name: "Trésorerie",           path: "/finance/tresorerie",           icon: Banknote,      moduleKey: "accounting",         permissionKey: "accounting.read",   description: "Suivez les entrées, sorties, soldes disponibles et prévisions de liquidité." },
      { name: "Recouvrement",         path: "/recouvrement",                 icon: Flame,         moduleKey: "accounting",         permissionKey: "accounting.read",   description: "Suivez et relancez vos créances clients échues : historique, litiges et relances automatiques." },
      { name: "Clôture des périodes", path: "/comptabilite/cloture",         icon: CalendarCheck, moduleKey: "accounting",         permissionKey: "accounting.manage", description: "Clôturez vos périodes comptables, verrouillez les écritures et générez les états de synthèse." },
      { name: "Budgets & prévisions", path: "/fpa",                               icon: TrendingUp,    moduleKey: "financial_planning", permissionKey: "fpa.read",          description: "Préparez vos budgets et comparez les prévisions aux réalisations." },
      { name: "Fiscalité",            path: "/fiscal/moteur",                     icon: Calculator,    moduleKey: "accounting",         permissionKey: "accounting.read",   description: "Calculez TVA, IS, IMF, Patente et IRPP (barème OHADA/Togo), simulez votre charge fiscale et gérez vos obligations déclaratives." },
      { name: "Contrôle fiscal",      path: "/comptabilite/controle-fiscal",      icon: ShieldCheck,   moduleKey: "accounting",         permissionKey: "accounting.read",   description: "Vérifiez la conformité fiscale de vos écritures avant soumission : détection d'anomalies et rapport de contrôle." },
      { name: "Conformité docs",      path: "/conformite",                        icon: Lock,          moduleKey: "accounting",         permissionKey: "accounting.read",   secondary: true, description: "Tableau de bord conformité : cachets OTR sur factures, scellés SHA-256 et suivi des workflows de signature." },
      { name: "Rapports",             path: "/rapports",                          icon: BarChart3,     moduleKey: "reports",            permissionKey: "accounting.read",   description: "Générez les états financiers correspondant au référentiel comptable actif." },
    ],
  },
  {
    title: "Équipe",
    icon: Users2,
    description: "Gérez vos collaborateurs, contrats, congés, présences, paie, recrutements et réclamations.",
    items: [
      { name: "Mon espace",           path: "/rh/mon-espace",         icon: UserCircle,        moduleKey: "team_hr",                                                description: "Votre espace RH personnel : bulletins de paie, soldes de congés, avances et documents administratifs." },
      { name: "Collaborateurs",       path: "/rh",                    icon: UsersRound,        moduleKey: "team_hr", permissionKey: "hr.read",                    description: "Gérez les fiches, contrats, documents et informations professionnelles de vos collaborateurs." },
      { name: "Paie",                 path: "/rh/paie",               icon: Banknote,          moduleKey: "team_hr", permissionKey: "hr.read",                    description: "Préparez et validez les bulletins de paie, gérez le calendrier, les déclarations et les corrections." },
      { name: "Avances sur salaire",  path: "/rh/avances-salaire",    icon: ArrowLeftRight,    moduleKey: "team_hr", permissionKey: "hr.read", roles: ["super_admin", "admin", "manager", "rh", "financier"], secondary: true, description: "Approuvez les demandes d'avance, gérez les échéanciers et intégrez les retenues dans la paie." },
      { name: "Congés & absences",    path: "/rh/conges",             icon: CalendarCheck,     moduleKey: "team_hr", permissionKey: "hr.read",                    description: "Gérez les demandes de congés, politiques d'absence, soldes et plannings de l'équipe." },
      { name: "Recrutement",          path: "/rh/recrutement",        icon: GraduationCap,     moduleKey: "team_hr", permissionKey: "hr.read",                    description: "Publiez vos offres, suivez les candidatures et gérez le processus de recrutement." },
      { name: "Présences",            path: "/presences",             icon: Clock,             moduleKey: "team_hr", permissionKey: "attendance.view",             description: "Suivez les horaires, pointages, pauses, retards, absences et heures travaillées." },
      { name: "Kiosques de pointage", path: "/kiosques",              icon: MonitorSmartphone, moduleKey: "team_hr", permissionKey: "attendance.manage_settings", secondary: true, description: "Configurez et gérez vos kiosques de pointage physiques connectés à Gaméasù." },
    ],
  },
  {
    title: "Portail Expert",
    icon: Network,
    description: "Gérez vos clients, missions et livrables depuis votre espace cabinet expert.",
    items: [
      { name: "Vue d'ensemble", path: "/expert",                   icon: LayoutDashboard, description: "Consultez votre tableau de bord cabinet : vue consolidée sur vos clients, missions et documents en attente." },
      { name: "Mes clients",    path: "/expert/clients",           icon: Building2,       description: "Accédez à vos clients connectés : espace client, statut de synchronisation et dernière activité." },
      { name: "Documents",      path: "/expert/document-requests", icon: FileText,        description: "Gérez vos demandes de documents auprès de vos clients : statut de réception et relances en attente." },
      { name: "Rapports",       path: "/expert/reports",           icon: BarChart3,       description: "Générez des rapports consolidés par client : synthèses financières et livrables du cabinet." },
      { name: "Utilisateurs",   path: "/expert/users-permissions", icon: UsersRound, secondary: true, description: "Gérez les accès de vos collaborateurs de cabinet : rôles et droits sur chaque client." },
      { name: "Mon cabinet",    path: "/expert/firm-settings",     icon: Settings,   secondary: true, description: "Configurez votre cabinet expert : informations, logo, spécialités et préférences d'affichage." },
    ],
  },
  {
    title: "Admin",
    icon: Shield,
    description: "Configurez votre organisation, vos utilisateurs, permissions, abonnements, modules et paramètres.",
    items: [
      { name: "Migration & Import", path: "/migration",          icon: Database,   moduleKey: "workspace_settings",   permissionKey: "admin.access",    description: "Importez vos données historiques et migrez depuis d'autres outils vers Gaméasù." },
      { name: "Paramètres",         path: "/workspace-settings", icon: Settings,   moduleKey: "workspace_settings",   permissionKey: "settings.read",   description: "Configurez votre espace de travail : organisation, modules actifs, rôles et autorisations." },
      { name: "Abonnement",         path: "/abonnement",         icon: CreditCard, moduleKey: "billing_subscription", permissionKey: "admin.access",    description: "Découvrez et activez des fonctionnalités supplémentaires adaptées à vos besoins." },
      { name: "Console admin",      path: "/admin",              icon: Shield,     moduleKey: "administration",       permissionKey: "admin.access",    secondary: true, description: "Administrez votre système : utilisateurs, audits, incidents et diagnostics avancés." },
      { name: "Automatisations",    path: "/automations",        icon: Workflow,   moduleKey: "administration",       permissionKey: "automation.read", secondary: true, description: "Créez des workflows automatiques : définissez les déclencheurs, actions et règles métier sans code." },
      { name: "Support",            path: "/tickets",            icon: LifeBuoy,   secondary: true,                                                                    description: "Soumettez une demande d'assistance et suivez son traitement par l'équipe concernée." },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  manager: "Responsable",
  rh: "Gestionnaire RH",
  financier: "Responsable Financier",
  commercial: "Commercial",
  logistique: "Gestionnaire Logistique",
  auditeur: "Auditeur",
  comptable: "Comptable",
  collaborator: "Collaborateur",
  client: "Client",
};

/** Badge rôle affiché en pied de sidebar (desktop + mobile). */
function SidebarUserFooter() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const roleLabel = ROLE_LABEL[role] || role;
  const initials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).toUpperCase() || "??";
  const fullName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "—";
  const isAuditeur = role === "auditeur";
  return (
    <div className="shrink-0 px-3 py-3 border-t border-white/[0.07] bg-black/[0.06]">
      <div className="flex items-center gap-2.5">
        <Avatar className="w-7 h-7 shrink-0">
          {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
          <AvatarFallback className="bg-[#0F1A3A] text-[#2563EB] font-bold text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold text-white/80 truncate leading-none">{fullName}</p>
          <p className="text-[10px] text-[#2563EB]/70 font-medium mt-0.5 truncate">{roleLabel}</p>
        </div>
        {isAuditeur && (
          <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-600/60 text-white/50 border border-white/10 whitespace-nowrap">
            Lecture seule
          </span>
        )}
      </div>
    </div>
  );
}

function isGroupActive(group: NavGroup, location: string) {
  return group.items.some(
    (item) => location === item.path || (item.path !== "/" && location.startsWith(item.path))
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [location] = useLocation();
  const { logout, user, switchOrg } = useAuth();
  const currentTourKey = (() => {
    const clean = location.split("?")[0];
    if (TOUR_MODULE_MAP[clean] !== undefined) return TOUR_MODULE_MAP[clean];
    const match = Object.keys(TOUR_MODULE_MAP)
      .filter(k => k !== "/" && clean.startsWith(k + "/"))
      .sort((a, b) => b.length - a.length)[0];
    return match ? TOUR_MODULE_MAP[match] : undefined;
  })();
  const handleRelaunchTour = () => {
    if (currentTourKey) window.dispatchEvent(new CustomEvent(RELAUNCH_EVENT, { detail: currentTourKey }));
  };
  const { data: org } = useCurrentOrganization();
  const { data: modules } = useOrganizationModules();

  const enabledKeys = useMemo(() => {
    const set = new Set<string>();
    (modules ?? []).forEach((m) => { if (m.enabled || m.isCore) set.add(m.moduleKey); });
    return set;
  }, [modules]);

  const currentNavItem = useMemo(() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (location === item.path || (item.path !== "/" && location.startsWith(item.path))) {
          return item;
        }
      }
    }
    return null;
  }, [location]);

  const perms = usePermissions();

  const isItemVisible = (item: NavItem) => {
    if (item.roles && !item.roles.includes(user?.role ?? "")) return false;
    if (item.permissionKey && !perms.isAdmin && !perms.has(item.permissionKey)) return false;
    return true;
  };

  const initials = ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "NX";
  const fullName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Utilisateur";
  const roleLabel = user?.role ? (ROLE_LABEL[user.role] || user.role) : "Connecté";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();

  // Expert Portal — use useActiveFirm as single source of truth (stays in sync across pages)
  const qc = useQueryClient();
  const { firmId: activeFirmId, setFirm: _setActiveFirm, firms: expertFirms } = useActiveFirm();
  const switchFirm = (id: string) => {
    _setActiveFirm(id);
    qc.invalidateQueries({ queryKey: ["expert"] });
  };
  const { data: expertClients } = useExpertClients(activeFirmId);
  const [contextOrgId, setContextOrgIdState] = useState<string | null>(getContextOrgId);
  const switchContextMutation = useSwitchClientContext(activeFirmId);
  const handleSwitchClient = (orgId: string) => {
    setContextOrgId(orgId);
    setContextOrgIdState(orgId);
    switchContextMutation.mutate(orgId);
  };
  const activeContextOrg = expertClients?.find((c) => c.orgId === contextOrgId);

  // Unread notifications count — polled every 60 s + invalidated by socket events
  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications", "unread-count"],
    queryFn: () => apiFetch<{ total: number }>("/api/notifications?unreadOnly=true&page=1&limit=1"),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!user,
  });
  const unreadCount = unreadData?.total ?? 0;

  // Pending approvals count — polled every 60 s for sidebar badge
  const { data: approvalsData } = useQuery({
    queryKey: ["purchases-approvals-count"],
    queryFn: () => apiFetch<{ total: number }>("/api/purchases/approvals/pending"),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!user,
  });
  const pendingApprovalsCount = approvalsData?.total ?? 0;

  // Pending client document requests — polled every 90 s for sidebar badge
  const { data: clientDocsData } = useQuery({
    queryKey: ["expert/client/doc-requests", "count"],
    queryFn: () => apiFetch<Array<{ status: string }>>("/api/expert/client/document-requests"),
    refetchInterval: 90_000,
    staleTime: 60_000,
    enabled: !!user,
    select: (rows) => rows.filter((r) => r.status === "en_attente" || r.status === "rejete").length,
  });
  const pendingClientDocsCount = clientDocsData ?? 0;

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
      // Auto-expand secondary items if the active item is secondary
      const activeItem = activeGroup.items.find(
        (item) => location === item.path || (item.path !== "/" && location.startsWith(item.path))
      );
      if (activeItem?.secondary) {
        setExpandedGroups((prev) => {
          if (prev.has(activeGroup.title)) return prev;
          const next = new Set(prev);
          next.add(activeGroup.title);
          return next;
        });
      }
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

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleExpand = (title: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const SidebarContent = (
    <>
      {/* ── Bouton fermeture mobile ───────────────────────────────── */}
      <div className="shrink-0 h-14 flex items-center justify-end px-4 border-b border-white/[0.07] lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
          aria-label="Fermer le menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Navigation groups ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pt-2 pb-4 custom-scrollbar overscroll-contain">
        <nav className="px-2 space-y-0.5">
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups.has(group.title);
            const hasActive = isGroupActive(group, location);
            const GroupIcon = group.icon;
            if (!group.items.some((i) => isItemVisible(i))) return null;
            // Gate Expert group: hide until user has at least one firm (unless already on /expert route)
            if (group.title === "Portail Expert" && !location.startsWith("/expert") && (!expertFirms || expertFirms.length === 0)) return null;

            const groupHeaderBtn = (
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
                      hasActive ? "text-[#2563EB]" : isOpen ? "text-white/50" : "text-white/25"
                    }`}
                    strokeWidth={hasActive ? 2 : 1.75}
                  />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className={`text-[11.5px] font-bold uppercase tracking-[0.08em] transition-colors duration-150`}>
                      {group.title}
                    </span>
                    {group.description && isOpen && (
                      <span className="text-[9.5px] font-normal normal-case tracking-normal leading-tight text-white/25 mt-0.5 truncate">
                        {group.description}
                      </span>
                    )}
                  </span>
                  {/* Badge "Nouveau" pour les modules récemment ajoutés */}
                  {group.isNew && !hasActive && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/25 uppercase shrink-0">
                      Nouveau
                    </span>
                  )}
                  {/* Active dot when group collapsed and has active item */}
                  {hasActive && !isOpen && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shadow-[0_0_6px_rgba(37,99,235,0.5)]" />
                  )}
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isOpen ? "rotate-90 text-white/40" : "text-white/20"
                    }`}
                    strokeWidth={2}
                  />
                </button>
              );

            return (
              <div key={group.title}>
                {/* Group header — clickable toggle, with tooltip when collapsed */}
                {group.description && !isOpen ? (
                  <TooltipProvider delayDuration={500}>
                    <Tooltip>
                      <TooltipTrigger asChild>{groupHeaderBtn}</TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px] text-[11px] leading-relaxed bg-popover text-popover-foreground border shadow-md">
                        <p className="font-semibold text-[11px] mb-0.5">{group.title}</p>
                        <p className="text-muted-foreground">{group.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : groupHeaderBtn}

                {/* Collapsible items — smooth CSS grid animation */}
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <ul className="pt-0.5 pb-1 pl-2 space-y-0.5">
                      {/* ── Items primaires — filtrés par permission ── */}
                      {group.items.filter(i => !i.secondary && isItemVisible(i)).map((item) => {
                        const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                        const locked = !!(item.moduleKey && modules && modules.length > 0 && !enabledKeys.has(item.moduleKey));
                        const lockedMod = locked ? modules?.find(m => m.moduleKey === item.moduleKey) : null;
                        const lockReason = locked
                          ? lockedMod?.source === "manual"
                            ? "Module désactivé par l'administrateur"
                            : "Module non inclus dans votre formule actuelle"
                          : undefined;
                        const href = item.path;
                        const linkEl = (
                          <Link
                            href={href}
                            title={lockReason}
                            className={`group/item relative flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150 ${
                              active ? "bg-white/[0.08] text-white" : locked ? "text-white/25 hover:text-white/40 hover:bg-white/[0.02]" : "text-white/55 hover:text-white/85 hover:bg-white/[0.05]"
                            }`}
                          >
                            {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.4)]" />}
                            <item.icon className={`w-[14px] h-[14px] shrink-0 transition-colors duration-150 ${active ? "text-[#D9B86A]" : locked ? "text-white/20" : "text-white/35 group-hover/item:text-white/60"}`} strokeWidth={active ? 2 : 1.75} />
                            <span className="truncate flex-1">{item.name}</span>
                            {item.path === "/documents-cabinet" && pendingClientDocsCount > 0 && (
                              <span className="ml-1 shrink-0 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                                {pendingClientDocsCount > 99 ? "99+" : pendingClientDocsCount}
                              </span>
                            )}
                            {locked && <Lock className="w-3 h-3 text-white/20 shrink-0" strokeWidth={2} />}
                          </Link>
                        );
                        return (
                          <li key={item.path}>
                            {item.description && !locked ? (
                              <TooltipProvider delayDuration={700}>
                                <Tooltip>
                                  <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[230px] text-[11px] leading-relaxed bg-popover text-popover-foreground border shadow-md">
                                    {item.description}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : linkEl}
                          </li>
                        );
                      })}
                      {/* ── Items secondaires + toggle ── */}
                      {group.items.some(i => i.secondary && isItemVisible(i)) && (() => {
                        const sec = group.items.filter(i => i.secondary && isItemVisible(i));
                        const isExp = expandedGroups.has(group.title);
                        return (
                          <>
                            {isExp && sec.map((item) => {
                              const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                              const locked = !!(item.moduleKey && modules && modules.length > 0 && !enabledKeys.has(item.moduleKey));
                              const lockedMod = locked ? modules?.find(m => m.moduleKey === item.moduleKey) : null;
                              const lockReason = locked
                                ? lockedMod?.source === "manual"
                                  ? "Module désactivé par l'administrateur"
                                  : "Module non inclus dans votre formule actuelle"
                                : undefined;
                              const href = item.path;
                              const secLinkEl = (
                                <Link
                                  href={href}
                                  title={lockReason}
                                  className={`group/item relative flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150 ${
                                    active ? "bg-white/[0.08] text-white" : locked ? "text-white/25 hover:text-white/40 hover:bg-white/[0.02]" : "text-white/55 hover:text-white/85 hover:bg-white/[0.05]"
                                  }`}
                                >
                                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.4)]" />}
                                  <item.icon className={`w-[14px] h-[14px] shrink-0 transition-colors duration-150 ${active ? "text-[#D9B86A]" : locked ? "text-white/20" : "text-white/35 group-hover/item:text-white/60"}`} strokeWidth={active ? 2 : 1.75} />
                                  <span className="truncate flex-1">{item.name}</span>
                                  {item.path === "/achats/approbations" && pendingApprovalsCount > 0 && (
                                    <span className="ml-1 shrink-0 min-w-[18px] h-[18px] rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center px-1">
                                      {pendingApprovalsCount > 99 ? "99+" : pendingApprovalsCount}
                                    </span>
                                  )}
                                  {locked && <Lock className="w-3 h-3 text-white/20 shrink-0" strokeWidth={2} />}
                                </Link>
                              );
                              return (
                                <li key={item.path}>
                                  {item.description && !locked ? (
                                    <TooltipProvider delayDuration={700}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>{secLinkEl}</TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-[230px] text-[11px] leading-relaxed bg-popover text-popover-foreground border shadow-md">
                                          {item.description}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : secLinkEl}
                                </li>
                              );
                            })}
                            <li>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleExpand(group.title); }}
                                className="w-full flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-colors mt-0.5"
                              >
                                <span className="flex-1 text-left">{isExp ? "Réduire" : `${sec.length} de plus…`}</span>
                                <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${isExp ? "-rotate-90" : "rotate-90"}`} />
                              </button>
                            </li>
                          </>
                        );
                      })()}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}

        </nav>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-white/[0.06] shrink-0">
        <AboutDialog />
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background font-sans">

      {/* ── Topbar pleine largeur ──────────────────────────────────── */}
      <header className="h-14 bg-card/95 backdrop-blur-md border-b border-border/60 flex items-center px-3 sm:px-4 shrink-0 z-20 shadow-[var(--shadow-xs)] gap-2">

          {/* ── Zone gauche : logo + séparateur + nom organisation ──── */}
          <div className="flex items-center shrink-0 gap-0 min-w-0">
            {/* Mobile — hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-foreground/70 hover:bg-muted"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile — logo */}
            <span className="lg:hidden ml-1">
              <img
                src={BRANDING.logoMark}
                alt={BRANDING.appName}
                className="h-6 w-auto object-contain"
                draggable={false}
              />
            </span>

            {/* Desktop — logo mark cliquable */}
            <Link
              href="/"
              className="hidden lg:flex items-center shrink-0 group/logo"
              aria-label={BRANDING.appName}
            >
              <img
                src={BRANDING.logoMark}
                alt={BRANDING.appName}
                className="h-7 w-auto object-contain select-none group-hover/logo:opacity-80 transition-opacity"
                draggable={false}
              />
            </Link>

            {/* Desktop — séparateur vertical */}
            <div className="hidden lg:block w-px h-5 bg-border/70 mx-3 shrink-0" />

            {/* Desktop — nom de l'organisation (multi-tenant, dynamique) */}
            <div className="hidden lg:flex items-center ml-[160px]">
              <span className="text-[15px] font-semibold text-foreground whitespace-nowrap leading-none">
                {org?.name ?? BRANDING.appName}
              </span>
            </div>
          </div>

          {/* ── Zone centrale : barre de recherche globale ────────────── */}
          <div className="flex-1 flex justify-center px-3 lg:px-6 min-w-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Rechercher"
              className="flex items-center gap-2.5 text-muted-foreground bg-muted/40 hover:bg-muted/70 border border-border/60 rounded-lg px-2.5 md:px-3.5 py-2 w-auto md:w-full max-w-[520px] transition-all group"
            >
              <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              <span className="hidden md:inline text-sm text-muted-foreground/60 flex-1 text-left truncate">
                Rechercher clients, collaborateurs, factures, projets…
              </span>
              <kbd className="hidden lg:inline-flex text-[10px] text-muted-foreground/50 font-mono bg-background border border-border rounded px-1.5 py-0.5 shrink-0">⌘K</kbd>
            </button>
          </div>

          {/* ── Zone droite : raccourcis rapides + profil ─────────────── */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Client context switcher — calls /switch endpoint, stores scoped token */}
            {location.startsWith("/expert") && expertClients && expertClients.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden sm:flex items-center gap-1.5 px-2.5 py-[7px] mr-1 rounded-lg border border-border text-[12.5px] font-medium hover:bg-muted/60 transition-colors">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="max-w-[130px] truncate">{activeContextOrg?.org.name ?? "Choisir un client"}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 font-sans">
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contexte client</div>
                  {expertClients.map((c) => (
                    <DropdownMenuItem key={c.orgId} onClick={() => handleSwitchClient(c.orgId)} className="flex items-center gap-2 cursor-pointer">
                      <span className="flex-1 truncate">{c.org.name}</span>
                      {c.orgId === contextOrgId && <span className="text-primary text-xs font-bold">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Firm switcher — visible dès qu'on est sur /expert/* et qu'au moins 1 cabinet existe */}
            {location.startsWith("/expert") && expertFirms && expertFirms.length >= 1 && (() => {
              const activeFirm = expertFirms.find((f) => f.id === activeFirmId);
              const canSwitch = expertFirms.length > 1;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="hidden sm:flex items-center gap-1.5 px-2.5 py-[7px] mr-1 rounded-lg border border-border text-[12.5px] font-medium hover:bg-muted/60 transition-colors"
                      title={canSwitch ? "Changer de cabinet" : activeFirm?.name}
                    >
                      <Network className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="max-w-[120px] truncate">{activeFirm?.name ?? "Cabinet"}</span>
                      {canSwitch && <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 font-sans">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cabinet actif</div>
                    {expertFirms.map((f) => (
                      <DropdownMenuItem
                        key={f.id}
                        onClick={() => canSwitch ? switchFirm(f.id) : undefined}
                        className={`flex items-center gap-2 ${canSwitch ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <Network className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{f.name}</span>
                        {f.id === activeFirmId && <span className="text-primary text-xs font-bold">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}
            {/* Bouton "Nouveau" Xero-style */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden sm:flex items-center gap-1.5 px-3 py-[7px] mr-2 rounded-lg bg-primary text-white text-[12.5px] font-semibold hover:bg-primary/90 transition-colors shadow-sm">
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  <span>Nouveau</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 font-sans">
                <DropdownMenuItem asChild>
                  <Link href="/factures" className="flex items-center gap-2.5 cursor-pointer">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />Facture
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/achats/factures" className="flex items-center gap-2.5 cursor-pointer">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />Facture fournisseur
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/clients" className="flex items-center gap-2.5 cursor-pointer">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />Client
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/projets" className="flex items-center gap-2.5 cursor-pointer">
                    <FolderKanban className="w-4 h-4 text-muted-foreground shrink-0" />Projet
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/devis" className="flex items-center gap-2.5 cursor-pointer">
                    <FileSignature className="w-4 h-4 text-muted-foreground shrink-0" />Devis
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/tasks" className="flex items-center gap-2.5 cursor-pointer">
                    <CheckSquare className="w-4 h-4 text-muted-foreground shrink-0" />Tâche
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Widget abonnement */}
            <SubscriptionWidget />

            {/* Mobile — icône recherche */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Rechercher"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            {/* Suggestion produit */}
            <button
              type="button"
              onClick={() => setSuggestionOpen(true)}
              className="hidden sm:flex p-2 rounded-lg text-muted-foreground hover:text-yellow-500 hover:bg-muted transition-colors"
              aria-label="Faire une suggestion"
              title="Faire une suggestion"
            >
              <Lightbulb className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>

            {/* Paramètres de l'espace */}
            <Link
              href="/workspace-settings"
              className="hidden sm:flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Paramètres de l'espace"
            >
              <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </Link>

            {/* Notifications */}
            <Link href="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-primary rounded-full border-2 border-card flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white leading-none px-0.5">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </span>
              )}
            </Link>

            {/* Guides disponibles */}
            <button
              onClick={() => setGuidesOpen(true)}
              className="hidden sm:flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative"
              aria-label="Guides disponibles"
              title="Guides disponibles"
            >
              <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.75} />
              {currentTourKey && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>

            {/* Aide & support */}
            <Link
              href="/tickets"
              className="hidden sm:flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Aide et support"
            >
              <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </Link>

            {/* Séparateur vertical */}
            <div className="hidden sm:block w-px h-5 bg-border/70 mx-1.5 shrink-0" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 outline-none transition-all rounded-lg px-1.5 py-1 hover:bg-muted group">
                  <div className="text-right hidden xl:block">
                    <p className="text-[12.5px] font-semibold leading-none text-foreground">{fullName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{roleLabel}</p>
                  </div>
                  <Avatar className="w-8 h-8 ring-2 ring-border group-hover:ring-primary/30 transition-all">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-[#0F1A3A] text-[#2563EB] font-semibold text-sm">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-80 font-sans p-0 overflow-hidden shadow-xl border-border/70">
                {/* ── Carte profil ── */}
                <div className="bg-gradient-to-br from-[#0F1A3A] to-[#162040] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-14 h-14 ring-2 ring-[#2563EB]/40 shrink-0">
                      {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                      <AvatarFallback className="bg-[#2563EB]/15 text-[#2563EB] font-bold text-lg">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white leading-tight truncate">{fullName}</p>
                      <p className="text-xs text-[#2563EB] font-medium mt-0.5">{roleLabel}</p>
                      {user?.email && (
                        <p className="text-[11px] text-white/50 mt-1 truncate">{user.email}</p>
                      )}
                      {user?.phone && (
                        <p className="text-[11px] text-white/50 mt-0.5 truncate">{user.phone}</p>
                      )}
                    </div>
                  </div>
                  <Link
                    href="/profil"
                    className="mt-3 flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/80 transition-colors"
                  >
                    <UserCircle className="w-3 h-3" />
                    Voir et modifier mon profil
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Link>
                </div>

                {/* ── Navigation personnelle ── */}
                <div className="py-1.5 px-1">
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 px-3 gap-3">
                    <Link href="/mon-espace">
                      <BarChart3 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none">Mon espace</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Mes tâches, projets et activité</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 px-3 gap-3">
                    <Link href="/suggestions">
                      <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none">Faire une suggestion</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Idées, bugs, améliorations</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  {currentTourKey && (
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg py-2.5 px-3 gap-3"
                      onClick={handleRelaunchTour}
                    >
                      <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none">Relancer la visite guidée</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Revoir le guide de ce module</p>
                      </div>
                    </DropdownMenuItem>
                  )}
                </div>

                <div className="h-px bg-border/60 mx-3" />

                {/* ── Changer d'organisation (multi-org) ── */}
                {user?.orgs && (user.orgs as any[]).length > 1 && (
                  <>
                    <div className="py-1.5 px-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-3 pt-1 pb-1.5">Changer d'organisation</p>
                      {(user.orgs as any[]).map((org: any) => {
                        const isActive = org.id === user.organizationId;
                        return (
                          <DropdownMenuItem
                            key={org.id}
                            onClick={async () => {
                              if (!isActive) {
                                try { await switchOrg(org.id); } catch { /* silencieux */ }
                              }
                            }}
                            className={`cursor-pointer rounded-lg py-2.5 px-3 gap-3 ${isActive ? "bg-primary/5" : ""}`}
                          >
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : ""}`}>{org.name}</p>
                              {org.legalName && org.legalName !== org.name && (
                                <p className="text-[11px] text-muted-foreground truncate">{org.legalName}</p>
                              )}
                            </div>
                            {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                    <div className="h-px bg-border/60 mx-3" />
                  </>
                )}

                {/* ── Organisation ── */}
                <div className="py-1.5 px-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-3 pt-1 pb-1.5">Organisation</p>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 px-3 gap-3">
                    <Link href="/workspace-settings">
                      <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">Paramètres de l'espace</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 px-3 gap-3">
                    <Link href="/abonnement">
                      <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">Abonnement & facturation</span>
                    </Link>
                  </DropdownMenuItem>
                </div>

                <div className="h-px bg-border/60 mx-3" />

                {/* ── Déconnexion ── */}
                <div className="py-1.5 px-1">
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg py-2.5 px-3 gap-3 text-destructive focus:text-destructive focus:bg-destructive/8"
                    onClick={() => logout()}
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">Déconnexion</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </header>

      {/* ── Corps : sidebar + contenu ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-[260px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col shadow-xl z-10 shrink-0 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.015] via-transparent to-black/[0.08] pointer-events-none" />
          <div className="relative flex flex-col h-full">
            {SidebarContent}
            <SidebarUserFooter />
          </div>
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
          <SidebarUserFooter />
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
          <AppBreadcrumb />
          {currentNavItem?.description && (
            <div className="hidden sm:block px-4 sm:px-6 lg:px-8 py-1.5 bg-muted/20 border-b border-border/40">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{currentNavItem.description}</p>
            </div>
          )}
          {perms.isReadOnly && (
            <div className="mx-4 mt-2.5 flex items-center gap-2 rounded-md border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              Mode Lecture Seule — Votre rôle Auditeur vous permet de consulter toutes les données mais pas d'en créer ou modifier.
            </div>
          )}

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 page-scroll bg-background">
            <div className="max-w-[1440px] mx-auto w-full">{children}</div>
          </div>
        </main>

      </div>

      {/* ── Koffi — assistant flottant universel ─────────────────────────────── */}
      <KoffiChat />

      {/* ── Recherche globale ─────────────────────────────────────────────────── */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── Suggestion produit — accessible depuis la topbar ──────────────────── */}
      <SuggestionDialog open={suggestionOpen} onOpenChange={setSuggestionOpen} />

      {/* ── Guides disponibles ─────────────────────────────────────────────────── */}
      <GuidesPanel
        moduleKey={currentTourKey ?? ""}
        open={guidesOpen}
        onOpenChange={setGuidesOpen}
      />
    </div>
  );
};
