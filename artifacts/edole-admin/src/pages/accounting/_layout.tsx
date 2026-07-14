import React from "react";
import {
  LayoutDashboard, BookOpen, Calendar, FileText, GitMerge,
  BookMarked, Users, Building2, Landmark, CheckCircle2,
  HardDrive, BarChart2, Percent, Shield,
} from "lucide-react";
import { ModuleShell, NavGroup } from "@/components/ui/module-nav";
import { useModuleEnabled } from "@/components/FeatureGate";

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Tableau de bord",
    items: [{ name: "Tableau de bord", path: "/comptabilite", icon: LayoutDashboard, exact: true, description: "Vue synthétique de la comptabilité : soldes, alertes d'écritures en attente et indicateurs du mois." }],
  },
  {
    label: "Référentiel",
    items: [
      { name: "Plan comptable", path: "/comptabilite/plan-comptable", icon: BookOpen, description: "Consultez et adaptez la liste des comptes utilisés par votre organisation selon le référentiel SYSCOHADA." },
      { name: "Exercices", path: "/comptabilite/periodes-fiscales", icon: Calendar, description: "Gérez les exercices fiscaux : ouverture, clôture des périodes et verrouillage des saisies passées." },
    ],
  },
  {
    label: "Saisie & Journaux",
    items: [
      { name: "Écritures", path: "/comptabilite/ecritures", icon: FileText, description: "Saisissez et consultez les écritures comptables classées par journal : ventes, achats, banque, caisse, OD." },
      { name: "Lettrage", path: "/comptabilite/lettrage", icon: GitMerge, description: "Apurez les comptes de tiers en rapprochant les factures et les règlements correspondants." },
      { name: "Grand livre", path: "/comptabilite/grand-livre", icon: BookMarked, description: "Consultez tous les mouvements et soldes enregistrés compte par compte sur la période choisie." },
    ],
  },
  {
    label: "Tiers",
    items: [
      { name: "Clients", path: "/comptabilite/clients", icon: Users, description: "Balance âgée et historique des écritures par client : créances, règlements et soldes en cours." },
      { name: "Fournisseurs", path: "/comptabilite/fournisseurs", icon: Building2, description: "Balance âgée et historique des écritures par fournisseur : dettes, paiements et échéances." },
    ],
  },
  {
    label: "Trésorerie",
    items: [
      { name: "Banques", path: "/comptabilite/banques", icon: Landmark, description: "Gérez vos comptes bancaires : soldes, relevés et paramétrage des comptes de trésorerie." },
      { name: "Rapprochement", path: "/comptabilite/rapprochement", icon: CheckCircle2, description: "Rapprochez les relevés bancaires avec les écritures : identifiez et justifiez les écarts." },
    ],
  },
  {
    label: "Gestion",
    items: [
      { name: "Immobilisations", path: "/comptabilite/immobilisations", icon: HardDrive, description: "Gérez les actifs immobilisés : acquisitions, plans d'amortissement et cessions." },
      { name: "Analytique", path: "/comptabilite/analytique", icon: BarChart2, description: "Analyse des charges et produits par centre de coût, projet ou client pour mesurer la rentabilité." },
      { name: "Fiscal", path: "/comptabilite/taxes", icon: Percent, description: "Paramétrage des taxes, suivi de la TVA collectée et déductible, et déclarations fiscales périodiques." },
    ],
  },
];

export function AccountingShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { enabled: taxControlEnabled, loading } = useModuleEnabled("tax_control");

  const navGroups: NavGroup[] = [
    ...BASE_NAV_GROUPS,
    {
      label: "Contrôle fiscal",
      items: [
        {
          name: "Contrôle préalable",
          path: "/comptabilite/controle-fiscal",
          icon: Shield,
          locked: !loading && !taxControlEnabled,
          description: "Vérification préalable des déclarations fiscales : détection des anomalies avant soumission à l'administration.",
        },
      ],
    },
  ];

  return (
    <ModuleShell
      title={title}
      subtitle={subtitle}
      navGroups={navGroups}
      actions={actions}
    >
      {children}
    </ModuleShell>
  );
}
