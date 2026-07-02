import { useLocation, Link } from "wouter";
import { ChevronRight, ArrowLeft, Home } from "lucide-react";

type Crumb = { label: string; href?: string };

/** Top-level route labels — shows "Accueil > Section" for every page except "/" */
const TOP_LEVEL: Record<string, string> = {
  "/projects":           "Projets",
  "/portfolio":          "Portefeuille",
  "/workload":           "Charge de travail",
  "/tasks":              "Tâches",
  "/crm":                "CRM",
  "/clients":            "Clients",
  "/services":           "Services",
  "/equipment":          "Équipements",
  "/collaborators":      "Collaborateurs",
  "/rentals":            "Locations",
  "/inspections":        "Inspections",
  "/logistics":          "Logistique",
  "/pricing":            "Calculateur de prix",
  "/orders":             "Commandes",
  "/proformas":          "Proformas",
  "/invoices":           "Factures",
  "/payments":           "Paiements",
  "/credit-notes":       "Avoirs",
  "/fpa":                "FP&A",
  "/accounting":         "Comptabilité",
  "/hr":                 "RH",
  "/admin":              "Administration",
  "/inventory":          "Inventaire",
  "/commercial":         "Commercial",
  "/marketing":          "Marketing",
  "/messaging":          "Messagerie",
  "/calls":              "Appels",
  "/users":              "Utilisateurs",
  "/notifications":      "Notifications",
  "/settings":           "Paramètres",
  "/profile":            "Mon profil",
  "/mon-espace":         "Mon espace",
  "/workspace-settings": "Paramètres de l'espace",
  "/abonnement":         "Abonnement & facturation",
  "/intelligence":       "Intelligence",
  "/automations":        "Automatisations",
  "/attendance":         "Présences",
  "/tickets":            "Tickets",
  "/alerts":             "Alertes",
  "/assistant":          "Assistant",
  "/briefing":           "Briefing",
  "/approvals":          "Approbations",
  "/anomalies":          "Anomalies",
  "/super-admin":        "Cockpit plateforme",
  "/org-tuner":          "OrgTuner",
  "/quick-actions":      "Actions rapides",
  "/operations":         "Opérations",
  "/reports":            "Rapports",
  "/map":                "Carte",
  "/search":             "Recherche",
  "/finance":            "Finance",
};

/**
 * Sub-section / detail route patterns → breadcrumb items.
 * Ordered most-specific first.
 */
