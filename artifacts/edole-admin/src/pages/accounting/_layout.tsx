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
    items: [{ name: "Tableau de bord", path: "/accounting", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Référentiel",
    items: [
      { name: "Plan comptable", path: "/accounting/chart-of-accounts", icon: BookOpen },
      { name: "Exercices", path: "/accounting/fiscal-periods", icon: Calendar },
    ],
  },
  {
    label: "Saisie & Journaux",
    items: [
      { name: "Écritures", path: "/accounting/entries", icon: FileText },
      { name: "Lettrage", path: "/accounting/matching", icon: GitMerge },
      { name: "Grand livre", path: "/accounting/ledger", icon: BookMarked },
    ],
  },
  {
    label: "Tiers",
    items: [
      { name: "Clients", path: "/accounting/customers", icon: Users },
      { name: "Fournisseurs", path: "/accounting/suppliers", icon: Building2 },
    ],
  },
  {
    label: "Trésorerie",
    items: [
      { name: "Banques", path: "/accounting/banks", icon: Landmark },
      { name: "Rapprochement", path: "/accounting/reconciliation", icon: CheckCircle2 },
    ],
  },
  {
    label: "Gestion",
    items: [
      { name: "Immobilisations", path: "/accounting/fixed-assets", icon: HardDrive },
      { name: "Analytique", path: "/accounting/analytical", icon: BarChart2 },
      { name: "Fiscal", path: "/accounting/taxes", icon: Percent },
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
