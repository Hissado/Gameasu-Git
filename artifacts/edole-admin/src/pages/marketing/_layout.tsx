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
      { name: "Vue d'ensemble", path: "/marketing", icon: Megaphone, exact: true, description: "Tableau de bord marketing : performance des campagnes actives, taux d'engagement et leads du mois." },
    ],
  },
  {
    label: "Exécution",
    items: [
      { name: "Campagnes",       path: "/marketing/campaigns",   icon: Send, description: "Créez et suivez vos campagnes email, SMS ou réseaux sociaux : envois, ouvertures et conversions." },
      { name: "Automatisations", path: "/marketing/automations", icon: Workflow, description: "Scénarios automatisés déclenchés par des actions : relances, séquences d'emails et nurturing." },
      { name: "Calendrier",      path: "/marketing/calendar",    icon: CalendarDays, description: "Planning des actions marketing : visualisez les campagnes et publications programmées sur le mois." },
    ],
  },
  {
    label: "Audiences",
    items: [
      { name: "Audiences",  path: "/marketing/audiences", icon: Users, description: "Segments de contacts définis par critères : créez des listes ciblées pour vos envois." },
      { name: "Contacts",   path: "/marketing/contacts",  icon: UserSquare2, description: "Base de contacts marketing : coordonnées, historique d'interactions et statut d'abonnement." },
      { name: "Prospects",  path: "/marketing/prospects", icon: Target, description: "Leads entrants : sources, scoring et transmission qualifiée vers l'équipe commerciale." },
    ],
  },
  {
    label: "Contenu",
    items: [
      { name: "Templates",   path: "/marketing/templates", icon: FileText, description: "Bibliothèque de modèles d'emails et messages réutilisables pour vos campagnes." },
      { name: "Formulaires", path: "/marketing/forms",     icon: FileCode2, description: "Formulaires de capture de leads à intégrer sur votre site ou landing pages." },
    ],
  },
  {
    label: "Analyse & Config",
    items: [
      { name: "Analytique",   path: "/marketing/analytics", icon: BarChart3, description: "Rapports de performance : taux d'ouverture, de clic, de conversion et ROI par campagne." },
      { name: "Alertes",      path: "/marketing/alerts",    icon: BellRing, description: "Notifications automatiques sur les seuils de performance ou les anomalies de campagne." },
      { name: "Canaux",       path: "/marketing/channels",  icon: Cable, description: "Configurez les canaux d'envoi : fournisseurs email, SMS et intégrations réseaux sociaux." },
      { name: "Consentement", path: "/marketing/consent",   icon: ShieldCheck, description: "Gestion du consentement RGPD : opt-in, opt-out et préférences de communication par contact." },
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
