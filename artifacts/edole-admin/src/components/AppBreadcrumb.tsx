import { useLocation, Link } from "wouter";
import { ChevronRight, ArrowLeft } from "lucide-react";

type Crumb = { label: string; href?: string };

/**
 * Route pattern → breadcrumb items.
 * Ordered: most specific first.
 * Only routes with 2+ crumbs are listed — single-level routes need no breadcrumb.
 */
const ROUTES: Array<{ pattern: RegExp; crumbs: Crumb[] }> = [
  // ── Projects ───────────────────────────────────────────────────
  { pattern: /^\/projects\/[^/?]+/, crumbs: [{ label: "Projets", href: "/projects" }, { label: "Fiche projet" }] },
  { pattern: /^\/portfolio/, crumbs: [{ label: "Projets", href: "/projects" }, { label: "Portefeuille" }] },
  { pattern: /^\/workload/, crumbs: [{ label: "Projets", href: "/projects" }, { label: "Charge de travail" }] },

  // ── Tasks ──────────────────────────────────────────────────────
  { pattern: /^\/tasks\/(?!focus)[^/?]+/, crumbs: [{ label: "Tâches", href: "/tasks" }, { label: "Détail tâche" }] },

  // ── CRM ────────────────────────────────────────────────────────
  { pattern: /^\/crm\/clients\/[^/?]+/, crumbs: [{ label: "CRM", href: "/crm" }, { label: "Clients", href: "/crm/clients" }, { label: "Fiche client" }] },
  { pattern: /^\/crm\/clients/, crumbs: [{ label: "CRM", href: "/crm" }, { label: "Clients" }] },
  { pattern: /^\/crm\/activities/, crumbs: [{ label: "CRM", href: "/crm" }, { label: "Activités" }] },

  // ── Clients (workspace) ────────────────────────────────────────
  { pattern: /^\/clients\/[^/?]+/, crumbs: [{ label: "Clients", href: "/clients" }, { label: "Fiche client" }] },

  // ── Services ───────────────────────────────────────────────────
  { pattern: /^\/services\/[^/?]+/, crumbs: [{ label: "Services", href: "/services" }, { label: "Détail service" }] },

  // ── Equipment ──────────────────────────────────────────────────
  { pattern: /^\/equipment\/categories/, crumbs: [{ label: "Équipements", href: "/equipment" }, { label: "Catégories" }] },
  { pattern: /^\/equipment\/qr/, crumbs: [{ label: "Équipements", href: "/equipment" }, { label: "QR Codes" }] },

  // ── Collaborators ──────────────────────────────────────────────
  { pattern: /^\/collaborators\/[^/?]+/, crumbs: [{ label: "Collaborateurs", href: "/collaborators" }, { label: "Fiche collaborateur" }] },

  // ── Rentals ────────────────────────────────────────────────────
  { pattern: /^\/rentals\/[^/?]+/, crumbs: [{ label: "Locations", href: "/rentals" }, { label: "Fiche location" }] },

  // ── Inspections ────────────────────────────────────────────────
  { pattern: /^\/inspections\/compare\/[^/?]+/, crumbs: [{ label: "Inspections", href: "/inspections" }, { label: "Comparaison" }] },

  // ── FP&A ───────────────────────────────────────────────────────
  { pattern: /^\/fpa\/budgets\/[^/?]+/, crumbs: [{ label: "FP&A", href: "/fpa" }, { label: "Budgets", href: "/fpa/budgets" }, { label: "Détail budget" }] },
  { pattern: /^\/fpa\/budgets/, crumbs: [{ label: "FP&A", href: "/fpa" }, { label: "Budgets" }] },
  { pattern: /^\/fpa\/variance/, crumbs: [{ label: "FP&A", href: "/fpa" }, { label: "Analyse de variance" }] },
  { pattern: /^\/fpa\/forecast/, crumbs: [{ label: "FP&A", href: "/fpa" }, { label: "Forecast" }] },
  { pattern: /^\/fpa\/cashflow/, crumbs: [{ label: "FP&A", href: "/fpa" }, { label: "Cash Flow" }] },
  { pattern: /^\/fpa\/reports/, crumbs: [{ label: "FP&A", href: "/fpa" }, { label: "Rapports" }] },

  // ── Accounting ─────────────────────────────────────────────────
  { pattern: /^\/accounting\/chart-of-accounts/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Plan comptable" }] },
  { pattern: /^\/accounting\/entries/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Écritures" }] },
  { pattern: /^\/accounting\/ledger/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Grand livre" }] },
  { pattern: /^\/accounting\/balance-sheet/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Bilan" }] },
  { pattern: /^\/accounting\/balance/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Balance" }] },
  { pattern: /^\/accounting\/income-statement/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Compte de résultat" }] },
  { pattern: /^\/accounting\/customers/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Clients" }] },
  { pattern: /^\/accounting\/suppliers/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Fournisseurs" }] },
  { pattern: /^\/accounting\/banks/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Banques" }] },
  { pattern: /^\/accounting\/reconciliation/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Rapprochement" }] },
  { pattern: /^\/accounting\/fixed-assets/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Immobilisations" }] },
  { pattern: /^\/accounting\/matching/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Lettrage" }] },
  { pattern: /^\/accounting\/fiscal-periods/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Périodes fiscales" }] },
  { pattern: /^\/accounting\/taxes/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Taxes" }] },
  { pattern: /^\/accounting\/analytical/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Analytique" }] },
  { pattern: /^\/accounting\/cash-flow/, crumbs: [{ label: "Comptabilité", href: "/accounting" }, { label: "Tableau de flux" }] },

  // ── HR ─────────────────────────────────────────────────────────
  { pattern: /^\/hr\/departments/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Départements" }] },
  { pattern: /^\/hr\/positions/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Postes" }] },
  { pattern: /^\/hr\/contracts/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Contrats" }] },
  { pattern: /^\/hr\/documents/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Documents" }] },
  { pattern: /^\/hr\/assignments/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Affectations" }] },
  { pattern: /^\/hr\/leaves/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Congés" }] },
  { pattern: /^\/hr\/payroll/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Paie" }] },
  { pattern: /^\/hr\/recruitment/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Recrutement" }] },
  { pattern: /^\/hr\/evaluations/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Évaluations" }] },
  { pattern: /^\/hr\/training/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Formations" }] },
  { pattern: /^\/hr\/movements/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Mouvements" }] },
  { pattern: /^\/hr\/orgchart/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Organigramme" }] },
  { pattern: /^\/hr\/intelligence/, crumbs: [{ label: "RH", href: "/hr" }, { label: "Intelligence" }] },

  // ── Admin ──────────────────────────────────────────────────────
  { pattern: /^\/admin\/roles/, crumbs: [{ label: "Administration", href: "/admin" }, { label: "Rôles" }] },
  { pattern: /^\/admin\/permissions/, crumbs: [{ label: "Administration", href: "/admin" }, { label: "Permissions" }] },
  { pattern: /^\/admin\/departments/, crumbs: [{ label: "Administration", href: "/admin" }, { label: "Départements" }] },
  { pattern: /^\/admin\/users/, crumbs: [{ label: "Administration", href: "/admin" }, { label: "Utilisateurs" }] },
  { pattern: /^\/admin\/invitations/, crumbs: [{ label: "Administration", href: "/admin" }, { label: "Invitations" }] },
  { pattern: /^\/admin\/audit/, crumbs: [{ label: "Administration", href: "/admin" }, { label: "Journal d'audit" }] },

  // ── Inventory ──────────────────────────────────────────────────
  { pattern: /^\/inventory\/warehouses/, crumbs: [{ label: "Inventaire", href: "/inventory" }, { label: "Entrepôts" }] },

  // ── Commercial ─────────────────────────────────────────────────
  { pattern: /^\/commercial\/clients/, crumbs: [{ label: "Commercial", href: "/commercial" }, { label: "Clients" }] },
  { pattern: /^\/commercial\/services/, crumbs: [{ label: "Commercial", href: "/commercial" }, { label: "Services" }] },

  // ── Marketing ──────────────────────────────────────────────────
  { pattern: /^\/marketing\/prospects/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Prospects" }] },
  { pattern: /^\/marketing\/campaigns/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Campagnes" }] },
  { pattern: /^\/marketing\/audiences/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Audiences" }] },
  { pattern: /^\/marketing\/templates/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Modèles" }] },
  { pattern: /^\/marketing\/automations/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Automatisations" }] },
  { pattern: /^\/marketing\/alerts/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Alertes" }] },
  { pattern: /^\/marketing\/contacts/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Contacts" }] },
  { pattern: /^\/marketing\/calendar/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Calendrier" }] },
  { pattern: /^\/marketing\/analytics/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Analytique" }] },
  { pattern: /^\/marketing\/consent/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Consentements" }] },
  { pattern: /^\/marketing\/channels/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Canaux" }] },
  { pattern: /^\/marketing\/forms/, crumbs: [{ label: "Marketing", href: "/marketing" }, { label: "Formulaires" }] },

  // ── Finance Intelligence ────────────────────────────────────────
  { pattern: /^\/finance\/intelligence/, crumbs: [{ label: "Finance", href: "/finance" }, { label: "Intelligence" }] },

  // ── Documents ──────────────────────────────────────────────────
  { pattern: /^\/documents\//, crumbs: [{ label: "Documents", href: "/documents" }, { label: "Prévisualisation" }] },
];

export function AppBreadcrumb() {
  const [location] = useLocation();
  const path = location.split("?")[0];

  const matched = ROUTES.find(r => r.pattern.test(path));
  if (!matched || matched.crumbs.length < 2) return null;

  const crumbs = matched.crumbs;
  const parentHref = crumbs.findLast(c => c.href)?.href;

  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex items-center gap-2 px-4 sm:px-6 lg:px-8 h-9 border-b border-border/40 bg-muted/20 shrink-0"
    >
      {/* Bouton retour */}
      {parentHref && (
        <Link
          href={parentHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mr-1 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Retour
        </Link>
      )}

      {parentHref && (
        <div className="w-px h-3.5 bg-border/60 mx-0.5" />
      )}

      {/* Fil d'Ariane */}
      <ol className="flex items-center gap-1 min-w-0">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              )}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[160px]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={`text-xs truncate max-w-[200px] ${isLast ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
