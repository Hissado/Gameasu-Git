import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import {
  X, ChevronRight, ChevronLeft, Sparkles, BookOpen, MapPin,
  CheckCircle2, Circle, Clock, Play, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TourStep {
  target: string;
  title: string;
  description: string;
  /** Bouton d'action optionnel affiché dans la bulle */
  action?: { label: string; href: string };
}

export interface TourPath {
  key: string;
  name: string;
  description: string;
  steps: TourStep[];
}

// ─── Catalogue de parcours ─────────────────────────────────────────────────────

export const TOUR_PATHS: Record<string, TourPath[]> = {
  dashboard: [
    {
      key: "decouverte",
      name: "Découverte",
      description: "Vue d'ensemble des KPIs et de l'activité récente en 3 étapes.",
      steps: [
        {
          target: "dash-header",
          title: "Votre espace de travail",
          description: "Le tableau de bord s'ouvre sur votre salutation personnalisée, la date du jour et un résumé des alertes actives (factures en retard, tâches échues).",
        },
        {
          target: "dash-kpis",
          title: "Indicateurs clés",
          description: "Encaissements du mois, créances ouvertes, pipeline CRM, taux de recouvrement — une vue synthétique actualisée en temps réel. Cliquez sur un KPI pour accéder au module.",
        },
        {
          target: "dash-alerts",
          title: "Alertes & tâches prioritaires",
          description: "Les actions urgentes remontent ici. Chaque alerte est un lien direct vers le document ou la tâche concernée — agissez sans chercher dans les menus.",
        },
      ],
    },
    {
      key: "actions-rapides",
      name: "Actions rapides",
      description: "Maîtrisez les raccourcis et créations rapides du tableau de bord.",
      steps: [
        {
          target: "dash-header",
          title: "Créer rapidement",
          description: "Les boutons en haut à droite du panneau permettent de créer factures, devis, clients et projets en un clic, sans quitter le tableau de bord.",
          action: { label: "Créer une facture", href: "/factures" },
        },
        {
          target: "dash-kpis",
          title: "Naviguer par KPI",
          description: "Chaque carte KPI est cliquable et redirige vers le module correspondant. Cliquez sur «Créances ouvertes» pour aller directement aux factures impayées.",
        },
        {
          target: "dash-alerts",
          title: "Traiter les alertes",
          description: "Chaque alerte est un lien direct vers l'élément concerné. Traitez vos priorités sans naviguer dans les menus.",
          action: { label: "Voir les factures", href: "/factures" },
        },
      ],
    },
  ],
  crm: [
    {
      key: "decouverte",
      name: "Découverte du CRM",
      description: "Apprenez à gérer vos opportunités commerciales en mode kanban.",
      steps: [
        {
          target: "crm-pipeline",
          title: "Kanban pipeline",
          description: "Les colonnes représentent les stades de votre cycle de vente. Faites glisser une opportunité d'une colonne à l'autre pour mettre à jour son avancement.",
        },
        {
          target: "crm-pipeline",
          title: "Fiche opportunité",
          description: "Chaque carte affiche la valeur estimée, la probabilité de gain, le commercial responsable et la prochaine action planifiée.",
        },
      ],
    },
    {
      key: "conversion",
      name: "Conversion & suivi",
      description: "Cycle complet : activités, conversion et reporting commercial.",
      steps: [
        {
          target: "crm-pipeline",
          title: "Filtres et assignation",
          description: "Utilisez les filtres en haut pour n'afficher que vos opportunités ou celles d'un commercial spécifique. Reassignez en un clic depuis la carte.",
        },
        {
          target: "crm-pipeline",
          title: "Convertir en client",
          description: "Une opportunité «Gagnée» se convertit en client directement depuis la fiche détail. Les coordonnées et le contexte commercial sont repris automatiquement.",
          action: { label: "Voir le CRM", href: "/crm" },
        },
      ],
    },
  ],
  projets: [
    {
      key: "decouverte",
      name: "Portefeuille projets",
      description: "Créez et suivez vos projets, phases et équipes.",
      steps: [
        {
          target: "proj-table",
          title: "Liste des projets",
          description: "Vue synthétique de tous vos projets actifs : budget alloué, taux d'avancement calculé automatiquement à partir des tâches, et équipe affectée.",
        },
        {
          target: "proj-header",
          title: "Fiche projet",
          description: "Phases, tâches, documents, budget et collaborateurs — tout est centralisé. Naviguez par onglets pour chaque dimension.",
        },
      ],
    },
    {
      key: "suivi",
      name: "Suivi & charge équipe",
      description: "Budget réalisé, avancement et gestion de la charge par collaborateur.",
      steps: [
        {
          target: "proj-table",
          title: "Avancement automatique",
          description: "Le taux d'avancement est calculé automatiquement à partir du ratio tâches terminées / total des tâches. Il se met à jour en temps réel.",
        },
        {
          target: "proj-header",
          title: "Budget réalisé",
          description: "Le budget consommé se met à jour dès qu'une facture ou dépense est associée au projet. Suivez l'écart budget/réalisé à tout moment.",
          action: { label: "Voir les projets", href: "/projets" },
        },
      ],
    },
  ],
  factures: [
    {
      key: "decouverte",
      name: "Facturation SYSCOHADA",
      description: "Créez et gérez vos factures conformément à la norme comptable.",
      steps: [
        {
          target: "inv-table",
          title: "Liste des factures",
          description: "Toutes vos factures avec leur statut (brouillon, envoyée, payée, annulée), montant TTC et date d'échéance. Le rouge indique les factures en retard.",
        },
        {
          target: "inv-header",
          title: "Nouvelle facture",
          description: "Sélectionnez le client, ajoutez les lignes de prestation avec TVA et définissez l'échéance. La numérotation SYSCOHADA est générée automatiquement.",
          action: { label: "Créer une facture", href: "/factures" },
        },
      ],
    },
    {
      key: "encaissement",
      name: "Encaissement & relances",
      description: "Suivez les règlements reçus et gérez les relances clients.",
      steps: [
        {
          target: "inv-table",
          title: "Identifier les retards",
          description: "Les factures en rouge ont dépassé leur date d'échéance. Filtrez-les pour lancer des relances groupées ou accéder au module Recouvrement.",
        },
        {
          target: "inv-table",
          title: "Export PDF et email",
          description: "Chaque facture est exportable en PDF et peut être envoyée par email depuis la fiche. Le modèle reprend votre logo et vos coordonnées bancaires.",
          action: { label: "Voir les factures", href: "/factures" },
        },
      ],
    },
  ],
  fpa: [
    {
      key: "decouverte",
      name: "Introduction au FP&A",
      description: "Budget, forecast et analyse des écarts financiers.",
      steps: [
        {
          target: "fpa-nav",
          title: "Budgets versionnés",
          description: "Chaque budget est versionné et peut être dupliqué pour créer des scénarios alternatifs (best case, worst case). Un seul budget peut être «actif» par périmètre.",
        },
        {
          target: "fpa-chart",
          title: "Analyse des écarts",
          description: "Comparez budget vs réalisé compte par compte et mois par mois. Les écarts négatifs sont surlignés automatiquement pour attirer votre attention.",
        },
      ],
    },
    {
      key: "projection",
      name: "Forecast & projection fin d'année",
      description: "Anticipez la clôture avec les outils de projection FP&A.",
      steps: [
        {
          target: "fpa-nav",
          title: "Activer un budget",
          description: "L'activation d'un budget l'élève en référence du périmètre et archive automatiquement le précédent. Un seul budget actif par périmètre à la fois.",
        },
        {
          target: "fpa-chart",
          title: "Projection fin d'année",
          description: "L'atterrissage (YTD + budget restant) et la projection linéaire vous donnent deux visions de la fin d'exercice pour affiner vos décisions budgétaires.",
          action: { label: "Voir les budgets", href: "/fpa" },
        },
      ],
    },
  ],
  collaborateurs: [
    {
      key: "decouverte",
      name: "Fiches collaborateurs",
      description: "Profils RH, charge de travail et gestion des équipes.",
      steps: [
        {
          target: "collab-list",
          title: "Annuaire des collaborateurs",
          description: "Tous vos collaborateurs avec leur poste, statut et taux de charge actuel. La couleur de la barre indique la charge : vert = disponible, rouge = surchargé.",
        },
        {
          target: "collab-search",
          title: "Matrice de charge",
          description: "Visualisez la charge semaine par semaine pour chaque collaborateur et anticipez les ressources disponibles pour vos prochains projets.",
          action: { label: "Voir les collaborateurs", href: "/collaborateurs" },
        },
      ],
    },
    {
      key: "rh_admin",
      name: "Administration RH",
      description: "Contrats, congés et gestion des droits d'accès par collaborateur.",
      steps: [
        {
          target: "collab-list",
          title: "Créer un collaborateur",
          description: "Renseignez le profil complet : informations personnelles, poste, département et manager direct. Le compte d'accès à l'ERP est créé automatiquement si une adresse email est fournie.",
        },
        {
          target: "collab-search",
          title: "Congés et absences",
          description: "Suivez les soldes de congés, validez les demandes et visualisez les chevauchements pour éviter les sous-effectifs. Les absences s'intègrent à la feuille de paie.",
          action: { label: "Gérer les collaborateurs", href: "/collaborateurs" },
        },
      ],
    },
  ],
  paiements: [
    {
      key: "decouverte",
      name: "Encaissements clients",
      description: "Enregistrez et suivez tous les règlements reçus.",
      steps: [
        {
          target: "pay-table",
          title: "Journal des encaissements",
          description: "Tous les paiements reçus triés par date, avec le mode de règlement (virement, espèces, mobile money) et la facture associée. La comptabilisation est automatique.",
        },
        {
          target: "pay-table",
          title: "Saisir un encaissement",
          description: "Associez un paiement à une ou plusieurs factures, y compris des règlements partiels. La balance de chaque facture se met à jour immédiatement.",
          action: { label: "Saisir un paiement", href: "/paiements" },
        },
      ],
    },
    {
      key: "rapprochement",
      name: "Rapprochement bancaire",
      description: "Vérifiez que vos encaissements ERP correspondent aux relevés bancaires.",
      steps: [
        {
          target: "pay-table",
          title: "Filtrer par période",
          description: "Sélectionnez une période et un compte bancaire pour lister les encaissements à rapprocher. Exportez la liste en CSV pour comparer avec votre relevé bancaire.",
        },
        {
          target: "pay-table",
          title: "Écarts et corrections",
          description: "Si un montant ne correspond pas, corrigez-le directement depuis la fiche paiement. La balance de la facture associée se recalcule automatiquement.",
          action: { label: "Voir les paiements", href: "/paiements" },
        },
      ],
    },
  ],
  locations: [
    {
      key: "decouverte",
      name: "Locations d'équipements",
      description: "Gérez les contrats de location et les états des lieux.",
      steps: [
        {
          target: "rental-table",
          title: "Planning des locations",
          description: "Vue calendaire des équipements loués : disponibilités, contrats en cours et retours prévus. Repérez les conflits de réservation en un coup d'œil.",
        },
        {
          target: "rental-header",
          title: "États des lieux",
          description: "Chaque contrat inclut un état des lieux départ et retour pour documenter l'état des équipements et protéger vos intérêts.",
        },
      ],
    },
    {
      key: "inspection_logistique",
      name: "Inspections & logistique",
      description: "Protocole de départ, retour et transport des équipements.",
      steps: [
        {
          target: "rental-table",
          title: "Inspection avant départ",
          description: "Renseignez l'état de chaque équipement avant la livraison : photos, commentaires et signature client. Ce rapport constitue la référence contractuelle en cas de litige.",
        },
        {
          target: "rental-header",
          title: "Opérations logistiques",
          description: "Planifiez la livraison et le retour avec le module Logistique. Les chauffeurs et moyens de transport sont assignés depuis la fiche de location.",
          action: { label: "Voir les locations", href: "/locations" },
        },
      ],
    },
  ],
  taches: [
    {
      key: "decouverte",
      name: "Gestion des tâches",
      description: "Organisez et suivez votre travail quotidien.",
      steps: [
        {
          target: "task-table",
          title: "Liste des tâches",
          description: "Toutes vos tâches avec priorité (haute/normale/basse), assignation, date d'échéance et statut. Les tâches échues s'affichent en rouge.",
        },
        {
          target: "task-table",
          title: "Filtres et sous-tâches",
          description: "Filtrez par statut, priorité ou projet. Chaque tâche peut avoir des sous-tâches, des commentaires d'équipe et des pièces jointes.",
          action: { label: "Voir les tâches", href: "/tasks" },
        },
      ],
    },
    {
      key: "collaboration",
      name: "Collaboration & reporting",
      description: "Commentaires, assignations multiples et suivi de l'avancement.",
      steps: [
        {
          target: "task-table",
          title: "Assigner et déléguer",
          description: "Chaque tâche peut être assignée à un ou plusieurs collaborateurs. L'assigné reçoit une notification immédiate et la tâche apparaît en priorité dans son tableau de bord.",
        },
        {
          target: "task-table",
          title: "Commentaires et historique",
          description: "L'onglet Commentaires de chaque tâche constitue le fil de discussion de l'équipe : mentionnez un collègue avec @, joignez un fichier ou partagez une mise à jour d'avancement.",
          action: { label: "Voir les tâches", href: "/tasks" },
        },
      ],
    },
  ],
  plan_comptable: [
    {
      key: "decouverte",
      name: "Plan de comptes SYSCOHADA",
      description: "Naviguez dans la structure comptable normalisée.",
      steps: [
        {
          target: "coa-classes",
          title: "Classes de comptes",
          description: "Les comptes sont organisés en 8 classes SYSCOHADA (immobilisations, stocks, tiers, financiers, charges, produits…). Développez chaque classe pour voir le détail.",
        },
        {
          target: "coa-classes",
          title: "Comptes personnalisés",
          description: "Créez des sous-comptes spécifiques à votre organisation en respectant la nomenclature SYSCOHADA. Les journaux et saisies s'actualisent en temps réel.",
          action: { label: "Voir le plan", href: "/comptabilite/plan-comptable" },
        },
      ],
    },
    {
      key: "saisie_journaux",
      name: "Saisie & journaux comptables",
      description: "Enregistrez les écritures et consultez les journaux de votre exercice.",
      steps: [
        {
          target: "coa-classes",
          title: "Écriture de journal",
          description: "Chaque écriture comptable est passée en partie double (débit/crédit) sur des comptes du plan SYSCOHADA. Le solde de chaque compte se met à jour immédiatement après validation.",
        },
        {
          target: "coa-classes",
          title: "Journaux et lettrage",
          description: "Consultez le journal général ou les journaux auxiliaires (ventes, achats, banque, caisse). Le lettrage permet d'identifier les règlements associés à chaque écriture client/fournisseur.",
          action: { label: "Voir la comptabilité", href: "/comptabilite/plan-comptable" },
        },
      ],
    },
  ],
};

// ─── Constants & LS helpers ─────────────────────────────────────────────────────

export const TOUR_MODULE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/crm": "crm",
  "/projets": "projets",
  "/collaborateurs": "collaborateurs",
  "/comptabilite/plan-comptable": "plan_comptable",
  "/fpa": "fpa",
  "/tasks": "taches",
  "/factures": "factures",
  "/paiements": "paiements",
  "/locations": "locations",
};

