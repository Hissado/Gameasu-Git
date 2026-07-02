import { useLocation, Link } from "wouter";
import { ChevronRight, ArrowLeft, Home } from "lucide-react";

type Crumb = { label: string; href?: string };

/** Top-level route labels — shows "Accueil > Section" for every page except "/" */
const TOP_LEVEL: Record<string, string> = {
  "/projets":           "Projets",
  "/portefeuille":      "Portefeuille",
  "/charge":            "Charge de travail",
  "/tasks":             "Tâches",
  "/crm":               "CRM",
  "/clients":           "Clients",
  "/services":          "Services",
  "/equipements":       "Équipements",
  "/collaborateurs":    "Collaborateurs",
  "/locations":         "Locations",
  "/inspections":       "Inspections",
  "/logistique":        "Logistique",
  "/tarification":      "Calculateur de prix",
  "/commandes":         "Commandes",
  "/devis":             "Proformas",
  "/factures":          "Factures",
  "/paiements":         "Paiements",
  "/avoirs":            "Avoirs",
  "/fpa":               "FP&A",
  "/comptabilite":      "Comptabilité",
  "/rh":                "RH",
  "/admin":             "Administration",
  "/stock":             "Inventaire",
  "/commercial":        "Commercial",
  "/marketing":         "Marketing",
  "/messaging":         "Messagerie",
  "/appels":            "Appels",
  "/utilisateurs":      "Utilisateurs",
  "/notifications":     "Notifications",
  "/parametres":        "Paramètres",
  "/profil":            "Mon profil",
  "/mon-espace":        "Mon espace",
  "/workspace-settings": "Paramètres de l'espace",
  "/abonnement":        "Abonnement & facturation",
  "/intelligence":      "Intelligence",
  "/automations":       "Automatisations",
  "/presences":         "Présences",
  "/tickets":           "Tickets",
  "/alertes":           "Alertes",
  "/assistant":         "Assistant",
  "/briefing":          "Briefing",
  "/approbations":      "Approbations",
  "/anomalies":         "Anomalies",
  "/super-admin":       "Cockpit plateforme",
  "/org-tuner":         "OrgTuner",
  "/quick-actions":     "Actions rapides",
  "/operations":        "Opérations",
  "/rapports":          "Rapports",
  "/carte":             "Carte",
  "/recherche":         "Recherche",
  "/finance":           "Finance",
};

/**
 * Sub-section / detail route patterns → breadcrumb items.
 * Ordered most-specific first.
 */
