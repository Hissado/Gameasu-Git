import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Search, CheckCircle2, PlayCircle, RotateCcw, BookOpen, Sparkles,
  ChevronRight, HelpCircle, LayoutDashboard, Target, Building2, FileText,
  ShoppingCart, CreditCard, Briefcase, Megaphone, FolderKanban, CheckSquare,
  Wrench, ClipboardCheck, Truck, Package, FolderOpen, Calculator, TrendingUp,
  BarChart3, UsersRound, CalendarCheck, Clock, GraduationCap, Users,
  MessageSquare, Settings, FileSignature, List, BookMarked, Layers,
  UserCheck, ShoppingBag, GraduationCap as GradCap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TOUR_PATHS, getPathStatus } from "@/components/ui/onboarding-tour";
import { useAuth } from "@/lib/auth";

// ─── Module metadata ──────────────────────────────────────────────────────────
type ModuleMeta = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  route: string;
  color: string;
  description: string;
};

const MODULE_META: Record<string, ModuleMeta> = {
  dashboard:           { label: "Tableau de bord",     icon: LayoutDashboard, category: "Général",         route: "/",                        color: "bg-blue-100 text-blue-700",    description: "Vue d'ensemble et indicateurs clés" },
  crm:                 { label: "Pipeline CRM",         icon: Target,          category: "Ventes & CRM",    route: "/crm",                     color: "bg-orange-100 text-orange-700", description: "Opportunités et suivi commercial" },
  clients:             { label: "Clients B2B",          icon: Building2,       category: "Ventes & CRM",    route: "/clients",                 color: "bg-orange-100 text-orange-700", description: "Portefeuille clients et fiches" },
  factures:            { label: "Facturation",          icon: FileText,        category: "Ventes & CRM",    route: "/factures",                color: "bg-orange-100 text-orange-700", description: "Factures, avoirs et encaissements" },
  commandes:           { label: "Commandes",            icon: ShoppingCart,    category: "Ventes & CRM",    route: "/commandes",               color: "bg-orange-100 text-orange-700", description: "Bons de commande clients" },
  devis:               { label: "Devis",                icon: FileSignature,   category: "Ventes & CRM",    route: "/devis",                   color: "bg-orange-100 text-orange-700", description: "Propositions commerciales" },
  paiements:           { label: "Encaissements",        icon: CreditCard,      category: "Ventes & CRM",    route: "/paiements",               color: "bg-orange-100 text-orange-700", description: "Règlements clients reçus" },
  services:            { label: "Services",             icon: Briefcase,       category: "Ventes & CRM",    route: "/services",                color: "bg-orange-100 text-orange-700", description: "Catalogue de prestations" },
  marketing:           { label: "Marketing",            icon: Megaphone,       category: "Ventes & CRM",    route: "/marketing",               color: "bg-pink-100 text-pink-700",    description: "Campagnes, audiences et analytics" },
  projets:             { label: "Projets",              icon: FolderKanban,    category: "Opérations",      route: "/projets",                 color: "bg-green-100 text-green-700",  description: "Pilotage de projets" },
  taches:              { label: "Tâches",               icon: CheckSquare,     category: "Opérations",      route: "/tasks",                   color: "bg-green-100 text-green-700",  description: "Actions et suivi avancement" },
  equipements:         { label: "Équipements",          icon: Wrench,          category: "Opérations",      route: "/equipements",             color: "bg-green-100 text-green-700",  description: "Inventaire d'actifs" },
  locations:           { label: "Locations",            icon: ClipboardCheck,  category: "Opérations",      route: "/locations",               color: "bg-green-100 text-green-700",  description: "Contrats de location" },
  logistique:          { label: "Logistique",           icon: Truck,           category: "Opérations",      route: "/logistique",              color: "bg-green-100 text-green-700",  description: "Livraisons et collectes" },
  stock:               { label: "Stock",                icon: Package,         category: "Opérations",      route: "/stock",                   color: "bg-green-100 text-green-700",  description: "Inventaire produits" },
  documents:           { label: "Documents",            icon: FolderOpen,      category: "Opérations",      route: "/documents",               color: "bg-green-100 text-green-700",  description: "Bibliothèque documentaire" },
  comptabilite:        { label: "Comptabilité",         icon: Calculator,      category: "Finance",          route: "/comptabilite",            color: "bg-purple-100 text-purple-700", description: "Dashboard financier" },
  comptabilite_journaux:{ label: "Journaux & Clôture", icon: BookOpen,        category: "Finance",          route: "/comptabilite/ecritures",  color: "bg-purple-100 text-purple-700", description: "Écritures, grand livre et clôture" },
  plan_comptable:      { label: "Plan de comptes",      icon: List,            category: "Finance",          route: "/comptabilite/plan-comptable", color: "bg-purple-100 text-purple-700", description: "Plan comptable SYSCOHADA" },
  fpa:                 { label: "Budgets & FP&A",       icon: TrendingUp,      category: "Finance",          route: "/fpa",                     color: "bg-purple-100 text-purple-700", description: "Tableau de bord financier" },
  fpa_budgets:         { label: "Création budgets",     icon: TrendingUp,      category: "Finance",          route: "/fpa/budgets",             color: "bg-purple-100 text-purple-700", description: "Budgets versionnés" },
  fpa_analyse:         { label: "Analyse & variance",   icon: BarChart3,       category: "Finance",          route: "/fpa/variance",            color: "bg-purple-100 text-purple-700", description: "Écarts budget/réalisé" },
  achats:              { label: "Achats",               icon: ShoppingBag,     category: "Finance",          route: "/achats",                  color: "bg-purple-100 text-purple-700", description: "Cycle fournisseurs" },
  rapports:            { label: "Rapports",             icon: BarChart3,       category: "Finance",          route: "/rapports",                color: "bg-purple-100 text-purple-700", description: "États financiers et exports" },
  rh:                  { label: "Ressources Humaines",  icon: UsersRound,      category: "RH",               route: "/rh",                      color: "bg-indigo-100 text-indigo-700", description: "KPIs RH et effectifs" },
  rh_conges:           { label: "Congés & absences",    icon: CalendarCheck,   category: "RH",               route: "/rh/conges",               color: "bg-indigo-100 text-indigo-700", description: "Demandes et politiques" },
  rh_presences:        { label: "Présences",            icon: Clock,           category: "RH",               route: "/presences",               color: "bg-indigo-100 text-indigo-700", description: "Pointages et feuilles de temps" },
  rh_recrutement:      { label: "Recrutement",          icon: GradCap,         category: "RH",               route: "/rh/recrutement",          color: "bg-indigo-100 text-indigo-700", description: "Pipeline candidats" },
  collaborateurs:      { label: "Collaborateurs",       icon: Users,           category: "RH",               route: "/collaborateurs",          color: "bg-indigo-100 text-indigo-700", description: "Fiches RH et profils" },
  presences:           { label: "Pointages",            icon: Clock,           category: "RH",               route: "/presences",               color: "bg-indigo-100 text-indigo-700", description: "Suivi des présences" },
  messagerie:          { label: "Messagerie",           icon: MessageSquare,   category: "Communication",    route: "/messaging",               color: "bg-teal-100 text-teal-700",   description: "DM, groupes et fichiers" },
  utilisateurs:        { label: "Utilisateurs",         icon: UserCheck,       category: "Administration",   route: "/utilisateurs",            color: "bg-gray-100 text-gray-700",   description: "Comptes et invitations" },
  parametres:          { label: "Paramètres",           icon: Settings,        category: "Administration",   route: "/workspace-settings",      color: "bg-gray-100 text-gray-700",   description: "Configuration de l'espace" },
  expert:              { label: "Portail Expert",       icon: Briefcase,       category: "Administration",   route: "/expert",                  color: "bg-gray-100 text-gray-700",   description: "Espace cabinet expert" },
};

