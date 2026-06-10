import React from "react";
import { ModuleShell } from "@/components/ui/module-nav";
import {
  Megaphone, Send, Workflow, Users, UserSquare2, FileText, FileCode2,
  Cable, BellRing, CalendarDays, BarChart3, ShieldCheck, Target,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Vue générale",
    items: [
      { name: "Vue d'ensemble", path: "/marketing", icon: Megaphone, exact: true },
    ],
  },
  {
    label: "Exécution",
    items: [
      { name: "Campagnes",       path: "/marketing/campaigns",   icon: Send },
      { name: "Automatisations", path: "/marketing/automations", icon: Workflow },
      { name: "Calendrier",      path: "/marketing/calendar",    icon: CalendarDays },
    ],
  },
  {
    label: "Audiences",
    items: [
      { name: "Audiences",  path: "/marketing/audiences", icon: Users },
      { name: "Contacts",   path: "/marketing/contacts",  icon: UserSquare2 },
      { name: "Prospects",  path: "/marketing/prospects", icon: Target },
    ],
  },
  {
    label: "Contenu",
    items: [
      { name: "Templates",   path: "/marketing/templates", icon: FileText },
      { name: "Formulaires", path: "/marketing/forms",     icon: FileCode2 },
    ],
  },
  {
    label: "Analyse & Config",
    items: [
      { name: "Analytique",   path: "/marketing/analytics", icon: BarChart3 },
      { name: "Alertes",      path: "/marketing/alerts",    icon: BellRing },
      { name: "Canaux",       path: "/marketing/channels",  icon: Cable },
      { name: "Consentement", path: "/marketing/consent",   icon: ShieldCheck },
    ],
  },
];

export const MarketingShell = ({
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
    titleIcon={Megaphone}
    navGroups={NAV_GROUPS}
    actions={actions}
  >
    {children}
  </ModuleShell>
);