const ROUTES: Array<{ pattern: RegExp; crumbs: Crumb[] }> = [
  // ── Projects ───────────────────────────────────────────────────
  { pattern: /^\/projets\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Projets", href: "/projets" }, { label: "Fiche projet" }] },
  { pattern: /^\/portefeuille/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "Projets", href: "/projets" }, { label: "Portefeuille" }] },
  { pattern: /^\/charge/,          crumbs: [{ label: "Accueil", href: "/" }, { label: "Projets", href: "/projets" }, { label: "Charge de travail" }] },

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
  { pattern: /^\/equipements\/categories/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Équipements", href: "/equipements" }, { label: "Catégories" }] },
  { pattern: /^\/equipements\/qr/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "Équipements", href: "/equipements" }, { label: "QR Codes" }] },

  // ── Collaborators ──────────────────────────────────────────────
  { pattern: /^\/collaborateurs\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Équipe & RH", href: "/rh" }, { label: "Fiche collaborateur" }] },
  { pattern: /^\/collaborateurs$/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "Équipe & RH", href: "/rh" }, { label: "Collaborateurs" }] },

  // ── Rentals ────────────────────────────────────────────────────
  { pattern: /^\/locations\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Locations", href: "/locations" }, { label: "Fiche location" }] },

  // ── Inspections ────────────────────────────────────────────────
  { pattern: /^\/inspections\/comparer\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Inspections", href: "/inspections" }, { label: "Comparaison" }] },

  // ── FP&A ───────────────────────────────────────────────────────
  { pattern: /^\/fpa\/budgets\/[^/?]+/, crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Budgets", href: "/fpa/budgets" }, { label: "Détail budget" }] },
  { pattern: /^\/fpa\/budgets/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Budgets" }] },
  { pattern: /^\/fpa\/variance/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Analyse de variance" }] },
  { pattern: /^\/fpa\/forecast/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Forecast" }] },
  { pattern: /^\/fpa\/cashflow/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Cash Flow" }] },
  { pattern: /^\/fpa\/reports/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "FP&A", href: "/fpa" }, { label: "Rapports" }] },

  // ── Comptabilité ───────────────────────────────────────────────
  { pattern: /^\/comptabilite\/plan-comptable/,    crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Plan comptable" }] },
  { pattern: /^\/comptabilite\/ecritures/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Écritures" }] },
  { pattern: /^\/comptabilite\/grand-livre/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Grand livre" }] },
  { pattern: /^\/comptabilite\/bilan/,             crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Bilan" }] },
  { pattern: /^\/comptabilite\/balance/,           crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Balance" }] },
  { pattern: /^\/comptabilite\/compte-de-resultat/,crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Compte de résultat" }] },
  { pattern: /^\/comptabilite\/clients/,           crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Clients" }] },
  { pattern: /^\/comptabilite\/fournisseurs/,      crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Fournisseurs" }] },
  { pattern: /^\/comptabilite\/banques/,           crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Banques" }] },
  { pattern: /^\/comptabilite\/rapprochement/,     crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Rapprochement" }] },
  { pattern: /^\/comptabilite\/immobilisations/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Immobilisations" }] },
  { pattern: /^\/comptabilite\/lettrage/,          crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Lettrage" }] },
  { pattern: /^\/comptabilite\/periodes-fiscales/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Périodes fiscales" }] },
  { pattern: /^\/comptabilite\/taxes/,             crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Taxes" }] },
  { pattern: /^\/comptabilite\/analytique/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Analytique" }] },
  { pattern: /^\/comptabilite\/flux-tresorerie/,   crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Tableau de flux" }] },
  { pattern: /^\/comptabilite\/cloture/,           crumbs: [{ label: "Accueil", href: "/" }, { label: "Comptabilité", href: "/comptabilite" }, { label: "Clôture" }] },

  // ── RH ─────────────────────────────────────────────────────────
  { pattern: /^\/rh\/departements/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Départements" }] },
  { pattern: /^\/rh\/postes/,             crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Postes" }] },
  { pattern: /^\/rh\/contrats/,           crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Contrats" }] },
  { pattern: /^\/rh\/documents/,          crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Documents" }] },
  { pattern: /^\/rh\/affectations/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Affectations" }] },
  { pattern: /^\/rh\/conges/,             crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Congés" }] },
  { pattern: /^\/rh\/paie/,               crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Paie" }] },
  { pattern: /^\/rh\/recrutement/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Recrutement" }] },
  { pattern: /^\/rh\/evaluations/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Évaluations" }] },
  { pattern: /^\/rh\/formations/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Formations" }] },
  { pattern: /^\/rh\/mouvements/,         crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Mouvements" }] },
  { pattern: /^\/rh\/organigramme/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Organigramme" }] },
  { pattern: /^\/rh\/intelligence/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Intelligence" }] },
  { pattern: /^\/rh\/notes-frais/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Notes de frais" }] },
  { pattern: /^\/rh\/integration/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Intégration" }] },
  { pattern: /^\/rh\/avantages/,          crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Avantages" }] },
  { pattern: /^\/rh\/registre-legal/,     crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Registre légal" }] },
  { pattern: /^\/rh\/indicateurs/,        crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Indicateurs" }] },
  { pattern: /^\/rh\/rapports/,           crumbs: [{ label: "Accueil", href: "/" }, { label: "RH", href: "/rh" }, { label: "Rapports RH" }] },

  // ── Admin ──────────────────────────────────────────────────────
  { pattern: /^\/admin\/roles/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Rôles" }] },
  { pattern: /^\/admin\/permissions/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Permissions" }] },
  { pattern: /^\/admin\/departments/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Départements" }] },
  { pattern: /^\/admin\/users/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Utilisateurs" }] },
  { pattern: /^\/admin\/invitations/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Invitations" }] },
  { pattern: /^\/admin\/audit/,       crumbs: [{ label: "Accueil", href: "/" }, { label: "Administration", href: "/admin" }, { label: "Journal d'audit" }] },

  // ── Inventaire ─────────────────────────────────────────────────
  { pattern: /^\/stock\/entrepots/, crumbs: [{ label: "Accueil", href: "/" }, { label: "Inventaire", href: "/stock" }, { label: "Entrepôts" }] },

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
