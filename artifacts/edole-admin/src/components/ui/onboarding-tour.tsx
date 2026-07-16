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
  rh: [
    {
      key: "decouverte",
      name: "Tableau de bord RH",
      description: "KPIs RH, effectifs actifs, masse salariale et événements du mois.",
      steps: [
        {
          target: "rh-kpis",
          title: "Indicateurs RH clés",
          description: "Vue consolidée : effectif actif, masse salariale du mois, anniversaires et fin de contrats imminents. Ces KPIs remontent automatiquement depuis les fiches collaborateurs.",
        },
        {
          target: "rh-kpis",
          title: "Répartition et activité",
          description: "Les graphiques en bas de page montrent la pyramide des âges et la répartition par département. Le calendrier remonte les événements RH (congés, anniversaires, échéances).",
        },
      ],
    },
    {
      key: "modules",
      name: "Modules RH avancés",
      description: "Paie, présences, congés et gestion des performances.",
      steps: [
        {
          target: "rh-kpis",
          title: "Gestion de la paie",
          description: "Le module Paie génère les bulletins mensuels à partir des contrats, présences et avances sur salaire. Les cotisations patronales et salariales sont calculées automatiquement.",
          action: { label: "Voir la paie", href: "/rh/paie" },
        },
        {
          target: "rh-kpis",
          title: "Présences et congés",
          description: "Enregistrez les présences quotidiennes, validez les demandes de congé et suivez les soldes. Les absences sont automatiquement prises en compte dans le calcul de la paie.",
          action: { label: "Voir les présences", href: "/presences" },
        },
      ],
    },
  ],
  comptabilite: [
    {
      key: "decouverte",
      name: "Tableau financier",
      description: "Trésorerie, créances, dettes et résultat du mois consolidés.",
      steps: [
        {
          target: "acc-kpis",
          title: "KPIs financiers",
          description: "Trésorerie totale, créances clients, dettes fournisseurs et résultat du mois — les 4 indicateurs clés de la santé financière de votre organisation, actualisés en temps réel.",
        },
        {
          target: "acc-kpis",
          title: "Graphique Produits vs Charges",
          description: "La courbe sur 6 mois met en évidence les tendances et saisonnalités. Un écart positif entre produits et charges signale un mois bénéficiaire.",
        },
      ],
    },
    {
      key: "plan",
      name: "Plan de comptes & journaux",
      description: "Naviguez dans la comptabilité SYSCOHADA et saisissez vos écritures.",
      steps: [
        {
          target: "acc-kpis",
          title: "Plan de comptes SYSCOHADA",
          description: "Le plan de comptes suit la norme SYSCOHADA révisée. Chaque compte est classé par classe (immobilisations, stocks, tiers, financiers, charges, produits).",
          action: { label: "Plan de comptes", href: "/comptabilite/plan-comptable" },
        },
        {
          target: "acc-kpis",
          title: "Journaux comptables",
          description: "Saisissez vos écritures en partie double, consultez le journal général et les journaux auxiliaires (ventes, achats, banque, caisse). Le lettrage facilite le rapprochement.",
          action: { label: "Journaux", href: "/comptabilite/journaux" },
        },
      ],
    },
  ],
  achats: [
    {
      key: "decouverte",
      name: "Vue d'ensemble Achats",
      description: "Tableau de bord des comptes fournisseurs et dépenses.",
      steps: [
        {
          target: "ach-kpis",
          title: "Indicateurs Achats",
          description: "Fournisseurs actifs, dépenses du mois, factures à échéance proche et alertes de retard — une vue synthétique de votre cycle fournisseur.",
        },
        {
          target: "ach-kpis",
          title: "Activité récente",
          description: "Les dernières réceptions, validations de factures et paiements fournisseurs apparaissent dans le fil d'activité pour un suivi en temps réel.",
        },
      ],
    },
    {
      key: "commandes",
      name: "Bons de commande & factures fournisseurs",
      description: "Gérez le cycle complet achats, de la commande au règlement.",
      steps: [
        {
          target: "ach-kpis",
          title: "Bons de commande",
          description: "Créez vos bons de commande fournisseur, suivez leur statut (brouillon, envoyé, réceptionné) et associez-les aux factures reçues pour un contrôle 3 niveaux.",
          action: { label: "Bons de commande", href: "/achats/bons-de-commande" },
        },
        {
          target: "ach-kpis",
          title: "Factures fournisseurs & règlements",
          description: "Enregistrez les factures reçues, contrôlez les montants et planifiez les règlements. La comptabilisation est automatique dès la validation.",
          action: { label: "Factures reçues", href: "/achats/factures" },
        },
      ],
    },
  ],
  clients: [
    {
      key: "decouverte",
      name: "Portefeuille clients",
      description: "Naviguez dans votre base clients B2B et accédez aux fiches détail.",
      steps: [
        {
          target: "clients-list",
          title: "Base clients B2B",
          description: "Tous vos clients avec leur secteur, statut (Actif / Prospect) et contacts principaux. Utilisez la recherche pour trouver rapidement un tiers.",
        },
        {
          target: "clients-list",
          title: "Fiche client",
          description: "Chaque fiche regroupe les coordonnées, les opportunités CRM associées, les factures, les projets et l'historique des interactions. Cliquez sur un client pour l'ouvrir.",
          action: { label: "Voir le CRM", href: "/crm" },
        },
      ],
    },
    {
      key: "suivi",
      name: "Suivi & historique",
      description: "Activités, documents et opportunities liés à chaque client.",
      steps: [
        {
          target: "clients-list",
          title: "Filtrer par statut",
          description: "Filtrez entre Actifs et Prospects pour cibler vos relances commerciales. Exportez la liste filtrée en CSV pour vos campagnes.",
        },
        {
          target: "clients-list",
          title: "Ajouter un client",
          description: "Le bouton «+ Nouveau» crée une fiche client en moins d'une minute. Les coordonnées saisies sont immédiatement disponibles dans les devis, factures et contrats.",
          action: { label: "Voir les clients", href: "/clients" },
        },
      ],
    },
  ],
  equipements: [
    {
      key: "decouverte",
      name: "Inventaire & disponibilité",
      description: "Gérez votre parc d'équipements et suivez leur état.",
      steps: [
        {
          target: "equip-list",
          title: "Catalogue équipements",
          description: "Chaque équipement affiche sa catégorie, son état (Disponible, En location, En maintenance) et sa valeur d'acquisition. Les codes couleur facilitent la lecture rapide.",
        },
        {
          target: "equip-list",
          title: "Disponibilité calendaire",
          description: "L'indicateur de disponibilité se met à jour automatiquement dès qu'un contrat de location est créé ou qu'une maintenance est planifiée.",
          action: { label: "Voir les équipements", href: "/equipements" },
        },
      ],
    },
    {
      key: "maintenance",
      name: "Maintenance & QR codes",
      description: "Planifiez les maintenances et identifiez les actifs par QR code.",
      steps: [
        {
          target: "equip-list",
          title: "Catégories d'équipements",
          description: "Organisez votre parc par catégories (véhicules, matériel BTP, informatique…). Chaque catégorie peut avoir des règles de maintenance et d'amortissement distinctes.",
          action: { label: "Voir les catégories", href: "/equipements/categories" },
        },
        {
          target: "equip-list",
          title: "QR codes d'identification",
          description: "Générez un QR code par équipement pour accéder instantanément à sa fiche depuis un smartphone : état, historique de location et prochaine maintenance.",
          action: { label: "Voir les QR codes", href: "/equipements/qr" },
        },
      ],
    },
  ],
  logistique: [
    {
      key: "decouverte",
      name: "Opérations logistiques",
      description: "Planifiez et suivez les livraisons et collectes terrain.",
      steps: [
        {
          target: "logis-list",
          title: "Journal des opérations",
          description: "Toutes les opérations de livraison et collecte liées aux contrats de location. Chaque ligne affiche l'équipement, le chauffeur assigné, l'adresse et le statut.",
        },
        {
          target: "logis-list",
          title: "Planifier une opération",
          description: "Créez une opération depuis la fiche de location. Assignez un chauffeur, renseignez l'adresse et la fenêtre horaire. Le responsable est notifié automatiquement.",
          action: { label: "Voir les locations", href: "/locations" },
        },
      ],
    },
  ],
  services: [
    {
      key: "decouverte",
      name: "Catalogue de services",
      description: "Gérez vos prestations et tarifications par client ou segment.",
      steps: [
        {
          target: "svc-list",
          title: "Catalogue des prestations",
          description: "Chaque service décrit une prestation facturable : désignation, unité, tarif HT et TVA applicable. Les services sont réutilisables dans les devis et factures.",
        },
        {
          target: "svc-list",
          title: "Créer un service",
          description: "Définissez vos prestations standards une seule fois. Lors de la création d'un devis ou d'une facture, sélectionnez-les depuis ce catalogue pour gagner du temps.",
          action: { label: "Voir les services", href: "/services" },
        },
      ],
    },
  ],
  commandes: [
    {
      key: "decouverte",
      name: "Bons de commande clients",
      description: "Suivez vos commandes de la validation à la livraison.",
      steps: [
        {
          target: "cmd-list",
          title: "Liste des commandes",
          description: "Toutes les commandes clients avec leur statut (brouillon, confirmée, livrée, annulée). Les commandes en retard de livraison s'affichent en rouge.",
        },
        {
          target: "cmd-list",
          title: "De la commande à la facture",
          description: "Une commande confirmée peut être convertie en facture en un clic. Les lignes, quantités et prix sont repris automatiquement.",
          action: { label: "Voir les factures", href: "/factures" },
        },
      ],
    },
  ],
  devis: [
    {
      key: "decouverte",
      name: "Devis & propositions",
      description: "Créez des propositions commerciales professionnelles.",
      steps: [
        {
          target: "devis-list",
          title: "Portefeuille devis",
          description: "Vos devis en cours avec leur statut (brouillon, envoyé, accepté, refusé). Le taux d'acceptation sur 30 jours est affiché en haut du tableau.",
        },
        {
          target: "devis-list",
          title: "Convertir en bon de commande",
          description: "Un devis accepté se transforme en bon de commande ou directement en facture d'un clic. Les lignes, remises et conditions sont reprises automatiquement.",
          action: { label: "Voir les commandes", href: "/commandes" },
        },
      ],
    },
  ],
  utilisateurs: [
    {
      key: "decouverte",
      name: "Gestion des utilisateurs",
      description: "Invitez les membres de votre équipe et gérez leurs droits.",
      steps: [
        {
          target: "users-list",
          title: "Annuaire des utilisateurs",
          description: "Tous les comptes ayant accès à votre espace Gaméasù : rôle, statut (actif / inactif) et dernière connexion. Seuls les Super Admins et Admins peuvent inviter de nouveaux membres.",
        },
        {
          target: "users-list",
          title: "Inviter un collaborateur",
          description: "Saisissez l'adresse email et choisissez le rôle. L'invité reçoit un email avec un lien d'activation valable 7 jours. L'accès est immédiatement limité aux modules autorisés par son rôle.",
          action: { label: "Voir les utilisateurs", href: "/utilisateurs" },
        },
      ],
    },
  ],
  parametres: [
    {
      key: "decouverte",
      name: "Paramètres de l'espace",
      description: "Configurez votre organisation, vos modules et vos préférences.",
      steps: [
        {
          target: "settings-nav",
          title: "Onglets de paramétrage",
          description: "Les paramètres sont organisés par thèmes : Profil, Sécurité, Organisation, Modules, Permissions, Comptabilité, Pointage et Zone danger. Naviguez par onglets.",
        },
        {
          target: "settings-nav",
          title: "Activer / désactiver des modules",
          description: "L'onglet Modules permet d'activer ou désactiver les fonctionnalités disponibles dans votre formule. Les modules désactivés disparaissent du menu pour tous les utilisateurs.",
          action: { label: "Aller aux paramètres", href: "/parametres" },
        },
      ],
    },
  ],
  messagerie: [
    {
      key: "decouverte",
      name: "Hub de messagerie",
      description: "Messagerie interne : DM, groupes projets et conversations clients.",
      steps: [
        {
          target: "msg-conv-list",
          title: "Liste des conversations",
          description: "Vos conversations récentes sont listées à gauche par ordre d'activité. Le badge indique les messages non lus. Cliquez pour ouvrir une conversation.",
        },
        {
          target: "msg-conv-list",
          title: "Types de conversations",
          description: "Créez des messages directs avec un collaborateur, des groupes projets avec toute une équipe, ou des fils de discussion liés à un client ou dossier.",
        },
      ],
    },
    {
      key: "fonctions",
      name: "Fonctions avancées",
      description: "Fichiers, vocaux, réactions, traduction et présence en temps réel.",
      steps: [
        {
          target: "msg-conv-list",
          title: "Pièces jointes et messages vocaux",
          description: "Partagez des fichiers (jusqu'à 25 Mo), images, PDF et messages audio directement dans la conversation. Le bouton micro lance l'enregistrement vocal.",
        },
        {
          target: "msg-conv-list",
          title: "Traduction automatique",
          description: "Chaque message peut être traduit instantanément en français, anglais, arabe, portugais ou espagnol via le menu contextuel. Idéal pour les équipes multilingues.",
        },
      ],
    },
  ],

  // ── Sous-modules comptabilité ─────────────────────────────────
  comptabilite_journaux: [
    {
      key: "saisie",
      name: "Saisie des écritures",
      description: "Créez des écritures comptables en partie double.",
      steps: [
        {
          target: "acc-kpis",
          title: "Écritures en partie double",
          description: "Chaque écriture doit être équilibrée (débit = crédit). Sélectionnez le journal, la date, les comptes et les montants. La validation enregistre l'écriture en statut «brouillon».",
          action: { label: "Écritures", href: "/comptabilite/ecritures" },
        },
        {
          target: "acc-kpis",
          title: "Journaux auxiliaires",
          description: "Consultez le journal général ou filtrez par journal auxiliaire (ventes, achats, banque, caisse). Chaque journal peut être exporté en CSV ou PDF pour votre expert-comptable.",
          action: { label: "Comptabilité", href: "/comptabilite" },
        },
      ],
    },
    {
      key: "grand_livre",
      name: "Grand livre & lettrage",
      description: "Vérifiez les soldes et rapprochez les opérations.",
      steps: [
        {
          target: "acc-kpis",
          title: "Grand livre par compte",
          description: "Consultez l'historique de toutes les opérations d'un compte dans l'ordre chronologique. Filtrez par période ou statut de lettrage. Idéal pour vérifier un solde ou retrouver une écriture.",
          action: { label: "Grand livre", href: "/comptabilite/grand-livre" },
        },
        {
          target: "acc-kpis",
          title: "Rapprochement bancaire",
          description: "Importez votre relevé bancaire (OFX, CSV) et rapprochez automatiquement les lignes aux écritures de caisse/banque. Les opérations non rapprochées sont signalées en orange.",
          action: { label: "Rapprochement", href: "/comptabilite/rapprochement" },
        },
      ],
    },
    {
      key: "cloture",
      name: "Clôture de période",
      description: "Verrouillez vos exercices et éditez les états SYSCOHADA.",
      steps: [
        {
          target: "acc-kpis",
          title: "Clôturer une période",
          description: "La clôture verrouille toutes les écritures de la période. Aucune modification n'est possible après clôture. Les soldes clôturés alimentent les états financiers définitifs.",
          action: { label: "Clôtures", href: "/comptabilite/cloture" },
        },
        {
          target: "acc-kpis",
          title: "États financiers SYSCOHADA",
          description: "Éditez le bilan, le compte de résultat et les flux de trésorerie conformes à la norme SYSCOHADA révisée, prêts pour le dépôt fiscal ou l'assemblée générale des actionnaires.",
          action: { label: "Bilan", href: "/comptabilite/bilan" },
        },
      ],
    },
  ],

  // ── Sous-modules RH ──────────────────────────────────────────
  rh_conges: [
    {
      key: "demandes",
      name: "Demandes de congés",
      description: "Validez ou refusez les demandes de congé de vos équipes.",
      steps: [
        {
          target: "rh-kpis",
          title: "File des demandes",
          description: "Toutes les demandes en attente sont listées avec le motif, la durée et le solde disponible du collaborateur. Approuvez ou refusez en un clic avec un commentaire facultatif.",
          action: { label: "Congés", href: "/rh/conges" },
        },
        {
          target: "rh-kpis",
          title: "Politiques de congé",
          description: "Définissez les règles d'acquisition (jours/mois, plafond, reports), les jours fériés et les types de congé (annuel, maladie, formation). Les soldes sont calculés automatiquement.",
          action: { label: "Politiques", href: "/rh/politiques-conges" },
        },
      ],
    },
  ],
  rh_presences: [
    {
      key: "pointages",
      name: "Pointages & présences",
      description: "Suivez les horaires et présences de vos collaborateurs.",
      steps: [
        {
          target: "rh-kpis",
          title: "Tableau de présence",
          description: "Vue quotidienne des présences, retards, absences et heures supplémentaires. Les kiosques de pointage connectés remontent les données en temps réel sans saisie manuelle.",
          action: { label: "Présences", href: "/presences" },
        },
        {
          target: "rh-kpis",
          title: "Feuilles de temps",
          description: "Les collaborateurs déclarent leurs heures par projet ou tâche. Le manager valide les feuilles en fin de semaine avant leur intégration dans le calcul de la paie.",
          action: { label: "Feuilles de temps", href: "/rh/feuilles-temps" },
        },
      ],
    },
  ],
  rh_recrutement: [
    {
      key: "pipeline",
      name: "Pipeline de recrutement",
      description: "Gérez les candidatures de l'offre à l'embauche.",
      steps: [
        {
          target: "rh-kpis",
          title: "Offres & candidatures",
          description: "Publiez vos offres d'emploi et suivez les candidatures en pipeline Kanban (reçue → entretien → test → offre → embauché). Chaque candidat reçoit des notifications automatiques à chaque étape.",
          action: { label: "Recrutement", href: "/rh/recrutement" },
        },
        {
          target: "rh-kpis",
          title: "Intégration du nouveau collaborateur",
          description: "Planifiez l'onboarding : documents à fournir, accès à créer, matériel à préparer, formation initiale. La checklist garantit qu'aucune étape critique n'est oubliée.",
          action: { label: "Intégration", href: "/rh/integration" },
        },
      ],
    },
  ],

  // ── Sous-modules FP&A ────────────────────────────────────────
  fpa_budgets: [
    {
      key: "creation",
      name: "Créer & activer un budget",
      description: "Saisissez vos budgets versionnés et activez-les.",
      steps: [
        {
          target: "fpa-kpis",
          title: "Créer un budget",
          description: "Un budget couvre une année fiscale et un périmètre (entreprise, projet, département). Saisissez les montants compte par compte (matrice SYSCOHADA × mois) ou importez depuis Excel.",
          action: { label: "Budgets", href: "/fpa/budgets" },
        },
        {
          target: "fpa-kpis",
          title: "Versionnage & duplication",
          description: "Créez des révisions budgétaires sans effacer les versions précédentes. Dupliquez un budget pour une variante Forecast. Un seul budget peut être actif par périmètre simultanément.",
          action: { label: "Voir les budgets", href: "/fpa/budgets" },
        },
      ],
    },
  ],
  fpa_analyse: [
    {
      key: "variance",
      name: "Analyse des écarts",
      description: "Comparez budgets, réalisé et prévisions en temps réel.",
      steps: [
        {
          target: "fpa-kpis",
          title: "Rapport variance",
          description: "Budget vs Réalisé par compte et par mois. Les dépassements apparaissent en rouge. Le taux d'exécution global et le top 5 des écarts sont visibles en haut du tableau.",
          action: { label: "Variance", href: "/fpa/variance" },
        },
        {
          target: "fpa-kpis",
          title: "Projection fin d'exercice",
          description: "L'atterrissage (YTD + budget restant) et la projection linéaire (extrapolation du rythme de consommation) donnent deux scénarios pour anticiper les ajustements nécessaires.",
          action: { label: "Forecast", href: "/fpa/forecast" },
        },
      ],
    },
  ],

  // ── Nouveaux modules ─────────────────────────────────────────
  marketing: [
    {
      key: "campagnes",
      name: "Campagnes & canaux",
      description: "Créez et envoyez des campagnes email, SMS et notifications.",
      steps: [
        {
          target: "mkt-campaigns",
          title: "Centre de campagnes",
          description: "Créez des campagnes email ou SMS en quelques clics : choisissez votre template, sélectionnez votre audience et planifiez l'envoi. Les statistiques (ouvertures, clics) sont disponibles en temps réel.",
          action: { label: "Campagnes", href: "/marketing/campaigns" },
        },
        {
          target: "mkt-campaigns",
          title: "Audiences & segmentation",
          description: "Segmentez vos contacts par critères (secteur, statut client, engagement, score). Les audiences dynamiques se mettent à jour automatiquement quand un contact change de segment.",
          action: { label: "Audiences", href: "/marketing/audiences" },
        },
      ],
    },
    {
      key: "analytics",
      name: "Performance & analytics",
      description: "Mesurez l'efficacité de vos actions marketing.",
      steps: [
        {
          target: "mkt-campaigns",
          title: "Tableaux de bord marketing",
          description: "Taux d'ouverture, de clic, désabonnements et ROI par campagne. Comparez les performances entre vos canaux (email, SMS, push) sur n'importe quelle période.",
          action: { label: "Analytics", href: "/marketing/analytics" },
        },
        {
          target: "mkt-campaigns",
          title: "Formulaires & lead capture",
          description: "Créez des formulaires d'acquisition intégrables sur votre site. Les prospects capturés sont automatiquement créés dans votre CRM avec le bon scoring.",
          action: { label: "Formulaires", href: "/marketing/forms" },
        },
      ],
    },
  ],
  stock: [
    {
      key: "inventaire",
      name: "Catalogue & inventaire",
      description: "Gérez vos produits, catégories et niveaux de stock.",
      steps: [
        {
          target: "stock-list",
          title: "Catalogue produits",
          description: "Tous vos produits avec référence, catégorie, unité de mesure et stock disponible. Les alertes de seuil minimum se déclenchent automatiquement pour éviter les ruptures.",
        },
        {
          target: "stock-list",
          title: "Entrepôts & emplacements",
          description: "Organisez votre stock par entrepôt ou zone. Chaque mouvement est tracé avec date, responsable et justificatif. Le stock théorique et le stock réel sont distingués.",
          action: { label: "Entrepôts", href: "/stock/entrepots" },
        },
      ],
    },
    {
      key: "mouvements",
      name: "Entrées, sorties & transferts",
      description: "Suivez tous les mouvements de marchandises.",
      steps: [
        {
          target: "stock-list",
          title: "Enregistrer un mouvement",
          description: "Créez une entrée (réception fournisseur), une sortie (livraison client) ou un transfert entre entrepôts. Le stock est mis à jour instantanément après validation.",
        },
        {
          target: "stock-list",
          title: "Inventaire physique",
          description: "Lancez un inventaire physique pour comparer stock théorique et réel. L'ajustement est comptabilisé automatiquement dans les charges/produits de régularisation.",
          action: { label: "Voir le stock", href: "/stock" },
        },
      ],
    },
  ],
  expert: [
    {
      key: "decouverte",
      name: "Portail cabinet expert",
      description: "Accédez à vos clients et gérez vos missions depuis un espace dédié.",
      steps: [
        {
          target: "expert-list",
          title: "Tableau de bord cabinet",
          description: "Vue consolidée sur tous vos clients connectés : statut de synchronisation, documents en attente et dernières activités. Passez d'un client à l'autre en un clic sans vous déconnecter.",
          action: { label: "Mes clients", href: "/expert/clients" },
        },
        {
          target: "expert-list",
          title: "Demandes de documents",
          description: "Créez des demandes de pièces justificatives auprès de vos clients (factures, relevés bancaires, contrats). Ils déposent directement dans leur espace sécurisé. Vous êtes notifié à chaque dépôt.",
          action: { label: "Documents", href: "/expert/document-requests" },
        },
      ],
    },
  ],
  documents: [
    {
      key: "decouverte",
      name: "Bibliothèque documentaire",
      description: "Centralisez, classez et partagez tous vos documents.",
      steps: [
        {
          target: "docs-list",
          title: "Organisation des fichiers",
          description: "Classez vos documents par catégorie (contrats, factures, RH, techniques) et par entité liée (projet, client, collaborateur). La recherche plein texte retrouve n'importe quel fichier instantanément.",
        },
        {
          target: "docs-list",
          title: "Partage & permissions",
          description: "Définissez qui peut voir, télécharger ou modifier chaque document. Les liens de partage sécurisés permettent d'envoyer des fichiers à des tiers sans créer de compte.",
          action: { label: "Voir les documents", href: "/documents" },
        },
      ],
    },
  ],
  rapports: [
    {
      key: "decouverte",
      name: "États financiers & exports",
      description: "Générez des rapports professionnels prêts à l'emploi.",
      steps: [
        {
          target: "rpt-list",
          title: "Catalogue de rapports",
          description: "Accédez aux états financiers SYSCOHADA (bilan, compte de résultat, flux de trésorerie, balance) et aux rapports de gestion (rentabilité par projet, analyse commerciale).",
        },
        {
          target: "rpt-list",
          title: "Export PDF & Excel",
          description: "Exportez chaque rapport en PDF formaté aux couleurs de votre organisation, ou en Excel pour des analyses complémentaires. Les rapports peuvent être envoyés par email en un clic.",
          action: { label: "Voir les rapports", href: "/rapports" },
        },
      ],
    },
  ],
  presences: [
    {
      key: "pointages",
      name: "Pointages & feuilles de temps",
      description: "Suivez les horaires, présences et feuilles de temps de vos équipes.",
      steps: [
        {
          target: "rh-kpis",
          title: "Tableau de présence quotidien",
          description: "Vue du jour : présents, absents, retards et heures supplémentaires. Les kiosques de pointage connectés remontent les données en temps réel — aucune saisie manuelle requise.",
        },
        {
          target: "rh-kpis",
          title: "Feuilles de temps par projet",
          description: "Les collaborateurs déclarent leurs heures par projet ou tâche. Le manager valide les feuilles hebdomadaires. Les heures validées alimentent automatiquement le module de paie.",
          action: { label: "Feuilles de temps", href: "/rh/feuilles-temps" },
        },
      ],
    },
  ],
};

