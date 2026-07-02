import React from "react";
import { ModuleShell } from "@/components/ui/module-nav";
import {
  UsersRound, Network, GraduationCap, FileSignature, FolderArchive, GitBranch, CalendarOff,
  Banknote, Briefcase, Star, BookOpen, ArrowRightLeft, Share2, LayoutDashboard, CalendarRange,
  Settings2, Timer, BarChart3, Zap, Percent, FileText, UserPlus, Receipt, Shield, Wrench, ClipboardList,
  FileBarChart2, FileSpreadsheet, ClipboardCheck, SlidersHorizontal, ShieldCheck,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Vue générale",
    items: [
      { name: "Mon espace",       path: "/hr/my-space",   icon: LayoutDashboard },
      { name: "Vue d'ensemble",   path: "/hr",            icon: UsersRound, exact: true },
      { name: "Indicateurs RH",   path: "/hr/indicators", icon: BarChart3 },
      { name: "Rapports RH",      path: "/hr/reports",    icon: FileBarChart2 },
    ],
  },
  {
    label: "Employés",
    items: [
      { name: "Collaborateurs",   path: "/collaborators",  icon: UsersRound },
      { name: "Organigramme",     path: "/hr/orgchart",    icon: Share2 },
      { name: "Départements",     path: "/hr/departments", icon: Network },
      { name: "Postes",           path: "/hr/positions",   icon: GraduationCap },
    ],
  },
  {
    label: "Temps & Présence",
    items: [
      { name: "Calendrier",        path: "/hr/team-calendar",  icon: CalendarRange },
      { name: "Feuilles de temps", path: "/hr/timesheets",     icon: Timer },
      { name: "Grille de pointage",path: "/hr/btp-pointage",   icon: ClipboardCheck },
      { name: "Absences & Congés", path: "/hr/leaves",         icon: CalendarOff },
      { name: "Politiques congés", path: "/hr/leave-policies", icon: Settings2 },
    ],
  },
  {
    label: "Paie",
    items: [
      { name: "Fiches de paie",   path: "/hr/payroll",               icon: Banknote, exact: true },
      { name: "États de salaires",path: "/hr/btp-paie",              icon: FileSpreadsheet },
      { name: "Calendrier paie",  path: "/hr/payroll/calendar",      icon: CalendarRange },
      { name: "Déclarations",     path: "/hr/payroll/declarations",  icon: ClipboardList },
      { name: "Corrections",      path: "/hr/payroll/corrections",   icon: Wrench },
      { name: "Hors-cycle",       path: "/hr/payroll/off-cycle",     icon: Zap },
      { name: "Fiscalité RH",     path: "/hr/tax-settings",          icon: Percent },
      { name: "Virements",        path: "/hr/transfer-orders",       icon: Banknote },
    ],
  },
  {
    label: "Talent",
    items: [
      { name: "Recrutement",  path: "/hr/recruitment", icon: Briefcase },
      { name: "Intégration",  path: "/hr/onboarding",  icon: UserPlus },
      { name: "Évaluations",  path: "/hr/evaluations", icon: Star },
      { name: "Formations",   path: "/hr/training",    icon: BookOpen },
    ],
  },
  {
    label: "Administratif",
    items: [
      { name: "Contrats",           path: "/hr/contracts",           icon: FileSignature },
      { name: "Templates contrats", path: "/hr/contract-templates",  icon: FileText },
      { name: "Notes de frais",     path: "/hr/expenses",            icon: Receipt },
      { name: "Affectations",       path: "/hr/assignments",         icon: GitBranch },
      { name: "Mouvements",         path: "/hr/movements",           icon: ArrowRightLeft },
      { name: "Registre légal",     path: "/hr/legal-register",      icon: BookOpen },
      { name: "Avantages",          path: "/hr/benefits",            icon: Shield },
      { name: "Documents",          path: "/hr/documents",           icon: FolderArchive },
    ],
  },
  {
    label: "Paramètres RH",
    items: [
      { name: "Paramètres sectoriels", path: "/hr/btp-settings", icon: SlidersHorizontal },
      { name: "Journal d'audit",       path: "/hr/audit-log",    icon: ShieldCheck },
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
