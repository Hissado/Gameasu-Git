import React from "react";
import { Link, useLocation } from "wouter";
import {
  Megaphone, Send, Workflow, Users, UserSquare2, FileText, FileCode2,
  Cable, BellRing, CalendarDays, BarChart3, ShieldCheck, Target,
} from "lucide-react";

const TABS = [
  { name: "Vue d'ensemble", path: "/marketing", icon: Megaphone, exact: true },
  { name: "Campagnes", path: "/marketing/campaigns", icon: Send },
  { name: "Automatisations", path: "/marketing/automations", icon: Workflow },
  { name: "Audiences", path: "/marketing/audiences", icon: Users },
  { name: "Contacts", path: "/marketing/contacts", icon: UserSquare2 },
  { name: "Prospects", path: "/marketing/prospects", icon: Target },
  { name: "Templates", path: "/marketing/templates", icon: FileText },
  { name: "Alertes", path: "/marketing/alerts", icon: BellRing },
  { name: "Calendrier", path: "/marketing/calendar", icon: CalendarDays },
  { name: "Analytique", path: "/marketing/analytics", icon: BarChart3 },
  { name: "Consentement", path: "/marketing/consent", icon: ShieldCheck },
  { name: "Canaux", path: "/marketing/channels", icon: Cable },
  { name: "Formulaires", path: "/marketing/forms", icon: FileCode2 },
];

export const MarketingShell = ({
  title, subtitle, children, actions,
}: { title: string; subtitle?: string; children: React.ReactNode; actions?: React.ReactNode }) => {
  const [location] = useLocation();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-primary" /> {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
      </div>
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((t) => {
            const active = t.exact ? location === t.path : location === t.path || location.startsWith(t.path + "/");
            return (
              <Link key={t.path} href={t.path} className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"}`}>
                <t.icon className="w-4 h-4" />
                {t.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
};