// ─── Constants & LS helpers ─────────────────────────────────────────────────────

export const TOUR_MODULE_MAP: Record<string, string> = {
  // Général
  "/": "dashboard",
  "/briefing": "dashboard",
  "/notifications": "dashboard",
  "/alertes": "dashboard",
  "/carte": "dashboard",
  "/intelligence": "dashboard",
  "/approbations": "dashboard",
  "/assistant-ia": "dashboard",
  "/quick": "dashboard",

  // Ventes & CRM
  "/crm": "crm",
  "/clients": "clients",
  "/tarification": "clients",
  "/devis": "devis",
  "/commandes": "commandes",
  "/factures": "factures",
  "/paiements": "paiements",
  "/avoirs": "factures",
  "/recouvrement": "comptabilite",
  "/marketing": "marketing",

  // Opérations
  "/projets": "projets",
  "/portefeuille": "projets",
  "/charge": "projets",
  "/tasks": "taches",
  "/services": "services",
  "/equipements": "equipements",
  "/locations": "locations",
  "/inspections": "locations",
  "/logistique": "logistique",
  "/operations": "logistique",
  "/stock": "stock",
  "/documents": "documents",
  "/rapports": "rapports",

  // Finance — sous-modules spécialisés (exact > préfixe)
  "/comptabilite/plan-comptable": "plan_comptable",
  "/comptabilite/ecritures": "comptabilite_journaux",
  "/comptabilite/grand-livre": "comptabilite_journaux",
  "/comptabilite/balance": "comptabilite_journaux",
  "/comptabilite/rapprochement": "comptabilite_journaux",
  "/comptabilite/cloture": "comptabilite_journaux",
  "/comptabilite/bilan": "comptabilite_journaux",
  "/comptabilite/compte-de-resultat": "comptabilite_journaux",
  "/comptabilite/flux-tresorerie": "comptabilite_journaux",
  "/comptabilite/analytique": "comptabilite_journaux",
  "/comptabilite/lettrage": "comptabilite_journaux",
  "/comptabilite": "comptabilite",
  "/finance/tresorerie": "comptabilite",
  "/fiscal/moteur": "comptabilite",
  "/conformite": "comptabilite",
  "/fpa/budgets": "fpa_budgets",
  "/fpa/variance": "fpa_analyse",
  "/fpa/forecast": "fpa_analyse",
  "/fpa/cashflow": "fpa_analyse",
  "/fpa/reports": "fpa_analyse",
  "/fpa": "fpa",
  "/achats": "achats",

  // RH — sous-modules spécialisés
  "/rh/conges": "rh_conges",
  "/rh/politiques-conges": "rh_conges",
  "/rh/recrutement": "rh_recrutement",
  "/rh/integration": "rh_recrutement",
  "/rh/feuilles-temps": "rh_presences",
  "/rh/btp-pointage": "rh_presences",
  "/presences": "rh_presences",
  "/kiosques": "rh_presences",
  "/rh": "rh",
  "/collaborateurs": "collaborateurs",

  // Communication
  "/messaging": "messagerie",
  "/appels": "messagerie",

  // Expert
  "/expert": "expert",

  // Administration
  "/utilisateurs": "utilisateurs",
  "/admin": "parametres",
  "/workspace-settings": "parametres",
  "/abonnement": "parametres",
  "/automations": "parametres",
  "/parametres": "parametres",
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
      style={{ background: "rgba(0,0,0,0.18)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div
        className="relative bg-card rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — thème clair (shadcn tokens) */}
        <div className="bg-muted/60 border-b px-5 pt-5 pb-4">
          <button
            onClick={onDismiss}
            className="absolute top-3.5 right-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1 text-primary text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <Sparkles className="w-3 h-3" />
                Visite guidée
              </div>
              <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
        </div>

        {/* Path selector — shown when 2+ paths are available */}
        {showPathSelector ? (
          <div className="px-5 py-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Choisissez votre parcours
            </p>
            <div className="space-y-1.5">
              {paths!.map((path, i) => (
                <button
                  key={path.key}
                  type="button"
                  onClick={() => setSelectedPath(path.key)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    selectedPath === path.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex-shrink-0 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                      selectedPath === path.key ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground">{path.name}</div>
                      <div className="text-[11px] text-muted-foreground/70 leading-tight">
                        {path.steps.length} étape{path.steps.length > 1 ? "s" : ""} · {path.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Steps preview — shown when only 1 path or no paths */
          <div className="px-5 py-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Au programme ({steps.length} étapes)
            </p>
            <ol className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={s.target} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs text-foreground leading-snug">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted-foreground"> — {s.description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 pb-4 pt-1 space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={onDismiss}>
              Plus tard
            </Button>
            <Button size="sm" className="flex-1 h-8 text-xs gap-1 bg-primary hover:bg-primary/90" onClick={handleStart}>
              <BookOpen className="w-3.5 h-3.5" />
              {showPathSelector ? "Démarrer" : "Démarrer la visite"}
            </Button>
          </div>
          {/* Ne plus afficher */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-0.5"
          >
            Ne plus afficher cette visite
          </button>
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
const BUBBLE_GAP = 14;
const BUBBLE_WIDTH = 300;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(val, max));
}

function getBubblePosition(rect: DOMRect, bubbleHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const lp = LENS_PADDING;

  const spaceBelow = vh - (rect.bottom + lp) - BUBBLE_GAP;
  const spaceAbove = rect.top - lp - BUBBLE_GAP;
  const spaceRight = vw - (rect.right + lp) - BUBBLE_GAP;
  const spaceLeft = rect.left - lp - BUBBLE_GAP;

  const centerLeft = clamp(rect.left + rect.width / 2 - BUBBLE_WIDTH / 2, 12, vw - BUBBLE_WIDTH - 12);
  const centerTop = clamp(rect.top + rect.height / 2 - bubbleHeight / 2, 12, vh - bubbleHeight - 12);

  if (spaceBelow >= bubbleHeight) {
    return { top: rect.bottom + lp + BUBBLE_GAP, left: centerLeft, placement: "bottom" as const };
  }
  if (spaceAbove >= bubbleHeight) {
    return { top: rect.top - lp - BUBBLE_GAP - bubbleHeight, left: centerLeft, placement: "top" as const };
  }
  if (spaceRight >= BUBBLE_WIDTH) {
    return { top: centerTop, left: rect.right + lp + BUBBLE_GAP, placement: "right" as const };
  }
  if (spaceLeft >= BUBBLE_WIDTH) {
    return { top: centerTop, left: rect.left - lp - BUBBLE_GAP - BUBBLE_WIDTH, placement: "left" as const };
  }
  return { top: clamp(rect.bottom + lp + BUBBLE_GAP, 12, vh - bubbleHeight - 12), left: centerLeft, placement: "bottom" as const };
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

  const BUBBLE_HEIGHT_ESTIMATE = 220;

  // Overlay ultra-léger + ring orange autour de l'élément ciblé (pas de masque sombre)
  const lensStyle: React.CSSProperties = rect ? {
    position: "fixed",
    top: rect.top - LENS_PADDING,
    left: rect.left - LENS_PADDING,
    width: rect.width + LENS_PADDING * 2,
    height: rect.height + LENS_PADDING * 2,
    borderRadius: 10,
    zIndex: 9995,
    pointerEvents: "none",
    // voile très léger sur le reste, ring orange bien visible sur la cible
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.10), 0 0 0 2px rgba(243,112,33,0.9), 0 0 0 5px rgba(243,112,33,0.18)",
    transition: "top 0.3s cubic-bezier(0.4,0,0.2,1), left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1), height 0.3s cubic-bezier(0.4,0,0.2,1)",
  } : {
    // Cible introuvable : voile minimal, non bloquant
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.06)",
    zIndex: 9995,
    pointerEvents: "none",
  };

  const bubblePos = rect
    ? getBubblePosition(rect, BUBBLE_HEIGHT_ESTIMATE)
    : {
        top: window.innerHeight - BUBBLE_HEIGHT_ESTIMATE - 24,
        left: window.innerWidth / 2 - BUBBLE_WIDTH / 2,
        placement: "bottom" as const,
      };

  const bubbleStyle: React.CSSProperties = {
    position: "fixed",
    top: bubblePos.top,
    left: bubblePos.left,
    width: Math.min(BUBBLE_WIDTH, window.innerWidth - 24),
    zIndex: 9999,
    transition: "top 0.3s cubic-bezier(0.4,0,0.2,1), left 0.3s cubic-bezier(0.4,0,0.2,1)",
  };

  return createPortal(
    <>
      {/* Spotlight ring (voile très léger + contour orange sur la cible) */}
      <div style={lensStyle} />

      {/* Bulle de guidage */}
      <div style={bubbleStyle}>
        <div className="bg-card rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] overflow-hidden border">
          {/* Barre de progression */}
          <div className="h-0.5 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="px-4 pt-3 pb-3">
            {/* Label parcours */}
            {pathLabel && (
              <div className="flex items-center gap-1 mb-1.5">
                <BookOpen className="w-3 h-3 text-primary/50" />
                <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-wide truncate">{pathLabel}</span>
              </div>
            )}

            {/* En-tête */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 w-4.5 h-4.5 w-[18px] h-[18px] rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                  {currentStep + 1}
                </span>
                <h3 className="text-[13px] font-bold text-foreground leading-tight">{step.title}</h3>
              </div>
              <button
                onClick={onClose}
                title="Fermer la visite"
                className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

            {/* Action optionnelle */}
            {step.action && (
              <Link href={step.action.href} onClick={onClose}>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-6 text-[11px] gap-1 w-full border-primary/25 text-primary hover:bg-primary/5"
                >
                  {step.action.label}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-2.5 gap-2">
              {/* Indicateurs dots */}
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`h-1 rounded-full transition-all ${
                      i === currentStep ? "bg-primary w-4" : "bg-muted-foreground/25 hover:bg-muted-foreground/40 w-1"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-1.5 items-center">
                {!isFirst && (
                  <button
                    onClick={() => goTo(currentStep - 1)}
                    className="h-7 px-2 text-[11px] rounded-md border border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Préc.
                  </button>
                )}
                {isLast ? (
                  <button
                    onClick={onClose}
                    className="h-7 px-2.5 text-[11px] rounded-md bg-primary hover:bg-primary/90 text-white transition-colors flex items-center gap-1 font-medium"
                  >
                    Terminer
                    <MapPin className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => goTo(currentStep + 1)}
                    className="h-7 px-2.5 text-[11px] rounded-md bg-primary hover:bg-primary/90 text-white transition-colors flex items-center gap-1 font-medium"
                  >
                    Suivant
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
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
  initialPathKey?: string;
}

export function GuidesPanel({ moduleKey, open, onOpenChange, initialPathKey }: GuidesPanelProps) {
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

  // Auto-launch a specific path when opened from the Help Center
  useEffect(() => {
    if (!open || !initialPathKey) return;
    const pending = sessionStorage.getItem("aide_launch");
    if (!pending) return;
    let parsed: { moduleKey: string; pathKey: string } | null = null;
    try { parsed = JSON.parse(pending); } catch { return; }
    if (!parsed || parsed.moduleKey !== moduleKey) return;
    sessionStorage.removeItem("aide_launch");
    // Small delay so panel's server-sync effect runs first
    const t = setTimeout(() => {
      const pk = parsed!.pathKey;
      const path = paths.find(p => p.key === pk);
      if (path) {
        if (!localStorage.getItem(LS_PATH_DONE(moduleKey, pk))) {
          localStorage.setItem(LS_PATH_STEP(moduleKey, pk), "0");
          syncProgressToServer(pk, 0, false);
        }
        setActivePath(pk);
        setTourActive(true);
        onOpenChange(false);
      }
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPathKey]);

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
          <div className="fixed top-0 right-0 bottom-0 z-[9810] w-[360px] bg-card shadow-2xl border-l border flex flex-col animate-in slide-in-from-right duration-200">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Guides disponibles</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {paths.length > 0
                      ? `${paths.length} parcours pour ce module`
                      : "Naviguez vers un module guidé"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
                        : "border bg-card"
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
                          <Circle className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{path.name}</h3>
                          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                            status === "done"
                              ? "bg-emerald-100 text-emerald-700"
                              : status === "in_progress"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-muted text-muted-foreground"
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
            <div className="px-4 py-3 border-t border shrink-0 bg-muted/60">
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
