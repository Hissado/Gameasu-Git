import React from "react";
import {
  LayoutDashboard, BookOpen, Calendar, FileText, GitMerge,
  BookMarked, Users, Building2, Landmark, CheckCircle2,
  HardDrive, BarChart2, Percent,
} from "lucide-react";
import { ModuleShell, NavGroup } from "@/components/ui/module-nav";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tableau de bord",
    items: [{ name: "Tableau de bord", path: "/comptabilite", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Référentiel",
    items: [
      { name: "Plan comptable", path: "/comptabilite/plan-comptable", icon: BookOpen },
      { name: "Exercices", path: "/comptabilite/periodes-fiscales", icon: Calendar },
    ],
  },
  {
    label: "Saisie & Journaux",
    items: [
      { name: "Écritures", path: "/comptabilite/ecritures", icon: FileText },
      { name: "Lettrage", path: "/comptabilite/lettrage", icon: GitMerge },
      { name: "Grand livre", path: "/comptabilite/grand-livre", icon: BookMarked },
    ],
  },
  {
    label: "Tiers",
    items: [
      { name: "Clients", path: "/comptabilite/clients", icon: Users },
      { name: "Fournisseurs", path: "/comptabilite/fournisseurs", icon: Building2 },
    ],
  },
  {
    label: "Trésorerie",
    items: [
      { name: "Banques", path: "/comptabilite/banques", icon: Landmark },
      { name: "Rapprochement", path: "/comptabilite/rapprochement", icon: CheckCircle2 },
    ],
  },
  {
    label: "Gestion",
    items: [
      { name: "Immobilisations", path: "/comptabilite/immobilisations", icon: HardDrive },
      { name: "Analytique", path: "/comptabilite/analytique", icon: BarChart2 },
      { name: "Fiscal", path: "/comptabilite/taxes", icon: Percent },
    ],
  },
];

export function AccountingShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ModuleShell
      title={title}
      subtitle={subtitle}
      navGroups={NAV_GROUPS}
      actions={actions}
    >
      {children}
    </ModuleShell>
  );
}
