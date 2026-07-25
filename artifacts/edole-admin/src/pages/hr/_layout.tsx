import React from "react";
import { ModuleShell } from "@/components/ui/module-nav";
import {
  UsersRound, Network, FileSignature, FolderArchive,
  Banknote, Briefcase, BookOpen, LayoutDashboard,
  Settings2, BarChart3, FileText, UserPlus, ClipboardList,
  ClipboardCheck, ShieldCheck, Calculator, MessageSquareWarning, Scale, Archive,
} from "lucide-react";
import { RH_MODULE, type RhNode } from "@/config/rh-navigation";

// Menu secondaire RH généré depuis la SOURCE UNIQUE DE VÉRITÉ
// (config/rh-navigation.ts). La hiérarchie n'est définie qu'à un seul endroit :
// modifier l'arbre RH_MODULE met à jour menu, routes et fils d'Ariane ensemble.
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  UsersRound, LayoutDashboard, Calculator, Briefcase, UserPlus, Scale, Settings2,
  FileSignature, Network, BarChart3, ClipboardCheck, Banknote, ClipboardList,
  Archive, MessageSquareWarning, ShieldCheck, BookOpen, FileText, FolderArchive,
};

function iconFor(node: RhNode): React.ComponentType<{ className?: string }> {
  if (node.icon && ICONS[node.icon]) return ICONS[node.icon]!;
  switch (node.pageType) {
    case "workflow": return ClipboardList;
    case "library":  return BookOpen;
    case "group":    return FolderArchive;
    default:         return FileText;
  }
}

const toItem = (n: RhNode) => ({
  name: n.label, path: n.route!, icon: iconFor(n), description: n.description,
  exact: n.route === "/rh",
});

function buildNavGroups() {
  const groups: Array<{ label: string; items: ReturnType<typeof toItem>[] }> = [];
  const general: ReturnType<typeof toItem>[] = [];
  for (const node of RH_MODULE.children) {
    if (node.pageType === "group" && node.children?.length) {
      groups.push({ label: node.label, items: node.children.filter((c) => c.route).map(toItem) });
    } else if (node.children?.length) {
      // Sous-module avec page d'accueil + sous-sous-modules.
      const items = [{ ...toItem(node), name: "Vue d'ensemble" }, ...node.children.filter((c) => c.route).map(toItem)];
      groups.push({ label: node.label, items });
    } else if (node.route) {
      general.push(toItem(node));
    }
  }
  if (general.length) groups.unshift({ label: "Général", items: general });
  return groups;
}

const NAV_GROUPS = buildNavGroups();

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
