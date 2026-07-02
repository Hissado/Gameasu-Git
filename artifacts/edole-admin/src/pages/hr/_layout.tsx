import React from "react";
import { ModuleShell } from "@/components/ui/module-nav";
import {
  UsersRound, Network, GraduationCap, FileSignature, FolderArchive, GitBranch, CalendarOff,
  Banknote, Briefcase, Star, BookOpen, ArrowRightLeft, Share2, LayoutDashboard, CalendarRange,
  Settings2, Timer, BarChart3, Zap, Percent, FileText, UserPlus, Receipt, Shield, Wrench, ClipboardList,
  FileBarChart2, FileSpreadsheet, ClipboardCheck, SlidersHorizontal, ShieldCheck, Calculator,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Vue générale",
    items: [
      { name: "Mon espace",       path: "/rh/mon-espace",   icon: LayoutDashboard },
      { name: "Vue d'ensemble",   path: "/rh",            icon: UsersRound, exact: true },
      { name: "Indicateurs RH",   path: "/rh/indicateurs", icon: BarChart3 },
      { name: "Rapports RH",      path: "/rh/rapports",    icon: FileBarChart2 },
      { name: "Simulateur de coût", path: "/rh/simulateur", icon: Calculator },
    ],
  },
  {
    label: "Employés",
    items: [
      { name: "Collaborateurs",   path: "/collaborateurs",  icon: UsersRound },
      { name: "Organigramme",     path: "/rh/organigramme",    icon: Share2 },
      { name: "Départements",     path: "/rh/departements", icon: Network },
      { name: "Postes",           path: "/rh/postes",   icon: GraduationCap },
    ],
  },
  {
    label: "Temps & Présence",
    items: [
      { name: "Calendrier",        path: "/rh/calendrier-equipe",  icon: CalendarRange },
      { name: "Feuilles de temps", path: "/rh/feuilles-temps",     icon: Timer },
      { name: "Grille de pointage",path: "/rh/btp-pointage",   icon: ClipboardCheck },
      { name: "Absences & Congés", path: "/rh/conges",         icon: CalendarOff },
      { name: "Politiques congés", path: "/rh/politiques-conges", icon: Settings2 },
    ],
  },
  {
    label: "Paie",
    items: [
      { name: "Fiches de paie",   path: "/rh/paie",               icon: Banknote, exact: true },
      { name: "États de salaires",path: "/rh/btp-paie",              icon: FileSpreadsheet },
      { name: "Calendrier paie",  path: "/rh/paie/calendrier",      icon: CalendarRange },
      { name: "Déclarations",     path: "/rh/paie/declarations",  icon: ClipboardList },
      { name: "Corrections",      path: "/rh/paie/corrections",   icon: Wrench },
      { name: "Hors-cycle",       path: "/rh/paie/hors-cycle",     icon: Zap },
      { name: "Fiscalité RH",     path: "/rh/fiscalite",          icon: Percent },
      { name: "Virements",        path: "/rh/virements",       icon: Banknote },
    ],
  },
  {
    label: "Talent",
    items: [
      { name: "Recrutement",  path: "/rh/recrutement", icon: Briefcase },
      { name: "Intégration",  path: "/rh/integration",  icon: UserPlus },
      { name: "Évaluations",  path: "/rh/evaluations", icon: Star },
      { name: "Formations",   path: "/rh/formations",    icon: BookOpen },
    ],
  },
  {
    label: "Administratif",
    items: [
      { name: "Contrats",           path: "/rh/contrats",           icon: FileSignature },
      { name: "Templates contrats", path: "/rh/modeles-contrats",  icon: FileText },
      { name: "Notes de frais",     path: "/rh/notes-frais",            icon: Receipt },
      { name: "Affectations",       path: "/rh/affectations",         icon: GitBranch },
      { name: "Mouvements",         path: "/rh/mouvements",           icon: ArrowRightLeft },
      { name: "Registre légal",     path: "/rh/registre-legal",      icon: BookOpen },
      { name: "Avantages",          path: "/rh/avantages",            icon: Shield },
      { name: "Documents",          path: "/rh/documents",           icon: FolderArchive },
    ],
  },
  {
    label: "Paramètres RH",
    items: [
      { name: "Paramètres sectoriels", path: "/rh/btp-parametres", icon: SlidersHorizontal },
      { name: "Journal d'audit",       path: "/rh/journal-audit",    icon: ShieldCheck },
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