const CATEGORIES = [
  { key: "all", label: "Tous les guides" },
  { key: "Général", label: "Général" },
  { key: "Ventes & CRM", label: "Ventes & CRM" },
  { key: "Opérations", label: "Opérations" },
  { key: "Finance", label: "Finance" },
  { key: "RH", label: "Ressources Humaines" },
  { key: "Communication", label: "Communication" },
  { key: "Administration", label: "Administration" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeProgress() {
  let total = 0;
  let done = 0;
  for (const [mk, paths] of Object.entries(TOUR_PATHS)) {
    for (const path of paths) {
      total++;
      if (getPathStatus(mk, path.key) === "done") done++;
    }
  }
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function PathStatusBadge({ status }: { status: ReturnType<typeof getPathStatus> }) {
  if (status === "done")
    return (
      <Badge variant="outline" className="gap-1 text-green-700 border-green-200 bg-green-50 text-xs">
        <CheckCircle2 className="h-3 w-3" /> Terminé
      </Badge>
    );
  if (status === "in_progress")
    return (
      <Badge variant="outline" className="gap-1 text-orange-700 border-orange-200 bg-orange-50 text-xs">
        <Clock className="h-3 w-3" /> En cours
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
      <HelpCircle className="h-3 w-3" /> Non commencé
    </Badge>
  );
}

// ─── Module Card ──────────────────────────────────────────────────────────────
function ModuleGuideCard({
  moduleKey,
  meta,
  onLaunch,
}: {
  moduleKey: string;
  meta: ModuleMeta;
  onLaunch: (moduleKey: string, pathKey: string, route: string) => void;
}) {
  const paths = TOUR_PATHS[moduleKey] ?? [];
  const [expanded, setExpanded] = useState(false);
  const Icon = meta.icon;

  const doneCount = paths.filter(p => getPathStatus(moduleKey, p.key) === "done").length;
  const allDone = doneCount === paths.length && paths.length > 0;

  return (
    <div className="border rounded-xl overflow-hidden bg-card hover:shadow-sm transition-shadow">
      {/* Module header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", meta.color)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-foreground truncate">{meta.label}</p>
            {allDone && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{doneCount}/{paths.length}</span>
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </div>
      </button>

      {/* Progress bar */}
      {paths.length > 0 && (
        <div className="px-4">
          <Progress value={paths.length > 0 ? (doneCount / paths.length) * 100 : 0} className="h-1" />
        </div>
      )}

      {/* Paths list */}
      {expanded && (
        <div className="divide-y">
          {paths.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Aucun guide disponible pour ce module.</div>
          ) : (
            paths.map(path => {
              const status = getPathStatus(moduleKey, path.key);
              return (
                <div key={path.key} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{path.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{path.description}</p>
                    <div className="mt-1.5">
                      <PathStatusBadge status={status} />
                    </div>
                  </div>
                  <div className="flex-shrink-0 pt-0.5">
                    {status === "done" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => onLaunch(moduleKey, path.key, meta.route)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Rejouer
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => onLaunch(moduleKey, path.key, meta.route)}
                      >
                        <PlayCircle className="h-3 w-3 mr-1" />
                        {status === "in_progress" ? "Continuer" : "Démarrer"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AidePage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const { user } = useAuth();

  const { total, done, pct } = useMemo(() => computeProgress(), []);

  const handleLaunch = (moduleKey: string, pathKey: string, route: string) => {
    sessionStorage.setItem("aide_launch", JSON.stringify({ moduleKey, pathKey }));
    setLocation(route + "?aide=1");
  };

  const filteredModules = useMemo(() => {
    const lc = search.toLowerCase();
    return Object.entries(MODULE_META).filter(([mk, meta]) => {
      if (!TOUR_PATHS[mk]) return false;
      if (category !== "all" && meta.category !== category) return false;
      if (search) {
        const pathsMatch = (TOUR_PATHS[mk] ?? []).some(
          p => p.name.toLowerCase().includes(lc) || p.description.toLowerCase().includes(lc),
        );
        return (
          meta.label.toLowerCase().includes(lc) ||
          meta.description.toLowerCase().includes(lc) ||
          pathsMatch
        );
      }
      return true;
    });
  }, [search, category]);

  const totalGuides = Object.values(TOUR_PATHS).reduce((acc, paths) => acc + paths.length, 0);
  const totalModules = Object.keys(MODULE_META).filter(mk => TOUR_PATHS[mk]).length;

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="border-b bg-muted/40 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookMarked className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold text-foreground">Centre d'aide</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Guides interactifs et visites guidées pour maîtriser chaque fonctionnalité de Gaméasù.
              </p>
            </div>
            {/* Progress */}
            <div className="bg-background border rounded-lg px-4 py-3 min-w-[220px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground font-medium">Progression</span>
                <span className="text-sm font-semibold text-foreground">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1.5">
                {done} guide{done > 1 ? "s" : ""} terminé{done > 1 ? "s" : ""} sur {total}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un guide, une fonctionnalité…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {totalModules} modules
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {totalGuides} parcours disponibles
            </span>
            {user?.name && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Guides adaptés à votre rôle
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden max-w-5xl mx-auto w-full">
        {/* Category sidebar */}
        <aside className="w-52 flex-shrink-0 border-r py-4 px-3 hidden md:block">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">
            Catégories
          </p>
          <nav className="space-y-0.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
                  category === cat.key
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Module grid */}
        <main className="flex-1 overflow-y-auto py-4 px-4 md:px-6">
          {/* Mobile category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-3 md:hidden">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  category === cat.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filteredModules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <HelpCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Aucun guide trouvé</p>
              <p className="text-xs text-muted-foreground mt-1">Essayez un autre terme de recherche</p>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setSearch(""); setCategory("all"); }}>
                Réinitialiser
              </Button>
            </div>
          ) : (
            <>
              {category === "all" && !search ? (
                /* Grouped by category */
                CATEGORIES.filter(c => c.key !== "all").map(cat => {
                  const inCat = filteredModules.filter(([, m]) => m.category === cat.key);
                  if (inCat.length === 0) return null;
                  return (
                    <div key={cat.key} className="mb-6">
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {cat.label}
                      </h2>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {inCat.map(([mk, meta]) => (
                          <ModuleGuideCard
                            key={mk}
                            moduleKey={mk}
                            meta={meta}
                            onLaunch={handleLaunch}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Flat filtered list */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredModules.map(([mk, meta]) => (
                    <ModuleGuideCard
                      key={mk}
                      moduleKey={mk}
                      meta={meta}
                      onLaunch={handleLaunch}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
