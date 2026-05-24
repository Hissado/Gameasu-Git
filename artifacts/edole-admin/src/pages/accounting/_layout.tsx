import React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, Calendar, FileText, GitMerge,
  BookMarked, Users, Building2, Landmark, CheckCircle2,
  HardDrive, BarChart2, Percent,
} from "lucide-react";

const TAB_GROUPS = [
  {
    label: null as string | null,
    tabs: [{ path: "/accounting", label: "Tableau de bord", icon: LayoutDashboard }],
  },
  {
    label: "Référentiel",
    tabs: [
      { path: "/accounting/chart-of-accounts", label: "Plan comptable", icon: BookOpen },
      { path: "/accounting/fiscal-periods", label: "Exercices", icon: Calendar },
    ],
  },
  {
    label: "Saisie & Journaux",
    tabs: [
      { path: "/accounting/entries", label: "Écritures", icon: FileText },
      { path: "/accounting/matching", label: "Lettrage", icon: GitMerge },
      { path: "/accounting/ledger", label: "Grand livre", icon: BookMarked },
    ],
  },
  {
    label: "Tiers",
    tabs: [
      { path: "/accounting/customers", label: "Clients", icon: Users },
      { path: "/accounting/suppliers", label: "Fournisseurs", icon: Building2 },
    ],
  },
  {
    label: "Trésorerie",
    tabs: [
      { path: "/accounting/banks", label: "Banques", icon: Landmark },
      { path: "/accounting/reconciliation", label: "Rapprochement", icon: CheckCircle2 },
    ],
  },
  {
    label: "Gestion",
    tabs: [
      { path: "/accounting/fixed-assets", label: "Immobilisations", icon: HardDrive },
      { path: "/accounting/analytical", label: "Analytique", icon: BarChart2 },
      { path: "/accounting/taxes", label: "Fiscal", icon: Percent },
    ],
  },
];

export function AccountingShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [loc] = useLocation();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>

      <div className="border-b border-border overflow-x-auto">
        <nav className="flex items-end gap-0 -mb-px min-w-max">
          {TAB_GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && (
                <div className="h-8 w-px bg-slate-200 mx-2 shrink-0 self-end mb-1" />
              )}
              <div className="flex flex-col shrink-0">
                {group.label && (
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 pb-0.5 select-none">
                    {group.label}
                  </span>
                )}
                <div className="flex">
                  {group.tabs.map((t) => {
                    const Icon = t.icon;
                    const active = loc === t.path || (t.path !== "/accounting" && loc.startsWith(t.path));
                    return (
                      <Link
                        key={t.path}
                        href={t.path}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                          active
                            ? "border-amber-500 text-amber-700"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {t.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
