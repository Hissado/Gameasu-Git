import React from "react";
import { Link, useLocation } from "wouter";
import { UsersRound, Network, GraduationCap, FileSignature, FolderArchive, GitBranch, CalendarOff, Banknote, Briefcase, Star, BookOpen, ArrowRightLeft } from "lucide-react";

const TABS = [
  { name: "Vue d'ensemble", path: "/hr", icon: UsersRound, exact: true },
  { name: "Collaborateurs", path: "/collaborators", icon: UsersRound },
  { name: "Paie", path: "/hr/payroll", icon: Banknote },
  { name: "Recrutement", path: "/hr/recruitment", icon: Briefcase },
  { name: "Évaluations", path: "/hr/evaluations", icon: Star },
  { name: "Formations", path: "/hr/training", icon: BookOpen },
  { name: "Mouvements", path: "/hr/movements", icon: ArrowRightLeft },
  { name: "Absences & Congés", path: "/hr/leaves", icon: CalendarOff },
  { name: "Affectations", path: "/hr/assignments", icon: GitBranch },
  { name: "Départements", path: "/hr/departments", icon: Network },
  { name: "Postes", path: "/hr/positions", icon: GraduationCap },
  { name: "Contrats", path: "/hr/contracts", icon: FileSignature },
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
