import React from "react";
import { Link, useLocation } from "wouter";
import {
  UsersRound, Network, GraduationCap, FileSignature, FolderArchive, GitBranch, CalendarOff,
  Banknote, Briefcase, Star, BookOpen, ArrowRightLeft, Share2, LayoutDashboard, CalendarRange,
  Settings2, Timer, BarChart3, Zap, Percent, FileText, UserPlus, Receipt, Shield, Wrench,
} from "lucide-react";

const TABS = [
  { name: "Mon espace", path: "/hr/my-space", icon: LayoutDashboard },
  { name: "Vue d'ensemble", path: "/hr", icon: UsersRound, exact: true },
  { name: "Indicateurs RH", path: "/hr/indicators", icon: BarChart3 },
  { name: "Collaborateurs", path: "/collaborators", icon: UsersRound },
  { name: "Organigramme", path: "/hr/orgchart", icon: Share2 },
  { name: "Calendrier absences", path: "/hr/team-calendar", icon: CalendarRange },
  { name: "Feuilles de temps", path: "/hr/timesheets", icon: Timer },
  { name: "Absences & Congés", path: "/hr/leaves", icon: CalendarOff },
  { name: "Politiques congés", path: "/hr/leave-policies", icon: Settings2 },
  { name: "Mouvements", path: "/hr/movements", icon: ArrowRightLeft },
  { name: "Paie", path: "/hr/payroll", icon: Banknote, exact: true },
  { name: "Calendrier paie", path: "/hr/payroll/calendar", icon: CalendarRange },
  { name: "Corrections paie", path: "/hr/payroll/corrections", icon: Wrench },
  { name: "Hors-cycle", path: "/hr/payroll/off-cycle", icon: Zap },
  { name: "Fiscalité RH", path: "/hr/tax-settings", icon: Percent },
  { name: "Virements", path: "/hr/transfer-orders", icon: Banknote },
  { name: "Recrutement", path: "/hr/recruitment", icon: Briefcase },
  { name: "Onboarding", path: "/hr/onboarding", icon: UserPlus },
  { name: "Notes de frais", path: "/hr/expenses", icon: Receipt },
  { name: "Évaluations", path: "/hr/evaluations", icon: Star },
  { name: "Formations", path: "/hr/training", icon: BookOpen },
  { name: "Affectations", path: "/hr/assignments", icon: GitBranch },
  { name: "Départements", path: "/hr/departments", icon: Network },
  { name: "Postes", path: "/hr/positions", icon: GraduationCap },
  { name: "Contrats", path: "/hr/contracts", icon: FileSignature },
  { name: "Templates contrats", path: "/hr/contract-templates", icon: FileText },
  { name: "Registre légal", path: "/hr/legal-register", icon: BookOpen },
  { name: "Avantages & Conformité", path: "/hr/benefits", icon: Shield },
  { name: "Documents", path: "/hr/documents", icon: FolderArchive },
];

export const HrShell = ({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: React.ReactNode; actions?: React.ReactNode }) => {
  const [location] = useLocation();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((t) => {
            const active = t.exact ? location === t.path : location === t.path || location.startsWith(t.path + "/");
            return (
              <Link key={t.path} href={t.path} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"}`}>
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
