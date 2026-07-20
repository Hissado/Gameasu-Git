import React from "react";
import { ModuleShell } from "@/components/ui/module-nav";
import {
  UsersRound, Network, Briefcase, Share2, GitBranch, ArrowRightLeft,
  BarChart3, FileBarChart2, Calculator, Zap,
  Timer, CalendarRange, CalendarOff, Settings2, ClipboardCheck,
  Banknote, Receipt, FileText, Shield, FileSpreadsheet, Wrench, SlidersHorizontal, ClipboardList, Percent,
  Star, UserPlus, BookOpen,
  FileSignature, FolderArchive,
  ShieldCheck, MessageSquareWarning,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Pilotage RH",
    items: [
      { name: "Indicateurs RH",     path: "/rh/indicateurs",  icon: BarChart3,     description: "KPIs RH : taux d'absentéisme, turnover, masse salariale et répartition par département." },
      { name: "Rapports RH",        path: "/rh/rapports",     icon: FileBarChart2, description: "Rapports exportables : état des effectifs, synthèse des congés et masse salariale." },
      { name: "Simulateur de coût", path: "/rh/simulateur",   icon: Calculator,    description: "Simulez le coût total employeur d'un recrutement ou d'une augmentation de salaire." },
      { name: "Intelligence RH",    path: "/rh/intelligence", icon: Zap,           description: "Analyses et recommandations RH basées sur vos données de paie et performance." },
    ],
  },
  {
    label: "Organisation",
    items: [
      { name: "Collaborateurs",  path: "/rh",              icon: UsersRound,     exact: true, description: "Fiches individuelles : informations personnelles, contrat, rémunération et historique." },
      { name: "Organigramme",    path: "/rh/organigramme", icon: Share2,         description: "Visualisez la hiérarchie et les liens managériaux de votre organisation." },
      { name: "Départements",    path: "/rh/departements", icon: Network,        description: "Gérez les départements et centres de coût de votre organisation." },
      { name: "Postes",          path: "/rh/postes",       icon: Briefcase,      description: "Référentiel des postes : intitulés, grilles salariales et compétences requises." },
      { name: "Affectations",    path: "/rh/affectations", icon: GitBranch,      description: "Affectation des collaborateurs à des projets, chantiers ou équipes spécifiques." },
      { name: "Mouvements",      path: "/rh/mouvements",   icon: ArrowRightLeft, description: "Historique des mouvements RH : mutations, transferts et changements de poste." },
    ],
  },
  {
    label: "Temps de travail",
    items: [
      { name: "Présences",         path: "/presences",             icon: ClipboardCheck, description: "Relevé de présence quotidien : pointages, retards et absences justifiées." },
      { name: "Feuilles de temps", path: "/rh/feuilles-temps",    icon: Timer,          description: "Heures travaillées déclarées par les collaborateurs : validation et suivi par projet." },
      { name: "Calendrier équipe", path: "/rh/calendrier-equipe", icon: CalendarRange,  description: "Planning d'équipe : présences, absences et congés du mois." },
      { name: "Congés & absences", path: "/rh/conges",            icon: CalendarOff,    description: "Demandes de congés : soumission, validation, soldes restants et historique." },
      { name: "Politiques congés", path: "/rh/politiques-conges", icon: Settings2,      description: "Configurez les règles d'acquisition, de report et de plafonnement des congés." },
    ],
  },
  {
    label: "Paie & Rémunération",
    items: [
      { name: "Bulletins de paie",   path: "/rh/paie",              icon: Banknote,          exact: true, description: "Préparez et validez les bulletins de paie du mois." },
      { name: "Avances sur salaire", path: "/rh/avances-salaire",   icon: Receipt,           description: "Demandes et validation des avances sur salaire des collaborateurs." },
      { name: "Notes de frais",      path: "/rh/notes-frais",       icon: FileText,          description: "Soumission et validation des notes de frais : justificatifs et remboursements." },
      { name: "Avantages",           path: "/rh/avantages",         icon: Shield,            description: "Avantages en nature : mutuelle, véhicule, logement et compléments de rémunération." },
      { name: "Virements",           path: "/rh/virements",         icon: FileSpreadsheet,   description: "Suivi des virements de salaires : statut d'envoi et confirmation bancaire." },
      { name: "Corrections",         path: "/rh/paie/corrections",  icon: Wrench,            description: "Ajustements après clôture : régularisations, rappels et corrections d'éléments variables." },
      { name: "Hors-cycle",          path: "/rh/paie/hors-cycle",   icon: SlidersHorizontal, description: "Paiements ponctuels hors cycle mensuel : primes exceptionnelles et soldes." },
      { name: "Déclarations",        path: "/rh/paie/declarations", icon: ClipboardList,     description: "Déclarations sociales et fiscales liées à la paie : CNSS et retenues à la source." },
      { name: "Fiscalité RH",        path: "/rh/fiscalite",         icon: Percent,           description: "Paramètres fiscaux appliqués à la paie : barèmes d'imposition et taux de cotisations." },
    ],
  },
  {
    label: "Talent",
    items: [
      { name: "Recrutement", path: "/rh/recrutement", icon: Briefcase, description: "Pipeline de recrutement : offres publiées, candidatures reçues et décisions d'embauche." },
      { name: "Intégration", path: "/rh/integration", icon: UserPlus,  description: "Parcours d'intégration des nouvelles recrues : étapes et suivi de la progression." },
      { name: "Évaluations", path: "/rh/evaluations", icon: Star,      description: "Entretiens d'évaluation : objectifs fixés, compétences évaluées et plan de développement." },
      { name: "Formations",  path: "/rh/formations",  icon: BookOpen,  description: "Catalogue de formations et suivi du plan de développement des compétences." },
    ],
  },
  {
    label: "Documents & Légal",
    items: [
      { name: "Contrats",         path: "/rh/contrats",         icon: FileSignature, description: "Contrats de travail : CDD, CDI, suivi des échéances et renouvellements." },
      { name: "Modèles contrats", path: "/rh/modeles-contrats", icon: FileText,      description: "Modèles de contrats réutilisables : créez vos trames et générez les documents." },
      { name: "Documents RH",     path: "/rh/documents",        icon: FolderArchive, description: "Coffre-fort documentaire RH : pièces d'identité, diplômes et documents administratifs." },
      { name: "Registre légal",   path: "/rh/registre-legal",   icon: BookOpen,      description: "Registre du personnel obligatoire : entrées, sorties et informations légales." },
    ],
  },
  {
    label: "Réclamations & Audit",
    items: [
      { name: "Réclamations RH", path: "/rh/reclamations",  icon: MessageSquareWarning, description: "Recevez et traitez les réclamations soumises par les collaborateurs." },
      { name: "Journal d'audit", path: "/rh/journal-audit", icon: ShieldCheck,          description: "Traçabilité des actions RH : qui a modifié quoi et quand dans le module RH." },
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