const LS_KEY = (k: string) => `tour_seen_${k}`;
const LS_PATH_DONE = (m: string, p: string) => `tour_path_done_${m}_${p}`;
const LS_PATH_STEP = (m: string, p: string) => `tour_path_step_${m}_${p}`;

export const RELAUNCH_EVENT = "gameasu:relaunch-tour";

// ─── Path progress helpers ─────────────────────────────────────────────────────

export type PathStatus = "done" | "in_progress" | "not_started";

export function getPathStatus(moduleKey: string, pathKey: string): PathStatus {
  if (localStorage.getItem(LS_PATH_DONE(moduleKey, pathKey))) return "done";
  const step = localStorage.getItem(LS_PATH_STEP(moduleKey, pathKey));
  if (step !== null) return "in_progress";
  return "not_started";
}

export function savePathProgress(moduleKey: string, pathKey: string, step: number, totalSteps: number) {
  if (step >= totalSteps - 1) {
    localStorage.setItem(LS_PATH_DONE(moduleKey, pathKey), "1");
    localStorage.removeItem(LS_PATH_STEP(moduleKey, pathKey));
  } else {
    localStorage.setItem(LS_PATH_STEP(moduleKey, pathKey), String(step));
  }
}

export function resetPathProgress(moduleKey: string, pathKey: string) {
  localStorage.removeItem(LS_PATH_DONE(moduleKey, pathKey));
  localStorage.removeItem(LS_PATH_STEP(moduleKey, pathKey));
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useModuleTour(moduleKey: string, canAutoShow = false) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [selectedPathKey, setSelectedPathKey] = useState<string | null>(null);

  const modulePaths = useMemo(() => TOUR_PATHS[moduleKey] ?? [], [moduleKey]);

  // Active path: explicitly selected by user, or first available path
  const activePathKey = selectedPathKey ?? modulePaths[0]?.key ?? null;

  const activePathSteps = useMemo(
    () => modulePaths.find(p => p.key === activePathKey)?.steps ?? [],
    [modulePaths, activePathKey],
  );

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (canAutoShow && !localStorage.getItem(LS_KEY(moduleKey))) {
      t = setTimeout(() => setShowWelcome(true), 600);
    }
    return () => { if (t !== undefined) clearTimeout(t); };
  }, [moduleKey, canAutoShow]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === moduleKey) {
        localStorage.removeItem(LS_KEY(moduleKey));
        setTourActive(false);
        setSelectedPathKey(null);
        setTimeout(() => setShowWelcome(true), 100);
      }
    };
    window.addEventListener(RELAUNCH_EVENT, handler);
    return () => window.removeEventListener(RELAUNCH_EVENT, handler);
  }, [moduleKey]);

  const startTour = useCallback(() => {
    const pathKey = modulePaths[0]?.key;
    if (pathKey && !localStorage.getItem(LS_PATH_DONE(moduleKey, pathKey))) {
      localStorage.setItem(LS_PATH_STEP(moduleKey, pathKey), "0");
    }
    localStorage.setItem(LS_KEY(moduleKey), "1");
    setShowWelcome(false);
    setTourActive(true);
  }, [moduleKey, modulePaths]);

  const startTourWithPath = useCallback((pathKey: string) => {
    if (!localStorage.getItem(LS_PATH_DONE(moduleKey, pathKey))) {
      localStorage.setItem(LS_PATH_STEP(moduleKey, pathKey), "0");
    }
    setSelectedPathKey(pathKey);
    localStorage.setItem(LS_KEY(moduleKey), "1");
    setShowWelcome(false);
    setTourActive(true);
  }, [moduleKey]);

  const dismissWelcome = useCallback(() => {
    localStorage.setItem(LS_KEY(moduleKey), "1");
    setShowWelcome(false);
  }, [moduleKey]);

  const closeTour = useCallback(() => {
    setTourActive(false);
    setSelectedPathKey(null);
  }, []);

  // Step change handler: persists to localStorage + server (for WelcomeModal-started tours)
  const handleTourStepChange = useCallback((step: number) => {
    if (!activePathKey || activePathSteps.length === 0) return;
    savePathProgress(moduleKey, activePathKey, step, activePathSteps.length);
    const token = localStorage.getItem("auth_token") ?? "";
    fetch("/api/onboarding/tour-progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        moduleKey,
        pathKey: activePathKey,
        currentStep: step,
        isDone: step >= activePathSteps.length - 1,
      }),
    }).catch(() => {});
  }, [moduleKey, activePathKey, activePathSteps.length]);

  // Initial step for resuming a tour across page navigations
  const tourInitialStep = useMemo(() => {
    if (!activePathKey || activePathSteps.length === 0) return 0;
    const s = localStorage.getItem(LS_PATH_STEP(moduleKey, activePathKey));
    return s ? Math.min(parseInt(s), Math.max(0, activePathSteps.length - 1)) : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, activePathKey, activePathSteps.length, tourActive]);

  const tourPathLabel = useMemo(
    () => modulePaths.find(p => p.key === activePathKey)?.name,
    [modulePaths, activePathKey],
  );

  return {
    showWelcome, tourActive, startTour, startTourWithPath, dismissWelcome, closeTour,
    selectedPathKey, handleTourStepChange, tourInitialStep, tourPathLabel,
  };
}

