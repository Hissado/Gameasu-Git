import React from "react";
import { ModuleShell } from "@/components/ui/module-nav";
import {
  UsersRound, Network, GraduationCap, FileSignature, FolderArchive, GitBranch, CalendarOff,
  Banknote, Briefcase, Star, BookOpen, ArrowRightLeft, Share2, LayoutDashboard, CalendarRange,
  Settings2, Timer, BarChart3, Zap, Percent, FileText, UserPlus, Receipt, Shield, Wrench, ClipboardList,
  FileBarChart2, FileSpreadsheet, ClipboardCheck, SlidersHorizontal, ShieldCheck, Calculator, MessageSquareWarning,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Vue générale",
    items: [
      { name: "Mon espace",       path: "/rh/mon-espace",   icon: LayoutDashboard, description: "Votre espace personnel RH : demandes de congés, bulletins de paie et notifications vous concernant." },
      { name: "Vue d'ensemble",   path: "/rh",            icon: UsersRound, exact: true, description: "Tableau de bord RH : effectif total, entrées/sorties du mois, absences en cours et alertes." },
      { name: "Indicateurs RH",   path: "/rh/indicateurs", icon: BarChart3, description: "KPIs RH : taux d'absentéisme, turnover, masse salariale et répartition par département." },
      { name: "Rapports RH",      path: "/rh/rapports",    icon: FileBarChart2, description: "Rapports exportables : état des effectifs, synthèse des congés et rapport de masse salariale." },
      { name: "Simulateur de coût", path: "/rh/simulateur", icon: Calculator, description: "Simulez le coût total employeur d'un recrutement ou d'une augmentation de salaire." },
    ],
  },
  {
    label: "Employés",
    items: [
      { name: "Collaborateurs",   path: "/collaborateurs",  icon: UsersRound, description: "Fiches individuelles : informations personnelles, contrat, rémunération et historique." },
      { name: "Organigramme",     path: "/rh/organigramme",    icon: Share2, description: "Visualisez la hiérarchie et les liens managériaux de votre organisation." },
      { name: "Départements",     path: "/rh/departements", icon: Network, description: "Gérez les départements et centres de coût de votre organisation." },
      { name: "Postes",           path: "/rh/postes",   icon: GraduationCap, description: "Référentiel des postes : intitulés, grilles salariales associées et compétences requises." },
    ],
  },
  {
    label: "Temps & Présence",
    items: [
      { name: "Calendrier",        path: "/rh/calendrier-equipe",  icon: CalendarRange, description: "Planning d'équipe : visualisez les présences, absences et congés de vos collaborateurs sur le mois." },
      { name: "Feuilles de temps", path: "/rh/feuilles-temps",     icon: Timer, description: "Heures travaillées déclarées par les collaborateurs : validation et suivi par projet ou activité." },
      { name: "Grille de pointage",path: "/rh/btp-pointage",   icon: ClipboardCheck, description: "Relevé de présence quotidien au format chantier : pointages par salarié et par jour." },
      { name: "Absences & Congés", path: "/rh/conges",         icon: CalendarOff, description: "Demandes de congés : soumission, validation, soldes restants et historique des absences." },
      { name: "Politiques congés", path: "/rh/politiques-conges", icon: Settings2, description: "Configurez les règles d'acquisition, de report et de plafonnement des congés par type." },
    ],
  },
  {
    label: "Paie",
    items: [
      { name: "Fiches de paie",   path: "/rh/paie",               icon: Banknote, exact: true, description: "Préparez et validez les bulletins de paie du mois : éléments variables, retenues et net à payer." },
      { name: "États de salaires",path: "/rh/etats-paie",            icon: FileSpreadsheet, description: "Tableau récapitulatif des salaires : base, primes, déductions et totaux." },
      { name: "Calendrier paie",  path: "/rh/paie/calendrier",      icon: CalendarRange, description: "Planifiez les cycles de paie : dates de fermeture, de traitement et de virement." },
      { name: "Déclarations",     path: "/rh/paie/declarations",  icon: ClipboardList, description: "Déclarations sociales et fiscales liées à la paie : CNSS, retenues à la source et bordereau." },
      { name: "Corrections",      path: "/rh/paie/corrections",   icon: Wrench, description: "Ajustements de paie après clôture : régularisations, rappels et corrections d'éléments variables." },
      { name: "Hors-cycle",       path: "/rh/paie/hors-cycle",     icon: Zap, description: "Paiements ponctuels hors cycle mensuel : primes exceptionnelles, soldes de tout compte." },
      { name: "Fiscalité RH",     path: "/rh/fiscalite",          icon: Percent, description: "Paramètres fiscaux appliqués à la paie : barèmes d'imposition, taux de cotisations patronales." },
      { name: "Virements",        path: "/rh/virements",       icon: Banknote, description: "Suivi des virements de salaires : statut d'envoi, confirmation bancaire et historique." },
    ],
  },
  {
    label: "Talent",
    items: [
      { name: "Recrutement",  path: "/rh/recrutement", icon: Briefcase, description: "Pipeline de recrutement : offres publiées, candidatures reçues, entretiens planifiés et décisions." },
      { name: "Intégration",  path: "/rh/integration",  icon: UserPlus, description: "Parcours d'intégration des nouvelles recrues : étapes, responsables et suivi de la progression." },
      { name: "Évaluations",  path: "/rh/evaluations", icon: Star, description: "Entretiens d'évaluation : objectifs fixés, compétences évaluées et plan de développement." },
      { name: "Formations",   path: "/rh/formations",    icon: BookOpen, description: "Catalogue de formations et suivi du plan de développement des compétences de l'équipe." },
    ],
  },
  {
    label: "Réclamations",
    items: [
      { name: "Réclamations RH",    path: "/rh/reclamations",       icon: MessageSquareWarning, description: "Recevez et traitez les réclamations soumises par les collaborateurs : analyse et suivi du traitement." },
    ],
  },
  {
    label: "Administratif",
    items: [
      { name: "Contrats",           path: "/rh/contrats",           icon: FileSignature, description: "Contrats de travail : CDD, CDI, suivi des échéances et renouvellements à venir." },
      { name: "Templates contrats", path: "/rh/modeles-contrats",  icon: FileText, description: "Modèles de contrats réutilisables : créez vos trames et générez les documents en un clic." },
      { name: "Notes de frais",     path: "/rh/notes-frais",            icon: Receipt, description: "Soumission et validation des notes de frais : justificatifs, montants et remboursements." },
      { name: "Affectations",       path: "/rh/affectations",         icon: GitBranch, description: "Affectation des collaborateurs à des projets, chantiers ou équipes spécifiques." },
      { name: "Mouvements",         path: "/rh/mouvements",           icon: ArrowRightLeft, description: "Historique des mouvements RH : promotions, transferts, mutations et changements de poste." },
      { name: "Registre légal",     path: "/rh/registre-legal",      icon: BookOpen, description: "Registre du personnel obligatoire : entrées, sorties et informations légales par salarié." },
      { name: "Avantages",          path: "/rh/avantages",            icon: Shield, description: "Avantages en nature et compléments de rémunération : mutuelle, véhicule, logement, etc." },
      { name: "Documents",          path: "/rh/documents",           icon: FolderArchive, description: "Coffre-fort documentaire RH : pièces d'identité, diplômes et documents administratifs." },
    ],
  },
  {
    label: "Paramètres RH",
    items: [
      { name: "Paramètres sectoriels", path: "/rh/btp-parametres", icon: SlidersHorizontal, description: "Configuration spécifique au secteur BTP : catégories professionnelles, conventions et coefficients." },
      { name: "Journal d'audit",       path: "/rh/journal-audit",    icon: ShieldCheck, description: "Traçabilité des actions RH : qui a modifié quoi et quand dans le module ressources humaines." },
    ],
  },
];

export const HrShell = ({
  title, subtitle, children, actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <ModuleShell
    title={title}
    subtitle={subtitle}
    titleIcon={UsersRound}
    navGroups={NAV_GROUPS}
    actions={actions}
  >
    {children}
  </ModuleShell>
);