const ROUTES: Array<{ pattern: RegExp; crumbs: Crumb[] }> = [
  // ── Projects ───────────────────────────────────────────────────
  { pattern: /^\/projects\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Projets", href: "/projects" }, { label: "Fiche projet" }] },
  { pattern: /^\/portfolio/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "Projets", href: "/projects" }, { label: "Portefeuille" }] },
  { pattern: /^\/workload/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "Projets", href: "/projects" }, { label: "Charge de travail" }] },

  // ── Tasks ──────────────────────────────────────────────────────
  { pattern: /^\/tasks\/(?!focus)[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Tâches", href: "/tasks" }, { label: "Détail tâche" }] },

  // ── CRM ────────────────────────────────────────────────────────
  { pattern: /^\/crm\/clients\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "CRM", href: "/crm" }, { label: "Clients", href: "/crm/clients" }, { label: "Fiche client" }] },
  { pattern: /^\/crm\/clients/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "CRM", href: "/crm" }, { label: "Clients" }] },
  { pattern: /^\/crm\/activities/,      crumbs: [{ label: "Accueil", href: "/" }, { label: "CRM", href: "/crm" }, { label: "Activités" }] },

  // ── Clients workspace ──────────────────────────────────────────
  { pattern: /^\/clients\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Clients", href: "/clients" }, { label: "Fiche client" }] },

  // ── Services ───────────────────────────────────────────────────
  { pattern: /^\/services\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Services", href: "/services" }, { label: "Détail service" }] },

  // ── Equipment ──────────────────────────────────────────────────
  { pattern: /^\/equipment\/categories/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Équipements", href: "/equipment" }, { label: "Catégories" }] },
  { pattern: /^\/equipment\/qr/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "Équipements", href: "/equipment" }, { label: "QR Codes" }] },

  // ── Collaborators ──────────────────────────────────────────────
  { pattern: /^\/collaborators\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Équipe & RH", href: "/hr" }, { label: "Fiche collaborateur" }] },
  { pattern: /^\/collaborators$/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "Équipe & RH", href: "/hr" }, { label: "Collaborateurs" }] },

  // ── Rentals ────────────────────────────────────────────────────
  { pattern: /^\/rentals\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Locations", href: "/rentals" }, { label: "Fiche location" }] },

  // ── Inspections ────────────────────────────────────────────────
  { pattern: /^\/inspections\/compare\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Inspections", href: "/inspections" }, { label: "Comparaison" }] },

  // ── FP&A ───────────────────────────────────────────────────────
  { pattern: /^\/fpa\/budgets\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Budgets", href: "/fpa/budgets" }, { label: "Détail budget" }] },
  { pattern: /^\/fpa\/budgets/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Budgets" }] },
  { pattern: /^\/fpa\/variance/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Analyse de variance" }] },
  { pattern: /^\/fpa\/forecast/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Forecast" }] },
  { pattern: /^\/fpa\/cashflow/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Cash Flow" }] },
  { pattern: /^\/fpa\/reports/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Rapports" }] },

  // ── Accounting ─────────────────────────────────────────────────
  { pattern: /^\/accounting\/chart-of-accounts/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Plan comptable" }] },
  { pattern: /^\/accounting\/entries/,           crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Écritures" }] },
  { pattern: /^\/accounting\/ledger/,            crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Grand livre" }] },
  { pattern: /^\/accounting\/balance-sheet/,     crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Bilan" }] },
  { pattern: /^\/accounting\/balance/,           crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Balance" }] },
  { pattern: /^\/accounting\/income-statement/,  crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Compte de résultat" }] },
  { pattern: /^\/accounting\/customers/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Clients" }] },
  { pattern: /^\/accounting\/suppliers/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Fournisseurs" }] },
  { pattern: /^\/accounting\/banks/,             crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Banques" }] },
  { pattern: /^\/accounting\/reconciliation/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Rapprochement" }] },
  { pattern: /^\/accounting\/fixed-assets/,      crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Immobilisations" }] },
  { pattern: /^\/accounting\/matching/,          crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Lettrage" }] },
  { pattern: /^\/accounting\/fiscal-periods/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Périodes fiscales" }] },
  { pattern: /^\/accounting\/taxes/,             crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Taxes" }] },
  { pattern: /^\/accounting\/analytical/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Analytique" }] },
  { pattern: /^\/accounting\/cash-flow/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/accounting" }, { label: "Tableau de flux" }] },

  // ── HR ─────────────────────────────────────────────────────────
  { pattern: /^\/hr\/departments/, crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Départements" }] },
  { pattern: /^\/hr\/positions/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Postes" }] },
  { pattern: /^\/hr\/contracts/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Contrats" }] },
  { pattern: /^\/hr\/documents/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Documents" }] },
  { pattern: /^\/hr\/assignments/, crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Affectations" }] },
  { pattern: /^\/hr\/leaves/,      crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Congés" }] },
  { pattern: /^\/hr\/payroll/,     crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Paie" }] },
  { pattern: /^\/hr\/recruitment/, crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Recrutement" }] },
  { pattern: /^\/hr\/evaluations/, crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Évaluations" }] },
  { pattern: /^\/hr\/training/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Formations" }] },
  { pattern: /^\/hr\/movements/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Mouvements" }] },
  { pattern: /^\/hr\/orgchart/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Organigramme" }] },
  { pattern: /^\/hr\/intelligence/,crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/hr" }, { label: "Intelligence" }] },

  // ── Admin ──────────────────────────────────────────────────────
  { pattern: /^\/admin\/roles/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Rôles" }] },
  { pattern: /^\/admin\/permissions/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Permissions" }] },
  { pattern: /^\/admin\/departments/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Départements" }] },
  { pattern: /^\/admin\/users/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Utilisateurs" }] },
  { pattern: /^\/admin\/invitations/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Invitations" }] },
  { pattern: /^\/admin\/audit/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Journal d'audit" }] },

  // ── Inventory ──────────────────────────────────────────────────
  { pattern: /^\/inventory\/warehouses/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Inventaire", href: "/inventory" }, { label: "Entrepôts" }] },

  // ── Commercial ─────────────────────────────────────────────────
  { pattern: /^\/commercial\/clients/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Commercial", href: "/commercial" }, { label: "Clients" }] },
  { pattern: /^\/commercial\/services/,crumbs: [{ label: "Accueil", href: "/" }, { label: "Commercial", href: "/commercial" }, { label: "Services" }] },

  // ── Marketing ──────────────────────────────────────────────────
  { pattern: /^\/marketing\/prospects/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Prospects" }] },
  { pattern: /^\/marketing\/campaigns/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Campagnes" }] },
  { pattern: /^\/marketing\/audiences/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Audiences" }] },
  { pattern: /^\/marketing\/templates/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Modèles" }] },
  { pattern: /^\/marketing\/automations/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Automatisations" }] },
  { pattern: /^\/marketing\/alerts/,      crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Alertes" }] },
  { pattern: /^\/marketing\/contacts/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Contacts" }] },
  { pattern: /^\/marketing\/calendar/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Calendrier" }] },
  { pattern: /^\/marketing\/analytics/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Analytique" }] },
  { pattern: /^\/marketing\/consent/,     crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Consentements" }] },
  { pattern: /^\/marketing\/channels/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Canaux" }] },
  { pattern: /^\/marketing\/forms/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Formulaires" }] },

  // ── Finance Intelligence ────────────────────────────────────────
  { pattern: /^\/finance\/intelligence/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Finance", href: "/finance" }, { label: "Intelligence" }] },
  { pattern: /^\/finance\/tresorerie/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "Finance", href: "/finance" }, { label: "Trésorerie" }] },
  { pattern: /^\/recouvrement/,          crumbs: [{ label: "Accueil", href: "/" }, { label: "Recouvrement" }] },

  // ── Documents ──────────────────────────────────────────────────
  { pattern: /^\/documents\//, crumbs: [{ label: "Accueil", href: "/" }, { label: "Documents" }, { label: "Prévisualisation" }] },
];

export function AppBreadcrumb() {
  const [location] = useLocation();
  const path = location.split("?")[0];

  if (path === "/") return null;

  // Try specific sub-section/detail match first
  const matched = ROUTES.find(r => r.pattern.test(path));
  const crumbs: Crumb[] = matched
    ? matched.crumbs
    : [{ label: "Accueil", href: "/" }, { label: TOP_LEVEL[path] ?? path.slice(1) }];

  const parentCrumb = [...crumbs].reverse().find(c => c.href && c.href !== path);

  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex items-center gap-2 px-4 sm:px-6 lg:px-8 h-9 border-b border-border/40 bg-muted/20 shrink-0"
    >
      {/* Bouton retour vers le parent le plus proche */}
      {parentCrumb?.href && (
        <>
          <Link
            href={parentCrumb.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Retour
          </Link>
          <div className="w-px h-3.5 bg-border/60 mx-0.5 shrink-0" />
        </>
      )}

      {/* Fil d'Ariane */}
      <ol className="flex items-center gap-1 min-w-0">
        {crumbs.map((crumb, i) => {
          const isFirst = i === 0;
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              )}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
                >
                  {isFirst && <Home className="w-3 h-3 shrink-0" />}
                  {isFirst ? null : crumb.label}
                </Link>
              ) : (
                <span className={`text-xs truncate max-w-[180px] ${isLast ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {isFirst ? <Home className="w-3 h-3 inline" /> : crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