// ─── WelcomeModal ──────────────────────────────────────────────────────────────

interface WelcomeModalProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: TourStep[];
  onStart: () => void;
  onDismiss: () => void;
  /** Parcours disponibles — quand 2+, affiche un sélecteur au lieu de la liste d'étapes */
  paths?: TourPath[];
  /** Appelé avec le pathKey choisi quand plusieurs parcours sont disponibles */
  onStartPath?: (pathKey: string) => void;
}

export function WelcomeModal({
  title, subtitle, icon: Icon, steps, onStart, onDismiss, paths, onStartPath,
}: WelcomeModalProps) {
  const showPathSelector = (paths?.length ?? 0) >= 2 && onStartPath != null;
  const [selectedPath, setSelectedPath] = useState<string>(paths?.[0]?.key ?? "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  const handleStart = () => {
    if (showPathSelector && onStartPath) {
      onStartPath(selectedPath || paths![0].key);
    } else {
      onStart();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-[#0F1A3A] to-[#162040] px-6 pt-6 pb-5 text-white">
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-primary/80 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <Sparkles className="w-3 h-3" />
                Visite guidée
              </div>
              <h2 className="text-lg font-bold leading-tight">{title}</h2>
            </div>
          </div>
          <p className="text-sm text-white/60 mt-1">{subtitle}</p>
        </div>

        {/* Path selector — shown when 2+ paths are available */}
        {showPathSelector ? (
          <div className="px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Choisissez votre parcours
            </p>
            <div className="space-y-2">
              {paths!.map((path, i) => (
                <button
                  key={path.key}
                  type="button"
                  onClick={() => setSelectedPath(path.key)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedPath === path.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5 ${
                      selectedPath === path.key ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{path.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{path.description}</div>
                      <div className="text-[11px] text-muted-foreground/60 mt-1">
                        {path.steps.length} étape{path.steps.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Steps preview — shown when only 1 path or no paths */
          <div className="px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Au programme ({steps.length} étapes)
            </p>
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={s.target} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700 leading-snug">
                    <span className="font-medium">{s.title}</span>
                    {" "}
                    <span className="text-muted-foreground">— {s.description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onDismiss}>
            Ignorer
          </Button>
          <Button size="sm" className="flex-1 gap-1.5 bg-primary hover:bg-primary/90" onClick={handleStart}>
            <BookOpen className="w-4 h-4" />
            {showPathSelector ? "Démarrer ce parcours" : "Démarrer la visite"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── OnboardingTour (spotlight overlay) ───────────────────────────────────────

interface OnboardingTourProps {
  steps: TourStep[];
  onClose: () => void;
  /** Nom du parcours affiché dans la bulle (optionnel) */
  pathLabel?: string;
  /** Étape de départ pour la reprise (optionnel, défaut = 0) */
  initialStep?: number;
  /** Callback appelé à chaque changement d'étape */
  onStepChange?: (step: number) => void;
}

const LENS_PADDING = 8;
const BUBBLE_GAP = 16;
const BUBBLE_WIDTH = 320;

function getBubblePosition(rect: DOMRect, bubbleHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceBelow = vh - (rect.bottom + LENS_PADDING);
  const spaceAbove = rect.top - LENS_PADDING;

  let top: number;
  let placement: "top" | "bottom";

  if (spaceBelow >= bubbleHeight + BUBBLE_GAP) {
    top = rect.bottom + LENS_PADDING + BUBBLE_GAP;
    placement = "bottom";
  } else if (spaceAbove >= bubbleHeight + BUBBLE_GAP) {
    top = rect.top - LENS_PADDING - BUBBLE_GAP - bubbleHeight;
    placement = "top";
  } else {
    top = rect.bottom + LENS_PADDING + BUBBLE_GAP;
    placement = "bottom";
  }

  const lensCenter = rect.left + rect.width / 2;
  let left = lensCenter - BUBBLE_WIDTH / 2;
  left = Math.max(12, Math.min(left, vw - BUBBLE_WIDTH - 12));

  return { top, left, placement };
}

export function OnboardingTour({ steps, onClose, pathLabel, initialStep = 0, onStepChange }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const goTo = useCallback((idx: number) => {
    setCurrentStep(idx);
    onStepChange?.(idx);
  }, [onStepChange]);

  const updateRect = useCallback((stepIdx: number) => {
    const step = steps[stepIdx];
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const tid = setTimeout(() => {
      setRect(el.getBoundingClientRect());
    }, 350);
    return () => clearTimeout(tid);
  }, [steps]);

  useEffect(() => {
    const cleanup = updateRect(currentStep);
    return cleanup;
  }, [currentStep, updateRect]);

  useEffect(() => {
    const handleResize = () => updateRect(currentStepRef.current);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateRect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if ((e.key === "ArrowRight" || e.key === "ArrowDown") && currentStepRef.current < steps.length - 1) {
        goTo(currentStepRef.current + 1);
      }
      if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && currentStepRef.current > 0) {
        goTo(currentStepRef.current - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [steps.length, onClose, goTo]);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const BUBBLE_HEIGHT_ESTIMATE = 210;

  const lensStyle: React.CSSProperties = rect ? {
    position: "fixed",
    top: rect.top - LENS_PADDING,
    left: rect.left - LENS_PADDING,
    width: rect.width + LENS_PADDING * 2,
    height: rect.height + LENS_PADDING * 2,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
    borderRadius: 10,
    zIndex: 9995,
    pointerEvents: "none",
    transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
    outline: "2px solid rgba(243,112,33,0.7)",
    outlineOffset: 0,
  } : {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    zIndex: 9995,
    pointerEvents: "none",
  };

  const bubblePos = rect
    ? getBubblePosition(rect, BUBBLE_HEIGHT_ESTIMATE)
    : {
        top: window.innerHeight / 2 - BUBBLE_HEIGHT_ESTIMATE / 2,
        left: window.innerWidth / 2 - BUBBLE_WIDTH / 2,
        placement: "bottom" as const,
      };

  const bubbleStyle: React.CSSProperties = {
    position: "fixed",
    top: bubblePos.top,
    left: bubblePos.left,
    width: BUBBLE_WIDTH,
    zIndex: 9999,
    transition: "top 0.25s ease, left 0.25s ease",
  };

  return createPortal(
    <>
      {/* Lens (spotlight) */}
      <div style={lensStyle} />

      {/* Bubble */}
      <div style={bubbleStyle}>
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="px-4 pt-3.5 pb-3">
            {/* Parcours label */}
            {pathLabel && (
              <div className="flex items-center gap-1 mb-2">
                <BookOpen className="w-3 h-3 text-primary/60" />
                <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide truncate">{pathLabel}</span>
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {currentStep + 1}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-slate-700 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

            {/* Action optionnelle */}
            {step.action && (
              <Link href={step.action.href} onClick={onClose}>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2.5 h-7 text-xs gap-1 w-full border-primary/30 text-primary hover:bg-primary/5"
                >
                  {step.action.label}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-3 gap-2">
              <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                Étape {currentStep + 1} / {steps.length}
              </span>
              <div className="flex gap-2">
                {!isFirst && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1"
                    onClick={() => goTo(currentStep - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Préc.
                  </Button>
                )}
                {isLast ? (
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs gap-1 bg-primary hover:bg-primary/90"
                    onClick={onClose}
                  >
                    Terminer
                    <MapPin className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1 bg-primary hover:bg-primary/90"
                    onClick={() => goTo(currentStep + 1)}
                  >
                    Suivant
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 pb-3">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? "bg-primary w-4" : "bg-slate-200 hover:bg-slate-300 w-1.5"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── GuidesPanel ──────────────────────────────────────────────────────────────

interface GuidesPanelProps {
  moduleKey: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GuidesPanel({ moduleKey, open, onOpenChange }: GuidesPanelProps) {
  const [activePath, setActivePath] = useState<string | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [tick, setTick] = useState(0);

  const paths = TOUR_PATHS[moduleKey] ?? [];

  // Fire-and-forget sync to server
  const syncProgressToServer = useCallback((pathKey: string, step: number, isDone: boolean) => {
    if (!moduleKey) return;
    const token = localStorage.getItem("auth_token") ?? "";
    fetch("/api/onboarding/tour-progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ moduleKey, pathKey, currentStep: step, isDone }),
    }).catch(() => {});
  }, [moduleKey]);

  // Refresh status badges + sync from server when panel opens
  useEffect(() => {
    if (!open) return;
    setTick(n => n + 1);
    if (!moduleKey) return;
    const token = localStorage.getItem("auth_token") ?? "";
    fetch(`/api/onboarding/tour-progress?moduleKey=${encodeURIComponent(moduleKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data: Array<{ pathKey: string; currentStep: number; isDone: boolean }> | null) => {
        if (!data) return;
        data.forEach((row) => {
          if (row.isDone) {
            localStorage.setItem(LS_PATH_DONE(moduleKey, row.pathKey), "1");
            localStorage.removeItem(LS_PATH_STEP(moduleKey, row.pathKey));
          } else if (!localStorage.getItem(LS_PATH_DONE(moduleKey, row.pathKey))) {
            localStorage.setItem(LS_PATH_STEP(moduleKey, row.pathKey), String(row.currentStep));
          }
        });
        setTick(n => n + 1);
      })
      .catch(() => {});
  }, [open, moduleKey]);

  const startPath = useCallback((pathKey: string) => {
    const path = paths.find(p => p.key === pathKey);
    if (!path) return;
    // Mark as started (step 0) immediately so status shows "in_progress"
    if (!localStorage.getItem(LS_PATH_DONE(moduleKey, pathKey))) {
      localStorage.setItem(LS_PATH_STEP(moduleKey, pathKey), "0");
      syncProgressToServer(pathKey, 0, false);
    }
    setActivePath(pathKey);
    setTourActive(true);
    onOpenChange(false);
  }, [paths, moduleKey, onOpenChange, syncProgressToServer]);

  const redoPath = useCallback((pathKey: string) => {
    resetPathProgress(moduleKey, pathKey);
    localStorage.setItem(LS_PATH_STEP(moduleKey, pathKey), "0");
    syncProgressToServer(pathKey, 0, false);
    setActivePath(pathKey);
    setTourActive(true);
    onOpenChange(false);
  }, [moduleKey, onOpenChange, syncProgressToServer]);

  const handleTourStepChange = useCallback((step: number) => {
    if (activePath) {
      const path = paths.find(p => p.key === activePath);
      if (path) {
        savePathProgress(moduleKey, activePath, step, path.steps.length);
        syncProgressToServer(activePath, step, step >= path.steps.length - 1);
      }
    }
  }, [activePath, paths, moduleKey, syncProgressToServer]);

  const handleTourClose = useCallback(() => {
    setTourActive(false);
    setActivePath(null);
    setTick(n => n + 1);
  }, []);

  const activePathObj = activePath ? (paths.find(p => p.key === activePath) ?? null) : null;
  const activeInitialStep = (activePath && activePathObj)
    ? (() => {
        const saved = localStorage.getItem(LS_PATH_STEP(moduleKey, activePath));
        return saved ? Math.min(parseInt(saved), activePathObj.steps.length - 1) : 0;
      })()
    : 0;

  // Use tick to force re-read of localStorage status in render
  void tick;

  return createPortal(
    <>
      {/* Tour runner (independent of panel visibility) */}
      {tourActive && activePathObj && (
        <OnboardingTour
          steps={activePathObj.steps}
          onClose={handleTourClose}
          pathLabel={activePathObj.name}
          initialStep={activeInitialStep}
          onStepChange={handleTourStepChange}
        />
      )}

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9800]"
            style={{ background: "rgba(0,0,0,0.15)", backdropFilter: "blur(1px)" }}
            onClick={() => onOpenChange(false)}
          />

          {/* Drawer */}
          <div className="fixed top-0 right-0 bottom-0 z-[9810] w-[360px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Guides disponibles</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {paths.length > 0
                      ? `${paths.length} parcours pour ce module`
                      : "Naviguez vers un module guidé"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-muted-foreground hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {paths.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground">
                  <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-25" />
                  <p className="text-sm font-medium">Aucun guide pour ce module</p>
                  <p className="text-xs mt-1 opacity-70">
                    Des guides sont disponibles pour : Dashboard, CRM, Projets, Factures, FP&amp;A, et plus.
                  </p>
                </div>
              ) : paths.map((path) => {
                const status = getPathStatus(moduleKey, path.key);
                const savedStepRaw = localStorage.getItem(LS_PATH_STEP(moduleKey, path.key));
                const savedStep = savedStepRaw !== null ? parseInt(savedStepRaw) : 0;

                return (
                  <div
                    key={path.key}
                    className={`rounded-xl border p-4 space-y-3 transition-colors ${
                      status === "done"
                        ? "border-emerald-200 bg-emerald-50/40"
                        : status === "in_progress"
                        ? "border-amber-200 bg-amber-50/40"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    {/* Path header */}
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : status === "in_progress" ? (
                          <Clock className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-slate-900">{path.name}</h3>
                          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                            status === "done"
                              ? "bg-emerald-100 text-emerald-700"
                              : status === "in_progress"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {status === "done" ? "Terminé" : status === "in_progress" ? "En cours" : "Non commencé"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{path.description}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {path.steps.length} étape{path.steps.length > 1 ? "s" : ""}
                          {status === "in_progress" && ` · En cours : étape ${savedStep + 1}/${path.steps.length}`}
                        </p>
                      </div>
                    </div>

                    {/* Progress track */}
                    {(status === "in_progress" || status === "done") && (
                      <div className="flex gap-1">
                        {path.steps.map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              status === "done" || i <= savedStep
                                ? status === "done" ? "bg-emerald-400" : "bg-amber-400"
                                : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {status === "done" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs gap-1.5"
                          onClick={() => redoPath(path.key)}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Revoir
                        </Button>
                      ) : status === "in_progress" ? (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90"
                            onClick={() => startPath(path.key)}
                          >
                            <Play className="w-3 h-3" />
                            Reprendre
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs px-2.5 gap-1 shrink-0"
                            onClick={() => redoPath(path.key)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Recommencer
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90"
                          onClick={() => startPath(path.key)}
                        >
                          <Play className="w-3 h-3" />
                          Démarrer le parcours
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-200 shrink-0 bg-slate-50/60">
              <p className="text-[11px] text-muted-foreground text-center">
                Utilisez ← → pour naviguer · Échap pour fermer
              </p>
            </div>
          </div>
        </>
      )}
    </>,
    document.body,
  );
}
